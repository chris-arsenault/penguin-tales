import { SimulationSystem, SystemResult, Graph } from '../../../types/engine';
import { HardState, Relationship } from '../../../types/worldTypes';
import {
  findEntities,
  getRelated,
  rollProbability
} from '../../../utils/helpers';

/**
 * Belief Contagion System
 *
 * Models ideological spread through social networks using SIR epidemic model.
 * Rules with status='proposed' act as contagions, spreading through contact networks.
 * NPCs can adopt (become infected), resist (stay susceptible), or reject (become recovered).
 *
 * Mathematical Foundation:
 * SIR Model:
 *   P(infection) = β * num_infected_neighbors * (1 - resistance_trait)
 *   P(recovery) = γ * (1 + tradition_trait)
 *
 * Where:
 *   β = 0.1 (transmission rate)
 *   γ = 0.05 (recovery rate)
 *   resistance_trait = 0.3 for conservative NPCs
 *   tradition_trait = 0.5 for traditionalists
 *
 * Transmission vectors: follower_of, member_of relationships
 *
 * SYSTEM_IMPLEMENTATION_GUIDE compliance:
 * - Natural throttling (only processes proposed rules)
 * - Caps probabilities at 0.95 before rollProbability
 * - Tracks NPC tag modifications properly
 * - Transitions rule status: proposed → enacted (when adoption threshold met)
 */

// Infection state tracking (stored in NPC tags)
function getBeliefsAdopted(npc: HardState): Set<string> {
  const beliefs = new Set<string>();
  npc.tags.forEach(tag => {
    if (tag.startsWith('belief:')) {
      beliefs.add(tag.split(':')[1]);
    }
  });
  return beliefs;
}

function hasAdoptedBelief(npc: HardState, ruleId: string): boolean {
  return npc.tags.some(tag => tag === `belief:${ruleId}`);
}

function adoptBelief(npc: HardState, ruleId: string): void {
  if (!hasAdoptedBelief(npc, ruleId)) {
    npc.tags.push(`belief:${ruleId}`);
    // Ensure tags stay <= 10
    if (npc.tags.length > 10) {
      npc.tags = npc.tags.slice(-10);
    }
  }
}

function rejectBelief(npc: HardState, ruleId: string): void {
  // Add immunity tag
  if (!npc.tags.some(tag => tag === `immune:${ruleId}`)) {
    npc.tags.push(`immune:${ruleId}`);
    if (npc.tags.length > 10) {
      npc.tags = npc.tags.slice(-10);
    }
  }
}

function isImmune(npc: HardState, ruleId: string): boolean {
  return npc.tags.some(tag => tag === `immune:${ruleId}`);
}

