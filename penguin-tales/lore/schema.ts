/**
 * Penguin Domain Schema
 *
 * Defines all penguin-specific world knowledge:
 * - Entity kinds and their subtypes/statuses
 * - Relationship kinds and their mutability
 * - Name generation
 * - Validation rules
 */

import {
  BaseDomainSchema,
  EntityKindDefinition,
  RelationshipKindDefinition,
  RelationshipConfig,
  RelationshipLimits,
  CultureDefinition,
  SnapshotConfig,
  EmergentDiscoveryConfig
} from '@lore-weave/core/types/domainSchema';
import { pickRandom } from '@lore-weave/core/utils/helpers';
import {
  getActionDomains,
  getActionDomainsForEntity,
  getPressureDomainMappings
} from './config/actionDomains';
import { penguinRegionConfig } from './config/regions';

// ===========================
// SNAPSHOT CONFIGURATIONS
// ===========================

/**
 * Location snapshot config - Tier 1 enrichment priority
 * Track population changes and control shifts
 */
const locationSnapshotConfig: SnapshotConfig = {
  trackedRelationships: [
    { kind: 'resident_of', direction: 'dst', countThreshold: 3, trackIds: false },
    { kind: 'stronghold_of', direction: 'dst', trackIds: true },
    { kind: 'controls', direction: 'dst', trackIds: true }
  ],
  enrichmentCooldown: 10,
  enrichmentPriority: 1
};

/**
 * Faction snapshot config - Tier 1 enrichment priority
 * Track leadership, territory, and diplomatic changes
 */
const factionSnapshotConfig: SnapshotConfig = {
  trackedRelationships: [
    { kind: 'leader_of', direction: 'dst', trackIds: true },
    { kind: 'stronghold_of', direction: 'src', countThreshold: 1, trackIds: true },
    { kind: 'allied_with', direction: 'src', trackIds: true },
    { kind: 'at_war_with', direction: 'src', trackIds: true }
  ],
  enrichmentCooldown: 10,
  enrichmentPriority: 1
};

/**
 * Rules snapshot config - Tier 2 enrichment priority
 * Track enforcement and geographic reach
 */
const rulesSnapshotConfig: SnapshotConfig = {
  trackedRelationships: [
    { kind: 'applies_in', direction: 'src', countThreshold: 1, trackIds: true },
    { kind: 'weaponized_by', direction: 'dst', trackIds: true },
    { kind: 'believer_of', direction: 'dst', countThreshold: 3 }
  ],
  enrichmentCooldown: 15,
  enrichmentPriority: 2
};

/**
 * Abilities snapshot config - Tier 2 enrichment priority
 * Track practitioners and manifestation spread
 */
const abilitiesSnapshotConfig: SnapshotConfig = {
  trackedRelationships: [
    { kind: 'practitioner_of', direction: 'dst', countThreshold: 2 },
    { kind: 'manifests_at', direction: 'src', countThreshold: 1, trackIds: true }
  ],
  enrichmentCooldown: 15,
  enrichmentPriority: 2
};

/**
 * NPC snapshot config - Tier 3 enrichment priority
 * Track leadership and affiliations
 */
const npcSnapshotConfig: SnapshotConfig = {
  trackedRelationships: [
    { kind: 'leader_of', direction: 'src', trackIds: true },
    { kind: 'member_of', direction: 'src', trackIds: true },
    { kind: 'resident_of', direction: 'src', trackIds: true }
  ],
  enrichmentCooldown: 20,
  enrichmentPriority: 3
};

// ===========================
// ENTITY KIND DEFINITIONS
// ===========================

