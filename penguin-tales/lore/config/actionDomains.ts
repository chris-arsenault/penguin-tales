/**
 * Penguin Action Domains
 *
 * Domain-specific configuration of action domains and their handlers.
 * The framework's universal catalyst system calls these handlers.
 */

import { Graph } from '@lore-weave/core/types/engine';
import { HardState, Relationship } from '@lore-weave/core/types/worldTypes';
import { generateId } from '@lore-weave/core/utils/helpers';

// ===========================
// ACTION DOMAIN DEFINITIONS
// ===========================

export interface ActionDefinition {
  type: string;
  name: string;
  description: string;
  baseSuccessChance: number;
  baseWeight?: number;
  requirements?: {
    minProminence?: string;
    requiredRelationships?: string[];
    requiredPressures?: Record<string, number>;
  };
  handler: (graph: Graph, actor: HardState, target?: HardState) => ActionOutcome;
}

export interface ActionDomain {
  id: string;
  name: string;
  description: string;
  validActors: string[];  // Entity kinds that can act in this domain
  actions: ActionDefinition[];
}

export interface ActionOutcome {
  success: boolean;
  relationships: Relationship[];
  description: string;
  entitiesCreated?: string[];
  entitiesModified?: string[];
}

// ===========================
// DOMAIN 1: POLITICAL
// ===========================

const politicalDomain: ActionDomain = {
  id: 'political',
  name: 'Political Actions',
  description: 'Governance, territorial control, alliances, and declarations of war',
  validActors: ['npc', 'faction', 'occurrence'],
  actions: [
    {
      type: 'seize_control',
      name: 'Seize Control',
      description: 'Take control of a location',
      baseSuccessChance: 0.3,
      baseWeight: 1.0,
      requirements: {
        minProminence: 'recognized',
        requiredRelationships: ['leader_of']
      },
      handler: (graph: Graph, actor: HardState): ActionOutcome => {
        // Find adjacent uncontrolled locations
        const controlledLocations = graph.getRelationships()
          .filter(r => r.kind === 'controls' && r.src === actor.id)
          .map(r => r.dst);

        const candidates = graph.getEntities()
          .filter(e => {
            if (e.kind !== 'location') return false;

            // Already controlled by this actor
            if (controlledLocations.includes(e.id)) return false;

            // Check if adjacent to controlled location
            const isAdjacent = graph.getRelationships().some(r =>
              r.kind === 'adjacent_to' &&
              ((r.src === e.id && controlledLocations.includes(r.dst)) ||
               (r.dst === e.id && controlledLocations.includes(r.src)))
            );

            return isAdjacent || controlledLocations.length === 0;
          });

        if (candidates.length === 0) {
          return {
            success: false,
            relationships: [],
            description: 'found no locations to seize'
          };
        }

        const target = candidates[Math.floor(Math.random() * candidates.length)];

        return {
          success: true,
          relationships: [{
            kind: 'controls',
            src: actor.id,
            dst: target.id,
            strength: 0.8
          }],
          description: `seized control of ${target.name}`,
          entitiesModified: [target.id]
        };
      }
    },
    {
      type: 'form_alliance',
      name: 'Form Alliance',
      description: 'Create alliance between factions',
      baseSuccessChance: 0.4,
      baseWeight: 0.8,
      requirements: {
        minProminence: 'recognized'
      },
      handler: (graph: Graph, actor: HardState): ActionOutcome => {
        const actorFaction = actor.kind === 'faction' ? actor :
          graph.getEntity(
            actor.links.find(l => l.kind === 'leader_of')?.dst || ''
          );

        if (!actorFaction || actorFaction.kind !== 'faction') {
          return {
            success: false,
            relationships: [],
            description: 'has no faction to ally'
          };
        }

        // Find factions not already allied or at war
        const existingAllies = graph.getRelationships()
          .filter(r => r.kind === 'allied_with' && r.src === actorFaction.id)
          .map(r => r.dst);

        const enemies = graph.getRelationships()
          .filter(r => r.kind === 'at_war_with' &&
                      (r.src === actorFaction.id || r.dst === actorFaction.id))
          .map(r => r.src === actorFaction.id ? r.dst : r.src);

        const candidates = graph.getEntities()
          .filter(e =>
            e.kind === 'faction' &&
            e.id !== actorFaction.id &&
            !existingAllies.includes(e.id) &&
            !enemies.includes(e.id)
          );

        if (candidates.length === 0) {
          return {
            success: false,
            relationships: [],
            description: 'found no factions to ally with'
          };
        }

        const target = candidates[Math.floor(Math.random() * candidates.length)];

        return {
          success: true,
          relationships: [
            {
              kind: 'allied_with',
              src: actorFaction.id,
              dst: target.id,
              strength: 0.7
            },
            {
              kind: 'allied_with',
              src: target.id,
              dst: actorFaction.id,
              strength: 0.7
            }
          ],
          description: `forged alliance between ${actorFaction.name} and ${target.name}`,
          entitiesModified: [target.id]
        };
      }
    },
    {
      type: 'declare_war',
      name: 'Declare War',
      description: 'Create enemy relationship and potential war occurrence',
      baseSuccessChance: 0.6,
      baseWeight: 0.5,
      requirements: {
        minProminence: 'renowned'
      },
      handler: (graph: Graph, actor: HardState): ActionOutcome => {
        const actorFaction = actor.kind === 'faction' ? actor :
          graph.getEntity(
            actor.links.find(l => l.kind === 'leader_of')?.dst || ''
          );

        if (!actorFaction || actorFaction.kind !== 'faction') {
          return {
            success: false,
            relationships: [],
            description: 'has no faction to lead into war'
          };
        }

        // Find factions not already at war
        const existingEnemies = graph.getRelationships()
          .filter(r => r.kind === 'at_war_with' &&
                      (r.src === actorFaction.id || r.dst === actorFaction.id))
          .map(r => r.src === actorFaction.id ? r.dst : r.src);

        const candidates = graph.getEntities()
          .filter(e =>
            e.kind === 'faction' &&
            e.id !== actorFaction.id &&
            !existingEnemies.includes(e.id)
          );

        if (candidates.length === 0) {
          return {
            success: false,
            relationships: [],
            description: 'found no new factions to declare war upon'
          };
        }

        const target = candidates[Math.floor(Math.random() * candidates.length)];

        return {
          success: true,
          relationships: [
            {
              kind: 'at_war_with',
              src: actorFaction.id,
              dst: target.id,
              strength: 0.9
            },
            {
              kind: 'at_war_with',
              src: target.id,
              dst: actorFaction.id,
              strength: 0.9
            }
          ],
          description: `declared war on ${target.name}`,
          entitiesModified: [target.id]
        };
      }
    }
  ]
};

