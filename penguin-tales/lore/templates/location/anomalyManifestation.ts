/**
 * Anomaly Manifestation Template
 *
 * Strategy-based template for spontaneous magical phenomena.
 *
 * Pipeline:
 *   1. Applicability: pressure_threshold(magic, 30) OR random_chance(0.2)
 *   2. Selection: by_kind(location) for reference points
 *   3. Creation: wilderness_placement with culture derivation
 *   4. Relationships: bidirectional(adjacent_to), optional discovery(discovered_by)
 */

import { GrowthTemplate, TemplateResult, ComponentPurpose } from '@lore-weave/core';
import { TemplateGraphView } from '@lore-weave/core';
import { HardState, Relationship } from '@lore-weave/core';
import { pickRandom, hasTag, extractParams } from '@lore-weave/core';

import {
  // Step 1: Applicability
  checkPressureThreshold,
  checkRandomChance,
  // Step 2: Selection
  selectByKind,
  // Step 3: Creation
  deriveCoordinatesNearReference,
  createEntityPartial,
  // Step 4: Relationships
  createRelationship,
  createBidirectionalRelationship,
  // Result helpers
  emptyResult,
  templateResult
} from '../../utils/strategyExecutors';
export const anomalyManifestation: GrowthTemplate = {
  id: 'anomaly_manifestation',
  name: 'Anomaly Appears',

  contract: {
    purpose: ComponentPurpose.ENTITY_CREATION,
    enabledBy: {
      pressures: [
        { name: 'magical_instability', threshold: 30 }
      ],
      entityCounts: [
        { kind: 'location', min: 1 }  // Needs locations to be adjacent to
      ]
    },
    affects: {
      entities: [
        { kind: 'location', operation: 'create', count: { min: 1, max: 1 } }
      ],
      relationships: [
        { kind: 'adjacent_to', operation: 'create', count: { min: 0, max: 2 } },
        { kind: 'discovered_by', operation: 'create', count: { min: 0, max: 1 } }
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
        { kind: 'adjacent_to', category: 'spatial', probability: 1.0, comment: 'Adjacent to existing location' },
        { kind: 'discovered_by', category: 'spatial', probability: 0.7, comment: 'Magic user discovers it' },
      ],
    },
    effects: {
      graphDensity: 0.3,
      clusterFormation: 0.4,
      diversityImpact: 0.8,
      comment: 'Creates mystical locations in the wilderness between settlements',
    },
    parameters: {
      activationChance: {
        value: 0.2,
        min: 0.05,
        max: 0.5,
        description: 'Probability of manifestation when magical_instability is low',
      },
      minDistanceFromColonies: {
        value: 8,
        min: 5,
        max: 20,
        description: 'Minimum distance from colony centers'
      },
      maxDistanceFromColonies: {
        value: 25,
        min: 15,
        max: 40,
        description: 'Maximum distance from any colony (for discoverability)'
      }
    },
    tags: ['mystical', 'pressure-driven', 'region-aware'],
  },

  // =========================================================================
  // STEP 1: APPLICABILITY - pressure_threshold OR random_chance
  // =========================================================================
  canApply: (graphView: TemplateGraphView) => {
    const { activationChance } = extractParams(anomalyManifestation.metadata, { activationChance: 0.2 });

    // Strategy: pressure_threshold(magic, 30) OR random_chance
    const magicTrigger = checkPressureThreshold(graphView, 'magical_instability', 30, 100);
    const randomTrigger = checkRandomChance(activationChance);

    return magicTrigger || randomTrigger;
  },

  // =========================================================================
  // STEP 2: SELECTION - by_kind(location) for reference
  // =========================================================================
  findTargets: (graphView: TemplateGraphView) => {
    // Strategy: by_kind(location)
    return selectByKind(graphView, 'location');
  },

  // =========================================================================
  // STEPS 3-4: CREATION & RELATIONSHIPS
  // =========================================================================
  expand: (graphView: TemplateGraphView, target?: HardState): TemplateResult => {
    // ------- STEP 3: CREATION - wilderness_placement -------

    // Strategy: by_kind for reference locations
    const colonies = selectByKind(graphView, 'location', ['colony']);
    const existingAnomalies = selectByKind(graphView, 'location', ['anomaly']);
    const geographicFeatures = selectByKind(graphView, 'location', ['geographic_feature']);

    // Build reference entities - prefer placing near existing mystical sites
    const referenceEntities: HardState[] = [];
    if (existingAnomalies.length > 0) {
      referenceEntities.push(pickRandom(existingAnomalies));
    }
    if (geographicFeatures.length > 0) {
      referenceEntities.push(pickRandom(geographicFeatures));
    }
    if (colonies.length > 0) {
      referenceEntities.push(pickRandom(colonies));
    }

    if (target && !referenceEntities.includes(target)) {
      referenceEntities.push(target);
    }

    if (referenceEntities.length === 0) {
      return emptyResult('Magical energies dissipate - no anchor points for anomaly');
    }

    const nearestColony = colonies.length > 0 ? pickRandom(colonies) : null;
    const cultureId = nearestColony?.culture || referenceEntities.find(e => e.culture)?.culture || 'world';

    // Strategy: deriveCoordinatesNearReference
    const coords = deriveCoordinatesNearReference(graphView, 'location', referenceEntities, cultureId);

    // Strategy: createEntityPartial
    const anomaly = createEntityPartial('location', 'anomaly', {
      status: 'unspoiled',
      prominence: 'recognized',
      culture: nearestColony?.culture || 'world',
      description: `A mysterious phenomenon deep in the ice, ${nearestColony ? `near ${nearestColony.name}` : 'in the remote wastes'}`,
      tags: { anomaly: true, mystical: true, caverns: true },
      coordinates: coords
    });

    // ------- STEP 4: RELATIONSHIPS -------

    const relationships: Relationship[] = [];

    // Strategy: bidirectional(adjacent_to)
    if (referenceEntities.length > 0) {
      const nearestRef = referenceEntities[0];
      relationships.push(
        ...createBidirectionalRelationship('adjacent_to', 'will-be-assigned-0', nearestRef.id)
      );
    }

    // Strategy: optional discovery(discovered_by) by magic user
    const magicUsers = graphView.findEntities({}).filter(
      e => (e.kind === 'npc' && hasTag(e.tags, 'magic')) ||
           (e.kind === 'npc' && e.links.some(l => l.kind === 'practitioner_of'))
    );

    if (magicUsers.length > 0 && checkRandomChance(0.7)) {
      const discoverer = pickRandom(magicUsers);
      relationships.push(createRelationship('discovered_by', 'will-be-assigned-0', discoverer.id));
    }

    return templateResult(
      [anomaly],
      relationships,
      `A mysterious anomaly manifests in the wilderness between settlements`
    );
  }
};
