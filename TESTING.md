# Testing ScottBot Local

## Test Suites

### 1. Functional Tests (`npm test`)
Tests all API endpoints and core functionality:
- ✅ Health check
- ✅ Preferences management
- ✅ Session management
- ✅ File upload & conversion
- ✅ Web search integration
- ✅ Chat functionality
- ✅ File operations

**Run:** `npm test`

### 2. AI Response Quality Tests (`npm run test:ai`)
Tests the AI assistant's ability to handle different types of queries:

#### Categories Tested:
1. **Factual Knowledge** - Simple facts and quick answers
2. **Math & Logic** - Calculations and reasoning
3. **Creative Thinking** - Open-ended creative tasks
4. **Explanations** - Detailed technical explanations
5. **Problem Solving** - Practical advice and solutions
6. **Code & Technical** - Programming questions

#### Evaluation Criteria:
- ✅ Response has content
- ✅ Contains expected keywords
- ✅ Appropriate length for question type
- 📊 Overall score (0-100)

**Run:** `npm run test:ai`

## Example Output

### Functional Tests
```
============================================================
  Test Summary
============================================================
Total Tests: 24
Passed: 24
Failed: 0
Pass Rate: 100.0%

🎉 All tests passed! ScottBot Local is working perfectly!
```

### AI Response Tests
```
============================================================
  Test Summary
============================================================
📈 Overall Performance:
   Average Score: 87.5/100
   Passed (≥75): 14/16 (87.5%)

📋 By Category:
   Factual Knowledge: 95.0/100
   Math & Logic: 91.7/100
   Creative Thinking: 75.0/100
   Explanations: 85.0/100
   Problem Solving: 82.5/100
   Code & Technical: 90.0/100
```

## Running Tests

```bash
# Make sure server is running first
npm run dev

# In another terminal:
npm test        # Run functional tests
npm run test:ai # Run AI response quality tests
```

## What's New

### Chat History Improvements ✨
- **Auto-generated titles**: Each conversation gets a descriptive title based on the first message
- **Rename feature**: Click the edit icon to rename any conversation
- **Relative timestamps**: Shows "5m ago", "2h ago", "3d ago" etc.
- **Message count**: See how many messages in each conversation
- **Delete conversations**: Remove old chats easily
- **Session persistence**: All conversations stored in SQLite database

### How It Works
1. Start a new chat - gets temporary "New Chat" title
2. Send first message - AI generates descriptive title in background
3. See your conversation appear in sidebar with smart title
4. Rename anytime by clicking the edit icon
5. All titles and messages persist between sessions
