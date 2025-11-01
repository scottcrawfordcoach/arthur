# LLM Decision Matrix for Arthur Roundtable Architecture

**Date:** October 22, 2025  
**Updated:** Multi-tier LLM strategy (Haiku/GPT-4o-mini/GPT-5)  
**Purpose:** Ensure adaptive intelligence at all critical decision points  
**Philosophy:** Make the high-level LLM's job as EASY as possible

---

## Core Paradigm: Division of Labor

**The Roundtable Architecture assigns specialized roles to optimize intelligence and cost.**

**Without Specialization (Monolithic LLM):**
```
Arthur gets: Raw database dumps, unfiltered history, web results
Arthur must: Filter noise, detect patterns, analyze emotions, synthesize response
Result: Slow, expensive ($0.120/message), inconsistent quality
```

**With Roundtable Architecture:**
```
Evidence Council: Knights analyze specific signals (emotion, needs, patterns)
Librarian & Herald: Curate and summarize relevant data
Arthur receives: Clear signals + curated context
Arthur focuses on: Final synthesis with appropriate persona balance
Result: Fast (<3s), affordable ($0.0335/message), exceptional quality
```

**The underlying paradigm: Specialized preparation enables exceptional synthesis.**

*(Technical analogy: Like a professional kitchen where prep cooks enable the head chef to focus on excellence rather than chopping vegetables)*

Liberal use of cheap LLMs (GPT-4o-mini, Haiku) in prep = Better, faster, cheaper final result.

---

## Updated Model Selection Strategy

### Tier 1: Lightning-Fast Prep (Haiku)
**Use Case:** Knights that need speed + intelligence  
**Model:** Claude 3.5 Haiku  
**Cost:** ~$0.00025 per 1K tokens (input), ~$0.00125 per 1K tokens (output)  
**Speed:** ~200-300ms  

**Best For:**
- ✅ Emotion Knight (real-time emotion detection)
- ✅ Needs Knight (quick latent needs inference)
- ✅ Pattern Knight (if LLM layer needed for themes)

**Why Haiku:**
- Faster than GPT-4o-mini for simple analysis
- Excellent at classification and pattern detection
- Cost-effective for high-frequency calls
- Good enough for signal generation

### Tier 2: Balanced Prep (GPT-4o-mini)
**Use Case:** Knights needing deeper reasoning  
**Model:** GPT-4o-mini  
**Cost:** ~$0.00015 per 1K tokens (input), ~$0.0006 per 1K tokens (output)  
**Speed:** ~300-500ms  

**Best For:**
- ✅ Context Knight (context relevance judgment)
- ✅ Analysis Knight (synthesizing multiple signals)
- ✅ Librarian curation (summarizing DB results)
- ✅ Herald (sanitizing queries, summarizing web results)

**Why GPT-4o-mini:**
- Better reasoning than Haiku for complex synthesis
- Excellent at summarization
- Good balance of cost/quality
- Reliable JSON output

### Tier 3: Master Chef (GPT-5)
**Use Case:** Final response synthesis  
**Model:** GPT-5  
**Cost:** TBD (likely ~$0.03-0.05 per 1K tokens)  
**Speed:** ~1-2s  

**Best For:**
- ✅ Arthur final response synthesis (ONLY)

**Why GPT-5:**
- Highest quality reasoning and synthesis
- Best coaching tone and empathy
- Can weave complex context naturally
- Worth the cost for user-facing quality
- User only sees THIS response

---

## Core Principle

**Code is fast but rigid. Cheap LLMs prep intelligently. Expensive LLM synthesizes perfectly.**

The right architecture uses:
- **Code:** Pattern matching, data retrieval, routing, validation
- **LLM:** Understanding context, detecting nuance, making judgment calls, synthesis

---

## Component-by-Component Analysis

### 1. Evidence Council Knights

#### ✅ Emotion Knight (CURRENT)
```javascript
Quick Pattern Check (CODE)
    ↓
Crisis detected? → Return immediately (fast!)
    ↓ NO
LLM Analysis (GPT-4o-mini) → Nuanced emotion detection
    ↓ FAIL
Fallback to Pattern (CODE)
```

**Assessment:** ✅ **CORRECT**
- Crisis = code (safety-critical speed)
- Nuance = LLM (adaptive understanding)
- Fallback = code (reliability)

---

