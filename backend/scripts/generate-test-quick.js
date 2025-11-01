/**
 * Quick test of synthetic data generator (small dataset)
 */

import Database from 'better-sqlite3';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, '../../data/db/ai_local.db');

const db = new Database(dbPath);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

console.log('=== QUICK TEST: Synthetic Data ===\n');

// Small test dataset
const testMessages = [
  // Crisis moment (HIGH VEHEMENCE)
  {
    user: "I can't breathe, I think I'm having a panic attack",
    assistant: "I'm here with you. Let's work through this together. Focus on your breath.",
    daysAgo: 2,
    topic: 'panic attack',
    emotion: 'panic',
    urgency: 0.95
  },
  // Recurring tech problem (HIGH FREQUENCY)
  {
    user: "Still stuck on that JWT authentication issue",
    assistant: "Let's debug this authentication flow step by step.",
    daysAgo: 5,
    topic: 'authentication',
    emotion: 'frustrated',
    urgency: 0.6
  },
  {
    user: "The JWT token keeps expiring too quickly",
    assistant: "Check your token expiration settings in the config.",
    daysAgo: 15,
    topic: 'authentication',
    emotion: 'confused',
    urgency: 0.5
  },
  {
    user: "Got the JWT working! Had to fix the refresh logic",
    assistant: "Excellent! Great debugging work.",
    daysAgo: 3,
    topic: 'authentication',
    emotion: 'satisfied',
    urgency: 0.2
  },
  // Learning journey (RECENCY + PROGRESSION)
  {
    user: "How does React useEffect work?",
    assistant: "useEffect runs side effects after render. Let me explain...",
    daysAgo: 30,
    topic: 'react',
    emotion: 'curious',
    urgency: 0.3
  },
  {
    user: "I'm getting better with React hooks!",
    assistant: "Great progress! Your understanding has really deepened.",
    daysAgo: 7,
    topic: 'react',
    emotion: 'confident',
    urgency: 0.2
  },
  // Old but important (TESTING RECENCY DECAY)
  {
    user: "What's the difference between var, let, and const?",
    assistant: "var is function-scoped, let and const are block-scoped...",
    daysAgo: 120,
    topic: 'javascript',
    emotion: 'learning',
    urgency: 0.3
  }
];

async function generateTestData() {
  try {
    console.log('Generating test conversations...');
    
    const conversations = [];
    let id = 1;
    
    for (const msg of testMessages) {
      const timestamp = Date.now() - (msg.daysAgo * 24 * 60 * 60 * 1000);
      
      // User message
      conversations.push({
        id: `TEST_QUICK_${id++}`,
        session_id: 'TEST_QUICK',
        role: 'user',
        content: msg.user,
        created_at: new Date(timestamp).toISOString(),
        is_test: 1
      });
      
      // Assistant message
      conversations.push({
        id: `TEST_QUICK_${id++}`,
        session_id: 'TEST_QUICK',
        role: 'assistant',
        content: msg.assistant,
        created_at: new Date(timestamp + 5000).toISOString(),
        is_test: 1
      });
    }
    
    console.log(`Generated ${conversations.length} messages (${conversations.length / 2} pairs)`);
    
    // Generate embeddings
    console.log('\nGenerating embeddings...');
    const texts = conversations.map(c => c.content);
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: texts
    });
    
    response.data.forEach((embedding, idx) => {
      conversations[idx].embedding = JSON.stringify(embedding.embedding);
    });
    
    console.log('Embeddings complete!');
    
    // Insert into database
    console.log('\nInserting into database...');
    const insert = db.prepare(`
      INSERT INTO assistant_chat_messages (
        id, session_id, role, content, created_at, is_test, embedding
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    const insertMany = db.transaction((convos) => {
      for (const convo of convos) {
        insert.run(
          convo.id,
          convo.session_id,
          convo.role,
          convo.content,
          convo.created_at,
          convo.is_test,
          convo.embedding
        );
      }
    });
    
    insertMany(conversations);
    console.log(`✅ Inserted ${conversations.length} messages`);
    
    // Verify
    const count = db.prepare('SELECT COUNT(*) as count FROM assistant_chat_messages WHERE is_test = 1').get();
    console.log(`\n✅ Total test messages in database: ${count.count}`);
    
    console.log('\n=== Test Data Ready ===');
    console.log('You can now test:');
    console.log('  - 3D scoring (recency, frequency, vehemence)');
    console.log('  - Pattern detection (authentication topic appears 3 times)');
    console.log('  - Crisis detection (panic attack with high urgency)');
    console.log('  - Learning progression (React journey)');
    
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    db.close();
  }
}

generateTestData();
