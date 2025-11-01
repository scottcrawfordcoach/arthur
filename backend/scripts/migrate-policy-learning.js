/**
 * Migration: Add Policy Learning Tables
 */

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, '../../data/db/ai_local.db');
const db = new Database(dbPath);

console.log('🔄 Running migration: Add Policy Learning tables...\n');

try {
  // Add user preferences table
  db.exec(`
    CREATE TABLE IF NOT EXISTS assistant_user_preferences (
      user_id TEXT PRIMARY KEY DEFAULT 'default',
      policy_overrides TEXT DEFAULT '{}',
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);
  console.log('✅ Created assistant_user_preferences table');

  // Add policy feedback history table
  db.exec(`
    CREATE TABLE IF NOT EXISTS assistant_policy_feedback_history (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      user_id TEXT DEFAULT 'default',
      feedback_type TEXT,
      adjustment TEXT,
      applied_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);
  console.log('✅ Created assistant_policy_feedback_history table');

  // Insert default preferences for 'default' user
  const insertDefault = db.prepare(`
    INSERT OR IGNORE INTO assistant_user_preferences (user_id, policy_overrides)
    VALUES ('default', '{}')
  `);
  insertDefault.run();
  console.log('✅ Initialized default user preferences');

  console.log('\n✅ Migration completed successfully!');
} catch (error) {
  console.error('❌ Migration failed:', error.message);
  process.exit(1);
} finally {
  db.close();
}
