import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, '../../data/db/ai_local.db');

const db = new Database(dbPath);
const tables = db.prepare(`SELECT name FROM sqlite_master WHERE type='table'`).all();

console.log('Tables in ai_local.db:');
tables.forEach(t => console.log(`  - ${t.name}`));

db.close();
