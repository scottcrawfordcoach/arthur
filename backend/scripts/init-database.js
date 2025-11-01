// Copyright (c) 2025 Scott Crawford. All rights reserved.

/**
 * Initialize ai_local.db with schema
 */

import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, '../../data/db/ai_local.db');
const schemaPath = path.join(__dirname, '../../schema_local.sql');

console.log('=== DATABASE INITIALIZATION ===\n');

const db = new Database(dbPath);

try {
  // Read schema file
  const schema = fs.readFileSync(schemaPath, 'utf8');
  
  // Split into individual statements (simple split on semicolon)
  const statements = schema
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));
  
  console.log(`Executing ${statements.length} SQL statements...`);
  
  // Execute each statement
  let created = 0;
  for (const statement of statements) {
    try {
      db.exec(statement);
      if (statement.toUpperCase().includes('CREATE TABLE')) {
        created++;
        const match = statement.match(/CREATE TABLE\s+(\w+)/i);
        if (match) {
          console.log(`  ✅ Created table: ${match[1]}`);
        }
      }
    } catch (error) {
      // Skip errors for already existing tables
      if (!error.message.includes('already exists')) {
        console.log(`  ⚠️  Warning: ${error.message}`);
      }
    }
  }
  
  console.log(`\n✅ Database initialized with ${created} tables`);
  
} catch (error) {
  console.error('Initialization failed:', error.message);
  process.exit(1);
} finally {
  db.close();
}
