/**
 * Lore Weave - Procedural World History Generation Framework
 *
 * PUBLIC API - These exports form the contract between framework and domain.
 * Internal framework services and utilities are not exported.
 */

// =============================================================================
// CORE ENGINE
// =============================================================================

export { WorldEngine } from './engine/worldEngine';

// =============================================================================
// CORE TYPES - Used by domain for type definitions
// =============================================================================

export type {
  HardState,
  Relationship,
  Prominence,
  EntityKind,
  EntityTags,
  NPCSubtype,
  FactionSubtype
} from './core/worldTypes';

export type {
  Graph,
  Era,
  Pressure,
  GrowthTemplate,
  SimulationSystem,
  EngineConfig,
  HistoryEvent,
  SystemResult,
  TemplateResult,
  MetaEntityConfig,
  EntityOperatorRegistry,
  NameGenerationService,
  TagMetadata,
  AncestorFilter
} from './engine/types';

export { ComponentPurpose, GraphStore } from './engine/types';

// =============================================================================
// DOMAIN SCHEMA TYPES - For implementing domain schemas
// =============================================================================

export type {
  DomainSchema,
  RelationshipKindDefinition,
  DecayRate,
  SnapshotConfig,
  EntityKindDefinition,
  SubtypeDefinition,
  StatusDefinition,
  EntityKindStyle,
  DomainUIConfig,
  CultureDefinition,
  NameGenerator,
  ImageGenerationPromptConfig,
  CultureImageConfig
} from './domainInterface/domainSchema';

// BaseDomainSchema is a class, not just a type
export { BaseDomainSchema } from './domainInterface/domainSchema';

// LLM types moved to @illuminator - import from there if needed

export type {
  DistributionTargets
} from './statistics/types';

// =============================================================================
// SERVICES - For domain templates and systems
// =============================================================================

export { TemplateGraphView } from './graph/templateGraphView';
export { TargetSelector } from './selection/targetSelector';
export type { SelectionBias, SelectionResult } from './selection/targetSelector';

// LLM services moved to @illuminator - import from there if needed

// Cultural awareness analysis (debugging/reporting)
export { CulturalAwarenessAnalyzer } from './statistics/culturalAwarenessAnalyzer';
export type { CulturalAwarenessReport } from './statistics/culturalAwarenessAnalyzer';

// =============================================================================
// UTILITY FUNCTIONS - For domain templates and systems
// =============================================================================

// Core helpers (re-exported from utils index)
export {
  generateId,
  pickRandom,
  pickMultiple,
  findEntities,
  getRelated,
  hasRelationship,
  normalizeInitialState,
  slugifyName,
  archiveRelationship,
  addRelationshipWithDistance,
  modifyRelationshipStrength,
  areRelationshipsCompatible,
  // Tag utilities
  mergeTags,
  hasTag,
  getTagValue,
  getTrueTagKeys,
  getStringTags,
  arrayToTags,
  // Additional entity/relationship utilities
  rollProbability,
  addEntity,
  addRelationship,
  canFormRelationship,
  recordRelationshipFormation,
  getProminenceValue,
  adjustProminence,
  getConnectionWeight
} from './utils';

// Name generation service (wraps name-forge)
export { NameForgeService } from './naming/nameForgeService';
export type { Culture, CultureNamingConfig } from './naming/nameForgeService';

// Validation
export { validateWorld } from './engine/validators';
export type { ValidationResult, ValidationReport } from './engine/validators';

// Entity clustering (for meta-entity formation systems)
export {
  calculateSimilarity,
  detectClusters,
  filterClusterableEntities,
  findBestClusterMatch
} from './graph/clusteringUtils';

export type {
  Cluster,
  ClusterCriterion,
  ClusterCriterionType,
  ClusterConfig
} from './graph/clusteringUtils';

// Entity archival (for entity lifecycle management)
export {
  archiveEntity,
  archiveEntities,
  transferRelationships,
  createPartOfRelationships,
  getActiveRelationships,
  getHistoricalRelationships,
  isHistoricalEntity,
  getPartOfMembers,
  supersedeEntity
} from './graph/entityArchival';

export type {
  ArchiveEntityOptions,
  TransferRelationshipsOptions,
  SupersedeEntityOptions
} from './graph/entityArchival';

// Template building utilities
export { EntityClusterBuilder } from './graph/entityClusterBuilder';
export { buildRelationships } from './graph/relationshipBuilder';

// Catalyst helpers (for domain occurrence/catalyst systems)
export {
  initializeCatalyst,
  initializeCatalystSmart,
  getAgentsByCategory,
  canPerformAction,
  getInfluence,
  recordCatalyst,
  getCatalyzedEvents,
  getCatalyzedEventCount,
  addCatalyzedEvent,
  calculateAttemptChance,
  updateInfluence
} from './systems/catalystHelpers';

