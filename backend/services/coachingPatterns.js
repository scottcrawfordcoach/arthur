// Copyright (c) 2025 Scott Crawford. All rights reserved.

/**
 * Coaching Response Patterns for Wellness & Fitness Logs
 * 
 * When the assistant detects wellness/fitness activity logs, it should:
 * - Acknowledge the effort warmly
 * - Prompt for experiential/qualitative data
 * - Connect to patterns and trends
 * - Encourage reflection without being pushy
 */

import { query } from './db.js';
import logger from '../utils/logger.js';

/**
 * Detect if a message contains wellness/fitness activity logging
 */
export function detectActivityLog(messageText) {
  const lowercaseText = messageText.toLowerCase();
  
  // Activity type keywords
  const activityKeywords = [
    'ran', 'run', 'jog', 'jogged',
    'rode', 'bike', 'biked', 'cycling', 'cycled',
    'swim', 'swam', 'swimming',
    'walked', 'walk', 'hiking', 'hiked',
    'workout', 'worked out', 'trained', 'training',
    'lifted', 'weights', 'gym',
    'yoga', 'stretching', 'pilates',
    'climbed', 'climbing'
  ];
  
  // Time/distance indicators
  const quantitativeIndicators = [
    'miles', 'km', 'kilometers', 'minutes', 'hours',
    'meters', 'feet', 'laps', 'reps', 'sets',
    'pace', 'speed', 'bpm', 'heart rate', 'hr'
  ];
  
  // Logging phrases
  const loggingPhrases = [
    'log ', 'record ', 'track ',
    'this morning', 'today i', 'yesterday i',
    'just finished', 'completed',
    'did a ', 'went for'
  ];
  
  const hasActivity = activityKeywords.some(keyword => lowercaseText.includes(keyword));
  const hasMetrics = quantitativeIndicators.some(indicator => lowercaseText.includes(indicator));
  const hasLoggingIntent = loggingPhrases.some(phrase => lowercaseText.includes(phrase));
  
  // Strong match: activity + (metrics OR logging intent)
  if (hasActivity && (hasMetrics || hasLoggingIntent)) {
    return {
      detected: true,
      confidence: 'high',
      activityType: inferActivityType(lowercaseText),
      hasQuantitativeData: hasMetrics,
      suggestedPrompts: generateCoachingPrompts(lowercaseText)
    };
  }
  
  // Weak match: just activity mention
  if (hasActivity) {
    return {
      detected: true,
      confidence: 'low',
      activityType: inferActivityType(lowercaseText),
      hasQuantitativeData: hasMetrics,
      suggestedPrompts: []
    };
  }
  
  return { detected: false };
}

/**
 * Infer the type of activity from text
 */
function inferActivityType(text) {
  if (/\b(ran|run|jog|running|jogging)\b/.test(text)) return 'running';
  if (/\b(bike|biked|cycling|cycled|rode)\b/.test(text)) return 'cycling';
  if (/\b(swim|swam|swimming)\b/.test(text)) return 'swimming';
  if (/\b(walk|walked|hiking|hiked)\b/.test(text)) return 'walking';
  if (/\b(yoga|stretching|pilates)\b/.test(text)) return 'flexibility';
  if (/\b(lifted|weights|gym|strength)\b/.test(text)) return 'strength';
  if (/\b(climb|climbing|bouldering)\b/.test(text)) return 'climbing';
  return 'general';
}

/**
 * Generate coaching prompts based on activity context
 */
function generateCoachingPrompts(text) {
  const prompts = [];
  
  // RPE (Rate of Perceived Exertion) prompt
  if (!text.includes('felt') && !text.includes('easy') && !text.includes('hard')) {
    prompts.push({
      type: 'rpe',
      prompt: "How did it feel? (Easy, moderate, challenging?)",
      field: 'rpe',
      category: 'effort'
    });
  }
  
  // Mood/emotional state
  if (!text.includes('mood') && !text.includes('happy') && !text.includes('tired')) {
    prompts.push({
      type: 'mood',
      prompt: "How was your mood during the activity?",
      field: 'mood',
      category: 'emotional'
    });
  }
  
  // Energy level
  if (!text.includes('energy') && !text.includes('energized') && !text.includes('drained')) {
    prompts.push({
      type: 'energy',
      prompt: "How's your energy level now?",
      field: 'energy_level',
      category: 'physical'
    });
  }
  
  // Context/notes
  if (text.length < 100) {
    prompts.push({
      type: 'context',
      prompt: "Anything else worth noting about this session?",
      field: 'user_comment',
      category: 'context'
    });
  }
  
  return prompts;
}

/**
 * Generate a coaching-style response to activity log
 */
