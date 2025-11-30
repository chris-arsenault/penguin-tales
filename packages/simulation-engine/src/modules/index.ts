/**
 * Simulation Modules
 *
 * Reusable parameterized code blocks for dynamic simulation behavior.
 * These modules are extracted from the lore-weave framework patterns
 * and provide intelligent, context-aware functionality.
 */

// Scoring modules
export { hubPenalty } from './hubPenalty.js';
export { cultureAffinity } from './cultureAffinity.js';
export { proximityDecay } from './proximityDecay.js';
export { tagFilter } from './tagFilter.js';
export { factionModifier } from './factionModifier.js';
export { statusGate } from './statusGate.js';

// Pressure modules
export { populationRatioPressure } from './populationRatioPressure.js';
export { ratioEquilibriumPressure } from './ratioEquilibriumPressure.js';

// Dynamics modules
export { relationshipDecay } from './relationshipDecay.js';
export { contagionSpread } from './contagionSpread.js';
export { prominenceEvolution } from './prominenceEvolution.js';
export { checkCooldown, applyCooldown, cleanupExpiredCooldowns } from './cooldownTracking.js';

// Module registry
export { moduleRegistry, type ModuleExecutor, type ModuleContext } from './registry.js';
