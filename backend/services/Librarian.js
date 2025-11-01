/**
 * LIBRARIAN - Data Access & Management Service
 * 
 * The SOLE entity with database access in the ARTHUR system.
 * All other components (Knights, Herald, Arthur) must request data through the Librarian.
 * 
 * Responsibilities:
 * 1. Fulfill context requests from Context Knight
 * 2. Implement 3D relevance scoring (Recency + Frequency + Vehemence)
 * 3. Manage conversation history and user data
 * 4. Handle table creation/deletion for new categories or privacy requests
 * 5. Age and compress memories
 * 6. Enforce retention policies
 * 
 * Architecture:
 * - Context Knight generates context_requests → Librarian fulfills them
 * - Pattern Knight needs topic frequency → Librarian provides it
 * - Arthur needs conversation history → Librarian retrieves it
 * - User requests data deletion → Librarian executes it
 */

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import { policyLoader } from '../utils/policyLoader.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class Librarian {
  constructor(dbPath = null) {
    // Load Librarian policy
    this.policy = policyLoader.getLibrarianPolicy();
    console.log(`📚 Librarian initialized with policy version ${this.policy.version}`);
    
    // Database connection (consolidated to ai_local.db)
    this.dbPath = dbPath || path.join(__dirname, '../../data/db/ai_local.db');
    this.db = new Database(this.dbPath);
    this.db.pragma('journal_mode = WAL'); // Better concurrent access
    
    // OpenAI for summarization and embeddings
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    this.embeddingModel = process.env.EMBEDDING_MODEL || 'text-embedding-3-small';
    this.summaryModel = process.env.MODEL_FAST || 'gpt-4o-mini';
    
    // Metrics
    this.metrics = {
      totalQueries: 0,
      cacheHits: 0,
      avgQueryTime: 0,
      tablesCreated: 0,
      tablesDeleted: 0,
      memoriesCompressed: 0
    };
  }

  /**
   * MAIN ENTRY POINT: Fulfill context requests from Context Knight
   * 
   * @param {Object} contextRequests - From Context Knight signals
   * @returns {Promise<Object>} Retrieved and scored context
   */
  async fulfillContextRequests(contextRequests) {
    const startTime = Date.now();
    
    try {
      console.log('📚 Librarian fulfilling context requests...');
      
      const results = {
        semantic_results: [],
        conversation_history: null,
        user_data: {},
        metadata: {
          query_time: 0,
          sources_checked: [],
          confidence: 0
        }
      };
      
      // 1. Handle semantic search requests
      if (contextRequests.semantic_search && contextRequests.semantic_search.length > 0) {
        for (const searchReq of contextRequests.semantic_search) {
          // Handle both 'tier' (singular) and 'tiers' (plural) from Context Knight
          const tiers = searchReq.tiers || (searchReq.tier ? [searchReq.tier] : ['all']);
          
          const semanticResults = await this.semanticSearch(
            searchReq.query,
            tiers,
            searchReq.time_range,
            searchReq.limit
          );
          results.semantic_results.push(...semanticResults);
          results.metadata.sources_checked.push(...tiers);
        }
      }
      
      // 2. Handle conversation history requests
      if (contextRequests.conversation_history) {
        results.conversation_history = await this.getConversationHistory(
          contextRequests.conversation_history
        );
      }
      
      // 3. Handle user data requests
      if (contextRequests.user_data && contextRequests.user_data.length > 0) {
        for (const dataType of contextRequests.user_data) {
          results.user_data[dataType] = await this.getUserData(dataType);
        }
      }
      
      // Calculate overall confidence
      results.metadata.confidence = this.calculateRetrievalConfidence(results);
      results.metadata.query_time = Date.now() - startTime;
      
      this.updateMetrics(true, results.metadata.query_time);
      
      console.log(`✅ Retrieved ${results.semantic_results.length} semantic results, confidence: ${results.metadata.confidence.toFixed(2)}`);
      
      // Format results for Arthur (flatten semantic_results to results array)
      return {
        results: results.semantic_results.map(r => ({
          ...r,
          relevance_score: r.scores?.relevance || 0
        })),
        conversation_history: results.conversation_history,
        user_data: results.user_data,
        metadata: results.metadata
      };
      
    } catch (error) {
      console.error('❌ Librarian failed to fulfill requests:', error.message);
      this.updateMetrics(false, Date.now() - startTime);
      throw error;
    }
  }

  /**
   * Retrieve project bucket context snippets ordered by semantic similarity
   * @param {string} bucketId - Active project bucket ID
   * @param {string} query - User message or topic query
   * @param {Object} options - Retrieval options
   * @returns {Promise<Object>} Project context payload
   */
  async getProjectContext(bucketId, query, options = {}) {
    const startTime = Date.now();

    const {
      maxSnippets = 6,
      tokenCap = 1500,
      minimumSimilarity = 0.2
    } = options;

    if (!bucketId || !query) {
      return {
        snippets: [],
        total_tokens: 0,
        latency_ms: 0,
        bucketId
      };
    }

    try {
      const queryEmbedding = await this.generateEmbedding(query);

      const rows = this.db.prepare(`
        SELECT 
          c.id AS chunk_id,
          c.file_id,
          c.chunk_index,
          c.content,
          c.summary,
          c.embedding,
          c.created_at,
          f.original_name,
          f.metadata AS file_metadata,
          f.processed_at,
          f.knowledge_tier,
          bf.uploaded_at
        FROM assistant_project_bucket_files bf
        JOIN assistant_chunks c ON c.file_id = bf.file_id
        LEFT JOIN assistant_files f ON f.id = bf.file_id
        WHERE bf.bucket_id = ?
          AND c.embedding IS NOT NULL
      `).all(bucketId);

      if (!rows || rows.length === 0) {
        return {
          snippets: [],
          total_tokens: 0,
          latency_ms: Date.now() - startTime,
          bucketId
        };
      }

      const scored = [];

      for (const row of rows) {
        try {
          const embedding = JSON.parse(row.embedding);
          const similarity = this.cosineSimilarity(queryEmbedding, embedding);

          if (similarity < minimumSimilarity) {
            continue;
          }

          const content = row.summary || row.content || '';
          const snippet = content.length > 900 ? `${content.slice(0, 900)}…` : content;
          const approxTokens = Math.ceil(snippet.length / 4);

          scored.push({
            chunkId: row.chunk_id,
            fileId: row.file_id,
            fileName: row.original_name || 'Untitled file',
            chunkIndex: row.chunk_index,
            summary: row.summary || null,
            snippet,
            similarity,
            approxTokens,
            createdAt: row.created_at,
            uploadedAt: row.uploaded_at,
            processedAt: row.processed_at,
            knowledgeTier: row.knowledge_tier || 'reference_library',
            fileMetadata: this.safeParse(row.file_metadata),
            source: 'project_bucket'
          });
        } catch (err) {
          console.warn('📚 Failed to parse project chunk embedding:', err.message);
        }
      }

      scored.sort((a, b) => b.similarity - a.similarity);

      const selected = [];
      let tokenTally = 0;

      for (const item of scored) {
        if (selected.length >= maxSnippets) {
          break;
        }

        if ((tokenTally + item.approxTokens) > tokenCap) {
          break;
        }

        selected.push(item);
        tokenTally += item.approxTokens;
      }

      return {
        snippets: selected,
        total_tokens: tokenTally,
        total_candidates: scored.length,
        latency_ms: Date.now() - startTime,
        bucketId
      };
    } catch (error) {
      console.error('📚 Project context retrieval failed:', error.message);
      return {
        snippets: [],
        total_tokens: 0,
        latency_ms: Date.now() - startTime,
        bucketId,
        error: error.message
      };
    }
  }

  /**
   * SEMANTIC SEARCH with 3D Relevance Scoring
   * 
   * @param {string} query - Search query
   * @param {Array<string>} tiers - Knowledge tiers to search ('reference_library', 'personal_journal', 'conversation', 'all')
   * @param {string} timeRange - 'recent', 'month', 'all'
   * @param {number} limit - Max results
   * @returns {Promise<Array>} Scored and ranked results
   */
  async semanticSearch(query, tiers = ['all'], timeRange = 'all', limit = 10) {
    try {
      // Generate query embedding
      const queryEmbedding = await this.generateEmbedding(query);
      
      const allResults = [];
      
      // Determine which tables to search based on tiers
      const searchAll = tiers.includes('all');
      const searchLibrary = searchAll || tiers.includes('reference_library');
      const searchJournal = searchAll || tiers.includes('personal_journal');
      const searchChat = searchAll || tiers.includes('conversation');
      
      // Build time filter
      const timeFilter = this.buildTimeFilter(timeRange);
      
      // 1. Search reference library chunks
      if (searchLibrary) {
        try {
          const libraryResults = this.db.prepare(`
            SELECT 
              id, content, embedding,
              summary, section_title, category, document_id,
              created_at, 'reference_library_chunks' as table_name
            FROM reference_library_chunks
            WHERE embedding IS NOT NULL
            ${timeFilter}
          `).all();
          
          allResults.push(...libraryResults.map(r => ({
            ...r,
            table: 'reference_library_chunks'
          })));
        } catch (error) {
          console.error('Error searching reference library:', error.message);
        }
      }
      
      // 2. Search journal entries
      if (searchJournal) {
        try {
          const journalResults = this.db.prepare(`
            SELECT 
              id, content, '' as embedding,
              json_object('entry_type', entry_type, 'mood', mood, 'topics', topics, 'sentiment_score', sentiment_score) as metadata,
              created_at, 'journal_entries' as table_name
            FROM journal_entries
            ${timeFilter}
          `).all();
          
          allResults.push(...journalResults.map(r => ({
            ...r,
            table: 'journal_entries'
          })));
        } catch (error) {
          console.error('Error searching journal:', error.message);
        }
      }
      
      // 3. Search chat messages
      if (searchChat) {
        try {
          const chatResults = this.db.prepare(`
            SELECT 
              id, content, embedding,
              created_at, 'assistant_chat_messages' as table_name
            FROM assistant_chat_messages
            ${timeFilter}
          `).all();
          
          allResults.push(...chatResults.map(r => ({
            ...r,
            table: 'assistant_chat_messages'
          })));
        } catch (error) {
          console.error('Error searching chat messages:', error.message);
        }
      }
      
      // Calculate semantic similarity for all results
      const resultsWithSimilarity = allResults.map(result => {
        let semantic_similarity = 0;
        
        if (result.embedding) {
          try {
            const resultEmbedding = JSON.parse(result.embedding);
            semantic_similarity = this.cosineSimilarity(queryEmbedding, resultEmbedding);
          } catch (error) {
            // If embedding parsing fails, use text similarity fallback
            semantic_similarity = 0.1;
          }
        } else {
          // No embedding, use simple text matching as fallback
          const queryLower = query.toLowerCase();
          const contentLower = (result.content || '').toLowerCase();
          semantic_similarity = contentLower.includes(queryLower) ? 0.5 : 0.1;
        }
        
        return {
          ...result,
          semantic_similarity
        };
      });
      
      // Filter to top candidates by semantic similarity
      const topCandidates = resultsWithSimilarity
        .sort((a, b) => b.semantic_similarity - a.semantic_similarity)
        .slice(0, limit * 3); // Get 3x limit for 3D scoring
      
      // Apply 3D relevance scoring
      const scoredResults = await this.apply3DScoring(topCandidates, query);
      
      // Return top results after 3D scoring
      return scoredResults.slice(0, limit);
      
    } catch (error) {
      console.error('Semantic search failed:', error.message);
      return [];
    }
  }
  
  /**
   * Calculate cosine similarity between two embedding vectors
   */
  cosineSimilarity(vecA, vecB) {
    if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }
    
    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);
    
    if (normA === 0 || normB === 0) return 0;
    
    return dotProduct / (normA * normB);
  }

  /**
   * Apply 3D Relevance Scoring to results
   * Formula: semantic(0.4) + recency(0.25) + frequency(0.20) + vehemence(0.15)
   * + credibility adjustment
   */
  async apply3DScoring(results, query) {
    const scoredResults = results.map(result => {
      // 1. Semantic similarity (already calculated)
      const semanticScore = result.semantic_similarity || 0;
      
      // 2. Recency score (exponential decay)
      const recencyScore = this.calculateRecencyScore(result.created_at);
      
      // 3. Frequency score (reference count, log-scaled)
      const frequencyScore = this.calculateFrequencyScore(result.reference_count || 0);
      
      // 4. Vehemence score (from metadata if available)
      const vehemenceScore = this.calculateVehemenceScore(result.metadata);
      
      // 5. Credibility adjustment (boost high-credibility sources)
      const credibilityBoost = this.calculateCredibilityBoost(result.metadata);
      
      // Calculate weighted 3D relevance score using policy weights
      const weights = this.policy['3d_scoring'].weights;
      let relevanceScore = 
        (semanticScore * weights.semantic) +
        (recencyScore * weights.recency) +
        (frequencyScore * weights.frequency) +
        (vehemenceScore * weights.vehemence);
      
      // Apply credibility boost (5-15% adjustment)
      relevanceScore *= credibilityBoost;
      
      return {
        ...result,
        scores: {
          semantic: semanticScore,
          recency: recencyScore,
          frequency: frequencyScore,
          vehemence: vehemenceScore,
          credibilityBoost: credibilityBoost,
          relevance: relevanceScore
        }
      };
    });
    
    // Sort by relevance score
    return scoredResults.sort((a, b) => b.scores.relevance - a.scores.relevance);
  }

  /**
   * Calculate recency score with exponential decay
   * Score decreases exponentially as content ages
   */
  calculateRecencyScore(timestamp) {
    const now = Date.now();
    const created = new Date(timestamp).getTime();
    const ageInDays = (now - created) / (1000 * 60 * 60 * 24);
    
    // Exponential decay using policy-defined half-life
    const halfLife = this.policy['3d_scoring'].recency.half_life_days;
    const decayRate = this.policy['3d_scoring'].recency.decay_rate;
    return Math.exp(-ageInDays / halfLife) * decayRate;
  }

  /**
   * Calculate frequency score from reference count
   * Log-scaled to prevent very frequent items from dominating
   */
  calculateFrequencyScore(referenceCount) {
    if (referenceCount === 0) return 0;
    
    const maxRefs = this.policy['3d_scoring'].frequency.max_references;
    // Log scale: log(count + 1) / log(max)
    // Normalizes 0-max+ references to 0-1 scale
    return Math.min(1.0, Math.log(referenceCount + 1) / Math.log(maxRefs));
  }

  /**
   * Calculate vehemence score from emotional metadata
   * Uses urgency, sentiment, and risk from Emotion Knight signals
   */
  calculateVehemenceScore(metadata) {
    if (!metadata) return 0.5; // Neutral if no metadata
    
    try {
      const meta = typeof metadata === 'string' ? JSON.parse(metadata) : metadata;
      
      // Extract emotion signals if available
      const urgency = meta.emotion?.urgency || 0.3;
      const sentiment = Math.abs(meta.emotion?.sentiment || 0); // Absolute value (intensity)
      const risk = meta.emotion?.risk || 0;
      
      // Combine using policy weights
      const weights = this.policy['3d_scoring'].vehemence.weights;
      return (urgency * weights.urgency) + (sentiment * weights.sentiment) + (risk * weights.risk_level);
      
    } catch (error) {
      return 0.5; // Neutral if parsing fails
    }
  }

  /**
   * Calculate credibility boost for source
   * High credibility sources get slight boost, controversial get penalty
   */
  calculateCredibilityBoost(metadata) {
    if (!metadata) return 1.0; // Neutral
    
    try {
      const meta = typeof metadata === 'string' ? JSON.parse(metadata) : metadata;
      
      // Check for credibility metadata (added by bulk import)
      // Handle both direct 'credibility' field and nested 'credibility.level'
      const credibilityLevel = meta.credibility?.level || meta.credibility;
      
      if (!credibilityLevel) return 1.0; // No credibility data = neutral
      
      // Apply boost/penalty based on credibility level (case-insensitive)
      const level = credibilityLevel.toUpperCase();
      switch (level) {
        case 'HIGH':
          return 1.15;  // 15% boost for peer-reviewed/scientific
        case 'MODERATE':
          return 1.05;  // 5% boost for evidence-based
        case 'LOW':
          return 0.95;  // 5% penalty for anecdotal (still valuable!)
        case 'CONTROVERSIAL':
          return 0.85;  // 15% penalty for controversial claims
        default:
          return 1.0;
      }
      
    } catch (error) {
      return 1.0; // Neutral if parsing fails
    }
  }

  /**
   * Get conversation history with filters
   */
  async getConversationHistory(historyRequest) {
    try {
      const { time_range = 'recent', limit = 20, session_id = null } = historyRequest;
      
      const timeFilter = this.buildTimeFilter(time_range);
      const sessionFilter = session_id ? `AND session_id = ?` : '';
      
      const query = `
        SELECT id, session_id, role, content as message, created_at as timestamp
        FROM assistant_chat_messages
        WHERE 1=1
        ${timeFilter}
        ${sessionFilter}
        ORDER BY created_at DESC
        LIMIT ?
      `;
      
      const stmt = this.db.prepare(query);
      const params = session_id ? [session_id, limit] : [limit];
      const messages = stmt.all(...params);
      
      // Increment reference count for accessed messages
      for (const msg of messages) {
        this.incrementReferenceCount('assistant_chat_messages', msg.id);
      }
      
      return messages.reverse(); // Return in chronological order
      
    } catch (error) {
      console.error('Failed to get conversation history:', error.message);
      return [];
    }
  }

  /**
   * Get user-specific data (preferences, wellness, etc.)
   */
  async getUserData(dataType) {
    try {
      switch (dataType) {
        case 'preferences':
          return this.getUserPreferences();
        case 'wellness':
          return this.getWellnessData();
        case 'goals':
          return this.getUserGoals();
        default:
          console.warn(`Unknown data type: ${dataType}`);
          return null;
      }
    } catch (error) {
      console.error(`Failed to get ${dataType}:`, error.message);
      return null;
    }
  }

  /**
   * TABLE MANAGEMENT: Create new table for custom category
   * Used when user introduces new data types or categories
   */
  async createTable(tableName, schema) {
    try {
      console.log(`📚 Creating table: ${tableName}`);
      
      // Validate table name (prevent SQL injection)
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) {
        throw new Error('Invalid table name');
      }
      
      // Check if table exists
      const exists = this.db.prepare(
        `SELECT name FROM sqlite_master WHERE type='table' AND name=?`
      ).get(tableName);
      
      if (exists) {
        console.log(`⚠️  Table ${tableName} already exists`);
        return false;
      }
      
      // Create table with provided schema
      this.db.exec(schema);
      
      // Log creation
      this.logTableOperation('create', tableName, schema);
      this.metrics.tablesCreated++;
      
      console.log(`✅ Table ${tableName} created successfully`);
      return true;
      
    } catch (error) {
      console.error(`Failed to create table ${tableName}:`, error.message);
      throw error;
    }
  }

  /**
   * TABLE MANAGEMENT: Delete table (for privacy or category removal)
   */
  async deleteTable(tableName, reason = 'user_request') {
    try {
      console.log(`📚 Deleting table: ${tableName} (reason: ${reason})`);
      
      // Validate table name
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) {
        throw new Error('Invalid table name');
      }
      
      // Protected tables (cannot be deleted)
      const protectedTables = [
        'assistant_chat_messages',
        'knowledge_chunks',
        'user_preferences',
        'wellness_logs'
      ];
      
      if (protectedTables.includes(tableName)) {
        throw new Error(`Cannot delete protected table: ${tableName}`);
      }
      
      // Backup before deletion (in case of accidental deletion)
      await this.backupTable(tableName);
      
      // Delete table
      this.db.exec(`DROP TABLE IF EXISTS ${tableName}`);
      
      // Log deletion
      this.logTableOperation('delete', tableName, reason);
      this.metrics.tablesDeleted++;
      
      console.log(`✅ Table ${tableName} deleted successfully`);
      return true;
      
    } catch (error) {
      console.error(`Failed to delete table ${tableName}:`, error.message);
      throw error;
    }
  }

  /**
   * DATA PRIVACY: Delete user data matching criteria
   */
  async deleteUserData(criteria) {
    try {
      console.log('📚 Processing data deletion request...');
      
      const deletionLog = {
        timestamp: new Date().toISOString(),
        criteria,
        deleted: {}
      };
      
      // 1. Delete from conversation history
      if (criteria.conversations) {
        const result = this.deleteConversations(criteria.conversations);
        deletionLog.deleted.conversations = result;
      }
      
      // 2. Delete from knowledge chunks
      if (criteria.knowledge) {
        const result = this.deleteKnowledge(criteria.knowledge);
        deletionLog.deleted.knowledge = result;
      }
      
      // 3. Delete from custom tables
      if (criteria.tables) {
        for (const tableName of criteria.tables) {
          const result = this.deleteFromTable(tableName, criteria.filter);
          deletionLog.deleted[tableName] = result;
        }
      }
      
      // Log the deletion for audit trail
      this.logDataDeletion(deletionLog);
      
      console.log(`✅ Data deletion complete:`, deletionLog.deleted);
      return deletionLog;
      
    } catch (error) {
      console.error('Failed to delete user data:', error.message);
      throw error;
    }
  }

  /**
   * Delete conversations matching criteria
   */
  deleteConversations(criteria) {
    const { session_id, time_range, topics } = criteria;
    
    let whereClause = '(is_test = 0 OR is_test IS NULL)';
    const params = [];
    
    if (session_id) {
      whereClause += ' AND session_id = ?';
      params.push(session_id);
    }
    
    if (time_range) {
      whereClause += ` AND ${this.buildTimeFilter(time_range, false)}`;
    }
    
    const stmt = this.db.prepare(
      `DELETE FROM assistant_chat_messages WHERE ${whereClause}`
    );
    
    const result = stmt.run(...params);
    return { deleted: result.changes };
  }

  /**
   * Delete knowledge chunks matching criteria
   */
  deleteKnowledge(criteria) {
    const { source_file, tier, topics } = criteria;
    
    let whereClause = '(is_test = 0 OR is_test IS NULL)';
    const params = [];
    
    if (source_file) {
      whereClause += ' AND source_file = ?';
      params.push(source_file);
    }
    
    if (tier) {
      whereClause += ' AND tier = ?';
      params.push(tier);
    }
    
    const stmt = this.db.prepare(
      `DELETE FROM knowledge_chunks WHERE ${whereClause}`
    );
    
    const result = stmt.run(...params);
    return { deleted: result.changes };
  }

  /**
   * MEMORY AGING: Compress old memories into summaries
   * Runs periodically to keep DB size manageable
   */
  async ageMemories() {
    try {
      console.log('📚 Running memory aging process...');
      
      const compressionDays = this.policy.retention.compression_threshold_days;
      const thresholdDate = new Date();
      thresholdDate.setDate(thresholdDate.getDate() - compressionDays);
      
      // Find old, uncompressed messages
      const stmt = this.db.prepare(`
        SELECT id, session_id, role, message, timestamp
        FROM assistant_chat_messages
        WHERE timestamp < ?
        AND (is_compressed = 0 OR is_compressed IS NULL)
        AND (is_test = 0 OR is_test IS NULL)
        ORDER BY timestamp ASC
        LIMIT 100
      `);
      
      const oldMessages = stmt.all(thresholdDate.toISOString());
      
      if (oldMessages.length === 0) {
        console.log('No memories to age');
        return { compressed: 0 };
      }
      
      // Group by session for context-aware compression
      const sessionGroups = this.groupBySession(oldMessages);
      
      let compressed = 0;
      for (const [sessionId, messages] of Object.entries(sessionGroups)) {
        const summary = await this.compressMessages(messages);
        
        // Store summary
        this.storeCompressedMemory(sessionId, messages, summary);
        compressed += messages.length;
        this.metrics.memoriesCompressed += messages.length;
      }
      
      console.log(`✅ Compressed ${compressed} memories into summaries`);
      return { compressed };
      
    } catch (error) {
      console.error('Memory aging failed:', error.message);
      return { compressed: 0, error: error.message };
    }
  }

  /**
   * Compress messages into summary using LLM
   */
  async compressMessages(messages) {
    try {
      const conversation = messages
        .map(m => `${m.role}: ${m.message}`)
        .join('\n');
      
      const tokenLimit = this.policy.retention.summary_token_limit;
      const prompt = `Summarize this conversation in ${tokenLimit} tokens or less, preserving key topics, decisions, and emotional context:\n\n${conversation}`;
      
      const response = await this.openai.chat.completions.create({
        model: this.summaryModel,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: tokenLimit,
        temperature: 0.3
      });
      
      return response.choices[0].message.content;
      
    } catch (error) {
      console.error('Failed to compress messages:', error.message);
      return 'Summary unavailable';
    }
  }

  /**
   * Store compressed memory and mark originals
   */
  storeCompressedMemory(sessionId, originalMessages, summary) {
    // Create compressed memory record
    const insertStmt = this.db.prepare(`
      INSERT INTO compressed_memories (session_id, original_count, summary, compressed_at, original_date_range)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    const dateRange = `${originalMessages[0].timestamp} to ${originalMessages[originalMessages.length - 1].timestamp}`;
    
    insertStmt.run(
      sessionId,
      originalMessages.length,
      summary,
      new Date().toISOString(),
      dateRange
    );
    
    // Mark originals as compressed
    const updateStmt = this.db.prepare(`
      UPDATE assistant_chat_messages
      SET is_compressed = 1
      WHERE id = ?
    `);
    
    for (const msg of originalMessages) {
      updateStmt.run(msg.id);
    }
  }

  /**
   * Helper: Build time filter SQL
   */
  buildTimeFilter(timeRange, includeWhere = false) {
    const prefix = includeWhere ? 'WHERE' : 'AND';
    
    switch (timeRange) {
      case 'recent':
        return `${prefix} created_at >= datetime('now', '-7 days')`;
      case 'month':
        return `${prefix} created_at >= datetime('now', '-30 days')`;
      case 'quarter':
        return `${prefix} created_at >= datetime('now', '-90 days')`;
      case 'year':
        return `${prefix} created_at >= datetime('now', '-365 days')`;
      case 'all':
      default:
        return '';
    }
  }

  /**
   * Helper: Generate embedding for query
   */
  async generateEmbedding(text) {
    try {
      const response = await this.openai.embeddings.create({
        model: this.embeddingModel,
        input: text
      });
      return response.data[0].embedding;
    } catch (error) {
      console.error('Failed to generate embedding:', error.message);
      throw error;
    }
  }

  /**
   * Helper: Increment reference count (for frequency scoring)
   */
  incrementReferenceCount(tableName, id) {
    try {
      const stmt = this.db.prepare(`
        UPDATE ${tableName}
        SET reference_count = COALESCE(reference_count, 0) + 1,
            last_accessed = datetime('now')
        WHERE id = ?
      `);
      stmt.run(id);
    } catch (error) {
      // Silently fail - not critical
    }
  }

  /**
   * Helper: Calculate retrieval confidence
   */
  calculateRetrievalConfidence(results) {
    const semanticCount = results.semantic_results.length;
    const hasHistory = results.conversation_history && results.conversation_history.length > 0;
    const userDataCount = Object.keys(results.user_data).length;
    
    // Base confidence on data availability
    let confidence = 0.3; // Baseline
    
    if (semanticCount > 0) confidence += 0.4;
    if (hasHistory) confidence += 0.2;
    if (userDataCount > 0) confidence += 0.1;
    
    return Math.min(1.0, confidence);
  }

  /**
   * Helper: Group messages by session
   */
  groupBySession(messages) {
    const groups = {};
    for (const msg of messages) {
      if (!groups[msg.session_id]) {
        groups[msg.session_id] = [];
      }
      groups[msg.session_id].push(msg);
    }
    return groups;
  }

  /**
   * Helper: Get user preferences (stub)
   */
  getUserPreferences() {
    // TODO: Implement full preferences system
    return { theme: 'default', language: 'en' };
  }

  /**
   * Helper: Get wellness data (stub)
   */
  getWellnessData() {
    // TODO: Implement wellness data retrieval
    return { recent_mood: 'neutral', activity_level: 'moderate' };
  }

  /**
   * Helper: Get user goals (stub)
   */
  getUserGoals() {
    // TODO: Implement goals system
    return [];
  }

  /**
   * Helper: Backup table before deletion
   */
  async backupTable(tableName) {
    try {
      const timestamp = Date.now(); // Use numeric timestamp for valid table name
      const backupName = `${tableName}_backup_${timestamp}`;
      
      this.db.exec(`CREATE TABLE ${backupName} AS SELECT * FROM ${tableName}`);
      console.log(`📦 Backed up ${tableName} to ${backupName}`);
    } catch (error) {
      console.warn('Backup failed:', error.message);
    }
  }

  /**
   * Helper: Log table operations
   */
  logTableOperation(operation, tableName, details) {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO librarian_logs (operation, table_name, details, timestamp)
        VALUES (?, ?, ?, ?)
      `);
      stmt.run(operation, tableName, JSON.stringify(details), new Date().toISOString());
    } catch (error) {
      console.warn('Failed to log table operation:', error.message);
    }
  }

  /**
   * Helper: Log data deletion
   */
  logDataDeletion(deletionLog) {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO data_deletion_log (criteria, deleted_counts, timestamp)
        VALUES (?, ?, ?)
      `);
      stmt.run(
        JSON.stringify(deletionLog.criteria),
        JSON.stringify(deletionLog.deleted),
        deletionLog.timestamp
      );
    } catch (error) {
      console.warn('Failed to log data deletion:', error.message);
    }
  }

  /**
   * Helper: Safe JSON parse
   */
  safeParse(raw, fallback = null) {
    if (!raw) {
      return fallback;
    }

    if (typeof raw === 'object') {
      return raw;
    }

    try {
      return JSON.parse(raw);
    } catch (error) {
      return fallback;
    }
  }

  /**
   * Helper: Delete from custom table
   */
  deleteFromTable(tableName, filter) {
    try {
      // Build WHERE clause from filter
      const conditions = [];
      const params = [];
      
      for (const [key, value] of Object.entries(filter)) {
        conditions.push(`${key} = ?`);
        params.push(value);
      }
      
      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      
      const stmt = this.db.prepare(`DELETE FROM ${tableName} ${whereClause}`);
      const result = stmt.run(...params);
      
      return { deleted: result.changes };
    } catch (error) {
      console.error(`Failed to delete from ${tableName}:`, error.message);
      return { deleted: 0, error: error.message };
    }
  }

  /**
   * Update metrics
   */
  updateMetrics(success, queryTime) {
    this.metrics.totalQueries++;
    
    // Update running average
    const totalTime = this.metrics.avgQueryTime * (this.metrics.totalQueries - 1);
    this.metrics.avgQueryTime = (totalTime + queryTime) / this.metrics.totalQueries;
  }

  /**
   * Get performance metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      successRate: this.metrics.totalQueries > 0
        ? (this.metrics.totalQueries - 0) / this.metrics.totalQueries // Simplified
        : 0
    };
  }

  /**
   * Close database connection
   */
  close() {
    this.db.close();
  }
}

export default Librarian;
