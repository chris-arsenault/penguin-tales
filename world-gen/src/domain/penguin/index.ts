/**
 * Penguin Domain - Complete Encapsulation
 *
 * This module exports all penguin-specific world generation components.
 * The framework (src/engine, src/systems/relationshipCulling, src/services)
 * operates on abstract types and has no knowledge of penguins.
 */

// Domain Schema
export { penguinDomain } from './schema';

// Configuration
export { penguinEras } from './config/eras';
export { pressures } from './config/pressures';

// Templates
export { allTemplates } from './templates';

// Systems
export { allSystems } from './systems';

// Initial State
import initialStateData from './data/initialState.json';
export const initialState = initialStateData;
