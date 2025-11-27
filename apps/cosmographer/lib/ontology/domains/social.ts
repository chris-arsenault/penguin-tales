/**
 * Social Domain Categories
 *
 * Categories for social structure, hierarchy, and relationship plane types.
 */

import type { CategoryDefinition } from '../../types/index.js';

export const SOCIAL_CATEGORIES: CategoryDefinition[] = [
  {
    id: 'nobility',
    domainClass: 'conceptual',
    label: 'Nobility/Aristocracy',
    description: 'Upper class by birth - lords, ladies, hereditary titles',
    keywords: [
      'noble', 'aristocrat', 'lord', 'lady', 'duke', 'count', 'baron',
      'earl', 'marquis', 'viscount', 'prince', 'princess', 'royal',
      'highborn', 'peerage', 'gentry', 'patrician'
    ],
    synonyms: ['aristocracy', 'upper_class', 'peerage'],
    basePriority: 1,
    defaultSaturation: 0.6, // Small exclusive class
    typicalParents: [],
    typicalChildren: ['gentry', 'merchant_class'],
    incompatibleWith: ['peasantry'],
    accessibilityWeight: 0.2, // Hard to enter
    capacityMultiplier: 0.2
  },

  {
    id: 'gentry',
    domainClass: 'conceptual',
    label: 'Gentry/Minor Nobility',
    description: 'Lesser nobility and landed elite - knights, squires',
    keywords: [
      'gentry', 'knight', 'squire', 'landed', 'minor_noble', 'esquire',
      'gentleman', 'gentlewoman', 'landowner', 'manor', 'estate'
    ],
    synonyms: ['minor_nobility', 'landed_class'],
    basePriority: 2,
    defaultSaturation: 0.7,
    typicalParents: ['nobility'],
    typicalChildren: ['merchant_class', 'professional'],
    incompatibleWith: [],
    accessibilityWeight: 0.4,
    capacityMultiplier: 0.4
  },

  {
    id: 'clergy',
    domainClass: 'conceptual',
    label: 'Clergy/Religious',
    description: 'Religious class - priests, monks, religious orders',
    keywords: [
      'clergy', 'priest', 'monk', 'nun', 'bishop', 'cardinal', 'pope',
      'abbot', 'friar', 'cleric', 'religious', 'order', 'temple',
      'church', 'monastery', 'convent', 'acolyte', 'deacon'
    ],
    synonyms: ['religious_class', 'priesthood'],
    basePriority: 2,
    defaultSaturation: 0.7,
    typicalParents: [],
    typicalChildren: [],
    incompatibleWith: [],
    accessibilityWeight: 0.5, // Open to devotion
    capacityMultiplier: 0.5
  },

  {
    id: 'merchant_class',
    domainClass: 'conceptual',
    label: 'Merchant Class',
    description: 'Trading and commerce - merchants, traders, bankers',
    keywords: [
      'merchant', 'trader', 'banker', 'commerce', 'bourgeois', 'burgher',
      'shopkeeper', 'vendor', 'dealer', 'broker', 'financier', 'guild',
      'market', 'trade', 'business', 'entrepreneur'
    ],
    synonyms: ['bourgeoisie', 'trading_class'],
    basePriority: 2,
    defaultSaturation: 0.75,
    typicalParents: ['gentry'],
    typicalChildren: ['artisan', 'professional'],
    incompatibleWith: [],
    accessibilityWeight: 0.7, // Wealth can enter
    capacityMultiplier: 0.8
  },

  {
    id: 'artisan',
    domainClass: 'conceptual',
    label: 'Artisan/Craftsman',
    description: 'Skilled labor - craftsmen, tradespeople, specialists',
    keywords: [
      'artisan', 'craftsman', 'smith', 'carpenter', 'mason', 'weaver',
      'potter', 'tailor', 'cobbler', 'jeweler', 'guild', 'apprentice',
      'journeyman', 'master', 'workshop', 'trade'
    ],
    synonyms: ['craftsman', 'skilled_labor'],
    basePriority: 3,
    defaultSaturation: 0.8,
    typicalParents: ['merchant_class'],
    typicalChildren: ['laborer'],
    incompatibleWith: [],
    accessibilityWeight: 0.8, // Skill can enter
    capacityMultiplier: 1.0
  },

  {
    id: 'professional',
    domainClass: 'conceptual',
    label: 'Professional',
    description: 'Educated specialists - lawyers, doctors, scholars',
    keywords: [
      'professional', 'lawyer', 'doctor', 'scholar', 'scribe', 'physician',
      'advocate', 'notary', 'professor', 'teacher', 'expert', 'specialist',
      'educated', 'learned', 'academic'
    ],
    synonyms: ['educated_class', 'specialists'],
    basePriority: 2,
    defaultSaturation: 0.7,
    typicalParents: ['merchant_class', 'gentry'],
    typicalChildren: [],
    incompatibleWith: [],
    accessibilityWeight: 0.5, // Requires education
    capacityMultiplier: 0.5
  },

  {
    id: 'military',
    domainClass: 'conceptual',
    label: 'Military',
    description: 'Martial class - soldiers, officers, warriors',
    keywords: [
      'military', 'soldier', 'warrior', 'officer', 'general', 'captain',
      'sergeant', 'guard', 'army', 'navy', 'legion', 'regiment',
      'mercenary', 'veteran', 'martial'
    ],
    synonyms: ['warrior_class', 'martial_class'],
    basePriority: 2,
    defaultSaturation: 0.75,
    typicalParents: [],
    typicalChildren: [],
    incompatibleWith: [],
    accessibilityWeight: 0.7,
    capacityMultiplier: 0.8
  },

  {
    id: 'laborer',
    domainClass: 'conceptual',
    label: 'Laborer/Worker',
    description: 'Working class - unskilled and semi-skilled workers',
    keywords: [
      'laborer', 'worker', 'servant', 'maid', 'porter', 'dock', 'miner',
      'common', 'working_class', 'employee', 'hand', 'help', 'staff'
    ],
    synonyms: ['working_class', 'common_worker'],
    basePriority: 3,
    defaultSaturation: 0.85,
    typicalParents: ['artisan'],
    typicalChildren: ['peasantry'],
    incompatibleWith: ['nobility'],
    accessibilityWeight: 0.9, // Easy to enter
    capacityMultiplier: 1.5
  },

  {
    id: 'peasantry',
    domainClass: 'conceptual',
    label: 'Peasantry',
    description: 'Rural lower class - farmers, serfs, villagers',
    keywords: [
      'peasant', 'farmer', 'serf', 'villager', 'rural', 'agrarian',
      'tenant', 'yeoman', 'country', 'field', 'harvest', 'plow',
      'commoner', 'lowborn'
    ],
    synonyms: ['rural_class', 'farming_class'],
    basePriority: 4,
    defaultSaturation: 0.9,
    typicalParents: ['laborer'],
    typicalChildren: [],
    incompatibleWith: ['nobility', 'gentry'],
    accessibilityWeight: 1.0,
    capacityMultiplier: 2.0 // Largest class
  },

  {
    id: 'outcast',
    domainClass: 'conceptual',
    label: 'Outcast/Marginalized',
    description: 'Social outcasts - beggars, criminals, exiles',
    keywords: [
      'outcast', 'beggar', 'criminal', 'exile', 'pariah', 'vagabond',
      'homeless', 'untouchable', 'slave', 'thrall', 'prisoner',
      'condemned', 'fugitive', 'reject', 'leper'
    ],
    synonyms: ['marginalized', 'underclass'],
    basePriority: 5,
    defaultSaturation: 0.95,
    typicalParents: [],
    typicalChildren: [],
    incompatibleWith: ['nobility', 'gentry', 'clergy'],
    accessibilityWeight: 0.9, // Easy to fall into
    capacityMultiplier: 0.5
  },

  {
    id: 'faction_political',
    domainClass: 'conceptual',
    label: 'Political Faction',
    description: 'Political groups - parties, movements, coalitions',
    keywords: [
      'faction', 'party', 'political', 'movement', 'coalition', 'bloc',
      'caucus', 'alliance', 'opposition', 'loyalist', 'rebel',
      'reformer', 'conservative', 'radical'
    ],
    synonyms: ['political_group', 'party'],
    basePriority: 2,
    defaultSaturation: 0.75,
    typicalParents: [],
    typicalChildren: [],
    incompatibleWith: [],
    accessibilityWeight: 0.6,
    capacityMultiplier: 1.0
  },

  {
    id: 'secret_society',
    domainClass: 'conceptual',
    label: 'Secret Society',
    description: 'Hidden organizations - cults, cabals, conspiracies',
    keywords: [
      'secret', 'society', 'cult', 'cabal', 'conspiracy', 'hidden',
      'underground', 'shadow', 'occult', 'brotherhood', 'sisterhood',
      'order', 'lodge', 'initiate', 'mystery'
    ],
    synonyms: ['hidden_group', 'cabal'],
    basePriority: 4,
    defaultSaturation: 0.9,
    typicalParents: [],
    typicalChildren: [],
    incompatibleWith: [],
    accessibilityWeight: 0.2, // Very hard to find/join
    capacityMultiplier: 0.3
  }
];