// =============================================================================
// FRAMEWORK SYSTEMS - Included via declarative shells in systems.json
// =============================================================================

// Framework systems are exposed via thin declarative shells (systemType: 'eraSpawner', etc.)
// This makes them visible in the Canonry UI and allows enable/disable toggling.
// The actual implementations are imperative TypeScript that access engine internals.
// Note: Use the factory functions (createEraSpawnerSystem, createEraTransitionSystem, etc.)
// accessed via the systemInterpreter, not deprecated singleton exports.
export { createConnectionEvolutionSystem } from './systems/connectionEvolution';
export type {
  ConnectionEvolutionConfig,
  MetricType,
  MetricConfig,
  EvolutionRule,
  ActionType,
  ConditionOperator,
  ThresholdValue,
  SubtypeBonus
} from './systems/connectionEvolution';

export { createGraphContagionSystem } from './systems/graphContagion';
export type {
  GraphContagionConfig,
  MarkerType,
  ContagionMarker,
  TransmissionVector,
  TransmissionConfig,
  RecoveryConfig,
  ContagionAction,
  PhaseTransition,
  MultiSourceConfig
} from './systems/graphContagion';

export { createThresholdTriggerSystem } from './systems/thresholdTrigger';
export type {
  ThresholdTriggerConfig,
  TriggerCondition,
  TriggerAction,
  TriggerActionType,
  ConditionType,
  EntityFilter
} from './systems/thresholdTrigger';

export { createClusterFormationSystem } from './systems/clusterFormation';
export type {
  ClusterFormationConfig,
  EntityFilter as ClusterEntityFilter,
  DeclarativeClusterCriterion,
  DeclarativeClusterConfig,
  MetaEntityConfig as ClusterMetaEntityConfig,
  PostProcessConfig
} from './systems/clusterFormation';

export { createTagDiffusionSystem } from './systems/tagDiffusion';
export type {
  TagDiffusionConfig,
  ConvergenceConfig,
  DivergenceConfig
} from './systems/tagDiffusion';

export { createPlaneDiffusionSystem } from './systems/planeDiffusion';
export type {
  PlaneDiffusionConfig,
  DiffusionSourceConfig,
  DiffusionSinkConfig,
  DiffusionParams,
  DiffusionOutputTag,
  FalloffType
} from './systems/planeDiffusion';

// =============================================================================
// DECLARATIVE ACTIONS - Agent action definitions for universalCatalyst
// =============================================================================

export { loadActions, createExecutableAction } from './engine/actionInterpreter';
export type {
  DeclarativeAction,
  ActionActorConfig,
  ActionActorResolution,
  ActionTargetConfig,
  ActionOutcomeConfig,
  ActionProbabilityConfig,
  ExecutableAction,
  ActionResult
} from './engine/actionInterpreter';

// =============================================================================
// FRAMEWORK PRIMITIVES - Minimal constants needed by domain
// =============================================================================

export {
  FRAMEWORK_ENTITY_KINDS,
  FRAMEWORK_RELATIONSHIP_KINDS,
  FRAMEWORK_STATUS
} from './core/frameworkPrimitives';

export type {
  FrameworkEntityKind,
  FrameworkRelationshipKind,
  FrameworkStatus
} from './core/frameworkPrimitives';

// =============================================================================
// REGION-BASED COORDINATE SYSTEM
// =============================================================================

export type {
  Point,
  Region,
  RegionShape,
  RegionBounds,
  CircleBounds,
  RectBounds,
  PolygonBounds,
  RegionMapperConfig,
  RegionLookupResult,
  SampleRegionOptions,
  EmergentRegionConfig,
  EmergentRegionResult,
  RegionCreatedEvent,
  EntityPlacedInRegionEvent,
  // Per-kind coordinate maps
  MapBounds,
  EntityKindMapConfig,
  EntityKindMapState,
  EntityKindMaps,
  EntityKindMapsState
} from './coordinates/types';

export { SPACE_BOUNDS } from './coordinates/types';

export { RegionMapper } from './coordinates/regionMapper';

export { RegionPlacementService } from './coordinates/regionPlacement';
export type {
  PlacementOptions as RegionPlacementOptions,
  PlacementResult as RegionPlacementResult,
  BatchPlacementOptions as RegionBatchPlacementOptions,
  BatchPlacementResult as RegionBatchPlacementResult
} from './coordinates/regionPlacement';

// Per-kind region management
export {
  KindRegionService,
  createDefaultEmergentConfig,
  createKindMapConfig
} from './coordinates/kindRegionService';
export type { KindRegionServiceConfig } from './coordinates/kindRegionService';

// =============================================================================
// SEMANTIC AXIS SYSTEM
// =============================================================================

export type {
  SemanticAxis,
  EntityKindAxes,
  TagSemanticWeight,
  TagSemanticWeights,
  SemanticEncodingResult,
  SemanticEncoderConfig
} from './coordinates/types';

