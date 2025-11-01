# TEST DATA MANAGEMENT GUIDE

## Overview
We've generated synthetic conversation history with an `is_test` flag to enable comprehensive testing without polluting your real chat experience.

## Current Status
- **116 test messages** (58 conversation pairs)
- **Time span:** April 28, 2025 - October 15, 2025 (~170 days)
- **All flagged with:** `is_test = 1`
- **Session:** `TEST_SESSION`

## Test Data Coverage

### Topics (Frequency Testing)
- `authentication`: 6 occurrences
- `career-anxiety`: 6 occurrences
- `work-stress`: 6 occurrences
- `anxiety-management`: 6 occurrences
- `python-journey`: 6 occurrences
- Plus 7 more topics (4 occurrences each)

### Personas
- Software Developer (14 conversations) - recurring tech problems
- Wellness Focused (16 conversations) - stress/anxiety management
- Career Switcher (10 conversations) - exploration + anxiety
- Lifelong Learner (8 conversations) - deep dives
- Crisis moments (4 conversations) - high vehemence

### Emotional Distribution
- Crisis emotions: `panic`, `desperate`, `crisis` (vehemence testing)
- Learning emotions: `curious`, `focused`, `confident` (progression testing)
- Recurring emotions: `anxious` (6x), `frustrated` (3x), `stressed` (2x)

## Management Commands

### View Statistics
```bash
npm run test:data:stats
```
Shows: message counts, time range, test sessions

### View Sample Messages
```bash
npm run test:data:sample
```
Shows: 10 most recent test messages

### Delete All Test Data
```bash
npm run test:data:clean
```
Interactive confirmation before deletion

### Regenerate Test Data
```bash
npm run test:data:generate
```
Creates fresh 6-month dataset (prompts if data exists)

## Using in Production Code

### Exclude Test Data (Your Real Chat)
```javascript
// In Librarian or chat services
const realMessages = db.prepare(`
  SELECT * FROM assistant_chat_messages 
  WHERE session_id = ? 
  AND (is_test = 0 OR is_test IS NULL)  -- Exclude test data
  ORDER BY created_at DESC
`).all(sessionId);
```

### Query Only Test Data (For Testing)
```javascript
// When testing Knights/Librarian
const testMessages = db.prepare(`
  SELECT * FROM assistant_chat_messages 
  WHERE is_test = 1
  ORDER BY created_at DESC
`).all();
```

### Semantic Search (Exclude Test Data)
```javascript
// Add to WHERE clause in Librarian
WHERE (is_test = 0 OR is_test IS NULL)
```

## Test Scenarios Enabled

### 1. Recency Scoring
- Messages from 170 days ago to recent
- Test exponential time decay: `Math.exp(-ageInDays / 30)`

### 2. Frequency Scoring
- Authentication discussed 6 times
- Work stress discussed 6 times
- Test log-scaled frequency: `Math.log(frequency + 1)`

### 3. Vehemence Scoring
- Panic attacks with `urgency: 0.95`
- Desperate moments with `risk: 0.9`
- Test emotional intensity weighting

### 4. Pattern Detection
- Recurring topics (authentication, anxiety, work-stress)
- Behavioral trends (learning_oriented, troubleshooting_focused)
- Conversation rhythms (daily, weekly, sporadic)

### 5. Learning Progressions
- Python journey: beginner → intermediate → confident
- React journey: curious → focused → confident
- Test skill progression tracking

### 6. Crisis Detection
- 4 crisis moments with high urgency/risk
- Test immediate support recommendations
- Validate Herald non-invocation during crisis

## Example Test Queries

Once Librarian is built, you can test:

```javascript
// Test 1: Recent crisis (should prioritize RECENCY)
"I'm feeling panicky like before"
// Expected: Find panic attack messages
// Scoring: High recency weight (0.35)

// Test 2: Recurring problem (should prioritize FREQUENCY)
"That authentication bug is back"
// Expected: Find all 6 authentication discussions
// Scoring: High frequency weight (0.30)

// Test 3: Emotional pattern (should prioritize VEHEMENCE)
"I'm anxious again"
// Expected: Find 6 anxiety discussions, prioritize intense moments
// Scoring: High vehemence weight (0.20)

// Test 4: Learning status (should prioritize RECENCY + FREQUENCY)
"How far have I gotten with Python?"
// Expected: Find Python journey (6 messages), show progression
// Scoring: Balanced recency (0.25) + frequency (0.20)
```

## Database Schema

### Table: `assistant_chat_messages`
```sql
CREATE TABLE assistant_chat_messages (
  id TEXT PRIMARY KEY,
  session_id TEXT,
  role TEXT,
  content TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  embedding TEXT,
  is_test INTEGER DEFAULT 0  -- 1 = test data, 0/NULL = real data
);

CREATE INDEX idx_chat_messages_is_test ON assistant_chat_messages(is_test);
```

## Best Practices

### When Building Features
1. **Always filter test data** in production queries
2. **Use test data** for validation and testing
3. **Check both scenarios** (with and without test data)

### When Testing
1. Use `is_test = 1` to query synthetic data
2. Validate 3D scoring weights with known patterns
3. Test edge cases (old data, high frequency, high vehemence)

### When Cleaning Up
1. Run `npm run test:data:stats` to see what you have
2. Run `npm run test:data:clean` to remove all test data
3. Regenerate with `npm run test:data:generate` if needed

## Migration to Production

When you're ready to deploy:

1. **Option 1: Keep test data for testing**
   - Queries automatically exclude with `is_test` filter
   - Test data won't appear in your chat
   - Can validate new features anytime

2. **Option 2: Remove test data**
   ```bash
   npm run test:data:clean
   ```
   - Cleaner database
   - Can regenerate anytime for testing

## Future Enhancements

Consider adding metadata columns for better test validation:
```sql
ALTER TABLE assistant_chat_messages ADD COLUMN test_topic TEXT;
ALTER TABLE assistant_chat_messages ADD COLUMN test_emotion TEXT;
ALTER TABLE assistant_chat_messages ADD COLUMN test_urgency REAL;
```

This would enable more sophisticated test queries:
```javascript
// Find all crisis moments in test data
SELECT * FROM assistant_chat_messages 
WHERE is_test = 1 AND test_urgency > 0.8;

// Find specific topic patterns
SELECT * FROM assistant_chat_messages 
WHERE is_test = 1 AND test_topic = 'authentication';
```

---

**Bottom Line:** Your real chat experience is protected. Test data is isolated and easily manageable. You can test complex scenarios without months of manual conversation.

Copyright (c) 2025 Scott Crawford. All rights reserved.
