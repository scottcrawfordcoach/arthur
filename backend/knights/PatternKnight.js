// Copyright (c) 2025 Scott Crawford. All rights reserved.

/**
 * PatternKnight.js
 * 
 * Evidence Council Knight: Detects behavioral trends and patterns
 * 
 * Responsibilities:
 * - Identify recurring topics in conversation history
 * - Detect conversation rhythm (frequency, timing patterns)
 * - Recognize behavioral trends (learning style, problem-solving approach)
 * - Track topic frequency and evolution
 * 
 * Signals Produced:
 * - recurring_topics: Array of topics that keep coming up
 * - topic_frequency: Map of topic -> frequency count
 * - conversation_rhythm: Pattern of interaction (daily, sporadic, intense bursts)
 * - behavior_trends: Array of observed behavioral patterns
 * - pattern_strength: Confidence in detected patterns (0-1)
 * 
 * Model: Haiku 3.5 (fast theme detection and pattern recognition)
 * 
 * Note: For now, works with mock conversation history in tests.
 * Will integrate with Librarian for real conversation history in Phase 4.
 */

import KnightBase from './KnightBase.js';
import OpenAI from 'openai';

class PatternKnight extends KnightBase {
  constructor() {
    super('pattern');
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    
    // Topic patterns for quick analysis
    this.topicPatterns = {
      authentication: /\b(auth|login|password|token|session|jwt|oauth)\b/i,
      database: /\b(database|sql|query|schema|table|migration|postgres|sqlite)\b/i,
      frontend: /\b(react|component|ui|css|html|frontend|dom|render)\b/i,
      backend: /\b(server|api|endpoint|route|express|node|backend)\b/i,
      deployment: /\b(deploy|production|docker|container|aws|cloud|hosting)\b/i,
      testing: /\b(test|testing|jest|unit|integration|coverage)\b/i,
      performance: /\b(slow|performance|optimize|cache|speed|latency)\b/i,
      debugging: /\b(bug|error|debug|issue|problem|broken|fix)\b/i,
      architecture: /\b(architecture|design|pattern|structure|organize)\b/i,
      learning: /\b(learn|understand|tutorial|how to|explain|teach)\b/i
    };
    
    this.rhythmPatterns = {
      daily: 'Messages consistently spread across multiple days',
      sporadic: 'Irregular gaps between conversations',
      intensive: 'Bursts of many messages in short timeframe',
      single_session: 'One conversation session only'
    };
  }

  /**
   * Analyze conversation patterns
   * @param {string} userMessage - Current user message
   * @param {Object} context - Additional context including conversation history
   * @returns {Promise<Object>} Pattern signals
   */
  async analyze(userMessage, context = {}) {
    try {
      // Get conversation history (from context or mock for testing)
      const conversationHistory = context.conversationHistory || [];
      
      // Quick pattern analysis first
      const quickPatterns = this.quickAnalysis(userMessage, conversationHistory);
      
      // If disabled, no API key, or no history, return pattern-based analysis
      if (!this.enabled || !process.env.OPENAI_API_KEY || conversationHistory.length === 0) {
        return this.createResult(
          quickPatterns, 
          conversationHistory.length > 0 ? 0.65 : 0.3,
          conversationHistory.length > 0 
            ? 'Pattern-based analysis (LLM disabled)' 
            : 'No conversation history available'
        );
      }

      // LLM-based analysis for nuanced pattern detection
      return await this.llmAnalysis(userMessage, conversationHistory, quickPatterns);
      
    } catch (error) {
      return this.handleError(error, userMessage);
    }
  }

