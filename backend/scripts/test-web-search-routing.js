// Copyright (c) 2025 Scott Crawford. All rights reserved.

/**
 * Test Web Search Integration with Tier System
 * 
 * Demonstrates how web search decisions are made based on intent analysis
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../../.env') });

import { analyzeIntent, quickIntentCheck } from '../services/intentAnalyzer.js';
import logger from '../utils/logger.js';

const testQueries = [
  {
    query: "I just ran 5k this morning",
    expectedWebSearch: "none",
    reason: "Personal wellness data - no web needed"
  },
  {
    query: "What does the ICF say about coaching presence?",
    expectedWebSearch: "fallback",
    reason: "Check internal knowledge first, web if not found"
  },
  {
    query: "What's the latest news on ChatGPT-5 release?",
    expectedWebSearch: "primary",
    reason: "Current/latest information required"
  },
  {
    query: "What did we discuss last week about my goals?",
    expectedWebSearch: "none",
    reason: "Conversation history - internal only"
  },
  {
    query: "I'm feeling stuck with my training",
    expectedWebSearch: "none",
    reason: "Coaching request - timeless principles"
  },
  {
    query: "What's the current weather in San Francisco?",
    expectedWebSearch: "primary",
    reason: "Real-time information required"
  },
  {
    query: "According to the book, what is grit?",
    expectedWebSearch: "fallback",
    reason: "Check reference library first"
  },
  {
    query: "What are today's AI headlines?",
    expectedWebSearch: "primary",
    reason: "Time-sensitive current events"
  }
];

async function runTests() {
  console.log('\n🌐 Testing Web Search Integration with Tier System\n');
  console.log('='.repeat(80));
  console.log('\nThis demonstrates how web search decisions are made based on query intent.\n');
  
  for (const test of testQueries) {
    console.log(`📝 Query: "${test.query}"`);
    console.log('-'.repeat(80));
    
    // Test 1: Quick Intent Check
    const quickResult = quickIntentCheck(test.query);
    console.log(`⚡ Quick Check: ${quickResult.intent} (${quickResult.confidence} confidence)`);
    
    // Test 2: Full Intent Analysis
    try {
      const analysis = await analyzeIntent(test.query, {
        recentMessages: [],
        hasWellnessActivity: false
      });
      
      console.log(`🧠 Full Analysis:`);
      console.log(`   Primary Intent: ${analysis.primary_intent}`);
      console.log(`   Tier Priorities: ${analysis.tier_priorities.join(' > ')}`);
      console.log(`   Web Search Priority: ${analysis.web_search_priority}`);
      console.log(`   Web Search Reasoning: ${analysis.web_search_reasoning}`);
      
      // Visual indicator
      const webSearchSymbol = {
        'primary': '🌐 PRIMARY - Web search happens FIRST',
        'fallback': '🔄 FALLBACK - Try internal KB, then web if needed',
        'none': '⊘ NONE - No web search needed'
      }[analysis.web_search_priority] || '❓ Unknown';
      
      console.log(`   ${webSearchSymbol}`);
      
      // Check if matches expected
      const webSearchMatches = analysis.web_search_priority === test.expectedWebSearch;
      
      if (webSearchMatches) {
        console.log(`   ✅ CORRECT - ${test.reason}`);
      } else {
        console.log(`   ⚠️  MISMATCH`);
        console.log(`      Expected: ${test.expectedWebSearch} (${test.reason})`);
        console.log(`      Got: ${analysis.web_search_priority}`);
      }
      
    } catch (error) {
      console.log(`   ❌ ERROR: ${error.message}`);
      logger.error('Test error:', error);
    }
    
    console.log('');
  }
  
  console.log('='.repeat(80));
  console.log('\n📊 Summary:\n');
  console.log('Web Search Priorities:');
  console.log('  • PRIMARY   = Search web BEFORE checking internal knowledge');
  console.log('  • FALLBACK  = Check internal knowledge first, use web if not found');
  console.log('  • NONE      = Only use internal knowledge, never search web');
  console.log('');
  console.log('Benefits:');
  console.log('  ✓ Saves API calls - only searches when needed');
  console.log('  ✓ Faster responses - internal KB is instant');
  console.log('  ✓ Privacy - personal data never sent to search engines');
  console.log('  ✓ Relevant - current info when needed, cached when not');
  console.log('\n✨ Tests Complete\n');
}

// Run tests
runTests().catch(err => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
