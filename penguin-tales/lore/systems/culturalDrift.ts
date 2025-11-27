import { SimulationSystem, SystemResult, Graph, ComponentPurpose } from '@lore-weave/core/types/engine';
import { HardState } from '@lore-weave/core/types/worldTypes';
import {
  findEntities,
  hasRelationship,
  pickRandom,
  rollProbability,
  hasTag
} from '@lore-weave/core/utils/helpers';

/**
 * Cultural Drift System
 *
 * Models cultural evolution - connected colonies become more similar,
 * isolated colonies diverge. Creates cultural tension pressure.
 */
export const culturalDrift: SimulationSystem = {
  id: 'cultural_drift',
  name: 'Cultural Evolution',

  contract: {
    purpose: ComponentPurpose.TAG_PROPAGATION,
    enabledBy: {
      entityCounts: [
        { kind: 'location', min: 2 }
      ]
    },
    affects: {
      tags: [
        { operation: 'add', pattern: 'unified' },
        { operation: 'add', pattern: 'trading' },
        { operation: 'add', pattern: 'peaceful' },
        { operation: 'add', pattern: 'isolated' },
        { operation: 'add', pattern: 'unique' },
        { operation: 'add', pattern: 'divergent' }
      ],
      entities: [
        { kind: 'location', operation: 'modify' }
      ],
      pressures: [
        { name: 'cultural_tension', formula: 'divergentColonies.length > 1 ? 10 : 0' }
      ]
    }
  },

  metadata: {
    produces: {
      relationships: [],
      modifications: [
        { type: 'tags', frequency: 'common', comment: 'Colonies gain/lose cultural tags' },
      ],
    },
    effects: {
      graphDensity: 0.0,
      clusterFormation: 0.5,
      diversityImpact: 0.8,
      comment: 'Connected colonies converge, isolated colonies diverge',
    },
    parameters: {
      convergenceChance: {
        value: 0.3,
        min: 0.1,
        max: 0.7,
        description: 'Probability connected colonies adopt shared cultural tags',
      },
      divergenceChance: {
        value: 0.3,
        min: 0.1,
        max: 0.7,
        description: 'Probability isolated colonies develop unique tags',
      },
    },
    triggers: {
      graphConditions: ['Colony count >= 2'],
      comment: 'Requires colonies to compare cultures',
    },
  },

  apply: (graph: Graph, modifier: number = 1.0): SystemResult => {
    const params = culturalDrift.metadata?.parameters || {};
    const convergenceChance = params.convergenceChance?.value ?? 0.3;
    const divergenceChance = params.divergenceChance?.value ?? 0.3;

    const modifications: Array<{ id: string; changes: Partial<HardState> }> = [];
    const colonies = findEntities(graph, { kind: 'location', subtype: 'colony' });

    // Track cultural differences between colonies
    colonies.forEach((colony, i) => {
      colonies.slice(i + 1).forEach(otherColony => {
        // Check if colonies are connected
        const connected = hasRelationship(graph, colony.id, otherColony.id, 'adjacent_to');

        if (connected) {
          // Connected colonies influence each other (reduce drift)
          const colonyTagKeys = Object.keys(colony.tags || {});
          const otherColonyTagKeys = Object.keys(otherColony.tags || {});
          const sharedTags = colonyTagKeys.filter(t => hasTag(otherColony.tags, t));
          if (sharedTags.length < 2 && Math.random() < convergenceChance / modifier) {
            // Add a shared cultural tag
            const newTag = pickRandom(['unified', 'trading', 'peaceful']);
            if (!hasTag(colony.tags, newTag) && colonyTagKeys.length < 10) {
              const newTags = { ...colony.tags };
              newTags[newTag] = true;
              modifications.push({
                id: colony.id,
                changes: { tags: newTags }
              });
            }
          }
        } else {
          // Disconnected colonies diverge
          if (rollProbability(divergenceChance, modifier)) {
            const divergentTag = pickRandom(['isolated', 'unique', 'divergent']);
            if (!hasTag(colony.tags, divergentTag) && Object.keys(colony.tags || {}).length < 10) {
              const newTags = { ...colony.tags };
              newTags[divergentTag] = true;
              modifications.push({
                id: colony.id,
                changes: { tags: newTags }
              });
            }
          }
        }
      });
    });

    // Factions in divergent colonies may splinter
    const divergentColonies = colonies.filter(c =>
      hasTag(c.tags, 'isolated') || hasTag(c.tags, 'divergent')
    );

    const splinterPressure = divergentColonies.length > 1 ? 10 : 0;

    return {
      relationshipsAdded: [],
      entitiesModified: modifications,
      pressureChanges: { 'cultural_tension': splinterPressure * modifier },
      description: `Cultural drift affects ${modifications.length} locations`
    };
  }
};
