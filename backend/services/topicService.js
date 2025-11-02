// Copyright (c) 2025 Scott Crawford. All rights reserved.

import { query, queryOne, execute } from './db.js';
import { getSessionHistoryView, getBundleById, dedupeChronologicalMessages } from './sessionBundler.js';
import logger from '../utils/logger.js';
import OpenAI from 'openai';

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

const SUMMARY_CACHE = new Map();
const SNAPSHOT_CACHE = new Map();
const GROUP_TOPIC_META = new Map();
const DEFAULT_LIMIT = 15;
const DEFAULT_WINDOW_DAYS = 30;
const SUMMARY_TTL_MS = Number.parseInt(process.env.TOPIC_SUMMARY_TTL_MS || '60000', 10);
const SNAPSHOT_TTL_MS = Number.parseInt(process.env.TOPIC_SNAPSHOT_TTL_MS || '30000', 10);
const TAU_HOURS = Number.parseInt(process.env.TOPIC_TAU_HOURS || '72', 10);
const SEGMENT_LIVE_WINDOW = Number.parseInt(process.env.TOPIC_SEGMENT_LIVE_WINDOW || '80', 10);
const SEGMENT_MIN_MESSAGES = Number.parseInt(process.env.TOPIC_SEGMENT_MIN_MESSAGES || '3', 10);
const SEGMENT_MIN_SWITCH_GAP_MINUTES = Number.parseInt(process.env.TOPIC_SEGMENT_GAP_MINUTES || '15', 10);
const SEGMENT_JACCARD_THRESHOLD = Number.parseFloat(process.env.TOPIC_SEGMENT_JACCARD_THRESHOLD || '0.28');
let bundleTableEnsured = false;

function getCache(map, key, ttl) {
  const entry = map.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > ttl) {
    map.delete(key);
    return null;
  }
  return entry.value;
}

function setCache(map, key, value) {
  map.set(key, { timestamp: Date.now(), value });
}

function ensureSessionBundleTable() {
  if (bundleTableEnsured) {
    return;
  }
  try {
    execute(`
      CREATE TABLE IF NOT EXISTS assistant_chat_session_bundles (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        start_created_at TEXT,
        end_created_at TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        message_count INTEGER DEFAULT 0,
        summary TEXT,
        payload TEXT,
        metadata TEXT
      )
    `);
    execute(`
      CREATE INDEX IF NOT EXISTS idx_bundle_session
      ON assistant_chat_session_bundles(session_id, end_created_at DESC)
    `);
    bundleTableEnsured = true;
  } catch (error) {
    logger.warn('Failed ensuring assistant_chat_session_bundles table: %s', error.message);
  }
}

function hashColor(id) {
  if (!id) return '#3B82F6';
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
    hash &= hash; // eslint-disable-line no-bitwise
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 70%, 55%)`;
}

function safeDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeLabel(title, fallback) {
  if (title && title.trim()) return title.trim();
  const candidate = (fallback || '').replace(/[`*_>#\-]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!candidate) return 'Conversation';
  return candidate.length > 60 ? `${candidate.slice(0, 57)}...` : candidate;
}

/**
 * Summarize a conversation excerpt into a short topic label using LLM
 * @param {string} content - Message content to summarize
 * @returns {Promise<string>} - Concise topic label (1-4 words)
 */
async function summarizeToLabel(content) {
  try {
    if (!process.env.OPENAI_API_KEY || !content) {
      return null;
    }

    const truncated = content.slice(0, 500); // Only use first 500 chars for speed
    
    const response = await getOpenAI().chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You generate ultra-concise topic labels (1-4 words max) for conversation excerpts. Examples: "Job Dilemma", "Marathon Training", "React Refactor", "Knee Pain", "Career Change"'
        },
        {
          role: 'user',
          content: `Summarize this conversation start in 1-4 words:\n\n${truncated}`
        }
      ],
      temperature: 0.3,
      max_tokens: 20
    });

    const label = response.choices[0]?.message?.content?.trim();
    return label && label.length > 0 ? label : null;
  } catch (error) {
    logger.warn('Failed to generate LLM topic label: %s', error.message);
    return null;
  }
}

function buildSummaryKey({ limit, windowDays, mode }) {
  return `${mode || 'session'}::${limit || DEFAULT_LIMIT}::${windowDays || DEFAULT_WINDOW_DAYS}`;
}

export function invalidateTopicCaches(sessionId = null) {
  SUMMARY_CACHE.clear();
  if (sessionId) {
    SNAPSHOT_CACHE.delete(sessionId);
  } else {
    SNAPSHOT_CACHE.clear();
  }
  GROUP_TOPIC_META.clear();
}

