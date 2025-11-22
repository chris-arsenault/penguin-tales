import { SimulationSystem, SystemResult, Graph } from '../types/engine';
import { HardState } from '../types/worldTypes';
import {
  findEntities,
  getFactionMembers,
  getProminenceValue,
  adjustProminence
} from '../utils/helpers';

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

  apply: (graph: Graph, modifier: number = 1.0): SystemResult => {
    const modifications: Array<{ id: string; changes: Partial<HardState> }> = [];

    // NPCs: Harsher prominence requirements - most should be forgotten/marginal
    const npcs = findEntities(graph, { kind: 'npc' });

    npcs.forEach(npc => {
      const relationships = graph.relationships.filter(r =>
        r.src === npc.id || r.dst === npc.id
      );

      const connectionScore = relationships.length;
      const currentProminence = getProminenceValue(npc.prominence);

      // Only heroes and mayors get a small bonus (reduced from +1 to +0.5 effective)
      const roleBonus = (npc.subtype === 'hero' || npc.subtype === 'mayor') ? 2 : 0;

      // Much harsher thresholds for prominence gain
      // forgotten (0) -> marginal (1): needs 6+ connections
      // marginal (1) -> recognized (2): needs 12+ connections
      // recognized (2) -> renowned (3): needs 20+ connections
      // renowned (3) -> mythic (4): needs 30+ connections
      let prominenceDelta = 0;
      const gainThreshold = (currentProminence + 1) * 6;

      if (connectionScore + roleBonus >= gainThreshold) {
        // Only 30% chance to gain even with enough connections
        if (Math.random() < 0.3 * modifier) {
          prominenceDelta = 1;
        }
      } else if (connectionScore < currentProminence * 2) {
        // Much more likely to decay (70% chance)
        if (Math.random() > 0.3) {
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
    const factions = findEntities(graph, { kind: 'faction' });

    factions.forEach(faction => {
      const members = getFactionMembers(graph, faction.id);
      const memberProminence = members.reduce((sum, m) =>
        sum + getProminenceValue(m.prominence), 0
      );

      if (memberProminence > getProminenceValue(faction.prominence) * members.length) {
        modifications.push({
          id: faction.id,
          changes: {
            prominence: adjustProminence(faction.prominence, 1)
          }
        });
      }
    });

    // Locations: Gain prominence through connections and occupancy
    const locations = findEntities(graph, { kind: 'location' });

    locations.forEach(location => {
      const relationships = graph.relationships.filter(r =>
        r.src === location.id || r.dst === location.id
      );
      const connectionScore = relationships.length;
      const currentProminence = getProminenceValue(location.prominence);

      // Colonies and anomalies get bonus
      const typeBonus = (location.subtype === 'colony' || location.subtype === 'anomaly') ? 3 : 0;

      let prominenceDelta = 0;
      const gainThreshold = (currentProminence + 1) * 5;

      if (connectionScore + typeBonus >= gainThreshold && Math.random() < 0.4 * modifier) {
        prominenceDelta = 1;
      } else if (connectionScore < currentProminence * 2 && Math.random() > 0.5) {
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
    const abilities = findEntities(graph, { kind: 'abilities' });

    abilities.forEach(ability => {
      const practitioners = graph.relationships.filter(r =>
        r.kind === 'practitioner_of' && r.dst === ability.id
      );
      const currentProminence = getProminenceValue(ability.prominence);

      if (practitioners.length > (currentProminence + 1) * 3 && Math.random() < 0.35 * modifier) {
        modifications.push({
          id: ability.id,
          changes: {
            prominence: adjustProminence(ability.prominence, 1)
          }
        });
      } else if (practitioners.length < currentProminence && Math.random() > 0.6) {
        modifications.push({
          id: ability.id,
          changes: {
            prominence: adjustProminence(ability.prominence, -1)
          }
        });
      }
    });

    // Rules: Gain prominence through commemorations and enactment
    const rules = findEntities(graph, { kind: 'rules' });

    rules.forEach(rule => {
      const connections = graph.relationships.filter(r =>
        r.src === rule.id || r.dst === rule.id
      );
      const currentProminence = getProminenceValue(rule.prominence);

      // Enacted rules are more prominent
      const statusBonus = rule.status === 'enacted' ? 3 : 0;

      if (connections.length + statusBonus > (currentProminence + 1) * 4 && Math.random() < 0.3 * modifier) {
        modifications.push({
          id: rule.id,
          changes: {
            prominence: adjustProminence(rule.prominence, 1)
          }
        });
      } else if (connections.length === 0 && rule.status !== 'enacted' && Math.random() > 0.5) {
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
