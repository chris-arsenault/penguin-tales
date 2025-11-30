/**
 * Magic Discovery Template
 *
 * Strategy-based template for heroes discovering magical abilities.
 *
 * Pipeline:
 *   1. Applicability: pressure_threshold(magical_instability, 10-70) AND NOT saturated(abilities/magic)
 *   2. Selection: by_kind(npc/hero) with relationship filter (max discoveries)
 *   3. Creation: near_reference with lineage
 *   4. Relationships: discovery(discoverer_of), spatial(manifests_at), lineage(related_to)
 */

import { GrowthTemplate, TemplateResult, ComponentPurpose } from '@lore-weave/core';
import { TemplateGraphView } from '@lore-weave/core';
import { HardState, Relationship } from '@lore-weave/core';
import { pickRandom } from '@lore-weave/core';

import {
  // Step 1: Applicability
  checkPressureThreshold,
  checkNotSaturated,
  checkEntityCountMin,
  // Step 2: Selection
  selectByKind,
  selectByRelationship,
  // Step 3: Creation
  deriveCoordinatesNearReference,
  createEntityPartial,
  findLineageCandidates,
  // Step 4: Relationships
  createRelationship,
  createLineageRelationship,
  // Result helpers
  emptyResult,
  templateResult
} from '../../utils/strategyExecutors';

export const magicDiscovery: GrowthTemplate = {
  id: 'magic_discovery',
  name: 'Magical Discovery',

  contract: {
    purpose: ComponentPurpose.ENTITY_CREATION,
    enabledBy: {
      entityCounts: [
        { kind: 'location', min: 1 },
        { kind: 'npc', min: 1 }
      ],
      pressures: [
        { name: 'magical_instability', threshold: 10 }
      ]
    },
    affects: {
      entities: [
        { kind: 'abilities', operation: 'create', count: { min: 1, max: 1 } }
      ],
      relationships: [
        { kind: 'discoverer_of', operation: 'create', count: { min: 1, max: 1 } },
        { kind: 'manifests_at', operation: 'create', count: { min: 0, max: 1 } },
        { kind: 'related_to', operation: 'create', count: { min: 0, max: 1 } }
      ]
    }
  },

  metadata: {
    produces: {
      entityKinds: [
        {
          kind: 'abilities',
          subtype: 'magic',
          count: { min: 1, max: 1 },
          prominence: [{ level: 'recognized', probability: 1.0 }],
        },
      ],
      relationships: [
        { kind: 'discoverer_of', category: 'immutable_fact', probability: 1.0, comment: 'Hero discovers magic' },
        { kind: 'manifests_at', category: 'immutable_fact', probability: 1.0, comment: 'Magic manifests at anomaly' },
        { kind: 'related_to', category: 'immutable_fact', probability: 0.7, comment: 'Related to existing magic' },
      ],
    },
    effects: {
      graphDensity: 0.3,
      clusterFormation: 0.4,
      diversityImpact: 0.9,
      comment: 'Creates mystical abilities linked to anomalies and heroes',
    },
    parameters: {
      maxDiscoveriesPerHero: {
        value: 2,
        min: 1,
        max: 5,
        description: 'Maximum abilities a single hero can discover',
      },
    },
    tags: ['mystical', 'ability-creation'],
  },

  // =========================================================================
  // STEP 1: APPLICABILITY - pressure + entity requirements + saturation
  // =========================================================================
  canApply: (graphView: TemplateGraphView) => {
    const anomalyCount = graphView.getEntityCount('location', 'anomaly');
    const magicalInstability = graphView.getPressure('magical_instability') || 0;

    // Need at least 10 instability to discover magic
    if (magicalInstability < 10) {
      return false;
    }

    // Need anomalies for low-instability discovery (unless very high instability)
    if (anomalyCount === 0 && magicalInstability < 30) {
      return false;
    }

    // Strategy: pressure_threshold(magical_instability, 10, 70, extremeChance=0.4)
    if (!checkPressureThreshold(graphView, 'magical_instability', 10, 70, 0.4)) {
      return false;
    }

    // Strategy: NOT saturated(abilities, magic)
    if (!checkNotSaturated(graphView, 'abilities', 'magic', 15)) {
      return false;
    }

    return true;
  },

  // =========================================================================
  // STEP 2: SELECTION - heroes with discovery limit
  // =========================================================================
  findTargets: (graphView: TemplateGraphView) => {
    const maxDiscoveriesPerHero = 2;

    // Strategy: by_kind(npc/hero)
    const heroes = selectByKind(graphView, 'npc', ['hero']);

    // Strategy: by_relationship filter (max discoveries)
    return heroes.filter(hero => {
      const discoveryCount = graphView.getAllRelationships().filter(r =>
        r.kind === 'discoverer_of' && r.src === hero.id
      ).length;
      return discoveryCount < maxDiscoveriesPerHero;
    });
  },

  // =========================================================================
  // STEPS 3-4: CREATION & RELATIONSHIPS
  // =========================================================================
  expand: (graphView: TemplateGraphView, target?: HardState): TemplateResult => {
    // Resolve target
    const hero = target || pickRandom(selectByKind(graphView, 'npc', ['hero']));
    const anomaly = pickRandom(selectByKind(graphView, 'location', ['anomaly']));

    if (!hero) {
      return emptyResult('Cannot discover magic - no heroes exist');
    }

    // ------- STEP 3: CREATION - with lineage -------

    // Find reference entities for coordinate placement
    const referenceEntities: HardState[] = [hero];
    if (anomaly) referenceEntities.push(anomaly);

    // Strategy: deriveCoordinatesNearReference
    const culture = hero.culture || anomaly?.culture || 'world';
    const coords = deriveCoordinatesNearReference(graphView, 'abilities', referenceEntities, culture);

    // Strategy: findLineageCandidates for related_to
    const lineageCandidates = findLineageCandidates(
      graphView,
      'abilities', 'magic',
      ['lost'],  // Exclude lost abilities
      hero      // Prefer same location
    );

    // Strategy: createEntityPartial
    const magicAbility = createEntityPartial('abilities', 'magic', {
      status: 'emergent',
      prominence: 'recognized',
      culture,
      description: `Mystical ability discovered by ${hero.name}`,
      tags: { magic: true, mystical: true },
      coordinates: coords
    });

    // ------- STEP 4: RELATIONSHIPS -------

    const relationships: Relationship[] = [];

    // Strategy: discovery(discoverer_of)
    relationships.push(
      createRelationship('discoverer_of', hero.id, 'will-be-assigned-0')
    );

    // Strategy: spatial(manifests_at) - conditional on anomaly
    if (anomaly) {
      relationships.push(
        createRelationship('manifests_at', 'will-be-assigned-0', anomaly.id)
      );
    }

    // Strategy: lineage(related_to) with distance 0.5-0.9 (diverse traditions)
    if (lineageCandidates.length > 0) {
      const lineageTarget = pickRandom(lineageCandidates);
      relationships.push(
        createLineageRelationship(
          'related_to',
          'will-be-assigned-0',
          lineageTarget.id,
          { min: 0.5, max: 0.9 },
          0.5
        )
      );
    }

    // Build description
    const locationDesc = anomaly ? ` at ${anomaly.name}` : ' through mystical insight';
    const lineageDesc = lineageCandidates.length > 0 ? ' related to existing magic' : '';

    return templateResult(
      [magicAbility],
      relationships,
      `${hero.name} discovers a mystical ability${locationDesc}${lineageDesc}`
    );
  }
};
