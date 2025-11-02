// Copyright (c) 2025 Scott Crawford. All rights reserved.

/**
 * ContextKnight.js
 * 
 * Evidence Council Knight: Determines what context is relevant
 * 
 * Responsibilities:
 * - Analyze signals from Emotion, Needs, and Pattern Knights
 * - Determine what data would be helpful from Librarian
 * - Produce structured context_requests (does NOT fetch data directly)
 * - Prioritize context requests based on signal analysis
 * 
 * Signals Produced:
 * - context_requests: Structured requests for Librarian
 *   - semantic_search: Array of search queries with tier/limit
 *   - conversation_history: Parameters for history retrieval
 *   - user_data: Specific user preferences/settings needed
 * - context_priority: Ordered array of what's most important
 * - novelty: Is this a new topic (0-1) or building on past conversations
 * 
 * Model: GPT-4o-mini (reasoning about context relevance)
 * 
 * CRITICAL: This Knight does NOT access the database. It only produces
 * REQUEST objects that the Librarian will fulfill.
 */

import KnightBase from './KnightBase.js';
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class ContextKnight extends KnightBase {
  constructor() {
    super('context');
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    
    // Load policy
    const policyPath = path.join(__dirname, '../config/context_knight_policy.json');
    this.policy = JSON.parse(fs.readFileSync(policyPath, 'utf8'));
  }

  /**
   * Analyze what context is needed based on all Knight signals
   * @param {string} userMessage - Current user message
   * @param {Object} context - Signals from other Knights
   * @returns {Promise<Object>} Context signals
   */
  async analyze(userMessage, context = {}) {
    try {
      const { emotion, needs, pattern } = context;
      
      // Quick analysis for baseline
      const quickContext = this.quickAnalysis(userMessage, { emotion, needs, pattern });
      
      // If disabled or no API key, return pattern-based analysis
      if (!this.enabled || !process.env.OPENAI_API_KEY) {
        return this.createResult(quickContext, 0.65, 'Pattern-based context analysis (LLM disabled)');
      }

      // LLM-based analysis for intelligent context requests
      return await this.llmAnalysis(userMessage, { emotion, needs, pattern }, quickContext);
      
    } catch (error) {
      return this.handleError(error, userMessage);
    }
  }

  /**
   * Quick pattern-based context analysis using policy rules
   * @param {string} userMessage - Current message
   * @param {Object} signals - Other Knight signals
   * @returns {Object} Basic context signals
   */
  quickAnalysis(userMessage, signals) {
    const { emotion, needs, pattern } = signals;
    const rules = this.policy.context_rules;
    
    const context_requests = {
      semantic_search: [],
      conversation_history: null,
      user_data: []
    };
    
    const context_priority = [];
    
    // Check crisis/high urgency (highest priority)
    if (emotion?.urgency > 0.7 || emotion?.risk > 0.5) {
      const rule = rules.crisis_or_high_urgency;
      context_requests.semantic_search.push({
        query: userMessage,
        tier: rule.tiers[0],
        limit: rule.limit,
        time_range: rule.time_range,
        scoring: rule.scoring
      });
      context_requests.conversation_history = {
        lookback: rule.conversation_lookback,
        limit: 10
      };
      context_priority.push(...rule.priority);
    }
    
    // Check learning intent
    if (needs?.learning_intent > 0.6) {
      const rule = rules.learning_intent;
      context_requests.semantic_search.push({
        query: userMessage,
        tier: rule.tiers[0],
        limit: rule.limit,
        time_range: rule.time_range,
        scoring: rule.scoring
      });
      if (!context_priority.includes('semantic_search')) {
        context_priority.push('semantic_search');
      }
    }
    
    // Check emotional support
    if (needs?.support_needed && needs.support_needed.includes('emotional')) {
      const rule = rules.emotional_support;
      context_requests.semantic_search.push({
        query: rule.query,
        tier: rule.tiers[0],
        limit: rule.limit,
        time_range: rule.time_range,
        scoring: rule.scoring
      });
      if (rule.request_user_data) {
        context_requests.user_data.push(...rule.request_user_data);
      }
      if (!context_priority.includes('semantic_search')) {
        context_priority.push('semantic_search');
      }
    }
    
    // Check recurring topics
    if (pattern?.recurring_topics && pattern.recurring_topics.length > 0) {
      const rule = rules.recurring_topics;
      pattern.recurring_topics.forEach(topic => {
        context_requests.semantic_search.push({
          query: topic,
          tier: rule.tiers[0],
          limit: rule.limit,
          time_range: rule.time_range,
          scoring: rule.scoring
        });
      });
      if (!context_priority.includes('semantic_search')) {
        context_priority.push('semantic_search');
      }
    }
    
    // Default: search all sources
    if (context_requests.semantic_search.length === 0) {
      const rule = rules.default;
      context_requests.semantic_search.push({
        query: userMessage,
        tier: rule.tiers[0],
        limit: rule.limit,
        time_range: rule.time_range,
        scoring: rule.scoring
      });
      context_priority.push('semantic_search');
    }
    
    // Enforce limits from policy
    const limits = this.policy.limits;
    if (context_requests.semantic_search.length > limits.max_semantic_searches_per_request) {
      context_requests.semantic_search = context_requests.semantic_search.slice(0, limits.max_semantic_searches_per_request);
    }
    
    // Calculate novelty based on policy thresholds
    const noveltyThresholds = this.policy.novelty_threshold;
    const novelty = pattern?.recurring_topics?.length > 0 
      ? noveltyThresholds.recurring_topic_present 
      : noveltyThresholds.no_recurring_topics;
    
    return {
      context_requests,
      context_priority,
      novelty
    };
  }

  /**
   * LLM-based context analysis for intelligent requests
   * @param {string} userMessage - Current message
   * @param {Object} signals - Other Knight signals
   * @param {Object} quickContext - Quick analysis baseline
   * @returns {Promise<Object>} Context knight result
   */
  async llmAnalysis(userMessage, signals, quickContext) {
    const { emotion, needs, pattern } = signals;
    
    // Build context summary for LLM
    const emotionSummary = emotion ? `
Emotional state:
- Mood: ${emotion.mood}
- Sentiment: ${emotion.sentiment}
- Urgency: ${emotion.urgency}
- Risk: ${emotion.risk}` : 'No emotional signals available';

    const needsSummary = needs ? `
User needs:
- Stated intent: ${needs.stated_intent}
- Latent need: ${needs.latent_need}
- Learning intent: ${needs.learning_intent}
- Support needed: [${needs.support_needed.join(', ')}]` : 'No needs signals available';

    const patternSummary = pattern && pattern.recurring_topics?.length > 0 ? `
Conversation patterns:
- Recurring topics: [${pattern.recurring_topics.join(', ')}]
- Behavior trends: [${pattern.behavior_trends ? pattern.behavior_trends.join(', ') : 'none'}]
- Conversation rhythm: ${pattern.conversation_rhythm || 'unknown'}
- Pattern strength: ${pattern.pattern_strength}` : 'No conversation history available (first interaction or new user)';

    const prompt = `You are an expert at determining what contextual information would be most helpful.

User message: "${userMessage}"

${emotionSummary}

${needsSummary}

${patternSummary}

Your job is to REQUEST context from the Librarian (you do NOT fetch data yourself).
The Librarian searches ALL TIME using 3D relevance scoring (Recency + Frequency + Vehemence).

Determine what context would help Arthur respond effectively:

1. **semantic_search**: What topics/themes should we search for? (array of objects)
   Each search MUST have:
   - query: Search query string
   - tier: Which knowledge tier? ("core_knowledge", "personal_journal", "reference_library", "archive")
   - limit: How many results? (5-20)
   - time_range: ALWAYS "all" (search entire history)
   - scoring: 3D relevance weights (object)
     * semantic_weight: How related to query (0.3-0.5, default 0.4)
     * recency_weight: How recent (0.1-0.4, default 0.25)
     * frequency_weight: How often discussed (0.1-0.3, default 0.20)
     * vehemence_weight: How emotionally intense (0.1-0.25, default 0.15)
     All weights MUST sum to 1.0
   
   Scoring weight guidelines:
   - High urgency/crisis → increase recency_weight (0.35-0.4)
   - Recurring topics → increase frequency_weight (0.25-0.3)
   - High emotional intensity → increase vehemence_weight (0.2-0.25)
   - Factual/learning queries → increase semantic_weight (0.45-0.5)
   
   Tier selection guide:
   - core_knowledge: Core concepts, fundamental information
   - personal_journal: User's past conversations, personal context
   - reference_library: External knowledge, books, articles
   - archive: Older/less relevant content

2. **conversation_history**: Timeline view for recent context (object or null)
   If yes: { lookback: "24 hours" | "7 days" | "30 days", limit: 5-20 }
   If no: null
   
   Request history when:
   - High urgency/risk (check what happened recently)
   - User references "last time" or "before"
   - Iterative problem solving pattern
   
   Note: This is for TIMELINE view only. Full historical search happens via semantic_search.

3. **user_data**: What user preferences/settings are relevant? (array of strings)
   Examples: ["communication_style", "learning_preferences", "wellness_goals", "coping_strategies"]

4. **context_priority**: What order should context be retrieved? (array of strings)
   Options: ["semantic_search", "conversation_history", "user_data"]
   Most important first.

5. **novelty**: Is this a new topic (0.8-1.0) or building on past conversations (0.0-0.3)? (0-1 scale)

Examples:

User: "I'm stuck on the same authentication bug AGAIN"
Pattern: recurring_topics: ["authentication"], topic_frequency: { "authentication": 5 }
Emotion: sentiment: -0.6, urgency: 0.7
→ semantic_search: [{
    query: "authentication debugging strategies",
    tier: "personal_journal",
    limit: 10,
    time_range: "all",
    scoring: { semantic_weight: 0.35, recency_weight: 0.3, frequency_weight: 0.25, vehemence_weight: 0.1 }
  }]
→ conversation_history: { lookback: "7 days", limit: 10 }
→ novelty: 0.2 (recurring frustration)

User: "How does quantum computing work?"
Pattern: no recurring topics
Needs: learning_intent: 0.9
→ semantic_search: [{
    query: "quantum computing fundamentals",
    tier: "reference_library",
    limit: 15,
    time_range: "all",
    scoring: { semantic_weight: 0.5, recency_weight: 0.2, frequency_weight: 0.15, vehemence_weight: 0.15 }
  }]
→ conversation_history: null
→ novelty: 0.9 (new learning topic)

User: "I feel really overwhelmed today"
Emotion: mood: anxious, risk: 0.7, urgency: 0.8, sentiment: -0.7
Pattern: recurring_topics: ["stress management"], topic_frequency: { "stress": 8 }
→ semantic_search: [{
    query: "stress coping strategies that worked before",
    tier: "personal_journal",
    limit: 12,
    time_range: "all",
    scoring: { semantic_weight: 0.3, recency_weight: 0.35, frequency_weight: 0.2, vehemence_weight: 0.15 }
  }]
→ conversation_history: { lookback: "24 hours", limit: 8 }
→ user_data: ["wellness_goals", "coping_strategies"]
→ novelty: 0.3 (recurring emotional theme)

Respond with ONLY valid JSON:
{
  "context_requests": {
    "semantic_search": [{
      "query": "...",
      "tier": "...",
      "limit": 10,
      "time_range": "all",
      "scoring": {
        "semantic_weight": 0.4,
        "recency_weight": 0.25,
        "frequency_weight": 0.2,
        "vehemence_weight": 0.15
      }
    }],
    "conversation_history": { "lookback": "...", "limit": 5 } or null,
    "user_data": ["..."] or []
  },
  "context_priority": ["...", "..."],
  "novelty": 0.0-1.0
}`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 600
      });

      const analysis = JSON.parse(response.choices[0].message.content);
      
      // Validate the analysis
      const validatedSignals = this.validateLLMAnalysis(analysis, quickContext);
      
      return this.createResult(
        validatedSignals,
        0.85,
        'LLM-based context analysis from Knight signals'
      );
      
    } catch (error) {
      console.error('ContextKnight LLM analysis failed:', error.message);
      // Fallback to pattern-based analysis
      return this.createResult(quickContext, 0.65, 'Pattern-based fallback (LLM failed)');
    }
  }

  /**
   * Validate and sanitize LLM analysis
   * @param {Object} analysis - LLM output
   * @param {Object} quickContext - Pattern-based baseline
   * @returns {Object} Validated signals
   */
  validateLLMAnalysis(analysis, quickContext) {
    const validTiers = ['core_knowledge', 'personal_journal', 'reference_library', 'archive'];
    const validLookbacks = ['24 hours', '7 days', '30 days'];
    const validPriorities = ['semantic_search', 'conversation_history', 'user_data'];
    
    // Default 3D scoring weights (balanced)
    const defaultScoring = {
      semantic_weight: 0.4,
      recency_weight: 0.25,
      frequency_weight: 0.2,
      vehemence_weight: 0.15
    };
    
    // Validate semantic_search
    const semantic_search = Array.isArray(analysis.context_requests?.semantic_search)
      ? analysis.context_requests.semantic_search
          .filter(s => s.query && validTiers.includes(s.tier))
          .map(s => {
            // Ensure time_range is 'all'
            const time_range = s.time_range || 'all';
            
            // Validate or default scoring weights
            let scoring = s.scoring && 
              s.scoring.semantic_weight !== undefined &&
              s.scoring.recency_weight !== undefined &&
              s.scoring.frequency_weight !== undefined &&
              s.scoring.vehemence_weight !== undefined
              ? s.scoring
              : defaultScoring;
            
            // Normalize weights to sum to 1.0
            const sum = scoring.semantic_weight + scoring.recency_weight + 
                       scoring.frequency_weight + scoring.vehemence_weight;
            if (Math.abs(sum - 1.0) > 0.001) {
              scoring = {
                semantic_weight: scoring.semantic_weight / sum,
                recency_weight: scoring.recency_weight / sum,
                frequency_weight: scoring.frequency_weight / sum,
                vehemence_weight: scoring.vehemence_weight / sum
              };
            }
            
            return {
              query: s.query,
              tier: s.tier,
              limit: this.clamp(s.limit || 10, 1, 20),
              time_range,
              scoring
            };
          })
      : quickContext.context_requests.semantic_search;
    
    // Validate conversation_history
    let conversation_history = null;
    if (analysis.context_requests?.conversation_history) {
      const hist = analysis.context_requests.conversation_history;
      if (validLookbacks.includes(hist.lookback)) {
        conversation_history = {
          lookback: hist.lookback,
          limit: this.clamp(hist.limit || 10, 5, 20)
        };
      }
    }
    
    // Validate user_data
    const user_data = Array.isArray(analysis.context_requests?.user_data)
      ? analysis.context_requests.user_data.filter(d => typeof d === 'string')
      : [];
    
    // Validate context_priority
    const context_priority = Array.isArray(analysis.context_priority)
      ? analysis.context_priority.filter(p => validPriorities.includes(p))
      : quickContext.context_priority;
    
    // Validate novelty
    const novelty = this.clamp(analysis.novelty, 0, 1);
    
    return {
      context_requests: {
        semantic_search,
        conversation_history,
        user_data
      },
      context_priority,
      novelty
    };
  }

  /**
   * Clamp value between min and max
   */
  clamp(value, min, max) {
    if (typeof value !== 'number' || isNaN(value)) return min;
    return Math.max(min, Math.min(max, value));
  }
}

export default ContextKnight;
