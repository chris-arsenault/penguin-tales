/**
 * Geographic Exploration Template
 *
 * EMERGENT: Generates neutral geographic features from pure exploration.
 * Creates general-purpose locations when no specific pressure drives discovery.
 */

import { GrowthTemplate, TemplateResult, Graph } from '../../types/engine';
import { HardState, Relationship } from '../../types/worldTypes';
import { pickRandom } from '../../utils/helpers';
import {
  generateExplorationTheme,
  shouldDiscoverLocation,
  findNearbyLocations
} from '../../utils/emergentDiscovery';

export const geographicExploration: GrowthTemplate = {
  id: 'geographic_exploration',
  name: 'Geographic Exploration',

  canApply: (graph: Graph): boolean => {
    // Can apply during expansion and reconstruction eras
    if (!['expansion', 'reconstruction', 'innovation'].includes(graph.currentEra.id)) {
      return false;
    }

    // Use emergent discovery probability (but lower threshold)
    const locationCount = Array.from(graph.entities.values()).filter(
      e => e.kind === 'location'
    ).length;

    if (locationCount >= 35) return false;

    const ticksSince = graph.tick - graph.discoveryState.lastDiscoveryTick;
    if (ticksSince < 8) return false; // Slower than pressure-driven

    if (graph.discoveryState.discoveriesThisEpoch >= 2) return false;

    // Lower base probability - pure exploration is rarer
    const baseChance = 0.08;
    return Math.random() < baseChance;
  },

  findTargets: (graph: Graph): HardState[] => {
    // Any living NPC can explore
    const npcs = Array.from(graph.entities.values()).filter(
      e => e.kind === 'npc' && e.status === 'alive'
    );

    // Prefer heroes and merchants
    const heroes = npcs.filter(e => e.subtype === 'hero');
    const merchants = npcs.filter(e => e.subtype === 'merchant');

    if (heroes.length > 0) return heroes;
    if (merchants.length > 0) return merchants;
    return npcs;
  },

  expand: (graph: Graph, explorer?: HardState): TemplateResult => {
    const entities: Partial<HardState>[] = [];
    const relationships: Relationship[] = [];

    // Find explorer
    let discoverer = explorer;
    if (!discoverer) {
      const npcs = Array.from(graph.entities.values()).filter(
        e => e.kind === 'npc' && e.status === 'alive'
      );
      const heroes = npcs.filter(e => e.subtype === 'hero');
      const merchants = npcs.filter(e => e.subtype === 'merchant');

      const targets = heroes.length > 0 ? heroes :
                      merchants.length > 0 ? merchants :
                      npcs;

      if (targets.length > 0) {
        discoverer = pickRandom(targets);
      }
    }
    if (!discoverer) {
      return {
        entities: [],
        relationships: [],
        description: 'No eligible explorer found'
      };
    }

    // PROCEDURALLY GENERATE neutral theme based on era
    const theme = generateExplorationTheme(graph);

    // Create the discovered location
    const newLocation: Partial<HardState> = {
      kind: 'location',
      subtype: theme.subtype,
      name: `PLACEHOLDER_${theme.themeString}`,
      description: `PLACEHOLDER_exploration_${graph.currentEra.id}`,
      status: 'unspoiled',
      prominence: 'marginal',
      tags: theme.tags,
      links: []
    };

    entities.push(newLocation);

    // Create discovery relationships
    relationships.push({
      kind: 'explorer_of',
      src: discoverer.id,
      dst: 'will-be-assigned-0'
    });

    relationships.push({
      kind: 'discovered_by',
      src: 'will-be-assigned-0',
      dst: discoverer.id
    });

    // Make adjacent to nearby locations
    const nearbyLocations = findNearbyLocations(discoverer, graph);
    if (nearbyLocations.length > 0) {
      const adjacentTo = pickRandom(nearbyLocations);
      relationships.push({
        kind: 'adjacent_to',
        src: 'will-be-assigned-0',
        dst: adjacentTo.id
      });
      relationships.push({
        kind: 'adjacent_to',
        src: adjacentTo.id,
        dst: 'will-be-assigned-0'
      });
    }

    // Update discovery state
    graph.discoveryState.lastDiscoveryTick = graph.tick;
    graph.discoveryState.discoveriesThisEpoch += 1;

    const description = `${discoverer.name} discovered ${theme.themeString.replace(/_/g, ' ')} while exploring`;

    return {
      entities,
      relationships,
      description
    };
  }
};
