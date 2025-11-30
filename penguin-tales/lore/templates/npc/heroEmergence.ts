/**
 * Hero Emergence Template
 *
 * Strategy-based template for creating heroes during times of conflict.
 *
 * Pipeline:
 *   1. Applicability: pressure_threshold(conflict, 5-80) AND NOT saturated(npc/hero)
 *   2. Selection: by_kind(location/colony) with status filter
 *   3. Creation: near_reference with culture inheritance
 *   4. Relationships: hierarchical(resident_of), optional practitioner_of
 */

import { GrowthTemplate, TemplateResult, ComponentPurpose } from '@lore-weave/core';
import { TemplateGraphView } from '@lore-weave/core';
import { HardState } from '@lore-weave/core';
import { pickRandom } from '@lore-weave/core';

import {
  // Step 1: Applicability
  checkPressureThreshold,
  checkNotSaturated,
  // Step 2: Selection
  selectByKind,
  // Step 3: Creation
  deriveCoordinatesNearReference,
  createEntityPartial,
  // Step 4: Relationships
  createRelationship,
  // Result helpers
  emptyResult,
  templateResult
} from '../../utils/strategyExecutors';

export const heroEmergence: GrowthTemplate = {
  id: 'hero_emergence',
  name: 'Hero Rises',

  contract: {
    purpose: ComponentPurpose.ENTITY_CREATION,
    enabledBy: {
      pressures: [
        { name: 'conflict', threshold: 5 },
        { name: 'external_threat', threshold: 5 }
      ]
    },
    affects: {
      entities: [
        { kind: 'npc', operation: 'create', count: { min: 1, max: 1 } }
      ],
      relationships: [
        { kind: 'practitioner_of', operation: 'create', count: { min: 0, max: 1 } },
        { kind: 'resident_of', operation: 'create', count: { min: 1, max: 1 } },
        { kind: 'inspired_by', operation: 'create', count: { min: 0, max: 1 } }
      ],
      pressures: [
        { name: 'conflict', delta: -2 }
      ]
    }
  },

  metadata: {
    produces: {
      entityKinds: [
        {
          kind: 'npc',
          subtype: 'hero',
          count: { min: 1, max: 1 },
          prominence: [{ level: 'marginal', probability: 1.0 }],
        },
      ],
      relationships: [
        { kind: 'practitioner_of', category: 'cultural', probability: 0.8, comment: 'If abilities exist' },
        { kind: 'resident_of', category: 'spatial', probability: 1.0, comment: 'Hero lives in colony' },
      ],
    },
    effects: {
      graphDensity: 0.2,
      clusterFormation: 0.3,
      diversityImpact: 0.5,
      comment: 'Creates individual heroes with potential for ability practice',
    },
    tags: ['crisis-driven', 'individual'],
  },

  // =========================================================================
  // STEP 1: APPLICABILITY - pressure_threshold AND NOT saturated
  // =========================================================================
  canApply: (graphView: TemplateGraphView) => {
    // Skip pressure check at very low entity count (bootstrap phase)
    if (graphView.getEntityCount() > 20) {
      // Strategy: pressure_threshold(conflict, 5, 80, extremeChance=0.3)
      if (!checkPressureThreshold(graphView, 'conflict', 5, 80, 0.3)) {
        return false;
      }
    }

    // Strategy: NOT saturated(npc, hero)
    if (!checkNotSaturated(graphView, 'npc', 'hero')) {
      return false;
    }

    return true;
  },

  // =========================================================================
  // STEP 2: SELECTION - by_kind(location/colony) with status filter
  // =========================================================================
  findTargets: (graphView: TemplateGraphView) => {
    // Strategy: by_kind with status filter
    const colonies = selectByKind(graphView, 'location', ['colony']);
    return colonies.filter(c => c.status === 'thriving' || c.status === 'waning');
  },

  // =========================================================================
  // STEPS 3-4: CREATION & RELATIONSHIPS
  // =========================================================================
  expand: async (graphView: TemplateGraphView, target?: HardState): Promise<TemplateResult> => {
    // Resolve target
    const colony = target || pickRandom(selectByKind(graphView, 'location', ['colony']));

    if (!colony) {
      return emptyResult('Cannot create hero - no colonies exist');
    }

    // ------- STEP 3: CREATION - near_reference with culture inherit -------

    // Strategy: deriveCoordinatesNearReference
    const coords = deriveCoordinatesNearReference(graphView, 'npc', [colony], colony.culture);

    // Strategy: createEntityPartial
    const heroEntity = createEntityPartial('npc', 'hero', {
      status: 'alive',
      prominence: 'marginal',
      culture: colony.culture,
      description: `A brave penguin who emerged during troubled times in ${colony.name}`,
      tags: { brave: true, emergent: true },
      coordinates: coords
    });

    // Add entity to graph
    const entityId = await graphView.addEntity(heroEntity);

    if (!entityId) {
      throw new Error('hero_emergence: Failed to create hero entity.');
    }

    // ------- STEP 4: RELATIONSHIPS -------

    const relationships: any[] = [];

    // Strategy: hierarchical(resident_of)
    relationships.push(
      createRelationship('resident_of', entityId, colony.id)
    );

    // Strategy: conditional - practitioner_of if abilities exist
    const abilities = graphView.findEntities({ kind: 'abilities' });
    if (abilities.length > 0) {
      relationships.push(
        createRelationship('practitioner_of', entityId, pickRandom(abilities).id)
      );
    }

    return templateResult(
      [],  // Entity already added via addEntity
      relationships,
      `A new hero emerges in ${colony.name}`
    );
  }
};
