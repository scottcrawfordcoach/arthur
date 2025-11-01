// Copyright (c) 2025 Scott Crawford. All rights reserved.

import express from 'express';
import multer from 'multer';
import { tmpdir } from 'os';
import { join } from 'path';
import logger from '../utils/logger.js';
import { processUploadedFile } from '../services/fileConverter.js';
import {
  getProjectBuckets,
  updateProjectBucket,
  attachFileToBucket,
  removeBucketFile,
  getProjectBucketBySlot,
  setActiveBucketForSession,
  getActiveBucketForSession
} from '../services/projectBuckets.js';

const router = express.Router();

const upload = multer({
  dest: join(tmpdir(), 'project-bucket-uploads'),
  limits: {
    fileSize: 150 * 1024 * 1024
  }
});

function parseSlotParam(slotParam) {
  const slot = Number.parseInt(slotParam, 10);
  if (!Number.isInteger(slot) || slot < 1 || slot > 4) {
    throw new Error('Slot must be between 1 and 4');
  }
  return slot;
}

router.get('/', (req, res) => {
  try {
    const includeFiles = req.query.includeFiles === 'true';
    const buckets = getProjectBuckets({ includeFiles });
    const active = req.query.sessionId ? getActiveBucketForSession(req.query.sessionId) : null;
    res.json({ buckets, activeBucket: active });
  } catch (error) {
    logger.error('Project bucket list error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.put('/:slot', (req, res) => {
  try {
    const slot = parseSlotParam(req.params.slot);
    const { name, description } = req.body;
    const bucket = updateProjectBucket(slot, { name, description });
    res.json({ bucket });
  } catch (error) {
    logger.error('Project bucket update error:', error);
    res.status(400).json({ error: error.message });
  }
});

router.post('/:slot/files', upload.single('file'), async (req, res) => {
  try {
    const slot = parseSlotParam(req.params.slot);
    const bucket = getBucketForSlot(slot);

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const uploadResult = await processUploadedFile(req.file, {
      knowledgeTier: 'project_bucket',
      tags: [`project_slot_${slot}`]
    });

    const fileId = uploadResult.isDuplicate
      ? uploadResult.duplicateInfo?.fileId
      : uploadResult.fileId;

    if (!fileId) {
      return res.status(500).json({ error: 'File processing failed' });
    }

    const association = attachFileToBucket(bucket.id, fileId);

    res.json({
      success: true,
      bucket,
      association,
      duplicate: uploadResult.isDuplicate,
      upload: uploadResult
    });
  } catch (error) {
    logger.error('Project bucket upload error:', error);
    res.status(400).json({ error: error.message });
  }
});

router.delete('/:slot/files/:associationId', (req, res) => {
  try {
    const slot = parseSlotParam(req.params.slot);
  const bucket = getBucketForSlot(slot);
    removeBucketFile(bucket.id, req.params.associationId);
    res.json({ success: true });
  } catch (error) {
    logger.error('Project bucket delete error:', error);
    res.status(400).json({ error: error.message });
  }
});

router.post('/:slot/activate', (req, res) => {
  try {
    const slot = parseSlotParam(req.params.slot);
  const bucket = getBucketForSlot(slot);
    const { sessionId } = req.body || {};
    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required' });
    }
    setActiveBucketForSession(sessionId, bucket.id);
    res.json({ success: true, activeBucket: bucket });
  } catch (error) {
    logger.error('Project bucket activate error:', error);
    res.status(400).json({ error: error.message });
  }
});

router.delete('/:slot/activate', (req, res) => {
  try {
    const slot = parseSlotParam(req.params.slot);
  const bucket = getBucketForSlot(slot);
    const sessionId = req.query.sessionId;
    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required' });
    }
    setActiveBucketForSession(sessionId, null);
    res.json({ success: true, deactivatedBucket: bucket });
  } catch (error) {
    logger.error('Project bucket deactivate error:', error);
    res.status(400).json({ error: error.message });
  }
});

function getBucketForSlot(slot) {
  const bucket = getProjectBucketBySlot(slot);
  if (!bucket) {
    throw new Error(`Bucket slot ${slot} not found`);
  }
  return bucket;
}

export default router;
