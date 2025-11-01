# ARTHUR Policy System

**Version**: 1.0.0  
**Status**: ✅ Complete & Tested (8/8 Arthur tests passing)  
**Created**: 2025-10-22

---

## Overview

The ARTHUR system now uses **externalized JSON policy files** to configure all behavior, making the system:
- ✅ **Tunable without code changes** - modify JSON policies and see results immediately
- ✅ **Hot-reload enabled** - policies can be updated while system runs (development mode)
- ✅ **Version-controlled** - all configurations tracked in Git
- ✅ **A/B testable** - swap policy files to test different behaviors
- ✅ **Auditable** - policy changes are explicit and documented

---

## Policy Files

### Location
All policy files are in **`backend/config/`**:

```
backend/config/
├── influencer_policy.json   (191 lines) - Advisory Council weights & boosters
├── librarian_policy.json    (153 lines) - 3D scoring & retention
├── herald_policy.json        (138 lines) - Search policies & privacy
└── signals_schema.json       (263 lines) - Evidence Council signal types
```

### Policy Loader
**`backend/utils/policyLoader.js`** (207 lines):
- Centralized policy loading with validation
- Hot-reload support via `fs.watch()`
- Singleton pattern for global access
- Default fallback policies if files missing

---

## 1. Influencer Policy (`influencer_policy.json`)

**Purpose**: Define how Arthur computes **Advisory Council** weights (Teacher, Coach, Problem Solver)

### Structure

```json
{
  "version": "1.0.0",
  "base_weights": {
    "teacher": 0.33,
    "coach": 0.33,
    "problemSolver": 0.34
  },
  "teacher": {
    "boosters": [
      {
        "signal": "needs.learning_intent",
        "condition": "> 0.7",
        "boost": 0.3,
        "reason": "User explicitly wants to learn"
      }
    ]
  },
  "crisis_override": {
    "enabled": true,
    "conditions": [
      { "signal": "emotion.urgency", "condition": "> 0.85" },
      { "signal": "needs.support_needed", "condition": "length > 0" }
    ],
    "logic": "AND",
    "forced_weights": {
      "teacher": 0.15,
      "coach": 0.70,
      "problemSolver": 0.15
    }
  },
  "response_modes": {
    "teacher_mode_threshold": 0.5,
    "coach_mode_threshold": 0.5,
    "problem_solver_mode_threshold": 0.5,
    "crisis_urgency_threshold": 0.85
  }
}
```

### Booster Condition Syntax

**Supported operators:**
- `"> 0.7"` - Greater than
- `"< 0.5"` - Less than
- `"== 'value'"` - Equals (string)
- `"in ['val1', 'val2']"` - In array
- `"length > 0"` - Array/string length check

**Signal paths** use dot notation:
- `"needs.learning_intent"` → `signals.needs.learning_intent`
- `"emotion.urgency"` → `signals.emotion.urgency`

### Tuning Examples

**Make system more empathetic:**
```json
"base_weights": {
  "teacher": 0.25,
  "coach": 0.50,  // Increased from 0.33
  "problemSolver": 0.25
}
```

**Lower crisis threshold:**
```json
"crisis_urgency_threshold": 0.75  // Was 0.85, now triggers earlier
```

**Add new teacher booster:**
```json
{
  "signal": "needs.info_gaps",
  "condition": "length > 3",
  "boost": 0.2,
  "reason": "User has many knowledge gaps"
}
```

---

## 2. Librarian Policy (`librarian_policy.json`)

**Purpose**: Configure **3D relevance scoring** (Semantic + Recency + Frequency + Vehemence) and retention

### Structure

```json
{
  "version": "1.0.0",
  "3d_scoring": {
    "weights": {
      "semantic": 0.40,
      "recency": 0.25,
      "frequency": 0.20,
      "vehemence": 0.15
    },
    "recency": {
      "half_life_days": 30,
      "decay_rate": 1.0
    },
    "frequency": {
      "max_references": 100,
      "log_scale": true
    },
    "vehemence": {
      "weights": {
        "urgency": 0.5,
        "sentiment": 0.3,
        "risk_level": 0.2
      }
    }
  },
  "retention": {
    "compression_threshold_days": 90,
    "archive_threshold_days": 365,
    "deletion_threshold_days": 730,
    "deletion_enabled": false,
    "summary_token_limit": 200
  }
}
```

### Tuning Examples

**Prioritize recency over semantics:**
```json
"weights": {
  "semantic": 0.30,  // Decreased from 0.40
  "recency": 0.35,   // Increased from 0.25
  "frequency": 0.20,
  "vehemence": 0.15
}
```

**Age memories faster:**
```json
"recency": {
  "half_life_days": 15,  // Was 30 - memories fade faster
  "decay_rate": 1.0
}
```

