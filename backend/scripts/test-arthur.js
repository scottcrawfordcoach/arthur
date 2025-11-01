// Copyright (c) 2025 Scott Crawford. All rights reserved.

/**
 * Test Suite for Arthur Orchestrator
 * 
 * Tests the complete ARTHUR system integration:
 * - Evidence Council → Librarian → Herald → Advisory Council → GPT-5
 */

import Arthur from '../services/Arthur.js';
import { query, execute, initDatabase } from '../services/db.js';
import logger from '../utils/logger.js';

// Initialize database first
await initDatabase();

const arthur = new Arthur();

// Disable verbose logging during tests
logger.transports.forEach(t => t.silent = true);

console.log('🏰 ARTHUR ORCHESTRATOR TEST SUITE\n');
console.log('=' .repeat(60));

/**
 * Test 1: Simple informational query (Teacher mode)
 */
async function testTeacherMode() {
  console.log('\n📚 Test 1: Teacher Mode (Informational Query)');
  console.log('-'.repeat(60));
  
  try {
    const result = await arthur.processMessage(
      "Can you explain how photosynthesis works?",
      { userId: 'test-user', stream: false }
    );
    
    console.log('✅ Response generated');
    console.log(`   Session: ${result.sessionId}`);
    console.log(`   Processing time: ${result.metadata.processingTime}ms`);
    console.log(`   Model: ${result.metadata.model}`);
    console.log(`   Confidence: ${(result.metadata.councilConfidence || 0).toFixed(2)}`);
    console.log('\n   Advisory Weights:');
    console.log(`   - Teacher: ${(result.advisoryWeights.teacher * 100).toFixed(0)}%`);
    console.log(`   - Coach: ${(result.advisoryWeights.coach * 100).toFixed(0)}%`);
    console.log(`   - Problem Solver: ${(result.advisoryWeights.problemSolver * 100).toFixed(0)}%`);
    
    // Verify Teacher is dominant
    if (result.advisoryWeights.teacher > 0.4) {
      console.log('   ✓ Teacher mode correctly activated');
    } else {
      console.log('   ⚠ Warning: Teacher weight lower than expected');
    }
    
    console.log(`\n   Herald invoked: ${result.heraldInvoked ? 'Yes' : 'No'}`);
    
    // Show first 200 chars of response
    console.log(`\n   Response preview: "${result.content.substring(0, 200)}..."`);
    
    return result.sessionId;
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    throw error;
  }
}

/**
 * Test 2: Emotional support query (Coach mode)
 */
async function testCoachMode() {
  console.log('\n💪 Test 2: Coach Mode (Emotional Support)');
  console.log('-'.repeat(60));
  
  try {
    const result = await arthur.processMessage(
      "I'm feeling really overwhelmed with everything on my plate right now",
      { userId: 'test-user', stream: false }
    );
    
    console.log('✅ Response generated');
    console.log(`   Session: ${result.sessionId}`);
    console.log(`   Processing time: ${result.metadata.processingTime}ms`);
    console.log('\n   Advisory Weights:');
    console.log(`   - Teacher: ${(result.advisoryWeights.teacher * 100).toFixed(0)}%`);
    console.log(`   - Coach: ${(result.advisoryWeights.coach * 100).toFixed(0)}%`);
    console.log(`   - Problem Solver: ${(result.advisoryWeights.problemSolver * 100).toFixed(0)}%`);
    
    // Verify Coach is dominant
    if (result.advisoryWeights.coach > 0.4) {
      console.log('   ✓ Coach mode correctly activated');
    } else {
      console.log('   ⚠ Warning: Coach weight lower than expected');
    }
    
    console.log(`\n   Herald invoked: ${result.heraldInvoked ? 'Yes' : 'No'}`);
    console.log(`\n   Response preview: "${result.content.substring(0, 200)}..."`);
    
    return result.sessionId;
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    throw error;
  }
}

/**
 * Test 3: Problem-solving query (Problem Solver mode)
 */
