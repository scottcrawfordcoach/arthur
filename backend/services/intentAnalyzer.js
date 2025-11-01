import OpenAI from 'openai';
import logger from '../utils/logger.js';

// Lazy initialization
let openai = null;
function getOpenAI() {
  if (!openai) {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }
  return openai;
}

/**
 * Analyze user query intent to determine appropriate knowledge tier routing
 * @param {string} userMessage - The user's query
 * @param {object} conversationContext - Recent conversation history
 * @returns {Promise<object>} - Intent analysis with tier priorities
 */
export async function analyzeIntent(userMessage, conversationContext = {}) {
  try {
    const { recentMessages = [], hasWellnessActivity = false } = conversationContext;
    
    // Build conversation context for intent analysis
    const contextMessages = recentMessages
      .slice(-3) // Last 3 messages
      .map(msg => `${msg.role}: ${msg.content.substring(0, 200)}`)
      .join('\n');
    
    const systemPrompt = `Analyze the user's query to determine which knowledge tiers should be searched and in what priority.

Available knowledge tiers:
- core_knowledge: ICF coaching competencies, ethics, best practices (foundational reference)
- personal_journal: User's wellness logs, activities, journal entries (time-sensitive, personal)
- reference_library: Converted books, documents, resources (educational reference)
- archive: Historical conversations and summaries (context/continuity)

Also identify query intent categories:
- coaching: Seeking coaching response, reflection, guidance
- wellness: Activity logging, health tracking, fitness questions
- research: Looking for information from books/documents
- personal: Asking about past conversations or personal history
- general: General questions or casual conversation

Also determine if web search is needed:
- Web search is for CURRENT/LATEST information not in the knowledge base
- Examples: news, weather, prices, recent events, "what's happening", "latest"
- NOT needed for: personal data, book content, coaching principles, past conversations

Return JSON with:
{
  "primary_intent": "string (coaching|wellness|research|personal|general)",
  "tier_priorities": ["tier1", "tier2", ...],
  "include_recent_context": boolean,
  "time_weight_journal": boolean,
  "needs_web_search": boolean,
  "web_search_priority": "primary|fallback|none",
  "web_search_reasoning": "why web search is/isn't needed",
  "confidence": "high|medium|low",
  "reasoning": "brief explanation"
}`;

    const userPrompt = `Current message: "${userMessage}"

${contextMessages ? `Recent conversation:\n${contextMessages}` : ''}
${hasWellnessActivity ? '\nNote: User has recent wellness activity logged.' : ''}

Analyze this query and return the JSON response.`;

    const response = await getOpenAI().chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' }
    });

    const analysis = JSON.parse(response.choices[0].message.content);
    
    logger.info(`Intent analysis - Primary: ${analysis.primary_intent}, Tiers: ${analysis.tier_priorities.join(', ')}`);
    
    return analysis;
  } catch (error) {
    logger.error('Intent analysis error:', error);
    
    // Fallback to basic pattern matching
    return fallbackIntentAnalysis(userMessage);
  }
}

/**
 * Fallback intent analysis using pattern matching
 * @param {string} userMessage - User's query
 * @returns {object} - Basic intent analysis
 */
function fallbackIntentAnalysis(userMessage) {
  const lower = userMessage.toLowerCase();
  
  // Wellness/activity patterns
  const wellnessKeywords = ['ran', 'run', 'bike', 'swim', 'workout', 'exercise', 'sleep', 'ate', 'meal'];
  const isWellness = wellnessKeywords.some(kw => lower.includes(kw));
  
  // Research/book patterns
  const researchKeywords = ['book', 'according to', 'what does', 'research', 'study', 'theory'];
  const isResearch = researchKeywords.some(kw => lower.includes(kw));
  
  // Personal history patterns
  const personalKeywords = ['we talked about', 'you said', 'remember when', 'last time'];
  const isPersonal = personalKeywords.some(kw => lower.includes(kw));
  
  // Coaching patterns
  const coachingKeywords = ['should i', 'what do you think', 'help me', 'advice', 'struggling'];
  const isCoaching = coachingKeywords.some(kw => lower.includes(kw));
  
  // Web search indicators
  const webSearchKeywords = ['latest', 'current', 'recent', 'news', 'today', 'now', 'weather', 'price', 'what is happening'];
  const needsWebSearch = webSearchKeywords.some(kw => lower.includes(kw));
  
  // Determine primary intent
  let primary_intent = 'general';
  let tier_priorities = ['core_knowledge', 'reference_library'];
  let web_search_priority = 'none';
  
  if (isWellness) {
    primary_intent = 'wellness';
    tier_priorities = ['personal_journal', 'core_knowledge'];
    web_search_priority = 'none'; // Personal data only
  } else if (isResearch) {
    primary_intent = 'research';
    tier_priorities = ['reference_library', 'core_knowledge'];
    web_search_priority = needsWebSearch ? 'primary' : 'fallback';
  } else if (isPersonal) {
    primary_intent = 'personal';
    tier_priorities = ['archive', 'personal_journal'];
    web_search_priority = 'none'; // Looking at history
  } else if (isCoaching) {
    primary_intent = 'coaching';
    tier_priorities = ['core_knowledge', 'personal_journal'];
    web_search_priority = 'none'; // Coaching is timeless
  } else if (needsWebSearch) {
    web_search_priority = 'primary'; // Current info needed
  }
  
  return {
    primary_intent,
    tier_priorities,
    include_recent_context: isPersonal || isCoaching,
    time_weight_journal: isWellness,
    needs_web_search: needsWebSearch || web_search_priority !== 'none',
    web_search_priority,
    web_search_reasoning: needsWebSearch ? 'Query contains current/latest indicators' : 'No real-time info needed',
    confidence: 'low',
    reasoning: 'Fallback pattern matching'
  };
}

/**
 * Quick heuristic-based intent detection (faster than LLM call)
 * @param {string} userMessage - User's query
 * @returns {object} - Quick intent classification
 */
export function quickIntentCheck(userMessage) {
  const lower = userMessage.toLowerCase();
  
  // Quick checks for obvious cases
  const patterns = {
    wellness: /\b(ran|run|bike|swim|workout|exercise|sleep|slept|ate|meal|walked|yoga|climbed)\b/i,
    research: /\b(book|chapter|according to|what does .* say|research shows|study found)\b/i,
    personal: /\b(we talked|you said|remember when|last time|earlier)\b/i,
    coaching: /\b(should i|what do you think|help me|advice|struggling|feeling|feel like)\b/i
  };
  
  for (const [intent, pattern] of Object.entries(patterns)) {
    if (pattern.test(userMessage)) {
      return { detected: true, intent, confidence: 'high' };
    }
  }
  
  return { detected: false, intent: 'general', confidence: 'low' };
}

export default {
  analyzeIntent,
  quickIntentCheck
};
