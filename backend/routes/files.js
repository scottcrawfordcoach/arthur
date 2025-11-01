// Copyright (c) 2025 Scott Crawford. All rights reserved.

import express from 'express';
import multer from 'multer';
import { tmpdir } from 'os';
import { join } from 'path';
import { processUploadedFile } from '../services/fileConverter.js';
import { query } from '../services/db.js';
import logger from '../utils/logger.js';

const router = express.Router();

// Configure multer for file uploads
const upload = multer({
  dest: join(tmpdir(), 'scottbot-uploads'),
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB limit
  }
});

/**
 * POST /api/files/upload
 * Upload and process a file
 */
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const { knowledgeTier = 'reference_library', userId, tags } = req.body;
    
    // Parse tags if string
    const parsedTags = typeof tags === 'string' ? JSON.parse(tags) : (tags || []);
    
    logger.info(`File upload: ${req.file.originalname} (tier: ${knowledgeTier})`);
    
    const result = await processUploadedFile(req.file, {
      userId,
      knowledgeTier,
      tags: parsedTags
    });
    
    // Handle duplicate detection
    if (result.isDuplicate) {
      return res.json({
        success: true,
        isDuplicate: true,
        duplicate: result.duplicateInfo,
        file: {
          originalName: result.originalName,
          fileHash: result.fileHash
        }
      });
    }
    
    res.json({
      success: true,
      isDuplicate: false,
      file: result
    });
    
  } catch (error) {
    logger.error('File upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/files
 * List all files
 */
router.get('/', async (req, res) => {
  try {
    const { userId, fileType, status } = req.query;
    
    let sql = 'SELECT * FROM assistant_files WHERE 1=1';
    const params = [];
    
    if (userId) {
      sql += ' AND user_id = ?';
      params.push(userId);
    }
    
    if (fileType) {
      sql += ' AND file_type = ?';
      params.push(fileType);
    }
    
    if (status) {
      sql += ' AND conversion_status = ?';
      params.push(status);
    }
    
    sql += ' ORDER BY processed_at DESC';
    
    const files = query(sql, params);
    
    res.json({ files });
  } catch (error) {
    logger.error('List files error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/files/:fileId
 * Get file details
 */
router.get('/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;
    
    const file = query(
      'SELECT * FROM assistant_files WHERE id = ?',
      [fileId]
    )[0];
    
    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    // Get chunks if available
    const chunks = query(
      'SELECT * FROM assistant_chunks WHERE file_id = ? ORDER BY chunk_index',
      [fileId]
    );
    
    res.json({
      file,
      chunks
    });
  } catch (error) {
    logger.error('Get file error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/files/:fileId
 * Delete a file
 */
router.delete('/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;
    const { execute } = await import('../services/db.js');
    
    // Delete chunks and embeddings first
    execute('DELETE FROM assistant_chunks WHERE file_id = ?', [fileId]);
    execute('DELETE FROM assistant_embeddings WHERE source_id LIKE ?', [`${fileId}%`]);
    execute('DELETE FROM assistant_files WHERE id = ?', [fileId]);
    
    res.json({ success: true });
  } catch (error) {
    logger.error('Delete file error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
