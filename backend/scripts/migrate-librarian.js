/**
 * DATABASE MIGRATION: Librarian Support Tables
 * 
 * Adds tables needed for Librarian functionality:
 * - compressed_memories: Store summaries of old conversations
 * - librarian_logs: Audit trail for table operations
 * - data_deletion_log: Privacy compliance logging
 * - Adds columns to existing tables for 3D scoring
 */

import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import logger from '../utils/logger.js';

const dbPath = path.join(__dirname, '../../data/db/ai_local.db');
const schemaPath = path.join(__dirname, '../../schema_local.sql');

console.log('🔧 Migrating database for Librarian support...\n');

try {
  const db = new Database(dbPath);
  
  // Check if database has key tables
  const tables = db.prepare(`SELECT name FROM sqlite_master WHERE type='table'`).all();
  const tableNames = tables.map(t => t.name);
  
  const hasKnowledgeChunks = tableNames.includes('knowledge_chunks');
  const hasChatMessages = tableNames.includes('assistant_chat_messages');
  
  console.log(`Found ${tableNames.length} tables in database`);
  if (tableNames.length > 0) {
    console.log(`Sample tables: ${tableNames.slice(0, 5).join(', ')}...\n`);
  } else {
    console.log('⚠️  Database appears to be empty\n');
  }
  
  // 1. Add columns to knowledge_chunks for 3D scoring (if table exists)
  if (hasKnowledgeChunks) {
    console.log('1. Adding 3D scoring columns to knowledge_chunks...');
    try {
      db.exec(`
        ALTER TABLE knowledge_chunks ADD COLUMN reference_count INTEGER DEFAULT 0;
      `);
      console.log('   ✅ Added reference_count column');
    } catch (e) {
      if (e.message.includes('duplicate column')) {
        console.log('   ⏭️  reference_count already exists');
      } else {
        throw e;
      }
    }
  
    try {
      db.exec(`
        ALTER TABLE knowledge_chunks ADD COLUMN last_accessed TEXT;
      `);
      console.log('   ✅ Added last_accessed column');
    } catch (e) {
      if (e.message.includes('duplicate column')) {
        console.log('   ⏭️  last_accessed already exists');
      } else {
        throw e;
      }
    }
  } else {
    console.log('1. ⏭️  knowledge_chunks table not found, skipping...');
  }
  
  // 2. Add columns to assistant_chat_messages for compression tracking
  console.log('\n2. Adding compression tracking to assistant_chat_messages...');
  if (hasChatMessages) {
    try {
      db.exec(`
        ALTER TABLE assistant_chat_messages ADD COLUMN is_compressed INTEGER DEFAULT 0;
      `);
      console.log('   ✅ Added is_compressed column');
    } catch (e) {
      if (e.message.includes('duplicate column')) {
        console.log('   ⏭️  is_compressed already exists');
      } else {
        throw e;
      }
    }
  } else {
    console.log('   ⏭️  assistant_chat_messages table not found, skipping...');
  }
  
  // 3. Create compressed_memories table
  console.log('\n3. Creating compressed_memories table...');
  db.exec(`
    CREATE TABLE IF NOT EXISTS compressed_memories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      original_count INTEGER NOT NULL,
      summary TEXT NOT NULL,
      compressed_at TEXT NOT NULL,
      original_date_range TEXT,
      metadata TEXT,
      FOREIGN KEY (session_id) REFERENCES assistant_chat_messages(session_id)
    );
  `);
  console.log('   ✅ compressed_memories table created');
  
  // 4. Create librarian_logs table
  console.log('\n4. Creating librarian_logs table...');
  db.exec(`
    CREATE TABLE IF NOT EXISTS librarian_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      operation TEXT NOT NULL,
      table_name TEXT NOT NULL,
      details TEXT,
      timestamp TEXT NOT NULL,
      user_id TEXT
    );
  `);
  console.log('   ✅ librarian_logs table created');
  
  // 5. Create data_deletion_log table
  console.log('\n5. Creating data_deletion_log table...');
  db.exec(`
    CREATE TABLE IF NOT EXISTS data_deletion_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      criteria TEXT NOT NULL,
      deleted_counts TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      user_id TEXT,
      reason TEXT
    );
  `);
  console.log('   ✅ data_deletion_log table created');
  
  // 6. Create indexes for performance
  console.log('\n6. Creating performance indexes...');
  
  if (hasKnowledgeChunks) {
    try {
      db.exec(`CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_reference ON knowledge_chunks(reference_count DESC);`);
      console.log('   ✅ Index on reference_count created');
    } catch (e) {
      console.log('   ⏭️  Index on reference_count already exists');
    }
  }
  
  if (hasChatMessages) {
    try {
      db.exec(`CREATE INDEX IF NOT EXISTS idx_chat_messages_compressed ON assistant_chat_messages(is_compressed, timestamp);`);
      console.log('   ✅ Index on is_compressed created');
    } catch (e) {
      console.log('   ⏭️  Index on is_compressed already exists');
    }
  }
  
  try {
    db.exec(`CREATE INDEX IF NOT EXISTS idx_compressed_memories_session ON compressed_memories(session_id);`);
    console.log('   ✅ Index on compressed_memories.session_id created');
  } catch (e) {
    console.log('   ⏭️  Index already exists');
  }
  
  db.close();
  
  console.log('\n✅ Librarian migration complete!\n');
  console.log('New capabilities:');
  console.log('  - 3D Relevance Scoring (recency, frequency, vehemence)');
  console.log('  - Memory compression and aging');
  console.log('  - Table operation audit trail');
  console.log('  - Data deletion logging for privacy compliance');
  console.log('');
  
} catch (error) {
  console.error('❌ Migration failed:', error.message);
  process.exit(1);
}