export {
  SemanticEncoder,
  createSemanticEncoder
} from './coordinates/semanticEncoder';

// =============================================================================
// COORDINATE CONTEXT (Culture-First Placement)
// =============================================================================

export {
  CoordinateContext,
  createCoordinateContext
} from './coordinates/coordinateContext';

export type {
  CoordinateContextConfig,
  EntityKindConfig,
  CultureConfig,
  SemanticPlane,
  KindAxisBiases,
  PlacementContext,
  PlacementResult
} from './coordinates/coordinateContext';

// =============================================================================
// COORDINATE STATISTICS (Diagnostics)
// =============================================================================

export { coordinateStats } from './coordinates/coordinateStatistics';
export type {
  PlacementEvent,
  CultureClusterStats,
  CoordinateStatsSummary
} from './coordinates/coordinateStatistics';

// =============================================================================
// DECLARATIVE TEMPLATE SYSTEM
// =============================================================================

export { TemplateInterpreter, createTemplateFromDeclarative } from './engine/templateInterpreter';

export type {
  DeclarativeTemplate,
  ApplicabilityRule,
  SelectionRule,
  SelectionFilter,
  CreationRule,
  RelationshipRule,
  StateUpdateRule,
  VariableDefinition,
  ExecutionContext,
  // Specific rule types
  PressureThresholdRule,
  EntityCountMinRule,
  EntityCountMaxRule,
  TagExistsApplicabilityRule,
  TagAbsentApplicabilityRule,
  GraphPathApplicabilityRule,
  GraphPathAssertion,
  PathStep,
  PathConstraint,
  GraphPathSelectionFilter,
  SubtypeSpec,
  CultureSpec,
  PlacementSpec,
  RelationshipCondition
} from './engine/declarativeTypes';

// =============================================================================
// DECLARATIVE PRESSURE SYSTEM
// =============================================================================

export {
  createPressureFromDeclarative,
  loadPressures,
  loadPressure
} from './engine/pressureInterpreter';

export type {
  DeclarativePressure,
  PressuresFile,
  FeedbackFactor,
  EntityCountFactor,
  RelationshipCountFactor,
  TagCountFactor,
  RatioFactor,
  StatusRatioFactor,
  CrossCultureRatioFactor,
  SimpleCountFactor
} from './engine/declarativePressureTypes';

// =============================================================================
// DECLARATIVE SYSTEM INTERPRETER
// =============================================================================

export {
  createSystemFromDeclarative,
  loadSystems,
  isDeclarativeSystem
} from './engine/systemInterpreter';

export type {
  DeclarativeSystem,
  DeclarativeConnectionEvolutionSystem,
  DeclarativeGraphContagionSystem,
  DeclarativeThresholdTriggerSystem,
  DeclarativeClusterFormationSystem,
  DeclarativeTagDiffusionSystem,
  DeclarativePlaneDiffusionSystem,
  // Framework system declarative shells
  FrameworkSystemConfig,
  DeclarativeEraSpawnerSystem,
  DeclarativeEraTransitionSystem,
  DeclarativeUniversalCatalystSystem,
  // Era system config types
  EraTransitionConfig,
  EraSpawnerConfig
} from './engine/systemInterpreter';

// Era transition condition types (defined per-era in eras.json)
export type {
  TransitionCondition,
  PressureTransitionCondition,
  EntityCountTransitionCondition,
  TimeTransitionCondition,
  EraTransitionEffects
} from './engine/types';

// =============================================================================
// DECLARATIVE DOMAIN SCHEMA SYSTEM
// =============================================================================

export {
  createDomainSchemaFromJSON,
  loadDomainSchema
} from './engine/domainSchemaInterpreter';

export type {
  JSONDomainSchema,
  JSONEntityKind,
  JSONRelationshipKind,
  JSONCulture,
  JSONSubtype,
  JSONStatus
} from './engine/domainSchemaInterpreter';

// =============================================================================
// OBSERVER PATTERN - Real-time simulation events
// =============================================================================

export { SimulationEmitter } from './observer/SimulationEmitter';
export type {
  ISimulationEmitter,
  SimulationEvent,
  ProgressPayload,
  LogPayload,
  ValidationPayload,
  EpochStartPayload,
  EpochStatsPayload,
  GrowthPhasePayload,
  PopulationPayload,
  PopulationMetricPayload,
  TemplateUsagePayload,
  CoordinateStatsPayload,
  TagHealthPayload,
  SystemHealthPayload,
  EntityBreakdownPayload,
  CatalystStatsPayload,
  RelationshipBreakdownPayload,
  NotableEntitiesPayload,
  SampleHistoryPayload,
  SimulationResultPayload,
  ErrorPayload,
  WorkerInboundMessage,
  WorkerOutboundMessage
} from './observer/types';