**Compress memories sooner:**
```json
"compression_threshold_days": 60  // Was 90
```

---

## 3. Herald Policy (`herald_policy.json`)

**Purpose**: Control **web search** behavior, privacy, and content filtering

### Structure

```json
{
  "version": "1.0.0",
  "budgets": {
    "daily_search_limit": 100,
    "monthly_search_limit": 3000,
    "cost_per_search": 0.001,
    "monthly_budget": 10
  },
  "privacy": {
    "sanitize_queries": true,
    "log_searches": true,
    "pii_categories": [
      "names", "locations", "ages", "phone_numbers",
      "email_addresses", "financial_info"
    ]
  },
  "content_filtering": {
    "blocked_keywords": ["illegal", "harmful", "explicit"],
    "blocked_domains": ["malware-site.com", "spam-site.com"],
    "allowed_domains": [],
    "allowlist_mode": false
  },
  "trust_scoring": {
    "base_score": 0.5,
    "trusted_domains": [
      "wikipedia.org", "github.com", ".edu", ".gov"
    ],
    "trust_boost": 0.3
  }
}
```

### Tuning Examples

**Increase daily search limit:**
```json
"daily_search_limit": 200  // Was 100
```

**Enable allowlist mode (only trusted domains):**
```json
"allowlist_mode": true,
"allowed_domains": [
  "wikipedia.org", "github.com", "stackoverflow.com",
  ".edu", ".gov", ".org"
]
```

**Add blocked keywords:**
```json
"blocked_keywords": [
  "illegal", "harmful", "explicit",
  "conspiracy", "misinformation"
]
```

---

## 4. Signals Schema (`signals_schema.json`)

**Purpose**: Formalize **Evidence Council** signal types and validation rules

### Structure

```json
{
  "version": "1.0.0",
  "signals": {
    "emotion": {
      "urgency": { "type": "float", "range": [0, 1] },
      "sentiment": { 
        "type": "enum", 
        "values": ["negative", "neutral", "positive"] 
      },
      "risk_level": { 
        "type": "enum", 
        "values": ["none", "low", "moderate", "high", "critical"] 
      }
    },
    "needs": {
      "stated_intent": { 
        "type": "enum", 
        "values": ["informational", "emotional_support", "problem_solving"] 
      },
      "learning_intent": { "type": "float", "range": [0, 1] }
    }
  },
  "validation_rules": {
    "required_fields": ["emotion.urgency", "needs.stated_intent"],
    "defaults": {
      "emotion.urgency": 0.3,
      "emotion.sentiment": "neutral"
    }
  }
}
```

---

## Hot Reload Usage

**Enable hot reload** (in development):

```javascript
import { policyLoader } from './utils/policyLoader.js';

// Enable hot-reload on all policies
policyLoader.enableHotReload(true);
```

**How it works:**
1. Edit `backend/config/influencer_policy.json`
2. Save file
3. Policy loader detects change via `fs.watch()`
4. Automatically reloads policy
5. Next request uses updated policy
6. **No server restart required!**

**Console output:**
```
🔄 Policy file changed: influencer_policy.json
✅ Reloaded policy: influencer_policy.json
```

---

## A/B Testing

**Scenario**: Test if lowering crisis threshold improves user satisfaction

### Setup

**Version A** (current):
```json
// influencer_policy.json
"crisis_urgency_threshold": 0.85
```

**Version B** (test):
```json
// influencer_policy_v2.json
"crisis_urgency_threshold": 0.75
```

### Test Process

1. **Week 1**: Run with `influencer_policy.json` (threshold 0.85)
2. **Collect metrics**: Crisis detections, user feedback
3. **Week 2**: Swap to `influencer_policy_v2.json` (threshold 0.75)
4. **Collect metrics**: Crisis detections, user feedback
5. **Compare**: Which threshold performed better?
6. **Decision**: Keep winning policy

**Code change required**: None! Just swap JSON files.

---

## Policy Validation

**Built-in validation** checks:
- ✅ Required fields exist
- ✅ Numeric values in valid ranges
- ✅ Enum values match allowed values
- ✅ Booster syntax is parseable
- ✅ Weights sum to expected totals (where applicable)

**On validation failure:**
- Policy loader logs error
- Falls back to default policy
- System continues running (graceful degradation)

---

## Best Practices

### 1. Version Your Policies
```json
{
  "version": "1.1.0",
  "changelog": "Lowered crisis threshold from 0.85 to 0.75"
}
```

### 2. Test Changes Locally
```bash
# Edit policy file
vim backend/config/influencer_policy.json

# Run tests
npm run test:arthur

# If tests pass, commit
git add backend/config/influencer_policy.json
git commit -m "Lower crisis threshold to 0.75"
```

