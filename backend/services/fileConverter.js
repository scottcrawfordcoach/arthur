import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import { readFile, writeFile, mkdir, copyFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join, extname, basename, dirname } from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'crypto';
import mime from 'mime-types';
import OpenAI from 'openai';
import { execute, queryOne } from './db.js';
import { generateEmbedding, storeEmbedding } from './embeddings.js';
import logger from '../utils/logger.js';

const execPromise = promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Lazy initialization of OpenAI client
let openai = null;
function getOpenAI() {
  if (!openai) {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openai;
}

// Resolve paths relative to project root (two levels up from this file)
const PROJECT_ROOT = join(__dirname, '../..');
const BUCKET_PATH = process.env.BUCKET_PATH 
  ? (process.env.BUCKET_PATH.startsWith('.') 
      ? join(PROJECT_ROOT, process.env.BUCKET_PATH) 
      : process.env.BUCKET_PATH)
  : join(PROJECT_ROOT, 'buckets');

const CONVERTER_PATH = process.env.CONVERTER_PATH
  ? (process.env.CONVERTER_PATH.startsWith('.')
      ? join(PROJECT_ROOT, process.env.CONVERTER_PATH)
      : process.env.CONVERTER_PATH)
  : join(PROJECT_ROOT, 'DOCUMENT _TO_MD_CONVERTER V1');

// Log resolved paths for debugging
logger.info(`File Converter initialized:`);
logger.info(`  PROJECT_ROOT: ${PROJECT_ROOT}`);
logger.info(`  CONVERTER_PATH env: ${process.env.CONVERTER_PATH}`);
logger.info(`  CONVERTER_PATH resolved: ${CONVERTER_PATH}`);
logger.info(`  BUCKET_PATH: ${BUCKET_PATH}`);

/**
 * File Conversion Service
 * Handles multi-format conversion with AI-assisted metadata extraction
 */

/**
 * Process uploaded file
 * @param {object} file - Multer file object
 * @param {object} options - Processing options
 * @returns {Promise<object>} - Processed file info
 */
export async function processUploadedFile(file, options = {}) {
  const {
    userId = null,
    knowledgeTier = 'reference_library', // core_knowledge | personal_journal | reference_library | archive
    tags = [],
    skipDuplicateCheck = false
  } = options;

  try {
    const fileId = uuidv4();
    const ext = extname(file.originalname).toLowerCase();
    const originalName = file.originalname;
    
    // Calculate file hash for duplicate detection
    const fileBuffer = await readFile(file.path);
    const fileHash = createHash('sha256').update(fileBuffer).digest('hex');
    
    // Check for duplicates (unless explicitly skipped)
    if (!skipDuplicateCheck) {
      const duplicate = queryOne(
        'SELECT id, original_name, knowledge_tier, processed_at FROM assistant_files WHERE file_hash = ?',
        [fileHash]
      );
      
      if (duplicate) {
        logger.info(`Duplicate detected: ${originalName} matches ${duplicate.original_name}`);
        return {
          isDuplicate: true,
          duplicateInfo: {
            existingFile: duplicate.original_name,
            uploadedOn: duplicate.processed_at,
            tier: duplicate.knowledge_tier,
            fileId: duplicate.id
          },
          originalName,
          fileHash
        };
      }
    }
    
    // Determine file type category
    const fileType = detectFileType(ext, file.mimetype);
    
    logger.info(`Processing file: ${originalName} (${fileType}, tier: ${knowledgeTier})`);
    
    // Move to appropriate bucket
    const targetBucket = 'processed';
    const targetPath = join(BUCKET_PATH, targetBucket, `${fileId}${ext}`);
    
    await ensureDir(join(BUCKET_PATH, targetBucket));
    await copyFile(file.path, targetPath);
    
    // Save to database
    const fileRecord = {
      id: fileId,
      user_id: userId,
      file_path: targetPath,
      source_bucket: targetBucket,
      file_type: fileType,
      original_name: originalName,
      file_hash: fileHash,
      tags: JSON.stringify(tags),
      processed_at: new Date().toISOString(),
      conversion_status: knowledgeTier === 'archive' ? 'stored' : 'pending',
      metadata: JSON.stringify({ mimetype: file.mimetype, size: file.size }),
      knowledge_tier: knowledgeTier
    };
    
    execute(`
      INSERT INTO assistant_files (id, user_id, file_path, source_bucket, file_type, original_name, file_hash, tags, processed_at, conversion_status, metadata, knowledge_tier)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, Object.values(fileRecord));
    
    // Process based on knowledge tier (archive tier skips processing)
    let acknowledgment = null;
    
    if (knowledgeTier !== 'archive') {
      // Process and index all non-archive files
      const result = await convertAndIndex(fileId, targetPath, fileType);
      acknowledgment = result.acknowledgment;
    } else {
      acknowledgment = `📄 **${originalName}** has been archived. It's stored securely but won't be automatically searched. You can retrieve it anytime by asking.`;
    }
    
    return {
      isDuplicate: false,
      fileId,
      originalName,
      fileType,
      knowledgeTier,
      status: fileRecord.conversion_status,
      acknowledgment
    };
  } catch (error) {
    logger.error('File processing error:', error);
    throw error;
  }
}

/**
 * Convert file to markdown and extract metadata
 * @param {string} fileId - File ID
 * @param {string} filePath - Path to file
 * @param {string} fileType - File type
 */
export async function convertAndIndex(fileId, filePath, fileType) {
  try {
    logger.info(`Converting file: ${fileId}`);
    
    let markdownContent = '';
    let metadata = {};
    
    // Use Python converter for complex formats
    if (['document', 'audio', 'video', 'archive'].includes(fileType)) {
      const result = await convertWithPython(filePath);
      markdownContent = result.content;
      metadata = result.metadata;
    } else if (fileType === 'text') {
      // Direct text/markdown files
      markdownContent = await readFile(filePath, 'utf-8');
    } else if (fileType === 'image') {
      // Use GPT-4 Vision for image description
      const description = await describeImage(filePath);
      markdownContent = `# Image: ${basename(filePath)}\n\n${description}`;
      metadata = { type: 'image_description' };
    }
    
    // Extract AI metadata
    if (markdownContent) {
      const aiMetadata = await extractMetadataWithAI(markdownContent, basename(filePath));
      metadata = { ...metadata, ...aiMetadata };
    }
    
    // Save converted file
    const convertedPath = join(BUCKET_PATH, 'converted', `${fileId}.md`);
    await ensureDir(join(BUCKET_PATH, 'converted'));
    await writeFile(convertedPath, markdownContent);
    
    // Update database
    execute(`
      UPDATE assistant_files 
      SET conversion_status = 'completed',
          metadata = ?
      WHERE id = ?
    `, [JSON.stringify(metadata), fileId]);
    
    // Chunk and embed
    await chunkAndEmbed(fileId, markdownContent, metadata);
    
    // Generate user-friendly acknowledgment
    const acknowledgment = await generateFileAcknowledgment(metadata, basename(filePath), 'process');
    
    logger.info(`Conversion completed: ${fileId}`);
    
    return {
      fileId,
      convertedPath,
      metadata,
      acknowledgment
    };
  } catch (error) {
    logger.error(`Conversion failed for ${fileId}:`, error);
    
    execute(`
      UPDATE assistant_files 
      SET conversion_status = 'failed'
      WHERE id = ?
    `, [fileId]);
    
    throw error;
  }
}

/**
 * Convert file using Python converter
 * @param {string} filePath - Path to file
 * @returns {Promise<object>} - Content and metadata
 */
async function convertWithPython(filePath) {
  return new Promise(async (resolve, reject) => {
    const pythonScript = join(CONVERTER_PATH, 'batch_doc_to_md.py');
    const outputDir = join(BUCKET_PATH, 'converted');
    
    // Check if Python converter exists
    if (!existsSync(pythonScript)) {
      return reject(new Error('Python converter not found at: ' + pythonScript));
    }
    
    // Create a temporary directory for the single file
    // (Python script expects a directory input)
    const tempDir = join(BUCKET_PATH, 'temp', `convert_${Date.now()}`);
    await mkdir(tempDir, { recursive: true });
    
    const fileName = basename(filePath);
    const tempFilePath = join(tempDir, fileName);
    await copyFile(filePath, tempFilePath);
    
    const args = [
      pythonScript,
      '--input', tempDir,
      '--output', outputDir
    ];
    
    const process = spawn('python', args);
    let stdout = '';
    let stderr = '';
    
    process.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    process.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    process.on('close', async (code) => {
      // Clean up temp directory
      try {
        await execPromise(`rm -rf "${tempDir}"`);
      } catch (err) {
        logger.warn('Failed to clean up temp directory:', err.message);
      }
      
      if (code !== 0) {
        logger.error('Python converter failed with code:', code);
        logger.error('Python stdout:', stdout);
        logger.error('Python stderr:', stderr);
        return reject(new Error(`Converter failed with code ${code}: ${stderr || stdout}`));
      }
      
      try {
        // Python converter creates markdown files with cleaned names
        // Find the created .md file in the output directory
        const { readdirSync } = await import('fs');
        const outputFiles = readdirSync(outputDir);
        
        // Look for newly created .md files that match our file stem
        const fileStem = fileName.replace(/\.[^/.]+$/, ''); // Remove extension
        const mdFiles = outputFiles.filter(f => 
          f.endsWith('.md') && 
          (f.startsWith(fileStem) || f.includes(fileStem.replace(/-/g, ' ')))
        );
        
        if (mdFiles.length === 0) {
          logger.warn('No markdown file found for:', fileName);
          logger.warn('Available files:', outputFiles.filter(f => f.endsWith('.md')).slice(0, 10));
          return reject(new Error('Converter did not create markdown file'));
        }
        
        // Use the most recently modified file (in case of duplicates)
        const { statSync } = await import('fs');
        const mostRecent = mdFiles
          .map(f => ({ name: f, mtime: statSync(join(outputDir, f)).mtime }))
          .sort((a, b) => b.mtime - a.mtime)[0];
        
        const mdPath = join(outputDir, mostRecent.name);
        logger.info(`Reading converted markdown: ${mostRecent.name}`);
        
        const content = await readFile(mdPath, 'utf-8');
        
        // Extract frontmatter metadata if present
        let metadata = {};
        const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n/);
        if (frontmatterMatch) {
          try {
            const yaml = frontmatterMatch[1];
            // Simple YAML parsing for common fields
            const lines = yaml.split('\n');
            lines.forEach(line => {
              const match = line.match(/^(\w+):\s*(.+)$/);
              if (match) {
                const [, key, value] = match;
                // Remove quotes if present
                metadata[key] = value.replace(/^["']|["']$/g, '');
              }
            });
          } catch (err) {
            logger.warn('Failed to parse frontmatter:', err.message);
          }
        }
        
        resolve({
          content: content,
          metadata: metadata
        });
      } catch (err) {
        logger.error('Failed to read converted markdown:', err);
        return reject(err);
      }
    });
  });
}

/**
 * Describe image using GPT-4 Vision
 * @param {string} imagePath - Path to image
 * @returns {Promise<string>} - Image description
 */
async function describeImage(imagePath) {
  try {
    const imageBuffer = await readFile(imagePath);
    const base64Image = imageBuffer.toString('base64');
    const mimeType = mime.lookup(imagePath) || 'image/jpeg';
    
    const response = await getOpenAI().chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Describe this image in detail. Include any text, objects, people, settings, and notable features.'
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:${mimeType};base64,${base64Image}`
              }
            }
          ]
        }
      ],
      max_tokens: 500
    });
    
    return response.choices[0].message.content;
  } catch (error) {
    logger.error('Image description error:', error);
    return 'Image description unavailable.';
  }
}

/**
 * Extract metadata using GPT
 * @param {string} content - Document content
 * @param {string} filename - Original filename
 * @returns {Promise<object>} - Extracted metadata
 */
async function extractMetadataWithAI(content, filename) {
  try {
    const prompt = `Extract metadata from this document. Return JSON with: title, author, category, tags (array), summary (2-3 sentences), key_topics (array).

Document filename: ${filename}

Content preview:
${content.substring(0, 2000)}`;

    const response = await getOpenAI().chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a metadata extraction specialist. Return valid JSON only.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3
    });
    
    let responseContent = response.choices[0].message.content;
    
    // Remove markdown code blocks if present
    responseContent = responseContent.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    
    const metadata = JSON.parse(responseContent);
    return metadata;
  } catch (error) {
    logger.error('Metadata extraction error:', error);
    return {
      title: filename,
      category: 'unknown',
      tags: [],
      summary: ''
    };
  }
}

/**
 * Generate user-friendly acknowledgment for uploaded file
 * @param {object} metadata - Extracted file metadata
 * @param {string} filename - Original filename
 * @param {string} action - Upload action (store/convert/process)
 * @returns {Promise<string>} - Acknowledgment message
 */
async function generateFileAcknowledgment(metadata, filename, action) {
  try {
    const prompt = `A user just uploaded a document titled "${metadata.title || filename}" to their knowledge base.

Category: ${metadata.category || 'unknown'}
Summary: ${metadata.summary || 'No summary available'}
Key Topics: ${metadata.key_topics?.join(', ') || 'None identified'}

Generate a brief, friendly acknowledgment (2-3 sentences) that:
1. Confirms receipt and successful processing
2. Summarizes the main content/purpose
3. Suggests how this might be useful for them

Be conversational and helpful, not robotic. Don't use phrases like "I've received" - just acknowledge naturally.`;

    const response = await getOpenAI().chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { 
          role: 'system', 
          content: 'You are a helpful AI assistant providing friendly acknowledgments for uploaded documents. Be warm, concise, and insightful.' 
        },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 150
    });
    
    return response.choices[0].message.content.trim();
  } catch (error) {
    logger.error('Acknowledgment generation error:', error);
    
    // Fallback acknowledgment
    if (metadata.summary) {
      return `✓ **${metadata.title || filename}** has been added to your reference library. ${metadata.summary} This will now be searchable in future conversations.`;
    } else {
      return `✓ **${filename}** has been successfully uploaded and is now available in your knowledge base.`;
    }
  }
}

