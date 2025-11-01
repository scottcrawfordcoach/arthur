// Copyright (c) 2025 Scott Crawford. All rights reserved.

/**
 * ARTHUR - The Orchestrator
 * 
 * The final synthesis layer that coordinates all components of the ARTHUR system:
 * - Evidence Council (5 Knights)
 * - Librarian (Data Handler)
 * - Herald (External Researcher)
 * - Advisory Council (Teacher, Coach, Problem Solver)
 * - Policy System
 * 
 * Arthur receives signals from the Evidence Council, invokes Herald if needed,
 * computes Advisory Council weights, applies policies, and synthesizes the
 * final response using GPT-5.
 */

import OpenAI from 'openai';
import EvidenceCouncil from './EvidenceCouncil.js';
import Librarian from './Librarian.js';
import Herald from './Herald.js';
import { query, execute } from './db.js';
import { bundleSessionIfNeeded, getSessionHistoryView } from './sessionBundler.js';
import { invalidateTopicCaches } from './topicService.js';
import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger.js';
import { policyLoader } from '../utils/policyLoader.js';
import {
  getProjectBuckets,
  setActiveBucketForSession,
  getActiveBucketForSession,
  clearActiveBucketForSession,
  buildBucketContext
} from './projectBuckets.js';

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

export class Arthur {
  constructor() {
    this.evidenceCouncil = new EvidenceCouncil();
    this.librarian = new Librarian();
    this.herald = new Herald();
    
    // Load policies
    this.policy = policyLoader.getInfluencerPolicy();
    
    // Track active streams for abort capability
    this.activeStreams = new Map();
    
    logger.info('🏰 Arthur Orchestrator initialized');
    logger.info(`📋 Policy version: ${this.policy.version || 'unknown'}`);
  }

