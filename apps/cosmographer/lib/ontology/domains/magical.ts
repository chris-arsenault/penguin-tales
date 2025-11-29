/**
 * Magical Domain Categories
 *
 * Categories for magic systems and supernatural power plane types.
 */

import type { CategoryDefinition } from '../../types/index.js';

export const MAGICAL_CATEGORIES: CategoryDefinition[] = [
  {
    id: 'arcane',
    domainClass: 'conceptual',
    label: 'Arcane Magic',
    description: 'Learned/scholarly magic - wizardry, formulaic casting, research',
    keywords: [
      'arcane', 'wizard', 'scholarly', 'formulaic', 'learned', 'academic',
      'sorcery', 'spellbook', 'ritual', 'incantation', 'enchantment',
      'conjuration', 'evocation', 'transmutation', 'abjuration',
      'divination', 'illusion', 'necromancy_school', 'mage', 'magus'
    ],
    synonyms: ['wizardry', 'high_magic', 'learned_magic'],
    basePriority: 1,
    defaultSaturation: 0.7,
    typicalParents: [],
    typicalChildren: ['elemental_magic', 'illusion_magic', 'necromancy'],
    incompatibleWith: [],
    accessibilityWeight: 0.6, // Requires study
    capacityMultiplier: 1.0
  },

  {
    id: 'divine_magic',
    domainClass: 'conceptual',
    label: 'Divine Magic',
    description: 'Granted by deities - clerical, faith-based, holy power',
    keywords: [
      'divine', 'holy', 'sacred', 'clerical', 'faith', 'blessing',
      'prayer', 'miracle', 'religious', 'priest', 'cleric', 'paladin',
      'zealot', 'devotion', 'worship', 'sanctified', 'consecrated'
    ],
    synonyms: ['holy_magic', 'clerical_magic', 'faith_magic'],
    basePriority: 1,
    defaultSaturation: 0.7,
    typicalParents: [],
    typicalChildren: ['healing_magic', 'protection_magic', 'smiting'],
    incompatibleWith: ['profane_magic'],
    accessibilityWeight: 0.5, // Requires devotion
    capacityMultiplier: 0.8
  },

  {
    id: 'primal',
    domainClass: 'conceptual',
    label: 'Primal Magic',
    description: 'Nature-derived - druidic, shamanic, natural forces',
    keywords: [
      'primal', 'nature', 'druidic', 'shamanic', 'wild', 'natural',
      'spirit', 'totem', 'animism', 'beast', 'plant', 'weather',
      'storm', 'growth', 'decay', 'cycle', 'seasonal', 'feral'
    ],
    synonyms: ['nature_magic', 'druid_magic', 'wild_magic'],
    basePriority: 2,
    defaultSaturation: 0.8,
    typicalParents: ['arcane', 'divine_magic'],
    typicalChildren: ['beast_magic', 'plant_magic', 'weather_magic'],
    incompatibleWith: [],
    accessibilityWeight: 0.7,
    capacityMultiplier: 1.2
  },

  {
    id: 'profane_magic',
    domainClass: 'conceptual',
    label: 'Profane/Dark Magic',
    description: 'Forbidden arts - necromancy, curses, blood magic, void',
    keywords: [
      'dark', 'forbidden', 'necromancy', 'curse', 'blood', 'death',
      'profane', 'unholy', 'corruption', 'blight', 'wither', 'drain',
      'soul', 'undead', 'lich', 'vampire', 'hex', 'malediction'
    ],
    synonyms: ['dark_magic', 'forbidden_magic', 'black_magic'],
    basePriority: 4,
    defaultSaturation: 0.9,
    typicalParents: ['arcane'],
    typicalChildren: [],
    incompatibleWith: ['divine_magic', 'healing_magic'],
    accessibilityWeight: 0.3, // Hidden, dangerous
    capacityMultiplier: 0.4
  },

  {
    id: 'psionic',
    domainClass: 'conceptual',
    label: 'Psionic Power',
    description: 'Mind-based - telepathy, telekinesis, mental projection',
    keywords: [
      'psionic', 'psychic', 'mental', 'mind', 'telepathy', 'telekinesis',
      'thought', 'consciousness', 'projection', 'empathy', 'precognition',
      'clairvoyance', 'domination', 'suggestion', 'illusion_mental'
    ],
    synonyms: ['psychic_power', 'mind_magic'],
    basePriority: 3,
    defaultSaturation: 0.85,
    typicalParents: [],
    typicalChildren: [],
    incompatibleWith: [],
    accessibilityWeight: 0.4,
    capacityMultiplier: 0.6
  },

  {
    id: 'elemental_magic',
    domainClass: 'conceptual',
    label: 'Elemental Magic',
    description: 'Command of elements - fire, water, earth, air, lightning',
    keywords: [
      'elemental', 'element', 'fire', 'water', 'earth', 'air',
      'lightning', 'ice', 'frost', 'flame', 'stone', 'wind',
      'pyromancy', 'hydromancy', 'geomancy', 'aeromancy', 'cryomancy'
    ],
    synonyms: ['element_magic', 'primal_element'],
    basePriority: 2,
    defaultSaturation: 0.75,
    typicalParents: ['arcane', 'primal'],
    typicalChildren: [],
    incompatibleWith: [],
    accessibilityWeight: 0.7,
    capacityMultiplier: 1.0
  },

  {
    id: 'healing_magic',
    domainClass: 'conceptual',
    label: 'Healing Magic',
    description: 'Restoration and mending - healing, curing, resurrection',
    keywords: [
      'healing', 'restoration', 'cure', 'mend', 'regeneration', 'life',
      'resurrect', 'revive', 'purify', 'cleanse', 'medicine', 'remedy',
      'balm', 'salve', 'rejuvenation'
    ],
    synonyms: ['restoration_magic', 'life_magic'],
    basePriority: 2,
    defaultSaturation: 0.75,
    typicalParents: ['divine_magic', 'primal'],
    typicalChildren: [],
    incompatibleWith: ['profane_magic', 'necromancy'],
    accessibilityWeight: 0.8,
    capacityMultiplier: 0.8
  },

  {
    id: 'illusion_magic',
    domainClass: 'conceptual',
    label: 'Illusion Magic',
    description: 'Deception and misdirection - phantasms, glamours, disguises',
    keywords: [
      'illusion', 'phantasm', 'glamour', 'disguise', 'deception', 'mirage',
      'invisibility', 'shadow_magic', 'false', 'figment', 'hallucination',
      'misdirection', 'trickery'
    ],
    synonyms: ['glamour_magic', 'shadow_magic'],
    basePriority: 3,
    defaultSaturation: 0.8,
    typicalParents: ['arcane'],
    typicalChildren: [],
    incompatibleWith: [],
    accessibilityWeight: 0.6,
    capacityMultiplier: 0.9
  },

  {
    id: 'summoning',
    domainClass: 'conceptual',
    label: 'Summoning',
    description: 'Calling entities - conjuration, binding, pacts',
    keywords: [
      'summoning', 'conjuration', 'binding', 'pact', 'call', 'invoke',
      'familiar', 'demon', 'angel', 'elemental', 'spirit', 'entity',
      'portal', 'gate', 'planar'
    ],
    synonyms: ['conjuration', 'binding_magic'],
    basePriority: 3,
    defaultSaturation: 0.85,
    typicalParents: ['arcane'],
    typicalChildren: [],
    incompatibleWith: [],
    accessibilityWeight: 0.5,
    capacityMultiplier: 0.7
  },

  {
    id: 'artifice',
    domainClass: 'conceptual',
    label: 'Artifice/Enchanting',
    description: 'Magic in objects - enchanting, runes, golems, constructs',
    keywords: [
      'artifice', 'enchanting', 'rune', 'golem', 'construct', 'artifact',
      'imbue', 'forge', 'craft', 'inscription', 'sigil', 'glyph',
      'automaton', 'mechanical', 'magical_item'
    ],
    synonyms: ['enchantment', 'runecraft'],
    basePriority: 2,
    defaultSaturation: 0.75,
    typicalParents: ['arcane'],
    typicalChildren: [],
    incompatibleWith: [],
    accessibilityWeight: 0.6,
    capacityMultiplier: 0.8
  },

  {
    id: 'chronomancy',
    domainClass: 'conceptual',
    label: 'Chronomancy',
    description: 'Time magic - manipulation of time, temporal effects',
    keywords: [
      'time', 'chrono', 'temporal', 'haste', 'slow', 'age', 'rewind',
      'loop', 'paradox', 'stasis', 'freeze', 'accelerate', 'decelerate',
      'prophecy', 'foresight'
    ],
    synonyms: ['time_magic', 'temporal_magic'],
    basePriority: 5,
    defaultSaturation: 0.95,
    typicalParents: ['arcane'],
    typicalChildren: [],
    incompatibleWith: [],
    accessibilityWeight: 0.1, // Extremely rare
    capacityMultiplier: 0.2
  },

  {
    id: 'necromancy',
    domainClass: 'conceptual',
    label: 'Necromancy',
    description: 'Death magic - undead, spirits of the dead, life force',
    keywords: [
      'necromancy', 'undead', 'zombie', 'skeleton', 'ghoul', 'ghost',
      'spirit', 'death', 'corpse', 'grave', 'tomb', 'lich',
      'soul', 'afterlife', 'raise_dead'
    ],
    synonyms: ['death_magic', 'undead_magic'],
    basePriority: 4,
    defaultSaturation: 0.9,
    typicalParents: ['arcane', 'profane_magic'],
    typicalChildren: [],
    incompatibleWith: ['divine_magic', 'healing_magic'],
    accessibilityWeight: 0.3,
    capacityMultiplier: 0.5
  }
];
