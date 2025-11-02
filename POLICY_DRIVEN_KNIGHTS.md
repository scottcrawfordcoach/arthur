# Policy-Driven Evidence Council Knights

**Copyright © 2025 Scott Crawford. All rights reserved.**

**Status:** ✅ Implemented  
**Date:** November 1, 2025  
**Impact:** All 5 Evidence Council Knights now use JSON policy configuration

## Overview

The Evidence Council Knights have been refactored from hard-coded analysis patterns to **policy-driven configuration**. Each Knight now loads its behavioral parameters from JSON files in `backend/config/`, enabling rapid iteration and customization without code changes.

## Architecture

### Knight System
Each Knight analyzes user messages through a specific lens:
- **EmotionKnight** - Emotional tone and crisis detection
- **NeedsKnight** - User intent and learning signals
- **PatternKnight** - Communication patterns and engagement
- **ContextKnight** - Conversation state tracking (unchanged)
- **AnalysisKnight** - Synthesis and recommendations

### Policy Files Location
```
backend/config/
├── emotion_policy.json      # EmotionKnight configuration
├── needs_policy.json         # NeedsKnight configuration
├── pattern_policy.json       # PatternKnight configuration
└── analysis_policy.json      # AnalysisKnight configuration (if needed)
```

## Implementation Details

### Loading Mechanism
Each Knight loads its policy in the constructor:

```javascript
constructor() {
  super('EmotionKnight');
  this.policy = this.loadPolicy('emotion_policy.json');
}

loadPolicy(filename) {
  try {
    const policyPath = path.join(__dirname, '../config', filename);
    const policyData = fs.readFileSync(policyPath, 'utf8');
    return JSON.parse(policyData);
  } catch (error) {
    logger.warn(`${this.name}: Failed to load policy ${filename}, using defaults`);
    return {};
  }
}
```

### Defensive Programming Pattern
All policy access uses **optional chaining** and **safe defaults**:

```javascript
// Example: EmotionKnight accessing crisis patterns
const riskKeywords = (policy?.crisis_patterns?.risk_keywords || []).join('|') || 'suicide|kill myself';
const riskPattern = new RegExp(riskKeywords, 'i');

// Example: NeedsKnight accessing intent patterns
const policyIntents = policy?.intent_patterns || {};
const questionMarkers = (policyIntents?.question_markers || []).join('|') || 'how|what|why|when|where';
```

### Key Benefits
1. **Rapid Iteration** - Tune Knight behavior without code changes
2. **A/B Testing** - Easy to compare different policy configurations
3. **User Customization** - Future: Per-user policy overrides
4. **Version Control** - Policy changes tracked separately from code
5. **Fail-Safe** - Graceful fallback to defaults if policy missing

## Policy File Structure

### EmotionKnight Policy (`emotion_policy.json`)
```json
{
  "crisis_patterns": {
    "risk_keywords": ["suicide", "kill myself", "end it all", "no reason to live"],
    "distress_keywords": ["overwhelmed", "can't cope", "falling apart", "too much"]
  },
  "sentiment": {
    "positive_indicators": ["excited", "happy", "grateful", "accomplished"],
    "negative_indicators": ["sad", "frustrated", "anxious", "worried"]
  }
}
```

### NeedsKnight Policy (`needs_policy.json`)
```json
{
  "intent_patterns": {
    "question_markers": ["how", "what", "why", "when", "where", "can you"],
    "learning_indicators": ["learn", "understand", "explain", "teach me"],
    "decision_indicators": ["should I", "what if", "which option", "help me decide"]
  },
  "coaching_signals": {
    "exploration_phrases": ["thinking about", "considering", "wondering if"],
    "action_phrases": ["going to", "planning to", "will", "I'll"]
  }
}
```

### PatternKnight Policy (`pattern_policy.json`)
```json
{
  "engagement_patterns": {
    "short_response_threshold": 20,
    "verbose_response_threshold": 200,
    "follow_up_indicators": ["also", "and", "another thing", "one more"]
  },
  "communication_style": {
    "formal_indicators": ["please", "thank you", "appreciate", "kindly"],
    "casual_indicators": ["hey", "yeah", "gonna", "wanna"]
  }
}
```

## Code Changes

### Files Modified
- `backend/knights/EmotionKnight.js` - 15+ defensive null checks
- `backend/knights/NeedsKnight.js` - 12+ safe policy accesses
- `backend/knights/PatternKnight.js` - 18+ optional chaining additions
- `backend/knights/AnalysisKnight.js` - 10+ safe defaults
- `backend/knights/KnightBase.js` - Added `loadPolicy()` method

### Pattern Example: Before vs After

**Before (Hard-coded):**
```javascript
const riskKeywords = 'suicide|kill myself|end it all|no reason to live';
const riskPattern = new RegExp(riskKeywords, 'i');
```

**After (Policy-driven with safety):**
```javascript
const riskKeywords = (this.policy?.crisis_patterns?.risk_keywords || []).join('|') || 'suicide|kill myself';
const riskPattern = new RegExp(riskKeywords, 'i');
```

## Testing

### Verification Steps
1. ✅ All Knights load successfully without errors
2. ✅ Policy files parsed and applied correctly
3. ✅ Fallback to defaults works when policy missing
4. ✅ Knights produce expected analysis results
5. ✅ No undefined errors or crashes

### Test Commands
```bash
# Check if Knights are loading policies
node backend/scripts/test-knights.js

# Verify policy files are valid JSON
node -e "console.log(require('./backend/config/emotion_policy.json'))"
node -e "console.log(require('./backend/config/needs_policy.json'))"
node -e "console.log(require('./backend/config/pattern_policy.json'))"
```

## Future Enhancements

### Phase 1 (Current) ✅
- [x] Extract all Knight patterns to JSON policies
- [x] Implement safe policy loading
- [x] Add defensive null checks throughout

### Phase 2 (Planned)
- [ ] Per-user policy overrides in database
- [ ] Policy versioning and rollback
- [ ] Admin UI for policy editing
- [ ] Policy validation schema

### Phase 3 (Proposed)
- [ ] A/B testing framework for policies
- [ ] ML-driven policy optimization
- [ ] Community policy marketplace
- [ ] Domain-specific policy templates (coaching, therapy, tutoring, etc.)

## Related Documentation
- [Evidence Council Architecture](./ADVISORY_COUNCIL_EXPLAINED.md)
- [Knight System Design](./backend/knights/README.md)
- [ICF Coaching Integration](./ARTHUR_INTEGRATION_COMPLETE.md)

## Maintenance Notes

### Adding New Policy Parameters
1. Update the policy JSON file with new fields
2. Add safe access in Knight code: `policy?.section?.field || defaultValue`
3. Document the new parameter in this file
4. Test with and without the new parameter

### Debugging Policy Issues
```javascript
// In Knight constructor, log loaded policy:
logger.info(`${this.name} loaded policy:`, JSON.stringify(this.policy, null, 2));

// Check specific policy values:
logger.debug(`Risk keywords: ${this.policy?.crisis_patterns?.risk_keywords}`);
```

### Performance Considerations
- Policies loaded once at Knight instantiation (not per message)
- Policy changes require server restart (or implement hot-reload)
- JSON parsing overhead negligible (~1ms per Knight)

---

**Contributors:** Scott Crawford, AI Assistant  
**Last Updated:** November 1, 2025
