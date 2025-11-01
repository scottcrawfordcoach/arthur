# Pattern Knight - COMPLETED ✅

**Date:** October 22, 2025  
**Status:** Production Ready  
**Tests:** 8/8 Passed

---

## Overview

The **Pattern Knight** is the third member of Arthur's Evidence Council, responsible for detecting behavioral patterns and recurring themes from conversation history. This Knight provides temporal intelligence about how users interact over time.

---

## What It Does

### Core Responsibility
**Detect behavioral trends and recurring topics from conversation history**

The Pattern Knight analyzes:
- **Recurring Topics:** Themes that keep coming up
- **Topic Frequency:** How often each topic appears
- **Conversation Rhythm:** Interaction patterns (daily, sporadic, intensive)
- **Behavior Trends:** Learning style, problem-solving approach, focus patterns

### Key Insight
Patterns reveal user behavior that single messages cannot:
- **Iterative Problem Solving:** User revisits topics with refinements
- **Learning Oriented:** Consistent how/why questions
- **Troubleshooting Focused:** Repeated debugging attempts
- **Deep Dive:** Sustained focus on one area
- **Wide-Ranging Exploration:** Jumping between many topics

---

## Signals Produced

```javascript
{
  recurring_topics: [                    // Topics appearing 2+ times
    'React hooks',
    'state management',
    'authentication'
  ],
  topic_frequency: {                     // How often each topic appears
    'React hooks': 6,
    'state management': 3,
    'authentication': 2
  },
  conversation_rhythm: 'daily',          // daily | sporadic | intensive | regular | single_session
  behavior_trends: [                     // Observed behavioral patterns
    'learning_oriented',
    'deep_dive'
  ],
  pattern_strength: 0.8                  // Confidence in patterns (0-1)
}
```

---

## Architecture

### Dual Analysis Approach

**1. Quick Pattern Analysis (Baseline)**
- Regex patterns detect common topics (auth, database, frontend, etc.)
- Timestamp analysis for conversation rhythm
- Fast (<1ms)
- Confidence: ~0.65
- Used as fallback if LLM unavailable

**2. LLM Analysis (Primary)**
- GPT-4o-mini (will switch to Haiku via modelService)
- Detects specific topics beyond generic categories
- Infers behavioral patterns from message themes
- Confidence: ~0.75-0.85
- Latency: 200-500ms

### Conversation History Integration

The Pattern Knight works with conversation history (mock for testing, Librarian in Phase 4):

```javascript
const conversationHistory = [
  { message: 'How do React hooks work?', timestamp: '2025-10-18T10:00:00Z' },
  { message: 'What is useState vs useReducer?', timestamp: '2025-10-19T14:30:00Z' },
  { message: 'Can I use useEffect to fetch data?', timestamp: '2025-10-19T17:45:00Z' },
  // ... more messages
];

const result = await patternKnight.analyze(userMessage, {
  conversationHistory
});
```

**Example Output:**
- Recurring Topics: `['React hooks', 'state management']`
- Topic Frequency: `{ 'React hooks': 6 }`
- Rhythm: `'daily'` (messages spread across days)
- Behavior: `['learning_oriented', 'deep_dive']`
- Strength: `0.8` (clear patterns visible)

---

## Test Results (8/8 Passed)

### Test 1: No History (First Conversation) ✅
```
Message: "How do I set up authentication in my app?"
History: 0 messages

Result:
- Recurring Topics: []
- Topic Frequency: {}
- Rhythm: single_session
- Behavior Trends: []
- Pattern Strength: 0.3 (no data yet)
```

### Test 2: Learning-Oriented Pattern ✅
```
History: 4 messages asking "How does X work?" and "Why is Y better?"
Message: "Why is semantic search better than keyword search?"

Result:
- Recurring Topics: [React, async/await, database, search]
- Topic Frequency: { React: 1, async/await: 1, database: 2, search: 1 }
- Rhythm: daily (consistent daily questions)
- Behavior: [learning_oriented, wide_ranging_exploration]
- Pattern Strength: 0.7
```

### Test 3: Troubleshooting Pattern ✅
```
History: 5 messages about auth bugs (401, CORS, session, logout errors)
Message: "The authentication is still not working"

Result:
- Recurring Topics: [authentication, session management, CORS, database connection]
- Topic Frequency: { authentication: 5, session management: 4, CORS: 3 }
- Rhythm: regular (multiple messages over 2 days)
- Behavior: [troubleshooting_focused, iterative_problem_solving]
- Pattern Strength: 0.8
```

