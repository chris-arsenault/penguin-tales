/**
 * Template Strategies
 *
 * Defines the meta-structure for templates as composable strategies.
 * Each template follows an ordered pipeline:
 *
 *   1. APPLICABILITY CHECK - Should template run?
 *   2. TARGET SELECTION    - What entities to act upon?
 *   3. ENTITY CREATION     - How to create new entities?
 *   4. RELATIONSHIP CREATION - How to connect entities?
 *   5. STATE UPDATES       - What side effects to apply?
 *
 * Each step has multiple strategies that can be composed.
 */

import { TemplateGraphView, HardState, Relationship } from '@lore-weave/core';

// =============================================================================
// STEP 1: APPLICABILITY STRATEGIES
// =============================================================================

/**
 * Applicability strategies determine when a template can run.
 */
export type ApplicabilityStrategy =
  | 'pressure_threshold'      // Run when pressure is within bounds
  | 'pressure_any_above'      // Run when any pressure exceeds threshold
  | 'entity_count_min'        // Run when entity count meets minimum
  | 'entity_count_max'        // Run when entity count below maximum (saturation)
  | 'relationship_exists'     // Run when specific relationship exists
  | 'era_match'               // Run only in specific eras
  | 'random_chance'           // Probabilistic trigger
  | 'cooldown_elapsed'        // Time since last action
  | 'composite_and'           // All conditions must pass
  | 'composite_or';           // Any condition can pass

export interface ApplicabilityConfig {
  strategy: ApplicabilityStrategy;
  // Strategy-specific params
  pressureId?: string;
  minValue?: number;
  maxValue?: number;
  entityKind?: string;
  entitySubtype?: string;
  eras?: string[];
  chance?: number;
  cooldownTicks?: number;
  children?: ApplicabilityConfig[];  // For composite strategies
}

// =============================================================================
// STEP 2: TARGET SELECTION STRATEGIES
// =============================================================================

/**
 * Target selection strategies determine how to find entities to act upon.
 */
export type SelectionStrategy =
  | 'by_kind'                 // Filter by entity kind/subtype
  | 'by_preference_order'     // Try subtypes in order, return first non-empty
  | 'by_status'               // Filter by entity status
  | 'by_relationship'         // Filter by having/lacking relationships
  | 'by_proximity'            // Filter by spatial proximity to reference
  | 'by_pressure_weight'      // Weight selection by pressure values
  | 'by_prominence'           // Filter by prominence level
  | 'by_culture'              // Filter by culture match
  | 'by_faction'              // Filter by faction membership
  | 'random_from_pool'        // Random selection from filtered pool
  | 'weighted_random'         // Weighted random based on scoring
  | 'all_matching';           // Return all matching entities

export interface SelectionConfig {
  strategy: SelectionStrategy;
  // Strategy-specific params
  kind?: string;
  subtypes?: string[];        // For preference order
  statusFilter?: string;
  prominenceMin?: string;
  relationshipKind?: string;
  relationshipRequired?: boolean;  // true = must have, false = must lack
  maxResults?: number;
  referenceEntity?: string;   // ID or placeholder
  maxDistance?: number;
  cultureId?: string;
  factionId?: string;
}

// =============================================================================
// STEP 3: ENTITY CREATION STRATEGIES
// =============================================================================

/**
 * Entity creation strategies determine how to generate new entities.
 */
export type CreationStrategy =
  | 'simple_direct'           // Create single entity with fixed attributes
  | 'batch_uniform'           // Create N entities with same attributes
  | 'batch_varied'            // Create N entities with varied attributes
  | 'near_reference'          // Place near reference entity
  | 'in_culture_region'       // Place in culture's region
  | 'with_lineage'            // Link to existing similar entities
  | 'procedural_theme'        // Generate attributes from world state
  | 'computed_placement'      // Use algorithm for placement (Voronoi, etc.)
  | 'selection_hybrid'        // Select existing OR create new
  | 'from_relationship'       // Derive from existing relationships
  | 'none';                   // No entity creation (relationship-only template)

export interface CreationConfig {
  strategy: CreationStrategy;
  // Entity attributes
  kind?: string;
  subtype?: string;
  status?: string;
  prominence?: string;
  // Batch params
  minCount?: number;
  maxCount?: number;
  // Placement params
  referenceKind?: string;
  cultureInherit?: boolean;   // Inherit culture from reference
  zAdjustment?: { min: number; max: number };  // For underwater/sky placement
  // Hybrid params
  preferExisting?: boolean;
  maxCreated?: number;        // Cap on new entities
  // Lineage params
  lineageKind?: string;       // 'related_to', 'inspired_by', etc.
  lineageSubtype?: string;
  distanceRange?: { min: number; max: number };
  // Procedural params
  themeSource?: 'era' | 'pressure' | 'random';
  themeOptions?: Record<string, string[]>;
}

// =============================================================================
// STEP 4: RELATIONSHIP CREATION STRATEGIES
// =============================================================================

/**
 * Relationship creation strategies determine how to connect entities.
 */