/**
 * Chunk document and generate embeddings
 * @param {string} fileId - File ID
 * @param {string} content - Document content
 * @param {object} metadata - File metadata
 */
async function chunkAndEmbed(fileId, content, metadata) {
  const CHUNK_SIZE = 1000; // characters
  const CHUNK_OVERLAP = 200;
  
  const chunks = [];
  let start = 0;
  let index = 0;
  
  while (start < content.length) {
    const end = Math.min(start + CHUNK_SIZE, content.length);
    const chunkContent = content.substring(start, end);
    
    if (chunkContent.trim()) {
      chunks.push({
        id: `${fileId}_chunk_${index}`,
        file_id: fileId,
        chunk_index: index,
        content: chunkContent,
        tags: metadata.tags ? JSON.stringify(metadata.tags) : '[]'
      });
      
      index++;
    }
    
    start += CHUNK_SIZE - CHUNK_OVERLAP;
  }
  
  logger.info(`Created ${chunks.length} chunks for file ${fileId}`);
  
  // Store chunks and generate embeddings
  for (const chunk of chunks) {
    execute(`
      INSERT INTO assistant_chunks (id, file_id, chunk_index, content, tags)
      VALUES (?, ?, ?, ?, ?)
    `, [chunk.id, chunk.file_id, chunk.chunk_index, chunk.content, chunk.tags]);
    
    // Generate embedding
    try {
      const embedding = await generateEmbedding(chunk.content);
      await storeEmbedding('assistant_chunks', chunk.id, embedding, { fileId });
    } catch (err) {
      logger.error(`Failed to embed chunk ${chunk.id}:`, err);
    }
  }
  
  execute(`
    UPDATE assistant_files 
    SET embedding_status = 'completed'
    WHERE id = ?
  `, [fileId]);
}

