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
  EntityTags
} from './types/worldTypes';

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
} from './types/engine';

export { ComponentPurpose, GraphStore } from './types/engine';

// =============================================================================
// DOMAIN SCHEMA TYPES - For implementing domain schemas
// =============================================================================

export type {
  DomainSchema,
  BaseDomainSchema,
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
  NameGenerator
} from './types/domainSchema';

export type {
  DomainLoreProvider
} from './types/domainLore';

export type {
  DistributionTargets
} from './types/distribution';

// =============================================================================
// SERVICES - For domain templates and systems
// =============================================================================

export { TemplateGraphView } from './graph/templateGraphView';
export { TargetSelector } from './selection/targetSelector';
export type { SelectionBias, SelectionResult } from './selection/targetSelector';

// Services for optional LLM integration (domain configures these)
export { EnrichmentService } from './llm/enrichmentService';
export { ImageGenerationService } from './llm/imageGenerationService';

// =============================================================================
// UTILITY FUNCTIONS - For domain templates and systems
// =============================================================================

// Core helpers
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
  arrayToTags
} from './utils/helpers';

// Name generation service (wraps name-forge)
export { NameForgeService } from './naming/nameForgeService';
export type { NameForgeConfig, NameForgeCultureConfig } from './naming/nameForgeService';

// Validation
export { validateWorld } from './utils/validators';
export type { ValidationResult, ValidationReport } from './utils/validators';

// Parameter configuration
export { applyParameterOverrides } from './utils/parameterOverrides';
export { extractParams } from './utils/parameterExtractor';

// Entity clustering (for meta-entity formation systems)
export {
  calculateSimilarity,
  detectClusters,
  filterClusterableEntities,
  findBestClusterMatch
} from './utils/clusteringUtils';

export type {
  Cluster,
  ClusterCriterion,
  ClusterCriterionType,
  ClusterConfig
} from './utils/clusteringUtils';

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
} from './utils/entityArchival';

export type {
  ArchiveEntityOptions,
  TransferRelationshipsOptions,
  SupersedeEntityOptions
} from './utils/entityArchival';

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
} from './utils/catalystHelpers';

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
} from './types/frameworkPrimitives';

export type {
  FrameworkEntityKind,
  FrameworkRelationshipKind,
  FrameworkStatus
} from './types/frameworkPrimitives';

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
} from './types/regions';

export { SPACE_BOUNDS } from './types/regions';

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
} from './types/semanticAxes';

export {
  SemanticEncoder,
  createSemanticEncoder
} from './coordinates/semanticEncoder';
