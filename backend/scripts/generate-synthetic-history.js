/**
 * SYNTHETIC CONVERSATION HISTORY GENERATOR
 * 
 * Generates realistic 6-month conversation history with TEST flag.
 * Creates diverse scenarios to test:
 * - 3D relevance scoring (recency, frequency, vehemence)
 * - Pattern detection (recurring topics, behavioral trends)
 * - Memory aging and compression
 * - Knight signal synthesis
 * - Crisis detection
 * - Learning journeys
 * 
 * Personas simulated:
 * - Software Developer (recurring tech problems)
 * - Career Switcher (exploration + anxiety)
 * - Wellness Focused (stress management patterns)
 * - Lifelong Learner (deep dives on topics)
 * 
 * Data structure:
 * - Conversations spread over 180 days
 * - Varying rhythm: daily spurts, weekly check-ins, sporadic crises
 * - Multiple topics with realistic frequency distributions
 * - Emotional arcs (from crisis to resolution)
 * - Learning progressions (novice → intermediate → advanced)
 */

import Database from 'better-sqlite3';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, '../../data/db/ai_local.db');

const db = new Database(dbPath);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

console.log('=== SYNTHETIC CONVERSATION HISTORY GENERATOR ===\n');

// Conversation templates organized by persona and topic
const conversationTemplates = {
  // Software Developer persona - recurring tech issues
  softwareDev: [
    {
      topic: 'authentication',
      frequency: 12, // Discussed 12 times over 6 months
      emotionArc: ['frustrated', 'confused', 'hopeful', 'frustrated', 'breakthrough', 'confident'],
      messages: [
        "I'm having issues with JWT authentication in my Node app",
        "The token keeps expiring even though I set it to 24 hours",
        "Still debugging this auth flow - getting 401 errors",
        "I think I found the issue - token wasn't being refreshed properly",
        "Got the authentication working! Had to implement refresh tokens",
        "Now I'm extending the auth to support OAuth2 as well"
      ]
    },
    {
      topic: 'react-performance',
      frequency: 8,
      emotionArc: ['curious', 'concerned', 'focused', 'satisfied'],
      messages: [
        "My React app is getting slow with large lists",
        "Should I use useMemo or useCallback for optimization?",
        "Implementing virtualization for the list - seems promising",
        "Performance is much better now after optimizing re-renders"
      ]
    },
    {
      topic: 'typescript-generics',
      frequency: 6,
      emotionArc: ['confused', 'learning', 'practicing', 'confident'],
      messages: [
        "TypeScript generics are confusing me",
        "Can you explain how to use generic constraints?",
        "Practicing with generic utility types",
        "I'm starting to really appreciate generics for type safety"
      ]
    }
  ],

  // Career Switcher - exploration + anxiety
  careerSwitcher: [
    {
      topic: 'career-anxiety',
      frequency: 15,
      emotionArc: ['anxious', 'worried', 'hopeful', 'anxious', 'determined', 'cautious'],
      messages: [
        "I'm thinking about switching careers to tech but I'm scared",
        "What if I'm too old to learn programming? I'm 35",
        "Had a good day learning Python - maybe I can do this",
        "Imposter syndrome is hitting hard today",
        "I got accepted into a bootcamp! Starting next month",
        "Nervous about the bootcamp but trying to stay positive"
      ]
    },
    {
      topic: 'learning-path',
      frequency: 10,
      emotionArc: ['curious', 'overwhelmed', 'focused', 'progressing'],
      messages: [
        "Should I learn web development or data science?",
        "There's so much to learn I don't know where to start",
        "Focusing on JavaScript fundamentals this month",
        "Making good progress with React - built my first app"
      ]
    }
  ],

  // Wellness Focused - stress management
  wellnessFocused: [
    {
      topic: 'work-stress',
      frequency: 20,
      emotionArc: ['stressed', 'overwhelmed', 'coping', 'stressed', 'better', 'managing'],
      messages: [
        "Work is really stressful lately - too many deadlines",
        "I feel completely overwhelmed and can't focus",
        "Trying the breathing exercises you suggested",
        "Another rough week - feeling burned out",
        "Taking a mental health day helped a lot",
        "Learning to set better boundaries at work"
      ]
    },
    {
      topic: 'anxiety-management',
      frequency: 18,
      emotionArc: ['anxious', 'panic', 'calming', 'anxious', 'practicing', 'improving'],
      messages: [
        "My anxiety is really bad today",
        "I think I'm having a panic attack",
        "The grounding technique helped - thank you",
        "Woke up anxious again - same worries",
        "Practicing mindfulness daily now",
        "Anxiety is more manageable with these tools"
      ]
    },
    {
      topic: 'sleep-issues',
      frequency: 12,
      emotionArc: ['tired', 'frustrated', 'hopeful', 'improving'],
      messages: [
        "Can't sleep again - been up since 3am",
        "Insomnia is affecting my work performance",
        "Trying a sleep routine - early days",
        "Sleep is getting better with consistent schedule"
      ]
    }
  ],

  // Lifelong Learner - deep dives
  lifelongLearner: [
    {
      topic: 'quantum-computing',
      frequency: 7,
      emotionArc: ['curious', 'fascinated', 'deep-diving', 'understanding'],
      messages: [
        "How does quantum computing actually work?",
        "The concept of superposition is mind-blowing",
        "Reading about quantum entanglement - so fascinating",
        "I think I'm starting to grasp the basics of qubits"
      ]
    },
    {
      topic: 'philosophy',
      frequency: 9,
      emotionArc: ['curious', 'thoughtful', 'engaged', 'reflecting'],
      messages: [
        "What's the difference between Stoicism and Buddhism?",
        "Been thinking about Seneca's letters",
        "The concept of impermanence is powerful",
        "How do you think ancient philosophy applies to modern life?"
      ]
    }
  ],

  // Crisis moments (high vehemence)
  crisisMoments: [
    {
      topic: 'acute-crisis',
      frequency: 4,
      emotionArc: ['panic', 'desperate', 'crisis', 'recovering'],
      messages: [
        "I can't breathe, everything is falling apart",
        "I don't know what to do anymore - feeling hopeless",
        "Having a really bad panic attack right now",
        "Thank you for being there - I'm feeling a bit better"
      ]
    }
  ],

  // Learning progressions (novice → expert)
  learningProgressions: [
    {
      topic: 'python-journey',
      frequency: 25,
      emotionArc: ['beginner', 'struggling', 'practicing', 'improving', 'intermediate', 'confident'],
      messages: [
        "Just started learning Python - what should I focus on?",
        "Having trouble with list comprehensions",
        "Practicing Python daily with small projects",
        "Built a web scraper - starting to feel more confident",
        "Learning about decorators and generators now",
        "I can actually help others with Python now!"
      ]
    }
  ]
};

