/**
 * Lore Weave - Procedural World History Generation Framework
 *
 * PUBLIC API - These exports form the contract between framework and domain.
 * Internal framework services and utilities are not exported.
 */
export { WorldEngine } from './engine/worldEngine';
export type { HardState, Relationship, Prominence, EntityKind } from './types/worldTypes';
export type { Graph, Era, Pressure, GrowthTemplate, SimulationSystem, EngineConfig, HistoryEvent, SystemResult, TemplateResult, ComponentPurpose, GraphModifier, MetaEntityConfig, EntityOperatorRegistry } from './types/engine';
export { ComponentPurpose as ComponentPurposeEnum } from './types/engine';
export type { DomainSchema, BaseDomainSchema, RelationshipKindDefinition, RelationshipConfig, RelationshipLimits, RelationshipCategory, SnapshotConfig, EntityKindDefinition, EmergentDiscoveryConfig, CultureDefinition, NameGenerator } from './types/domainSchema';
export type { DomainLoreProvider } from './types/domainLore';
export type { DistributionTargets } from './types/distribution';
export { TemplateGraphView } from './services/templateGraphView';
export { TargetSelector } from './services/targetSelector';
export type { SelectionBias, SelectionResult } from './services/targetSelector';
export { EnrichmentService } from './services/enrichmentService';
export { ImageGenerationService } from './services/imageGenerationService';
export { generateId, generateName, setNameGenerator, pickRandom, pickMultiple, findEntities, getRelated, getLocation, getFactionMembers, hasRelationship, normalizeInitialState, slugifyName, archiveRelationship, addRelationshipWithDistance, modifyRelationshipStrength, areRelationshipsCompatible } from './utils/helpers';
export { validateWorld } from './utils/validators';
export type { ValidationResult, ValidationReport } from './utils/validators';
export { applyParameterOverrides } from './utils/parameterOverrides';
export { extractParams } from './utils/parameterExtractor';
export { calculateSimilarity, detectClusters, filterClusterableEntities, findBestClusterMatch } from './utils/clusteringUtils';
export type { Cluster, ClusterCriterion, ClusterCriterionType, ClusterConfig } from './utils/clusteringUtils';
export { archiveEntity, archiveEntities, transferRelationships, createPartOfRelationships, getActiveRelationships, getHistoricalRelationships, isHistoricalEntity, getPartOfMembers, supersedeEntity } from './utils/entityArchival';
export type { ArchiveEntityOptions, TransferRelationshipsOptions, SupersedeEntityOptions } from './utils/entityArchival';
export { analyzeResourceDeficit, analyzeConflictPatterns, analyzeMagicPresence, generateResourceTheme, generateStrategicTheme, generateMysticalTheme, generateExplorationTheme, shouldDiscoverLocation, calculateThemeSimilarity, findNearbyLocations } from './utils/emergentDiscovery';
export type { ResourceAnalysis, ConflictAnalysis, MagicAnalysis, LocationTheme } from './utils/emergentDiscovery';
export { EntityClusterBuilder } from './utils/entityClusterBuilder';
export { buildRelationships } from './utils/relationshipBuilder';
export { relationshipCulling } from './systems/relationshipCulling';
export { eraSpawner } from './systems/eraSpawner';
export { eraTransition } from './systems/eraTransition';
export { occurrenceCreation } from './systems/occurrenceCreation';
export { universalCatalyst } from './systems/universalCatalyst';
export { FRAMEWORK_RELATIONSHIP_KINDS } from './types/frameworkPrimitives';
export type { FrameworkRelationshipKind } from './types/frameworkPrimitives';
//# sourceMappingURL=index.d.ts.map