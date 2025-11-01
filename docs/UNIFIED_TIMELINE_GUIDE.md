## Unified Timeline Guide

Audience: Technical partners evaluating the Roundtable chat history model and integration points.

### Why a unified timeline?

Traditional “threaded topics” hide context. We render a single, recency-ordered stream of assistant activity across all sessions. This mirrors how humans remember conversations: one evolving story with day breaks and time stamps. Benefits:

- Clear recency: newest across all sessions is always visible
- Temporal cues: day separators and time labels improve recall
- Seamless drill-down: click any item to view its surrounding session context
- Observability: traces and metrics tie each message to its reasoning path

---

## Core concepts

- Session: A long-running conversation labeled by a smart title. Table: `assistant_chat_sessions`.
- Message: A single user/assistant utterance within a session. Table: `assistant_chat_messages`.
- Timeline: A recency-sorted list of assistant messages across all sessions with short summaries and timestamps.
- Snapshot: A small “neighborhood” of messages around an anchor message inside its session.
- Trace: A persisted Roundtable transcript for the assistant’s message (council signals, librarian, herald, synthesis, timing, errors).

---

## Data model (SQLite)

- `assistant_chat_sessions`
  - id TEXT PRIMARY KEY
  - title TEXT
  - created_at TEXT
  - updated_at TEXT
  - summary TEXT (optional)
  - embedding TEXT (optional)

- `assistant_chat_messages`
  - id TEXT PRIMARY KEY
  - session_id TEXT
  - role TEXT CHECK(role IN ('user','assistant'))
  - content TEXT
  - created_at TEXT
  - embedding TEXT (optional)
  - is_test INTEGER (optional; present in some environments)

- `assistant_roundtable_traces`
  - message_id TEXT PRIMARY KEY
  - session_id TEXT
  - started_at, completed_at, total_ms
  - council_json, librarian_json, herald_json, advisory_json, synthesis_json, errors_json
  - created_at TEXT

- `assistant_token_usage` (estimates for streaming)

Indexes you’ll likely want in production: `assistant_chat_messages(created_at DESC)`, `assistant_roundtable_traces(created_at DESC)`.

---

## Backend APIs

Base path: `/api`

### Timeline

- GET `/history/timeline?limit=50`
  - Returns recent assistant messages across sessions (recency-sorted). `limit` caps results (1–200).
  - Response shape:
    - `{ items: [{ id, sessionId, title, summary, timestamp }] }`

### Snapshot

- GET `/history/snapshot/:messageId`
  - Returns a small window around the anchor message from its session.
  - Response shape:
    - `{ anchor: { id, sessionId }, messages: [{ id, role, content, created_at }], retrieved: { top: [] } }`

### Traces (Roundtable)

- GET `/chat/:messageId/trace`
  - Full transcript for an assistant message: council, librarian, herald, advisory, synthesis, errors.
- GET `/chat/traces/recent?limit=50`
  - Lightweight recent trace list with timestamps and durations.

### Sessions and titles

- GET `/sessions`
  - Lists sessions with titles and timestamps.
- PATCH `/sessions/:sessionId` body: `{ title }`
  - Update a title.
- POST `/sessions/backfill-titles?limit=all&strategy=auto|llm|heuristic&model=gpt-4o-mini`
  - Generate titles for older “New Chat” sessions. `limit=all` supported. `strategy=heuristic` avoids LLM calls.

---

## Streaming and timestamps

Chat is streamed via SSE from `POST /chat`.

- metadata event: `{ type: 'metadata', sessionId, streamId, userMessageId, serverTime }`
- content event: `{ type: 'content', content }`
- done event: `{ type: 'done', messageId, fullContent, createdAt }`

Frontend uses `serverTime` and `done.createdAt` to render accurate timestamps, with:

- Day separators when date changes
- Time labels on role changes or when gaps exceed ~5 minutes
- Full datetime on hover

---

## Live window bundling (session persistence)

