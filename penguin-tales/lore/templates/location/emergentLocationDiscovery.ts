/**
 * Emergent Location Discovery Template (UNIFIED)
 *
 * Strategy-based template for discovering locations based on world state.
 *
 * Pipeline:
 *   1. Applicability: pressure_any_above(10) OR random_chance(0.05)
 *   2. Selection: by_preference_order(npc: hero > outlaw > merchant > mayor)
 *   3. Creation: procedural_theme(pressure) with near_reference placement
 *   4. Relationships: discovery(explorer_of, discovered_by), bidirectional(adjacent_to)
 */

import { GrowthTemplate, TemplateResult, ComponentPurpose } from '@lore-weave/core';
import { TemplateGraphView } from '@lore-weave/core';
import { HardState, Relationship } from '@lore-weave/core';
import { pickRandom } from '@lore-weave/core';

import {
  // Step 1: Applicability
  checkAnyPressureAbove,
  checkRandomChance,
  // Step 2: Selection
  selectByPreferenceOrder,
  pickByPreferenceOrder,
  // Step 3: Creation
  deriveCoordinatesNearReference,
  createEntityPartial,
  findNearbyLocationsForAdjacency,
  selectThemeByPressure,
  // Step 4: Relationships
  createRelationship,
  createBidirectionalRelationship,
  // Result helpers
  emptyResult,
  templateResult
} from '../../utils/strategyExecutors';

export const emergentLocationDiscovery: GrowthTemplate = {
  id: 'emergent_location_discovery',
  name: 'Location Discovery',

  contract: {
    purpose: ComponentPurpose.ENTITY_CREATION,
    enabledBy: {
      entityCounts: [
        { kind: 'npc', min: 1 },
        { kind: 'location', min: 1 }
      ]
    },
    affects: {
      entities: [
        { kind: 'location', operation: 'create', count: { min: 1, max: 1 } }
      ],
      relationships: [
        { kind: 'explorer_of', operation: 'create', count: { min: 1, max: 1 } },
        { kind: 'discovered_by', operation: 'create', count: { min: 1, max: 1 } },
        { kind: 'adjacent_to', operation: 'create', count: { min: 0, max: 4 } }
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

  // =========================================================================
  // STEP 1: APPLICABILITY - pressure_any_above OR random_chance
  // =========================================================================
  canApply: (graphView: TemplateGraphView): boolean => {
    // Strategy: pressure_any_above(10) OR random_chance(0.05)
    const hasPressure = checkAnyPressureAbove(
      graphView,
      ['conflict', 'magical_instability', 'resource_scarcity'],
      10
    );
    const randomTrigger = checkRandomChance(0.05);

    return hasPressure || randomTrigger;
  },

  // =========================================================================
  // STEP 2: SELECTION - by_preference_order for explorers
  // =========================================================================
  findTargets: (graphView: TemplateGraphView): HardState[] => {
    // Strategy: by_preference_order(hero > outlaw > merchant > mayor) with status filter
    return selectByPreferenceOrder(graphView, 'npc', ['hero', 'outlaw', 'merchant', 'mayor'], 'alive');
  },

  // =========================================================================
  // STEPS 3-4: CREATION & RELATIONSHIPS
  // =========================================================================
  expand: (graphView: TemplateGraphView, explorer?: HardState): TemplateResult => {
    // Resolve target using preference order
    const discoverer = explorer || pickByPreferenceOrder(
      graphView, 'npc', ['hero', 'outlaw', 'merchant', 'mayor'], 'alive'
    );

    if (!discoverer) {
      return emptyResult('No eligible explorer found');
    }

    // ------- STEP 3: CREATION - procedural_theme based on pressure -------

    // Strategy: selectThemeByPressure
    const pressureThemes = {
      conflict: {
        subtype: 'geographic_feature',
        themes: ['Vantage Point', 'Choke Point', 'Natural Fortification', 'Strategic Ridge'],
        tags: { strategic: true, defensive: true, conflict: true },
        descriptionTemplate: 'A strategic {theme} providing tactical advantage'
      },
      magical_instability: {
        subtype: 'anomaly',
        themes: ['Ley Nexus', 'Mystical Shrine', 'Ethereal Cavern', 'Magical Convergence'],
        tags: { mystical: true, magical: true, anomaly: true },
        descriptionTemplate: 'A mystical {theme} manifesting magical energies'
      },
      resource_scarcity: {
        subtype: 'geographic_feature',
        themes: ['Krill Fields', 'Ice Quarry', 'Thermal Vent', 'Fishing Grounds'],
        tags: { resource: true, valuable: true, economic: true },
        descriptionTemplate: 'Rich {theme} providing essential resources'
      }
    };

    const themeOption = selectThemeByPressure(graphView, pressureThemes);

    if (!themeOption) {
      return emptyResult('No theme available for location discovery');
    }

    const locationTheme = pickRandom(themeOption.themes);
    const dominantPressure = Object.entries(pressureThemes)
      .find(([_, v]) => v === themeOption)?.[0] || 'exploration';

    // Find nearby locations for coordinate derivation and adjacency
    const nearbyLocations = findNearbyLocationsForAdjacency(graphView, discoverer);
    const referenceEntities: HardState[] = [discoverer];
    if (nearbyLocations.length > 0) {
      referenceEntities.push(nearbyLocations[0]);
    }

    const cultureId = discoverer.culture ?? 'default';

    // Strategy: deriveCoordinatesNearReference
    const coords = deriveCoordinatesNearReference(graphView, 'location', referenceEntities, cultureId);

    // Strategy: createEntityPartial
    const newLocation = createEntityPartial('location', themeOption.subtype, {
      status: 'unspoiled',
      prominence: 'recognized',
      culture: discoverer.culture,
      description: themeOption.descriptionTemplate.replace('{theme}', locationTheme.toLowerCase()),
      tags: themeOption.tags,
      coordinates: coords
    });

    // ------- STEP 4: RELATIONSHIPS -------

    const relationships: Relationship[] = [];

    // Strategy: discovery(explorer_of)
    relationships.push(
      createRelationship('explorer_of', discoverer.id, 'will-be-assigned-0')
    );

    // Strategy: discovery(discovered_by)
    relationships.push(
      createRelationship('discovered_by', 'will-be-assigned-0', discoverer.id)
    );

    // Strategy: bidirectional(adjacent_to) if nearby locations exist
    if (nearbyLocations.length > 0) {
      const adjacentTo = pickRandom(nearbyLocations);
      relationships.push(
        ...createBidirectionalRelationship('adjacent_to', 'will-be-assigned-0', adjacentTo.id)
      );
    }

    return templateResult(
      [newLocation],
      relationships,
      `${discoverer.name} discovered a new ${locationTheme.toLowerCase()} driven by ${dominantPressure} pressure`
    );
  }
};
