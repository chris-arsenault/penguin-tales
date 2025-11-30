/**
 * Geographic Exploration Template
 *
 * Strategy-based template for discovering neutral geographic features.
 *
 * Pipeline:
 *   1. Applicability: era_match AND entity_count_max AND cooldown AND random_chance
 *   2. Selection: by_preference_order(npc: hero > merchant)
 *   3. Creation: procedural_theme(era) with near_reference placement
 *   4. Relationships: discovery(explorer_of, discovered_by), bidirectional(adjacent_to)
 *   5. State: update_discovery_state
 */

import { GrowthTemplate, TemplateResult, ComponentPurpose } from '@lore-weave/core';
import { TemplateGraphView } from '@lore-weave/core';
import { HardState, Relationship } from '@lore-weave/core';
import { pickRandom, extractParams } from '@lore-weave/core';
import { generateExplorationTheme } from '../../utils/emergentDiscovery';

import {
  // Step 1: Applicability
  checkEraMatch,
  checkNotSaturated,
  checkDiscoveryCooldown,
  checkDiscoveriesPerEpoch,
  checkRandomChance,
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

export const geographicExploration: GrowthTemplate = {
  id: 'geographic_exploration',
  name: 'Geographic Exploration',

  contract: {
    purpose: ComponentPurpose.ENTITY_CREATION,
    enabledBy: {
      era: ['expansion', 'reconstruction', 'innovation'],
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

  // =========================================================================
  // STEP 1: APPLICABILITY - era_match AND limits AND cooldown AND random
  // =========================================================================
  canApply: (graphView: TemplateGraphView): boolean => {
    // Strategy: era_match
    if (!checkEraMatch(graphView, ['expansion', 'reconstruction', 'innovation'])) {
      return false;
    }

    // Strategy: entity_count_max (location cap)
    if (!checkNotSaturated(graphView, 'location', undefined, 35, 1.0)) {
      return false;
    }

    // Strategy: cooldown_elapsed
    if (!checkDiscoveryCooldown(graphView, 8)) {
      return false;
    }

    // Strategy: discoveries_per_epoch
    if (!checkDiscoveriesPerEpoch(graphView, 2)) {
      return false;
    }

    // Strategy: random_chance
    const { baseChance } = extractParams(geographicExploration.metadata, { baseChance: 0.08 });
    if (!checkRandomChance(baseChance)) {
      return false;
    }

    return true;
  },

  // =========================================================================
  // STEP 2: SELECTION - by_preference_order(hero > merchant)
  // =========================================================================
  findTargets: (graphView: TemplateGraphView): HardState[] => {
    // Strategy: by_preference_order with status filter
    return selectByPreferenceOrder(graphView, 'npc', ['hero', 'merchant'], 'alive');
  },

  // =========================================================================
  // STEPS 3-5: CREATION, RELATIONSHIPS, STATE
  // =========================================================================
  expand: (graphView: TemplateGraphView, explorer?: HardState): TemplateResult => {
    // Resolve target using preference order
    const discoverer = explorer || pickByPreferenceOrder(graphView, 'npc', ['hero', 'merchant'], 'alive');

    if (!discoverer) {
      return emptyResult('No eligible explorer found');
    }

    // ------- STEP 3: CREATION - procedural_theme with near_reference -------

    // Strategy: procedural_theme(era)
    const theme = generateExplorationTheme(graphView);
    if (!theme) {
      return emptyResult('No exploration theme available');
    }

    // Format theme for description
    const formattedTheme = theme.themeString.split('_').map(w =>
      w.charAt(0).toUpperCase() + w.slice(1)
    ).join(' ');

    // Convert theme tags array to KVP
    const themeTags = Array.isArray(theme.tags)
      ? theme.tags.reduce((acc, tag) => ({ ...acc, [tag]: true }), {} as Record<string, boolean>)
      : theme.tags;

    // Find nearby locations for coordinate derivation
    const nearbyLocations = findNearbyLocationsForAdjacency(graphView, discoverer);
    const referenceEntities: HardState[] = [discoverer];
    if (nearbyLocations.length > 0) {
      referenceEntities.push(nearbyLocations[0]);
    }

    // Strategy: deriveCoordinatesNearReference
    const coords = deriveCoordinatesNearReference(graphView, 'location', referenceEntities, discoverer.culture);

    // Strategy: createEntityPartial
    const newLocation = createEntityPartial('location', theme.subtype, {
      status: 'unspoiled',
      prominence: 'marginal',
      culture: discoverer.culture,
      description: `A newly discovered ${formattedTheme.toLowerCase()} during the ${graphView.currentEra.name}`,
      tags: themeTags,
      coordinates: coords
    });

    const entities: Partial<HardState>[] = [newLocation];

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

    // ------- STEP 5: STATE UPDATES -------

    // Strategy: update_discovery_state
    updateDiscoveryState(graphView);

    return templateResult(
      entities,
      relationships,
      `${discoverer.name} discovered ${theme.themeString.replace(/_/g, ' ')} while exploring`
    );
  }
};
