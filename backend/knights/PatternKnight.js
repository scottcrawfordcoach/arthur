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
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class PatternKnight extends KnightBase {
  constructor() {
    super('pattern');
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    
    // Load policy
    const policyPath = path.join(__dirname, '../config/pattern_knight_policy.json');
    this.policy = JSON.parse(fs.readFileSync(policyPath, 'utf8'));
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
   * Quick pattern-based analysis using policy
   * @param {string} userMessage - Current message
   * @param {Array} conversationHistory - Previous messages
   * @returns {Object} Basic pattern signals
   */
  quickAnalysis(userMessage, conversationHistory) {
    const policy = this.policy || {};
    
    // If no history, return minimal signals
    if (conversationHistory.length === 0) {
      return {
        recurring_topics: [],
        topic_frequency: {},
        conversation_rhythm: 'single_session',
        behavior_trends: [],
        pattern_strength: policy?.confidence_thresholds?.no_history || 0.3
      };
    }

    // Combine current message with history
    const allMessages = [...conversationHistory.map(m => m.message || m.text || ''), userMessage];
    
    // Build topic patterns from policy with safe defaults
    const topicPatterns = {};
    const policyTopics = policy?.topic_patterns || {};
    for (const [category, data] of Object.entries(policyTopics)) {
      const keywords = (data?.keywords || []).join('|');
      if (keywords) {
        topicPatterns[category] = new RegExp(`\\b(${keywords})\\b`, 'i');
      }
    }
    
    // Detect topics across all messages
    const topicCounts = {};
    const detectedTopics = new Set();
    
    allMessages.forEach(message => {
      Object.entries(topicPatterns).forEach(([topic, pattern]) => {
        if (pattern.test(message)) {
          topicCounts[topic] = (topicCounts[topic] || 0) + 1;
          detectedTopics.add(topic);
        }
      });
    });
    
    // Recurring topics using policy threshold
    const recurringThreshold = policy?.recurring_topic_threshold?.min_occurrences || 2;
    const recurring_topics = Object.entries(topicCounts)
      .filter(([_, count]) => count >= recurringThreshold)
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
    
    // Behavioral trends using policy
    const behavior_trends = [];
    if (topicCounts.learning >= 2) {
      behavior_trends.push('learning_oriented');
    }
    if (topicCounts.debugging >= 3) {
      behavior_trends.push('troubleshooting_focused');
    }
    if (detectedTopics.size >= 5) {
      behavior_trends.push('wide_ranging_exploration');
    }
    if (recurring_topics.length >= 3) {
      behavior_trends.push('iterative_problem_solving');
    }
    
    // Pattern strength based on history size and policy confidence thresholds
    let pattern_strength;
    const thresholds = policy?.confidence_thresholds || {};
    if (conversationHistory.length >= 10) {
      pattern_strength = thresholds.high || 0.8;
    } else if (conversationHistory.length >= 5) {
      pattern_strength = thresholds.medium || 0.5;
    } else {
      pattern_strength = thresholds.low || 0.3;
    }
    
    return {
      recurring_topics,
      topic_frequency: topicCounts,
      conversation_rhythm,
      behavior_trends,
      pattern_strength
    };
  }

  /**
   * Detect conversation rhythm from timestamps using policy rules
   * @param {Array<Date>} timestamps - Conversation timestamps
   * @returns {string} Rhythm pattern
   */
  detectRhythm(timestamps) {
    if (timestamps.length < 2) return 'single_session';
    
    const policy = this.policy || {};
    const rhythmRules = policy?.rhythm_detection || {};
    
    const sorted = timestamps.sort((a, b) => a - b);
    const gaps = [];
    
    for (let i = 1; i < sorted.length; i++) {
      const gapHours = (sorted[i] - sorted[i-1]) / (1000 * 60 * 60);
      gaps.push(gapHours);
    }
    const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    const maxGap = Math.max(...gaps);
    const minGap = Math.min(...gaps);
    
    // Use policy rhythm detection rules with safe defaults
    const dailyRule = rhythmRules?.daily || {};
    const sporadicRule = rhythmRules?.sporadic || {};
    const intensiveRule = rhythmRules?.intensive || {};
    
    // Check intensive (bursts of messages)
    if (maxGap < (intensiveRule.max_gap_hours || 24)) {
      return 'intensive';
    }
    
    // Check daily pattern
    const minAvg = dailyRule.min_avg_gap_hours || 20;
    const maxAvg = dailyRule.max_avg_gap_hours || 30;
    if (avgGap >= minAvg && avgGap <= maxAvg) {
      return 'daily';
    }
    
    // Check sporadic (irregular gaps)
    const maxMultiplier = sporadicRule.max_gap_multiplier || 3;
    if (maxGap > maxMultiplier * avgGap) {
      return 'sporadic';
    }
    
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
