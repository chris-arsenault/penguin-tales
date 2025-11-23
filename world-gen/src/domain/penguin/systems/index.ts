/**
 * Penguin Simulation Systems
 *
 * Domain-specific systems that govern penguin world dynamics.
 * Each system runs every tick and modifies the world state.
 *
 * Note: relationshipCulling is framework-level (src/systems/relationshipCulling.ts)
 * and should be added separately in the engine configuration.
 */

import { SimulationSystem } from '../../../types/engine';

// Import all penguin-specific systems
export { relationshipFormation } from './relationshipFormation';
export { conflictContagion } from './conflictContagion';
export { resourceFlow } from './resourceFlow';
export { culturalDrift } from './culturalDrift';
export { prominenceEvolution } from './prominenceEvolution';
export { allianceFormation } from './allianceFormation';
export { legendCrystallization } from './legendCrystallization';
export { thermalCascade } from './thermalCascade';
export { beliefContagion } from './beliefContagion';
export { successionVacuum } from './successionVacuum';
export { relationshipDecay } from './relationshipDecay';
export { relationshipReinforcement } from './relationshipReinforcement';

// Import for aggregation
import { relationshipFormation } from './relationshipFormation';
import { conflictContagion } from './conflictContagion';
import { resourceFlow } from './resourceFlow';
import { culturalDrift } from './culturalDrift';
import { prominenceEvolution } from './prominenceEvolution';
import { allianceFormation } from './allianceFormation';
import { legendCrystallization } from './legendCrystallization';
import { thermalCascade } from './thermalCascade';
import { beliefContagion } from './beliefContagion';
import { successionVacuum } from './successionVacuum';
import { relationshipDecay } from './relationshipDecay';
import { relationshipReinforcement } from './relationshipReinforcement';

/**
 * All penguin-specific simulation systems
 *
 * Order matters - systems execute in this sequence each tick.
 * Relationship dynamics run first (decay/reinforcement), then formation.
 *
 * NOTE: relationshipCulling is NOT included here as it's framework-level.
 * It will be added by the engine configuration automatically.
 */
export const allSystems: SimulationSystem[] = [
  relationshipDecay,           // Run decay first
  relationshipReinforcement,   // Then reinforcement
  relationshipFormation,       // Then new relationship formation
  conflictContagion,
  resourceFlow,
  culturalDrift,
  prominenceEvolution,
  allianceFormation,
  legendCrystallization,
  thermalCascade,
  beliefContagion,
  successionVacuum
];
