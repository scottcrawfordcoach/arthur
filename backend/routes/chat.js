import express from 'express';
import { arthur } from '../services/Arthur.js';
import logger from '../utils/logger.js';
import { execute, queryOne, query } from '../services/db.js';

const router = express.Router();

/**
 * POST /api/chat
 * Send a chat message through ARTHUR system
 */
router.post('/', async (req, res) => {
  try {
    const { message, sessionId, userId } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }
    
    const result = await arthur.processMessage(message, {
      sessionId,
      userId: userId || 'default',
      stream: true
    });
    
    // Set up SSE headers for streaming
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    // Send initial metadata (include serverTime for timestamped bubbles)
    res.write(`data: ${JSON.stringify({
      type: 'metadata',
      sessionId: result.sessionId,
      streamId: result.streamId,
      userMessageId: result.userMessageId,
      serverTime: new Date().toISOString()
    })}\n\n`);
    
    // Stream the response
    let fullResponse = '';
    
    try {
      for await (const chunk of result.stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          fullResponse += content;
          res.write(`data: ${JSON.stringify({
            type: 'content',
            content
          })}\n\n`);
        }
      }
      
      // Save complete assistant message
      const { saveMessage } = await import('../services/chatService.js');
      const assistantMessageId = await saveMessage(
        result.sessionId,
        'assistant',
        fullResponse
      );

      // Persist transcript (if available)
      try {
        if (result.transcript) {
          const t = result.transcript;
          execute(`
            INSERT INTO assistant_roundtable_traces (
              message_id, session_id, started_at, completed_at, total_ms,
              council_json, librarian_json, herald_json, advisory_json, synthesis_json, errors_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            assistantMessageId,
            result.sessionId,
            t.startedAt || null,
            t.completedAt || null,
            t.totalMs || null,
            JSON.stringify(t.council || {}),
            JSON.stringify(t.librarian || {}),
            JSON.stringify(t.herald || {}),
            JSON.stringify(t.advisory || {}),
            JSON.stringify(t.synthesis || {}),
            JSON.stringify(t.errors || [])
          ]);
        }
      } catch (traceErr) {
        logger.warn('Failed to persist transcript trace:', traceErr.message);
      }
      
      // Fetch saved created_at for assistant message
      let createdAt = null;
      try {
        const row = queryOne(`SELECT created_at FROM assistant_chat_messages WHERE id = ?`, [assistantMessageId]);
        createdAt = row?.created_at || null;
      } catch (tsErr) {
        logger.warn('Failed to fetch assistant message timestamp:', tsErr.message);
      }

      // Send completion event
      res.write(`data: ${JSON.stringify({
        type: 'done',
        messageId: assistantMessageId,
        fullContent: fullResponse,
        createdAt
      })}\n\n`);

      // Token usage (approximate for streaming): store char count and estimated tokens
      try {
        const model = result.transcript?.synthesis?.model || null;
        const charCount = fullResponse.length;
        const totalTokensEst = Math.round(charCount / 4);
        execute(`
          INSERT INTO assistant_token_usage (message_id, model, prompt_tokens, completion_tokens, total_tokens, is_estimate, char_count)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
          assistantMessageId,
          model,
          null,
          null,
          totalTokensEst,
          1,
          charCount
        ]);
      } catch (tokErr) {
        logger.warn('Failed to persist estimated token usage:', tokErr.message);
      }
      
    } catch (streamError) {
      if (streamError.name === 'AbortError') {
        res.write(`data: ${JSON.stringify({
          type: 'aborted'
        })}\n\n`);
      } else {
        throw streamError;
      }
    }
    
    res.end();
    
  } catch (error) {
    logger.error('Chat endpoint error:', error);
    // Persist error for analytics
    try {
      execute(`
        INSERT INTO assistant_errors (component, code, message, stack, context)
        VALUES (?, ?, ?, ?, ?)
      `, [
        'chat_route',
        error.code || null,
        error.message || String(error),
        error.stack || null,
        JSON.stringify({ path: req.path })
      ]);
    } catch (logErr) {
      logger.warn('Failed to persist chat error:', logErr.message);
    }
    
    if (res.headersSent) {
      res.write(`data: ${JSON.stringify({
        type: 'error',
        error: error.message
      })}\n\n`);
      res.end();
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

/**
 * POST /api/chat/abort
 * Abort a streaming chat
 */
router.post('/abort', async (req, res) => {
  try {
    const { streamId } = req.body;
    
    if (!streamId) {
      return res.status(400).json({ error: 'streamId is required' });
    }
    
    const aborted = arthur.abortStream(streamId);
    
    res.json({ 
      success: aborted,
      message: aborted ? 'Stream aborted' : 'Stream not found'
    });
  } catch (error) {
    logger.error('Abort endpoint error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/chat/:sessionId/history
 * Get chat history for a session
 */
router.get('/:sessionId/history', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const history = await arthur.getSessionHistory(sessionId);
    res.json({ history });
  } catch (error) {
    logger.error('History endpoint error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/chat/metrics
 * Get Arthur system metrics
 */
router.get('/metrics', async (req, res) => {
  try {
    const metrics = arthur.getMetrics();
    res.json({ metrics });
  } catch (error) {
    logger.error('Metrics endpoint error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/chat/:messageId/trace
 * Fetch Roundtable transcript for a specific assistant message
 */
router.get('/:messageId/trace', async (req, res) => {
  try {
    const { messageId } = req.params;
    const row = queryOne(`
      SELECT message_id, session_id, started_at, completed_at, total_ms,
             council_json, librarian_json, herald_json, advisory_json, synthesis_json, errors_json,
             created_at
      FROM assistant_roundtable_traces
      WHERE message_id = ?
    `, [messageId]);
    if (!row) {
      return res.status(404).json({ error: 'Trace not found' });
    }
    const payload = {
      messageId: row.message_id,
      sessionId: row.session_id,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      totalMs: row.total_ms,
      council: safeParse(row.council_json, {}),
      librarian: safeParse(row.librarian_json, {}),
      herald: safeParse(row.herald_json, {}),
      advisory: safeParse(row.advisory_json, {}),
      synthesis: safeParse(row.synthesis_json, {}),
      errors: safeParse(row.errors_json, []),
      createdAt: row.created_at
    };
    res.json({ trace: payload });
  } catch (error) {
    logger.error('Trace fetch error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/chat/traces/recent?limit=50
 * Fetch recent transcript summaries
 */
router.get('/traces/recent', async (req, res) => {
  try {
    const limit = Math.max(1, Math.min(parseInt(req.query.limit || '50', 10), 200));
    const rows = query(`
      SELECT message_id, session_id, total_ms, created_at
      FROM assistant_roundtable_traces
      ORDER BY created_at DESC
      LIMIT ?
    `, [limit]);
    res.json({ traces: rows });
  } catch (error) {
    logger.error('Recent traces error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Helper for safe JSON parsing
function safeParse(text, fallback) {
  try {
    return text ? JSON.parse(text) : fallback;
  } catch {
    return fallback;
  }
}

export default router;
