# Roundtable Transcript Spec (Observability)

Updated: 2025-10-23

## Purpose
A structured, per-message trace that captures Knight execution, Librarian retrieval, Herald search (if any), Advisory weights, and synthesis metadata. Enables debugging, performance monitoring, and explainability without leaking full user content.

## Transcript JSON (contract)

```json
{
  "id": "trace_...",                 
  "messageId": "msg_...",            
  "sessionId": "sess_...",
  "startedAt": "2025-10-23T17:12:03Z",
  "completedAt": "2025-10-23T17:12:06Z",
  "totalMs": 2987,

  "council": {
    "emotion": { "ms": 102, "status": "success", "sample": {"urgency": 0.42, "sentiment": 0.1 } },
    "needs":   { "ms": 156, "status": "success", "sample": {"learning_intent": 0.65} },
    "pattern": { "ms": 88,  "status": "success", "sample": {"recurring_topics": ["motivation"]} },
    "context": { "ms": 211, "status": "success", "sample": {"context_requests": {"semantic_search": 2}} },
    "analysis":{ "ms": 134, "status": "success", "sample": {"synthesis_strategy": "teach_then_coach"} }
  },

  "librarian": {
    "invoked": true,
    "ms": 472,
    "tiersChecked": ["reference_library", "personal_journal", "conversation"],
    "results": { "count": 8, "topRelevance": 0.82 },
    "topItemPreview": { "table": "reference_library_chunks", "section_title": "Grit — Effort x Consistency" }
  },

  "herald": {
    "invoked": false,
    "ms": 0,
    "results": { "count": 0 }
  },

  **"advisory"**: { "teacher": 0.44, "coach": 0.33, "problemSolver": 0.23 },
  "synthesis": { "model": "gpt-4o", "temperature": 0.7 },

  "errors": [ ]
}
```

Notes:
- "sample" fields are tiny typed snippets for observability, not full payloads.
- Use null where a component was not executed.
- All times in ISO 8601 UTC.

## Storage

Create a dedicated table to keep messages lean and enable retention policies.

```sql
CREATE TABLE IF NOT EXISTS assistant_roundtable_traces (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  message_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  started_at TEXT,
  completed_at TEXT,
  total_ms INTEGER,
  council_json TEXT,        -- compact JSON for 5 Knights
  librarian_json TEXT,      -- compact JSON
  herald_json TEXT,         -- compact JSON
  advisory_json TEXT,       -- weights
  synthesis_json TEXT,      -- model, temperature
  errors_json TEXT,         -- array of { component, code, message }
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_traces_message ON assistant_roundtable_traces(message_id);
CREATE INDEX IF NOT EXISTS idx_traces_session_created ON assistant_roundtable_traces(session_id, created_at DESC);
```

Retention:
- Keep 180 days by default. Nightly job: `DELETE FROM assistant_roundtable_traces WHERE created_at < datetime('now','-180 days')`.
- Feature-flag retention window per environment.

Privacy:
- Do not store raw user content in the trace. Only typed summaries and counts.

## Backend generation (high level)
- Arthur constructs an in-memory transcript at start.
- Each Knight call records start→end ms, status, and a tiny sample.
- Librarian and Herald record invoked, ms, counts, and minimal previews.
- After assistant message is saved (message_id known), persist the trace row.

## APIs
- GET /api/chat/:messageId/trace → returns the persisted transcript JSON as one object composed from columns.
- GET /api/chat/traces/recent?limit=50 → returns latest N traces (admin/dev only).
- GET /api/chat/metrics → expand to include:
  - perKnight: { emotion: {avgMs, successRate}, ... }
  - librarian: { avgMs, invokeRate, avgResults }
  - herald: { avgMs, invokeRate }
  - latency: { p50, p90, p95 }

## Logging levels
- info: totalMs, herald/librarian invoked flags, results counts.
- debug: per-knight ms and samples.
- error: component, code, message; include correlation ids.

## Acceptance criteria
- Every processed message yields a trace row with totalMs and at least 3 components populated.
- Failures appear in `errors` and lower successRate in metrics.
- No user content is stored in trace rows.
