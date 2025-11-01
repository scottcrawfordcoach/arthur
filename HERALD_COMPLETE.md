# HERALD SERVICE - COMPLETE ✅

**Status:** Phase 4 Complete - All 10 Tests Passing (Including Real Tavily Search!)  
**Date:** October 22, 2025  
**Implementation:** `backend/services/Herald.js` (640 lines)  
**Test Suite:** `backend/scripts/test-herald.js` (10 comprehensive tests)

---

## Overview

The **Herald** is the external research service for the ARTHUR system. It handles policy-bound web searches via Tavily API, with privacy protections and audit logging.

### Core Responsibilities

1. **Sanitize Queries** - Remove PII before external search
2. **Execute Web Search** - Via Tavily API
3. **Filter Results** - Domain blocklist, content validation
4. **Summarize Results** - LLM-powered condensation
5. **Tag Provenance** - Track result sources and trust scores
6. **Enforce Policies** - Daily limits, blocked keywords, budgets

---

## Privacy-First Design

### Query Sanitization

Before any query leaves your system, the Herald uses GPT-4o-mini to remove personal information:

**Example:**
```
Original:  "John Smith from 123 Main St wants to know about anxiety treatment"
Sanitized: "User wants to know about anxiety treatment"
```

**What Gets Removed:**
- Names (John Smith, Dr. Jones, etc.)
- Addresses (123 Main St, New York, etc.)
- Phone numbers, emails
- Ages, dates of birth
- Any other personally identifiable information

### Audit Trail

Every search is logged for compliance:
```javascript
{
  timestamp: "2025-10-22T10:30:00Z",
  originalQuery: "John Smith wants to know about React hooks",
  sanitizedQuery: "User wants to know about React hooks",
  resultCount: 3,
  intent: "learning",
  success: true
}
```

---

## Policy Enforcement

### Daily Search Limits

```javascript
policy: {
  dailySearchLimit: 100,        // Max searches per day
  dailySearchCount: 15,          // Current count
  lastResetDate: "2025-10-22"    // Auto-resets at midnight
}
```

**Behavior:**
- Tracks searches per day
- Blocks when limit reached
- Auto-resets at midnight
- Prevents abuse and controls costs

### Blocked Keywords

```javascript
blockedKeywords: [
  'illegal',
  'harmful',
  'explicit'
]
```

**Result:**
```
Query: "how to do something illegal"
Response: ⛔ Search blocked: Blocked keyword detected: illegal
```

### Domain Filtering

**Blocklist:**
```javascript
blockedDomains: [
  'malware-site.com',
  'spam-site.com',
  'known-bad-actor.com'
]
```

**Allowlist (Optional):**
```javascript
allowedDomains: [
  'wikipedia.org',
  'github.com',
  'stackoverflow.com',
  '.edu',
  '.gov'
]
```

---

## Core Methods

### `search(searchRequest)`
Main entry point for web searches.

**Input:**
```javascript
{
  query: "What are React hooks?",
  intent: "learning",           // Optional: from Analysis Knight
  maxResults: 5,
  searchDepth: "basic"          // 'basic' or 'advanced'
}
```

**Output:**
```javascript
{
  success: true,
  originalQuery: "What are React hooks?",
  sanitizedQuery: "What are hooks in React?",
  results: [
    {
      title: "React Hooks - React Documentation",
      snippet: "Hooks are functions that let you use state and other React features...",
      url: "https://react.dev/reference/react/hooks",
      score: 0.95,
      provenance: {
        source: "web_search",
        engine: "tavily",
        retrievedAt: "2025-10-22T10:30:00Z",
        queryIntent: "learning",
        trustScore: 0.85  // Higher for .dev domains
      }
    },
    // ... more results
  ],
  summary: "React hooks are functions introduced in React 16.8 that allow...",
  metadata: {
    searchTime: 7968,
    resultCount: 3,
    source: "tavily",
    timestamp: "2025-10-22T10:30:00Z",
    policyCompliant: true
  }
}
```

### `sanitizeQuery(query)`
Remove PII using GPT-4o-mini.

