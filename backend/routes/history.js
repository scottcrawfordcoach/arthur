import express from 'express';
import { query, queryOne } from '../services/db.js';
import { getBundleById } from '../services/sessionBundler.js';
import { searchHistory } from '../services/topicService.js';
import logger from '../utils/logger.js';

const router = express.Router();

function summarize(text, len = 180) {
  if (!text) return '';
  const trimmed = text.replace(/\s+/g, ' ').trim();
  if (trimmed.length <= len) return trimmed;
  // Try to cut on sentence boundary
  const periodIdx = trimmed.indexOf('. ', Math.min(len, trimmed.length - 1));
  if (periodIdx > 0 && periodIdx < len + 40) {
    return trimmed.slice(0, periodIdx + 1);
  }
  return trimmed.slice(0, len) + '...';
}

function titleFromContent(text) {
  if (!text) return 'Conversation';
  const firstLine = text.split(/\n|\.\s/)[0].trim();
  const candidate = firstLine.length > 0 ? firstLine : summarize(text, 60);
  return candidate.length > 60 ? candidate.slice(0, 57) + '...' : candidate;
}

/**
 * GET /api/history/timeline
 * Returns recent assistant messages across sessions (Phase A: recency only)
 */
router.get('/timeline', async (req, res) => {
  try {
    const limit = Math.max(1, Math.min(parseInt(req.query.limit || '50', 10), 200));
    const rows = query(`
      SELECT id, session_id, item_type, content, created_at, message_count FROM (
        SELECT 
          id,
          session_id,
          'message' AS item_type,
          content,
          created_at,
          NULL AS message_count
        FROM assistant_chat_messages
        WHERE role = 'assistant'
        UNION ALL
        SELECT
          id,
          session_id,
          'bundle' AS item_type,
          summary AS content,
          COALESCE(end_created_at, created_at) AS created_at,
          message_count
        FROM assistant_chat_session_bundles
      )
      ORDER BY created_at DESC
      LIMIT ?
    `, [limit]);

    const items = rows.map(r => {
      if (r.item_type === 'bundle') {
        return {
          id: r.id,
          sessionId: r.session_id,
          itemType: 'bundle',
          title: `🗂️ Archived ${r.message_count || 0} messages`,
          summary: r.content,
          timestamp: r.created_at,
          messageCount: r.message_count || 0
        };
      }
      return {
        id: r.id,
        sessionId: r.session_id,
        itemType: 'message',
        title: titleFromContent(r.content),
        summary: summarize(r.content, 200),
        timestamp: r.created_at
      };
    });

    res.json({ items });
  } catch (error) {
    logger.error('Timeline endpoint error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/history/snapshot/:messageId
 * Returns a neighborhood around an anchor message and a minimal retrieval preview (best-effort)
 */
router.get('/snapshot/:messageId', async (req, res) => {
  try {
    const { messageId } = req.params;
    const anchor = queryOne(`
      SELECT id, session_id, role, content, created_at
      FROM assistant_chat_messages
      WHERE id = ?
    `, [messageId]);

    if (anchor) {
      const windowRows = query(`
        SELECT id, role, content, created_at
        FROM assistant_chat_messages
        WHERE session_id = ?
        ORDER BY created_at ASC
        LIMIT 200
      `, [anchor.session_id]);

      const idx = windowRows.findIndex(r => r.id === anchor.id);
      const start = Math.max(0, idx - 3);
      const end = Math.min(windowRows.length, idx + 4);
      const messages = windowRows.slice(start, end);

      return res.json({
        anchor: { id: anchor.id, sessionId: anchor.session_id, itemType: 'message' },
        messages,
        retrieved: { top: [] }
      });
    }

    const bundle = getBundleById(messageId);
    if (!bundle) {
      return res.status(404).json({ error: 'Anchor message not found' });
    }

    let bundleMessages = [];
    try {
      bundleMessages = JSON.parse(bundle.payload || '[]');
    } catch (parseErr) {
      logger.warn('Failed to parse bundle payload:', parseErr.message);
    }

    res.json({
      anchor: {
        id: bundle.id,
        sessionId: bundle.session_id,
        itemType: 'bundle',
        messageCount: bundle.message_count,
        summary: bundle.summary,
        range: {
          start: bundle.start_created_at,
          end: bundle.end_created_at
        }
      },
      messages: bundleMessages,
      retrieved: { top: [] }
    });
  } catch (error) {
    logger.error('Snapshot endpoint error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/search', (req, res) => {
  try {
    const { q, mode = 'keyword', limit } = req.query;
    if (!q || !q.trim()) {
      return res.status(400).json({ error: 'Query parameter "q" is required' });
    }

    const normalizedMode = String(mode).toLowerCase();
    if (normalizedMode !== 'keyword') {
      return res.status(400).json({ error: `Unsupported search mode: ${normalizedMode}` });
    }

    const parsedLimit = (() => {
      const n = Number.parseInt(limit, 10);
      if (Number.isNaN(n)) return 50;
      return Math.max(1, Math.min(200, n));
    })();

    const results = searchHistory({ queryText: q, limit: parsedLimit });
    res.json({ results, mode: normalizedMode });
  } catch (error) {
    logger.error('History search error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
