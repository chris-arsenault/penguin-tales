/**
 * Simulation Types
 *
 * Types for the browser-based simulation engine.
 * Owned by the Simulation Workshop component of Canonry.
 */

import type { Prominence } from './seed.js';

// ============================================================================
// CORE TYPES
// ============================================================================

/**
 * Count specification - fixed number or range
 */
export type CountSpec = number | { min: number; max: number };

/**
 * Reference to an entity (created in this rule or existing)
 */
export type EntityRef =
  | string                        // Simple ref name: "merchant"
  | { ref: string }               // Explicit: { ref: "merchant" }
  | { query: EntityQuery }        // Query existing: { query: { kind: "location" } }
  | { random: EntityQuery };      // Random from query: { random: { kind: "faction" } }

/**
 * Query for existing entities
 */
export interface EntityQuery {
  kind: string;
  subtype?: string;
  status?: string;
  culture?: string;
  hasTag?: string;
  hasRelationship?: { kind: string; direction: 'incoming' | 'outgoing' };
  notHasRelationship?: { kind: string; direction: 'incoming' | 'outgoing' };
}

// ============================================================================
// CONDITIONS
// ============================================================================

/**
 * Condition types for rule triggering
 */
export type ConditionType =
  // Entity counts
  | 'entity_count_below'      // Below distribution target
  | 'entity_count_above'      // Above a specific count
  | 'entity_count_range'      // Within a range
  | 'entity_exists'           // At least one entity matches
  // Pressure checks
  | 'pressure_above'          // Pressure > value
  | 'pressure_below'          // Pressure < value
  | 'pressure_range'          // Pressure within range
  // Relationship checks
  | 'relationship_exists'     // Relationship kind exists
  | 'entity_has_relationship' // Entity has specific relationship
  // Era/tick checks
  | 'current_era'             // Matches specific era
  | 'tick_range'              // Within tick range
  // Random
  | 'random_chance';          // Probability check

/**
 * A single condition - flat, no nesting
 */
export interface Condition {
  type: ConditionType;
  params: Record<string, unknown>;
  /** Optional NOT modifier */
  negate?: boolean;
}

// ============================================================================
// ENTITY TEMPLATES
// ============================================================================

/**
 * Prominence with probability distribution
 */
export type ProminenceDistribution = Array<{
  level: Prominence;
  probability: number;
}>;

/**
 * Placement specification for entity creation
 */
export interface PlacementSpec {
  /** Place near another entity */
  near?: EntityRef;
  /** Place in a specific semantic region */
  inRegion?: string;
  /** Random placement */
  random?: boolean;
  /** Culture handling: inherit from 'near', random, or specific ID */
  culture: 'inherit' | 'random' | string;
  /** Coordinate derivation strategy */
  coordinateStrategy: 'culture_aware' | 'region_center' | 'random';
}

/**
 * Template for creating an entity
 */
export interface EntityTemplate {
  /** Reference name for use in connect/occurrence */
  ref: string;
  /** Entity kind from schema */
  kind: string;
  /** Subtype from schema */
  subtype: string;
  /** How many to create */
  count: CountSpec;
  /** Where to place the entity */
  placement: PlacementSpec;
  /** Initial status */
  status: string;
  /** Prominence level or distribution */
  prominence: Prominence | ProminenceDistribution;
  /** Tags to apply */
  tags: string[];
  /** Description template with {ref.field} interpolation */
  descriptionTemplate: string;
}

// ============================================================================
// RELATIONSHIP TEMPLATES
// ============================================================================

/**
 * Template for creating a relationship
 */
