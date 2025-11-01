// Copyright (c) 2025 Scott Crawford. All rights reserved.

/**
 * TEST HERALD SERVICE
 * 
 * Comprehensive test suite for the Herald external search service.
 * Tests query sanitization, policy enforcement, result filtering, and Tavily integration.
 * 
 * Test Scenarios:
 * 1. Query Sanitization - Remove PII before search
 * 2. Policy Check - Daily limits and blocked keywords
 * 3. Tavily Search - External web search (if API key available)
 * 4. Result Filtering - Domain blocklist
 * 5. Trust Score Calculation - Domain reputation
 * 6. Provenance Tagging - Track result sources
 * 7. Search Logging - Audit trail
 * 8. Metrics Tracking - Performance monitoring
 */

import dotenv from 'dotenv';
import Herald from '../services/Herald.js';

dotenv.config();

// Test utilities
function logTestResult(testName, passed, details = '') {
  const icon = passed ? '✅' : '❌';
  console.log(`${icon} ${testName}`);
  if (details) console.log(`   ${details}`);
}

async function runTests() {
  console.log('\n🔍 HERALD SERVICE - TEST SUITE\n');
  
  let passedTests = 0;
  let totalTests = 0;
  
  const herald = new Herald();
  
  // TEST 1: Query Sanitization
  totalTests++;
  console.log('\n--- Test 1: Query Sanitization (Remove PII) ---');
  try {
    const sensitiveQuery = "John Smith from 123 Main St wants to know about anxiety treatment";
    const sanitized = await herald.sanitizeQuery(sensitiveQuery);
    
    // Check that personal info is removed
    const hasPII = 
      sanitized.toLowerCase().includes('john') ||
      sanitized.toLowerCase().includes('smith') ||
      sanitized.includes('123');
    
    const passed = !hasPII && sanitized.length > 0;
    
    if (passed) passedTests++;
    logTestResult(
      'Test 1: Query Sanitization',
      passed,
      `Original: "${sensitiveQuery.substring(0, 50)}..."\nSanitized: "${sanitized}"`
    );
    
  } catch (error) {
    logTestResult('Test 1: Query Sanitization', false, error.message);
  }
  
  // TEST 2: Policy Check - Daily Limit
  totalTests++;
  console.log('\n--- Test 2: Policy Enforcement - Daily Limit ---');
  try {
    // Set low limit for testing
    herald.policy.dailySearchLimit = 5;
    herald.policy.dailySearchCount = 5; // Already at limit
    
    const policyCheck = herald.checkPolicy({ query: 'test query' });
    
    const passed = !policyCheck.allowed && policyCheck.reason.includes('Daily search limit');
    
    // Reset for other tests
    herald.policy.dailySearchLimit = 100;
    herald.policy.dailySearchCount = 0;
    
    if (passed) passedTests++;
    logTestResult(
      'Test 2: Daily Limit Check',
      passed,
      `Policy check: ${policyCheck.reason}`
    );
    
  } catch (error) {
    logTestResult('Test 2: Daily Limit Check', false, error.message);
  }
  
  // TEST 3: Policy Check - Blocked Keywords
  totalTests++;
  console.log('\n--- Test 3: Policy Enforcement - Blocked Keywords ---');
  try {
    const blockedQuery = { query: 'how to do something illegal' };
    const policyCheck = herald.checkPolicy(blockedQuery);
    
    const passed = !policyCheck.allowed && policyCheck.reason.includes('Blocked keyword');
    
    if (passed) passedTests++;
    logTestResult(
      'Test 3: Blocked Keywords',
      passed,
      `Blocked: ${policyCheck.reason}`
    );
    
  } catch (error) {
    logTestResult('Test 3: Blocked Keywords', false, error.message);
  }
  
  // TEST 4: Result Filtering - Domain Blocklist
  totalTests++;
  console.log('\n--- Test 4: Result Filtering (Domain Blocklist) ---');
  try {
    const mockResults = {
      results: [
        { url: 'https://good-site.com/article', title: 'Good Article', content: 'Content' },
        { url: 'https://spam-site.com/bad', title: 'Spam', content: 'Bad content' },
        { url: 'https://trusted.edu/research', title: 'Research', content: 'Academic content' }
      ]
    };
    
    const filtered = herald.filterResults(mockResults);
    
    const hasSpam = filtered.some(r => r.url.includes('spam-site.com'));
    const hasGood = filtered.some(r => r.url.includes('good-site.com'));
    
    const passed = !hasSpam && hasGood && filtered.length === 2;
    
    if (passed) passedTests++;
    logTestResult(
      'Test 4: Domain Filtering',
      passed,
      `Filtered ${mockResults.results.length} → ${filtered.length} results (blocked spam-site.com)`
    );
    
  } catch (error) {
    logTestResult('Test 4: Domain Filtering', false, error.message);
  }
  
  // TEST 5: Trust Score Calculation
  totalTests++;
  console.log('\n--- Test 5: Trust Score Calculation ---');
  try {
    const trustedResult = { url: 'https://wikipedia.org/wiki/React', score: 0.9 };
    const untrustedResult = { url: 'https://random-blog.com/post', score: 0.3 };
    
    const trustedScore = herald.calculateTrustScore(trustedResult);
    const untrustedScore = herald.calculateTrustScore(untrustedResult);
    
    const passed = 
      trustedScore > untrustedScore &&
      trustedScore > 0.7 &&
      untrustedScore < 0.6;
    
    if (passed) passedTests++;
    logTestResult(
      'Test 5: Trust Scoring',
      passed,
      `Wikipedia: ${trustedScore.toFixed(2)}, Random blog: ${untrustedScore.toFixed(2)}`
    );
    
  } catch (error) {
    logTestResult('Test 5: Trust Scoring', false, error.message);
  }
  
  // TEST 6: Provenance Tagging
  totalTests++;
  console.log('\n--- Test 6: Provenance Tagging ---');
  try {
    const mockSummarized = {
      results: [
        { title: 'Article', snippet: 'Content', url: 'https://example.com', score: 0.8 }
      ],
      summary: 'Test summary'
    };
    
    const mockRequest = { query: 'test query', intent: 'learning' };
    const tagged = herald.tagProvenance(mockSummarized, mockRequest);
    
    const passed = 
      tagged.results[0].provenance &&
      tagged.results[0].provenance.source === 'web_search' &&
      tagged.results[0].provenance.engine === 'tavily' &&
      tagged.results[0].provenance.queryIntent === 'learning' &&
      typeof tagged.results[0].provenance.trustScore === 'number';
    
    if (passed) passedTests++;
    logTestResult(
      'Test 6: Provenance Tagging',
      passed,
      `Source: ${tagged.results[0].provenance.source}, Trust: ${tagged.results[0].provenance.trustScore.toFixed(2)}`
    );
    
  } catch (error) {
    logTestResult('Test 6: Provenance Tagging', false, error.message);
  }
  
  // TEST 7: Search Logging
  totalTests++;
  console.log('\n--- Test 7: Search Logging (Audit Trail) ---');
  try {
    const mockRequest = { query: 'test query', intent: 'research' };
    const mockResults = {
      results: [{ title: 'Result', url: 'https://example.com' }],
      summary: 'Summary'
    };
    
    herald.logSearch(mockRequest, 'sanitized test query', mockResults);
    
    const history = herald.getSearchHistory(1);
    
    const passed = 
      history.length > 0 &&
      history[0].originalQuery === 'test query' &&
      history[0].sanitizedQuery === 'sanitized test query' &&
      history[0].intent === 'research';
    
    if (passed) passedTests++;
    logTestResult(
      'Test 7: Search Logging',
      passed,
      `Logged search: "${history[0].originalQuery}" → "${history[0].sanitizedQuery}"`
    );
    
  } catch (error) {
    logTestResult('Test 7: Search Logging', false, error.message);
  }
  
  // TEST 8: Metrics Tracking
  totalTests++;
  console.log('\n--- Test 8: Metrics Tracking ---');
  try {
    const metrics = herald.getMetrics();
    
    const passed = 
      typeof metrics.totalSearches === 'number' &&
      typeof metrics.successRate === 'number' &&
      typeof metrics.avgSearchTime === 'number' &&
      typeof metrics.sanitizedQueries === 'number' &&
      typeof metrics.blockedQueries === 'number' &&
      typeof metrics.dailySearchCount === 'number' &&
      typeof metrics.searchesRemaining === 'number';
    
    if (passed) passedTests++;
    logTestResult(
      'Test 8: Metrics Tracking',
      passed,
      `Searches: ${metrics.totalSearches}, Sanitized: ${metrics.sanitizedQueries}, Blocked: ${metrics.blockedQueries}`
    );
    
  } catch (error) {
    logTestResult('Test 8: Metrics Tracking', false, error.message);
  }
  
  // TEST 9: Policy Update
  totalTests++;
  console.log('\n--- Test 9: Policy Update ---');
  try {
    const originalLimit = herald.policy.dailySearchLimit;
    
    herald.updatePolicy({ dailySearchLimit: 200 });
    
    const passed = herald.policy.dailySearchLimit === 200;
    
    // Restore original
    herald.updatePolicy({ dailySearchLimit: originalLimit });
    
    if (passed) passedTests++;
    logTestResult(
      'Test 9: Policy Update',
      passed,
      `Updated daily limit from ${originalLimit} to 200`
    );
    
  } catch (error) {
    logTestResult('Test 9: Policy Update', false, error.message);
  }
  
  // TEST 10: Full Search Flow (Mock - no actual API call unless key exists)
  totalTests++;
  console.log('\n--- Test 10: Full Search Flow ---');
  try {
    // Only test if Tavily API key is configured
    if (process.env.TAVILY_API_KEY) {
      console.log('   🌐 Tavily API key found, testing real search...');
      
      const searchRequest = {
        query: 'What are React hooks?',
        intent: 'learning',
        maxResults: 3
      };
      
      const result = await herald.search(searchRequest);
      
      const passed = 
        result.success === true &&
        result.sanitizedQuery &&
        Array.isArray(result.results) &&
        result.metadata &&
        result.metadata.policyCompliant === true;
      
      if (passed) passedTests++;
      logTestResult(
        'Test 10: Full Search Flow',
        passed,
        `Found ${result.results.length} results, sanitized: "${result.sanitizedQuery}"`
      );
      
    } else {
      console.log('   ⏭️  Tavily API key not found, testing blocked response...');
      
      // Test that blocked searches return proper structure
      herald.policy.dailySearchLimit = 0; // Force block
      const result = await herald.search({ query: 'test' });
      
      const passed = 
        result.success === false &&
        result.blocked === true &&
        result.reason &&
        result.metadata.policyCompliant === false;
      
      herald.policy.dailySearchLimit = 100; // Reset
      
      if (passed) passedTests++;
      logTestResult(
        'Test 10: Blocked Response',
        passed,
        `Blocked response structure valid: ${result.reason}`
      );
    }
    
  } catch (error) {
    logTestResult('Test 10: Full Search Flow', false, error.message);
  }
  
  // SUMMARY
  console.log('\n' + '='.repeat(60));
  console.log(`SUMMARY: ${passedTests}/${totalTests} tests passed`);
  console.log('='.repeat(60) + '\n');
  
  if (passedTests === totalTests) {
    console.log('🎉 All Herald tests passed!\n');
    console.log('✅ Query sanitization (PII removal)');
    console.log('✅ Policy enforcement (limits, blocked keywords)');
    console.log('✅ Result filtering (domain blocklist)');
    console.log('✅ Trust score calculation');
    console.log('✅ Provenance tagging');
    console.log('✅ Search logging (audit trail)');
    console.log('✅ Metrics tracking');
    console.log('✅ Policy updates');
    
    if (process.env.TAVILY_API_KEY) {
      console.log('✅ Full search flow with Tavily API');
    } else {
      console.log('⚠️  Tavily API not tested (no API key)');
      console.log('   Set TAVILY_API_KEY in .env to test real searches');
    }
    
    console.log('\n🔍 Herald Service: READY FOR INTEGRATION!\n');
  } else {
    console.log(`⚠️  ${totalTests - passedTests} test(s) failed. Review output above.\n`);
  }
  
  return passedTests === totalTests;
}

// Run tests
runTests()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('💥 Test suite crashed:', error);
    process.exit(1);
  });
