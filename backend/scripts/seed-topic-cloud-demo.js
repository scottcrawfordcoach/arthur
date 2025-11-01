/**
 * Seed a compact dataset tailored for the History Explorer topic cloud demo.
 *
 * Creates 5 topical sessions with mixed recency so the cloud shows
 * varied font sizes and recency badges. All content is marked as test data.
 */

import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, '../../data/db/ai_local.db');

const db = new Database(dbPath);

const msgColumns = db.prepare(`PRAGMA table_info(assistant_chat_messages)`).all();
const hasIsTest = msgColumns.some((col) => col.name === 'is_test');

function timestampDaysAgo(days, hour = 11, minute = 0) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
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

const TOPIC_SESSIONS = [
  {
    title: 'TOPIC CLOUD DEMO — Strategic Offsites',
    timeline: [
      {
        daysAgo: 45,
        user: 'Need help designing a team offsite that balances strategy and recharge.',
        assistant: 'Open with a strategy retro, then rotate ownership for energizers and reflections.'
      },
      {
        daysAgo: 7,
        user: 'Offsite went well—looking for a 30-day follow-up plan.',
        assistant: 'Schedule buddy check-ins and capture three commitments per leader.'
      }
    ]
  },
  {
    title: 'TOPIC CLOUD DEMO — Focus Rituals',
    timeline: [
      {
        daysAgo: 30,
        user: 'Struggling to protect deep-work blocks.',
        assistant: 'Adopt a daily 90-minute maker slot; announce it in your status updates.'
      },
      {
        daysAgo: 1,
        user: 'Tried the maker slot today—still interrupted twice.',
        assistant: 'Add a Slack auto-reply and share a shared calendar view with your team.'
      }
    ]
  },
  {
    title: 'TOPIC CLOUD DEMO — Product Feedback Loop',
    timeline: [
      {
        daysAgo: 21,
        user: 'Need a weekly ritual for customer insight ingestion.',
        assistant: 'Rotate a listener-of-the-week to summarize patterns every Friday.'
      },
      {
        daysAgo: 3,
        user: 'First ritual produced 18 raw notes—overwhelming!',
        assistant: 'Cluster by theme before the meeting; track deltas in a single changelog.'
      }
    ]
  },
  {
    title: 'TOPIC CLOUD DEMO — Hiring Debriefs',
    timeline: [
      {
        daysAgo: 12,
        user: 'How do we make interview debriefs more decisive?',
        assistant: 'Use a 3-part agenda: signal snapshot, concerns, and go/no-go vote.'
      }
    ]
  },
  {
    title: 'TOPIC CLOUD DEMO — Learning Journal',
    timeline: [
      {
        daysAgo: 90,
        user: 'Want a reflective practice for ongoing experiments.',
        assistant: 'Create a learning journal with three questions: hypothesis, result, next iteration.'
      },
      {
        daysAgo: 60,
        user: 'Journal feels repetitive—any prompt refresh ideas?',
        assistant: 'Add a monthly “kill a bad habit” entry and highlight one surprising insight.'
      }
    ]
  }
];

function seed() {
  const existing = db.prepare(`
    SELECT id FROM assistant_chat_sessions WHERE title LIKE 'TOPIC CLOUD DEMO — %'
  `).all();

  if (existing.length > 0) {
    const ids = existing.map((row) => row.id);
    const slots = ids.map(() => '?').join(',');
    db.prepare(`DELETE FROM assistant_chat_messages WHERE session_id IN (${slots})`).run(...ids);
    db.prepare(`DELETE FROM assistant_chat_sessions WHERE id IN (${slots})`).run(...ids);
    console.log(`Removed ${existing.length} previous TOPIC CLOUD DEMO sessions.`);
  }

  let totalMessages = 0;

  for (const session of TOPIC_SESSIONS) {
    const sessionId = uuidv4();
    const messages = [];

    for (const item of session.timeline) {
      const userTime = timestampDaysAgo(item.daysAgo, 9 + Math.floor(Math.random() * 6), Math.floor(Math.random() * 50));
      const assistantTime = new Date(new Date(userTime).getTime() + 60 * 1000).toISOString();
      messages.push({ role: 'user', content: item.user, createdAt: userTime });
      messages.push({ role: 'assistant', content: item.assistant, createdAt: assistantTime });
    }

    const createdAt = messages[0].createdAt;
    const updatedAt = messages[messages.length - 1].createdAt;

    insertSession({ id: sessionId, title: session.title, createdAt, updatedAt });

    for (const message of messages) {
      insertMessage({ id: uuidv4(), sessionId, role: message.role, content: message.content, createdAt: message.createdAt });
      totalMessages += 1;
    }
  }

  console.log(`\n✅ Seeded ${TOPIC_SESSIONS.length} topic cloud demo sessions with ${totalMessages} messages.`);
  console.log('Use the History Explorer to view these Smart Topics.');
  console.log('To clear them, delete sessions titled "TOPIC CLOUD DEMO — …" or rerun this script.');
}

try {
  seed();
} catch (error) {
  console.error('Seeding topic cloud demo failed:', error.message);
  process.exit(1);
} finally {
  db.close();
}
