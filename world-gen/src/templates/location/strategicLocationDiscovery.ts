/**
 * Strategic Location Discovery Template
 *
 * EMERGENT: Generates strategic locations based on actual conflict patterns.
 * Analyzes enemy relationships, war status, and conflict types to create
 * tactically relevant positions.
 */

import { GrowthTemplate, TemplateResult, Graph } from '../../types/engine';
import { HardState, Relationship } from '../../types/worldTypes';
import { pickRandom } from '../../utils/helpers';
import {
  analyzeConflictPatterns,
  generateStrategicTheme,
  shouldDiscoverLocation,
  findNearbyLocations
} from '../../utils/emergentDiscovery';

export const strategicLocationDiscovery: GrowthTemplate = {
  id: 'strategic_location_discovery',
  name: 'Strategic Location Discovery',

  canApply: (graph: Graph): boolean => {
    // Must have active conflicts
    const conflict = analyzeConflictPatterns(graph);
    if (!conflict) return false;

    // Use emergent discovery probability
    return shouldDiscoverLocation(graph);
  },

  findTargets: (graph: Graph): HardState[] => {
    // Find explorers, preferring heroes (military) and outlaws (scouts)
    const npcs = Array.from(graph.entities.values()).filter(
      e => e.kind === 'npc' && e.status === 'alive'
    );

    const heroes = npcs.filter(e => e.subtype === 'hero');
    const outlaws = npcs.filter(e => e.subtype === 'outlaw');

    // Strategic discoveries are made by combatants
    if (heroes.length > 0) return heroes;
    if (outlaws.length > 0) return outlaws;
    return npcs.filter(e => e.subtype === 'mayor'); // Defensive mayors
  },

  expand: (graph: Graph, explorer?: HardState): TemplateResult => {
    const entities: Partial<HardState>[] = [];
    const relationships: Relationship[] = [];

    // Analyze conflict patterns
    const conflict = analyzeConflictPatterns(graph);
    if (!conflict) {
      return {
        entities: [],
        relationships: [],
        description: 'No active conflicts detected'
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
      const mayors = npcs.filter(e => e.subtype === 'mayor');

      const targets = heroes.length > 0 ? heroes :
                      outlaws.length > 0 ? outlaws :
                      mayors;

      if (targets.length > 0) {
        discoverer = pickRandom(targets);
      }
    }
    if (!discoverer) {
      return {
        entities: [],
        relationships: [],
        description: 'No eligible scout found'
      };
    }

    // PROCEDURALLY GENERATE theme based on conflict state
    const theme = generateStrategicTheme(conflict, graph.currentEra.id);

    // Create the discovered location
    const newLocation: Partial<HardState> = {
      kind: 'location',
      subtype: theme.subtype,
      name: `PLACEHOLDER_${theme.themeString}`,
      description: `PLACEHOLDER_strategic_${conflict.type}`,
      status: 'unspoiled',
      prominence: 'recognized',  // Strategic locations are notable
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

    const description = `${discoverer.name} discovered ${theme.themeString.replace(/_/g, ' ')} for ${conflict.type} advantage`;

    return {
      entities,
      relationships,
      description
    };
  }
};
