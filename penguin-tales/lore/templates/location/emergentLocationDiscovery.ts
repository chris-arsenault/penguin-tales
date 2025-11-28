/**
 * Emergent Location Discovery Template (UNIFIED)
 *
 * Combines strategic_location_discovery and mystical_location_discovery into one template.
 * Discovers different types of locations based on world state:
 * - Strategic locations (conflict-driven): vantage_point, choke_point, natural_fortification
 * - Mystical locations (magic-driven): anomaly, ley_nexus, mystical_shrine
 * - Resource locations (scarcity-driven): krill_fields, ice_quarry, thermal_vent
 *
 * Uses emergent discovery logic to generate thematically appropriate locations.
 */

import { GrowthTemplate, TemplateResult, ComponentPurpose } from '@lore-weave/core/types/engine';
import { TemplateGraphView } from '@lore-weave/core/graph/templateGraphView';
import { HardState, Relationship } from '@lore-weave/core/types/worldTypes';
import { pickRandom, findEntities } from '@lore-weave/core/utils/helpers';

export const emergentLocationDiscovery: GrowthTemplate = {
  id: 'emergent_location_discovery',
  name: 'Location Discovery',

  contract: {
    purpose: ComponentPurpose.ENTITY_CREATION,
    enabledBy: {
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
      ]
    }
  },

  metadata: {
    produces: {
      entityKinds: [
        {
          kind: 'location',
          subtype: 'geographic_feature',  // Or 'anomaly' for mystical
          count: { min: 1, max: 1 },
          prominence: [{ level: 'recognized', probability: 1.0 }],
        },
      ],
      relationships: [
        { kind: 'explorer_of', category: 'spatial', probability: 1.0, comment: 'Explorer discovers location' },
        { kind: 'discovered_by', category: 'spatial', probability: 1.0, comment: 'Location discovered' },
        { kind: 'adjacent_to', category: 'spatial', probability: 0.8, comment: 'Adjacent to nearby location' },
      ],
    },
    effects: {
      graphDensity: 0.4,
      clusterFormation: 0.4,
      diversityImpact: 0.7,
      comment: 'Procedurally generates locations based on world state (conflict, magic, scarcity)',
    },
    tags: ['emergent', 'discovery', 'adaptive'],
  },

  canApply: (graphView: TemplateGraphView): boolean => {
    // Apply if there's any significant pressure
    const conflict = graphView.getPressure('conflict') || 0;
    const magicInstability = graphView.getPressure('magical_instability') || 0;
    const resourceScarcity = graphView.getPressure('resource_scarcity') || 0;

    // Need at least one pressure above 10 OR random 5% chance
    return conflict > 10 || magicInstability > 10 || resourceScarcity > 10 || Math.random() < 0.05;
  },

  findTargets: (graphView: TemplateGraphView): HardState[] => {
    // Find explorers (heroes, outlaws, mayors, merchants)
    const npcs = graphView.findEntities({}).filter(
      e => e.kind === 'npc' && e.status === 'alive'
    );

    return npcs.filter(npc =>
      npc.subtype === 'hero' ||
      npc.subtype === 'outlaw' ||
      npc.subtype === 'mayor' ||
      npc.subtype === 'merchant'
    );
  },

  expand: (graphView: TemplateGraphView, explorer?: HardState): TemplateResult => {
    const entities: Partial<HardState>[] = [];
    const relationships: Relationship[] = [];

    // Find or select explorer
    let discoverer = explorer;
    if (!discoverer) {
      const npcs = graphView.findEntities({}).filter(
        e => e.kind === 'npc' && e.status === 'alive'
      );
      const heroes = npcs.filter(e => e.subtype === 'hero');
      const outlaws = npcs.filter(e => e.subtype === 'outlaw');
      const mayors = npcs.filter(e => e.subtype === 'mayor');
      const merchants = npcs.filter(e => e.subtype === 'merchant');

      const targets = heroes.length > 0 ? heroes :
                      outlaws.length > 0 ? outlaws :
                      merchants.length > 0 ? merchants :
                      mayors;

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

    // Determine discovery type based on pressures
    const conflict = graphView.getPressure('conflict') || 0;
    const magicInstability = graphView.getPressure('magical_instability') || 0;
    const resourceScarcity = graphView.getPressure('resource_scarcity') || 0;

    // Select dominant pressure
    const pressures = [
      { type: 'conflict', value: conflict },
      { type: 'magic', value: magicInstability },
      { type: 'resource', value: resourceScarcity }
    ];
    pressures.sort((a, b) => b.value - a.value);
    const dominantPressure = pressures[0].type;

    // Generate location based on dominant pressure
    let locationType: 'geographic_feature' | 'anomaly';
    let locationTheme: string;
    let locationTags: Record<string, boolean>;
    let description: string;

    if (dominantPressure === 'conflict') {
      // Strategic location
      locationType = 'geographic_feature';
      const themes = ['Vantage Point', 'Choke Point', 'Natural Fortification', 'Strategic Ridge'];
      locationTheme = pickRandom(themes);
      locationTags = { strategic: true, defensive: true, conflict: true };
      description = `A strategic ${locationTheme.toLowerCase()} providing tactical advantage`;
    } else if (dominantPressure === 'magic') {
      // Mystical location
      locationType = 'anomaly';
      const themes = ['Ley Nexus', 'Mystical Shrine', 'Ethereal Cavern', 'Magical Convergence'];
      locationTheme = pickRandom(themes);
      locationTags = { mystical: true, magical: true, anomaly: true };
      description = `A mystical ${locationTheme.toLowerCase()} manifesting magical energies`;
    } else {
      // Resource location
      locationType = 'geographic_feature';
      const themes = ['Krill Fields', 'Ice Quarry', 'Thermal Vent', 'Fishing Grounds'];
      locationTheme = pickRandom(themes);
      locationTags = { resource: true, valuable: true, economic: true };
      description = `Rich ${locationTheme.toLowerCase()} providing essential resources`;
    }

    // Derive coordinates - reference the discoverer and any nearby locations
    const nearbyLocations = findNearbyLocations(discoverer, graphView);
    const referenceEntities: HardState[] = [discoverer];
    if (nearbyLocations.length > 0) {
      referenceEntities.push(nearbyLocations[0]);  // Use first nearby location as reference
    }

    const conceptualCoords = graphView.deriveCoordinates(
      referenceEntities,
      'location',
      'physical',
      { maxDistance: 0.4, minDistance: 0.1 }
    );

    if (!conceptualCoords) {
      throw new Error(
        `emergent_location_discovery: Failed to derive coordinates for ${locationTheme} discovered by ${discoverer.name}. ` +
        `This indicates the coordinate system is not properly configured for 'location' entities.`
      );
    }

    const newLocation: Partial<HardState> = {
      kind: 'location',
      subtype: locationType,
      description: description,
      status: 'unspoiled',
      prominence: 'recognized',
      culture: discoverer.culture,  // Inherit culture from discoverer
      tags: locationTags,
      coordinates: conceptualCoords,
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

    // Make adjacent to nearby locations (reuse nearbyLocations from coordinate derivation)
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

    const discoveryDescription = `${discoverer.name} discovered a new ${locationTheme.toLowerCase()} driven by ${dominantPressure} pressure`;

    return {
      entities,
      relationships,
      description: discoveryDescription
    };
  }
};

/**
 * Helper: Find nearby locations for adjacency
 */
function findNearbyLocations(npc: HardState, graphView: TemplateGraphView): HardState[] {
  // Find NPC's residence
  const residences = npc.links.filter(l => l.kind === 'resident_of');
  if (residences.length === 0) {
    // No residence, return any location
    return graphView.findEntities({ kind: 'location' });
  }

  const residence = graphView.getEntity(residences[0].dst);
  if (!residence) {
    return graphView.findEntities({ kind: 'location' });
  }

  // Find locations adjacent to residence
  const adjacentLocations = residence.links
    .filter(l => l.kind === 'adjacent_to')
    .map(l => graphView.getEntity(l.dst))
    .filter((loc): loc is HardState => !!loc);

  if (adjacentLocations.length > 0) {
    return adjacentLocations;
  }

  // Fall back to any location
  return graphView.findEntities({ kind: 'location' });
}
