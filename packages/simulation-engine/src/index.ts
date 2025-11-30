/**
 * @canonry/simulation-engine
 *
 * Browser-based simulation engine for world generation.
 * Executes simulation rules to populate and evolve world graphs.
 */

// Types
export type {
  RuntimeEntity,
  RuntimeRelationship,
  RuntimeOccurrence,
  SimulationState,
  ExecutionContext,
  RuleExecutionResult,
  TickResult,
  EraResult,
  SimulationResult,
  EngineConfig,
} from './types.js';

// Engine
export { runSimulation, runTick, transitionEra } from './engine.js';

// Conditions
export {
  queryEntities,
  evaluateCondition,
  evaluateConditions,
  seededRandom,
  randomInt,
  randomPick,
  randomPickN,
} from './conditions.js';

// Entities
export {
  resolveCount,
  resolveEntityRef,
  createEntities,
  commitEntities,
} from './entities.js';

// Selection
export { executeSelection, executeSelections } from './selection.js';

// Relationships
export {
  createRelationships,
  createAllRelationships,
  commitRelationships,
  archiveRelationship,
  deleteRelationship,
  createOccurrence,
  commitOccurrence,
} from './relationships.js';

// Modules - Reusable parameterized code blocks
export {
  // Scoring modules
  hubPenalty,
  cultureAffinity,
  proximityDecay,
  tagFilter,
  factionModifier,
  statusGate,
  // Pressure modules
  populationRatioPressure,
  ratioEquilibriumPressure,
  // Dynamics modules
  relationshipDecay,
  contagionSpread,
  prominenceEvolution,
  checkCooldown,
  applyCooldown,
  cleanupExpiredCooldowns,
  // Registry
  moduleRegistry,
  type ModuleExecutor,
  type ModuleContext,
} from './modules/index.js';