async function testProblemSolverMode() {
  console.log('\n🔧 Test 3: Problem Solver Mode');
  console.log('-'.repeat(60));
  
  try {
    const result = await arthur.processMessage(
      "I need to decide between two job offers. Can you help me think through the pros and cons?",
      { userId: 'test-user', stream: false }
    );
    
    console.log('✅ Response generated');
    console.log(`   Session: ${result.sessionId}`);
    console.log(`   Processing time: ${result.metadata.processingTime}ms`);
    console.log('\n   Advisory Weights:');
    console.log(`   - Teacher: ${(result.advisoryWeights.teacher * 100).toFixed(0)}%`);
    console.log(`   - Coach: ${(result.advisoryWeights.coach * 100).toFixed(0)}%`);
    console.log(`   - Problem Solver: ${(result.advisoryWeights.problemSolver * 100).toFixed(0)}%`);
    
    // Verify Problem Solver is dominant
    if (result.advisoryWeights.problemSolver > 0.35) {
      console.log('   ✓ Problem Solver mode correctly activated');
    } else {
      console.log('   ⚠ Warning: Problem Solver weight lower than expected');
    }
    
    console.log(`\n   Herald invoked: ${result.heraldInvoked ? 'Yes' : 'No'}`);
    console.log(`\n   Response preview: "${result.content.substring(0, 200)}..."`);
    
    return result.sessionId;
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    throw error;
  }
}

/**
 * Test 4: Multi-turn conversation (context awareness)
 */
async function testMultiTurnConversation(sessionId) {
  console.log('\n💬 Test 4: Multi-Turn Conversation');
  console.log('-'.repeat(60));
  
  try {
    // First message
    const result1 = await arthur.processMessage(
      "I'm training for a marathon",
      { sessionId, userId: 'test-user', stream: false }
    );
    
    console.log('✅ First message processed');
    console.log(`   Response length: ${result1.content.length} chars`);
    
    // Follow-up message
    const result2 = await arthur.processMessage(
      "What should I do about knee pain?",
      { sessionId, userId: 'test-user', stream: false }
    );
    
    console.log('✅ Follow-up processed');
    console.log(`   Response length: ${result2.content.length} chars`);
    console.log(`   Processing time: ${result2.metadata.processingTime}ms`);
    
    // Check if context was maintained
    const history = await arthur.getSessionHistory(sessionId);
    console.log(`   ✓ Session has ${history.length} messages`);
    
    if (history.length >= 4) { // 2 user + 2 assistant
      console.log('   ✓ Context maintained across turns');
    }
    
    console.log(`\n   Response preview: "${result2.content.substring(0, 200)}..."`);
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    throw error;
  }
}

/**
 * Test 5: Herald invocation (web search needed)
 */
async function testHeraldInvocation() {
  console.log('\n🔍 Test 5: Herald Invocation (Web Search)');
  console.log('-'.repeat(60));
  
  try {
    const result = await arthur.processMessage(
      "What are the latest features in React 19?",
      { userId: 'test-user', stream: false }
    );
    
    console.log('✅ Response generated');
    console.log(`   Session: ${result.sessionId}`);
    console.log(`   Processing time: ${result.metadata.processingTime}ms`);
    console.log(`   Herald invoked: ${result.heraldInvoked ? 'Yes ✓' : 'No'}`);
    
    if (result.heraldInvoked) {
      console.log('   ✓ Herald correctly invoked for current information');
    } else {
      console.log('   ℹ Herald not invoked (may have internal knowledge or policy blocked)');
    }
    
    console.log('\n   Advisory Weights:');
    console.log(`   - Teacher: ${(result.advisoryWeights.teacher * 100).toFixed(0)}%`);
    console.log(`   - Coach: ${(result.advisoryWeights.coach * 100).toFixed(0)}%`);
    console.log(`   - Problem Solver: ${(result.advisoryWeights.problemSolver * 100).toFixed(0)}%`);
    
    console.log(`\n   Response preview: "${result.content.substring(0, 200)}..."`);
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    throw error;
  }
}

/**
 * Test 6: Streaming response
 */
async function testStreaming() {
  console.log('\n📡 Test 6: Streaming Response');
  console.log('-'.repeat(60));
  
  try {
    const result = await arthur.processMessage(
      "Tell me a short story about a robot learning to paint",
      { userId: 'test-user', stream: true }
    );
    
    console.log('✅ Stream started');
    console.log(`   Stream ID: ${result.streamId}`);
    console.log(`   Session: ${result.sessionId}`);
    
    let chunkCount = 0;
    let fullContent = '';
    
    // Consume the stream
    for await (const chunk of result.stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        fullContent += content;
        chunkCount++;
      }
    }
    
    console.log(`   ✓ Received ${chunkCount} chunks`);
    console.log(`   ✓ Total content length: ${fullContent.length} chars`);
    console.log(`\n   Response preview: "${fullContent.substring(0, 200)}..."`);
    
    // Save the complete message
    await arthur.saveMessage(result.sessionId, 'assistant', fullContent);
    console.log('   ✓ Message saved to database');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    throw error;
  }
}

