import OpenAI from 'openai';
import logger from '../utils/logger.js';

// Lazy initialization of OpenAI client
let openai = null;
function getOpenAI() {
  if (!openai) {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }
  return openai;
}

/**
 * Generate embeddings for text
 * @param {string|string[]} text - Text or array of texts to embed
 * @returns {Promise<number[]|number[][]>} - Embedding vector(s)
 */
export async function generateEmbedding(text) {
  try {
    const input = Array.isArray(text) ? text : [text];
    
    const response = await getOpenAI().embeddings.create({
      model: process.env.EMBEDDING_MODEL || 'text-embedding-3-small',
      input: input.slice(0, 100), // Limit batch size
    });

    const embeddings = response.data.map(item => item.embedding);
    
    return Array.isArray(text) ? embeddings : embeddings[0];
  } catch (error) {
    logger.error('Error generating embeddings:', error);
    throw error;
  }
}

/**
 * Calculate cosine similarity between two vectors
 * @param {number[]} a - First vector
 * @param {number[]} b - Second vector
 * @returns {number} - Similarity score (0-1)
 */
export function cosineSimilarity(a, b) {
  if (a.length !== b.length) {
    throw new Error('Vectors must have the same length');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Store embedding in database
 * @param {string} sourceTable - Table name (e.g., 'messages', 'files')
 * @param {string} sourceId - Record ID
 * @param {number[]} embedding - Embedding vector
 * @param {object} metadata - Additional metadata
 */
export async function storeEmbedding(sourceTable, sourceId, embedding, metadata = {}) {
  const { execute } = await import('./db.js');
  
  const embeddingJson = JSON.stringify(embedding);
  const metadataJson = JSON.stringify(metadata);
  
  return execute(`
    INSERT INTO assistant_embeddings (id, source_table, source_id, embedding, metadata)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      embedding = excluded.embedding,
      metadata = excluded.metadata,
      created_at = CURRENT_TIMESTAMP
  `, [
    `${sourceTable}_${sourceId}`,
    sourceTable,
    sourceId,
    embeddingJson,
    metadataJson
  ]);
}

/**
 * Search for similar embeddings
 * @param {number[]} queryEmbedding - Query vector
 * @param {object} options - Search options
 * @returns {Promise<Array>} - Similar items with scores
 */
export async function searchSimilar(queryEmbedding, options = {}) {
  const {
    limit = 10,
    threshold = 0.7,
    sourceTable = null,
    knowledgeTiers = null,  // Array of tiers to search
    timeWeight = false,      // Apply recency weighting
    maxAgeHours = null       // Filter by age
  } = options;

  const { query } = await import('./db.js');
  
  let sql = `
    SELECT 
      e.id, 
      e.source_table, 
      e.source_id, 
      e.embedding, 
      e.metadata,
      e.created_at
    FROM assistant_embeddings e
  `;
  
  const params = [];
  const conditions = [];
  
  if (sourceTable) {
    conditions.push(`e.source_table = ?`);
    params.push(sourceTable);
  }
  
  // Add tier-based filtering
  if (knowledgeTiers && knowledgeTiers.length > 0) {
    // Join with files to get knowledge_tier (tier is on files table, not chunks)
    sql = `
      SELECT 
        e.id, 
        e.source_table, 
        e.source_id, 
        e.embedding, 
        e.metadata,
        e.created_at,
        f.knowledge_tier
      FROM assistant_embeddings e
      LEFT JOIN assistant_chunks c ON e.source_id = c.id AND e.source_table = 'assistant_chunks'
      LEFT JOIN assistant_files f ON c.file_id = f.id
    `;
    
    const tierPlaceholders = knowledgeTiers.map(() => '?').join(',');
    conditions.push(`(f.knowledge_tier IN (${tierPlaceholders}) OR e.source_table != 'assistant_chunks')`);
    params.push(...knowledgeTiers);
  }
  
  // Add time-based filtering
  if (maxAgeHours) {
    conditions.push(`datetime(e.created_at) >= datetime('now', '-${maxAgeHours} hours')`);
  }
  
  if (conditions.length > 0) {
    sql += ` WHERE ${conditions.join(' AND ')}`;
  }

  const rows = query(sql, params);
  
  // Calculate similarities with optional time weighting
  const now = new Date();
  const results = rows.map(row => {
    const embedding = JSON.parse(row.embedding);
    const similarity = cosineSimilarity(queryEmbedding, embedding);
    
    let adjustedScore = similarity;
    
    // Apply time weighting for recent content (personal_journal tier)
    if (timeWeight && row.created_at) {
      const createdAt = new Date(row.created_at);
      const ageHours = (now - createdAt) / (1000 * 60 * 60);
      
      // Decay factor: 100% at 0 hours, 90% at 24 hours, 70% at 7 days
      const decayFactor = Math.max(0.7, 1 - (ageHours / 168) * 0.3);
      adjustedScore = similarity * decayFactor;
    }
    
    return {
      ...row,
      embedding: embedding,
      metadata: JSON.parse(row.metadata || '{}'),
      similarity,
      adjusted_score: adjustedScore,
      knowledge_tier: row.knowledge_tier || 'unknown'
    };
  })
  .filter(item => item.similarity >= threshold)
  .sort((a, b) => (b.adjusted_score || b.similarity) - (a.adjusted_score || a.similarity))
  .slice(0, limit);

  return results;
}

export default {
  generateEmbedding,
  cosineSimilarity,
  storeEmbedding,
  searchSimilar
};
