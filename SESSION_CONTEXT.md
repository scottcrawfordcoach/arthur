# Arthur Assistant - Session Context

**Last Updated:** October 22, 2025  
**Current Phase:** Phase 3.2 - Emotion Knight (COMPLETED) → Needs Knight (NEXT)  
**Purpose:** Preserve context between development sessions

---

## Strategic Vision

**Arthur is the R&D testbed for the full Roundtable architecture.**

- Arthur (local) → Proves architecture with SQLite, fast iteration
- Full Arthur (Supabase) → Production deployment with Edge Functions
- ScottBot → Wellness-focused extraction of proven patterns
- Tutor → Education-focused extraction of proven patterns

**Why this matters:** We're not building a simple chatbot. We're building a cognitive architecture that will be deployed across multiple specialized products.

---

## Architecture: Roundtable Metaphor (ARTHUR_STRATEGY_v3)

### Core Components

1. **Arthur (Orchestrator)** - Executive decision-maker
   - Applies policy rules
   - Computes influencer weights (Teacher, Coach, Problem Solver)
   - Synthesizes final responses
   - Status: Not yet implemented

2. **Evidence Council (5 Knights)** - Generate signals about user and situation
   - **Pattern Knight** - Detects behavioral trends
   - **Emotion Knight** - Analyzes tone and affect
   - **Needs Knight** - Determines latent intent and goals
   - **Context Knight** - Requests context from Librarian
   - **Analysis Knight** - Synthesizes signals, recommends Herald invocation
   - Output: `signals.json` (urgency, mood, risk, novelty, learning_intent, etc.)
   - Status: Not yet implemented

3. **Advisory Council** - Voice & tone shaping
   - **Teacher** - Explains and contextualizes knowledge
   - **Coach** - Encourages reflection and growth
   - **Problem Solver** - Provides direct, actionable solutions
   - Weights computed dynamically from policy + signals
   - Status: Not yet implemented

4. **Librarian** (formerly Data Handler) - Archive & compliance
   - **SOLE ENTITY WITH DATABASE ACCESS**
   - Executes all reads/writes
   - Enforces retention and privacy policies
   - Acts as system's memory steward
   - Status: Existing services need refactoring to this pattern

5. **Herald** (formerly Researcher) - External exploration
   - Policy-bound web search and API lookups
   - Returns sanitized, provenance-tagged results
   - Invoked only when Analysis Knight recommends
   - Status: Web search exists but needs Herald wrapper

### Data Flow

```
User Message
    ↓
Evidence Council (5 Knights analyze)
    ↓
Pattern → Emotion → Needs → Context → Analysis
    ↓                           ↓           ↓
Behavioral signals         Librarian    Herald
                          (DB access)  (Web search)
    ↓
signals.json
    ↓
Arthur Orchestrator
    ↓
Policy files (influencer_policy.json, etc.)
    ↓
Advisory Council weights (Teacher, Coach, Problem Solver)
    ↓
Response Synthesis
    ↓
Final Response
```

---

## Implementation Status

### ✅ Phase 1: Multi-Tier Knowledge System (COMPLETED)

**Files:**
- `backend/services/fileConverter.js` - Markdown processing
- `backend/scripts/init-db.js` - Database initialization
- `schema_local.sql` - Tier system in assistant_files

**Tiers:**
- `core_knowledge` - Coaching principles, frameworks (ICF competencies)
- `personal_journal` - User activities, reflections, wellness data
- `reference_library` - Books, research, guides
- `archive` - Older content, lower priority

**Results:**
- 13 ICF coaching files processed
- 204 chunks embedded
- Tier filtering working

### ✅ Phase 2: Tier-Based Semantic Search Routing (COMPLETED)

**Files:**
- `backend/services/intentAnalyzer.js` - LLM-based + quick pattern matching
- `backend/services/embeddings.js` - Tier filtering with time-weighting
- `backend/services/recallEngine.js` - Tier-prioritized search
- `backend/services/chatService.js` - Integration with web search

**Features:**
- Intent categories: wellness, research, personal, coaching, general
- Tier priorities per intent
- Web search decision logic (primary/fallback/none)
- Smart fallback: coaching + factual → searches if KB confidence < 0.75

**Test Scripts:**
- `backend/scripts/test-tier-search.js`
- `backend/scripts/test-web-search-routing.js`
- `backend/scripts/test-coaching-factual-fallback.js`
- `backend/scripts/test-conversation-flows.js`