  /**
   * Process a user message through the complete ARTHUR system
   * 
   * @param {string} userMessage - The user's message
   * @param {Object} options - Processing options
   * @param {string} options.sessionId - Chat session ID
   * @param {string} options.userId - User ID
   * @param {boolean} options.stream - Whether to stream the response
   * @returns {Promise<Object>} Processing result with stream or complete response
   */
  async processMessage(userMessage, options = {}) {
    const {
      sessionId: providedSessionId = null,
      userId = 'default',
      stream = true
    } = options;

    const streamId = uuidv4();
    const abortController = new AbortController();
    const startTime = Date.now();

    try {
      // Get or create session
  const sessionId = await this.getOrCreateSession(providedSessionId);

  // Load stored user preferences to personalize orchestration
  const userPreferences = this.getUserPreferences(userId);

      const projectBuckets = Array.isArray(userPreferences.projectBuckets)
        ? userPreferences.projectBuckets
        : [];

      let activeBucketInfo = getActiveBucketForSession(sessionId);
      const bucketDirective = this.detectProjectBucketDirective(userMessage, projectBuckets);
      let activationInstruction = null;

      if (bucketDirective?.clear) {
        clearActiveBucketForSession(sessionId);
        activeBucketInfo = null;
        activationInstruction = 'User cleared the active project context. Do not rely on prior bucket files unless requested again.';
      } else if (bucketDirective?.bucket) {
        setActiveBucketForSession(sessionId, bucketDirective.bucket.id);
        activeBucketInfo = {
          id: bucketDirective.bucket.id,
          slot: bucketDirective.bucket.slot,
          name: bucketDirective.bucket.name,
          description: bucketDirective.bucket.description
        };
        activationInstruction = `User activated project bucket "${bucketDirective.bucket.name}". Acknowledge the context shift and incorporate its files immediately.`;
      }

      const activeBucketContext = activeBucketInfo
        ? buildBucketContext(activeBucketInfo.id)
        : null;

  // Save user message
  const userMessageId = await this.saveMessage(sessionId, 'user', userMessage);
      
      // Auto-generate title for first message in new session
      if (!providedSessionId) {
        this.generateSessionTitle(userMessage, sessionId).catch(err => 
          logger.error('Title generation failed:', err)
        );
      }

      logger.info(`🏰 Arthur processing message in session ${sessionId}`);

      // ============================================================
      // PHASE 1: CONVENE THE EVIDENCE COUNCIL
      // ============================================================
      
      // Get recent conversation history for context
      const recentMessages = query(`
        SELECT role, content, created_at
        FROM assistant_chat_messages 
        WHERE session_id = ? 
        ORDER BY created_at DESC 
        LIMIT 10
      `, [sessionId]).reverse();

      const conversationContext = {
        userId,
        sessionId,
        recentMessages,
        messageCount: recentMessages.length,
        preferences: userPreferences,
        activeProjectBucket: activeBucketContext
      };

      logger.info('⚔️  Convening Evidence Council...');
      const councilResult = await this.evidenceCouncil.convene(
        userMessage, 
        conversationContext
      );

      if (!councilResult.success) {
        logger.error('Evidence Council failed:', councilResult.error);
        throw new Error('Evidence Council failed to convene');
      }

      const signals = councilResult.signals;
      const projectContextConfig = this.normalizeProjectContextPolicy(this.policy.project_context || {});
      const topicShift = this.detectTopicShift(userMessage, signals, {
        bucketDirective,
        recentMessages,
        config: projectContextConfig
      });
      signals.analysis = signals.analysis || {};
      signals.analysis.topic_shift = topicShift;
      logger.info('⚔️  Evidence Council complete:', {
        confidence: councilResult.confidence,
        executionTime: councilResult.executionTime
      });

      // Initialize transcript object (in-memory, not persisted in this iteration)
      const transcript = {
        startedAt: new Date(startTime).toISOString(),
        council: councilResult.councilDiagnostics || null,
        librarian: { invoked: false, ms: 0, tiersChecked: [], results: { count: 0 } },
        herald: { invoked: false, ms: 0, results: { count: 0 } },
        advisory: null,
        synthesis: null,
        topicShift,
        context: { projectFirst: false, projectSnippets: 0, historySnippets: 0 }
      };

      // ============================================================
      // PHASE 2: INVOKE HERALD IF RECOMMENDED
      // ============================================================
      
  let heraldResults = null;
  const heraldStart = Date.now();
      
      if (signals.analysis?.herald_recommendation?.invoke) {
        const heraldReq = signals.analysis.herald_recommendation;
        logger.info(`🔍 Herald invoked: ${heraldReq.reason}`);
        
        try {
          const heraldResponse = await this.herald.search({
            query: heraldReq.search_query,
            intent: signals.needs?.stated_intent || 'general',
            maxResults: 5,
            searchDepth: heraldReq.priority === 'high' ? 'advanced' : 'basic'
          });

          if (heraldResponse.success) {
            heraldResults = heraldResponse;
            logger.info(`🔍 Herald found ${heraldResponse.results.length} results`);
          } else {
            logger.warn('🔍 Herald search failed:', heraldResponse.blocked ? 'Policy blocked' : heraldResponse.error);
          }
        } catch (error) {
          logger.error('🔍 Herald error:', error);
          // Continue without Herald results (graceful degradation)
        }
      } else {
        logger.info('🔍 Herald not invoked:', signals.analysis?.herald_recommendation?.reason || 'Not needed');
      }
      // Herald transcript update
      transcript.herald.invoked = !!heraldResults;
      transcript.herald.ms = Date.now() - heraldStart;
      transcript.herald.results = { count: heraldResults?.results?.length || 0 };

      // ============================================================
      // PHASE 2.5: FULFILL CONTEXT REQUESTS VIA LIBRARIAN
      // ============================================================
      
  let librarianContext = null;
  const librarianStart = Date.now();
      
      if (signals.context?.context_requests) {
        logger.info('📚 Fulfilling context requests via Librarian...');
        
        try {
          librarianContext = await this.librarian.fulfillContextRequests(
            signals.context.context_requests
          );
          
          if (librarianContext && librarianContext.results) {
            logger.info(`📚 Librarian returned ${librarianContext.results.length} results`);
            
            // Log credibility distribution if present
            const credibilityDist = librarianContext.results.reduce((acc, r) => {
              const level = r.metadata?.credibility?.level || 'UNKNOWN';
              acc[level] = (acc[level] || 0) + 1;
              return acc;
            }, {});
            
            if (Object.keys(credibilityDist).length > 0) {
              logger.info('📚 Source credibility distribution:', credibilityDist);
            }
          } else {
            logger.info('📚 Librarian returned no results');
          }
        } catch (error) {
          logger.error('📚 Librarian error:', error);
          // Continue without Librarian results (graceful degradation)
        }
      } else {
        logger.info('📚 Librarian not invoked: No context requests from Context Knight');
      }
      // Librarian transcript update
      transcript.librarian.invoked = !!librarianContext;
      transcript.librarian.ms = Date.now() - librarianStart;
      if (librarianContext && librarianContext.metadata) {
        transcript.librarian.tiersChecked = librarianContext.metadata.sources_checked || [];
        transcript.librarian.results = { count: librarianContext.results?.length || 0, topRelevance: librarianContext.results?.[0]?.relevance_score || 0 };
      }

      const contextPack = await this.assembleContextPack({
        userMessage,
        signals,
        librarianContext,
        activeBucketContext,
        topicShift,
        projectConfig: projectContextConfig
      });
      transcript.context = {
        projectFirst: contextPack.shouldPrioritizeProject,
        projectSnippets: contextPack.projectContext?.snippets?.length || 0,
        historySnippets: contextPack.historyContext?.snippets?.length || 0,
        tokenBudget: contextPack.tokenBudget,
        sources: contextPack.sources
      };
      transcript.contextPack = contextPack;

      // ============================================================
      // PHASE 3: COMPUTE ADVISORY COUNCIL WEIGHTS
      // ============================================================
      
  const advisoryWeights = this.computeAdvisoryWeights(signals);
      logger.info('🎯 Advisory Council weights:', advisoryWeights);
  transcript.advisory = advisoryWeights;

      // ============================================================
      // PHASE 4: BUILD SYNTHESIS PROMPT
      // ============================================================
      
      const systemPrompt = this.buildSynthesisPrompt(
        signals,
        heraldResults,
        librarianContext,
        advisoryWeights,
        userPreferences,
        activeBucketContext,
        activationInstruction,
        contextPack,
        projectContextConfig
      );

      // ============================================================
      // PHASE 5: SYNTHESIZE FINAL RESPONSE WITH GPT-5
      // ============================================================
      
      const messages = [
        { role: 'system', content: systemPrompt },
        ...recentMessages.map(m => ({ 
          role: m.role, 
          content: m.content 
        }))
      ];

  const modelToUse = process.env.MODEL_MAIN || 'gpt-4o';
  transcript.synthesis = { model: modelToUse, temperature: 0.7 };
      
      if (stream) {
        logger.info('🏰 Streaming response from GPT-5...');
        
        const chatStream = await getOpenAI().chat.completions.create({
          model: modelToUse,
          messages,
          temperature: 0.7,
          stream: true
        }, {
          signal: abortController.signal
        });
        
        // Store stream for potential abort
        this.activeStreams.set(streamId, {
          controller: abortController,
          sessionId,
          startTime
        });
        
        const completedAt = new Date().toISOString();
        const processingTime = Date.now() - startTime;
        transcript.completedAt = completedAt;
        transcript.totalMs = processingTime;
        return {
          streamId,
          sessionId,
          stream: chatStream,
          userMessageId,
          signals,
          advisoryWeights,
          heraldInvoked: !!heraldResults,
          contextPack,
          transcript,
          abort: () => this.abortStream(streamId)
        };
        
      } else {
        logger.info('🏰 Generating complete response from GPT-5...');
        
        const completion = await getOpenAI().chat.completions.create({
          model: modelToUse,
          messages,
          temperature: 0.7
        }, {
          signal: abortController.signal
        });
        
        const assistantMessage = completion.choices[0].message.content;
        const assistantMessageId = await this.saveMessage(
          sessionId, 
          'assistant', 
          assistantMessage
        );
        
        const processingTime = Date.now() - startTime;
        transcript.completedAt = new Date().toISOString();
        transcript.totalMs = processingTime;
        logger.info(`🏰 Arthur complete in ${processingTime}ms`);
        
        // Persist token usage for non-streaming (usage available on completion)
        try {
          const usage = completion.usage || completion?.choices?.[0]?.usage || null;
          if (usage) {
            execute(`
              INSERT INTO assistant_token_usage (message_id, model, prompt_tokens, completion_tokens, total_tokens, is_estimate, char_count)
              VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [
              assistantMessageId,
              modelToUse,
              usage.prompt_tokens || null,
              usage.completion_tokens || null,
              usage.total_tokens || null,
              0,
              (assistantMessage || '').length
            ]);
          }
        } catch (tokErr) {
          logger.warn('Failed to persist token usage (non-stream):', tokErr.message);
        }
        
        // Persist transcript for non-streaming to keep parity with streaming path
        try {
          execute(`
            INSERT INTO assistant_roundtable_traces (
              message_id, session_id, started_at, completed_at, total_ms,
              council_json, librarian_json, herald_json, advisory_json, synthesis_json, errors_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            assistantMessageId,
            sessionId,
            transcript.startedAt || null,
            transcript.completedAt || null,
            transcript.totalMs || null,
            JSON.stringify(transcript.council || {}),
            JSON.stringify(transcript.librarian || {}),
            JSON.stringify(transcript.herald || {}),
            JSON.stringify(transcript.advisory || {}),
            JSON.stringify(transcript.synthesis || {}),
            JSON.stringify(transcript.errors || [])
          ]);
        } catch (traceErr) {
          logger.warn('Failed to persist transcript (non-stream):', traceErr.message);
        }
        
        return {
          sessionId,
          userMessageId,
          assistantMessageId,
          content: assistantMessage,
          signals,
          advisoryWeights,
          heraldInvoked: !!heraldResults,
          transcript,
          metadata: {
            processingTime,
            model: modelToUse,
            councilConfidence: councilResult.confidence
          }
        };
      }
      
    } catch (error) {
      logger.error('🏰 Arthur orchestration error:', error);
      throw error;
    }
  }

  /**
   * Load persisted user preferences from the database
   * @param {string} userId - Reserved for future multi-user support
   * @returns {Object} Normalized preference map
   */
  getUserPreferences(userId = 'default') {
    try {
      const rows = query(`
        SELECT key, value
        FROM assistant_preferences
        ORDER BY key
      `);

      const preferences = {};
      for (const row of rows) {
        preferences[row.key] = this.parsePreferenceValue(row.value);
      }

      try {
        const buckets = getProjectBuckets();
        preferences.projectBuckets = buckets.map((bucket) => ({
          id: bucket.id,
          slot: bucket.slot,
          name: bucket.name,
          description: bucket.description,
          fileCount: bucket.active_file_count
        }));
      } catch (bucketErr) {
        logger.warn('Failed to load project bucket preferences:', bucketErr.message);
        preferences.projectBuckets = [];
      }

      return preferences;
    } catch (error) {
      logger.warn('Failed to load user preferences:', error.message);
      return {};
    }
  }

  /**
   * Convert stored TEXT preference values into useful JS types
   * @param {unknown} value - Raw value from SQLite
   * @returns {unknown} Parsed value
   */
  parsePreferenceValue(value) {
    if (value === null || value === undefined) {
      return null;
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      return value;
    }

    const trimmed = String(value).trim();
    if (trimmed === '') {
      return '';
    }

    const lower = trimmed.toLowerCase();
    if (lower === 'true') return true;
    if (lower === 'false') return false;
    if (lower === 'null') return null;

    if (!Number.isNaN(Number(trimmed)) && /^-?\d+(\.\d+)?$/.test(trimmed)) {
      return Number(trimmed);
    }

    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) ||
        (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
      try {
        return JSON.parse(trimmed);
      } catch (err) {
        logger.debug?.('Preference JSON parse failed, using raw string:', err.message);
      }
    }

    return trimmed;
  }

