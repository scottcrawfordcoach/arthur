# EVIDENCE COUNCIL COORDINATOR - COMPLETE ✅

**Status:** Phase 3.3 Complete - All 8 Tests Passing  
**Date:** October 22, 2025  
**Implementation:** `backend/services/EvidenceCouncil.js` (390 lines)  
**Test Suite:** `backend/scripts/test-evidence-council.js` (8 comprehensive tests)

---

## Overview

The **Evidence Council Coordinator** is the orchestration layer that manages the 5 Knights of the Evidence Council. It executes Knights in phases (parallel + sequential), handles failures gracefully, and returns unified signals to Arthur for final synthesis.

### Architecture (Roundtable Metaphor)

```
Arthur Orchestrator
    ↓
Evidence Council Coordinator ← YOU ARE HERE
    ↓
    ┌──────────────── Phase 1 (Parallel) ────────────────┐
    │                                                      │
    ├─→ Emotion Knight ────────────┐                     │
    ├─→ Needs Knight ──────────────┼─→ signals          │
    └─→ Pattern Knight ────────────┘                     │
    │                                                      │
    └──────────────────────────────────────────────────────┘
           ↓
    ┌──────────────── Phase 2 (Sequential) ───────────────┐
    │                                                       │
    └─→ Context Knight (receives Phase 1 signals)        │
           ↓ (generates context_requests)                 │
    └──────────────────────────────────────────────────────┘
           ↓
    ─────────────────────────────────────────────────────
    [Future: Librarian fulfills context_requests via DB]
    ─────────────────────────────────────────────────────
           ↓
    ┌──────────────── Phase 3 (Sequential) ───────────────┐
    │                                                       │
    └─→ Analysis Knight (synthesizes all signals)        │
           ↓                                               │
    └──────────────────────────────────────────────────────┘
           ↓
    Returns to Arthur
```

---

## Implementation Details

### Core Methods

#### `convene(userMessage, context)`
Main entry point. Orchestrates all 3 phases and returns unified signals.

**Input:**
```javascript
{
  userMessage: "Can you explain how React hooks work?",
  context: {
    session_id: "abc123",
    user_id: "user456",
    conversation_history: [...]
  }
}
```

**Output:**
```javascript
{
  success: true,
  signals: {
    emotion: { sentiment: 0.0, mood: "frustrated", urgency: 0.3, ... },
    needs: { stated_intent: "information", latent_need: "guidance", ... },
    pattern: { recurring_topics: [], topic_frequency: {}, ... },
    context: { context_requests: {...}, context_priority: [...], novelty: 0.9 },
    analysis: { 
      synthesized_signals: {...},
      herald_recommendation: { invoke: true, ... },
      recommendation: "invoke_herald_first"
    },
    confidence: 0.75,
    degraded: false,
    knightStatus: {
      emotion: "success",
      needs: "success",
      pattern: "success",
      context: "success",
      analysis: "success"
    }
  },
  executionTime: 12060,
  timestamp: "2025-10-22T..."
}
```

---

### Execution Phases

#### Phase 1: Independent Knights (Parallel)
Runs Emotion, Needs, and Pattern Knights simultaneously since they don't depend on each other.

```javascript
const [emotionResult, needsResult, patternResult] = await Promise.allSettled([
  this.emotionKnight.analyze(userMessage, context),
  this.needsKnight.analyze(userMessage, context),
  this.patternKnight.analyze(userMessage, context)
]);
```

**Why Parallel?**
- 3x faster execution (10-12s vs 30-36s if sequential)
- Knights analyze independently
- No data dependencies between them

#### Phase 2: Context Knight (Sequential)
Depends on Phase 1 signals to determine what context to request.

```javascript
const contextInput = {
  emotion: phase1Results.emotion?.signals,
  needs: phase1Results.needs?.signals,
  pattern: phase1Results.pattern?.signals
};

const contextResult = await this.contextKnight.analyze(userMessage, contextInput);
```

