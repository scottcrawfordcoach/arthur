/**
 * Re-process existing converted files to fix content in database
 * This script reads the properly converted markdown files and updates the database
 */

import 'dotenv/config';
import Database from 'better-sqlite3';
import { readFile, readdir, stat } from 'fs/promises';
import { join, basename } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { generateEmbedding } from '../services/embeddings.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DB_PATH = join(__dirname, '../data/db/ai_local.db');
const CONVERTED_DIR = join(__dirname, '../../buckets/converted');

const db = new Database(DB_PATH);

/**
 * Chunk text into smaller pieces for embedding
 */
function chunkText(text, chunkSize = 1000, overlap = 200) {
  const chunks = [];
  const lines = text.split('\n');
  let currentChunk = '';
  
  for (const line of lines) {
    if ((currentChunk + line).length > chunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      // Keep last few lines for context overlap
      const overlapLines = currentChunk.split('\n').slice(-3).join('\n');
      currentChunk = overlapLines + '\n' + line;
    } else {
      currentChunk += (currentChunk ? '\n' : '') + line;
    }
  }
  
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks;
}

/**
 * Extract frontmatter metadata from markdown
 */
function extractFrontmatter(content) {
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n/);
  if (!frontmatterMatch) {
    return {};
  }
  
  const metadata = {};
  const yaml = frontmatterMatch[1];
  const lines = yaml.split('\n');
  
  lines.forEach(line => {
    const match = line.match(/^(\w+):\s*(.+)$/);
    if (match) {
      const [, key, value] = match;
      // Remove quotes and brackets
      let cleanValue = value.replace(/^["'\[]|["'\]]$/g, '').trim();
      
      // Parse arrays
      if (value.startsWith('[')) {
        cleanValue = value.match(/"([^"]+)"/g)?.map(s => s.replace(/"/g, '')) || [];
      }
      
      metadata[key] = cleanValue;
    }
  });
  
  return metadata;
}

/**
 * Find the correct markdown file for a given file ID
 */
async function findMarkdownFile(fileId, originalName) {
  const files = await readdir(CONVERTED_DIR);
  
  // Look for files matching the UUID prefix (cleaned names may be truncated)
  const uuidPrefix = fileId.substring(0, 23).replace(/-/g, ' ');
  
  const candidates = files.filter(f => {
    if (!f.endsWith('.md')) return false;
    
    // Skip the UUID-based file (small file with logs)
    if (f === `${fileId}.md`) return false;
    
    // Match by UUID prefix with spaces (case insensitive)
    if (f.toLowerCase().startsWith(uuidPrefix.toLowerCase())) return true;
    
    return false;
  });
  
  if (candidates.length === 0) {
    return null;
  }
  
  // Prefer larger files (actual content vs logs)
  const withStats = await Promise.all(
    candidates.map(async (name) => ({
      name,
      stats: await stat(join(CONVERTED_DIR, name))
    }))
  );
  
  // Sort by size descending, then by modification time
  withStats.sort((a, b) => {
    const sizeDiff = b.stats.size - a.stats.size;
    if (sizeDiff !== 0) return sizeDiff;
    return b.stats.mtime - a.stats.mtime;
  });
  
  return withStats[0].name;
}

async function main() {
  console.log('🔄 Re-processing converted files...\n');
  
  // Get all files with completed conversion
  const files = db.prepare(`
    SELECT id, original_name, file_path, knowledge_tier 
    FROM assistant_files 
    WHERE conversion_status = 'completed'
    ORDER BY processed_at DESC
  `).all();
  
  console.log(`Found ${files.length} files to re-process\n`);
  
  let processedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;
  
  for (const file of files) {
    try {
      console.log(`Processing: ${file.original_name}`);
      
      // Find the correct markdown file
      const mdFileName = await findMarkdownFile(file.id, file.original_name);
      
      if (!mdFileName) {
        console.log(`  ⚠️  No markdown file found, skipping`);
        skippedCount++;
        continue;
      }
      
      const mdPath = join(CONVERTED_DIR, mdFileName);
      const content = await readFile(mdPath, 'utf-8');
      
      // Check if content is actually logs (small file with log patterns)
      if (content.length < 1000 && content.includes('[INFO]')) {
        console.log(`  ⚠️  File contains logs, skipping: ${mdFileName}`);
        skippedCount++;
        continue;
      }
      
      console.log(`  ✓ Found: ${mdFileName} (${(content.length / 1024).toFixed(1)}KB)`);
      
      // Extract metadata from frontmatter
      const frontmatter = extractFrontmatter(content);
      
      // Update the converted file path to point to the correct file
      const convertedPath = join(dirname(dirname(__dirname)), 'buckets', 'converted', `${file.id}.md`);
      
      // Save content to the UUID-based filename (for consistency)
      await import('fs/promises').then(fs => fs.writeFile(convertedPath, content));
      
      // Update metadata in database
      const existingMetadata = file.metadata ? JSON.parse(file.metadata) : {};
      const updatedMetadata = { ...existingMetadata, ...frontmatter };
      
      db.prepare(`
        UPDATE assistant_files 
        SET metadata = ?
        WHERE id = ?
      `).run(JSON.stringify(updatedMetadata), file.id);
      
      // Delete old chunks
      db.prepare('DELETE FROM assistant_chunks WHERE file_id = ?').run(file.id);
      
      // Create new chunks with proper content
      const chunks = chunkText(content);
      console.log(`  📄 Creating ${chunks.length} chunks...`);
      
      // Insert chunks with embeddings
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        
        // Generate embedding
        const embedding = await generateEmbedding(chunk);
        const embeddingBuffer = Buffer.from(new Float32Array(embedding).buffer);
        
        db.prepare(`
          INSERT INTO assistant_chunks (file_id, chunk_index, content, embedding)
          VALUES (?, ?, ?, ?)
        `).run(file.id, i, chunk, embeddingBuffer);
      }
      
      console.log(`  ✅ Successfully re-processed (${chunks.length} chunks)\n`);
      processedCount++;
      
    } catch (error) {
      console.error(`  ❌ Error processing ${file.original_name}:`, error.message);
      errorCount++;
    }
  }
  
  console.log('\n' + '='.repeat(50));
  console.log('📊 Re-processing Summary:');
  console.log(`  ✅ Successfully processed: ${processedCount}`);
  console.log(`  ⚠️  Skipped: ${skippedCount}`);
  console.log(`  ❌ Errors: ${errorCount}`);
  console.log('='.repeat(50));
  
  db.close();
  console.log('\n🎉 Re-processing complete!');
}

main().catch(console.error);
