# Project Summary — November 1, 2025

Copyright © 2025 Scott Crawford. All rights reserved.

## What this project is

A local‑first, policy‑driven, multi‑agent AI assistant with a modern web UI (Vite + React + Tailwind) and a Node/Express backend. It blends real‑time chat with a searchable memory layer and an AI‑first Smart Topic Cloud that organizes conversations by theme automatically.

- Frontend: `frontend/`
- Backend: `backend/`
- Policies: `backend/config/*.json`
- Agents (Knights): `backend/knights/`
- Topics intelligence: `backend/services/topicService.js`
- Docs: `AI_TOPIC_CLOUD.md`, `POLICY_DRIVEN_KNIGHTS.md`, `ADVISORY_COUNCIL_EXPLAINED.md`

## How it works (pipeline)

1. User message enters via the web app (`ChatWindow.jsx`, `Sidebar.jsx`).
2. API receives it (Express routes in `backend/routes/`), and `Arthur.js` orchestrates.
3. Advisory Council + Knights analyze the message:
   - Emotion, Needs, Pattern, Context, Analysis (`backend/knights/*.js`)
   - Behavior is externalized to JSON policies in `backend/config/`.
4. Librarian retrieves helpful context across tiers (reference_library, personal_journal, conversation) using embeddings (`Librarian.js`).
5. Response is generated (model‑safe logic in `Arthur.js`) and streamed back to UI.
6. Messages + embeddings are stored (SQLite) and become searchable (`db.js`).
7. Smart Topic Cloud runs AI segmentation (gpt‑4o‑mini) to discover themes, pick the primary topic, and label them concisely (`topicService.js`).

## What it does (capabilities)

- ICF‑aligned coaching mode (one powerful question, no stacking, evoking awareness)
- Multi‑agent analysis via Evidence Council Knights
- AI‑first Smart Topic Cloud with dual labels (punchy cloud label + descriptive title)
- Semantic search over conversation + library content
- Virtual threads and session bundling for topic‑centric browsing
- “Clear Screen” UX that preserves data and reassures the user

## What makes it different

- Policy‑driven behavior (coaching style, thresholds, retrieval) in JSON (edit without redeploying code)
- Multi‑agent architecture (specialized analysis instead of a single monolith prompt)
- AI‑first topic intelligence (LLM finds boundaries, marks primary vs. logistics, and labels succinctly)
- Local transparency (SQLite + clear services, with logs and cache controls)
- Dev ergonomics (defensive coding, readable modules, docs for key systems)

## Advantages

- Adaptable: tweak policies in `backend/config/*.json`
- Context‑smart: topic cloud surfaces the true theme, merges closing logistics
- Searchable memory with embeddings
- Cost‑effective: topic AI uses gpt‑4o‑mini (~$0.0003 per conversation analysis)
- Robustness: policy defaults, optional chaining, model compatibility checks

## Limitations

- Requires OpenAI API (network + small cost)
- AI labeling is probabilistic; occasional over/under‑segmentation
- Policies not hot‑reloaded (restart needed)
- Primarily English; multilingual needs prompt/model tuning
- Very long sessions may need batching for best performance

## Key files and where behavior lives

- Orchestrator: `backend/services/Arthur.js`
- Topic Intelligence: `backend/services/topicService.js`
- Session Bundling: `backend/services/sessionBundler.js`
- Retrieval/Search: `backend/services/Librarian.js`, routes in `backend/routes/search.js`
- Agents/Knights: `backend/knights/*.js`
- Policies (edit here):
  - `backend/config/influencer_policy.json` (ICF coaching guidance)
  - `backend/config/analysis_knight_policy.json`
  - `backend/config/emotion_knight_policy.json`
  - `backend/config/needs_knight_policy.json`
  - `backend/config/pattern_knight_policy.json`
  - `backend/config/context_knight_policy.json`
  - `backend/config/librarian_policy.json`

## Notable recent improvements

- AI‑first topic segmentation with primary detection and dual labels
- Session‑scoped grouping so multiple segments combine into one cloud item
- Defensive null checks across Knights; model compatibility for o1/gpt‑5
- “Clear Screen” rename + reassurance toast; improved logs (Council weights)

## How to run (short)

- Backend: `npm run dev` from project root starts API + frontend (see `package.json`).
- If needed, initialize DB via scripts in `backend/scripts/`.
- Environment: set `OPENAI_API_KEY` for AI features. Without it, legacy segmentation fallback is used.

## Where to read more

- Smart Topics: `AI_TOPIC_CLOUD.md`
- Policy agents: `POLICY_DRIVEN_KNIGHTS.md`
- Advisory Council: `ADVISORY_COUNCIL_EXPLAINED.md`
- System map: `docs/SYSTEM_MAP.md`
- Setup/Troubleshooting: `SETUP.md`, `TROUBLESHOOTING.md`

---

This document summarizes the state as of Nov 1, 2025; see Git history for subsequent changes.
