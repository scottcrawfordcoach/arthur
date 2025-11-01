// Copyright (c) 2025 Scott Crawford. All rights reserved.

/**
 * NeedsKnight.js
 * 
 * Evidence Council Knight: Determines user's actual needs vs stated intent
 * 
 * Responsibilities:
 * - Infer latent needs from user message and emotional context
 * - Distinguish between stated intent (what they ask) and actual need (what they need)
 * - Detect learning intent vs immediate problem-solving needs
 * - Determine level of support needed (emotional, informational, guidance)
 * - Assess goal alignment (user working toward stated goals)
 * 
 * Signals Produced:
 * - stated_intent: What user explicitly asked for (enum)
 * - latent_need: What user actually needs (enum)
 * - learning_intent: Desire to understand vs get answer (0-1)
 * - support_needed: Type of support required (array)
 * - goal_alignment: Working toward goals vs exploring (0-1)
 * - exploratory: Open-ended exploration vs specific task (0-1)
 * - needs_confidence: Confidence in need assessment (0-1)
 * 
 * Model: Haiku 3.5 (fast latent needs inference)
 */

import KnightBase from './KnightBase.js';
import OpenAI from 'openai';

class NeedsKnight extends KnightBase {
  constructor() {
    super('needs');
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    
    // Intent patterns for quick analysis fallback
    this.intentPatterns = {
      information: /\b(what|how|why|when|where|who|explain|tell me|show me)\b/i,
      validation: /\b(right|correct|good|okay|should I|is this|am I)\b/i,
      guidance: /\b(help|stuck|don't know|unsure|confused|lost)\b/i,
      emotional_support: /\b(feel|feeling|frustrated|scared|worried|anxious|upset)\b/i,
      problem_solving: /\b(fix|solve|work|broken|error|issue|problem)\b/i,
      exploration: /\b(think|consider|maybe|wondering|curious|interested)\b/i,
      goal_setting: /\b(want to|need to|trying to|working on|goal|plan)\b/i
    };
    
    this.supportTypes = [
      'emotional_support',
      'information',
      'guidance',
      'validation',
      'problem_solving',
      'encouragement'
    ];
  }

  /**
   * Analyze user message to determine actual needs
   * @param {string} userMessage - The user's message
   * @param {Object} context - Additional context (emotion signals, conversation history)
   * @returns {Promise<Object>} Needs signals
   */
  async analyze(userMessage, context = {}) {
    try {
      // Quick pattern analysis first (for baseline)
      const quickNeeds = this.quickAnalysis(userMessage);
      
      // If disabled or no API key, return pattern-based analysis
      if (!this.enabled || !process.env.OPENAI_API_KEY) {
        return this.createResult(quickNeeds, 0.65, 'Pattern-based needs analysis (LLM disabled)');
      }

      // LLM-based analysis for nuanced understanding
      return await this.llmAnalysis(userMessage, context, quickNeeds);
      
    } catch (error) {
      return this.handleError(error, userMessage);
    }
  }

  /**
   * Quick pattern-based needs analysis
   * @param {string} userMessage - The user's message
   * @returns {Object} Basic needs signals
   */
  quickAnalysis(userMessage) {
    const lowerMessage = userMessage.toLowerCase();
    
    // Detect stated intent
    let stated_intent = 'information'; // default
    let latent_need = 'information';
    
    if (this.intentPatterns.guidance.test(lowerMessage)) {
      stated_intent = 'guidance';
      latent_need = 'emotional_support'; // Often seeking reassurance when stuck
    } else if (this.intentPatterns.validation.test(lowerMessage)) {
      stated_intent = 'validation';
      latent_need = 'validation';
    } else if (this.intentPatterns.emotional_support.test(lowerMessage)) {
      stated_intent = 'emotional_support';
      latent_need = 'emotional_support';
    } else if (this.intentPatterns.problem_solving.test(lowerMessage)) {
      stated_intent = 'problem_solving';
      latent_need = 'problem_solving';
    } else if (this.intentPatterns.exploration.test(lowerMessage)) {
      stated_intent = 'exploration';
      latent_need = 'guidance';
    } else if (this.intentPatterns.goal_setting.test(lowerMessage)) {
      stated_intent = 'goal_setting';
      latent_need = 'guidance';
    }
    
    // Learning intent (questions vs commands)
    const hasQuestion = /\?/.test(userMessage);
    const hasWhy = /\b(why|how does|how do|explain)\b/i.test(lowerMessage);
    const learning_intent = hasWhy ? 0.8 : (hasQuestion ? 0.6 : 0.3);
    
    // Support needed
    const support_needed = [];
    if (this.intentPatterns.emotional_support.test(lowerMessage)) {
      support_needed.push('emotional_support');
    }
    if (this.intentPatterns.information.test(lowerMessage)) {
      support_needed.push('information');
    }
    if (this.intentPatterns.guidance.test(lowerMessage)) {
      support_needed.push('guidance');
    }
    if (this.intentPatterns.validation.test(lowerMessage)) {
      support_needed.push('validation');
    }
    if (support_needed.length === 0) {
      support_needed.push('information'); // default
    }
    
    // Goal alignment (harder to detect from single message)
    const goal_alignment = this.intentPatterns.goal_setting.test(lowerMessage) ? 0.7 : 0.5;
    
    // Exploratory
    const exploratory = this.intentPatterns.exploration.test(lowerMessage) ? 0.8 : 0.3;
    
    return {
      stated_intent,
      latent_need,
      learning_intent,
      support_needed,
      goal_alignment,
      exploratory,
      needs_confidence: 0.6 // Pattern-based is less confident
    };
  }

  /**
   * LLM-based needs analysis for nuanced understanding
   * @param {string} userMessage - The user's message
   * @param {Object} context - Additional context (emotion signals, etc.)
   * @param {Object} quickNeeds - Quick pattern analysis as baseline
   * @returns {Promise<Object>} Needs knight result
   */
  async llmAnalysis(userMessage, context, quickNeeds) {
    const emotionContext = context.emotion ? `
Emotional context:
- Mood: ${context.emotion.mood}
- Sentiment: ${context.emotion.sentiment}
- Urgency: ${context.emotion.urgency}
- Risk: ${context.emotion.risk}` : '';

    const prompt = `You are an expert at understanding what people actually need vs what they ask for.

User message: "${userMessage}"
${emotionContext}

Analyze the user's TRUE needs:

1. **stated_intent**: What they explicitly asked for
   Options: information, guidance, validation, emotional_support, problem_solving, exploration, goal_setting

2. **latent_need**: What they ACTUALLY need (may differ from stated)
   Options: information, guidance, validation, emotional_support, problem_solving, exploration, goal_setting, encouragement

3. **learning_intent**: Do they want to understand (0.8-1.0) or just get an answer (0.0-0.3)? (0-1 scale)

4. **support_needed**: What types of support would help? (array)
   Options: emotional_support, information, guidance, validation, problem_solving, encouragement

5. **goal_alignment**: Are they working toward stated goals (0.7-1.0) or exploring (0.0-0.3)? (0-1 scale)

6. **exploratory**: Open-ended exploration (0.8-1.0) vs specific task (0.0-0.3)? (0-1 scale)

7. **needs_confidence**: How confident are you in this assessment? (0-1 scale)

Examples of stated vs latent needs:
- "What should I do?" → stated: guidance, latent: validation (seeking reassurance)
- "I'm stuck on this" → stated: problem_solving, latent: emotional_support (frustrated, needs encouragement)
- "How does this work?" → stated: information, latent: information (genuine learning)
- "Is this the right approach?" → stated: validation, latent: validation (needs confidence boost)
- "I can't figure this out" → stated: problem_solving, latent: guidance (needs direction, not just answer)

Respond with ONLY valid JSON:
{
  "stated_intent": "...",
  "latent_need": "...",
  "learning_intent": 0.0-1.0,
  "support_needed": ["...", "..."],
  "goal_alignment": 0.0-1.0,
  "exploratory": 0.0-1.0,
  "needs_confidence": 0.0-1.0
}`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini', // Will switch to Haiku via modelService later
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 300
      });

