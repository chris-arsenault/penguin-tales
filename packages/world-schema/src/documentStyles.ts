/**
 * Document Style Types and Defaults
 *
 * Defines document-based narrative styles for in-universe documents
 * like news articles, treaties, letters, etc.
 *
 * Design principle: Mirrors story styles - freeform text blocks over structured micro-fields.
 * The LLM works best with natural language guidance, not fragmented config.
 */

import type { RoleDefinition } from './narrativeStyles.js';

/**
 * Document narrative style - for in-universe document formats
 *
 * Simplified structure that mirrors StoryNarrativeStyle:
 * - Freeform text blocks for guidance (documentInstructions, eventInstructions)
 * - Minimal structure for genuinely useful constraints (roles, pacing)
 */
export interface DocumentNarrativeStyle {
  format: 'document';

  // === Metadata (same as story) ===
  /** Unique identifier */
  id: string;
  /** Display name */
  name: string;
  /** Description shown in UI */
  description: string;
  /** Tags for categorization */
  tags?: string[];

  // === Freeform Text Blocks (injected directly into prompts) ===

  /**
   * Document structure and style instructions - how to write the document.
   * Includes: document type, section structure, voice, tone, what to include/avoid.
   * This is the primary guidance for document generation.
   */
  documentInstructions: string;

  /**
   * Event usage instructions - how to incorporate world events.
   * Optional - only needed if events require special handling.
   */
  eventInstructions?: string;

  // === Structured Data (genuinely useful as structured) ===

  /** Cast roles - what positions exist in this document */
  roles: RoleDefinition[];

  /** Pacing - word count range */
  pacing: {
    wordCount: { min: number; max: number };
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

    documentInstructions: `This is an official news dispatch meant to be read aloud in the town square.

STRUCTURE:
- Headline (~15 words): Punchy, declarative. Start with action verb or dramatic noun.
- Lead Paragraph (~60 words): Essential facts - who did what, where, and why it matters to the common folk.
- Full Account (~200 words): Expand on events, include witness accounts or official statements.
- Implications (~80 words): How this affects trade, safety, daily life. What might happen next.

VOICE & TONE: Third person, present tense for immediacy. Authoritative, urgent, formal-but-accessible. The voice of an official announcer.

Include specific names, locations, dates/times, official titles, and direct quotes. Reference entities by full title and name. Important figures should be quoted or mentioned.

Avoid modern journalism terms, passive voice in headlines, speculation presented as fact.`,

    eventInstructions: 'Events are the news. Present them as recent occurrences with immediate relevance.',

    roles: [
      { role: 'newsworthy-subject', count: { min: 1, max: 2 }, description: 'The occurrence or entity being announced' },
      { role: 'affected-territory', count: { min: 0, max: 2 }, description: 'Locations impacted by the news' },
      { role: 'faction-involved', count: { min: 0, max: 2 }, description: 'Organizations, kingdoms, or groups in the news' },
      { role: 'notable-figure', count: { min: 0, max: 2 }, description: 'Persons of importance mentioned' },
    ],

    pacing: {
      wordCount: { min: 300, max: 500 },
    },
  },

  // 2. TREATISE ON POWERS
  {
    id: 'treatise-powers',
    name: 'Treatise on Powers',
    description: 'Scholarly analysis of abilities, magic, or supernatural phenomena',
    tags: ['document', 'scholarly', 'abilities', 'academic'],
    format: 'document',

    documentInstructions: `This is an academic treatise presenting scholarly findings to peers.

STRUCTURE:
- Abstract (~80 words): Concise overview of what was studied and concluded.
- Introduction (~100 words): Why this ability matters. Historical context. What questions this treatise addresses.
- Observations (~200 words): Documented instances, effects observed, conditions required. Be specific.
- Theoretical Analysis (~150 words): What the observations suggest. How this connects to known principles.
- Caveats (~80 words): Risks of misuse, limitations, ethical considerations.
- Conclusion (~60 words): Key takeaways, questions for future study.

VOICE & TONE: Third person academic. First person plural ("we observe") for analysis. Formal register. Scholarly, precise, analytical, measured, authoritative.

Include technical terminology, specific examples, qualifications, citations to authorities. Reference documented capabilities of entities with abilities.

Avoid casual language, unsubstantiated claims, sensationalism, first person singular.`,

    eventInstructions: 'Events serve as case studies or evidence. Cite specific instances where powers manifested.',

    roles: [
      { role: 'studied-power', count: { min: 1, max: 2 }, description: 'The ability, magic, or phenomenon being analyzed' },
      { role: 'documented-practitioner', count: { min: 0, max: 2 }, description: 'Those who wield or manifest the power' },
      { role: 'scholarly-authority', count: { min: 0, max: 1 }, description: 'Expert or institution lending credibility' },
      { role: 'related-artifact', count: { min: 0, max: 2 }, description: 'Objects associated with the power' },
    ],

    pacing: {
      wordCount: { min: 600, max: 900 },
    },
  },

