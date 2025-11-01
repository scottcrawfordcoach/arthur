// Copyright (c) 2025 Scott Crawford. All rights reserved.

/**
 * Signal Extraction Service
 * Inspired by the Roundtable Protocol's Evidence Council
 * Analyzes retrieved context to extract behavioral signals
 */

import logger from '../utils/logger.js';

// Lazy initialization of OpenAI client
let openai = null;
async function getOpenAI() {
  if (!openai) {
    const OpenAI = (await import('openai')).default;
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }
  return openai;
}

/**
 * Extract signals from conversation context and retrieved data
 * @param {string} userMessage - Current user message
 * @param {object} context - Retrieved context (messages, files, memory)
 * @param {array} conversationHistory - Recent conversation history
 * @returns {Promise<object>} - Extracted signals
 */
export async function extractSignals(userMessage, context, conversationHistory = []) {
  try {
    // Build analysis prompt
    const prompt = buildSignalExtractionPrompt(userMessage, context, conversationHistory);
    
    const openaiClient = await getOpenAI();
    const response = await openaiClient.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a context analysis specialist. Extract behavioral signals from conversation data. Return valid JSON only.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 500
    });
    
    let signalsJson = response.choices[0].message.content.trim();
    
    // Remove markdown code blocks if present
    signalsJson = signalsJson.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    
    const signals = JSON.parse(signalsJson);
    
    console.log('🔍 RAW SIGNALS:', signals);
    logger.info('Signals extracted:', signals);
    return signals;
    
  } catch (error) {
    logger.error('Signal extraction error:', error);
    // Return default signals on error
    return getDefaultSignals();
  }
}

/**
 * Build prompt for signal extraction
 */
function buildSignalExtractionPrompt(userMessage, context, conversationHistory) {
  const parts = [
    'Analyze this conversation context and extract behavioral signals.',
    '',
    '## Current User Message:',
    userMessage,
    '',
    '## Retrieved Context Summary:',
    `- Messages found: ${context.messages?.length || 0}`,
    `- Files found: ${context.files?.length || 0}`,
    `- Memory entries: ${context.memory?.length || 0}`,
    ''
  ];
  
  // Add conversation history if available
  if (conversationHistory.length > 0) {
    parts.push('## Recent Conversation:');
    conversationHistory.slice(-3).forEach(msg => {
      parts.push(`${msg.role}: ${msg.content.substring(0, 100)}...`);
    });
    parts.push('');
  }
  
  // Add sample context snippets
  if (context.messages?.length > 0) {
    parts.push('## Sample Retrieved Messages:');
    context.messages.slice(0, 2).forEach(msg => {
      parts.push(`- ${msg.content.substring(0, 100)}... (similarity: ${msg.similarity?.toFixed(2)})`);
    });
    parts.push('');
  }
  
  parts.push('## Extract These Signals (0.0 to 1.0):');
  parts.push('Return JSON with this exact structure:');
  parts.push(JSON.stringify({
    urgency: 0.5,
    learning_intent: 0.5,
    emotional_tone: "neutral",
    complexity: 0.5,
    context_depth: 0.5,
    needs_teaching: 0.3,
    needs_coaching: 0.2,
    needs_direct_answer: 0.5,
    confidence: 0.8
  }, null, 2));
  
  parts.push('');
  parts.push('Where:');
  parts.push('- urgency: 0=casual, 1=time-sensitive');
  parts.push('- learning_intent: 0=just answer, 1=wants to learn');
  parts.push('- emotional_tone: "frustrated", "curious", "neutral", "confident", "confused"');
  parts.push('- complexity: 0=simple, 1=very complex');
  parts.push('- context_depth: 0=new topic, 1=deep continuation');
  parts.push('- needs_teaching: 0=no explanation, 1=full educational context');
  parts.push('- needs_coaching: 0=no guidance, 1=reflective questions/empowerment');
  parts.push('- needs_direct_answer: 0=exploration, 1=immediate solution');
  parts.push('- confidence: how confident you are in these signals');
  
  return parts.join('\n');
}

/**
 * Get default signals (fallback)
 */
function getDefaultSignals() {
  return {
    urgency: 0.5,
    learning_intent: 0.3,
    emotional_tone: 'neutral',
    complexity: 0.5,
    context_depth: 0.3,
    needs_teaching: 0.3,
    needs_coaching: 0.2,
    needs_direct_answer: 0.5,
    confidence: 0.5
  };
}

/**
 * Calculate response style weights from signals
 * Inspired by Roundtable Protocol's Influencer weighting
 * @param {object} signals - Extracted signals
 * @returns {object} - Style weights
 */
export function calculateResponseWeights(signals) {
  // Start with base weights
  let weights = {
    teacher: 0.3,      // Explains concepts, provides educational context
    coach: 0.2,        // Asks reflective questions, empowers growth
    problem_solver: 0.5 // Delivers direct solutions, answers questions
  };
  
  // Adjust based on signals
  
  // Learning intent increases teacher weight
  if (signals.learning_intent > 0.6) {
    weights.teacher += 0.3;
    weights.problem_solver -= 0.2;
  }
  
  // High urgency increases problem solver, reduces coaching
  if (signals.urgency > 0.7) {
    weights.problem_solver += 0.3;
    weights.coach -= 0.1;
    weights.teacher -= 0.1;
  }
  
  // Frustrated users need more coaching, less teaching
  if (signals.emotional_tone === 'frustrated' || signals.emotional_tone === 'confused') {
    weights.coach += 0.3;
    weights.teacher -= 0.2;
    weights.problem_solver += 0.1;
  }
  
  // Curious/interested users benefit from teaching
  if (signals.emotional_tone === 'curious') {
    weights.teacher += 0.2;
    weights.coach += 0.1;
  }
  
  // Direct answer needs override everything else
  if (signals.needs_direct_answer > 0.8) {
    weights.problem_solver = 0.8;
    weights.teacher = 0.1;
    weights.coach = 0.1;
  }
  
  // Normalize to sum to 1.0
  const total = weights.teacher + weights.coach + weights.problem_solver;
  weights.teacher /= total;
  weights.coach /= total;
  weights.problem_solver /= total;
  
  console.log('⚖️  RAW WEIGHTS:', weights);
  logger.info('Response weights calculated:', weights);
  
  return weights;
}

export default {
  extractSignals,
  calculateResponseWeights
};