// ===========================
// DOMAIN 2: MILITARY
// ===========================

const militaryDomain: ActionDomain = {
  id: 'military',
  name: 'Military Actions',
  description: 'Combat, fortification, and strategic maneuvers',
  validActors: ['npc', 'faction', 'occurrence'],
  actions: [
    {
      type: 'raid',
      name: 'Raid',
      description: 'Attack enemy location',
      baseSuccessChance: 0.35,
      baseWeight: 1.0,
      handler: (graph: Graph, actor: HardState): ActionOutcome => {
        // Find enemy factions
        const actorFaction = actor.kind === 'faction' ? actor :
          graph.getEntity(actor.links.find(l => l.kind === 'leader_of')?.dst || '');

        if (!actorFaction) {
          return { success: false, relationships: [], description: 'has no faction' };
        }

        const enemies = graph.getRelationships()
          .filter(r => r.kind === 'at_war_with' && r.src === actorFaction.id)
          .map(r => r.dst);

        if (enemies.length === 0) {
          return { success: false, relationships: [], description: 'has no enemies to raid' };
        }

        const enemy = graph.getEntity(enemies[Math.floor(Math.random() * enemies.length)]);
        if (!enemy) {
          return { success: false, relationships: [], description: 'enemy not found' };
        }

        return {
          success: true,
          relationships: [{
            kind: 'enemy_of',
            src: actor.id,
            dst: enemy.id,
            strength: 0.8
          }],
          description: `raided ${enemy.name}`,
          entitiesModified: [enemy.id]
        };
      }
    }
  ]
};

