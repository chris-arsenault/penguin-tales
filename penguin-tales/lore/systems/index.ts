/**
 * Penguin Simulation Systems
 *
 * Domain-specific systems that govern penguin world dynamics.
 * Each system runs every tick and modifies the world state.
 *
 * NOTE: Many systems have been migrated to declarative configs in the Canonry default project:
 * - conflictContagion → conflict_contagion (graphContagion)
 * - allianceFormation → alliance_formation (connectionEvolution)
 * - prominenceEvolution → prominence_evolution (connectionEvolution)
 * - warBrewingDetector → war_brewing_detector (thresholdTrigger)
 * - powerVacuumDetector → power_vacuum_detector (thresholdTrigger)
 * - legendRipeDetector → legend_ripe_detector (thresholdTrigger)
 * - occurrenceCreation → war_outbreak generator (thresholdTrigger)
 * - successionVacuum → succession_crisis generator (thresholdTrigger)
 * - legendCrystallization → legend_crystallization generator (thresholdTrigger)
 */

import { SimulationSystem } from '@lore-weave/core';

// Import framework systems
import { eraSpawner } from '@lore-weave/core';
import { universalCatalyst } from '@lore-weave/core';
import { eraTransition } from '@lore-weave/core';

// Import all penguin-specific systems (remaining after migration)
export { resourceFlow } from './resourceFlow';
export { culturalDrift } from './culturalDrift';
export { thermalCascade } from './thermalCascade';
export { beliefContagion } from './beliefContagion';

// Meta-entity formation systems (run at epoch end)
export { magicSchoolFormation } from './magicSchoolFormation';
export { legalCodeFormation } from './legalCodeFormation';
export { combatTechniqueFormation } from './combatTechniqueFormation';

// Import for aggregation
import { resourceFlow } from './resourceFlow';
import { culturalDrift } from './culturalDrift';
import { thermalCascade } from './thermalCascade';
import { beliefContagion } from './beliefContagion';
import { magicSchoolFormation } from './magicSchoolFormation';
import { legalCodeFormation } from './legalCodeFormation';
import { combatTechniqueFormation } from './combatTechniqueFormation';

/**
 * All penguin-specific simulation systems
 *
 * Order matters - systems execute in this sequence each tick.
 *
 * EXECUTION ORDER:
 * 1. Era spawning (create era entities if they don't exist)
 * 2. Era transition (check if world state triggers new era)
 * 3. Agent actions (catalyst system - NPCs/factions/abilities act)
 * 4. Domain systems (resources, culture, environment)
 *
 * NOTE: Many systems have been migrated to declarative configs loaded from the project.
 * The systems below are either framework systems or domain systems not yet migrated.
 */
export const allSystems: SimulationSystem[] = [
  // Phase 1: Era & Agent Actions
  eraSpawner,                  // Create era entities at initialization (runs once)
  eraTransition,               // Check for era transitions
  universalCatalyst,           // Agents take actions (seize control, declare war, etc.)

  // Phase 2: Domain Dynamics (remaining after migration)
  resourceFlow,                // Resources move through world
  culturalDrift,               // Cultural evolution
  thermalCascade,              // Environmental effects
  beliefContagion,             // Ideologies spread

  // Phase 3: Meta-Entity Formation (epoch end only)
  magicSchoolFormation,        // Cluster abilities into schools
  legalCodeFormation,          // Cluster rules into legal codes
  combatTechniqueFormation     // Cluster combat abilities into fighting styles
];
