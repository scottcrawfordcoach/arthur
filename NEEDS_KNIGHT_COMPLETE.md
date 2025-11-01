# Needs Knight - COMPLETED ✅

**Date:** October 22, 2025  
**Status:** Production Ready  
**Tests:** 8/8 Passed

---

## Overview

The **Needs Knight** is the second member of Arthur's Evidence Council, responsible for determining what users actually need versus what they explicitly ask for. This Knight provides critical intelligence for Arthur to respond appropriately.

---

## What It Does

### Core Responsibility
**Infer latent needs from user messages and emotional context**

The Needs Knight distinguishes between:
- **Stated Intent:** What the user explicitly asked for
- **Latent Need:** What the user actually needs (often different)

### Key Insight
People rarely ask for what they truly need:
- "What should I do?" → **Stated:** guidance, **Latent:** validation (seeking reassurance)
- "I'm stuck on this bug" → **Stated:** problem_solving, **Latent:** emotional_support (frustrated)
- "How does this work?" → **Stated:** information, **Latent:** information (genuine learning)
- "Am I doing this right?" → **Stated:** validation, **Latent:** emotional_support (self-doubt)

---

## Signals Produced

```javascript
{
  stated_intent: 'validation',           // What they asked for
  latent_need: 'emotional_support',      // What they actually need
  learning_intent: 0.4,                  // Want to learn (0.8-1.0) vs get answer (0.0-0.3)
  support_needed: [                      // Types of support that would help
    'emotional_support',
    'validation',
    'guidance'
  ],
  goal_alignment: 0.7,                   // Working toward goals (0.7-1.0) vs exploring (0.0-0.3)
  exploratory: 0.3,                      // Open-ended (0.8-1.0) vs specific task (0.0-0.3)
  needs_confidence: 0.9                  // Confidence in assessment (0-1)
}
```

---

## Architecture

### Dual Analysis Approach

**1. Quick Pattern Analysis (Baseline)**
- Regex patterns detect common intent keywords
- Fast (<1ms)
- Confidence: ~0.65
- Used as fallback if LLM unavailable

**2. LLM Analysis (Primary)**
- GPT-4o-mini (will switch to Haiku via modelService)
- Uses emotional context from Emotion Knight
- Detects subtle needs and contradictions
- Confidence: ~0.9
- Latency: 200-500ms

### Integration with Emotion Knight

The Needs Knight receives emotional context to make better assessments:

```javascript
const result = await needsKnight.analyze(userMessage, {
  emotion: {
    mood: 'anxious',
    sentiment: -0.5,
    urgency: 0.6,
    risk: 0.4
  }
});
```

**Example:** If user says "Is this right?" with anxious mood, the Needs Knight infers they need emotional support + validation, not just information.

---

## Test Results (8/8 Passed)

### Test 1: Information Seeking (Genuine Learning) ✅
```
Message: "How does semantic search work with embeddings?"
Emotion: curious (sentiment: 0.5)

Result:
- Stated: information
- Latent: exploration (LLM detected deeper curiosity)
- Learning Intent: 0.8 (high - wants to understand)
- Support: information, guidance
- Exploratory: 0.8 (open-ended learning)
```

### Test 2: Seeking Validation ✅
```
Message: "Is this the right way to structure my database schema?"
Emotion: anxious (sentiment: 0.0)

Result:
- Stated: validation
- Latent: emotional_support (LLM detected anxiety)
- Learning Intent: 0.4 (medium)
- Support: validation, emotional_support, guidance
- Exploratory: 0.3 (specific concern)
```

### Test 3: Stuck and Frustrated ✅
```
Message: "I'm stuck on this bug and I can't figure out what's wrong"
Emotion: frustrated (sentiment: -0.6)

Result:
- Stated: problem_solving
- Latent: emotional_support (needs encouragement)
- Learning Intent: 0.3 (low - wants it fixed)
- Support: emotional_support, guidance, problem_solving
- Exploratory: 0.2 (specific problem)
```

### Test 4: Lost and Seeking Guidance ✅
```
Message: "I don't know where to start with this project"
Emotion: overwhelmed (sentiment: -0.4)

Result:
- Stated: guidance
- Latent: emotional_support (overwhelmed needs reassurance)
- Learning Intent: 0.4
- Support: emotional_support, guidance, encouragement
- Exploratory: 0.6 (broad exploration)
```

### Test 5: Exploratory Thinking ✅
```
Message: "I wonder if there are better ways to handle user authentication"
Emotion: curious (sentiment: 0.3)

Result:
- Stated: information
- Latent: exploration
- Learning Intent: 0.7 (wants to understand options)
- Support: information, guidance
- Exploratory: 0.8 (open-ended)
```

### Test 6: Quick Answer Needed ✅
```
Message: "What is the command to restart the server?"
Emotion: neutral (sentiment: 0.0)

Result:
- Stated: information
- Latent: information (straightforward)
- Learning Intent: 0.2 (low - just needs answer)
- Support: information
- Exploratory: 0.1 (very specific)
```

