# Arthur Unified Smart Threading & Session Bundling

Audience: Developer partners integrating with the chat history model and timeline.

## What this gives you (in plain terms)

- One continuous, recency-first narrative across all sessions ("unified timeline")
- Fast, lightweight session views even for long chats (older turns are archived into bundles)
- Clear UX: archived segments appear as compact placeholders you can expand on demand
- Stable observability: assistant traces, timestamps, and token usage remain intact

---

## Core data model (SQLite)

- `assistant_chat_sessions`
  - `id` TEXT PK, `title` TEXT, `created_at` TEXT, `updated_at` TEXT
- `assistant_chat_messages`
  - `id` TEXT PK, `session_id` TEXT, `role` TEXT ('user'|'assistant'), `content` TEXT, `created_at` TEXT
- `assistant_chat_session_bundles`
  - `id` TEXT PK, `session_id` TEXT, `start_created_at` TEXT, `end_created_at` TEXT,
  - `created_at` TEXT, `message_count` INTEGER, `summary` TEXT, `payload` TEXT (JSON array of archived messages), `metadata` TEXT
- `assistant_roundtable_traces`
  - `message_id` TEXT PK, `session_id` TEXT, timing fields, plus JSON columns for council/librarian/herald/advisory/synthesis/errors

Recommended indexes: `assistant_chat_messages(created_at DESC)`, `assistant_roundtable_traces(created_at DESC)`.

---

## Configuration

Environment variables control how much stays live vs. archived:

```bash
# .env (examples)
SESSION_LIVE_WINDOW=80     # keep the most recent 80 messages in each session
SESSION_BUNDLE_MIN=40      # minimum number to archive when bundling triggers
```

---

## Write path and bundling trigger

Every message save is followed by a non-blocking bundling check. The save path runs in `Arthur` and `chatService`:

```js
// backend/services/Arthur.js (excerpt)
async saveMessage(sessionId, role, content) {
  const messageId = uuidv4();
  execute(`
    INSERT INTO assistant_chat_messages (id, session_id, role, content, created_at)
    VALUES (?, ?, ?, ?, datetime('now'))
  `, [messageId, sessionId, role, content]);

  execute(`UPDATE assistant_chat_sessions SET updated_at = datetime('now') WHERE id = ?`, [sessionId]);

  // Fire-and-forget bundling (keeps writes fast)
  bundleSessionIfNeeded(sessionId).catch(err => logger.warn('Session bundler error:', err.message));
  return messageId;
}
```

When the session grows beyond the threshold, the bundler archives the oldest slice:

