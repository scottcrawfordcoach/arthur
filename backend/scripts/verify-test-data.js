/**
 * Verify test data and show how to filter it
 */

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, '../../data/db/ai_local.db');

const db = new Database(dbPath);

console.log('=== TEST DATA VERIFICATION ===\n');

// Count test messages
const testCount = db.prepare('SELECT COUNT(*) as count FROM assistant_chat_messages WHERE is_test = 1').get();
console.log(`Test messages (is_test = 1): ${testCount.count}`);

// Count real messages
const realCount = db.prepare('SELECT COUNT(*) as count FROM assistant_chat_messages WHERE is_test = 0 OR is_test IS NULL').get();
console.log(`Real messages (is_test = 0 or NULL): ${realCount.count}`);

// Show sample test data
console.log('\n=== SAMPLE TEST MESSAGES ===');
const samples = db.prepare(`
  SELECT role, content, created_at 
  FROM assistant_chat_messages 
  WHERE is_test = 1 
  ORDER BY created_at DESC 
  LIMIT 5
`).all();

samples.forEach((msg, i) => {
  console.log(`\n${i + 1}. [${msg.role}] ${msg.created_at}`);
  console.log(`   ${msg.content.substring(0, 80)}${msg.content.length > 80 ? '...' : ''}`);
});

console.log('\n=== HOW TO USE IN PRODUCTION ===');
console.log(`
When querying for real chat history (excluding test data):

// In your Librarian or chat service:
const realMessages = db.prepare(\`
  SELECT * FROM assistant_chat_messages 
  WHERE session_id = ? 
  AND (is_test = 0 OR is_test IS NULL)  -- Exclude test data
  ORDER BY created_at DESC
  LIMIT 50
\`).all(sessionId);

// For semantic search (when you build the Librarian):
const searchResults = db.prepare(\`
  SELECT * FROM assistant_chat_messages 
  WHERE (is_test = 0 OR is_test IS NULL)  -- Exclude test data
  -- ... rest of your search logic
\`).all();

// To DELETE all test data later:
db.prepare('DELETE FROM assistant_chat_messages WHERE is_test = 1').run();
`);

console.log('\n=== TESTING WITH TEST DATA ===');
console.log(`
When you want to TEST the Knights/Librarian with synthetic data:

// Query for test data only:
const testMessages = db.prepare(\`
  SELECT * FROM assistant_chat_messages 
  WHERE is_test = 1
  ORDER BY created_at DESC
\`).all();

// Test 3D scoring with known patterns:
// - "authentication" appears 6 times (frequency test)
// - "panic attack" has urgency: 0.95 (vehemence test)
// - Messages span 180 days (recency test)
`);

db.close();
