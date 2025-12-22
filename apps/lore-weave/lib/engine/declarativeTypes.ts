/**
 * Declarative Template Types
 *
 * These types define a JSON-serializable template format that can be
 * interpreted without custom TypeScript code. Templates become pure data
 * that the TemplateInterpreter executes.
 */

import type { Prominence } from '../core/worldTypes';

// Import types from rules/ (single source of truth)
import type {
  // Filter types
  SelectionFilter,
  ExcludeEntitiesFilter,
  HasRelationshipFilter,
  LacksRelationshipFilter,
  HasTagSelectionFilter,
  HasTagsSelectionFilter,
  HasAnyTagSelectionFilter,
  LacksTagSelectionFilter,
  LacksAnyTagSelectionFilter,
  HasCultureFilter,
  MatchesCultureFilter,
  HasStatusFilter,
  HasProminenceFilter,
  SharesRelatedFilter,
  GraphPathSelectionFilter,
  GraphPathAssertion,
  PathStep,
  PathConstraint,
} from '../rules/filters/types';

import type {
  SelectionRule,
  SaturationLimit,
  VariableSelectionRule,
  RelatedEntitiesSpec,
} from '../rules/selection/types';

import type {
  // Condition types (used for ApplicabilityRule)
  Condition,
  PressureCondition,
  PressureCompareCondition,
  PressureAnyAboveCondition,
  EntityCountCondition,
  EraMatchCondition,
  RandomChanceCondition,
  CooldownElapsedCondition,
  CreationsPerEpochCondition,
  AndCondition,
  OrCondition,
} from '../rules/conditions/types';

import type {
  // Mutation types (used for StateUpdateRule)
  Mutation,
  SetTagMutation,
  RemoveTagMutation,
  ArchiveRelationshipMutation,
  ChangeStatusMutation,
  ModifyPressureMutation,
  UpdateRateLimitMutation,
} from '../rules/mutations/types';

// Re-export filter types for callers that import from this module
export type {
  SelectionFilter,
  ExcludeEntitiesFilter,
  HasRelationshipFilter,
  LacksRelationshipFilter,
  HasTagSelectionFilter,
  HasTagsSelectionFilter,
  HasAnyTagSelectionFilter,
  LacksTagSelectionFilter,
  LacksAnyTagSelectionFilter,
  HasCultureFilter,
  MatchesCultureFilter,
  HasStatusFilter,
  HasProminenceFilter,
  SharesRelatedFilter,
  GraphPathSelectionFilter,
  GraphPathAssertion,
  PathStep,
  PathConstraint,
};

export type {
  SelectionRule,
  SaturationLimit,
  VariableSelectionRule,
  RelatedEntitiesSpec,
};

// =============================================================================
// UNIFIED TYPE ALIASES
// =============================================================================

/**
 * ApplicabilityRule is now an alias for Condition from rules/.
 * This unifies the type names across the stack.
 */
export type ApplicabilityRule = Condition;

// Re-export condition types under their canonical names
export type {
  Condition,
  PressureCondition,
  PressureCompareCondition,
  PressureAnyAboveCondition,
  EntityCountCondition,
  EraMatchCondition,
  RandomChanceCondition,
  CooldownElapsedCondition,
  CreationsPerEpochCondition,
  AndCondition,
  OrCondition,
};

// Legacy type aliases for backwards compatibility with existing JSON
export type PressureRule = PressureCondition;
export type PressureAnyAboveRule = PressureAnyAboveCondition;
export type PressureCompareRule = PressureCompareCondition;
export type EntityCountRule = EntityCountCondition;
export type EraMatchRule = EraMatchCondition;
export type RandomChanceRule = RandomChanceCondition;
export type CooldownElapsedRule = CooldownElapsedCondition;
export type CreationsPerEpochRule = CreationsPerEpochCondition;
export type CompositeApplicabilityRule = AndCondition | OrCondition;

/**
 * StateUpdateRule is now an alias for Mutation from rules/.
 */
export type StateUpdateRule = Mutation;

// Re-export mutation types
export type {
  Mutation,
  SetTagMutation,
  RemoveTagMutation,
  ArchiveRelationshipMutation,
  ChangeStatusMutation,
  ModifyPressureMutation,
  UpdateRateLimitMutation,
};

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
// STEP 2: SELECTION RULES
// =============================================================================

// SelectionRule, SaturationLimit, and variable selection types are imported from rules/selection/types

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

export type RelationshipCondition = Condition;

// =============================================================================
// StateUpdateRule is now defined at the top as an alias for Mutation from rules/

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

// VariableSelectionRule and RelatedEntitiesSpec are imported from rules/selection/types

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
export type VariantCondition = Condition;

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
  graphView: import('../runtime/worldRuntime').WorldRuntime;
  variables: Map<string, import('../core/worldTypes').HardState | import('../core/worldTypes').HardState[] | undefined>;
  target?: import('../core/worldTypes').HardState;
  // Stores for graph path traversal (e.g., "$controlled" -> set of entity IDs)
  pathSets: Map<string, Set<string>>;
}