/**
 * Test 7: Crisis detection
 */
async function testCrisisDetection() {
  console.log('\n🚨 Test 7: Crisis Detection');
  console.log('-'.repeat(60));
  
  try {
    const result = await arthur.processMessage(
      "I can't take this anymore, everything is falling apart and I don't know what to do",
      { userId: 'test-user', stream: false }
    );
    
    console.log('✅ Response generated');
    console.log(`   Session: ${result.sessionId}`);
    console.log(`   Processing time: ${result.metadata.processingTime}ms`);
    console.log('\n   Advisory Weights:');
    console.log(`   - Teacher: ${(result.advisoryWeights.teacher * 100).toFixed(0)}%`);
    console.log(`   - Coach: ${(result.advisoryWeights.coach * 100).toFixed(0)}%`);
    console.log(`   - Problem Solver: ${(result.advisoryWeights.problemSolver * 100).toFixed(0)}%`);
    
    // Verify Coach is heavily weighted in crisis
    if (result.advisoryWeights.coach > 0.6) {
      console.log('   ✓ CRISIS MODE: Coach heavily weighted');
    } else {
      console.log('   ⚠ Warning: Coach should be heavily weighted in crisis');
    }
    
    console.log(`\n   Response preview: "${result.content.substring(0, 200)}..."`);
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    throw error;
  }
}

/**
 * Test 8: System metrics
 */
async function testMetrics() {
  console.log('\n📊 Test 8: System Metrics');
  console.log('-'.repeat(60));
  
  try {
    const metrics = arthur.getMetrics();
    
    console.log('✅ Metrics retrieved');
    console.log('\n   Evidence Council:');
    console.log(`   - Total convocations: ${metrics.councilMetrics.totalConvocations || 0}`);
    console.log(`   - Success rate: ${((metrics.councilMetrics.successRate || 0) * 100).toFixed(1)}%`);
    console.log(`   - Avg execution time: ${(metrics.councilMetrics.avgExecutionTime || 0).toFixed(0)}ms`);
    
    console.log('\n   Librarian:');
    console.log(`   - Total searches: ${metrics.librarianMetrics.totalSearches || 0}`);
    console.log(`   - Avg results: ${(metrics.librarianMetrics.avgResultsPerSearch || 0).toFixed(1)}`);
    
    console.log('\n   Herald:');
    console.log(`   - Total searches: ${metrics.heraldMetrics.totalSearches || 0}`);
    console.log(`   - Success rate: ${((metrics.heraldMetrics.successRate || 0) * 100).toFixed(1)}%`);
    console.log(`   - Blocked searches: ${metrics.heraldMetrics.blockedQueries || 0}`);
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    throw error;
  }
}

/**
 * Run all tests
 */
async function runAllTests() {
  console.log('\n🏰 Starting Arthur Orchestrator Tests...\n');
  
  let passedTests = 0;
  let failedTests = 0;
  let sessionId = null;
  
  const tests = [
    { name: 'Teacher Mode', fn: testTeacherMode },
    { name: 'Coach Mode', fn: testCoachMode },
    { name: 'Problem Solver Mode', fn: testProblemSolverMode },
    { name: 'Herald Invocation', fn: testHeraldInvocation },
    { name: 'Streaming', fn: testStreaming },
    { name: 'Crisis Detection', fn: testCrisisDetection },
    { name: 'System Metrics', fn: testMetrics }
  ];
  
  for (const test of tests) {
    try {
      const result = await test.fn(sessionId);
      if (result && !sessionId) {
        sessionId = result; // Use first session for multi-turn test
      }
      passedTests++;
    } catch (error) {
      failedTests++;
      console.error(`\n❌ ${test.name} failed:`, error.message);
    }
  }
  
  // Run multi-turn test if we have a session
  if (sessionId) {
    try {
      await testMultiTurnConversation(sessionId);
      passedTests++;
    } catch (error) {
      failedTests++;
      console.error('\n❌ Multi-Turn Conversation failed:', error.message);
    }
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('🏰 ARTHUR TEST SUITE COMPLETE\n');
  console.log(`✅ Passed: ${passedTests}`);
  console.log(`❌ Failed: ${failedTests}`);
  console.log(`📊 Total: ${passedTests + failedTests}`);
  console.log('='.repeat(60) + '\n');
  
  if (failedTests === 0) {
    console.log('🎉 ALL TESTS PASSED!\n');
    process.exit(0);
  } else {
    console.log('⚠️  SOME TESTS FAILED\n');
    process.exit(1);
  }
}

// Run tests
runAllTests().catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});