  /**
   * Build the user profile section of the system prompt based on preferences
   * @param {Object} preferences - Normalized preferences
   * @returns {string} Formatted prompt section
   */
  buildUserProfileSection(preferences = {}) {
    if (!preferences || Object.keys(preferences).length === 0) {
      return '';
    }

    const lines = [];

    const preferredName = preferences.userName && String(preferences.userName).trim();
    if (preferredName) {
      lines.push(`- Preferred name: ${preferredName}`);
      lines.push(`  Always address the user as ${preferredName}.`);
    }

    if (preferences.userContext) {
      lines.push(`- Background:`);
      lines.push(`  ${this.formatMultilinePreference(preferences.userContext)}`);
    }

    if (preferences.responseStyle) {
      const styleLabel = String(preferences.responseStyle).charAt(0).toUpperCase() + String(preferences.responseStyle).slice(1);
      const styleGuidance = this.getResponseStyleGuidance(preferences.responseStyle);
      lines.push(`- Response style: ${styleLabel}`);
      if (styleGuidance) {
        lines.push(`  ${styleGuidance}`);
      }
    }

    if (preferences.autoWebSearch) {
      if (preferences.autoWebSearch === 'always') {
        lines.push('- Web search preference: Proactively leverage external research when it could add value.');
      } else if (preferences.autoWebSearch === 'never') {
        lines.push('- Web search preference: Avoid external web searches unless the user explicitly asks.');
      } else {
        lines.push('- Web search preference: Use judgment (automatic mode).');
      }
    }

    if (typeof preferences.enableMemory === 'boolean') {
      lines.push(`- Semantic memory: ${preferences.enableMemory
        ? 'Enabled—feel free to reference relevant past conversations when helpful.'
        : 'Disabled—avoid referencing past conversations unless the user raises them.'}`);
    }

    if (typeof preferences.enableFileRecall === 'boolean') {
      lines.push(`- File recall: ${preferences.enableFileRecall
        ? 'Enabled—mention supporting files when relevant.'
        : 'Disabled—do not reference stored files unless asked.'}`);
    }

    if (preferences.additionalNotes) {
      lines.push('- Additional notes:');
      lines.push(`  ${this.formatMultilinePreference(preferences.additionalNotes)}`);
    }

    if (Array.isArray(preferences.projectBuckets) && preferences.projectBuckets.length > 0) {
      lines.push('- Active project buckets:');
      preferences.projectBuckets.forEach((bucket) => {
        const label = bucket.name || `Project ${bucket.slot || ''}`.trim();
        const note = bucket.description
          ? ` — ${this.truncateText(bucket.description, 140)}`
          : '';
        lines.push(`  • Slot ${bucket.slot}: ${label}${note}`);
      });
    }

    return lines.filter(Boolean).join('\n');
  }

  /**
   * Format multi-line preference text with indentation for readability
   * @param {string} text
   * @returns {string}
   */
  formatMultilinePreference(text) {
    return String(text)
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .join('\n  ');
  }

  /**
   * Map response style preference to actionable guidance
   * @param {string} style
   * @returns {string}
   */
  getResponseStyleGuidance(style) {
    const key = String(style || '').toLowerCase();
    switch (key) {
      case 'concise':
        return 'Keep replies under three short paragraphs and prioritize direct answers.';
      case 'balanced':
        return 'Provide structured answers with clear takeaways and optional next steps.';
      case 'detailed':
        return 'Offer thorough, step-by-step reasoning with references or examples when possible.';
      case 'conversational':
        return 'Use a warm, friendly tone with gentle curiosity and natural dialogue pacing.';
      default:
        return '';
    }
  }

  truncateText(text, maxLength) {
    const clean = String(text || '').trim();
    if (clean.length <= maxLength) {
      return clean;
    }
    return `${clean.slice(0, maxLength - 3)}...`;
  }

