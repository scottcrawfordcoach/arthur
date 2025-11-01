import express from 'express';
import { webSearch } from '../services/webSearch.js';
import logger from '../utils/logger.js';

const router = express.Router();

/**
 * POST /api/search
 * Perform web search
 */
router.post('/', async (req, res) => {
  try {
    const { query, maxResults = 5 } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }
    
    const results = await webSearch(query, { maxResults });
    
    res.json(results);
  } catch (error) {
    logger.error('Web search error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
