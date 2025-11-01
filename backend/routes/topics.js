// Copyright (c) 2025 Scott Crawford. All rights reserved.

import express from 'express';
import { getTopicSummary, getTopicSnapshot } from '../services/topicService.js';
import logger from '../utils/logger.js';

const router = express.Router();

function parsePositiveInt(value, fallback, { min = 1, max = 200 } = {}) {
  const num = Number.parseInt(value, 10);
  if (Number.isNaN(num)) return fallback;
  return Math.max(min, Math.min(max, num));
}

function parseWindow(value, fallbackDays) {
  if (!value) return fallbackDays;
  const trimmed = String(value).trim().toLowerCase();
  const daysMatch = trimmed.match(/^(\d+)(d|day|days)$/);
  if (daysMatch) {
    return Number.parseInt(daysMatch[1], 10);
  }
  const hoursMatch = trimmed.match(/^(\d+)(h|hr|hour|hours)$/);
  if (hoursMatch) {
    const hours = Number.parseInt(hoursMatch[1], 10);
    return Math.max(1, Math.round(hours / 24));
  }
  return fallbackDays;
}

router.get('/summary', (req, res) => {
  try {
    const limit = parsePositiveInt(req.query.limit, 15, { min: 1, max: 100 });
    const windowDays = parseWindow(req.query.window, 30);
    const mode = (req.query.mode || 'session').toLowerCase();

    const items = getTopicSummary({ limit, windowDays, mode });
    res.json({ items, mode, windowDays });
  } catch (error) {
    logger.error('Topic summary error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/:topicId/snapshot', (req, res) => {
  try {
    const limit = parsePositiveInt(req.query.limit, 200, { min: 20, max: 500 });
    const mode = (req.query.mode || 'session').toLowerCase();
    const { topicId } = req.params;

    const snapshot = getTopicSnapshot(topicId, { limit, mode });
    if (!snapshot) {
      return res.status(404).json({ error: 'Topic not found' });
    }

    res.json(snapshot);
  } catch (error) {
    logger.error('Topic snapshot error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
