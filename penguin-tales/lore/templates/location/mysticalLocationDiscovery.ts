/**
 * Mystical Location Discovery Template
 *
 * EMERGENT: Generates anomaly locations based on magical instability.
 * Analyzes existing magic, anomaly count, and era to create thematically
 * appropriate mystical phenomena.
 */

import { GrowthTemplate, TemplateResult, ComponentPurpose } from '@lore-weave/core/types/engine';
import { TemplateGraphView } from '@lore-weave/core/graph/templateGraphView';
import { HardState, Relationship } from '@lore-weave/core/types/worldTypes';
import { pickRandom } from '@lore-weave/core/utils/helpers';
import {
  analyzeMagicPresence,
  generateMysticalTheme,
  shouldDiscoverLocation,
  findNearbyLocations
} from '../../utils/emergentDiscovery';

export const mysticalLocationDiscovery: GrowthTemplate = {
  id: 'mystical_location_discovery',
  name: 'Mystical Location Discovery',

  contract: {
    purpose: ComponentPurpose.ENTITY_CREATION,
    enabledBy: {
      pressures: [
        { name: 'magical_instability', threshold: 0 }  // Any instability triggers consideration
      ],
      entityCounts: [
        { kind: 'npc', min: 1 },       // Need magic users/explorers
        { kind: 'location', min: 1 },  // Need locations to be adjacent to
        { kind: 'abilities', min: 1 }  // Need magic system to exist
      ]
    },
    affects: {
      entities: [
        { kind: 'location', operation: 'create', count: { min: 1, max: 1 } }
      ],
      relationships: [
        { kind: 'explorer_of', operation: 'create', count: { min: 1, max: 1 } },
        { kind: 'discovered_by', operation: 'create', count: { min: 1, max: 1 } },
        { kind: 'adjacent_to', operation: 'create', count: { min: 0, max: 2 } }
      ],
      pressures: [
        { name: 'magical_instability', delta: 2 }  // Discovery amplifies instability
      ]
    }
  },

  metadata: {
    produces: {
      entityKinds: [
        {
          kind: 'location',
          subtype: 'anomaly',
          count: { min: 1, max: 1 },
          prominence: [{ level: 'recognized', probability: 1.0 }],
        },
      ],
      relationships: [
        { kind: 'explorer_of', category: 'spatial', probability: 1.0, comment: 'Magic user explores anomaly' },
        { kind: 'discovered_by', category: 'spatial', probability: 1.0, comment: 'Anomaly discovered by magic user' },
        { kind: 'adjacent_to', category: 'spatial', probability: 0.8, comment: 'Adjacent to nearby location' },
      ],
    },
    effects: {
      graphDensity: 0.4,
      clusterFormation: 0.5,
      diversityImpact: 0.8,
      comment: 'Procedurally generates mystical locations based on magical state',
    },
    tags: ['emergent', 'mystical', 'magic-driven'],
  },

  canApply: (graphView: TemplateGraphView): boolean => {
    // Must have magical instability
    const magic = analyzeMagicPresence(graphView.getInternalGraph());
    if (!magic) return false;

    // Use emergent discovery probability
    return shouldDiscoverLocation(graphView.getInternalGraph());
  },

  findTargets: (graphView: TemplateGraphView): HardState[] => {
    // Find explorers, preferring those with magic connections
    const npcs = graphView.findEntities({}).filter(
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

  expand: (graphView: TemplateGraphView, explorer?: HardState): TemplateResult => {
    const entities: Partial<HardState>[] = [];
    const relationships: Relationship[] = [];

    // Analyze magical patterns
    const magic = analyzeMagicPresence(graphView.getInternalGraph());
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
      const npcs = graphView.findEntities({}).filter(
        e => e.kind === 'npc' && e.status === 'alive'
      );

      // Prefer those connected to magic/abilities
      const magical = npcs.filter(npc => {
        return graphView.getAllRelationships().some(r =>
          (r.src === npc.id || r.dst === npc.id) &&
          graphView.getEntity(r.src === npc.id ? r.dst : r.src)?.kind === 'abilities'
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
    const theme = generateMysticalTheme(magic, graphView.currentEra.id);

    const formattedTheme = theme.themeString.split('_').map(w =>
      w.charAt(0).toUpperCase() + w.slice(1)
    ).join(' ');

    // Convert theme tags array to KVP
    const themeTags = Array.isArray(theme.tags)
      ? theme.tags.reduce((acc, tag) => ({ ...acc, [tag]: true }), {} as Record<string, boolean>)
      : theme.tags;

    // Derive coordinates for new location - place near discoverer's location
    const locationCoords = graphView.deriveCoordinates(
      [discoverer],
      'location',
      undefined,
      { maxDistance: 20 }  // Larger distance - discoveries are further away
    );

    // Create the discovered location
    const newLocation: Partial<HardState> = {
      kind: 'location',
      subtype: theme.subtype,  // 'anomaly'
      description: `A mystical ${formattedTheme.toLowerCase()} manifesting ${magic.manifestationType} energies`,
      status: 'unspoiled',
      prominence: 'recognized',  // Mystical places are notable
      culture: discoverer.culture,  // Inherit culture from discoverer
      tags: themeTags,
      coordinates: locationCoords,
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
    const nearbyLocations = findNearbyLocations(discoverer, graphView.getInternalGraph());
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
    graphView.discoveryState.lastDiscoveryTick = graphView.tick;
    graphView.discoveryState.discoveriesThisEpoch += 1;

    const description = `${discoverer.name} discovered ${theme.themeString.replace(/_/g, ' ')} manifestation`;

    return {
      entities,
      relationships,
      description
    };
  }
};
