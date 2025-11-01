/**
 * Seed scattered conversation fragments across multiple sessions
 * to visualize how revisited topics manifest in thread history.
 *
 * Generates 6 sessions with time-scattered fragments touching
 * a few recurring topics (auth, stress, Adam Grant books, React, sleep).
 * All messages are flagged is_test=1 for easy cleanup.
 */

import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, '../../data/db/ai_local.db');

const db = new Database(dbPath);

// Detect optional columns
const msgColumns = db.prepare(`PRAGMA table_info(assistant_chat_messages)`).all();
const hasIsTest = msgColumns.some(c => c.name === 'is_test');

function nowMinusDays(days, hour = 12, minute = 0) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(hour, minute, 0, 0);
  return d;
}

function insertSession({ id, title, createdAt, updatedAt }) {
  db.prepare(`
    INSERT INTO assistant_chat_sessions (id, title, created_at, updated_at)
    VALUES (?, ?, ?, ?)
  `).run(id, title, createdAt, updatedAt);
}

function insertMessage({ id, sessionId, role, content, createdAt }) {
  if (hasIsTest) {
    db.prepare(`
      INSERT INTO assistant_chat_messages (id, session_id, role, content, created_at, is_test)
      VALUES (?, ?, ?, ?, ?, 1)
    `).run(id, sessionId, role, content, createdAt);
  } else {
    db.prepare(`
      INSERT INTO assistant_chat_messages (id, session_id, role, content, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, sessionId, role, content, createdAt);
  }
}

function seed() {
  const sessions = [
    {
      title: 'TEST — JWT auth keeps expiring',
      schedule: [
        { daysAgo: 90, user: "JWT tokens keep expiring before 24 hours.", assistant: "Check server clock drift and refresh token logic." },
        { daysAgo: 34, user: "Auth again… 401 after refresh.", assistant: "Verify refresh cookie path and sameSite settings." },
        { daysAgo: 5, user: "Auth stable now; adding OAuth2.", assistant: "Great—ensure secure storage for client secrets." }
      ]
    },
    {
      title: 'TEST — Overwhelmed at work',
      schedule: [
        { daysAgo: 60, user: "Feeling overwhelmed—too many deadlines.", assistant: "Let’s triage and set 3 priorities for today." },
        { daysAgo: 28, user: "Still stressed about next sprint.", assistant: "Block 90 minutes of deep work; protect calendar." },
        { daysAgo: 2, user: "Today was better after a walk.", assistant: "Nice—keep that as a reset between tasks." }
      ]
    },
    {
      title: 'TEST — Adam Grant book notes',
      schedule: [
        { daysAgo: 75, user: "What are Adam Grant books in your library?", assistant: "Hidden Potential, Think Again, Give and Take…" },
        { daysAgo: 12, user: "Summarize Hidden Potential (no web).", assistant: "Focus on systems, environment, deliberate practice." }
      ]
    },
    {
      title: 'TEST — React hooks journey',
      schedule: [
        { daysAgo: 120, user: "How does useEffect actually work?", assistant: "Runs side effects after render; mind dependencies." },
        { daysAgo: 10, user: "Refactoring to hooks improved readability.", assistant: "Good—extract custom hooks for reuse." }
      ]
    },
    {
      title: 'TEST — Sleep routines',
      schedule: [
        { daysAgo: 44, user: "Up since 3am again…", assistant: "Try a wind‑down window and screen cutoff at 9pm." },
        { daysAgo: 7, user: "Sleep better after consistent schedule.", assistant: "Great—keep wake time fixed even on weekends." }
      ]
    },
    {
      title: 'TEST — Think Again reflections',
      schedule: [
        { daysAgo: 52, user: "Rethinking vs. knowing—how to practice?", assistant: "Schedule regular idea reviews; keep a rethinking log." },
        { daysAgo: 1, user: "Tried rethinking journal—helpful.", assistant: "Nice—add prompts: What changed my mind today?" }
      ]
    }
  ];

  let totalMessages = 0;

  const existingTestSessions = db.prepare(`
    SELECT id FROM assistant_chat_sessions WHERE title LIKE 'TEST — %'
  `).all();
  if (existingTestSessions.length > 0) {
    console.log(`Found ${existingTestSessions.length} existing TEST sessions. Deleting their messages and sessions…`);
    const ids = existingTestSessions.map(r => r.id);
    const placeholders = ids.map(() => '?').join(',');
    db.prepare(`DELETE FROM assistant_chat_messages WHERE session_id IN (${placeholders})`).run(...ids);
    db.prepare(`DELETE FROM assistant_chat_sessions WHERE id IN (${placeholders})`).run(...ids);
  }

  for (const s of sessions) {
    const sessionId = uuidv4();
    // Create messages with scattered dates
    const msgs = [];
    for (const entry of s.schedule) {
      const t = nowMinusDays(entry.daysAgo, 11 + Math.floor(Math.random() * 8), Math.floor(Math.random() * 50));
      const t2 = new Date(t.getTime() + 45 * 1000);
      msgs.push({ role: 'user', content: entry.user, createdAt: t.toISOString() });
      msgs.push({ role: 'assistant', content: entry.assistant, createdAt: t2.toISOString() });
    }
    const createdAt = msgs[0].createdAt;
    const updatedAt = msgs[msgs.length - 1].createdAt;

    insertSession({ id: sessionId, title: s.title, createdAt, updatedAt });

    for (const m of msgs) {
      insertMessage({ id: uuidv4(), sessionId, role: m.role, content: m.content, createdAt: m.createdAt });
      totalMessages += 1;
    }
  }

  console.log(`\n✅ Seeded ${sessions.length} sessions with ${totalMessages} messages.`);
  console.log('These sessions are prefixed with "TEST —" so they are easy to spot.');
}

try {
  seed();
} catch (e) {
  console.error('Seeding failed:', e.message);
  process.exit(1);
} finally {
  db.close();
}
