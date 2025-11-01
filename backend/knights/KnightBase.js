// Copyright (c) 2025 Scott Crawford. All rights reserved.

/**
 * KnightBase.js
 * Base class for all Evidence Council Knights
 * Following ARTHUR_STRATEGY_v3 Roundtable Architecture
 * 
 * All Knights analyze user messages and produce signals that inform
 * Arthur's orchestration and response synthesis.
 * 
 * Knights do NOT access data directly. The Context Knight requests
 * data from the Librarian, but doesn't fetch it itself.
 */

class KnightBase {
  constructor(name, config = {}) {
    this.name = name;
    this.config = config;
    this.enabled = config.enabled !== false; // Default to enabled
  }

  /**
   * Analyze user message and context to produce signals
   * MUST be implemented by all subclasses
   * 
   * @param {string} userMessage - The current user message
   * @param {Object} context - Conversation context and metadata
   * @param {Object} context.sessionId - Current session ID
   * @param {Object} context.userId - User ID (if available)
   * @param {Array} context.conversationHistory - Recent messages (optional)
   * @param {Object} context.userPreferences - User settings (optional)
   * @param {Object} context.priorSignals - Signals from other Knights (for dependent Knights)
   * @returns {Promise<Object>} - Knight analysis result
   */
  async analyze(userMessage, context = {}) {
    throw new Error(`analyze() must be implemented by ${this.name}`);
  }

  /**
   * Validate signal output format
   * All Knights must produce standardized output
   * 
   * @param {Object} result - Analysis result to validate
   * @returns {boolean} - Valid or not
   */
  validateResult(result) {
    if (!result || typeof result !== 'object') {
      return false;
    }

    // Required fields
    const required = ['knightName', 'confidence', 'signals', 'reasoning'];
    for (const field of required) {
      if (!(field in result)) {
        console.warn(`[${this.name}] Missing required field: ${field}`);
        return false;
      }
    }

    // Confidence must be 0.0 - 1.0
    if (typeof result.confidence !== 'number' || result.confidence < 0 || result.confidence > 1) {
      console.warn(`[${this.name}] Invalid confidence: ${result.confidence}`);
      return false;
    }

    // Signals must be an object
    if (typeof result.signals !== 'object' || result.signals === null) {
      console.warn(`[${this.name}] Invalid signals: ${result.signals}`);
      return false;
    }

    return true;
  }

  /**
   * Create standardized output format
   * Helper method for Knights to format their results
   * 
   * @param {Object} signals - Knight-specific signals
   * @param {number} confidence - Confidence level (0.0 - 1.0)
   * @param {string} reasoning - Why these signals were generated
   * @returns {Object} - Formatted result
   */
  createResult(signals, confidence, reasoning) {
    const result = {
      knight: this.name,  // Short form for convenience
      knightName: this.name,
      confidence: Math.max(0, Math.min(1, confidence)), // Clamp to 0-1
      signals,
      reasoning,
      timestamp: new Date().toISOString()
    };

    if (!this.validateResult(result)) {
      console.warn(`[${this.name}] Created invalid result, fixing...`);
      // Provide defaults for invalid results
      result.confidence = result.confidence || 0.5;
      result.signals = result.signals || {};
      result.reasoning = result.reasoning || 'No reasoning provided';
    }

    return result;
  }

  /**
   * Handle Knight execution errors gracefully
   * Returns a degraded but valid result when Knight fails
   * 
   * @param {Error} error - The error that occurred
   * @param {string} userMessage - Original user message
   * @returns {Object} - Degraded result
   */
  handleError(error, userMessage) {
    console.error(`[${this.name}] Error during analysis:`, error.message);
    
    return this.createResult(
      { error: true, message: error.message },
      0.0, // Zero confidence on error
      `${this.name} failed: ${error.message}`
    );
  }

  /**
   * Quick pattern matching fallback
   * Used when LLM analysis fails or for fast pre-checks
   * Subclasses can override with Knight-specific patterns
   * 
   * @param {string} userMessage - User message to analyze
   * @returns {Object|null} - Quick analysis result or null if no patterns match
   */
  quickAnalysis(userMessage) {
    // Base implementation returns null (no quick analysis)
    // Subclasses override with Knight-specific patterns
    return null;
  }

  /**
   * Check if Knight is enabled
   * Allows runtime enabling/disabling of Knights
   * 
   * @returns {boolean}
   */
  isEnabled() {
    return this.enabled;
  }

  /**
   * Enable/disable Knight
   * 
   * @param {boolean} enabled
   */
  setEnabled(enabled) {
    this.enabled = enabled;
  }

  /**
   * Get Knight metadata
   * Useful for logging and debugging
   * 
   * @returns {Object}
   */
  getMetadata() {
    return {
      name: this.name,
      enabled: this.enabled,
      config: this.config
    };
  }
}

export default KnightBase;
