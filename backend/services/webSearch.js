import fetch from 'node-fetch';
import logger from '../utils/logger.js';

/**
 * Web Search Service
 * Supports Tavily and Serper APIs
 */

const TAVILY_API_KEY = process.env.TAVILY_API_KEY;
const SERPER_API_KEY = process.env.SERPER_API_KEY;

/**
 * Search the web using Tavily API
 * @param {string} query - Search query
 * @param {object} options - Search options
 * @returns {Promise<Array>} - Search results
 */
async function searchWithTavily(query, options = {}) {
  if (!TAVILY_API_KEY) {
    throw new Error('TAVILY_API_KEY not configured');
  }

  const {
    maxResults = 5,
    searchDepth = 'basic', // 'basic' or 'advanced'
    includeAnswer = true
  } = options;

  try {
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        api_key: TAVILY_API_KEY,
        query,
        max_results: maxResults,
        search_depth: searchDepth,
        include_answer: includeAnswer,
        include_raw_content: false
      })
    });

    if (!response.ok) {
      throw new Error(`Tavily API error: ${response.statusText}`);
    }

    const data = await response.json();
    
    return {
      answer: data.answer || null,
      results: data.results.map(r => ({
        title: r.title,
        url: r.url,
        content: r.content,
        score: r.score
      }))
    };
  } catch (error) {
    logger.error('Tavily search error:', error);
    throw error;
  }
}

/**
 * Search the web using Serper API
 * @param {string} query - Search query
 * @param {object} options - Search options
 * @returns {Promise<Array>} - Search results
 */
async function searchWithSerper(query, options = {}) {
  if (!SERPER_API_KEY) {
    throw new Error('SERPER_API_KEY not configured');
  }

  const { maxResults = 5 } = options;

  try {
    const response = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': SERPER_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        q: query,
        num: maxResults
      })
    });

    if (!response.ok) {
      throw new Error(`Serper API error: ${response.statusText}`);
    }

    const data = await response.json();
    
    return {
      answer: data.answerBox?.answer || null,
      results: (data.organic || []).map(r => ({
        title: r.title,
        url: r.link,
        content: r.snippet,
        score: r.position
      }))
    };
  } catch (error) {
    logger.error('Serper search error:', error);
    throw error;
  }
}

/**
 * Perform web search (automatically chooses available provider)
 * @param {string} query - Search query
 * @param {object} options - Search options
 * @returns {Promise<object>} - Search results
 */
export async function webSearch(query, options = {}) {
  try {
    logger.info(`Web search: "${query}"`);
    
    // Try Tavily first if available
    if (TAVILY_API_KEY) {
      return await searchWithTavily(query, options);
    }
    
    // Fall back to Serper
    if (SERPER_API_KEY) {
      return await searchWithSerper(query, options);
    }
    
    throw new Error('No web search API configured. Set TAVILY_API_KEY or SERPER_API_KEY in .env');
  } catch (error) {
    logger.error('Web search error:', error);
    throw error;
  }
}

/**
 * Format search results for LLM context
 * @param {object} searchResults - Results from webSearch
 * @returns {string} - Formatted context
 */
export function formatSearchResults(searchResults) {
  const parts = ['=== WEB SEARCH RESULTS ===\n'];
  
  if (searchResults.answer) {
    parts.push(`Quick Answer: ${searchResults.answer}\n`);
  }
  
  searchResults.results.forEach((result, index) => {
    parts.push(`[${index + 1}] ${result.title}`);
    parts.push(`URL: ${result.url}`);
    parts.push(`${result.content}\n`);
  });
  
  return parts.join('\n');
}

export default {
  webSearch,
  formatSearchResults
};
