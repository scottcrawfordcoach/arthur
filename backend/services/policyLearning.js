// Copyright (c) 2025 Scott Crawford. All rights reserved.

/**
 * Policy Learning Service
 * Adapts user-specific policy biases based on natural language feedback
 * Users never see settings - the system just "gets to know them"
 */

import logger from '../utils/logger.js';
import { query, execute } from './db.js';

/**
 * Feedback patterns that indicate policy adjustments
 */
const FEEDBACK_PATTERNS = {
  // Coaching reduction
  reduce_questions: {
    patterns: [
      /ask (me )?less questions?/i,
      /too many questions?/i,
      /fewer questions?/i
    ],
    adjustment: { coaching_signal_bias: -0.5, exploratory_questions: -0.5 }
  },
  
  stop_questions: {
    patterns: [
      /stop ask(ing)?.*questions?/i,
      /just (want|give me|need) answers?/i,
      /don'?t ask me/i,
      /no (more )?questions?/i
    ],
    adjustment: { coaching_signal_bias: -0.75, exploratory_questions: -1.0 }
  },
  
  more_questions: {
    patterns: [
      /ask me more questions?/i,
      /help me think/i,
      /explore (this|that) with me/i
    ],
    adjustment: { coaching_signal_bias: 0.3, exploratory_questions: 0.5 }
  },
  
  // Teaching/explanation preferences
  more_explanation: {
    patterns: [
      /explain (more|better|deeper)/i,
      /want to understand/i,
      /how does (this|that|it) work/i,
      /tell me (why|how)/i
    ],
    adjustment: { teacher_signal_bias: 0.3, learning_intent_boost: 0.2 }
  },
  
  less_explanation: {
    patterns: [
      /too much explanation/i,
      /simpler (please|answer)/i,
      /just the (basics|summary)/i,
      /(skip|less) detail/i
    ],
    adjustment: { teacher_signal_bias: -0.3, complexity_tolerance: -0.2 }
  },
  
  // Directness preferences
  more_direct: {
    patterns: [
      /be more direct/i,
      /get to the point/i,
      /bottom line/i,
      /tl;?dr/i,
      /quick answer/i
    ],
    adjustment: { problem_solver_bias: 0.3, urgency_sensitivity: 0.2 }
  },
  
  less_direct: {
    patterns: [
      /too brief/i,
      /too short/i,
      /more context/i,
      /elaborate/i
    ],
    adjustment: { problem_solver_bias: -0.2, teacher_signal_bias: 0.2 }
  },
  
  // Tone/formality
  more_casual: {
    patterns: [
      /be more casual/i,
      /too formal/i,
      /relax/i,
      /friendly/i
    ],
    adjustment: { formality_level: -0.3 }
  },
  
  more_formal: {
    patterns: [
      /be more (formal|professional)/i,
      /too casual/i,
      /business tone/i
    ],
    adjustment: { formality_level: 0.3 }
  }
};

/**
 * Detect if user message contains policy feedback
 * @param {string} message - User message
 * @returns {Object|null} - Detected feedback or null
 */
export function detectPolicyFeedback(message) {
  for (const [type, config] of Object.entries(FEEDBACK_PATTERNS)) {
    for (const pattern of config.patterns) {
      if (pattern.test(message)) {
        logger.info(`📊 Policy feedback detected: ${type}`);
        return {
          type,
          adjustment: config.adjustment
        };
      }
    }
  }
  return null;
}

/**
 * Get user's current policy preferences
 * @param {string} userId - User ID
 * @returns {Promise<Object>} - User preferences
 */
export async function getUserPolicyPreferences(userId = 'default') {
  const result = await query(
    'SELECT policy_overrides FROM assistant_user_preferences WHERE user_id = ?',
    [userId]
  );
  
  if (result.length > 0 && result[0].policy_overrides) {
    return JSON.parse(result[0].policy_overrides);
  }
  
  // Return defaults
  return {
    coaching_signal_bias: 1.0,
    teacher_signal_bias: 1.0,
    problem_solver_bias: 1.0,
    exploratory_questions: 1.0,
    learning_intent_boost: 0.0,
    complexity_tolerance: 0.0,
    urgency_sensitivity: 0.0,
    formality_level: 0.0
  };
}

/**
 * Apply policy adjustment from user feedback
 * @param {string} userId - User ID
 * @param {Object} adjustment - Adjustment to apply
 * @returns {Promise<Object>} - Updated preferences
 */
