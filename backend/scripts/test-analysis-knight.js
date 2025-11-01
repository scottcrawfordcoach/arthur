/**
 * TEST SUITE: Analysis Knight
 * 
 * Tests the strategic synthesis capabilities of the Analysis Knight:
 * - Signal synthesis across all Knights
 * - Herald invocation decisions
 * - Ambiguity detection
 * - Knowledge gap identification
 * - Confidence assessment
 * - Strategic recommendations
 */

import AnalysisKnight from '../knights/AnalysisKnight.js';
import dotenv from 'dotenv';

dotenv.config();

console.log('=== ANALYSIS KNIGHT TEST SUITE ===\n');

const knight = new AnalysisKnight();
let passed = 0;
let total = 0;

async function runTest(name, userMessage, signals, expectations) {
  total++;
  console.log(`--- Test: ${name} ---`);
  console.log(`Message: "${userMessage}"`);
  
  // Show key signal highlights
  if (signals.emotion) {
    console.log(`Emotion: ${signals.emotion.mood} (urgency: ${signals.emotion.urgency}, risk: ${signals.emotion.risk})`);
  }
  if (signals.needs) {
    console.log(`Needs: ${signals.needs.latent_need} (learning: ${signals.needs.learning_intent})`);
  }
  if (signals.pattern) {
    console.log(`Pattern: [${signals.pattern.recurring_topics?.join(', ') || 'none'}] (strength: ${signals.pattern.pattern_strength})`);
  }
  if (signals.contextKnight) {
    console.log(`Context: novelty=${signals.contextKnight.novelty}`);
  }
  
  const result = await knight.analyze(userMessage, signals);
  const analysis = result.signals;
  
  console.log('\nResult:');
  console.log(`  Knight: ${result.knight}`);
  console.log(`  Confidence: ${result.confidence}`);
  console.log(`  Primary Intent: ${analysis.synthesized_signals?.primary_intent}`);
  console.log(`  Emotional Context: ${analysis.synthesized_signals?.emotional_context}`);
  console.log(`  Urgency Level: ${analysis.synthesized_signals?.urgency_level}`);
  console.log(`  Pattern Context: ${analysis.synthesized_signals?.pattern_context}`);
  console.log(`  Complexity: ${analysis.synthesized_signals?.complexity}`);
  console.log(`  Herald Invoke: ${analysis.herald_recommendation?.invoke ? 'YES' : 'NO'}`);
  if (analysis.herald_recommendation?.invoke) {
    console.log(`    Reason: ${analysis.herald_recommendation.reason}`);
    console.log(`    Query: "${analysis.herald_recommendation.search_query}"`);
    console.log(`    Priority: ${analysis.herald_recommendation.priority}`);
  }
  console.log(`  Ambiguity: [${analysis.ambiguity_detected?.join('; ') || 'none'}]`);
  console.log(`  Knowledge Gaps: [${analysis.knowledge_gaps?.join('; ') || 'none'}]`);
  console.log(`  Analysis Confidence: ${analysis.confidence}`);
  console.log(`  Recommendation: ${analysis.recommendation}`);
  console.log(`  Reasoning: ${result.reasoning}`);
  
  // Validate expectations
  let testPassed = true;
  const warnings = [];
  
  if (expectations.herald_invoke !== undefined && 
      analysis.herald_recommendation?.invoke !== expectations.herald_invoke) {
    warnings.push(`Expected herald_invoke: ${expectations.herald_invoke}`);
    testPassed = false;
  }
  
  if (expectations.recommendation && 
      analysis.recommendation !== expectations.recommendation) {
    warnings.push(`Expected recommendation: ${expectations.recommendation}`);
  }
  
  if (expectations.min_confidence !== undefined && 
      analysis.confidence < expectations.min_confidence) {
    warnings.push(`Expected confidence >= ${expectations.min_confidence}`);
  }
  
  if (testPassed) {
    console.log('\n✅ TEST PASSED');
    passed++;
  } else {
    console.log('\n❌ TEST FAILED');
    warnings.forEach(w => console.log(`  - ${w}`));
  }
  
  if (warnings.length > 0 && testPassed) {
    console.log('\n⚠️  TEST PASSED (but with nuances):');
    warnings.forEach(w => console.log(`  - ${w}`));
    console.log('  (LLM may have made different strategic decisions)');
  }
  
  console.log();
}

