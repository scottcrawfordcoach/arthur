/**
 * Source Credibility & Bias Metadata
 * 
 * Adds credibility ratings and bias awareness to reference documents.
 * Helps Arthur understand which sources are scientifically rigorous vs. opinion-based.
 * 
 * Usage:
 *   import { assessSourceCredibility } from './sourceCredibility.js';
 *   const metadata = assessSourceCredibility(bookTitle, author, content);
 */

/**
 * Source Types & Credibility Levels
 */
export const SOURCE_TYPES = {
  PEER_REVIEWED: 'peer_reviewed',           // Academic, peer-reviewed research
  SCIENTIFIC: 'scientific',                 // Science-based, but not peer-reviewed
  EVIDENCE_BASED: 'evidence_based',         // Cites research, but includes interpretation
  PRACTITIONER: 'practitioner',             // Expert practitioner insights
  POPULAR_SCIENCE: 'popular_science',       // Popularization of science
  SELF_HELP: 'self_help',                   // Self-improvement, may lack rigor
  PHILOSOPHICAL: 'philosophical',           // Philosophical arguments
  ANECDOTAL: 'anecdotal',                   // Personal stories, limited evidence
  CONTROVERSIAL: 'controversial',           // Contains disputed claims
  OPINION: 'opinion'                        // Primarily opinion-based
};

export const CREDIBILITY_LEVELS = {
  HIGH: 'high',           // 8-10: Peer-reviewed, rigorous methodology
  MODERATE: 'moderate',   // 5-7: Evidence-based but with interpretation
  LOW: 'low',            // 3-4: Primarily anecdotal or opinion
  CONTROVERSIAL: 'controversial' // 1-2: Contains disputed claims
};

/**
 * Known Authors & Their Typical Source Types
 */
const AUTHOR_PROFILES = {
  // High Credibility - Research-Based
  'Daniel Kahneman': { type: SOURCE_TYPES.PEER_REVIEWED, credibility: CREDIBILITY_LEVELS.HIGH, notes: 'Nobel laureate, rigorous research' },
  'Angela Duckworth': { type: SOURCE_TYPES.SCIENTIFIC, credibility: CREDIBILITY_LEVELS.HIGH, notes: 'Academic psychologist, data-driven' },
  'Martin E. P. Seligman': { type: SOURCE_TYPES.SCIENTIFIC, credibility: CREDIBILITY_LEVELS.HIGH, notes: 'Founder of positive psychology' },
  'Adam Grant': { type: SOURCE_TYPES.EVIDENCE_BASED, credibility: CREDIBILITY_LEVELS.HIGH, notes: 'Organizational psychologist, cites research' },
  'Brené Brown': { type: SOURCE_TYPES.EVIDENCE_BASED, credibility: CREDIBILITY_LEVELS.MODERATE, notes: 'Researcher, but popular audience' },
  'Cal Newport': { type: SOURCE_TYPES.EVIDENCE_BASED, credibility: CREDIBILITY_LEVELS.MODERATE, notes: 'Computer scientist, synthesizes research' },
  'James Clear': { type: SOURCE_TYPES.EVIDENCE_BASED, credibility: CREDIBILITY_LEVELS.MODERATE, notes: 'Synthesizes research, practical focus' },
  'Gabor Maté': { type: SOURCE_TYPES.EVIDENCE_BASED, credibility: CREDIBILITY_LEVELS.MODERATE, notes: 'Physician, integrative approach' },
  
  // Moderate Credibility - Practitioner/Popularizer
  'Malcolm Gladwell': { type: SOURCE_TYPES.POPULAR_SCIENCE, credibility: CREDIBILITY_LEVELS.MODERATE, notes: 'Journalist, selective research use' },
  'Daniel Z. Lieberman': { type: SOURCE_TYPES.POPULAR_SCIENCE, credibility: CREDIBILITY_LEVELS.MODERATE, notes: 'Psychiatrist, neuroscience popularization' },
  'David Epstein': { type: SOURCE_TYPES.POPULAR_SCIENCE, credibility: CREDIBILITY_LEVELS.MODERATE, notes: 'Science journalist, investigative' },
  'Michael Easter': { type: SOURCE_TYPES.POPULAR_SCIENCE, credibility: CREDIBILITY_LEVELS.MODERATE, notes: 'Journalist, health/fitness focus' },
  'Rick Rubin': { type: SOURCE_TYPES.PHILOSOPHICAL, credibility: CREDIBILITY_LEVELS.MODERATE, notes: 'Artist, creative philosophy' },
  'Dale Carnegie': { type: SOURCE_TYPES.PRACTITIONER, credibility: CREDIBILITY_LEVELS.MODERATE, notes: 'Classic practitioner wisdom' },
  
  // Lower Credibility - Opinion/Anecdotal (Still Valuable!)
  'David Goggins': { type: SOURCE_TYPES.ANECDOTAL, credibility: CREDIBILITY_LEVELS.LOW, notes: 'Personal experience, extreme methods, controversial' },
  'Robert Greene': { type: SOURCE_TYPES.PHILOSOPHICAL, credibility: CREDIBILITY_LEVELS.LOW, notes: 'Historical synthesis, strategic philosophy' },
  'Mark Webber': { type: SOURCE_TYPES.ANECDOTAL, credibility: CREDIBILITY_LEVELS.LOW, notes: 'Memoir, personal experience' },
  'Terrence Real': { type: SOURCE_TYPES.PRACTITIONER, credibility: CREDIBILITY_LEVELS.MODERATE, notes: 'Therapist, clinical experience' },
  
  // Controversial/Disputed
  'Robert B. Cialdini': { type: SOURCE_TYPES.SCIENTIFIC, credibility: CREDIBILITY_LEVELS.HIGH, notes: 'Social psychologist, well-researched' }
};

