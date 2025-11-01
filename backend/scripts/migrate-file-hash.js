/**
 * Migration: Add file hash for duplicate detection
 * 
 * Adds file_hash column and index for efficient duplicate checking
 */

import Database from 'better-sqlite3';
import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '../..');
const DB_PATH = process.env.DATABASE_URL
  ? (process.env.DATABASE_URL.startsWith('.')
      ? join(PROJECT_ROOT, process.env.DATABASE_URL)
      : process.env.DATABASE_URL)
  : join(PROJECT_ROOT, 'data/db/ai_local.db');

console.log('🔄 Starting file hash migration...');
console.log(`Database: ${DB_PATH}\n`);

const db = new Database(DB_PATH);

try {
  // Add file_hash column
  console.log('Adding file_hash column to assistant_files...');
  
  try {
    db.exec(`
      ALTER TABLE assistant_files 
      ADD COLUMN file_hash TEXT;
    `);
    console.log('✅ Added file_hash column');
  } catch (error) {
    if (error.message.includes('duplicate column')) {
      console.log('ℹ️  file_hash column already exists, skipping...');
    } else {
      throw error;
    }
  }

  // Hash existing files
  console.log('\nGenerating hashes for existing files...');
  
  const files = db.prepare('SELECT id, file_path FROM assistant_files WHERE file_hash IS NULL').all();
  
  let hashed = 0;
  for (const file of files) {
    try {
      if (file.file_path && readFileSync(file.file_path)) {
        const fileBuffer = readFileSync(file.file_path);
        const hash = createHash('sha256').update(fileBuffer).digest('hex');
        
        db.prepare('UPDATE assistant_files SET file_hash = ? WHERE id = ?').run(hash, file.id);
        hashed++;
      }
    } catch (err) {
      console.log(`  ⚠️  Could not hash ${file.file_path}: ${err.message}`);
    }
  }
  
  console.log(`✅ Hashed ${hashed} existing files`);
  
  // Create index for fast duplicate lookup
  console.log('\nCreating index for file_hash...');
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_files_hash 
    ON assistant_files(file_hash);
  `);
  console.log('✅ Created index');
  
  console.log('\n🎉 Migration completed successfully!');
  console.log('\nDuplicate detection now enabled:');
  console.log('  - Files are hashed on upload');
  console.log('  - Duplicates are detected before processing');
  console.log('  - Users can choose to skip or replace');
  
} catch (error) {
  console.error('❌ Migration failed:', error.message);
  process.exit(1);
} finally {
  db.close();
}
