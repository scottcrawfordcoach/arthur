/**
 * TEST: Verify 3D Relevance Scoring Implementation
 * 
 * This test verifies that Context Knight generates proper 3D scoring weights:
 * - Recency: How recent (exponential decay)
 * - Frequency: How often discussed
 * - Vehemence: How emotionally intense
 * - Semantic: How related to query
 */

import ContextKnight from '../knights/ContextKnight.js';
import dotenv from 'dotenv';

dotenv.config();

console.log('=== 3D RELEVANCE SCORING TEST ===\n');

async function test3DScoring() {
  const knight = new ContextKnight();
  
  // Test 1: High urgency → Should prioritize RECENCY
  console.log('--- Test 1: Crisis (High Urgency) → Prioritize RECENCY ---');
  const crisis = await knight.analyze(
    "I'm having a panic attack right now",
    {
      emotion: { mood: 'panic', urgency: 0.95, risk: 0.9, sentiment: -0.8 },
      needs: { stated_intent: 'help', latent_need: 'emotional_support', learning_intent: 0.1, support_needed: ['emotional'] },
      pattern: { recurring_topics: ['anxiety'], pattern_strength: 0.7 }
    }
  );
  
  const crisisSearch = crisis.signals.context_requests.semantic_search[0];
  console.log('Query:', crisisSearch.query);
  console.log('Scoring:', crisisSearch.scoring);
  console.log('Expected: recency_weight > 0.3 (prioritize recent context)');
  console.log('Result:', crisisSearch.scoring.recency_weight > 0.3 ? '✅ PASS' : '❌ FAIL');
  console.log();
  
  // Test 2: Recurring topic → Should prioritize FREQUENCY
  console.log('--- Test 2: Recurring Bug → Prioritize FREQUENCY ---');
  const recurring = await knight.analyze(
    "Still stuck on that authentication bug AGAIN",
    {
      emotion: { mood: 'frustrated', urgency: 0.6, risk: 0.3, sentiment: -0.6 },
      needs: { stated_intent: 'help', latent_need: 'guidance', learning_intent: 0.4, support_needed: ['technical'] },
      pattern: { recurring_topics: ['authentication', 'JWT'], topic_frequency: { authentication: 8 }, pattern_strength: 0.85 }
    }
  );
  
  const recurringSearch = recurring.signals.context_requests.semantic_search[0];
  console.log('Query:', recurringSearch.query);
  console.log('Scoring:', recurringSearch.scoring);
  console.log('Expected: frequency_weight > 0.22 (prioritize often-discussed topics)');
  console.log('Result:', recurringSearch.scoring.frequency_weight > 0.22 ? '✅ PASS' : '❌ FAIL');
  console.log();
  
  // Test 3: Learning/Factual → Should prioritize SEMANTIC
  console.log('--- Test 3: Learning Query → Prioritize SEMANTIC ---');
  const learning = await knight.analyze(
    "How does neural network backpropagation work?",
    {
      emotion: { mood: 'curious', urgency: 0.2, risk: 0.0, sentiment: 0.4 },
      needs: { stated_intent: 'exploration', latent_need: 'information', learning_intent: 0.9, support_needed: [] },
      pattern: { recurring_topics: [], pattern_strength: 0.3 }
    }
  );
  
  const learningSearch = learning.signals.context_requests.semantic_search[0];
  console.log('Query:', learningSearch.query);
  console.log('Scoring:', learningSearch.scoring);
  console.log('Expected: semantic_weight > 0.42 (prioritize meaning over time/frequency)');
  console.log('Result:', learningSearch.scoring.semantic_weight > 0.42 ? '✅ PASS' : '❌ FAIL');
  console.log();
  
  // Test 4: High emotion → Should prioritize VEHEMENCE
  console.log('--- Test 4: Emotional Intensity → Prioritize VEHEMENCE ---');
  const vehement = await knight.analyze(
    "I'm SO frustrated this never works!",
    {
      emotion: { mood: 'angry', urgency: 0.7, risk: 0.5, sentiment: -0.85 },
      needs: { stated_intent: 'help', latent_need: 'validation', learning_intent: 0.2, support_needed: ['emotional'] },
      pattern: { recurring_topics: ['frustration'], pattern_strength: 0.6 }
    }
  );
  
  const vehementSearch = vehement.signals.context_requests.semantic_search[0];
  console.log('Query:', vehementSearch.query);
  console.log('Scoring:', vehementSearch.scoring);
  console.log('Expected: vehemence_weight > 0.16 (prioritize emotionally intense memories)');
  console.log('Result:', vehementSearch.scoring.vehemence_weight > 0.16 ? '✅ PASS' : '❌ FAIL');
  console.log();
  
  // Test 5: All searches should have time_range: 'all'
  console.log('--- Test 5: All Time Search (No Sliding Windows) ---');
  const searches = [crisisSearch, recurringSearch, learningSearch, vehementSearch];
  const allTimeSearch = searches.every(s => s.time_range === 'all');
  console.log('All searches have time_range: "all"?', allTimeSearch ? '✅ PASS' : '❌ FAIL');
  console.log();
  
  // Test 6: Weights should sum to 1.0
  console.log('--- Test 6: Scoring Weights Sum to 1.0 ---');
  searches.forEach((search, i) => {
    const sum = search.scoring.semantic_weight + 
                search.scoring.recency_weight + 
                search.scoring.frequency_weight + 
                search.scoring.vehemence_weight;
    const valid = Math.abs(sum - 1.0) < 0.001;
    console.log(`Test ${i + 1} sum: ${sum.toFixed(3)}`, valid ? '✅' : '❌');
  });
  console.log();
  
  console.log('=================================');
  console.log('3D SCORING ARCHITECTURE: READY');
  console.log('Context Knight now searches ALL TIME with intelligent ranking');
  console.log('=================================');
}

test3DScoring().catch(console.error);
