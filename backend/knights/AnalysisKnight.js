// Copyright (c) 2025 Scott Crawford. All rights reserved.

/**
 * ANALYSIS KNIGHT
 * 
 * The final Evidence Council member - synthesizes all Knight signals
 * into unified recommendations for Arthur.
 * 
 * Role: Strategic Synthesis
 * - Combines emotion, needs, pattern, and context signals
 * - Detects contradictions and ambiguity
 * - Determines if Herald (web search) should be invoked
 * - Identifies knowledge gaps
 * - Provides final confidence assessment
 * 
 * Model: GPT-4o-mini (complex multi-signal reasoning)
 * 
 * Output Signals:
 * - synthesized_signals: Unified interpretation of all Knight inputs
 * - herald_recommendation: Should external search happen? (invoke, reason, query, priority)
 * - ambiguity_detected: Are signals contradictory or unclear?
 * - knowledge_gaps: What information is missing?
 * - confidence: Overall confidence in understanding user intent
 * - recommendation: Primary action Arthur should take
 */

import KnightBase from './KnightBase.js';
import OpenAI from 'openai';

class AnalysisKnight extends KnightBase {
  constructor() {
    super('analysis');
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  /**
   * Synthesize all Knight signals into final recommendations
   * @param {string} userMessage - Current user message
   * @param {Object} context - All Knight signals
   * @returns {Promise<Object>} Analysis signals
   */
  async analyze(userMessage, context = {}) {
    try {
      const { emotion, needs, pattern, contextKnight } = context;
      
      // Quick analysis for baseline
      const quickAnalysis = this.quickAnalysis(userMessage, { emotion, needs, pattern, contextKnight });
      
      // If disabled or no API key, return pattern-based analysis
      if (!this.enabled || !process.env.OPENAI_API_KEY) {
        return this.createResult(quickAnalysis, 0.65, 'Pattern-based synthesis (LLM disabled)');
      }

      // LLM-based deep synthesis
      return await this.llmAnalysis(userMessage, { emotion, needs, pattern, contextKnight }, quickAnalysis);
      
    } catch (error) {
      return this.handleError(error, userMessage);
    }
  }

  /**
   * Quick pattern-based synthesis (heuristics)
   * @param {string} userMessage - Current message
   * @param {Object} signals - All Knight signals
   * @returns {Object} Basic analysis signals
   */
  quickAnalysis(userMessage, signals) {
    const { emotion, needs, pattern, contextKnight } = signals;
    
    // Default synthesis
    const synthesized_signals = {
      primary_intent: needs?.latent_need || needs?.stated_intent || 'information',
      emotional_context: emotion?.mood || 'neutral',
      urgency_level: emotion?.urgency || 0.3,
      pattern_context: pattern?.recurring_topics?.length > 0 ? 'recurring' : 'novel'
    };
    
    // Herald recommendation logic
    const herald_recommendation = {
      invoke: false,
      reason: '',
      search_query: '',
      priority: 'none'
    };
    
    // Internal-first guardrails
    const msg = (userMessage || '').toLowerCase();
    const userRequestedInternalOnly = /(without\s+using\s+(a\s+)?web\s+search|no\s+web(\s+search)?|local\s+only|internal\s+only|from\s+(your|my)\s+(files|library|reference\s+library))/i.test(msg);
    const hasReferenceLibraryRequest = Array.isArray(contextKnight?.context_requests?.semantic_search)
      && contextKnight.context_requests.semantic_search.some(s => (s.tier === 'reference_library'));
    const libraryIntent = /(reference\s+library|your\s+library|books\s+in\s+(your|the)\s+library|book\s+list|list\s+of\s+books)/i.test(msg);
    
    if (userRequestedInternalOnly || hasReferenceLibraryRequest || libraryIntent) {
      herald_recommendation.invoke = false;
      herald_recommendation.reason = userRequestedInternalOnly
        ? 'User requested internal sources only'
        : 'Internal reference library is available and requested; try Librarian first';
      herald_recommendation.search_query = '';
      herald_recommendation.priority = 'none';
    }
    
    // Invoke Herald if:
    // 1. High learning intent + novel topic + no patterns
    if (!herald_recommendation.invoke && (needs?.learning_intent > 0.7 && contextKnight?.novelty > 0.7)) {
      // Only consider Herald if not explicitly guarded by internal-first rules
      herald_recommendation.invoke = true;
      herald_recommendation.reason = 'New learning topic with no historical context';
      herald_recommendation.search_query = userMessage;
      herald_recommendation.priority = 'primary';
    }
    
    // 2. Explicit question pattern with no known context
    const questionPatterns = /^(what|how|why|when|where|who|can you explain|tell me about)/i;
    if (!herald_recommendation.invoke && questionPatterns.test(userMessage.trim()) && contextKnight?.novelty > 0.6) {
      herald_recommendation.invoke = true;
      herald_recommendation.reason = 'Direct question about potentially unfamiliar topic';
      herald_recommendation.search_query = userMessage;
      herald_recommendation.priority = 'fallback';
    }
    
    // Detect ambiguity
    const ambiguity_detected = [];
    
    // Check for signal contradictions
    if (emotion?.urgency > 0.7 && needs?.learning_intent > 0.7) {
      ambiguity_detected.push('High urgency conflicts with deep learning intent');
    }
    
    if (emotion?.sentiment < -0.5 && needs?.exploratory > 0.7) {
      ambiguity_detected.push('Negative emotion conflicts with exploratory intent');
    }
    
    // Knowledge gaps
    const knowledge_gaps = [];
    
    if (contextKnight?.novelty > 0.7 && !pattern?.recurring_topics?.length) {
      knowledge_gaps.push('No historical context for this topic');
    }
    
    if (emotion?.risk > 0.6 && (!contextKnight?.context_requests?.user_data || contextKnight.context_requests.user_data.length === 0)) {
      knowledge_gaps.push('High risk but no user coping strategies retrieved');
    }
    
    // Overall confidence
    const confidence = this.calculateConfidence({
      emotion,
      needs,
      pattern,
      contextKnight,
      ambiguity_detected
    });
    
    // Primary recommendation
    const recommendation = this.determineRecommendation({
      emotion,
      needs,
      pattern,
      herald_recommendation
    });
    
    return {
      synthesized_signals,
      herald_recommendation,
      ambiguity_detected,
      knowledge_gaps,
      confidence,
      recommendation
    };
  }

  /**
   * LLM-based deep synthesis (complex reasoning)
   * @param {string} userMessage - Current message
   * @param {Object} signals - All Knight signals
   * @param {Object} quickAnalysis - Pattern-based baseline
   * @returns {Promise<Object>} Analysis result
   */
  async llmAnalysis(userMessage, signals, quickAnalysis) {
    const { emotion, needs, pattern, contextKnight } = signals;
    
    // Build comprehensive context summary
    const emotionSummary = emotion ? `
Emotional Signals:
- Mood: ${emotion.mood}
- Sentiment: ${emotion.sentiment} (-1 negative to +1 positive)
- Urgency: ${emotion.urgency} (0-1 scale)
- Risk: ${emotion.risk} (0-1 scale)
- Energy: ${emotion.energy_level || 'unknown'}` : 'No emotional signals available';

    const needsSummary = needs ? `
User Needs:
- Stated intent: ${needs.stated_intent}
- Latent need: ${needs.latent_need}
- Learning intent: ${needs.learning_intent} (0-1 scale)
- Support needed: [${needs.support_needed.join(', ')}]
- Goal alignment: ${needs.goal_alignment}
- Exploratory: ${needs.exploratory}
- Confidence: ${needs.needs_confidence}` : 'No needs signals available';

    const patternSummary = pattern && pattern.recurring_topics?.length > 0 ? `
Conversation Patterns:
- Recurring topics: [${pattern.recurring_topics.join(', ')}]
- Topic frequency: ${JSON.stringify(pattern.topic_frequency || {})}
- Behavior trends: [${pattern.behavior_trends?.join(', ') || 'none'}]
- Conversation rhythm: ${pattern.conversation_rhythm || 'unknown'}
- Pattern strength: ${pattern.pattern_strength}` : 'No conversation history (new user or first interaction)';

    const contextSummary = contextKnight ? `
Context Requests:
- Semantic searches: ${contextKnight.context_requests?.semantic_search?.length || 0}
- Timeline requested: ${contextKnight.context_requests?.conversation_history?.lookback || 'none'}
- User data requested: [${contextKnight.context_requests?.user_data?.join(', ') || 'none'}]
- Novelty: ${contextKnight.novelty} (0=recurring, 1=new topic)
- Priority: [${contextKnight.context_priority?.join(', ') || 'none'}]` : 'No context signals available';

    const prompt = `You are the Analysis Knight - the strategic synthesizer of the Evidence Council.

Your role is to analyze ALL Knight signals and provide unified strategic recommendations.

User message: "${userMessage}"

${emotionSummary}

${needsSummary}

${patternSummary}

${contextSummary}

Your task is to synthesize these signals and determine:

1. **synthesized_signals**: What is the unified interpretation? (object)
   {
     primary_intent: "What user primarily needs" (string),
     emotional_context: "Summary of emotional state" (string),
     urgency_level: 0-1 (number),
     pattern_context: "recurring" | "novel" | "mixed" (string),
     complexity: "simple" | "moderate" | "complex" (string)
   }

2. **herald_recommendation**: Should we invoke external search (Herald)? (object)
   {
     invoke: true/false,
     reason: "Why external search is/isn't needed",
     search_query: "Query to search" (empty if invoke=false),
     priority: "primary" | "fallback" | "none"
   }
   
   Invoke Herald when:
   - New topic (novelty > 0.7) + high learning intent (> 0.7)
   - Direct factual question with no historical context
   - User explicitly asks for current information
   - Knowledge gap detected that internal context can't fill
   
   Do NOT invoke Herald when:
   - Emotional support needed (personal context more important)
   - Recurring topic with strong patterns (we have history)
   - Personal/introspective questions
   - Crisis situations (need immediate response, not research)

3. **ambiguity_detected**: Are signals contradictory or unclear? (array of strings)
   Examples:
   - "High urgency conflicts with deep learning intent"
   - "Negative emotion but exploratory behavior"
   - "Crisis signals but casual tone"

4. **knowledge_gaps**: What information is missing? (array of strings)
   Examples:
   - "No historical context for this topic"
   - "User's coping strategies unknown"
   - "Previous attempts at solving this unclear"

5. **confidence**: Overall confidence in understanding user intent (0-1)
   - 0.9-1.0: Clear signals, no contradictions
   - 0.7-0.89: Good signals, minor ambiguity
   - 0.5-0.69: Moderate ambiguity or gaps
   - < 0.5: Significant contradictions or missing context

6. **recommendation**: Primary action for Arthur (string)
   Options:
   - "provide_emotional_support"
   - "answer_learning_question"
   - "guide_problem_solving"
   - "explore_together"
   - "acknowledge_and_clarify"
   - "invoke_herald_first"

Examples:

User: "I'm having a panic attack right now"
Emotion: urgency: 0.95, risk: 0.9, mood: panic
Needs: latent_need: emotional_support
Pattern: recurring_topics: [anxiety]
Context: novelty: 0.3
→ synthesized_signals: { primary_intent: "immediate_support", emotional_context: "acute_crisis", urgency_level: 0.95, pattern_context: "recurring", complexity: "moderate" }
→ herald_recommendation: { invoke: false, reason: "Crisis requires immediate personal support, not research", search_query: "", priority: "none" }
→ ambiguity_detected: []
→ knowledge_gaps: ["User's current coping strategies effectiveness"]
→ confidence: 0.85
→ recommendation: "provide_emotional_support"

User: "How does quantum entanglement work?"
Emotion: mood: curious, urgency: 0.2
Needs: learning_intent: 0.9, stated_intent: exploration
Pattern: no recurring topics
Context: novelty: 0.95, semantic_search tier: reference_library
→ synthesized_signals: { primary_intent: "learn_new_concept", emotional_context: "curious_engaged", urgency_level: 0.2, pattern_context: "novel", complexity: "complex" }
→ herald_recommendation: { invoke: true, reason: "Complex new topic requiring authoritative external sources", search_query: "quantum entanglement explained", priority: "primary" }
→ ambiguity_detected: []
→ knowledge_gaps: ["User's physics background unknown"]
→ confidence: 0.9
→ recommendation: "invoke_herald_first"

User: "I'm stuck on the authentication bug again"
Emotion: frustrated, urgency: 0.6
Needs: latent_need: guidance, learning_intent: 0.4
Pattern: recurring_topics: [authentication, JWT], topic_frequency: { authentication: 8 }
Context: novelty: 0.2, conversation_history: 7 days
→ synthesized_signals: { primary_intent: "solve_recurring_problem", emotional_context: "frustrated_but_focused", urgency_level: 0.6, pattern_context: "recurring", complexity: "moderate" }
→ herald_recommendation: { invoke: false, reason: "Strong historical context available - discussed 8 times before", search_query: "", priority: "fallback" }
→ ambiguity_detected: []
→ knowledge_gaps: []
→ confidence: 0.95
→ recommendation: "guide_problem_solving"

Respond with ONLY valid JSON:
{
  "synthesized_signals": {
    "primary_intent": "...",
    "emotional_context": "...",
    "urgency_level": 0.0-1.0,
    "pattern_context": "recurring|novel|mixed",
    "complexity": "simple|moderate|complex"
  },
  "herald_recommendation": {
    "invoke": true/false,
    "reason": "...",
    "search_query": "...",
    "priority": "primary|fallback|none"
  },
  "ambiguity_detected": ["..."],
  "knowledge_gaps": ["..."],
  "confidence": 0.0-1.0,
  "recommendation": "..."
}`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 800
      });

