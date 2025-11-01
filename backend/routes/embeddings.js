// Copyright (c) 2025 Scott Crawford. All rights reserved.

import express from 'express';
import { recallContext } from '../services/recallEngine.js';
import logger from '../utils/logger.js';

const router = express.Router();

/**
 * POST /api/embeddings/search
 * Search for similar content
 */
router.post('/search', async (req, res) => {
  try {
    const { query: searchQuery, userId, maxResults = 10, threshold = 0.7 } = req.body;
    
    if (!searchQuery) {
      return res.status(400).json({ error: 'Query is required' });
    }
    
    const context = await recallContext(searchQuery, {
      userId,
      maxResults,
      threshold
    });
    
    res.json(context);
  } catch (error) {
    logger.error('Embedding search error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
