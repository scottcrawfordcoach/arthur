// Copyright (c) 2025 Scott Crawford. All rights reserved.

import express from 'express';
import { execute } from '../services/db.js';
import logger from '../utils/logger.js';

const router = express.Router();

/**
 * POST /api/analytics/event
 * Store a client or server usage event for analytics/testing
 */
router.post('/event', async (req, res) => {
  try {
    const { type, sessionId, messageId, clientTime, payload } = req.body || {};
    if (!type) {
      return res.status(400).json({ error: 'type is required' });
    }
    execute(`
      INSERT INTO assistant_usage_events (event_type, session_id, message_id, client_time, payload)
      VALUES (?, ?, ?, ?, ?)
    `, [
      type,
      sessionId || null,
      messageId || null,
      clientTime || null,
      payload ? JSON.stringify(payload) : null
    ]);
    res.json({ success: true });
  } catch (error) {
    logger.error('Analytics event error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