  /**
   * Quick pattern-based analysis
   * @param {string} userMessage - Current message
   * @param {Array} conversationHistory - Previous messages
   * @returns {Object} Basic pattern signals
   */
  quickAnalysis(userMessage, conversationHistory) {
    // If no history, return minimal signals
    if (conversationHistory.length === 0) {
      return {
        recurring_topics: [],
        topic_frequency: {},
        conversation_rhythm: 'single_session',
        behavior_trends: [],
        pattern_strength: 0.3
      };
    }

    // Combine current message with history
    const allMessages = [...conversationHistory.map(m => m.message || m.text || ''), userMessage];
    
    // Detect topics across all messages
    const topicCounts = {};
    const detectedTopics = new Set();
    
    allMessages.forEach(message => {
      Object.entries(this.topicPatterns).forEach(([topic, pattern]) => {
        if (pattern.test(message)) {
          topicCounts[topic] = (topicCounts[topic] || 0) + 1;
          detectedTopics.add(topic);
        }
      });
    });
    
    // Recurring topics (appeared 2+ times)
    const recurring_topics = Object.entries(topicCounts)
      .filter(([_, count]) => count >= 2)
      .map(([topic, _]) => topic);
    
    // Detect conversation rhythm from timestamps
    let conversation_rhythm = 'single_session';
    if (conversationHistory.length > 0) {
      const timestamps = conversationHistory
        .map(m => m.timestamp ? new Date(m.timestamp) : null)
        .filter(t => t !== null);
      
      if (timestamps.length > 1) {
        conversation_rhythm = this.detectRhythm(timestamps);
      }
    }
    
    // Simple behavior trends from topic patterns
    const behavior_trends = [];
    if (topicCounts.debugging >= 3) {
      behavior_trends.push('troubleshooting_focused');
    }
    if (topicCounts.learning >= 2) {
      behavior_trends.push('learning_oriented');
    }
    if (detectedTopics.size >= 5) {
      behavior_trends.push('wide_ranging_exploration');
    }
    if (recurring_topics.length >= 3) {
      behavior_trends.push('iterative_problem_solving');
    }
    
    // Pattern strength based on history size
    const pattern_strength = Math.min(conversationHistory.length / 10, 0.7);
    
    return {
      recurring_topics,
      topic_frequency: topicCounts,
      conversation_rhythm,
      behavior_trends,
      pattern_strength
    };
  }

  /**
   * Detect conversation rhythm from timestamps
   * @param {Array<Date>} timestamps - Conversation timestamps
   * @returns {string} Rhythm pattern
   */
  detectRhythm(timestamps) {
    if (timestamps.length < 2) return 'single_session';
    
    const sorted = timestamps.sort((a, b) => a - b);
    const gaps = [];
    
    for (let i = 1; i < sorted.length; i++) {
      const gapHours = (sorted[i] - sorted[i-1]) / (1000 * 60 * 60);
      gaps.push(gapHours);
    }
    
    const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    const maxGap = Math.max(...gaps);
    const minGap = Math.min(...gaps);
    
    // All within same day (< 24 hours)
    if (maxGap < 24) return 'intensive';
    
    // Regular daily pattern (gaps around 24 hours)
    if (avgGap > 20 && avgGap < 30 && maxGap < 48) return 'daily';
    
    // Irregular gaps
    if (maxGap > avgGap * 3) return 'sporadic';
    
    return 'regular';
  }

