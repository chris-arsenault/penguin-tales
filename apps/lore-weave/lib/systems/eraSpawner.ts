import { SimulationSystem, SystemResult, ComponentPurpose } from '../engine/types';
import { HardState } from '../core/worldTypes';
import { generateId } from '../utils';
import {
  FRAMEWORK_ENTITY_KINDS,
  FRAMEWORK_STATUS,
  FRAMEWORK_RELATIONSHIP_KINDS
} from '../core/frameworkPrimitives';
import { TemplateGraphView } from '../graph/templateGraphView';

/**
 * Era Spawner System
 *
 * Framework-level system that ensures era entities exist in the graph.
 * Creates era entities from the config and establishes lineage relationships.
 *
 * Era Lifecycle:
 * 1. All eras are spawned at initialization with status='future'
 * 2. First era is immediately activated to status='current'
 * 3. Eras are connected via 'supersedes' lineage with distance=(tick difference / total ticks)
 * 4. eraTransition system handles transitions from current→next based on conditions
 *
 * This system only runs once to spawn eras if they don't exist.
 */
export const eraSpawner: SimulationSystem = {
  id: 'era_spawner',
  name: 'Era Initialization',

  contract: {
    purpose: ComponentPurpose.STATE_MODIFICATION,  // Creates era entities as world setup (special case)
    affects: {
      entities: [
        {
          kind: FRAMEWORK_ENTITY_KINDS.ERA,
          operation: 'create',
          count: { min: 0, max: 10 }
        }
      ],
      relationships: [
        {
          kind: FRAMEWORK_RELATIONSHIP_KINDS.SUPERSEDES,
          operation: 'create',
          count: { min: 0, max: 10 }
        }
      ]
    }
  },

  metadata: {
    produces: {
      relationships: [
        { kind: 'supersedes', frequency: 'rare', comment: 'Lineage between consecutive eras' }
      ],
      modifications: [
        { type: 'status', frequency: 'rare', comment: 'Creates era entities with status current/future' }
      ]
    },
    effects: {
      graphDensity: 0.05,
      clusterFormation: 0.0,
      diversityImpact: 1.0,
      comment: 'One-time spawn of era entities to enable era transitions'
    },
    parameters: {
      ticksPerEra: {
        value: 30,
        min: 10,
        max: 100,
        description: 'Expected ticks per era (for lineage distance calculation)'
      },
      runOnce: {
        value: 1,
        min: 0,
        max: 1,
        description: 'Only spawn eras once (1 = true, 0 = false)'
      }
    },
    triggers: {
      graphConditions: [
        'No era entities exist in graph',
        'Graph tick > 0'
      ],
      comment: 'Runs once at start of simulation to spawn era entities'
    }
  },

  apply: (graphView: TemplateGraphView, modifier: number = 1.0): SystemResult => {
    const params = eraSpawner.metadata?.parameters || {};
    const ticksPerEra = params.ticksPerEra?.value ?? 30;

    // Check if era entities already exist
    const existingEras = graphView.findEntities({ kind: FRAMEWORK_ENTITY_KINDS.ERA });

    if (existingEras.length > 0) {
      // Eras already spawned - skip
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

    // Create era entities
    const entitiesCreated: HardState[] = [];
    const relationshipsAdded: any[] = [];
    let previousEra: HardState | null = null;

    for (let i = 0; i < configEras.length; i++) {
      const configEra = configEras[i];
      const isFirst = i === 0;

      const eraEntity: HardState = {
        id: generateId(FRAMEWORK_ENTITY_KINDS.ERA),
        kind: FRAMEWORK_ENTITY_KINDS.ERA,
        subtype: configEra.id,
        name: configEra.name,
        description: configEra.description,
        status: isFirst ? FRAMEWORK_STATUS.CURRENT : FRAMEWORK_STATUS.FUTURE,
        prominence: 'mythic',  // Eras are always mythic (world-defining)
        culture: 'world',  // Eras are world-level entities
        tags: { temporal: true, era: true, eraId: configEra.id },
        links: [],
        createdAt: graphView.tick,
        updatedAt: graphView.tick,
        coordinates: { x: 50, y: 50, z: 50 },  // Eras are world-level, centered in their map
        temporal: isFirst ? {
          startTick: graphView.tick,
          endTick: null
        } : undefined
      };

      entitiesCreated.push(eraEntity);

      // Add lineage relationship to previous era
      if (previousEra) {
        // Distance = expected tick difference normalized to [0, 1]
        // For 30 ticks per era and 500 max ticks: distance = 30/500 = 0.06
        const maxTicks = graphView.config.maxTicks || 500;
        const distance = Math.min(ticksPerEra / maxTicks, 0.5);

        relationshipsAdded.push({
          kind: FRAMEWORK_RELATIONSHIP_KINDS.SUPERSEDES,
          src: eraEntity.id,
          dst: previousEra.id,
          strength: 1.0,
          distance: distance,
          createdAt: graphView.tick
        });
      }

      previousEra = eraEntity;
    }

    // Add entities to graph using TemplateGraphView method
    entitiesCreated.forEach(entity => {
      graphView.loadEntity(entity);
    });

    // Set currentEra reference to first era
    if (entitiesCreated.length > 0) {
      graphView.setCurrentEra(configEras[0]);
    }

    // Create history event
    graphView.addHistoryEvent({
      tick: graphView.tick,
      era: configEras[0].id,
      type: 'special',
      description: `World timeline established: ${configEras.map(e => e.name).join(' → ')}`,
      entitiesCreated: entitiesCreated.map(e => e.id),
      relationshipsCreated: relationshipsAdded,
      entitiesModified: []
    });

    return {
      relationshipsAdded,
      entitiesModified: [],
      pressureChanges: {},
      description: `Spawned ${entitiesCreated.length} era entities (${configEras.map(e => e.name).join(', ')})`
    };
  }
};