const penguinEntityKinds: EntityKindDefinition[] = [
  {
    kind: 'npc',
    description: 'Non-player characters - penguins with agency',
    subtypes: ['merchant', 'mayor', 'hero', 'outlaw', 'orca'],
    statusValues: ['alive', 'dead', 'fictional', 'missing'],
    defaultStatus: 'alive',
    requiredRelationships: [
      {
        kind: 'resident_of',
        when: (entity) => entity.status === 'alive' && entity.subtype !== 'orca',
        description: 'Living non-orca NPCs must have a location'
      }
    ],
    snapshotConfig: npcSnapshotConfig,
    style: { displayName: 'NPCs', color: '#6FB1FC', shape: 'ellipse' }
  },
  {
    kind: 'location',
    description: 'Physical places in the world',
    subtypes: ['iceberg', 'colony', 'igloo', 'geographic_feature', 'anomaly'],
    statusValues: ['thriving', 'waning', 'abandoned'],
    defaultStatus: 'thriving',
    snapshotConfig: locationSnapshotConfig,
    style: { displayName: 'Locations', color: '#6BFC9C', shape: 'hexagon' }
  },
  {
    kind: 'faction',
    description: 'Organized groups with shared goals',
    subtypes: ['political', 'criminal', 'cult', 'company'],
    statusValues: ['active', 'disbanded', 'waning'],
    defaultStatus: 'active',
    snapshotConfig: factionSnapshotConfig,
    style: { displayName: 'Factions', color: '#FC6B6B', shape: 'diamond' }
  },
  {
    kind: 'rules',
    description: 'Social norms, laws, and customs',
    subtypes: ['edict', 'taboo', 'social', 'natural'],
    statusValues: ['active', 'forgotten', 'proposed', 'enacted', 'repealed'],
    defaultStatus: 'enacted',
    snapshotConfig: rulesSnapshotConfig,
    style: { displayName: 'Rules', color: '#FCA86B', shape: 'rectangle' }
  },
  {
    kind: 'abilities',
    description: 'Special powers, technologies, or skills',
    subtypes: ['magic', 'faith', 'technology', 'physical', 'combat'],
    statusValues: ['active', 'lost', 'emergent'],
    defaultStatus: 'active',
    snapshotConfig: abilitiesSnapshotConfig,
    style: { displayName: 'Abilities', color: '#C76BFC', shape: 'star' }
  },
  {
    kind: 'era',
    description: 'Temporal contexts that modify action probabilities and template weights',
    subtypes: ['expansion', 'conflict', 'innovation', 'invasion', 'reconstruction'],
    statusValues: ['past', 'current', 'future'],
    defaultStatus: 'future',
    style: { displayName: 'Eras', color: '#FFD700', shape: 'octagon' }
  },
  {
    kind: 'occurrence',
    description: 'Major happenings with their own momentum (second-order agents)',
    subtypes: ['war', 'magical_disaster', 'cultural_movement', 'economic_boom'],
    statusValues: ['brewing', 'active', 'waning', 'ended', 'legendary'],
    defaultStatus: 'brewing',
    style: { displayName: 'Occurrences', color: '#FF69B4', shape: 'triangle' }
  }
];

// ===========================
// RELATIONSHIP KIND DEFINITIONS
// ===========================