export function generateCoachingResponse(detection, userMessage, recentActivities = []) {
  const { activityType, hasQuantitativeData, suggestedPrompts } = detection;
  
  // Build acknowledgment
  let response = '';
  
  // Warm acknowledgment based on activity type
  const acknowledgments = {
    running: ["Nice run! 🏃", "Great job getting out there! 🏃", "Love seeing you on the roads/trails! 🏃"],
    cycling: ["Solid ride! 🚴", "Nice work on the bike! 🚴", "Great cycling session! 🚴"],
    swimming: ["Great swim! 🏊", "Nice time in the pool! 🏊", "Excellent swim session! 🏊"],
    walking: ["Good walk! 🚶", "Nice to get moving! 🚶", "Great walk! 🚶"],
    strength: ["Strong work! 💪", "Nice lifting session! 💪", "Great strength training! 💪"],
    flexibility: ["Good session! 🧘", "Nice work on flexibility! 🧘", "Great practice! 🧘"],
    general: ["Nice work! 💪", "Great session! 👍", "Good job getting it done! ✨"]
  };
  
  const acks = acknowledgments[activityType] || acknowledgments.general;
  response += acks[Math.floor(Math.random() * acks.length)];
  
  // If they provided quantitative data, acknowledge it
  if (hasQuantitativeData) {
    response += " I've got the metrics logged.";
  }
  
  // Add coaching prompts (pick 1-2 most relevant)
  if (suggestedPrompts.length > 0) {
    response += "\n\n";
    
    // Prioritize: RPE > Mood > Energy > Context
    const priorityOrder = ['rpe', 'mood', 'energy', 'context'];
    const sortedPrompts = suggestedPrompts.sort((a, b) => {
      return priorityOrder.indexOf(a.type) - priorityOrder.indexOf(b.type);
    });
    
    // Include 1-2 prompts
    const selectedPrompts = sortedPrompts.slice(0, 2);
    
    if (selectedPrompts.length === 1) {
      response += selectedPrompts[0].prompt;
    } else if (selectedPrompts.length === 2) {
      response += `${selectedPrompts[0].prompt} ${selectedPrompts[1].prompt}`;
    }
  }
  
  // Check for patterns if we have recent data
  if (recentActivities.length > 0) {
    const pattern = detectPattern(activityType, recentActivities);
    if (pattern) {
      response += `\n\n${pattern}`;
    }
  }
  
  return response;
}

/**
 * Detect patterns in recent activities
 */
function detectPattern(activityType, recentActivities) {
  // Filter to same activity type
  const sameType = recentActivities.filter(a => 
    a.activity_type === activityType || 
    (a.name && a.name.toLowerCase().includes(activityType))
  );
  
  if (sameType.length >= 2) {
    const latest = sameType[0];
    const previous = sameType[1];
    
    // Compare distances
    if (latest.distance_m && previous.distance_m) {
      const diff = latest.distance_m - previous.distance_m;
      const percentChange = (diff / previous.distance_m) * 100;
      
      if (percentChange > 10) {
        return `📈 Nice progression - that's ${Math.round(percentChange)}% longer than last time!`;
      }
    }
    
    // Frequency pattern
    const daysSinceLast = Math.floor(
      (new Date(latest.started_at) - new Date(previous.started_at)) / (1000 * 60 * 60 * 24)
    );
    
    if (daysSinceLast <= 2 && sameType.length >= 3) {
      return `🔥 You're building a solid consistency streak with ${activityType}!`;
    }
  }
  
  return null;
}

/**
 * Get system prompt modification for coaching mode
 */
export function getCoachingModePrompt() {
  return `
You are in COACHING MODE. The user has logged a wellness/fitness activity.

Your response style should be:
- Warm and encouraging (but not over-the-top)
- Curious about their subjective experience
- Focused on how they FELT, not just what they DID
- Supportive without being pushy

Ask about:
- Perceived exertion (how hard did it feel?)
- Mood and energy levels
- Notable observations or reflections
- Physical sensations (good pain vs bad pain, energy, recovery)

DON'T:
- Lecture or give unsolicited advice
- Be overly enthusiastic (no excessive emojis)
- Make assumptions about their goals
- Push for more data if they seem brief

DO:
- Validate their effort
- Show genuine curiosity
- Connect to patterns when relevant
- Encourage reflection naturally
`;
}

/**
 * Check if recent activities exist for pattern detection
 */
export async function getRecentActivities(userId = 'default', limit = 10) {
  try {
    const activities = query(`
      SELECT * FROM activities
      WHERE user_id = ?
      ORDER BY started_at DESC
      LIMIT ?
    `, [userId, limit]);
    
    return activities || [];
  } catch (error) {
    logger.error('Error fetching recent activities:', error);
    return [];
  }
}

export default {
  detectActivityLog,
  generateCoachingResponse,
  getCoachingModePrompt,
  getRecentActivities
};
