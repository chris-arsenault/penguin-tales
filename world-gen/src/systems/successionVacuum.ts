import { SimulationSystem, SystemResult, Graph } from '../types/engine';
import { HardState, Relationship } from '../types/worldTypes';
import {
  findEntities,
  getRelated,
  rollProbability,
  canFormRelationship,
  recordRelationshipFormation,
  areRelationshipsCompatible,
  pickRandom,
  pickMultiple,
  getFactionMembers
} from '../utils/helpers';

/**
 * Succession Vacuum System
 *
 * Detects leaderless factions/colonies and triggers succession crises.
 * When leaders die without clear successors, multiple claimants emerge,
 * creating rivalries and potentially splitting factions.
 *
 * This is a DETERMINISTIC CASCADE system, not an emergent one.
 * Triggers immediately on leader death detection.
 *
 * Cascade effects:
 * - 2-3 NPCs become claimants (gain rival_of relationships)
 * - Faction status may change to 'waning'
 * - Rules may be repealed
 * - Faction may split (triggers existing factionSplinter template via recommendation)
 * - Stability pressure drops dramatically
 *
 * SYSTEM_IMPLEMENTATION_GUIDE compliance:
 * - Throttled (20% of ticks) despite being event-driven
 * - Uses cooldown checks for rival_of, enemy_of relationships
 * - Uses contradiction checks before creating relationships
 * - Records all relationship formations
 * - Caps probabilities at 0.95 for event triggers
 */