  /**
   * Compute Advisory Council weights based on Evidence Council signals
   * 
   * The Advisory Council consists of three influencers:
   * - Teacher: Informational, educational responses
   * - Coach: Supportive, motivational responses
   * - Problem Solver: Analytical, solution-focused responses
   * 
   * @param {Object} signals - Signals from Evidence Council
   * @returns {Object} Weights for each influencer (0-1 scale)
   */
  computeAdvisoryWeights(signals) {
    // Load base weights from policy
    const weights = {
      teacher: this.policy.base_weights.teacher,
      coach: this.policy.base_weights.coach,
      problemSolver: this.policy.base_weights.problemSolver
    };

    // Extract key signals
    const needs = signals.needs || {};
    const emotion = signals.emotion || {};
    const pattern = signals.pattern || {};
    const context = signals.context || {};

    // TEACHER WEIGHT BOOSTERS (from policy)
    const teacherBoosters = this.policy.teacher.boosters;
    teacherBoosters.forEach(booster => {
      if (this.evaluateBoosterCondition(booster, signals)) {
        weights.teacher += booster.boost;
      }
    });

    // COACH WEIGHT BOOSTERS (from policy)
    const coachBoosters = this.policy.coach.boosters;
    coachBoosters.forEach(booster => {
      if (this.evaluateBoosterCondition(booster, signals)) {
        weights.coach += booster.boost;
      }
    });

    // PROBLEM SOLVER WEIGHT BOOSTERS (from policy)
    const problemSolverBoosters = this.policy.problemSolver.boosters;
    problemSolverBoosters.forEach(booster => {
      if (this.evaluateBoosterCondition(booster, signals)) {
        weights.problemSolver += booster.boost;
      }
    });

    // CRISIS OVERRIDE (from policy)
    if (this.policy.crisis_override.enabled) {
      const crisisConditions = this.policy.crisis_override.conditions;
      const crisisLogic = this.policy.crisis_override.logic || 'AND';
      
      const conditionResults = crisisConditions.map(cond => 
        this.evaluateBoosterCondition(cond, signals)
      );

      const crisisTriggered = crisisLogic === 'AND' 
        ? conditionResults.every(r => r)
        : conditionResults.some(r => r);

      if (crisisTriggered) {
        logger.info('🚨 CRISIS MODE: Coach heavily weighted');
        return {
          teacher: this.policy.crisis_override.forced_weights.teacher,
          coach: this.policy.crisis_override.forced_weights.coach,
          problemSolver: this.policy.crisis_override.forced_weights.problemSolver
        };
      }
    }

    // Normalize weights to sum to 1.0
    return this.normalizeWeights(weights);
  }