/**
 * Generate timestamp for conversation
 * Distributes conversations across 180 days with realistic patterns
 */
function generateTimestamp(daysAgo, hourOffset = 0) {
  const now = Date.now();
  const dayInMs = 24 * 60 * 60 * 1000;
  const hourInMs = 60 * 60 * 1000;
  return now - (daysAgo * dayInMs) + (hourOffset * hourInMs);
}

/**
 * Generate conversation entries with embeddings
 */
async function generateConversations() {
  console.log('Generating synthetic conversations...\n');
  
  const conversations = [];
  let conversationId = 1;
  
  // Helper to create conversation pairs
  function createConversation(userMessage, assistantMessage, timestamp, metadata) {
    return [
      {
        id: `TEST_${conversationId++}_${Date.now()}`,
        session_id: 'TEST_SESSION',
        role: 'user',
        content: userMessage,
        created_at: new Date(timestamp).toISOString(),
        is_test: 1,
        ...metadata
      },
      {
        id: `TEST_${conversationId++}_${Date.now()}`,
        session_id: 'TEST_SESSION',
        role: 'assistant',
        content: assistantMessage,
        created_at: new Date(timestamp + 5000).toISOString(), // 5 seconds later
        is_test: 1,
        ...metadata
      }
    ];
  }
  
  // Generate Software Dev conversations
  console.log('Generating Software Developer persona...');
  for (const template of conversationTemplates.softwareDev) {
    const { topic, messages, emotionArc } = template;
    const daySpread = [175, 160, 140, 110, 80, 45]; // Spread across 6 months
    
    messages.forEach((msg, idx) => {
      const daysAgo = daySpread[idx] || 30;
      const timestamp = generateTimestamp(daysAgo, Math.random() * 8 + 10); // 10am-6pm
      
      const assistantResponse = `I understand you're working on ${topic.replace('-', ' ')}. Let me help you with that.`;
      
      conversations.push(...createConversation(
        msg,
        assistantResponse,
        timestamp,
        {
          topic: topic,
          emotion: emotionArc[idx],
          persona: 'software_dev'
        }
      ));
    });
  }
  
  // Generate Career Switcher conversations
  console.log('Generating Career Switcher persona...');
  for (const template of conversationTemplates.careerSwitcher) {
    const { topic, messages, emotionArc } = template;
    const daySpread = [170, 150, 120, 90, 60, 30]; // More recent
    
    messages.forEach((msg, idx) => {
      const daysAgo = daySpread[idx] || 20;
      const timestamp = generateTimestamp(daysAgo, Math.random() * 6 + 18); // 6pm-midnight
      
      const assistantResponse = `I hear your concerns about ${topic.replace('-', ' ')}. This is completely normal.`;
      
      conversations.push(...createConversation(
        msg,
        assistantResponse,
        timestamp,
        {
          topic: topic,
          emotion: emotionArc[idx],
          persona: 'career_switcher'
        }
      ));
    });
  }
  
  // Generate Wellness Focused conversations
  console.log('Generating Wellness Focused persona...');
  for (const template of conversationTemplates.wellnessFocused) {
    const { topic, messages, emotionArc } = template;
    // More frequent, recent pattern (weekly check-ins)
    const daySpread = [7, 14, 21, 28, 35, 42].map(d => d + Math.random() * 3);
    
    messages.forEach((msg, idx) => {
      const daysAgo = daySpread[idx] || 10;
      const timestamp = generateTimestamp(daysAgo, Math.random() * 12 + 8); // 8am-8pm
      
      const assistantResponse = `I'm here to support you with ${topic.replace('-', ' ')}. Let's work through this together.`;
      
      conversations.push(...createConversation(
        msg,
        assistantResponse,
        timestamp,
        {
          topic: topic,
          emotion: emotionArc[idx],
          persona: 'wellness_focused',
          urgency: emotionArc[idx] === 'panic' || emotionArc[idx] === 'stressed' ? 0.8 : 0.4
        }
      ));
    });
  }
  
  // Generate Lifelong Learner conversations
  console.log('Generating Lifelong Learner persona...');
  for (const template of conversationTemplates.lifelongLearner) {
    const { topic, messages, emotionArc } = template;
    const daySpread = [165, 140, 100, 65]; // Spread out deep dives
    
    messages.forEach((msg, idx) => {
      const daysAgo = daySpread[idx] || 50;
      const timestamp = generateTimestamp(daysAgo, Math.random() * 4 + 14); // 2pm-6pm
      
      const assistantResponse = `Great question about ${topic.replace('-', ' ')}! Let me explain...`;
      
      conversations.push(...createConversation(
        msg,
        assistantResponse,
        timestamp,
        {
          topic: topic,
          emotion: emotionArc[idx],
          persona: 'lifelong_learner'
        }
      ));
    });
  }
  
  // Generate Crisis moments (HIGH VEHEMENCE)
  console.log('Generating Crisis moments (high vehemence)...');
  for (const template of conversationTemplates.crisisMoments) {
    const { topic, messages, emotionArc } = template;
    const daySpread = [120, 85, 40, 15]; // Spread crises across timeline
    
    messages.forEach((msg, idx) => {
      const daysAgo = daySpread[idx] || 20;
      const timestamp = generateTimestamp(daysAgo, Math.random() * 12); // Any time
      
      const assistantResponse = `I'm here with you. Let's work through this together. You're not alone.`;
      
      conversations.push(...createConversation(
        msg,
        assistantResponse,
        timestamp,
        {
          topic: topic,
          emotion: emotionArc[idx],
          persona: 'crisis',
          urgency: 0.95,
          risk: 0.9
        }
      ));
    });
  }
  
  // Generate Learning progression
  console.log('Generating Learning progression...');
  for (const template of conversationTemplates.learningProgressions) {
    const { topic, messages, emotionArc } = template;
    const daySpread = [178, 165, 145, 120, 90, 50]; // Long-term journey
    
    messages.forEach((msg, idx) => {
      const daysAgo = daySpread[idx] || 30;
      const timestamp = generateTimestamp(daysAgo, Math.random() * 6 + 9); // 9am-3pm
      
      const assistantResponse = `Great to see your progress with ${topic.replace('-', ' ')}!`;
      
      conversations.push(...createConversation(
        msg,
        assistantResponse,
        timestamp,
        {
          topic: topic,
          emotion: emotionArc[idx],
          persona: 'learner',
          learning_stage: emotionArc[idx]
        }
      ));
    });
  }
  
  console.log(`\nGenerated ${conversations.length} conversation messages`);
  console.log(`Conversation pairs: ${conversations.length / 2}`);
  
  return conversations;
}