**Examples:**
```javascript
// Example 1: Name removal
Input:  "John wants to learn Python"
Output: "User wants to learn Python"

// Example 2: Location removal
Input:  "Best coffee shops in San Francisco"
Output: "Best coffee shops in a city"

// Example 3: No PII (unchanged)
Input:  "How do JavaScript closures work?"
Output: "How do JavaScript closures work?"
```

### `executeTavilySearch(query, searchDepth, maxResults)`
Execute Tavily API search.

**Features:**
- Basic or advanced search depth
- Configurable result limit
- Auto-increment daily counter
- Error handling with fallback

**Tavily API Response:**
```json
{
  "results": [
    {
      "title": "Article Title",
      "url": "https://example.com/article",
      "content": "Full article content...",
      "score": 0.89
    }
  ],
  "answer": "Direct answer if available"
}
```

### `filterResults(searchResults)`
Apply policy-based filtering.

**Filters Applied:**
1. **Domain Blocklist** - Remove known bad actors
2. **Domain Allowlist** - Only include trusted sources (if configured)
3. **Content Length** - Truncate overly long content
4. **URL Validation** - Remove invalid URLs

**Example:**
```javascript
Input:  3 results (good-site.com, spam-site.com, trusted.edu)
Output: 2 results (spam-site.com filtered out)
```

### `summarizeResults(results, originalQuery)`
Condense multiple results using GPT-4o-mini.

**Prompt:**
```
Summarize these search results for the query "What are React hooks?". Provide:
1. A brief overview (2-3 sentences)
2. Key findings (bullet points)
3. Source credibility notes if relevant
```

**Output:**
```
React hooks are functions introduced in React 16.8 that allow function 
components to use state and lifecycle features. They solve common problems 
like sharing stateful logic between components.

Key findings:
• useState: Adds state to function components
• useEffect: Handles side effects and lifecycle
• Custom hooks: Reusable stateful logic
• Rules of hooks: Only call at top level

Sources are highly credible (React official docs, MDN, GitHub).
```

### `calculateTrustScore(result)`
Compute trust score based on domain reputation and search score.

**Trusted Domains (Boost +0.3):**
- wikipedia.org
- github.com
- stackoverflow.com
- mozilla.org
- .edu, .gov domains

**High Search Score (Boost +0.2):**
- Tavily score > 0.8

**Examples:**
```javascript
Wikipedia article with score 0.9:
  Base: 0.5 + Domain: 0.3 + Score: 0.2 = 1.0 (capped)

Random blog with score 0.3:
  Base: 0.5 + Domain: 0.0 + Score: 0.0 = 0.5

Invalid URL:
  Base: 0.5 - Penalty: 0.2 = 0.3
```

---

## Test Results

### Test Suite: `test-herald.js`

**10/10 Tests Passing** ✅ (Including Real Tavily Search!)

| Test | Description | Result |
|------|-------------|--------|
| 1 | Query Sanitization (PII Removal) | ✅ "John Smith from 123 Main St..." → "User wants..." |
| 2 | Policy: Daily Limit | ✅ Blocked when limit reached |
| 3 | Policy: Blocked Keywords | ✅ "illegal" keyword blocked |
| 4 | Result Filtering (Domain Blocklist) | ✅ Filtered 3 → 2 (blocked spam-site.com) |
| 5 | Trust Score Calculation | ✅ Wikipedia: 1.00, Random: 0.50 |
| 6 | Provenance Tagging | ✅ Tagged with source, trust score |
| 7 | Search Logging (Audit Trail) | ✅ Logged with original + sanitized |
| 8 | Metrics Tracking | ✅ Searches, sanitizations, blocks tracked |
| 9 | Policy Updates | ✅ Dynamic policy modification |
| 10 | **Full Search Flow (Real Tavily API)** | ✅ **Found 3 results in 7968ms** |

### Real Tavily Search Test

**Query:** "What are React hooks?"

**Results:**
- **3 results** retrieved from Tavily
- **Query sanitized:** "What are hooks in React?"
- **Search time:** 7968ms (~8 seconds)
- **Policy compliant:** ✅ Yes
- **All results tagged** with provenance and trust scores

