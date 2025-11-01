# Adaptive Policy Learning

## Overview

ScottBot Local includes an **invisible adaptive learning system** that allows users to tune their experience through natural language feedback, without ever seeing settings menus or configuration files.

## How It Works

### User Experience

Users simply give natural feedback during conversations:
- "Ask me less questions like this"
- "Stop asking exploratory questions - I just want answers"
- "Explain more - I want to understand"
- "Be more direct"
- "Too much detail - keep it simple"

The system detects these patterns, adjusts internal policy weights, and adapts future responses accordingly.

### What Users See

**Before:** Standard coaching behavior with exploratory questions
**User says:** "Stop asking me exploratory questions"
**System responds:** "Got it - I'll focus on giving you direct answers."
**After:** Future responses skip exploratory questions and deliver direct solutions

## Architecture

### 1. Policy Detection (`policyLearning.js`)

Monitors user messages for feedback patterns:
- Coaching preferences (more/fewer questions)
- Teaching preferences (more/less explanation)
- Directness preferences (concise vs detailed)
- Tone preferences (casual vs formal)

### 2. Preference Storage

User-specific adjustments stored in SQLite:
```javascript
{
  "coaching_signal_bias": 0.25,        // Reduced coaching to 25%
  "exploratory_questions": 0.0,        // Suppressed exploratory questions
  "teacher_signal_bias": 1.0,          // Normal teaching level
  "problem_solver_bias": 1.3,          // Boosted direct problem solving
  "urgency_sensitivity": 0.2           // Slightly higher urgency detection
}
```

### 3. Weight Adjustment

User preferences modify the Roundtable Protocol weights:
- Base weights calculated from signals (Pattern/Emotion/Needs analysis)
- User bias multipliers applied
- Final normalized weights guide ChatGPT-5's response style

### 4. System Prompt Adaptation

The coaching mode instructions adapt to user preferences:
- **Full coaching** (100%): 2-3 exploratory questions before solutions
- **Reduced coaching** (50%): 1 clarifying question, balanced approach
- **Suppressed coaching** (0%): Supportive guidance without questions

## Examples

### Example 1: Reducing Exploratory Questions

**User:** "I'm feeling stuck with my career..."
**System:** *Detects coaching need, asks 2-3 exploratory questions*

**User:** "Ask me less questions like this"
**System:** *Adjusts exploratory_questions: 0.5*

**Next time:**
**User:** "I'm not sure about this decision..."
**System:** *Asks only 1 brief question, then provides guidance*

### Example 2: Increasing Explanation Depth

**User:** "What's machine learning?"
**System:** *Provides standard explanation*

**User:** "Explain more - I want to understand how it really works"
**System:** *Adjusts teacher_signal_bias: 1.3*

**Next time:**
**User:** "Tell me about neural networks"
**System:** *Provides deeper, more educational explanation with examples and context*

### Example 3: Requesting Direct Answers

**User:** "How do I fix this bug?"
**System:** *Asks clarifying questions first*

**User:** "Stop asking questions - just give me the solution"
**System:** *Adjusts coaching_signal_bias: 0.25, problem_solver_bias: 1.5*

**Next time:**
**User:** "How do I deploy this app?"
**System:** *Immediately provides step-by-step solution without exploratory questions*

## Supported Adjustments

| Feedback Type | Pattern Examples | Effect |
|---|---|---|
| **Reduce Questions** | "ask less questions", "fewer questions" | exploratory_questions: -0.5 |
| **Stop Questions** | "stop asking", "just give me answers" | exploratory_questions: -1.0, coaching: -0.75 |
| **More Questions** | "ask me more", "help me think" | exploratory_questions: +0.5, coaching: +0.3 |
| **More Explanation** | "explain more", "want to understand" | teacher_signal_bias: +0.3 |
| **Less Explanation** | "too much detail", "simpler please" | teacher_signal_bias: -0.3 |
| **More Direct** | "be more direct", "get to the point" | problem_solver_bias: +0.3 |
| **Less Direct** | "too brief", "more context" | problem_solver_bias: -0.2 |
| **More Casual** | "be more casual", "too formal" | formality_level: -0.3 |
| **More Formal** | "be more professional" | formality_level: +0.3 |

## Database Schema

### `assistant_user_preferences`
Stores user-specific policy overrides:
```sql
CREATE TABLE assistant_user_preferences (
  user_id TEXT PRIMARY KEY DEFAULT 'default',
  policy_overrides TEXT DEFAULT '{}',
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

### `assistant_policy_feedback_history`
Audit log of all policy adjustments:
```sql
CREATE TABLE assistant_policy_feedback_history (
  id TEXT PRIMARY KEY,
  user_id TEXT DEFAULT 'default',
  feedback_type TEXT,
  adjustment TEXT,
  applied_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

## Benefits

1. **Invisible Learning** - No settings menus, just natural conversation
2. **Gradual Tuning** - Users can refine preferences over time
3. **Reversible** - Can always adjust back (e.g., "ask me more questions")
4. **Persistent** - Preferences persist across sessions
5. **Transparent** - Users see immediate effect in next response
6. **Auditable** - All adjustments logged for review

## Future Enhancements

- Time-of-day patterns (morning = more urgency, evening = more exploration)
- Topic-specific preferences (technical questions = direct, life decisions = coaching)
- Automatic preference suggestions based on interaction patterns
- Preference export/import for backup
- Multi-user profiles with separate preferences

## Testing

Try these phrases in the chat to see adaptation:
1. "Ask me fewer questions"
2. "Explain this in more detail"
3. "Just give me the answer quickly"
4. "Help me think through this with questions"

Watch the console logs for:
```
🎛️  User policy adjusted: reduce_questions
🎯 PROTOCOL ACTIVE - User Preferences Applied: { ... }
```
