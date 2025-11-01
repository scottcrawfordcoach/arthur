/**
 * EVIDENCE COUNCIL COORDINATOR
 * 
 * Orchestrates the 5 Knights of the Evidence Council to analyze user messages
 * and generate comprehensive signals for Arthur's decision-making.
 * 
 * Architecture (Roundtable Metaphor):
 * - 5 specialized Knights, each analyzing different aspects
 * - Phased execution: parallel → sequential for dependencies
 * - Graceful degradation when Knights fail
 * - No database access (Knights analyze, don't fetch data)
 * 
 * Execution Flow:
 * Phase 1 (Parallel): Emotion, Needs, Pattern Knights
 *   → Independent analyses, can run simultaneously
 * 
 * Phase 2 (Sequential): Context Knight
 *   → Depends on Phase 1 signals to determine what context to request
 * 
 * Phase 3 (Sequential): Analysis Knight
 *   → Synthesizes all signals into final recommendations
 * 
 * Error Handling:
 * - Knights can fail without breaking the whole council
 * - Degraded signals returned with confidence penalties
 * - Logs failures for debugging
 */

import EmotionKnight from '../knights/EmotionKnight.js';
import NeedsKnight from '../knights/NeedsKnight.js';
import PatternKnight from '../knights/PatternKnight.js';
import ContextKnight from '../knights/ContextKnight.js';
import AnalysisKnight from '../knights/AnalysisKnight.js';

class EvidenceCouncil {
  constructor() {
    // Initialize all Knights
    this.emotionKnight = new EmotionKnight();
    this.needsKnight = new NeedsKnight();
    this.patternKnight = new PatternKnight();
    this.contextKnight = new ContextKnight();
    this.analysisKnight = new AnalysisKnight();
    
    // Track execution metrics
    this.metrics = {
      totalCalls: 0,
      successfulCalls: 0,
      knightFailures: {},
      averageExecutionTime: 0,
      // Per-knight aggregates
      perKnight: {
        emotion: { totalMs: 0, calls: 0, successes: 0 },
        needs: { totalMs: 0, calls: 0, successes: 0 },
        pattern: { totalMs: 0, calls: 0, successes: 0 },
        context: { totalMs: 0, calls: 0, successes: 0 },
        analysis: { totalMs: 0, calls: 0, successes: 0 }
      }
    };
  }

