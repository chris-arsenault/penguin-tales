/**
 * Legal/Rules Domain Categories
 *
 * Categories for law, governance, and rule system plane types.
 */

import type { CategoryDefinition } from '../../types/index.js';

export const LEGAL_CATEGORIES: CategoryDefinition[] = [
  {
    id: 'sovereign_law',
    domainClass: 'conceptual',
    label: 'Sovereign Law',
    description: 'Highest authority - imperial edicts, constitutional law',
    keywords: [
      'sovereign', 'constitutional', 'supreme', 'royal', 'imperial',
      'decree', 'edict', 'fundamental', 'charter', 'crown',
      'throne', 'monarch', 'emperor', 'king', 'divine_right'
    ],
    synonyms: ['highest_law', 'supreme_authority'],
    basePriority: 1,
    defaultSaturation: 0.6, // Limited capacity - few supreme laws
    typicalParents: [],
    typicalChildren: ['statutory_law', 'divine_law'],
    incompatibleWith: [],
    accessibilityWeight: 0.3, // Hard to access/change
    capacityMultiplier: 0.3
  },

  {
    id: 'divine_law',
    domainClass: 'conceptual',
    label: 'Divine Law',
    description: 'Religious law - commandments, sacred texts, religious authority',
    keywords: [
      'divine', 'religious', 'sacred', 'commandment', 'holy', 'scripture',
      'canon', 'ecclesiastical', 'temple', 'church', 'faith', 'doctrine',
      'dogma', 'covenant', 'prophecy'
    ],
    synonyms: ['religious_law', 'sacred_law'],
    basePriority: 1,
    defaultSaturation: 0.65,
    typicalParents: ['sovereign_law'],
    typicalChildren: ['customary_law'],
    incompatibleWith: [],
    accessibilityWeight: 0.4,
    capacityMultiplier: 0.5
  },

  {
    id: 'statutory_law',
    domainClass: 'conceptual',
    label: 'Statutory Law',
    description: 'Codified laws - legislation, regulations, written codes',
    keywords: [
      'statute', 'legislation', 'code', 'regulation', 'act', 'law',
      'ordinance', 'bylaw', 'codified', 'written', 'formal',
      'parliament', 'senate', 'council', 'assembly'
    ],
    synonyms: ['written_law', 'formal_law'],
    basePriority: 2,
    defaultSaturation: 0.75,
    typicalParents: ['sovereign_law'],
    typicalChildren: ['customary_law', 'guild_law', 'criminal_law'],
    incompatibleWith: [],
    accessibilityWeight: 0.6,
    capacityMultiplier: 0.8
  },

  {
    id: 'customary_law',
    domainClass: 'conceptual',
    label: 'Customary Law',
    description: 'Unwritten traditions - local customs, precedent, common law',
    keywords: [
      'custom', 'tradition', 'precedent', 'common_law', 'unwritten',
      'practice', 'convention', 'folkway', 'norm', 'usage',
      'hereditary', 'ancestral', 'traditional'
    ],
    synonyms: ['common_law', 'traditional_law'],
    basePriority: 3,
    defaultSaturation: 0.85,
    typicalParents: ['statutory_law', 'divine_law'],
    typicalChildren: ['informal_rules'],
    incompatibleWith: [],
    accessibilityWeight: 0.8,
    capacityMultiplier: 1.5
  },

  {
    id: 'guild_law',
    domainClass: 'conceptual',
    label: 'Guild/Corporate Law',
    description: 'Organizational rules - guild charters, corporate bylaws, professional codes',
    keywords: [
      'guild', 'corporate', 'charter', 'bylaws', 'organization',
      'association', 'union', 'professional', 'trade', 'merchant',
      'craft', 'company', 'syndicate', 'consortium'
    ],
    synonyms: ['organizational_law', 'professional_rules'],
    basePriority: 3,
    defaultSaturation: 0.8,
    typicalParents: ['statutory_law'],
    typicalChildren: ['informal_rules'],
    incompatibleWith: [],
    accessibilityWeight: 0.7,
    capacityMultiplier: 1.0
  },

  {
    id: 'criminal_law',
    domainClass: 'conceptual',
    label: 'Criminal Law',
    description: 'Prohibitions and punishments - crimes, sentences, enforcement',
    keywords: [
      'criminal', 'crime', 'punishment', 'sentence', 'felony',
      'offense', 'prohibition', 'penalty', 'justice', 'court',
      'trial', 'verdict', 'execution', 'imprisonment', 'fine'
    ],
    synonyms: ['penal_law', 'criminal_code'],
    basePriority: 2,
    defaultSaturation: 0.7,
    typicalParents: ['statutory_law', 'sovereign_law'],
    typicalChildren: [],
    incompatibleWith: [],
    accessibilityWeight: 0.4, // Enforcement-heavy
    capacityMultiplier: 0.6
  },

  {
    id: 'contract_law',
    domainClass: 'conceptual',
    label: 'Contract Law',
    description: 'Agreements and obligations - contracts, oaths, binding promises',
    keywords: [
      'contract', 'agreement', 'oath', 'promise', 'bond', 'obligation',
      'covenant', 'treaty', 'pact', 'compact', 'deal', 'bargain',
      'sworn', 'binding', 'vow'
    ],
    synonyms: ['obligation_law', 'agreement_law'],
    basePriority: 3,
    defaultSaturation: 0.8,
    typicalParents: ['statutory_law'],
    typicalChildren: [],
    incompatibleWith: [],
    accessibilityWeight: 0.7,
    capacityMultiplier: 1.2
  },

  {
    id: 'informal_rules',
    domainClass: 'conceptual',
    label: 'Informal Rules',
    description: 'Unspoken agreements - social norms, etiquette, honor codes',
    keywords: [
      'informal', 'unspoken', 'etiquette', 'honor', 'reputation',
      'face', 'shame', 'taboo', 'manners', 'protocol', 'courtesy',
      'social_norm', 'peer_pressure'
    ],
    synonyms: ['social_rules', 'honor_code'],
    basePriority: 4,
    defaultSaturation: 0.9,
    typicalParents: ['customary_law', 'guild_law'],
    typicalChildren: [],
    incompatibleWith: [],
    accessibilityWeight: 0.9,
    capacityMultiplier: 2.0
  },

  {
    id: 'outlaw',
    domainClass: 'conceptual',
    label: 'Outlaw/Criminal',
    description: 'Operating outside law - criminal codes, underworld rules',
    keywords: [
      'outlaw', 'criminal', 'underworld', 'black_market', 'smuggler',
      'thief', 'assassin', 'gang', 'mafia', 'syndicate', 'pirate',
      'bandit', 'rogue', 'contraband'
    ],
    synonyms: ['criminal_code', 'underworld_law'],
    basePriority: 4,
    defaultSaturation: 0.85,
    typicalParents: [],
    typicalChildren: [],
    incompatibleWith: ['sovereign_law', 'divine_law'],
    accessibilityWeight: 0.5,
    capacityMultiplier: 0.8
  }
];
