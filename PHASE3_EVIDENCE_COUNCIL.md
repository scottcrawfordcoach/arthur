# Phase 3: Evidence Council Implementation

**Date:** October 22, 2025  
**Status:** Ready to Begin  
**Purpose:** Implement the 5 Knights of the Evidence Council following ARTHUR_STRATEGY_v3

---

## Overview

The Evidence Council consists of 5 specialized Knights that analyze each user message and generate **signals** that inform Arthur's orchestration and response synthesis.

**Critical Principle:** Knights analyze and produce signals. They do NOT access data directly. The Context Knight requests data from the Librarian, but doesn't fetch it itself.

---

## Knight Interface

All Knights implement the same base interface:

```javascript
// backend/knights/KnightBase.js
class KnightBase {
  constructor(name) {
    this.name = name;
  }

  /**
   * Analyze user message and context to produce signals
   * @param {string} userMessage - The current user message
   * @param {Object} context - Conversation context and metadata
   * @returns {Object} - Knight analysis result
   */
  async analyze(userMessage, context) {
    throw new Error('analyze() must be implemented by subclass');
  }

  /**
   * Validate signal output format
   * @param {Object} signals - Signals to validate
   * @returns {boolean} - Valid or not
   */
  validateSignals(signals) {
    return signals && typeof signals === 'object';
  }
}
```

**Standard Output Format:**
```javascript
{
  knightName: 'PatternKnight',
  confidence: 0.85,        // 0.0 - 1.0
  signals: {
    // Knight-specific signals
  },
  reasoning: "Why these signals were generated",
  timestamp: "2025-10-22T10:30:00Z"
}
```

---

## Knight 1: Pattern Knight

**Purpose:** Detect behavioral trends and patterns from user history

**File:** `backend/knights/PatternKnight.js`

### Responsibilities
- Analyze conversation history for recurring topics
- Detect activity patterns (workout trends, sleep habits, etc.)
- Identify conversation rhythm (frequency, timing, topics)
- Recognize behavioral trends over time

### Signals Produced
```javascript
{
  recurring_topics: ['training', 'nutrition', 'sleep'],
  topic_frequency: { 'training': 0.45, 'nutrition': 0.30, 'sleep': 0.25 },
  conversation_rhythm: 'daily_evening',  // Pattern of interaction
  behavior_trends: {
    training_plateau: true,
    sleep_improving: true,
    stress_increasing: false
  },
  pattern_strength: 0.75  // How confident in detected patterns
}
```

### Data Needs
- Recent conversation messages (via Librarian)
- Topic tags from previous conversations
- Wellness activity logs (if available)

### Implementation Notes
- Use LLM to detect patterns in conversation history
- Simple pattern matching for known topics
- Time-based windowing (last 7 days, 30 days, all time)
- Confidence based on data volume and consistency

---

## Knight 2: Emotion Knight

**Purpose:** Analyze tone, affect, and emotional state of user message

**File:** `backend/knights/EmotionKnight.js`

### Responsibilities
- Detect sentiment (positive, neutral, negative)
- Analyze emotional tone (excited, frustrated, calm, anxious, etc.)
- Assess urgency level
- Identify emotional risk indicators

### Signals Produced
```javascript
{
  sentiment: 0.65,        // -1.0 (very negative) to +1.0 (very positive)
  mood: 'frustrated',     // detected emotional state
  urgency: 0.80,          // 0.0 (casual) to 1.0 (urgent)
  risk: 0.15,             // 0.0 (safe) to 1.0 (crisis)
  tone_indicators: ['exclamation', 'short_sentences', 'negative_words'],
  energy_level: 'low'     // high, medium, low
}
```

### Data Needs
- Current user message only
- Optional: Recent message history for tone shift detection

### Implementation Notes
- Use LLM with emotion analysis prompt
- Quick pattern matching for urgent keywords ("help", "emergency", etc.)
- Risk assessment for crisis detection (important for wellness app)
- Fallback to simple sentiment analysis if LLM fails

---

## Knight 3: Needs Knight

**Purpose:** Infer latent intent and actual needs vs stated request

**File:** `backend/knights/NeedsKnight.js`

### Responsibilities
- Determine what user actually needs (may differ from what they asked)
- Identify learning intent vs immediate problem solving
- Detect support needs (emotional, informational, tactical)
- Assess goal alignment with user's stated objectives

### Signals Produced
```javascript
{
  stated_intent: 'information',        // What user explicitly asked for
  latent_need: 'emotional_support',    // What they might actually need
  learning_intent: 0.70,               // Wants to learn vs just answer
  support_needed: 'coaching',          // Type: coaching, information, validation
  goal_alignment: 0.85,                // Aligns with user's known goals
  exploratory: false,                  // Exploring vs focused question
  needs_confidence: 0.75               // How confident in this assessment
}
```

