// Copyright (c) 2025 Scott Crawford. All rights reserved.

import express from 'express';
import { query } from '../services/db.js';
import logger from '../utils/logger.js';

const router = express.Router();

/**
 * GET /api/archive
 * Get archived content
 */
router.get('/', async (req, res) => {
  try {
    const archives = query(`
      SELECT * FROM assistant_archive 
      ORDER BY archived_at DESC 
      LIMIT 50
    `);
    
    res.json({ archives });
  } catch (error) {
    logger.error('Get archive error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