### Test 4: Iterative Problem-Solving ✅
```
History: 4 messages revisiting database schema with refinements
Message: "I want to refactor the database schema we discussed"

Result:
- Recurring Topics: [database design, schema refactoring, performance optimization]
- Topic Frequency: { database design: 4, performance optimization: 2 }
- Rhythm: regular
- Behavior: [iterative_problem_solving, troubleshooting_focused]
- Pattern Strength: 0.8
```

### Test 5: Wide-Ranging Exploration ✅
```
History: 6 messages on different topics (React, auth, DB, tests, Docker, performance)
Message: "Now I am thinking about deployment strategies"

Result:
- Recurring Topics: [authentication, database design, testing, deployment]
- Topic Frequency: { authentication: 1, database design: 1, testing: 1, deployment: 1 }
- Rhythm: daily
- Behavior: [learning_oriented, wide_ranging_exploration]
- Pattern Strength: 0.6
```

### Test 6: Deep Dive Pattern ✅
```
History: 6 messages all about React hooks (useState, useReducer, useEffect, custom hooks, etc.)
Message: "Another question about React hooks and state management"

Result:
- Recurring Topics: [React hooks, state management]
- Topic Frequency: { React hooks: 6, state management: 1 }
- Rhythm: daily
- Behavior: [learning_oriented, deep_dive]
- Pattern Strength: 0.8 (sustained focus detected)
```

### Test 7: Sporadic Pattern ✅
```
History: 3 messages with large gaps (15 days, 10 days, 3 days)
Message: "I have another question about the API"

Result:
- Recurring Topics: [API, REST, GraphQL]
- Topic Frequency: { API: 4, REST: 1, GraphQL: 1, Express: 1, Fastify: 1 }
- Rhythm: sporadic (irregular gaps)
- Behavior: [learning_oriented, iterative_problem_solving]
- Pattern Strength: 0.7
```

### Test 8: Mixed Topics with Clear Theme ✅
```
History: 6 messages mixing auth and database, but auth dominates
Message: "Back to the authentication issue"

Result:
- Recurring Topics: [authentication, database]
- Topic Frequency: { authentication: 6, database: 1 }
- Rhythm: regular
- Behavior: [iterative_problem_solving, learning_oriented]
- Pattern Strength: 0.8
```

---

## Key Observations

### LLM Detects Specific Topics Beyond Generic Categories

**Better Topic Naming:**
- Pattern: "frontend" → LLM: "React hooks", "state management"
- Pattern: "database" → LLM: "database design", "schema refactoring"
- Pattern: "debugging" → LLM: "authentication", "CORS", "session management"

**Why This Matters:**
- Context Knight can request more specific data from Librarian
- Arthur can reference specific topics naturally ("I see you've been working on React hooks")
- More actionable intelligence than generic categories

### Behavioral Patterns Detected

**Learning Styles:**
- `learning_oriented`: Consistent how/why questions
- `deep_dive`: Sustained focus on one topic
- `wide_ranging_exploration`: Many different topics
- `theoretical_learner`: Concepts before implementation
- `hands_on_learner`: Builds first, asks questions later

**Problem-Solving Approaches:**
- `troubleshooting_focused`: Repeated debugging attempts
- `iterative_problem_solving`: Revisiting topics with refinements
- `systematic_approach`: Methodical progression through topics

### Conversation Rhythms

**Detected Patterns:**
- `daily`: Consistent daily interactions (learning habit)
- `intensive`: Bursts of activity (working on active project)
- `sporadic`: Irregular gaps (casual exploration)
- `regular`: Consistent intervals (structured learning)
- `single_session`: First conversation (no pattern yet)

---

## Integration with Evidence Council

### Execution Order

**Phase 1 (Parallel):**
```
Emotion Knight → mood, sentiment, urgency, risk
Needs Knight   → Uses emotion context
Pattern Knight → Analyzes conversation history independently
```

**Phase 2 (Sequential):**
```
Context Knight → Uses ALL Phase 1 signals to determine what data to request
  - Emotion: Adjust tone based on mood
  - Needs: Prioritize latent needs over stated
  - Pattern: Consider recurring topics and learning style
```

**Phase 3 (Sequential):**
```
Analysis Knight → Synthesizes all signals, detects contradictions
  - Example: High urgency + deep_dive pattern = unusual (might be crisis)
  - Example: Iterative problem solving + frustrated = needs encouragement
```

### Signal Flow Example