  detectProjectBucketDirective(userMessage, buckets = []) {
    if (!userMessage || !Array.isArray(buckets) || buckets.length === 0) {
      return null;
    }

    const text = userMessage.toLowerCase();

    if (/(clear|stop|remove).*(project|bucket|context)/.test(text)) {
      return { clear: true };
    }

    const intentMarkers = /(work on|focus on|switch to|continue|project|bucket|let's work on)/;

    for (const bucket of buckets) {
      const name = (bucket.name || '').toLowerCase().trim();
      if (!name) {
        continue;
      }

      const hasName = text.includes(name);
      const slotMarker = bucket.slot ? text.includes(`project ${bucket.slot}`) || text.includes(`bucket ${bucket.slot}`) : false;

      const explicitTriggers = [
        `work on ${name}`,
        `working on ${name}`,
        `focus on ${name}`,
        `switch to ${name}`,
        `${name} project`,
        `${name} bucket`
      ];

      if (explicitTriggers.some((phrase) => text.includes(phrase))) {
        return { bucket };
      }

      if (hasName && intentMarkers.test(text)) {
        return { bucket };
      }

      if (slotMarker && intentMarkers.test(text)) {
        return { bucket };
      }
    }

    return null;
  }

  /**
   * Evaluate a booster condition from policy
   * @param {Object} booster - Booster configuration from policy
   * @param {Object} signals - All signals from Evidence Council
   * @returns {boolean}
   */
  evaluateBoosterCondition(booster, signals) {
    const signal = booster.signal;
    const condition = booster.condition;
    
    // Navigate nested signal path (e.g., "needs.learning_intent")
    const value = this.getNestedValue(signals, signal);
    
    if (value === undefined || value === null) {
      return false;
    }

    // Parse and evaluate condition
    if (condition.startsWith('> ')) {
      const threshold = parseFloat(condition.substring(2));
      return value > threshold;
    }
    
    if (condition.startsWith('< ')) {
      const threshold = parseFloat(condition.substring(2));
      return value < threshold;
    }
    
    if (condition.startsWith('== ')) {
      const target = condition.substring(3).trim().replace(/['"]/g, '');
      return value === target;
    }
    
    if (condition.includes('in [')) {
      const match = condition.match(/in \[(.*?)\]/);
      if (match) {
        const values = match[1].split(',').map(v => v.trim().replace(/['"]/g, ''));
        return values.includes(value);
      }
    }
    
    if (condition === 'length > 0') {
      return Array.isArray(value) && value.length > 0;
    }

    return false;
  }

  /**
   * Get nested value from object (e.g., "needs.learning_intent")
   * @param {Object} obj 
   * @param {string} path 
   * @returns {any}
   */
  getNestedValue(obj, path) {
    const parts = path.split('.');
    let value = obj;
    
    for (const part of parts) {
      if (value && typeof value === 'object' && part in value) {
        value = value[part];
      } else {
        return undefined;
      }
    }
    
    return value;
  }

  /**
   * Normalize weights to sum to 1.0
   */
  normalizeWeights(weights) {
    const total = weights.teacher + weights.coach + weights.problemSolver;
    if (total === 0) {
      return { teacher: 0.33, coach: 0.33, problemSolver: 0.34 };
    }
    return {
      teacher: weights.teacher / total,
      coach: weights.coach / total,
      problemSolver: weights.problemSolver / total
    };
  }

  normalizeProjectContextPolicy(policy = {}) {
    return {
      featureFlag: policy.feature_flag !== false,
      topicShiftThreshold: typeof policy.topic_shift_threshold === 'number' ? policy.topic_shift_threshold : 0.65,
      topicShiftHysteresis: typeof policy.topic_shift_hysteresis === 'number' ? policy.topic_shift_hysteresis : 0.6,
      topicShiftWindow: typeof policy.topic_shift_window === 'number' ? policy.topic_shift_window : 2,
      tokenCaps: {
        project: policy.token_caps?.project ?? 1500,
        history: policy.token_caps?.history ?? 1000
      },
      maxProjectSnippets: policy.max_project_snippets ?? 6,
      maxHistorySnippets: policy.max_history_snippets ?? 6,
      conflictPenalty: typeof policy.conflict_penalty === 'number' ? policy.conflict_penalty : 0.15,
      stalePenalty: typeof policy.stale_penalty === 'number' ? policy.stale_penalty : 0.1,
      minProjectSimilarity: typeof policy.min_project_similarity === 'number' ? policy.min_project_similarity : 0.45,
      minHistoryRelevance: typeof policy.min_history_relevance === 'number' ? policy.min_history_relevance : 0.35,
      minReferenceRelevance: typeof policy.min_reference_relevance === 'number' ? policy.min_reference_relevance : 0.35,
      requireInternalEvidence: policy.require_internal_evidence !== false,
      externalKnowledge: {
        allowed: policy.external_knowledge?.allowed !== false,
        requireDisclosure: policy.external_knowledge?.require_disclosure !== false,
        label: policy.external_knowledge?.label || 'general knowledge',
        noInternalPrefix: policy.external_knowledge?.no_internal_prefix || 'Explain that no repository context was found before sharing broader knowledge.'
      }
    };
  }

  detectTopicShift(userMessage, signals, options = {}) {
    const config = options.config || this.normalizeProjectContextPolicy(this.policy.project_context || {});
    const reasons = [];
    let score = 0;

    const message = (userMessage || '').toLowerCase();
    const novelty = typeof signals.context?.novelty === 'number' ? signals.context.novelty : null;

    if (novelty !== null) {
      score += novelty * 0.5;
      if (novelty > 0.6) {
        reasons.push(`Context Knight flagged high novelty (${novelty.toFixed(2)})`);
      }
    }

    if (options.bucketDirective?.bucket) {
      score += 0.45;
      reasons.push('User activated a project bucket');
    }

    if (options.bucketDirective?.clear) {
      score += 0.35;
      reasons.push('User cleared the active project bucket');
    }

    const lexicalCueRegex = /(switch(ing)? topics|change (?:gears|topic)|let's pivot|new project|different project|another project|fresh topic)/i;
    const lexicalCue = lexicalCueRegex.test(message);
    if (lexicalCue) {
      score += 0.35;
      reasons.push('User explicitly signaled a topic change');
    }

    if (signals.pattern?.recurring_topics && signals.pattern.recurring_topics.length === 0 && novelty !== null && novelty >= 0.5) {
      reasons.push('No recurring topics matched and novelty is elevated');
      score += 0.2;
    }

    const cappedScore = Math.min(1, score);
    const threshold = config.topicShiftThreshold ?? 0.65;
    const shiftDetected = cappedScore >= threshold;

    if (shiftDetected && reasons.length === 0) {
      reasons.push('Topic shift confidence exceeded threshold');
    }

    return {
      confidence: Number(cappedScore.toFixed(2)),
      shiftDetected,
      reasons,
      novelty,
      lexicalCue
    };
  }

  async assembleContextPack({ userMessage, signals, librarianContext, activeBucketContext, topicShift, projectConfig }) {
    const config = projectConfig || this.normalizeProjectContextPolicy(this.policy.project_context || {});
    const hasBucket = !!activeBucketContext?.id;
    const projectEnabled = config.featureFlag && hasBucket;

    let projectContext = {
      snippets: [],
      total_tokens: 0,
      latency_ms: 0,
      bucketId: hasBucket ? activeBucketContext.id : null
    };

    if (projectEnabled) {
      projectContext = await this.librarian.getProjectContext(activeBucketContext.id, userMessage, {
        maxSnippets: config.maxProjectSnippets,
        tokenCap: config.tokenCaps.project,
        minimumSimilarity: config.minProjectSimilarity
      });
    }

    const historyContext = this.selectHistorySnippets(librarianContext?.results || [], {
      maxSnippets: config.maxHistorySnippets,
      tokenCap: config.tokenCaps.history,
      minRelevance: config.minHistoryRelevance
    });

    const referenceMatches = Array.isArray(librarianContext?.results)
      ? librarianContext.results.filter(item => (item.table || 'assistant_chat_messages') === 'reference_library_chunks')
      : [];
    const minReferenceRelevance = config.minReferenceRelevance ?? 0;
    const highConfidenceReferences = referenceMatches.filter(item => {
      const score = item.relevance_score ?? item.scores?.relevance ?? 0;
      return score >= minReferenceRelevance;
    });

    const internalEvidenceAvailable =
      (projectContext?.snippets?.length || 0) > 0 ||
      highConfidenceReferences.length > 0 ||
      (historyContext?.snippets?.length || 0) > 0;

    return {
      projectContext,
      historyContext,
      shouldPrioritizeProject: projectEnabled,
      topicShift,
      tokenBudget: {
        project: config.tokenCaps.project,
        history: config.tokenCaps.history
      },
      sources: {
        projectFiles: projectContext.snippets.map(item => ({ fileId: item.fileId, fileName: item.fileName })),
        historyMessages: historyContext.snippets.map(item => ({ messageId: item.messageId, sessionId: item.sessionId })),
        referenceChunks: highConfidenceReferences.map(item => ({ chunkId: item.id, documentId: item.document_id || null, sectionTitle: item.section_title || null }))
      },
      coverage: {
        projectSnippets: projectContext.snippets.length,
        historySnippets: historyContext.snippets.length,
        referenceMatches: referenceMatches.length,
        highConfidenceReferences: highConfidenceReferences.length,
        internalEvidenceAvailable,
        requireInternalEvidence: config.requireInternalEvidence
      },
      policySnapshot: {
        externalKnowledge: config.externalKnowledge,
        minReferenceRelevance
      }
    };
  }

  selectHistorySnippets(results = [], options = {}) {
    const { maxSnippets = 6, tokenCap = 1000, minRelevance = 0 } = options;
    if (!Array.isArray(results) || results.length === 0) {
      return { snippets: [], total_tokens: 0 };
    }

    const candidates = results
      .filter(r => (r.table || 'assistant_chat_messages') === 'assistant_chat_messages')
      .sort((a, b) => {
        const scoreA = a.relevance_score ?? a.scores?.relevance ?? 0;
        const scoreB = b.relevance_score ?? b.scores?.relevance ?? 0;
        return scoreB - scoreA;
      });

    const selected = [];
    let tokenCount = 0;

    for (const item of candidates) {
      const relevanceScore = Number(item.relevance_score ?? item.scores?.relevance ?? 0);
      if (relevanceScore < minRelevance) {
        continue;
      }

      if (selected.length >= maxSnippets) {
        break;
      }

      const raw = item.summary || item.content || '';
      if (!raw.trim()) {
        continue;
      }

      const snippet = raw.length > 600 ? `${raw.slice(0, 600)}…` : raw;
      const approxTokens = this.estimateTokens(snippet);

      if (tokenCount + approxTokens > tokenCap) {
        break;
      }

      selected.push({
        messageId: item.id,
        sessionId: item.session_id || null,
        snippet,
        relevance: Number.isFinite(relevanceScore) ? relevanceScore : 0,
        createdAt: item.created_at || null,
        table: item.table || 'assistant_chat_messages'
      });

      tokenCount += approxTokens;
    }

    return {
      snippets: selected,
      total_tokens: tokenCount
    };
  }

  estimateTokens(text) {
    if (!text) {
      return 0;
    }
    return Math.max(1, Math.ceil(text.length / 4));
  }

  /**
   * Build the synthesis prompt for GPT-5
   * 
   * This prompt combines:
   * - Evidence Council signals
   * - Librarian context (via Context Knight)
   * - Herald results (if invoked)
   * - Advisory Council weights
   * 
   * @param {Object} signals - Evidence Council signals
   * @param {Object} heraldResults - Herald search results (or null)
   * @param {Object} advisoryWeights - Advisory Council weights
   * @returns {string} System prompt for GPT-5
   */
  buildSynthesisPrompt(signals, heraldResults, librarianContext, advisoryWeights, userPreferences = {}, activeBucketContext = null, activationInstruction = null, contextPack = null, projectConfig = null) {
    const needs = signals.needs || {};
    const emotion = signals.emotion || {};
    const pattern = signals.pattern || {};
    const context = signals.context || {};
    const analysis = signals.analysis || {};

    let prompt = `You are Arthur, an advanced AI assistant with a sophisticated understanding of user needs, emotions, and context.

# YOUR KNOWLEDGE BASE

You have access to a comprehensive internal knowledge base containing:

**Reference Library** (694 chunks across 168 documents):
- 📚 **38 Professional Development Books** including works by:
  - Daniel Kahneman (Thinking, Fast and Slow)
  - Angela Duckworth (Grit)
  - Robert Greene (Mastery, 48 Laws of Power, Laws of Human Nature)
  - Adam Grant (Hidden Potential, Think Again)
  - And many more on leadership, psychology, productivity, and science
- 📄 **ICF Coaching Guidelines** (43 chunks): Professional coaching standards and ethics
- 📝 **Articles & Research** (33 chunks): Evidence-based insights
- ✍️ **Blogs & Newsletters** (57 chunks): Personal insights and practical advice
- 📋 **Client Handouts & Coaching Materials** (26 chunks): Resources for coaching clients
- 🎓 **Educational Materials** (Various): Workbooks, courses, and guides

**Personal Data** (when user provides it):
- Conversation history with sentiment analysis
- Journal entries with mood tracking
- Wellness data (sleep, exercise, nutrition)
- Goals and progress tracking

**IMPORTANT**: When users ask about "your library" or "what books you have", they're asking about the Reference Library listed above. You can directly tell them about these resources without needing to search the web.

`;

    const userProfileSection = this.buildUserProfileSection(userPreferences);
    if (userProfileSection) {
      prompt += `\n# USER PROFILE & PREFERENCES\n${userProfileSection}\n`;
    }

    if (activationInstruction) {
      prompt += `\n# PROJECT CONTEXT UPDATE\n${activationInstruction}\n`;
    }

    if (analysis.topic_shift?.shiftDetected) {
      const reasons = analysis.topic_shift.reasons?.length ? analysis.topic_shift.reasons.map(r => `- ${r}`).join('\n') : '- Shift inferred from conversation signals';
      prompt += `\n# TOPIC SHIFT SIGNALS\nConfidence: ${(analysis.topic_shift.confidence ?? 0).toFixed(2)}\n${reasons}\n`;
    }

    const projectContextSnippets = contextPack?.projectContext?.snippets || [];
    const historyContextSnippets = contextPack?.historyContext?.snippets || [];

    const librarianResults = Array.isArray(librarianContext?.results) ? librarianContext.results : [];
    const rawReferenceResults = librarianResults.filter(item => (item.table || '') === 'reference_library_chunks');
    const minReferenceRelevance = projectConfig?.minReferenceRelevance ?? contextPack?.policySnapshot?.minReferenceRelevance ?? 0;
    const referenceResults = rawReferenceResults.filter(item => {
      const score = item.relevance_score ?? item.scores?.relevance ?? 0;
      return score >= minReferenceRelevance;
    });
    const droppedReferenceCount = rawReferenceResults.length - referenceResults.length;
    const librarianResultsFiltered = librarianResults.filter(item => {
      if ((item.table || '') !== 'reference_library_chunks') {
        return true;
      }
      const score = item.relevance_score ?? item.scores?.relevance ?? 0;
      return score >= minReferenceRelevance;
    });

    const requireInternalEvidence = contextPack?.coverage?.requireInternalEvidence ?? projectConfig?.requireInternalEvidence ?? false;
    const internalEvidenceAvailable = contextPack?.coverage?.internalEvidenceAvailable ?? (
      projectContextSnippets.length > 0 ||
      referenceResults.length > 0 ||
      historyContextSnippets.length > 0
    );
    const externalKnowledgePolicy = projectConfig?.externalKnowledge || contextPack?.policySnapshot?.externalKnowledge || {
      allowed: true,
      requireDisclosure: true,
      label: 'general knowledge',
      noInternalPrefix: 'Explain that no repository context was found before sharing broader knowledge.'
    };

    const knowledgeDirectives = [];
    knowledgeDirectives.push(`Internal project snippets available: ${projectContextSnippets.length}`);
    knowledgeDirectives.push(`Reference library matches above threshold: ${referenceResults.length}`);
    if (historyContextSnippets.length > 0) {
      knowledgeDirectives.push(`Conversation history snippets provided: ${historyContextSnippets.length}`);
    }
    if (droppedReferenceCount > 0 && minReferenceRelevance > 0) {
      knowledgeDirectives.push(`${droppedReferenceCount} low-relevance reference chunks were discarded (threshold ${minReferenceRelevance.toFixed(2)}).`);
    }

    if (requireInternalEvidence) {
      if (internalEvidenceAvailable) {
        knowledgeDirectives.push(`Ground your response in these repository snippets. If you add anything beyond them, clearly label it as ${externalKnowledgePolicy.label} outside the repository.`);
      } else {
        knowledgeDirectives.push(`No repository snippets matched this query. ${externalKnowledgePolicy.noInternalPrefix}`);
        knowledgeDirectives.push(`Only share ${externalKnowledgePolicy.label} if you first acknowledge it comes from outside the repository.`);
      }
    } else if (externalKnowledgePolicy.requireDisclosure) {
      knowledgeDirectives.push(`If you use ${externalKnowledgePolicy.label} beyond the retrieved snippets, explicitly label it as outside the repository.`);
    }

    if (knowledgeDirectives.length > 0) {
      prompt += `
# KNOWLEDGE PRIORITY
${knowledgeDirectives.map(item => `- ${item}`).join('\n')}
`;
    }

    if (activeBucketContext) {
      prompt += `\n# ACTIVE PROJECT CONTEXT\n`;
      const projectName = activeBucketContext.name || `Project ${activeBucketContext.slot}`;
      prompt += `Project: ${projectName}\n`;
      if (activeBucketContext.description) {
        prompt += `${activeBucketContext.description}\n`;
      }

      if (Array.isArray(activeBucketContext.files) && activeBucketContext.files.length > 0) {
        const listedFiles = activeBucketContext.files.slice(0, 6).map((file) => file.originalName || 'Untitled');
        const moreIndicator = activeBucketContext.files.length > listedFiles.length ? '…' : '';
        prompt += `Reference files available (${activeBucketContext.files.length}): ${listedFiles.join(', ')}${moreIndicator}\n`;
      } else {
        prompt += `No reference files attached yet.\n`;
      }
    }

    if (projectContextSnippets.length > 0) {
      prompt += `\n## Project Highlights (highest relevance first)\n`;
      projectContextSnippets.forEach((item, idx) => {
        const similarity = (item.similarity * 100).toFixed(1);
        prompt += `${idx + 1}. ${item.fileName} — similarity ${similarity}%\n`;
        prompt += `   ${item.snippet}\n`;
      });
    } else if (contextPack?.shouldPrioritizeProject && activeBucketContext) {
      prompt += `\n## Project Highlights\nNo high-confidence snippets were retrieved from the active project bucket. Consider reviewing the reference files directly.\n`;
    }

    if (historyContextSnippets.length > 0) {
      prompt += `\n## Historical Context (virtual session memory)\n`;
      historyContextSnippets.forEach((item, idx) => {
        let timestamp = 'timestamp unknown';
        if (item.createdAt) {
          const parsed = new Date(item.createdAt);
          timestamp = Number.isNaN(parsed.getTime()) ? item.createdAt : parsed.toISOString();
        }
        const relevance = ((item.relevance ?? 0) * 100).toFixed(1);
        prompt += `${idx + 1}. Relevance ${relevance}% — ${timestamp}\n`;
        prompt += `   ${item.snippet}\n`;
      });
    }

    prompt += `\n# EVIDENCE COUNCIL ANALYSIS

## Emotional State
- Urgency: ${emotion.urgency?.toFixed(2) || 'N/A'} (${emotion.urgency > 0.7 ? 'HIGH' : emotion.urgency > 0.4 ? 'MODERATE' : 'LOW'})
- Sentiment: ${emotion.sentiment || 'neutral'}
- Risk Level: ${emotion.risk_level || 'low'}
${emotion.concerns && emotion.concerns.length > 0 ? `- Concerns: ${emotion.concerns.join(', ')}` : ''}

## User Needs
- Stated Intent: ${needs.stated_intent || 'general'}
- Learning Intent: ${needs.learning_intent?.toFixed(2) || 'N/A'}
${needs.support_needed && needs.support_needed.length > 0 ? `- Support Needed: ${needs.support_needed.join(', ')}` : ''}
${needs.information_gaps && needs.information_gaps.length > 0 ? `- Information Gaps: ${needs.information_gaps.join(', ')}` : ''}

## Behavioral Patterns
- Engagement Level: ${pattern.engagement_level || 'normal'}
- Behavior Type: ${pattern.behavior_type || 'conversation'}
- Exploratory: ${pattern.exploratory?.toFixed(2) || 'N/A'}
- Goal Alignment: ${pattern.goal_alignment?.toFixed(2) || 'N/A'}
${pattern.recurring_topics && pattern.recurring_topics.length > 0 ? `- Recurring Topics: ${pattern.recurring_topics.join(', ')}` : ''}

## Retrieved Context
${context.internal_context_summary || 'No internal context retrieved'}
${context.context_gaps && context.context_gaps.length > 0 ? `\n### Context Gaps:\n${context.context_gaps.map(g => `- ${g}`).join('\n')}` : ''}
`;

    // Add Herald results if available
    if (heraldResults && heraldResults.results && heraldResults.results.length > 0) {
      prompt += `\n## External Research (Herald)
${heraldResults.summary || 'Web search results available'}

### Sources:
${heraldResults.results.slice(0, 3).map(r => `- ${r.title} (${r.url}) [Trust: ${r.provenance.trustScore.toFixed(2)}]`).join('\n')}
`;
    }

    // Add Librarian results if available
    if (librarianResultsFiltered.length > 0) {
      prompt += `\n## Internal Knowledge Base (Librarian)
Retrieved ${librarianResultsFiltered.length} relevant items from your internal knowledge.

### Retrieved Context:
`;
      
      // Group by table/source type
      const byTable = {};
      librarianResultsFiltered.forEach(r => {
        const table = r.table || 'unknown';
        if (!byTable[table]) byTable[table] = [];
        byTable[table].push(r);
      });

      const skipHistory = historyContextSnippets.length > 0;

      // Add each table's results
      for (const [table, results] of Object.entries(byTable)) {
        if (skipHistory && table === 'assistant_chat_messages') {
          continue;
        }
        const tableLabel = {
          'reference_library_chunks': '📚 Reference Library (Books & Documents)',
          'assistant_chat_messages': '💬 Conversation History',
          'journal_entries': '📔 Personal Journal',
          'wellness_sleep': '😴 Sleep Data',
          'wellness_mood': '😊 Mood Tracking'
        }[table] || table;

        prompt += `\n**${tableLabel}** (${results.length} items)\n`;

        results.slice(0, 3).forEach((r, idx) => {
          const score = r.relevance_score?.toFixed(2) || 'N/A';
          
          // For reference library, include credibility info
          if (table === 'reference_library_chunks' && r.metadata?.credibility) {
            const cred = r.metadata.credibility;
            const credEmoji = {
              'HIGH': '✅',
              'MODERATE': 'ℹ️',
              'LOW': '⚠️',
              'CONTROVERSIAL': '🚨'
            }[cred.level] || '';
            
            const title = r.section_title || r.summary?.substring(0, 50) || 'Untitled';
            const author = r.metadata.author || 'Unknown';
            
            prompt += `  ${idx + 1}. ${credEmoji} "${title}" by ${author}\n`;
            prompt += `     Credibility: ${cred.level} (${cred.sourceType})\n`;
            prompt += `     Relevance: ${score}\n`;
            
            if (cred.useWithCaution) {
              prompt += `     ⚠️ Use with caution: ${cred.useWithCaution}\n`;
            }
            
            // Include a snippet of content
            const content = r.content?.substring(0, 200) || '';
            if (content) {
              prompt += `     Content: ${content}...\n`;
            }
          } else {
            // For other tables, simpler format
            const preview = r.content?.substring(0, 150) || r.message?.substring(0, 150) || '';
            prompt += `  ${idx + 1}. ${preview}... [Score: ${score}]\n`;
          }
        });

        if (results.length > 3) {
          prompt += `  ... and ${results.length - 3} more items\n`;
        }
      }

      prompt += `\n**IMPORTANT**: When using information from the reference library, acknowledge the source credibility:\n`;
      prompt += `- HIGH credibility: Strong scientific evidence, cite confidently\n`;
      prompt += `- MODERATE credibility: Evidence-based with interpretation, mention author perspective\n`;
      prompt += `- LOW credibility: Personal experience/opinion, present as such\n`;
      prompt += `- CONTROVERSIAL: Use cautiously, include appropriate disclaimers\n`;
    }

    // Add synthesis strategy based on Analysis Knight
    if (analysis.synthesis_strategy) {
      prompt += `\n## Synthesis Strategy
${analysis.synthesis_strategy}
`;
    }

    // Add Advisory Council weights
    prompt += `\n# ADVISORY COUNCIL GUIDANCE

Your response should be weighted according to these three influencers:

**Teacher (${(advisoryWeights.teacher * 100).toFixed(0)}%)**: Provide clear, educational information. Break down complex topics. Cite sources when available.

**Coach (${(advisoryWeights.coach * 100).toFixed(0)}%)**: Offer encouragement, empathy, and motivation. Acknowledge emotions. Support personal growth.

**Problem Solver (${(advisoryWeights.problemSolver * 100).toFixed(0)}%)**: Focus on practical solutions. Provide actionable steps. Help the user think through options.

`;

    // Add special instructions based on dominant weight
    const dominant = Object.entries(advisoryWeights).reduce((a, b) => 
      advisoryWeights[a[0]] > advisoryWeights[b[0]] ? a : b
    )[0];

    // Get mode thresholds from policy
    const coachThreshold = this.policy.response_modes.coach_mode_threshold;
    const teacherThreshold = this.policy.response_modes.teacher_mode_threshold;
    const problemSolverThreshold = this.policy.response_modes.problem_solver_mode_threshold;

    if (dominant === 'coach' && advisoryWeights.coach > coachThreshold) {
      prompt += `**PRIMARY MODE: COACH** - This user needs emotional support and encouragement. Prioritize empathy and validation over pure information. Be warm and supportive.\n\n`;
    } else if (dominant === 'teacher' && advisoryWeights.teacher > teacherThreshold) {
      prompt += `**PRIMARY MODE: TEACHER** - This user is seeking to learn. Provide comprehensive, well-structured information. Use examples and explanations.\n\n`;
    } else if (dominant === 'problemSolver' && advisoryWeights.problemSolver > problemSolverThreshold) {
      prompt += `**PRIMARY MODE: PROBLEM SOLVER** - This user needs practical solutions. Focus on actionable advice and clear next steps.\n\n`;
    } else {
      prompt += `**BALANCED MODE** - This situation requires a mix of all three approaches. Adapt your response dynamically.\n\n`;
    }

    // Add crisis override if needed (using policy threshold)
    const crisisThreshold = this.policy.response_modes.crisis_urgency_threshold;
    if (emotion.urgency > crisisThreshold) {
      prompt += `🚨 **CRISIS DETECTED**: User may be in distress. Prioritize immediate support, validation, and safety. Offer resources if appropriate.\n\n`;
    }

    prompt += `# RESPONSE GUIDELINES

1. **Address the user's needs** as identified by the Evidence Council
2. **Use the appropriate tone** based on Advisory Council weights
3. **Reference context** from internal knowledge when relevant
4. **Cite external sources** from Herald when available
5. **Be concise but complete** - match the user's communication style
6. **Show understanding** of their emotional state and patterns

Respond naturally and conversationally. You are Arthur, a trusted companion who truly understands the user.`;

    return prompt;
  }

  /**
   * Get or create a chat session
   */
  async getOrCreateSession(sessionId = null) {
    if (sessionId) {
      const existing = query(
        'SELECT id FROM assistant_chat_sessions WHERE id = ?',
        [sessionId]
      )[0];
      if (existing) return sessionId;
    }
    
    // Create new session
    const newId = uuidv4();
    execute(`
      INSERT INTO assistant_chat_sessions (id, title, created_at, updated_at)
      VALUES (?, ?, datetime('now'), datetime('now'))
    `, [newId, 'New Chat']);
    
    logger.info(`🏰 Created new chat session: ${newId}`);
    return newId;
  }

  /**
   * Save a message to the database
   */
  async saveMessage(sessionId, role, content) {
    const messageId = uuidv4();
    
    execute(`
      INSERT INTO assistant_chat_messages (id, session_id, role, content, created_at)
      VALUES (?, ?, ?, ?, datetime('now'))
    `, [messageId, sessionId, role, content]);
    
    // Update session timestamp
    execute(`
      UPDATE assistant_chat_sessions 
      SET updated_at = datetime('now')
      WHERE id = ?
    `, [sessionId]);
    invalidateTopicCaches(sessionId);
    
    // TODO: Generate and store embeddings asynchronously
    bundleSessionIfNeeded(sessionId).catch(err => logger.warn('Session bundler error:', err.message));
    
    return messageId;
  }

  /**
   * Generate a session title based on the first message
   */
  async generateSessionTitle(firstMessage, sessionId) {
    const fallbackFromText = (text) => {
      if (!text) return 'New Chat';
      let t = String(text).replace(/[`*_>#\-]/g, ' ')
        .replace(/https?:\/\/\S+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      // Take first sentence-ish
      t = t.split(/[\.!?\n]/)[0] || t;
      // Remove leading common phrases
      const leading = [/^(hi|hello|hey|yo)[,\s]+/i,
        /^(can you|could you|please)\s+/i,
        /^(how do i|how to|what is|what's|tell me about|need help with)\s+/i];
      leading.forEach(r => { t = t.replace(r, ''); });
      t = t.trim();
      if (!t) return 'New Chat';
      const words = t.split(/\s+/).slice(0, 8); // cap words
      let title = words.join(' ');
      // Remove trailing punctuation
      title = title.replace(/[\.:,;!?]+$/g, '');
      // Title Case basic
      title = title.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1));
      if (title.length > 50) title = title.slice(0, 47) + '...';
      return title || 'New Chat';
    };

    // If no API key, use fallback immediately
    if (!process.env.OPENAI_API_KEY) {
      const title = fallbackFromText(firstMessage);
      execute(`UPDATE assistant_chat_sessions SET title = ? WHERE id = ?`, [title, sessionId]);
      logger.info(`🏰 Session title (fallback): "${title}"`);
      return;
    }

    try {
      const modelName = process.env.TITLE_MODEL || 'gpt-4o-mini';
      const response = await getOpenAI().chat.completions.create({
        model: modelName,
        messages: [
          {
            role: 'system',
            content: 'Generate a short, descriptive title (max 50 chars) for a chat that starts with this message. Return only the title, no quotes or punctuation at the end.'
          },
          {
            role: 'user',
            content: firstMessage.substring(0, 200)
          }
        ],
        temperature: 0.4,
        max_tokens: 20
      });
      let title = (response?.choices?.[0]?.message?.content || '').trim();
      title = title.replace(/^["']|["']$/g, '');
      if (!title) title = fallbackFromText(firstMessage);
      if (title.length > 50) title = title.substring(0, 47) + '...';
      execute(`UPDATE assistant_chat_sessions SET title = ? WHERE id = ?`, [title, sessionId]);
      logger.info(`🏰 Session title: "${title}"`);
    } catch (error) {
      logger.warn('Title generation error, using fallback:', error.message);
      const title = fallbackFromText(firstMessage);
      execute(`UPDATE assistant_chat_sessions SET title = ? WHERE id = ?`, [title, sessionId]);
      logger.info(`🏰 Session title (fallback): "${title}"`);
    }
  }

  /**
   * Abort a streaming response
   */
  abortStream(streamId) {
    const streamData = this.activeStreams.get(streamId);
    if (streamData) {
      streamData.controller.abort();
      this.activeStreams.delete(streamId);
      logger.info(`🏰 Aborted stream: ${streamId}`);
      return true;
    }
    return false;
  }

  /**
   * Get session history
   */
  async getSessionHistory(sessionId, limit = 50) {
    const view = getSessionHistoryView(sessionId, { liveWindow: limit });
    return view.messages;
  }

  /**
   * Get metrics about Arthur's performance
   */
  getMetrics() {
    return {
      activeStreams: this.activeStreams.size,
      councilMetrics: this.evidenceCouncil.getMetrics(),
      librarianMetrics: this.librarian.getMetrics(),
      heraldMetrics: this.herald.getMetrics()
    };
  }
}

// Export singleton instance
export const arthur = new Arthur();

// Export class for testing
export default Arthur;