      const analysis = JSON.parse(response.choices[0].message.content);
      
      // Validate the analysis
      let validatedSignals = this.validateLLMAnalysis(analysis, quickAnalysis);
      
      // Apply internal-first overrides even after LLM synthesis
      const msg = (userMessage || '').toLowerCase();
      const userRequestedInternalOnly = /(without\s+using\s+(a\s+)?web\s+search|no\s+web(\s+search)?|local\s+only|internal\s+only|from\s+(your|my)\s+(files|library|reference\s+library))/i.test(msg);
      const hasReferenceLibraryRequest = Array.isArray(contextKnight?.context_requests?.semantic_search)
        && contextKnight.context_requests.semantic_search.some(s => (s.tier === 'reference_library'));
      const libraryIntent = /(reference\s+library|your\s+library|books\s+in\s+(your|the)\s+library|book\s+list|list\s+of\s+books)/i.test(msg);
      if (userRequestedInternalOnly || hasReferenceLibraryRequest || libraryIntent) {
        validatedSignals.herald_recommendation = {
          invoke: false,
          reason: userRequestedInternalOnly
            ? 'User requested internal sources only'
            : 'Internal reference library is available and requested; try Librarian first',
          search_query: '',
          priority: 'none'
        };
      }
      
      return this.createResult(
        validatedSignals,
        0.85,
        'LLM-based strategic synthesis from all Knights'
      );
      
    } catch (error) {
      console.error('AnalysisKnight LLM analysis failed:', error.message);
      // Fallback to pattern-based analysis
      return this.createResult(quickAnalysis, 0.65, 'Pattern-based fallback (LLM failed)');
    }
  }

  /**
   * Validate and sanitize LLM analysis
   * @param {Object} analysis - LLM output
   * @param {Object} quickAnalysis - Pattern-based baseline
   * @returns {Object} Validated signals
   */
  validateLLMAnalysis(analysis, quickAnalysis) {
    // Validate synthesized_signals
    const synthesized_signals = analysis.synthesized_signals || quickAnalysis.synthesized_signals;
    if (synthesized_signals) {
      synthesized_signals.urgency_level = this.clamp(synthesized_signals.urgency_level || 0.3, 0, 1);
      if (!['recurring', 'novel', 'mixed'].includes(synthesized_signals.pattern_context)) {
        synthesized_signals.pattern_context = 'novel';
      }
      if (!['simple', 'moderate', 'complex'].includes(synthesized_signals.complexity)) {
        synthesized_signals.complexity = 'moderate';
      }
    }
    
    // Validate herald_recommendation
    const herald = analysis.herald_recommendation || quickAnalysis.herald_recommendation;
    if (herald) {
      herald.invoke = Boolean(herald.invoke);
      if (!['primary', 'fallback', 'none'].includes(herald.priority)) {
        herald.priority = 'none';
      }
      if (!herald.invoke) {
        herald.search_query = '';
        herald.priority = 'none';
      }
    }
    
    // Validate arrays
    const ambiguity_detected = Array.isArray(analysis.ambiguity_detected)
      ? analysis.ambiguity_detected.filter(a => typeof a === 'string')
      : quickAnalysis.ambiguity_detected;
    
    const knowledge_gaps = Array.isArray(analysis.knowledge_gaps)
      ? analysis.knowledge_gaps.filter(k => typeof k === 'string')
      : quickAnalysis.knowledge_gaps;
    
    // Validate confidence
    const confidence = this.clamp(
      typeof analysis.confidence === 'number' ? analysis.confidence : quickAnalysis.confidence,
      0,
      1
    );
    
    // Validate recommendation
    const validRecommendations = [
      'provide_emotional_support',
      'answer_learning_question',
      'guide_problem_solving',
      'explore_together',
      'acknowledge_and_clarify',
      'invoke_herald_first'
    ];
    const recommendation = validRecommendations.includes(analysis.recommendation)
      ? analysis.recommendation
      : quickAnalysis.recommendation;
    
    return {
      synthesized_signals,
      herald_recommendation: herald,
      ambiguity_detected,
      knowledge_gaps,
      confidence,
      recommendation
    };
  }

  /**
   * Calculate confidence based on signal quality
   * @param {Object} signals - All signals
   * @returns {number} Confidence score 0-1
   */
  calculateConfidence(signals) {
    let confidence = 0.7; // baseline
    
    const { emotion, needs, pattern, contextKnight, ambiguity_detected } = signals;
    
    // Increase confidence with clear signals
    if (emotion && emotion.urgency !== undefined) confidence += 0.05;
    if (needs && needs.needs_confidence > 0.7) confidence += 0.1;
    if (pattern && pattern.pattern_strength > 0.7) confidence += 0.1;
    if (contextKnight && contextKnight.novelty !== undefined) confidence += 0.05;
    
    // Decrease confidence with ambiguity
    if (ambiguity_detected && ambiguity_detected.length > 0) {
      confidence -= (ambiguity_detected.length * 0.1);
    }
    
    return this.clamp(confidence, 0, 1);
  }

  /**
   * Determine primary recommendation for Arthur
   * @param {Object} signals - Key signals
   * @returns {string} Recommendation
   */
  determineRecommendation(signals) {
    const { emotion, needs, pattern, herald_recommendation } = signals;
    
    // Crisis takes priority
    if (emotion?.risk > 0.7 || emotion?.urgency > 0.8) {
      return 'provide_emotional_support';
    }
    
    // Herald invocation
    if (herald_recommendation?.invoke && herald_recommendation.priority === 'primary') {
      return 'invoke_herald_first';
    }
    
    // Learning intent
    if (needs?.learning_intent > 0.7) {
      return 'answer_learning_question';
    }
    
    // Problem solving pattern
    if (pattern?.behavior_trends?.includes('troubleshooting_focused') ||
        pattern?.behavior_trends?.includes('iterative_solving')) {
      return 'guide_problem_solving';
    }
    
    // Exploratory
    if (needs?.exploratory > 0.7) {
      return 'explore_together';
    }
    
    // Default
    return 'acknowledge_and_clarify';
  }

  /**
   * Utility: Clamp value between min and max
   */
  clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }
}

export default AnalysisKnight;