// ===========================
// DOMAIN 3: ECONOMIC
// ===========================

const economicDomain: ActionDomain = {
  id: 'economic',
  name: 'Economic Actions',
  description: 'Trade, monopolization, and resource control',
  validActors: ['npc', 'faction'],
  actions: [
    {
      type: 'establish_trade',
      name: 'Establish Trade Route',
      description: 'Create trade connection between locations',
      baseSuccessChance: 0.5,
      baseWeight: 1.2,
      handler: (graph: Graph, actor: HardState): ActionOutcome => {
        // Find two locations not already trading
        const locations = graph.getEntities()
          .filter(e => e.kind === 'location' && e.status === 'thriving');

        if (locations.length < 2) {
          return { success: false, relationships: [], description: 'insufficient locations for trade' };
        }

        const loc1 = locations[Math.floor(Math.random() * locations.length)];
        const loc2 = locations[Math.floor(Math.random() * locations.length)];

        if (loc1.id === loc2.id) {
          return { success: false, relationships: [], description: 'cannot trade with self' };
        }

        // Check if already trading
        const alreadyTrading = graph.getRelationships().some(r =>
          r.kind === 'trades_with' &&
          ((r.src === loc1.id && r.dst === loc2.id) || (r.src === loc2.id && r.dst === loc1.id))
        );

        if (alreadyTrading) {
          return { success: false, relationships: [], description: 'trade route already exists' };
        }

        return {
          success: true,
          relationships: [
            {
              kind: 'trades_with',
              src: loc1.id,
              dst: loc2.id,
              strength: 0.6
            },
            {
              kind: 'trades_with',
              src: loc2.id,
              dst: loc1.id,
              strength: 0.6
            }
          ],
          description: `established trade route between ${loc1.name} and ${loc2.name}`,
          entitiesModified: [loc1.id, loc2.id]
        };
      }
    }
  ]
};

// ===========================
// DOMAIN 4: MAGICAL
// ===========================

const magicalDomain: ActionDomain = {
  id: 'magical',
  name: 'Magical Actions',
  description: 'Ice magic, corruption, manifestation',
  validActors: ['npc', 'abilities', 'occurrence'],
  actions: [
    {
      type: 'corrupt_location',
      name: 'Corrupt Location',
      description: 'Spread magical corruption',
      baseSuccessChance: 0.25,
      baseWeight: 0.8,
      requirements: {
        requiredRelationships: ['practitioner_of'],
        requiredPressures: { magical_instability: 50 }
      },
      handler: (graph: Graph, actor: HardState): ActionOutcome => {
        // Find magical ability
        const ability = actor.kind === 'abilities' ? actor :
          graph.getEntity(
            actor.links.find(l => l.kind === 'practitioner_of')?.dst || ''
          );

        if (!ability || ability.subtype !== 'magic') {
          return { success: false, relationships: [], description: 'has no magical ability' };
        }

        // Find uncorrupted location
        const corruptedLocations = graph.getRelationships()
          .filter(r => r.kind === 'corrupted_by')
          .map(r => r.src);

        const candidates = graph.getEntities()
          .filter(e => e.kind === 'location' && !corruptedLocations.includes(e.id));

        if (candidates.length === 0) {
          return { success: false, relationships: [], description: 'all locations already corrupted' };
        }

        const target = candidates[Math.floor(Math.random() * candidates.length)];

        return {
          success: true,
          relationships: [{
            kind: 'corrupted_by',
            src: target.id,
            dst: ability.id,
            strength: 0.7
          }],
          description: `corrupted ${target.name} with ${ability.name}`,
          entitiesModified: [target.id]
        };
      }
    },
    {
      type: 'manifest',
      name: 'Manifest Magic',
      description: 'Magic manifests at a location',
      baseSuccessChance: 0.3,
      baseWeight: 1.0,
      handler: (graph: Graph, actor: HardState): ActionOutcome => {
        if (actor.kind !== 'abilities' || actor.subtype !== 'magic') {
          return { success: false, relationships: [], description: 'not a magical ability' };
        }

        // Find locations where magic doesn't already manifest
        const manifestLocations = graph.getRelationships()
          .filter(r => r.kind === 'manifests_at' && r.src === actor.id)
          .map(r => r.dst);

        const candidates = graph.getEntities()
          .filter(e => e.kind === 'location' && !manifestLocations.includes(e.id));

        if (candidates.length === 0) {
          return { success: false, relationships: [], description: 'already manifests everywhere possible' };
        }

        const target = candidates[Math.floor(Math.random() * candidates.length)];

        return {
          success: true,
          relationships: [{
            kind: 'manifests_at',
            src: actor.id,
            dst: target.id,
            strength: 0.8
          }],
          description: `manifested at ${target.name}`,
          entitiesModified: [target.id]
        };
      }
    }
  ]
};

