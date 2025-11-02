# System Map (Arthur Assistant)

Copyright © 2025 Scott Crawford. All rights reserved.

Status: ✅ Current
Date: 2025-11-01

## 1) High-level architecture

```
 ┌─────────────────────┐        HTTP (REST/WS)        ┌──────────────────────┐
 │   Frontend (Vite)   │  ─────────────────────────▶  │   Backend (Express)   │
 │  React + Tailwind   │                              │  routes/*             │
 │  - ChatWindow       │                              │  services/*           │
 │  - Sidebar/Cloud    │                              │  knights/*            │
 └─────────┬───────────┘                              └──────────┬───────────┘
           │                                                   │
           │                                                   │ Orchestration
           │                                                   ▼
           │                                         ┌──────────────────────┐
           │                                         │  Arthur (services)   │
           │                                         │  - advisory council  │
           │                                         │  - model adapter     │
           │                                         └──────────┬───────────┘
           │                                                    │
           │                                       context      │  analysis
           │                                                    │
           │                                         ┌──────────▼───────────┐
           │                                         │  Knights (agents)    │
           │                                         │  Emotion/Needs/      │
           │                                         │  Pattern/Context/    │
           │                                         │  Analysis            │
           │                                         └──────────┬───────────┘
           │                                                    │ findings
           │                                                    ▼
           │                                         ┌──────────────────────┐
           │                                         │  Librarian (RAG)     │
           │                                         │  - embeddings search │
           │                                         │  - ref/personal/conv │
           │                                         └──────────┬───────────┘
           │                                                    │ SQL + vec
           │                         ┌───────────────────────────┴──────────────────────────┐
           │                         │                           DB                          │
           │                         │  SQLite + embeddings tables (messages, sessions,     │
           │                         │  bundles, topics)                                     │
           │                         └───────────────────────────────────────────────────────┘
           │
           │ topics + snapshots
           ▼
 ┌──────────────────────┐
 │ Smart Topic Cloud    │  (AI-first segmentation: gpt-4o-mini)
 │ - cloudLabel/title   │  - primary vs logistics
 │ - virtual threads    │  - session-based grouping
 └──────────────────────┘
```

## 2) Data flow (happy path)

1. UI posts message → `backend/routes/chat.js`
2. `Arthur.js` orchestrates: applies Advisory Council weights, selects model, streams reply
3. Knights analyze using policy JSONs (`backend/config/*_knight_policy.json`)
4. Librarian gathers context (reference_library, personal_journal, conversation)
5. Message stored + embedded (`services/db.js`), session updated (`sessionBundler.js`)
6. Topic Cloud: `topicService.js` runs AI segmentation → concise cloud labels → snapshot/virtual thread

## 3) Key entry points (code map)

- Orchestrator: `backend/services/Arthur.js`
- Topic intelligence: `backend/services/topicService.js`
- Session assembly: `backend/services/sessionBundler.js`
- Retrieval: `backend/services/Librarian.js`
- Routes (API): `backend/routes/*.js` (chat, topics, search, sessions, files)
- Agents (Knights): `backend/knights/*.js`
- Policies (JSON): `backend/config/*.json`
- Frontend: `frontend/src/components/` (ChatWindow, Sidebar, TopicCloud, ChatHistory)

Docs worth reading first:
- `AI_TOPIC_CLOUD.md` — design/contract/cost
- `POLICY_DRIVEN_KNIGHTS.md` — policy-driven agents & patterns
- `ADVISORY_COUNCIL_EXPLAINED.md` — council modes, weights

## 4) Behavior knobs (JSON policies)

- Coaching/Influence: `backend/config/influencer_policy.json` (ICF instruction)
- Knights: `analysis|emotion|needs|pattern|context` policies in `backend/config/`
- Librarian search: `backend/config/librarian_policy.json`
- Signals schema: `backend/config/signals_schema.json`

Pattern to access safely in code:
```js
const value = policy?.section?.field ?? defaultValue;
```

## 5) Smart Topic Cloud (AI-first)

- Model: `gpt-4o-mini` with JSON output
- Segmentation prompt returns: `primaryTopic`, `cloudLabel`, `segments[] {start,end,label,cloudLabel,isPrimary}`
- Grouping: all live segments from same session merge into one cloud topic
- Labels: cloud (2–3 words) for scanning; title (descriptive) for lists
- Code: `backend/services/topicService.js`

## 6) Runbook (local)

Backend (from project root):
```bash
npm run server
```
Frontend:
```bash
cd frontend && npm run dev
```
Check topics (optional):
```bash
curl -s "http://localhost:3001/api/topics/summary?limit=15" | jq '.items[] | {topic, title, count}'
```

## 7) Advantages vs typical assistants

- Policy-driven behavior you can tune without code
- Multi-agent analysis (Knights) instead of a single monolithic prompt
- AI-first topic intelligence (primary vs logistics, concise labels)
- Local-first storage and transparent routes/services
- Cost-efficient (gpt-4o-mini for topic analysis)

## 8) Current limitations

- Requires OpenAI connectivity for AI segmentation
- Occasional over/under-segmentation; prompt tuning helps
- Policies not hot-reloaded (restart needed)
- Very long sessions may need batching for speed

## 9) Quick troubleshooting

- Topic cloud stale → cache TTL (60s) or call invalidation helper
- Virtual thread shows wrong content → ensure `virtualThread` is cleared on session switch (fixed in `App.jsx`)
- Model errors (temperature/etc.) → see guards in `Arthur.js`
- Knight crashes → verify policy JSON shape; defaults should prevent failures

## 10) Extend points

- Add/edit policies in `backend/config/`
- Tune AI cloud labels/prompt in `topicService.js`
- Add a new Knight in `backend/knights/`
- Expand Librarian tiers/weights in `librarian_policy.json`

```text
This map is designed as a 1-page onboarding: architecture, flow, and where-to-edit next.
```