**Why Sequential?**
- Needs emotion/needs/pattern signals to determine context priorities
- Example: Crisis → prioritize personal_journal, Learning → prioritize reference_library

#### Phase 3: Analysis Knight (Sequential)
Synthesizes all signals into final recommendations.

```javascript
const analysisInput = {
  emotion: allPriorResults.emotion?.signals,
  needs: allPriorResults.needs?.signals,
  pattern: allPriorResults.pattern?.signals,
  contextKnight: allPriorResults.contextKnight?.signals
};

const analysisResult = await this.analysisKnight.analyze(userMessage, analysisInput);
```

**Why Sequential?**
- Needs all prior signals for strategic synthesis
- Makes Herald invocation decision (search web vs use internal context)
- Detects ambiguity and knowledge gaps

---

## Error Handling & Graceful Degradation

### Strategy
Knights can fail without breaking the whole council. Degraded signals are returned with confidence penalties.

### Implementation

```javascript
async executePhase1(userMessage, context) {
  // Run in parallel with Promise.allSettled (doesn't throw on failure)
  const [emotionResult, needsResult, patternResult] = await Promise.allSettled([...]);
  
  // Process results - handle failures gracefully
  results.emotion = this.processKnightResult('emotion', emotionResult);
  results.needs = this.processKnightResult('needs', needsResult);
  results.pattern = this.processKnightResult('pattern', patternResult);
  
  return results; // Returns even if some Knights failed
}

processKnightResult(knightName, result) {
  if (result.status === 'fulfilled') {
    return result.value; // Knight succeeded
  } else {
    console.warn(`⚠️  ${knightName} Knight failed, using degraded signals`);
    return {
      knight: knightName,
      confidence: 0.0,
      signals: this.getDegradedSignalsForKnight(knightName),
      reasoning: `${knightName} Knight failed: ${result.reason?.message}`,
      degraded: true
    };
  }
}
```

### Degraded Signals
Each Knight has default "safe" signals when it fails:

**Emotion Knight Degraded:**
```javascript
{
  sentiment: 0.0,
  mood: 'unknown',
  urgency: 0.3,  // Slightly elevated for caution
  risk: 0.0,
  tone_indicators: [],
  energy_level: 'unknown'
}
```

**Needs Knight Degraded:**
```javascript
{
  stated_intent: 'unknown',
  latent_need: 'unknown',
  learning_intent: 0.5,
  support_needed: [],
  goal_alignment: 0.5,
  exploratory: 0.5,
  needs_confidence: 0.0
}
```

*(Similar for Pattern, Context, Analysis Knights)*

---

## Confidence Scoring

Overall confidence is calculated from all Knights:

```javascript
calculateOverallConfidence(allResults) {
  const confidences = [
    allResults.emotion?.confidence,
    allResults.needs?.confidence,
    allResults.pattern?.confidence,
    allResults.contextKnight?.confidence,
    allResults.analysis?.confidence
  ].filter(c => typeof c === 'number');
  
  if (confidences.length === 0) return 0.0;
  
  // Average confidence, but penalize if any Knights failed
  const avgConfidence = confidences.reduce((sum, c) => sum + c, 0) / confidences.length;
  const successRate = confidences.length / 5; // 5 total Knights
  
  return avgConfidence * successRate;
}
```

**Examples:**
- All 5 Knights succeed with avg confidence 0.75 → Overall: 0.75 * (5/5) = **0.75**
- 4 Knights succeed with avg confidence 0.75, 1 fails → Overall: 0.75 * (4/5) = **0.60**
- 3 Knights succeed with avg confidence 0.80, 2 fail → Overall: 0.80 * (3/5) = **0.48**

---

## Metrics Tracking

The Coordinator tracks performance metrics:

```javascript
{
  totalCalls: 10,
  successfulCalls: 9,
  successRate: 0.9,
  averageExecutionTime: 11500,  // ms
  knightFailures: {
    emotion: 1,
    pattern: 2
  }
}
```