// ===========================
// DOMAIN 5: TECHNOLOGICAL
// ===========================

const technologicalDomain: ActionDomain = {
  id: 'technological',
  name: 'Technological Actions',
  description: 'Innovation, weaponization, and tech spread',
  validActors: ['npc', 'faction', 'abilities'],
  actions: [
    {
      type: 'spread_innovation',
      name: 'Spread Innovation',
      description: 'Technology spreads to new practitioners',
      baseSuccessChance: 0.4,
      baseWeight: 1.0,
      handler: (graph: Graph, actor: HardState): ActionOutcome => {
        const tech = actor.kind === 'abilities' && actor.subtype === 'technology' ? actor : null;

        if (!tech) {
          return { success: false, relationships: [], description: 'not a technology' };
        }

        // Find NPCs/factions not yet practitioners
        const practitioners = graph.getRelationships()
          .filter(r => r.kind === 'practitioner_of' && r.dst === tech.id)
          .map(r => r.src);

        const candidates = graph.getEntities()
          .filter(e => (e.kind === 'npc' || e.kind === 'faction') &&
                      !practitioners.includes(e.id) &&
                      e.status !== 'dead');

        if (candidates.length === 0) {
          return { success: false, relationships: [], description: 'no new practitioners available' };
        }

        const target = candidates[Math.floor(Math.random() * candidates.length)];

        return {
          success: true,
          relationships: [{
            kind: 'practitioner_of',
            src: target.id,
            dst: tech.id,
            strength: 0.6
          }],
          description: `spread to ${target.name}`,
          entitiesModified: [target.id]
        };
      }
    }
  ]
};

// ===========================
// DOMAIN 6: ENVIRONMENTAL
// ===========================

const environmentalDomain: ActionDomain = {
  id: 'environmental',
  name: 'Environmental Actions',
  description: 'Ice drift, krill migration, natural phenomena',
  validActors: ['location', 'occurrence'],
  actions: [
    {
      type: 'ice_drift',
      name: 'Ice Drift',
      description: 'Iceberg drifts, changing adjacencies',
      baseSuccessChance: 0.2,
      baseWeight: 0.5,
      handler: (graph: Graph, actor: HardState): ActionOutcome => {
        // Placeholder for ice drift logic
        return {
          success: false,
          relationships: [],
          description: 'ice remains stable'
        };
      }
    }
  ]
};

// ===========================
// DOMAIN 7: CULTURAL
// ===========================

const culturalDomain: ActionDomain = {
  id: 'cultural',
  name: 'Cultural Actions',
  description: 'Convert factions, inspire heroes, create schisms',
  validActors: ['npc', 'occurrence'],
  actions: [
    {
      type: 'convert_faction',
      name: 'Convert Faction',
      description: 'Spread cultural/religious belief to faction',
      baseSuccessChance: 0.3,
      baseWeight: 1.0,
      handler: (graph: Graph, actor: HardState): ActionOutcome => {
        // Find rules this actor weaponizes
        const rules = graph.getRelationships()
          .filter(r => r.kind === 'weaponized_by' && r.src === actor.id)
          .map(r => graph.getEntity(r.dst))
          .filter(r => r && r.kind === 'rules');

        if (rules.length === 0) {
          return { success: false, relationships: [], description: 'has no ideology to spread' };
        }

        const rule = rules[0];
        if (!rule) return { success: false, relationships: [], description: 'rule not found' };

        // Find factions not yet weaponizing this rule
        const adopters = graph.getRelationships()
          .filter(r => r.kind === 'weaponized_by' && r.dst === rule.id)
          .map(r => r.src);

        const candidates = graph.getEntities()
          .filter(e => e.kind === 'faction' && !adopters.includes(e.id));

        if (candidates.length === 0) {
          return { success: false, relationships: [], description: 'all factions already converted' };
        }

        const target = candidates[Math.floor(Math.random() * candidates.length)];

        return {
          success: true,
          relationships: [{
            kind: 'weaponized_by',
            src: target.id,
            dst: rule.id,
            strength: 0.7
          }],
          description: `converted ${target.name} to ${rule.name}`,
          entitiesModified: [target.id]
        };
      }
    }
  ]
};