function buildTopicSlug(label) {
  if (!label) return 'topic';
  const slug = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'topic';
}

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'this', 'that', 'your', 'into', 'about', 'from',
  'what', 'when', 'where', 'which', 'why', 'how', 'does', 'can', 'will', 'should',
  'would', 'could', 'have', 'has', 'had', 'you', 'are', 'was', 'were', 'been',
  'just', 'like', 'into', 'more', 'some', 'want', 'need', 'help', 'over', 'really'
]);

function tokenize(text) {
  if (!text) return [];
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word && !STOP_WORDS.has(word) && word.length > 2);
}

function jaccardSimilarity(aTokens, bTokens) {
  if (!aTokens.length || !bTokens.length) return 0;
  const aSet = new Set(aTokens);
  const bSet = new Set(bTokens);
  let intersection = 0;
  for (const token of aSet) {
    if (bSet.has(token)) {
      intersection += 1;
    }
  }
  const union = new Set([...aSet, ...bSet]).size;
  return union === 0 ? 0 : intersection / union;
}

function shouldCreateNewSegment(segment, nextTokens, message, options = {}) {
  if (!segment) return true;
  const {
    minGapMinutes = SEGMENT_MIN_SWITCH_GAP_MINUTES,
    jaccardThreshold = SEGMENT_JACCARD_THRESHOLD
  } = options;

  const prevUserTimestamp = segment.lastUserAt ? new Date(segment.lastUserAt).getTime() : null;
  const currentTimestamp = message.created_at ? new Date(message.created_at).getTime() : null;
  if (prevUserTimestamp && currentTimestamp) {
    const diffMinutes = Math.abs(currentTimestamp - prevUserTimestamp) / (1000 * 60);
    if (diffMinutes >= minGapMinutes) {
      return true;
    }
  }

  if (!segment.primaryTokens || segment.primaryTokens.length === 0) {
    return false;
  }

  const similarity = jaccardSimilarity(segment.primaryTokens, nextTokens);
  return similarity < jaccardThreshold && segment.userTurns >= 1;
}

async function buildSegmentLabel(messages) {
  const firstUser = messages.find((msg) => msg.role === 'user');
  
  // Try LLM summarization first if available
  if (firstUser?.content && process.env.OPENAI_API_KEY) {
    const llmLabel = await summarizeToLabel(firstUser.content);
    if (llmLabel) {
      return llmLabel;
    }
  }
  
  // Fallback to first message truncation
  if (firstUser?.content) {
    return normalizeLabel(firstUser.content, 'Conversation');
  }
  const firstAssistant = messages.find((msg) => msg.role === 'assistant');
  if (firstAssistant?.content) {
    return normalizeLabel(firstAssistant.content, 'Conversation');
  }
  const fallback = messages[0]?.content || 'Conversation';
  return normalizeLabel(fallback, 'Conversation');
}

/**
 * AI-first conversation segmentation using LLM to identify topic boundaries
 */