**Key Insight:** Per-message analysis enables dynamic tone switching across conversation turns. This is a competitive advantage over ChatGPT's conversation-level tone.

### 🚧 Phase 3: Evidence Council (IN PROGRESS)

**Goal:** Build 5 Knights following ARTHUR_STRATEGY_v3

#### ✅ Phase 3.1: Knight Base Infrastructure (COMPLETED)

**Files Created:**
- `backend/knights/KnightBase.js` - Base class for all Knights
- `backend/knights/signalsSchema.js` - Signal definitions and validation
- `backend/knights/README.md` - Documentation
- `backend/scripts/test-knight-base.js` - Test infrastructure

**Features:**
- `KnightBase` class with standardized `analyze()` interface
- Signal validation against schema
- Graceful error handling with degraded results
- Result formatting and metadata tracking
- Example signals for all 5 Knight types

**Test Results:**
```
✅ All Knight Base Infrastructure Tests Passed!
- KnightBase instantiation: PASS
- Knight analysis method: PASS
- Signal schema validation (all 5 types): PASS
- Invalid signal detection: PASS
- Error handling: PASS
```

#### ✅ Phase 3.2: Emotion Knight (COMPLETED)

**Files Created:**
- `backend/knights/EmotionKnight.js` - Emotion analysis (287 lines)
- `backend/scripts/test-emotion-knight.js` - Comprehensive test suite (250 lines)
- `EMOTION_KNIGHT_COMPLETE.md` - Detailed completion summary

**Features:**
- Dual analysis: LLM (GPT-4o-mini) + quick pattern matching
- Crisis detection with immediate return (risk >= 0.7)
- Graceful fallback when LLM fails
- Signals: sentiment, mood, urgency, risk, tone_indicators, energy_level

**Test Results:**
```
✅ 8/8 test cases passed
✅ Crisis detection working (95% confidence)
✅ LLM analysis producing nuanced results (85% confidence)
✅ Quick pattern fallback functional (60% confidence)
✅ All signals validated against schema
✅ Error handling tested
```

**Performance:**
- Quick analysis: <1ms (synchronous)
- LLM analysis: 200-500ms (API call)
- Crisis detection: Immediate return, no LLM call needed

**Key Insight:** Several test cases showed LLM being MORE intelligent than expected - detecting implicit emotions and nuanced context that pattern matching missed. This is a feature, not a bug!

#### 📋 Phase 3.2: Needs Knight (NEXT)

**Knight Responsibilities:**

1. **Pattern Knight** (`backend/knights/PatternKnight.js`)
   - Analyzes conversation history for behavioral patterns
   - Detects recurring topics, activity trends, habits
   - Outputs: pattern_signals { recurring_topics, behavior_trends, conversation_rhythm }

2. **Emotion Knight** (`backend/knights/EmotionKnight.js`)
   - Analyzes user message tone and affect
   - Detects sentiment, emotional state, urgency
   - Outputs: emotion_signals { mood, urgency, risk, sentiment }

3. **Needs Knight** (`backend/knights/NeedsKnight.js`)
   - Infers latent intent and goals
   - Determines what user actually needs vs asked for
   - Outputs: needs_signals { learning_intent, support_needed, goal_alignment }

4. **Context Knight** (`backend/knights/ContextKnight.js`)
   - Determines what context is relevant
   - **Requests data from Librarian** (does NOT access DB directly)
   - Outputs: context_requests { semantic_search, conversation_history, user_data }

5. **Analysis Knight** (`backend/knights/AnalysisKnight.js`)
   - Synthesizes signals from all other Knights
   - Detects ambiguity and knowledge gaps
   - Decides if Herald (web search) should be invoked
   - Outputs: synthesized_signals + herald_recommendation

**Interface Pattern:**
```javascript
class KnightBase {
  async analyze(userMessage, conversationContext) {
    // Each Knight produces signals
    return {
      knightName: 'PatternKnight',
      confidence: 0.85,
      signals: { /* knight-specific signals */ },
      reasoning: "Why these signals were generated"
    };
  }
}
```

### 📋 Phase 4: Librarian & Herald (PLANNED)

