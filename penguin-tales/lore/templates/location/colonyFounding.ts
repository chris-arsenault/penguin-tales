/**
 * Colony Founding Template
 *
 * Strategy-based template for establishing new colonies.
 *
 * Pipeline:
 *   1. Applicability: entity_count_max(colony, 5) AND entity_count_min(total, 20)
 *   2. Selection: by_kind(location/iceberg)
 *   3. Creation: computed_placement with minimum distance constraint
 *   4. Relationships: spatial(contained_by)
 */

import { GrowthTemplate, TemplateResult, ComponentPurpose } from '@lore-weave/core';
import { TemplateGraphView } from '@lore-weave/core';
import { HardState } from '@lore-weave/core';
import { pickRandom, extractParams } from '@lore-weave/core';

import {
  // Step 1: Applicability
  checkNotSaturated,
  checkEntityCountMin,
  // Step 2: Selection
  selectByKind,
  // Step 3: Creation
  isPointFarEnough,
  // Result helpers
  emptyResult,
  templateResult
} from '../../utils/strategyExecutors';

export const colonyFounding: GrowthTemplate = {
  id: 'colony_founding',
  name: 'Colony Foundation',

  contract: {
    purpose: ComponentPurpose.ENTITY_CREATION,
    enabledBy: {
      entityCounts: [
        { kind: 'location', min: 1 },
        { kind: 'npc', min: 20 }
      ]
    },
    affects: {
      entities: [
        { kind: 'location', operation: 'create', count: { min: 1, max: 1 } }
      ],
      relationships: [
        { kind: 'contained_by', operation: 'create', count: { min: 1, max: 2 } }
      ]
    }
  },

  metadata: {
    produces: {
      entityKinds: [
        {
          kind: 'location',
          subtype: 'colony',
          count: { min: 1, max: 1 },
          prominence: [{ level: 'marginal', probability: 1.0 }],
        },
      ],
      relationships: [
        { kind: 'contained_by', category: 'spatial', probability: 1.0, comment: 'Colony on iceberg' },
      ],
    },
    effects: {
      graphDensity: 0.1,
      clusterFormation: 0.3,
      diversityImpact: 0.3,
      comment: 'Adds new colony nodes with realistic spatial placement',
    },
    parameters: {
      minDistanceFromColonies: {
        value: 20,
        min: 10,
        max: 40,
        description: 'Minimum distance from existing colonies'
      }
    },
    tags: ['expansion', 'colony-formation', 'region-aware'],
  },

  // =========================================================================
  // STEP 1: APPLICABILITY - entity_count_max AND entity_count_min
  // =========================================================================
  canApply: (graphView: TemplateGraphView) => {
    // Strategy: entity_count_max(colony, 5)
    if (!checkNotSaturated(graphView, 'location', 'colony', 5, 1.0)) {
      return false;
    }
    // Strategy: entity_count_min(total, 20)
    if (!checkEntityCountMin(graphView, undefined, undefined, 20)) {
      return false;
    }
    return true;
  },

  // =========================================================================
  // STEP 2: SELECTION - icebergs to found colonies on
  // =========================================================================
  findTargets: (graphView: TemplateGraphView) => {
    // Strategy: by_kind(location/iceberg)
    return selectByKind(graphView, 'location', ['iceberg']);
  },

  // =========================================================================
  // STEPS 3-4: CREATION & RELATIONSHIPS
  // =========================================================================
  expand: async (graphView: TemplateGraphView, target?: HardState): Promise<TemplateResult> => {
    const iceberg = target || pickRandom(selectByKind(graphView, 'location', ['iceberg']));

    if (!iceberg) {
      return emptyResult('Cannot found colony - no icebergs exist');
    }

    // Determine culture based on existing colonies on this iceberg
    const existingColonies = selectByKind(graphView, 'location', ['colony']);
    const colonyOnIceberg = existingColonies.find(c =>
      graphView.hasRelationship(c.id, iceberg.id, 'contained_by')
    );
    const culture = colonyOnIceberg?.culture || 'aurora-stack';

    // Check if region system is available
    if (!graphView.hasRegionSystem()) {
      throw new Error(
        `colony_founding: Region system is not configured. ` +
        `Cannot place colony without spatial coordinates.`
      );
    }

    // ------- STEP 3: CREATION - computed_placement with distance constraint -------

    const { minDistanceFromColonies } = extractParams(colonyFounding.metadata, { minDistanceFromColonies: 20 });

    // Get all existing colony coordinate points
    const existingColonyPoints = existingColonies
      .map(c => c.coordinates)
      .filter((p): p is { x: number; y: number; z: number } => p != null && 'x' in p);

    // Try to create an emergent region in the wilderness
    const referencePoint = {
      x: 20 + Math.random() * 60,
      y: 25 + Math.random() * 55,
      z: 45 + Math.random() * 10
    };

    // Strategy: isPointFarEnough - check distance from all existing colonies
    if (!isPointFarEnough(referencePoint, existingColonyPoints, minDistanceFromColonies)) {
      return emptyResult(`Could not find suitable location for new colony - all areas too close to existing settlements`);
    }

    // Create emergent region for the new colony
    const regionResult = graphView.createEmergentRegion(
      referencePoint,
      'New Colony',
      `A new colony founded on ${iceberg.name}`
    );

    if (!regionResult.success || !regionResult.region) {
      return emptyResult(`Could not create region for new colony`);
    }

    // Place the colony within the new region using culture-aware placement
    const placementResult = graphView.deriveCoordinatesWithCulture(
      culture,
      'location',
      iceberg ? [iceberg] : undefined
    );

    const coords = placementResult?.coordinates ?? referencePoint;

    const entityId = await graphView.addEntity({
      kind: 'location',
      subtype: 'colony',
      description: `New colony established on ${iceberg.name} in the ${pickRandom(['northern', 'southern', 'eastern', 'western'])} reaches.`,
      status: 'thriving',
      prominence: 'marginal',
      culture,
      tags: { new: true, colony: true },
      coordinates: coords
    });

    if (!entityId) {
      return emptyResult(`Failed to create colony entity`);
    }

    // ------- STEP 4: RELATIONSHIPS -------

    return templateResult(
      [],  // Entity already added via graphView.addEntity
      [{ kind: 'contained_by', src: entityId, dst: iceberg.id }],
      `A new colony founded on ${iceberg.name} at region ${regionResult.region.label}`
    );
  }
};