export type RelationshipStrategy =
  | 'hierarchical'            // leader_of, member_of, resident_of
  | 'discovery'               // explorer_of, discovered_by, discoverer_of
  | 'lineage'                 // inspired_by, related_to, split_from, derived_from
  | 'conflict'                // enemy_of, rival_of, at_war_with
  | 'social'                  // mentor_of, lover_of, believer_of
  | 'economic'                // controls, trades_with, occupies
  | 'spatial'                 // adjacent_to, contained_by, manifests_at
  | 'bidirectional'           // Create pair of opposite relationships
  | 'with_distance'           // Include semantic distance (0-1)
  | 'with_catalyst'           // Include catalyzedBy attribution
  | 'conditional';            // Only if condition met

export interface RelationshipConfig {
  strategy: RelationshipStrategy;
  kind: string;
  // Direction
  srcPlaceholder?: string;    // 'will-be-assigned-0', 'target', etc.
  dstPlaceholder?: string;
  // Metadata
  distance?: number | { min: number; max: number };
  strength?: number;
  catalystId?: string;
  // Conditional
  condition?: (graphView: TemplateGraphView, src: HardState, dst: HardState) => boolean;
}

// =============================================================================
// STEP 5: STATE UPDATE STRATEGIES
// =============================================================================

/**
 * State update strategies for side effects after entity/relationship creation.
 */
export type StateUpdateStrategy =
  | 'update_discovery_state'  // Track discovery timing
  | 'archive_relationship'    // Mark old relationship as historical
  | 'modify_pressure'         // Change pressure values
  | 'update_entity_status'    // Change entity status
  | 'record_history_event'    // Add to history log
  | 'none';                   // No state updates

export interface StateUpdateConfig {
  strategy: StateUpdateStrategy;
  // Strategy-specific params
  pressureId?: string;
  pressureDelta?: number;
  entityId?: string;
  newStatus?: string;
  historyEventType?: string;
}

// =============================================================================
// TEMPLATE RULE DEFINITION
// =============================================================================

/**
 * A complete template rule definition using strategies.
 */
export interface TemplateRule {
  id: string;
  name: string;
  description: string;

  // Step 1: When can this template apply?
  applicability: ApplicabilityConfig[];

  // Step 2: How to select targets?
  selection: SelectionConfig;

  // Step 3: What entities to create?
  creation: CreationConfig;

  // Step 4: What relationships to create?
  relationships: RelationshipConfig[];

  // Step 5: What state updates to apply?
  stateUpdates: StateUpdateConfig[];
}

// =============================================================================
// STRATEGY CATALOG
// =============================================================================

/**
 * Catalog of all available strategies for UI/DSL reference.
 */
export const STRATEGY_CATALOG = {
  applicability: [
    { id: 'pressure_threshold', description: 'Run when pressure is within min-max bounds', params: ['pressureId', 'minValue', 'maxValue'] },
    { id: 'pressure_any_above', description: 'Run when any pressure exceeds threshold', params: ['minValue'] },
    { id: 'entity_count_min', description: 'Run when entity count meets minimum', params: ['entityKind', 'entitySubtype', 'minValue'] },
    { id: 'entity_count_max', description: 'Run when entity count below maximum (saturation)', params: ['entityKind', 'entitySubtype', 'maxValue'] },
    { id: 'era_match', description: 'Run only in specific eras', params: ['eras'] },
    { id: 'random_chance', description: 'Probabilistic trigger', params: ['chance'] },
    { id: 'cooldown_elapsed', description: 'Time since last action', params: ['cooldownTicks'] },
  ],

  selection: [
    { id: 'by_kind', description: 'Filter by entity kind/subtype', params: ['kind', 'subtypes'] },
    { id: 'by_preference_order', description: 'Try subtypes in order, return first non-empty', params: ['kind', 'subtypes'] },
    { id: 'by_status', description: 'Filter by entity status', params: ['kind', 'statusFilter'] },
    { id: 'by_relationship', description: 'Filter by having/lacking relationships', params: ['kind', 'relationshipKind', 'relationshipRequired'] },
    { id: 'by_proximity', description: 'Filter by spatial proximity to reference', params: ['kind', 'referenceEntity', 'maxDistance'] },
    { id: 'by_prominence', description: 'Filter by prominence level', params: ['kind', 'prominenceMin'] },
    { id: 'random_from_pool', description: 'Random selection from filtered pool', params: ['maxResults'] },
    { id: 'weighted_random', description: 'Weighted random based on scoring function', params: [] },
  ],

  creation: [
    { id: 'simple_direct', description: 'Create single entity with fixed attributes', params: ['kind', 'subtype', 'status', 'prominence'] },
    { id: 'batch_uniform', description: 'Create N entities with same attributes', params: ['kind', 'subtype', 'minCount', 'maxCount'] },
    { id: 'batch_varied', description: 'Create N entities with varied attributes', params: ['kind', 'minCount', 'maxCount'] },
    { id: 'near_reference', description: 'Place near reference entity', params: ['kind', 'subtype', 'referenceKind', 'cultureInherit'] },
    { id: 'in_culture_region', description: 'Place in culture\'s region', params: ['kind', 'subtype', 'cultureInherit'] },
    { id: 'with_lineage', description: 'Link to existing similar entities', params: ['kind', 'subtype', 'lineageKind', 'distanceRange'] },
    { id: 'procedural_theme', description: 'Generate attributes from world state', params: ['kind', 'themeSource', 'themeOptions'] },
    { id: 'selection_hybrid', description: 'Select existing OR create new', params: ['kind', 'subtypes', 'preferExisting', 'maxCreated'] },
    { id: 'none', description: 'No entity creation (relationship-only template)', params: [] },
  ],

  relationships: [
    { id: 'hierarchical', description: 'Ownership/membership (leader_of, member_of, resident_of)', params: ['kind'] },
    { id: 'discovery', description: 'Attribution (explorer_of, discovered_by)', params: ['kind'] },
    { id: 'lineage', description: 'Heritage (inspired_by, related_to, split_from)', params: ['kind', 'distance'] },
    { id: 'conflict', description: 'Opposition (enemy_of, rival_of, at_war_with)', params: ['kind'] },
    { id: 'social', description: 'Social bonds (mentor_of, lover_of, believer_of)', params: ['kind'] },
    { id: 'spatial', description: 'Geographic (adjacent_to, contained_by, manifests_at)', params: ['kind'] },
    { id: 'bidirectional', description: 'Create pair of opposite relationships', params: ['kind'] },
    { id: 'with_distance', description: 'Include semantic distance (0-1)', params: ['kind', 'distance'] },
  ],

  stateUpdates: [
    { id: 'update_discovery_state', description: 'Track discovery timing', params: [] },
    { id: 'archive_relationship', description: 'Mark old relationship as historical', params: ['entityId', 'relationshipKind'] },
    { id: 'modify_pressure', description: 'Change pressure values', params: ['pressureId', 'pressureDelta'] },
    { id: 'update_entity_status', description: 'Change entity status', params: ['entityId', 'newStatus'] },
    { id: 'none', description: 'No state updates', params: [] },
  ],
} as const;

