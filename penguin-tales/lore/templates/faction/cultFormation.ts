/**
 * Cult Formation Template
 *
 * Strategy-based template for mystical cults emerging near anomalies.
 *
 * Pipeline:
 *   1. Applicability: entity_count_min(anomaly|magic) AND NOT saturated(faction/cult)
 *   2. Selection: by_kind(location) with anomaly adjacency expansion
 *   3. Creation: faction + prophet + selection_hybrid cultists
 *   4. Relationships: spatial(occupies), hierarchical(leader_of, member_of), cultural(seeks, practitioner_of)
 */

import { GrowthTemplate, TemplateResult, ComponentPurpose } from '@lore-weave/core';
import { TemplateGraphView } from '@lore-weave/core';
import { HardState, Relationship } from '@lore-weave/core';
import { pickRandom, extractParams } from '@lore-weave/core';

import {
  // Step 1: Applicability
  checkNotSaturated,
  checkEntityCountMin,
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

export const cultFormation: GrowthTemplate = {
  id: 'cult_formation',
  name: 'Cult Awakening',

  contract: {
    purpose: ComponentPurpose.ENTITY_CREATION,
    enabledBy: {
      entityCounts: [
        { kind: 'location', min: 1 }
      ],
      custom: (graphView) => {
        const anomalyCount = graphView.getEntityCount('location', 'anomaly');
        const magicCount = graphView.getEntityCount('abilities', 'magic');
        return (anomalyCount > 0 || magicCount > 0);
      }
    },
    affects: {
      entities: [
        { kind: 'faction', operation: 'create', count: { min: 1, max: 1 } },
        { kind: 'npc', operation: 'create', count: { min: 1, max: 2 } }
      ],
      relationships: [
        { kind: 'occupies', operation: 'create', count: { min: 1, max: 1 } },
        { kind: 'leader_of', operation: 'create', count: { min: 1, max: 1 } },
        { kind: 'resident_of', operation: 'create', count: { min: 1, max: 4 } },
        { kind: 'member_of', operation: 'create', count: { min: 1, max: 3 } },
        { kind: 'seeks', operation: 'create', count: { min: 0, max: 1 } },
        { kind: 'practitioner_of', operation: 'create', count: { min: 0, max: 1 } }
      ],
      pressures: []
    }
  },

  metadata: {
    produces: {
      entityKinds: [
        {
          kind: 'faction',
          subtype: 'cult',
          count: { min: 1, max: 1 },
          prominence: [{ level: 'marginal', probability: 1.0 }],
        },
        {
          kind: 'npc',
          subtype: 'hero',
          count: { min: 1, max: 1 },
          prominence: [{ level: 'marginal', probability: 1.0 }],
        },
      ],
      relationships: [
        { kind: 'occupies', category: 'spatial', probability: 1.0, comment: 'Cult occupies anomaly/location' },
        { kind: 'leader_of', category: 'political', probability: 1.0, comment: 'Prophet leads cult' },
        { kind: 'resident_of', category: 'spatial', probability: 4.0, comment: 'Prophet + 3 cultists reside' },
        { kind: 'member_of', category: 'political', probability: 3.0, comment: '3 cultists join' },
        { kind: 'seeks', category: 'cultural', probability: 0.8, comment: 'Cult seeks magic if exists' },
        { kind: 'practitioner_of', category: 'cultural', probability: 0.8, comment: 'Prophet practices magic if exists' },
      ],
    },
    effects: {
      graphDensity: 0.7,
      clusterFormation: 0.9,
      diversityImpact: 0.5,
      comment: 'Creates tight mystical clusters near anomalies',
    },
    parameters: {
      numCultists: {
        value: 1,
        min: 1,
        max: 3,
        description: 'Number of initial cultist followers',
      },
    },
    tags: ['mystical', 'anomaly-driven', 'cluster-forming'],
  },

  // =========================================================================
  // STEP 1: APPLICABILITY - entity_count_min(anomaly|magic) AND NOT saturated
  // =========================================================================
  canApply: (graphView: TemplateGraphView) => {
    // Strategy: entity_count_min - anomalies OR magic must exist
    const hasAnomalies = checkEntityCountMin(graphView, 'location', 'anomaly', 1);
    const hasMagic = checkEntityCountMin(graphView, 'abilities', 'magic', 1);
    if (!hasAnomalies && !hasMagic) {
      return false;
    }

    // Strategy: NOT saturated(faction, cult)
    if (!checkNotSaturated(graphView, 'faction', 'cult', 10)) {
      return false;
    }

    return true;
  },

  // =========================================================================
  // STEP 2: SELECTION - anomalies + adjacent locations
  // =========================================================================
  findTargets: (graphView: TemplateGraphView) => {
    // Strategy: by_kind(location/anomaly) with adjacency expansion
    const anomalies = selectByKind(graphView, 'location', ['anomaly']);
    const nearbyLocations: HardState[] = [];

    anomalies.forEach(anomaly => {
      const adjacent = graphView.getRelatedEntities(anomaly.id, 'adjacent_to');
      nearbyLocations.push(...adjacent);
    });

    return [...anomalies, ...nearbyLocations];
  },

  // =========================================================================
  // STEPS 3-4: CREATION & RELATIONSHIPS
  // =========================================================================
  expand: (graphView: TemplateGraphView, target?: HardState): TemplateResult => {
    const { numCultists } = extractParams(cultFormation.metadata, { numCultists: 1 });

    // Resolve target location
    const location = target || pickRandom(graphView.findEntities({ kind: 'location' }));

    if (!location) {
      return emptyResult('Cannot form cult - no locations exist');
    }

    // ------- STEP 3: CREATION -------

    // Find reference entities for coordinate placement
    const existingCults = graphView.findEntities({ kind: 'faction', subtype: 'cult' });
    const nearbyMagic = graphView.findEntities({ kind: 'abilities', subtype: 'magic' });

    const referenceEntities: HardState[] = [location];
    if (nearbyMagic.length > 0) {
      referenceEntities.push(pickRandom(nearbyMagic));
    }
    if (existingCults.length > 0) {
      referenceEntities.push(pickRandom(existingCults));
    }

    const cultureId = location.culture ?? 'default';

    // Strategy: createEntityPartial for cult faction
    const cultCoords = deriveCoordinatesNearReference(graphView, 'faction', referenceEntities, cultureId);
    const cult = createEntityPartial('faction', 'cult', {
      status: 'illegal',
      prominence: 'marginal',
      culture: location.culture,
      description: `A mystical cult drawn to the power near ${location.name}`,
      tags: { mystical: true, secretive: true, cult: true },
      coordinates: cultCoords
    });

    // Strategy: createEntityPartial for prophet (leader)
    const prophetCoords = deriveCoordinatesNearReference(graphView, 'npc', [location], cultureId);
    const prophet = createEntityPartial('npc', 'hero', {
      status: 'alive',
      prominence: 'marginal',
      culture: location.culture,
      description: `The enigmatic prophet of a mystical cult near ${location.name}`,
      tags: { prophet: true, mystical: true },
      coordinates: prophetCoords
    });

    // Strategy: selection_hybrid for cultists (prefer existing, create if needed)
    const newCultistCoords = deriveCoordinatesNearReference(graphView, 'npc', [location], cultureId);

    const selectionResult = graphView.selectTargets('npc', numCultists, {
      prefer: {
        subtypes: ['merchant', 'outlaw', 'hero'],
        sameLocationAs: location.id,
        sameCultureAs: location.culture,
        preferenceBoost: 2.0
      },
      avoid: {
        relationshipKinds: ['member_of'],
        hubPenaltyStrength: 2.0,
        maxTotalRelationships: 15,
        differentCulturePenalty: 0.3
      },
      createIfSaturated: {
        threshold: 0.15,
        factory: () => ({
          kind: 'npc',
          subtype: pickRandom(['merchant', 'outlaw']),
          description: `A convert drawn to the cult's mystical teachings`,
          status: 'alive',
          prominence: 'marginal',
          culture: location.culture,
          tags: { cultist: true },
          coordinates: newCultistCoords
        }),
        maxCreated: Math.ceil(numCultists / 2)
      },
      diversityTracking: {
        trackingId: 'cult_recruitment',
        strength: 1.5
      }
    });

    const cultists = selectionResult.existing;
    const newCultists = selectionResult.created;

    // ------- STEP 4: RELATIONSHIPS -------

    const relationships: Relationship[] = [];

    // Strategy: spatial(occupies) - cult occupies location
    relationships.push(
      createRelationship('occupies', 'will-be-assigned-0', location.id)
    );

    // Strategy: hierarchical(leader_of) - prophet leads cult
    relationships.push(
      createRelationship('leader_of', 'will-be-assigned-1', 'will-be-assigned-0')
    );

    // Strategy: spatial(resident_of) - prophet resides at location
    relationships.push(
      createRelationship('resident_of', 'will-be-assigned-1', location.id)
    );

    // Add relationships for existing cultists
    cultists.forEach(cultist => {
      relationships.push(
        createRelationship('member_of', cultist.id, 'will-be-assigned-0')
      );
      relationships.push(
        createRelationship('resident_of', cultist.id, location.id)
      );
    });

    // Add relationships for newly created cultists
    // Placeholder indices: 0=cult, 1=prophet, 2+=new cultists
    newCultists.forEach((_, index) => {
      const cultistPlaceholderId = `will-be-assigned-${2 + index}`;
      relationships.push(
        createRelationship('member_of', cultistPlaceholderId, 'will-be-assigned-0')
      );
      relationships.push(
        createRelationship('resident_of', cultistPlaceholderId, location.id)
      );
    });

    // Strategy: conditional - cultural relationships if magic exists
    const magicAbilities = graphView.findEntities({ kind: 'abilities', subtype: 'magic' });
    if (magicAbilities.length > 0) {
      const magic = magicAbilities[0];
      relationships.push(
        createRelationship('seeks', 'will-be-assigned-0', magic.id)
      );
      relationships.push(
        createRelationship('practitioner_of', 'will-be-assigned-1', magic.id)
      );
    }

    // Build description
    const totalCultists = cultists.length + newCultists.length;
    const creationNote = newCultists.length > 0
      ? ` (${newCultists.length} new converts recruited)`
      : '';

    return templateResult(
      [cult, prophet, ...newCultists],
      relationships,
      `A mystical cult forms near ${location.name} with ${totalCultists} followers${creationNote}`
    );
  }
};
