/**
 * Session bundler keeps a live window of recent messages while archiving older
 * turns into compact bundles that surface in history and the unified timeline.
 */

import { v4 as uuidv4 } from 'uuid';
import { query, queryOne, execute, transaction } from './db.js';
import logger from '../utils/logger.js';

const DEFAULT_LIVE_WINDOW = parseInt(process.env.SESSION_LIVE_WINDOW || '80', 10);
const DEFAULT_MIN_BUNDLE = parseInt(process.env.SESSION_BUNDLE_MIN || '40', 10);

let ensured = false;

function ensureBundleTables() {
  if (ensured) return;
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
      );
    `);
    execute(`
      CREATE INDEX IF NOT EXISTS idx_bundle_session ON assistant_chat_session_bundles(session_id, end_created_at DESC);
    `);
    ensured = true;
  } catch (err) {
    logger.error('Failed ensuring session bundle tables:', err.message);
  }
}

function getLiveWindowSize(override) {
  const value = parseInt(override ?? process.env.SESSION_LIVE_WINDOW ?? DEFAULT_LIVE_WINDOW, 10);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_LIVE_WINDOW;
}

function getMinBundleSize(override) {
  const value = parseInt(override ?? process.env.SESSION_BUNDLE_MIN ?? DEFAULT_MIN_BUNDLE, 10);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_MIN_BUNDLE;
}

function truncate(text, max = 120) {
  if (!text) return '';
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1)}…`;
}

function buildBundleSummary(messages) {
  if (!messages || messages.length === 0) return 'Archived conversation bundle';
  const firstUser = messages.find(m => m.role === 'user');
  const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant');
  const start = messages[0].created_at;
  const end = messages[messages.length - 1].created_at;
  const startLabel = start ? new Date(start).toLocaleString() : 'unknown';
  const endLabel = end ? new Date(end).toLocaleString() : 'unknown';
  const parts = [`Archived ${messages.length} messages`, `${startLabel} → ${endLabel}`];
  if (firstUser) parts.push(`Kickoff: “${truncate(firstUser.content, 80)}”`);
  if (lastAssistant) parts.push(`Last reply: “${truncate(lastAssistant.content, 80)}”`);
  return parts.join(' · ');
}

function buildPlaceholderSummary(bundle) {
  const startLabel = bundle.start_created_at ? new Date(bundle.start_created_at).toLocaleString() : 'unknown';
  const endLabel = bundle.end_created_at ? new Date(bundle.end_created_at).toLocaleString() : 'unknown';
  return `🗂️ Archived ${bundle.message_count} messages (${startLabel} → ${endLabel}). Open Unified Timeline to revisit.`;
}

export async function bundleSessionIfNeeded(sessionId, options = {}) {
  ensureBundleTables();
  const liveWindow = getLiveWindowSize(options.liveWindow);
  const minBundle = getMinBundleSize(options.minBundle);
  if (liveWindow <= 0) return { bundled: false };

  const countRow = queryOne(`
    SELECT COUNT(*) as count FROM assistant_chat_messages WHERE session_id = ?
  `, [sessionId]);
  const totalMessages = countRow?.count || 0;
  if (totalMessages <= liveWindow + minBundle) {
    // Keep buffering until we have enough to make a meaningful bundle
    return { bundled: false };
  }

  const excess = totalMessages - liveWindow;
  const bundleSize = Math.max(excess, minBundle);
  const messagesToArchive = query(`
    SELECT id, role, content, created_at
    FROM assistant_chat_messages
    WHERE session_id = ?
    ORDER BY created_at ASC
    LIMIT ?
  `, [sessionId, bundleSize]);

  if (!messagesToArchive.length) {
    return { bundled: false };
  }

  const bundleId = uuidv4();
  const summary = buildBundleSummary(messagesToArchive);
  const payload = JSON.stringify(messagesToArchive.map(m => ({
    role: m.role,
    content: m.content,
    created_at: m.created_at
  })));
  const startCreatedAt = messagesToArchive[0].created_at;
  const endCreatedAt = messagesToArchive[messagesToArchive.length - 1].created_at;

  try {
    transaction(() => {
      execute(`
        INSERT INTO assistant_chat_session_bundles (
          id, session_id, start_created_at, end_created_at, message_count, summary, payload
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [
        bundleId,
        sessionId,
        startCreatedAt,
        endCreatedAt,
        messagesToArchive.length,
        summary,
        payload
      ]);

      const chunkSize = 200;
      for (let i = 0; i < messagesToArchive.length; i += chunkSize) {
        const chunk = messagesToArchive.slice(i, i + chunkSize).map(m => m.id);
        const placeholders = chunk.map(() => '?').join(',');
        execute(`DELETE FROM assistant_chat_messages WHERE id IN (${placeholders})`, chunk);
      }
    });

    logger.info(`Bundled ${messagesToArchive.length} messages from session ${sessionId} into ${bundleId}`);
    return { bundled: true, bundleId, removed: messagesToArchive.length };
  } catch (err) {
    logger.error('Session bundler failed:', err.message);
    return { bundled: false, error: err };
  }
}

export function getSessionBundles(sessionId) {
  ensureBundleTables();
  return query(`
    SELECT id, session_id, start_created_at, end_created_at, created_at, message_count, summary
    FROM assistant_chat_session_bundles
    WHERE session_id = ?
    ORDER BY end_created_at ASC
  `, [sessionId]);
}

export function getBundledPlaceholderMessages(sessionId, options = {}) {
  const bundles = getSessionBundles(sessionId);
  if (!bundles.length) return [];
  return bundles.map(bundle => ({
    id: `bundle-${bundle.id}`,
    role: 'system',
    content: buildPlaceholderSummary(bundle),
    created_at: bundle.end_created_at || bundle.created_at,
    bundleId: bundle.id,
    session_id: bundle.session_id
  }));
}

export function getBundleById(bundleId) {
  ensureBundleTables();
  return queryOne(`
    SELECT id, session_id, start_created_at, end_created_at, created_at, message_count, summary, payload
    FROM assistant_chat_session_bundles
    WHERE id = ?
  `, [bundleId]);
}

export function deleteBundlesForSession(sessionId) {
  ensureBundleTables();
  execute('DELETE FROM assistant_chat_session_bundles WHERE session_id = ?', [sessionId]);
}

export function getSessionLiveMessages(sessionId, liveWindowOverride = null) {
  ensureBundleTables();
  const liveWindow = getLiveWindowSize(liveWindowOverride);
  return query(`
    SELECT id, session_id, role, content, created_at
    FROM assistant_chat_messages
    WHERE session_id = ?
    ORDER BY created_at DESC
    LIMIT ?
  `, [sessionId, liveWindow]).reverse();
}

export function getSessionHistoryView(sessionId, options = {}) {
  const liveMessages = getSessionLiveMessages(sessionId, options.liveWindow);
  const placeholders = getBundledPlaceholderMessages(sessionId, options);
  return {
    liveMessages,
    bundles: getSessionBundles(sessionId),
    messages: [...placeholders, ...liveMessages]
  };
}