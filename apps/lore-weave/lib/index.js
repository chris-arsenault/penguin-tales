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
export { ComponentPurpose as ComponentPurposeEnum } from './types/engine';
// =============================================================================
// SERVICES - For domain templates and systems
// =============================================================================
export { TemplateGraphView } from './services/templateGraphView';
export { TargetSelector } from './services/targetSelector';
// Services for optional LLM integration (domain configures these)
export { EnrichmentService } from './services/enrichmentService';
export { ImageGenerationService } from './services/imageGenerationService';
// =============================================================================
// UTILITY FUNCTIONS - For domain templates and systems
// =============================================================================
// Core helpers
export { generateId, generateName, setNameGenerator, pickRandom, pickMultiple, findEntities, getRelated, getLocation, getFactionMembers, hasRelationship, normalizeInitialState, slugifyName, archiveRelationship, addRelationshipWithDistance, modifyRelationshipStrength, areRelationshipsCompatible } from './utils/helpers';
// Validation
export { validateWorld } from './utils/validators';
// Parameter configuration
export { applyParameterOverrides } from './utils/parameterOverrides';
export { extractParams } from './utils/parameterExtractor';
// Entity clustering (for meta-entity formation systems)
export { calculateSimilarity, detectClusters, filterClusterableEntities, findBestClusterMatch } from './utils/clusteringUtils';
// Entity archival (for entity lifecycle management)
export { archiveEntity, archiveEntities, transferRelationships, createPartOfRelationships, getActiveRelationships, getHistoricalRelationships, isHistoricalEntity, getPartOfMembers, supersedeEntity } from './utils/entityArchival';
// Emergent discovery (for location discovery templates)
export { analyzeResourceDeficit, analyzeConflictPatterns, analyzeMagicPresence, generateResourceTheme, generateStrategicTheme, generateMysticalTheme, generateExplorationTheme, shouldDiscoverLocation, calculateThemeSimilarity, findNearbyLocations } from './utils/emergentDiscovery';
// Template building utilities
export { EntityClusterBuilder } from './utils/entityClusterBuilder';
export { buildRelationships } from './utils/relationshipBuilder';
// =============================================================================
// FRAMEWORK SYSTEMS - Domain registers these with engine config
// =============================================================================
export { relationshipCulling } from './systems/relationshipCulling';
export { eraSpawner } from './systems/eraSpawner';
export { eraTransition } from './systems/eraTransition';
export { occurrenceCreation } from './systems/occurrenceCreation';
export { universalCatalyst } from './systems/universalCatalyst';
// =============================================================================
// FRAMEWORK PRIMITIVES - Minimal constants needed by domain
// =============================================================================
export { FRAMEWORK_RELATIONSHIP_KINDS } from './types/frameworkPrimitives';
//# sourceMappingURL=index.js.map