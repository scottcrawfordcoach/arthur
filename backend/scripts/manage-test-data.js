/**
 * TEST DATA MANAGER
 * 
 * Utility to manage synthetic test data:
 * - View stats
 * - Delete all test data
 * - Query test data for validation
 */

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, '../../data/db/ai_local.db');

const db = new Database(dbPath);

const commands = {
  stats: () => {
    console.log('=== TEST DATA STATISTICS ===\n');
    
    const testCount = db.prepare('SELECT COUNT(*) as count FROM assistant_chat_messages WHERE is_test = 1').get();
    const realCount = db.prepare('SELECT COUNT(*) as count FROM assistant_chat_messages WHERE is_test = 0 OR is_test IS NULL').get();
    
    console.log(`Test messages: ${testCount.count}`);
    console.log(`Real messages: ${realCount.count}`);
    console.log(`Total: ${testCount.count + realCount.count}`);
    
    if (testCount.count > 0) {
      const oldest = db.prepare('SELECT MIN(created_at) as oldest FROM assistant_chat_messages WHERE is_test = 1').get();
      const newest = db.prepare('SELECT MAX(created_at) as newest FROM assistant_chat_messages WHERE is_test = 1').get();
      
      console.log(`\nTest data time range:`);
      console.log(`  Oldest: ${oldest.oldest}`);
      console.log(`  Newest: ${newest.newest}`);
      
      const sessions = db.prepare('SELECT DISTINCT session_id FROM assistant_chat_messages WHERE is_test = 1').all();
      console.log(`\nTest sessions: ${sessions.map(s => s.session_id).join(', ')}`);
    }
  },
  
  delete: () => {
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    rl.question('Are you sure you want to DELETE all test data? (yes/no): ', (answer) => {
      if (answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y') {
        const result = db.prepare('DELETE FROM assistant_chat_messages WHERE is_test = 1').run();
        console.log(`✅ Deleted ${result.changes} test messages`);
      } else {
        console.log('Cancelled.');
      }
      rl.close();
      db.close();
    });
  },
  
  sample: () => {
    console.log('=== SAMPLE TEST MESSAGES ===\n');
    
    const samples = db.prepare(`
      SELECT role, content, created_at, session_id
      FROM assistant_chat_messages
      WHERE is_test = 1
      ORDER BY created_at DESC
      LIMIT 10
    `).all();
    
    samples.forEach((msg, i) => {
      console.log(`${i + 1}. [${msg.role}] ${msg.created_at}`);
      console.log(`   Session: ${msg.session_id}`);
      console.log(`   ${msg.content.substring(0, 100)}${msg.content.length > 100 ? '...' : ''}`);
      console.log();
    });
  },
  
  help: () => {
    console.log(`
=== TEST DATA MANAGER ===

Commands:
  node manage-test-data.js stats   - Show test data statistics
  node manage-test-data.js sample  - Show sample test messages
  node manage-test-data.js delete  - Delete all test data (with confirmation)
  node manage-test-data.js help    - Show this help

Examples:
  npm run test:data:stats
  npm run test:data:clean
    `);
  }
};

// Parse command
const command = process.argv[2] || 'help';

if (commands[command]) {
  commands[command]();
} else {
  console.log(`Unknown command: ${command}`);
  commands.help();
  db.close();
}

// Close DB on exit (except for delete which handles it separately)
if (command !== 'delete') {
  process.on('exit', () => db.close());
}
