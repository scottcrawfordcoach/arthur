/**
 * HERALD - External Research Service
 * 
 * Handles policy-bound web searches for the ARTHUR system.
 * Invoked only when Analysis Knight recommends external knowledge is needed.
 * 
 * Responsibilities:
 * 1. Sanitize search queries (remove personal information)
 * 2. Execute web search via Tavily API
 * 3. Summarize and validate results
 * 4. Tag results with provenance
 * 5. Enforce policy constraints (budgets, allowed domains, content filters)
 * 
 * Privacy First:
 * - Strips personal info before external search
 * - Logs all searches for audit
 * - Applies content filters
 * - Respects search budgets
 * 
 * Integration:
 * - Analysis Knight signals when to invoke
 * - Arthur uses results for final synthesis
 */

import OpenAI from 'openai';
import dotenv from 'dotenv';
import { policyLoader } from '../utils/policyLoader.js';

dotenv.config();

class Herald {
  constructor() {
    // Load Herald policy
    this.policy = policyLoader.getHeraldPolicy();
    console.log(`🔒 Herald initialized with policy version ${this.policy.version}`);
    
    // Tavily API for web search
    this.tavilyApiKey = process.env.TAVILY_API_KEY;
    this.tavilyApiUrl = 'https://api.tavily.com/search';
    
    // OpenAI for query sanitization and summarization
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    this.sanitizationModel = process.env.MODEL_FAST || 'gpt-4o-mini';
    this.summaryModel = process.env.MODEL_FAST || 'gpt-4o-mini';
    
    // Initialize search tracking
    this.dailySearchCount = 0;
    this.lastResetDate = new Date().toISOString().split('T')[0];
    
    // Metrics
    this.metrics = {
      totalSearches: 0,
      successfulSearches: 0,
      failedSearches: 0,
      sanitizedQueries: 0,
      blockedQueries: 0,
      avgSearchTime: 0,
      totalCost: 0 // Estimated cost
    };
    
    // Search history (for audit)
    this.searchHistory = [];
  }

  /**
   * MAIN ENTRY POINT: Execute web search with privacy and policy enforcement
   * 
   * @param {Object} searchRequest - From Analysis Knight
   * @returns {Promise<Object>} Search results with provenance
   */
  async search(searchRequest) {
    const startTime = Date.now();
    
    try {
      console.log('🔍 Herald executing search...');
      
      // 1. Check policy constraints
      const policyCheck = this.checkPolicy(searchRequest);
      if (!policyCheck.allowed) {
        console.log(`⛔ Search blocked: ${policyCheck.reason}`);
        return this.buildBlockedResponse(policyCheck.reason);
      }
      
      // 2. Sanitize query (remove personal information)
      let sanitizedQuery = searchRequest.query;
      if (this.policy.privacy.sanitize_queries) {
        sanitizedQuery = await this.sanitizeQuery(searchRequest.query);
        console.log(`🔒 Query sanitized: "${searchRequest.query}" → "${sanitizedQuery}"`);
      }
      
      // 3. Execute Tavily search
      const maxResults = searchRequest.maxResults || this.policy.tavily_integration.max_results;
      const searchResults = await this.executeTavilySearch(
        sanitizedQuery,
        searchRequest.searchDepth || this.policy.tavily_integration.search_depth,
        maxResults
      );
      
      // 4. Filter and validate results
      const filteredResults = this.filterResults(searchResults);
      
      // 5. Summarize results (if enabled)
      let summarizedResults = filteredResults;
      if (this.policy.result_processing.summarize_results) {
        summarizedResults = await this.summarizeResults(
          filteredResults,
          searchRequest.query
        );
      }
      
      // 6. Tag with provenance
      const taggedResults = this.tagProvenance(summarizedResults, searchRequest);
      
      // 7. Log search
      if (this.policy.audit.log_searches) {
        this.logSearch(searchRequest, sanitizedQuery, taggedResults);
      }
      
      const searchTime = Date.now() - startTime;
      this.updateMetrics(true, searchTime);
      
      console.log(`✅ Herald search complete: ${taggedResults.results.length} results in ${searchTime}ms`);
      
      return {
        success: true,
        originalQuery: searchRequest.query,
        sanitizedQuery,
        results: taggedResults.results,
        metadata: {
          searchTime,
          resultCount: taggedResults.results.length,
          source: 'tavily',
          timestamp: new Date().toISOString(),
          policyCompliant: true
        }
      };
      
    } catch (error) {
      const searchTime = Date.now() - startTime;
      this.updateMetrics(false, searchTime);
      
      console.error('❌ Herald search failed:', error.message);
      
      return {
        success: false,
        error: error.message,
        results: [],
        metadata: {
          searchTime,
          timestamp: new Date().toISOString()
        }
      };
    }
  }