  /**
   * LLM-based pattern analysis for nuanced understanding
   * @param {string} userMessage - Current message
   * @param {Array} conversationHistory - Previous messages
   * @param {Object} quickPatterns - Quick pattern analysis as baseline
   * @returns {Promise<Object>} Pattern knight result
   */
  async llmAnalysis(userMessage, conversationHistory, quickPatterns) {
    // Format conversation history for LLM
    const historyText = conversationHistory
      .slice(-10) // Last 10 messages for context
      .map((msg, idx) => {
        const text = msg.message || msg.text || '';
        const timestamp = msg.timestamp ? new Date(msg.timestamp).toLocaleDateString() : '';
        return `[${idx + 1}] ${timestamp ? timestamp + ' - ' : ''}${text.substring(0, 150)}`;
      })
      .join('\n');

    const prompt = `You are an expert at detecting behavioral patterns and recurring themes in conversations.

Recent conversation history (last 10 messages):
${historyText}

Current message: "${userMessage}"

Analyze the conversation patterns:

1. **recurring_topics**: What topics keep coming up? (array of strings)
   Examples: ["authentication", "database design", "React hooks", "deployment issues"]

2. **topic_frequency**: How often does each topic appear? (object: topic -> count)
   Example: { "authentication": 5, "database": 3, "testing": 2 }

3. **conversation_rhythm**: What's the interaction pattern? (string)
   Options: "daily", "sporadic", "intensive", "regular", "single_session"

4. **behavior_trends**: What behavioral patterns do you observe? (array of strings)
   Examples:
   - "troubleshooting_focused" - Often debugging/fixing issues
   - "learning_oriented" - Asking how/why questions
   - "iterative_problem_solving" - Revisiting topics with refinements
   - "wide_ranging_exploration" - Jumping between many topics
   - "deep_dive" - Sustained focus on one area
   - "theoretical_learner" - Focuses on concepts before implementation
   - "hands_on_learner" - Builds first, asks questions later

5. **pattern_strength**: How confident are you in these patterns? (0-1 scale)
   - 0.0-0.3: Very limited data, weak patterns
   - 0.4-0.6: Some patterns emerging
   - 0.7-0.8: Clear patterns visible
   - 0.9-1.0: Strong, consistent patterns

Respond with ONLY valid JSON:
{
  "recurring_topics": ["...", "..."],
  "topic_frequency": { "topic": count, ... },
  "conversation_rhythm": "...",
  "behavior_trends": ["...", "..."],
  "pattern_strength": 0.0-1.0
}`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini', // Will switch to Haiku via modelService later
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 500
      });

      const analysis = JSON.parse(response.choices[0].message.content);
      
      // Validate the analysis
      const validatedSignals = this.validateLLMAnalysis(analysis, quickPatterns);
      
      return this.createResult(
        validatedSignals,
        analysis.pattern_strength || 0.75,
        'LLM-based pattern analysis from conversation history'
      );
      
    } catch (error) {
      console.error('PatternKnight LLM analysis failed:', error.message);
      // Fallback to pattern-based analysis
      return this.createResult(quickPatterns, 0.65, 'Pattern-based fallback (LLM failed)');
    }
  }

  /**
   * Validate and sanitize LLM analysis
   * @param {Object} analysis - LLM output
   * @param {Object} quickPatterns - Pattern-based baseline
   * @returns {Object} Validated signals
   */
  validateLLMAnalysis(analysis, quickPatterns) {
    const validRhythms = ['daily', 'sporadic', 'intensive', 'regular', 'single_session'];
    
    return {
      recurring_topics: Array.isArray(analysis.recurring_topics)
        ? analysis.recurring_topics.filter(t => typeof t === 'string')
        : quickPatterns.recurring_topics,
      
      topic_frequency: typeof analysis.topic_frequency === 'object' && analysis.topic_frequency !== null
        ? this.validateTopicFrequency(analysis.topic_frequency)
        : quickPatterns.topic_frequency,
      
      conversation_rhythm: validRhythms.includes(analysis.conversation_rhythm)
        ? analysis.conversation_rhythm
        : quickPatterns.conversation_rhythm,
      
      behavior_trends: Array.isArray(analysis.behavior_trends)
        ? analysis.behavior_trends.filter(t => typeof t === 'string')
        : quickPatterns.behavior_trends,
      
      pattern_strength: this.clamp(analysis.pattern_strength, 0, 1)
    };
  }

  /**
   * Validate topic frequency object
   * @param {Object} topicFreq - Topic frequency from LLM
   * @returns {Object} Validated topic frequency
   */
  validateTopicFrequency(topicFreq) {
    const validated = {};
    Object.entries(topicFreq).forEach(([topic, count]) => {
      if (typeof topic === 'string' && typeof count === 'number' && count > 0) {
        validated[topic] = count;
      }
    });
    return validated;
  }

  /**
   * Clamp value between min and max
   */
  clamp(value, min, max) {
    if (typeof value !== 'number' || isNaN(value)) return min;
    return Math.max(min, Math.min(max, value));
  }
}

export default PatternKnight;
