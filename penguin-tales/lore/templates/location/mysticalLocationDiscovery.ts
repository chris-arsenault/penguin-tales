/**
 * Mystical Location Discovery Template
 *
 * Strategy-based template for emergent anomaly location generation.
 *
 * Pipeline:
 *   1. Applicability: magic_analysis(instability) AND discovery_probability
 *   2. Selection: by_relationship(practitioner_of) THEN by_preference_order(hero)
 *   3. Creation: procedural_theme(magic) with near_reference placement
 *   4. Relationships: discovery(explorer_of, discovered_by), bidirectional(adjacent_to)
 *   5. State: update_discovery_state
 */

import { GrowthTemplate, TemplateResult, ComponentPurpose } from '@lore-weave/core';
import { TemplateGraphView } from '@lore-weave/core';
import { HardState, Relationship } from '@lore-weave/core';
import { pickRandom } from '@lore-weave/core';
import {
  analyzeMagicPresence,
  generateMysticalTheme,
  shouldDiscoverLocation,
  findNearbyLocations
} from '../../utils/emergentDiscovery';

import {
  // Step 2: Selection
  selectByRelationship,
  selectByPreferenceOrder,
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

  // =========================================================================
  // STEP 1: APPLICABILITY - magic_analysis AND discovery_probability
  // =========================================================================
  canApply: (graphView: TemplateGraphView): boolean => {
    // Strategy: magic_analysis(instability)
    const magic = analyzeMagicPresence(graphView);
    if (!magic) return false;

    // Strategy: discovery_probability
    return shouldDiscoverLocation(graphView);
  },

  // =========================================================================
  // STEP 2: SELECTION - by_relationship THEN by_preference_order
  // =========================================================================
  findTargets: (graphView: TemplateGraphView): HardState[] => {
    // Strategy: by_relationship(practitioner_of) - prefer magic users
    const magicUsers = selectByRelationship(graphView, 'npc', 'practitioner_of', true)
      .filter(npc => npc.status === 'alive');

    if (magicUsers.length > 0) return magicUsers;

    // Strategy: by_preference_order(hero) fallback
    return selectByPreferenceOrder(graphView, 'npc', ['hero'], 'alive');
  },

  // =========================================================================
  // STEPS 3-5: CREATION, RELATIONSHIPS, STATE
  // =========================================================================
  expand: (graphView: TemplateGraphView, explorer?: HardState): TemplateResult => {
    // Strategy: magic_analysis(instability)
    const magic = analyzeMagicPresence(graphView);
    if (!magic) {
      return emptyResult('No magical instability detected');
    }

    // Strategy: resolve target using relationship then preference
    let discoverer = explorer;
    if (!discoverer) {
      const magicUsers = selectByRelationship(graphView, 'npc', 'practitioner_of', true)
        .filter(npc => npc.status === 'alive');

      if (magicUsers.length > 0) {
        discoverer = pickRandom(magicUsers);
      } else {
        const heroes = selectByPreferenceOrder(graphView, 'npc', ['hero'], 'alive');
        discoverer = heroes.length > 0 ? pickRandom(heroes) : undefined;
      }
    }

    if (!discoverer) {
      return emptyResult('No eligible seeker found');
    }

    // ------- STEP 3: CREATION - procedural_theme(magic) -------

    // Strategy: procedural_theme(magic)
    const theme = generateMysticalTheme(magic, graphView.currentEra.id);

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
      description: `A mystical ${formattedTheme.toLowerCase()} manifesting ${magic.manifestationType} energies`,
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
      `${discoverer.name} discovered ${theme.themeString.replace(/_/g, ' ')} manifestation`
    );
  }
};
