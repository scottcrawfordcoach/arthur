import express from 'express';
import { query, execute } from '../services/db.js';
import { getProjectBuckets } from '../services/projectBuckets.js';
import logger from '../utils/logger.js';

const router = express.Router();

/**
 * GET /api/preferences
 * Get all preferences
 */
router.get('/', async (req, res) => {
  try {
    const prefs = query('SELECT * FROM assistant_preferences ORDER BY key');
    
    const prefsObject = {};
    prefs.forEach(p => {
      prefsObject[p.key] = p.value;
    });
    
  const projectBuckets = getProjectBuckets({ includeFiles: true });
  res.json({ preferences: prefsObject, projectBuckets });
  } catch (error) {
    logger.error('Get preferences error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/preferences/:key
 * Update a preference
 */
router.put('/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const { value } = req.body;
    
    if (value === undefined) {
      return res.status(400).json({ error: 'Value is required' });
    }
    
    execute(`
      INSERT INTO assistant_preferences (id, key, value, updated_at)
      VALUES (?, ?, ?, datetime('now'))
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        updated_at = datetime('now')
    `, [`pref_${key}`, key, value]);
    
    res.json({ success: true });
  } catch (error) {
    logger.error('Update preference error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/preferences/:key
 * Delete a preference
 */
router.delete('/:key', async (req, res) => {
  try {
    const { key } = req.params;
    execute('DELETE FROM assistant_preferences WHERE key = ?', [key]);
    res.json({ success: true });
  } catch (error) {
    logger.error('Delete preference error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
