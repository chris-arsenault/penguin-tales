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
export { ValidationOrchestrator } from './engine/validationOrchestrator';

// Core Types
export type {
  HardState,
  Relationship,
  Prominence,
  EntityKind
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
  RelationshipKindDefinition,
  RelationshipConfig,
  RelationshipLimits,
  RelationshipCategory,
  SnapshotConfig,
  EntityKindDefinition,
  EmergentDiscoveryConfig
} from './types/domainSchema';

export type {
  DistributionTargets
} from './types/distribution';

export type {
  LoreRecord
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
  DomainLoreProvider
} from './types/domainLore';

export type {
  FitnessMetrics
} from './types/statistics';

// Services
export { EnrichmentService } from './services/enrichmentService';
export { ImageGenerationService } from './services/imageGenerationService';
export { LLMClient } from './services/llmClient';
export { LoreValidator } from './services/loreValidator';
export { DistributionTracker } from './services/distributionTracker';
export { DynamicWeightCalculator } from './services/dynamicWeightCalculator';
export { FeedbackAnalyzer } from './services/feedbackAnalyzer';
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
export { eraSpawner } from './systems/eraSpawner';
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

// Emergent discovery exports
export {
  analyzeResourceDeficit,
  analyzeConflictPatterns,
  analyzeMagicPresence,
  generateResourceTheme,
  generateStrategicTheme,
  generateMysticalTheme,
  generateExplorationTheme,
  shouldDiscoverLocation,
  calculateThemeSimilarity,
  findNearbyLocations
} from './utils/emergentDiscovery';

export type {
  ResourceAnalysis,
  ConflictAnalysis,
  MagicAnalysis,
  LocationTheme
} from './utils/emergentDiscovery';

// Catalyst helpers
export {
  initializeCatalyst,
  initializeCatalystSmart
} from './utils/catalystHelpers';

// Configuration (framework-level)
export { tagRegistry } from './config/tagRegistry';
export { feedbackLoops } from './config/feedbackLoops';
