import { ComponentPurpose } from '../types/engine';
import { generateId } from '../utils/helpers';
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
export const eraSpawner = {
    id: 'era_spawner',
    name: 'Era Initialization',
    contract: {
        purpose: ComponentPurpose.STATE_MODIFICATION, // Creates era entities as world setup (special case)
        affects: {
            entities: [
                {
                    kind: 'era',
                    operation: 'create',
                    count: { min: 0, max: 10 }
                }
            ],
            relationships: [
                {
                    kind: 'supersedes',
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
    apply: (graph, modifier = 1.0) => {
        const params = eraSpawner.metadata?.parameters || {};
        const ticksPerEra = params.ticksPerEra?.value ?? 30;
        // Check if era entities already exist
        const existingEras = Array.from(graph.entities.values()).filter(e => e.kind === 'era');
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
        const configEras = graph.config.eras;
        if (!configEras || configEras.length === 0) {
            return {
                relationshipsAdded: [],
                entitiesModified: [],
                pressureChanges: {},
                description: 'No eras defined in config'
            };
        }
        // Create era entities
        const entitiesCreated = [];
        const relationshipsAdded = [];
        let previousEra = null;
        for (let i = 0; i < configEras.length; i++) {
            const configEra = configEras[i];
            const isFirst = i === 0;
            const eraEntity = {
                id: generateId('era'),
                kind: 'era',
                subtype: configEra.id,
                name: configEra.name,
                description: configEra.description,
                status: isFirst ? 'current' : 'future',
                prominence: 'mythic', // Eras are always mythic (world-defining)
                culture: 'world', // Eras are world-level entities
                tags: ['temporal', 'era', configEra.id],
                links: [],
                createdAt: graph.tick,
                updatedAt: graph.tick,
                temporal: isFirst ? {
                    startTick: graph.tick,
                    endTick: null
                } : undefined
            };
            entitiesCreated.push(eraEntity);
            // Add lineage relationship to previous era
            if (previousEra) {
                // Distance = expected tick difference normalized to [0, 1]
                // For 30 ticks per era and 500 max ticks: distance = 30/500 = 0.06
                const maxTicks = graph.config.maxTicks || 500;
                const distance = Math.min(ticksPerEra / maxTicks, 0.5);
                relationshipsAdded.push({
                    kind: 'supersedes',
                    src: eraEntity.id,
                    dst: previousEra.id,
                    strength: 1.0,
                    distance: distance,
                    createdAt: graph.tick
                });
            }
            previousEra = eraEntity;
        }
        // Add entities to graph
        entitiesCreated.forEach(entity => {
            graph.entities.set(entity.id, entity);
        });
        // Set currentEra reference to first era
        if (entitiesCreated.length > 0) {
            graph.currentEra = configEras[0];
        }
        // Create history event
        graph.history.push({
            tick: graph.tick,
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
//# sourceMappingURL=eraSpawner.js.map