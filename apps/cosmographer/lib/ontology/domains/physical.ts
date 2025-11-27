/**
 * Physical/Spatial Domain Categories
 *
 * Categories for geographic and physical plane types.
 */

import type { CategoryDefinition } from '../../types/index.js';

export const PHYSICAL_CATEGORIES: CategoryDefinition[] = [
  {
    id: 'surface',
    domainClass: 'spatial',
    label: 'Surface',
    description: 'Ground-level terrain - the default habitable layer',
    keywords: [
      'surface', 'ground', 'land', 'plains', 'terrain', 'earth', 'soil',
      'grassland', 'forest', 'desert', 'tundra', 'prairie', 'savanna',
      'mainland', 'continental', 'terrestrial'
    ],
    synonyms: ['topside', 'overworld', 'daylight'],
    basePriority: 1,
    defaultSaturation: 0.7,
    typicalParents: [],
    typicalChildren: ['subterranean', 'aquatic', 'elevated'],
    incompatibleWith: [],
    accessibilityWeight: 1.0,
    capacityMultiplier: 1.0
  },

  {
    id: 'subterranean',
    domainClass: 'spatial',
    label: 'Underground',
    description: 'Below-surface spaces - caves, tunnels, depths',
    keywords: [
      'underground', 'cave', 'cavern', 'tunnel', 'depths', 'below',
      'subterranean', 'underdark', 'mines', 'catacombs', 'burrow',
      'warren', 'grotto', 'hollow', 'delve', 'pit', 'chasm'
    ],
    synonyms: ['underworld', 'below-ground', 'deep'],
    basePriority: 3,
    defaultSaturation: 0.85,
    typicalParents: ['surface', 'aquatic'],
    typicalChildren: ['deep_subterranean'],
    incompatibleWith: ['elevated', 'celestial'],
    accessibilityWeight: 0.6,
    capacityMultiplier: 0.7
  },

  {
    id: 'deep_subterranean',
    domainClass: 'spatial',
    label: 'Deep Underground',
    description: 'The deepest reaches - abyssal caverns, magma chambers',
    keywords: [
      'abyss', 'deep', 'magma', 'core', 'bottomless', 'primordial',
      'underdark', 'nether', 'infernal_caves', 'lava', 'volcanic'
    ],
    basePriority: 5,
    defaultSaturation: 0.95,
    typicalParents: ['subterranean'],
    typicalChildren: [],
    incompatibleWith: ['elevated', 'celestial', 'aquatic'],
    accessibilityWeight: 0.2,
    capacityMultiplier: 0.3
  },

  {
    id: 'aquatic',
    domainClass: 'spatial',
    label: 'Aquatic',
    description: 'Water-based environments - seas, lakes, rivers',
    keywords: [
      'underwater', 'ocean', 'sea', 'aquatic', 'marine', 'lake',
      'river', 'coral', 'reef', 'coastal', 'tidal', 'wetland',
      'swamp', 'marsh', 'delta', 'estuary', 'lagoon'
    ],
    synonyms: ['water', 'subaquatic', 'pelagic'],
    basePriority: 2,
    defaultSaturation: 0.8,
    typicalParents: ['surface'],
    typicalChildren: ['deep_aquatic', 'subterranean'],
    incompatibleWith: ['elevated', 'celestial'],
    accessibilityWeight: 0.5,
    capacityMultiplier: 1.2
  },

  {
    id: 'deep_aquatic',
    domainClass: 'spatial',
    label: 'Deep Ocean',
    description: 'Abyssal depths - trenches, deep sea',
    keywords: [
      'abyss', 'trench', 'deep_sea', 'abyssal', 'hadal', 'benthic',
      'midnight_zone', 'bathyal', 'aphotic', 'depths'
    ],
    basePriority: 4,
    defaultSaturation: 0.9,
    typicalParents: ['aquatic'],
    typicalChildren: [],
    incompatibleWith: ['elevated', 'celestial', 'subterranean'],
    accessibilityWeight: 0.3,
    capacityMultiplier: 0.5
  },

  {
    id: 'elevated',
    domainClass: 'spatial',
    label: 'Elevated',
    description: 'Above-surface spaces - mountains, trees, sky',
    keywords: [
      'sky', 'aerial', 'mountain', 'peak', 'tower', 'cloud',
      'canopy', 'heights', 'floating', 'airborne', 'highland',
      'plateau', 'cliff', 'spire', 'summit', 'ridge'
    ],
    synonyms: ['above', 'high', 'lofty'],
    basePriority: 2,
    defaultSaturation: 0.75,
    typicalParents: ['surface'],
    typicalChildren: ['celestial'],
    incompatibleWith: ['subterranean', 'aquatic', 'deep_subterranean'],
    accessibilityWeight: 0.7,
    capacityMultiplier: 0.5
  },

  {
    id: 'celestial',
    domainClass: 'spatial',
    label: 'Celestial',
    description: 'The heavens - orbital, stellar, cosmic',
    keywords: [
      'celestial', 'orbital', 'space', 'stellar', 'cosmic', 'star',
      'moon', 'asteroid', 'station', 'satellite', 'void', 'vacuum',
      'nebula', 'heaven', 'firmament'
    ],
    synonyms: ['heavenly', 'astral_physical', 'outer'],
    basePriority: 4,
    defaultSaturation: 0.9,
    typicalParents: ['elevated'],
    typicalChildren: [],
    incompatibleWith: ['subterranean', 'aquatic', 'deep_subterranean', 'deep_aquatic'],
    accessibilityWeight: 0.2,
    capacityMultiplier: 2.0 // Vast but sparse
  },

  {
    id: 'frontier',
    domainClass: 'spatial',
    label: 'Frontier',
    description: 'Edge territories - unexplored, wild, distant',
    keywords: [
      'frontier', 'edge', 'border', 'wilderness', 'outpost', 'remote',
      'unexplored', 'wild', 'untamed', 'distant', 'fringe', 'rim',
      'periphery', 'badlands', 'wasteland'
    ],
    basePriority: 3,
    defaultSaturation: 0.85,
    typicalParents: ['surface', 'elevated', 'aquatic'],
    typicalChildren: [],
    incompatibleWith: [],
    accessibilityWeight: 0.4,
    capacityMultiplier: 1.5
  },

  {
    id: 'urban',
    domainClass: 'spatial',
    label: 'Urban',
    description: 'Built environments - cities, settlements, structures',
    keywords: [
      'city', 'urban', 'town', 'settlement', 'metropolis', 'district',
      'quarter', 'ward', 'neighborhood', 'street', 'building', 'structure',
      'fortress', 'castle', 'palace', 'temple'
    ],
    basePriority: 1,
    defaultSaturation: 0.6, // Dense, fills quickly
    typicalParents: ['surface'],
    typicalChildren: ['subterranean'], // Sewers, catacombs
    incompatibleWith: ['celestial', 'deep_aquatic'],
    accessibilityWeight: 1.0,
    capacityMultiplier: 0.4 // Limited space
  }
];