/**
 * Content Keywords for Source Type Detection
 */
const CONTENT_INDICATORS = {
  peer_reviewed: [
    'meta-analysis', 'systematic review', 'peer-reviewed', 'published in',
    'journal of', 'research shows', 'study found', 'p < 0.05', 'statistical significance',
    'randomized controlled trial', 'longitudinal study', 'methodology', 'n =', 'sample size'
  ],
  scientific: [
    'research', 'study', 'experiment', 'data', 'evidence', 'findings',
    'neuroscience', 'psychology', 'biology', 'laboratory', 'scientific'
  ],
  anecdotal: [
    'in my experience', 'I believe', 'I found that', 'my story', 'my journey',
    'what worked for me', 'personal', 'memoir', 'autobiography'
  ],
  philosophical: [
    'philosophy', 'ethics', 'virtue', 'wisdom', 'meaning', 'existential',
    'stoic', 'ancient', 'taoism', 'buddhism', 'principles'
  ],
  controversial: [
    'controversial', 'disputed', 'critics argue', 'debate', 'extreme',
    'unproven', 'questionable', 'lacks evidence', 'pseudoscience'
  ]
};

/**
 * Bias Indicators
 */
const BIAS_INDICATORS = {
  confirmation: [
    'proves my point', 'as I suspected', 'obviously', 'clearly shows',
    'undeniable', 'must be', 'cannot be denied'
  ],
  selection: [
    'cherry-picked', 'selected examples', 'ignoring', 'fails to mention',
    'conveniently omits', 'one-sided'
  ],
  overgeneralization: [
    'always', 'never', 'everyone', 'no one', 'all', 'every single',
    'without exception', 'universally true'
  ],
  emotional: [
    'shocking', 'outrageous', 'unbelievable', 'disgusting', 'amazing',
    'revolutionary', 'life-changing', 'will blow your mind'
  ]
};

/**
 * Assess source credibility and bias
 */
