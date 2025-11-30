/**
 * Penguin Domain - Complete Encapsulation
 *
 * This module exports all penguin-specific world generation components.
 * The framework (lore-weave) operates on abstract types and has no knowledge of penguins.
 */

// Domain Schema
export { penguinDomain } from './schema.js';

// Configuration
export { penguinEras } from './config/eras.js';
export { pressures } from './config/pressures.js';

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

// Templates (declarative - loaded from JSON)
export {
  loadGrowthTemplates,
  loadDeclarativeTemplate,
  loadDeclarativeTemplates,
  templateInterpreter,
  type GrowthTemplatesFile
} from './templates/index.js';

import growthTemplatesData from './data/growthTemplates.json' with { type: 'json' };
import { loadGrowthTemplates } from './templates/index.js';
export const allTemplates = loadGrowthTemplates(growthTemplatesData as unknown as import('./templates/index.js').GrowthTemplatesFile);

// Systems
export { allSystems } from './systems/index.js';

// Entity Registries (domain-specific entity operator configs)
export { penguinEntityRegistries } from './config/entityRegistries.js';

// Initial State
import initialStateData from './data/initialState.json' with { type: 'json' };
export const initialState = initialStateData;
