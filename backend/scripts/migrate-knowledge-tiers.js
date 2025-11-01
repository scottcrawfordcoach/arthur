// Copyright (c) 2025 Scott Crawford. All rights reserved.

/**
 * Migration: Add knowledge tier system to files
 * 
 * Adds knowledge_tier field to assistant_files table with 4 tiers:
 * - core_knowledge: Always searched (frameworks, competencies)
 * - personal_journal: Time-weighted patterns (notes, reflections)
 * - reference_library: Domain-filtered (books, articles)
 * - archive: Not auto-searched (storage only)
 */

import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '../..');
const DB_PATH = join(PROJECT_ROOT, 'backend/data/db/ai_local.db');

console.log('🔄 Starting knowledge tier migration...');
console.log(`Database: ${DB_PATH}\n`);

const db = new Database(DB_PATH);

try {
  // Add knowledge_tier column to assistant_files (if not exists)
  console.log('Checking if knowledge_tier column exists...');
  
  try {
    db.exec(`
      ALTER TABLE assistant_files 
      ADD COLUMN knowledge_tier TEXT DEFAULT 'reference_library';
    `);
    console.log('✅ Added knowledge_tier column');
  } catch (error) {
    if (error.message.includes('duplicate column')) {
      console.log('ℹ️  knowledge_tier column already exists, skipping...');
    } else {
      throw error;
    }
  }

  // Update existing files with smart defaults based on metadata
  console.log('\nApplying smart defaults to existing files...');
  
  const files = db.prepare('SELECT id, original_name, file_type, metadata FROM assistant_files').all();
  
  for (const file of files) {
    let tier = 'reference_library'; // default
    const name = file.original_name?.toLowerCase() || '';
    const metadata = file.metadata ? JSON.parse(file.metadata) : {};
    
    // Smart tier assignment
    if (name.includes('icf') || name.includes('competenc') || name.includes('framework')) {
      tier = 'core_knowledge';
    } else if (file.file_type === 'text' && (name.includes('note') || name.includes('journal'))) {
      tier = 'personal_journal';
    } else if (name.includes('tax') || name.includes('legal') || name.includes('receipt')) {
      tier = 'archive';
    } else if (file.file_type === 'document') {
      tier = 'reference_library';
    }
    
    db.prepare('UPDATE assistant_files SET knowledge_tier = ? WHERE id = ?').run(tier, file.id);
    console.log(`  ${file.original_name}: ${tier}`);
  }
  
  console.log(`\n✅ Updated ${files.length} existing files with smart defaults`);
  
  // Create index for efficient tier-based queries
  console.log('\nCreating index for knowledge_tier...');
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_files_knowledge_tier 
    ON assistant_files(knowledge_tier);
  `);
  console.log('✅ Created index');
  
  console.log('\n🎉 Migration completed successfully!');
  console.log('\nKnowledge Tiers:');
  console.log('  - core_knowledge: Always searched');
  console.log('  - personal_journal: Time-weighted patterns');
  console.log('  - reference_library: Domain-filtered');
  console.log('  - archive: Manual retrieval only');
  
} catch (error) {
  console.error('❌ Migration failed:', error.message);
  process.exit(1);
} finally {
  db.close();
}