// =============================================================================
// EXAMPLE TEMPLATE RULES
// =============================================================================

/**
 * Example: Hero Emergence as a TemplateRule
 */
export const HERO_EMERGENCE_RULE: TemplateRule = {
  id: 'hero_emergence',
  name: 'Hero Rises',
  description: 'A brave penguin emerges during troubled times',

  applicability: [
    {
      strategy: 'pressure_threshold',
      pressureId: 'conflict',
      minValue: 5,
      maxValue: 80,
    },
    {
      strategy: 'entity_count_max',
      entityKind: 'npc',
      entitySubtype: 'hero',
      maxValue: 30,  // 1.5x target of 20
    },
  ],

  selection: {
    strategy: 'by_kind',
    kind: 'location',
    subtypes: ['colony'],
    statusFilter: 'thriving',
  },

  creation: {
    strategy: 'near_reference',
    kind: 'npc',
    subtype: 'hero',
    status: 'alive',
    prominence: 'marginal',
    referenceKind: 'location',
    cultureInherit: true,
  },

  relationships: [
    {
      strategy: 'hierarchical',
      kind: 'resident_of',
      srcPlaceholder: 'will-be-assigned-0',
      dstPlaceholder: 'target',
    },
  ],

  stateUpdates: [],
};

/**
 * Example: Geographic Exploration as a TemplateRule
 */
export const GEOGRAPHIC_EXPLORATION_RULE: TemplateRule = {
  id: 'geographic_exploration',
  name: 'Geographic Exploration',
  description: 'An explorer discovers a new geographic feature',

  applicability: [
    {
      strategy: 'era_match',
      eras: ['expansion', 'reconstruction', 'innovation'],
    },
    {
      strategy: 'entity_count_max',
      entityKind: 'location',
      maxValue: 35,
    },
    {
      strategy: 'cooldown_elapsed',
      cooldownTicks: 8,
    },
    {
      strategy: 'random_chance',
      chance: 0.08,
    },
  ],

  selection: {
    strategy: 'by_preference_order',
    kind: 'npc',
    subtypes: ['hero', 'merchant'],
    statusFilter: 'alive',
  },

  creation: {
    strategy: 'procedural_theme',
    kind: 'location',
    subtype: 'geographic_feature',
    status: 'unspoiled',
    prominence: 'recognized',
    themeSource: 'era',
    cultureInherit: true,
  },

  relationships: [
    {
      strategy: 'discovery',
      kind: 'explorer_of',
      srcPlaceholder: 'target',
      dstPlaceholder: 'will-be-assigned-0',
    },
    {
      strategy: 'discovery',
      kind: 'discovered_by',
      srcPlaceholder: 'will-be-assigned-0',
      dstPlaceholder: 'target',
    },
    {
      strategy: 'bidirectional',
      kind: 'adjacent_to',
      srcPlaceholder: 'will-be-assigned-0',
      dstPlaceholder: 'nearby_location',
    },
  ],

  stateUpdates: [
    { strategy: 'update_discovery_state' },
  ],
};