export interface RelationshipTemplate {
  /** Relationship kind from schema */
  kind: string;
  /** Source entity */
  from: EntityRef;
  /** Target entity */
  to: EntityRef;
  /** When ref resolves to multiple entities, create one relationship per */
  forEach?: 'from' | 'to';
  /** Semantic distance (0-1) */
  distance?: number | { min: number; max: number };
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

// ============================================================================
// SELECTION (FOR SIMULATION RULES)
// ============================================================================

/**
 * Scoring specification for intelligent entity selection
 */
export interface ScoringSpec {
  /** Preferences (increase score) */
  prefer?: {
    sameLocationAs?: EntityRef;
    sameCultureAs?: EntityRef | string;
    subtypes?: string[];
    hasTags?: string[];
    /** Score multiplier for preferences */
    boost?: number;
  };
  /** Avoidances (decrease score) */
  avoid?: {
    hasRelationships?: string[];
    /** Penalty multiplier for highly-connected entities */
    hubPenalty?: number;
    /** Hard cutoff for relationships */
    maxRelationships?: number;
    /** Penalty for cross-culture selection */
    differentCulturePenalty?: number;
  };
  /** Create new entities if no good candidates */
  createIfNone?: {
    /** Minimum score to accept existing entity */
    threshold: number;
    /** Maximum new entities to create */
    maxCreate: number;
    /** Template for new entities */
    template: EntityTemplate;
  };
}

/**
 * Selection specification for simulation rules
 */
export interface SelectionSpec {
  /** Reference name for selected entities */
  ref: string;
  /** Query to find candidates */
  query: EntityQuery;
  /** How many to select */
  count: CountSpec;
  /** Selection strategy */
  strategy: 'random' | 'scored';
  /** Scoring config (required if strategy is 'scored') */
  scoring?: ScoringSpec;
}

// ============================================================================
// MODIFICATION (FOR SIMULATION RULES)
// ============================================================================

/**
 * Specification for modifying existing entities
 */
export interface ModifySpec {
  target: EntityRef;
  set?: {
    status?: string;
    prominence?: Prominence;
    addTags?: string[];
    removeTags?: string[];
  };
}

/**
 * Specification for removing relationships
 */
export interface DisconnectSpec {
  kind: string;
  from: EntityRef;
  to: EntityRef;
  /** Keep in history vs delete completely */
  archive?: boolean;
}

// ============================================================================
// OCCURRENCES
// ============================================================================

/**
 * Template for recording an occurrence (historical event)
 */
export interface OccurrenceTemplate {
  /** Occurrence kind (e.g., "founding", "conflict", "succession") */
  kind: string;
  /** Description template with {ref.field} interpolation */
  descriptionTemplate: string;
}

// ============================================================================
// PRESSURES
// ============================================================================

/**
 * Effect on a pressure value
 */
export interface PressureEffect {
  /** Pressure ID */
  pressure: string;
  /** Change amount (positive or negative) */
  delta: number;
}

/**
 * Definition of a pressure (global state variable)
 */
export interface PressureDefinition {
  /** Unique identifier */
  id: string;
  /** Display name */
  name: string;
  /** Human-readable description */
  description?: string;
  /** Starting value */
  initialValue: number;
  /** Valid range */
  range: { min: number; max: number };
  /** Natural drift per tick (before rules) */
  naturalDrift?: number;
  /** Equilibrium value to drift toward */
  equilibrium?: number;
  /** Rate of return to equilibrium (0-1) */
  decayRate?: number;
}

// ============================================================================
// RULES
// ============================================================================

/**
 * Metadata for coherence analysis
 */
export interface RuleMetadata {
  /** What this rule produces */
  produces?: {
    entityKinds?: Array<{ kind: string; subtype?: string; count: CountSpec }>;
    relationships?: Array<{ kind: string; count: CountSpec }>;
  };
  /** What this rule requires to fire */
  requires?: {
    entityKinds?: Array<{ kind: string; subtype?: string; min: number }>;
    relationships?: Array<{ kind: string; min: number }>;
    pressures?: Array<{ name: string; range: { min?: number; max?: number } }>;
  };
  /** Effects for analysis */
  effects?: {
    graphDensity?: number;        // -1 to 1
    clusterFormation?: number;    // 0 to 1
    diversityImpact?: number;     // 0 to 1
  };
  /** Tags for categorization */
  tags?: string[];
}

/**
 * Generation rule - fires during growth phase to populate the world
 */
export interface GenerationRule {
  /** Unique identifier */
  id: string;
  /** Display name */
  name: string;
  /** Human-readable description */
  description?: string;
  /** Conditions that must ALL be true (flat AND) */
  conditions: Condition[];
  /** Entities to create */
  create: EntityTemplate[];
  /** Relationships to form */
  connect: RelationshipTemplate[];
  /** Optional occurrence to record */
  occurrence?: OccurrenceTemplate;
  /** Optional pressure changes */
  pressureEffects?: PressureEffect[];
  /** Weight for weighted selection when multiple rules match */
  weight?: number;
  /** Metadata for coherence analysis */
  metadata: RuleMetadata;
}

/**
 * Simulation rule - fires during simulation phase to refine and connect
 */
export interface SimulationRule {
  /** Unique identifier */
  id: string;
  /** Display name */
  name: string;
  /** Human-readable description */
  description?: string;
  /** Conditions that must ALL be true (flat AND) */
  conditions: Condition[];
  /** Entities to select for operation */
  select: SelectionSpec[];
  /** Optional: entities to create (less common in simulation) */
  create?: EntityTemplate[];
  /** Relationships to form */
  connect: RelationshipTemplate[];
  /** Optional: modify existing entities */
  modify?: ModifySpec[];
  /** Optional: remove relationships */
  disconnect?: DisconnectSpec[];
  /** Optional occurrence to record */
  occurrence?: OccurrenceTemplate;
  /** Optional pressure changes */
  pressureEffects?: PressureEffect[];
  /** Weight for weighted selection */
  weight?: number;
  /** Metadata for coherence analysis */
  metadata: RuleMetadata;
}

// ============================================================================
// ERA RULE WEIGHTS
// ============================================================================

/**
 * Rule weights for a specific era
 */
export interface EraRuleWeights {
  /** Era ID (references an era from Cosmographer) */
  eraId: string;
  /** Generation rule weights (ruleId -> multiplier) */
  generationWeights: Record<string, number>;
  /** Simulation rule weights (ruleId -> multiplier) */
  simulationWeights: Record<string, number>;
  /** Pressure drift per tick during this era */
  pressureDrift: Record<string, number>;
}

// ============================================================================
// DISTRIBUTION TARGETS
// ============================================================================

/**
 * Distribution targets for coherence validation
 */
export interface DistributionTargets {
  /** Entity distribution targets */
  entities: {
    [kind: string]: {
      /** Target total count */
      total: CountSpec;
      /** Target proportions per subtype (0-1) */
      subtypes?: Record<string, number>;
    };
  };
  /** Relationship coverage targets */
  relationships: {
    /** Coverage targets per relationship kind (proportion 0-1) */
    coverage: Record<string, number>;
    /** Connectivity constraints */
    connectivity: {
      minPerEntity: number;
      maxHubSize: number;
    };
  };
  /** Culture representation targets */
  cultures: {
    minEntitiesPerCulture: number;
    maxVariance: number;
  };
  /** Temporal distribution targets */
  temporal: {
    minEntitiesPerEra: number;
    occurrencesPerEra: CountSpec;
  };
}

// ============================================================================
// FEEDBACK LOOPS (FOR STATIC ANALYSIS)
// ============================================================================

/**
 * Declaration of an expected feedback loop
 */
export interface FeedbackLoopDeclaration {
  /** Unique identifier */
  id: string;
  /** Human-readable description */
  description: string;
  /** The expected causal chain */
  chain: Array<{
    /** Rule ID or pressure ID */
    component: string;
    /** What effect it has */
    effect: string;
  }>;
}

// ============================================================================
// AGENT BEHAVIORS (OPTIONAL)
// ============================================================================

/**
 * An action an agent can take
 */
export interface AgentAction {
  /** Unique identifier */
  id: string;
  /** Weight for selection (higher = more likely) */
  weight: number;
  /** Conditions for this action to be available */
  conditions: Condition[];
  /** Effects of taking this action */
  effects: {
    createRelationship?: RelationshipTemplate;
    modifyEntity?: ModifySpec;
    adjustPressure?: PressureEffect;
    emitOccurrence?: OccurrenceTemplate;
  };
}

/**
 * Definition of agent behavior
 */
export interface AgentBehavior {
  /** Unique identifier */
  id: string;
  /** Which entities this behavior applies to */
  appliesTo: EntityQuery;
  /** Available actions */
  actions: AgentAction[];
}

// ============================================================================
// MODULES - REUSABLE CODE BLOCKS
// ============================================================================

/**
 * Module categories for organization
 */
export type ModuleCategory = 'scoring' | 'pressure' | 'filtering' | 'dynamics' | 'social';

/**
 * Parameter definition for module configuration
 */
export interface ModuleParameterDef {
  name: string;
  type: 'number' | 'string' | 'boolean' | 'string[]' | 'record';
  default: unknown;
  description?: string;
  min?: number;
  max?: number;
  options?: string[];
}

/**
 * Reference to a module with parameters
 */
export interface ModuleRef {
  /** Module ID from the registry */
  moduleId: string;
  /** Parameter overrides */
  params?: Record<string, unknown>;
}

/**
 * Hub Penalty module parameters
 */
export interface HubPenaltyParams {
  hubThreshold: number;      // default: 5
  penaltyBase: number;       // default: 0.7
  penaltyExponent: number;   // default: 1.0
  relationshipKinds?: string[]; // optional filter
}

/**
 * Population Ratio Pressure module parameters
 */
export interface PopulationRatioPressureParams {
  numeratorKind: string;
  numeratorSubtype?: string;
  denominatorKind: string;
  denominatorSubtype?: string;
  multiplier: number;        // default: 1.0
  offset: number;            // default: 0
}

/**
 * Culture Affinity module parameters
 */
export interface CultureAffinityParams {
  sameCultureBoost: number;         // default: 1.5
  differentCulturePenalty: number;  // default: 0.4
  mode: 'prefer' | 'avoid';         // default: 'prefer'
}

/**
 * Proximity Decay module parameters
 */
export interface ProximityDecayParams {
  closeDistance: number;     // default: 15
  mediumDistance: number;    // default: 30
  closeBoost: number;        // default: 1.5
  mediumBoost: number;       // default: 1.0
  farPenalty: number;        // default: 0.3
}

/**
 * Tag Filter module parameters
 */
export interface TagFilterParams {
  requiredTags: string[];
  forbiddenTags: string[];
  preferTags: string[];
  preferBoost: number;       // default: 1.5
}

/**
 * Relationship Decay module parameters
 */
export interface RelationshipDecayParams {
  decayRate: number;         // default: 0.02
  decayFloor: number;        // default: 0.1
  gracePeriodTicks: number;  // default: 20
  protectedKinds: string[];  // never decay these
}

/**
 * Contagion Spread module parameters
 */
export interface ContagionSpreadParams {
  transmissionRate: number;  // default: 0.1
  resistanceTag?: string;
  resistanceBonus: number;   // default: 0.3
  recoveryRate: number;      // default: 0.05
  transmissionRelationships: string[]; // default: ["member_of", "ally_of"]
  contagionTag: string;      // tag that spreads
}

/**
 * Prominence Evolution module parameters
 */
export interface ProminenceEvolutionParams {
  connectionThresholdBase: number;  // default: 6
  promotionChance: number;          // default: 0.3
  demotionThreshold: number;        // default: 2.0
  demotionChance: number;           // default: 0.7
}

/**
 * Faction Modifier module parameters
 */
export interface FactionModifierParams {
  sharedFactionBoost: number;       // default: 2.0
  alliedFactionBoost: number;       // default: 1.2
  enemyFactionBoost: number;        // default: 3.0 (for conflict)
  neutralPenalty: number;           // default: 0.3
  factionRelationshipKind: string;  // default: "member_of"
}

/**
 * Cooldown Tracking module parameters
 */
export interface CooldownParams {
  cooldownTicks: number;     // default: 10
  actionType: string;        // e.g., "romance", "conflict"
}

/**
 * Ratio Equilibrium Pressure module parameters
 */
export interface RatioEquilibriumPressureParams {
  measureKind: string;
  measureSubtype?: string;
  equilibriumRatio: number;  // default: 0.5
  sensitivity: number;       // default: 10
  baseValue: number;         // default: 50
}

/**
 * Status Gate module parameters
 */
export interface StatusGateParams {
  allowedStatuses: string[];
  blockedStatuses: string[];
}

/**
 * Union of all module parameter types
 */
export type ModuleParams =
  | HubPenaltyParams
  | PopulationRatioPressureParams
  | CultureAffinityParams
  | ProximityDecayParams
  | TagFilterParams
  | RelationshipDecayParams
  | ContagionSpreadParams
  | ProminenceEvolutionParams
  | FactionModifierParams
  | CooldownParams
  | RatioEquilibriumPressureParams
  | StatusGateParams;

/**
 * Pressure calculation using modules (replaces static thresholds)
 */
export interface DynamicPressureCalculation {
  /** Output pressure ID */
  pressureId: string;
  /** Module to calculate pressure value */
  module: ModuleRef;
  /** Threshold for condition to pass (pressure must exceed this) */
  threshold?: number;
}

/**
 * Selection scoring using modules (for intelligent entity selection)
 */
export interface SelectionScoringModules {
  /** Scoring modules to apply (multiplicative combination) */
  scorers: ModuleRef[];
  /** Minimum combined score to accept entity */
  minimumScore?: number;
}

// ============================================================================
// PLUGIN CONFIGURATION (FUTURE)
// ============================================================================

/**
 * Configuration for a simulation plugin
 */
export interface PluginConfig {
  /** Plugin identifier */
  id: string;
  /** Plugin type (e.g., 'diffusion', 'clustering') */
  type: string;
  /** Plugin-specific configuration */
  config: Record<string, unknown>;
  /** When the plugin runs */
  trigger: 'per_tick' | 'per_era' | 'on_demand';
}

// ============================================================================
// SIMULATION CONFIG (TOP-LEVEL)
// ============================================================================

/**
 * Simulation settings
 */
export interface SimulationSettings {
  /** Default ticks per era (if era doesn't specify) */
  ticksPerEra: number;
  /** Ratio of growth phases to simulation phases */
  growthSimulationRatio: number;
  /** Maximum total entities */
  maxEntities: number;
  /** Random seed for reproducibility */
  randomSeed?: number;
}

/**
 * Complete simulation configuration
 *
 * This is owned by the Simulation Workshop and stored in WorldSeedProject.
 */
export interface SimulationConfig {
  /** Simulation settings */
  settings: SimulationSettings;
  /** Pressure definitions */
  pressures: PressureDefinition[];
  /** Generation rules (growth phase) */
  generationRules: GenerationRule[];
  /** Simulation rules (refinement phase) */
  simulationRules: SimulationRule[];
  /** Rule weights per era (references era IDs from Cosmographer) */
  eraRuleWeights: Record<string, EraRuleWeights>;
  /** Distribution targets for coherence */
  distributionTargets: DistributionTargets;
  /** Declared feedback loops for static analysis */
  feedbackLoops?: FeedbackLoopDeclaration[];
  /** Agent behaviors */
  agentBehaviors?: AgentBehavior[];
  /** Plugin configurations */
  plugins?: PluginConfig[];
}
