// Copyright (c) 2025 Scott Crawford. All rights reserved.

/**
 * ScottBot Local - AI Response Quality Tests
 * Tests different types of queries and evaluates response quality
 */

import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fetch from 'node-fetch';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const API_BASE = 'http://localhost:3001/api';
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logSection(title) {
  log(`\n${'='.repeat(70)}`, colors.cyan);
  log(`  ${title}`, colors.bright + colors.cyan);
  log('='.repeat(70), colors.cyan);
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Test queries categorized by type
const testQueries = [
  {
    category: 'Factual Knowledge',
    queries: [
      {
        q: 'What is the capital of France?',
        expectedKeywords: ['Paris'],
        shouldBeShort: true
      },
      {
        q: 'Explain photosynthesis in one sentence.',
        expectedKeywords: ['plants', 'light', 'energy'],
        shouldBeShort: true
      },
      {
        q: 'Who wrote "To Kill a Mockingbird"?',
        expectedKeywords: ['Harper Lee'],
        shouldBeShort: true
      }
    ]
  },
  {
    category: 'Math & Logic',
    queries: [
      {
        q: 'What is 25 * 4?',
        expectedKeywords: ['100'],
        shouldBeShort: true
      },
      {
        q: 'If I have 3 apples and buy 7 more, then give away 4, how many do I have?',
        expectedKeywords: ['6'],
        shouldBeShort: true
      },
      {
        q: 'What is the square root of 144?',
        expectedKeywords: ['12'],
        shouldBeShort: true
      }
    ]
  },
  {
    category: 'Creative Thinking',
    queries: [
      {
        q: 'Give me a creative name for a coffee shop.',
        expectedKeywords: [], // Open-ended
        shouldBeShort: true
      },
      {
        q: 'Write a one-line joke about programming.',
        expectedKeywords: [],
        shouldBeShort: true
      }
    ]
  },
  {
    category: 'Explanations',
    queries: [
      {
        q: 'Explain how a car engine works in simple terms.',
        expectedKeywords: ['fuel', 'pistons', 'combustion'],
        shouldBeShort: false
      },
      {
        q: 'What is machine learning?',
        expectedKeywords: ['data', 'algorithms', 'patterns'],
        shouldBeShort: false
      }
    ]
  },
  {
    category: 'Problem Solving',
    queries: [
      {
        q: 'I need to organize a small team meeting. What should I prepare?',
        expectedKeywords: ['agenda', 'time', 'participants'],
        shouldBeShort: false
      },
      {
        q: 'How can I improve my productivity when working from home?',
        expectedKeywords: ['schedule', 'space', 'breaks'],
        shouldBeShort: false
      }
    ]
  },
  {
    category: 'Code & Technical',
    queries: [
      {
        q: 'Write a Python function to reverse a string.',
        expectedKeywords: ['def', 'return', '[::-1]'],
        shouldBeShort: true
      },
      {
        q: 'What is the difference between let and const in JavaScript?',
        expectedKeywords: ['const', 'reassign', 'block'],
        shouldBeShort: false
      }
    ]
  }
];

async function chatWithAI(message, sessionId = null) {
  try {
    const response = await fetch(`${API_BASE}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        message,
        useSearch: false
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    let fullResponse = '';
    let newSessionId = sessionId;

    for await (const chunk of response.body) {
      const text = chunk.toString();
      const lines = text.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') break;
          try {
            const parsed = JSON.parse(data);
            if (parsed.content) {
              fullResponse += parsed.content;
            }
            if (parsed.sessionId && !sessionId) {
              newSessionId = parsed.sessionId;
            }
          } catch (e) {
            // Ignore parse errors
          }
        }
      }
    }

    return { response: fullResponse, sessionId: newSessionId };
  } catch (error) {
    log(`Error: ${error.message}`, colors.red);
    return { response: '', sessionId };
  }
}

function evaluateResponse(query, response) {
  const results = {
    hasContent: response.length > 0,
    length: response.length,
    wordCount: response.split(/\s+/).length,
    hasExpectedKeywords: false,
    isAppropriateLength: false,
    score: 0
  };

  // Check for expected keywords
  if (query.expectedKeywords.length > 0) {
    const lowerResponse = response.toLowerCase();
    const foundKeywords = query.expectedKeywords.filter(keyword => 
      lowerResponse.includes(keyword.toLowerCase())
    );
    results.hasExpectedKeywords = foundKeywords.length > 0;
    results.keywordsFound = foundKeywords.length;
    results.keywordsTotal = query.expectedKeywords.length;
  } else {
    results.hasExpectedKeywords = true; // Open-ended
  }

  // Check length appropriateness
  if (query.shouldBeShort) {
    results.isAppropriateLength = results.wordCount < 100;
  } else {
    results.isAppropriateLength = results.wordCount >= 30;
  }

  // Calculate score
  let score = 0;
  if (results.hasContent) score += 25;
  if (results.hasExpectedKeywords) score += 50;
  if (results.isAppropriateLength) score += 25;
  results.score = score;

  return results;
}

function getScoreColor(score) {
  if (score >= 90) return colors.green;
  if (score >= 70) return colors.yellow;
  return colors.red;
}

async function runTests() {
  log('\n' + '█'.repeat(70), colors.bright + colors.magenta);
  log('  ScottBot Local - AI Response Quality Tests', colors.bright + colors.magenta);
  log('█'.repeat(70) + '\n', colors.bright + colors.magenta);

  const allResults = [];
  let sessionId = null;

  for (const category of testQueries) {
    logSection(category.category);
    
    for (const query of category.queries) {
      log(`\n📝 Query: ${query.q}`, colors.blue);
      log('⏳ Waiting for response...', colors.yellow);
      
      const { response, sessionId: newSessionId } = await chatWithAI(query.q, sessionId);
      sessionId = newSessionId;
      
      const evaluation = evaluateResponse(query, response);
      allResults.push({ category: category.category, query: query.q, evaluation, response });
      
      // Display results
      log(`\n💬 Response (${evaluation.wordCount} words):`, colors.cyan);
      const preview = response.length > 200 ? response.substring(0, 200) + '...' : response;
      log(preview, colors.reset);
      
      log(`\n📊 Evaluation:`, colors.bright);
      log(`   Score: ${evaluation.score}/100`, getScoreColor(evaluation.score));
      log(`   Has Content: ${evaluation.hasContent ? '✓' : '✗'}`, evaluation.hasContent ? colors.green : colors.red);
      log(`   Expected Keywords: ${evaluation.hasExpectedKeywords ? '✓' : '✗'}`, evaluation.hasExpectedKeywords ? colors.green : colors.red);
      if (evaluation.keywordsTotal > 0) {
        log(`   Keywords Found: ${evaluation.keywordsFound}/${evaluation.keywordsTotal}`, colors.blue);
      }
      log(`   Appropriate Length: ${evaluation.isAppropriateLength ? '✓' : '✗'}`, evaluation.isAppropriateLength ? colors.green : colors.red);
      
      await sleep(1000); // Rate limiting
    }
  }

  // Summary
  logSection('Test Summary');
  
  const averageScore = allResults.reduce((sum, r) => sum + r.evaluation.score, 0) / allResults.length;
  const passed = allResults.filter(r => r.evaluation.score >= 75).length;
  const total = allResults.length;
  
  log(`\n📈 Overall Performance:`, colors.bright);
  log(`   Average Score: ${averageScore.toFixed(1)}/100`, getScoreColor(averageScore));
  log(`   Passed (≥75): ${passed}/${total} (${((passed/total)*100).toFixed(1)}%)`, passed >= total * 0.8 ? colors.green : colors.yellow);
  
  log(`\n📋 By Category:`, colors.bright);
  const categories = [...new Set(allResults.map(r => r.category))];
  categories.forEach(cat => {
    const catResults = allResults.filter(r => r.category === cat);
    const catAvg = catResults.reduce((sum, r) => sum + r.evaluation.score, 0) / catResults.length;
    log(`   ${cat}: ${catAvg.toFixed(1)}/100`, getScoreColor(catAvg));
  });
  
  // Show failures
  const failures = allResults.filter(r => r.evaluation.score < 75);
  if (failures.length > 0) {
    log(`\n⚠️  Low Scoring Responses (< 75):`, colors.yellow);
    failures.forEach(f => {
      log(`   • ${f.query}`, colors.red);
      log(`     Score: ${f.evaluation.score}/100`, colors.red);
    });
  }
  
  log('\n' + '='.repeat(70), colors.cyan);
  if (averageScore >= 75) {
    log('🎉 AI Response Quality: GOOD', colors.green + colors.bright);
  } else if (averageScore >= 60) {
    log('⚠️  AI Response Quality: ACCEPTABLE', colors.yellow + colors.bright);
  } else {
    log('❌ AI Response Quality: NEEDS IMPROVEMENT', colors.red + colors.bright);
  }
  log('='.repeat(70) + '\n', colors.cyan);

  // Cleanup session
  if (sessionId) {
    try {
      await fetch(`${API_BASE}/sessions/${sessionId}`, { method: 'DELETE' });
      log('🧹 Test session cleaned up', colors.blue);
    } catch (e) {
      // Ignore cleanup errors
    }
  }
}

// Run tests
log('\n⚙️  Starting AI Response Quality Tests...', colors.yellow);
log('⚠️  Make sure the server is running: npm run dev\n', colors.yellow);

await sleep(1000);

runTests().catch(error => {
  log(`\n❌ Fatal error: ${error.message}`, colors.red);
  process.exit(1);
});