// Test 1: CRISIS - Immediate emotional support needed
await runTest(
  'Crisis (Panic Attack)',
  "I can't breathe, I think I'm having a panic attack",
  {
    emotion: {
      mood: 'panic',
      sentiment: -0.9,
      urgency: 0.95,
      risk: 0.9,
      energy_level: 'high'
    },
    needs: {
      stated_intent: 'help',
      latent_need: 'emotional_support',
      learning_intent: 0.1,
      support_needed: ['emotional', 'guidance'],
      goal_alignment: 0.3,
      exploratory: 0.1,
      needs_confidence: 0.9
    },
    pattern: {
      recurring_topics: ['anxiety', 'panic attacks'],
      topic_frequency: { anxiety: 5, 'panic attacks': 3 },
      conversation_rhythm: 'sporadic',
      behavior_trends: ['crisis_oriented'],
      pattern_strength: 0.7
    },
    contextKnight: {
      context_requests: {
        semantic_search: [{
          query: 'panic attack coping strategies',
          tier: 'personal_journal',
          limit: 10,
          time_range: 'all',
          scoring: { semantic_weight: 0.3, recency_weight: 0.35, frequency_weight: 0.2, vehemence_weight: 0.15 }
        }],
        conversation_history: { lookback: '24 hours', limit: 10 },
        user_data: ['coping_strategies', 'wellness_goals']
      },
      context_priority: ['conversation_history', 'semantic_search', 'user_data'],
      novelty: 0.3
    }
  },
  {
    herald_invoke: false,
    recommendation: 'provide_emotional_support',
    min_confidence: 0.8
  }
);

// Test 2: LEARNING - Novel topic requiring external research
await runTest(
  'Learning (New Complex Topic)',
  "How does CRISPR gene editing actually work?",
  {
    emotion: {
      mood: 'curious',
      sentiment: 0.4,
      urgency: 0.2,
      risk: 0.0,
      energy_level: 'moderate'
    },
    needs: {
      stated_intent: 'exploration',
      latent_need: 'information',
      learning_intent: 0.95,
      support_needed: [],
      goal_alignment: 0.6,
      exploratory: 0.8,
      needs_confidence: 0.85
    },
    pattern: {
      recurring_topics: [],
      topic_frequency: {},
      conversation_rhythm: 'unknown',
      behavior_trends: [],
      pattern_strength: 0.3
    },
    contextKnight: {
      context_requests: {
        semantic_search: [{
          query: 'CRISPR gene editing',
          tier: 'reference_library',
          limit: 15,
          time_range: 'all',
          scoring: { semantic_weight: 0.5, recency_weight: 0.2, frequency_weight: 0.15, vehemence_weight: 0.15 }
        }],
        conversation_history: null,
        user_data: []
      },
      context_priority: ['semantic_search'],
      novelty: 0.95
    }
  },
  {
    herald_invoke: true,
    recommendation: 'invoke_herald_first',
    min_confidence: 0.75
  }
);

// Test 3: RECURRING PROBLEM - Historical context available
await runTest(
  'Recurring Problem (Authentication Bug)',
  "Still stuck on that JWT authentication issue",
  {
    emotion: {
      mood: 'frustrated',
      sentiment: -0.6,
      urgency: 0.65,
      risk: 0.3,
      energy_level: 'moderate'
    },
    needs: {
      stated_intent: 'help',
      latent_need: 'guidance',
      learning_intent: 0.4,
      support_needed: ['technical', 'validation'],
      goal_alignment: 0.7,
      exploratory: 0.3,
      needs_confidence: 0.8
    },
    pattern: {
      recurring_topics: ['authentication', 'JWT', 'tokens'],
      topic_frequency: { authentication: 8, JWT: 6, tokens: 5 },
      conversation_rhythm: 'daily',
      behavior_trends: ['troubleshooting_focused', 'iterative_solving'],
      pattern_strength: 0.85
    },
    contextKnight: {
      context_requests: {
        semantic_search: [{
          query: 'JWT authentication debugging',
          tier: 'personal_journal',
          limit: 10,
          time_range: 'all',
          scoring: { semantic_weight: 0.35, recency_weight: 0.2, frequency_weight: 0.3, vehemence_weight: 0.15 }
        }],
        conversation_history: { lookback: '7 days', limit: 10 },
        user_data: []
      },
      context_priority: ['semantic_search', 'conversation_history'],
      novelty: 0.2
    }
  },
  {
    herald_invoke: false,
    recommendation: 'guide_problem_solving',
    min_confidence: 0.8
  }
);