### Test 7: Goal-Oriented ✅
```
Message: "I'm trying to implement the authentication flow you suggested"
Emotion: focused (sentiment: 0.4)

Result:
- Stated: guidance
- Latent: problem_solving
- Learning Intent: 0.6
- Support: guidance, validation, encouragement
- Goal Alignment: 0.8 (high - working toward goal)
- Exploratory: 0.3
```

### Test 8: Self-Doubt Needing Encouragement ✅
```
Message: "Am I doing this right? I feel like I keep making mistakes"
Emotion: anxious (sentiment: -0.5)

Result:
- Stated: guidance
- Latent: emotional_support (self-doubt)
- Learning Intent: 0.3
- Support: emotional_support, validation, guidance
- Goal Alignment: 0.7
- Exploratory: 0.3
```

---

## Key Observations

### LLM Detects Nuances Pattern Matching Misses

**1. Anxiety → Need for Emotional Support**
- Pattern: "Is this right?" = validation
- LLM: Detects anxious mood → latent need is emotional_support

**2. Curiosity → Exploration vs Information**
- Pattern: "How does X work?" = information
- LLM: Detects open-ended curiosity → latent need is exploration

**3. Frustration → Emotional Support Before Problem Solving**
- Pattern: "I'm stuck" = problem_solving
- LLM: Detects frustration → needs encouragement before solution

**4. Self-Doubt → Multi-layered Support**
- Pattern: "Am I doing this right?" = validation
- LLM: Detects self-doubt → needs emotional_support, validation, guidance together

### Why This Matters for Arthur

The Needs Knight enables Arthur to:

1. **Respond to actual needs, not just stated questions**
   - User asks "What should I do?" → Arthur provides validation + guidance (not just options)

2. **Adjust tone based on emotional + need state**
   - Anxious + seeking validation → Warm, reassuring response
   - Curious + exploratory → Educational, thought-provoking response
   - Frustrated + stuck → Encouraging, then problem-solving

3. **Balance Advisory Council weights appropriately**
   - High learning_intent → More Teacher
   - Need validation → More Coach
   - Low learning_intent → More Problem Solver

4. **Detect contradictions for Analysis Knight**
   - High urgency + high learning_intent = tension (learning takes time)
   - Analysis Knight will flag this and recommend immediate tactical + long-term learning

---

## Integration with Evidence Council

### Execution Order

**Phase 1 (Parallel):**
```
Emotion Knight → mood, sentiment, urgency, risk
Needs Knight   → Uses emotion context for deeper analysis
Pattern Knight → recurring topics, behavior trends
```

**Phase 2 (Sequential):**
```
Context Knight → Uses all Phase 1 signals to determine what data to request
```

**Phase 3 (Sequential):**
```
Analysis Knight → Synthesizes all signals, detects contradictions, recommends actions
```

### Signal Flow Example

```javascript
// Emotion Knight runs first (parallel with Pattern Knight)
const emotionSignals = {
  mood: 'anxious',
  sentiment: -0.4,
  urgency: 0.7,
  risk: 0.3
};

// Needs Knight uses emotion context
const needsSignals = await needsKnight.analyze(userMessage, {
  emotion: emotionSignals
});

// Result: Detects latent need for emotional_support due to anxiety
// Arthur will respond with warmth + reassurance before providing information
```

---

## What's Next

### Immediate: Pattern Knight
- Detect behavioral trends from conversation history
- Identify recurring topics and patterns
- Complement Needs Knight with historical context

### Then: Context Knight
- Use signals from Emotion + Needs + Pattern Knights
- Determine what context to REQUEST from Librarian
- Prioritize relevant data retrieval

### Finally: Analysis Knight
- Synthesize all signals
- Detect contradictions (e.g., urgency + learning intent)
- Recommend whether Herald should search web
- Provide final signal set to Arthur

---

## Files Created

1. **backend/knights/NeedsKnight.js** (287 lines)
   - Dual analysis (quick pattern + LLM)
   - Emotion context integration
   - Graceful fallback
   - Signal validation

2. **backend/scripts/test-needs-knight.js** (254 lines)
   - 8 comprehensive test cases
   - Emotion context simulation
   - Schema validation
   - Expectation checking with nuance detection

---

## Performance

- **Quick Analysis:** <1ms
- **LLM Analysis:** 200-500ms (GPT-4o-mini)
- **Target (Haiku):** 200-300ms
- **Confidence:** 0.9 (LLM), 0.65 (pattern)
- **Accuracy:** 8/8 tests passed, often detecting needs deeper than expected

---

## Evidence Council Progress

- ✅ **Emotion Knight** - Emotional tone and risk detection
- ✅ **Needs Knight** - Latent needs inference
- ⏳ **Pattern Knight** - Next
- ⏳ **Context Knight** - After Pattern
- ⏳ **Analysis Knight** - Final synthesis

**2 of 5 Knights complete. The Roundtable is taking shape! ⚔️**