  /**
   * Check if search request complies with policies
   */
  checkPolicy(searchRequest) {
    // 1. Check daily search limit
    this.resetDailyCountIfNeeded();
    const dailyLimit = this.policy.budgets.daily_search_limit;
    if (this.dailySearchCount >= dailyLimit) {
      this.metrics.blockedQueries++;
      return {
        allowed: false,
        reason: 'Daily search limit reached'
      };
    }
    
    // 2. Check for blocked keywords
    const query = searchRequest.query.toLowerCase();
    for (const keyword of this.policy.content_filtering.blocked_keywords) {
      if (query.includes(keyword.toLowerCase())) {
        this.metrics.blockedQueries++;
        return {
          allowed: false,
          reason: `Blocked keyword detected: ${keyword}`
        };
      }
    }
    
    // 3. Check allowlist mode (if enabled)
    if (this.policy.content_filtering.allowlist_mode && 
        this.policy.content_filtering.allowed_domains.length > 0) {
      // In allowlist mode, only searches for allowed domains are permitted
      // This is checked later during result filtering
    }
    
    return { allowed: true };
  }

  /**
   * Sanitize query to remove personal information
   * Uses LLM to rewrite query without PII
   */
  async sanitizeQuery(query) {
    if (!this.policy.privacy.sanitize_queries) {
      return query;
    }
    
    try {
      const piiCategories = this.policy.privacy.pii_categories.join(', ');
      const prompt = `Rewrite this search query to remove any personal information (${piiCategories}) while preserving the core search intent. If no personal info exists, return the query unchanged.

Original query: "${query}"

Sanitized query:`;
      
      const response = await this.openai.chat.completions.create({
        model: this.sanitizationModel,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 100,
        temperature: 0.3
      });
      
      const sanitized = response.choices[0].message.content.trim();
      this.metrics.sanitizedQueries++;
      
      return sanitized;
      
    } catch (error) {
      console.warn('Query sanitization failed, using original:', error.message);
      return query; // Fallback to original if sanitization fails
    }
  }

