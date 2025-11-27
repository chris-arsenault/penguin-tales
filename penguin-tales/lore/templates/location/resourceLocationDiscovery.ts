/**
 * Resource Location Discovery Template
 *
 * EMERGENT: Generates resource locations based on actual world needs.
 * Analyzes colony status, population, and scarcity to procedurally create
 * appropriate resource sites.
 */

import { GrowthTemplate, TemplateResult, ComponentPurpose } from '@lore-weave/core/types/engine';
import { TemplateGraphView } from '@lore-weave/core/services/templateGraphView';
import { HardState, Relationship } from '@lore-weave/core/types/worldTypes';
import { pickRandom } from '@lore-weave/core/utils/helpers';
import {
  analyzeResourceDeficit,
  generateResourceTheme,
  shouldDiscoverLocation,
  findNearbyLocations
} from '@lore-weave/core/utils/emergentDiscovery';

export const resourceLocationDiscovery: GrowthTemplate = {
  id: 'resource_location_discovery',
  name: 'Resource Location Discovery',

  contract: {
    purpose: ComponentPurpose.ENTITY_CREATION,
    enabledBy: {
      pressures: [
        { name: 'resource_scarcity', threshold: 0 }  // Any scarcity triggers consideration
      ],
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
        { kind: 'adjacent_to', operation: 'create', count: { min: 0, max: 4 } }  // FIXED: Bidirectional (0-2 pairs = 0-4 relationships)
      ],
      pressures: [
        { name: 'resource_scarcity', delta: -5 }  // Discovery reduces scarcity
      ]
    }
  },

  metadata: {
    produces: {
      entityKinds: [
        {
          kind: 'location',
          subtype: 'geographic_feature',
          count: { min: 1, max: 1 },
          prominence: [{ level: 'marginal', probability: 1.0 }],
        },
      ],
      relationships: [
        { kind: 'explorer_of', category: 'spatial', probability: 1.0, comment: 'Explorer finds resource' },
        { kind: 'discovered_by', category: 'spatial', probability: 1.0, comment: 'Resource discovered' },
        { kind: 'adjacent_to', category: 'spatial', probability: 0.8, comment: 'Adjacent to nearby location' },
      ],
    },
    effects: {
      graphDensity: 0.4,
      clusterFormation: 0.3,
      diversityImpact: 0.6,
      comment: 'Procedurally generates resource locations based on scarcity',
    },
    tags: ['emergent', 'resource', 'scarcity-driven'],
  },

  canApply: (graphView: TemplateGraphView): boolean => {
    // Must have resource deficit
    const deficit = analyzeResourceDeficit(graphView.getInternalGraph());
    if (!deficit) return false;

    // Use emergent discovery probability
    return shouldDiscoverLocation(graphView.getInternalGraph());
  },

  findTargets: (graphView: TemplateGraphView): HardState[] => {
    // Find explorers who could make the discovery
    const npcs = graphView.findEntities({}).filter(
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

  expand: (graphView: TemplateGraphView, explorer?: HardState): TemplateResult => {
    const entities: Partial<HardState>[] = [];
    const relationships: Relationship[] = [];

    // Analyze what the world needs
    const deficit = analyzeResourceDeficit(graphView.getInternalGraph());
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
      const npcs = graphView.findEntities({}).filter(
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
    const discoveryConfig = graphView.config?.domain?.emergentDiscoveryConfig;
    if (!discoveryConfig) {
      return {
        entities: [],
        relationships: [],
        description: 'No emergent discovery config available'
      };
    }
    const theme = generateResourceTheme(deficit, graphView.currentEra.id, discoveryConfig);

    // Format theme for description
    const formattedTheme = theme.themeString.split('_').map(w =>
      w.charAt(0).toUpperCase() + w.slice(1)
    ).join(' ');

    // Convert theme tags array to KVP
    const themeTags = Array.isArray(theme.tags)
      ? theme.tags.reduce((acc, tag) => ({ ...acc, [tag]: true }), {} as Record<string, boolean>)
      : theme.tags;

    // Create the discovered location (name will be generated by addEntity)
    const newLocation: Partial<HardState> = {
      kind: 'location',
      subtype: theme.subtype,
      description: `A resource-rich ${formattedTheme.toLowerCase()} discovered to address ${deficit.specific} scarcity`,
      status: 'unspoiled',
      prominence: 'marginal',
      culture: discoverer.culture,  // Inherit culture from discoverer
      tags: themeTags,
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

    const description = `${discoverer.name} discovered ${theme.themeString.replace(/_/g, ' ')} to address ${deficit.primary} scarcity`;

    return {
      entities,
      relationships,
      description
    };
  }
};
