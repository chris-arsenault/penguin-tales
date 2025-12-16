/**
 * Declarative Template Types
 *
 * These types define a JSON-serializable template format that can be
 * interpreted without custom TypeScript code. Templates become pure data
 * that the TemplateInterpreter executes.
 */

import type { Prominence } from '../core/worldTypes';

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

  // Step 6: Conditional variants that modify the template based on world state
  variants?: TemplateVariants;
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
  | PressureCompareRule
  | EntityCountMinRule
  | EntityCountMaxRule
  | EraMatchRule
  | RandomChanceRule
  | CooldownElapsedRule
  | CreationsPerEpochRule
  | CompositeApplicabilityRule;

export interface PressureThresholdRule {
  type: 'pressure_threshold';
  pressureId: string;
  min: number;
  max: number;
}

export interface PressureAnyAboveRule {
  type: 'pressure_any_above';
  pressureIds: string[];
  threshold: number;
}

export interface PressureCompareRule {
  type: 'pressure_compare';
  pressureA: string;
  pressureB: string;
  // Only > supported: pressureA > pressureB
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
 * Graph path assertion - used by selection filters.
 */
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
  | HasTagsSelectionFilter
  | HasAnyTagSelectionFilter
  | LacksTagSelectionFilter
  | LacksAnyTagSelectionFilter
  | HasCultureFilter
  | MatchesCultureFilter
  | HasStatusFilter
  | HasProminenceFilter
  | SharesRelatedFilter
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

/**
 * Filter entities that have ALL specified tags (AND semantics).
 * Use has_any_tag for OR semantics.
 */
export interface HasTagsSelectionFilter {
  type: 'has_tags';
  tags: string[];
}

export interface HasAnyTagSelectionFilter {
  type: 'has_any_tag';
  tags: string[];
}

export interface LacksTagSelectionFilter {
  type: 'lacks_tag';
  tag: string;
  value?: string | boolean;  // If specified, only excludes if tag has this value
}

export interface LacksAnyTagSelectionFilter {
  type: 'lacks_any_tag';
  tags: string[];  // Excludes entities that have ANY of these tags
}

export interface HasCultureFilter {
  type: 'has_culture';
  culture: string;
}

export interface MatchesCultureFilter {
  type: 'matches_culture';
  with: string;  // Variable reference like "$target"
}

export interface HasStatusFilter {
  type: 'has_status';
  status: string;
}

export interface HasProminenceFilter {
  type: 'has_prominence';
  minProminence: Prominence;
}

/**
 * Filter entities that share a common related entity with a reference.
 * Example: Find entities that share the same location as $target via 'resident_of' relationship.
 */
export interface SharesRelatedFilter {
  type: 'shares_related';
  relationshipKind: string;  // Relationship kind to check (e.g., 'resident_of')
  with: string;              // Reference entity (e.g., '$target')
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
 * Placement Specification
 *
 * Controls where entities are placed on their semantic plane.
 * Each entity kind has its own independent coordinate space (0-100 scale).
 *
 * IMPORTANT: References in 'entity' anchors must be the SAME KIND as the
 * entity being created. Cross-kind associations use relationships instead.
 */

/** Anchor determines the primary placement strategy */
export type PlacementAnchor =
  | { type: 'entity'; ref: string; stickToRegion?: boolean }
  | { type: 'culture'; id: string }
  | { type: 'refs_centroid'; refs: string[]; jitter?: number }
  | { type: 'sparse'; preferPeriphery?: boolean }
  | { type: 'bounds'; bounds?: { x: [number, number]; y: [number, number]; z?: [number, number] } };

/** Spacing constraints for placement */
export interface PlacementSpacing {
  minDistance?: number;
  avoidRefs?: string[];
}

/** Region creation policy */
export interface PlacementRegionPolicy {
  /** Allow emergent region creation when seed regions are at capacity */
  allowEmergent?: boolean;
  /** Create a new region centered on the placed entity (useful for sparse placement establishing new territories) */
  createRegion?: boolean;
  /** Bias region selection toward sparser regions (weighted by inverse entity count) */
  preferSparse?: boolean;
}

/** Fallback strategies when primary placement fails */
export type PlacementFallback = 'anchor_region' | 'ref_region' | 'seed_region' | 'sparse' | 'bounds' | 'random';

/** Placement specification */
export interface PlacementSpec {
  anchor: PlacementAnchor;
  spacing?: PlacementSpacing;
  regionPolicy?: PlacementRegionPolicy;
  fallback?: PlacementFallback[];
}

export interface CountRange {
  min: number;
  max: number;
}

// =============================================================================
// STEP 4: RELATIONSHIP RULES
// =============================================================================

/**
 * Rules that define relationships to create.
 *
 * IMPORTANT: relationship.distance is ALWAYS computed from Euclidean distance
 * between src and dst coordinates. It cannot be set directly.
 */
export interface RelationshipRule {
  kind: string;
  src: string;  // Entity reference: "$newEntity", "$target", "$faction"
  dst: string;  // Entity reference

