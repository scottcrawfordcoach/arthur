// Copyright (c) 2025 Scott Crawford. All rights reserved.

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables FIRST from project root
dotenv.config({ path: join(__dirname, '../.env') });

import express from 'express';
import os from 'os';
import cors from 'cors';
import logger from './utils/logger.js';
import { initDatabase } from './services/db.js';

// Import routes
import chatRoutes from './routes/chat.js';
import filesRoutes from './routes/files.js';
import embeddingsRoutes from './routes/embeddings.js';
import preferencesRoutes from './routes/preferences.js';
import archiveRoutes from './routes/archive.js';
import searchRoutes from './routes/search.js';
import sessionsRoutes from './routes/sessions.js';
import analyticsRoutes from './routes/analytics.js';
import historyRoutes from './routes/history.js';
import topicsRoutes from './routes/topics.js';
import { ensureProjectBuckets } from './services/projectBuckets.js';
import projectBucketsRoutes from './routes/projectBuckets.js';

const app = express();
const PORT = process.env.PORT || 3001;

function getLanIP() {
  try {
    const nets = os.networkInterfaces();
    for (const name of Object.keys(nets)) {
      for (const net of nets[name] || []) {
        if (net.family === 'IPv4' && !net.internal) {
          if (/^(10\.|172\.(1[6-9]|2\d|3[0-1])\.|192\.168\.)/.test(net.address)) {
            return net.address;
          }
        }
      }
    }
  } catch {}
  return undefined;
}

const LAN_HOST = process.env.DEV_HOST || getLanIP();

// Middleware
// Allow localhost and LAN dev host for mobile testing
const allowedOrigins = new Set([
  'http://localhost:3000',
  LAN_HOST ? `http://${LAN_HOST}:3000` : null
].filter(Boolean));

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); // direct curl / mobile address bar
    return cb(null, allowedOrigins.has(origin));
  },
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// Initialize database
try {
  await initDatabase();
  ensureProjectBuckets();
  logger.info('Database initialized successfully');
} catch (error) {
  logger.error('Failed to initialize database:', error);
  process.exit(1);
}

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/chat', chatRoutes);
app.use('/api/files', filesRoutes);
app.use('/api/embeddings', embeddingsRoutes);
app.use('/api/preferences', preferencesRoutes);
app.use('/api/archive', archiveRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/sessions', sessionsRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/topics', topicsRoutes);
app.use('/api/project-buckets', projectBucketsRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Server error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  logger.info(`🚀 ScottBot Local server running on http://localhost:${PORT}`);
  logger.info(`📱 Accessible on LAN at http://${LAN_HOST || '<your-ip>'}:${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  logger.info('Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Shutting down gracefully...');
  process.exit(0);
});
