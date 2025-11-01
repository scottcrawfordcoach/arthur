// Copyright (c) 2025 Scott Crawford. All rights reserved.

/**
 * Migration: Add wellness and journal tracking tables
 * Enables ScottBot journal functionality with qualitative + quantitative tracking
 */

import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DB_PATH = join(__dirname, '../data/db/ai_local.db');

console.log('🔄 Adding wellness and journal tracking tables...\n');

const db = new Database(DB_PATH);

try {
  // Check which new tables need to be added
  const existingTables = db.prepare(`
    SELECT name FROM sqlite_master 
    WHERE type='table' AND name IN (
      'journal_entries', 'reflections', 'goals'
    )
  `).all().map(t => t.name);
  
  const tablesToCreate = ['journal_entries', 'reflections', 'goals']
    .filter(t => !existingTables.includes(t));
  
  if (tablesToCreate.length === 0) {
    console.log('✅ All wellness tables already exist!');
    db.close();
    process.exit(0);
  }
  
  console.log(`Creating ${tablesToCreate.length} new tables: ${tablesToCreate.join(', ')}\n`);
  
  if (tablesToCreate.includes('journal_entries')) {
    console.log('Creating journal_entries table...');
    db.exec(`
      CREATE TABLE journal_entries (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        user_id TEXT NOT NULL DEFAULT 'default',
        entry_date TEXT NOT NULL,
        entry_type TEXT DEFAULT 'general',
        content TEXT NOT NULL,
        mood TEXT,
        energy_level INTEGER,
        stress_level INTEGER,
        tags TEXT,
        linked_activity_id TEXT,
        linked_sleep_id TEXT,
        weather TEXT,
        location TEXT,
        is_private INTEGER DEFAULT 1,
        ai_summary TEXT,
        sentiment_score REAL,
        topics TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (linked_activity_id) REFERENCES activities(id),
        FOREIGN KEY (linked_sleep_id) REFERENCES sleep_sessions(id)
      )
    `);
  }
  
  if (tablesToCreate.includes('reflections')) {
    console.log('Creating reflections table...');
    db.exec(`
      CREATE TABLE reflections (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        user_id TEXT NOT NULL DEFAULT 'default',
        reflection_date TEXT NOT NULL,
        reflection_type TEXT DEFAULT 'daily',
        prompt TEXT,
        response TEXT NOT NULL,
        linked_entries TEXT,
        insights TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }
  
  if (tablesToCreate.includes('goals')) {
    console.log('Creating goals table...');
    db.exec(`
      CREATE TABLE goals (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        user_id TEXT NOT NULL DEFAULT 'default',
        goal_type TEXT,
        title TEXT NOT NULL,
        description TEXT,
        target_date TEXT,
        status TEXT DEFAULT 'active',
        progress_metric TEXT,
        target_value REAL,
        current_value REAL,
        unit TEXT,
        check_ins TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        completed_at TEXT,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }
  
  console.log('Creating indexes...');
  if (tablesToCreate.includes('journal_entries')) {
    db.exec(`
      CREATE INDEX idx_journal_entries_user_date ON journal_entries(user_id, entry_date DESC);
      CREATE INDEX idx_journal_entries_type ON journal_entries(entry_type);
    `);
  }
  if (tablesToCreate.includes('reflections')) {
    db.exec(`CREATE INDEX idx_reflections_user_date ON reflections(user_id, reflection_date DESC)`);
  }
  if (tablesToCreate.includes('goals')) {
    db.exec(`CREATE INDEX idx_goals_user_status ON goals(user_id, status)`);
  }
  
  console.log('\n✅ New tables created successfully!');
  console.log('\n📊 Tables added:');
  if (tablesToCreate.includes('journal_entries')) {
    console.log('  • journal_entries - Freeform entries with AI analysis');
  }
  if (tablesToCreate.includes('reflections')) {
    console.log('  • reflections - Structured reflection prompts and responses');
  }
  if (tablesToCreate.includes('goals')) {
    console.log('  • goals - Goal tracking with progress metrics');
  }
  console.log('\n🎉 ScottBot journal functionality is ready!');
  console.log('\n💡 Existing tables (wellness_daily, sleep_sessions, activities) are available');
  
} catch (error) {
  console.error('\n❌ Migration failed:', error.message);
  process.exit(1);
} finally {
  db.close();
}