  // Relationship attributes
  strength: number;  // 0.0 (weak/spatial) to 1.0 (strong/narrative)
  // Note: distance is computed from coordinates, not specified here

  // Special behaviors
  bidirectional?: boolean;
  catalyzedBy?: string;  // Entity reference

  // Conditional creation
  condition?: RelationshipCondition;
}

export type RelationshipCondition =
  | { type: 'random_chance'; chance: number }
  | { type: 'entity_exists'; entity: string }
  | { type: 'entity_has_relationship'; entity: string; relationshipKind: string };

// =============================================================================
// STEP 5: STATE UPDATE RULES
// =============================================================================

/**
 * Rules for side effects after entity/relationship creation.
 */
export type StateUpdateRule =
  | { type: 'update_rate_limit' }
  | { type: 'archive_relationship'; entity: string; relationshipKind: string; with: string; direction?: 'src' | 'dst' | 'any' }
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
  /**
   * If true, the template will not run unless this variable resolves to at least one entity.
   * Use this when the template logic depends on the variable existing.
   */
  required?: boolean;
}

export interface VariableSelectionRule {
  // Select from graph or from related entities
  from?: RelatedEntitiesSpec | 'graph';

  // Entity filtering (kind used when from='graph')
  kind?: string;
  subtypes?: string[];
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
// STEP 6: TEMPLATE VARIANTS
// =============================================================================

/**
 * Conditional variants that modify template output based on world state.
 * Allows a single template to produce different outcomes (tags, relationships,
 * state updates) depending on pressures, entity counts, or random chance.
 */
export interface TemplateVariants {
  /** How to select which variant(s) to apply */
  selection: 'first_match' | 'all_matching';

  /** Available variant options */
  options: TemplateVariant[];
}

/**
 * A single variant option with its condition and effects.
 */
export interface TemplateVariant {
  /** Human-readable name for this variant */
  name: string;

  /** Condition that must be met for this variant to apply */
  when: VariantCondition;

  /** Effects to apply when this variant is selected */
  apply: VariantEffects;
}

/**
 * Conditions for variant selection.
 */
export type VariantCondition =
  | { type: 'pressure'; pressureId: string; min?: number; max?: number }
  | { type: 'pressure_compare'; pressureA: string; pressureB: string }
  | { type: 'entity_count'; kind: string; subtype?: string; min?: number; max?: number }
  | { type: 'has_tag'; entity: string; tag: string }
  | { type: 'random'; chance: number }
  | { type: 'always' }
  | { type: 'and'; conditions: VariantCondition[] }
  | { type: 'or'; conditions: VariantCondition[] };

/**
 * Effects applied when a variant is selected.
 * All fields are optional - only specified fields are applied.
 */
export interface VariantEffects {
  /** Override subtype for created entities. Key is entityRef (e.g., "$location") */
  subtype?: Record<string, string>;

  /** Additional tags to add to created entities. Key is entityRef */
  tags?: Record<string, Record<string, boolean>>;

  /** Additional relationships to create */
  relationships?: RelationshipRule[];

  /** Additional state updates to apply */
  stateUpdates?: StateUpdateRule[];
}

// =============================================================================
// EXECUTION CONTEXT
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
