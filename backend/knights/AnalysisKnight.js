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
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class AnalysisKnight extends KnightBase {
  constructor() {
    super('analysis');
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    
    // Load policy
    const policyPath = path.join(__dirname, '../config/analysis_knight_policy.json');
    this.policy = JSON.parse(fs.readFileSync(policyPath, 'utf8'));
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
    const policy = this.policy || {};
    
    // Default synthesis
    const synthesized_signals = {
      primary_intent: needs?.latent_need || needs?.stated_intent || 'information',
      emotional_context: emotion?.mood || 'neutral',
      urgency_level: emotion?.urgency || 0.3,
      pattern_context: pattern?.recurring_topics?.length > 0 ? 'recurring' : 'novel'
    };
    
    // Herald recommendation logic using policy
    const herald_recommendation = {
      invoke: false,
      reason: '',
      search_query: '',
      priority: 'none'
    };
    
    // Internal-first guardrails from policy with safe defaults
    const msg = (userMessage || '').toLowerCase();
    const heraldPolicy = policy?.herald_invocation || {};
    const internalPatterns = heraldPolicy?.internal_first_patterns?.keywords || [];
    const libraryPatterns = heraldPolicy?.library_intent_patterns?.keywords || [];
    
    const userRequestedInternalOnly = internalPatterns.some(pattern => msg.includes(pattern.toLowerCase()));
    const hasReferenceLibraryRequest = Array.isArray(contextKnight?.context_requests?.semantic_search)
      && contextKnight.context_requests.semantic_search.some(s => (s.tier === 'reference_library'));
    const libraryIntent = libraryPatterns.some(pattern => msg.includes(pattern.toLowerCase()));
    
    if (userRequestedInternalOnly || hasReferenceLibraryRequest || libraryIntent) {
      herald_recommendation.invoke = false;
      herald_recommendation.reason = userRequestedInternalOnly
        ? 'User requested internal sources only'
        : 'Internal reference library is available and requested; try Librarian first';
      herald_recommendation.search_query = '';
      herald_recommendation.priority = 'none';
    }
    
    // Invoke Herald based on policy rules
    const invokeRules = policy?.herald_invocation?.invoke_conditions || {};
    
    // Rule 1: High learning intent + novel topic
    const learningRule = invokeRules?.high_learning_novel_topic || {};
    if (!herald_recommendation.invoke && 
        needs?.learning_intent > (learningRule.learning_intent_threshold || 0.7) && 
        contextKnight?.novelty > (learningRule.novelty_threshold || 0.7)) {
      herald_recommendation.invoke = true;
      herald_recommendation.reason = learningRule.reason || 'New learning topic with no historical context';
      herald_recommendation.search_query = userMessage;
      herald_recommendation.priority = learningRule.priority || 'primary';
    }
    
    // Rule 2: Direct question with novelty
    const questionRule = invokeRules?.direct_question_novel || {};
    const questionPatterns = (questionRule.question_patterns || []).map(p => new RegExp(p, 'i'));
    const isQuestion = questionPatterns.some(pattern => pattern.test(userMessage.trim()));
    
    if (!herald_recommendation.invoke && 
        isQuestion && 
        contextKnight?.novelty > (questionRule.novelty_threshold || 0.6)) {
      herald_recommendation.invoke = true;
      herald_recommendation.reason = questionRule.reason || 'Direct question about potentially unfamiliar topic';
      herald_recommendation.search_query = userMessage;
      herald_recommendation.priority = questionRule.priority || 'fallback';
    }
    
    // Detect ambiguity using policy rules
    const ambiguity_detected = [];
    const ambiguityRules = policy?.ambiguity_detection?.contradictions || [];
    
    for (const rule of ambiguityRules) {
      let detected = false;
      
      // Evaluate condition dynamically
      if (rule.name === 'urgency_vs_learning' && 
          emotion?.urgency > 0.7 && needs?.learning_intent > 0.7) {
        detected = true;
      } else if (rule.name === 'negative_emotion_vs_exploration' && 
                 emotion?.sentiment < -0.5 && needs?.exploratory > 0.7) {
        detected = true;
      } else if (rule.name === 'crisis_vs_casual' && 
                 emotion?.risk > 0.8 && emotion?.urgency < 0.3) {
        detected = true;
      }
      
      if (detected) {
        ambiguity_detected.push(rule.message);
      }
    }
    
    // Knowledge gaps using policy
    const knowledge_gaps = [];
    const gapRules = policy?.knowledge_gaps?.gap_conditions || [];
    
    for (const rule of gapRules) {
      let detected = false;
      
      if (rule.name === 'no_historical_context' && 
          contextKnight?.novelty > 0.7 && !pattern?.recurring_topics?.length) {
        detected = true;
      } else if (rule.name === 'risk_without_coping_data' && 
                 emotion?.risk > 0.6 && 
                 (!contextKnight?.context_requests?.user_data || contextKnight.context_requests.user_data.length === 0)) {
        detected = true;
      } else if (rule.name === 'learning_without_resources' && 
                 needs?.learning_intent > 0.7 && 
                 (!contextKnight?.context_requests?.semantic_search || 
                  !contextKnight.context_requests.semantic_search.some(s => s.tier === 'reference_library'))) {
        detected = true;
      }
      
      if (detected) {
        knowledge_gaps.push(rule.message);
      }
    }
    
    // Overall confidence using policy
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
      const policy = this.policy || {};
      const heraldPolicy = policy?.herald_invocation || {};
      const internalPatterns = heraldPolicy?.internal_first_patterns?.keywords || [];
      const libraryPatterns = heraldPolicy?.library_intent_patterns?.keywords || [];
      
      const userRequestedInternalOnly = internalPatterns.some(pattern => msg.includes(pattern.toLowerCase()));
      const hasReferenceLibraryRequest = Array.isArray(contextKnight?.context_requests?.semantic_search)
        && contextKnight.context_requests.semantic_search.some(s => (s.tier === 'reference_library'));
      const libraryIntent = libraryPatterns.some(pattern => msg.includes(pattern.toLowerCase()));
      
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
   * Calculate confidence based on signal quality using policy
   * @param {Object} signals - All signals
   * @returns {number} Confidence score 0-1
   */
  calculateConfidence(signals) {
    const policy = this.policy?.confidence_calculation || {};
    let confidence = policy.base_confidence || 0.7;
    
    const { emotion, needs, pattern, contextKnight, ambiguity_detected } = signals;
    
    // Apply policy adjustments with safe defaults
    const adjustments = policy.adjustments || {};
    
    // High emotion signals increase confidence
    if (adjustments.high_emotion_signals && emotion && 
        (emotion.urgency > 0.5 || emotion.risk > 0.5)) {
      confidence += adjustments.high_emotion_signals.adjustment;
    }
    
    // Ambiguity detected decreases confidence
    if (adjustments.ambiguity_detected && ambiguity_detected && ambiguity_detected.length > 0) {
      confidence += adjustments.ambiguity_detected.adjustment;
    }
    
    // No pattern data decreases confidence
    if (adjustments.no_pattern_data && (!pattern || pattern.pattern_strength < 0.3)) {
      confidence += adjustments.no_pattern_data.adjustment;
    }
    
    // All knights agree increases confidence
    if (adjustments.all_knights_agree && emotion && needs && pattern &&
        emotion.mood !== 'neutral' && needs.needs_confidence > 0.7 && pattern.pattern_strength > 0.5) {
      confidence += adjustments.all_knights_agree.adjustment;
    }
    
    return this.clamp(confidence, policy.min_confidence || 0.3, policy.max_confidence || 0.95);
  }

  /**
   * Determine primary recommendation for Arthur using policy
   * @param {Object} signals - Key signals
   * @returns {string} Recommendation
   */
  determineRecommendation(signals) {
    const { emotion, needs, pattern, herald_recommendation } = signals;
    const policy = this.policy?.recommendation_rules || {};
    
    // Check priorities in order from policy with safe defaults
    const priorities = policy.priorities || [];
    for (const rule of priorities) {
      let conditionMet = false;
      
      switch (rule.action) {
        case 'provide_crisis_support':
          if (emotion?.risk > 0.7 || emotion?.urgency > 0.8) {
            conditionMet = true;
          }
          break;
        
        case 'invoke_herald':
          if (herald_recommendation?.invoke && herald_recommendation.priority === 'primary') {
            conditionMet = true;
          }
          break;
        
        case 'provide_emotional_support':
          if (needs?.support_needed?.includes('emotional_support') && emotion?.sentiment < -0.4) {
            conditionMet = true;
          }
          break;
        
        case 'answer_from_context':
          if (pattern?.recurring_topics?.length > 0 || needs?.learning_intent > 0.5) {
            conditionMet = true;
          }
          break;
        
        case 'explore_with_user':
          if (needs?.exploratory > 0.6 || (signals.ambiguity_detected && signals.ambiguity_detected.length > 0)) {
            conditionMet = true;
          }
          break;
      }
      
      if (conditionMet) {
        return rule.action;
      }
    }
    
    // Default fallback
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
