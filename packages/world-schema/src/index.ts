/**
 * @canonry/world-schema
 *
 * Shared types for The Canonry world-building suite.
 * This package contains ONLY types - no runtime code, no dependencies.
 */

// Entity Kind types
export type {
  Subtype,
  Status,
  SemanticAxis,
  CircleBounds,
  RectBounds,
  SemanticRegion,
  SemanticPlane,
  EntityKindStyle,
  EntityKindDefinition,
} from './entityKind.js';

// Relationship types
export type { RelationshipKindDefinition } from './relationship.js';

// Culture types
export type {
  AxisBias,
  CultureVisualData,
  CultureDefinition,
} from './culture.js';

// Naming types (Name-Forge)
export type {
  PhonologyProfile,
  MorphologyProfile,
  Capitalization,
  RhythmBias,
  StyleRules,
  NamingDomain,
  LexemeList,
  Grammar,
  NamingStrategy,
  StrategyGroupConditions,
  StrategyGroup,
  NamingProfile,
  CultureNamingData,
} from './naming.js';

// Seed data types
export type {
  Prominence,
  SemanticCoordinates,
  SeedEntity,
  SeedRelationship,
} from './seed.js';

// Era types (Cosmographer)
export type { EraDefinition } from './era.js';

// Simulation types (Simulation Workshop)
export type {
  // Core types
  CountSpec,
  EntityRef,
  EntityQuery,
  // Conditions
  ConditionType,
  Condition,
  // Entity templates
  ProminenceDistribution,
  PlacementSpec,
  EntityTemplate,
  // Relationship templates
  RelationshipTemplate,
  // Selection
  ScoringSpec,
  SelectionSpec,
  // Modification
  ModifySpec,
  DisconnectSpec,
  // Occurrences
  OccurrenceTemplate,
  // Pressures
  PressureEffect,
  PressureDefinition,
  // Rules
  RuleMetadata,
  GenerationRule,
  SimulationRule,
  // Era weights
  EraRuleWeights,
  // Distribution targets
  DistributionTargets,
  // Feedback loops
  FeedbackLoopDeclaration,
  // Agents
  AgentAction,
  AgentBehavior,
  // Plugins
  PluginConfig,
  // Top-level config
  SimulationSettings,
  SimulationConfig,
  // Module types
  ModuleCategory,
  ModuleParameterDef,
  ModuleRef,
  HubPenaltyParams,
  PopulationRatioPressureParams,
  CultureAffinityParams,
  ProximityDecayParams,
  TagFilterParams,
  RelationshipDecayParams,
  ContagionSpreadParams,
  ProminenceEvolutionParams,
  FactionModifierParams,
  CooldownParams,
  RatioEquilibriumPressureParams,
  StatusGateParams,
  ModuleParams,
  DynamicPressureCalculation,
  SelectionScoringModules,
} from './simulation.js';

// Project types
export type { WorldSeedProject, ProjectMetadata } from './project.js';