// ===========================
// DOMAIN 8: CONFLICT ESCALATION
// ===========================

const conflictEscalationDomain: ActionDomain = {
  id: 'conflict_escalation',
  name: 'Conflict Escalation',
  description: 'War momentum, drawing in factions, devastation',
  validActors: ['occurrence'],
  actions: [
    {
      type: 'draw_in_faction',
      name: 'Draw In Faction',
      description: 'Neutral faction becomes war participant',
      baseSuccessChance: 0.3,
      baseWeight: 1.5,
      handler: (graph: Graph, actor: HardState): ActionOutcome => {
        if (actor.kind !== 'occurrence' || actor.subtype !== 'war') {
          return { success: false, relationships: [], description: 'not a war' };
        }

        // Find current participants
        const participants = graph.getRelationships()
          .filter(r => r.kind === 'participant_in' && r.dst === actor.id)
          .map(r => r.src);

        // Find non-participant factions
        const candidates = graph.getEntities()
          .filter(e => e.kind === 'faction' && !participants.includes(e.id));

        if (candidates.length === 0) {
          return { success: false, relationships: [], description: 'all factions already involved' };
        }

        const target = candidates[Math.floor(Math.random() * candidates.length)];

        return {
          success: true,
          relationships: [{
            kind: 'participant_in',
            src: target.id,
            dst: actor.id,
            strength: 0.8
          }],
          description: `drew ${target.name} into the war`,
          entitiesModified: [target.id]
        };
      }
    },
    {
      type: 'escalate_war',
      name: 'Escalate War',
      description: 'War intensifies',
      baseSuccessChance: 0.4,
      baseWeight: 1.0,
      handler: (graph: Graph, actor: HardState): ActionOutcome => {
        if (actor.kind !== 'occurrence' || actor.subtype !== 'war') {
          return { success: false, relationships: [], description: 'not a war' };
        }

        // Increase strength of participant relationships
        return {
          success: true,
          relationships: [],
          description: 'escalated in intensity',
          entitiesModified: [actor.id]
        };
      }
    }
  ]
};

// ===========================
// DOMAIN 9: DISASTER SPREAD
// ===========================

const disasterSpreadDomain: ActionDomain = {
  id: 'disaster_spread',
  name: 'Disaster Spread',
  description: 'Corruption spreads, threats spawn, refugees flee',
  validActors: ['occurrence'],
  actions: [
    {
      type: 'spread_corruption',
      name: 'Spread Corruption',
      description: 'Disaster corrupts adjacent locations',
      baseSuccessChance: 0.35,
      baseWeight: 1.2,
      handler: (graph: Graph, actor: HardState): ActionOutcome => {
        if (actor.kind !== 'occurrence' || actor.subtype !== 'magical_disaster') {
          return { success: false, relationships: [], description: 'not a magical disaster' };
        }

        // Find epicenter
        const epicenter = graph.getRelationships()
          .find(r => r.kind === 'epicenter_of' && r.src === actor.id);

        if (!epicenter) {
          return { success: false, relationships: [], description: 'has no epicenter' };
        }

        // Find adjacent uncorrupted locations
        const adjacentLocations = graph.getRelationships()
          .filter(r => r.kind === 'adjacent_to' &&
                      (r.src === epicenter.dst || r.dst === epicenter.dst))
          .map(r => r.src === epicenter.dst ? r.dst : r.src);

        const corruptedLocations = graph.getRelationships()
          .filter(r => r.kind === 'corrupted_by')
          .map(r => r.src);

        const candidates = adjacentLocations
          .map(id => graph.getEntity(id))
          .filter(e => e && !corruptedLocations.includes(e.id));

        if (candidates.length === 0) {
          return { success: false, relationships: [], description: 'corruption contained' };
        }

        const target = candidates[Math.floor(Math.random() * candidates.length)]!;

        // Find existing corruption ability or use actor if it's a corruption effect
        const corruptionAbility = graph.getEntities()
          .find(e => e.kind === 'abilities' && e.name === 'Corruption');

        // Use existing corruption ability, or the disaster's originating ability
        const ability = corruptionAbility || graph.getEntity(
          graph.getRelationships()
            .find(r => r.kind === 'caused_by' && r.src === actor.id)?.dst || ''
        );

        if (!ability) {
          return { success: false, relationships: [], description: 'no corruption source found' };
        }

        return {
          success: true,
          relationships: [{
            kind: 'corrupted_by',
            src: target.id,
            dst: ability.id,
            strength: 0.8
          }],
          description: `spread corruption to ${target.name}`,
          entitiesModified: [target.id]
        };
      }
    }
  ]
};

