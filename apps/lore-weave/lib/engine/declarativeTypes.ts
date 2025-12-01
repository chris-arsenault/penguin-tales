/**
 * Declarative Template Types
 *
 * These types define a JSON-serializable template format that can be
 * interpreted without custom TypeScript code. Templates become pure data
 * that the TemplateInterpreter executes.
 */

import type { Prominence } from '../core/worldTypes';
import type { TemplateMetadata } from '../statistics/types';
import type { ComponentContract } from './types';

// =============================================================================
// MAIN TEMPLATE STRUCTURE
// =============================================================================

/**
 * A declarative template definition.
 * This is the top-level structure that defines a complete template as JSON data.
 *
 * APPLICABILITY MODEL:
 * A template can run when:
 *   1. All `applicability` rules pass (pressure thresholds, entity counts, era, etc.)
 *   2. AND the `selection` returns at least one valid target
 *
 * This means you don't need to duplicate graph_path rules in both applicability
 * and selection. The selection rule implicitly acts as an applicability check.
 */
export interface DeclarativeTemplate {
  id: string;
  name: string;

  // Step 1: Additional applicability constraints (pressure, era, counts, etc.)
  // The selection having at least 1 target is ALWAYS an implicit applicability rule.
  applicability: ApplicabilityRule[];

  // Step 2: What entities to act upon? (Also serves as primary applicability check)
  selection: SelectionRule;

  // Step 3: What entities to create?
  creation: CreationRule[];

  // Step 4: What relationships to form?
  relationships: RelationshipRule[];

  // Step 5: What state updates to apply?
  stateUpdates: StateUpdateRule[];

  // Named entity references computed during execution
  variables?: Record<string, VariableDefinition>;

  // Metadata for UI/introspection
  contract?: ComponentContract;
  metadata?: TemplateMetadata;
}

// =============================================================================
// STEP 1: APPLICABILITY RULES
// =============================================================================

/**
 * Rules that determine when a template can run.
 * Multiple rules are combined with AND logic by default.
 */
export type ApplicabilityRule =
  | PressureThresholdRule
  | PressureAnyAboveRule
  | EntityCountMinRule
  | EntityCountMaxRule
  | EraMatchRule
  | RandomChanceRule
  | CooldownElapsedRule
  | CreationsPerEpochRule
  | GraphPathApplicabilityRule
  | TagExistsApplicabilityRule
  | TagAbsentApplicabilityRule
  | CompositeApplicabilityRule;

export interface PressureThresholdRule {
  type: 'pressure_threshold';
  pressureId: string;
  min: number;
  max: number;
  extremeChance?: number;  // Chance to apply when above max (default 0.3)
}

export interface PressureAnyAboveRule {
  type: 'pressure_any_above';
  pressureIds: string[];
  threshold: number;
}

export interface EntityCountMinRule {
  type: 'entity_count_min';
  kind: string;
  subtype?: string;
  status?: string;
  min: number;
}

export interface EntityCountMaxRule {
  type: 'entity_count_max';
  kind: string;
  subtype?: string;
  max: number;
  overshootFactor?: number;  // Default 1.5
}

export interface EraMatchRule {
  type: 'era_match';
  eras: string[];
}

export interface RandomChanceRule {
  type: 'random_chance';
  chance: number;  // 0-1
}

export interface CooldownElapsedRule {
  type: 'cooldown_elapsed';
  cooldownTicks: number;
}

export interface CreationsPerEpochRule {
  type: 'creations_per_epoch';
  maxPerEpoch: number;
}

/**
 * Tag existence rule - checks if any entity of a kind has a specific tag.
 * Used for threshold-trigger patterns where systems set tags that templates react to.
 *
 * Example: { type: 'tag_exists', kind: 'faction', tag: 'power_vacuum' }
 *   - Template can run when at least one faction has the 'power_vacuum' tag set
 */
export interface TagExistsApplicabilityRule {
  type: 'tag_exists';
  kind: string;
  subtype?: string;
  status?: string;
  tag: string;
  /** If specified, tag value must match (for cluster ID tags) */
  tagValue?: string | boolean;
  /** Minimum number of entities with the tag (default 1) */
  minCount?: number;
}

