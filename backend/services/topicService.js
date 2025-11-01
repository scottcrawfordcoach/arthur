import { query, queryOne } from './db.js';
import { getSessionHistoryView } from './sessionBundler.js';
import logger from '../utils/logger.js';

const SUMMARY_CACHE = new Map();
const SNAPSHOT_CACHE = new Map();
const DEFAULT_LIMIT = 15;
const DEFAULT_WINDOW_DAYS = 30;
const SUMMARY_TTL_MS = Number.parseInt(process.env.TOPIC_SUMMARY_TTL_MS || '60000', 10);
const SNAPSHOT_TTL_MS = Number.parseInt(process.env.TOPIC_SNAPSHOT_TTL_MS || '30000', 10);
const TAU_HOURS = Number.parseInt(process.env.TOPIC_TAU_HOURS || '72', 10);

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
}

export function getTopicSummary(options = {}) {
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
  if (cached) return cached;

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

  const entries = [];
  const now = Date.now();

  for (const session of sessions) {
    const msg = messageMap.get(session.id) || {};
    const bundle = bundleMap.get(session.id) || {};

    const totalMessages = Number(msg.total_messages || 0) + Number(bundle.total_bundle_messages || 0);
    if (!totalMessages) {
      continue;
    }

    const recentMessages = Number(msg.recent_messages || 0) + Number(bundle.recent_bundle_messages || 0);
    const assistantMessages = Number(msg.assistant_messages || 0);

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
      recentMessages,
      assistantMessages,
      lastActive,
      recencyScore
    });
  }

  if (!entries.length) {
    const result = [];
    setCache(SUMMARY_CACHE, cacheKey, result);
    return result;
  }

  const maxRecent = Math.max(...entries.map((it) => it.recentMessages || 0));
  const maxTotal = Math.max(...entries.map((it) => it.totalMessages || 0));

  const enriched = entries.map((entry) => {
    const freqBase = maxRecent > 0 ? entry.recentMessages / maxRecent : (maxTotal > 0 ? entry.totalMessages / maxTotal : 0);
    const engagementScore = entry.totalMessages > 0 ? entry.assistantMessages / entry.totalMessages : 0;
    const score = (0.5 * freqBase) + (0.4 * entry.recencyScore) + (0.1 * engagementScore);
    const weight = Math.round(16 + (Math.max(0, Math.min(1, score)) * 44));

    return {
      topic: entry.title,
      topicId: entry.sessionId,
      sessionId: entry.sessionId,
      weight,
      count: entry.totalMessages,
      lastActive: entry.lastActive,
      recencyScore: Number(entry.recencyScore.toFixed(3)),
      engagementScore: Number(engagementScore.toFixed(3)),
      score,
      colorHint: hashColor(entry.sessionId)
    };
  });

  enriched.sort((a, b) => b.score - a.score);
  const limited = enriched.slice(0, limit).map((item) => ({
    ...item,
    title: item.topic,
    mode: 'session',
    anchorId: getLatestAnchorId(item.sessionId)
  }));

  setCache(SUMMARY_CACHE, cacheKey, limited);
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

export function getTopicSnapshot(topicId, options = {}) {
  if (!topicId) {
    return null;
  }

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

  const sessionRow = queryOne(`
    SELECT id, title, updated_at
    FROM assistant_chat_sessions
    WHERE id = ?
  `, [topicId]);
  if (!sessionRow) {
    return null;
  }

  const historyView = getSessionHistoryView(topicId, { liveWindow: limit });
  const payload = {
    topic: {
      id: topicId,
      name: normalizeLabel(sessionRow.title, 'Conversation'),
      mode: 'session',
      sessionId: topicId,
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