// ===========================
// EXPORTS
// ===========================

export const penguinActionDomains: ActionDomain[] = [
  politicalDomain,
  militaryDomain,
  economicDomain,
  magicalDomain,
  technologicalDomain,
  environmentalDomain,
  culturalDomain,
  conflictEscalationDomain,
  disasterSpreadDomain
];

/**
 * Get all action domains
 */
export function getActionDomains(): ActionDomain[] {
  return penguinActionDomains;
}

/**
 * Get actions for a specific domain
 */
export function getActionsForDomain(domainId: string): ActionDefinition[] {
  const domain = penguinActionDomains.find(d => d.id === domainId);
  return domain?.actions || [];
}

/**
 * Pressure-domain mappings
 * Defines which pressures amplify which action domains
 */
export const pressureDomainMappings: Record<string, string[]> = {
  political: ['conflict', 'stability'],
  military: ['conflict', 'external_threat'],
  economic: ['resource_scarcity', 'stability'],
  magical: ['magical_instability'],
  technological: ['resource_scarcity', 'magical_instability'],
  environmental: ['magical_instability'],
  cultural: ['cultural_tension', 'stability'],
  conflict_escalation: ['conflict', 'external_threat'],
  disaster_spread: ['magical_instability']
};

/**
 * Get pressure mappings
 */
export function getPressureDomainMappings(): Record<string, string[]> {
  return pressureDomainMappings;
}

/**
 * Get action domains for an entity based on its kind and subtype
 * This is penguin-domain specific logic that maps entity types to their capabilities.
 * @param entity - The entity to check
 * @returns Array of action domain IDs
 */
export function getActionDomainsForEntity(entity: HardState): string[] {
  const domains: string[] = [];

  switch (entity.kind) {
    case 'npc':
      if (entity.subtype === 'hero') {
        domains.push('political', 'military', 'cultural');
      } else if (entity.subtype === 'mayor') {
        domains.push('political', 'economic');
      } else if (entity.subtype === 'orca') {
        domains.push('military');
      } else if (entity.subtype === 'outlaw') {
        domains.push('military', 'economic');
      } else {
        // Other NPC types get economic domain
        domains.push('economic');
      }
      break;

    case 'faction':
      domains.push('political', 'economic', 'cultural');
      if (entity.subtype === 'criminal') {
        domains.push('military');
      }
      break;

    case 'abilities':
      if (entity.subtype === 'magic') {
        domains.push('magical');
      } else if (entity.subtype === 'technology') {
        domains.push('technological');
      }
      break;

    case 'occurrence':
      if (entity.subtype === 'war') {
        domains.push('conflict_escalation', 'military');
      } else if (entity.subtype === 'magical_disaster') {
        domains.push('disaster_spread');
      }
      break;

    case 'location':
      // Anomalies can cause environmental effects
      if (entity.subtype === 'anomaly') {
        domains.push('environmental', 'magical');
      }
      break;
  }

  return domains;
}