- Env vars: `SESSION_LIVE_WINDOW` (default 80 messages) keeps the most recent turns in `assistant_chat_messages`. `SESSION_BUNDLE_MIN` (default 40) defines the minimum archived chunk size.
- When a session exceeds `live_window + min_bundle`, the oldest messages are bundled into `assistant_chat_session_bundles` with a summary and JSON payload. Live chat remains contiguous for active conversations; nothing disappears mid-thought.
- Chat history endpoint prepends lightweight system stubs ("🗂️ Archived…") so users know where older segments went. Opening the unified timeline or snapshot reveals the full payload.
- Timeline includes both live assistant replies (`itemType: 'message'`) and bundles (`itemType: 'bundle'`), allowing partners to visualize hot-swappable topics without fragmenting sessions.

---

## Frontend integration model

Components (reference implementation):

- `ChatWindow.jsx`
  - Opens SSE stream for `/api/chat`
  - Renders timestamped bubbles using `serverTime` offset and `done.createdAt`
  - Shows day separators and time labels based on gap and role-change heuristics

- `UnifiedTimeline.jsx`
  - Fetches `/api/history/timeline`
  - Groups by day; shows role icons and a Refresh action
  - Optional: Auto-refresh on each chat completion or 30–60s polling

---

## Routing policy: internal-first guardrails

`AnalysisKnight` suppresses web search (“Herald”) when prompts are clearly internal or library-only (e.g., contain “no web”, or reference the local reference library). This ensures local-first behavior and reduces latency/costs.

---

## Example requests (optional)

```bash
# Timeline (last 25 assistant messages)
curl -s "http://localhost:3001/api/history/timeline?limit=25" | jq .items[0]

# Snapshot around a specific message
curl -s "http://localhost:3001/api/history/snapshot/<MESSAGE_ID>" | jq

# Recent traces
curl -s "http://localhost:3001/api/chat/traces/recent?limit=10" | jq .traces[0]

# Backfill session titles for all, heuristic only
curl -s -X POST "http://localhost:3001/api/sessions/backfill-titles?limit=all&strategy=heuristic" | jq
```

---

## Demo data and validation

- Quick seed: `npm run test:data:seed-fragments`
  - Adds 6 sessions like “TEST — Overwhelmed at work” with scattered timestamps to exercise timeline rendering.
- Synthetic generator: `npm run test:data:generate`
  - Larger, 6-month corpus with personas/topics; includes embeddings.
- Stats/sampling: `npm run test:data:stats` and `npm run test:data:sample`

---

## Performance and scaling notes

- Pagination: use `limit` and plan for cursor-based pagination for very large histories.
- Indexing: ensure `assistant_chat_messages.created_at` is indexed; consider composite (role, created_at).
- Payloads: timeline returns short summaries; fetch full content via snapshot only on demand.
- SSE: one open stream per active chat tab; timeline itself is pull-based to avoid unnecessary connections.

---

## Security and privacy

- Local-first: all data in SQLite under `./data/db/ai_local.db` and local buckets.
- External calls: guardrails prevent Herald (web search) for internal/library prompts.
- Configurable models: title generation defaults to a small, inexpensive model (`TITLE_MODEL`, default `gpt-4o-mini`).

---

## Adopting the pattern in your stack

1) Persist chat messages with created_at timestamps per session.
2) Expose a timeline endpoint that surfaces only assistant messages with brief summaries and timestamps.
3) Provide a session-scoped snapshot endpoint to drill into context on demand.
4) Stream chat with SSE and include server and message timestamps.
5) Add a trace/telemetry surface to tie messages back to reasoning.
6) Title sessions automatically on first message; offer a backfill routine for legacy data.

Success criteria:

- Timeline items render within <200ms server time with indexes
- Snapshot returns within <100ms for typical sessions (<200 rows scanned)
- No Herald calls on internal/library prompts (verify in traces)
- Titles generated for >95% sessions without manual edits

Copyright (c) 2025 Scott Crawford. All rights reserved.
