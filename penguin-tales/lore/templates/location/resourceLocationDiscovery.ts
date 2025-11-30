/**
 * Resource Location Discovery Template
 *
 * Strategy-based template for emergent resource location generation.
 *
 * Pipeline:
 *   1. Applicability: pressure_analysis(scarcity) AND discovery_probability
 *   2. Selection: by_preference_order(npc: hero > outlaw > merchant)
 *   3. Creation: procedural_theme(deficit) with near_reference placement
 *   4. Relationships: discovery(explorer_of, discovered_by), bidirectional(adjacent_to)
 *   5. State: update_discovery_state
 */

import { GrowthTemplate, TemplateResult, ComponentPurpose } from '@lore-weave/core';
import { TemplateGraphView } from '@lore-weave/core';
import { HardState, Relationship } from '@lore-weave/core';
import { pickRandom } from '@lore-weave/core';
import {
  analyzeResourceDeficit,
  generateResourceTheme,
  shouldDiscoverLocation,
  findNearbyLocations
} from '../../utils/emergentDiscovery';

import {
  // Step 2: Selection
  selectByPreferenceOrder,
  pickByPreferenceOrder,
  // Step 3: Creation
  deriveCoordinatesNearReference,
  createEntityPartial,
  findNearbyLocationsForAdjacency,
  // Step 4: Relationships
  createRelationship,
  createBidirectionalRelationship,
  // Step 5: State
  updateDiscoveryState,
  // Result helpers
  emptyResult,
  templateResult
} from '../../utils/strategyExecutors';

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

  // =========================================================================
  // STEP 1: APPLICABILITY - pressure_analysis AND discovery_probability
  // =========================================================================
  canApply: (graphView: TemplateGraphView): boolean => {
    // Strategy: pressure_analysis(scarcity)
    const deficit = analyzeResourceDeficit(graphView);
    if (!deficit) return false;

    // Strategy: discovery_probability
    return shouldDiscoverLocation(graphView);
  },

  // =========================================================================
  // STEP 2: SELECTION - by_preference_order for explorers
  // =========================================================================
  findTargets: (graphView: TemplateGraphView): HardState[] => {
    // Strategy: by_preference_order(hero > outlaw > merchant)
    return selectByPreferenceOrder(graphView, 'npc', ['hero', 'outlaw', 'merchant'], 'alive');
  },

  // =========================================================================
  // STEPS 3-5: CREATION, RELATIONSHIPS, STATE
  // =========================================================================
  expand: (graphView: TemplateGraphView, explorer?: HardState): TemplateResult => {
    // Strategy: pressure_analysis(scarcity)
    const deficit = analyzeResourceDeficit(graphView);
    if (!deficit) {
      return emptyResult('No resource deficit detected');
    }

    // Strategy: pickByPreferenceOrder
    const discoverer = explorer || pickByPreferenceOrder(
      graphView, 'npc', ['hero', 'outlaw', 'merchant'], 'alive'
    );

    if (!discoverer) {
      return emptyResult('No eligible explorer found');
    }

    // ------- STEP 3: CREATION - procedural_theme(deficit) -------

    const discoveryConfig = graphView.config?.domain?.emergentDiscoveryConfig;
    if (!discoveryConfig) {
      return emptyResult('No emergent discovery config available');
    }

    // Strategy: procedural_theme(deficit)
    const theme = generateResourceTheme(deficit, graphView.currentEra.id, discoveryConfig);

    const formattedTheme = theme.themeString.split('_').map(w =>
      w.charAt(0).toUpperCase() + w.slice(1)
    ).join(' ');

    const themeTags = Array.isArray(theme.tags)
      ? theme.tags.reduce((acc, tag) => ({ ...acc, [tag]: true }), {} as Record<string, boolean>)
      : theme.tags;

    // Strategy: findNearbyLocationsForAdjacency
    const nearbyLocations = findNearbyLocationsForAdjacency(graphView, discoverer);

    // Strategy: deriveCoordinatesNearReference
    const coords = deriveCoordinatesNearReference(
      graphView, 'location', [discoverer], discoverer.culture
    );

    // Strategy: createEntityPartial
    const newLocation = createEntityPartial('location', theme.subtype, {
      status: 'unspoiled',
      prominence: 'marginal',
      culture: discoverer.culture,
      description: `A resource-rich ${formattedTheme.toLowerCase()} discovered to address ${deficit.specific} scarcity`,
      tags: themeTags,
      coordinates: coords
    });

    // ------- STEP 4: RELATIONSHIPS -------

    const relationships: Relationship[] = [];

    // Strategy: discovery(explorer_of)
    relationships.push(createRelationship('explorer_of', discoverer.id, 'will-be-assigned-0'));

    // Strategy: discovery(discovered_by)
    relationships.push(createRelationship('discovered_by', 'will-be-assigned-0', discoverer.id));

    // Strategy: bidirectional(adjacent_to)
    if (nearbyLocations.length > 0) {
      const adjacentTo = pickRandom(nearbyLocations);
      relationships.push(
        ...createBidirectionalRelationship('adjacent_to', 'will-be-assigned-0', adjacentTo.id)
      );
    }

    // ------- STEP 5: STATE UPDATES -------

    // Strategy: update_discovery_state
    updateDiscoveryState(graphView);

    return templateResult(
      [newLocation],
      relationships,
      `${discoverer.name} discovered ${theme.themeString.replace(/_/g, ' ')} to address ${deficit.primary} scarcity`
    );
  }
};