const penguinRelationshipKinds: RelationshipKindDefinition[] = [
  // SPATIAL RELATIONSHIPS (Immutable - facts about the world)
  {
    kind: 'contains',
    description: 'Location A contains location B',
    srcKinds: ['location'],
    dstKinds: ['location'],
    mutability: 'immutable',
    protected: true,
    structural: true,
    strength: 0.2,
    category: 'immutable_fact',
    isLineage: true,
    distanceRange: { min: 0.0, max: 0.3 }
  },
  {
    kind: 'contained_by',
    description: 'Inverse of contains',
    srcKinds: ['location'],
    dstKinds: ['location'],
    mutability: 'immutable',
    protected: true,
    structural: true,
    strength: 0.2,
    category: 'immutable_fact',
    isLineage: true,
    distanceRange: { min: 0.0, max: 0.3 }
  },
  {
    kind: 'adjacent_to',
    description: 'Two locations are next to each other',
    srcKinds: ['location'],
    dstKinds: ['location'],
    mutability: 'immutable',
    protected: true,
    structural: true,
    strength: 0.2,
    category: 'immutable_fact',
    isLineage: true,
    distanceRange: { min: 0.0, max: 0.5 }
  },

  // MEMBERSHIP RELATIONSHIPS (Mutable but protected - core structure)
  {
    kind: 'member_of',
    description: 'NPC is a member of a faction',
    srcKinds: ['npc'],
    dstKinds: ['faction'],
    mutability: 'mutable',
    protected: true,
    strength: 1.0,
    category: 'institutional'
  },
  {
    kind: 'leader_of',
    description: 'NPC leads a faction',
    srcKinds: ['npc'],
    dstKinds: ['faction'],
    mutability: 'mutable',
    protected: true,
    strength: 1.0,
    category: 'institutional'
  },
  {
    kind: 'resident_of',
    description: 'NPC lives at a location',
    srcKinds: ['npc'],
    dstKinds: ['location'],
    mutability: 'mutable',
    protected: true,
    structural: true,
    strength: 0.3,
    category: 'social'
  },

  // ABILITY RELATIONSHIPS (Immutable - facts about abilities)
  {
    kind: 'practitioner_of',
    description: 'NPC practices an ability',
    srcKinds: ['npc'],
    dstKinds: ['abilities'],
    mutability: 'mutable',
    protected: true,
    strength: 0.9,
    category: 'institutional'
  },
  {
    kind: 'manifests_at',
    description: 'Ability manifests at a location',
    srcKinds: ['abilities'],
    dstKinds: ['location'],
    mutability: 'immutable',
    protected: true,
    strength: 0.6,
    category: 'immutable_fact'
  },
  {
    kind: 'slumbers_beneath',
    description: 'Ability is dormant beneath a location',
    srcKinds: ['abilities'],
    dstKinds: ['location'],
    mutability: 'immutable',
    protected: true,
    strength: 0.3,
    category: 'immutable_fact'
  },
  {
    kind: 'discoverer_of',
    description: 'NPC discovered an ability',
    srcKinds: ['npc'],
    dstKinds: ['abilities'],
    mutability: 'immutable',
    protected: true,
    strength: 0.2,
    category: 'immutable_fact'
  },
  {
    kind: 'originated_in',
    description: 'Ability originated in a location',
    srcKinds: ['abilities'],
    dstKinds: ['location'],
    mutability: 'immutable',
    protected: true,
    strength: 0.9,
    category: 'immutable_fact'
  },
  {
    kind: 'derived_from',
    description: 'Ability/rule derived from another (lineage with cognitive distance)',
    srcKinds: ['abilities', 'rules'],
    dstKinds: ['abilities', 'rules'],
    mutability: 'immutable',
    protected: true,
    structural: true,
    strength: 0.6,
    category: 'immutable_fact',
    isLineage: true,
    distanceRange: { min: 0.05, max: 0.6 }
  },
  {
    kind: 'related_to',
    description: 'Generic same-kind similarity relationship (lineage with cognitive distance)',
    srcKinds: ['abilities', 'rules', 'faction'],
    dstKinds: ['abilities', 'rules', 'faction'],
    mutability: 'immutable',
    protected: true,
    structural: true,
    strength: 0.5,
    category: 'immutable_fact',
    isLineage: true,
    distanceRange: { min: 0.3, max: 0.7 }
  },
  {
    kind: 'inspired_by',
    description: 'Entity inspired by another of same kind (influence with cognitive distance)',
    srcKinds: ['npc', 'abilities'],
    dstKinds: ['npc', 'abilities'],
    mutability: 'immutable',
    protected: true,
    strength: 0.5,
    category: 'immutable_fact',
    isLineage: true,
    distanceRange: { min: 0.3, max: 0.6 }
  },
  {
    kind: 'part_of',
    description: 'Entity is part of a meta-entity (subsumption)',
    srcKinds: ['abilities', 'rules'],
    dstKinds: ['abilities', 'rules'],
    mutability: 'immutable',
    protected: true,
    structural: true,
    strength: 0.7,
    category: 'immutable_fact',
    isLineage: true,
    distanceRange: { min: 0.0, max: 0.3 }
  },

  // SOCIAL RELATIONSHIPS (Mutable - naturally change over time)
  // REMOVED: lover_of (social drama, 219 instances - 20% of relationships)
  // REMOVED: follower_of (social drama, 108 instances - 10% of relationships)
  {
    kind: 'enemy_of',
    description: 'NPCs are enemies',
    srcKinds: ['npc'],
    dstKinds: ['npc'],
    mutability: 'mutable',
    protected: false,
    strength: 0.7,
    category: 'social',
    conflictsWith: ['lover_of', 'follower_of', 'ally_of', 'allied_with']
  },
  {
    kind: 'rival_of',
    description: 'NPCs are rivals',
    srcKinds: ['npc'],
    dstKinds: ['npc'],
    mutability: 'mutable',
    protected: false,
    strength: 0.5,
    category: 'social',
    conflictsWith: ['lover_of', 'follower_of', 'mentor_of']
  },
  {
    kind: 'ally_of',
    description: 'NPCs are allies',
    srcKinds: ['npc'],
    dstKinds: ['npc'],
    mutability: 'mutable',
    protected: false,
    strength: 0.7,
    category: 'social'
  },
  {
    kind: 'family_of',
    description: 'NPCs are family members',
    srcKinds: ['npc'],
    dstKinds: ['npc'],
    mutability: 'immutable',
    protected: true,
    strength: 0.5,
    category: 'immutable_fact'
  },

  // POLITICAL RELATIONSHIPS (Mutable)
  {
    kind: 'allied_with',
    description: 'Factions are allied',
    srcKinds: ['faction'],
    dstKinds: ['faction'],
    mutability: 'mutable',
    protected: false,
    strength: 0.7,
    category: 'political'
  },
  {
    kind: 'at_war_with',
    description: 'Factions are at war',
    srcKinds: ['faction'],
    dstKinds: ['faction'],
    mutability: 'mutable',
    protected: false,
    strength: 0.7,
    category: 'political',
    conflictsWith: ['allied_with']
  },
  {
    kind: 'split_from',
    description: 'Faction split from parent (lineage with ideological distance)',
    srcKinds: ['faction'],
    dstKinds: ['faction'],
    mutability: 'immutable',
    protected: true,
    structural: true,
    strength: 0.8,
    category: 'immutable_fact',
    isLineage: true,
    distanceRange: { min: 0.15, max: 0.8 }
  },
  {
    kind: 'stronghold_of',
    description: 'Faction controls a location',
    srcKinds: ['faction'],
    dstKinds: ['location'],
    mutability: 'mutable',
    protected: false,
    strength: 0.7,
    category: 'political'
  },
  {
    kind: 'controls',
    description: 'Faction controls a location',
    srcKinds: ['faction'],
    dstKinds: ['location'],
    mutability: 'mutable',
    protected: false,
    strength: 0.7,
    category: 'political'
  },

  // RULE RELATIONSHIPS (Mixed - some structural, some mutable)
  {
    kind: 'applies_in',
    description: 'Rule applies in a location',
    srcKinds: ['rules'],
    dstKinds: ['location'],
    mutability: 'immutable',
    protected: true,
    strength: 0.6,
    category: 'immutable_fact'
  },
  {
    kind: 'supersedes',
    description: 'Rule replaces/supersedes another (lineage with legal distance)',
    srcKinds: ['rules'],
    dstKinds: ['rules'],
    mutability: 'immutable',
    protected: true,
    structural: true,
    strength: 0.7,
    category: 'immutable_fact',
    isLineage: true,
    distanceRange: { min: 0.1, max: 0.5 }
  },
  {
    kind: 'champion_of',
    description: 'NPC champions an ideology/rule',
    srcKinds: ['npc'],
    dstKinds: ['rules'],
    mutability: 'mutable',
    protected: true,
    strength: 0.6,
    category: 'social'
  },
  {
    kind: 'believer_of',
    description: 'NPC believes in an ideology/rule',
    srcKinds: ['npc'],
    dstKinds: ['rules'],
    mutability: 'mutable',
    protected: false,
    strength: 0.5,
    category: 'social'
  },
  {
    kind: 'celebrated_by',
    description: 'Festival/tradition celebrated by faction',
    srcKinds: ['rules'],
    dstKinds: ['faction'],
    mutability: 'mutable',
    protected: true,
    strength: 0.6,
    category: 'institutional'
  },
  {
    kind: 'wields',
    description: 'Faction wields an ability',
    srcKinds: ['faction'],
    dstKinds: ['abilities'],
    mutability: 'mutable',
    protected: true,
    strength: 0.6,
    category: 'institutional'
  },
  {
    kind: 'weaponized_by',
    description: 'Rule is enforced by a faction',
    srcKinds: ['faction'],
    dstKinds: ['rules'],
    mutability: 'mutable',
    protected: false,
    strength: 0.5,
    category: 'institutional'
  },
  {
    kind: 'kept_secret_by',
    description: 'Rule is kept secret by a faction',
    srcKinds: ['faction'],
    dstKinds: ['rules'],
    mutability: 'mutable',
    protected: false,
    strength: 0.5,
    category: 'institutional'
  },

  // TEMPORAL RELATIONSHIPS (New - for era and occurrence entities)
  {
    kind: 'active_during',
    description: 'Entity was prominent during this era',
    srcKinds: ['npc', 'faction', 'occurrence', 'location', 'abilities'],
    dstKinds: ['era'],
    mutability: 'immutable',
    protected: true,
    strength: 0.6,
    category: 'immutable_fact'
  },
  {
    kind: 'participant_in',
    description: 'Entity participates in an occurrence',
    srcKinds: ['npc', 'faction', 'location'],
    dstKinds: ['occurrence'],
    mutability: 'mutable',
    protected: false,
    strength: 0.7,
    category: 'social'
  },
  {
    kind: 'epicenter_of',
    description: 'Occurrence is centered at this location',
    srcKinds: ['occurrence'],
    dstKinds: ['location'],
    mutability: 'immutable',
    protected: true,
    strength: 0.8,
    category: 'immutable_fact'
  },
  {
    kind: 'triggered_by',
    description: 'Occurrence was triggered by this agent',
    srcKinds: ['occurrence'],
    dstKinds: ['npc', 'faction'],
    mutability: 'immutable',
    protected: true,
    strength: 0.9,
    category: 'immutable_fact'
  },
  {
    kind: 'escalated_by',
    description: 'Occurrence was escalated by this agent',
    srcKinds: ['occurrence'],
    dstKinds: ['npc', 'faction'],
    mutability: 'mutable',
    protected: false,
    strength: 0.6,
    category: 'social'
  },
  {
    kind: 'ended_by',
    description: 'Occurrence was ended by this agent action',
    srcKinds: ['occurrence'],
    dstKinds: ['npc', 'faction'],
    mutability: 'immutable',
    protected: true,
    strength: 0.8,
    category: 'immutable_fact'
  },
  {
    kind: 'spawned',
    description: 'Occurrence spawned another occurrence',
    srcKinds: ['occurrence'],
    dstKinds: ['occurrence'],
    mutability: 'immutable',
    protected: true,
    strength: 0.7,
    category: 'immutable_fact'
  },
  {
    kind: 'concurrent_with',
    description: 'Occurrences overlapped in time',
    srcKinds: ['occurrence'],
    dstKinds: ['occurrence'],
    mutability: 'immutable',
    protected: false,
    strength: 0.4,
    category: 'immutable_fact'
  }
];

