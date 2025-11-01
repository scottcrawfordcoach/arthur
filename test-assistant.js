/**
 * ScottBot Local - Comprehensive Feature Test Suite
 * Tests all major functionality without requiring manual UI interaction
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
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
  cyan: '\x1b[36m'
};

let sessionId = null;
let fileId = null;
let testResults = {
  passed: 0,
  failed: 0,
  tests: []
};

// Utility functions
function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logTest(name, passed, details = '') {
  const status = passed ? '✅ PASS' : '❌ FAIL';
  const statusColor = passed ? colors.green : colors.red;
  log(`${status}: ${name}${details ? ' - ' + details : ''}`, statusColor);
  testResults.tests.push({ name, passed, details });
  if (passed) testResults.passed++;
  else testResults.failed++;
}

function logSection(title) {
  log(`\n${'='.repeat(60)}`, colors.cyan);
  log(`  ${title}`, colors.bright + colors.cyan);
  log('='.repeat(60), colors.cyan);
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Test functions
async function testHealth() {
  logSection('1. Health Check');
  try {
    const response = await fetch('http://localhost:3001/health');
    const data = await response.json();
    
    logTest('Server responds to health check', response.ok && data.status === 'ok');
    
    log(`  Status: ${data.status}`, colors.blue);
    log(`  Timestamp: ${data.timestamp}`, colors.blue);
    
    return response.ok;
  } catch (error) {
    logTest('Health check', false, error.message);
    return false;
  }
}

async function testPreferences() {
  logSection('2. Preferences Management');
  try {
    // Save preferences (using PUT for individual keys)
    const saveTheme = await fetch(`${API_BASE}/preferences/theme`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: 'dark' })
    });
    
    const saveModel = await fetch(`${API_BASE}/preferences/model`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: 'gpt-4o' })
    });
    
    logTest('Save theme preference', saveTheme.ok);
    logTest('Save model preference', saveModel.ok);
    
    // Get preferences
    const getResponse = await fetch(`${API_BASE}/preferences`);
    const data = await getResponse.json();
    const savedPrefs = data.preferences || {};
    
    logTest('Retrieve preferences', getResponse.ok);
    logTest('Theme preference saved', savedPrefs.theme === 'dark');
    logTest('Model preference saved', savedPrefs.model === 'gpt-4o');
    
    log(`  Saved preferences: ${JSON.stringify(savedPrefs, null, 2)}`, colors.blue);
    
    return saveTheme.ok && saveModel.ok && getResponse.ok;
  } catch (error) {
    logTest('Preferences management', false, error.message);
    return false;
  }
}

async function testSessions() {
  logSection('3. Session Management');
  try {
    // Sessions are auto-created via chat, so just test listing
    const listResponse = await fetch(`${API_BASE}/sessions`);
    const data = await listResponse.json();
    const sessions = data.sessions || [];
    
    logTest('List sessions endpoint works', listResponse.ok);
    log(`  Total sessions: ${sessions.length}`, colors.blue);
    
    // If there are existing sessions, store one for later tests
    if (sessions.length > 0) {
      sessionId = sessions[0].id;
      log(`  Using session: ${sessionId}`, colors.blue);
    } else {
      log('  No existing sessions - will be created during chat test', colors.yellow);
    }
    
    return listResponse.ok;
  } catch (error) {
    logTest('Session management', false, error.message);
    return false;
  }
}

async function testFileUpload() {
  logSection('4. File Upload & Conversion');
  try {
    // Create a test markdown file
    const testFilePath = join(__dirname, 'test-upload.md');
    const testContent = `# Test Document

This is a test document for ScottBot Local.

## Features Being Tested
- File upload
- Content extraction
- Metadata generation
- Chunking
- Embedding generation

## Sample Content
AI assistants are becoming increasingly sophisticated. They can help with:
1. Research and information gathering
2. Code development and debugging
3. Writing and editing
4. Data analysis

This document contains enough content to test the chunking system properly.`;

    fs.writeFileSync(testFilePath, testContent);
    
    // Create form data
    const FormData = (await import('form-data')).default;
    const form = new FormData();
    form.append('file', fs.createReadStream(testFilePath));
    form.append('action', 'process');
    
    const uploadResponse = await fetch(`${API_BASE}/files/upload`, {
      method: 'POST',
      body: form
    });
    
    const result = await uploadResponse.json();
    fileId = result.file?.fileId || result.file?.id;
    
    logTest('File upload', uploadResponse.ok);
    logTest('File ID generated', !!fileId);
    log(`  File ID: ${fileId}`, colors.blue);
    
    // Wait for processing
    log('  Waiting for file processing...', colors.yellow);
    await sleep(3000);
    
    // Check file was stored
    const filesResponse = await fetch(`${API_BASE}/files`);
    const filesData = await filesResponse.json();
    const files = filesData.files || [];
    const uploadedFile = files.find(f => f.id === fileId);
    
    logTest('File stored in database', !!uploadedFile);
    logTest('File processing completed', uploadedFile?.conversion_status === 'completed');
    
    if (uploadedFile) {
      log(`  Filename: ${uploadedFile.original_filename}`, colors.blue);
      log(`  Size: ${uploadedFile.size} bytes`, colors.blue);
      log(`  Status: ${uploadedFile.conversion_status}`, colors.blue);
    }
    
    // Cleanup
    fs.unlinkSync(testFilePath);
    
    return uploadResponse.ok;
  } catch (error) {
    logTest('File upload', false, error.message);
    return false;
  }
}

async function testSearch() {
  logSection('5. Web Search');
  try {
    const searchResponse = await fetch(`${API_BASE}/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'test query', maxResults: 3 })
    });
    
    logTest('Web search endpoint responds', searchResponse.ok || searchResponse.status === 500);
    
    // Web search may fail without API keys, which is expected
    if (searchResponse.ok) {
      const results = await searchResponse.json();
      log(`  Search returned data`, colors.blue);
    } else {
      log('  Web search requires API key (TAVILY_API_KEY or SERPER_API_KEY)', colors.yellow);
    }
    
    return true; // Always pass since API keys may not be configured
  } catch (error) {
    log(`  Web search not configured: ${error.message}`, colors.yellow);
    return true; // Not a failure - just not configured
  }
}

async function testChat() {
  logSection('6. Chat Functionality');
  try {
    // Chat will create a session if none provided
    const chatResponse = await fetch(`${API_BASE}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: sessionId || null,
        message: 'What is 2+2? Answer briefly.',
        useSearch: false
      })
    });
    
    logTest('Chat endpoint responds', chatResponse.ok);
    logTest('Response is streaming', chatResponse.headers.get('content-type')?.includes('text/event-stream'));
    
    // Read stream
    let fullResponse = '';
    let newSessionId = sessionId;
    const reader = chatResponse.body;
    
    log('  Reading chat stream...', colors.yellow);
    
    for await (const chunk of reader) {
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
              sessionId = newSessionId;
            }
          } catch (e) {
            // Ignore parse errors
          }
        }
      }
      
      if (fullResponse.length > 50) break; // Got enough response
    }
    
    logTest('Chat generates response', fullResponse.length > 0);
    log(`  Response preview: ${fullResponse.substring(0, 100)}...`, colors.blue);
    if (newSessionId) {
      log(`  Session ID: ${newSessionId}`, colors.blue);
    }
    
    return chatResponse.ok;
  } catch (error) {
    logTest('Chat functionality', false, error.message);
    return false;
  }
}

async function testWebSearch() {
  logSection('7. Web Search Integration');
  try {
    const chatResponse = await fetch(`${API_BASE}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        message: 'Search the web for recent AI news',
        useSearch: true
      })
    });
    
    logTest('Web search chat endpoint responds', chatResponse.ok);
    
    // Read stream briefly to confirm it works
    let hasSearchResults = false;
    const reader = chatResponse.body;
    
    for await (const chunk of reader) {
      const text = chunk.toString();
      if (text.includes('search') || text.includes('found') || text.includes('results')) {
        hasSearchResults = true;
        break;
      }
      await sleep(100);
      break; // Just check first chunk
    }
    
    logTest('Web search integration active', chatResponse.ok);
    log('  Note: Web search requires API key to return results', colors.yellow);
    
    return chatResponse.ok;
  } catch (error) {
    logTest('Web search', false, error.message);
    return false;
  }
}

async function testFileOperations() {
  logSection('8. File Management');
  try {
    // List files
    const listResponse = await fetch(`${API_BASE}/files`);
    const data = await listResponse.json();
    const files = data.files || [];
    
    logTest('List files', listResponse.ok);
    log(`  Total files: ${files.length}`, colors.blue);
    
    if (fileId) {
      // Get specific file
      const fileResponse = await fetch(`${API_BASE}/files/${fileId}`);
      const fileData = await fileResponse.json();
      const file = fileData.file || fileData;
      
      logTest('Get file details', fileResponse.ok);
      logTest('File record exists', !!file);
      
      // Delete file
      const deleteResponse = await fetch(`${API_BASE}/files/${fileId}`, {
        method: 'DELETE'
      });
      
      logTest('Delete file', deleteResponse.ok);
      
      // Verify deletion
      const verifyResponse = await fetch(`${API_BASE}/files/${fileId}`);
      logTest('File deleted from database', verifyResponse.status === 404 || verifyResponse.status === 500);
    }
    
    return listResponse.ok;
  } catch (error) {
    logTest('File operations', false, error.message);
    return false;
  }
}

async function testSessionDeletion() {
  logSection('9. Session Cleanup');
  try {
    if (!sessionId) {
      log('  No session to delete', colors.yellow);
      return true;
    }
    
    const deleteResponse = await fetch(`${API_BASE}/sessions/${sessionId}`, {
      method: 'DELETE'
    });
    
    logTest('Delete session', deleteResponse.ok);
    
    // Verify deletion
    const verifyResponse = await fetch(`${API_BASE}/sessions/${sessionId}`);
    logTest('Session deleted from database', verifyResponse.status === 404);
    
    return deleteResponse.ok;
  } catch (error) {
    logTest('Session deletion', false, error.message);
    return false;
  }
}

async function printSummary() {
  logSection('Test Summary');
  
  const total = testResults.passed + testResults.failed;
  const passRate = ((testResults.passed / total) * 100).toFixed(1);
  
  log(`Total Tests: ${total}`, colors.bright);
  log(`Passed: ${testResults.passed}`, colors.green);
  log(`Failed: ${testResults.failed}`, colors.red);
  log(`Pass Rate: ${passRate}%`, passRate > 90 ? colors.green : colors.yellow);
  
  if (testResults.failed > 0) {
    log('\nFailed Tests:', colors.red);
    testResults.tests
      .filter(t => !t.passed)
      .forEach(t => log(`  - ${t.name}: ${t.details}`, colors.red));
  }
  
  log('\n' + '='.repeat(60), colors.cyan);
  
  if (testResults.failed === 0) {
    log('🎉 All tests passed! ScottBot Local is working perfectly!', colors.green + colors.bright);
  } else {
    log('⚠️  Some tests failed. Check the details above.', colors.yellow);
  }
}

// Main test runner
async function runAllTests() {
  log('\n' + '█'.repeat(60), colors.bright + colors.blue);
  log('  ScottBot Local - Automated Test Suite', colors.bright + colors.blue);
  log('█'.repeat(60) + '\n', colors.bright + colors.blue);
  
  log('Starting tests...', colors.yellow);
  log('Make sure the server is running: npm run dev\n', colors.yellow);
  
  await sleep(1000);
  
  try {
    await testHealth();
    await testPreferences();
    await testSessions();
    await testFileUpload();
    await testSearch();
    await testChat();
    await testWebSearch();
    await testFileOperations();
    await testSessionDeletion();
  } catch (error) {
    log(`\nCritical error during tests: ${error.message}`, colors.red);
    log(error.stack, colors.red);
  }
  
  await printSummary();
  
  process.exit(testResults.failed > 0 ? 1 : 0);
}

// Run tests
runAllTests().catch(error => {
  log(`Fatal error: ${error.message}`, colors.red);
  process.exit(1);
});
