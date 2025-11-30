/**
 * Orca Raider Arrival Template
 *
 * Strategy-based template for external threat (orca) invasions.
 *
 * Pipeline:
 *   1. Applicability: era_match(invasion) OR pressure_threshold(external_threat, 70) AND NOT saturated(npc/orca)
 *   2. Selection: by_kind(location/colony) as targets
 *   3. Creation: batch_varied orcas with z-axis adjustment (underwater)
 *   4. Relationships: conflict(enemy_of), cultural(practitioner_of), lineage(inspired_by)
 */

import { GrowthTemplate, TemplateResult, ComponentPurpose } from '@lore-weave/core';
import { TemplateGraphView } from '@lore-weave/core';
import { HardState, Relationship } from '@lore-weave/core';
import { pickRandom, pickMultiple, hasTag, extractParams } from '@lore-weave/core';

import {
  // Step 1: Applicability
  checkEraMatch,
  checkNotSaturated,
  // Step 2: Selection
  selectByKind,
  // Step 3: Creation
  createEntityPartial,
  applyZAdjustment,
  randomCount,
  // Step 4: Relationships
  createRelationship,
  createLineageRelationship,
  // Result helpers
  emptyResult,
  templateResult
} from '../../utils/strategyExecutors';

export const orcaRaiderArrival: GrowthTemplate = {
  id: 'orca_raider_arrival',
  name: 'Orca Raiders Arrive',

  contract: {
    purpose: ComponentPurpose.ENTITY_CREATION,
    enabledBy: {
      pressures: [
        { name: 'external_threat', threshold: 0 }
      ],
      era: ['invasion']
    },
    affects: {
      entities: [
        { kind: 'npc', operation: 'create', count: { min: 1, max: 2 } }
      ],
      relationships: [
        { kind: 'enemy_of', operation: 'create', count: { min: 1, max: 4 } },
        { kind: 'practitioner_of', operation: 'create', count: { min: 0, max: 2 } },
        { kind: 'inspired_by', operation: 'create', count: { min: 0, max: 1 } }
      ],
      pressures: [
        { name: 'external_threat', delta: 10 },
        { name: 'conflict', delta: 5 }
      ],
      tags: [
        { operation: 'add', pattern: 'external' },
        { operation: 'add', pattern: 'invader' }
      ]
    }
  },

  metadata: {
    produces: {
      entityKinds: [
        {
          kind: 'npc',
          subtype: 'orca',
          count: { min: 1, max: 2 },
          prominence: [
            { level: 'marginal', probability: 0.6 },
            { level: 'recognized', probability: 0.3 },
            { level: 'renowned', probability: 0.1 }
          ],
        },
      ],
      relationships: [
        { kind: 'enemy_of', category: 'conflict', probability: 0.9, comment: 'Orcas vs colonies and heroes' },
        { kind: 'practitioner_of', category: 'cultural', probability: 0.7, comment: 'Orcas use abilities' },
      ],
    },
    effects: {
      graphDensity: 0.4,
      clusterFormation: 0.2,
      diversityImpact: 0.8,
      comment: 'Injects external threat cluster into the world',
    },
    tags: ['external-threat', 'invasion', 'cluster'],
  },

  // =========================================================================
  // STEP 1: APPLICABILITY - era_match OR pressure AND NOT saturated
  // =========================================================================
  canApply: (graphView: TemplateGraphView) => {
    const externalThreat = graphView.getPressure('external_threat') || 0;

    // Strategy: era_match(invasion) OR pressure_threshold(70)
    const invasionEra = checkEraMatch(graphView, ['invasion']);
    if (!invasionEra && externalThreat < 70) {
      return false;
    }

    // Strategy: NOT saturated(npc, orca)
    if (!checkNotSaturated(graphView, 'npc', 'orca', 5)) {
      return false;
    }

    return true;
  },

  // =========================================================================
  // STEP 2: SELECTION - colonies to threaten
  // =========================================================================
  findTargets: (graphView: TemplateGraphView) => {
    // Strategy: by_kind(location/colony)
    return selectByKind(graphView, 'location', ['colony']);
  },

  // =========================================================================
  // STEPS 3-4: CREATION & RELATIONSHIPS
  // =========================================================================
  expand: (graphView: TemplateGraphView, target?: HardState): TemplateResult => {
    const colony = target || pickRandom(selectByKind(graphView, 'location', ['colony']));

    if (!colony) {
      return emptyResult('Cannot spawn orca raiders - no colonies exist');
    }

    // ------- STEP 3: CREATION -------

    const raiderCount = randomCount(1, 2);
    const entities: Partial<HardState>[] = [];
    const relationships: Relationship[] = [];

    // Find existing orcas for lineage
    const existingOrcas = graphView.findEntities({ kind: 'npc', subtype: 'orca' });
    let relatedOrca: HardState | undefined;
    if (existingOrcas.length > 0 && Math.random() < 0.5) {
      relatedOrca = pickRandom(existingOrcas);
    }

    const orcaTags = { orca: true, raider: true, 'external-threat': true, predator: true, underwater: true };

    for (let i = 0; i < raiderCount; i++) {
      const prominence = Math.random() < 0.1 ? 'renowned'
                       : Math.random() < 0.3 ? 'recognized'
                       : 'marginal';

      // Derive coordinates using orca culture
      const placementResult = graphView.deriveCoordinatesWithCulture('orca', 'npc', [colony]);
      const baseCoords = placementResult?.coordinates;

      // Strategy: applyZAdjustment for underwater placement
      const orcaCoords = baseCoords
        ? applyZAdjustment(baseCoords, { min: 10, max: 30 })
        : { x: 50, y: 50, z: 20 };

      // Strategy: createEntityPartial
      entities.push(createEntityPartial('npc', 'orca', {
        status: 'alive',
        prominence,
        culture: 'orca',
        description: `A fearsome orca raider threatening ${colony.name} from the depths`,
        tags: orcaTags,
        coordinates: orcaCoords
      }));

      // ------- STEP 4: RELATIONSHIPS -------

      // Strategy: lineage(inspired_by) for first orca if related
      if (relatedOrca && i === 0) {
        relationships.push(
          createLineageRelationship('inspired_by', 'will-be-assigned-0', relatedOrca.id, { min: 0.2, max: 0.4 }, 0.7)
        );
      }
    }

    // Find heroes and leaders to oppose
    const heroes = graphView.findEntities({ kind: 'npc', subtype: 'hero' });
    const mayors = graphView.findEntities({ kind: 'npc', subtype: 'mayor' });
    const defenders = [...heroes, ...mayors];

    if (defenders.length > 0) {
      const defendingPenguins = pickMultiple(defenders, Math.min(raiderCount + 1, defenders.length));
      for (let i = 0; i < raiderCount && i < defendingPenguins.length; i++) {
        // Strategy: conflict(enemy_of)
        relationships.push(
          createRelationship('enemy_of', `will-be-assigned-${i}`, defendingPenguins[i].id)
        );
      }
    }

    // Orcas might also be enemies of factions
    const factions = graphView.findEntities({ kind: 'faction' });
    if (factions.length > 0 && Math.random() < 0.5) {
      relationships.push(
        createRelationship('enemy_of', 'will-be-assigned-0', pickRandom(factions).id)
      );
    }

    // Give orcas combat abilities
    const combatAbilities = graphView.findEntities({ kind: 'abilities' })
      .filter(a => hasTag(a.tags, 'combat') || hasTag(a.tags, 'offensive'));

    if (combatAbilities.length > 0) {
      const ability = pickRandom(combatAbilities);
      for (let i = 0; i < raiderCount; i++) {
        if (Math.random() < 0.7) {
          // Strategy: cultural(practitioner_of)
          relationships.push(
            createRelationship('practitioner_of', `will-be-assigned-${i}`, ability.id)
          );
        }
      }
    }

    const lineageDesc = relatedOrca ? ` (from ${relatedOrca.name}'s pod)` : '';
    const description = raiderCount === 1
      ? `An orca raider surfaces near ${colony.name}, threatening the colony from the depths${lineageDesc}`
      : `A pod of ${raiderCount} orca raiders threatens ${colony.name} from the underwater passages${lineageDesc}`;

    return templateResult(entities, relationships, description);
  }
};
