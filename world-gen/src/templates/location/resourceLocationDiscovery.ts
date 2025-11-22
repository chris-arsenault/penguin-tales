/**
 * Resource Location Discovery Template
 *
 * EMERGENT: Generates resource locations based on actual world needs.
 * Analyzes colony status, population, and scarcity to procedurally create
 * appropriate resource sites.
 */

import { GrowthTemplate, TemplateResult, Graph } from '../../types/engine';
import { HardState, Relationship } from '../../types/worldTypes';
import { pickRandom, generateName } from '../../utils/helpers';
import {
  analyzeResourceDeficit,
  generateResourceTheme,
  shouldDiscoverLocation,
  findNearbyLocations
} from '../../utils/emergentDiscovery';

export const resourceLocationDiscovery: GrowthTemplate = {
  id: 'resource_location_discovery',
  name: 'Resource Location Discovery',

  canApply: (graph: Graph): boolean => {
    // Must have resource deficit
    const deficit = analyzeResourceDeficit(graph);
    if (!deficit) return false;

    // Use emergent discovery probability
    return shouldDiscoverLocation(graph);
  },

  findTargets: (graph: Graph): HardState[] => {
    // Find explorers who could make the discovery
    const npcs = Array.from(graph.entities.values()).filter(
      e => e.kind === 'npc' && e.status === 'alive'
    );

    // Prefer heroes and outlaws for exploration
    const heroes = npcs.filter(e => e.subtype === 'hero');
    const outlaws = npcs.filter(e => e.subtype === 'outlaw');
    const merchants = npcs.filter(e => e.subtype === 'merchant');

    if (heroes.length > 0) return heroes;
    if (outlaws.length > 0) return outlaws;
    return merchants;
  },

  expand: (graph: Graph, explorer?: HardState): TemplateResult => {
    const entities: Partial<HardState>[] = [];
    const relationships: Relationship[] = [];

    // Analyze what the world needs
    const deficit = analyzeResourceDeficit(graph);
    if (!deficit) {
      return {
        entities: [],
        relationships: [],
        description: 'No resource deficit detected'
      };
    }

    // Find explorer
    let discoverer = explorer;
    if (!discoverer) {
      const npcs = Array.from(graph.entities.values()).filter(
        e => e.kind === 'npc' && e.status === 'alive'
      );
      const heroes = npcs.filter(e => e.subtype === 'hero');
      const outlaws = npcs.filter(e => e.subtype === 'outlaw');
      const merchants = npcs.filter(e => e.subtype === 'merchant');

      const targets = heroes.length > 0 ? heroes :
                      outlaws.length > 0 ? outlaws :
                      merchants;

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

    // PROCEDURALLY GENERATE theme based on world state
    const theme = generateResourceTheme(deficit, graph.currentEra.id);

    // Generate penguin-style name with themeString as descriptor
    const locationName = generateName('location');
    const formattedTheme = theme.themeString.split('_').map(w =>
      w.charAt(0).toUpperCase() + w.slice(1)
    ).join(' ');

    // Create the discovered location
    const newLocation: Partial<HardState> = {
      kind: 'location',
      subtype: theme.subtype,
      name: `${locationName} ${formattedTheme}`,
      description: `A resource-rich ${formattedTheme.toLowerCase()} discovered to address ${deficit.specific} scarcity`,
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

    const description = `${discoverer.name} discovered ${theme.themeString.replace(/_/g, ' ')} to address ${deficit.primary} scarcity`;

    return {
      entities,
      relationships,
      description
    };
  }
};
