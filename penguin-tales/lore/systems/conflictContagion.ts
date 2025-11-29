import { TemplateGraphView } from '@lore-weave/core';
import { SimulationSystem, SystemResult, ComponentPurpose } from '@lore-weave/core';
import { HardState, Relationship } from '@lore-weave/core';
import { rollProbability, extractParams } from '@lore-weave/core';

/**
 * Conflict Contagion System
 *
 * Spreads conflicts through alliance networks - allies of enemies become enemies.
 * Increases conflict pressure as wars spread.
 */
export const conflictContagion: SimulationSystem = {
  id: 'conflict_contagion',
  name: 'Conflict Spread',

  contract: {
    purpose: ComponentPurpose.RELATIONSHIP_CREATION,
    enabledBy: {
      entityCounts: [
        { kind: 'npc', min: 3 },
        { kind: 'faction', min: 2 }
      ]
    },
    affects: {
      relationships: [
        { kind: 'enemy_of', operation: 'create', count: { min: 0, max: 20 } }
      ],
      pressures: [
        { name: 'conflict', formula: 'relationships.length * 2 (up to 10)' }
      ]
    }
  },

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

  apply: (graphView: TemplateGraphView, modifier: number = 1.0): SystemResult => {
    // Extract parameters using utility (cleaner than manual extraction)
    const { throttleChance, spreadChance, cooldown: COOLDOWN } = extractParams(
      conflictContagion.metadata,
      {
        throttleChance: 0.2,
        spreadChance: 0.15,
        cooldown: 8
      }
    );

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
    const conflicts = graphView.getAllRelationships().filter(r =>
      r.kind === 'enemy_of' || r.kind === 'rival_of' || r.kind === 'at_war_with'
    );

    conflicts.forEach(conflict => {
      // Only strong allies (>= 0.5 loyalty) will join the conflict
      // Use allied_with and member_of relationships (follower_of was removed)
      const srcAllies = graphView.getRelated(conflict.src, 'allied_with', 'src', { minStrength: 0.5 })
        .concat(graphView.getRelated(conflict.src, 'member_of', 'src', { minStrength: 0.5 }));
      const dstAllies = graphView.getRelated(conflict.dst, 'allied_with', 'src', { minStrength: 0.5 })
        .concat(graphView.getRelated(conflict.dst, 'member_of', 'src', { minStrength: 0.5 }));

      // Conflicts spread to strong allies only
      srcAllies.forEach(ally => {
        // Prevent self-referential relationships
        if (ally.id === conflict.dst) return;

        if (rollProbability(spreadChance, modifier)) {
          // Check: no existing enemy_of, not on cooldown, no contradictions
          if (!graphView.hasRelationship(ally.id, conflict.dst, 'enemy_of') &&
              graphView.canFormRelationship(ally.id, 'enemy_of', COOLDOWN) &&
              graphView.areRelationshipsCompatible(ally.id, conflict.dst, 'enemy_of')) {
            relationships.push({
              kind: 'enemy_of',
              src: ally.id,
              dst: conflict.dst,
              catalyzedBy: conflict.src  // Catalyst is the conflict participant who dragged ally in
            });
            graphView.recordRelationshipFormation(ally.id, 'enemy_of');
          }
        }
      });

      dstAllies.forEach(ally => {
        // Prevent self-referential relationships
        if (ally.id === conflict.src) return;

        if (rollProbability(spreadChance, modifier)) {
          // Check: no existing enemy_of, not on cooldown, no contradictions
          if (!graphView.hasRelationship(ally.id, conflict.src, 'enemy_of') &&
              graphView.canFormRelationship(ally.id, 'enemy_of', COOLDOWN) &&
              graphView.areRelationshipsCompatible(ally.id, conflict.src, 'enemy_of')) {
            relationships.push({
              kind: 'enemy_of',
              src: ally.id,
              dst: conflict.src,
              catalyzedBy: conflict.dst  // Catalyst is the conflict participant who dragged ally in
            });
            graphView.recordRelationshipFormation(ally.id, 'enemy_of');
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
