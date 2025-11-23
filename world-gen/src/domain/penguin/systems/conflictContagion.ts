import { SimulationSystem, SystemResult, Graph } from '../../../types/engine';
import { HardState, Relationship } from '../../../types/worldTypes';
import {
  getRelated,
  hasRelationship,
  rollProbability,
  canFormRelationship,
  recordRelationshipFormation,
  areRelationshipsCompatible
} from '../../../utils/helpers';

/**
 * Conflict Contagion System
 *
 * Spreads conflicts through alliance networks - allies of enemies become enemies.
 * Increases conflict pressure as wars spread.
 */
export const conflictContagion: SimulationSystem = {
  id: 'conflict_contagion',
  name: 'Conflict Spread',

  metadata: {
    produces: {
      relationships: [
        { kind: 'enemy_of', category: 'social', frequency: 'uncommon', comment: 'Conflicts spread to allies' },
      ],
      modifications: [],
    },
    effects: {
      graphDensity: 0.5,
      clusterFormation: 0.4,
      diversityImpact: 0.6,
      comment: 'Spreads conflicts through alliance networks',
    },
    parameters: {
      throttleChance: {
        value: 0.2,
        min: 0.05,
        max: 0.5,
        description: 'Probability system runs each tick (prevents conflict spam)',
      },
      spreadChance: {
        value: 0.15,
        min: 0.05,
        max: 0.5,
        description: 'Probability conflict spreads to an ally',
      },
      cooldown: {
        value: 8,
        min: 3,
        max: 20,
        description: 'Ticks before same NPC can form another enemy relationship',
      },
    },
    triggers: {
      graphConditions: ['Existing conflicts', 'Allied NPCs/factions'],
      comment: 'Requires enemy_of/rival_of/at_war_with relationships',
    },
  },

  apply: (graph: Graph, modifier: number = 1.0): SystemResult => {
    const params = conflictContagion.metadata?.parameters || {};
    const throttleChance = params.throttleChance?.value ?? 0.2;
    const spreadChance = params.spreadChance?.value ?? 0.15;
    const COOLDOWN = params.cooldown?.value ?? 8;

    // Throttle: Only run throttleChance% of ticks to reduce conflict spam
    if (!rollProbability(throttleChance, modifier)) {
      return {
        relationshipsAdded: [],
        entitiesModified: [],
        pressureChanges: {},
        description: 'Conflict spread dormant'
      };
    }

    const relationships: Relationship[] = [];
    const modifications: Array<{ id: string; changes: Partial<HardState> }> = [];

    // Find existing conflicts
    const conflicts = graph.relationships.filter(r =>
      r.kind === 'enemy_of' || r.kind === 'rival_of' || r.kind === 'at_war_with'
    );

    conflicts.forEach(conflict => {
      // Only strong allies (>= 0.5 loyalty) will join the conflict
      const srcAllies = getRelated(graph, conflict.src, 'follower_of', 'dst', { minStrength: 0.5 })
        .concat(getRelated(graph, conflict.src, 'member_of', 'src', { minStrength: 0.5 }));
      const dstAllies = getRelated(graph, conflict.dst, 'follower_of', 'dst', { minStrength: 0.5 })
        .concat(getRelated(graph, conflict.dst, 'member_of', 'src', { minStrength: 0.5 }));

      // Conflicts spread to strong allies only
      srcAllies.forEach(ally => {
        // Prevent self-referential relationships
        if (ally.id === conflict.dst) return;

        if (rollProbability(spreadChance, modifier)) {
          // Check: no existing enemy_of, not on cooldown, no contradictions
          if (!hasRelationship(graph, ally.id, conflict.dst, 'enemy_of') &&
              canFormRelationship(graph, ally.id, 'enemy_of', COOLDOWN) &&
              areRelationshipsCompatible(graph, ally.id, conflict.dst, 'enemy_of')) {
            relationships.push({
              kind: 'enemy_of',
              src: ally.id,
              dst: conflict.dst
            });
            recordRelationshipFormation(graph, ally.id, 'enemy_of');
          }
        }
      });

      dstAllies.forEach(ally => {
        // Prevent self-referential relationships
        if (ally.id === conflict.src) return;

        if (rollProbability(spreadChance, modifier)) {
          // Check: no existing enemy_of, not on cooldown, no contradictions
          if (!hasRelationship(graph, ally.id, conflict.src, 'enemy_of') &&
              canFormRelationship(graph, ally.id, 'enemy_of', COOLDOWN) &&
              areRelationshipsCompatible(graph, ally.id, conflict.src, 'enemy_of')) {
            relationships.push({
              kind: 'enemy_of',
              src: ally.id,
              dst: conflict.src
            });
            recordRelationshipFormation(graph, ally.id, 'enemy_of');
          }
        }
      });
    });

    const pressureChange = relationships.length > 5 ? 10 : relationships.length * 2;

    return {
      relationshipsAdded: relationships,
      entitiesModified: modifications,
      pressureChanges: { 'conflict': pressureChange },
      description: `Conflicts spread through alliances (${relationships.length} new enemies)`
    };
  }
};