#### 🤔 Needs Knight (TO BUILD)

**Option A: Pattern-Only (WRONG)**
```javascript
if (message.includes('how')) return { stated_intent: 'information' };
if (message.includes('help')) return { stated_intent: 'guidance' };
// Misses: "I'm wondering..." = exploration, not just information
```

**Option B: LLM-First (CORRECT)**
```javascript
Quick Pattern Check (CODE)
    ↓
Obvious patterns? (help, urgent, etc.)
    ↓ NO
LLM Analysis (GPT-4o-mini)
    ↓
Detect latent needs vs stated intent
    ↓
"I'm stuck" → stated: information, latent: emotional_support
"What should I do?" → stated: guidance, latent: validation
"How does this work?" → stated: information, latent: learning
```

**Decision:** ✅ **NEEDS LLM**
- Latent needs require understanding subtext
- Stated vs actual intent is nuanced
- Learning intent requires context interpretation

---

#### 🤔 Pattern Knight (TO BUILD)

**Option A: Pure Code (TEMPTING BUT LIMITED)**
```javascript
// Count topic occurrences
const topics = {};
conversationHistory.forEach(msg => {
  // Simple keyword matching
  if (msg.includes('training')) topics.training++;
});
// Misses: synonyms, themes, evolving patterns
```

**Option B: Hybrid Code + LLM (CORRECT)**
```javascript
// CODE: Fast pattern detection
const codePatterns = {
  conversation_rhythm: detectTimingPatterns(conversationHistory),
  message_frequency: calculateFrequency(conversationHistory)
};

// LLM: Theme and trend detection
const llmAnalysis = await analyzeBehavioralTrends(conversationHistory);
// Detects: "training plateau" recurring theme
//          shift from "excited" to "frustrated" over time
//          synonym clustering ("stuck", "plateau", "not progressing")

return merge(codePatterns, llmAnalysis);
```

**Decision:** ⚠️ **NEEDS HYBRID**
- Timing/frequency = code (fast, deterministic)
- Theme detection = LLM (understands synonyms, context)
- Trend analysis = LLM (sees subtle shifts)

---

#### 🤔 Context Knight (TO BUILD)

