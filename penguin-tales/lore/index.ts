/**
 * Penguin Domain - Complete Encapsulation
 *
 * This module exports all penguin-specific world generation components.
 * The framework (lore-weave) operates on abstract types and has no knowledge of penguins.
 */

// Domain Schema
export { penguinDomain } from './schema.js';

// Configuration (eras now managed by canonry)

// Action Domains
export {
  penguinActionDomains,
  getActionDomains,
  getActionsForDomain,
  getPressureDomainMappings
} from './config/actionDomains.js';

// Relationship categories now handled by framework's relationshipMaintenance system
// using cullable and decayRate fields on RelationshipKindDefinition

// Lore Provider moved to illuminator project

// Tag Registry
export { penguinTagRegistry } from './config/tagRegistry.js';

// Templates (declarative - loaded from JSON, now managed by canonry)
export {
  loadGrowthTemplates,
  loadDeclarativeTemplate,
  loadDeclarativeTemplates,
  templateInterpreter,
  type GrowthTemplatesFile
} from './templates/index.js';

// Templates now managed by canonry - export empty array
export const allTemplates: import('@lore-weave/core').GrowthTemplate[] = [];

// Systems
export { allSystems } from './systems/index.js';

// Entity Registries removed - lineage/saturation now handled via:
// - contract.lineage in generators (for ancestor relationships)
// - applicability rules: entity_count_max (for saturation)

// Initial State
import initialStateData from './data/initialState.json' with { type: 'json' };
export const initialState = initialStateData;
