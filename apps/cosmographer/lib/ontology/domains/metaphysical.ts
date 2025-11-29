/**
 * Metaphysical Domain Categories
 *
 * Categories for spirit, energy, and dimensional plane types.
 */

import type { CategoryDefinition } from '../../types/index.js';

export const METAPHYSICAL_CATEGORIES: CategoryDefinition[] = [
  {
    id: 'ethereal',
    domainClass: 'metaphysical',
    label: 'Ethereal',
    description: 'The spirit world - ghosts, spirits, echo of material',
    keywords: [
      'ethereal', 'spirit', 'ghost', 'spectral', 'phantom', 'wraith',
      'incorporeal', 'immaterial', 'ectoplasm', 'shade', 'apparition',
      'specter', 'haunt'
    ],
    synonyms: ['spirit_world', 'ghostly'],
    basePriority: 3,
    defaultSaturation: 0.85,
    typicalParents: ['material'],
    typicalChildren: ['astral', 'shadow'],
    incompatibleWith: [],
    accessibilityWeight: 0.4,
    capacityMultiplier: 1.5
  },

  {
    id: 'astral',
    domainClass: 'metaphysical',
    label: 'Astral',
    description: 'The plane of thought - dreams, minds, consciousness',
    keywords: [
      'astral', 'dream', 'thought', 'mind', 'consciousness', 'psychic',
      'mental', 'dreamscape', 'mindscape', 'cognitive', 'noosphere',
      'ideation', 'oneiric'
    ],
    synonyms: ['dream_world', 'mental_plane'],
    basePriority: 4,
    defaultSaturation: 0.9,
    typicalParents: ['ethereal'],
    typicalChildren: ['void'],
    incompatibleWith: [],
    accessibilityWeight: 0.3,
    capacityMultiplier: 2.0 // Infinite mental space
  },

  {
    id: 'shadow',
    domainClass: 'metaphysical',
    label: 'Shadow',
    description: 'The dark reflection - shadow realm, negative space',
    keywords: [
      'shadow', 'dark', 'negative', 'reflection', 'mirror', 'umbra',
      'penumbra', 'shadowfell', 'gloom', 'darkness', 'twilight',
      'dusk', 'murk'
    ],
    synonyms: ['dark_world', 'shadow_realm'],
    basePriority: 4,
    defaultSaturation: 0.9,
    typicalParents: ['ethereal', 'material'],
    typicalChildren: ['void'],
    incompatibleWith: ['celestial_divine'],
    accessibilityWeight: 0.3,
    capacityMultiplier: 1.0
  },

  {
    id: 'elemental',
    domainClass: 'metaphysical',
    label: 'Elemental',
    description: 'Pure elemental planes - fire, water, earth, air',
    keywords: [
      'elemental', 'element', 'fire', 'water', 'earth', 'air',
      'primal', 'primordial', 'chaos', 'energy', 'force',
      'pure_element', 'plane_of_fire', 'plane_of_water'
    ],
    synonyms: ['inner_planes', 'elemental_chaos'],
    basePriority: 3,
    defaultSaturation: 0.8,
    typicalParents: ['material'],
    typicalChildren: [],
    incompatibleWith: [],
    accessibilityWeight: 0.5,
    capacityMultiplier: 0.8
  },

  {
    id: 'celestial_divine',
    domainClass: 'metaphysical',
    label: 'Celestial/Divine',
    description: 'The upper planes - heavens, divine realms',
    keywords: [
      'heaven', 'divine', 'celestial', 'holy', 'sacred', 'blessed',
      'paradise', 'elysium', 'mount_celestia', 'arcadia', 'empyrean',
      'seraphic', 'angelic'
    ],
    synonyms: ['upper_planes', 'heavenly'],
    basePriority: 5,
    defaultSaturation: 0.95,
    typicalParents: ['astral'],
    typicalChildren: [],
    incompatibleWith: ['infernal', 'shadow'],
    accessibilityWeight: 0.1,
    capacityMultiplier: 0.5
  },

  {
    id: 'infernal',
    domainClass: 'metaphysical',
    label: 'Infernal',
    description: 'The lower planes - hells, abyssal realms',
    keywords: [
      'hell', 'infernal', 'abyss', 'demon', 'devil', 'fiend',
      'damned', 'torment', 'gehenna', 'hades', 'tartarus',
      'perdition', 'underworld_spirit'
    ],
    synonyms: ['lower_planes', 'demonic'],
    basePriority: 5,
    defaultSaturation: 0.95,
    typicalParents: ['shadow'],
    typicalChildren: [],
    incompatibleWith: ['celestial_divine'],
    accessibilityWeight: 0.1,
    capacityMultiplier: 0.5
  },

  {
    id: 'void',
    domainClass: 'metaphysical',
    label: 'Void',
    description: 'The space between - emptiness, far realm, chaos',
    keywords: [
      'void', 'nothing', 'empty', 'far_realm', 'outside', 'beyond',
      'limbo', 'chaos', 'entropy', 'null', 'oblivion', 'formless',
      'primordial_chaos'
    ],
    synonyms: ['far_realm', 'outer_void'],
    basePriority: 6,
    defaultSaturation: 0.99,
    typicalParents: ['astral', 'shadow'],
    typicalChildren: [],
    incompatibleWith: [],
    accessibilityWeight: 0.05,
    capacityMultiplier: 10.0 // Infinite but hostile
  },

  {
    id: 'material',
    domainClass: 'metaphysical',
    label: 'Material',
    description: 'The prime material plane - physical reality baseline',
    keywords: [
      'material', 'prime', 'physical', 'real', 'mortal', 'mundane',
      'natural', 'worldly', 'corporeal', 'tangible'
    ],
    synonyms: ['prime_material', 'reality'],
    basePriority: 1,
    defaultSaturation: 0.7,
    typicalParents: [],
    typicalChildren: ['ethereal', 'shadow', 'elemental'],
    incompatibleWith: [],
    accessibilityWeight: 1.0,
    capacityMultiplier: 1.0
  },

  {
    id: 'temporal',
    domainClass: 'metaphysical',
    label: 'Temporal',
    description: 'Time-based planes - past echoes, future possibilities',
    keywords: [
      'time', 'temporal', 'past', 'future', 'chrono', 'history',
      'memory', 'echo', 'timeline', 'causality', 'paradox',
      'anachronism'
    ],
    synonyms: ['timestream', 'chronoplane'],
    basePriority: 5,
    defaultSaturation: 0.95,
    typicalParents: ['astral'],
    typicalChildren: [],
    incompatibleWith: [],
    accessibilityWeight: 0.1,
    capacityMultiplier: 3.0
  }
];
