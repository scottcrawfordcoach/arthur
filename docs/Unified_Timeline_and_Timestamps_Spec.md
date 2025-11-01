# Unified Timeline and Timestamped Bubbles (Chat UX)

Updated: 2025-10-23

## Goal
Replace threaded session lists with a unified, human-style timeline across sessions. Show time-aware, relevance-aware entries for fast topic switching. Add consistent timestamps to chat bubbles.

## Timeline overview
- One panel showing recent assistant interactions across all sessions, newest first.
- Each item: title, 1–2 line summary/snippet, timestamp, optional "why this is relevant" hint.
- Click → open a Context Snapshot (not full session): surrounding messages + top retrieved context.
- Casual queries naturally sink as they age; older entries compress to summaries and eventually drop from default view.

## API: GET /api/history/timeline
Query params:
- limit (default 50)
- since (optional ISO timestamp)
- activeQuery (optional string) – if present, include a simple relevance hint vs. active topic

Response shape:
```json
{
  "items": [
    {
      "id": "msg_...",
      "sessionId": "sess_...",
      "title": "Reflections on motivation plateau",
      "summary": "Discussed mood tracking and habit adherence logic.",
      "timestamp": "2025-10-23T17:12:06Z",
      "relevance": { "semantic": 0.78, "recency": 0.92, "vehemence": 0.31 },
      "contextHint": "High semantic match to current topic"
    }
  ]
}
```

Minimum viable implementation (Phase A):
- Items sourced from `assistant_chat_messages` where role = 'assistant'.
- Order by `created_at` DESC, LIMIT 50.
- `title` = generated short title (reuse existing title generator or first sentence heuristic).
- `summary` = first 140–200 chars of content, sentence-aware trimming.
- No `relevance`/`contextHint` initially.

Phase B (optional enhancements):
- If `activeQuery` present, compute a quick text score (keyword overlap or fast local embedding cosine against item content when available) to fill `relevance.semantic` and a basic `contextHint`.
- Include `vehemence` if Emotion Knight signals are stored for the message.
- Add a weekly header summarizing topical clusters (from Pattern Knight tags) without adding complexity to Phase A.

## API: GET /api/history/snapshot/:messageId
Returns a small neighborhood around a timeline item plus a retrieval preview.

Response shape:
```json
{
  "anchor": { "id": "msg_...", "sessionId": "sess_..." },
  "messages": [
    { "id": "...", "role": "user", "content": "...", "created_at": "..." },
    { "id": "...", "role": "assistant", "content": "...", "created_at": "..." }
  ],
  "retrieved": {
    "top": [
      { "table": "reference_library_chunks", "section_title": "...", "relevance": 0.81, "preview": "..." }
    ]
  }
}
```

Neighborhood selection:
- Same session as anchor.
- 3 messages before + 3 after by `created_at` ordering.
- `retrieved.top` is best-effort: if transcript/librarian context available for anchor or nearby message, show up to 3 compact items.

## Timestamps in chat bubbles
Display rules:
- Show timestamp on the first bubble of a contiguous block per speaker.
- Always show timestamp on hover.
- If a gap > 5 minutes between messages, show the timestamp regardless and/or a day separator when date changes.

Backend event metadata:
- Streaming start (SSE initial metadata): add `serverTime` (ISO) or planned `created_at`.
- Stream completion (done event): include saved `messageId` and `created_at` from DB.
- For user messages, the client can attach local send time, and replace with server-ack time after save if desired.

## SQL reference (Phase A)
```sql
SELECT id, session_id, content, created_at
FROM assistant_chat_messages
WHERE role = 'assistant'
ORDER BY created_at DESC
LIMIT 50;
```

## Acceptance criteria
- Timeline shows last 50 assistant entries across sessions with title, summary, and timestamp.
- Snapshot opens in < 200ms for local DB, shows neighbors and any available retrieved previews.
- Chat bubbles display timestamps per rules above, including gap and day changes.

## Retention & aging behavior
- Default timeline shows 90 days; older content accessible via paging or "Older" link.
- Compression jobs may replace older entries with stored summaries; timeline should render summaries if present.
- Very old items (> 1–2 years) may be hidden by default; users can surface via filter.

## Instrumentation
- Count timeline API p95 latency.
- Track click-through rate from timeline to snapshot.
- Track proportion of items with relevance/context hints when `activeQuery` is provided.