export const successionVacuum: SimulationSystem = {
  id: 'succession_vacuum',
  name: 'Leadership Crisis',

  metadata: {
    produces: {
      relationships: [
        { kind: 'rival_of', category: 'social', frequency: 'uncommon', comment: 'Claimants rival each other' },
        { kind: 'enemy_of', category: 'social', frequency: 'rare', comment: 'Supporter groups may escalate to conflict' },
      ],
      modifications: [
        { type: 'status', frequency: 'uncommon', comment: 'Factions become waning, rules repealed' },
      ],
    },
    effects: {
      graphDensity: 0.3,
      clusterFormation: -0.2,
      diversityImpact: 0.6,
      comment: 'Leadership vacuums create succession crises with multiple claimants',
    },
    parameters: {
      throttleChance: {
        value: 0.2,
        min: 0.05,
        max: 0.5,
        description: 'Probability system runs each tick (event-driven, no need to check constantly)',
      },
      rivalryCooldown: {
        value: 8,
        min: 3,
        max: 20,
        description: 'Ticks before same NPC can form another rivalry',
      },
      rivalryChance: {
        value: 0.7,
        min: 0.3,
        max: 0.95,
        description: 'Probability claimants become rivals',
      },
      escalationChance: {
        value: 0.3,
        min: 0.1,
        max: 0.7,
        description: 'Probability rivalry escalates to enemy_of between supporters',
      },
      conflictChance: {
        value: 0.5,
        min: 0.2,
        max: 0.9,
        description: 'Probability supporters actually form enemy_of when escalation triggered',
      },
      repealChance: {
        value: 0.4,
        min: 0.1,
        max: 0.8,
        description: 'Probability dead leader rules get repealed during crisis',
      },
    },
    triggers: {
      graphConditions: ['Factions with dead leaders'],
      comment: 'Detects leaderless factions and triggers succession cascades',
    },
  },

  apply: (graph: Graph, modifier: number = 1.0): SystemResult => {
    const params = successionVacuum.metadata?.parameters || {};
    const throttleChance = params.throttleChance?.value ?? 0.2;
    const RIVALRY_COOLDOWN = params.rivalryCooldown?.value ?? 8;
    const rivalryChance = params.rivalryChance?.value ?? 0.7;
    const escalationChance = params.escalationChance?.value ?? 0.3;
    const conflictChance = params.conflictChance?.value ?? 0.5;
    const repealChance = params.repealChance?.value ?? 0.4;

    // Throttle: Only check throttleChance% of ticks (don't need to check every tick)
    if (!rollProbability(throttleChance, modifier)) {
      return {
        relationshipsAdded: [],
        entitiesModified: [],
        pressureChanges: {},
        description: 'No succession crises detected'
      };
    }

    const modifications: Array<{ id: string; changes: Partial<HardState> }> = [];
    const relationships: Relationship[] = [];
    const pressureChanges: Record<string, number> = {};

    // === STEP 1: Detect Leaderless Factions ===
    const factions = findEntities(graph, { kind: 'faction', status: 'active' });
    const leaderlessFactions: HardState[] = [];

    factions.forEach(faction => {
      const leaders = getRelated(graph, faction.id, 'leader_of', 'dst');
      const livingLeaders = leaders.filter(leader => leader.status === 'alive');

      // Faction is leaderless if no living leaders
      if (livingLeaders.length === 0 && leaders.length > 0) {
        // Had a leader who died
        leaderlessFactions.push(faction);
      }
    });

    if (leaderlessFactions.length === 0) {
      return {
        relationshipsAdded: [],
        entitiesModified: [],
        pressureChanges: {},
        description: 'All factions have stable leadership'
      };
    }

    // === STEP 2: Process Each Succession Crisis ===
    leaderlessFactions.forEach(faction => {
      // Only core members (>= 0.7 strength) with sufficient prominence can claim leadership
      const coreMembers = getRelated(graph, faction.id, 'member_of', 'dst', { minStrength: 0.7 });
      const eligibleClaimants = coreMembers.filter(npc =>
        npc.status === 'alive' &&
        (npc.prominence === 'recognized' || npc.prominence === 'renowned' || npc.prominence === 'mythic')
      );

      if (eligibleClaimants.length < 2) {
        // Not enough potential leaders → faction wanes
        modifications.push({
          id: faction.id,
          changes: {
            status: 'waning',
            description: `${faction.description} With no clear successor, the faction's influence fades.`
          }
        });
        return;
      }

      // === STEP 3: Select 2-3 Claimants ===
      const claimantCount = Math.min(3, Math.max(2, eligibleClaimants.length));
      const claimants = pickMultiple(eligibleClaimants, claimantCount);

      // === STEP 4: Create Rivalry Relationships ===
      // Each claimant rivals the others
      for (let i = 0; i < claimants.length; i++) {
        for (let j = i + 1; j < claimants.length; j++) {
          const claimant1 = claimants[i];
          const claimant2 = claimants[j];

          // Check all preconditions before creating rivalry
          if (!areRelationshipsCompatible(graph, claimant1.id, claimant2.id, 'rival_of') ||
              !canFormRelationship(graph, claimant1.id, 'rival_of', RIVALRY_COOLDOWN)) {
            continue;
          }

          const rivalryProb = Math.min(0.95, rivalryChance * modifier);
          if (rollProbability(rivalryProb, modifier)) {
            relationships.push({
              kind: 'rival_of',
              src: claimant1.id,
              dst: claimant2.id
            });
            recordRelationshipFormation(graph, claimant1.id, 'rival_of');
          }
        }
      }

      // === STEP 5: Escalation to Conflict ===
      // Tunable chance rivalries escalate to enemy_of between supporter groups
      if (claimants.length >= 2 && Math.random() < escalationChance) {
        const claimant1Supporters = getRelated(graph, claimants[0].id, 'follower_of', 'dst');
        const claimant2Supporters = getRelated(graph, claimants[1].id, 'follower_of', 'dst');

        if (claimant1Supporters.length > 0 && claimant2Supporters.length > 0) {
          const supporter1 = pickRandom(claimant1Supporters);
          const supporter2 = pickRandom(claimant2Supporters);

          if (areRelationshipsCompatible(graph, supporter1.id, supporter2.id, 'enemy_of') &&
              canFormRelationship(graph, supporter1.id, 'enemy_of', 8)) {
            const conflictProb = Math.min(0.95, conflictChance * modifier);
            if (rollProbability(conflictProb, modifier)) {
              relationships.push({
                kind: 'enemy_of',
                src: supporter1.id,
                dst: supporter2.id
              });
              recordRelationshipFormation(graph, supporter1.id, 'enemy_of');
            }
          }
        }
      }

      // === STEP 6: Rule Repeals ===
      // Old edicts of the dead leader may be questioned
      const deadLeader = getRelated(graph, faction.id, 'leader_of', 'dst')
        .find(leader => leader.status === 'dead');

      if (deadLeader) {
        const leaderRules = findEntities(graph, { kind: 'rules', status: 'enacted' })
          .filter(rule => {
            const originators = getRelated(graph, rule.id, 'originated_in', 'src');
            return originators.some(orig => orig.id === faction.id);
          });

        if (leaderRules.length > 0) {
          const repealCount = Math.min(2, leaderRules.length);
          const rulesRepaled = pickMultiple(leaderRules, repealCount);

          rulesRepaled.forEach(rule => {
            const repealProb = Math.min(0.95, repealChance * modifier);
            if (rollProbability(repealProb, modifier)) {
              modifications.push({
                id: rule.id,
                changes: {
                  status: 'repealed',
                  description: `${rule.description} This edict was repealed during the succession crisis.`
                }
              });
            }
          });
        }
      }

      // === STEP 7: Faction Status Change ===
      // Faction becomes waning during crisis
      if (faction.status === 'active') {
        modifications.push({
          id: faction.id,
          changes: {
            status: 'waning',
            description: `${faction.description} A succession crisis threatens to tear the faction apart.`
          }
        });
      }

      // === STEP 8: Pressure Changes ===
      pressureChanges['stability'] = (pressureChanges['stability'] || 0) - 15; // Major instability
      pressureChanges['conflict'] = (pressureChanges['conflict'] || 0) + 10;    // Increased conflict

      // Note: Faction splitting is handled by existing factionSplinter template,
      // which will be triggered by high conflict pressure and waning faction status
    });

    return {
      relationshipsAdded: relationships,
      entitiesModified: modifications,
      pressureChanges,
      description: leaderlessFactions.length > 0
        ? `Succession crisis: ${leaderlessFactions.length} faction(s) face leadership vacuum`
        : 'Leadership transitions proceed smoothly'
    };
  }
};
