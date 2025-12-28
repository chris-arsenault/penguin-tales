/**
 * Document Style Types and Defaults
 *
 * Defines document-based narrative styles for in-universe documents
 * like news articles, treaties, letters, etc.
 */

import type {
  BaseNarrativeStyle,
  EntitySelectionRules,
  EventSelectionRules,
} from './narrativeStyles.js';

/**
 * Section template for document-based styles
 */
export interface DocumentSection {
  /** Section identifier */
  id: string;
  /** Section name/heading */
  name: string;
  /** Purpose of this section */
  purpose: string;
  /** Target word count for this section */
  wordCountTarget?: number;
  /** Content guidance for LLM */
  contentGuidance: string;
  /** Whether this section is optional */
  optional?: boolean;
}

/**
 * Configuration for document-based narrative styles
 * Used for in-universe documents like news articles, treaties, letters, etc.
 */
export interface DocumentConfig {
  /** Type of document (shown to LLM for context) */
  documentType: string;
  /** High-level instructions for content generation */
  contentInstructions: string;
  /** Section templates */
  sections: DocumentSection[];
  /** Target word count */
  wordCount: { min: number; max: number };
  /** Tone and style keywords */
  toneKeywords: string[];
  /** Elements to include */
  include: string[];
  /** Things to avoid */
  avoid: string[];
  /** How to use entity data */
  entityUsage?: string;
  /** How to use event data */
  eventUsage?: string;
  /** Voice/perspective guidance */
  voice?: string;
}

/**
 * Document narrative style - for in-universe document formats
 */
export interface DocumentNarrativeStyle extends BaseNarrativeStyle {
  format: 'document';
  /** Document-based generation config */
  documentConfig: DocumentConfig;
}

// =============================================================================
// Helper functions for cloning default rules
// =============================================================================

const DEFAULT_DOCUMENT_ENTITY_RULES: EntitySelectionRules = {
  primarySubjectCategories: ['character', 'collective', 'place', 'object', 'concept'],
  supportingSubjectCategories: ['character', 'collective', 'place', 'object', 'concept', 'power'],
  roles: [
    { role: 'subject', count: { min: 1, max: 2 }, description: 'Primary focus of the document' },
    { role: 'authority', count: { min: 0, max: 2 }, description: 'Official or institutional voice' },
    { role: 'witness', count: { min: 0, max: 3 }, description: 'Witnesses or participants with direct knowledge' },
    { role: 'mentioned', count: { min: 0, max: 4 }, description: 'Referenced entities that provide context' },
  ],
  maxCastSize: 8,
};

const DEFAULT_DOCUMENT_EVENT_RULES: EventSelectionRules = {
  significanceRange: { min: 0.3, max: 1.0 },
  maxEvents: 12,
  usageInstructions: 'Events are cited facts that ground the document in history. Use them as evidence, context, or justification.',
};

function cloneDocumentEntityRules(): EntitySelectionRules {
  return {
    ...DEFAULT_DOCUMENT_ENTITY_RULES,
    primarySubjectCategories: DEFAULT_DOCUMENT_ENTITY_RULES.primarySubjectCategories
      ? [...DEFAULT_DOCUMENT_ENTITY_RULES.primarySubjectCategories]
      : undefined,
    supportingSubjectCategories: DEFAULT_DOCUMENT_ENTITY_RULES.supportingSubjectCategories
      ? [...DEFAULT_DOCUMENT_ENTITY_RULES.supportingSubjectCategories]
      : undefined,
    roles: DEFAULT_DOCUMENT_ENTITY_RULES.roles.map((role) => ({
      ...role,
      count: { ...role.count },
    })),
  };
}

function cloneDocumentEventRules(): EventSelectionRules {
  return {
    ...DEFAULT_DOCUMENT_EVENT_RULES,
    significanceRange: { ...DEFAULT_DOCUMENT_EVENT_RULES.significanceRange },
    priorityKinds: DEFAULT_DOCUMENT_EVENT_RULES.priorityKinds
      ? [...DEFAULT_DOCUMENT_EVENT_RULES.priorityKinds]
      : undefined,
    excludeKinds: DEFAULT_DOCUMENT_EVENT_RULES.excludeKinds
      ? [...DEFAULT_DOCUMENT_EVENT_RULES.excludeKinds]
      : undefined,
    priorityTags: DEFAULT_DOCUMENT_EVENT_RULES.priorityTags
      ? [...DEFAULT_DOCUMENT_EVENT_RULES.priorityTags]
      : undefined,
  };
}

// =============================================================================
// Default Document Styles
// =============================================================================