**Usage:**
```javascript
const council = new EvidenceCouncil();

// Run convenes...
await council.convene(message1, context);
await council.convene(message2, context);

// Check metrics
const metrics = council.getMetrics();
console.log(`Success rate: ${(metrics.successRate * 100).toFixed(0)}%`);
console.log(`Avg time: ${metrics.averageExecutionTime.toFixed(0)}ms`);
```

---

## Test Results

### Test Suite: `test-evidence-council.js`

**8/8 Tests Passing** ✅

| Test | Description | Result |
|------|-------------|--------|
| 1 | Full Council Success | ✅ All Knights succeed, confidence 0.75 |
| 2 | Crisis Detection | ✅ Urgency 1.0, Risk 0.9, recommendation: provide_emotional_support |
| 3 | Learning Intent | ✅ Learning intent 0.8, recommendation: invoke_herald_first |
| 4 | Complex Analysis | ✅ Ambiguities detected, complexity: moderate |
| 5 | Signal Structure | ✅ All signal types present and valid |
| 6 | Herald Logic | ✅ Technical → invoke=true, Crisis → invoke=false |
| 7 | Metrics Tracking | ✅ Tracks calls, success rate, timing |
| 8 | Confidence Scoring | ✅ Confidence 0.73-0.75 range |

### Execution Time
- Average: **11-12 seconds** per convene
- Range: 8-17 seconds depending on message complexity
- Phase 1 parallelization saves ~60% time vs sequential

### Sample Test Output

```
🏰 Evidence Council convening...
⚔️  Phase 1: Emotion, Needs, Pattern Knights (parallel)
⚔️  Phase 2: Context Knight (sequential)
⚔️  Phase 3: Analysis Knight (synthesis)
✅ Council complete (11749ms)

Signal Summary:
- Emotion: frustrated (urgency: 0.3)
- Needs: information → guidance
- Pattern: 0 topics, rhythm: single_session
- Context: 3 priorities, novelty: 0.9
- Analysis: invoke_herald_first (herald: true)
```

---

## Real-World Examples

### Example 1: Crisis Situation
**Input:** "I'm having a panic attack and can't breathe. Please help me right now!"

**Phase 1 (Parallel):**
- Emotion Knight: urgency=1.0, risk=0.9, mood="panic"
- Needs Knight: stated_intent="immediate_help", support_needed=["crisis_intervention"]
- Pattern Knight: behavior_trends=[] (no history yet)

**Phase 2 (Sequential):**
- Context Knight: priority=["personal_journal"], novelty=1.0, time_range="recent"

**Phase 3 (Sequential):**
- Analysis Knight: recommendation="provide_emotional_support", herald_invoke=false

**Result:**
- Arthur receives clear directive: Emotional crisis → Coach mode → Do NOT search web
- Confidence: 0.82 (all Knights agree)

---

### Example 2: Technical Learning Question
**Input:** "Can you explain how React hooks work? I'm confused about useEffect dependencies."

**Phase 1 (Parallel):**
- Emotion Knight: mood="frustrated", urgency=0.3
- Needs Knight: stated_intent="information", latent_need="guidance", learning_intent=0.8
- Pattern Knight: recurring_topics=[], conversation_rhythm="single_session"

**Phase 2 (Sequential):**
- Context Knight: priority=["reference_library", "core_knowledge"], novelty=0.9

**Phase 3 (Sequential):**
- Analysis Knight: recommendation="invoke_herald_first", herald_invoke=true

**Result:**
- Arthur receives directive: Novel technical topic → Search web first (Herald)
- Confidence: 0.75 (Knights detect knowledge gap)

---

### Example 3: Complex Multi-Topic
**Input:** "I've been struggling with work stress for weeks, but I'm also excited about learning Python. How should I balance learning with managing my anxiety?"

