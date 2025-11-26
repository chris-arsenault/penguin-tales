/**
 * Penguin Simulation Systems
 *
 * Domain-specific systems that govern penguin world dynamics.
 * Each system runs every tick and modifies the world state.
 *
 * Note: relationshipCulling is framework-level (src/systems/relationshipCulling.ts)
 * and should be added separately in the engine configuration.
 */

import { SimulationSystem } from '../../../apps/lore-weave/lib/types/engine';

// Import framework systems (NEW)
import { eraSpawner } from '../../../apps/lore-weave/lib/systems/eraSpawner';
import { universalCatalyst } from '../../../apps/lore-weave/lib/systems/universalCatalyst';
import { occurrenceCreation } from '../../../apps/lore-weave/lib/systems/occurrenceCreation';
import { eraTransition } from '../../../apps/lore-weave/lib/systems/eraTransition';

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
 *
 * EXECUTION ORDER:
 * 1. Era spawning (create era entities if they don't exist)
 * 2. Era transition (check if world state triggers new era)
 * 3. Agent actions (catalyst system - NPCs/factions/abilities act)
 * 4. Relationship dynamics (decay, reinforcement, formation)
 * 5. Domain systems (conflicts, resources, culture, prominence)
 * 6. Occurrence creation (wars, disasters emerge from accumulated state)
 *
 * NOTE: relationshipCulling is NOT included here as it's framework-level.
 * It will be added by the engine configuration automatically.
 */
export const allSystems: SimulationSystem[] = [
  // Phase 1: Era & Agent Actions
  eraSpawner,                  // Create era entities at initialization (runs once)
  eraTransition,               // Check for era transitions
  universalCatalyst,           // Agents take actions (seize control, declare war, etc.)

  // Phase 2: Relationship Dynamics
  relationshipDecay,           // Decay weak relationships
  relationshipReinforcement,   // Reinforce strong relationships
  // relationshipFormation,    // REMOVED: Created social drama (follower_of, lover_of) that we eliminated

  // Phase 3: Domain Dynamics
  conflictContagion,           // Conflicts spread through networks
  resourceFlow,                // Resources move through world
  culturalDrift,               // Cultural evolution
  prominenceEvolution,         // Fame and obscurity
  allianceFormation,           // Diplomatic alliances
  legendCrystallization,       // Heroes become legends
  thermalCascade,              // Environmental effects
  beliefContagion,             // Ideologies spread
  successionVacuum,            // Leadership transitions

  // Phase 4: Occurrence Creation
  occurrenceCreation           // Create war/disaster occurrences based on accumulated state
];