  /**
   * Main entry point: Convene the council to analyze a user message
   * 
   * @param {string} userMessage - The user's message to analyze
   * @param {Object} context - Additional context (session, history, etc.)
   * @returns {Promise<Object>} Unified signals from all Knights
   */
  async convene(userMessage, context = {}) {
    const startTime = Date.now();
    this.metrics.totalCalls++;
    
    try {
      console.log('🏰 Evidence Council convening...');
      
      // Phase 1: Independent Knights (run in parallel)
      console.log('⚔️  Phase 1: Emotion, Needs, Pattern Knights (parallel)');
      const phase1Results = await this.executePhase1(userMessage, context);
      
      // Phase 2: Context Knight (depends on Phase 1)
      console.log('⚔️  Phase 2: Context Knight (sequential)');
      const phase2Results = await this.executePhase2(userMessage, phase1Results);
      
      // Phase 3: Analysis Knight (synthesizes everything)
      console.log('⚔️  Phase 3: Analysis Knight (synthesis)');
      const phase3Results = await this.executePhase3(userMessage, {
        ...phase1Results,
        ...phase2Results
      });
      
      // Compile unified signal set
      const unifiedSignals = this.compileSignals({
        ...phase1Results,
        ...phase2Results,
        ...phase3Results
      });
      
      // Build diagnostics for transcript
      const councilDiagnostics = {
        emotion: {
          ms: phase1Results.emotion?.durationMs ?? null,
          degraded: !!phase1Results.emotion?.degraded
        },
        needs: {
          ms: phase1Results.needs?.durationMs ?? null,
          degraded: !!phase1Results.needs?.degraded
        },
        pattern: {
          ms: phase1Results.pattern?.durationMs ?? null,
          degraded: !!phase1Results.pattern?.degraded
        },
        context: {
          ms: phase2Results.contextKnight?.durationMs ?? null,
          degraded: !!phase2Results.contextKnight?.degraded
        },
        analysis: {
          ms: phase3Results.analysis?.durationMs ?? null,
          degraded: !!phase3Results.analysis?.degraded
        }
      };
      
      const executionTime = Date.now() - startTime;
      this.updateMetrics(true, executionTime);
      
      console.log(`✅ Council complete (${executionTime}ms)`);
      
      return {
        success: true,
        signals: unifiedSignals,
        confidence: unifiedSignals.confidence || 0,
        executionTime,
        councilDiagnostics,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.updateMetrics(false, executionTime);
      
      console.error('❌ Council failed:', error.message);
      
      // Return degraded result
      return {
        success: false,
        signals: this.getDegradedSignals(),
        error: error.message,
        executionTime,
        councilDiagnostics: null,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Phase 1: Execute independent Knights in parallel
   * Emotion, Needs, Pattern can run simultaneously
   */
  async executePhase1(userMessage, context) {
    const results = {};
    
    // Run all three Knights in parallel
    const [emotionResult, needsResult, patternResult] = await Promise.allSettled([
      this.executeKnight('emotion', () => 
        this.emotionKnight.analyze(userMessage, context)
      ),
      this.executeKnight('needs', () => 
        this.needsKnight.analyze(userMessage, context)
      ),
      this.executeKnight('pattern', () => 
        this.patternKnight.analyze(userMessage, context)
      )
    ]);
    
    // Process results (handle failures gracefully)
    results.emotion = this.processKnightResult('emotion', emotionResult);
    results.needs = this.processKnightResult('needs', needsResult);
    results.pattern = this.processKnightResult('pattern', patternResult);
    
    return results;
  }

  /**
   * Phase 2: Execute Context Knight (sequential)
   * Depends on Phase 1 signals to determine context needs
   */
  async executePhase2(userMessage, phase1Results) {
    const results = {};
    
    // Context Knight needs signals from Phase 1
    const contextInput = {
      emotion: phase1Results.emotion?.signals,
      needs: phase1Results.needs?.signals,
      pattern: phase1Results.pattern?.signals
    };
    
    const contextResult = await this.executeKnight('context', () =>
      this.contextKnight.analyze(userMessage, contextInput)
    );
    
    results.contextKnight = this.processKnightResult('context', { 
      status: 'fulfilled', 
      value: contextResult 
    });
    
    return results;
  }

  /**
   * Phase 3: Execute Analysis Knight (sequential)
   * Synthesizes all signals from previous phases
   */
  async executePhase3(userMessage, allPriorResults) {
    const results = {};
    
    // Analysis Knight needs all prior signals
    const analysisInput = {
      emotion: allPriorResults.emotion?.signals,
      needs: allPriorResults.needs?.signals,
      pattern: allPriorResults.pattern?.signals,
      contextKnight: allPriorResults.contextKnight?.signals
    };
    
    const analysisResult = await this.executeKnight('analysis', () =>
      this.analysisKnight.analyze(userMessage, analysisInput)
    );
    
    results.analysis = this.processKnightResult('analysis', {
      status: 'fulfilled',
      value: analysisResult
    });
    
    return results;
  }

  /**
   * Execute a single Knight with error handling
   */
  async executeKnight(knightName, knightFn) {
    try {
      const start = Date.now();
      const result = await knightFn();
      const durationMs = Date.now() - start;
      
      // Validate result has expected structure
      if (!result || !result.signals) {
        throw new Error(`${knightName} Knight returned invalid result`);
      }
      // Attach duration for diagnostics
      const withDuration = { ...result, durationMs };
      
      // Update per-knight metrics
      if (this.metrics.perKnight[knightName]) {
        this.metrics.perKnight[knightName].calls += 1;
        this.metrics.perKnight[knightName].successes += 1;
        this.metrics.perKnight[knightName].totalMs += durationMs;
      }
      
      return withDuration;
      
    } catch (error) {
      console.error(`⚠️  ${knightName} Knight failed:`, error.message);
      
      // Track failure
      this.metrics.knightFailures[knightName] = 
        (this.metrics.knightFailures[knightName] || 0) + 1;
      if (this.metrics.perKnight[knightName]) {
        this.metrics.perKnight[knightName].calls += 1;
        // no successes increment on failure
      }
      
      // Re-throw to be handled by caller
      throw error;
    }
  }

  /**
   * Process Knight result from Promise.allSettled
   */
  processKnightResult(knightName, result) {
    if (result.status === 'fulfilled') {
      return result.value;
    } else {
      console.warn(`⚠️  ${knightName} Knight failed, using degraded signals`);
      return {
        knight: knightName,
        confidence: 0.0,
        signals: this.getDegradedSignalsForKnight(knightName),
        reasoning: `${knightName} Knight failed: ${result.reason?.message || 'unknown error'}`,
        timestamp: new Date().toISOString(),
        degraded: true
      };
    }
  }

  /**
   * Compile all Knight results into unified signal set
   */
  compileSignals(allResults) {
    return {
      // Individual Knight signals
      emotion: allResults.emotion?.signals || null,
      needs: allResults.needs?.signals || null,
      pattern: allResults.pattern?.signals || null,
      context: allResults.contextKnight?.signals || null,
      analysis: allResults.analysis?.signals || null,
      
      // Metadata
      confidence: this.calculateOverallConfidence(allResults),
      degraded: this.hasDegradedSignals(allResults),
      knightStatus: {
        emotion: allResults.emotion?.degraded ? 'degraded' : 'success',
        needs: allResults.needs?.degraded ? 'degraded' : 'success',
        pattern: allResults.pattern?.degraded ? 'degraded' : 'success',
        context: allResults.contextKnight?.degraded ? 'degraded' : 'success',
        analysis: allResults.analysis?.degraded ? 'degraded' : 'success'
      }
    };
  }

  /**
   * Calculate overall confidence from all Knights
   */
  calculateOverallConfidence(allResults) {
    const confidences = [
      allResults.emotion?.confidence,
      allResults.needs?.confidence,
      allResults.pattern?.confidence,
      allResults.contextKnight?.confidence,
      allResults.analysis?.confidence
    ].filter(c => typeof c === 'number');
    
    if (confidences.length === 0) return 0.0;
    
    // Average confidence, but penalize if any Knights failed
    const avgConfidence = confidences.reduce((sum, c) => sum + c, 0) / confidences.length;
    const successRate = confidences.length / 5; // 5 total Knights
    
    return avgConfidence * successRate;
  }

  /**
   * Check if any signals are degraded
   */
  hasDegradedSignals(allResults) {
    return [
      allResults.emotion,
      allResults.needs,
      allResults.pattern,
      allResults.contextKnight,
      allResults.analysis
    ].some(result => result?.degraded === true);
  }

  /**
   * Get degraded signals for a specific Knight
   */
  getDegradedSignalsForKnight(knightName) {
    const degradedSignals = {
      emotion: {
        sentiment: 0.0,
        mood: 'unknown',
        urgency: 0.3,
        risk: 0.0,
        tone_indicators: [],
        energy_level: 'unknown'
      },
      needs: {
        stated_intent: 'unknown',
        latent_need: 'unknown',
        learning_intent: 0.5,
        support_needed: [],
        goal_alignment: 0.5,
        exploratory: 0.5,
        needs_confidence: 0.0
      },
      pattern: {
        recurring_topics: [],
        topic_frequency: {},
        conversation_rhythm: 'unknown',
        behavior_trends: [],
        pattern_strength: 0.0
      },
      context: {
        context_requests: {
          semantic_search: [],
          conversation_history: null,
          user_data: []
        },
        context_priority: [],
        novelty: 0.5
      },
      analysis: {
        synthesized_signals: {
          primary_intent: 'unknown',
          emotional_context: 'unknown',
          urgency_level: 0.3,
          pattern_context: 'unknown',
          complexity: 'unknown'
        },
        herald_recommendation: {
          invoke: false,
          reason: 'Analysis failed',
          search_query: '',
          priority: 'none'
        },
        ambiguity_detected: ['Analysis Knight failed'],
        knowledge_gaps: ['Unable to analyze'],
        confidence: 0.0,
        recommendation: 'acknowledge_and_clarify'
      }
    };
    
    return degradedSignals[knightName] || {};
  }

  /**
   * Get fully degraded signals when entire council fails
   */
  getDegradedSignals() {
    return {
      emotion: this.getDegradedSignalsForKnight('emotion'),
      needs: this.getDegradedSignalsForKnight('needs'),
      pattern: this.getDegradedSignalsForKnight('pattern'),
      context: this.getDegradedSignalsForKnight('context'),
      analysis: this.getDegradedSignalsForKnight('analysis'),
      confidence: 0.0,
      degraded: true,
      knightStatus: {
        emotion: 'failed',
        needs: 'failed',
        pattern: 'failed',
        context: 'failed',
        analysis: 'failed'
      }
    };
  }

  /**
   * Update execution metrics
   */
  updateMetrics(success, executionTime) {
    if (success) {
      this.metrics.successfulCalls++;
    }
    
    // Update running average
    const totalTime = this.metrics.averageExecutionTime * (this.metrics.totalCalls - 1);
    this.metrics.averageExecutionTime = (totalTime + executionTime) / this.metrics.totalCalls;
  }

  /**
   * Get council performance metrics
   */
  getMetrics() {
    const perKnight = {};
    for (const [name, agg] of Object.entries(this.metrics.perKnight)) {
      perKnight[name] = {
        avgMs: agg.calls > 0 ? agg.totalMs / agg.calls : 0,
        calls: agg.calls,
        successRate: agg.calls > 0 ? agg.successes / agg.calls : 0
      };
    }
    return {
      totalCalls: this.metrics.totalCalls,
      successfulCalls: this.metrics.successfulCalls,
      averageExecutionTime: this.metrics.averageExecutionTime,
      knightFailures: this.metrics.knightFailures,
      successRate: this.metrics.totalCalls > 0 
        ? this.metrics.successfulCalls / this.metrics.totalCalls 
        : 0,
      perKnight
    };
  }

  /**
   * Reset metrics (useful for testing)
   */
  resetMetrics() {
    this.metrics = {
      totalCalls: 0,
      successfulCalls: 0,
      knightFailures: {},
      averageExecutionTime: 0
    };
  }
}

export default EvidenceCouncil;