async function segmentLiveMessagesAI(messages, sessionTitle = null) {
  if (!Array.isArray(messages) || messages.length === 0) {
    return [];
  }

  // For very short conversations, just return one segment
  if (messages.length < 4) {
    return [{
      index: 1,
      messages: messages,
      start: messages[0]?.created_at || null,
      end: messages[messages.length - 1]?.created_at || null,
      label: sessionTitle || (await buildSegmentLabel(messages)),
      userTurns: messages.filter(m => m.role === 'user').length,
      messageCount: messages.length,
      isPrimary: true
    }];
  }

  try {
    if (!process.env.OPENAI_API_KEY) {
      // Fallback to rule-based if no API key
      return await segmentLiveMessagesLegacy(messages, {});
    }

    // Build conversation transcript for LLM
    const transcript = messages.map((m, i) => 
      `[${i + 1}] ${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content.slice(0, 300)}`
    ).join('\n\n');

    const response = await getOpenAI().chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You analyze conversations to identify topic boundaries and primary focus.

Return JSON with this structure:
{
  "primaryTopic": "Punchy 2-3 word label for the main topic",
  "cloudLabel": "Ultra-concise 2-3 word label for cloud view (e.g., '8km Run', 'Career Change', 'Knee Pain')",
  "segments": [
    {
      "startMessageIndex": 1,
      "endMessageIndex": 8,
      "label": "Brief segment label (2-4 words)",
      "cloudLabel": "2-3 word cloud label",
      "isPrimary": true
    },
    {
      "startMessageIndex": 9,
      "endMessageIndex": 10,
      "label": "Closing logistics",
      "cloudLabel": "Logistics",
      "isPrimary": false
    }
  ]
}

Guidelines:
- cloudLabel must be VERY concise (2-3 words max) for limited space
- If the entire conversation is one coherent topic, return ONE segment with isPrimary=true
- Only split into multiple segments if there's a clear topic shift
- Mark segments as isPrimary=true only if they represent the main conversation focus
- Brief logistics/closing actions should be isPrimary=false
- Use the session title as context if provided
${sessionTitle ? `\n- Session title: "${sessionTitle}"` : ''}`
        },
        {
          role: 'user',
          content: `Analyze this conversation:\n\n${transcript}`
        }
      ],
      temperature: 0.3,
      max_tokens: 500,
      response_format: { type: "json_object" }
    });

    const result = JSON.parse(response.choices[0]?.message?.content || '{}');
    
    if (!result.segments || !Array.isArray(result.segments) || result.segments.length === 0) {
      // LLM failed, fallback to single segment
      const fallbackLabel = result.cloudLabel || result.primaryTopic || sessionTitle || (await buildSegmentLabel(messages));
      return [{
        index: 1,
        messages: messages,
        start: messages[0]?.created_at || null,
        end: messages[messages.length - 1]?.created_at || null,
        label: fallbackLabel,
        cloudLabel: result.cloudLabel || fallbackLabel,
        userTurns: messages.filter(m => m.role === 'user').length,
        messageCount: messages.length,
        isPrimary: true
      }];
    }

    // Convert LLM segments to our format
    const segments = result.segments.map((seg, idx) => {
      const startIdx = Math.max(0, (seg.startMessageIndex || 1) - 1);
      const endIdx = Math.min(messages.length - 1, (seg.endMessageIndex || messages.length) - 1);
      const segMessages = messages.slice(startIdx, endIdx + 1);
      
      return {
        index: idx + 1,
        messages: segMessages,
        start: segMessages[0]?.created_at || null,
        end: segMessages[segMessages.length - 1]?.created_at || null,
        label: seg.label || result.primaryTopic || 'Conversation',
        cloudLabel: seg.cloudLabel || seg.label || result.cloudLabel || result.primaryTopic || 'Conversation',
        userTurns: segMessages.filter(m => m.role === 'user').length,
        messageCount: segMessages.length,
        isPrimary: seg.isPrimary || false
      };
    });

    return segments.filter(s => s.messageCount > 0);

  } catch (error) {
    logger.warn('AI segmentation failed, using legacy: %s', error.message);
    return await segmentLiveMessagesLegacy(messages, {});
  }
}

/**
 * Legacy rule-based segmentation (fallback)
 */
async function segmentLiveMessagesLegacy(messages, options = {}) {
  if (!Array.isArray(messages) || messages.length === 0) {
    return [];
  }

  const segments = [];
  let current = null;
  let segmentIndex = 0;

  for (const message of messages) {
    if (!current) {
      segmentIndex += 1;
      current = {
        index: segmentIndex,
        messages: [],
        primaryTokens: [],
        aggregatedTokens: new Set(),
        userTurns: 0,
        lastUserAt: null,
        start: message.created_at || null,
        end: message.created_at || null
      };
      segments.push(current);
    }

    if (message.role === 'user') {
      const tokens = tokenize(message.content);
      if (
        shouldCreateNewSegment(
          current,
          tokens,
          message,
          options
        )
      ) {
        segmentIndex += 1;
        current = {
          index: segmentIndex,
          messages: [],
          primaryTokens: tokens.slice(0, 24),
          aggregatedTokens: new Set(tokens),
          userTurns: 0,
          lastUserAt: message.created_at || null,
          start: message.created_at || null,
          end: message.created_at || null
        };
        segments.push(current);
      } else {
        if (!current.primaryTokens || current.primaryTokens.length === 0) {
          current.primaryTokens = tokens.slice(0, 24);
        }
        tokens.forEach((token) => current.aggregatedTokens.add(token));
        current.lastUserAt = message.created_at || current.lastUserAt;
      }
      current.userTurns += 1;
    }

    current.messages.push(message);
    current.end = message.created_at || current.end;
  }

  const prepared = await Promise.all(segments.map(async (segment) => ({
    index: segment.index,
    messages: segment.messages,
    start: segment.start,
    end: segment.end,
    label: await buildSegmentLabel(segment.messages),
    userTurns: segment.userTurns,
    messageCount: segment.messages.length,
    isPrimary: true // Legacy assumes all segments are primary
  })));

  const filtered = prepared.filter((segment) => segment.messageCount >= SEGMENT_MIN_MESSAGES);
  if (filtered.length === 0 && prepared.length > 0) {
    return [prepared[prepared.length - 1]];
  }
  return filtered;
}

// Main entry point - uses AI-first approach
async function segmentLiveMessages(messages, options = {}) {
  const sessionTitle = options.sessionTitle || null;
  return await segmentLiveMessagesAI(messages, sessionTitle);
}

function applyTopicMeta(metaList = []) {
  GROUP_TOPIC_META.clear();
  for (const meta of metaList) {
    if (!meta?.topicId) continue;
    GROUP_TOPIC_META.set(meta.topicId, meta);
  }
}

export async function getTopicSummary(options = {}) {
  ensureSessionBundleTable();
  const {
    limit = DEFAULT_LIMIT,
    windowDays = DEFAULT_WINDOW_DAYS,
    mode = 'session'
  } = options;

  if (mode !== 'session') {
    throw new Error(`Unsupported topic mode: ${mode}`);
  }

  const cacheKey = buildSummaryKey({ limit, windowDays, mode });
  const cached = getCache(SUMMARY_CACHE, cacheKey, SUMMARY_TTL_MS);
  if (cached) {
    if (cached.meta) applyTopicMeta(cached.meta);
    return cached.items ?? cached;
  }

  const windowOffset = `-${windowDays} days`;

  const sessions = query(`
    SELECT id, title, created_at, updated_at
    FROM assistant_chat_sessions
    ORDER BY updated_at DESC
  `);

  const messageStats = query(`
    SELECT
      session_id,
      COUNT(*) AS total_messages,
      SUM(CASE WHEN role = 'assistant' THEN 1 ELSE 0 END) AS assistant_messages,
      SUM(CASE WHEN created_at >= datetime('now', ?) THEN 1 ELSE 0 END) AS recent_messages,
      MAX(created_at) AS last_message_at
    FROM assistant_chat_messages
    GROUP BY session_id
  `, [windowOffset]);

  const bundleStats = query(`
    SELECT
      session_id,
      SUM(message_count) AS total_bundle_messages,
      SUM(CASE WHEN COALESCE(end_created_at, created_at) >= datetime('now', ?) THEN message_count ELSE 0 END) AS recent_bundle_messages,
      MAX(COALESCE(end_created_at, created_at)) AS last_bundle_at
    FROM assistant_chat_session_bundles
    GROUP BY session_id
  `, [windowOffset]);

  const messageMap = new Map(messageStats.map((row) => [row.session_id, row]));
  const bundleMap = new Map(bundleStats.map((row) => [row.session_id, row]));

  const bundleDetailsRows = query(`
    SELECT
      id,
      session_id,
      summary,
      message_count,
      start_created_at,
      end_created_at,
      created_at
    FROM assistant_chat_session_bundles
    WHERE COALESCE(end_created_at, created_at) >= datetime('now', ?)
    ORDER BY COALESCE(end_created_at, created_at) DESC
  `, [windowOffset]);

  const bundleDetailsMap = new Map();
  for (const row of bundleDetailsRows) {
    const list = bundleDetailsMap.get(row.session_id) || [];
    list.push(row);
    bundleDetailsMap.set(row.session_id, list);
  }

  const entries = [];
  const now = Date.now();
  const windowStartMs = now - (windowDays * 24 * 60 * 60 * 1000);

  for (const session of sessions) {
    const msg = messageMap.get(session.id) || {};
    const bundle = bundleMap.get(session.id) || {};
    const sessionBundles = (bundleDetailsMap.get(session.id) || [])
      .slice()
      .sort((a, b) => {
        const aDate = safeDate(a.end_created_at) || safeDate(a.created_at) || safeDate(a.start_created_at) || new Date(0);
        const bDate = safeDate(b.end_created_at) || safeDate(b.created_at) || safeDate(b.start_created_at) || new Date(0);
        return aDate.getTime() - bDate.getTime();
      });

    const totalMessages = Number(msg.total_messages || 0) + Number(bundle.total_bundle_messages || 0);
    if (!totalMessages) {
      continue;
    }

    const liveMessageCount = Math.max(0, Number(msg.total_messages || 0) - Number(bundle.total_bundle_messages || 0));
    let historyView = null;
    try {
      historyView = getSessionHistoryView(session.id, { liveWindow: SEGMENT_LIVE_WINDOW });
    } catch (error) {
      logger.warn('Failed to build history view for session %s: %s', session.id, error.message);
    }

    // Bundle segments (archived)
    let bundleIndex = 0;
    for (const bundleRow of sessionBundles) {
      bundleIndex += 1;
      const segmentEnd = safeDate(bundleRow.end_created_at) || safeDate(bundleRow.created_at) || null;
      const lastActiveDate = segmentEnd;
      const lastActive = lastActiveDate ? lastActiveDate.toISOString() : null;
      const ageHours = lastActiveDate ? (now - lastActiveDate.getTime()) / (1000 * 60 * 60) : Number.POSITIVE_INFINITY;
      const recencyScore = Number.isFinite(ageHours) ? Math.exp(-ageHours / TAU_HOURS) : 0;
      const label = normalizeLabel(bundleRow.summary, 'Archived conversation');
      const recentMessages = lastActiveDate && lastActiveDate.getTime() >= windowStartMs ? Number(bundleRow.message_count || 0) : 0;
      const assistantMessages = Math.max(1, Math.round(Number(bundleRow.message_count || 0) / 2));

      entries.push({
        sessionId: session.id,
        title: label,
        totalMessages: Number(bundleRow.message_count || 0),
        recentMessages,
        assistantMessages,
        lastActive,
        lastActiveDate,
        recencyScore,
        segmentRef: {
          type: 'bundle',
          sessionId: session.id,
          bundleId: bundleRow.id,
          start: bundleRow.start_created_at,
          end: bundleRow.end_created_at || bundleRow.created_at || null,
          label,
          segmentIndex: bundleIndex,
          anchorId: bundleRow.id
        }
      });
    }

    // Live segments (current window)
    const liveMessages = historyView?.liveMessages || [];
    let liveSegments = [];
    if (liveMessages.length > 0) {
      liveSegments = await segmentLiveMessages(liveMessages, { sessionTitle: session.title });
    }

    if (liveSegments.length === 0 && liveMessages.length > 0) {
      const fallbackLabel = normalizeLabel(session.title, 'Conversation');
      const firstSegment = {
        index: 1,
        messages: liveMessages,
        start: liveMessages[0]?.created_at || null,
        end: liveMessages[liveMessages.length - 1]?.created_at || null,
        label: fallbackLabel,
        userTurns: liveMessages.filter((m) => m.role === 'user').length,
        messageCount: liveMessages.length
      };
      liveSegments = [firstSegment];
    }

    let segmentIndex = 0;
    for (const segment of liveSegments) {
      segmentIndex = segment.index ?? (segmentIndex + 1);
      const messages = segment.messages || [];
      if (!messages.length) {
        continue;
      }

      const assistantMessages = messages.filter((m) => m.role === 'assistant').length;
      const recentMessages = messages.filter((m) => {
        if (!m.created_at) return false;
        const ts = new Date(m.created_at).getTime();
        return Number.isFinite(ts) && ts >= windowStartMs;
      }).length;
      const lastActiveDate = safeDate(segment.end) || safeDate(messages[messages.length - 1].created_at) || safeDate(session.updated_at);
      const lastActive = lastActiveDate ? lastActiveDate.toISOString() : null;
      const ageHours = lastActiveDate ? (now - lastActiveDate.getTime()) / (1000 * 60 * 60) : Number.POSITIVE_INFINITY;
      const recencyScore = Number.isFinite(ageHours) ? Math.exp(-ageHours / TAU_HOURS) : 0;
      const messageIds = messages.map((m) => m.id).filter(Boolean);
      const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant' && m.id);
      const lastAny = messages[messages.length - 1];

      entries.push({
        sessionId: session.id,
        title: segment.label,
        totalMessages: messages.length,
        recentMessages,
        assistantMessages,
        lastActive,
        lastActiveDate,
        recencyScore,
        segmentRef: {
          type: 'live',
          sessionId: session.id,
          messageIds,
          start: segment.start,
          end: segment.end,
          label: segment.label,
          cloudLabel: segment.cloudLabel || segment.label,
          segmentIndex,
          anchorId: lastAssistant?.id || lastAny?.id || null,
          isPrimary: segment.isPrimary || false
        }
      });
    }

    if (sessionBundles.length === 0 && liveSegments.length === 0 && liveMessageCount === 0) {
      // Fallback to session-level entry if no granular data available
      const lastCandidates = [
        safeDate(msg.last_message_at),
        safeDate(bundle.last_bundle_at),
        safeDate(session.updated_at)
      ].filter(Boolean);

      const lastActiveDate = lastCandidates.sort((a, b) => b.getTime() - a.getTime())[0] || null;
      const lastActive = lastActiveDate ? lastActiveDate.toISOString() : null;
      const ageHours = lastActiveDate ? (now - lastActiveDate.getTime()) / (1000 * 60 * 60) : Number.POSITIVE_INFINITY;
      const recencyScore = Number.isFinite(ageHours) ? Math.exp(-ageHours / TAU_HOURS) : 0;

      entries.push({
        sessionId: session.id,
        title: normalizeLabel(session.title, 'Conversation'),
        totalMessages,
        recentMessages: Number(msg.recent_messages || 0),
        assistantMessages: Number(msg.assistant_messages || 0),
        lastActive,
        lastActiveDate,
        recencyScore,
        segmentRef: {
          type: 'session',
          sessionId: session.id,
          start: session.created_at,
          end: session.updated_at,
          label: normalizeLabel(session.title, 'Conversation'),
          segmentIndex: 1,
          anchorId: null
        }
      });
    }
  }

  if (!entries.length) {
    const result = [];
    setCache(SUMMARY_CACHE, cacheKey, { items: result, meta: [] });
    return result;
  }

  const groups = new Map();
  for (const entry of entries) {
    const slug = buildTopicSlug(entry.title);
    // Group ALL segments from the same session together into one cloud topic
    // Use session title as the grouping key for live segments
    const groupKey = entry.segmentRef?.type === 'live'
      ? entry.sessionId  // All live segments from same session → one cloud topic
      : slug;  // Bundles: allow cross-session grouping by topic
    
    const group = groups.get(groupKey) || {
      slug,
      label: entry.title,
      entries: [],
      totalMessages: 0,
      recentMessages: 0,
      assistantMessages: 0,
      lastActiveDate: null,
      segmentRefs: [],
      hasPrimarySegment: false
    };

    group.entries.push(entry);
    group.totalMessages += entry.totalMessages;
    group.recentMessages += entry.recentMessages;
    group.assistantMessages += entry.assistantMessages;
    
    // Prefer primary segments for labeling
    const entryIsPrimary = entry.segmentRef?.isPrimary || false;
    const groupHasPrimary = group.hasPrimarySegment || false;
    
    if (!group.lastActiveDate || (entry.lastActiveDate && entry.lastActiveDate > group.lastActiveDate)) {
      group.lastActiveDate = entry.lastActiveDate;
      // Only update label if this entry is primary, or if no primary exists yet
      if (entryIsPrimary || !groupHasPrimary) {
        group.label = entry.title;
        group.hasPrimarySegment = entryIsPrimary;
      }
    }
    
    if (entry.segmentRef) {
      group.segmentRefs.push(entry.segmentRef);
    }
    groups.set(groupKey, group);
  }

  const groupList = Array.from(groups.values());
  const maxRecent = Math.max(...groupList.map((it) => it.recentMessages || 0));
  const maxTotal = Math.max(...groupList.map((it) => it.totalMessages || 0));

  const aggregated = groupList.map((group) => {
    const ageHours = group.lastActiveDate
      ? (now - group.lastActiveDate.getTime()) / (1000 * 60 * 60)
      : Number.POSITIVE_INFINITY;
    const recencyScore = Number.isFinite(ageHours) ? Math.exp(-ageHours / TAU_HOURS) : 0;
    const freqBase = maxRecent > 0
      ? group.recentMessages / maxRecent
      : (maxTotal > 0 ? group.totalMessages / maxTotal : 0);
    const engagementScore = group.totalMessages > 0
      ? group.assistantMessages / group.totalMessages
      : 0;
    const score = (0.5 * freqBase) + (0.4 * recencyScore) + (0.1 * engagementScore);
    const weight = Math.round(16 + (Math.max(0, Math.min(1, score)) * 44));

    const members = group.entries
      .slice()
      .sort((a, b) => (b.lastActiveDate?.getTime() || 0) - (a.lastActiveDate?.getTime() || 0));
    const representative = members[0];
    const sessionIds = Array.from(new Set(members.map((m) => m.sessionId)));
    
    // Find the primary segment's cloud label for concise display
    const primarySegment = group.segmentRefs.find(ref => ref.isPrimary);
    const cloudLabel = primarySegment?.cloudLabel || group.label;
    
    // If only one session, use session title for full label, but cloudLabel for display
    let fullLabel = group.label;
    if (sessionIds.length === 1) {
      const session = sessions.find(s => s.id === sessionIds[0]);
      if (session?.title) {
        fullLabel = normalizeLabel(session.title, 'Conversation');
      }
    }
    
    const topicId = sessionIds.length > 1
      ? `group-${group.slug}`
      : `${representative.sessionId}-${group.slug}`;
    const lastActive = group.lastActiveDate ? group.lastActiveDate.toISOString() : null;
    const segmentRefs = group.segmentRefs.slice();
    const primaryAnchor = segmentRefs.find((ref) => ref?.anchorId)?.anchorId || getLatestAnchorId(representative.sessionId);

    return {
      topic: cloudLabel,  // Short punchy label for cloud display
      topicId,
      sessionId: representative.sessionId,
      representativeSessionId: representative.sessionId,
      relatedSessions: sessionIds,
      segmentRefs,
      weight,
      count: group.totalMessages,
      lastActive,
      recencyScore: Number(recencyScore.toFixed(3)),
      engagementScore: Number(engagementScore.toFixed(3)),
      score,
      colorHint: hashColor(topicId),
      title: fullLabel,  // Full descriptive title for list/detail views
      mode: 'session',
      anchorId: primaryAnchor
    };
  });

  aggregated.sort((a, b) => b.score - a.score);
  const limited = aggregated.slice(0, limit);

  const metaList = limited.map((item) => ({
    topicId: item.topicId,
    label: item.topic,
    sessionIds: item.relatedSessions,
    representativeSessionId: item.representativeSessionId,
    lastActive: item.lastActive,
    segmentRefs: item.segmentRefs,
    anchorId: item.anchorId
  }));

  applyTopicMeta(metaList);
  setCache(SUMMARY_CACHE, cacheKey, { items: limited, meta: metaList });
  return limited;
}

function getLatestAnchorId(sessionId) {
  if (!sessionId) return null;
  try {
    const assistantRow = queryOne(`
      SELECT id
      FROM assistant_chat_messages
      WHERE session_id = ? AND role = 'assistant'
      ORDER BY created_at DESC
      LIMIT 1
    `, [sessionId]);
    if (assistantRow?.id) return assistantRow.id;

    const anyRow = queryOne(`
      SELECT id
      FROM assistant_chat_messages
      WHERE session_id = ?
      ORDER BY created_at DESC
      LIMIT 1
    `, [sessionId]);
    if (anyRow?.id) return anyRow.id;

    const bundle = queryOne(`
      SELECT id
      FROM assistant_chat_session_bundles
      WHERE session_id = ?
      ORDER BY COALESCE(end_created_at, created_at) DESC
      LIMIT 1
    `, [sessionId]);
    return bundle?.id || null;
  } catch (error) {
    logger.warn('Failed to resolve anchor id for session %s: %s', sessionId, error.message);
    return null;
  }
}

function fetchMessagesByIdsOrdered(messageIds) {
  if (!Array.isArray(messageIds) || messageIds.length === 0) {
    return [];
  }
  const rows = [];
  const batchSize = 50;
  for (let i = 0; i < messageIds.length; i += batchSize) {
    const chunk = messageIds.slice(i, i + batchSize);
    const placeholders = chunk.map(() => '?').join(',');
    const chunkRows = query(`
      SELECT id, session_id, role, content, created_at
      FROM assistant_chat_messages
      WHERE id IN (${placeholders})
    `, chunk);
    rows.push(...chunkRows);
  }
  rows.sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));
  return rows;
}

function buildSegmentSnapshotPayload(topicId, meta, limit) {
  const refs = Array.isArray(meta?.segmentRefs) ? meta.segmentRefs : [];
  if (!refs.length) {
    return null;
  }

  const combined = [];
  for (const ref of refs) {
    if (!ref) continue;

    if (ref.type === 'bundle' && ref.bundleId) {
      const bundle = getBundleById(ref.bundleId);
      if (!bundle) {
        continue;
      }
      let payload = [];
      try {
        payload = JSON.parse(bundle.payload || '[]');
      } catch (error) {
        logger.warn('Failed to parse bundle payload %s: %s', bundle.id, error.message);
      }
      payload.forEach((msg, idx) => {
        combined.push({
          id: msg.id || `${bundle.id}::${idx}`,
          session_id: bundle.session_id,
          origin_session_id: bundle.session_id,
          role: msg.role,
          content: msg.content,
          created_at: msg.created_at,
          segment_label: ref.label,
          segment_index: ref.segmentIndex || null,
          source_type: 'bundle',
          bundle_id: bundle.id
        });
      });
    } else if (ref.type === 'live' && Array.isArray(ref.messageIds) && ref.messageIds.length) {
      // Fetch ONLY the specific messages in this topic segment
      const rows = fetchMessagesByIdsOrdered(ref.messageIds);
      rows.forEach((row) => {
        combined.push({
          id: row.id,
          session_id: row.session_id,
          origin_session_id: row.session_id,
          role: row.role,
          content: row.content,
          created_at: row.created_at,
          segment_label: ref.label,
          segment_index: ref.segmentIndex || null,
          source_type: 'live'
        });
      });
    } else if (ref.type === 'session' && ref.sessionId) {
      const view = getSessionHistoryView(ref.sessionId, { liveWindow: limit });
      const annotate = (msg) => ({
        ...msg,
        origin_session_id: msg.session_id || ref.sessionId,
        segment_label: ref.label,
        segment_index: ref.segmentIndex || null,
        source_type: 'session'
      });
      combined.push(...view.messages.map(annotate));
    }
  }

  combined.sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));
  const ordered = dedupeChronologicalMessages(combined);
  const startIndex = Math.max(0, ordered.length - limit);
  const items = ordered.slice(startIndex);

  return {
    topic: {
      id: topicId,
      name: meta.label,
      mode: 'segment',
      sessionId: meta.representativeSessionId,
      lastActive: meta.lastActive
    },
    items,
    bundles: [],
    liveMessages: []
  };
}

export function getTopicSnapshot(topicId, options = {}) {
  if (!topicId) {
    return null;
  }

  ensureSessionBundleTable();

  const {
    limit = 200,
    mode = 'session'
  } = options;

  if (mode !== 'session') {
    throw new Error(`Unsupported topic mode: ${mode}`);
  }

  const cacheKey = `${topicId}::${limit}`;
  const cached = getCache(SNAPSHOT_CACHE, cacheKey, SNAPSHOT_TTL_MS);
  if (cached) return cached;

  const meta = GROUP_TOPIC_META.get(topicId);
  if (meta?.segmentRefs?.length) {
    const payload = buildSegmentSnapshotPayload(topicId, meta, limit);
    if (payload) {
      setCache(SNAPSHOT_CACHE, cacheKey, payload);
      return payload;
    }
  }

  if (meta?.sessionIds?.length > 1) {
    const combined = [];
    const bundles = [];
    const liveMessages = [];

    for (const sessionId of meta.sessionIds) {
      const view = getSessionHistoryView(sessionId, { liveWindow: limit });
      const annotate = (msg) => ({
        ...msg,
        session_id: msg.session_id || sessionId,
        origin_session_id: sessionId
      });
      combined.push(...view.messages.map(annotate));
      bundles.push(...(view.bundles || []).map((bundle) => ({ ...bundle, session_id: sessionId })));
      liveMessages.push(...(view.liveMessages || []).map(annotate));
    }

  combined.sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));
  const ordered = dedupeChronologicalMessages(combined);
  const startIndex = Math.max(0, ordered.length - limit);
  const items = ordered.slice(startIndex);

    const payload = {
      topic: {
        id: topicId,
        name: meta.label,
        mode: 'session-group',
        sessionId: meta.representativeSessionId,
        lastActive: meta.lastActive
      },
      items,
      bundles,
      liveMessages
    };

    setCache(SNAPSHOT_CACHE, cacheKey, payload);
    return payload;
  }

  const targetSessionId = meta?.representativeSessionId || meta?.sessionIds?.[0] || topicId;
  const sessionRow = queryOne(`
    SELECT id, title, updated_at
    FROM assistant_chat_sessions
    WHERE id = ?
  `, [targetSessionId]);
  if (!sessionRow) {
    return null;
  }

  const historyView = getSessionHistoryView(targetSessionId, { liveWindow: limit });
  const payload = {
    topic: {
      id: topicId,
      name: meta?.label || normalizeLabel(sessionRow.title, 'Conversation'),
      mode: 'session',
      sessionId: targetSessionId,
      lastActive: sessionRow.updated_at
    },
    items: historyView.messages,
    bundles: historyView.bundles,
    liveMessages: historyView.liveMessages
  };

  setCache(SNAPSHOT_CACHE, cacheKey, payload);
  return payload;
}

export function searchHistory(options = {}) {
  const {
    queryText,
    limit = 50
  } = options;

  if (!queryText || !queryText.trim()) {
    return [];
  }

  const normalized = queryText.trim().toLowerCase();
  const pattern = `%${normalized}%`;

  const rows = query(`
    SELECT id, session_id, role, content, created_at
    FROM assistant_chat_messages
    WHERE LOWER(content) LIKE ?
    ORDER BY created_at DESC
    LIMIT ?
  `, [pattern, limit]);

  const results = rows.map((row) => ({
    id: row.id,
    sessionId: row.session_id,
    role: row.role,
    createdAt: row.created_at,
    snippet: buildSnippet(row.content, normalized)
  }));

  return results;
}

function buildSnippet(content, needle) {
  if (!content) return '';
  const lower = content.toLowerCase();
  const idx = lower.indexOf(needle);
  if (idx === -1) {
    return content.length > 160 ? `${content.slice(0, 157)}...` : content;
  }

  const start = Math.max(0, idx - 60);
  const end = Math.min(content.length, idx + needle.length + 60);
  const prefix = start > 0 ? '…' : '';
  const suffix = end < content.length ? '…' : '';
  const segment = content.slice(start, end);
  return `${prefix}${segment}${suffix}`;
}

export default {
  getTopicSummary,
  getTopicSnapshot,
  searchHistory,
  invalidateTopicCaches
};
