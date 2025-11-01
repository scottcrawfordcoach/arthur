# ARTHUR System - Data Management Guide for Developers

**Audience**: New developers joining the project  
**Purpose**: Understand how ARTHUR stores, retrieves, and manages data over time  
**Last Updated**: 2025-10-23

---

## Overview

The ARTHUR system is a **local-first AI assistant** with sophisticated data management powered by the **Librarian** service. This guide explains the complete data lifecycle.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [How Data is Stored](#how-data-is-stored)
3. [How Data is Retrieved](#how-data-is-retrieved)
4. [How Data Ages Over Time](#how-data-ages-over-time)
5. [Privacy & User Control](#privacy--user-control)
6. [Code Examples](#code-examples)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        USER INPUT                            │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                   ARTHUR (Orchestrator)                      │
│  - Receives user message                                     │
│  - Coordinates all components                                │
│  - Saves final response                                      │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              EVIDENCE COUNCIL (5 Knights)                    │
│  Phase 1: Emotion, Needs, Pattern (parallel)                │
│  Phase 2: Context Knight (needs Librarian)                  │
│  Phase 3: Analysis Knight (synthesis)                       │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│           LIBRARIAN (SOLE Database Access)                   │
│  - Stores: Chat history, knowledge, reference docs           │
│  - Retrieves: Using 3D relevance scoring                     │
│  - Ages: Compresses old memories into summaries              │
│  - Privacy: Handles user data deletion requests              │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                    SQLite DATABASE                           │
│  File: data/db/arthur_local.db                              │
│  30 tables across 4 categories                               │
└─────────────────────────────────────────────────────────────┘
```

**Key Principle**: Only the **Librarian** can access the database. All other components (Knights, Herald, Arthur) must request data through the Librarian's API.

---

## How Data is Stored

### 1. Storage Architecture

**Database**: SQLite (`data/db/arthur_local.db`)  
**Access**: Only through `Librarian.js`  
**Tables**: 30 tables organized into 4 categories

#### Category 1: **Wellness & Life** (8 tables)
Stores personal wellness tracking data.

```sql
-- Sleep tracking
wellness_sleep (id, date, hours, quality, notes, created_at)

-- Mood tracking
wellness_mood (id, date, mood_score, energy_level, notes, created_at)

-- Exercise tracking
wellness_exercise (id, date, activity_type, duration_minutes, intensity, notes)

-- Nutrition tracking
wellness_nutrition (id, date, meal_type, calories, protein, carbs, fats, notes)

-- Medication tracking
wellness_medication (id, name, dosage, frequency, notes, is_active)

-- Symptoms tracking
wellness_symptoms (id, date, symptom, severity, notes, created_at)

-- Goals
wellness_goals (id, goal_type, title, description, target_date, status)

-- Appointments
wellness_appointments (id, date, provider, purpose, notes, is_completed)
```

#### Category 2: **Personal Journal** (9 tables)
Stores user's personal notes, thoughts, and memories.

```sql
-- Daily journal entries
journal_entries (id, date, content, mood, tags, created_at, updated_at)

-- Gratitude logs
journal_gratitude (id, date, entry, created_at)

-- Reflections
journal_reflections (id, date, reflection, created_at)

-- Wins/achievements
journal_wins (id, date, win, category, created_at)

-- Lessons learned
journal_lessons (id, date, lesson, context, created_at)

-- Relationships
journal_relationships (id, name, relationship_type, notes, last_contact)

-- Events
journal_events (id, date, title, description, tags, created_at)

-- Memories
journal_memories (id, date, title, content, tags, created_at)

-- Habits tracking
journal_habits (id, habit_name, frequency, streak, last_completed)
```

#### Category 3: **Reference Library** (7 tables)
Stores uploaded documents, knowledge base articles, and external references.

```sql
-- Uploaded documents
reference_documents (
  id, title, content, file_type, file_hash, 
  upload_date, tags, summary, embedding
)

-- Articles
reference_articles (id, title, url, content, source, saved_date, tags)

-- Quotes
reference_quotes (id, quote, author, source, tags, created_at)

-- Bookmarks
reference_bookmarks (id, url, title, description, tags, created_at)

-- Code snippets
reference_code (id, title, language, code, description, tags, created_at)

-- Ideas/notes
reference_ideas (id, title, content, category, tags, created_at, updated_at)

-- Resources
reference_resources (id, title, url, type, description, tags, created_at)
```

#### Category 4: **Assistant Core** (6 tables)
Stores chat history and assistant metadata.

```sql
-- Chat sessions
assistant_chat_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  started_at DATETIME,
  last_activity DATETIME,
  message_count INTEGER,
  metadata TEXT
)

-- Chat messages (MOST IMPORTANT TABLE)
assistant_chat_messages (
  id TEXT PRIMARY KEY,
  session_id TEXT,
  role TEXT,              -- 'user' or 'assistant'
  message TEXT,           -- The actual message content
  timestamp DATETIME,
  model TEXT,             -- Which AI model was used
  tokens_used INTEGER,
  metadata TEXT,          -- JSON with emotion signals, etc.
  embedding BLOB,         -- Vector embedding for semantic search
  reference_count INTEGER DEFAULT 0,
  is_compressed BOOLEAN DEFAULT 0,
  is_test BOOLEAN DEFAULT 0,
  FOREIGN KEY (session_id) REFERENCES assistant_chat_sessions(id)
)

-- Advisory Council signals
assistant_advisory_signals (
  id, message_id, teacher_weight, coach_weight, 
  problem_solver_weight, created_at
)

-- User preferences
assistant_preferences (id, key, value, created_at, updated_at)

-- System metrics
assistant_metrics (id, metric_name, value, timestamp)

-- Herald search logs (external searches)
assistant_herald_logs (
  id, query, sanitized_query, result_count, 
  timestamp, cost, metadata
)
```

### 2. How Data Gets Stored

#### Chat Messages (Most Common)

**Flow**: User sends message → Arthur processes → Response generated → **Both saved to DB**

```javascript
// In Arthur.js - after generating response
await this.saveMessage(sessionId, 'user', userMessage);
await this.saveMessage(sessionId, 'assistant', assistantResponse, {
  model: this.mainModel,
  tokens: response.usage.total_tokens,
  advisoryWeights: weights,
  emotion: signals.emotion
});
```

**Saved to**: `assistant_chat_messages` table

**What's stored**:
- Message text (user input or assistant response)
- Timestamp (for recency scoring)
- Role (user/assistant)
- Metadata JSON (emotion signals, weights, etc.)
- Vector embedding (for semantic search)
- Reference count (initially 0, incremented when message is retrieved later)

#### Uploaded Documents

**Flow**: User uploads file → Content extracted → Chunked → Embedded → Stored

```javascript
// In file upload handler
const embedding = await generateEmbedding(content);
await librarian.storeDocument({
  title: filename,
  content: content,
  file_type: fileType,
  file_hash: hash,
  tags: extractedTags,
  embedding: embedding
});
```

**Saved to**: `reference_documents` table

#### Journal Entries

**Flow**: User makes journal entry → Stored with metadata → Tagged

```javascript
await librarian.createJournalEntry({
  date: today,
  content: journalText,
  mood: moodScore,
  tags: ['reflection', 'personal']
});
```

**Saved to**: `journal_entries` table

### 3. Vector Embeddings

**All text content gets embedded** for semantic search:

```javascript
// Using OpenAI's text-embedding-3-small model
const embedding = await openai.embeddings.create({
  model: 'text-embedding-3-small',
  input: text
});

// Stored as BLOB in database
// Enables: "Find messages similar to X" without exact keyword match
```

**Tables with embeddings**:
- `assistant_chat_messages.embedding`
- `reference_documents.embedding`
- `journal_entries.embedding` (if enabled)

---

## How Data is Retrieved

### 1. The 3D Relevance Scoring System

**Problem**: When user asks a question, how do we find the most relevant past conversations?

**Solution**: **3D Relevance Score** = Semantic + Recency + Frequency + Vehemence

#### Dimension 1: **Semantic Similarity** (40% weight)

*"How related is this to what the user is asking about?"*

```javascript
// Uses cosine similarity between embeddings
const queryEmbedding = await generateEmbedding(userQuery);
const semanticScore = cosineSimilarity(queryEmbedding, messageEmbedding);

// Returns: 0.0 (unrelated) to 1.0 (highly related)
```

**Example**: User asks "How do I manage stress?"
- Message about meditation: **High semantic score** (0.85)
- Message about grocery shopping: **Low semantic score** (0.12)

#### Dimension 2: **Recency** (25% weight)

*"How recent is this information?"*

```javascript
// Exponential decay: older = lower score
const ageInDays = (now - messageTimestamp) / (1000 * 60 * 60 * 24);
const recencyScore = Math.exp(-ageInDays / 30);  // Half-life: 30 days

// Returns: 1.0 (today) → 0.5 (30 days old) → 0.1 (90+ days old)
```

**Example**:
- Message from today: **1.0**
- Message from 30 days ago: **0.5**
- Message from 90 days ago: **0.1**

#### Dimension 3: **Frequency** (20% weight)

*"How often has this been referenced before?"*

```javascript
// Log-scaled to prevent frequent items from dominating
const frequencyScore = Math.log(referenceCount + 1) / Math.log(100);

// Returns: 0.0 (never referenced) to 1.0 (100+ references)
```

**Example**:
- Referenced 0 times: **0.0**
- Referenced 10 times: **0.5**
- Referenced 100 times: **1.0**

**When reference count increases**: Every time a message is retrieved and shown to user, `reference_count++`

#### Dimension 4: **Vehemence** (15% weight)

*"How emotionally intense was this moment?"*

```javascript
// Based on Emotion Knight signals stored in metadata
const urgency = metadata.emotion?.urgency || 0.3;
const sentimentIntensity = Math.abs(metadata.emotion?.sentiment || 0);
const risk = metadata.emotion?.risk || 0;

const vehemenceScore = (urgency * 0.5) + (sentimentIntensity * 0.3) + (risk * 0.2);

// Returns: 0.0 (neutral) to 1.0 (highly emotional/urgent)
```

**Example**:
- "I'm feeling great!" → **Low vehemence** (0.3)
- "I'm really struggling with this" → **High vehemence** (0.8)
- "I need help immediately" → **Very high vehemence** (0.95)

#### Combined Score

```javascript
const relevanceScore = 
  (semanticScore * 0.40) +    // Most important: topical relevance
  (recencyScore * 0.25) +      // Prefer recent info
  (frequencyScore * 0.20) +    // Boost previously useful info
  (vehemenceScore * 0.15);     // Remember emotional moments

// Returns: 0.0 to 1.0 (higher = more relevant)
// Results sorted by this score, top N returned
```

**Configurable**: All weights defined in `backend/config/librarian_policy.json`

### 2. Context Retrieval Flow

**Trigger**: Context Knight requests relevant context during Evidence Council

```javascript
// In Context Knight
const contextRequest = {
  query: userMessage,
  time_range: 'recent',    // or 'today', 'week', 'month', 'all'
  limit: 20,               // Max results to return
  tables: ['chat_messages', 'journal_entries', 'documents']
};

const context = await librarian.fulfillContextRequests(contextRequest);
```

**Librarian Process**:

1. **Generate query embedding**
   ```javascript
   const queryEmbedding = await generateEmbedding(contextRequest.query);
   ```

2. **Query database with semantic search**
   ```sql
   SELECT 
     id, message, timestamp, metadata, embedding, reference_count
   FROM assistant_chat_messages
   WHERE timestamp > ? -- time_range filter
   ORDER BY semantic_similarity(embedding, ?) DESC
   LIMIT 100 -- Get top candidates
   ```

3. **Calculate 3D scores for each result**
   ```javascript
   const scoredResults = candidates.map(result => {
     const semantic = cosineSimilarity(queryEmbedding, result.embedding);
     const recency = calculateRecencyScore(result.timestamp);
     const frequency = calculateFrequencyScore(result.reference_count);
     const vehemence = calculateVehemenceScore(result.metadata);
     
     const relevanceScore = 
       (semantic * 0.40) + 
       (recency * 0.25) + 
       (frequency * 0.20) + 
       (vehemence * 0.15);
     
     return { ...result, relevanceScore, scores: { semantic, recency, frequency, vehemence } };
   });
   ```

4. **Sort by relevance and return top N**
   ```javascript
   const topResults = scoredResults
     .sort((a, b) => b.relevanceScore - a.relevanceScore)
     .slice(0, contextRequest.limit);
   
   // Increment reference_count for retrieved messages
   topResults.forEach(result => {
     db.prepare('UPDATE assistant_chat_messages SET reference_count = reference_count + 1 WHERE id = ?')
       .run(result.id);
   });
   ```

5. **Return formatted context**
   ```javascript
   return {
     results: topResults,
     metadata: {
       totalCandidates: candidates.length,
       returnedCount: topResults.length,
       avgRelevanceScore: average(topResults.map(r => r.relevanceScore)),
       searchTime: Date.now() - startTime
     }
   };
   ```

### 3. Example Retrieval Scenarios

#### Scenario 1: User Asks About Past Conversation

**User**: "What did we discuss about my sleep issues last week?"

**Librarian Process**:
1. Generate embedding for "sleep issues"
2. Query `assistant_chat_messages` with time_range='week'
3. Find messages with high semantic similarity to "sleep"
4. Calculate 3D scores:
   - "I've been having trouble sleeping" (5 days ago):
     - Semantic: 0.92 (very related)
     - Recency: 0.89 (recent)
     - Frequency: 0.2 (mentioned 5 times)
     - Vehemence: 0.7 (user was concerned)
     - **Total: 0.76** ✅ Top result
   
   - "I slept well last night" (2 days ago):
     - Semantic: 0.85 (related)
     - Recency: 0.95 (very recent)
     - Frequency: 0.1 (mentioned 2 times)
     - Vehemence: 0.3 (neutral)
     - **Total: 0.67** ✅ Second result

5. Return top 2 messages to Context Knight
6. Context Knight includes these in Arthur's synthesis prompt
7. Arthur references them in response: "Last week you mentioned having trouble sleeping due to stress..."

#### Scenario 2: User Uploads Document and Asks About It

**User**: Uploads "annual_report.pdf", then asks "What were the key findings?"

**Librarian Process**:
1. Document stored with embedding of full content
2. Query embedding: "key findings"
3. Semantic search finds document (high similarity)
4. Return relevant sections
5. Arthur synthesizes answer from document content

#### Scenario 3: Finding Patterns Over Time

**User**: "What are my recurring themes in journal entries this month?"

**Librarian Process**:
1. Query `journal_entries` with time_range='month'
2. Retrieve all entries (no semantic filter needed)
3. Pattern Knight analyzes for recurring topics
4. Librarian groups by tags/themes
5. Arthur presents: "Your main themes this month: work stress (15 entries), family time (8 entries), exercise goals (12 entries)"

---

## How Data Ages Over Time

### 1. Memory Aging Strategy

**Problem**: Database grows indefinitely, old conversations lose relevance

**Solution**: **3-tier aging process** - Compress → Archive → Delete

```
Fresh Memory (0-90 days)
├─ Stored in full detail
├─ Full text + embeddings + metadata
└─ Quickly searchable

↓ After 90 days

Compressed Memory (90-365 days)
├─ Summarized by LLM
├─ Original message replaced with summary
├─ Embeddings updated to match summary
└─ "is_compressed = 1" flag set

↓ After 365 days

Archived Memory (365-730 days)
├─ Moved to archive table
├─ Still searchable but slower
├─ Lower priority in results
└─ "is_archived = 1" flag set

↓ After 730 days (optional)

Deleted Memory (730+ days)
├─ Permanently removed
├─ User consent required
└─ "deletion_enabled = true" in policy
```

**Configurable**: All thresholds in `backend/config/librarian_policy.json`

```json
{
  "retention": {
    "compression_threshold_days": 90,
    "archive_threshold_days": 365,
    "deletion_threshold_days": 730,
    "deletion_enabled": false,
    "summary_token_limit": 200
  }
}
```

### 2. Compression Process

**When**: Runs automatically (daily cron job or on-demand)

**Process**:

```javascript
// In Librarian.js
async ageMemories() {
  // 1. Find old, uncompressed messages
  const oldMessages = db.prepare(`
    SELECT id, session_id, role, message, timestamp
    FROM assistant_chat_messages
    WHERE timestamp < ?
    AND is_compressed = 0
    ORDER BY timestamp ASC
    LIMIT 100
  `).all(compressionThresholdDate);
  
  // 2. Group by session (compress entire conversations)
  const sessions = groupBy(oldMessages, 'session_id');
  
  for (const [sessionId, messages] of sessions) {
    // 3. Use LLM to summarize conversation
    const summary = await this.compressMessages(messages);
    
    // 4. Update messages with summary
    db.prepare(`
      UPDATE assistant_chat_messages
      SET 
        message = ?,
        is_compressed = 1,
        compressed_at = ?
      WHERE session_id = ?
    `).run(summary, Date.now(), sessionId);
    
    // 5. Update embeddings to match summary
    const summaryEmbedding = await generateEmbedding(summary);
    db.prepare(`
      UPDATE assistant_chat_messages
      SET embedding = ?
      WHERE session_id = ?
    `).run(summaryEmbedding, sessionId);
    
    console.log(`✅ Compressed session ${sessionId}: ${messages.length} messages → 1 summary`);
  }
}
```

**Example**:

**Before compression** (5 messages, 2000 tokens):
```
User: How do I train for a marathon?
Assistant: Here's a comprehensive 16-week training plan...
User: What about nutrition?
Assistant: Marathon nutrition is crucial. Focus on...
User: Thanks!
```

**After compression** (1 summary, 150 tokens):
```
Summary: User asked about marathon training and nutrition. 
Provided 16-week training plan and nutrition guidance 
focusing on carb-loading and hydration. User satisfied.
```

**Benefits**:
- ✅ Reduces database size by ~70%
- ✅ Preserves semantic meaning (embedding updated)
- ✅ Still searchable via 3D scoring
- ✅ Faster queries (less data to scan)

**Trade-off**: Loses verbatim conversation details

### 3. Frequency Score Dynamics

**Key Insight**: `reference_count` increases over time for useful memories

**Example Timeline**:

```
Day 1: User discusses sleep issues
├─ Message stored with reference_count = 0
├─ Recency score: 1.0 (fresh)
└─ Frequency score: 0.0 (never referenced)

Day 2: User asks about sleep again
├─ Previous message retrieved (relevant)
├─ reference_count = 1 (incremented)
├─ Recency score: 0.97
└─ Frequency score: 0.05

Day 7: User asks about sleep third time
├─ reference_count = 2
├─ Recency score: 0.85
└─ Frequency score: 0.1

Day 30: User asks about sleep tenth time
├─ reference_count = 9
├─ Recency score: 0.5 (aging)
└─ Frequency score: 0.5 (frequently useful!)

Day 90: Compression threshold reached
├─ Message compressed to summary
├─ reference_count preserved (9)
├─ Recency score: 0.1 (old)
└─ Frequency score: 0.5 (still valued for frequency)
```

**Effect**: **Frequently referenced messages stay relevant even as they age** due to frequency score compensating for declining recency score.

### 4. Recency Decay Formula

**Exponential decay** with configurable half-life:

```javascript
const ageInDays = (Date.now() - messageTimestamp) / (1000 * 60 * 60 * 24);
const halfLife = 30; // days (configurable in policy)
const recencyScore = Math.exp(-ageInDays / halfLife);
```

**Visualization**:

```
Recency Score vs Age (30-day half-life)
1.0 ┤█
    │ ██
0.8 │   ██
    │     ██
0.6 │       ███
    │          ███
0.4 │             ████
    │                 █████
0.2 │                      ████████
    │                              ████████████
0.0 └──────────────────────────────────────────────
    0   15  30  45  60  75  90  105 120 135 150 days
```

**Tunable**: Change `half_life_days` in policy to make memories fade faster/slower

---

## Privacy & User Control

### 1. User Data Deletion

**User Request**: "Delete all my data"

**Librarian Process**:

```javascript
async deleteUserData(userId, options = {}) {
  const { 
    backup = true,           // Backup before deleting
    tables = 'all',          // Which categories to delete
    confirm = false          // Safety check
  } = options;
  
  if (!confirm) {
    throw new Error('User must explicitly confirm deletion');
  }
  
  // 1. Create backup if requested
  if (backup) {
    const backupPath = `backups/${userId}_${Date.now()}.db`;
    fs.copyFileSync(this.dbPath, backupPath);
    console.log(`✅ Backup created: ${backupPath}`);
  }
  
  // 2. Delete from specified tables
  const tablesToDelete = tables === 'all' 
    ? ALL_USER_TABLES 
    : tables;
  
  for (const table of tablesToDelete) {
    db.prepare(`DELETE FROM ${table} WHERE user_id = ?`).run(userId);
    console.log(`✅ Deleted from ${table}`);
  }
  
  // 3. Log deletion in audit trail
  db.prepare(`
    INSERT INTO assistant_audit_log (action, user_id, timestamp, metadata)
    VALUES (?, ?, ?, ?)
  `).run('USER_DATA_DELETION', userId, Date.now(), JSON.stringify(options));
  
  console.log(`✅ All data deleted for user ${userId}`);
}
```

### 2. Dynamic Table Management

**Feature**: System can create/delete tables on-the-fly for new data categories

**Example**: User wants to track "books read"

```javascript
// User: "Create a table to track books I've read"

await librarian.createDynamicTable({
  name: 'journal_books',
  columns: {
    title: 'TEXT',
    author: 'TEXT',
    date_finished: 'DATE',
    rating: 'INTEGER',
    notes: 'TEXT'
  },
  backup: true  // Backup DB before schema change
});

// Table created, now user can log books
await librarian.insertInto('journal_books', {
  title: 'Atomic Habits',
  author: 'James Clear',
  date_finished: '2025-10-15',
  rating: 5,
  notes: 'Excellent book on habit formation'
});
```

**Safety**: All schema changes logged and backed up

### 3. PII Sanitization

**Herald Service**: Before sending search queries to external APIs, removes PII

```javascript
// User asks: "How do I manage type 2 diabetes? I'm 45 and live in Seattle"

// Sanitized query sent to Tavily: "How do I manage type 2 diabetes?"
// Removed: age (45), location (Seattle)
```

**Configurable PII categories** in `backend/config/herald_policy.json`:
- Names
- Locations
- Ages
- Phone numbers
- Email addresses
- Financial info

---

## Code Examples

### Example 1: Save Chat Message

```javascript
// In Arthur.js
async saveMessage(sessionId, role, message, metadata = {}) {
  const messageId = uuidv4();
  
  // Generate embedding for semantic search
  const embedding = await this.generateEmbedding(message);
  
  await this.librarian.saveMessage({
    id: messageId,
    session_id: sessionId,
    role: role,
    message: message,
    timestamp: new Date().toISOString(),
    model: metadata.model || this.mainModel,
    tokens_used: metadata.tokens || 0,
    metadata: JSON.stringify(metadata),
    embedding: embedding,
    reference_count: 0,
    is_compressed: 0
  });
  
  return messageId;
}
```

### Example 2: Retrieve Context

```javascript
// In Context Knight
async analyzeContext(userMessage, signals) {
  // Request context from Librarian
  const contextRequest = {
    query: userMessage,
    time_range: 'recent',  // Last 30 days
    limit: 20,
    tables: ['chat_messages', 'journal_entries']
  };
  
  const context = await this.librarian.fulfillContextRequests(contextRequest);
  
  // Process results
  const relevantMemories = context.results.map(r => ({
    content: r.message,
    relevance: r.relevanceScore,
    age: getDaysAgo(r.timestamp),
    referenced: r.reference_count,
    scores: r.scores
  }));
  
  return {
    internal_context_summary: this.summarize(relevantMemories),
    context_requests: [contextRequest],
    gaps: this.identifyGaps(relevantMemories, userMessage),
    relevance_scores: relevantMemories.map(m => m.relevance)
  };
}
```

### Example 3: Age Memories

```javascript
// In Librarian.js
async ageMemories() {
  const compressionDays = this.policy.retention.compression_threshold_days;
  const thresholdDate = new Date();
  thresholdDate.setDate(thresholdDate.getDate() - compressionDays);
  
  // Find old messages
  const oldMessages = this.db.prepare(`
    SELECT id, session_id, role, message, timestamp
    FROM assistant_chat_messages
    WHERE timestamp < ?
    AND is_compressed = 0
    AND is_test = 0
    ORDER BY timestamp ASC
    LIMIT 100
  `).all(thresholdDate.toISOString());
  
  // Group by session
  const sessions = {};
  for (const msg of oldMessages) {
    if (!sessions[msg.session_id]) sessions[msg.session_id] = [];
    sessions[msg.session_id].push(msg);
  }
  
  // Compress each session
  for (const [sessionId, messages] of Object.entries(sessions)) {
    const summary = await this.compressMessages(messages);
    const summaryEmbedding = await this.generateEmbedding(summary);
    
    // Update first message with summary, delete others
    this.db.prepare(`
      UPDATE assistant_chat_messages
      SET message = ?, is_compressed = 1, embedding = ?
      WHERE id = ?
    `).run(summary, summaryEmbedding, messages[0].id);
    
    for (let i = 1; i < messages.length; i++) {
      this.db.prepare('DELETE FROM assistant_chat_messages WHERE id = ?')
        .run(messages[i].id);
    }
    
    this.metrics.memoriesCompressed += messages.length;
    console.log(`✅ Compressed session ${sessionId}: ${messages.length} → 1 summary`);
  }
}
```

---

## Quick Reference

### Key Tables
- **`assistant_chat_messages`** - All conversations (most queried)
- **`reference_documents`** - Uploaded files
- **`journal_entries`** - Personal journal
- **`wellness_*`** - Health tracking (8 tables)

### 3D Scoring Weights (Default)
- Semantic: **40%** (most important)
- Recency: **25%** (prefer recent)
- Frequency: **20%** (boost useful memories)
- Vehemence: **15%** (remember emotional moments)

### Aging Thresholds (Default)
- Compression: **90 days**
- Archive: **365 days**
- Deletion: **730 days** (disabled by default)

### Key Files
- `backend/services/Librarian.js` - All DB operations
- `backend/config/librarian_policy.json` - Scoring weights & retention
- `backend/db/initDatabase.js` - Schema definitions

---

## Summary

**How ARTHUR stores data:**
1. SQLite database with 30 tables across 4 categories
2. All text content gets vector embeddings for semantic search
3. Only Librarian service has database access
4. Metadata (emotion signals, weights) stored as JSON

**How ARTHUR retrieves data:**
1. **3D Relevance Scoring** (Semantic + Recency + Frequency + Vehemence)
2. Context Knight requests relevant context
3. Librarian calculates scores and returns top N results
4. Reference count incremented when message retrieved
5. Arthur synthesizes response using retrieved context

**How ARTHUR ages data:**
1. **Fresh** (0-90 days): Full detail, fast queries
2. **Compressed** (90-365 days): LLM-summarized, embeddings updated
3. **Archived** (365-730 days): Moved to archive, lower priority
4. **Deleted** (730+ days): Removed with user consent
5. **Frequency score** keeps useful memories relevant despite aging

**Key principles:**
- ✅ Local-first (all data stored locally in SQLite)
- ✅ Privacy-first (PII sanitization, user data deletion)
- ✅ Context-aware (3D scoring finds most relevant memories)
- ✅ Adaptive (frequent references prevent important memories from fading)
- ✅ Configurable (all thresholds and weights in policy files)

---

**Questions?** See `backend/services/Librarian.js` for implementation details.

Copyright (c) 2025 Scott Crawford. All rights reserved.
