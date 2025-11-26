import { SimulationSystem, SystemResult, Graph } from '../../../apps/lore-weave/lib/types/engine';
import { Relationship } from '../../../apps/lore-weave/lib/types/worldTypes';
import {
  findEntities,
  getRelated,
  getLocation,
  hasRelationship,
  rollProbability,
  canFormRelationship,
  recordRelationshipFormation,
  areRelationshipsCompatible,
  getConnectionWeight,
  getFactionRelationship
} from '../../../apps/lore-weave/lib/utils/helpers';

/**
 * Relationship Formation System
 *
 * Forms social connections between NPCs based on proximity and shared attributes.
 * Handles friendships, rivalries, conflicts, and romance with proper cooldown tracking.
 */
export const relationshipFormation: SimulationSystem = {
  id: 'relationship_formation',
  name: 'Social Dynamics',

  metadata: {
    produces: {
      relationships: [
        { kind: 'follower_of', category: 'social', frequency: 'common', comment: 'Friendships within factions' },
        { kind: 'rival_of', category: 'social', frequency: 'uncommon', comment: 'Rivalries within factions' },
        { kind: 'enemy_of', category: 'political', frequency: 'uncommon', comment: 'Conflicts between factions' },
        { kind: 'lover_of', category: 'social', frequency: 'rare', comment: 'Romance between NPCs' },
      ],
      modifications: [],
    },
    effects: {
      graphDensity: 0.7,
      clusterFormation: 0.5,
      diversityImpact: 0.6,
      comment: 'Creates social bonds within location/faction clusters with varied relationship types',
    },
    parameters: {
      throttleChance: {
        value: 0.3,
        min: 0.1,
        max: 1.0,
        description: 'Probability system runs each tick (prevents relationship spam)',
      },
      friendshipBaseChance: {
        value: 0.2,
        min: 0.05,
        max: 0.5,
        description: 'Base probability of friendship formation between co-located NPCs',
      },
      friendshipRivalRatio: {
        value: 0.75,
        min: 0.5,
        max: 0.95,
        description: 'Ratio of friendships vs rivalries (0.75 = 75% friends, 25% rivals)',
      },
      conflictBaseChance: {
        value: 0.2,
        min: 0.05,
        max: 0.5,
        description: 'Base probability of conflict between NPCs from different factions',
      },
      romanceBaseChance: {
        value: 0.05,
        min: 0.01,
        max: 0.2,
        description: 'Base probability of romance formation',
      },
      sameFactionFriendshipMultiplier: {
        value: 2.0,
        min: 1.0,
        max: 5.0,
        description: 'Friendship boost for same-faction members',
      },
      alliedFactionFriendshipMultiplier: {
        value: 1.2,
        min: 1.0,
        max: 3.0,
        description: 'Friendship boost for allied-faction members',
      },
      enemyFactionConflictMultiplier: {
        value: 3.0,
        min: 1.0,
        max: 10.0,
        description: 'Conflict boost when factions are at war',
      },
      neutralConflictMultiplier: {
        value: 0.3,
        min: 0.0,
        max: 1.0,
        description: 'Conflict probability for neutral faction pairs',
      },
      sameFactionRomanceMultiplier: {
        value: 3.0,
        min: 1.0,
        max: 10.0,
        description: 'Romance boost for same-faction members',
      },
      alliedFactionRomanceMultiplier: {
        value: 1.5,
        min: 1.0,
        max: 5.0,
        description: 'Romance boost for allied-faction members',
      },
      neutralRomanceMultiplier: {
        value: 0.7,
        min: 0.1,
        max: 2.0,
        description: 'Romance multiplier for neutral faction pairs',
      },
      starCrossedLoversMultiplier: {
        value: 0.05,
        min: 0.0,
        max: 0.5,
        description: 'Romance probability for enemy faction pairs (star-crossed lovers)',
      },
      cooldownFollower: {
        value: 5,
        min: 1,
        max: 20,
        description: 'Ticks before same NPC can form another friendship',
      },
      cooldownRival: {
        value: 5,
        min: 1,
        max: 20,
        description: 'Ticks before same NPC can form another rivalry',
      },
      cooldownEnemy: {
        value: 8,
        min: 1,
        max: 30,
        description: 'Ticks before same NPC can form another enemy relationship',
      },
      cooldownLover: {
        value: 15,
        min: 5,
        max: 50,
        description: 'Ticks before same NPC can form another romance (should be rare)',
      },
    },
    triggers: {
      graphConditions: ['Same location', 'Faction membership'],
      comment: 'Requires NPCs in same location; faction relationships influence formation',
    },
  },

  apply: (graph: Graph, modifier: number = 1.0): SystemResult => {
    // Throttle: Only run 30% of ticks to reduce relationship spam
    const params = relationshipFormation.metadata?.parameters || {};
    const throttleChance = params.throttleChance?.value ?? 0.3;

    if (!rollProbability(throttleChance, modifier)) {
      return {
        relationshipsAdded: [],
        entitiesModified: [],
        pressureChanges: {},
        description: 'Social dynamics dormant'
      };
    }

    const npcs = findEntities(graph, { kind: 'npc', status: 'alive' });
    const relationships: Relationship[] = [];
    const modifications: Array<{ id: string; changes: Partial<any> }> = [];

    // Extract parameters from metadata
    const friendshipBaseChance = params.friendshipBaseChance?.value ?? 0.2;
    const friendshipRivalRatio = params.friendshipRivalRatio?.value ?? 0.75;
    const conflictBaseChance = params.conflictBaseChance?.value ?? 0.2;
    const romanceBaseChance = params.romanceBaseChance?.value ?? 0.05;

    const sameFactionFriendshipMult = params.sameFactionFriendshipMultiplier?.value ?? 2.0;
    const alliedFactionFriendshipMult = params.alliedFactionFriendshipMultiplier?.value ?? 1.2;
    const enemyFactionConflictMult = params.enemyFactionConflictMultiplier?.value ?? 3.0;
    const neutralConflictMult = params.neutralConflictMultiplier?.value ?? 0.3;
    const sameFactionRomanceMult = params.sameFactionRomanceMultiplier?.value ?? 3.0;
    const alliedFactionRomanceMult = params.alliedFactionRomanceMultiplier?.value ?? 1.5;
    const neutralRomanceMult = params.neutralRomanceMultiplier?.value ?? 0.7;
    const starCrossedLoversMult = params.starCrossedLoversMultiplier?.value ?? 0.05;

    // Cooldown periods (in ticks) for different relationship types
    const COOLDOWNS = {
      follower_of: params.cooldownFollower?.value ?? 5,
      rival_of: params.cooldownRival?.value ?? 5,
      enemy_of: params.cooldownEnemy?.value ?? 8,
      lover_of: params.cooldownLover?.value ?? 15
    };

    // Form relationships based on proximity and shared attributes
    // Process each pair only once using ID comparison to avoid double-counting
    npcs.forEach((npc, i) => {
      const location = getLocation(graph, npc.id);
      if (!location) return;

      // Connection-aware weighting to balance network density
      const npcWeight = getConnectionWeight(npc);

      // Only process NPCs that come after this one to avoid double processing
      npcs.slice(i + 1).forEach(neighbor => {
        // Verify same location
        if (getLocation(graph, neighbor.id)?.id !== location.id) return;

        // Connection-aware weighting for neighbor
        const neighborWeight = getConnectionWeight(neighbor);
        const balancingFactor = (npcWeight + neighborWeight) / 2;

        // Get faction memberships
        const npcFactions = getRelated(graph, npc.id, 'member_of', 'src');
        const neighborFactions = getRelated(graph, neighbor.id, 'member_of', 'src');

        const sharedFaction = npcFactions.some(f =>
          neighborFactions.some(nf => nf.id === f.id)
        );

        const factionRel = getFactionRelationship(npcFactions, neighborFactions, graph);

        // === FRIENDSHIP / RIVALRY ===
        // Same faction or allied factions can form friendships/rivalries
        if (sharedFaction || factionRel === 'allied') {
          const friendshipMultiplier = sharedFaction ? sameFactionFriendshipMult : alliedFactionFriendshipMult;
          const friendshipChance = Math.min(0.95, friendshipBaseChance * friendshipMultiplier * balancingFactor);

          if (rollProbability(friendshipChance, modifier)) {
            // Use friendshipRivalRatio parameter
            const relType = Math.random() > friendshipRivalRatio ? 'rival_of' : 'follower_of';

            // Check: no existing relationship, not on cooldown, no contradictions
            if (!hasRelationship(graph, npc.id, neighbor.id, relType) &&
                canFormRelationship(graph, npc.id, relType, COOLDOWNS[relType]) &&
                areRelationshipsCompatible(graph, npc.id, neighbor.id, relType)) {
              relationships.push({
                kind: relType,
                src: npc.id,
                dst: neighbor.id
              });
              recordRelationshipFormation(graph, npc.id, relType);
            }
          }
        }

        // === ENEMY FORMATION ===
        // Different factions → potential conflict (much higher if at war)
        if (!sharedFaction && npcFactions.length > 0 && neighborFactions.length > 0) {
          let conflictMultiplier = 1.0;
          if (factionRel === 'enemy') conflictMultiplier = enemyFactionConflictMult;
          else if (factionRel === 'allied') conflictMultiplier = 0.0; // Allied = no conflicts
          else conflictMultiplier = neutralConflictMult;

          const conflictChance = Math.min(0.95, conflictBaseChance * conflictMultiplier * balancingFactor);

          if (rollProbability(conflictChance, modifier)) {
            // Check: no existing enemy_of, not on cooldown, no contradictions
            if (!hasRelationship(graph, npc.id, neighbor.id, 'enemy_of') &&
                canFormRelationship(graph, npc.id, 'enemy_of', COOLDOWNS.enemy_of) &&
                areRelationshipsCompatible(graph, npc.id, neighbor.id, 'enemy_of')) {
              relationships.push({
                kind: 'enemy_of',
                src: npc.id,
                dst: neighbor.id
              });
              recordRelationshipFormation(graph, npc.id, 'enemy_of');
            }
          }
        }

        // === ROMANCE ===
        // Romance with strong geographical/factional bias
        let romanceMultiplier = 1.0;
        if (sharedFaction) romanceMultiplier = sameFactionRomanceMult;
        else if (factionRel === 'allied') romanceMultiplier = alliedFactionRomanceMult;
        else if (factionRel === 'neutral') romanceMultiplier = neutralRomanceMult;
        else if (factionRel === 'enemy') romanceMultiplier = starCrossedLoversMult;  // Star-crossed lovers!

        const romanceChance = Math.min(0.95, romanceBaseChance * romanceMultiplier * balancingFactor);

        if (rollProbability(romanceChance, modifier)) {
          // Check: no existing lover_of, not on cooldown, no contradictions
          if (!hasRelationship(graph, npc.id, neighbor.id, 'lover_of') &&
              canFormRelationship(graph, npc.id, 'lover_of', COOLDOWNS.lover_of) &&
              areRelationshipsCompatible(graph, npc.id, neighbor.id, 'lover_of')) {
            relationships.push({
              kind: 'lover_of',
              src: npc.id,
              dst: neighbor.id
            });
            recordRelationshipFormation(graph, npc.id, 'lover_of');
          }
        }
      });
    });

    return {
      relationshipsAdded: relationships,
      entitiesModified: modifications,
      pressureChanges: {},
      description: `Social bonds form and rivalries emerge (${relationships.length} new relationships)`
    };
  }
};