export const beliefContagion: SimulationSystem = {
  id: 'belief_contagion',
  name: 'Ideological Spread',

  metadata: {
    produces: {
      relationships: [],
      modifications: [
        { type: 'tags', frequency: 'common', comment: 'NPCs adopt/reject belief tags' },
        { type: 'status', frequency: 'uncommon', comment: 'Rules transition proposed → enacted/forgotten' },
        { type: 'prominence', frequency: 'rare', comment: 'Enacted rules gain prominence' },
      ],
    },
    effects: {
      graphDensity: 0.0,
      clusterFormation: 0.8,
      diversityImpact: 0.7,
      comment: 'Spreads ideologies through social networks using SIR epidemic model',
    },
    parameters: {
      transmissionRate: {
        value: 0.15,
        min: 0.05,
        max: 0.5,
        description: 'Beta: infection probability per infected contact',
      },
      recoveryRate: {
        value: 0.03,
        min: 0.01,
        max: 0.2,
        description: 'Gamma: rejection probability per tick',
      },
      resistanceWeight: {
        value: 0.3,
        min: 0.0,
        max: 0.8,
        description: 'Resistance bonus for traditional/conservative NPCs',
      },
      traditionWeight: {
        value: 0.5,
        min: 0.0,
        max: 1.0,
        description: 'Recovery bonus for traditional NPCs',
      },
      enactmentThreshold: {
        value: 0.2,
        min: 0.1,
        max: 0.5,
        description: 'Adoption rate needed for proposed → enacted transition',
      },
    },
    triggers: {
      graphConditions: ['Proposed rules exist', 'NPC count > 0'],
      comment: 'Only runs when proposed ideologies are active',
    },
  },

  apply: (graph: Graph, modifier: number = 1.0): SystemResult => {
    const params = beliefContagion.metadata?.parameters || {};
    const BETA = params.transmissionRate?.value ?? 0.15;
    const GAMMA = params.recoveryRate?.value ?? 0.03;
    const RESISTANCE_WEIGHT = params.resistanceWeight?.value ?? 0.3;
    const TRADITION_WEIGHT = params.traditionWeight?.value ?? 0.5;
    const ENACTMENT_THRESHOLD = params.enactmentThreshold?.value ?? 0.2;

    const modifications: Array<{ id: string; changes: Partial<HardState> }> = [];
    const relationships: Relationship[] = [];

    // Find all proposed rules (these are the "diseases" to spread)
    const proposedRules = findEntities(graph, { kind: 'rules', status: 'proposed' });

    // Natural throttling: Only runs if there are proposed rules
    if (proposedRules.length === 0) {
      return {
        relationshipsAdded: [],
        entitiesModified: [],
        pressureChanges: {},
        description: 'No ideological movements active'
      };
    }

    const npcs = findEntities(graph, { kind: 'npc', status: 'alive' });

    proposedRules.forEach(rule => {
      const carriers: HardState[] = []; // Infected NPCs
      const susceptible: HardState[] = []; // Can be infected
      const recovered: HardState[] = []; // Immune

      // Categorize NPCs by infection state
      npcs.forEach(npc => {
        // Check both tags AND believer_of relationships for initial carriers
        const hasBeliefTag = hasAdoptedBelief(npc, rule.id);
        const hasBelieverRelationship = graph.relationships.some(r =>
          r.kind === 'believer_of' && r.src === npc.id && r.dst === rule.id
        );

        if (hasBeliefTag || hasBelieverRelationship) {
          // Add belief tag if they have relationship but not tag yet
          if (hasBelieverRelationship && !hasBeliefTag) {
            adoptBelief(npc, rule.id);
            modifications.push({
              id: npc.id,
              changes: { tags: npc.tags }
            });
          }
          carriers.push(npc);
        } else if (isImmune(npc, rule.id)) {
          recovered.push(npc);
        } else {
          susceptible.push(npc);
        }
      });

      // === TRANSMISSION PHASE ===
      // Susceptible NPCs exposed to infected carriers may adopt the belief
      susceptible.forEach(npc => {
        // Count infected neighbors (via follower_of, member_of)
        // Only relationships >= 0.3 have meaningful influence on belief transmission
        const followers = getRelated(graph, npc.id, 'follower_of', 'dst', { minStrength: 0.3 }); // NPCs who follow this one
        const followees = getRelated(graph, npc.id, 'follower_of', 'src', { minStrength: 0.3 }); // NPCs this one follows
        const factionMembers = getRelated(graph, npc.id, 'member_of', 'src', { minStrength: 0.3 })
          .flatMap(faction => getRelated(graph, faction.id, 'member_of', 'dst', { minStrength: 0.3 }));

        const contacts = [...followers, ...followees, ...factionMembers];
        const infectedContacts = contacts.filter(contact => hasAdoptedBelief(contact, rule.id));

        if (infectedContacts.length === 0) return; // No exposure

        // Calculate resistance based on NPC traits
        let resistance = 0;
        if (npc.tags.includes('traditional') || npc.tags.includes('conservative')) {
          resistance = RESISTANCE_WEIGHT;
        }
        if (npc.tags.includes('radical') || npc.tags.includes('innovator')) {
          resistance = -0.2; // More susceptible
        }

        // Calculate infection probability: P = β * contacts * (1 - resistance)
        const baseProb = BETA * infectedContacts.length * (1 - resistance);
        const infectionProb = Math.min(0.95, baseProb * modifier);

        if (rollProbability(infectionProb, modifier)) {
          adoptBelief(npc, rule.id);
          modifications.push({
            id: npc.id,
            changes: { tags: npc.tags }
          });
        }
      });

      // === RECOVERY PHASE ===
      // Infected NPCs may reject the belief based on traditional traits
      carriers.forEach(npc => {
        let traditionBonus = 0;
        if (npc.tags.includes('traditional') || npc.tags.includes('conservative')) {
          traditionBonus = TRADITION_WEIGHT;
        }

        // Calculate recovery probability: P = γ * (1 + tradition)
        const baseProb = GAMMA * (1 + traditionBonus);
        const recoveryProb = Math.min(0.95, baseProb * modifier);

        if (rollProbability(recoveryProb, modifier)) {
          // Remove belief and add immunity
          npc.tags = npc.tags.filter(tag => tag !== `belief:${rule.id}`);
          rejectBelief(npc, rule.id);
          modifications.push({
            id: npc.id,
            changes: { tags: npc.tags }
          });
        }
      });

      // === ENACTMENT CHECK ===
      // If enough NPCs have adopted the belief, transition proposed → enacted
      const currentCarriers = npcs.filter(npc => hasAdoptedBelief(npc, rule.id));
      const adoptionRate = currentCarriers.length / npcs.length;

      if (adoptionRate >= ENACTMENT_THRESHOLD && rule.status === 'proposed') {
        modifications.push({
          id: rule.id,
          changes: {
            status: 'enacted',
            description: `${rule.description} This belief has spread widely and is now established tradition.`,
            prominence: 'recognized'
          }
        });
      }
      // If adoption drops too low, belief fades
      else if (adoptionRate < 0.05 && rule.status === 'proposed') {
        modifications.push({
          id: rule.id,
          changes: {
            status: 'forgotten',
            description: `${rule.description} This ideology failed to gain traction.`
          }
        });
      }
    });

    // === PRESSURE CHANGES ===
    const pressureChanges: Record<string, number> = {};
    if (modifications.some(m => m.changes.status === 'enacted')) {
      pressureChanges['cultural_tension'] = -10; // Consensus reduces tension
      pressureChanges['stability'] = 5; // Shared beliefs increase stability
    }

    return {
      relationshipsAdded: relationships,
      entitiesModified: modifications,
      pressureChanges,
      description: modifications.length > 0
        ? `Ideological movements: ${modifications.filter(m => m.changes.tags).length} NPCs shift beliefs`
        : 'Belief systems remain stable'
    };
  }
};
