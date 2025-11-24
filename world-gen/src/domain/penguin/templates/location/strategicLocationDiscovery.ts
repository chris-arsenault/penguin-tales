/**
 * Strategic Location Discovery Template
 *
 * EMERGENT: Generates strategic locations based on actual conflict patterns.
 * Analyzes enemy relationships, war status, and conflict types to create
 * tactically relevant positions.
 */

import { GrowthTemplate, TemplateResult, ComponentPurpose } from '../../../../types/engine';
import { TemplateGraphView } from '../../../../services/templateGraphView';
import { HardState, Relationship } from '../../../../types/worldTypes';
import { pickRandom, generateName } from '../../../../utils/helpers';
import {
  analyzeConflictPatterns,
  generateStrategicTheme,
  shouldDiscoverLocation,
  findNearbyLocations
} from '../../../../utils/emergentDiscovery';

export const strategicLocationDiscovery: GrowthTemplate = {
  id: 'strategic_location_discovery',
  name: 'Strategic Location Discovery',

  contract: {
    purpose: ComponentPurpose.ENTITY_CREATION,
    enabledBy: {
      pressures: [
        { name: 'conflict', threshold: 0 }  // Any conflict triggers consideration
      ],
      entityCounts: [
        { kind: 'npc', min: 1 },      // Need scouts/heroes
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
          subtype: 'geographic_feature',
          count: { min: 1, max: 1 },
          prominence: [{ level: 'recognized', probability: 1.0 }],
        },
      ],
      relationships: [
        { kind: 'explorer_of', category: 'spatial', probability: 1.0, comment: 'Scout/hero finds strategic position' },
        { kind: 'discovered_by', category: 'spatial', probability: 1.0, comment: 'Strategic location discovered' },
        { kind: 'adjacent_to', category: 'spatial', probability: 0.8, comment: 'Adjacent to nearby location' },
      ],
    },
    effects: {
      graphDensity: 0.4,
      clusterFormation: 0.4,
      diversityImpact: 0.7,
      comment: 'Procedurally generates strategic locations based on conflict patterns',
    },
    tags: ['emergent', 'strategic', 'conflict-driven'],
  },

  canApply: (graphView: TemplateGraphView): boolean => {
    // Must have active conflicts
    const conflict = analyzeConflictPatterns(graphView.getInternalGraph());
    if (!conflict) return false;

    // Use emergent discovery probability
    return shouldDiscoverLocation(graphView.getInternalGraph());
  },

  findTargets: (graphView: TemplateGraphView): HardState[] => {
    // Find explorers, preferring heroes (military) and outlaws (scouts)
    const npcs = graphView.findEntities({}).filter(
      e => e.kind === 'npc' && e.status === 'alive'
    );

    const heroes = npcs.filter(e => e.subtype === 'hero');
    const outlaws = npcs.filter(e => e.subtype === 'outlaw');

    // Strategic discoveries are made by combatants
    if (heroes.length > 0) return heroes;
    if (outlaws.length > 0) return outlaws;
    return npcs.filter(e => e.subtype === 'mayor'); // Defensive mayors
  },

  expand: (graphView: TemplateGraphView, explorer?: HardState): TemplateResult => {
    const entities: Partial<HardState>[] = [];
    const relationships: Relationship[] = [];

    // Analyze conflict patterns
    const conflict = analyzeConflictPatterns(graphView.getInternalGraph());
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
      const npcs = graphView.findEntities({}).filter(
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
    const theme = generateStrategicTheme(conflict, graphView.currentEra.id);

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
      description: `A strategic ${formattedTheme.toLowerCase()} providing tactical advantage in the ${conflict.type} conflict`,
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

    const description = `${discoverer.name} discovered ${theme.themeString.replace(/_/g, ' ')} for ${conflict.type} advantage`;

    return {
      entities,
      relationships,
      description
    };
  }
};