      const analysis = JSON.parse(response.choices[0].message.content);
      
      // Validate the analysis
      const validatedSignals = this.validateLLMAnalysis(analysis, quickNeeds);
      
      return this.createResult(
        validatedSignals,
        analysis.needs_confidence || 0.85,
        'LLM-based needs analysis with emotional context'
      );
      
    } catch (error) {
      console.error('NeedsKnight LLM analysis failed:', error.message);
      // Fallback to pattern-based analysis
      return this.createResult(quickNeeds, 0.65, 'Pattern-based fallback (LLM failed)');
    }
  }

  /**
   * Validate and sanitize LLM analysis
   * @param {Object} analysis - LLM output
   * @param {Object} quickNeeds - Pattern-based baseline
   * @returns {Object} Validated signals
   */
  validateLLMAnalysis(analysis, quickNeeds) {
    const validIntents = [
      'information', 'guidance', 'validation', 'emotional_support',
      'problem_solving', 'exploration', 'goal_setting', 'encouragement'
    ];
    
    const validSupport = [
      'emotional_support', 'information', 'guidance',
      'validation', 'problem_solving', 'encouragement'
    ];
    
    return {
      stated_intent: validIntents.includes(analysis.stated_intent) 
        ? analysis.stated_intent 
        : quickNeeds.stated_intent,
      
      latent_need: validIntents.includes(analysis.latent_need)
        ? analysis.latent_need
        : quickNeeds.latent_need,
      
      learning_intent: this.clamp(analysis.learning_intent, 0, 1),
      
      support_needed: Array.isArray(analysis.support_needed)
        ? analysis.support_needed.filter(s => validSupport.includes(s))
        : quickNeeds.support_needed,
      
      goal_alignment: this.clamp(analysis.goal_alignment, 0, 1),
      
      exploratory: this.clamp(analysis.exploratory, 0, 1),
      
      needs_confidence: this.clamp(analysis.needs_confidence, 0, 1)
    };
  }

  /**
   * Clamp value between min and max
   */
  clamp(value, min, max) {
    if (typeof value !== 'number' || isNaN(value)) return min;
    return Math.max(min, Math.min(max, value));
  }
}

export default NeedsKnight;