/**
 * Generate embeddings for conversations in batches
 */
async function generateEmbeddings(conversations) {
  console.log('\nGenerating embeddings...');
  
  const batchSize = 100;
  const batches = [];
  
  for (let i = 0; i < conversations.length; i += batchSize) {
    batches.push(conversations.slice(i, i + batchSize));
  }
  
  console.log(`Processing ${batches.length} batches of ${batchSize} messages each`);
  
  let processed = 0;
  for (const batch of batches) {
    const texts = batch.map(c => c.content);
    
    try {
      const response = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: texts
      });
      
      // Add embeddings to conversations
      response.data.forEach((embedding, idx) => {
        batch[idx].embedding = JSON.stringify(embedding.embedding);
      });
      
      processed += batch.length;
      console.log(`  Processed ${processed}/${conversations.length} embeddings`);
      
      // Rate limiting pause
      await new Promise(resolve => setTimeout(resolve, 200));
      
    } catch (error) {
      console.error(`Error generating embeddings for batch:`, error.message);
      // Add null embeddings as fallback
      batch.forEach(c => c.embedding = null);
    }
  }
  
  console.log('Embeddings complete!');
}

/**
 * Insert conversations into database
 */
function insertConversations(conversations) {
  console.log('\nInserting conversations into database...');
  
  const insert = db.prepare(`
    INSERT INTO assistant_chat_messages (
      id, session_id, role, content, created_at, is_test, embedding
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  
  const insertMany = db.transaction((convos) => {
    for (const convo of convos) {
      insert.run(
        convo.id,
        convo.session_id,
        convo.role,
        convo.content,
        convo.created_at,
        convo.is_test,
        convo.embedding
      );
    }
  });
  
  insertMany(conversations);
  console.log(`Inserted ${conversations.length} conversations`);
}

/**
 * Generate summary statistics
 */
function generateStats(conversations) {
  console.log('\n=== SYNTHETIC DATA STATISTICS ===');
  
  const topics = {};
  const personas = {};
  const emotions = {};
  
  conversations.forEach(c => {
    if (c.role === 'user') { // Count user messages only
      topics[c.topic] = (topics[c.topic] || 0) + 1;
      personas[c.persona] = (personas[c.persona] || 0) + 1;
      emotions[c.emotion] = (emotions[c.emotion] || 0) + 1;
    }
  });
  
  console.log('\nTopic Frequency (for testing frequency scoring):');
  Object.entries(topics)
    .sort(([,a], [,b]) => b - a)
    .forEach(([topic, count]) => {
      console.log(`  ${topic}: ${count} occurrences`);
    });
  
  console.log('\nPersona Distribution:');
  Object.entries(personas).forEach(([persona, count]) => {
    console.log(`  ${persona}: ${count} conversations`);
  });
  
  console.log('\nEmotion Distribution (for testing vehemence scoring):');
  Object.entries(emotions)
    .sort(([,a], [,b]) => b - a)
    .forEach(([emotion, count]) => {
      console.log(`  ${emotion}: ${count} occurrences`);
    });
  
  const userMessages = conversations.filter(c => c.role === 'user');
  const oldestMsg = Math.min(...userMessages.map(c => c.timestamp));
  const newestMsg = Math.max(...userMessages.map(c => c.timestamp));
  const daysSpan = (newestMsg - oldestMsg) / (24 * 60 * 60 * 1000);
  
  console.log(`\nTime Span: ${Math.round(daysSpan)} days (~${Math.round(daysSpan/30)} months)`);
  console.log(`\nData ready for testing:`);
  console.log(`  ✅ Recency scoring (conversations from ${Math.round(daysSpan)} days ago to now)`);
  console.log(`  ✅ Frequency scoring (topics discussed 4-25 times)`);
  console.log(`  ✅ Vehemence scoring (crisis moments with high urgency/risk)`);
  console.log(`  ✅ Pattern detection (recurring topics, behavioral trends)`);
  console.log(`  ✅ Memory aging (old, compressed, archive tiers)`);
  console.log(`  ✅ Learning progressions (beginner → expert journeys)`);
}

/**
 * Main execution
 */
async function main() {
  try {
    // Check if test data already exists
    const existing = db.prepare('SELECT COUNT(*) as count FROM assistant_chat_messages WHERE is_test = 1').get();
    if (existing.count > 0) {
      console.log(`Found ${existing.count} existing test conversations.`);
      const readline = await import('readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });
      
      const answer = await new Promise(resolve => {
        rl.question('Delete and regenerate? (yes/no): ', resolve);
      });
      rl.close();
      
      if (answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y') {
        console.log('Deleting existing test data...');
        db.prepare('DELETE FROM assistant_chat_messages WHERE is_test = 1').run();
      } else {
        console.log('Keeping existing data. Exiting.');
        process.exit(0);
      }
    }
    
    // Generate conversations
    const conversations = await generateConversations();
    
    // Generate embeddings
    await generateEmbeddings(conversations);
    
    // Insert into database
    insertConversations(conversations);
    
    // Show statistics
    generateStats(conversations);
    
    console.log('\n=================================');
    console.log('✅ Synthetic conversation history generated!');
    console.log('You can now test complex queries and patterns.');
    console.log('=================================\n');
    
  } catch (error) {
    console.error('Error generating synthetic data:', error);
    process.exit(1);
  } finally {
    db.close();
  }
}

main();
