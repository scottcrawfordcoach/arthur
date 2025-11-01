// Copyright (c) 2025 Scott Crawford. All rights reserved.

/**
 * Bulk Import Reference Library
 * 
 * Imports books, documents, and reference materials into the ARTHUR system.
 * Automatically chunks large documents, generates embeddings, and stores in DB.
 * 
 * Usage:
 *   node backend/scripts/bulk-import-library.js <source_directory>
 * 
 * Example:
 *   node backend/scripts/bulk-import-library.js "./DOCUMENT _TO_MD_CONVERTER V1/input_docs"
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import OpenAI from 'openai';
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { assessSourceCredibility } from '../utils/sourceCredibility.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const CONFIG = {
  // Database
  dbPath: path.join(__dirname, '../../data/db/ai_local.db'),
  
  // Chunking
  maxChunkSize: 2000,        // Max tokens per chunk
  overlapSize: 200,          // Token overlap between chunks
  
  // OpenAI
  embeddingModel: 'text-embedding-3-small',
  embeddingDimensions: 1536,
  
  // Processing
  batchSize: 10,             // Process N files at a time
  delayBetweenBatches: 1000, // ms delay between batches
  
  // Supported file types
  supportedExtensions: ['.md', '.txt', '.pdf', '.epub'],
  
  // Default tags
  defaultTags: ['reference', 'imported', 'bulk-upload']
};

class BulkLibraryImporter {
  constructor() {
    this.db = new Database(CONFIG.dbPath);
    this.db.pragma('journal_mode = WAL');
    
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    
    this.stats = {
      filesProcessed: 0,
      filesSkipped: 0,
      chunksCreated: 0,
      embeddingsGenerated: 0,
      errors: 0,
      startTime: Date.now()
    };
  }

  /**
   * Main import function
   */
  async importDirectory(sourceDir) {
    console.log('📚 ARTHUR Reference Library Bulk Import\n');
    console.log(`Source: ${sourceDir}`);
    console.log(`Database: ${CONFIG.dbPath}\n`);
    
    // Validate source directory
    if (!fs.existsSync(sourceDir)) {
      throw new Error(`Directory not found: ${sourceDir}`);
    }
    
    // Get all files
    const files = this.findFiles(sourceDir);
    console.log(`Found ${files.length} files to process\n`);
    
    if (files.length === 0) {
      console.log('⚠️  No files found. Exiting.');
      return;
    }
    
    // Process in batches
    for (let i = 0; i < files.length; i += CONFIG.batchSize) {
      const batch = files.slice(i, i + CONFIG.batchSize);
      
      console.log(`\n📦 Processing batch ${Math.floor(i / CONFIG.batchSize) + 1}/${Math.ceil(files.length / CONFIG.batchSize)}`);
      console.log('─'.repeat(60));
      
      await this.processBatch(batch);
      
      // Delay between batches to avoid rate limits
      if (i + CONFIG.batchSize < files.length) {
        await this.sleep(CONFIG.delayBetweenBatches);
      }
    }
    
    this.printSummary();
  }

  /**
   * Find all supported files in directory
   */
  findFiles(dir, fileList = []) {
    const files = fs.readdirSync(dir);
    
    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isDirectory()) {
        this.findFiles(filePath, fileList);
      } else {
        const ext = path.extname(file).toLowerCase();
        if (CONFIG.supportedExtensions.includes(ext)) {
          fileList.push(filePath);
        }
      }
    }
    
    return fileList;
  }

  /**
   * Process a batch of files
   */
  async processBatch(files) {
    for (const filePath of files) {
      try {
        await this.processFile(filePath);
      } catch (error) {
        console.error(`❌ Error processing ${path.basename(filePath)}: ${error.message}`);
        this.stats.errors++;
      }
    }
  }

  /**
   * Process a single file
   */
  async processFile(filePath) {
    const fileName = path.basename(filePath);
    console.log(`\n📄 ${fileName}`);
    
    // Read content
    const content = fs.readFileSync(filePath, 'utf-8');
    const fileHash = this.calculateHash(content);
    
    // Check for duplicates (check if document already imported)
    const existing = this.db.prepare(`
      SELECT id, section_title FROM reference_library_chunks 
      WHERE json_extract(metadata, '$.originalFile') = ? LIMIT 1
    `).get(fileName);
    
    if (existing) {
      console.log(`   ⏭️  Skipped (duplicate: ${existing.section_title || fileName})`);
      this.stats.filesSkipped++;
      return;
    }
    
    // Extract category from folder path (e.g., BOOKS, ARTICLES, BLOGS, etc.)
    const folderCategory = this.extractCategoryFromPath(filePath);
    
    // Extract metadata from filename
    const metadata = this.extractMetadata(fileName, content, folderCategory);
    
    // Assess source credibility
    const credibilityAssessment = assessSourceCredibility(
      metadata.title,
      metadata.author,
      content,
      metadata.category
    );
    
    console.log(`   📊 Credibility: ${credibilityAssessment.credibility} (${credibilityAssessment.sourceType})`);
    if (credibilityAssessment.useWithCaution) {
      console.log(`   ⚠️  ${credibilityAssessment.summary}`);
    }
    
    // Chunk the document
    const chunks = this.chunkDocument(content, metadata.title);
    console.log(`   📝 Created ${chunks.length} chunks`);
    this.stats.chunksCreated += chunks.length;
    
    // Process each chunk
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      
      // Generate embedding
      const embedding = await this.generateEmbedding(chunk.content);
      this.stats.embeddingsGenerated++;
      
      // Generate summary for this chunk
      const summary = this.extractSummary(chunk.content);
      
      // Store in database with credibility metadata
      const chunkId = this.storeDocument({
        title: chunk.title,
        content: chunk.content,
        summary: summary,
        fileType: path.extname(filePath).substring(1),
        fileHash: i === 0 ? fileHash : `${fileHash}_chunk${i}`,
        tags: JSON.stringify([...CONFIG.defaultTags, ...metadata.tags, metadata.category, credibilityAssessment.credibility]),
        metadata: JSON.stringify({
          originalFile: fileName,
          chunkIndex: i,
          totalChunks: chunks.length,
          author: metadata.author,
          category: metadata.category,
          importDate: new Date().toISOString(),
          // Credibility metadata
          sourceType: credibilityAssessment.sourceType,
          credibility: credibilityAssessment.credibility,
          biasRisk: credibilityAssessment.biasRisk,
          limitations: credibilityAssessment.limitations,
          strengths: credibilityAssessment.strengths,
          useWithCaution: credibilityAssessment.useWithCaution,
          credibilitySummary: credibilityAssessment.summary
        }),
        embedding: embedding
      });
      
      // Progress indicator
      if ((i + 1) % 5 === 0 || i === chunks.length - 1) {
        process.stdout.write(`   🔄 Processing chunk ${i + 1}/${chunks.length}...\r`);
      }
    }
    
    console.log(`   ✅ Imported ${chunks.length} chunks`);
    this.stats.filesProcessed++;
  }

  /**
   * Extract category from file path
   * E.g., "Resources/LIBRARY/BOOKS/..." -> "books"
   */
  extractCategoryFromPath(filePath) {
    const normalized = filePath.replace(/\\/g, '/');
    const match = normalized.match(/LIBRARY\/([^/]+)\//);
    if (match) {
      return match[1].toLowerCase().replace(/_/g, '-');
    }
    return 'general';
  }

  /**
   * Extract metadata from filename and content
   */
  extractMetadata(fileName, content, folderCategory = 'general') {
    // Parse filename patterns like:
    // "Atomic Habits by James Clear.md"
    // "Deep Work_ Rules for Focused Success by Cal Newport.md"
    
    let title = fileName.replace(/\.(md|txt|pdf|epub)$/i, '');
    let author = 'Unknown';
    let category = folderCategory; // Use folder as primary category
    
    // Try to extract author from "Title by Author" pattern
    const byMatch = title.match(/^(.+?)\s+by\s+(.+?)(?:\s+EPUB)?$/i);
    if (byMatch) {
      title = byMatch[1].trim();
      author = byMatch[2].trim();
    }
    
    // Clean up underscores and special chars
    title = title.replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
    
    // Infer secondary tags from content keywords (don't override folder category)
    const contentLower = content.toLowerCase().substring(0, 5000); // First 5k chars
    const contentTags = [];
    
    if (contentLower.includes('leadership') || contentLower.includes('management')) {
      contentTags.push('leadership');
    }
    if (contentLower.includes('productivity') || contentLower.includes('habits')) {
      contentTags.push('productivity');
    }
    if (contentLower.includes('psychology') || contentLower.includes('mental')) {
      contentTags.push('psychology');
    }
    if (contentLower.includes('business') || contentLower.includes('entrepreneur')) {
      contentTags.push('business');
    }
    if (contentLower.includes('science') || contentLower.includes('research')) {
      contentTags.push('science');
    }
    if (contentLower.includes('health') || contentLower.includes('wellness')) {
      contentTags.push('health');
    }
    
    return {
      title,
      author,
      category,
      tags: [category, ...contentTags, author.toLowerCase().replace(/\s+/g, '-')]
    };
  }

  /**
   * Chunk document into manageable pieces
   */
  chunkDocument(content, baseTitle) {
    const chunks = [];
    
    // Split by major headings first
    const sections = content.split(/(?=^#{1,2}\s)/m);
    
    let currentChunk = '';
    let chunkIndex = 0;
    
    for (const section of sections) {
      // Estimate token count (rough: 1 token ≈ 4 chars)
      const sectionTokens = section.length / 4;
      const currentTokens = currentChunk.length / 4;
      
      if (currentTokens + sectionTokens > CONFIG.maxChunkSize && currentChunk.length > 0) {
        // Save current chunk
        chunks.push({
          title: `${baseTitle} (Part ${chunkIndex + 1})`,
          content: currentChunk.trim()
        });
        
        // Start new chunk with overlap
        const overlapText = currentChunk.slice(-CONFIG.overlapSize * 4); // Approx overlap
        currentChunk = overlapText + '\n\n' + section;
        chunkIndex++;
      } else {
        currentChunk += (currentChunk ? '\n\n' : '') + section;
      }
    }
    
    // Add final chunk
    if (currentChunk.trim().length > 0) {
      chunks.push({
        title: chunks.length > 0 ? `${baseTitle} (Part ${chunkIndex + 1})` : baseTitle,
        content: currentChunk.trim()
      });
    }
    
    return chunks;
  }

  /**
   * Extract summary from content (first paragraph or heading)
   */
  extractSummary(content, maxLength = 300) {
    // Remove markdown formatting
    let text = content
      .replace(/#{1,6}\s/g, '')
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/\*(.+?)\*/g, '$1')
      .replace(/\[(.+?)\]\(.+?\)/g, '$1');
    
    // Get first paragraph
    const paragraphs = text.split(/\n\n+/).filter(p => p.trim().length > 50);
    const summary = paragraphs[0] || text.substring(0, maxLength);
    
    return summary.length > maxLength 
      ? summary.substring(0, maxLength) + '...'
      : summary;
  }

  /**
   * Generate embedding for text
   */
  async generateEmbedding(text) {
    try {
      const response = await this.openai.embeddings.create({
        model: CONFIG.embeddingModel,
        input: text.substring(0, 8000), // Limit to ~8k chars for API
        dimensions: CONFIG.embeddingDimensions
      });
      
      const embedding = response.data[0].embedding;
      return Buffer.from(new Float32Array(embedding).buffer);
      
    } catch (error) {
      console.error('   ⚠️  Embedding generation failed:', error.message);
      return null;
    }
  }

  /**
   * Store document chunk in database
   */
  storeDocument(doc) {
    const stmt = this.db.prepare(`
      INSERT INTO reference_library_chunks (
        id, document_id, chunk_index, content, summary,
        section_title, category, embedding, metadata, tags, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const id = crypto.randomUUID();
    
    // Parse metadata to extract info
    let metadata = {};
    try {
      metadata = typeof doc.metadata === 'string' ? JSON.parse(doc.metadata) : doc.metadata;
    } catch (e) {
      // Keep metadata as empty object if parsing fails
    }
    
    stmt.run(
      id,
      metadata.originalFile || doc.fileHash, // Use filename as document_id
      metadata.chunkIndex || 0,
      doc.content,
      doc.summary,
      doc.title, // section_title
      metadata.category || 'reference',
      doc.embedding,
      doc.metadata, // Store full metadata JSON
      doc.tags, // Store tags JSON
      new Date().toISOString()
    );
    
    return id;
  }

  /**
   * Calculate file hash for duplicate detection
   */
  calculateHash(content) {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Sleep utility
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Print summary statistics
   */
  printSummary() {
    const duration = ((Date.now() - this.stats.startTime) / 1000).toFixed(1);
    
    console.log('\n\n' + '═'.repeat(60));
    console.log('📊 IMPORT SUMMARY');
    console.log('═'.repeat(60));
    console.log(`Files processed:     ${this.stats.filesProcessed}`);
    console.log(`Files skipped:       ${this.stats.filesSkipped} (duplicates)`);
    console.log(`Chunks created:      ${this.stats.chunksCreated}`);
    console.log(`Embeddings generated: ${this.stats.embeddingsGenerated}`);
    console.log(`Errors:              ${this.stats.errors}`);
    console.log(`Duration:            ${duration}s`);
    console.log('═'.repeat(60));
    
    if (this.stats.filesProcessed > 0) {
      console.log('\n✅ Import complete! Your reference library is now searchable.');
      console.log('💡 Try asking Arthur about topics from your imported books.');
    }
  }

  /**
   * Close database connection
   */
  close() {
    this.db.close();
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('Usage: node bulk-import-library.js <source_directory>');
    console.log('\nExample:');
    console.log('  node bulk-import-library.js "./DOCUMENT _TO_MD_CONVERTER V1/input_docs"');
    console.log('  node bulk-import-library.js "./my-books"');
    process.exit(1);
  }
  
  const sourceDir = args[0];
  const importer = new BulkLibraryImporter();
  
  try {
    await importer.importDirectory(sourceDir);
  } catch (error) {
    console.error('\n❌ Import failed:', error.message);
    process.exit(1);
  } finally {
    importer.close();
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
} else {
  // Fallback: run if this is the main script (Windows path handling)
  const scriptPath = fileURLToPath(import.meta.url);
  const argPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
  if (argPath && scriptPath === argPath) {
    main();
  }
}

export { BulkLibraryImporter };
