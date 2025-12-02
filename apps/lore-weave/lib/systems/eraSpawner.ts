import { SimulationSystem, SystemResult, Era, EraTransitionEffects } from '../engine/types';
import { HardState } from '../core/worldTypes';
import { generateId } from '../utils';
import {
  FRAMEWORK_ENTITY_KINDS,
  FRAMEWORK_STATUS
} from '../core/frameworkPrimitives';
import { TemplateGraphView } from '../graph/templateGraphView';
import type { EraSpawnerConfig } from '../engine/systemInterpreter';

/**
 * Era Spawner System
 *
 * Framework-level system that ensures the first era entity exists in the graph.
 *
 * NEW LAZY SPAWNING MODEL:
 * - Only the FIRST era is spawned at initialization
 * - Subsequent eras are spawned by eraTransition when conditions are met
 * - This supports divergent era paths where the next era depends on world state
 *
 * Era Lifecycle:
 * 1. First era is spawned at init with status='current'
 * 2. eraTransition handles checking exitConditions and finding/spawning next era
 * 3. Era entities are created on-demand when transitioned into
 *
 * This system only runs once to spawn the first era if it doesn't exist.
 */

/**
 * Create an era entity from config.
 * Exported so eraTransition can use it for lazy spawning.
 */
export function createEraEntity(
  configEra: Era,
  tick: number,
  status: string,
  previousEra?: HardState
): { entity: HardState; relationship?: any } {
  const eraEntity: HardState = {
    id: generateId(FRAMEWORK_ENTITY_KINDS.ERA),
    kind: FRAMEWORK_ENTITY_KINDS.ERA,
    subtype: configEra.id,
    name: configEra.name,
    description: configEra.description,
    status: status,
    prominence: 'mythic',  // Eras are always mythic (world-defining)
    culture: 'world',  // Eras are world-level entities
    tags: { temporal: true, era: true, eraId: configEra.id },
    links: [],
    createdAt: tick,
    updatedAt: tick,
    coordinates: { x: 50, y: 50, z: 50 },  // Eras are world-level, centered in their map
    temporal: status === FRAMEWORK_STATUS.CURRENT ? {
      startTick: tick,
      endTick: null
    } : undefined
  };

  return { entity: eraEntity };
}

/**
 * Apply entry effects when transitioning INTO an era.
 */
export function applyEntryEffects(
  graphView: TemplateGraphView,
  configEra: Era
): Record<string, number> {
  // Get entry effects (new model)
  const entryEffects = configEra.entryEffects;

  if (!entryEffects?.pressureChanges) {
    return {};
  }

  return entryEffects.pressureChanges;
}

/**
 * Create an Era Spawner system with the given configuration.
 */
export function createEraSpawnerSystem(config: EraSpawnerConfig): SimulationSystem {
  return {
    id: config.id || 'era_spawner',
    name: config.name || 'Era Initialization',

    apply: (graphView: TemplateGraphView, modifier: number = 1.0): SystemResult => {
      // Check if any era entities already exist
      const existingEras = graphView.findEntities({ kind: FRAMEWORK_ENTITY_KINDS.ERA });

      if (existingEras.length > 0) {
        // Eras already exist - skip
        return {
          relationshipsAdded: [],
          entitiesModified: [],
          pressureChanges: {},
          description: `${existingEras.length} era entities already exist`
        };
      }

      // Get eras from config
      const configEras = graphView.config.eras;
      if (!configEras || configEras.length === 0) {
        return {
          relationshipsAdded: [],
          entitiesModified: [],
          pressureChanges: {},
          description: 'No eras defined in config'
        };
      }

      // LAZY SPAWNING: Only create the FIRST era at init
      const firstEraConfig = configEras[0];
      const { entity: firstEra } = createEraEntity(
        firstEraConfig,
        graphView.tick,
        FRAMEWORK_STATUS.CURRENT
      );

      // Add era entity to graph
      graphView.loadEntity(firstEra);

      // Set currentEra reference
      graphView.setCurrentEra(firstEraConfig);

      // Apply entry effects for the first era
      const pressureChanges = applyEntryEffects(graphView, firstEraConfig);

      // Create history event
      graphView.addHistoryEvent({
        tick: graphView.tick,
        era: firstEraConfig.id,
        type: 'special',
        description: `${firstEraConfig.name} begins`,
        entitiesCreated: [firstEra.id],
        relationshipsCreated: [],
        entitiesModified: []
      });

      graphView.log('info', `[EraSpawner] Started first era: ${firstEraConfig.name}`);

      return {
        relationshipsAdded: [],
        entitiesModified: [],
        pressureChanges,
        description: `Started first era: ${firstEraConfig.name}`
      };
    }
  };
}