// ===========================
// CULTURE DEFINITIONS
// ===========================

const penguinCultures: CultureDefinition[] = [
  {
    id: 'world',
    name: 'World',
    description: 'Transcendent entities that belong to the world itself - eras, major occurrences, and world-spanning events.',
    homeland: undefined  // No specific homeland
  },
  {
    id: 'aurora-stack',
    name: 'Aurora Stack',
    description: 'The orderly, trade-focused culture of Aurora Stack colony. Values commerce, organization, and technological progress.',
    homeland: 'Aurora Stack'
  },
  {
    id: 'nightshelf',
    name: 'Nightfall Shelf',
    description: 'The secretive, mystical culture of Nightfall Shelf colony. Values cunning, magic, and shadow dealings.',
    homeland: 'Nightfall Shelf'
  },
  {
    id: 'orca',
    name: 'Orca Raiders',
    description: 'The fierce warrior culture of the orca raiders. Values strength, conquest, and dominance.',
    homeland: undefined  // Nomadic
  }
];

// ===========================
// RELATIONSHIP CONFIGURATION
// ===========================

/**
 * Per-entity-kind relationship limits.
 * Warns when relationships of a given type exceed these thresholds.
 */
const penguinRelationshipLimits: Record<string, RelationshipLimits> = {
  npc: {
    default: 5,        // NPCs shouldn't have too many of any single relationship type
    perKind: {
      member_of: 3,    // NPCs rarely in more than 3 factions
      enemy_of: 5,
      ally_of: 5,
      lover_of: 2      // Keep romantic relationships limited
    }
  },
  location: {
    default: 15,       // Locations can have many connections
    perKind: {
      resident_of: 50, // Colonies can have many residents
      adjacent_to: 10
    }
  },
  faction: {
    default: 20,       // Factions can have many members and relationships
    perKind: {
      member_of: 50,   // Factions can have many members (as dst)
      allied_to: 8,
      enemy_of: 8
    }
  },
  rules: {
    default: 10        // Rules can apply to multiple entities
  },
  abilities: {
    default: 10        // Abilities can be practiced by multiple entities
  }
};