export function assessSourceCredibility(title, author, content, category = 'general') {
  const assessment = {
    sourceType: SOURCE_TYPES.EVIDENCE_BASED,
    credibility: CREDIBILITY_LEVELS.MODERATE,
    biasRisk: 'low',
    limitations: [],
    strengths: [],
    useWithCaution: false,
    metadata: {}
  };
  
  // 1. Check author profile
  const authorProfile = findAuthorProfile(author);
  if (authorProfile) {
    assessment.sourceType = authorProfile.type;
    assessment.credibility = authorProfile.credibility;
    assessment.metadata.authorNotes = authorProfile.notes;
  }
  
  // 2. Analyze content for indicators
  const contentLower = content.toLowerCase().substring(0, 10000); // First 10k chars
  
  // Check for peer-reviewed markers
  const peerReviewedScore = countIndicators(contentLower, CONTENT_INDICATORS.peer_reviewed);
  if (peerReviewedScore > 5) {
    assessment.sourceType = SOURCE_TYPES.PEER_REVIEWED;
    assessment.credibility = CREDIBILITY_LEVELS.HIGH;
    assessment.strengths.push('Contains peer-reviewed research citations');
  }
  
  // Check for scientific content
  const scientificScore = countIndicators(contentLower, CONTENT_INDICATORS.scientific);
  if (scientificScore > 10 && assessment.sourceType !== SOURCE_TYPES.PEER_REVIEWED) {
    assessment.strengths.push('Cites scientific research');
  }
  
  // Check for anecdotal content
  const anecdotalScore = countIndicators(contentLower, CONTENT_INDICATORS.anecdotal);
  if (anecdotalScore > 15) {
    assessment.limitations.push('Primarily anecdotal evidence');
    if (assessment.credibility === CREDIBILITY_LEVELS.HIGH) {
      assessment.credibility = CREDIBILITY_LEVELS.MODERATE;
    }
  }
  
  // Check for philosophical content
  const philosophicalScore = countIndicators(contentLower, CONTENT_INDICATORS.philosophical);
  if (philosophicalScore > 10) {
    assessment.metadata.hasPhilosophicalContent = true;
    assessment.limitations.push('Contains philosophical arguments (not empirical)');
  }
  
  // Check for controversial indicators
  const controversialScore = countIndicators(contentLower, CONTENT_INDICATORS.controversial);
  if (controversialScore > 3) {
    assessment.credibility = CREDIBILITY_LEVELS.CONTROVERSIAL;
    assessment.useWithCaution = true;
    assessment.limitations.push('Contains controversial or disputed claims');
  }
  
  // 3. Analyze for bias
  const biasScores = {
    confirmation: countIndicators(contentLower, BIAS_INDICATORS.confirmation),
    selection: countIndicators(contentLower, BIAS_INDICATORS.selection),
    overgeneralization: countIndicators(contentLower, BIAS_INDICATORS.overgeneralization),
    emotional: countIndicators(contentLower, BIAS_INDICATORS.emotional)
  };
  
  const totalBiasScore = Object.values(biasScores).reduce((a, b) => a + b, 0);
  
  if (totalBiasScore > 20) {
    assessment.biasRisk = 'high';
    assessment.useWithCaution = true;
    assessment.limitations.push('High potential for cognitive bias');
  } else if (totalBiasScore > 10) {
    assessment.biasRisk = 'moderate';
    assessment.limitations.push('Moderate potential for bias');
  }
  
  // 4. Category-specific adjustments
  if (category === 'self_help' && assessment.credibility === CREDIBILITY_LEVELS.HIGH) {
    assessment.credibility = CREDIBILITY_LEVELS.MODERATE;
    assessment.limitations.push('Self-help genre: practical over rigorous');
  }
  
  if (category === 'memoir' || category === 'biography') {
    assessment.sourceType = SOURCE_TYPES.ANECDOTAL;
    assessment.limitations.push('Memoir: personal experience, not generalizable');
  }
  
  // 5. Generate summary
  assessment.summary = generateCredibilitySummary(assessment);
  
  return assessment;
}

/**
 * Find author in profile database
 */
function findAuthorProfile(author) {
  // Try exact match
  if (AUTHOR_PROFILES[author]) {
    return AUTHOR_PROFILES[author];
  }
  
  // Try partial match (e.g., "David Goggins" matches "Goggins")
  const authorLower = author.toLowerCase();
  for (const [profileAuthor, profile] of Object.entries(AUTHOR_PROFILES)) {
    if (authorLower.includes(profileAuthor.toLowerCase()) || 
        profileAuthor.toLowerCase().includes(authorLower)) {
      return profile;
    }
  }
  
  return null;
}

/**
 * Count indicator occurrences
 */
function countIndicators(text, indicators) {
  let count = 0;
  for (const indicator of indicators) {
    const regex = new RegExp(indicator, 'gi');
    const matches = text.match(regex);
    if (matches) count += matches.length;
  }
  return count;
}

/**
 * Generate human-readable summary
 */
