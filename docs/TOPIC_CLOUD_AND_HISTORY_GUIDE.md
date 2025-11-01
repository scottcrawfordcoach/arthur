# Topic Cloud & Unified History Experience

Prepared for: Arthur UI/UX + backend developers

Purpose: document the hybrid "Smart Topic Cloud" + "Full Chat History" design so implementation tomorrow is straightforward.

---

## Objectives

- Deliver a gist-first recognition surface (topic cloud) without losing the existing chronological unified threads.
- Allow one-click access to compiled "virtual threads" sourced from relevant fragments across sessions.
- Keep archived bundles discoverable inside the expanded history dropdown.
- Provide keyword (and later semantic) search for granular retrieval.
- Maintain local-first, privacy-preserving behavior and bundling guarantees.

Success criteria (MVP, phase 0):
- Topic cloud renders ≤200 ms (cache hit ≤10 ms) with ≤15 topics.
- Clicking a topic opens a virtual thread with stitched messages/bundles.
- "Full Chat History" dropdown exposes the current unified timeline with archived placeholders unchanged.
- Keyword search returns results ≤200 ms for typical datasets.
- Accessibility: keyboard navigation, aria labels, reduced-motion support verified.

---

## View-level summary

| Surface | Purpose | Data source |
| --- | --- | --- |
| Topic Cloud (default) | Recognition-first summary of 10–15 Smart Topics sized by recency × frequency. | `/api/topics/summary` |
| Virtual Thread pane | Read-only stitched timeline for the selected topic (cross-session). | `/api/topics/:topicId/snapshot` |
| Full Chat History dropdown | Existing unified smart threads (chronological). | `/api/history/timeline` / `/api/chat/:sessionId/history` |
| Keyword search | Granular recall by term (future semantic toggle). | `/api/history/search` |

---

## User flows

1. **Browse**: User sees the cloud, hovers for tooltip ("56 turns · last active 2h ago"), clicks to open a virtual thread. "Open in Session" button jumps to the originating session when applicable.
2. **Full history**: User toggles the button, the unified chronological list expands with archived bundle placeholders. Collapse returns to the compact cloud.
3. **Search**: User enters a keyword; results show snippet, timestamp, session/topic chips, with links to virtual thread or snapshot.
4. **New chat**: When a new chat starts, previous mixed sessions remain intact but their messages now carry topic references so the cloud and search show themed fragments.

---

## Data model extensions (no data duplication)

- `assistant_topics`
  - `id` TEXT PK, `name` TEXT, `created_at`, `last_active`, `color_hint` TEXT (optional)
- `assistant_message_topics`
  - `message_id` TEXT, `topic_id` TEXT, `score` REAL, PRIMARY KEY (`message_id`, `topic_id`)
- Optional cache table: `assistant_topic_snapshots` (`topic_id`, `payload`, `last_built_at`) for virtual thread memoization.
- Bundles remain authoritative for archived segments; topic assignment stores references only.

Topic assignment strategy:
- **Phase 0 (Session mode)**: Topic = session title. All messages/bundles inherit the session topic.
- **Phase 1 (Keyword mode)**: Assign top TF-IDF n-grams per message in last *window* (e.g., 30 days); merge near-duplicates.
- **Phase 2 (Cluster mode)**: Use existing embeddings (already generated for messages) with MiniBatch K-Means or HDBSCAN; label clusters via top n-grams.

Mixed sessions are split virtually by assigning multiple topics to different portions; no rewriting of rows.

---

## API plan

### Topic summary (cloud)
- `GET /api/topics/summary`
  - Query params: `limit` (default 15, max 50), `window` (default `30d`), `mode=session|keyword|cluster` (default `session`).
  - Response item:
    ```json
    {
      "topic": "Q4 Roadmap – Pricing",
      "topicId": "topic_123",
      "weight": 87,
      "count": 56,
      "lastActive": "2025-10-26T15:04:12Z",
      "recencyScore": 0.92,
      "engagementScore": 0.61,
      "sessionId": "S123",        // optional in keyword/cluster mode
      "anchorId": "M987",         // message or bundle ID for drill-down
      "colorHint": "#3B82F6",
      "mode": "session"
    }
    ```
  - Implementation: SQL aggregation over `assistant_chat_messages` + bundles within window, cached (TTL 30–60s).

### Virtual thread snapshot
- `GET /api/topics/:topicId/snapshot`
  - Params: `limit` (default 200), optional `before/after` cursors.
  - Response: list of chronological entries mixing live messages and bundle payload extracts.
  - Cache: optional memoization per topic with TTL (15–60 s). Rebuilt lazily after new messages.

### Keyword/semantic search
- `GET /api/history/search`
  - Query params: `q`, `mode=keyword|semantic`, `limit`, optional `topicId`, `sessionId`, `from`, `to`.
  - Returns snippet + anchors. Keyword mode can use SQLite FTS or LIKE; semantic uses vector similarity when enabled.