---

## Integration with Evidence Council

### Analysis Knight → Herald Flow

```javascript
// In Analysis Knight
const heraldRecommendation = {
  invoke: true,
  reason: "Novel technical topic with no internal context",
  search_query: "What are React hooks?",
  priority: "high"
};

// In Arthur Orchestrator (Phase 5)
if (councilResult.signals.analysis.herald_recommendation.invoke) {
  const webResults = await this.herald.search({
    query: councilResult.signals.analysis.herald_recommendation.search_query,
    intent: councilResult.signals.needs.stated_intent,
    maxResults: 5
  });
  
  // Add web results to context for final synthesis
  context.externalKnowledge = webResults;
}
```

### Decision Flow

**When Herald is Invoked:**
- Novel topics (no internal knowledge)
- Factual questions requiring current information
- Technical queries needing documentation
- Learning requests with high confidence

**When Herald is NOT Invoked:**
- Crisis situations (emotional support needed)
- Recurring topics (internal history exists)
- Personal questions (journal/preferences)
- Questions that need empathy over facts

---

## Real-World Examples

### Example 1: Technical Learning Query

**User Message:** "Can you explain how async/await works in JavaScript?"

**Analysis Knight Decision:**
```javascript
herald_recommendation: {
  invoke: true,
  reason: "Technical topic requiring current documentation",
  search_query: "async await JavaScript explanation",
  priority: "high"
}
```

**Herald Processing:**
1. Sanitize: "async await JavaScript explanation" (no PII)
2. Search Tavily: Found 5 results
3. Filter: Removed 1 spam site, kept 4 trusted sources
4. Summarize: "Async/await is syntactic sugar for Promises..."
5. Tag: All results tagged with trust scores

**Result to Arthur:**
```javascript
{
  success: true,
  results: [
    {
      title: "async/await - MDN Web Docs",
      url: "https://developer.mozilla.org/...",
      trustScore: 0.95
    },
    // ... 3 more results
  ],
  summary: "Async/await provides cleaner syntax for handling asynchronous operations..."
}
```

---

### Example 2: Query with PII (Sanitized)

**User Message:** "My friend John Smith living in Brooklyn wants to know about anxiety management techniques"

**Herald Processing:**
1. **Sanitize:**
   - Input: "My friend John Smith living in Brooklyn wants to know about anxiety management techniques"
   - Output: "User wants to know about anxiety management techniques"
   
2. **Search:** Uses sanitized query
3. **Results:** Brooklyn and John Smith never leave the system

**Privacy Protection:** ✅ Personal information stays local

---

### Example 3: Blocked Query

**User Message:** "How to do something illegal with credit cards"

**Herald Processing:**
1. **Policy Check:** Detects "illegal" keyword
2. **Block:** ⛔ Search blocked before any API call
3. **Response:**
   ```javascript
   {
     success: false,
     blocked: true,
     reason: "Blocked keyword detected: illegal",
     results: [],
     metadata: {
       policyCompliant: false
     }
   }
   ```

**Result:** No external search executed, user gets explanation

---

## Metrics & Monitoring

```javascript
const metrics = herald.getMetrics();

{
  totalSearches: 42,
  successfulSearches: 40,
  failedSearches: 2,
  successRate: 0.95,
  
  sanitizedQueries: 38,        // Queries with PII removed
  blockedQueries: 4,           // Blocked by policy
  
  avgSearchTime: 8200,         // milliseconds
  totalCost: 0.042,            // Estimated ($0.001/search)
  
  dailySearchCount: 15,
  dailySearchLimit: 100,
  searchesRemaining: 85
}
```

### Cost Tracking

- **Tavily API:** ~$0.001 per search
- **GPT-4o-mini (Sanitization):** ~$0.0001 per query
- **GPT-4o-mini (Summarization):** ~$0.0002 per search
- **Total per search:** ~$0.0013

**Monthly estimate (100 searches/day):**
- 100 searches × 30 days × $0.0013 = **$3.90/month**

