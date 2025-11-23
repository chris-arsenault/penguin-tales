/**
 * Simulation Systems Index
 *
 * All simulation systems that govern world dynamics.
 * Each system runs every tick and modifies the world state.
 */

import { SimulationSystem } from '../types/engine';

// Import all systems
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
export { relationshipCulling } from './relationshipCulling';

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
import { relationshipCulling } from './relationshipCulling';

/**
 * All simulation systems
 *
 * Order matters - systems execute in this sequence each tick.
 * Relationship dynamics run first (decay/reinforcement), then culling at end.
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
  successionVacuum,
  relationshipCulling          // Culling runs last to clean up
];
