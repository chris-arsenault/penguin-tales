/**
 * Mystical Location Discovery Template
 *
 * EMERGENT: Generates anomaly locations based on magical instability.
 * Analyzes existing magic, anomaly count, and era to create thematically
 * appropriate mystical phenomena.
 */

import { GrowthTemplate, TemplateResult, Graph } from '../../types/engine';
import { HardState, Relationship } from '../../types/worldTypes';
import { pickRandom } from '../../utils/helpers';
import {
  analyzeMagicPresence,
  generateMysticalTheme,
  shouldDiscoverLocation,
  findNearbyLocations
} from '../../utils/emergentDiscovery';

export const mysticalLocationDiscovery: GrowthTemplate = {
  id: 'mystical_location_discovery',
  name: 'Mystical Location Discovery',

  canApply: (graph: Graph): boolean => {
    // Must have magical instability
    const magic = analyzeMagicPresence(graph);
    if (!magic) return false;

    // Use emergent discovery probability
    return shouldDiscoverLocation(graph);
  },

  findTargets: (graph: Graph): HardState[] => {
    // Find explorers, preferring those with magic connections
    const npcs = Array.from(graph.entities.values()).filter(
      e => e.kind === 'npc' && e.status === 'alive'
    );

    // Find NPCs with magic relationships
    const magicUsers = npcs.filter(npc =>
      npc.links.some(r => r.kind === 'practitioner_of' || r.kind === 'discoverer_of')
    );

    if (magicUsers.length > 0) return magicUsers;

    // Otherwise heroes are most likely
    const heroes = npcs.filter(e => e.subtype === 'hero');
    if (heroes.length > 0) return heroes;

    return npcs;
  },

  expand: (graph: Graph, explorer?: HardState): TemplateResult => {
    const entities: Partial<HardState>[] = [];
    const relationships: Relationship[] = [];

    // Analyze magical patterns
    const magic = analyzeMagicPresence(graph);
    if (!magic) {
      return {
        entities: [],
        relationships: [],
        description: 'No magical instability detected'
      };
    }

    // Find explorer
    let discoverer = explorer;
    if (!discoverer) {
      const npcs = Array.from(graph.entities.values()).filter(
        e => e.kind === 'npc' && e.status === 'alive'
      );

      // Prefer those connected to magic/abilities
      const magical = npcs.filter(npc => {
        return graph.relationships.some(r =>
          (r.src === npc.id || r.dst === npc.id) &&
          graph.entities.get(r.src === npc.id ? r.dst : r.src)?.kind === 'abilities'
        );
      });

      const targets = magical.length > 0 ? magical : npcs;

      if (targets.length > 0) {
        discoverer = pickRandom(targets);
      }
    }
    if (!discoverer) {
      return {
        entities: [],
        relationships: [],
        description: 'No eligible seeker found'
      };
    }

    // PROCEDURALLY GENERATE theme based on magical state
    const theme = generateMysticalTheme(magic, graph.currentEra.id);

    // Create the discovered location
    const newLocation: Partial<HardState> = {
      kind: 'location',
      subtype: theme.subtype,  // 'anomaly'
      name: `PLACEHOLDER_${theme.themeString}`,
      description: `PLACEHOLDER_mystical_${magic.manifestationType}`,
      status: 'unspoiled',
      prominence: 'recognized',  // Mystical places are notable
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

    const description = `${discoverer.name} discovered ${theme.themeString.replace(/_/g, ' ')} manifestation`;

    return {
      entities,
      relationships,
      description
    };
  }
};