  // 3. MERCHANT'S BROADSHEET
  {
    id: 'merchants-broadsheet',
    name: "Merchant's Broadsheet",
    description: 'Commercial advertisement, trade announcement, or market bulletin',
    tags: ['document', 'commercial', 'trade', 'advertisement'],
    format: 'document',

    documentInstructions: `This is a commercial advertisement from a merchant trying to attract customers.

STRUCTURE:
- Attention Grabber (~30 words): Bold claim, question, or announcement. Make them curious.
- What We Offer (~150 words): Describe items with appeal. Focus on benefits, not just features.
- Why Trust Us (~80 words): Years of experience, famous customers, quality guarantees.
- Satisfied Customers (~60 words, optional): Quote from a satisfied buyer. Name and location add authenticity.
- Visit Us (~40 words): Where to find them, when open, special current deals.

VOICE & TONE: First person from merchant, or third person promotional. Enthusiastic, persuasive, confident, welcoming, urgent - but genuine.

Include specific products, prices or barter terms, location details, merchant personality. Items might reference artifacts or abilities.

Avoid modern marketing jargon, obvious lies, threatening language, desperation.`,

    eventInstructions: 'Recent events create opportunities. "After the siege, rebuilding supplies in high demand!"',

    roles: [
      { role: 'merchant', count: { min: 1, max: 1 }, description: 'The seller with personality and credibility' },
      { role: 'featured-goods', count: { min: 1, max: 3 }, description: 'Products or services being advertised' },
      { role: 'satisfied-customer', count: { min: 0, max: 1 }, description: 'Testimonial source' },
    ],

    pacing: {
      wordCount: { min: 300, max: 450 },
    },
  },

  // 4. COLLECTED CORRESPONDENCE
  {
    id: 'collected-letters',
    name: 'Collected Correspondence',
    description: 'Exchange of letters between entities revealing relationships and events',
    tags: ['document', 'letters', 'personal', 'epistolary'],
    format: 'document',

    documentInstructions: `This is a collection of authentic personal letters between entities.

STRUCTURE:
- Editor's Note (~60 words): Why these letters were preserved. Who the correspondents were.
- First Letter (~200 words): Initial communication. Raises questions, shares news, makes a request.
- Reply (~200 words): Addresses the first letter. Reveals the other perspective. Deepens the situation.
- Final Letter (~180 words, optional): Concludes the exchange or leaves tantalizing loose ends.

VOICE & TONE: First person from each writer. Each letter has distinct voice matching the entity. Personal, intimate, revealing, period-appropriate, distinctive-voices.

Include personal details, emotional subtext, period greetings/closings, references to shared history. Their bond should be evident in how they write.

Avoid identical voices, exposition dumps, modern idioms, perfect information.`,

    eventInstructions: 'Events are what they write about. News, reactions, consequences discussed in personal terms.',

    roles: [
      { role: 'correspondent-a', count: { min: 1, max: 1 }, description: 'First letter writer' },
      { role: 'correspondent-b', count: { min: 1, max: 1 }, description: 'Second letter writer / respondent' },
      { role: 'mentioned-party', count: { min: 0, max: 2 }, description: 'People or groups discussed in the letters' },
    ],

    pacing: {
      wordCount: { min: 500, max: 800 },
    },
  },