### 3. Document Tuning Rationale
```json
"tuning_notes": {
  "crisis_threshold": "Set to 0.85 based on 2 weeks of user feedback showing 0.75 triggered too often"
}
```

### 4. Keep Backups
```bash
# Before major changes
cp backend/config/influencer_policy.json backend/config/influencer_policy.backup.json
```

---

## Implementation Details

### Files Modified

1. **`backend/services/Arthur.js`** (665 lines):
   - Loads `influencer_policy.json` in constructor
   - `computeAdvisoryWeights()` uses policy boosters dynamically
   - `buildSynthesisPrompt()` uses policy mode thresholds
   - Added helpers: `evaluateBoosterCondition()`, `getNestedValue()`

2. **`backend/services/Herald.js`** (542 lines):
   - Loads `herald_policy.json` in constructor
   - `checkPolicy()` uses policy limits and blocked keywords
   - `sanitizeQuery()` uses policy PII categories
   - `filterResults()` uses policy domain filters
   - `calculateTrustScore()` uses policy trusted domains

3. **`backend/services/Librarian.js`** (838 lines):
   - Loads `librarian_policy.json` in constructor
   - `calculate3DScore()` uses policy weights
   - `calculateRecencyScore()` uses policy half-life
   - `calculateFrequencyScore()` uses policy max references
   - `calculateVehemenceScore()` uses policy vehemence weights
   - `ageMemories()` uses policy compression threshold

### Before vs After

**Before** (hardcoded):
```javascript
if (signals.needs.learning_intent > 0.7) {
  weights.teacher += 0.3;
}
```

**After** (policy-driven):
```javascript
teacherBoosters.forEach(booster => {
  if (this.evaluateBoosterCondition(booster, signals)) {
    weights.teacher += booster.boost;
  }
});
```

**Benefits:**
- Add/remove boosters without code changes
- Tune boost amounts in real-time
- A/B test different booster configurations
- Self-documenting with "reason" fields

---

## Testing

**All tests passing** ✅:
```bash
npm run test:arthur
# ✅ Passed: 8
# ❌ Failed: 0
# 🎉 ALL TESTS PASSED!
```

**Test coverage:**
1. ✅ Teacher Mode (policy boosters work)
2. ✅ Coach Mode (policy boosters work)
3. ✅ Problem Solver Mode (policy boosters work)
4. ✅ Multi-Turn Conversation (policy maintained)
5. ✅ Herald Invocation (policy limits enforced)
6. ✅ Streaming Response (policy thresholds applied)
7. ✅ Crisis Detection (policy override works)
8. ✅ System Metrics (policy versions logged)

---

## Troubleshooting

### Policy Not Loading
**Symptom**: Console shows "Failed to load policy"

**Fix**:
1. Check file exists: `ls backend/config/influencer_policy.json`
2. Validate JSON syntax: `cat backend/config/influencer_policy.json | jq .`
3. Check permissions: `chmod 644 backend/config/*.json`

### Hot Reload Not Working
**Symptom**: Changes to policy file not reflected

**Fix**:
1. Verify hot reload enabled: `policyLoader.enableHotReload(true)`
2. Check file watcher is active (should see "Watching policy files" in console)
3. Try manual reload: `policyLoader.reloadPolicy('influencer_policy')`

### Invalid Booster Condition
**Symptom**: Console shows "Invalid booster condition"

**Fix**:
```json
// ❌ Wrong: missing quotes around value
{ "condition": "> 0.7" }

// ✅ Correct
{ "condition": "> 0.7" }

// ❌ Wrong: invalid operator
{ "condition": "~= 'value'" }

// ✅ Correct
{ "condition": "== 'value'" }
```

---

## Future Enhancements

### Planned Features
- [ ] Web UI for policy editing (no JSON editing required)
- [ ] Policy diff viewer (see what changed between versions)
- [ ] Real-time policy metrics (show impact of changes)
- [ ] Policy recommendations (ML suggests optimal values)
- [ ] Multi-environment policies (dev/staging/prod)

### Community Contributions
**Want to tune policies?** Submit a PR with:
1. Modified policy JSON file
2. Test results showing improvement
3. Explanation of changes in PR description

---

## Summary

The ARTHUR policy system transforms configuration from **hardcoded values** → **data-driven behavior**.

**Key Benefits:**
- ✅ Tune without code changes
- ✅ Hot-reload in development
- ✅ A/B test configurations
- ✅ Version-controlled
- ✅ Self-documenting
- ✅ Graceful fallbacks

**All tests passing** ✅ - system is production-ready with full policy externalization.

---

**Questions?** See `backend/utils/policyLoader.js` for implementation details.
