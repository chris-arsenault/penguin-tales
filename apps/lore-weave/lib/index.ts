/**
 * Lore Weave - Procedural World History Generation Framework
 *
 * This module exports all framework types, classes, and utilities.
 * Domain-specific implementations (like penguin-tales) import from here.
 */

// Core Engine
export { WorldEngine } from './engine/worldEngine';
export { FrameworkValidator } from './engine/frameworkValidator';
export { ContractEnforcer } from './engine/contractEnforcer';
export { ChangeDetector, detectChanges } from './engine/changeDetection';
export { ValidationOrchestrator } from './engine/validationOrchestrator';

// Core Types
export type {
  HardState,
  Relationship,
  Prominence,
  EntityKind,
  Catalyst
} from './types/worldTypes';

export type {
  Graph,
  Era,
  Pressure,
  GrowthTemplate,
  SimulationSystem,
  EngineConfig,
  HistoryEvent,
  SystemResult
} from './types/engine';

export type {
  DomainSchema,
  EntityKindSchema,
  RelationshipKindDefinition,
  RelationshipConfig,
  RelationshipLimits,
  RelationshipCategory,
  DomainCapabilities,
  SnapshotConfig,
  EntityKindDefinition,
  EmergentDiscoveryConfig
} from './types/domainSchema';

export type {
  DistributionTargets,
  DistributionTarget
} from './types/distribution';

export type {
  LoreRecord,
  EntityLore,
  RelationshipLore,
  EraNarrative
} from './types/lore';

// Framework Primitives (domain-agnostic types)
export {
  FRAMEWORK_ENTITY_KINDS,
  FRAMEWORK_RELATIONSHIP_KINDS,
  FRAMEWORK_STATUS,
  FRAMEWORK_ENTITY_KIND_VALUES,
  FRAMEWORK_RELATIONSHIP_KIND_VALUES,
  FRAMEWORK_STATUS_VALUES,
  FRAMEWORK_ERA_STATUS_VALUES,
  FRAMEWORK_OCCURRENCE_STATUS_VALUES,
  FRAMEWORK_RELATIONSHIP_PROPERTIES,
  isFrameworkEntityKind,
  isFrameworkRelationshipKind,
  isFrameworkStatus,
  isFrameworkEntity,
  isFrameworkRelationship,
  getFrameworkRelationshipStrength,
  isProtectedFrameworkRelationship
} from './types/frameworkPrimitives';

export type {
  FrameworkEntityKind,
  FrameworkRelationshipKind,
  FrameworkStatus
} from './types/frameworkPrimitives';

export type {
  DomainLoreProvider,
  LoreContext,
  EntityLoreContext,
  RelationshipLoreContext,
  EraNarrativeContext
} from './types/domainLore';

export type {
  StatisticsExport,
  FitnessMetrics
} from './types/statistics';

// Services
export { EnrichmentService } from './services/enrichmentService';
export { ImageGenerationService } from './services/imageGenerationService';
export { LLMClient } from './services/llmClient';
export { LoreIndex } from './services/loreIndex';
export { LoreValidator } from './services/loreValidator';
export { DistributionTracker } from './services/distributionTracker';
export { DynamicWeightCalculator } from './services/dynamicWeightCalculator';
export { FeedbackAnalyzer } from './services/feedbackAnalyzer';
// @deprecated - MetaEntityFormation replaced by SimulationSystems with clusteringUtils/entityArchival
// export { MetaEntityFormation, MetaEntityConfig } from './services/metaEntityFormation';
export { NameLogger } from './services/nameLogger';
export { PopulationTracker } from './services/populationTracker';
export { StatisticsCollector } from './services/statisticsCollector';
export { SystemSelector } from './services/systemSelector';
export { TagHealthAnalyzer } from './services/tagHealthAnalyzer';
export { TargetSelector } from './services/targetSelector';
export { TemplateGraphView } from './services/templateGraphView';
export { TemplateSelector } from './services/templateSelector';

// Framework Systems (domain-agnostic)
export { relationshipCulling } from './systems/relationshipCulling';
export { eraSpawner, EraSpawnerConfig } from './systems/eraSpawner';
export { eraTransition } from './systems/eraTransition';
export { occurrenceCreation } from './systems/occurrenceCreation';
export { universalCatalyst } from './systems/universalCatalyst';

// Utilities
export {
  generateId,
  generateName,
  setNameGenerator,
  pickRandom,
  pickMultiple,
  findEntities,
  getRelated,
  getLocation,
  getFactionMembers,
  hasRelationship,
  normalizeInitialState,
  // Relationship config utilities (domain-aware)
  isLineageRelationship,
  getExpectedDistanceRange,
  getRelationshipStrength,
  getRelationshipCategory,
  areRelationshipsCompatible
} from './utils/helpers';

export {
  selectEra,
  getTemplateWeight,
  getSystemModifier
} from './utils/eraUtils';

export {
  validateWorld,
  ValidationResult,
  ValidationReport
} from './utils/validators';

export {
  applyParameterOverrides
} from './utils/parameterOverrides';

export {
  extractParameters,
  ParameterExtractor
} from './utils/parameterExtractor';

export {
  buildEntityCluster,
  EntityClusterBuilder
} from './utils/entityClusterBuilder';

export {
  buildRelationship,
  RelationshipBuilder
} from './utils/relationshipBuilder';

export {
  calculateDistribution,
  DistributionCalculator
} from './utils/distributionCalculations';

export {
  discoverEmergentPatterns,
  EmergentDiscovery
} from './utils/emergentDiscovery';

export {
  findShortestPath,
  findAllPaths,
  getNeighbors,
  getEntityDegree,
  getConnectedComponents
} from './utils/graphQueries';

export {
  getCatalystActions,
  canActAsCatalyst,
  applyCatalystAction
} from './utils/catalystHelpers';

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

// Configuration (framework-level)
// Note: entityRegistries has been moved to domain layer (penguin-tales/lore/config/entityRegistries.ts)
// The empty export below is for backwards compatibility only
/**
 * @deprecated Import entityRegistries from your domain layer instead of the framework.
 * For penguin-tales, use: import { penguinEntityRegistries } from './lore/index.js'
 */
export { entityRegistries } from './config/entityRegistries';
export { tagRegistry } from './config/tagRegistry';
export { feedbackLoops } from './config/feedbackLoops';
