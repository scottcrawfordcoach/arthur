// Copyright (c) 2025 Scott Crawford. All rights reserved.

import OpenAI from 'openai';
import { recallContext, formatContextForLLM } from './recallEngine.js';
import { webSearch, formatSearchResults } from './webSearch.js';
import { generateEmbedding, storeEmbedding } from './embeddings.js';
import { extractSignals, calculateResponseWeights } from './signalExtractor.js';
import { 
  detectPolicyFeedback, 
  getUserPolicyPreferences, 
  applyPolicyAdjustment,
  applyUserPreferences,
  generateAcknowledgment 
} from './policyLearning.js';
import { 
  detectActivityLog, 
  generateCoachingResponse, 
  getCoachingModePrompt, 
  getRecentActivities 
} from './coachingPatterns.js';
import { analyzeIntent, quickIntentCheck } from './intentAnalyzer.js';
import { query, queryOne, execute } from './db.js';
import {
  bundleSessionIfNeeded,
  getSessionHistoryView,
  deleteBundlesForSession
} from './sessionBundler.js';
import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger.js';
import { invalidateTopicCaches } from './topicService.js';

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

// Track active streaming requests for abort capability
const activeStreams = new Map();

/**
 * Determine if web search is needed
 * @param {string} userMessage - User's message
 * @param {string} sessionId - Chat session ID
 * @returns {Promise<boolean>} - Whether to perform web search
 */
async function shouldUseWebSearch(userMessage, sessionId) {
  // Quick heuristics
  const searchIndicators = [
    'search', 'find', 'look up', 'what is', 'who is', 'when did',
    'latest', 'current', 'recent', 'news', 'weather', 'price'
  ];
  
  const lowerMessage = userMessage.toLowerCase();
  const hasIndicator = searchIndicators.some(indicator => 
    lowerMessage.includes(indicator)
  );
  
  // Could also use GPT-4o-mini to determine this more intelligently
  return hasIndicator;
}

/**
 * Generate a title for a chat session based on the first message
 * @param {string} firstMessage - The first user message
 * @returns {Promise<string>} - Generated title
 */
