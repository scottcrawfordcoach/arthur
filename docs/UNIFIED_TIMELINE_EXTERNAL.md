Arthur Roundtable Project — Unified Timeline Specification

© 2025 Scott Crawford. All rights reserved.
This document contains proprietary concepts and intellectual property belonging to the Arthur Roundtable Project and Scott Crawford. It may not be reproduced, distributed, or used for commercial or derivative purposes without explicit written permission.

Overview

Document purpose:
This paper outlines the Unified Timeline System, a persistent and context-aware conversation model forming part of the Arthur Roundtable architecture. It enables intelligent, human-like continuity across sessions while preserving observability, auditability, and recency awareness.

Audience:
Technical and strategic partners evaluating integration of the Roundtable chat persistence model within their systems.

Concept: The Unified Timeline

Traditional chat systems use session-bound threads, which fragment memory and context.
The Unified Timeline resolves this by maintaining a single, recency-ordered narrative stream spanning all sessions. This mirrors human recall: a continuous story punctuated by natural pauses (days, topics, or user focus shifts).

Core Benefits

Contextual continuity: Users and assistants share one evolving memory structure.

Cognitive fidelity: Day and time breaks simulate human temporal recall.

Smart-threaded view: Unified Chat Bar dynamically groups related turns by theme or purpose.

Observability layer: Each message links to its underlying reasoning trace for diagnostics.

Session Persistence Model

Each Roundtable instance maintains session persistence of approximately 50–100 conversational turns, per user.
Older turns gracefully roll off the visible interface while remaining indexed in the unified timeline, ensuring lightweight retrieval and privacy compliance.

Features:

Smart-threading: Conversations auto-cluster by session ID and embedding similarity.

Unified chat bar: A single conversational surface where active threads surface contextually.

Rolling memory window: Older entries fade visually but remain accessible through the timeline or session snapshots.

System Entities
Entity	Description	Table
Session	Long-running chat labeled by a generated or user-defined title.	assistant_chat_sessions
Message	Single utterance (user or assistant).	assistant_chat_messages
Timeline	Recency-ordered view of assistant messages across all sessions.	Derived from assistant_chat_messages
Snapshot	Localized view of conversation around an anchor message.	Generated dynamically
Trace	Full reasoning transcript for an assistant message (Council, Librarian, Herald, Advisory, Synthesis).	assistant_roundtable_traces
API Surface (v1)

Base path: /api

Timeline

GET /history/timeline?limit=50
Returns the most recent assistant messages across all sessions.
Response:

{ "items": [{ "id": "...", "sessionId": "...", "title": "...", "summary": "...", "timestamp": "..." }] }

Snapshot

GET /history/snapshot/:messageId
Returns surrounding context for a specific message.
Response:

{ "anchor": { "id": "...", "sessionId": "..." }, "messages": [{ "id": "...", "role": "...", "content": "...", "created_at": "..." }] }

Traces

GET /chat/:messageId/trace — Retrieve full reasoning transcript.
GET /chat/traces/recent?limit=50 — Fetch recent trace list with timing metadata.

Sessions

GET /sessions — List sessions with titles and timestamps.
PATCH /sessions/:id — Update session title.
POST /sessions/backfill-titles — Auto-generate titles for legacy sessions.

Streaming and Timestamp Logic

Chat streaming uses Server-Sent Events (SSE):

metadata event defines session and stream IDs.

content event carries message chunks.

done event finalizes timestamps and trace records.

Frontend heuristics:

Day separators for date transitions.

Time labels on role changes or >5min gaps.

Full datetime on hover.

Frontend Reference Implementation
Component	Function
ChatWindow.jsx	Renders live SSE stream, timestamps, and message layout.
UnifiedTimeline.jsx	Fetches /api/history/timeline, groups by day, refreshes automatically or every 60s.
ChatBar.jsx	Manages smart-threaded session persistence, showing 50–100 active turns.
Security and Privacy

Local-first storage under ./data/db/ai_local.db

Guardrails prevent external search (Herald suppression) for private prompts.

Data residency: Configurable to Canada-hosted (PIPEDA-compliant).

Model isolation: Title generation and summaries default to small, cost-efficient local models (gpt-4o-mini).

Performance Targets
Metric	Target
Timeline render	<200ms
Snapshot retrieval	<100ms
Trace lookup	<250ms
Session backfill (heuristic)	>95% auto-title success
Adoption Guidelines

To adopt the Unified Timeline in your stack:

Persist chat messages with timestamps per session.

Provide a recency-sorted timeline endpoint for assistant messages.

Support snapshots for contextual recall.

Stream chat with timestamp metadata.

Maintain trace objects for reasoning transparency.

Implement a smart-threaded persistence window (50–100 turns).

Intellectual Property & Attribution

Arthur Roundtable Project
Unified Timeline System
© 2025 Scott Crawford — All Rights Reserved
Proprietary design, methodology, and terminology (Roundtable, Unified Timeline, Council, Librarian, Herald, Advisory, Synthesis) are protected under Scott Crawford’s IP portfolio and may not be reused or rebranded without explicit authorization.