// Copyright (c) 2025 Scott Crawford. All rights reserved.

/**
 * Signal Schema Definitions
 * Defines the structure and validation rules for Knight signals
 * Following ARTHUR_STRATEGY_v3 specifications
 */

const signalsSchema = {
  /**
   * Pattern Knight Signals
   * Detect behavioral trends and patterns from user history
   */
  pattern: {
    recurring_topics: {
      type: 'array',
      items: 'string',
      description: 'List of recurring conversation topics',
      example: ['training', 'nutrition', 'sleep']
    },
    topic_frequency: {
      type: 'object',
      description: 'Frequency distribution of topics (0.0 - 1.0)',
      example: { 'training': 0.45, 'nutrition': 0.30, 'sleep': 0.25 }
    },
    conversation_rhythm: {
      type: 'string',
      enum: ['daily_morning', 'daily_evening', 'weekly', 'sporadic', 'unknown'],
      description: 'Pattern of user interaction timing'
    },
    behavior_trends: {
      type: 'object',
      description: 'Detected behavioral trends',
      example: {
        training_plateau: true,
        sleep_improving: true,
        stress_increasing: false
      }
    },
    pattern_strength: {
      type: 'number',
      range: [0, 1],
      description: 'Confidence in detected patterns'
    }
  },

  /**
   * Emotion Knight Signals
   * Analyze tone, affect, and emotional state
   */
  emotion: {
    sentiment: {
      type: 'number',
      range: [-1, 1],
      description: 'Overall sentiment: -1 (very negative) to +1 (very positive)'
    },
    mood: {
      type: 'string',
      enum: ['excited', 'happy', 'calm', 'neutral', 'frustrated', 'anxious', 'sad', 'angry'],
      description: 'Detected emotional state'
    },
    urgency: {
      type: 'number',
      range: [0, 1],
      description: 'Urgency level: 0.0 (casual) to 1.0 (urgent)'
    },
    risk: {
      type: 'number',
      range: [0, 1],
      description: 'Risk assessment: 0.0 (safe) to 1.0 (crisis)'
    },
    tone_indicators: {
      type: 'array',
      items: 'string',
      description: 'List of detected tone markers',
      example: ['exclamation', 'short_sentences', 'negative_words']
    },
    energy_level: {
      type: 'string',
      enum: ['high', 'medium', 'low', 'unknown'],
      description: 'Detected energy level from message'
    }
  },

  /**
   * Needs Knight Signals
   * Infer latent intent and actual needs
   */
  needs: {
    stated_intent: {
      type: 'string',
      enum: ['information', 'guidance', 'support', 'validation', 'conversation', 'unknown'],
      description: 'What user explicitly asked for'
    },
    latent_need: {
      type: 'string',
      enum: ['emotional_support', 'information', 'validation', 'problem_solving', 'exploration', 'accountability', 'unknown'],
      description: 'What user might actually need'
    },
    learning_intent: {
      type: 'number',
      range: [0, 1],
      description: 'Wants to learn (1.0) vs just get answer (0.0)'
    },
    support_needed: {
      type: 'string',
      enum: ['coaching', 'teaching', 'problem_solving', 'information', 'validation', 'none'],
      description: 'Type of support needed'
    },
    goal_alignment: {
      type: 'number',
      range: [0, 1],
      description: 'How well request aligns with user\'s known goals'
    },
    exploratory: {
      type: 'boolean',
      description: 'Exploring topic vs focused question'
    },
    needs_confidence: {
      type: 'number',
      range: [0, 1],
      description: 'Confidence in needs assessment'
    }
  },

  /**
   * Context Knight Signals
   * Determine what context is relevant (requests, not fetches)
   */
  context: {
    context_requests: {
      type: 'object',
      description: 'Structured requests for Librarian - searches ALL TIME with 3D scoring',
      properties: {
        semantic_search: {
          type: 'array',
          items: 'object',
          description: 'Semantic searches with Recency/Frequency/Vehemence scoring',
          example: [{
            query: 'work stress',
            tier: 'personal_journal',
            limit: 20,
            time_range: 'all',
            scoring: {
              semantic_weight: 0.4,
              recency_weight: 0.25,
              frequency_weight: 0.20,
              vehemence_weight: 0.15
            }
          }]
        },
        conversation_history: {
          type: 'object',
          description: 'Timeline view (not full search)',
          properties: {
            lookback: { type: 'string', enum: ['24 hours', '7 days', '30 days'] },
            limit: { type: 'number' }
          }
        },
        user_data: {
          type: 'array',
          items: 'string',
          description: 'User preferences to retrieve',
          example: ['wellness_goals', 'coping_strategies']
        }
      }
    },
    context_priority: {
      type: 'array',
      items: 'string',
      description: 'Order of context importance',
      example: ['semantic_search', 'user_data', 'conversation_history']
    },
    novelty: {
      type: 'number',
      range: [0, 1],
      description: 'How much new info vs known topics (0 = all known, 1 = all new)'
    }
  },

  /**
   * Analysis Knight Signals
   * Synthesized signals and recommendations
   */
  analysis: {
    synthesized_signals: {
      type: 'object',
      description: 'Merged and weighted signals from all Knights'
    },
    herald_recommendation: {
      type: 'object',
      properties: {
        invoke: { type: 'boolean' },
        reason: { type: 'string' },
        search_query: { type: 'string' },
        priority: { type: 'string', enum: ['primary', 'fallback', 'none'] }
      },
      description: 'Whether to invoke Herald for web search'
    },
    ambiguity_detected: {
      type: 'boolean',
      description: 'Whether user message is ambiguous'
    },
    knowledge_gaps: {
      type: 'array',
      items: 'string',
      description: 'Identified gaps in knowledge',
      example: ['current research', 'user-specific data']
    },
    confidence: {
      type: 'number',
      range: [0, 1],
      description: 'Overall confidence in analysis'
    },
    recommendation: {
      type: 'string',
      description: 'High-level recommendation for Arthur'
    }
  }
};