  // 5. CHRONICLE ENTRY
  {
    id: 'chronicle-entry',
    name: 'Chronicle Entry',
    description: 'Official historical record or archive entry documenting events',
    tags: ['document', 'historical', 'official', 'archive'],
    format: 'document',

    documentInstructions: `This is an official historical chronicle entry documenting events for posterity.

STRUCTURE:
- Entry Header (~40 words): Date, period, chronicler identification.
- Events Recorded (~250 words): Chronological account. Specific details. Who did what.
- Significance (~100 words): Why this matters. How it connects to other events. Precedents.
- Notable Figures (~80 words): List key entities and their roles. Titles and affiliations.
- Chronicler's Notes (~60 words, optional): Uncertainties, conflicting accounts, personal reflections.

VOICE & TONE: Third person objective. The chronicler may intrude briefly in notes sections. Objective, formal, precise, archival, measured.

Include specific dates, full titles, source attribution, cross-references. Use full titles and note entity roles.

Avoid emotional language, speculation as fact, modern historical terms, bias without acknowledgment.`,

    eventInstructions: 'Events are the primary content. Document them with precision and context.',

    roles: [
      { role: 'era-documented', count: { min: 0, max: 1 }, description: 'The age or period being recorded' },
      { role: 'pivotal-event', count: { min: 0, max: 2 }, description: 'Key occurrence being chronicled' },
      { role: 'historical-figure', count: { min: 0, max: 3 }, description: 'Notable persons documented' },
      { role: 'faction-recorded', count: { min: 0, max: 2 }, description: 'Organizations or powers mentioned' },
      { role: 'chronicler', count: { min: 0, max: 1 }, description: 'The voice recording history' },
    ],

    pacing: {
      wordCount: { min: 450, max: 650 },
    },
  },

  // 6. WANTED NOTICE
  {
    id: 'wanted-notice',
    name: 'Wanted Notice',
    description: 'Bounty poster, warning notice, or official alert about a person or threat',
    tags: ['document', 'warning', 'bounty', 'official'],
    format: 'document',

    documentInstructions: `This is an official notice meant to be posted publicly - a wanted poster or warning.

STRUCTURE:
- Alert Header (~20 words): WANTED, REWARD OFFERED, or WARNING. Large and clear.
- Subject Description (~100 words): Name, aliases, physical description, distinguishing marks, known abilities.
- Crimes/Reason (~80 words): List of offenses or reason for the notice. Specific incidents.
- Reward & Contact (~60 words): What is offered. Where to report. Conditions.
- Cautions (~40 words): Danger level. Do not approach. Special abilities to watch for.

VOICE & TONE: Official third person. Terse, declarative sentences. Commands where appropriate. Urgent, official, direct, warning, authoritative.

Include specific physical details, last known location, bounty amount, authority seal. Describe the subject as someone might identify them on sight.

Avoid ambiguity, lengthy prose, humor, speculation.`,

    eventInstructions: 'Events are the crimes or incidents. Reference specific acts.',

    roles: [
      { role: 'wanted-subject', count: { min: 1, max: 1 }, description: 'The person or entity being sought' },
      { role: 'issuing-authority', count: { min: 0, max: 1 }, description: 'Who posted the notice' },
      { role: 'victim', count: { min: 0, max: 2 }, description: 'Those harmed by the subject' },
    ],

    pacing: {
      wordCount: { min: 250, max: 400 },
    },
  },