**What It Does:** Determines WHAT context to request (doesn't fetch)

**Option A: Rule-Based (LIMITED)**
```javascript
if (intent === 'wellness') {
  return { request: 'wellness_data', lookback: '30d' };
}
// Misses: nuanced context needs
```

**Option B: LLM-Assisted (CORRECT)**
```javascript
// CODE: Obvious routing
if (signals.risk > 0.7) {
  return { priority: ['conversation_history', 'crisis_resources'] };
}

// LLM: Determine context relevance
const contextNeeds = await determineContextNeeds({
  userMessage,
  emotionSignals,
  needsSignals,
  patternSignals
});
// LLM understands:
// "stuck again" → needs past plateau conversations
// "new approach" → needs reference_library research
// "feeling better" → needs recent wellness trends
```

**Decision:** ✅ **NEEDS LLM**
- Context relevance is nuanced
- Must understand implicit references
- Prioritization requires judgment

---

#### ✅ Analysis Knight (TO BUILD)

**Critical Decision Point:** Synthesize all signals + decide Herald invocation

**Must Use LLM:**
```javascript
const synthesis = await synthesizeSignals({
  emotion: { mood: 'frustrated', urgency: 0.6 },
  needs: { latent_need: 'emotional_support', learning_intent: 0.7 },
  pattern: { recurring_topics: ['training_plateau'] },
  context: { novelty: 0.3 }
});

// LLM determines:
// - Are signals contradictory? (high urgency + low risk?)
// - What's the PRIMARY need? (coaching vs information)
// - Should Herald search? (new info needed or KB sufficient?)
// - What's the overall recommendation for Arthur?
```

**Decision:** ✅ **ABSOLUTELY NEEDS LLM**
- Synthesizing multiple signal sources requires intelligence
- Detecting contradictions needs reasoning
- Herald invocation is a judgment call
- Recommendation to Arthur shapes entire response

---

### 2. Librarian (Data Handler)

#### 🤔 When to Use LLM?

**Data Retrieval:** ❌ **NO LLM** (SQL/code)
```javascript
// Just fetch data efficiently
const history = db.query('SELECT * FROM messages WHERE...');
```

**Data Summarization:** ✅ **YES LLM** (when returning to Arthur)
```javascript
// Librarian gets 50 conversation messages
// Instead of returning all 50:
const summary = await summarizeConversationHistory(messages);
// Returns: "User discussed training plateau 3 times, 
//           showing increasing frustration. Last mentioned 
//           trying new approach 2 days ago."
```

**Decision:** ⚠️ **HYBRID**
- Retrieval = code (fast, exact)
- Summarization = LLM (compress intelligently)
- Ranking = LLM (what's most relevant?)

---

### 3. Herald (Researcher)

#### ✅ When to Use LLM?

**Web Search API Call:** ❌ **NO LLM** (Tavily API)
```javascript
const results = await tavily.search(query);
```

**Query Sanitization:** ✅ **YES LLM**
```javascript
// Remove personal info before searching
const sanitized = await sanitizeQuery(
  "I'm John Doe and struggling with training at 123 Main St"
);
// Returns: "struggling with training plateau"
```

**Results Summarization:** ✅ **YES LLM**
```javascript
// Herald gets 10 web search results
// LLM summarizes into coherent context
const summary = await summarizeWebResults(results, originalQuery);
// Returns: "Current research (2025) suggests plateau 
//           breaking requires periodization and..."
```

**Decision:** ✅ **NEEDS LLM**
- Query sanitization protects privacy (needs understanding)
- Results summarization provides coherent context
- Relevance filtering needs judgment

---

### 4. Arthur (Orchestrator)

#### ✅ Response Synthesis

**This is THE place for highest-quality LLM:**

```javascript
// INPUT: Signals + Context + Policy
const signals = evidenceCouncil.getSignals();
const context = {
  from_librarian: conversationHistory + semanticSearch,
  from_herald: webSearchResults
};
const policy = loadInfluencerPolicy();

// COMPUTE WEIGHTS (CODE)
const weights = computeInfluencerWeights(signals, policy);
// { teacher: 0.2, coach: 0.6, problem_solver: 0.2 }

// SYNTHESIS (HIGH-QUALITY LLM)
const response = await openai.chat.completions.create({
  model: 'gpt-4o', // or gpt-4 for complex cases
  messages: [
    { role: 'system', content: buildSystemPrompt(weights, policy) },
    { role: 'user', content: buildUserPrompt(userMessage, context, signals) }
  ]
});
```

**Decision:** ✅ **MUST USE BEST LLM**
- Final response quality is paramount
- Must balance multiple influencer voices
- Needs to weave context naturally
- Coaching tone requires sophistication

---

## Updated LLM Usage Summary

### Required LLM Components

| Component | LLM Model | Purpose | Cost per Call | Speed |
|-----------|-----------|---------|---------------|-------|
| **Emotion Knight** | **Haiku 3.5** | Fast emotion detection | $0.0003 | 200ms |
| **Needs Knight** | **Haiku 3.5** | Quick latent needs inference | $0.0003 | 200ms |
| **Pattern Knight** | **Haiku 3.5** | Theme detection (if needed) | $0.0003 | 200ms |
| **Context Knight** | **GPT-4o-mini** | Context relevance judgment | $0.0005 | 400ms |
| **Analysis Knight** | **GPT-4o-mini** | Signal synthesis | $0.0008 | 500ms |
| **Librarian** | **GPT-4o-mini** | Summarize large data | $0.0005 | 400ms |
| **Herald** | **GPT-4o-mini** | Sanitize + summarize web | $0.0008 | 500ms |
| **Arthur** | **GPT-5** 🌟 | Final response synthesis | **$0.030** | 1-2s |

### Total Cost per Message

**Prep Layer (Knights + Librarian + Herald):**
- Emotion Knight (Haiku): $0.0003
- Needs Knight (Haiku): $0.0003  
- Pattern Knight (Haiku): $0.0003
- Context Knight (4o-mini): $0.0005
- Analysis Knight (4o-mini): $0.0008
- Librarian (4o-mini): $0.0005
- Herald (4o-mini, if invoked): $0.0008
- **Prep Total: ~$0.0035** (less than half a penny)

**Final Synthesis (Arthur):**
- GPT-5: ~$0.030 (3 cents)

**Grand Total: ~$0.0335 per message** (~3.4 cents)

### Cost Optimization Strategy

**Cheap Prep (Haiku + 4o-mini): $0.0035**
- All Knights generate clean signals
- Librarian curates data
- Herald summarizes web results
- Everything optimized for GPT-5

**Premium Synthesis (GPT-5): $0.030**
- Receives perfectly prepped context
- Focuses on quality, tone, empathy
- No time wasted on data cleaning
- User sees exceptional quality

**The Math:**
- Without prep: GPT-5 processes raw data (4000 tokens) = $0.120
- With prep: GPT-5 processes curated context (1000 tokens) = $0.030
- **Savings: $0.090 per message** by spending $0.0035 on prep!

---

## Critical Oversight Points

### 1. **Emotion Knight** 
✅ LLM detects nuanced tone
- Prevents misreading sarcasm, subtle distress
- Example: "I'm fine" (frustrated tone) vs "I'm fine" (actually fine)

### 2. **Needs Knight**
✅ LLM detects latent needs
- Prevents giving answers when coaching needed
- Example: "What should I do?" might need validation, not instructions

### 3. **Pattern Knight**
✅ LLM detects themes and trends
- Prevents missing patterns across synonym variations
- Example: "stuck", "plateau", "not progressing" = same pattern

### 4. **Context Knight**
✅ LLM determines context relevance
- Prevents fetching irrelevant data
- Example: "last time" requires understanding which "last time"

### 5. **Analysis Knight**
✅ LLM synthesizes signals
- Prevents contradictory or incomplete recommendations
- Example: High urgency + low risk → needs triage, not emergency

### 6. **Herald**
✅ LLM sanitizes and summarizes
- Prevents privacy leaks in web searches
- Prevents information overload from raw results

### 7. **Arthur**
✅ High-quality LLM for final synthesis
- Prevents robotic, inconsistent responses
- Enables coaching tone, empathy, nuance

---

## What Happens Without LLM Oversight?

### Pattern-Only Emotion Knight:
```
User: "I'm fine, really. Just... fine."
Pattern: No negative keywords → neutral mood
❌ WRONG: User is clearly NOT fine (sarcasm, resignation)
✅ LLM: Detects sarcasm, resignation → frustrated mood
```

### Pattern-Only Needs Knight:
```
User: "What should I do about this plateau?"
Pattern: "What should I do" → stated_intent: guidance
❌ MISSES: latent_need might be validation, not instructions
✅ LLM: Understands context, detects seeking reassurance
```

### Pattern-Only Context Knight:
```
User: "This happened last time too"
Pattern: Grabs most recent conversation
❌ WRONG: "last time" might reference weeks/months ago
✅ LLM: Understands "last time" from conversation context
```

### No Analysis Knight LLM:
```
Signals: { mood: frustrated, urgency: 0.8, learning_intent: 0.7 }
Code: Returns all signals as-is
❌ MISSES: Contradiction (learning takes time, urgency needs speed)
✅ LLM: Detects tension, recommends immediate tactical + long-term learning
```

---

## Implementation Checklist

### Phase 3.2 (Current - Knights)
- [x] **Emotion Knight:** LLM for nuanced analysis ✅
- [ ] **Needs Knight:** LLM for latent needs detection (REQUIRED)
- [ ] **Pattern Knight:** LLM for theme/trend detection (REQUIRED)
- [ ] **Context Knight:** LLM for relevance judgment (REQUIRED)
- [ ] **Analysis Knight:** LLM for synthesis (REQUIRED)

### Phase 4 (Librarian & Herald)
- [ ] **Librarian:** LLM for summarization (OPTIONAL but valuable)
- [ ] **Herald:** LLM for sanitization + summarization (REQUIRED)

### Phase 5 (Arthur)
- [ ] **Arthur:** GPT-4o/GPT-4 for final synthesis (ABSOLUTELY REQUIRED)

---

## Cost Considerations

### Token Usage Estimates (per user message)

| Component | Tokens In | Tokens Out | Model | Cost |
|-----------|-----------|------------|-------|------|
| Emotion Knight | ~200 | ~100 | 4o-mini | $0.0001 |
| Needs Knight | ~300 | ~150 | 4o-mini | $0.0002 |
| Pattern Knight | ~500 | ~200 | 4o-mini | $0.0003 |
| Context Knight | ~300 | ~150 | 4o-mini | $0.0002 |
| Analysis Knight | ~600 | ~200 | 4o-mini | $0.0003 |
| Herald (if invoked) | ~800 | ~300 | 4o-mini | $0.0005 |
| **Arthur (synthesis)** | ~2000 | ~500 | **4o** | **$0.0075** |
| **TOTAL per message** | ~4700 | ~1600 | Mixed | **~$0.009** |

**~0.9 cents per user message** - affordable for quality adaptive intelligence!

---

## Recommendation

✅ **Multi-Tier LLM Strategy for the Roundtable Architecture**
- **Haiku** for Evidence Council Knights (emotion, needs, patterns) - Fast signal generation
- **GPT-4o-mini** for complex synthesis (Context/Analysis Knights, Librarian, Herald) - Reasoning
- **GPT-5** for Arthur's final response - Highest quality synthesis

This ensures **adaptive intelligence at all critical decision points** while:
- Optimizing for speed (Haiku is faster than 4o-mini for classification)
- Minimizing cost (Evidence Council prep layer is cheap)
- Maximizing quality (Arthur receives clear signals, not raw noise)
- Reducing tokens (curated context from Librarian/Herald, not raw database dumps)

**The Roundtable Flow:**
```
User Message
    ↓
Evidence Council (Haiku) → Clear signals about user state
    ↓
Librarian & Herald (4o-mini) → Curated, relevant context
    ↓
Arthur (GPT-5) → Receives perfect prep, focuses on synthesis
    ↓
Exceptional Response
```

**Key Insight:** Spending $0.0035 on specialized preparation (Knights + data curation) saves $0.090 on final synthesis AND improves quality.

---

**The alternative (skip preparation, use GPT-5 for everything) costs 4x more and produces worse results because GPT-5 wastes tokens on signal detection and data cleaning instead of synthesis.**

**Arthur's value comes from the Roundtable's collective intelligence + exceptional final synthesis.**

---

## Implementation Guide

### 1. Environment Variables (.env)
```bash
# Already have these:
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# Optional: Model selection
KNIGHT_MODEL=haiku          # haiku | gpt-4o-mini
SYNTHESIS_MODEL=gpt-4o-mini # gpt-4o-mini | gpt-4o
ARTHUR_MODEL=gpt-5          # gpt-5 | gpt-4o
```

### 2. Model Service (backend/services/modelService.js)
```javascript
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

class ModelService {
  constructor() {
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    this.anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }

  async callKnight(prompt, options = {}) {
    const model = process.env.KNIGHT_MODEL || 'haiku';
    
    if (model === 'haiku') {
      return await this.callHaiku(prompt, options);
    } else {
      return await this.callGPT4oMini(prompt, options);
    }
  }

  async callSynthesis(prompt, options = {}) {
    const model = process.env.SYNTHESIS_MODEL || 'gpt-4o-mini';
    return await this.callOpenAI(prompt, { model, ...options });
  }

  async callArthur(messages, options = {}) {
    const model = process.env.ARTHUR_MODEL || 'gpt-5';
    return await this.callOpenAI(messages, { model, ...options });
  }

  async callHaiku(prompt, options = {}) {
    const response = await this.anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: options.max_tokens || 1024,
      temperature: options.temperature || 0.3,
      messages: [{ role: 'user', content: prompt }]
    });
    return response.content[0].text;
  }

  async callGPT4oMini(prompt, options = {}) {
    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: options.temperature || 0.3,
      max_tokens: options.max_tokens || 1024
    });
    return response.choices[0].message.content;
  }

  async callOpenAI(messages, options = {}) {
    const response = await this.openai.chat.completions.create({
      model: options.model || 'gpt-4o-mini',
      messages: Array.isArray(messages) ? messages : [{ role: 'user', content: messages }],
      temperature: options.temperature || 0.3,
      max_tokens: options.max_tokens || 2048
    });
    return response.choices[0].message.content;
  }
}

export default new ModelService();
```

### 3. Knight Updates
```javascript
// EmotionKnight.js - USE HAIKU
import modelService from '../services/modelService.js';

async llmAnalysis(userMessage) {
  const prompt = `You are an expert emotion analyst...
  
  User message: "${userMessage}"
  
  Provide JSON: {...}`;
  
  const response = await modelService.callKnight(prompt);
  const analysis = JSON.parse(response);
  
  return this.createResult(analysis, 0.85, 'Haiku-based emotion analysis');
}
```

### 4. Analysis Knight - USE GPT-4o-mini
```javascript
// AnalysisKnight.js - MORE COMPLEX SYNTHESIS
import modelService from '../services/modelService.js';

async llmSynthesis(allSignals) {
  const prompt = `Synthesize these signals from Evidence Council...`;
  
  const response = await modelService.callSynthesis(prompt);
  return JSON.parse(response);
}
```

### 5. Arthur Orchestrator - USE GPT-5
```javascript
// Arthur.js - FINAL RESPONSE
import modelService from '../services/modelService.js';

async synthesizeResponse(userMessage, signals, context, policy) {
  const messages = [
    { role: 'system', content: this.buildSystemPrompt(policy, signals) },
    { role: 'user', content: this.buildUserPrompt(userMessage, context, signals) }
  ];
  
  const response = await modelService.callArthur(messages, {
    temperature: 0.7, // Higher for natural conversation
    max_tokens: 2048
  });
  
  return response;
}

buildSystemPrompt(policy, signals) {
  const weights = this.computeInfluencerWeights(signals, policy);
  
  return `You are Arthur, an adaptive AI assistant using the Roundtable architecture.

Your Advisory Council weights for this response:
- Teacher: ${weights.teacher} (explain and contextualize)
- Coach: ${weights.coach} (encourage reflection and growth)
- Problem Solver: ${weights.problem_solver} (provide direct solutions)

User's emotional state: ${signals.emotion.mood} (sentiment: ${signals.emotion.sentiment})
User's actual need: ${signals.needs.latent_need} vs stated: ${signals.needs.stated_intent}
Urgency: ${signals.emotion.urgency}
Risk level: ${signals.emotion.risk}

Respond with the appropriate balance of teaching, coaching, and problem-solving.
Be warm, professional, and adapt your tone to the user's emotional state.`;
}
```

### 6. Model Selection Logic
```javascript
// Automatic fallback chain
class ModelService {
  async callArthur(messages, options = {}) {
    try {
      // Try GPT-5 first
      return await this.callOpenAI(messages, { model: 'gpt-5', ...options });
    } catch (error) {
      if (error.code === 'model_not_found') {
        console.warn('GPT-5 not available, falling back to GPT-4o');
        return await this.callOpenAI(messages, { model: 'gpt-4o', ...options });
      }
      throw error;
    }
  }
}
```

---

## Performance Characteristics

### Haiku (Evidence Council Knights)
- **Latency:** 200-300ms
- **Throughput:** High (can handle many parallel calls)
- **Best for:** Classification, signal generation, pattern detection
- **JSON reliability:** Excellent
- **Role:** Fast analysis in the Evidence Council

### GPT-4o-mini (Librarian & Herald)
- **Latency:** 300-500ms
- **Throughput:** Medium
- **Best for:** Summarization, context curation, multi-signal synthesis
- **Reasoning:** Good for complex tasks
- **Role:** Data preparation for Arthur

### GPT-5 (Arthur Orchestrator)
- **Latency:** 1-2s
- **Throughput:** Lower (but only 1 call per user message)
- **Best for:** Final response quality, natural conversation, empathy
- **Reasoning:** Exceptional
- **Role:** Final synthesis at the Roundtable

### Total Response Time (Roundtable Pipeline)
```
Evidence Council (parallel): 300ms (Haiku × 3 Knights)
Context Knight: 400ms (4o-mini, uses Council signals)
Analysis Knight: 500ms (4o-mini, synthesizes all signals)
Librarian: 400ms (4o-mini, parallel with Context)
Herald: 500ms (4o-mini, if needed, parallel)
Arthur: 1500ms (GPT-5, final synthesis)

Sequential path: ~2.7s
With parallelization: ~2.2s
```

**User perception: <3s for exceptional, adaptive response**

---

## Next Steps

1. ✅ Create `modelService.js` with Haiku + GPT-5 support
2. ✅ Update EmotionKnight to use `modelService.callKnight()`
3. ✅ Build NeedsKnight with Haiku
4. ✅ Build PatternKnight with Haiku
5. ✅ Build ContextKnight with GPT-4o-mini
6. ✅ Build AnalysisKnight with GPT-4o-mini
7. ✅ Build Librarian with GPT-4o-mini curation
8. ✅ Build Arthur with GPT-5 synthesis
9. ✅ Test full Roundtable pipeline with cost/latency monitoring

**The Roundtable is ready to convene! ⚔️**
