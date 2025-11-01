/**
 * Migration: Add is_test flag to conversations table
 * 
 * Allows us to generate synthetic test data without polluting real conversations.
 * Test data can be easily filtered or deleted.
 */

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, '../../data/db/ai_local.db');

console.log('=== MIGRATION: Add is_test flag ===\n');

const db = new Database(dbPath);

try {
  // Check if column already exists
  const tableInfo = db.prepare("PRAGMA table_info(assistant_chat_messages)").all();
  const hasIsTest = tableInfo.some(col => col.name === 'is_test');
  
  if (hasIsTest) {
    console.log('✅ Column is_test already exists');
  } else {
    console.log('Adding is_test column...');
    db.prepare('ALTER TABLE assistant_chat_messages ADD COLUMN is_test INTEGER DEFAULT 0').run();
    console.log('✅ Column is_test added successfully');
  }
  
  // Create index for faster test data filtering
  console.log('Creating index on is_test...');
  try {
    db.prepare('CREATE INDEX IF NOT EXISTS idx_chat_messages_is_test ON assistant_chat_messages(is_test)').run();
    console.log('✅ Index created');
  } catch (error) {
    if (error.message.includes('already exists')) {
      console.log('✅ Index already exists');
    } else {
      throw error;
    }
  }
  
  console.log('\n=== Migration Complete ===');
  
} catch (error) {
  console.error('Migration failed:', error.message);
  process.exit(1);
} finally {
  db.close();
}