export async function applyPolicyAdjustment(userId = 'default', adjustment) {
  const current = await getUserPolicyPreferences(userId);
  
  // Apply adjustments with bounds checking
  const updated = { ...current };
  
  for (const [key, delta] of Object.entries(adjustment)) {
    if (key in updated) {
      // Apply delta
      updated[key] = (updated[key] || 0) + delta;
      
      // Clamp to reasonable bounds
      if (key.includes('bias')) {
        updated[key] = Math.max(0, Math.min(2.0, updated[key])); // 0 to 2x
      } else if (key === 'exploratory_questions') {
        updated[key] = Math.max(0, Math.min(1.0, updated[key])); // 0 to 100%
      } else {
        updated[key] = Math.max(-1.0, Math.min(1.0, updated[key])); // -1 to +1
      }
    }
  }
  
  // Log the adjustment
  logger.info(`🎛️  Policy adjusted for user ${userId}:`, adjustment);
  logger.info(`   New preferences:`, updated);
  
  // Store updated preferences
  await execute(
    `INSERT OR REPLACE INTO assistant_user_preferences (user_id, policy_overrides, updated_at)
     VALUES (?, ?, CURRENT_TIMESTAMP)`,
    [userId, JSON.stringify(updated)]
  );
  
  // Log to feedback history
  await execute(
    `INSERT INTO assistant_policy_feedback_history (user_id, feedback_type, adjustment, applied_at)
     VALUES (?, ?, ?, CURRENT_TIMESTAMP)`,
    [userId, Object.keys(adjustment).join(','), JSON.stringify(adjustment)]
  );
  
  return updated;
}

/**
 * Apply user preferences to calculated weights
 * @param {Object} weights - Base weights from signals
 * @param {Object} signals - Extracted signals
 * @param {Object} userPrefs - User preferences
 * @returns {Object} - Adjusted weights and signals
 */
export function applyUserPreferences(weights, signals, userPrefs) {
  const adjustedWeights = { ...weights };
  const adjustedSignals = { ...signals };
  
  // Apply bias multipliers to weights
  if (userPrefs.coaching_signal_bias !== 1.0) {
    adjustedWeights.coach *= userPrefs.coaching_signal_bias;
  }
  
  if (userPrefs.teacher_signal_bias !== 1.0) {
    adjustedWeights.teacher *= userPrefs.teacher_signal_bias;
  }
  
  if (userPrefs.problem_solver_bias !== 1.0) {
    adjustedWeights.problem_solver *= userPrefs.problem_solver_bias;
  }
  
  // Apply signal adjustments
  if (userPrefs.learning_intent_boost) {
    adjustedSignals.learning_intent = Math.min(1.0, 
      adjustedSignals.learning_intent + userPrefs.learning_intent_boost
    );
  }
  
  if (userPrefs.urgency_sensitivity) {
    adjustedSignals.urgency = Math.min(1.0,
      adjustedSignals.urgency + userPrefs.urgency_sensitivity
    );
  }
  
  if (userPrefs.complexity_tolerance) {
    adjustedSignals.complexity = Math.max(0, Math.min(1.0,
      adjustedSignals.complexity + userPrefs.complexity_tolerance
    ));
  }
  
  // Suppress exploratory questions if user requested
  if (userPrefs.exploratory_questions <= 0.2) {
    adjustedSignals.suppress_exploratory_questions = true;
  } else if (userPrefs.exploratory_questions < 1.0) {
    adjustedSignals.reduce_exploratory_questions = userPrefs.exploratory_questions;
  }
  
  // Normalize weights after adjustments
  const total = adjustedWeights.teacher + adjustedWeights.coach + adjustedWeights.problem_solver;
  adjustedWeights.teacher /= total;
  adjustedWeights.coach /= total;
  adjustedWeights.problem_solver /= total;
  
  return { weights: adjustedWeights, signals: adjustedSignals };
}

/**
 * Generate a subtle acknowledgment message for policy changes
 * @param {string} feedbackType - Type of feedback detected
 * @returns {string|null} - Acknowledgment message or null
 */
export function generateAcknowledgment(feedbackType) {
  const acknowledgments = {
    reduce_questions: null, // Silent adjustment
    stop_questions: "Got it - I'll focus on giving you direct answers.",
    more_questions: null,
    more_explanation: null,
    less_explanation: null,
    more_direct: "Understood - I'll be more concise.",
    less_direct: null,
    more_casual: null,
    more_formal: null
  };
  
  return acknowledgments[feedbackType] || null;
}

export default {
  detectPolicyFeedback,
  getUserPolicyPreferences,
  applyPolicyAdjustment,
  applyUserPreferences,
  generateAcknowledgment
};
