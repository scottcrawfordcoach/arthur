// Copyright (c) 2025 Scott Crawford. All rights reserved.

import { generateEmbedding, searchSimilar } from './embeddings.js';
import { query, queryOne } from './db.js';
import logger from '../utils/logger.js';

/**
 * Recall Engine - semantic search across all stored content
 */

/**
 * Search for relevant context based on user query
 * @param {string} userQuery - User's question or message
 * @param {object} options - Search options
 * @returns {Promise<object>} - Context bundle
 */
export async function recallContext(userQuery, options = {}) {
  const {
    userId = null,
    maxResults = 10,
    includeMessages = true,
    includeFiles = true,
    includeMemory = true,
    threshold = 0.7,
    knowledgeTiers = null,   // Array of tier names to search
    tierPriorities = null,   // Ordered tier list for weighted retrieval
    timeWeight = false,      // Apply recency weighting
    maxAgeHours = null       // Filter by age
  } = options;

  try {
    // Generate embedding for query
    const queryEmbedding = await generateEmbedding(userQuery);
    
    let similarItems = [];
    
    // If tier priorities are provided, search each tier in order
    if (tierPriorities && tierPriorities.length > 0) {
      logger.info(`Tier-prioritized search: ${tierPriorities.join(' > ')}`);
      
      // Search tiers with priority weighting
      for (let i = 0; i < tierPriorities.length; i++) {
        const tier = tierPriorities[i];
        const tierWeight = 1 - (i * 0.1); // First tier: 1.0, second: 0.9, etc.
        
        const tierResults = await searchSimilar(queryEmbedding, {
          limit: Math.ceil(maxResults * 1.5),
          threshold: threshold - (i * 0.05), // Slightly lower threshold for lower priority tiers
          knowledgeTiers: [tier],
          timeWeight: timeWeight && tier === 'personal_journal',
          maxAgeHours: tier === 'personal_journal' ? maxAgeHours : null
        });
        
        // Apply tier priority weighting
        tierResults.forEach(item => {
          item.tier_weight = tierWeight;
          item.final_score = (item.adjusted_score || item.similarity) * tierWeight;
        });
        
        similarItems.push(...tierResults);
      }
      
      // Sort by final score across all tiers
      similarItems.sort((a, b) => b.final_score - a.final_score);
      similarItems = similarItems.slice(0, maxResults * 2);
      
    } else if (knowledgeTiers) {
      // Simple tier filtering without priorities
      similarItems = await searchSimilar(queryEmbedding, {
        limit: maxResults * 2,
        threshold,
        knowledgeTiers,
        timeWeight,
        maxAgeHours
      });
    } else {
      // No tier filtering - search all
      similarItems = await searchSimilar(queryEmbedding, {
        limit: maxResults * 2,
        threshold
      });
    }

    // Organize by source
    const context = {
      messages: [],
      files: [],
      memory: [],
      documents: [],
      tierStats: {}  // Track which tiers contributed
    };

    for (const item of similarItems) {
      // Track tier statistics
      const tier = item.knowledge_tier || 'unknown';
      context.tierStats[tier] = (context.tierStats[tier] || 0) + 1;
      
      // Fetch full content based on source
      if (includeMessages && item.source_table === 'assistant_chat_messages') {
        const message = queryOne(
          'SELECT * FROM assistant_chat_messages WHERE id = ?',
          [item.source_id]
        );
        if (message && (!userId || message.user_id === userId)) {
          context.messages.push({
            ...message,
            similarity: item.similarity,
            final_score: item.final_score,
            knowledge_tier: tier
          });
        }
      }
      
      if (includeFiles && item.source_table === 'assistant_chunks') {
        const chunk = queryOne(
          'SELECT c.*, f.original_name, f.file_type, f.knowledge_tier FROM assistant_chunks c JOIN assistant_files f ON c.file_id = f.id WHERE c.id = ?',
          [item.source_id]
        );
        if (chunk && (!userId || chunk.user_id === userId)) {
          context.files.push({
            ...chunk,
            similarity: item.similarity,
            final_score: item.final_score,
            knowledge_tier: chunk.knowledge_tier || tier
          });
        }
      }
      
      if (includeMemory && item.source_table === 'user_memory') {
        const memory = queryOne(
          'SELECT * FROM user_memory WHERE id = ?',
          [item.source_id]
        );
        if (memory && (!userId || memory.user_id === userId)) {
          context.memory.push({
            ...memory,
            similarity: item.similarity,
            final_score: item.final_score
          });
        }
      }

      if (item.source_table === 'reference_library_chunks') {
        const doc = queryOne(
          'SELECT c.*, d.title, d.category FROM reference_library_chunks c JOIN reference_library_documents d ON c.document_id = d.id WHERE c.id = ?',
          [item.source_id]
        );
        if (doc) {
          context.documents.push({
            ...doc,
            similarity: item.similarity,
            final_score: item.final_score
          });
        }
      }
    }

    // Limit each category
    context.messages = context.messages.slice(0, maxResults);
    context.files = context.files.slice(0, maxResults);
    context.memory = context.memory.slice(0, 5);
    context.documents = context.documents.slice(0, 5);

    const tierStatsStr = Object.entries(context.tierStats)
      .map(([tier, count]) => `${tier}:${count}`)
      .join(', ');
    
    logger.info(`Recall found: ${context.messages.length} messages, ${context.files.length} files, ${context.memory.length} memories [Tiers: ${tierStatsStr}]`);

    return context;
  } catch (error) {
    logger.error('Recall context error:', error);
    throw error;
  }
}