/**
 * Complete relationship configuration for penguin domain.
 */
const penguinRelationshipConfig: RelationshipConfig = {
  limits: penguinRelationshipLimits,
  defaultStrength: 0.5,
  defaultCategory: 'social'
};

// ===========================
// EMERGENT DISCOVERY CONFIG
// ===========================

/**
 * Penguin-domain emergent discovery configuration.
 * Defines penguin-specific discovery behavior.
 */
const penguinDiscoveryConfig: EmergentDiscoveryConfig = {
  // Settlements in penguin world are colonies
  settlementSubtypes: ['colony'],

  // Colony status values
  thrivingStatuses: ['thriving'],
  strugglingStatuses: ['waning', 'derelict'],

  // Who can discover new locations
  explorerSubtypes: ['hero', 'outlaw', 'merchant'],
  explorerActiveStatus: 'alive',

  // Penguin food resources
  resourceTypes: ['food', 'water', 'shelter', 'safety'],
  foodResources: ['krill', 'fish', 'kelp'],

  // Era-based discovery probabilities
  eraDiscoveryModifiers: {
    'expansion': 0.15,      // High exploration during expansion
    'conflict': 0.08,       // Low during conflict
    'innovation': 0.12,     // Moderate during innovation
    'invasion': 0.06,       // Very low during invasion
    'reconstruction': 0.10  // Moderate during reconstruction
  },

  // Discovery limits
  maxLocations: 40,
  maxDiscoveriesPerEpoch: 3,
  minTicksBetweenDiscoveries: 5,

  // Era-specific theme words
  eraThemeWords: {
    'conflict': {
      depthWords: ['hidden', 'secret', 'deep']
    },
    'expansion': {
      depthWords: ['open', 'accessible', 'shallow'],
      descriptors: ['fertile', 'pristine', 'untouched', 'virgin']
    },
    'reconstruction': {
      descriptors: ['renewed', 'reclaimed', 'restored', 'peaceful']
    }
  },

  // Resource-specific theme words
  resourceThemeWords: {
    'fishing': ['krill', 'fish', 'kelp', 'current'],
    'fresh_water': ['spring', 'melt', 'pool', 'stream'],
    'krill': ['breeding', 'swarm', 'bloom', 'migration'],
    'fish': ['spawning', 'feeding', 'schooling', 'hunting'],
    'kelp': ['forest', 'grove', 'bed', 'garden']
  }
};