export const DEFAULT_DOCUMENT_STYLES: DocumentNarrativeStyle[] = [
  // 1. HERALD'S DISPATCH
  {
    id: 'heralds-dispatch',
    name: "Herald's Dispatch",
    description: 'Official news proclamation or town crier announcement about recent events',
    tags: ['document', 'news', 'official', 'proclamation'],
    format: 'document',
    entityRules: {
      primarySubjectCategories: ['collective', 'place', 'event', 'character'],
      supportingSubjectCategories: ['character', 'concept', 'object'],
      roles: [
        { role: 'newsworthy-event', count: { min: 1, max: 2 }, description: 'The occurrence being announced', selectionCriteria: 'Prefer entities from event category' },
        { role: 'affected-territory', count: { min: 0, max: 2 }, description: 'Locations impacted by the news', selectionCriteria: 'Prefer entities from place category' },
        { role: 'faction-involved', count: { min: 0, max: 2 }, description: 'Organizations, kingdoms, or groups in the news', selectionCriteria: 'Prefer entities from collective category' },
        { role: 'notable-figure', count: { min: 0, max: 2 }, description: 'Persons of importance mentioned' },
        { role: 'decree-or-law', count: { min: 0, max: 1 }, description: 'New regulation or proclamation being announced', selectionCriteria: 'Prefer entities from concept category' },
      ],
      maxCastSize: 8,
    },
    eventRules: cloneDocumentEventRules(),
    documentConfig: {
      documentType: 'official news dispatch',
      contentInstructions: 'Write as if this will be read aloud in the town square. Lead with the most dramatic or important information. Include official-sounding language but remain accessible. Reference specific entities and events from the world data.',
      sections: [
        { id: 'headline', name: 'Headline', purpose: 'Grab attention immediately', wordCountTarget: 15, contentGuidance: 'Punchy, declarative. Start with action verb or dramatic noun.' },
        { id: 'lead', name: 'Lead Paragraph', purpose: 'Essential facts', wordCountTarget: 60, contentGuidance: 'Who did what, where, and why it matters to the common folk.' },
        { id: 'body', name: 'Full Account', purpose: 'Details and context', wordCountTarget: 200, contentGuidance: 'Expand on events, include witness accounts or official statements.' },
        { id: 'implications', name: 'What This Means', purpose: 'Consequences', wordCountTarget: 80, contentGuidance: 'How this affects trade, safety, daily life. What might happen next.' },
      ],
      wordCount: { min: 300, max: 500 },
      toneKeywords: ['authoritative', 'urgent', 'public', 'formal-but-accessible'],
      include: ['specific names', 'locations', 'dates/times', 'official titles', 'direct quotes'],
      avoid: ['modern journalism terms', 'passive voice in headlines', 'speculation presented as fact'],
      entityUsage: 'Reference entities by full title and name. Important figures should be quoted or mentioned.',
      eventUsage: 'Events are the news. Present them as recent occurrences with immediate relevance.',
      voice: 'Third person, present tense for immediacy. The voice of an official announcer.',
    },
  },

  // 2. TREATISE ON POWERS
  {
    id: 'treatise-powers',
    name: 'Treatise on Powers',
    description: 'Scholarly analysis of abilities, magic, or supernatural phenomena',
    tags: ['document', 'scholarly', 'abilities', 'academic'],
    format: 'document',
    entityRules: {
      primarySubjectCategories: ['power', 'character'],
      supportingSubjectCategories: ['character', 'object', 'concept', 'collective'],
      roles: [
        { role: 'studied-power', count: { min: 1, max: 2 }, description: 'The ability, magic, or phenomenon being analyzed', selectionCriteria: 'Prefer entities from power category' },
        { role: 'documented-practitioner', count: { min: 0, max: 2 }, description: 'Those who wield or manifest the power' },
        { role: 'scholarly-authority', count: { min: 0, max: 1 }, description: 'Expert or institution lending credibility' },
        { role: 'related-artifact', count: { min: 0, max: 2 }, description: 'Objects associated with the power', selectionCriteria: 'Prefer entities from object category' },
      ],
      maxCastSize: 6,
    },
    eventRules: cloneDocumentEventRules(),
    documentConfig: {
      documentType: 'academic treatise',
      contentInstructions: 'Write as a scholar presenting findings to peers. Balance technical precision with readable prose. Include both empirical observations and theoretical speculation. Reference the ability/power/phenomenon in question using proper terminology.',
      sections: [
        { id: 'abstract', name: 'Abstract', purpose: 'Summarize findings', wordCountTarget: 80, contentGuidance: 'Concise overview of what was studied and concluded.' },
        { id: 'introduction', name: 'Introduction', purpose: 'Establish importance', wordCountTarget: 100, contentGuidance: 'Why this ability matters. Historical context. What questions this treatise addresses.' },
        { id: 'observations', name: 'Observations', purpose: 'Present evidence', wordCountTarget: 200, contentGuidance: 'Documented instances, effects observed, conditions required. Be specific.' },
        { id: 'analysis', name: 'Theoretical Analysis', purpose: 'Interpret findings', wordCountTarget: 150, contentGuidance: 'What the observations suggest. How this connects to known principles.' },
        { id: 'warnings', name: 'Caveats', purpose: 'Note dangers', wordCountTarget: 80, contentGuidance: 'Risks of misuse, limitations, ethical considerations.' },
        { id: 'conclusion', name: 'Conclusion', purpose: 'Summarize', wordCountTarget: 60, contentGuidance: 'Key takeaways, questions for future study.' },
      ],
      wordCount: { min: 600, max: 900 },
      toneKeywords: ['scholarly', 'precise', 'analytical', 'measured', 'authoritative'],
      include: ['technical terminology', 'specific examples', 'qualifications', 'citations to authorities'],
      avoid: ['casual language', 'unsubstantiated claims', 'sensationalism', 'first person singular'],
      entityUsage: 'Entities with abilities are subjects of study. Reference their documented capabilities.',
      eventUsage: 'Events serve as case studies or evidence. Cite specific instances where powers manifested.',
      voice: 'Third person academic. First person plural ("we observe") for analysis. Formal register.',
    },
  },

  // 3. MERCHANT'S BROADSHEET
  {
    id: 'merchants-broadsheet',
    name: "Merchant's Broadsheet",
    description: 'Commercial advertisement, trade announcement, or market bulletin',
    tags: ['document', 'commercial', 'trade', 'advertisement'],
    format: 'document',
    entityRules: cloneDocumentEntityRules(),
    eventRules: cloneDocumentEventRules(),
    documentConfig: {
      documentType: 'commercial advertisement',
      contentInstructions: 'Write as a merchant trying to attract customers. Be enthusiastic but not absurdly so. Include specific products or services with enticing descriptions. Reference the culture and location to make it feel grounded.',
      sections: [
        { id: 'hook', name: 'Attention Grabber', purpose: 'Stop the reader', wordCountTarget: 30, contentGuidance: 'Bold claim, question, or announcement. Make them curious.' },
        { id: 'offerings', name: 'What We Offer', purpose: 'List goods/services', wordCountTarget: 150, contentGuidance: 'Describe items with appeal. Focus on benefits, not just features.' },
        { id: 'credibility', name: 'Why Trust Us', purpose: 'Build confidence', wordCountTarget: 80, contentGuidance: 'Years of experience, famous customers, quality guarantees.' },
        { id: 'testimonial', name: 'Satisfied Customers', purpose: 'Social proof', wordCountTarget: 60, contentGuidance: 'Quote from a satisfied buyer. Name and location add authenticity.', optional: true },
        { id: 'call-to-action', name: 'Visit Us', purpose: 'Close the sale', wordCountTarget: 40, contentGuidance: 'Where to find them, when open, special current deals.' },
      ],
      wordCount: { min: 300, max: 450 },
      toneKeywords: ['enthusiastic', 'persuasive', 'confident', 'welcoming', 'urgent'],
      include: ['specific products', 'prices or barter terms', 'location details', 'merchant personality'],
      avoid: ['modern marketing jargon', 'obvious lies', 'threatening language', 'desperation'],
      entityUsage: 'Merchants are individuals with personality. Items might reference artifacts or abilities.',
      eventUsage: 'Recent events create opportunities. "After the siege, rebuilding supplies in high demand!"',
      voice: 'First person from merchant, or third person promotional. Enthusiastic but genuine.',
    },
  },

  // 4. COLLECTED CORRESPONDENCE
  {
    id: 'collected-letters',
    name: 'Collected Correspondence',
    description: 'Exchange of letters between entities revealing relationships and events',
    tags: ['document', 'letters', 'personal', 'epistolary'],
    format: 'document',
    entityRules: cloneDocumentEntityRules(),
    eventRules: cloneDocumentEventRules(),
    documentConfig: {
      documentType: 'letter collection',
      contentInstructions: 'Write authentic personal letters between entities. Each letter should have distinct voice matching the sender. Letters should reveal character, advance a narrative through correspondence, and reference shared history. Include mundane details alongside important matters.',
      sections: [
        { id: 'context', name: "Editor's Note", purpose: 'Frame the collection', wordCountTarget: 60, contentGuidance: 'Why these letters were preserved. Who the correspondents were.' },
        { id: 'letter1', name: 'First Letter', purpose: 'Establish situation', wordCountTarget: 200, contentGuidance: 'Initial communication. Raises questions, shares news, makes a request.' },
        { id: 'letter2', name: 'Reply', purpose: 'Response and development', wordCountTarget: 200, contentGuidance: 'Addresses the first letter. Reveals the other perspective. Deepens the situation.' },
        { id: 'letter3', name: 'Final Letter', purpose: 'Resolution or cliffhanger', wordCountTarget: 180, contentGuidance: 'Concludes the exchange or leaves tantalizing loose ends.', optional: true },
      ],
      wordCount: { min: 500, max: 800 },
      toneKeywords: ['personal', 'intimate', 'revealing', 'period-appropriate', 'distinctive-voices'],
      include: ['personal details', 'emotional subtext', 'period greetings/closings', 'references to shared history'],
      avoid: ['identical voices', 'exposition dumps', 'modern idioms', 'perfect information'],
      entityUsage: 'Correspondents are entities with relationship. Their bond should be evident in how they write.',
      eventUsage: 'Events are what they write about. News, reactions, consequences discussed in personal terms.',
      voice: 'First person from each writer. Each letter has distinct voice matching the entity.',
    },
  },

  // 5. CHRONICLE ENTRY
  {
    id: 'chronicle-entry',
    name: 'Chronicle Entry',
    description: 'Official historical record or archive entry documenting events',
    tags: ['document', 'historical', 'official', 'archive'],
    format: 'document',
    entityRules: {
      primarySubjectCategories: ['era', 'event', 'collective', 'character'],
      supportingSubjectCategories: ['character', 'place', 'concept', 'collective'],
      roles: [
        { role: 'era-documented', count: { min: 0, max: 1 }, description: 'The age or period being recorded', selectionCriteria: 'Prefer entities from era category' },
        { role: 'pivotal-event', count: { min: 0, max: 2 }, description: 'Key occurrence being chronicled', selectionCriteria: 'Prefer entities from event category' },
        { role: 'historical-figure', count: { min: 0, max: 3 }, description: 'Notable persons documented' },
        { role: 'faction-recorded', count: { min: 0, max: 2 }, description: 'Organizations or powers mentioned', selectionCriteria: 'Prefer entities from collective category' },
        { role: 'chronicler', count: { min: 0, max: 1 }, description: 'The voice recording history' },
      ],
      maxCastSize: 8,
    },
    eventRules: cloneDocumentEventRules(),
    documentConfig: {
      documentType: 'historical chronicle entry',
      contentInstructions: 'Write as an official record-keeper documenting events for posterity. Maintain objectivity while acknowledging sources. Include specific dates and names. Note uncertainties honestly. The chronicler may occasionally reveal opinions through careful word choice.',
      sections: [
        { id: 'header', name: 'Entry Header', purpose: 'Identify the record', wordCountTarget: 40, contentGuidance: 'Date, period, chronicler identification.' },
        { id: 'events', name: 'Events Recorded', purpose: 'Document what happened', wordCountTarget: 250, contentGuidance: 'Chronological account. Specific details. Who did what.' },
        { id: 'analysis', name: 'Significance', purpose: 'Explain importance', wordCountTarget: 100, contentGuidance: 'Why this matters. How it connects to other events. Precedents.' },
        { id: 'figures', name: 'Notable Figures', purpose: 'Document participants', wordCountTarget: 80, contentGuidance: 'List key entities and their roles. Titles and affiliations.' },
        { id: 'notes', name: "Chronicler's Notes", purpose: 'Personal observations', wordCountTarget: 60, contentGuidance: 'Uncertainties, conflicting accounts, personal reflections.', optional: true },
      ],
      wordCount: { min: 450, max: 650 },
      toneKeywords: ['objective', 'formal', 'precise', 'archival', 'measured'],
      include: ['specific dates', 'full titles', 'source attribution', 'cross-references'],
      avoid: ['emotional language', 'speculation as fact', 'modern historical terms', 'bias without acknowledgment'],
      entityUsage: 'Entities are historical figures. Use full titles and note their roles.',
      eventUsage: 'Events are the primary content. Document them with precision and context.',
      voice: 'Third person objective. The chronicler may intrude briefly in notes sections.',
    },
  },

  // 6. WANTED NOTICE
  {
    id: 'wanted-notice',
    name: 'Wanted Notice',
    description: 'Bounty poster, warning notice, or official alert about a person or threat',
    tags: ['document', 'warning', 'bounty', 'official'],
    format: 'document',
    entityRules: cloneDocumentEntityRules(),
    eventRules: cloneDocumentEventRules(),
    documentConfig: {
      documentType: 'wanted poster or warning notice',
      contentInstructions: 'Write as an official notice meant to be posted publicly. Be direct and clear. Include specific identifying details. The tone should match the urgency - wanted criminals are described differently than missing children.',
      sections: [
        { id: 'header', name: 'Alert Header', purpose: 'Immediate classification', wordCountTarget: 20, contentGuidance: 'WANTED, REWARD OFFERED, or WARNING. Large and clear.' },
        { id: 'subject', name: 'Subject Description', purpose: 'Identification', wordCountTarget: 100, contentGuidance: 'Name, aliases, physical description, distinguishing marks, known abilities.' },
        { id: 'charges', name: 'Crimes/Reason', purpose: 'Why they are wanted', wordCountTarget: 80, contentGuidance: 'List of offenses or reason for the notice. Specific incidents.' },
        { id: 'reward', name: 'Reward & Contact', purpose: 'Motivate action', wordCountTarget: 60, contentGuidance: 'What is offered. Where to report. Conditions.' },
        { id: 'warnings', name: 'Cautions', purpose: 'Safety information', wordCountTarget: 40, contentGuidance: 'Danger level. Do not approach. Special abilities to watch for.' },
      ],
      wordCount: { min: 250, max: 400 },
      toneKeywords: ['urgent', 'official', 'direct', 'warning', 'authoritative'],
      include: ['specific physical details', 'last known location', 'bounty amount', 'authority seal'],
      avoid: ['ambiguity', 'lengthy prose', 'humor', 'speculation'],
      entityUsage: 'The subject is an entity. Describe them as someone might identify them on sight.',
      eventUsage: 'Events are the crimes or incidents. Reference specific acts.',
      voice: 'Official third person. Terse, declarative sentences. Commands where appropriate.',
    },
  },

  // 7. DIPLOMATIC ACCORD
  {
    id: 'diplomatic-accord',
    name: 'Diplomatic Accord',
    description: 'Treaty, alliance agreement, or formal pact between factions',
    tags: ['document', 'diplomatic', 'treaty', 'formal'],
    format: 'document',
    entityRules: {
      primarySubjectCategories: ['collective', 'concept'],
      supportingSubjectCategories: ['character', 'place', 'object'],
      roles: [
        { role: 'signatory-faction', count: { min: 2, max: 4 }, description: 'Party to the accord', selectionCriteria: 'Prefer entities from collective category' },
        { role: 'binding-principle', count: { min: 0, max: 2 }, description: 'Law, tradition, or doctrine being established or invoked', selectionCriteria: 'Prefer entities from concept category' },
        { role: 'territorial-subject', count: { min: 0, max: 2 }, description: 'Land or region covered by the accord', selectionCriteria: 'Prefer entities from place category' },
        { role: 'signatory-leader', count: { min: 0, max: 2 }, description: 'Representative who signs on behalf of faction' },
        { role: 'treaty-artifact', count: { min: 0, max: 1 }, description: 'Object exchanged or invoked as guarantee', selectionCriteria: 'Prefer entities from object category' },
      ],
      maxCastSize: 8,
    },
    eventRules: cloneDocumentEventRules(),
    documentConfig: {
      documentType: 'diplomatic treaty or accord',
      contentInstructions: 'Write as a formal legal document between powers. Use precise diplomatic language. Each article should be clear and enforceable. Include both rights and obligations for all parties. The preamble may be more flowery; the articles must be precise.',
      sections: [
        { id: 'title', name: 'Treaty Title', purpose: 'Name the accord', wordCountTarget: 20, contentGuidance: 'Formal name including parties and purpose.' },
        { id: 'preamble', name: 'Preamble', purpose: 'Establish context', wordCountTarget: 100, contentGuidance: 'Why the parties come together. Shared interests. Diplomatic language.' },
        { id: 'articles', name: 'Articles', purpose: 'Specific terms', wordCountTarget: 300, contentGuidance: 'Numbered articles with clear terms. Rights, obligations, conditions.' },
        { id: 'enforcement', name: 'Enforcement & Duration', purpose: 'Implementation', wordCountTarget: 80, contentGuidance: 'How violations are handled. How long this lasts. Renewal terms.' },
        { id: 'signatures', name: 'Signatures', purpose: 'Formalize agreement', wordCountTarget: 60, contentGuidance: 'Who signs, their titles, date, location of signing.' },
      ],
      wordCount: { min: 500, max: 750 },
      toneKeywords: ['formal', 'precise', 'diplomatic', 'binding', 'ceremonial'],
      include: ['specific obligations', 'mutual commitments', 'enforcement mechanisms', 'formal titles'],
      avoid: ['ambiguous terms', 'one-sided benefits', 'informal language', 'unenforceable clauses'],
      entityUsage: 'Parties are factions or leaders. Use full titles and formal names.',
      eventUsage: 'Events may be what led to the treaty - referenced in preamble as context.',
      voice: 'Third person formal. Legal register. "The parties hereby agree..." style.',
    },
  },

  // 8. TAVERN NOTICE BOARD
  {
    id: 'tavern-notices',
    name: 'Tavern Notice Board',
    description: 'Collection of community postings: jobs, rumors, announcements, personal ads',
    tags: ['document', 'community', 'rumors', 'informal'],
    format: 'document',
    entityRules: cloneDocumentEntityRules(),
    eventRules: cloneDocumentEventRules(),
    documentConfig: {
      documentType: 'community notice board collection',
      contentInstructions: 'Write a variety of notices as they would appear on a public board. Each notice has its own voice - from illiterate farmers to pompous nobles to mysterious strangers. Mix mundane (lost cat) with intriguing (strange lights seen). Some notices may reference the same events from different perspectives.',
      sections: [
        { id: 'header', name: 'Board Location', purpose: 'Set the scene', wordCountTarget: 30, contentGuidance: 'Name of establishment. Brief atmosphere.' },
        { id: 'job', name: 'Help Wanted', purpose: 'Work opportunities', wordCountTarget: 80, contentGuidance: 'Someone needs something done. Clear task and payment.' },
        { id: 'rumor', name: 'Local Talk', purpose: 'Gossip and rumors', wordCountTarget: 100, contentGuidance: 'What people are whispering about. May or may not be true.' },
        { id: 'announcement', name: 'Announcements', purpose: 'Public information', wordCountTarget: 80, contentGuidance: 'Upcoming events, changes, official notices.' },
        { id: 'personal', name: 'Personal Notices', purpose: 'Individual needs', wordCountTarget: 80, contentGuidance: 'Seeking companions, lost items, looking for relatives.' },
        { id: 'mysterious', name: 'Curious Posting', purpose: 'Hook for adventure', wordCountTarget: 60, contentGuidance: 'Something intriguing or ominous. Questions unanswered.', optional: true },
      ],
      wordCount: { min: 350, max: 550 },
      toneKeywords: ['varied', 'authentic', 'community', 'informal', 'diverse-voices'],
      include: ['spelling quirks for some posters', 'local slang', 'specific locations', 'realistic requests'],
      avoid: ['modern references', 'all notices sounding the same', 'only dramatic content'],
      entityUsage: 'Entities may post notices or be subjects of rumors. Different social classes write differently.',
      eventUsage: 'Events become rumors and gossip. Different takes on the same events add texture.',
      voice: 'Multiple first-person voices. Each notice reflects its poster - educated or not, local or foreign.',
    },
  },

  // 9. FIELD REPORT
  {
    id: 'field-report',
    name: 'Field Report',
    description: 'Military scout report, expedition log, or reconnaissance document',
    tags: ['document', 'military', 'reconnaissance', 'tactical'],
    format: 'document',
    entityRules: {
      primarySubjectCategories: ['collective', 'place'],
      supportingSubjectCategories: ['character', 'power', 'object'],
      roles: [
        { role: 'enemy-force', count: { min: 0, max: 2 }, description: 'Hostile faction or army being observed', selectionCriteria: 'Prefer entities from collective category' },
        { role: 'terrain-assessed', count: { min: 0, max: 2 }, description: 'Territory, fortification, or location being reported on', selectionCriteria: 'Prefer entities from place category' },
        { role: 'capability-observed', count: { min: 0, max: 2 }, description: 'Enemy abilities, magic, or weapons noted', selectionCriteria: 'Prefer entities from power category' },
        { role: 'reporting-unit', count: { min: 0, max: 1 }, description: 'Scout or reconnaissance party submitting report' },
        { role: 'strategic-asset', count: { min: 0, max: 1 }, description: 'Resource, weapon, or item of tactical importance', selectionCriteria: 'Prefer entities from object category' },
      ],
      maxCastSize: 6,
    },
    eventRules: cloneDocumentEventRules(),
    documentConfig: {
      documentType: 'military or expedition field report',
      contentInstructions: 'Write as a professional military or expedition report. Be concise and factual. Focus on tactically relevant information. Include honest assessment of situation. Recommend actions based on observations.',
      sections: [
        { id: 'header', name: 'Report Header', purpose: 'Identify document', wordCountTarget: 50, contentGuidance: 'Classification, date, unit, commander addressed.' },
        { id: 'objective', name: 'Mission & Status', purpose: 'Context', wordCountTarget: 60, contentGuidance: 'What the mission was. Current status of unit.' },
        { id: 'observations', name: 'Observations', purpose: 'Intelligence gathered', wordCountTarget: 200, contentGuidance: 'What was seen, heard, learned. Numbers, positions, movements.' },
        { id: 'encounters', name: 'Encounters', purpose: 'Contacts made', wordCountTarget: 100, contentGuidance: 'Any interactions with hostiles, locals, or allies. Outcomes.' },
        { id: 'assessment', name: 'Tactical Assessment', purpose: 'Analysis', wordCountTarget: 80, contentGuidance: 'What this means. Threats, opportunities, unknowns.' },
        { id: 'recommendations', name: 'Recommendations', purpose: 'Proposed actions', wordCountTarget: 60, contentGuidance: 'What the reporting officer suggests. Specific and actionable.' },
      ],
      wordCount: { min: 450, max: 650 },
      toneKeywords: ['professional', 'concise', 'tactical', 'factual', 'urgent'],
      include: ['numbers and quantities', 'directions and distances', 'time references', 'unit designations'],
      avoid: ['emotional language', 'speculation without marking it', 'irrelevant details', 'casual tone'],
      entityUsage: 'Entities are assets, hostiles, or contacts. Describe tactically - capabilities, positions.',
      eventUsage: 'Events are mission-relevant occurrences. Report with tactical implications.',
      voice: 'First person plural for unit actions. Third person for observations. Military register.',
    },
  },

  // 10. ARTISAN'S CATALOGUE
  {
    id: 'artisans-catalogue',
    name: "Artisan's Catalogue",
    description: 'Detailed catalog of items, artifacts, or creations with descriptions and provenance',
    tags: ['document', 'catalog', 'items', 'artifacts'],
    format: 'document',
    entityRules: {
      primarySubjectCategories: ['object'],
      supportingSubjectCategories: ['character', 'place', 'power', 'collective'],
      roles: [
        { role: 'catalogued-item', count: { min: 1, max: 3 }, description: 'Artifact, creation, or treasure being documented', selectionCriteria: 'Prefer entities from object category' },
        { role: 'creator-or-owner', count: { min: 0, max: 2 }, description: 'Artisan who made it or notable previous owners' },
        { role: 'provenance-place', count: { min: 0, max: 2 }, description: 'Locations significant to the item history', selectionCriteria: 'Prefer entities from place category' },
        { role: 'associated-power', count: { min: 0, max: 1 }, description: 'Ability or enchantment the item possesses', selectionCriteria: 'Prefer entities from power category' },
      ],
      maxCastSize: 6,
    },
    eventRules: cloneDocumentEventRules(),
    documentConfig: {
      documentType: 'item catalog or collection inventory',
      contentInstructions: 'Write as a knowledgeable collector or artisan documenting items. Balance technical description with evocative detail. Include provenance where known. Note special properties without being overly clinical. Each item should feel unique and desirable.',
      sections: [
        { id: 'introduction', name: 'Introduction', purpose: 'Frame the catalog', wordCountTarget: 80, contentGuidance: 'What this catalog covers. Notable inclusions. Curator credentials.' },
        { id: 'entry1', name: 'Catalog Entry', purpose: 'Document an item', wordCountTarget: 150, contentGuidance: 'Full description of one significant item. History, properties, significance.' },
        { id: 'entry2', name: 'Second Entry', purpose: 'Another item', wordCountTarget: 150, contentGuidance: 'Different type of item. Contrast with first entry.' },
        { id: 'entry3', name: 'Third Entry', purpose: 'Third item', wordCountTarget: 120, contentGuidance: 'Perhaps a more mysterious or less documented piece.', optional: true },
        { id: 'notes', name: "Curator's Notes", purpose: 'Additional context', wordCountTarget: 60, contentGuidance: 'Patterns observed, items sought, authentication concerns.', optional: true },
      ],
      wordCount: { min: 450, max: 700 },
      toneKeywords: ['knowledgeable', 'appreciative', 'detailed', 'authoritative', 'collector'],
      include: ['physical details', 'provenance', 'special properties', 'comparative value'],
      avoid: ['generic descriptions', 'identical formats for each item', 'excessive jargon'],
      entityUsage: 'Items may be associated with entities as creators or former owners.',
      eventUsage: 'Events give items history - "used in the Battle of X" or "created during the Y crisis."',
      voice: 'First person curatorial. Knowledgeable but accessible. Pride in the collection.',
    },
  },

  // 11. SACRED TEXT
  {
    id: 'sacred-text',
    name: 'Sacred Text',
    description: 'Religious scripture, prophecy, or spiritual teaching from a culture or faith tradition',
    tags: ['document', 'religious', 'spiritual', 'sacred'],
    format: 'document',
    entityRules: {
      primarySubjectCategories: ['concept', 'power', 'character'],
      supportingSubjectCategories: ['character', 'era', 'place', 'collective'],
      roles: [
        { role: 'divine-teaching', count: { min: 1, max: 2 }, description: 'Doctrine, law, or spiritual truth being revealed', selectionCriteria: 'Prefer entities from concept category' },
        { role: 'sacred-power', count: { min: 0, max: 1 }, description: 'Divine ability, blessing, or cosmic force', selectionCriteria: 'Prefer entities from power category' },
        { role: 'prophesied-era', count: { min: 0, max: 1 }, description: 'Age that was, is, or will be', selectionCriteria: 'Prefer entities from era category' },
        { role: 'divine-figure', count: { min: 0, max: 2 }, description: 'God, prophet, or holy person' },
        { role: 'sacred-place', count: { min: 0, max: 1 }, description: 'Holy site or realm', selectionCriteria: 'Prefer entities from place category' },
      ],
      maxCastSize: 6,
    },
    eventRules: cloneDocumentEventRules(),
    documentConfig: {
      documentType: 'religious or sacred text',
      contentInstructions: 'Write with reverence and weight appropriate to sacred literature. Use elevated language without being incomprehensible. Include cosmological claims, moral teachings, or prophetic visions. The text should feel ancient and authoritative. May include creation myths, commandments, prophecies, or wisdom teachings.',
      sections: [
        { id: 'invocation', name: 'Invocation', purpose: 'Opening sacred formula', wordCountTarget: 40, contentGuidance: 'Traditional opening. Names of the divine. Blessing on the reader.' },
        { id: 'teaching', name: 'Core Teaching', purpose: 'Central message', wordCountTarget: 200, contentGuidance: 'The main spiritual or moral content. Poetic structure. Memorable phrases.' },
        { id: 'parable', name: 'Parable or Vision', purpose: 'Illustrative story', wordCountTarget: 150, contentGuidance: 'A teaching story, prophetic vision, or divine encounter.', optional: true },
        { id: 'commandments', name: 'Precepts', purpose: 'Moral directives', wordCountTarget: 100, contentGuidance: 'What followers must do or avoid. Stated with authority.' },
        { id: 'blessing', name: 'Closing Blessing', purpose: 'Benediction', wordCountTarget: 50, contentGuidance: 'Final blessing, promise, or warning. Memorable closing.' },
      ],
      wordCount: { min: 400, max: 650 },
      toneKeywords: ['reverent', 'elevated', 'ancient', 'authoritative', 'poetic'],
      include: ['repetition for emphasis', 'metaphor and symbol', 'direct address to faithful', 'cosmic scope'],
      avoid: ['casual language', 'modern idioms', 'uncertainty or hedging', 'irony'],
      entityUsage: 'Divine beings, prophets, or founders may be named. Entities might be subjects of prophecy.',
      eventUsage: 'Mythic events, creation stories, or prophesied future events. Frame as eternal truths.',
      voice: 'Divine voice, prophetic utterance, or ancient sage. Second person for commandments. Third person for narrative.',
    },
  },

  // 12. PROVERBS & SAYINGS
  {
    id: 'proverbs-sayings',
    name: 'Proverbs & Sayings',
    description: 'Collection of folk wisdom, traditional sayings, and cultural aphorisms',
    tags: ['document', 'wisdom', 'folklore', 'cultural'],
    format: 'document',
    entityRules: {
      primarySubjectCategories: ['concept', 'collective'],
      supportingSubjectCategories: ['character', 'place', 'object'],
      roles: [
        { role: 'cultural-value', count: { min: 1, max: 3 }, description: 'Tradition, belief, or principle expressed in the sayings', selectionCriteria: 'Prefer entities from concept category' },
        { role: 'folk-hero', count: { min: 0, max: 2 }, description: 'Legendary figure referenced in proverbs' },
        { role: 'cultural-institution', count: { min: 0, max: 1 }, description: 'Guild, temple, or social group whose wisdom is cited', selectionCriteria: 'Prefer entities from collective category' },
        { role: 'proverbial-place', count: { min: 0, max: 1 }, description: 'Location referenced in cautionary tales', selectionCriteria: 'Prefer entities from place category' },
      ],
      maxCastSize: 6,
    },
    eventRules: cloneDocumentEventRules(),
    documentConfig: {
      documentType: 'collection of proverbs and sayings',
      contentInstructions: 'Create authentic-feeling folk wisdom. Proverbs should be pithy, memorable, and reveal cultural values. Use concrete imagery from the world (local animals, weather, trades). Some should be obvious in meaning, others more cryptic. Include contradictory proverbs - real cultures have these.',
      sections: [
        { id: 'introduction', name: 'Introduction', purpose: 'Frame the collection', wordCountTarget: 60, contentGuidance: 'Who uses these sayings. What they reveal about the culture.' },
        { id: 'common', name: 'Common Sayings', purpose: 'Everyday wisdom', wordCountTarget: 120, contentGuidance: '4-6 proverbs about daily life, work, family. Practical wisdom.' },
        { id: 'warnings', name: 'Cautionary Sayings', purpose: 'Warnings and taboos', wordCountTarget: 100, contentGuidance: '3-4 proverbs warning against folly, danger, or moral failure.' },
        { id: 'virtues', name: 'Virtue Sayings', purpose: 'Moral ideals', wordCountTarget: 100, contentGuidance: '3-4 proverbs praising positive qualities valued by the culture.' },
        { id: 'cryptic', name: 'Old Sayings', purpose: 'Ancient wisdom', wordCountTarget: 80, contentGuidance: '2-3 more mysterious proverbs. Meaning debated or lost.', optional: true },
      ],
      wordCount: { min: 350, max: 550 },
      toneKeywords: ['pithy', 'memorable', 'earthy', 'wise', 'traditional'],
      include: ['local imagery', 'rhythm and rhyme where natural', 'concrete metaphors', 'occasional contradictions'],
      avoid: ['modern concepts', 'abstract language', 'lengthy explanations within proverbs', 'forced rhymes'],
      entityUsage: 'Legendary figures might appear in sayings. "As [famous person] learned..." Cultural heroes and fools.',
      eventUsage: 'Historical events become cautionary tales. "Remember the [disaster]" type sayings.',
      voice: 'Collective wisdom. Third person observations. Some in imperative mood.',
    },
  },

  // 13. PRODUCT REVIEWS
  {
    id: 'product-reviews',
    name: 'Product Reviews',
    description: 'Customer testimonials and critiques of goods, services, or establishments',
    tags: ['document', 'commercial', 'reviews', 'informal'],
    format: 'document',
    entityRules: cloneDocumentEntityRules(),
    eventRules: cloneDocumentEventRules(),
    documentConfig: {
      documentType: 'collection of customer reviews',
      contentInstructions: 'Write authentic-feeling reviews with varied voices and opinions. Include glowing reviews, complaints, and nuanced takes. Reviewers have different priorities and writing abilities. Some reviews are helpful, others rambling or petty. Reference specific features, experiences, and comparisons. Use period-appropriate rating systems.',
      sections: [
        { id: 'header', name: 'Subject Header', purpose: 'Identify what is reviewed', wordCountTarget: 30, contentGuidance: 'Name of product/service/place. Vendor. Basic info.' },
        { id: 'positive', name: 'Satisfied Customer', purpose: 'Positive review', wordCountTarget: 100, contentGuidance: 'Enthusiastic review. Specific praise. Would recommend.' },
        { id: 'negative', name: 'Disappointed Customer', purpose: 'Negative review', wordCountTarget: 100, contentGuidance: 'Complaint with specifics. What went wrong. Warning to others.' },
        { id: 'nuanced', name: 'Balanced Review', purpose: 'Mixed opinion', wordCountTarget: 100, contentGuidance: 'Pros and cons. Specific use cases. Qualified recommendation.' },
        { id: 'brief', name: 'Quick Takes', purpose: 'Short reviews', wordCountTarget: 80, contentGuidance: '2-3 very brief reviews. Different perspectives. Varied literacy levels.' },
      ],
      wordCount: { min: 350, max: 500 },
      toneKeywords: ['varied', 'authentic', 'opinionated', 'specific', 'personal'],
      include: ['specific details', 'comparisons to alternatives', 'usage context', 'personality quirks'],
      avoid: ['identical voices', 'all positive or all negative', 'generic praise', 'modern review site language'],
      entityUsage: 'Reviewers are ordinary people. Vendor might be a known entity. Famous customers add credibility.',
      eventUsage: 'Reviews reference occasions. "Bought for the festival" or "Needed after the flood."',
      voice: 'Multiple first-person voices. Varied education levels and personalities. Some formal, some casual.',
    },
  },
];
