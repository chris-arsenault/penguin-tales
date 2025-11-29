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
  TagMetadata
} from './engine/types';

export { ComponentPurpose, GraphStore } from './engine/types';

// =============================================================================
// DOMAIN SCHEMA TYPES - For implementing domain schemas
// =============================================================================

export type {
  DomainSchema,
  RelationshipKindDefinition,
  RelationshipConfig,
  RelationshipLimits,
  RelationshipCategory,
  SnapshotConfig,
  EntityKindDefinition,
  EntityKindStyle,
  DomainUIConfig,
  EmergentDiscoveryConfig,
  CultureDefinition,
  NameGenerator,
  ImageGenerationPromptConfig,
  CultureImageConfig
} from './domainInterface/domainSchema';

// BaseDomainSchema is a class, not just a type
export { BaseDomainSchema } from './domainInterface/domainSchema';

export type {
  DomainLoreProvider,
  CulturalGroup,
  NamingRules,
  GeographyConstraints
} from './llm/types';

export type {
  DistributionTargets
} from './statistics/types';

// =============================================================================
// SERVICES - For domain templates and systems
// =============================================================================

export { TemplateGraphView } from './graph/templateGraphView';
export { TargetSelector } from './selection/targetSelector';
export type { SelectionBias, SelectionResult } from './selection/targetSelector';

// Services for optional LLM integration (domain configures these)
export { EnrichmentService } from './llm/enrichmentService';
export { ImageGenerationService } from './llm/imageGenerationService';

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
  getLocation,
  getFactionMembers,
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
  tagsToArray,
  arrayToTags,
  // Additional entity/relationship utilities
  rollProbability,
  addEntity,
  addRelationship,
  canFormRelationship,
  recordRelationshipFormation,
  getProminenceValue,
  adjustProminence,
  getConnectionWeight,
  getFactionRelationship
} from './utils';

// Name generation service (wraps name-forge)
export { NameForgeService } from './naming/nameForgeService';
export type { NameForgeConfig, NameForgeProjectFile, Culture } from './naming/nameForgeService';

// Validation
export { validateWorld } from './engine/validators';
export type { ValidationResult, ValidationReport } from './engine/validators';

// Parameter configuration
export { applyParameterOverrides } from './engine/parameterOverrides';
export { extractParams } from './engine/parameterExtractor';

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
// FRAMEWORK SYSTEMS - Domain registers these with engine config
// =============================================================================

export { relationshipCulling } from './systems/relationshipCulling';
export { eraSpawner } from './systems/eraSpawner';
export { eraTransition } from './systems/eraTransition';
export { universalCatalyst } from './systems/universalCatalyst';

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

// Feedback loop types (domain provides feedback loop configuration)
export type { FeedbackLoop } from './feedback/feedbackAnalyzer';

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
  CultureCoordinateConfig,
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