**Librarian** (`backend/services/Librarian.js`)
- Refactor existing services under single data access layer
- Sole entity with database access
- Methods:
  - `searchSemantic(query, tiers)` - Semantic search
  - `getConversationHistory(sessionId, lastN)` - Recent conversation
  - `getUserPreferences(userId)` - Settings and preferences
  - `getWellnessData(userId, lookback)` - Activity/journal data
  - `writeConversation(message, response, metadata)` - Save interactions
  - `logSignals(signals)` - Store Knight outputs for learning

**Herald** (`backend/services/Herald.js`)
- Wrapper around existing Tavily web search
- Policy-bound search (herald_policy.json)
- Methods:
  - `search(query, context, policy)` - External search
  - `sanitizeQuery(query)` - Remove personal info
  - `tagProvenance(results)` - Add source metadata

### 📋 Phase 5: Arthur Orchestrator & Policies (PLANNED)

**Arthur** (`backend/services/Arthur.js`)
- Receives signals from Evidence Council
- Loads policy files
- Computes Advisory Council weights
- Synthesizes final response
- Methods:
  - `processRequest(userMessage, conversationContext)`
  - `computeInfluencerWeights(signals, policy)`
  - `synthesizeResponse(contexts, weights, signals)`

**Policy Files** (`backend/policies/`)
- `influencer_policy.json` - Teacher/Coach/Problem Solver weight rules
- `signals_schema.json` - Allowed signal types and ranges
- `librarian_policy.json` - DB access rules, retention policies
- `herald_policy.json` - Web search governance (domains, budgets, filters)
- `charter.md` - Human-readable governance summary

---

## Current Working Code

### Existing Services (Need Librarian Refactor)

**backend/services/embeddings.js**
- `generateEmbedding(text)` - OpenAI embeddings
- `storeEmbeddings(chunks, contentId, tier)` - Save to DB
- `searchByEmbedding(embedding, tier, limit)` - Semantic search
- **ACTION NEEDED:** Move to Librarian

**backend/services/recallEngine.js**
- `searchSimilarFiles(query, tierPriorities)` - Tier-aware search
- **ACTION NEEDED:** Becomes `Librarian.searchSemantic()`

**backend/services/chatService.js**
- Current monolithic chat handler
- **ACTION NEEDED:** Replace with Arthur orchestrator flow

**backend/services/intentAnalyzer.js**
- Current intent analysis
- **ACTION NEEDED:** Becomes input to Evidence Council

---

## Key Architectural Decisions

### 0. LLM Oversight at All Critical Points ⭐ **NEW**
- **Code is fast but rigid. LLMs are adaptive but slow/costly.**
- **Decision:** Use LLM at EVERY Knight + Arthur for adaptive intelligence
- All Knights use GPT-4o-mini for signal analysis (~$0.001 per Knight)
- Arthur uses GPT-4o (or GPT-4) for final synthesis (~$0.0075)
- Total cost: ~$0.009 per message for full adaptive intelligence
- **Alternative (pattern-only) saves money but loses entire value proposition**
- See `LLM_DECISION_MATRIX.md` for complete analysis

**Why This Matters:**
- "I'm fine" (sarcastic) vs "I'm fine" (genuine) - LLM detects nuance
- "What should I do?" might need validation, not instructions - LLM infers latent needs
- "stuck again" - LLM understands implicit temporal reference
- **Arthur's value comes from understanding nuance, not pattern matching**

### 1. Knights Don't Access Data Directly
- Only Librarian has DB access (Service Role Key in production)
- Context Knight requests data, doesn't fetch it
- Enforces separation of concerns and security

### 2. Signals Are the Language
- Knights produce signals (JSON objects)
- Arthur consumes signals to make decisions
- Signals are logged for learning (Phase 6)

### 3. Policy-Driven, Not Hardcoded
- Influencer weights from policy files
- Web search rules from herald_policy.json
- Retention rules from librarian_policy.json
- Makes governance auditable and modifiable

### 4. Privacy-First
- Librarian enforces retention policies
- Herald sanitizes queries (no personal identifiers)
- User control: soft delete, export, anonymization

### 5. Local SQLite → Supabase Pattern
- Build architecture with SQLite (fast iteration)
- Librarian abstracts data access (easy swap)
- Knights remain identical in both environments
- Only Librarian implementation changes for Supabase

---

## Database Schema (Current)

