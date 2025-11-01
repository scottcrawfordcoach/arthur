/**
 * Test coaching pattern detection
 */

import { detectActivityLog, generateCoachingResponse } from '../services/coachingPatterns.js';

console.log('🧪 Testing Coaching Pattern Detection\n');
console.log('='.repeat(60));

const testMessages = [
  {
    text: "Just finished a 5 mile run in 45 minutes",
    expected: true
  },
  {
    text: "I went for a bike ride this morning, about 20km",
    expected: true
  },
  {
    text: "Logged 10,000 steps today",
    expected: true
  },
  {
    text: "Did yoga for 30 minutes",
    expected: true
  },
  {
    text: "What's the weather like?",
    expected: false
  },
  {
    text: "I'm thinking about running tomorrow",
    expected: false // Just thinking, not logging
  }
];

testMessages.forEach((test, i) => {
  console.log(`\nTest ${i + 1}: "${test.text}"`);
  console.log('-'.repeat(60));
  
  const detection = detectActivityLog(test.text);
  
  console.log(`Detected: ${detection.detected ? '✅ YES' : '❌ NO'}`);
  
  if (detection.detected) {
    console.log(`Confidence: ${detection.confidence}`);
    console.log(`Activity Type: ${detection.activityType}`);
    console.log(`Has Metrics: ${detection.hasQuantitativeData ? 'Yes' : 'No'}`);
    
    if (detection.confidence === 'high') {
      console.log(`\nSuggested Prompts (${detection.suggestedPrompts.length}):`);
      detection.suggestedPrompts.forEach(p => {
        console.log(`  • [${p.type}] ${p.prompt}`);
      });
      
      const response = generateCoachingResponse(detection, test.text);
      console.log(`\n📣 Coaching Response:`);
      console.log(response);
    }
  }
  
  const passed = detection.detected === test.expected;
  console.log(`\nResult: ${passed ? '✅ PASS' : '❌ FAIL'}`);
});

console.log('\n' + '='.repeat(60));
console.log('🎉 Test complete!');
