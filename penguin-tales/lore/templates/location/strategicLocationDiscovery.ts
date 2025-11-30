/**
 * Strategic Location Discovery Template
 *
 * Strategy-based template for emergent strategic location generation.
 *
 * Pipeline:
 *   1. Applicability: conflict_analysis(patterns) AND discovery_probability
 *   2. Selection: by_preference_order(npc: hero > outlaw > mayor)
 *   3. Creation: procedural_theme(conflict) with near_reference placement
 *   4. Relationships: discovery(explorer_of, discovered_by), bidirectional(adjacent_to)
 *   5. State: update_discovery_state
 */

import { GrowthTemplate, TemplateResult, ComponentPurpose } from '@lore-weave/core';
import { TemplateGraphView } from '@lore-weave/core';
import { HardState, Relationship } from '@lore-weave/core';
import { pickRandom } from '@lore-weave/core';
import {
  analyzeConflictPatterns,
  generateStrategicTheme,
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

  // =========================================================================
  // STEP 1: APPLICABILITY - conflict_analysis AND discovery_probability
  // =========================================================================
  canApply: (graphView: TemplateGraphView): boolean => {
    // Strategy: conflict_analysis(patterns)
    const conflict = analyzeConflictPatterns(graphView);
    if (!conflict) return false;

    // Strategy: discovery_probability
    return shouldDiscoverLocation(graphView);
  },

  // =========================================================================
  // STEP 2: SELECTION - by_preference_order for scouts/combatants
  // =========================================================================
  findTargets: (graphView: TemplateGraphView): HardState[] => {
    // Strategy: by_preference_order(hero > outlaw > mayor)
    return selectByPreferenceOrder(graphView, 'npc', ['hero', 'outlaw', 'mayor'], 'alive');
  },

  // =========================================================================
  // STEPS 3-5: CREATION, RELATIONSHIPS, STATE
  // =========================================================================
  expand: (graphView: TemplateGraphView, explorer?: HardState): TemplateResult => {
    // Strategy: conflict_analysis(patterns)
    const conflict = analyzeConflictPatterns(graphView);
    if (!conflict) {
      return emptyResult('No active conflicts detected');
    }

    // Strategy: pickByPreferenceOrder
    const discoverer = explorer || pickByPreferenceOrder(
      graphView, 'npc', ['hero', 'outlaw', 'mayor'], 'alive'
    );

    if (!discoverer) {
      return emptyResult('No eligible scout found');
    }

    // ------- STEP 3: CREATION - procedural_theme(conflict) -------

    // Strategy: procedural_theme(conflict)
    const theme = generateStrategicTheme(conflict, graphView.currentEra.id);

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
      prominence: 'recognized',
      culture: discoverer.culture,
      description: `A strategic ${formattedTheme.toLowerCase()} providing tactical advantage in the ${conflict.type} conflict`,
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
      `${discoverer.name} discovered ${theme.themeString.replace(/_/g, ' ')} for ${conflict.type} advantage`
    );
  }
};
