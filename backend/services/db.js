import Database from 'better-sqlite3';
import { readFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import logger from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DB_PATH = process.env.DATABASE_URL || './data/db/ai_local.db';
let db = null;

/**
 * Initialize SQLite database with schema
 */
export async function initDatabase() {
  try {
    // Ensure directory exists
    const dbDir = dirname(DB_PATH);
    if (!existsSync(dbDir)) {
      mkdirSync(dbDir, { recursive: true });
      logger.info(`Created database directory: ${dbDir}`);
    }

    // Connect to database
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');

    logger.info(`Connected to database: ${DB_PATH}`);

    // Check if database is empty (needs initialization)
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    
    if (tables.length === 0) {
      logger.info('Empty database detected, running schema initialization...');
      
      // Read and execute schema
      const schemaPath = join(__dirname, '../../schema_local.sql');
      const schema = readFileSync(schemaPath, 'utf8');
      
      // Execute entire schema at once (SQLite supports this)
      db.exec(schema);
      
      // Verify tables were created
      const createdTables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
      logger.info(`Database schema initialized successfully - created ${createdTables.length} tables`);
    } else {
      logger.info(`Database already initialized with ${tables.length} tables`);
    }

  // Ensure auxiliary tables exist (idempotent)
  ensureRoundtableTracesTable();
  ensureAnalyticsTables();
  ensureConvenienceIndices();

    return db;
  } catch (error) {
    logger.error('Database initialization failed:', error);
    throw error;
  }
}

/**
 * Get database connection
 */
export function getDb() {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

/**
 * Close database connection
 */
export function closeDb() {
  if (db) {
    db.close();
    db = null;
    logger.info('Database connection closed');
  }
}

/**
 * Execute a query with parameters
 */
export function query(sql, params = []) {
  const db = getDb();
  return db.prepare(sql).all(params);
}

/**
 * Execute a single-row query
 */
export function queryOne(sql, params = []) {
  const db = getDb();
  return db.prepare(sql).get(params);
}

/**
 * Execute an insert/update/delete query
 */
export function execute(sql, params = []) {
  const db = getDb();
  return db.prepare(sql).run(params);
}

/**
 * Begin a transaction
 */
export function transaction(fn) {
  const db = getDb();
  return db.transaction(fn)();
}

/**
 * Ensure Roundtable traces table exists (idempotent)
 */
function ensureRoundtableTracesTable() {
  const db = getDb();
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS assistant_roundtable_traces (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        message_id TEXT NOT NULL,
        session_id TEXT NOT NULL,
        started_at TEXT,
        completed_at TEXT,
        total_ms INTEGER,
        council_json TEXT,
        librarian_json TEXT,
        herald_json TEXT,
        advisory_json TEXT,
        synthesis_json TEXT,
        errors_json TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_traces_message ON assistant_roundtable_traces(message_id);
      CREATE INDEX IF NOT EXISTS idx_traces_session_created ON assistant_roundtable_traces(session_id, created_at DESC);
    `);
  } catch (err) {
    logger.warn('Failed ensuring assistant_roundtable_traces table:', err.message);
  }
}

/**
 * Ensure analytics tables exist (usage events, token usage, errors)
 */
function ensureAnalyticsTables() {
  const db = getDb();
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS assistant_usage_events (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        event_type TEXT NOT NULL,
        session_id TEXT,
        message_id TEXT,
        client_time TEXT,
        payload TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_usage_events_created ON assistant_usage_events(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_usage_events_session ON assistant_usage_events(session_id, created_at DESC);

      CREATE TABLE IF NOT EXISTS assistant_token_usage (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        message_id TEXT,
        model TEXT,
        prompt_tokens INTEGER,
        completion_tokens INTEGER,
        total_tokens INTEGER,
        is_estimate INTEGER DEFAULT 0,
        char_count INTEGER,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_token_usage_message ON assistant_token_usage(message_id);
      
      CREATE TABLE IF NOT EXISTS assistant_errors (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        component TEXT,
        code TEXT,
        message TEXT,
        stack TEXT,
        context TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_errors_created ON assistant_errors(created_at DESC);
    `);
  } catch (err) {
    logger.warn('Failed ensuring analytics tables:', err.message);
  }
}

/**
 * Helpful indexes for common queries (idempotent)
 */
function ensureConvenienceIndices() {
  const db = getDb();
  try {
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_chat_messages_role_created ON assistant_chat_messages(role, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_chat_messages_session_created ON assistant_chat_messages(session_id, created_at DESC);
    `);
  } catch (err) {
    logger.warn('Failed ensuring convenience indices:', err.message);
  }
}

export default {
  initDatabase,
  getDb,
  closeDb,
  query,
  queryOne,
  execute,
  transaction
};