### Admin
- `POST /api/topics/reindex` (optional) to trigger backfill or cluster rebuild.

Existing endpoints (`/api/history/timeline`, `/api/history/snapshot`, `/api/chat/:sessionId/history`) remain unchanged and power the full history dropdown.

---

## Scoring & visual encoding

Normalize each factor to [0,1]:
- Frequency: `f = log(1 + message_count_window)`
- Recency: `r = exp(-Δt/τ)` (τ default 72h, configurable)
- Engagement (optional): `e = normalize(avg assistant completion length)`

Combine: `score = 0.5*f + 0.4*r + 0.1*e`
- Convert to `weight` → map to font sizes `[16px, 60px]`.
- Bold if `recency > 0.85`.
- Color and position derived from a stable hash of `topicId` to reduce jitter.

---

## UI guidelines

- **Topic Cloud**
  - Render 10–15 items, minimal rotation (±10–15°).
  - Tooltip: `<count> turns · last active <relative time>`; include full label in tooltip and aria-label.
  - Each word is a `<button>` with keyboard focus, Enter to activate.
  - Provide `Open in Session` when `sessionId` present; fallback to snapshot view.
  - Respect `prefers-reduced-motion`: disable rotation/animations.

- **Full Chat History button**
  - Toggles an animated collapsible panel containing the unchanged unified list. Provide sticky header labeling the view.

- **Virtual Thread pane**
  - Show breadcrumbs (`Topic > Virtual Thread`).
  - Include chips for source sessions/bundles. Keep "Open in Session" and "Jump to timeline" actions.

- **Search bar**
  - Placed above the cloud/dropdown. Supports filters (topic, session, date).
  - Results list shows snippet, timestamp, origin session; clicking navigates similarly to snapshots or virtual threads.

---

## Performance & caching

- Topic summary cache keyed by (`mode`, `window`, `limit`), TTL 30–60 s.
- Virtual thread cache keyed by (`topicId`, `limit`, `cursor`), TTL 15–60 s (optional to start).
- Invalidate caches when a new assistant message completes (`timeline:refresh` already dispatched in ChatWindow).
- Ensure indexes: `assistant_chat_messages(session_id, created_at DESC)`, `assistant_chat_session_bundles(session_id, end_created_at DESC)`.

---

## Guardrails and policies

- Local-first only; avoid external APIs for topic extraction unless explicitly enabled.
- Keep bundling transactional; do not update topic mappings mid-transaction.
- No rewriting or deleting of historical messages; only create references.
- Logs: structured, no PII. Follow existing policies under `backend/config/*.json`.
- Handle empty states gracefully ("No topics yet—start a conversation").

---

## Rollout plan

1. **Phase 0 (MVP)**
   - Session-mode topics only (no clustering yet).
   - Topic cloud UI behind `UI_TOPIC_CLOUD` flag.
   - Full History dropdown using existing components.
   - Basic keyword search (LIKE or FTS) gated by `UI_TOPIC_SEARCH` flag.

2. **Phase 1**
   - Enable keyword mode (TF-IDF).
   - Enhance search to use FTS across assistant + user content.
   - Add analytics: topic click-through, time-to-find, search success.

3. **Phase 2**
   - Enable cluster mode using embeddings.
   - Add semantic search (vector similarity) behind `SEARCH_SEMANTIC` flag.
   - Compare metrics vs session-mode baseline before promoting.

Feature flags allow quick rollback to the current unified list.

---

## Testing strategy

- Unit
  - Topic scoring yields expected ordering for synthetic datasets.
  - Topic summary endpoint returns cached data; respects limit/window.
  - Virtual thread assembly merges live + bundle messages correctly.
- Integration
  - Clicking a topic opens the correct stitched thread (verify session IDs and message ordering).
  - Bundling events still emit placeholders in the full history view.
  - Keyword search returns accurate results for mixed sessions.
- Accessibility
  - Keyboard navigation across the cloud, dropdown, and search results.
  - Screen reader labels for topics (including counts and recency).
  - Reduced-motion preference reduces animations.
- Performance
  - p95 latency for new endpoints <200 ms on sample data.
  - Timeline refresh still <200 ms after bundling.

---

## Open questions / next steps

- Topic labeling heuristics for keyword/cluster modes (e.g., combine synonyms?).
- Analytics schema for topic interactions (local events only).
- Virtual thread pagination UX (infinite scroll vs. fixed window).
- Whether to persist user pins/favorites for topics.

---

This guide should give tomorrow’s implementation a clear runway: create the topic summary endpoint + cache, build the cloud UI behind a feature flag, wire the full history dropdown to existing components, and add the keyword search surface. Subsequent phases can layer on keyword and embedding-based modes.

Copyright (c) 2025 Scott Crawford. All rights reserved.