/**
 * Validate signals against schema
 * @param {string} knightType - Type of knight (pattern, emotion, needs, context, analysis)
 * @param {Object} signals - Signals to validate
 * @returns {Object} - { valid: boolean, errors: Array }
 */
function validateSignals(knightType, signals) {
  const schema = signalsSchema[knightType];
  if (!schema) {
    return { valid: false, errors: [`Unknown knight type: ${knightType}`] };
  }

  const errors = [];

  for (const [key, spec] of Object.entries(schema)) {
    const value = signals[key];

    // Skip optional fields
    if (value === undefined) continue;

    // Type check
    if (spec.type === 'number') {
      if (typeof value !== 'number') {
        errors.push(`${key} should be number, got ${typeof value}`);
      } else if (spec.range) {
        const [min, max] = spec.range;
        if (value < min || value > max) {
          errors.push(`${key} should be in range [${min}, ${max}], got ${value}`);
        }
      }
    } else if (spec.type === 'string') {
      if (typeof value !== 'string') {
        errors.push(`${key} should be string, got ${typeof value}`);
      } else if (spec.enum && !spec.enum.includes(value)) {
        errors.push(`${key} should be one of [${spec.enum.join(', ')}], got ${value}`);
      }
    } else if (spec.type === 'boolean') {
      if (typeof value !== 'boolean') {
        errors.push(`${key} should be boolean, got ${typeof value}`);
      }
    } else if (spec.type === 'array') {
      if (!Array.isArray(value)) {
        errors.push(`${key} should be array, got ${typeof value}`);
      }
    } else if (spec.type === 'object') {
      if (typeof value !== 'object' || value === null) {
        errors.push(`${key} should be object, got ${typeof value}`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Get example signals for a knight type
 * Useful for testing and documentation
 * @param {string} knightType - Type of knight
 * @returns {Object} - Example signals
 */
function getExampleSignals(knightType) {
  const examples = {
    pattern: {
      recurring_topics: ['training', 'nutrition'],
      topic_frequency: { 'training': 0.6, 'nutrition': 0.4 },
      conversation_rhythm: 'daily_evening',
      behavior_trends: {
        training_plateau: true,
        sleep_improving: false
      },
      pattern_strength: 0.75
    },
    emotion: {
      sentiment: 0.3,
      mood: 'frustrated',
      urgency: 0.6,
      risk: 0.1,
      tone_indicators: ['short_sentences', 'negative_words'],
      energy_level: 'low'
    },
    needs: {
      stated_intent: 'information',
      latent_need: 'emotional_support',
      learning_intent: 0.7,
      support_needed: 'coaching',
      goal_alignment: 0.8,
      exploratory: false,
      needs_confidence: 0.75
    },
    context: {
      context_requests: {
        semantic_search: {
          query: 'training plateau coaching',
          tiers: ['core_knowledge', 'reference_library'],
          limit: 10
        },
        conversation_history: {
          last_n: 10,
          include_topics: ['training']
        },
        user_data: {
          preferences: true,
          wellness_data: { type: 'activity', lookback: '30d' },
          goals: true
        }
      },
      context_priority: ['semantic_search', 'user_data', 'conversation_history'],
      novelty: 0.3
    },
    analysis: {
      synthesized_signals: {
        mood: 'frustrated',
        urgency: 0.6,
        learning_intent: 0.7,
        recurring_topics: ['training'],
        latent_need: 'emotional_support'
      },
      herald_recommendation: {
        invoke: false,
        reason: 'Coaching topic with KB coverage',
        search_query: '',
        priority: 'none'
      },
      ambiguity_detected: false,
      knowledge_gaps: [],
      confidence: 0.75,
      recommendation: 'Coaching approach with pattern awareness'
    }
  };

  return examples[knightType] || {};
}

export {
  signalsSchema,
  validateSignals,
  getExampleSignals
};