  /**
   * Execute Tavily web search
   */
  async executeTavilySearch(query, searchDepth = 'basic', maxResults = 5) {
    try {
      if (!this.tavilyApiKey) {
        throw new Error('TAVILY_API_KEY not configured');
      }
      
      const requestBody = {
        api_key: this.tavilyApiKey,
        query: query,
        search_depth: searchDepth, // 'basic' or 'advanced'
        max_results: maxResults,
        include_answer: true,
        include_raw_content: false
      };
      
      const response = await fetch(this.tavilyApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });
      
      if (!response.ok) {
        throw new Error(`Tavily API error: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Increment daily search count
      this.dailySearchCount++;
      
      return data;
      
    } catch (error) {
      console.error('Tavily search failed:', error.message);
      throw error;
    }
  }

  /**
   * Filter results based on policy
   */
  filterResults(searchResults) {
    if (!searchResults.results) {
      return [];
    }
    
    return searchResults.results.filter(result => {
      // 1. Check domain blocklist
      try {
        const url = new URL(result.url);
        const domain = url.hostname;
        
        if (this.policy.content_filtering.blocked_domains.some(blocked => domain.includes(blocked))) {
          console.log(`⛔ Blocked domain: ${domain}`);
          return false;
        }
        
        // 2. Check allowlist mode
        if (this.policy.content_filtering.allowlist_mode && 
            this.policy.content_filtering.allowed_domains.length > 0) {
          if (!this.policy.content_filtering.allowed_domains.some(allowed => domain.includes(allowed))) {
            console.log(`⚠️  Domain not in allowlist: ${domain}`);
            return false;
          }
        }
      } catch (error) {
        console.warn('Invalid URL:', result.url);
        return false;
      }
      
      // 3. Check content length
      const maxChars = this.policy.result_processing.max_characters_per_result;
      if (result.content && result.content.length > maxChars) {
        result.content = result.content.substring(0, maxChars) + '...';
      }
      
      return true;
    });
  }

  /**
   * Summarize results using LLM
   * Condenses multiple results into actionable insights
   */
  async summarizeResults(results, originalQuery) {
    if (results.length === 0) {
      return { results: [], summary: 'No results found.' };
    }
    
    try {
      // Build context from all results
      const context = results.map((r, i) => 
        `[${i + 1}] ${r.title}\n${r.content}\nSource: ${r.url}`
      ).join('\n\n');
      
      const prompt = `Summarize these search results for the query "${originalQuery}". Provide:
1. A brief overview (2-3 sentences)
2. Key findings (bullet points)
3. Source credibility notes if relevant

Search Results:
${context}

Summary:`;
      
      const response = await this.openai.chat.completions.create({
        model: this.summaryModel,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 400,
        temperature: 0.3
      });
      
      const summary = response.choices[0].message.content.trim();
      
      return {
        results: results.map(r => ({
          title: r.title,
          snippet: r.content?.substring(0, 300) + '...' || '',
          url: r.url,
          score: r.score || 0
        })),
        summary
      };
      
    } catch (error) {
      console.warn('Summarization failed:', error.message);
      // Return unsummarized results
      return {
        results: results.map(r => ({
          title: r.title,
          snippet: r.content?.substring(0, 300) + '...' || '',
          url: r.url,
          score: r.score || 0
        })),
        summary: 'Summary unavailable'
      };
    }
  }

  /**
   * Tag results with provenance information
   */
  tagProvenance(summarizedResults, originalRequest) {
    return {
      results: summarizedResults.results ? summarizedResults.results.map(result => ({
        ...result,
        provenance: {
          source: 'web_search',
          engine: 'tavily',
          retrievedAt: new Date().toISOString(),
          queryIntent: originalRequest.intent || 'unknown',
          trustScore: this.calculateTrustScore(result)
        }
      })) : summarizedResults.map(result => ({
        ...result,
        provenance: {
          source: 'web_search',
          engine: 'tavily',
          retrievedAt: new Date().toISOString(),
          queryIntent: originalRequest.intent || 'unknown',
          trustScore: this.calculateTrustScore(result)
        }
      })),
      summary: summarizedResults.summary,
      provenance: {
        herald: 'external_search',
        sanitized: this.policy.privacy.sanitize_queries,
        policyVersion: this.policy.version,
        timestamp: new Date().toISOString()
      }
    };
  }

  /**
   * Calculate trust score for a result
   * Based on domain reputation, score, etc.
   */
  calculateTrustScore(result) {
    const baseScore = this.policy.trust_scoring.base_score;
    const trustedDomains = this.policy.trust_scoring.trusted_domains;
    const trustBoost = this.policy.trust_scoring.trust_boost;
    
    let score = baseScore;
    
    try {
      const url = new URL(result.url);
      const domain = url.hostname;
      
      if (trustedDomains.some(trusted => domain.includes(trusted))) {
        score += trustBoost;
      }
      
      // Boost for high search score
      if (result.score && result.score > 0.8) {
        score += 0.2;
      }
      
    } catch (error) {
      // Invalid URL = lower trust
      score -= 0.2;
    }
    
    return Math.max(0, Math.min(1, score)); // Clamp to 0-1
  }

  /**
   * Log search for audit trail
   */
  logSearch(originalRequest, sanitizedQuery, results) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      originalQuery: originalRequest.query,
      sanitizedQuery,
      resultCount: results.results.length,
      intent: originalRequest.intent || 'unknown',
      success: true
    };
    
    this.searchHistory.push(logEntry);
    
    // Keep only last 1000 searches in memory
    if (this.searchHistory.length > 1000) {
      this.searchHistory.shift();
    }
  }

  /**
   * Build response for blocked searches
   */
  buildBlockedResponse(reason) {
    return {
      success: false,
      blocked: true,
      reason,
      results: [],
      metadata: {
        timestamp: new Date().toISOString(),
        policyCompliant: false
      }
    };
  }

  /**
   * Reset daily count if new day
   */
  resetDailyCountIfNeeded() {
    const today = new Date().toISOString().split('T')[0];
    if (today !== this.lastResetDate) {
      this.dailySearchCount = 0;
      this.lastResetDate = today;
      console.log('📅 Daily search count reset');
    }
  }

  /**
   * Update metrics
   */
  updateMetrics(success, searchTime) {
    this.metrics.totalSearches++;
    
    if (success) {
      this.metrics.successfulSearches++;
    } else {
      this.metrics.failedSearches++;
    }
    
    // Update running average
    const totalTime = this.metrics.avgSearchTime * (this.metrics.totalSearches - 1);
    this.metrics.avgSearchTime = (totalTime + searchTime) / this.metrics.totalSearches;
    
    // Estimate cost (Tavily: ~$0.001 per search)
    this.metrics.totalCost += 0.001;
  }

  /**
   * Get Herald metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      successRate: this.metrics.totalSearches > 0
        ? this.metrics.successfulSearches / this.metrics.totalSearches
        : 0,
      dailySearchCount: this.policy.dailySearchCount,
      dailySearchLimit: this.policy.dailySearchLimit,
      searchesRemaining: this.policy.dailySearchLimit - this.policy.dailySearchCount
    };
  }

  /**
   * Get search history (for audit)
   */
  getSearchHistory(limit = 10) {
    return this.searchHistory.slice(-limit).reverse();
  }

  /**
   * Update policy settings
   */
  updatePolicy(newPolicySettings) {
    this.policy = {
      ...this.policy,
      ...newPolicySettings
    };
    console.log('📜 Herald policy updated');
  }
}

export default Herald;
