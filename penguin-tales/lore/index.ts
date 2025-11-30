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

// Relationship Categories
export {
  relationshipCategories,
  getCategoryForRelationship,
  getImmutableRelationshipKinds,
  getProtectedRelationshipKinds,
  getRelationshipKindsByCategory,
  getAllCategories
} from './config/relationshipCategories.js';

// Lore Provider
export { penguinLoreProvider } from './config/loreProvider.js';

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

// Entity Registries (domain-specific entity operator configs)
export { penguinEntityRegistries } from './config/entityRegistries.js';

// Initial State
import initialStateData from './data/initialState.json' with { type: 'json' };
export const initialState = initialStateData;