### Data Needs
- Current user message
- User goals and preferences (via Librarian)
- Recent conversation context

### Implementation Notes
- Use LLM to detect discrepancies between asked and needed
- Compare against user's known goals from preferences
- Consider emotional signals from Emotion Knight
- High uncertainty → exploratory coaching approach

---

## Knight 4: Context Knight

**Purpose:** Determine what context is relevant and request it from Librarian

**File:** `backend/knights/ContextKnight.js`

### Responsibilities
- Decide what semantic search is needed
- Determine conversation history window
- Identify relevant user data (preferences, wellness, etc.)
- **Request** (not fetch) context from Librarian
- Prioritize context sources

### Signals Produced
```javascript
{
  context_requests: {
    semantic_search: {
      query: "coaching principles for plateau",
      tiers: ['core_knowledge', 'reference_library'],
      limit: 10
    },
    conversation_history: {
      last_n: 10,
      include_topics: ['training', 'goals']
    },
    user_data: {
      preferences: true,
      wellness_data: { type: 'activity', lookback: '30d' },
      goals: true
    }
  },
  context_priority: ['semantic_search', 'user_data', 'conversation_history'],
  novelty: 0.60  // How much new info vs known topics
}
```

### Data Needs
- Current user message
- Intent from Needs Knight
- Patterns from Pattern Knight
- **Does NOT access DB directly** - produces requests for Librarian

### Implementation Notes
- Analyzes user message to determine context needs
- Uses signals from other Knights to refine requests
- Prioritizes based on intent (coaching → core_knowledge, research → reference_library)
- Outputs structured requests that Librarian can fulfill

---

## Knight 5: Analysis Knight

**Purpose:** Synthesize all signals and make recommendations to Arthur

**File:** `backend/knights/AnalysisKnight.js`

### Responsibilities
- Synthesize signals from all other Knights
- Detect ambiguity and knowledge gaps
- Recommend if Herald (web search) should be invoked
- Produce final signal set for Arthur orchestrator
- Identify contradictions or uncertainties

### Signals Produced
```javascript
{
  synthesized_signals: {
    // Merged and weighted signals from all Knights
    mood: 'frustrated',
    urgency: 0.80,
    learning_intent: 0.70,
    recurring_topics: ['training'],
    latent_need: 'emotional_support'
  },
  herald_recommendation: {
    invoke: true,
    reason: "User asking about current research, KB may be outdated",
    search_query: "latest training plateau research 2025",
    priority: 'fallback'  // primary, fallback, or none
  },
  ambiguity_detected: false,
  knowledge_gaps: ['current research', 'user-specific data'],
  confidence: 0.82,
  recommendation: "Coaching approach with research support"
}
```

### Data Needs
- Signals from all other Knights
- Context requests from Context Knight
- User message

### Implementation Notes
- Receives all Knight outputs
- Uses LLM to synthesize and detect patterns across signals
- Determines if external search needed (Herald)
- Produces final recommendations for Arthur
- Handles contradictory signals (e.g., high urgency + low risk)

---

## Integration Flow

```
User Message
    ↓
┌─────────────────────────────────────────────┐
│         Evidence Council Analysis           │
│                                             │
│  ┌──────────────┐  ┌─────────────┐         │
│  │Pattern Knight│  │Emotion Knight│         │
│  └──────┬───────┘  └──────┬──────┘         │
│         │                 │                 │
│         ↓                 ↓                 │
│  ┌──────────────┐  ┌─────────────┐         │
│  │ Needs Knight │  │Context Knight│         │
│  └──────┬───────┘  └──────┬──────┘         │
│         │                 │                 │
│         │                 │                 │
│         ↓                 ↓                 │
│         All signals + context requests      │
│                 ↓                           │
│         ┌──────────────┐                    │
│         │Analysis Knight│                   │
│         └──────┬───────┘                    │
│                │                            │
└────────────────┼────────────────────────────┘
                 ↓
        Synthesized Signals
                 ↓
         Arthur Orchestrator
```

**Execution Order:**
1. Pattern, Emotion, Needs Knights run in parallel (independent)
2. Context Knight runs after (uses signals from 1-3)
3. Analysis Knight runs last (synthesizes all)

---

## Testing Strategy

### Individual Knight Tests

**Test Pattern Knight:**
```javascript
// backend/scripts/test-pattern-knight.js
const PatternKnight = require('../knights/PatternKnight');

async function test() {
  const knight = new PatternKnight();
  
  const testCases = [
    {
      userMessage: "I'm stuck at the same plateau again",
      conversationHistory: [
        { role: 'user', content: 'My training has plateaued', timestamp: '2025-10-15' },
        { role: 'user', content: 'Still not making progress', timestamp: '2025-10-18' }
      ]
    }
  ];
  
  for (const test of testCases) {
    const result = await knight.analyze(test.userMessage, test);
    console.log('Pattern Signals:', result.signals);
    console.log('Recurring Topics:', result.signals.recurring_topics);
  }
}
```

