/**
 * Test EmotionKnight
 * Validates emotion analysis for various user messages
 */

import EmotionKnight from '../knights/EmotionKnight.js';
import { validateSignals } from '../knights/signalsSchema.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

console.log('😊 Testing Emotion Knight...\n');

const knight = new EmotionKnight();

// Test cases covering different emotional states
const testCases = [
  {
    name: 'Positive - High Energy',
    message: "I just crushed my workout! Feeling amazing and so motivated!",
    expected: {
      sentiment: 'positive',
      mood: ['happy', 'excited'],
      urgency: 'low',
      risk: 'low',
      energy_level: ['high', 'medium']
    }
  },
  {
    name: 'Negative - Frustrated',
    message: "I'm so stuck. Nothing seems to be working and I'm getting really frustrated.",
    expected: {
      sentiment: 'negative',
      mood: ['frustrated', 'sad'],
      urgency: 'medium',
      risk: 'low',
      energy_level: ['low', 'medium']
    }
  },
  {
    name: 'Urgent - Help Needed',
    message: "Help! I really need to figure this out quickly!",
    expected: {
      sentiment: 'neutral',
      mood: ['anxious', 'frustrated', 'neutral'],
      urgency: 'high',
      risk: 'low',
      energy_level: ['high', 'medium']
    }
  },
  {
    name: 'Crisis - High Risk',
    message: "I can't do this anymore. I just want to give up.",
    expected: {
      sentiment: 'negative',
      mood: ['sad', 'anxious', 'frustrated'],
      urgency: 'high',
      risk: 'high',
      energy_level: ['low', 'medium']
    }
  },
  {
    name: 'Calm - Neutral',
    message: "I'm wondering about training strategies for the next phase.",
    expected: {
      sentiment: 'neutral',
      mood: ['calm', 'neutral'],
      urgency: 'low',
      risk: 'low',
      energy_level: ['medium', 'low']
    }
  },
  {
    name: 'Anxious - Worried',
    message: "I'm really worried this won't work out. What if I fail?",
    expected: {
      sentiment: 'negative',
      mood: ['anxious', 'worried', 'frustrated'],
      urgency: 'medium',
      risk: 'low',
      energy_level: ['medium', 'low']
    }
  },
  {
    name: 'Short - Low Energy',
    message: "tired",
    expected: {
      sentiment: 'neutral',
      mood: ['neutral', 'calm', 'sad'],
      urgency: 'low',
      risk: 'low',
      energy_level: 'low'
    }
  },
  {
    name: 'Excited - Multiple Exclamations',
    message: "This is incredible!! I can't believe the progress I'm making!!!",
    expected: {
      sentiment: 'positive',
      mood: ['excited', 'happy'],
      urgency: 'low',
      risk: 'low',
      energy_level: 'high'
    }
  }
];

async function runTests() {
  console.log('=' .repeat(70));
  console.log('Test 1: Quick Pattern Analysis');
  console.log('=' .repeat(70));
  
  // Test quick analysis on a few cases
  const quickTests = [testCases[3], testCases[6]]; // Crisis and short message
  
  for (const test of quickTests) {
    console.log(`\nTest: ${test.name}`);
    console.log(`Message: "${test.message}"`);
    
    const result = knight.quickAnalysis(test.message);
    console.log('Quick Analysis:', JSON.stringify(result.signals, null, 2));
    console.log('Confidence:', result.confidence);
    console.log('Reasoning:', result.reasoning);
    
    // Validate signals
    const validation = validateSignals('emotion', result.signals);
    console.log(`Schema Validation: ${validation.valid ? '✅ VALID' : '❌ INVALID'}`);
    if (!validation.valid) {
      console.log('Errors:', validation.errors);
    }
  }
  
  console.log('\n');
  console.log('=' .repeat(70));
  console.log('Test 2: LLM-Based Analysis (All Test Cases)');
  console.log('=' .repeat(70));
  
  for (const test of testCases) {
    console.log(`\n${'─'.repeat(70)}`);
    console.log(`Test: ${test.name}`);
    console.log(`Message: "${test.message}"`);
    console.log(`Expected: sentiment=${test.expected.sentiment}, mood=${test.expected.mood}, urgency=${test.expected.urgency}, risk=${test.expected.risk}`);
    
    try {
      const result = await knight.analyze(test.message, {});
      
      console.log('\nAnalysis Result:');
      console.log(JSON.stringify(result.signals, null, 2));
      console.log('Confidence:', result.confidence);
      console.log('Reasoning:', result.reasoning);
      
      // Validate signals
      const validation = validateSignals('emotion', result.signals);
      console.log(`\nSchema Validation: ${validation.valid ? '✅ VALID' : '❌ INVALID'}`);
      if (!validation.valid) {
        console.log('Errors:', validation.errors);
      }
      
      // Check expectations
      const checks = {
        sentiment: checkSentiment(result.signals.sentiment, test.expected.sentiment),
        mood: checkMood(result.signals.mood, test.expected.mood),
        urgency: checkUrgency(result.signals.urgency, test.expected.urgency),
        risk: checkRisk(result.signals.risk, test.expected.risk),
        energy_level: checkEnergyLevel(result.signals.energy_level, test.expected.energy_level)
      };
      
      console.log('\nExpectation Checks:');
      for (const [key, pass] of Object.entries(checks)) {
        console.log(`  ${key}: ${pass ? '✅' : '⚠️'}`);
      }
      
      const allPassed = Object.values(checks).every(v => v);
      console.log(`\nOverall: ${allPassed ? '✅ PASSED' : '⚠️ REVIEW'}`);
      
    } catch (error) {
      console.error(`❌ Error: ${error.message}`);
    }
    
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log('\n');
  console.log('=' .repeat(70));
  console.log('Test 3: Error Handling');
  console.log('=' .repeat(70));
  
  // Test with disabled knight
  knight.setEnabled(false);
  const disabledResult = await knight.analyze('Test message', {});
  console.log('\nDisabled Knight Result:');
  console.log('Confidence:', disabledResult.confidence);
  console.log('Reasoning:', disabledResult.reasoning);
  console.log(`✅ Gracefully handled disabled state (confidence=${disabledResult.confidence})`);
  
  knight.setEnabled(true);
  
  console.log('\n');
  console.log('=' .repeat(70));
  console.log('✅ All Emotion Knight Tests Complete!');
  console.log('=' .repeat(70));
}

// Helper functions to check expectations
function checkSentiment(actual, expected) {
  if (expected === 'positive') return actual > 0.2;
  if (expected === 'negative') return actual < -0.2;
  if (expected === 'neutral') return actual >= -0.2 && actual <= 0.2;
  return false;
}

function checkMood(actual, expected) {
  if (Array.isArray(expected)) {
    return expected.includes(actual);
  }
  return actual === expected;
}

function checkUrgency(actual, expected) {
  if (expected === 'low') return actual < 0.5;
  if (expected === 'medium') return actual >= 0.4 && actual <= 0.7;
  if (expected === 'high') return actual > 0.6;
  return false;
}

function checkRisk(actual, expected) {
  if (expected === 'low') return actual < 0.5;
  if (expected === 'medium') return actual >= 0.4 && actual <= 0.7;
  if (expected === 'high') return actual > 0.6;
  return false;
}

function checkEnergyLevel(actual, expected) {
  if (Array.isArray(expected)) {
    return expected.includes(actual);
  }
  return actual === expected;
}

// Run tests
runTests().catch(console.error);
