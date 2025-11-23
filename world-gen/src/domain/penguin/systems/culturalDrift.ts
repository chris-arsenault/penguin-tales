import { SimulationSystem, SystemResult, Graph } from '../../../types/engine';
import { HardState } from '../../../types/worldTypes';
import {
  findEntities,
  hasRelationship,
  pickRandom,
  rollProbability
} from '../../../utils/helpers';

/**
 * Cultural Drift System
 *
 * Models cultural evolution - connected colonies become more similar,
 * isolated colonies diverge. Creates cultural tension pressure.
 */
export const culturalDrift: SimulationSystem = {
  id: 'cultural_drift',
  name: 'Cultural Evolution',

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
          const sharedTags = colony.tags.filter(t => otherColony.tags.includes(t));
          if (sharedTags.length < 2 && Math.random() < convergenceChance / modifier) {
            // Add a shared cultural tag
            const newTag = pickRandom(['unified', 'trading', 'peaceful']);
            if (!colony.tags.includes(newTag) && colony.tags.length < 10) {
              modifications.push({
                id: colony.id,
                changes: { tags: [...colony.tags, newTag] }
              });
            }
          }
        } else {
          // Disconnected colonies diverge
          if (rollProbability(divergenceChance, modifier)) {
            const divergentTag = pickRandom(['isolated', 'unique', 'divergent']);
            if (!colony.tags.includes(divergentTag) && colony.tags.length < 10) {
              modifications.push({
                id: colony.id,
                changes: { tags: [...colony.tags, divergentTag] }
              });
            }
          }
        }
      });
    });

    // Factions in divergent colonies may splinter
    const divergentColonies = colonies.filter(c =>
      c.tags.includes('isolated') || c.tags.includes('divergent')
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