### Evidence Council Integration Test

```javascript
// backend/scripts/test-evidence-council.js
const EvidenceCouncil = require('../services/EvidenceCouncil');

async function test() {
  const council = new EvidenceCouncil();
  
  const userMessage = "I'm feeling stuck with my training";
  const context = {
    sessionId: 'test-123',
    userId: 'user-1'
  };
  
  const analysis = await council.analyze(userMessage, context);
  
  console.log('Pattern Signals:', analysis.pattern);
  console.log('Emotion Signals:', analysis.emotion);
  console.log('Needs Signals:', analysis.needs);
  console.log('Context Requests:', analysis.context.context_requests);
  console.log('Final Synthesis:', analysis.synthesis);
}
```

---

## Implementation Order

### Phase 3.1: Build Knight Base
- [x] Create `backend/knights/` directory
- [x] Implement `KnightBase.js` with interface
- [x] Create signal validation schema

### Phase 3.2: Build Individual Knights
- [x] Implement Emotion Knight (simplest - single message analysis)
- [x] Implement Needs Knight (uses Emotion signals)
- [x] Implement Pattern Knight (requires conversation history)
- [x] Implement Context Knight (uses signals from others)
- [x] Implement Analysis Knight (synthesizes all)

### Phase 3.3: Build Evidence Council Coordinator ✅ COMPLETE
- [x] Create `backend/services/EvidenceCouncil.js`
- [x] Orchestrate Knight execution (parallel + sequential)
- [x] Handle Knight failures gracefully
- [x] Return unified signal set
- [x] **All 8 tests passing!** (test-evidence-council.js)

### Phase 3.4: Testing & Refinement ✅ COMPLETE
- [x] Create individual Knight tests
- [x] Create Evidence Council integration test
- [x] Test with real conversation flows
- [x] Validate signal quality and consistency

---

## Success Criteria

Evidence Council is complete when:

1. ✅ All 5 Knights implemented and tested individually (40/40 tests passing)
2. ✅ EvidenceCouncil coordinator orchestrates execution correctly (8/8 tests passing)
3. ✅ Signals produced match schema and are useful
4. ✅ Context Knight produces requests (doesn't access DB)
5. ✅ Analysis Knight correctly recommends Herald invocation
6. ✅ Integration tests pass with realistic conversations
7. ✅ Signal quality enables Arthur to make informed decisions

**STATUS: ✅ EVIDENCE COUNCIL 100% COMPLETE**

---

## Phase 3 Summary

### What We Built
- **5 Knights:** Emotion, Needs, Pattern, Context, Analysis
- **Evidence Council Coordinator:** Orchestrates all Knights in phased execution
- **Test Infrastructure:** 48 total tests (40 Knight tests + 8 Council tests)
- **Synthetic Test Data:** 116 messages over 170 days with is_test flag
- **3D Relevance Scoring:** Schema ready for Librarian implementation

### Key Achievements
- **Phased Execution:** Phase 1 (parallel), Phase 2 (sequential), Phase 3 (sequential)
- **Graceful Degradation:** Knights can fail without breaking the system
- **Herald Invocation Logic:** Analysis Knight decides when to search externally
- **Confidence Scoring:** Aggregated from all Knights with failure penalty
- **Metrics Tracking:** Performance monitoring (avg 11-12s execution)

### Files Created
- `backend/knights/KnightBase.js` (base class)
- `backend/knights/signalsSchema.js` (validation)
- `backend/knights/EmotionKnight.js` (8/8 tests)
- `backend/knights/NeedsKnight.js` (8/8 tests)
- `backend/knights/PatternKnight.js` (8/8 tests)
- `backend/knights/ContextKnight.js` (8/8 tests)
- `backend/knights/AnalysisKnight.js` (8/8 tests)
- `backend/services/EvidenceCouncil.js` (8/8 tests)
- Test files for all components
- Complete documentation (EVIDENCE_COUNCIL_COORDINATOR_COMPLETE.md)

### NPM Commands
```bash
npm run test:council  # Test Evidence Council Coordinator
```

---

## Next Steps After Phase 3

1. **Phase 4: Librarian** - Sole DB accessor, fulfills Context Knight requests, implements 3D relevance scoring
2. **Phase 4: Herald** - External web search via Tavily, invoked by Analysis Knight recommendation
3. **Phase 5: Arthur Orchestrator** - Receives signals, computes Advisory weights, applies policy, synthesizes with GPT-5
4. **Phase 5: Policy System** - influencer_policy.json, signals_schema.json, librarian_policy.json, herald_policy.json

---

**Phase 3: COMPLETE! Ready for Phase 4: Librarian**
