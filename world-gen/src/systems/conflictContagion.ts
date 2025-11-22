import { SimulationSystem, SystemResult, Graph } from '../types/engine';
import { HardState, Relationship } from '../types/worldTypes';
import {
  getRelated,
  hasRelationship,
  rollProbability,
  canFormRelationship,
  recordRelationshipFormation,
  areRelationshipsCompatible
} from '../utils/helpers';

/**
 * Conflict Contagion System
 *
 * Spreads conflicts through alliance networks - allies of enemies become enemies.
 * Increases conflict pressure as wars spread.
 */
export const conflictContagion: SimulationSystem = {
  id: 'conflict_contagion',
  name: 'Conflict Spread',

  apply: (graph: Graph, modifier: number = 1.0): SystemResult => {
    // Throttle: Only run 20% of ticks to reduce conflict spam
    if (!rollProbability(0.2, modifier)) {
      return {
        relationshipsAdded: [],
        entitiesModified: [],
        pressureChanges: {},
        description: 'Conflict spread dormant'
      };
    }

    const relationships: Relationship[] = [];
    const modifications: Array<{ id: string; changes: Partial<HardState> }> = [];
    const COOLDOWN = 8;  // Same as enemy_of cooldown in relationshipFormation

    // Find existing conflicts
    const conflicts = graph.relationships.filter(r =>
      r.kind === 'enemy_of' || r.kind === 'rival_of' || r.kind === 'at_war_with'
    );

    conflicts.forEach(conflict => {
      const srcAllies = getRelated(graph, conflict.src, 'follower_of', 'dst')
        .concat(getRelated(graph, conflict.src, 'member_of', 'src'));
      const dstAllies = getRelated(graph, conflict.dst, 'follower_of', 'dst')
        .concat(getRelated(graph, conflict.dst, 'member_of', 'src'));

      // Conflicts spread to allies (15% base chance, reduced from 30%)
      srcAllies.forEach(ally => {
        // Prevent self-referential relationships
        if (ally.id === conflict.dst) return;

        if (rollProbability(0.15, modifier)) {
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

        if (rollProbability(0.15, modifier)) {
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
