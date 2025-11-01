// Copyright (c) 2025 Scott Crawford. All rights reserved.

import Database from 'better-sqlite3';
import { readFileSync } from 'fs';

const db = new Database('./data/db/test.db');
const schema = readFileSync('./schema_local.sql', 'utf8');

console.log('Schema length:', schema.length);
console.log('First 200 chars:', schema.substring(0, 200));

try {
  db.exec(schema);
  console.log('Schema executed successfully');
} catch (err) {
  console.error('Error executing schema:', err.message);
  console.error('Full error:', err);
}

const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log(`Created ${tables.length} tables:`, tables.map(t => t.name));

db.close();
