/**
 * Policy Loader
 * 
 * Centralized loader for all policy JSON files with validation and hot-reload support
 */

import { readFileSync, existsSync, watch } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import logger from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const CONFIG_DIR = join(__dirname, '../config');

class PolicyLoader {
  constructor() {
    this.policies = {};
    this.watchers = new Map();
    this.loadAll();
  }

  /**
   * Load all policy files
   */
  loadAll() {
    this.policies.influencer = this.loadPolicy('influencer_policy.json');
    this.policies.librarian = this.loadPolicy('librarian_policy.json');
    this.policies.herald = this.loadPolicy('herald_policy.json');
    this.policies.signals = this.loadPolicy('signals_schema.json');
    
    logger.info('📋 All policies loaded');
  }

  /**
   * Load a single policy file
   * @param {string} filename 
   * @returns {Object}
   */
  loadPolicy(filename) {
    const filepath = join(CONFIG_DIR, filename);
    
    if (!existsSync(filepath)) {
      logger.warn(`Policy file not found: ${filename}`);
      return null;
    }

    try {
      const content = readFileSync(filepath, 'utf8');
      const policy = JSON.parse(content);
      
      logger.info(`✅ Loaded policy: ${filename}`);
      return policy;
    } catch (error) {
      logger.error(`Failed to load policy ${filename}:`, error);
      return null;
    }
  }

  /**
   * Get influencer (Advisory Council) policy
   */
  getInfluencerPolicy() {
    return this.policies.influencer || this.getDefaultInfluencerPolicy();
  }

  /**
   * Get Librarian policy
   */
  getLibrarianPolicy() {
    return this.policies.librarian || this.getDefaultLibrarianPolicy();
  }

  /**
   * Get Herald policy
   */
  getHeraldPolicy() {
    return this.policies.herald || this.getDefaultHeraldPolicy();
  }

  /**
   * Get signals schema
   */
  getSignalsSchema() {
    return this.policies.signals || {};
  }

  /**
   * Reload a specific policy (for hot-reload)
   * @param {string} policyName - 'influencer', 'librarian', 'herald', or 'signals'
   */
  reloadPolicy(policyName) {
    const fileMap = {
      influencer: 'influencer_policy.json',
      librarian: 'librarian_policy.json',
      herald: 'herald_policy.json',
      signals: 'signals_schema.json'
    };

    const filename = fileMap[policyName];
    if (!filename) {
      logger.warn(`Unknown policy name: ${policyName}`);
      return;
    }

    this.policies[policyName] = this.loadPolicy(filename);
    logger.info(`🔄 Reloaded policy: ${policyName}`);
  }

  /**
   * Watch policy files for changes (hot-reload)
   * @param {boolean} enable - Enable or disable watching
   */
  enableHotReload(enable = true) {
    if (enable) {
      const policyFiles = [
        { name: 'influencer', file: 'influencer_policy.json' },
        { name: 'librarian', file: 'librarian_policy.json' },
        { name: 'herald', file: 'herald_policy.json' },
        { name: 'signals', file: 'signals_schema.json' }
      ];

      policyFiles.forEach(({ name, file }) => {
        const filepath = join(CONFIG_DIR, file);
        
        if (existsSync(filepath)) {
          const watcher = watch(filepath, (eventType) => {
            if (eventType === 'change') {
              logger.info(`🔄 Policy file changed: ${file}`);
              this.reloadPolicy(name);
            }
          });
          
          this.watchers.set(name, watcher);
        }
      });

      logger.info('🔥 Policy hot-reload enabled');
    } else {
      // Stop all watchers
      this.watchers.forEach(watcher => watcher.close());
      this.watchers.clear();
      logger.info('❄️  Policy hot-reload disabled');
    }
  }

  /**
   * Default fallback policies (if files missing)
   */
  getDefaultInfluencerPolicy() {
    return {
      base_weights: { teacher: 0.33, coach: 0.33, problemSolver: 0.34 },
      crisis_override: {
        enabled: true,
        forced_weights: { teacher: 0.15, coach: 0.70, problemSolver: 0.15 }
      }
    };
  }

  getDefaultLibrarianPolicy() {
    return {
      '3d_scoring': {
        weights: {
          semantic: 0.40,
          recency: 0.25,
          frequency: 0.20,
          vehemence: 0.15
        }
      },
      retention: {
        compression: { threshold_days: 90 },
        archiving: { threshold_days: 365 }
      },
      access_limits: {
        max_results_per_query: 50,
        max_history_messages: 100
      }
    };
  }

  getDefaultHeraldPolicy() {
    return {
      budgets: { daily_search_limit: 100 },
      privacy: { sanitize_queries: true },
      content_filtering: {
        blocked_keywords: ['illegal', 'harmful', 'explicit']
      },
      trust_scoring: {
        trusted_domains: ['wikipedia.org', 'github.com', '.edu', '.gov']
      }
    };
  }

  /**
   * Validate policy structure
   * @param {string} policyName 
   * @returns {boolean}
   */
  validatePolicy(policyName) {
    const policy = this.policies[policyName];
    
    if (!policy) {
      logger.warn(`Policy not loaded: ${policyName}`);
      return false;
    }

    // Basic validation - check for required fields
    switch (policyName) {
      case 'influencer':
        return policy.base_weights && policy.crisis_override;
      
      case 'librarian':
        return policy['3d_scoring'] && policy.retention;
      
      case 'herald':
        return policy.budgets && policy.privacy;
      
      case 'signals':
        return policy.signals && policy.metadata;
      
      default:
        return false;
    }
  }

  /**
   * Get policy metadata (version, description)
   * @param {string} policyName 
   * @returns {Object}
   */
  getPolicyMetadata(policyName) {
    const policy = this.policies[policyName];
    
    if (!policy) return null;

    return {
      version: policy.version || 'unknown',
      description: policy.description || 'No description'
    };
  }
}

// Export singleton instance
export const policyLoader = new PolicyLoader();

// Export class for testing
export default PolicyLoader;
