import { TemplateGraphView } from '@lore-weave/core';
import { SimulationSystem, SystemResult, ComponentPurpose } from '@lore-weave/core';
import { HardState } from '@lore-weave/core';
import {
  getProminenceValue,
  adjustProminence
} from '@lore-weave/core';

/**
 * Prominence Evolution System
 *
 * Models fame and obscurity - well-connected entities become more prominent,
 * isolated entities fade.
 *
 * Design Goals:
 * - Most NPCs should be forgotten/marginal (realistic distribution)
 * - Only factions can go beyond "recognized" (locations, abilities, rules capped)
 * - Prominence gain requires exceptional circumstances
 * - Natural decay toward obscurity over time
 */
export const prominenceEvolution: SimulationSystem = {
  id: 'prominence_evolution',
  name: 'Fame and Obscurity',

  contract: {
    purpose: ComponentPurpose.PROMINENCE_EVOLUTION,
    enabledBy: {
      entityCounts: [
        { kind: 'npc', min: 1 }
      ]
    },
    affects: {
      entities: [
        { kind: 'npc', operation: 'modify' },
        { kind: 'faction', operation: 'modify' },
        { kind: 'location', operation: 'modify' },
        { kind: 'abilities', operation: 'modify' },
        { kind: 'rules', operation: 'modify' }
      ]
    }
  },

  metadata: {
    produces: {
      relationships: [],
      modifications: [
        { type: 'prominence', frequency: 'common', comment: 'All entity types can gain/lose prominence' },
      ],
    },
    effects: {
      graphDensity: 0.0,
      clusterFormation: 0.2,
      diversityImpact: 0.5,
      comment: 'Well-connected entities gain fame, isolated entities fade to obscurity',
    },
    parameters: {
      npcGainChance: {
        value: 0.3,
        min: 0.1,
        max: 0.7,
        description: 'Probability NPC gains prominence when connection threshold met',
      },
      npcDecayChance: {
        value: 0.7,
        min: 0.3,
        max: 0.95,
        description: 'Probability NPC loses prominence when under-connected',
      },
      locationGainChance: {
        value: 0.4,
        min: 0.1,
        max: 0.8,
        description: 'Probability location gains prominence when connection threshold met',
      },
      locationDecayChance: {
        value: 0.5,
        min: 0.2,
        max: 0.8,
        description: 'Probability location loses prominence when under-connected',
      },
      abilityGainChance: {
        value: 0.35,
        min: 0.1,
        max: 0.7,
        description: 'Probability ability gains prominence with many practitioners',
      },
      abilityDecayChance: {
        value: 0.4,
        min: 0.2,
        max: 0.7,
        description: 'Probability ability loses prominence with few practitioners',
      },
      ruleGainChance: {
        value: 0.3,
        min: 0.1,
        max: 0.7,
        description: 'Probability rule gains prominence when well-connected',
      },
      ruleDecayChance: {
        value: 0.5,
        min: 0.2,
        max: 0.8,
        description: 'Probability rule loses prominence when forgotten',
      },
    },
    triggers: {
      graphConditions: ['Entity connection counts'],
      comment: 'Runs every tick, evaluates all entities',
    },
  },

  apply: (graphView: TemplateGraphView, modifier: number = 1.0): SystemResult => {
    const params = prominenceEvolution.metadata?.parameters || {};
    const npcGainChance = params.npcGainChance?.value ?? 0.3;
    const npcDecayChance = params.npcDecayChance?.value ?? 0.7;
    const locationGainChance = params.locationGainChance?.value ?? 0.4;
    const locationDecayChance = params.locationDecayChance?.value ?? 0.5;
    const abilityGainChance = params.abilityGainChance?.value ?? 0.35;
    const abilityDecayChance = params.abilityDecayChance?.value ?? 0.4;
    const ruleGainChance = params.ruleGainChance?.value ?? 0.3;
    const ruleDecayChance = params.ruleDecayChance?.value ?? 0.5;

    const modifications: Array<{ id: string; changes: Partial<HardState> }> = [];

    // NPCs: Prominence based on catalyzed events (agency and impact)
    const npcs = graphView.findEntities({ kind: 'npc' });

    npcs.forEach(npc => {
      const relationships = graphView.getAllRelationships().filter(r =>
        r.src === npc.id || r.dst === npc.id
      );

      // Use catalyzedEvents if available, otherwise fall back to connection count
      const catalyzedEvents = npc.catalyst?.catalyzedEvents?.length ?? 0;
      const connectionScore = catalyzedEvents > 0
        ? catalyzedEvents * 2  // Each catalyzed event worth 2 connections
        : relationships.length;  // Fallback for entities without catalyst data

      const currentProminence = getProminenceValue(npc.prominence);

      // Only heroes and mayors get a small bonus (reduced from +1 to +0.5 effective)
      const roleBonus = (npc.subtype === 'hero' || npc.subtype === 'mayor') ? 2 : 0;

      // Much harsher thresholds for prominence gain
      // forgotten (0) -> marginal (1): needs 6+ impact
      // marginal (1) -> recognized (2): needs 12+ impact
      // recognized (2) -> renowned (3): needs 20+ impact
      // renowned (3) -> mythic (4): needs 30+ impact
      let prominenceDelta = 0;
      const gainThreshold = (currentProminence + 1) * 6;

      if (connectionScore + roleBonus >= gainThreshold) {
        // Tunable chance to gain even with enough connections
        if (Math.random() < npcGainChance * modifier) {
          prominenceDelta = 1;
        }
      } else if (connectionScore < currentProminence * 2) {
        // Tunable chance to decay
        if (Math.random() > (1 - npcDecayChance)) {
          prominenceDelta = -1;
        }
      }

      if (prominenceDelta !== 0) {
        modifications.push({
          id: npc.id,
          changes: {
            prominence: adjustProminence(npc.prominence, prominenceDelta)
          }
        });
      }
    });

    // Factions: Gain prominence through membership
    const factions = graphView.findEntities({ kind: 'faction' });

    factions.forEach(faction => {
      // Only core members (>= 0.6 strength) contribute to faction prominence
      const coreMembers = graphView.getRelated(faction.id, 'member_of', 'dst', { minStrength: 0.6 });
      const memberProminence = coreMembers.reduce((sum, m) =>
        sum + getProminenceValue(m.prominence), 0
      );

      if (memberProminence > getProminenceValue(faction.prominence) * coreMembers.length) {
        modifications.push({
          id: faction.id,
          changes: {
            prominence: adjustProminence(faction.prominence, 1)
          }
        });
      }
    });

    // Locations: Gain prominence through connections and occupancy
    const locations = graphView.findEntities({ kind: 'location' });

    locations.forEach(location => {
      const relationships = graphView.getAllRelationships().filter(r =>
        r.src === location.id || r.dst === location.id
      );
      const connectionScore = relationships.length;
      const currentProminence = getProminenceValue(location.prominence);

      // Colonies and anomalies get bonus
      const typeBonus = (location.subtype === 'colony' || location.subtype === 'anomaly') ? 3 : 0;

      let prominenceDelta = 0;
      const gainThreshold = (currentProminence + 1) * 5;

      if (connectionScore + typeBonus >= gainThreshold && Math.random() < locationGainChance * modifier) {
        prominenceDelta = 1;
      } else if (connectionScore < currentProminence * 2 && Math.random() > (1 - locationDecayChance)) {
        prominenceDelta = -1;
      }

      if (prominenceDelta !== 0) {
        modifications.push({
          id: location.id,
          changes: {
            prominence: adjustProminence(location.prominence, prominenceDelta)
          }
        });
      }
    });

    // Abilities: Gain prominence through practitioners
    const abilities = graphView.findEntities({ kind: 'abilities' });

    abilities.forEach(ability => {
      const practitioners = graphView.getAllRelationships().filter(r =>
        r.kind === 'practitioner_of' && r.dst === ability.id
      );
      const currentProminence = getProminenceValue(ability.prominence);

      if (practitioners.length > (currentProminence + 1) * 3 && Math.random() < abilityGainChance * modifier) {
        modifications.push({
          id: ability.id,
          changes: {
            prominence: adjustProminence(ability.prominence, 1)
          }
        });
      } else if (practitioners.length < currentProminence && Math.random() > (1 - abilityDecayChance)) {
        modifications.push({
          id: ability.id,
          changes: {
            prominence: adjustProminence(ability.prominence, -1)
          }
        });
      }
    });

    // Rules: Gain prominence through commemorations and enactment
    const rules = graphView.findEntities({ kind: 'rules' });

    rules.forEach(rule => {
      const connections = graphView.getAllRelationships().filter(r =>
        r.src === rule.id || r.dst === rule.id
      );
      const currentProminence = getProminenceValue(rule.prominence);

      // Enacted rules are more prominent
      const statusBonus = rule.status === 'enacted' ? 3 : 0;

      if (connections.length + statusBonus > (currentProminence + 1) * 4 && Math.random() < ruleGainChance * modifier) {
        modifications.push({
          id: rule.id,
          changes: {
            prominence: adjustProminence(rule.prominence, 1)
          }
        });
      } else if (connections.length === 0 && rule.status !== 'enacted' && Math.random() > (1 - ruleDecayChance)) {
        modifications.push({
          id: rule.id,
          changes: {
            prominence: adjustProminence(rule.prominence, -1)
          }
        });
      }
    });

    return {
      relationshipsAdded: [],
      entitiesModified: modifications,
      pressureChanges: {},
      description: `Prominence shifts for ${modifications.length} entities`
    };
  }
};
