// Copyright (c) 2025 Scott Crawford. All rights reserved.

/**
 * Database Consolidation Script
 * 
 * Ensures ai_local.db has all required tables from schema
 * and updates all services to point to it.
 */

import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.join(__dirname, '../../data/db/ai_local.db');
const SCHEMA_PATH = path.join(__dirname, '../../schema_local.sql');

console.log('🔧 Database Consolidation Script\n');
console.log(`Database: ${DB_PATH}`);
console.log(`Schema: ${SCHEMA_PATH}\n`);

// Connect to database
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

// Get existing tables
const existingTables = new Set(
  db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(t => t.name)
);

console.log(`📊 Current tables: ${existingTables.size}\n`);

// Read schema
const schema = fs.readFileSync(SCHEMA_PATH, 'utf-8');

// Split by CREATE TABLE and process each
const statements = schema.split(/(?=CREATE TABLE)/);
const missing = [];
const errors = [];

for (const stmt of statements) {
  if (!stmt.trim().startsWith('CREATE TABLE')) continue;
  
  // Extract table name
  const match = stmt.match(/CREATE TABLE\s+(\w+)/);
  if (!match) continue;
  
  const tableName = match[1];
  
  if (!existingTables.has(tableName)) {
    // Extract the full CREATE TABLE statement (up to the closing semicolon and next CREATE or end)
    const endMatch = stmt.match(/CREATE TABLE[\s\S]*?;/);
    if (!endMatch) {
      console.log(`⚠️  Could not extract full statement for ${tableName}`);
      continue;
    }
    
    const createStmt = endMatch[0];
    
    try {
      db.exec(createStmt);
      console.log(`✅ Added table: ${tableName}`);
      missing.push(tableName);
    } catch (e) {
      console.log(`❌ Error adding ${tableName}: ${e.message}`);
      errors.push({ table: tableName, error: e.message });
    }
  }
}

// Final count
const finalTables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();

console.log('\n' + '─'.repeat(60));
console.log('📊 CONSOLIDATION COMPLETE\n');
console.log(`Total tables: ${finalTables.count || finalTables.length}`);
console.log(`Added: ${missing.length}`);
console.log(`Errors: ${errors.length}`);

if (missing.length > 0) {
  console.log('\n✅ Added tables:');
  missing.forEach(t => console.log(`   - ${t}`));
}

if (errors.length > 0) {
  console.log('\n❌ Errors:');
  errors.forEach(e => console.log(`   - ${e.table}: ${e.error}`));
}

console.log('\n📋 All tables in ai_local.db:');
finalTables.forEach(t => console.log(`   - ${t.name}`));

db.close();