**Phase 1 (Parallel):**
- Emotion Knight: mood="mixed", urgency=0.5, sentiment=0.3
- Needs Knight: stated_intent="guidance", latent_need="validation", goal_alignment=0.6
- Pattern Knight: recurring_topics=["work-stress", "anxiety"], behavior_trends=["wellness_focus"]

**Phase 2 (Sequential):**
- Context Knight: priority=["personal_journal", "reference_library"], novelty=0.4

**Phase 3 (Sequential):**
- Analysis Knight: 
  - ambiguity_detected=["Dual topic: wellness + learning"]
  - recommendation="guide_problem_solving"
  - herald_invoke=false (has internal context)

**Result:**
- Arthur receives nuanced directive: Balance emotional support (Coach) with learning guidance (Teacher)
- Confidence: 0.73 (moderate due to complexity)

---

## Integration Points

### Current State (Phase 3.3)
```javascript
// Import the coordinator
import EvidenceCouncil from './services/EvidenceCouncil.js';

// Instantiate
const council = new EvidenceCouncil();

// Use in Arthur's pipeline
const result = await council.convene(userMessage, context);

// Access signals
console.log(result.signals.emotion);
console.log(result.signals.analysis.recommendation);
```

### Future Integration (Phase 5)

**Arthur Orchestrator** will receive signals:

```javascript
// In Arthur.js (Phase 5)
async processMessage(userMessage, context) {
  // 1. Convene Evidence Council
  const councilResult = await this.evidenceCouncil.convene(userMessage, context);
  
  // 2. Check if Herald should be invoked
  if (councilResult.signals.analysis.herald_recommendation.invoke) {
    const webResults = await this.herald.search(
      councilResult.signals.analysis.herald_recommendation.search_query
    );
    // Add web results to context...
  }
  
  // 3. Compute Advisory Council weights (Teacher/Coach/Problem Solver)
  const weights = this.computeAdvisoryWeights(councilResult.signals);
  
  // 4. Apply policy rules
  const policy = this.policyEngine.evaluate(councilResult.signals, weights);
  
  // 5. Synthesize final response with GPT-5
  const response = await this.synthesize(
    userMessage,
    councilResult.signals,
    weights,
    policy
  );
  
  return response;
}
```

---

## Knight Dependencies

```
Emotion Knight ─┐
Needs Knight ───┼─→ Context Knight ─→ Analysis Knight
Pattern Knight ─┘
```

- **Emotion, Needs, Pattern:** Independent (Phase 1, parallel)
- **Context:** Depends on Phase 1 (Phase 2, sequential)
- **Analysis:** Depends on all prior Knights (Phase 3, sequential)

---

## Comparison to Individual Knights

| Feature | Individual Knight | Evidence Council |
|---------|------------------|------------------|
| Scope | Single aspect | Unified analysis |
| Dependencies | None | Orchestrated |
| Error Handling | Fail fast | Graceful degradation |
| Execution | Manual | Phased orchestration |
| Signals | Single type | All 5 types + synthesis |
| Confidence | Per-Knight | Overall + per-Knight |
| Metrics | None | Tracks performance |

---

## Performance Characteristics

### Execution Time Breakdown
- Phase 1 (Parallel): ~8-10s (3 Knights running simultaneously)
- Phase 2 (Sequential): ~2-3s (Context Knight)
- Phase 3 (Sequential): ~1-2s (Analysis Knight)
- **Total:** 11-15s average

### Optimization Opportunities
1. **Cache embeddings:** Reuse for repeated messages (future)
2. **Parallel Phase 2+3:** If Librarian provides context instantly (future)
3. **Quick analysis mode:** Pattern-based heuristics before LLM (implemented in Analysis Knight)

---

## What's Next?

### Phase 4: Librarian
**Purpose:** Sole database accessor, fulfills context requests from Context Knight