  // 7. DIPLOMATIC ACCORD
  {
    id: 'diplomatic-accord',
    name: 'Diplomatic Accord',
    description: 'Treaty, alliance agreement, or formal pact between factions',
    tags: ['document', 'diplomatic', 'treaty', 'formal'],
    format: 'document',

    documentInstructions: `This is a formal diplomatic treaty or accord between powers.

STRUCTURE:
- Treaty Title (~20 words): Formal name including parties and purpose.
- Preamble (~100 words): Why the parties come together. Shared interests. Diplomatic language.
- Articles (~300 words): Numbered articles with clear terms. Rights, obligations, conditions.
- Enforcement & Duration (~80 words): How violations are handled. How long this lasts. Renewal terms.
- Signatures (~60 words): Who signs, their titles, date, location of signing.

VOICE & TONE: Third person formal. Legal register. "The parties hereby agree..." style. Formal, precise, diplomatic, binding, ceremonial.

Include specific obligations, mutual commitments, enforcement mechanisms, formal titles. Use full titles and formal names for parties.

Avoid ambiguous terms, one-sided benefits, informal language, unenforceable clauses.`,

    eventInstructions: 'Events may be what led to the treaty - referenced in preamble as context.',

    roles: [
      { role: 'signatory-faction', count: { min: 2, max: 4 }, description: 'Party to the accord' },
      { role: 'binding-principle', count: { min: 0, max: 2 }, description: 'Law, tradition, or doctrine being established or invoked' },
      { role: 'territorial-subject', count: { min: 0, max: 2 }, description: 'Land or region covered by the accord' },
      { role: 'signatory-leader', count: { min: 0, max: 2 }, description: 'Representative who signs on behalf of faction' },
    ],

    pacing: {
      wordCount: { min: 500, max: 750 },
    },
  },

  // 8. TAVERN NOTICE BOARD
  {
    id: 'tavern-notices',
    name: 'Tavern Notice Board',
    description: 'Collection of community postings: jobs, rumors, announcements, personal ads',
    tags: ['document', 'community', 'rumors', 'informal'],
    format: 'document',

    documentInstructions: `This is a collection of notices as they would appear on a public tavern board.

STRUCTURE:
- Board Location (~30 words): Name of establishment. Brief atmosphere.
- Help Wanted (~80 words): Someone needs something done. Clear task and payment.
- Local Talk (~100 words): What people are whispering about. May or may not be true.
- Announcements (~80 words): Upcoming events, changes, official notices.
- Personal Notices (~80 words): Seeking companions, lost items, looking for relatives.
- Curious Posting (~60 words, optional): Something intriguing or ominous. Questions unanswered.

VOICE & TONE: Multiple first-person voices. Each notice reflects its poster - educated or not, local or foreign. Varied, authentic, community, informal, diverse-voices.

Include spelling quirks for some posters, local slang, specific locations, realistic requests. Different social classes write differently.

Avoid modern references, all notices sounding the same, only dramatic content.`,

    eventInstructions: 'Events become rumors and gossip. Different takes on the same events add texture.',

    roles: [
      { role: 'establishment', count: { min: 0, max: 1 }, description: 'The tavern or public house hosting the board' },
      { role: 'job-poster', count: { min: 0, max: 1 }, description: 'Someone seeking help' },
      { role: 'rumor-subject', count: { min: 0, max: 2 }, description: 'Person or event being gossiped about' },
      { role: 'mysterious-poster', count: { min: 0, max: 1 }, description: 'Unknown entity leaving intriguing notice' },
    ],

    pacing: {
      wordCount: { min: 350, max: 550 },
    },
  },

  // 9. FIELD REPORT
  {
    id: 'field-report',
    name: 'Field Report',
    description: 'Military scout report, expedition log, or reconnaissance document',
    tags: ['document', 'military', 'reconnaissance', 'tactical'],
    format: 'document',

    documentInstructions: `This is a professional military or expedition field report.

STRUCTURE:
- Report Header (~50 words): Classification, date, unit, commander addressed.
- Mission & Status (~60 words): What the mission was. Current status of unit.
- Observations (~200 words): What was seen, heard, learned. Numbers, positions, movements.
- Encounters (~100 words): Any interactions with hostiles, locals, or allies. Outcomes.
- Tactical Assessment (~80 words): What this means. Threats, opportunities, unknowns.
- Recommendations (~60 words): What the reporting officer suggests. Specific and actionable.

VOICE & TONE: First person plural for unit actions. Third person for observations. Military register. Professional, concise, tactical, factual, urgent.

Include numbers and quantities, directions and distances, time references, unit designations. Describe entities tactically - capabilities, positions.

Avoid emotional language, speculation without marking it, irrelevant details, casual tone.`,

    eventInstructions: 'Events are mission-relevant occurrences. Report with tactical implications.',

    roles: [
      { role: 'enemy-force', count: { min: 0, max: 2 }, description: 'Hostile faction or army being observed' },
      { role: 'terrain-assessed', count: { min: 0, max: 2 }, description: 'Territory, fortification, or location being reported on' },
      { role: 'capability-observed', count: { min: 0, max: 2 }, description: 'Enemy abilities, magic, or weapons noted' },
      { role: 'reporting-unit', count: { min: 0, max: 1 }, description: 'Scout or reconnaissance party submitting report' },
      { role: 'strategic-asset', count: { min: 0, max: 1 }, description: 'Resource, weapon, or item of tactical importance' },
    ],

    pacing: {
      wordCount: { min: 450, max: 650 },
    },
  },

