/**
 * Show before/after comparison of file content
 */

import Database from 'better-sqlite3';
import { readFile, readdir, stat } from 'fs/promises';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DB_PATH = join(__dirname, '../data/db/ai_local.db');
const CONVERTED_DIR = join(__dirname, '../../buckets/converted');

const db = new Database(DB_PATH);

/**
 * Find the correct markdown file
 */
async function findMarkdownFile(fileId, originalName) {
  const files = await readdir(CONVERTED_DIR);
  const fileStem = originalName.replace(/\.[^/.]+$/, '');
  
  // Create a pattern matcher for the UUID with spaces instead of dashes
  const uuidSpaced = fileId.replace(/-/g, ' ').toLowerCase();
  
  const candidates = files.filter(f => {
    if (!f.endsWith('.md')) return false;
    const fLower = f.toLowerCase();
    // Skip the UUID-based file with dashes (it has logs)
    if (f === `${fileId}.md`) return false;
    // Look for UUID with spaces (case insensitive)
    if (fLower.includes(uuidSpaced)) return true;
    // Look for cleaned filename variants
    if (fLower.includes(fileStem.replace(/-/g, ' ').toLowerCase())) return true;
    if (f.startsWith(fileStem)) return true;
    return false;
  });
  
  if (candidates.length === 0) return null;
  
  const withStats = await Promise.all(
    candidates.map(async (name) => ({
      name,
      stats: await stat(join(CONVERTED_DIR, name))
    }))
  );
  
  withStats.sort((a, b) => {
    const sizeDiff = b.stats.size - a.stats.size;
    if (sizeDiff !== 0) return sizeDiff;
    return b.stats.mtime - a.stats.mtime;
  });
  
  return withStats[0].name;
}

async function main() {
  console.log('📋 Content Comparison: Database vs Actual Files\n');
  console.log('='.repeat(80));
  
  // Get a sample file
  const file = db.prepare(`
    SELECT id, original_name
    FROM assistant_files 
    WHERE conversion_status = 'completed'
    ORDER BY processed_at DESC
    LIMIT 1
  `).get();
  
  if (!file) {
    console.log('No files found');
    db.close();
    return;
  }
  
  console.log(`\n📄 File: ${file.original_name}`);
  console.log(`🔑 ID: ${file.id}\n`);
  
  // Get current database content
  const currentChunk = db.prepare(`
    SELECT content 
    FROM assistant_chunks 
    WHERE file_id = ?
    ORDER BY chunk_index
    LIMIT 1
  `).get(file.id);
  
  // Find actual markdown file
  // First try direct pattern - UUID with spaces (cleaned version may be truncated)
  const allFiles = await readdir(CONVERTED_DIR);
  const uuidPrefix = file.id.substring(0, 23).replace(/-/g, ' '); // First ~20 chars
  let mdFileName = allFiles.find(f => 
    f.endsWith('.md') && 
    f !== `${file.id}.md` &&
    f.toLowerCase().startsWith(uuidPrefix.toLowerCase())
  );
  
  let actualContent = null;
  
  if (mdFileName) {
    const mdPath = join(CONVERTED_DIR, mdFileName);
    actualContent = await readFile(mdPath, 'utf-8');
  }
  
  // Show comparison
  console.log('🔴 CURRENT DATABASE CONTENT (INCORRECT):');
  console.log('-'.repeat(80));
  if (currentChunk) {
    const preview = currentChunk.content.substring(0, 500);
    console.log(preview);
    if (currentChunk.content.length > 500) {
      console.log(`\n... [${currentChunk.content.length - 500} more characters]`);
    }
  } else {
    console.log('(No chunks found)');
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('✅ ACTUAL CONVERTED FILE (CORRECT):');
  console.log('-'.repeat(80));
  if (actualContent) {
    console.log(`📁 File: ${mdFileName}`);
    console.log(`📏 Size: ${(actualContent.length / 1024).toFixed(1)}KB\n`);
    
    const preview = actualContent.substring(0, 800);
    console.log(preview);
    if (actualContent.length > 800) {
      console.log(`\n... [${(actualContent.length - 800 / 1024).toFixed(1)}KB more content]`);
    }
  } else {
    console.log('(Markdown file not found)');
  }
  
  console.log('\n' + '='.repeat(80));
  
  const dbHasLogs = currentChunk && currentChunk.content.includes('[INFO]');
  const fileHasContent = actualContent && actualContent.length > 1000 && !actualContent.includes('[INFO]');
  const dbHasContent = currentChunk && !currentChunk.content.includes('[INFO]') && currentChunk.content.length > 500;
  
  if (dbHasLogs) {
    console.log('\n⚠️  ISSUE CONFIRMED: Database contains Python logs instead of content!');
  }
  
  if (dbHasContent) {
    console.log('\n✅ SUCCESS: Database now contains proper document content!');
  }
  
  if (fileHasContent) {
    console.log('\n✅ GOOD NEWS: Proper converted file exists and has real content!');
  }
  
  if (dbHasLogs) {
    console.log('\n💡 Run: node backend/scripts/reprocess-converted-files.js');
    console.log('   This will fix all files in the database.');
  }
  
  console.log();
  
  db.close();
}

main().catch(console.error);