**Key Methods:**
- `fulfillContextRequests(contextRequests)` - Main entry point
- `searchWithScoring(query, filters)` - Apply 3D relevance scoring
- `calculateRecencyScore(timestamp)` - Exponential time decay
- `calculateFrequencyScore(topic)` - From Pattern Knight topic_frequency
- `calculateVehemenceScore(emotion)` - From Emotion Knight urgency/sentiment/risk

**Integration:**
```javascript
// In Phase 2 of EvidenceCouncil.js
const contextResult = await this.contextKnight.analyze(userMessage, contextInput);

// NEW: Fulfill context requests via Librarian
if (contextResult.signals.context_requests) {
  const retrievedContext = await this.librarian.fulfillContextRequests(
    contextResult.signals.context_requests
  );
  contextResult.signals.retrieved_context = retrievedContext;
}
```

### Phase 4: Herald
**Purpose:** External web search via Tavily API

**Invoked by:** Analysis Knight recommendation

**Integration:**
```javascript
// In Arthur Orchestrator (Phase 5)
if (councilResult.signals.analysis.herald_recommendation.invoke) {
  const webResults = await this.herald.search(
    councilResult.signals.analysis.herald_recommendation.search_query
  );
  // Add to context before final synthesis
}
```

### Phase 5: Arthur Orchestrator
**Purpose:** Final synthesis layer

**Receives:** Evidence Council signals → Computes Advisory weights → Applies policy → Synthesizes with GPT-5

---

## Key Takeaways

✅ **Evidence Council Coordinator orchestrates 5 Knights in phased execution**  
✅ **Phase 1 parallelization reduces execution time by ~60%**  
✅ **Graceful degradation: Knights can fail without breaking the system**  
✅ **Unified signal structure ready for Arthur's consumption**  
✅ **Herald invocation logic: Detects when to search externally**  
✅ **Confidence scoring: Aggregates Knight confidence with failure penalty**  
✅ **Metrics tracking: Monitors performance and failure patterns**  
✅ **All 8 tests passing: Crisis detection, learning intent, complex analysis, etc.**  

---

## Files Created

| File | Purpose | Lines |
|------|---------|-------|
| `backend/services/EvidenceCouncil.js` | Coordinator implementation | 390 |
| `backend/scripts/test-evidence-council.js` | Test suite (8 scenarios) | 450 |
| `EVIDENCE_COUNCIL_COORDINATOR_COMPLETE.md` | Documentation | This file |

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                   ARTHUR ORCHESTRATOR                    │
│              (Final Synthesis with GPT-5)               │
└────────────────────┬────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────────────┐
│              EVIDENCE COUNCIL COORDINATOR                │
│           (Orchestrates Knights in phases)              │
└────────────────────┬────────────────────────────────────┘
                     ↓
        ┌────────────┴────────────┐
        │     Phase 1: Parallel   │
        ├─────────────────────────┤
        │  - Emotion Knight       │
        │  - Needs Knight         │
        │  - Pattern Knight       │
        └────────────┬─────────────┘
                     ↓
        ┌────────────┴────────────┐
        │   Phase 2: Sequential   │
        ├─────────────────────────┤
        │  - Context Knight       │
        │    (requests context)   │
        └────────────┬─────────────┘
                     ↓
        ┌────────────┴────────────┐
        │         LIBRARIAN       │  ← NEXT TO BUILD
        │   (Fulfills requests)   │
        └────────────┬─────────────┘
                     ↓
        ┌────────────┴────────────┐
        │   Phase 3: Sequential   │
        ├─────────────────────────┤
        │  - Analysis Knight      │
        │    (Synthesizes all)    │
        └────────────┬─────────────┘
                     ↓
        ┌────────────┴────────────┐
        │         HERALD          │  ← IF INVOKED
        │   (External Search)     │
        └─────────────────────────┘
```

---

**Status:** ✅ Evidence Council Coordinator COMPLETE  
**Next:** Build Librarian (3D Relevance Scoring + DB Access)

Copyright (c) 2025 Scott Crawford. All rights reserved.