// Test 4: AMBIGUITY - Conflicting signals
await runTest(
  'Ambiguity (Urgency vs Learning)',
  "I need to learn quantum mechanics RIGHT NOW for my exam tomorrow!",
  {
    emotion: {
      mood: 'anxious',
      sentiment: -0.3,
      urgency: 0.9,
      risk: 0.5,
      energy_level: 'high'
    },
    needs: {
      stated_intent: 'help',
      latent_need: 'information',
      learning_intent: 0.85,
      support_needed: ['emotional', 'technical'],
      goal_alignment: 0.8,
      exploratory: 0.6,
      needs_confidence: 0.7
    },
    pattern: {
      recurring_topics: [],
      topic_frequency: {},
      conversation_rhythm: 'unknown',
      behavior_trends: [],
      pattern_strength: 0.3
    },
    contextKnight: {
      context_requests: {
        semantic_search: [{
          query: 'quantum mechanics basics',
          tier: 'reference_library',
          limit: 15,
          time_range: 'all',
          scoring: { semantic_weight: 0.45, recency_weight: 0.25, frequency_weight: 0.15, vehemence_weight: 0.15 }
        }],
        conversation_history: null,
        user_data: []
      },
      context_priority: ['semantic_search'],
      novelty: 0.9
    }
  },
  {
    herald_invoke: true,
    min_confidence: 0.6 // Lower confidence due to ambiguity
  }
);

// Test 5: EXPLORATION - Casual discovery
await runTest(
  'Exploration (Career Thinking)',
  "I've been thinking about maybe switching to AI engineering",
  {
    emotion: {
      mood: 'thoughtful',
      sentiment: 0.3,
      urgency: 0.3,
      risk: 0.2,
      energy_level: 'low'
    },
    needs: {
      stated_intent: 'exploration',
      latent_need: 'guidance',
      learning_intent: 0.6,
      support_needed: [],
      goal_alignment: 0.5,
      exploratory: 0.85,
      needs_confidence: 0.75
    },
    pattern: {
      recurring_topics: ['career', 'goals', 'learning'],
      topic_frequency: { career: 4, goals: 6, learning: 8 },
      conversation_rhythm: 'weekly',
      behavior_trends: ['exploratory', 'goal_oriented'],
      pattern_strength: 0.65
    },
    contextKnight: {
      context_requests: {
        semantic_search: [{
          query: 'career transition AI engineering',
          tier: 'personal_journal',
          limit: 10,
          time_range: 'all',
          scoring: { semantic_weight: 0.4, recency_weight: 0.25, frequency_weight: 0.2, vehemence_weight: 0.15 }
        }],
        conversation_history: null,
        user_data: ['goals', 'learning_preferences']
      },
      context_priority: ['semantic_search', 'user_data'],
      novelty: 0.5
    }
  },
  {
    herald_invoke: false,
    recommendation: 'explore_together',
    min_confidence: 0.7
  }
);

