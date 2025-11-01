// Copyright (c) 2025 Scott Crawford. All rights reserved.

/**
 * Test Tier-Based Semantic Search
 * 
 * Tests the intent analyzer and tier-based context retrieval
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../../.env') });

import { analyzeIntent, quickIntentCheck } from '../services/intentAnalyzer.js';
import { recallContext } from '../services/recallEngine.js';
import { initDatabase } from '../services/db.js';
import logger from '../utils/logger.js';

const testQueries = [
  {
    query: "I just ran 5k this morning",
    expectedIntent: "wellness",
    expectedTiers: ["personal_journal", "core_knowledge"]
  },
  {
    query: "What does the book say about coaching presence?",
    expectedIntent: "research",
    expectedTiers: ["reference_library", "core_knowledge"]
  },
  {
    query: "What did we discuss about my running goals last week?",
    expectedIntent: "personal",
    expectedTiers: ["archive", "personal_journal"]
  },
  {
    query: "I'm feeling stuck and need some perspective",
    expectedIntent: "coaching",
    expectedTiers: ["core_knowledge", "personal_journal"]
  },
  {
    query: "What's the difference between ACC and PCC coaching?",
    expectedIntent: "research",
    expectedTiers: ["core_knowledge", "reference_library"]
  }
];

async function runTests() {
  console.log('\n🧪 Testing Tier-Based Semantic Search\n');
  console.log('='.repeat(60));
  
  // Initialize database connection
  try {
    await initDatabase();
    console.log('✅ Database initialized\n');
  } catch (error) {
    console.error('❌ Failed to initialize database:', error.message);
    process.exit(1);
  }
  
  for (const test of testQueries) {
    console.log(`\n📝 Query: "${test.query}"`);
    console.log('-'.repeat(60));
    
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
      console.log(`   Time Weight: ${analysis.time_weight_journal}`);
      console.log(`   Confidence: ${analysis.confidence}`);
      console.log(`   Reasoning: ${analysis.reasoning}`);
      
      // Check if matches expected
      const intentMatches = analysis.primary_intent === test.expectedIntent;
      const tiersMatch = JSON.stringify(analysis.tier_priorities) === JSON.stringify(test.expectedTiers);
      
      if (intentMatches && tiersMatch) {
        console.log('   ✅ PASS - Intent and tiers match expected');
      } else {
        console.log('   ⚠️  PARTIAL - Some differences:');
        if (!intentMatches) {
          console.log(`      Expected intent: ${test.expectedIntent}, got: ${analysis.primary_intent}`);
        }
        if (!tiersMatch) {
          console.log(`      Expected tiers: ${test.expectedTiers.join(', ')}`);
        }
      }
      
      // Test 3: Tier-Based Recall
      console.log(`\n🔍 Testing Recall with Tier Priorities...`);
      const context = await recallContext(test.query, {
        tierPriorities: analysis.tier_priorities,
        timeWeight: analysis.time_weight_journal,
        maxResults: 5,
        threshold: 0.6
      });
      
      console.log(`   Found: ${context.files.length} files, ${context.messages.length} messages`);
      if (context.tierStats && Object.keys(context.tierStats).length > 0) {
        const tierStatsStr = Object.entries(context.tierStats)
          .map(([tier, count]) => `${tier}: ${count}`)
          .join(', ');
        console.log(`   Tier Distribution: ${tierStatsStr}`);
      }
      
      // Show top result if any
      if (context.files.length > 0) {
        const topFile = context.files[0];
        console.log(`   Top Result: ${topFile.original_name || 'Unknown'} (${topFile.knowledge_tier}, score: ${topFile.final_score?.toFixed(3) || topFile.similarity.toFixed(3)})`);
        console.log(`   Preview: ${topFile.content.substring(0, 100)}...`);
      }
      
    } catch (error) {
      console.log(`   ❌ ERROR: ${error.message}`);
      logger.error('Test error:', error);
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('✨ Tests Complete\n');
}

// Run tests
runTests().catch(err => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