// ===========================
// PENGUIN DOMAIN SCHEMA
// ===========================

// Create base domain
const baseDomain = new BaseDomainSchema({
  id: 'penguin-colony',
  name: 'Super Penguin Colony',
  version: '1.0.0',
  entityKinds: penguinEntityKinds,
  relationshipKinds: penguinRelationshipKinds,
  cultures: penguinCultures,
  relationshipConfig: penguinRelationshipConfig,
  uiConfig: {
    worldIcon: '🐧',
    prominenceLevels: ['forgotten', 'marginal', 'recognized', 'renowned', 'mythic']
  }
});

// Extend with catalyst system methods and discovery config
export const penguinDomain = Object.assign(baseDomain, {
  // Region-based coordinate system configuration
  regionConfig: penguinRegionConfig,

  // Emergent discovery configuration
  emergentDiscoveryConfig: penguinDiscoveryConfig,

  // Action domains for catalyst system
  getActionDomains() {
    return getActionDomains();
  },

  // Action domains for a specific entity
  getActionDomainsForEntity(entity: any) {
    return getActionDomainsForEntity(entity);
  },

  // Pressure-domain mappings
  getPressureDomainMappings() {
    return getPressureDomainMappings();
  },

  // Occurrence triggers (placeholder - can be customized)
  getOccurrenceTriggers() {
    return {
      war: {
        nameGenerator: (factionNames: string[]) =>
          `The ${factionNames[0]}-${factionNames[1]} War`
      },
      magical_disaster: {
        nameGenerator: () => `The ${pickRandom(['Corruption', 'Void', 'Chaos', 'Shadow'])} Cascade`
      },
      cultural_movement: {
        nameGenerator: (ruleName: string) => `The ${ruleName} Movement`
      },
      economic_boom: {
        nameGenerator: () => `The ${pickRandom(['Prosperity', 'Abundance', 'Wealth', 'Fortune'])} Era`
      }
    };
  },

  // Era transition conditions (placeholder - can be customized)
  getEraTransitionConditions(eraSubtype: string) {
    // Default: time-based transitions
    // Each era should last ~2 epochs (2 × 15 ticks = 30 ticks)
    return [
      { type: 'time', minTicks: 30 }
    ];
  },

  // Era transition effects
  getEraTransitionEffects(fromEra: any, toEra: any, graph: any) {
    return {
      pressureChanges: {}
    };
  }
});

// Export penguin-specific constants for backward compatibility
export const PENGUIN_ENTITY_KINDS = penguinEntityKinds.map(ek => ek.kind);
export const PENGUIN_RELATIONSHIP_KINDS = penguinRelationshipKinds.map(rk => rk.kind);
export const PENGUIN_CULTURES = penguinCultures.map(c => c.id);
export { penguinCultures };