function generateCredibilitySummary(assessment) {
  let summary = '';
  
  // Credibility
  switch (assessment.credibility) {
    case CREDIBILITY_LEVELS.HIGH:
      summary += 'High credibility: ';
      break;
    case CREDIBILITY_LEVELS.MODERATE:
      summary += 'Moderate credibility: ';
      break;
    case CREDIBILITY_LEVELS.LOW:
      summary += 'Lower credibility (still valuable): ';
      break;
    case CREDIBILITY_LEVELS.CONTROVERSIAL:
      summary += '⚠️ Controversial source: ';
      break;
  }
  
  // Source type
  switch (assessment.sourceType) {
    case SOURCE_TYPES.PEER_REVIEWED:
      summary += 'Peer-reviewed research. ';
      break;
    case SOURCE_TYPES.SCIENTIFIC:
      summary += 'Science-based content. ';
      break;
    case SOURCE_TYPES.EVIDENCE_BASED:
      summary += 'Evidence-based with author interpretation. ';
      break;
    case SOURCE_TYPES.POPULAR_SCIENCE:
      summary += 'Science popularization. ';
      break;
    case SOURCE_TYPES.PRACTITIONER:
      summary += 'Practitioner experience. ';
      break;
    case SOURCE_TYPES.ANECDOTAL:
      summary += 'Personal experience and anecdotes. ';
      break;
    case SOURCE_TYPES.PHILOSOPHICAL:
      summary += 'Philosophical arguments and wisdom. ';
      break;
    case SOURCE_TYPES.OPINION:
      summary += 'Opinion-based. ';
      break;
  }
  
  // Warnings
  if (assessment.useWithCaution) {
    summary += '⚠️ Use with caution. ';
  }
  
  return summary.trim();
}

/**
 * Generate citation disclaimer for Arthur's responses
 */
export function generateCitationDisclaimer(sourceAssessment) {
  const disclaimers = [];
  
  if (sourceAssessment.credibility === CREDIBILITY_LEVELS.CONTROVERSIAL) {
    disclaimers.push('⚠️ Note: This source contains controversial or disputed claims');
  }
  
  if (sourceAssessment.sourceType === SOURCE_TYPES.ANECDOTAL) {
    disclaimers.push('ℹ️ Based on personal experience rather than research');
  }
  
  if (sourceAssessment.sourceType === SOURCE_TYPES.PHILOSOPHICAL) {
    disclaimers.push('ℹ️ Philosophical perspective, not empirical evidence');
  }
  
  if (sourceAssessment.biasRisk === 'high') {
    disclaimers.push('⚠️ This source may contain cognitive bias');
  }
  
  if (sourceAssessment.credibility === CREDIBILITY_LEVELS.LOW && 
      sourceAssessment.sourceType !== SOURCE_TYPES.PHILOSOPHICAL) {
    disclaimers.push('ℹ️ Consider as inspiration rather than scientific fact');
  }
  
  return disclaimers.join(' | ');
}

/**
 * Compare source credibility for synthesis
 */
export function compareSourcesForSynthesis(sources) {
  // Sort by credibility
  const sorted = sources.sort((a, b) => {
    const credOrder = {
      [CREDIBILITY_LEVELS.HIGH]: 4,
      [CREDIBILITY_LEVELS.MODERATE]: 3,
      [CREDIBILITY_LEVELS.LOW]: 2,
      [CREDIBILITY_LEVELS.CONTROVERSIAL]: 1
    };
    return credOrder[b.credibility] - credOrder[a.credibility];
  });
  
  const guidance = {
    primarySources: sorted.filter(s => s.credibility === CREDIBILITY_LEVELS.HIGH),
    supportingSources: sorted.filter(s => s.credibility === CREDIBILITY_LEVELS.MODERATE),
    inspirationalSources: sorted.filter(s => s.credibility === CREDIBILITY_LEVELS.LOW),
    controversialSources: sorted.filter(s => s.credibility === CREDIBILITY_LEVELS.CONTROVERSIAL),
    synthesisGuidance: ''
  };
  
  // Generate synthesis guidance
  if (guidance.primarySources.length > 0) {
    guidance.synthesisGuidance += 'Prioritize peer-reviewed and scientific sources. ';
  }
  
  if (guidance.controversialSources.length > 0) {
    guidance.synthesisGuidance += 'Flag controversial claims and present alternative views. ';
  }
  
  if (guidance.inspirationalSources.length > 0 && guidance.primarySources.length > 0) {
    guidance.synthesisGuidance += 'Use anecdotal sources for examples, not evidence. ';
  }
  
  return guidance;
}

export default {
  assessSourceCredibility,
  generateCitationDisclaimer,
  compareSourcesForSynthesis,
  SOURCE_TYPES,
  CREDIBILITY_LEVELS
};