/**
 * Queue file for conversion
 */
async function queueConversion(fileId, filePath, fileType) {
  const jobId = uuidv4();
  execute(`
    INSERT INTO assistant_jobs (id, job_type, status, payload)
    VALUES (?, 'conversion', 'pending', ?)
  `, [jobId, JSON.stringify({ fileId, filePath, fileType })]);
  
  // Process immediately (could be moved to background worker)
  convertAndIndex(fileId, filePath, fileType).catch(err => {
    logger.error('Queued conversion error:', err);
  });
}

/**
 * Detect file type from extension and mime
 */
function detectFileType(ext, mimetype) {
  if (['.md', '.txt', '.log'].includes(ext)) return 'text';
  if (['.pdf', '.doc', '.docx', '.odt', '.epub'].includes(ext)) return 'document';
  if (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'].includes(ext)) return 'image';
  if (['.mp3', '.wav', '.m4a', '.aac', '.flac', '.ogg'].includes(ext)) return 'audio';
  if (['.mp4', '.m4v', '.mov', '.avi', '.mkv', '.webm'].includes(ext)) return 'video';
  if (['.zip', '.tar', '.gz'].includes(ext)) return 'archive';
  return 'unknown';
}

/**
 * Ensure directory exists
 */
async function ensureDir(dir) {
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
}

export default {
  processUploadedFile,
  convertAndIndex
};