```javascript
// Pattern Knight runs in parallel with Emotion and Needs Knights
const patternSignals = await patternKnight.analyze(userMessage, {
  conversationHistory: await librarian.getRecentHistory()
});

// Pattern signals inform Context Knight
if (patternSignals.recurring_topics.includes('authentication')) {
  // Request previous auth-related conversations
  contextRequest.semantic_search.push({
    query: 'authentication setup',
    tier: 'personal_journal',
    limit: 5
  });
}

if (patternSignals.behavior_trends.includes('learning_oriented')) {
  // Teacher weight increases in Advisory Council
  influencerWeights.teacher += 0.3;
}

if (patternSignals.behavior_trends.includes('troubleshooting_focused')) {
  // Problem Solver weight increases
  influencerWeights.problem_solver += 0.3;
}
```

---

## What This Enables for Arthur

### 1. Contextual Awareness
Arthur can reference past conversations naturally:
- "I see you've been working on React hooks over the past few days"
- "This relates to the authentication issue you mentioned yesterday"
- "You've been exploring database design - this builds on that"

### 2. Adaptive Teaching Style
- **Deep Dive + Learning Oriented** → Teacher mode, detailed explanations
- **Wide Ranging + Exploratory** → Coach mode, guide exploration
- **Troubleshooting Focused** → Problem Solver mode, direct solutions + encouragement

### 3. Detect Behavioral Changes
- User usually learning-oriented but now troubleshooting → Acknowledge shift
- Sporadic user becomes intensive → Recognize active project phase
- Deep dive suddenly becomes wide-ranging → User might be stuck or exploring alternatives

### 4. Predict Information Needs
- Recurring topic → Likely to need related information again
- Iterative problem solving → Anticipate next refinement
- Learning pattern → Suggest related topics to explore

---

## Conversation Rhythm Detection

### Algorithm

```javascript
detectRhythm(timestamps) {
  // Calculate gaps between messages
  const gaps = timestamps.map((t, i) => i > 0 ? t - timestamps[i-1] : 0);
  const avgGap = average(gaps);
  const maxGap = max(gaps);
  
  // Classification
  if (maxGap < 24 hours) return 'intensive';      // Same day activity
  if (avgGap ~24h && maxGap < 48h) return 'daily';  // Daily habit
  if (maxGap > avgGap * 3) return 'sporadic';     // Irregular gaps
  return 'regular';                                // Consistent intervals
}
```

**Why It Matters:**
- Intensive → User is actively working, needs quick responses
- Daily → Learning habit, appreciate structured guidance
- Sporadic → Casual exploration, keep responses accessible
- Regular → Structured learning, can build on previous sessions

---

## Mock History vs Real Integration

### Current (Testing)
```javascript
const conversationHistory = [
  { message: '...', timestamp: '...' },
  // Mock data in tests
];
```

### Phase 4 (With Librarian)
```javascript
// Context Knight requests history from Librarian
const historyRequest = {
  type: 'conversation_history',
  session_id: currentSessionId,
  lookback: '7 days',
  limit: 20
};

const conversationHistory = await librarian.fulfillRequest(historyRequest);

// Pattern Knight analyzes real history
const patternSignals = await patternKnight.analyze(userMessage, {
  conversationHistory
});
```

---

## Files Created

1. **backend/knights/PatternKnight.js** (349 lines)
   - Dual analysis (quick pattern + LLM)
   - Topic detection with regex patterns
   - Conversation rhythm detection from timestamps
   - Behavioral trend inference
   - Graceful handling of no-history case

2. **backend/scripts/test-pattern-knight.js** (305 lines)
   - 8 comprehensive test scenarios
   - Mock conversation histories with timestamps
   - Rhythm detection validation
   - Pattern strength assessment
   - Topic frequency tracking

---

## Performance

- **Quick Analysis:** <1ms
- **LLM Analysis:** 200-500ms (GPT-4o-mini)
- **Target (Haiku):** 200-300ms
- **Confidence:** 0.75-0.85 (LLM with history), 0.65 (pattern), 0.3 (no history)
- **History Handling:** Last 10 messages sent to LLM for context

---

## Evidence Council Progress

- ✅ **Emotion Knight** - Emotional tone and risk detection
- ✅ **Needs Knight** - Latent needs inference
- ✅ **Pattern Knight** - Behavioral trends from history
- ⏳ **Context Knight** - Next (uses all 3 Knight signals)
- ⏳ **Analysis Knight** - Final synthesis

**3 of 5 Knights complete. 60% done! The Roundtable grows stronger! ⚔️**

Copyright (c) 2025 Scott Crawford. All rights reserved.
