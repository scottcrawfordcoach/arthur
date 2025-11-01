// Copyright (c) 2025 Scott Crawford. All rights reserved.

/**
 * TEST LIBRARIAN SERVICE
 * 
 * Comprehensive test suite for the Librarian data access layer.
 * Tests 3D scoring, table management, memory aging, and data deletion.
 * 
 * Test Scenarios:
 * 1. Context Request Fulfillment - Retrieve conversation history
 * 2. 3D Scoring Components - Recency, frequency, vehemence calculations
 * 3. Table Creation - Create new custom tables
 * 4. Table Deletion - Delete tables with backup
 * 5. Data Deletion - Privacy-compliant data removal
 * 6. Memory Aging - Compress old conversations
 * 7. Reference Counting - Track access frequency
 * 8. Metrics Tracking - Performance monitoring
 */

import dotenv from 'dotenv';
import Librarian from '../services/Librarian.js';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Use test database
const testDbPath = path.join(__dirname, '../../data/db/librarian_test.db');

// Test utilities
function logTestResult(testName, passed, details = '') {
  const icon = passed ? '✅' : '❌';
  console.log(`${icon} ${testName}`);
  if (details) console.log(`   ${details}`);
}

async function setupTestDatabase() {
  const db = new Database(testDbPath);
  
  // Create minimal test tables
  db.exec(`
    DROP TABLE IF EXISTS assistant_chat_messages;
    CREATE TABLE assistant_chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL,
      message TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      emotion_signals TEXT,
      is_test INTEGER DEFAULT 0,
      is_compressed INTEGER DEFAULT 0,
      reference_count INTEGER DEFAULT 0,
      last_accessed TEXT
    );
    
    DROP TABLE IF EXISTS compressed_memories;
    CREATE TABLE compressed_memories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      original_count INTEGER NOT NULL,
      summary TEXT NOT NULL,
      compressed_at TEXT NOT NULL,
      original_date_range TEXT,
      metadata TEXT
    );
    
    DROP TABLE IF EXISTS librarian_logs;
    CREATE TABLE librarian_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      operation TEXT NOT NULL,
      table_name TEXT NOT NULL,
      details TEXT,
      timestamp TEXT NOT NULL,
      user_id TEXT
    );
    
    DROP TABLE IF EXISTS data_deletion_log;
    CREATE TABLE data_deletion_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      criteria TEXT NOT NULL,
      deleted_counts TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      user_id TEXT,
      reason TEXT
    );
  `);
  
  // Insert test data
  const insertStmt = db.prepare(`
    INSERT INTO assistant_chat_messages (session_id, role, message, timestamp, emotion_signals, reference_count)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  
  // Recent conversation (within 7 days)
  const recentDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(); // 2 days ago
  insertStmt.run('session1', 'user', 'How do I handle anxiety?', recentDate, JSON.stringify({ urgency: 0.8 }), 5);
  insertStmt.run('session1', 'assistant', 'Here are some strategies...', recentDate, null, 0);
  
  // Old conversation (90+ days ago)
  const oldDate = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString();
  insertStmt.run('session2', 'user', 'What is Python?', oldDate, JSON.stringify({ urgency: 0.2 }), 1);
  insertStmt.run('session2', 'assistant', 'Python is a programming language...', oldDate, null, 0);
  
  // Frequently accessed conversation
  const mediumDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  insertStmt.run('session3', 'user', 'React hooks tutorial', mediumDate, JSON.stringify({ urgency: 0.5 }), 15);
  insertStmt.run('session3', 'assistant', 'Let me explain hooks...', mediumDate, null, 0);
  
  db.close();
}

async function cleanupTestDatabase() {
  const fs = await import('fs');
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }
}

async function runTests() {
  console.log('\n📚 LIBRARIAN SERVICE - TEST SUITE\n');
  
  let passedTests = 0;
  let totalTests = 0;
  
  // Setup
  await setupTestDatabase();
  const librarian = new Librarian(testDbPath);
  
  // TEST 1: 3D Scoring - Recency
  totalTests++;
  console.log('\n--- Test 1: Recency Score Calculation ---');
  try {
    const recentDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(); // 2 days ago
    const oldDate = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString(); // 100 days ago
    
    const recentScore = librarian.calculateRecencyScore(recentDate);
    const oldScore = librarian.calculateRecencyScore(oldDate);
    
    const passed = 
      recentScore > 0.9 && // Recent should be very high
      oldScore < 0.1 &&     // Old should be very low
      recentScore > oldScore; // Recent > Old
    
    if (passed) passedTests++;
    logTestResult(
      'Test 1: Recency Scoring',
      passed,
      `Recent (2 days): ${recentScore.toFixed(3)}, Old (100 days): ${oldScore.toFixed(3)}`
    );
    
  } catch (error) {
    logTestResult('Test 1: Recency Scoring', false, error.message);
  }
  
  // TEST 2: 3D Scoring - Frequency
  totalTests++;
  console.log('\n--- Test 2: Frequency Score Calculation ---');
  try {
    const lowFreq = librarian.calculateFrequencyScore(1);
    const mediumFreq = librarian.calculateFrequencyScore(10);
    const highFreq = librarian.calculateFrequencyScore(50);
    
    const passed = 
      lowFreq < mediumFreq &&
      mediumFreq < highFreq &&
      highFreq <= 1.0;
    
    if (passed) passedTests++;
    logTestResult(
      'Test 2: Frequency Scoring',
      passed,
      `Low (1): ${lowFreq.toFixed(3)}, Medium (10): ${mediumFreq.toFixed(3)}, High (50): ${highFreq.toFixed(3)}`
    );
    
  } catch (error) {
    logTestResult('Test 2: Frequency Scoring', false, error.message);
  }
  
  // TEST 3: 3D Scoring - Vehemence
  totalTests++;
  console.log('\n--- Test 3: Vehemence Score Calculation ---');
  try {
    const lowVehemence = librarian.calculateVehemenceScore({
      emotion: { urgency: 0.2, sentiment: 0.1, risk: 0.1 }
    });
    
    const highVehemence = librarian.calculateVehemenceScore({
      emotion: { urgency: 0.9, sentiment: 0.8, risk: 0.7 }
    });
    
    const passed = 
      lowVehemence < highVehemence &&
      lowVehemence >= 0 &&
      highVehemence <= 1.0;
    
    if (passed) passedTests++;
    logTestResult(
      'Test 3: Vehemence Scoring',
      passed,
      `Low emotion: ${lowVehemence.toFixed(3)}, High emotion: ${highVehemence.toFixed(3)}`
    );
    
  } catch (error) {
    logTestResult('Test 3: Vehemence Scoring', false, error.message);
  }
  
  // TEST 4: Conversation History Retrieval
  totalTests++;
  console.log('\n--- Test 4: Conversation History Retrieval ---');
  try {
    const history = await librarian.getConversationHistory({
      time_range: 'all',
      limit: 10
    });
    
    const passed = 
      Array.isArray(history) &&
      history.length > 0 &&
      history[0].role &&
      history[0].message;
    
    if (passed) passedTests++;
    logTestResult(
      'Test 4: Conversation History',
      passed,
      `Retrieved ${history.length} messages`
    );
    
  } catch (error) {
    logTestResult('Test 4: Conversation History', false, error.message);
  }
  
  // TEST 5: Recent vs All Time Filter
  totalTests++;
  console.log('\n--- Test 5: Time Range Filtering ---');
  try {
    const recentHistory = await librarian.getConversationHistory({
      time_range: 'recent', // Last 7 days
      limit: 10
    });
    
    const allHistory = await librarian.getConversationHistory({
      time_range: 'all',
      limit: 10
    });
    
    const passed = 
      Array.isArray(recentHistory) &&
      Array.isArray(allHistory) &&
      allHistory.length >= recentHistory.length; // All should have more or equal
    
    if (passed) passedTests++;
    logTestResult(
      'Test 5: Time Filtering',
      passed,
      `Recent: ${recentHistory.length} messages, All: ${allHistory.length} messages`
    );
    
  } catch (error) {
    logTestResult('Test 5: Time Filtering', false, error.message);
  }
  
  // TEST 6: Table Creation
  totalTests++;
  console.log('\n--- Test 6: Custom Table Creation ---');
  try {
    const schema = `
      CREATE TABLE custom_category (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        data TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    const result = await librarian.createTable('custom_category', schema);
    
    // Verify table exists
    const db = new Database(testDbPath);
    const exists = db.prepare(`
      SELECT name FROM sqlite_master WHERE type='table' AND name='custom_category'
    `).get();
    db.close();
    
    const passed = result === true && exists !== undefined;
    
    if (passed) passedTests++;
    logTestResult(
      'Test 6: Table Creation',
      passed,
      `Table 'custom_category' created successfully`
    );
    
  } catch (error) {
    logTestResult('Test 6: Table Creation', false, error.message);
  }
  
  // TEST 7: Table Deletion with Backup
  totalTests++;
  console.log('\n--- Test 7: Table Deletion ---');
  try {
    // Delete the custom table we just created
    const result = await librarian.deleteTable('custom_category', 'test_cleanup');
    
    // Verify table is deleted
    const db = new Database(testDbPath);
    const exists = db.prepare(`
      SELECT name FROM sqlite_master WHERE type='table' AND name='custom_category'
    `).get();
    
    // Verify backup was created
    const backup = db.prepare(`
      SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'custom_category_backup%'
    `).get();
    
    db.close();
    
    const passed = result === true && exists === undefined && backup !== undefined;
    
    if (passed) passedTests++;
    logTestResult(
      'Test 7: Table Deletion',
      passed,
      `Table deleted, backup created: ${backup?.name || 'N/A'}`
    );
    
  } catch (error) {
    logTestResult('Test 7: Table Deletion', false, error.message);
  }
  
  // TEST 8: Data Deletion
  totalTests++;
  console.log('\n--- Test 8: Privacy-Compliant Data Deletion ---');
  try {
    const deletionResult = await librarian.deleteUserData({
      conversations: {
        session_id: 'session2'
      }
    });
    
    const passed = 
      deletionResult.deleted.conversations &&
      deletionResult.deleted.conversations.deleted > 0;
    
    if (passed) passedTests++;
    logTestResult(
      'Test 8: Data Deletion',
      passed,
      `Deleted ${deletionResult.deleted.conversations.deleted} messages from session2`
    );
    
  } catch (error) {
    logTestResult('Test 8: Data Deletion', false, error.message);
  }
  
  // TEST 9: Memory Aging
  totalTests++;
  console.log('\n--- Test 9: Memory Aging & Compression ---');
  try {
    const agingResult = await librarian.ageMemories();
    
    // Check if compression was attempted
    const db = new Database(testDbPath);
    const compressedCount = db.prepare(`
      SELECT COUNT(*) as count FROM assistant_chat_messages WHERE is_compressed = 1
    `).get();
    db.close();
    
    const passed = 
      agingResult !== null &&
      typeof agingResult.compressed === 'number';
    
    if (passed) passedTests++;
    logTestResult(
      'Test 9: Memory Aging',
      passed,
      `Compressed ${agingResult.compressed} memories, ${compressedCount.count} marked as compressed`
    );
    
  } catch (error) {
    logTestResult('Test 9: Memory Aging', false, error.message);
  }
  
  // TEST 10: Metrics Tracking
  totalTests++;
  console.log('\n--- Test 10: Metrics Tracking ---');
  try {
    const metrics = librarian.getMetrics();
    
    const passed = 
      typeof metrics.totalQueries === 'number' &&
      typeof metrics.avgQueryTime === 'number' &&
      typeof metrics.tablesCreated === 'number' &&
      typeof metrics.tablesDeleted === 'number';
    
    if (passed) passedTests++;
    logTestResult(
      'Test 10: Metrics',
      passed,
      `Queries: ${metrics.totalQueries}, Tables Created: ${metrics.tablesCreated}, Tables Deleted: ${metrics.tablesDeleted}`
    );
    
  } catch (error) {
    logTestResult('Test 10: Metrics', false, error.message);
  }
  
  // Cleanup
  librarian.close();
  await cleanupTestDatabase();
  
  // SUMMARY
  console.log('\n' + '='.repeat(60));
  console.log(`SUMMARY: ${passedTests}/${totalTests} tests passed`);
  console.log('='.repeat(60) + '\n');
  
  if (passedTests === totalTests) {
    console.log('🎉 All Librarian tests passed!\n');
    console.log('✅ 3D Relevance Scoring (Recency, Frequency, Vehemence)');
    console.log('✅ Conversation history retrieval with time filtering');
    console.log('✅ Custom table creation and deletion');
    console.log('✅ Privacy-compliant data deletion');
    console.log('✅ Memory aging and compression');
    console.log('✅ Metrics tracking');
    console.log('\n📚 Librarian Service: READY FOR INTEGRATION!\n');
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
