# AI-First Smart Topic Cloud

**Copyright © 2025 Scott Crawford. All rights reserved.**

**Status:** ✅ Implemented  
**Date:** November 1, 2025  
**Impact:** Intelligent conversation segmentation and topic discovery

## Overview

The Smart Topic Cloud uses **AI-first architecture** to intelligently analyze conversations, identify topic boundaries, and generate concise labels for easy navigation. Powered by gpt-4o-mini, it understands context, distinguishes primary topics from logistics, and creates a visual cloud of recent conversation themes.

## Problem Statement

### Original Approach (Rule-Based)
- **60-minute time gaps** required to create new topic
- **Token similarity (Jaccard)** determined boundaries
- **First message content** used for labeling
- **Algorithmic merging** of related segments
- **Result:** Topics missed, poor labeling, context-blind splitting

### Issues Found
1. **Running conversation + time zone logistics** merged into one topic labeled "Time Zone Coordination"
2. **Session title** ("Celebrating 8km Run") ignored
3. **Multiple segments** from same session appeared as separate cloud items
4. **Verbose labels** cluttered the cloud interface

## Solution: AI-First Segmentation

### Architecture Flow
```
Conversation → AI Analysis → Segments → Smart Merging → Cloud Display
                ↓
         - Identify topics
         - Mark primary/secondary
         - Generate dual labels
         - Understand context
```

### Core Components

#### 1. AI Segmentation (`segmentLiveMessagesAI`)
```javascript
async function segmentLiveMessagesAI(messages, sessionTitle = null) {
  // Build transcript for LLM
  const transcript = messages.map((m, i) => 
    `[${i + 1}] ${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content.slice(0, 300)}`
  ).join('\n\n');

  // Call gpt-4o-mini with structured output
  const response = await getOpenAI().chat.completions.create({
    model: 'gpt-4o-mini',
    response_format: { type: "json_object" },
    messages: [/* prompt */]
  });

  // Returns: { primaryTopic, cloudLabel, segments: [...] }
}
```

#### 2. Dual Labeling System
- **Cloud Label:** Punchy 2-3 words for visual scanning ("8km Run", "Career Change")
- **Full Title:** Descriptive for list view ("Celebrating an 8km Run/Walk Achievement")

#### 3. Primary Segment Detection
- `isPrimary: true` → Main conversation topic
- `isPrimary: false` → Logistics, closing actions, tangential topics

#### 4. Intelligent Grouping
All segments from the same session merge into **one cloud topic**, using the primary segment's label.

## Implementation Details

### AI Prompt Design
```javascript
{
  role: 'system',
  content: `You analyze conversations to identify topic boundaries and primary focus.

Return JSON with this structure:
{
  "primaryTopic": "Punchy 2-3 word label for the main topic",
  "cloudLabel": "Ultra-concise 2-3 word label for cloud view",
  "segments": [
    {
      "startMessageIndex": 1,
      "endMessageIndex": 8,
      "label": "Brief segment label (2-4 words)",
      "cloudLabel": "2-3 word cloud label",
      "isPrimary": true
    }
  ]
}

Guidelines:
- cloudLabel must be VERY concise (2-3 words max)
- If entire conversation is coherent, return ONE segment
- Mark isPrimary=true for main topic only
- Brief logistics should be isPrimary=false
- Use session title as context if provided`
}
```

### Grouping Logic
```javascript
// Group ALL segments from same session together
const groupKey = entry.segmentRef?.type === 'live'
  ? entry.sessionId  // All live segments → one cloud topic
  : slug;  // Bundles: cross-session grouping

// Prefer primary segment's cloud label
const primarySegment = group.segmentRefs.find(ref => ref.isPrimary);
const cloudLabel = primarySegment?.cloudLabel || group.label;
```

### Data Flow
```
1. Session Messages
   ↓
2. AI Analysis (gpt-4o-mini)
   ↓
3. Segments with labels + isPrimary flags
   ↓
4. Group by sessionId
   ↓
5. Pick primary segment's cloudLabel
   ↓
6. Score & rank topics
   ↓
7. Display in cloud
```

## Results

### Before AI-First
```
Cloud View:
- "Time Zone Coordination" (2 messages)

List View:
- "Celebrating an 8km Run/Walk Achievement" (12 messages)

Problem: Running conversation invisible in cloud!
```

