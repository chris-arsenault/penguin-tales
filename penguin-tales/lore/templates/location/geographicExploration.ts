/**
 * Geographic Exploration Template
 *
 * EMERGENT: Generates neutral geographic features from pure exploration.
 * Creates general-purpose locations when no specific pressure drives discovery.
 */

import { GrowthTemplate, TemplateResult, ComponentPurpose } from '@lore-weave/core/types/engine';
import { TemplateGraphView } from '@lore-weave/core/services/templateGraphView';
import { HardState, Relationship } from '@lore-weave/core/types/worldTypes';
import { pickRandom, generateName } from '@lore-weave/core/utils/helpers';
import {
  generateExplorationTheme,
  shouldDiscoverLocation,
  findNearbyLocations
} from '@lore-weave/core/utils/emergentDiscovery';

export const geographicExploration: GrowthTemplate = {
  id: 'geographic_exploration',
  name: 'Geographic Exploration',

  contract: {
    purpose: ComponentPurpose.ENTITY_CREATION,
    enabledBy: {
      era: ['expansion', 'reconstruction', 'innovation'],
      entityCounts: [
        { kind: 'npc', min: 1 },      // Need explorers
        { kind: 'location', min: 1 }  // Need locations to be adjacent to
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
      ]
    }
  },

  metadata: {
    produces: {
      entityKinds: [
        {
          kind: 'location',
          subtype: 'various',
          count: { min: 1, max: 1 },
          prominence: [{ level: 'marginal', probability: 1.0 }],
        },
      ],
      relationships: [
        { kind: 'explorer_of', category: 'spatial', probability: 1.0, comment: 'NPC explores location' },
        { kind: 'discovered_by', category: 'spatial', probability: 1.0, comment: 'Location discovered by NPC' },
        { kind: 'adjacent_to', category: 'spatial', probability: 0.8, comment: 'Adjacent to nearby location' },
      ],
    },
    effects: {
      graphDensity: 0.4,
      clusterFormation: 0.3,
      diversityImpact: 0.7,
      comment: 'Procedurally generates neutral locations based on era themes',
    },
    parameters: {
      baseChance: {
        value: 0.08,
        min: 0.01,
        max: 0.3,
        description: 'Base probability of discovery when other conditions met',
      },
    },
    tags: ['emergent', 'exploration', 'era-driven'],
  },

  canApply: (graphView: TemplateGraphView): boolean => {
    // Can apply during expansion and reconstruction eras
    if (!['expansion', 'reconstruction', 'innovation'].includes(graphView.currentEra.id)) {
      return false;
    }

    // Use emergent discovery probability (but lower threshold)
    const locationCount = graphView.findEntities({}).filter(
      e => e.kind === 'location'
    ).length;

    if (locationCount >= 35) return false;

    const ticksSince = graphView.tick - graphView.discoveryState.lastDiscoveryTick;
    if (ticksSince < 8) return false; // Slower than pressure-driven

    if (graphView.discoveryState.discoveriesThisEpoch >= 2) return false;

    // Lower base probability - pure exploration is rarer
    const params = geographicExploration.metadata?.parameters || {};
    const baseChance = params.baseChance?.value ?? 0.08;
    return Math.random() < baseChance;
  },

  findTargets: (graphView: TemplateGraphView): HardState[] => {
    // Any living NPC can explore
    const npcs = graphView.findEntities({}).filter(
      e => e.kind === 'npc' && e.status === 'alive'
    );

    // Prefer heroes and merchants
    const heroes = npcs.filter(e => e.subtype === 'hero');
    const merchants = npcs.filter(e => e.subtype === 'merchant');

    if (heroes.length > 0) return heroes;
    if (merchants.length > 0) return merchants;
    return npcs;
  },

  expand: (graphView: TemplateGraphView, explorer?: HardState): TemplateResult => {
    const entities: Partial<HardState>[] = [];
    const relationships: Relationship[] = [];

    // Find explorer
    let discoverer = explorer;
    if (!discoverer) {
      const npcs = graphView.findEntities({}).filter(
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
    const theme = generateExplorationTheme(graphView.getInternalGraph());
    if (!theme) {
      return {
        entities: [],
        relationships: [],
        description: 'No exploration theme available'
      };
    }

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
      description: `A newly discovered ${formattedTheme.toLowerCase()} during the ${graphView.currentEra.name}`,
      status: 'unspoiled',
      prominence: 'marginal',
      culture: discoverer.culture,  // Inherit culture from discoverer
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

    const description = `${discoverer.name} discovered ${theme.themeString.replace(/_/g, ' ')} while exploring`;

    return {
      entities,
      relationships,
      description
    };
  }
};