/**
 * Tag absence rule - checks that no entity of a kind has a specific tag.
 * Useful for preventing duplicate processing.
 *
 * Example: { type: 'tag_absent', kind: 'faction', tag: 'war_processed' }
 *   - Template can run when no faction has been processed yet
 */
export interface TagAbsentApplicabilityRule {
  type: 'tag_absent';
  kind: string;
  subtype?: string;
  status?: string;
  tag: string;
}

/**
 * Graph path filter - general purpose graph-aware filtering.
 * Supports up to 2 hops of traversal with existence/count checks.
 */
export interface GraphPathApplicabilityRule {
  type: 'graph_path';

  // Starting point - what entities to check
  from: {
    kind: string;
    subtype?: string;
    status?: string;
  };

  // What we're looking for
  assert: GraphPathAssertion;
}

export interface GraphPathAssertion {
  // Type of assertion
  check: 'exists' | 'not_exists' | 'count_min' | 'count_max';

  // Path to traverse (1-2 hops)
  path: PathStep[];

  // For count assertions
  count?: number;

  // Additional constraints on the final target
  where?: PathConstraint[];
}

/**
 * A single step in a graph traversal path.
 */
export interface PathStep {
  // Relationship to traverse
  via: string;
  direction: 'out' | 'in' | 'any';

  // Filter targets at this step
  targetKind?: string;
  targetSubtype?: string;
  targetStatus?: string;

  // Store intermediate result for reference
  as?: string;  // e.g., "$controlled", "$adjacent"
}

/**
 * Constraints on path targets.
 */
export type PathConstraint =
  | { type: 'not_in'; set: string }           // Target not in a stored set (e.g., "$controlled")
  | { type: 'in'; set: string }               // Target in a stored set
  | { type: 'lacks_relationship'; kind: string; with: string; direction?: 'out' | 'in' | 'any' }
  | { type: 'has_relationship'; kind: string; with: string; direction?: 'out' | 'in' | 'any' }
  | { type: 'not_self' }                      // Target is not the starting entity
  | { type: 'kind_equals'; kind: string }
  | { type: 'subtype_equals'; subtype: string }

export interface CompositeApplicabilityRule {
  type: 'and' | 'or';
  rules: ApplicabilityRule[];
}

// =============================================================================
// STEP 2: SELECTION RULES
// =============================================================================

/**
 * Rules that determine how to find target entities.
 */
export interface SelectionRule {
  strategy: 'by_kind' | 'by_preference_order' | 'by_relationship' | 'by_proximity' | 'by_prominence';
  kind: string;

  // Common filters
  subtypes?: string[];
  statusFilter?: string;

  // For by_relationship strategy
  relationshipKind?: string;
  mustHave?: boolean;
  direction?: 'src' | 'dst' | 'both';

  // For by_preference_order strategy
  subtypePreferences?: string[];

  // For by_proximity strategy
  referenceEntity?: string;  // Variable reference like "$target"
  maxDistance?: number;

  // For by_prominence strategy
  minProminence?: Prominence;

  // Post-selection filters
  filters?: SelectionFilter[];

  // Result handling
  pickStrategy?: 'random' | 'first' | 'all' | 'weighted';
  maxResults?: number;
}

/**
 * Filters applied after the main selection strategy.
 */
export type SelectionFilter =
  | ExcludeEntitiesFilter
  | HasRelationshipFilter
  | LacksRelationshipFilter
  | HasTagSelectionFilter
  | HasAnyTagSelectionFilter
  | SameLocationFilter
  | NotAtWarFilter
  | GraphPathSelectionFilter;

/**
 * Graph path selection filter - filters entities based on graph traversal.
 */
export interface GraphPathSelectionFilter {
  type: 'graph_path';
  assert: GraphPathAssertion;
}

export interface ExcludeEntitiesFilter {
  type: 'exclude';
  entities: string[];  // Variable references
}

