import { existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { initDatabase, closeDb } from '../services/db.js';
import logger from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const BUCKET_PATH = process.env.BUCKET_PATH || './buckets';

/**
 * Initialize database and create bucket folders
 */
async function init() {
  try {
    logger.info('Initializing ScottBot Local...');
    
    // Create bucket directories
    const buckets = ['inbox', 'converted', 'processed', 'archive', 'outputs', 'media'];
    
    for (const bucket of buckets) {
      const path = `${BUCKET_PATH}/${bucket}`;
      if (!existsSync(path)) {
        mkdirSync(path, { recursive: true });
        logger.info(`Created bucket: ${path}`);
      }
    }
    
    // Initialize database
    await initDatabase();
    logger.info('Database initialized');
    
    // Create logs directory
    if (!existsSync('./logs')) {
      mkdirSync('./logs', { recursive: true });
      logger.info('Created logs directory');
    }
    
    logger.info('✅ Initialization complete!');
    logger.info('');
    logger.info('Next steps:');
    logger.info('1. Copy .env.example to .env and fill in your API keys');
    logger.info('2. Run: npm run server (in one terminal)');
    logger.info('3. Run: npm run client (in another terminal)');
    logger.info('4. Open: http://localhost:3000');
    
    closeDb();
    process.exit(0);
  } catch (error) {
    logger.error('Initialization failed:', error);
    process.exit(1);
  }
}

init();