/**
 * Build context summary for LLM
 * @param {object} context - Context bundle
 * @returns {string} - Formatted context string
 */
export function formatContextForLLM(context) {
  const parts = [];

  if (context.memory.length > 0) {
    parts.push('=== USER MEMORY ===');
    context.memory.forEach(m => {
      parts.push(`[${m.kind}] ${m.content}`);
    });
    parts.push('');
  }

  if (context.messages.length > 0) {
    parts.push('=== RELEVANT PAST CONVERSATIONS ===');
    context.messages.forEach(m => {
      const tierTag = m.knowledge_tier ? `[${m.knowledge_tier}] ` : '';
      parts.push(`${tierTag}[${m.role}] ${m.content.substring(0, 300)}${m.content.length > 300 ? '...' : ''}`);
    });
    parts.push('');
  }

  if (context.files.length > 0) {
    parts.push('=== RELEVANT KNOWLEDGE ===');
    // Group by tier for better organization
    const filesByTier = {};
    context.files.forEach(f => {
      const tier = f.knowledge_tier || 'unknown';
      if (!filesByTier[tier]) filesByTier[tier] = [];
      filesByTier[tier].push(f);
    });
    
    // Output in tier priority order
    const tierOrder = ['core_knowledge', 'personal_journal', 'reference_library', 'archive'];
    tierOrder.forEach(tier => {
      if (filesByTier[tier]) {
        parts.push(`--- ${tier.toUpperCase().replace('_', ' ')} ---`);
        filesByTier[tier].forEach(f => {
          parts.push(`[${f.original_name || 'Unknown'}]`);
          parts.push(f.content.substring(0, 500) + (f.content.length > 500 ? '...' : ''));
          parts.push('');
        });
      }
    });
  }

  if (context.documents.length > 0) {
    parts.push('=== REFERENCE LIBRARY ===');
    context.documents.forEach(d => {
      parts.push(`[${d.title}] ${d.category || ''}`);
      parts.push(d.content.substring(0, 400) + (d.content.length > 400 ? '...' : ''));
      parts.push('');
    });
  }

  // Add tier statistics summary
  if (context.tierStats && Object.keys(context.tierStats).length > 0) {
    const tierSummary = Object.entries(context.tierStats)
      .map(([tier, count]) => `${tier}: ${count} item${count > 1 ? 's' : ''}`)
      .join(', ');
    parts.push(`[Context sources: ${tierSummary}]`);
  }

  return parts.join('\n');
}

export default {
  recallContext,
  formatContextForLLM
};