export interface HasRelationshipFilter {
  type: 'has_relationship';
  kind: string;
  with?: string;  // Variable reference (optional)
  direction?: 'src' | 'dst' | 'both';
}

export interface LacksRelationshipFilter {
  type: 'lacks_relationship';
  kind: string;
  with?: string;  // Variable reference (optional)
}

export interface HasTagSelectionFilter {
  type: 'has_tag';
  tag: string;
  value?: string | boolean;
}

export interface HasAnyTagSelectionFilter {
  type: 'has_any_tag';
  tags: string[];
}

export interface SameLocationFilter {
  type: 'same_location';
  as: string;  // Variable reference
}

export interface NotAtWarFilter {
  type: 'not_at_war';
  with: string;  // Variable reference
}


// =============================================================================
// STEP 3: CREATION RULES
// =============================================================================

/**
 * Rules that define how to create new entities.
 */
export interface CreationRule {
  // Variable name for this entity (e.g., "$newFaction", "$child")
  entityRef: string;

  // What to create
  kind: string;
  subtype: SubtypeSpec;

  // Attributes
  status?: string;
  prominence?: Prominence;
  culture?: CultureSpec;
  description?: DescriptionSpec;
  tags?: Record<string, boolean>;

  // Placement
  placement: PlacementSpec;

  // Count (for batch creation)
  count?: number | CountRange;

  // Lineage (optional connection to existing similar entity)
  lineage?: LineageSpec;
}

/**
 * How to determine subtype.
 */
export type SubtypeSpec =
  | string  // Fixed subtype
  | { inherit: string; chance?: number; fallback?: string | 'random' }  // Inherit from reference
  | { fromPressure: Record<string, string> }  // Choose based on dominant pressure
  | { random: string[] };  // Random from list

/**
 * How to determine culture.
 */
export type CultureSpec =
  | { inherit: string }  // Inherit from reference entity
  | { fixed: string };   // Fixed culture

/**
 * How to generate description.
 */
export type DescriptionSpec =
  | string  // Fixed description
  | { template: string; replacements: Record<string, string> };  // Template with variable references

/**
 * How to place the new entity.
 *
 * Distance values are on 0-100 scale (Euclidean distance on semantic plane).
 */
export type PlacementSpec =
  | { type: 'near_entity'; entity: string; maxDistance?: number; minDistance?: number }
  | { type: 'in_culture_region'; culture: string }
  | { type: 'at_location'; location: string }
  | { type: 'derived_from_references'; references: string[]; culture?: string }
  | { type: 'random_in_bounds'; bounds?: { x: [number, number]; y: [number, number]; z?: [number, number] } }
  | NearAncestorPlacement;

/**
 * Place entity near an ancestor and create a lineage relationship.
 *
 * This placement type unifies coordinate placement with lineage relationship creation:
 * 1. Finds an ancestor using ancestorFilter (tries each filter in order)
 * 2. Places the new entity at the specified distance from the ancestor
 * 3. Creates a relationship of relationshipKind from new entity to ancestor
 * 4. Sets relationship.distance to the actual Euclidean distance
 *
 * Distance values are on 0-100 scale (same as coordinates).
 */
export interface NearAncestorPlacement {
  type: 'near_ancestor';

  /** Relationship kind for the lineage link (e.g., 'inspired_by', 'derived_from') */
  relationshipKind: string;

  /** Distance range from ancestor on the semantic plane (0-100 scale) */
  distanceRange: { min: number; max: number };

  /**
   * Filters to find an ancestor, tried in order.
   * First filter that returns results is used, then one entity is picked randomly.
   */
  ancestorFilter: AncestorFilterSpec[];
}

/**
 * Filter criteria for finding ancestor entities.
 * All specified fields must match (AND logic).
 */
export interface AncestorFilterSpec {
  kind: string;
  subtype?: string;
  status?: string;
  /** If true, prefer ancestors with same culture as the new entity */
  sameCulture?: boolean;
}

export interface CountRange {
  min: number;
  max: number;
}

