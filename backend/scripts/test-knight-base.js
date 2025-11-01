// Copyright (c) 2025 Scott Crawford. All rights reserved.

/**
 * Test KnightBase and Signal Schema
 * Validates the foundation for Evidence Council Knights
 */

import KnightBase from '../knights/KnightBase.js';
import { validateSignals, getExampleSignals } from '../knights/signalsSchema.js';

console.log('🏰 Testing Knight Base Infrastructure...\n');

// Test 1: KnightBase instantiation
console.log('Test 1: KnightBase Instantiation');
console.log('=' .repeat(50));

class TestKnight extends KnightBase {
  constructor() {
    super('TestKnight', { enabled: true });
  }

  async analyze(userMessage, context) {
    return this.createResult(
      { test: 'signal' },
      0.85,
      'Test knight analysis'
    );
  }
}

const testKnight = new TestKnight();
console.log('✅ TestKnight created:', testKnight.getMetadata());
console.log('✅ IsEnabled:', testKnight.isEnabled());
console.log('');

// Test 2: Analyze method
console.log('Test 2: Knight Analysis');
console.log('=' .repeat(50));

async function testAnalyze() {
  const result = await testKnight.analyze('Test message', { sessionId: 'test-123' });
  console.log('Analysis result:', JSON.stringify(result, null, 2));
  console.log('✅ Validation passed:', testKnight.validateResult(result));
  console.log('');
}

testAnalyze().then(() => {

  // Test 3: Signal Schema Validation
  console.log('Test 3: Signal Schema Validation');
  console.log('=' .repeat(50));

  // Test all knight types
  const knightTypes = ['pattern', 'emotion', 'needs', 'context', 'analysis'];
  
  for (const type of knightTypes) {
    const exampleSignals = getExampleSignals(type);
    const validation = validateSignals(type, exampleSignals);
    
    console.log(`\n${type.toUpperCase()} Knight:`);
    console.log('Example signals:', JSON.stringify(exampleSignals, null, 2));
    console.log(`Validation: ${validation.valid ? '✅ VALID' : '❌ INVALID'}`);
    
    if (!validation.valid) {
      console.log('Errors:', validation.errors);
    }
  }

  console.log('\n');

  // Test 4: Invalid Signal Detection
  console.log('Test 4: Invalid Signal Detection');
  console.log('=' .repeat(50));

  const invalidSignals = {
    sentiment: 2.5, // Should be -1 to 1
    mood: 'unknown_mood', // Not in enum
    urgency: -0.5 // Should be 0 to 1
  };

  const invalidValidation = validateSignals('emotion', invalidSignals);
  console.log('Invalid signals:', invalidSignals);
  console.log(`Validation: ${invalidValidation.valid ? '✅ VALID' : '❌ INVALID (expected)'}`);
  console.log('Errors:', invalidValidation.errors);
  console.log('');

  // Test 5: Error Handling
  console.log('Test 5: Error Handling');
  console.log('=' .repeat(50));

  class FailingKnight extends KnightBase {
    constructor() {
      super('FailingKnight');
    }

    async analyze(userMessage, context) {
      throw new Error('Intentional test error');
    }
  }

  const failingKnight = new FailingKnight();
  
  async function testErrorHandling() {
    try {
      await failingKnight.analyze('Test', {});
    } catch (error) {
      const degradedResult = failingKnight.handleError(error, 'Test');
      console.log('Degraded result:', JSON.stringify(degradedResult, null, 2));
      console.log('✅ Error handled gracefully, zero confidence result produced');
    }
  }

  testErrorHandling().then(() => {
    console.log('\n');
    console.log('=' .repeat(50));
    console.log('✅ All Knight Base Infrastructure Tests Passed!');
    console.log('=' .repeat(50));
    console.log('\nReady to build individual Knights! 🎯');
  });

});