### Tables with Tier Support
- `assistant_files` - File metadata with `knowledge_tier` column
- `assistant_chunks` - Text chunks with `tier` inherited from parent
- `assistant_embeddings` - Vector embeddings linked to chunks
- `assistant_preferences` - User settings and learned preferences
- `conversation_sessions` - Session tracking
- `conversation_messages` - Message history

### Tables Needed for Roundtable
- `knight_signals_log` - Store signals from Evidence Council
- `context_retrieval_log` - Track what Librarian retrieved
- `response_metadata` - Track Arthur's decisions (influencer weights, policies applied)
- `herald_queries_log` - Track external searches

---

## Migration Path: Current → Roundtable

### Step 1: Build Evidence Council (Phase 3)
- [x] Update todo list with correct Knight structure
- [ ] Create `backend/knights/` directory
- [ ] Implement Pattern Knight
- [ ] Implement Emotion Knight
- [ ] Implement Needs Knight
- [ ] Implement Context Knight
- [ ] Implement Analysis Knight
- [ ] Create test script for Evidence Council

### Step 2: Build Librarian (Phase 4)
- [ ] Create `backend/services/Librarian.js`
- [ ] Migrate embeddings.js functions to Librarian
- [ ] Migrate recallEngine.js functions to Librarian
- [ ] Add conversation history methods
- [ ] Add wellness data methods
- [ ] Add signal logging methods
- [ ] Update Context Knight to use Librarian

### Step 3: Build Herald (Phase 4)
- [ ] Create `backend/services/Herald.js`
- [ ] Wrap existing Tavily search
- [ ] Implement query sanitization
- [ ] Implement provenance tagging
- [ ] Create `backend/policies/herald_policy.json`
- [ ] Update Analysis Knight to recommend Herald

### Step 4: Build Arthur Orchestrator (Phase 5)
- [ ] Create `backend/services/Arthur.js`
- [ ] Create policy files in `backend/policies/`
- [ ] Implement signal processing
- [ ] Implement influencer weight calculation
- [ ] Implement response synthesis
- [ ] Replace chatService.js with Arthur flow

### Step 5: Add Learning (Phase 6)
- [ ] Create signal logging tables
- [ ] Implement preference learning
- [ ] Build pattern recognition for Knights
- [ ] Create feedback integration

---

## Next Session Checklist

When resuming work:

1. **Read this file first** - Get full context
2. **Check todo list** - See current phase progress
3. **Review last test results** - Understand what works
4. **Check ARTHUR_STRATEGY_v3.md** - Validate against source of truth
5. **Run existing tests** - Ensure nothing broke

---

## Testing Strategy

### Test Each Knight Individually
```bash
node backend/scripts/test-pattern-knight.js
node backend/scripts/test-emotion-knight.js
node backend/scripts/test-needs-knight.js
node backend/scripts/test-context-knight.js
node backend/scripts/test-analysis-knight.js
```

### Test Evidence Council Integration
```bash
node backend/scripts/test-evidence-council.js
```

### Test Full Roundtable Flow
```bash
node backend/scripts/test-arthur-flow.js
```

### Test Supabase Migration (Later)
- Deploy Librarian as Edge Function
- Deploy Herald as Edge Function
- Deploy Knights as Edge Functions (or bundled)
- Test distributed architecture

---

## Common Pitfalls to Avoid

1. **Don't let Knights access DB directly** - Always go through Librarian
2. **Don't hardcode influencer weights** - Use policy files
3. **Don't skip signal logging** - Critical for learning
4. **Don't mix local and Supabase patterns** - Keep Librarian abstract
5. **Don't forget to update this file** - Context preservation is critical

---

## Resources

- **Strategy Doc:** `ARTHUR_STRATEGY_v3.md` (source of truth)
- **Phase 2 Docs:** `PHASE2_IMPLEMENTATION.md` (tier-based routing)
- **Database Schema:** `schema_local.sql`
- **Test Scripts:** `backend/scripts/test-*.js`

---

## Quick Reference: File Locations

### Current Implementation
- Services: `backend/services/`
- Scripts: `backend/scripts/`
- Tests: `backend/scripts/test-*.js`
- Schema: `schema_local.sql`

### Roundtable Implementation (To Create)
- Knights: `backend/knights/`
- Policies: `backend/policies/`
- Librarian: `backend/services/Librarian.js`
- Herald: `backend/services/Herald.js`
- Arthur: `backend/services/Arthur.js`

---

**END OF SESSION CONTEXT**

*This file should be updated after each major implementation milestone.*