export async function generateSessionTitle(firstMessage, modelOverride = null) {
  try {
    const modelName = modelOverride || process.env.TITLE_MODEL || 'gpt-4o-mini';
    const response = await getOpenAI().chat.completions.create({
      model: modelName,
      messages: [
        {
          role: 'system',
          content: 'Generate a short, descriptive title (max 50 chars) for a chat that starts with this message. Return only the title, no quotes or punctuation at the end.'
        },
        {
          role: 'user',
          content: firstMessage.substring(0, 200) // Only use first 200 chars
        }
      ],
      temperature: 0.4,
      max_tokens: 20
    });
    
    let title = response.choices[0].message.content.trim();
    // Remove quotes if AI added them
    title = title.replace(/^["']|["']$/g, '');
    // Truncate if too long
    if (title.length > 50) {
      title = title.substring(0, 47) + '...';
    }
    return title || 'New Chat';
  } catch (error) {
    logger.error('Title generation error:', error);
    return 'New Chat';
  }
}

/**
 * Backfill smart titles for sessions with generic/empty titles
 * @param {{limit?: number}} options
 * @returns {{updated: number, totalCandidates: number}}
 */
export async function backfillSessionTitles(options = {}) {
  const raw = options.limit ?? '50';
  let candidates = [];
  if (String(raw).toLowerCase() === 'all') {
    candidates = query(`
      SELECT id FROM assistant_chat_sessions
      WHERE title IS NULL OR title = '' OR title = 'New Chat'
      ORDER BY created_at ASC
    `).map(r => r.id);
  } else {
    const limit = Math.max(1, Math.min(parseInt(raw, 10) || 50, 500));
    candidates = query(`
      SELECT id FROM assistant_chat_sessions
      WHERE title IS NULL OR title = '' OR title = 'New Chat'
      ORDER BY created_at ASC
      LIMIT ?
    `, [limit]).map(r => r.id);
  }
  
  let updated = 0;
  const strategy = (options.strategy || 'auto').toLowerCase();
  const modelName = options.model || process.env.TITLE_MODEL || 'gpt-4o-mini';
  const wantLLM = strategy === 'llm' || (strategy === 'auto' && !!process.env.OPENAI_API_KEY);
  for (const sessionId of candidates) {
    try {
      const firstMsg = queryOne(`
        SELECT content FROM assistant_chat_messages
        WHERE session_id = ? AND role = 'user'
        ORDER BY created_at ASC
        LIMIT 1
      `, [sessionId]);
      if (!firstMsg || !firstMsg.content) continue;
      // Prefer LLM if key available, else simple heuristic
      let title = null;
      if (wantLLM) {
        try {
          // Synchronous style: await per iteration since this runs server-side
          // eslint-disable-next-line no-await-in-loop
          title = await generateSessionTitle(firstMsg.content, modelName);
        } catch (e) {
          logger.warn('Backfill LLM error, falling back:', e.message);
        }
      }
      if (!title) {
        // Fallback heuristic
        const fallbackFromText = (text) => {
          let t = String(text || '').replace(/[`*_>#\-]/g, ' ')
            .replace(/https?:\/\/\S+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
          t = t.split(/[\.!?\n]/)[0] || t;
          const leading = [/^(hi|hello|hey|yo)[,\s]+/i, /^(can you|could you|please)\s+/i, /^(how do i|how to|what is|what's|tell me about|need help with)\s+/i];
          leading.forEach(r => { t = t.replace(r, ''); });
          t = t.trim();
          if (!t) return 'New Chat';
          const words = t.split(/\s+/).slice(0, 8);
          let titleH = words.join(' ').replace(/[\.:,;!?]+$/g, '');
          titleH = titleH.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1));
          if (titleH.length > 50) titleH = titleH.slice(0, 47) + '...';
          return titleH || 'New Chat';
        };
        title = fallbackFromText(firstMsg.content);
      }
      updateSessionTitle(sessionId, title);
      updated += 1;
    } catch (e) {
      logger.warn('Backfill title failed for session', sessionId, e.message);
    }
  }
  return { updated, totalCandidates: candidates.length, strategyUsed: strategy, modelUsed: wantLLM ? modelName : 'heuristic' };
}

/**
 * Create or get chat session
 * @param {string} sessionId - Optional existing session ID
 * @returns {Promise<string>} - Session ID
 */
export async function getOrCreateSession(sessionId = null) {
  if (sessionId) {
    const existing = queryOne(
      'SELECT id FROM assistant_chat_sessions WHERE id = ?',
      [sessionId]
    );
    if (existing) return sessionId;
  }
  
  // Create new session
  const newId = uuidv4();
  execute(`
    INSERT INTO assistant_chat_sessions (id, title, created_at, updated_at)
    VALUES (?, ?, datetime('now'), datetime('now'))
  `, [newId, 'New Chat']);
  
  logger.info(`Created new chat session: ${newId}`);
  return newId;
}

/**
 * Save message to database
 * @param {string} sessionId - Chat session ID
 * @param {string} role - Message role (user/assistant)
 * @param {string} content - Message content
 * @returns {Promise<string>} - Message ID
 */
export async function saveMessage(sessionId, role, content) {
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
  
  // Generate and store embedding asynchronously
  generateEmbedding(content)
    .then(embedding => storeEmbedding('assistant_chat_messages', messageId, embedding, { role }))
    .catch(err => logger.error('Error storing message embedding:', err));
  // Kick off bundling in the background to keep session lightweight
  bundleSessionIfNeeded(sessionId).catch(err => logger.warn('Session bundler error:', err.message));
  
  return messageId;
}

/**
 * Process chat message with streaming support
 * @param {string} userMessage - User's message
 * @param {object} options - Chat options
 * @returns {Promise<object>} - Stream controller and metadata
 */
export async function processChat(userMessage, options = {}) {
  const {
    sessionId: providedSessionId = null,
    userId = null,
    stream = true,
    useWebSearch = null // null = auto-detect, true/false = force
  } = options;

  const streamId = uuidv4();
  const abortController = new AbortController();
  
  try {
    // Get or create session
    const sessionId = await getOrCreateSession(providedSessionId);
    
    // Save user message
    const userMessageId = await saveMessage(sessionId, 'user', userMessage);
    
    // Auto-generate title for first message in new session
    if (!providedSessionId) {
      // This is a new session, generate a title in the background
      generateSessionTitle(userMessage).then(title => {
        updateSessionTitle(sessionId, title).catch(err => 
          logger.error('Failed to update session title:', err)
        );
      }).catch(err => logger.error('Title generation failed:', err));
    }
    
    // Step 1: INTENT ANALYSIS - Determine tier routing AND web search strategy
    const quickIntent = quickIntentCheck(userMessage);
    let intentAnalysis = null;
    
    // Get recent conversation context for intent analysis
    const recentMessages = query(`
      SELECT role, content 
      FROM assistant_chat_messages 
      WHERE session_id = ? 
      ORDER BY created_at DESC 
      LIMIT 5
    `, [sessionId]);
    
    // Check for recent wellness activity
    const hasRecentWellness = query(`
      SELECT COUNT(*) as count 
      FROM activities 
      WHERE user_id = ? AND created_at >= datetime('now', '-7 days')
    `, [userId || 'default'])[0]?.count > 0;
    
    // Use LLM analysis for non-obvious cases or coaching intent
    if (quickIntent.confidence === 'low' || quickIntent.intent === 'coaching') {
      try {
        intentAnalysis = await analyzeIntent(userMessage, {
          recentMessages,
          hasWellnessActivity: hasRecentWellness
        });
        logger.info(`🧠 Intent: ${intentAnalysis.primary_intent} | Tiers: ${intentAnalysis.tier_priorities.join(' > ')} | Web: ${intentAnalysis.web_search_priority}`);
      } catch (error) {
        logger.warn('Intent analysis failed, using quick check', error);
        intentAnalysis = mapQuickIntentToAnalysis(quickIntent);
      }
    } else {
      // Use quick intent check result
      intentAnalysis = mapQuickIntentToAnalysis(quickIntent);
      logger.info(`⚡ Quick intent: ${quickIntent.intent} | Web: ${intentAnalysis.web_search_priority}`);
    }
    
    // Step 2: Gather context with tier-based routing
    const recallOptions = {
      userId,
      maxResults: 10
    };
    
    // Apply tier priorities from intent analysis
    if (intentAnalysis.tier_priorities && intentAnalysis.tier_priorities.length > 0) {
      recallOptions.tierPriorities = intentAnalysis.tier_priorities;
      
      // Apply time weighting for personal journal queries
      if (intentAnalysis.time_weight_journal) {
        recallOptions.timeWeight = true;
        recallOptions.maxAgeHours = 168; // 7 days
      }
    }
    
    const context = await recallContext(userMessage, recallOptions);
    
    // Step 3: Intelligent web search decision based on intent analysis
    let searchContext = null;
    
    // Determine if web search should happen
    let shouldSearch = false;
    let searchReason = '';
    
    if (useWebSearch !== null) {
      // User explicitly requested/disabled web search
      shouldSearch = useWebSearch;
      searchReason = 'User override';
    } else if (intentAnalysis.web_search_priority === 'primary') {
      // High priority - current/latest info needed
      shouldSearch = true;
      searchReason = 'Primary priority - current info needed';
    } else if (intentAnalysis.web_search_priority === 'fallback') {
      // Fallback - search if internal KB has no results
      if (context.files.length === 0 && context.documents.length === 0) {
        shouldSearch = true;
        searchReason = 'Fallback - no internal results found';
      }
    } else if (intentAnalysis.web_search_priority === 'none') {
      // Special case: coaching/wellness but low confidence results
      // This handles "I'm stuck with marathon training" → coaching intent but needs training info
      const hasLowConfidenceResults = context.files.length > 0 && 
        context.files.every(f => (f.similarity || 0) < 0.75);
      
      // Check if query has factual/informational component
      const hasFactualComponent = /\b(how to|what is|why does|when should|best way|research|science|evidence|study)\b/i.test(userMessage);
      
      if ((hasLowConfidenceResults || context.files.length === 0) && hasFactualComponent) {
        shouldSearch = true;
        searchReason = 'Coaching + factual query with weak KB results';
        logger.info(`🔄 Coaching fallback: detected factual component in coaching query`);
      }
    }
    
    if (shouldSearch) {
      try {
        searchContext = await webSearch(userMessage, { maxResults: 5 });
        logger.info(`🌐 Web search completed: ${searchReason}`);
      } catch (err) {
        logger.warn('Web search failed, continuing without it:', err.message);
      }
    } else {
      logger.info(`⊘ Web search skipped (${intentAnalysis.web_search_priority}: ${searchReason || intentAnalysis.web_search_reasoning || 'Not needed'})`);
    }
    
    // Step 2.5: ROUNDTABLE PROTOCOL - Extract signals and calculate weights
    const history = query(`
      SELECT role, content 
      FROM assistant_chat_messages 
      WHERE session_id = ? 
      ORDER BY created_at DESC 
      LIMIT 20
    `, [sessionId]).reverse();
    
    // Detect policy feedback first
    const policyFeedback = detectPolicyFeedback(userMessage);
    let acknowledgment = null;
    
    if (policyFeedback) {
      await applyPolicyAdjustment(userId, policyFeedback.adjustment);
      acknowledgment = generateAcknowledgment(policyFeedback.type);
      logger.info(`🎛️  User policy adjusted: ${policyFeedback.type}`);
    }
    
    // Detect activity/wellness logging for coaching mode
    const activityDetection = detectActivityLog(userMessage);
    let coachingPrompt = null;
    
    if (activityDetection.detected && activityDetection.confidence === 'high') {
      const recentActivities = await getRecentActivities(userId, 10);
      const coachingResponse = generateCoachingResponse(
        activityDetection, 
        userMessage, 
        recentActivities
      );
      
      // Prepend coaching response to acknowledgment
      acknowledgment = coachingResponse + (acknowledgment ? '\n\n' + acknowledgment : '');
      
      // Add coaching mode to system prompt
      coachingPrompt = getCoachingModePrompt();
      
      logger.info(`🏃 Coaching mode activated for ${activityDetection.activityType}`);
    }
    
    // Get user's learned preferences
    const userPreferences = await getUserPolicyPreferences(userId);
    
    // Extract signals from message
    const signals = await extractSignals(userMessage, context, history);
    let responseWeights = calculateResponseWeights(signals);
    
    // Apply user-specific preference adjustments
    const adjusted = applyUserPreferences(responseWeights, signals, userPreferences);
    responseWeights = adjusted.weights;
    const adjustedSignals = adjusted.signals;
    
    console.log('🎯 PROTOCOL ACTIVE - Signals:', adjustedSignals);
    console.log('🎯 PROTOCOL ACTIVE - Weights:', responseWeights);
    console.log('🎛️  User Preferences Applied:', userPreferences);
    
    logger.info('Roundtable Protocol active:');
    logger.info('  Signals:', JSON.stringify(adjustedSignals, null, 2));
    logger.info('  Weights:', JSON.stringify(responseWeights, null, 2));
    logger.info('  User Prefs:', JSON.stringify(userPreferences, null, 2));
    
    // Step 3: Build system prompt with context and dynamic weights
    const systemPrompt = buildSystemPrompt(context, searchContext, responseWeights, adjustedSignals, acknowledgment, coachingPrompt);
    
    // Step 4: Build messages array
    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.map(h => ({ role: h.role, content: h.content }))
    ];
    
    // Step 5: Stream response from ChatGPT-5
    const modelToUse = process.env.MODEL_MAIN || 'chatgpt-5';
    
    if (stream) {
      const chatStream = await getOpenAI().chat.completions.create({
        model: modelToUse,
        messages,
        temperature: 0.7,
        stream: true
      }, {
        signal: abortController.signal
      });
      
      // Store stream for potential abort
      activeStreams.set(streamId, {
        controller: abortController,
        sessionId,
        startTime: Date.now()
      });
      
      return {
        streamId,
        sessionId,
        stream: chatStream,
        userMessageId,
        abort: () => abortStream(streamId)
      };
    } else {
      // Non-streaming response
      const completion = await getOpenAI().chat.completions.create({
        model: modelToUse,
        messages,
        temperature: 0.7
      }, {
        signal: abortController.signal
      });
      
      const assistantMessage = completion.choices[0].message.content;
      const assistantMessageId = await saveMessage(sessionId, 'assistant', assistantMessage);
      
      return {
        sessionId,
        message: assistantMessage,
        messageId: assistantMessageId,
        userMessageId
      };
    }
  } catch (error) {
    if (error.name === 'AbortError') {
      logger.info(`Chat request aborted: ${streamId}`);
      throw new Error('Request aborted by user');
    }
    logger.error('Chat processing error:', error);
    throw error;
  }
}

/**
 * Abort an active streaming chat
 * @param {string} streamId - Stream ID to abort
 */
export function abortStream(streamId) {
  const stream = activeStreams.get(streamId);
  if (stream) {
    logger.info(`Aborting stream: ${streamId}`);
    stream.controller.abort();
    activeStreams.delete(streamId);
    return true;
  }
  return false;
}

/**
 * Build system prompt with context
 */
function buildSystemPrompt(context, searchContext, weights = null, signals = null, acknowledgment = null, coachingPrompt = null) {
  const parts = [
    'You are ScottBot Local, a personal AI assistant running entirely on the user\'s machine.',
    '',
    '## Your Capabilities:',
    '• **Semantic Memory**: You can recall information from past conversations and uploaded documents',
    '• **File Processing**: Users can upload documents (PDF, DOCX, EPUB, etc.) which are converted to markdown and stored in your knowledge base',
    '• **Web Search**: You can search the internet when needed for current information',
    '• **Multi-Session Conversations**: You maintain separate conversation threads with auto-generated titles',
    '• **Local & Private**: All data stays on the user\'s computer - no cloud uploads',
    ''
  ];
  
  // Add wellness/fitness coaching mode if detected
  if (coachingPrompt) {
    parts.push(coachingPrompt);
    parts.push('');
  }
  
  // Add acknowledgment if policy was adjusted
  if (acknowledgment) {
    parts.push('## 🎛️  Preference Update:');
    parts.push(`Start your response with: "${acknowledgment}"`);
    parts.push('');
  }
  
  // Add dynamic response weighting if available (Roundtable Protocol)
  if (weights && signals) {
    parts.push('## Response Style Guidance (Adaptive):');
    parts.push(`Based on context analysis, adjust your response with these weights:`);
    parts.push(`• Teacher (explain & educate): ${(weights.teacher * 100).toFixed(0)}%`);
    parts.push(`• Coach (guide & empower): ${(weights.coach * 100).toFixed(0)}%`);
    parts.push(`• Problem Solver (direct answers): ${(weights.problem_solver * 100).toFixed(0)}%`);
    parts.push('');
    parts.push('Context signals detected:');
    parts.push(`• Urgency: ${signals.urgency.toFixed(2)} (${signals.urgency > 0.7 ? 'high - be concise' : 'low - can elaborate'})`);
    parts.push(`• Learning intent: ${signals.learning_intent.toFixed(2)} (${signals.learning_intent > 0.6 ? 'wants to learn' : 'just needs answer'})`);
    parts.push(`• Emotional tone: ${signals.emotional_tone}`);
    parts.push(`• Complexity: ${signals.complexity.toFixed(2)}`);
    parts.push('');
    
    // Add ICF-compliant coaching guidance when coach weight is significant
    // BUT respect user preferences to suppress exploratory questions
    if (weights.coach > 0.35 && !signals.suppress_exploratory_questions) {
      const questionIntensity = signals.reduce_exploratory_questions || 1.0;
      const questionCount = Math.max(1, Math.round(2 * questionIntensity)); // 0-2 questions based on preference
      
      parts.push('## 🎯 COACHING MODE ACTIVATED (ICF-Aligned):');
      parts.push('');
      parts.push('**Priority: Facilitate Self-Discovery Through Questions**');
      parts.push('');
      parts.push('### Response Strategy:');
      
      if (questionIntensity >= 0.5) {
        parts.push('1. **DO NOT provide solutions, advice, or answers immediately**');
        parts.push(`2. **Ask ${questionCount} powerful, open-ended question${questionCount > 1 ? 's' : ''} first** to:`);
        parts.push('   - Help the user explore their own thinking');
        parts.push('   - Evoke awareness and insight');
        parts.push('   - Clarify values, goals, and obstacles');
        parts.push('3. **Listen actively** - reflect back what you hear');
        parts.push('4. **Create space** for the user to think out loud');
        parts.push('5. **Only after exploration**, help them identify their own solutions');
      } else {
        parts.push('1. **Ask 1 brief clarifying question** if truly needed');
        parts.push('2. **Provide gentle guidance** but don\'t delay solutions');
        parts.push('3. **Balance support with efficiency**');
      }
      
      parts.push('');
      parts.push('### ICF Core Competencies to Apply:');
      parts.push('- **Evokes Awareness**: Use powerful questions, silence, metaphors');
      parts.push('- **Facilitates Client Growth**: Partner to transform insight into action');
      parts.push('- **Active Listening**: Focus on what is said AND unsaid');
      parts.push('- **Maintains Presence**: Be fully present, open, flexible');
      parts.push('');
      
      if (questionIntensity >= 0.5) {
        parts.push('### Powerful Question Examples:');
        parts.push('- "What matters most to you about this?"');
        parts.push('- "What would success look like?"');
        parts.push('- "What\'s holding you back from taking that step?"');
        parts.push('- "If you knew the answer, what would it be?"');
        parts.push('- "What are you not saying?"');
        parts.push('');
      }
      
      parts.push('**Remember: The user explaining their thoughts TO YOU = explaining to THEMSELVES = deeper understanding**');
      parts.push('');
    } else if (weights.coach > 0.35 && signals.suppress_exploratory_questions) {
      // User wants coaching style but NO questions - supportive guidance only
      parts.push('## 🤝 SUPPORTIVE MODE (User Preference: Direct Support):');
      parts.push('');
      parts.push('**Provide empathetic, supportive guidance WITHOUT exploratory questions.**');
      parts.push('- Acknowledge their situation with understanding');
      parts.push('- Offer direct, actionable suggestions');
      parts.push('- Be encouraging but concise');
      parts.push('');
    }
  }
  
  parts.push('## How You Work:');
  parts.push('1. When users upload files, they\'re converted to markdown and chunked for semantic search');
  parts.push('2. When answering questions, you automatically search your knowledge base for relevant context');
  parts.push('3. You can search the web when you detect queries about current events or need up-to-date info');
  parts.push('4. All conversations and files are stored locally in a SQLite database');
  parts.push('');
  parts.push('## Current Context:');
  parts.push('You have semantic recall of past conversations, files, and documents stored in the local knowledge base.');
  parts.push('');
  
  // Add recalled context
  const formattedContext = formatContextForLLM(context);
  if (formattedContext.trim()) {
    parts.push('## Recalled Information:');
    parts.push('The following relevant information was found in your knowledge base:');
    parts.push(formattedContext);
    parts.push('');
  }
  
  // Add web search results
  if (searchContext) {
    parts.push('## Web Search Results:');
    parts.push(formatSearchResults(searchContext));
    parts.push('');
  }
  
  parts.push('## Response Guidelines:');
  parts.push('• Be helpful, concise, and natural in your responses');
  parts.push('• Use recalled context and search results when relevant, but don\'t force them');
  parts.push('• If you used web search, briefly mention it (e.g., "Based on recent information..."');
  parts.push('• If asked what you can do, explain your file upload, search, and memory capabilities');
  parts.push('• Remember: you\'re a LOCAL assistant - emphasize privacy and offline operation when relevant');
  
  return parts.join('\n');
}

/**
 * Get chat session history
 * @param {string} sessionId - Session ID
 * @returns {Promise<Array>} - Messages
 */
export async function getSessionHistory(sessionId) {
  const view = getSessionHistoryView(sessionId);
  return view.messages;
}

/**
 * List all chat sessions
 * @returns {Promise<Array>} - Sessions
 */
export async function listSessions() {
  return query(`
    SELECT 
      s.*,
      (SELECT COUNT(*) FROM assistant_chat_messages WHERE session_id = s.id)
        + COALESCE((SELECT SUM(message_count) FROM assistant_chat_session_bundles WHERE session_id = s.id), 0)
        AS message_count,
      COALESCE((SELECT COUNT(*) FROM assistant_chat_session_bundles WHERE session_id = s.id), 0) AS bundle_count
    FROM assistant_chat_sessions s
    ORDER BY updated_at DESC
  `);
}

/**
 * Update session title
 * @param {string} sessionId - Session ID
 * @param {string} title - New title
 */
export async function updateSessionTitle(sessionId, title) {
  execute(`
    UPDATE assistant_chat_sessions 
    SET title = ?, updated_at = datetime('now')
    WHERE id = ?
  `, [title, sessionId]);
  invalidateTopicCaches(sessionId);
}

/**
 * Delete a chat session
 * @param {string} sessionId - Session ID
 */
export async function deleteSession(sessionId) {
  execute('DELETE FROM assistant_chat_messages WHERE session_id = ?', [sessionId]);
  execute('DELETE FROM assistant_chat_sessions WHERE id = ?', [sessionId]);
  deleteBundlesForSession(sessionId);
  logger.info(`Deleted session: ${sessionId}`);
  invalidateTopicCaches(sessionId);
}

/**
 * Map quick intent check to full analysis format
 * @param {object} quickIntent - Quick intent result
 * @returns {object} - Full analysis format
 */
function mapQuickIntentToAnalysis(quickIntent) {
  const tierMappings = {
    wellness: {
      tier_priorities: ['personal_journal', 'core_knowledge'],
      time_weight_journal: true,
      web_search_priority: 'none',
      web_search_reasoning: 'Personal wellness data only'
    },
    research: {
      tier_priorities: ['reference_library', 'core_knowledge'],
      time_weight_journal: false,
      web_search_priority: 'fallback',
      web_search_reasoning: 'Check internal knowledge first, web if not found'
    },
    personal: {
      tier_priorities: ['archive', 'personal_journal'],
      time_weight_journal: false,
      web_search_priority: 'none',
      web_search_reasoning: 'Looking at conversation history'
    },
    coaching: {
      tier_priorities: ['core_knowledge', 'personal_journal'],
      time_weight_journal: false,
      web_search_priority: 'none',
      web_search_reasoning: 'ICF coaching principles are timeless'
    },
    general: {
      tier_priorities: ['core_knowledge', 'reference_library'],
      time_weight_journal: false,
      web_search_priority: 'fallback',
      web_search_reasoning: 'Check KB first, web if needed'
    }
  };
  
  const mapping = tierMappings[quickIntent.intent] || tierMappings.general;
  
  return {
    primary_intent: quickIntent.intent,
    tier_priorities: mapping.tier_priorities,
    include_recent_context: ['personal', 'coaching'].includes(quickIntent.intent),
    time_weight_journal: mapping.time_weight_journal,
    needs_web_search: mapping.web_search_priority !== 'none',
    web_search_priority: mapping.web_search_priority,
    web_search_reasoning: mapping.web_search_reasoning,
    confidence: quickIntent.confidence,
    reasoning: 'Quick pattern matching'
  };
}

export default {
  processChat,
  abortStream,
  getOrCreateSession,
  saveMessage,
  getSessionHistory,
  listSessions,
  updateSessionTitle,
  deleteSession
};