```js
// backend/services/sessionBundler.js (essence)
const liveWindow = parseInt(process.env.SESSION_LIVE_WINDOW || '80', 10);
const minBundle = parseInt(process.env.SESSION_BUNDLE_MIN || '40', 10);

export async function bundleSessionIfNeeded(sessionId) {
  const total = queryOne('SELECT COUNT(*) as count FROM assistant_chat_messages WHERE session_id = ?', [sessionId])?.count || 0;
  if (total <= liveWindow + minBundle) return { bundled: false };

  const bundleSize = Math.max(total - liveWindow, minBundle);
  const rows = query(`
    SELECT id, role, content, created_at
    FROM assistant_chat_messages
    WHERE session_id = ?
    ORDER BY created_at ASC
    LIMIT ?
  `, [sessionId, bundleSize]);

  const summary = buildBundleSummary(rows); // includes message count and time range
  const payload = JSON.stringify(rows.map(({ role, content, created_at }) => ({ role, content, created_at })));

  transaction(() => {
    execute(`INSERT INTO assistant_chat_session_bundles (id, session_id, start_created_at, end_created_at, message_count, summary, payload) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [uuidv4(), sessionId, rows[0].created_at, rows[rows.length - 1].created_at, rows.length, summary, payload]);
    // Delete archived originals in chunks
    /* ... */
  });

  return { bundled: true };
}
```

Bundle summaries are compact and human-readable:

```js
function buildBundleSummary(messages) {
  const firstUser = messages.find(m => m.role === 'user');
  const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant');
  const start = messages[0].created_at, end = messages[messages.length - 1].created_at;
  return [
    `Archived ${messages.length} messages`,
    `${new Date(start).toLocaleString()} → ${new Date(end).toLocaleString()}`,
    firstUser ? `Kickoff: “${truncate(firstUser.content, 80)}”` : null,
    lastAssistant ? `Last reply: “${truncate(lastAssistant.content, 80)}”` : null
  ].filter(Boolean).join(' · ');
}
```

---

## Session history view (unified within a session)

Older segments reappear as a single system placeholder per bundle, followed by the latest live turns:

```js
// backend/services/sessionBundler.js (essence)
export function getSessionHistoryView(sessionId, options = {}) {
  const liveMessages = getSessionLiveMessages(sessionId, options.liveWindow);
  const placeholders = getBundledPlaceholderMessages(sessionId, options);
  return {
    liveMessages,
    bundles: getSessionBundles(sessionId),
    messages: [...placeholders, ...liveMessages]
  };
}
```

Placeholders look like: `🗂️ Archived N messages (start → end). Open Unified Timeline to revisit.`

---

## Unified timeline API (cross-session)

Surfaces both new assistant replies and archived bundles across all sessions, ordered by recency.

```http
GET /api/history/timeline?limit=50
```

Implementation sketch (union query):

```sql
SELECT id, session_id, item_type, content, created_at, message_count FROM (
  SELECT id, session_id, 'message' AS item_type, content, created_at, NULL AS message_count
  FROM assistant_chat_messages
  WHERE role = 'assistant'
  UNION ALL
  SELECT id, session_id, 'bundle' AS item_type, summary AS content,
         COALESCE(end_created_at, created_at) AS created_at, message_count
  FROM assistant_chat_session_bundles
)
ORDER BY created_at DESC
LIMIT ?;
```

Response shape:

```json
{
  "items": [
    {
      "id": "...",
      "sessionId": "...",
      "itemType": "message",
      "title": "Short title from content",
      "summary": "Trimmed content",
      "timestamp": "2025-10-26T...Z"
    },
    {
      "id": "bundle-uuid",
      "sessionId": "...",
      "itemType": "bundle",
      "title": "🗂️ Archived 42 messages",
      "summary": "Archived 42 messages · 2025-09-01 09:00 → 2025-09-02 13:15 · ...",
      "timestamp": "2025-09-02T13:15:00.000Z",
      "messageCount": 42
    }
  ]
}
```

---

## Snapshot API (drill-down)

Expand either a live anchor message or a bundle into its surrounding context.

```http
GET /api/history/snapshot/:messageId
```

- If `messageId` is a live message, returns a small neighborhood from `assistant_chat_messages`.
- If it matches a bundle `id`, returns the archived `payload` (array of `{ role, content, created_at }`).

---

## SSE chat streaming (timestamps for bubbles)

Chat responses stream over SSE so time labels are consistent and immediate:

```http
POST /api/chat   // server replies using SSE events
```

Event sequence:

```json
{ "type": "metadata", "sessionId": "...", "streamId": "...", "userMessageId": "...", "serverTime": "2025-10-26T...Z" }
{ "type": "content",  "content": "partial text..." }
{ "type": "done",     "messageId": "assistant-msg-id", "fullContent": "...", "createdAt": "2025-10-26T...Z" }
```

Frontends should render timestamps from `serverTime` and final `createdAt`, with day separators and gap-based time labels.

---

## Developer checklist

- Persist turns to `assistant_chat_messages` with `created_at` timestamps.
- Keep the UI snappy by relying on the unified view:
  - Session view: `GET /api/chat/:sessionId/history` (via `getSessionHistoryView`).
  - Cross-session view: `GET /api/history/timeline`.
  - Drill-down: `GET /api/history/snapshot/:messageId`.
- Configure `.env`: `SESSION_LIVE_WINDOW`, `SESSION_BUNDLE_MIN` to match your volume and UX needs.
- Send chats via `POST /api/chat` (SSE) and wire up `metadata`/`content`/`done` events.

---

## Tuning and extension points

- Live/bundle thresholds: adjust `SESSION_LIVE_WINDOW` and `SESSION_BUNDLE_MIN`.
- Bundle UX: customize `buildBundleSummary` and the placeholder text to surface topics or tags.
- Richer retrieval: populate `assistant_chat_session_bundles.metadata` (e.g., tags, embeddings) for clustering/search.
- Pagination: add cursor-based pagination to timeline for very large histories.

---

## Quick validation (optional)

```bash
# Timeline (last 25 assistant items)
curl -s "http://localhost:3001/api/history/timeline?limit=25" | jq .items[0]

# Snapshot a bundle or live message
curl -s "http://localhost:3001/api/history/snapshot/<ID>" | jq

# Session history (unified view)
curl -s "http://localhost:3001/api/chat/<SESSION_ID>/history" | jq .history[0]
```

---

## Appendix: bundle table creation (for reference)

```sql
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
CREATE INDEX IF NOT EXISTS idx_bundle_session
  ON assistant_chat_session_bundles(session_id, end_created_at DESC);
```

Copyright (c) 2025 Scott Crawford. All rights reserved.