### After AI-First
```
Cloud View:
- "Run Achievement" (10 messages)

List View:
- "Celebrating an 8km Run/Walk Achievement"

Success: Concise label, all segments merged, primary topic surfaced!
```

## Cost Analysis

### GPT-4o-mini Pricing
- **Input:** $0.15 per 1M tokens
- **Output:** $0.60 per 1M tokens

### Per-Conversation Cost
- **Typical conversation:** ~2000 input tokens, ~100 output tokens
- **Cost:** ~$0.0003 (0.03 cents)
- **100 conversations:** ~$0.03
- **1000 conversations:** ~$0.30

### Optimization
- Only analyzed when topic summary requested (not every message)
- Cache results (60s TTL)
- Fallback to rule-based if no API key

## Technical Specifications

### Files Modified
- `backend/services/topicService.js` - Core segmentation logic
  - Added `segmentLiveMessagesAI()` - AI-first analysis
  - Added `segmentLiveMessagesLegacy()` - Rule-based fallback
  - Modified `getTopicSummary()` - Grouping by sessionId
  - Enhanced label selection - Primary segment preference

### Key Functions

#### `segmentLiveMessagesAI(messages, sessionTitle)`
**Purpose:** AI-driven conversation analysis  
**Input:** Array of messages, optional session title  
**Output:** Array of segments with labels and isPrimary flags  
**Model:** gpt-4o-mini  
**Fallback:** Rule-based if API key missing

#### `segmentLiveMessagesLegacy(messages, options)`
**Purpose:** Rule-based segmentation (fallback)  
**Logic:** 
- 15-minute gap triggers new segment
- Jaccard similarity < 0.28 triggers split
- Minimum 3 messages per segment

#### Segment Object Structure
```javascript
{
  index: 1,
  messages: [...],
  start: '2025-11-01T22:29:15Z',
  end: '2025-11-01T22:51:40Z',
  label: 'Celebrating an 8km Run/Walk',  // Descriptive
  cloudLabel: 'Run Achievement',          // Punchy
  userTurns: 5,
  messageCount: 10,
  isPrimary: true                         // Main topic flag
}
```

## Configuration

### Environment Variables
```bash
# Segmentation settings (legacy fallback only)
TOPIC_SEGMENT_GAP_MINUTES=15           # Time gap threshold
TOPIC_SEGMENT_JACCARD_THRESHOLD=0.28   # Token similarity
TOPIC_SEGMENT_MIN_MESSAGES=3           # Min messages per segment

# Caching
TOPIC_SUMMARY_TTL_MS=60000             # Cache duration
TOPIC_SEGMENT_LIVE_WINDOW=80           # Messages to analyze
```

### AI Model Configuration
```javascript
model: 'gpt-4o-mini',
temperature: 0.3,        // Low for consistency
max_tokens: 500,         // Enough for structured output
response_format: { type: "json_object" }
```

## Testing & Validation

### Test Scenarios

#### Scenario 1: Single Coherent Topic ✅
```
Input: 8km run conversation (10 messages)
Expected: ONE segment, isPrimary=true
Result: "Run Achievement" (10 msgs)
Status: PASS
```

#### Scenario 2: Topic + Logistics ✅
```
Input: Run (8 msgs) + Time zone (2 msgs)
Expected: TWO segments, run=primary
Result: "Run Achievement" (10 msgs total, merged)
Status: PASS
```

#### Scenario 3: Multiple Topics ✅
```
Input: Robert Greene books conversation (20 msgs)
Expected: Segments merged by session
Result: "Robert Greene" (20 msgs)
Status: PASS
```

### Validation Commands
```bash
# Check topic cloud output
curl -s "http://localhost:3001/api/topics/summary?limit=20" | jq '.items[] | {topic, count, title}'

# Verify segment structure
curl -s "http://localhost:3001/api/topics/TOPIC_ID/snapshot" | jq '.items[0]'

# Test with specific session
curl -s "http://localhost:3001/api/chat/SESSION_ID/history"
```

## Edge Cases & Handling

### Very Short Conversations (< 4 messages)
- Skip AI analysis
- Return single segment with session title
- Cost: $0 (no API call)