---

## Policy Configuration

### Default Policy

```javascript
policy: {
  // Search budgets
  dailySearchLimit: 100,
  
  // Content filtering
  allowedDomains: [],              // Empty = all allowed
  blockedDomains: [
    'malware-site.com',
    'spam-site.com'
  ],
  blockedKeywords: [
    'illegal',
    'harmful',
    'explicit'
  ],
  
  // Result limits
  maxResultsPerSearch: 5,
  maxCharactersPerResult: 2000,
  
  // Privacy
  sanitizeQueries: true,
  logSearches: true,
  
  // Categories
  allowedCategories: [
    'general',
    'tech',
    'health',
    'science',
    'education'
  ]
}
```

### Updating Policy

```javascript
// Increase daily limit
herald.updatePolicy({ dailySearchLimit: 200 });

// Add trusted domains only
herald.updatePolicy({ 
  allowedDomains: ['wikipedia.org', 'github.com', '.edu', '.gov']
});

// Disable query sanitization (not recommended!)
herald.updatePolicy({ sanitizeQueries: false });
```

---

## Error Handling

### Graceful Degradation

```javascript
// If Tavily API fails
{
  success: false,
  error: "Tavily API error: 503 Service Unavailable",
  results: [],
  metadata: {
    searchTime: 1523,
    timestamp: "2025-10-22T10:30:00Z"
  }
}

// If sanitization fails
// Falls back to original query with warning
console.warn('Query sanitization failed, using original');
```

### API Key Validation

```javascript
if (!this.tavilyApiKey) {
  throw new Error('TAVILY_API_KEY not configured');
}
```

---

## Performance Characteristics

### Search Times

- **Query Sanitization:** ~500-1000ms (LLM call)
- **Tavily API Call:** ~5-8 seconds
- **Result Filtering:** <10ms
- **Summarization:** ~1-2 seconds (LLM call)
- **Total:** **7-12 seconds** average

### Optimization Opportunities

1. **Parallel Processing:** Sanitize while Tavily searches
2. **Caching:** Cache common queries (e.g., "What is Python?")
3. **Batch Summarization:** Summarize multiple results together
4. **CDN:** Cache trusted domain results

---

## Commands

```bash
# Test Herald
npm run test:herald

# Test with real Tavily API
# (requires TAVILY_API_KEY in .env)
TAVILY_API_KEY=your_key npm run test:herald
```

---

## Key Takeaways

✅ **Privacy-first** - PII removed before external search  
✅ **Policy-bound** - Daily limits, blocked keywords, domain filters  
✅ **Audit trail** - Every search logged for compliance  
✅ **Trust scoring** - Domain reputation tracked  
✅ **Provenance tagging** - Results tagged with source/trust info  
✅ **Real Tavily integration** - Tested with actual API  
✅ **Graceful degradation** - Handles failures without crashing  
✅ **All 10 tests passing** - Production-ready  

---

## What's Next?

### Phase 5: Arthur Orchestrator
**Purpose:** Final synthesis layer that brings everything together

**Flow:**
```
User Message
    ↓
Evidence Council (5 Knights + Coordinator)
    ↓
    ├─ Emotion, Needs, Pattern signals
    ├─ Context requests → Librarian (3D scoring)
    └─ Analysis synthesis
    ↓
If herald_recommendation.invoke = true:
    Herald Search (query sanitization + Tavily)
    ↓
Arthur Orchestrator
    ↓
    ├─ Compute Advisory Council weights (Teacher/Coach/Problem Solver)
    ├─ Apply policy rules
    └─ Synthesize with GPT-5
    ↓
Final Response
```

### Phase 5: Policy System
**Purpose:** Codify all governance rules

**Files to Create:**
- `influencer_policy.json` - Advisory Council weight calculation
- `signals_schema.json` - Formalized signal types
- `librarian_policy.json` - DB access rules, retention schedules
- `herald_policy.json` - Web search governance (extract from Herald.js)

---

**Status:** ✅ Herald COMPLETE  
**Next:** Build Arthur Orchestrator (Final Synthesis Layer)
