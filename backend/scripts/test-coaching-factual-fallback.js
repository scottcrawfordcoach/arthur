/**
 * Test Coaching + Factual Queries (Web Search Fallback)
 * 
 * Demonstrates how coaching conversations can fall back to web search
 * when they contain factual/informational components
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../../.env') });

import { analyzeIntent } from '../services/intentAnalyzer.js';

const testQueries = [
  {
    category: "Pure Coaching (No Factual Need)",
    queries: [
      "I'm feeling stuck with my progress",
      "I don't know what to do next",
      "How should I approach this challenge?",
      "I'm struggling with motivation"
    ],
    expectedBehavior: "Coaching response only, no web search needed"
  },
  {
    category: "Coaching + Factual Component",
    queries: [
      "I'm stuck with my marathon training - what's the best way to increase endurance?",
      "I'm struggling to understand the science behind intermittent fasting",
      "How should I approach learning about neural networks? What's the best way to start?",
      "I'm feeling overwhelmed - what does the research say about managing stress?"
    ],
    expectedBehavior: "Coaching response + web search for factual information"
  },
  {
    category: "ScottBot Use Case (Personal + Trusted Sources)",
    queries: [
      "I'm not seeing progress in my running - what does the literature say about training plateaus?",
      "I feel like I'm burning out - what do experts recommend for recovery?",
      "My sleep quality is poor - what's the evidence-based approach to improving it?",
      "I'm having trouble sticking to my goals - what does the research say works?"
    ],
    expectedBehavior: "Coach-like response with trusted research (KB first, then web)"
  }
];

async function runTests() {
  console.log('\n🤝 Testing Coaching + Factual Query Fallback\n');
  console.log('='.repeat(80));
  console.log('\nThis shows how coaching conversations can access external knowledge when needed.\n');
  
  for (const category of testQueries) {
    console.log(`\n📁 Category: ${category.category}`);
    console.log(`   Expected: ${category.expectedBehavior}`);
    console.log('-'.repeat(80));
    
    for (const query of category.queries) {
      console.log(`\n   Query: "${query}"`);
      
      try {
        const analysis = await analyzeIntent(query, {
          recentMessages: [],
          hasWellnessActivity: false
        });
        
        // Check for factual component
        const hasFactualComponent = /\b(how to|what is|why does|when should|best way|research|science|evidence|study|what does|literature|experts|evidence-based)\b/i.test(query);
        
        console.log(`   Intent: ${analysis.primary_intent}`);
        console.log(`   Tiers: ${analysis.tier_priorities.join(' > ')}`);
        console.log(`   Web Search: ${analysis.web_search_priority}`);
        console.log(`   Factual Component: ${hasFactualComponent ? '✓ YES' : '✗ NO'}`);
        
        // Simulate fallback logic
        const emptyKB = true; // Assume KB has no results for this test
        let willSearch = false;
        let searchReason = '';
        
        if (analysis.web_search_priority === 'primary') {
          willSearch = true;
          searchReason = 'Primary priority';
        } else if (analysis.web_search_priority === 'fallback' && emptyKB) {
          willSearch = true;
          searchReason = 'Fallback - KB empty';
        } else if (analysis.web_search_priority === 'none' && emptyKB && hasFactualComponent) {
          willSearch = true;
          searchReason = 'Smart fallback - coaching + factual query';
        }
        
        if (willSearch) {
          console.log(`   🌐 WILL SEARCH WEB: ${searchReason}`);
        } else {
          console.log(`   ⊘ No web search (coaching only)`);
        }
        
      } catch (error) {
        console.log(`   ❌ ERROR: ${error.message}`);
      }
    }
    
    console.log('');
  }
  
  console.log('='.repeat(80));
  console.log('\n📊 Key Insights:\n');
  console.log('1. PURE COACHING:');
  console.log('   "I\'m feeling stuck" → Coaching mode, no factual need');
  console.log('   Response: Reflective questions, no external data\n');
  
  console.log('2. COACHING + FACTUAL:');
  console.log('   "I\'m stuck with marathon training - best way to increase endurance?"');
  console.log('   Response: Coaching questions + training research from web\n');
  
  console.log('3. SCOTTBOT USE CASE:');
  console.log('   "What does research say about training plateaus?"');
  console.log('   Response: Check trusted KB → If empty, search web → Coach-like delivery\n');
  
  console.log('Benefits:');
  console.log('  ✓ Coaching style maintained (warm, curious, supportive)');
  console.log('  ✓ Access to factual info when conversation needs it');
  console.log('  ✓ KB prioritized (your trusted sources first)');
  console.log('  ✓ Web as intelligent fallback (not blocked by "coaching" intent)');
  console.log('  ✓ Personable AND informative\n');
  
  console.log('For ScottBot:');
  console.log('  → Build extensive KB of trusted sources (research, books, experts)');
  console.log('  → Tag sources by domain (training, nutrition, sleep, recovery)');
  console.log('  → Web search finds NEW research your KB doesn\'t have yet');
  console.log('  → You review/approve before adding to KB (quality control)');
  console.log('  → Your voice/style in responses, backed by solid evidence\n');
  
  console.log('✨ Tests Complete\n');
}

runTests().catch(err => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