  // 10. ARTISAN'S CATALOGUE
  {
    id: 'artisans-catalogue',
    name: "Artisan's Catalogue",
    description: 'Detailed catalog of items, artifacts, or creations with descriptions and provenance',
    tags: ['document', 'catalog', 'items', 'artifacts'],
    format: 'document',

    documentInstructions: `This is an item catalog or collection inventory from a knowledgeable collector or artisan.

STRUCTURE:
- Introduction (~80 words): What this catalog covers. Notable inclusions. Curator credentials.
- Catalog Entry (~150 words): Full description of one significant item. History, properties, significance.
- Second Entry (~150 words): Different type of item. Contrast with first entry.
- Third Entry (~120 words, optional): Perhaps a more mysterious or less documented piece.
- Curator's Notes (~60 words, optional): Patterns observed, items sought, authentication concerns.

VOICE & TONE: First person curatorial. Knowledgeable but accessible. Pride in the collection. Knowledgeable, appreciative, detailed, authoritative.

Include physical details, provenance, special properties, comparative value. Items may be associated with entities as creators or former owners.

Avoid generic descriptions, identical formats for each item, excessive jargon.`,

    eventInstructions: 'Events give items history - "used in the Battle of X" or "created during the Y crisis."',

    roles: [
      { role: 'catalogued-item', count: { min: 1, max: 3 }, description: 'Artifact, creation, or treasure being documented' },
      { role: 'creator-or-owner', count: { min: 0, max: 2 }, description: 'Artisan who made it or notable previous owners' },
      { role: 'provenance-place', count: { min: 0, max: 2 }, description: 'Locations significant to the item history' },
      { role: 'associated-power', count: { min: 0, max: 1 }, description: 'Ability or enchantment the item possesses' },
    ],

    pacing: {
      wordCount: { min: 450, max: 700 },
    },
  },

  // 11. SACRED TEXT
  {
    id: 'sacred-text',
    name: 'Sacred Text',
    description: 'Religious scripture, prophecy, or spiritual teaching from a culture or faith tradition',
    tags: ['document', 'religious', 'spiritual', 'sacred'],
    format: 'document',

    documentInstructions: `This is a religious or sacred text with reverence and weight appropriate to sacred literature.

STRUCTURE:
- Invocation (~40 words): Traditional opening. Names of the divine. Blessing on the reader.
- Core Teaching (~200 words): The main spiritual or moral content. Poetic structure. Memorable phrases.
- Parable or Vision (~150 words, optional): A teaching story, prophetic vision, or divine encounter.
- Precepts (~100 words): What followers must do or avoid. Stated with authority.
- Closing Blessing (~50 words): Final blessing, promise, or warning. Memorable closing.

VOICE & TONE: Divine voice, prophetic utterance, or ancient sage. Second person for commandments. Third person for narrative. Reverent, elevated, ancient, authoritative, poetic.

Include repetition for emphasis, metaphor and symbol, direct address to faithful, cosmic scope. Divine beings, prophets, or founders may be named.

Avoid casual language, modern idioms, uncertainty or hedging, irony.`,

    eventInstructions: 'Mythic events, creation stories, or prophesied future events. Frame as eternal truths.',

    roles: [
      { role: 'divine-teaching', count: { min: 1, max: 2 }, description: 'Doctrine, law, or spiritual truth being revealed' },
      { role: 'sacred-power', count: { min: 0, max: 1 }, description: 'Divine ability, blessing, or cosmic force' },
      { role: 'prophesied-era', count: { min: 0, max: 1 }, description: 'Age that was, is, or will be' },
      { role: 'divine-figure', count: { min: 0, max: 2 }, description: 'God, prophet, or holy person' },
      { role: 'sacred-place', count: { min: 0, max: 1 }, description: 'Holy site or realm' },
    ],

    pacing: {
      wordCount: { min: 400, max: 650 },
    },
  },

