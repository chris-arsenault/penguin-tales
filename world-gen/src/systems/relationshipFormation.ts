import { SimulationSystem, SystemResult, Graph } from '../types/engine';
import { Relationship } from '../types/worldTypes';
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
} from '../utils/helpers';

/**
 * Relationship Formation System
 *
 * Forms social connections between NPCs based on proximity and shared attributes.
 * Handles friendships, rivalries, conflicts, and romance with proper cooldown tracking.
 */
export const relationshipFormation: SimulationSystem = {
  id: 'relationship_formation',
  name: 'Social Dynamics',

  apply: (graph: Graph, modifier: number = 1.0): SystemResult => {
    // Throttle: Only run 30% of ticks to reduce relationship spam
    if (!rollProbability(0.3, modifier)) {
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

    // Cooldown periods (in ticks) for different relationship types
    const COOLDOWNS = {
      follower_of: 5,
      rival_of: 5,
      enemy_of: 8,
      lover_of: 15  // Romance should be rarer
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
          const friendshipMultiplier = sharedFaction ? 2.0 : 1.2;  // Same faction stronger
          const friendshipChance = Math.min(0.95, 0.2 * friendshipMultiplier * balancingFactor);

          if (rollProbability(friendshipChance, modifier)) {
            // 75% friendship, 25% rivalry within same faction
            const relType = Math.random() > 0.75 ? 'rival_of' : 'follower_of';

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
          if (factionRel === 'enemy') conflictMultiplier = 3.0;       // Factions at war
          else if (factionRel === 'allied') conflictMultiplier = 0.0; // Allied = no conflicts
          else conflictMultiplier = 0.3;                              // Neutral = rare conflicts

          const conflictChance = Math.min(0.95, 0.2 * conflictMultiplier * balancingFactor);

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
        if (sharedFaction) romanceMultiplier = 3.0;                    // Same faction: much more likely
        else if (factionRel === 'allied') romanceMultiplier = 1.5;     // Allied factions: slightly more
        else if (factionRel === 'neutral') romanceMultiplier = 0.7;    // Neutral: slightly less
        else if (factionRel === 'enemy') romanceMultiplier = 0.05;     // Enemy: star-crossed lovers (rare!)

        const romanceChance = Math.min(0.95, 0.05 * romanceMultiplier * balancingFactor);

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