### API Key Missing
- Gracefully fallback to rule-based segmentation
- Log warning but continue operation
- No user-facing errors

### LLM Returns Invalid JSON
- Catch parse errors
- Fallback to single segment
- Log for debugging

### Multiple Rapid Topic Switches
- AI handles naturally (context-aware)
- Creates multiple segments with appropriate isPrimary flags
- Groups by session for cloud display

## Future Enhancements

### Phase 1 (Current) ✅
- [x] AI-first segmentation with gpt-4o-mini
- [x] Dual labeling (cloud + full title)
- [x] Primary segment detection
- [x] Session-based grouping

### Phase 2 (Planned)
- [ ] Cross-session topic merging (e.g., "Running" from multiple sessions)
- [ ] Topic evolution tracking over time
- [ ] User feedback on topic labels (thumbs up/down)
- [ ] Personalized label preferences

### Phase 3 (Proposed)
- [ ] Multi-modal analysis (images, files in conversations)
- [ ] Conversation threading (parent/child topics)
- [ ] Topic-based search and filtering
- [ ] Topic statistics dashboard

### Phase 4 (Future)
- [ ] Predictive topic suggestions
- [ ] Auto-tagging for organization
- [ ] Topic-based memory recall
- [ ] Conversation summaries per topic

## Performance Metrics

### Response Times
- **Topic Summary Generation:** ~200-500ms (with AI)
- **Cache Hit:** ~10ms
- **Fallback (no API):** ~50ms

### Accuracy (Subjective)
- **Topic Identification:** Excellent - Context-aware
- **Label Quality:** Very Good - Occasionally verbose
- **Primary Detection:** Excellent - Distinguishes main vs tangential

### Scalability
- **Current:** Handles 100s of sessions easily
- **Bottleneck:** AI API latency (parallel processing possible)
- **Solution:** Batch processing, background jobs for large datasets

## Monitoring & Debugging

### Key Logs to Watch
```bash
# AI segmentation calls
grep "segmentLiveMessagesAI" logs/server.log

# Fallback usage (indicates API issues)
grep "AI segmentation failed, using legacy" logs/server.log

# Topic summary generation
grep "getTopicSummary" logs/server.log
```

### Debug Mode
```javascript
// Enable detailed logging in topicService.js
logger.debug('AI response:', JSON.stringify(result, null, 2));
logger.debug('Segments created:', segments.map(s => ({ label: s.label, isPrimary: s.isPrimary })));
```

### Common Issues

#### "Topics not updating"
- **Cause:** Cache TTL (60s)
- **Solution:** Wait or clear cache: `invalidateTopicCaches()`

#### "Segments not merging"
- **Cause:** Different sessionIds or grouping logic
- **Solution:** Check groupKey calculation in aggregation

#### "Labels too verbose"
- **Cause:** AI prompt needs tuning
- **Solution:** Adjust cloudLabel guidance in prompt

## Related Documentation
- [Policy-Driven Knights](./POLICY_DRIVEN_KNIGHTS.md)
- [Evidence Council Architecture](./ADVISORY_COUNCIL_EXPLAINED.md)
- [Session Management](./SESSION_CONTEXT.md)
- [Librarian Search System](./LIBRARIAN_COMPLETE.md)

## API Endpoints

### GET `/api/topics/summary`
Returns scored and ranked topics for cloud display.

**Query Parameters:**
- `limit` (default: 15) - Max topics to return
- `windowDays` (default: 30) - Time window for relevance

**Response:**
```json
{
  "items": [
    {
      "topic": "Run Achievement",          // Cloud label
      "title": "Celebrating 8km Run...",   // Full title
      "topicId": "session-id-slug",
      "count": 10,
      "weight": 44,
      "lastActive": "2025-11-01T22:52:58Z",
      "segmentRefs": [
        {
          "type": "live",
          "sessionId": "...",
          "messageIds": [...],
          "label": "Celebrating run/walk",
          "cloudLabel": "Run Achievement",
          "isPrimary": true
        }
      ]
    }
  ]
}
```

### GET `/api/topics/:topicId/snapshot`
Returns full conversation snapshot for a topic (virtual thread).

---

**Contributors:** Scott Crawford, AI Assistant  
**Last Updated:** November 1, 2025  
**Version:** 1.0