  // 12. PROVERBS & SAYINGS
  {
    id: 'proverbs-sayings',
    name: 'Proverbs & Sayings',
    description: 'Collection of folk wisdom, traditional sayings, and cultural aphorisms',
    tags: ['document', 'wisdom', 'folklore', 'cultural'],
    format: 'document',

    documentInstructions: `This is a collection of authentic-feeling folk wisdom and proverbs.

STRUCTURE:
- Introduction (~60 words): Who uses these sayings. What they reveal about the culture.
- Common Sayings (~120 words): 4-6 proverbs about daily life, work, family. Practical wisdom.
- Cautionary Sayings (~100 words): 3-4 proverbs warning against folly, danger, or moral failure.
- Virtue Sayings (~100 words): 3-4 proverbs praising positive qualities valued by the culture.
- Old Sayings (~80 words, optional): 2-3 more mysterious proverbs. Meaning debated or lost.

VOICE & TONE: Collective wisdom. Third person observations. Some in imperative mood. Pithy, memorable, earthy, wise, traditional.

Include local imagery, rhythm and rhyme where natural, concrete metaphors, occasional contradictions. Legendary figures might appear in sayings.

Avoid modern concepts, abstract language, lengthy explanations within proverbs, forced rhymes.`,

    eventInstructions: 'Historical events become cautionary tales. "Remember the [disaster]" type sayings.',

    roles: [
      { role: 'cultural-value', count: { min: 1, max: 3 }, description: 'Tradition, belief, or principle expressed in the sayings' },
      { role: 'folk-hero', count: { min: 0, max: 2 }, description: 'Legendary figure referenced in proverbs' },
      { role: 'cultural-institution', count: { min: 0, max: 1 }, description: 'Guild, temple, or social group whose wisdom is cited' },
      { role: 'proverbial-place', count: { min: 0, max: 1 }, description: 'Location referenced in cautionary tales' },
    ],

    pacing: {
      wordCount: { min: 350, max: 550 },
    },
  },

  // 13. PRODUCT REVIEWS
  {
    id: 'product-reviews',
    name: 'Product Reviews',
    description: 'Customer testimonials and critiques of goods, services, or establishments',
    tags: ['document', 'commercial', 'reviews', 'informal'],
    format: 'document',

    documentInstructions: `This is a collection of authentic-feeling customer reviews with varied voices and opinions.

STRUCTURE:
- Subject Header (~30 words): Name of product/service/place. Vendor. Basic info.
- Satisfied Customer (~100 words): Enthusiastic review. Specific praise. Would recommend.
- Disappointed Customer (~100 words): Complaint with specifics. What went wrong. Warning to others.
- Balanced Review (~100 words): Pros and cons. Specific use cases. Qualified recommendation.
- Quick Takes (~80 words): 2-3 very brief reviews. Different perspectives. Varied literacy levels.

VOICE & TONE: Multiple first-person voices. Varied education levels and personalities. Some formal, some casual. Varied, authentic, opinionated, specific, personal.

Include specific details, comparisons to alternatives, usage context, personality quirks. Reviewers are ordinary people. Vendor might be a known entity.

Avoid identical voices, all positive or all negative, generic praise, modern review site language.`,

    eventInstructions: 'Reviews reference occasions. "Bought for the festival" or "Needed after the flood."',

    roles: [
      { role: 'reviewed-subject', count: { min: 1, max: 1 }, description: 'Product, service, or establishment being reviewed' },
      { role: 'vendor', count: { min: 0, max: 1 }, description: 'The seller or provider' },
      { role: 'notable-reviewer', count: { min: 0, max: 1 }, description: 'Famous customer whose opinion carries weight' },
    ],

    pacing: {
      wordCount: { min: 350, max: 500 },
    },
  },
];
