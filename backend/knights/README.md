# Evidence Council Knights

Following the **ARTHUR_STRATEGY_v3** Roundtable Architecture.

## Directory Structure

```
backend/knights/
├── KnightBase.js           # Base class for all Knights
├── signalsSchema.js        # Signal definitions and validation
├── EmotionKnight.js        # [TODO] Analyzes tone and affect
├── NeedsKnight.js          # [TODO] Determines latent intent
├── PatternKnight.js        # [TODO] Detects behavioral trends
├── ContextKnight.js        # [TODO] Requests context from Librarian
├── AnalysisKnight.js       # [TODO] Synthesizes all signals
└── README.md               # This file
```

## Knight Hierarchy

All Knights extend `KnightBase` and implement the `analyze()` method.

### Execution Order

**Phase 1 (Parallel):**
- Pattern Knight
- Emotion Knight  
- Needs Knight

**Phase 2 (Sequential):**
- Context Knight (uses signals from Phase 1)

**Phase 3 (Sequential):**
- Analysis Knight (synthesizes all signals)

## Knight Interface

```javascript
class MyKnight extends KnightBase {
  constructor() {
    super('MyKnight', { enabled: true });
  }

  async analyze(userMessage, context) {
    // Knight-specific analysis logic
    const signals = {
      // Knight-specific signals
    };

    return this.createResult(
      signals,
      0.85, // confidence
      'Why these signals were generated'
    );
  }
}
```

## Standard Output Format

All Knights produce:

```javascript
{
  knightName: 'PatternKnight',
  confidence: 0.85,        // 0.0 - 1.0
  signals: {
    // Knight-specific signals (validated against schema)
  },
  reasoning: "Why these signals were generated",
  timestamp: "2025-10-22T10:30:00Z"
}
```

## Signal Types

See `signalsSchema.js` for complete signal definitions.

### Pattern Knight Signals
- `recurring_topics` - List of recurring conversation topics
- `topic_frequency` - Frequency distribution of topics
- `conversation_rhythm` - Pattern of user interaction timing
- `behavior_trends` - Detected behavioral trends
- `pattern_strength` - Confidence in detected patterns

### Emotion Knight Signals
- `sentiment` - Overall sentiment (-1.0 to +1.0)
- `mood` - Detected emotional state
- `urgency` - Urgency level (0.0 to 1.0)
- `risk` - Risk assessment (0.0 to 1.0)
- `tone_indicators` - List of detected tone markers
- `energy_level` - Detected energy level

### Needs Knight Signals
- `stated_intent` - What user explicitly asked for
- `latent_need` - What user might actually need
- `learning_intent` - Wants to learn vs just get answer
- `support_needed` - Type of support needed
- `goal_alignment` - Alignment with user's known goals
- `exploratory` - Exploring vs focused question
- `needs_confidence` - Confidence in needs assessment

### Context Knight Signals
- `context_requests` - Structured requests for Librarian
- `context_priority` - Order of context importance
- `novelty` - How much new info vs known topics

### Analysis Knight Signals
- `synthesized_signals` - Merged signals from all Knights
- `herald_recommendation` - Whether to invoke Herald (web search)
- `ambiguity_detected` - Whether user message is ambiguous
- `knowledge_gaps` - Identified gaps in knowledge
- `confidence` - Overall confidence in analysis
- `recommendation` - High-level recommendation for Arthur

## Key Principles

### 1. Knights Don't Access Data Directly
- Only **Librarian** has database access
- Context Knight **requests** data, doesn't fetch it
- Enforces separation of concerns and security

### 2. Signals Are the Language
- Knights produce signals (JSON objects)
- Arthur consumes signals to make decisions
- Signals are logged for learning (Phase 6)

### 3. Graceful Degradation
- Knights handle errors internally
- Failed Knights return zero-confidence results
- Evidence Council continues with partial signals

### 4. Schema Validation
- All signals validated against `signalsSchema.js`
- Invalid signals logged as warnings
- Ensures consistent data format for Arthur

## Testing

Test individual Knights:
```bash
node backend/scripts/test-emotion-knight.js
node backend/scripts/test-needs-knight.js
node backend/scripts/test-pattern-knight.js
node backend/scripts/test-context-knight.js
node backend/scripts/test-analysis-knight.js
```

Test Evidence Council integration:
```bash
node backend/scripts/test-evidence-council.js
```

## Development Status

- [x] **Phase 3.1:** Knight Base Infrastructure ✅
  - [x] KnightBase.js
  - [x] signalsSchema.js
  - [x] Test infrastructure
  
- [ ] **Phase 3.2:** Individual Knights
  - [ ] EmotionKnight.js (simplest - start here)
  - [ ] NeedsKnight.js
  - [ ] PatternKnight.js
  - [ ] ContextKnight.js
  - [ ] AnalysisKnight.js

- [ ] **Phase 3.3:** Evidence Council Coordinator
  - [ ] EvidenceCouncil.js (orchestrates all Knights)

## Next Steps

1. Build EmotionKnight (simplest - single message analysis)
2. Build NeedsKnight (uses Emotion signals)
3. Build PatternKnight (requires conversation history)
4. Build ContextKnight (uses signals from all others)
5. Build AnalysisKnight (synthesizes everything)
6. Build EvidenceCouncil coordinator

---

**Following ARTHUR_STRATEGY_v3 Roundtable Architecture**