/**
 * Lineage specification for automatic ancestor linking.
 *
 * When specified on a CreationRule, the framework will:
 * 1. Search for an ancestor using ancestorFilter (tries each filter in order)
 * 2. Create a relationship of relationshipKind from new entity to ancestor
 * 3. Set relationship.distance randomly within distanceRange (0-100 scale)
 *
 * This is separate from placement - the entity is placed according to its
 * placement spec, and the lineage relationship is created afterward.
 */
export interface LineageSpec {
  /** Relationship kind for the lineage link (e.g., 'inspired_by', 'derived_from') */
  relationshipKind: string;

  /**
   * Filters to find an ancestor, tried in order.
   * First filter that returns results is used, then one entity is picked randomly.
   * If no filter returns results, no lineage relationship is created.
   */
  ancestorFilter: AncestorFilterSpec[];

  /** Distance range for the lineage relationship (0-100 scale, Euclidean distance) */
  distanceRange: { min: number; max: number };
}

// =============================================================================
// STEP 4: RELATIONSHIP RULES
// =============================================================================

/**
 * Rules that define relationships to create.
 */
export interface RelationshipRule {
  kind: string;
  src: string;  // Entity reference: "$newEntity", "$target", "$faction"
  dst: string;  // Entity reference

  // Relationship attributes
  strength?: number;
  distance?: number | { min: number; max: number };

  // Special behaviors
  bidirectional?: boolean;
  catalyzedBy?: string;  // Entity reference

  // Conditional creation
  condition?: RelationshipCondition;
}

export type RelationshipCondition =
  | { type: 'random_chance'; chance: number }
  | { type: 'entity_exists'; entity: string }
  | { type: 'entity_has_relationship'; entity: string; relationshipKind: string }
  | { type: 'custom'; filterId: string; params?: Record<string, unknown> };

// =============================================================================
// STEP 5: STATE UPDATE RULES
// =============================================================================

/**
 * Rules for side effects after entity/relationship creation.
 */
export type StateUpdateRule =
  | { type: 'update_rate_limit' }
  | { type: 'archive_relationship'; entity: string; relationshipKind: string; with: string }
  | { type: 'modify_pressure'; pressureId: string; delta: number }
  | { type: 'update_entity_status'; entity: string; newStatus: string }
  | { type: 'set_tag'; entity: string; tag: string; value?: string | boolean }
  | { type: 'remove_tag'; entity: string; tag: string };

// =============================================================================
// VARIABLE DEFINITIONS
// =============================================================================

/**
 * Named entity references computed during execution.
 * Variables are resolved in order and can reference previously resolved variables.
 */
export interface VariableDefinition {
  select: VariableSelectionRule;
}

export interface VariableSelectionRule {
  // Select from graph or from related entities
  from?: RelatedEntitiesSpec | 'graph';

  // Selection strategy
  strategy?: 'by_kind' | 'by_preference_order';
  kind?: string;
  subtypes?: string[];
  subtypePreferences?: string[];
  statusFilter?: string;

  // Post-filters
  filters?: SelectionFilter[];

  // Prefer filters (try these first, fall back to all matches)
  preferFilters?: SelectionFilter[];

  // Result handling
  pickStrategy?: 'random' | 'first' | 'all';
  fallback?: string;  // Variable reference or fixed value if nothing found
}

export interface RelatedEntitiesSpec {
  relatedTo: string;  // Variable reference
  relationship: string;  // Relationship kind
  direction: 'src' | 'dst' | 'both';
}

// =============================================================================
// CUSTOM FILTER REGISTRY TYPES
// =============================================================================

/**
 * Context for template execution.
 */
export interface ExecutionContext {
  graphView: import('../graph/templateGraphView').TemplateGraphView;
  variables: Map<string, import('../core/worldTypes').HardState | import('../core/worldTypes').HardState[] | undefined>;
  target?: import('../core/worldTypes').HardState;
  // Stores for graph path traversal (e.g., "$controlled" -> set of entity IDs)
  pathSets: Map<string, Set<string>>;
}
