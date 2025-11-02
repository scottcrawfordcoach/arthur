// Copyright (c) 2025 Scott Crawford. All rights reserved.

/**
 * EmotionKnight.js
 * Analyzes tone, affect, and emotional state from user messages
 * Following ARTHUR_STRATEGY_v3 Roundtable Architecture
 * 
 * Emotion Knight is the simplest Knight - analyzes only the current message
 * No dependencies on other Knights or conversation history
 */

import KnightBase from './KnightBase.js';
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class EmotionKnight extends KnightBase {
  constructor(config = {}) {
    super('EmotionKnight', config);
    
    // Initialize OpenAI client
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    
    // Load policy
    const policyPath = path.join(__dirname, '../config/emotion_knight_policy.json');
    this.policy = JSON.parse(fs.readFileSync(policyPath, 'utf8'));
  }

  /**
   * Quick analysis using pattern matching
   * Fast fallback for when LLM analysis fails or for pre-screening
   * 
   * @param {string} userMessage - User message to analyze
   * @returns {Object|null} - Quick analysis result or null
   */
  quickAnalysis(userMessage) {
    const messageLower = userMessage.toLowerCase();
    const policy = this.policy;
    
    // Build regex patterns from policy keywords with safe defaults
    const riskKeywords = (policy?.crisis_patterns?.risk_keywords || []).join('|') || 'suicide|kill myself';
    const urgentKeywords = (policy?.crisis_patterns?.urgent_keywords || []).join('|') || 'help|urgent|emergency';
    const riskPattern = new RegExp(`\\b(${riskKeywords})\\b`, 'i');
    const urgentPattern = new RegExp(`\\b(${urgentKeywords})\\b`, 'i');
    
    // Check for crisis/risk indicators
    const hasRiskPattern = riskPattern.test(userMessage);
    if (hasRiskPattern) {
      return this.createResult(
        {
          sentiment: -0.9,
          mood: 'anxious',
          urgency: 1.0,
          risk: 0.9,
          tone_indicators: ['crisis_keywords', 'risk_detected'],
          energy_level: 'low'
        },
        policy.confidence_thresholds.crisis_detection,
        'Crisis/risk keywords detected via pattern matching'
      );
    }
    
    // Check for urgency
    const hasUrgentPattern = urgentPattern.test(userMessage) || /!{2,}/.test(userMessage) || /\?\?+/.test(userMessage);
    const urgency = hasUrgentPattern ? (policy?.crisis_patterns?.thresholds?.urgent || 0.8) : 0.3;
    
    // Simple sentiment analysis based on word counts from policy
    const negativeWords = policy?.sentiment_words?.negative || [];
    const positiveWords = policy?.sentiment_words?.positive || [];
    
    const negativeCount = negativeWords.filter(word => 
      messageLower.includes(word)
    ).length;
    const positiveCount = positiveWords.filter(word => 
      messageLower.includes(word)
    ).length;
    
    const sentiment = positiveCount - negativeCount;
    const normalizedSentiment = Math.max(-1, Math.min(1, sentiment / 5));
    
    // Detect mood from policy patterns
    let detectedMood = 'neutral';
    let highestMoodCount = 0;
    
    const moodDetection = policy?.mood_detection || {};
    for (const [moodName, moodData] of Object.entries(moodDetection)) {
      const moodKeywords = moodData?.keywords || [];
      const moodCount = moodKeywords.filter(word => 
        messageLower.includes(word)
      ).length;
      if (moodCount > highestMoodCount) {
        highestMoodCount = moodCount;
        detectedMood = moodName;
      }
    }
    
    // Detect energy level from message length and punctuation
    const wordCount = userMessage.split(/\s+/).length;
    const hasExclamation = /!/.test(userMessage);
    const shortSentences = userMessage.split(/[.!?]/).filter(s => s.trim()).length > 3;
    
    let energy_level = 'medium';
    const lowIndicators = policy?.energy_level_indicators?.low || [];
    const highIndicators = policy?.energy_level_indicators?.high || [];
    
    if (wordCount < 10 && !hasExclamation) {
      energy_level = 'low';
    } else if (hasExclamation && (wordCount > 30 || shortSentences)) {
      energy_level = 'high';
    }
    
    // Check energy indicators from policy
    if (lowIndicators.some(ind => messageLower.includes(ind))) {
      energy_level = 'low';
    } else if (highIndicators.some(ind => messageLower.includes(ind))) {
      energy_level = 'high';
    }
    
    // Use detected mood from policy patterns or fallback to sentiment-based
    let mood = detectedMood;
    if (mood === 'neutral') {
      if (normalizedSentiment > 0.6) mood = 'excited';
      else if (normalizedSentiment > 0.3) mood = 'happy';
      else if (normalizedSentiment < -0.6) mood = 'sad';
      else if (normalizedSentiment < -0.3) mood = 'frustrated';
    }
    
    const tone_indicators = [];
    if (hasExclamation) tone_indicators.push('exclamation');
    if (shortSentences) tone_indicators.push('short_sentences');
    if (negativeCount > 0) tone_indicators.push('negative_words');
    if (positiveCount > 0) tone_indicators.push('positive_words');
    
    return this.createResult(
      {
        sentiment: normalizedSentiment,
        mood,
        urgency,
        risk: 0.1, // Low risk if no crisis patterns
        tone_indicators,
        energy_level
      },
      policy.confidence_thresholds.pattern_match || 0.7,
      'Quick pattern-based emotion analysis using policy rules'
    );
  }

  /**
   * LLM-based emotion analysis
   * More nuanced and context-aware than pattern matching
   * 
   * @param {string} userMessage - User message to analyze
   * @returns {Promise<Object>} - LLM analysis result
   */
  async llmAnalysis(userMessage) {
    const prompt = `You are an expert emotion and sentiment analyst for a wellness coaching AI.

Analyze the following user message for emotional tone, sentiment, urgency, and potential risk.

User message: "${userMessage}"

Provide your analysis as JSON with this exact structure:
{
  "sentiment": <number between -1.0 (very negative) and 1.0 (very positive)>,
  "mood": <one of: "excited", "happy", "calm", "neutral", "frustrated", "anxious", "sad", "angry">,
  "urgency": <number between 0.0 (casual) and 1.0 (urgent/emergency)>,
  "risk": <number between 0.0 (safe) and 1.0 (crisis/self-harm risk)>,
  "tone_indicators": [<array of strings describing tone markers>],
  "energy_level": <one of: "high", "medium", "low", "unknown">,
  "reasoning": "<brief explanation of your analysis>"
}

Important:
- Risk should be HIGH (0.7+) if there are any mentions of self-harm, suicide, or crisis
- Urgency should be HIGH (0.7+) for requests for immediate help
- Consider both explicit and implicit emotional cues
- tone_indicators can include things like: "exclamation", "short_sentences", "negative_words", "positive_words", "question_heavy", "emotional_language"`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { 
            role: 'system', 
            content: 'You are an emotion analysis expert. Always respond with valid JSON only, no markdown formatting.'
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3, // Low temperature for consistent analysis
        max_tokens: 300
      });

      const content = response.choices[0].message.content.trim();
      
      // Remove markdown code blocks if present
      const jsonContent = content.replace(/```json\n?|\n?```/g, '').trim();
      
      const analysis = JSON.parse(jsonContent);
      
      // Extract reasoning and remove from signals
      const reasoning = analysis.reasoning || 'LLM-based emotion analysis';
      delete analysis.reasoning;
      
      // Validate the analysis matches our schema
      const requiredFields = ['sentiment', 'mood', 'urgency', 'risk', 'tone_indicators', 'energy_level'];
      for (const field of requiredFields) {
        if (!(field in analysis)) {
          throw new Error(`Missing required field: ${field}`);
        }
      }
      
      return this.createResult(
        analysis,
        0.85, // High confidence in LLM analysis
        reasoning
      );
      
    } catch (error) {
      console.error('[EmotionKnight] LLM analysis failed:', error.message);
      throw error; // Re-throw so analyze() can fall back to quick analysis
    }
  }

  /**
   * Analyze user message for emotional signals
   * Uses LLM analysis with quick pattern matching fallback
   * 
   * @param {string} userMessage - The current user message
   * @param {Object} context - Conversation context (not needed for EmotionKnight)
   * @returns {Promise<Object>} - Emotion analysis result
   */
  async analyze(userMessage, context = {}) {
    if (!this.isEnabled()) {
      return this.createResult(
        {
          sentiment: 0,
          mood: 'neutral',
          urgency: 0.3,
          risk: 0.0,
          tone_indicators: [],
          energy_level: 'unknown'
        },
        0.0,
        'EmotionKnight is disabled'
      );
    }

    try {
      // Always do quick analysis first for crisis detection
      const quickResult = this.quickAnalysis(userMessage);
      
      // If high risk detected, return immediately
      if (quickResult.signals.risk >= 0.7) {
        console.log('[EmotionKnight] High risk detected, returning quick analysis');
        return quickResult;
      }
      
      // Otherwise, try LLM analysis
      try {
        const llmResult = await this.llmAnalysis(userMessage);
        
        // If LLM also detects high risk, boost confidence
        if (llmResult.signals.risk >= 0.7) {
          llmResult.confidence = 0.95;
          llmResult.reasoning += ' (confirmed by LLM analysis)';
        }
        
        return llmResult;
        
      } catch (llmError) {
        // LLM failed, fall back to quick analysis
        console.warn('[EmotionKnight] Falling back to quick analysis:', llmError.message);
        return quickResult;
      }
      
    } catch (error) {
      return this.handleError(error, userMessage);
    }
  }
}

export default EmotionKnight;
