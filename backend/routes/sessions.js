import express from 'express';
import { listSessions, updateSessionTitle, deleteSession, backfillSessionTitles } from '../services/chatService.js';
import logger from '../utils/logger.js';

const router = express.Router();

/**
 * GET /api/sessions
 * List all chat sessions
 */
router.get('/', async (req, res) => {
  try {
    const sessions = await listSessions();
    res.json({ sessions });
  } catch (error) {
    logger.error('List sessions error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PATCH /api/sessions/:sessionId
 * Update session title
 */
router.patch('/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { title } = req.body;
    
    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }
    
    await updateSessionTitle(sessionId, title);
    res.json({ success: true });
  } catch (error) {
    logger.error('Update session error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/sessions/:sessionId
 * Delete a session
 */
router.delete('/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    await deleteSession(sessionId);
    res.json({ success: true });
  } catch (error) {
    logger.error('Delete session error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;

/**
 * POST /api/sessions/backfill-titles?limit=50
 * Generate smart titles for sessions with generic titles
 */
router.post('/backfill-titles', async (req, res) => {
  try {
    const limit = req.query.limit ?? '50';
    const strategy = req.query.strategy || 'auto'; // auto|llm|heuristic
    const model = req.query.model || undefined;
    const result = await backfillSessionTitles({ limit, strategy, model });
    res.json({ success: true, ...result });
  } catch (error) {
    logger.error('Backfill titles error:', error);
    res.status(500).json({ error: error.message });
  }
});