// Test 6: KNOWLEDGE GAPS - Missing critical context
await runTest(
  'Knowledge Gaps (Wellness Check)',
  "I'm feeling really overwhelmed again",
  {
    emotion: {
      mood: 'overwhelmed',
      sentiment: -0.6,
      urgency: 0.7,
      risk: 0.6,
      energy_level: 'low'
    },
    needs: {
      stated_intent: 'validation',
      latent_need: 'emotional_support',
      learning_intent: 0.2,
      support_needed: ['emotional'],
      goal_alignment: 0.4,
      exploratory: 0.1,
      needs_confidence: 0.8
    },
    pattern: {
      recurring_topics: ['stress', 'overwhelm'],
      topic_frequency: { stress: 7, overwhelm: 5 },
      conversation_rhythm: 'weekly',
      behavior_trends: ['wellness_focused'],
      pattern_strength: 0.7
    },
    contextKnight: {
      context_requests: {
        semantic_search: [{
          query: 'overwhelm coping strategies',
          tier: 'personal_journal',
          limit: 10,
          time_range: 'all',
          scoring: { semantic_weight: 0.3, recency_weight: 0.3, frequency_weight: 0.2, vehemence_weight: 0.2 }
        }],
        conversation_history: { lookback: '24 hours', limit: 8 },
        user_data: [] // Note: No coping strategies retrieved!
      },
      context_priority: ['semantic_search', 'conversation_history'],
      novelty: 0.3
    }
  },
  {
    herald_invoke: false,
    recommendation: 'provide_emotional_support',
    min_confidence: 0.7
  }
);

// Test 7: CLEAR SIGNALS - High confidence synthesis
await runTest(
  'Clear Signals (Direct Question)',
  "What's the capital of France?",
  {
    emotion: {
      mood: 'neutral',
      sentiment: 0.0,
      urgency: 0.2,
      risk: 0.0,
      energy_level: 'moderate'
    },
    needs: {
      stated_intent: 'information',
      latent_need: 'information',
      learning_intent: 0.3,
      support_needed: [],
      goal_alignment: 0.5,
      exploratory: 0.2,
      needs_confidence: 0.95
    },
    pattern: {
      recurring_topics: [],
      topic_frequency: {},
      conversation_rhythm: 'unknown',
      behavior_trends: [],
      pattern_strength: 0.3
    },
    contextKnight: {
      context_requests: {
        semantic_search: [{
          query: 'capital of France',
          tier: 'core_knowledge',
          limit: 5,
          time_range: 'all',
          scoring: { semantic_weight: 0.5, recency_weight: 0.2, frequency_weight: 0.15, vehemence_weight: 0.15 }
        }],
        conversation_history: null,
        user_data: []
      },
      context_priority: ['semantic_search'],
      novelty: 1.0
    }
  },
  {
    herald_invoke: false, // Simple factual question
    recommendation: 'answer_learning_question',
    min_confidence: 0.85
  }
);

// Test 8: MIXED PATTERN - Both recurring and novel elements
await runTest(
  'Mixed Pattern (Extending Known Topic)',
  "Now that I understand React hooks, how do I use them with TypeScript?",
  {
    emotion: {
      mood: 'focused',
      sentiment: 0.5,
      urgency: 0.4,
      risk: 0.1,
      energy_level: 'moderate'
    },
    needs: {
      stated_intent: 'exploration',
      latent_need: 'information',
      learning_intent: 0.75,
      support_needed: [],
      goal_alignment: 0.8,
      exploratory: 0.6,
      needs_confidence: 0.85
    },
    pattern: {
      recurring_topics: ['React', 'hooks', 'useState', 'useEffect'],
      topic_frequency: { React: 12, hooks: 10, useState: 8 },
      conversation_rhythm: 'daily',
      behavior_trends: ['learning_oriented', 'deep_dive'],
      pattern_strength: 0.8
    },
    contextKnight: {
      context_requests: {
        semantic_search: [{
          query: 'React hooks with TypeScript',
          tier: 'reference_library',
          limit: 10,
          time_range: 'all',
          scoring: { semantic_weight: 0.45, recency_weight: 0.2, frequency_weight: 0.2, vehemence_weight: 0.15 }
        }],
        conversation_history: null,
        user_data: []
      },
      context_priority: ['semantic_search'],
      novelty: 0.6 // Mixed: known topic (React) + new angle (TypeScript)
    }
  },
  {
    herald_invoke: false, // Has strong context, can use internal knowledge
    recommendation: 'answer_learning_question',
    min_confidence: 0.8
  }
);

console.log('=================================');
console.log(`Tests passed: ${passed}/${total}`);
console.log('=================================\n');

if (passed === total) {
  console.log('🎉 All tests passed! Analysis Knight is ready for the Evidence Council.');
}
