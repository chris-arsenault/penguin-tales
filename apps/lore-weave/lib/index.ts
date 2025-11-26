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
  DomainCapabilities
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
export { MetaEntityFormation, MetaEntityConfig } from './services/metaEntityFormation';
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
  normalizeInitialState
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

// Configuration (framework-level)
export { entityRegistries } from './config/entityRegistries';
export { tagRegistry } from './config/tagRegistry';
export { feedbackLoops } from './config/feedbackLoops';
