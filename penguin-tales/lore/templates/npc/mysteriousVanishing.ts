/**
 * Mysterious Vanishing Template
 *
 * Strategy-based template for high-prominence NPCs disappearing near anomalies.
 *
 * Pipeline:
 *   1. Applicability: random_chance(0.1) AND entity_count_min(anomaly, 1) AND prominence_filter
 *   2. Selection: by_prominence(recognized+) with weighted_random by anomaly proximity
 *   3. Creation: optional anomaly at disappearance site
 *   4. Relationships: spatial(last_seen_at, adjacent_to), social(searching_for)
 *   5. State: archive_relationship for victim's relationships
 */

import { GrowthTemplate, TemplateResult, ComponentPurpose } from '@lore-weave/core';
import { TemplateGraphView } from '@lore-weave/core';
import { HardState, Relationship } from '@lore-weave/core';
import { pickRandom, pickMultiple, extractParams } from '@lore-weave/core';

import {
  // Step 1: Applicability
  checkRandomChance,
  checkEntityCountMin,
  // Step 2: Selection
  selectByProminence,
  // Step 3: Creation
  createEntityPartial,
  // Step 4: Relationships
  createRelationship,
  // Result helpers
  emptyResult,
  templateResult
} from '../../utils/strategyExecutors';

export const mysteriousVanishing: GrowthTemplate = {
  id: 'mysterious_vanishing',
  name: 'Unexplained Disappearance',

  contract: {
    purpose: ComponentPurpose.ENTITY_CREATION,
    enabledBy: {
      entityCounts: [
        { kind: 'location', min: 1 }
      ]
    },
    affects: {
      entities: [
        { kind: 'location', operation: 'create', count: { min: 0, max: 1 } }
      ],
      relationships: [
        { kind: 'last_seen_at', operation: 'create', count: { min: 1, max: 1 } },
        { kind: 'searching_for', operation: 'create', count: { min: 0, max: 3 } },
        { kind: 'adjacent_to', operation: 'create', count: { min: 0, max: 1 } }
      ]
    }
  },

  metadata: {
    produces: {
      entityKinds: [
        {
          kind: 'location',
          subtype: 'anomaly',
          count: { min: 0, max: 1 },
          prominence: [{ level: 'recognized', probability: 1.0 }],
        },
      ],
      relationships: [
        { kind: 'last_seen_at', category: 'spatial', probability: 1.0, comment: 'Victim linked to disappearance site' },
        { kind: 'searching_for', category: 'social', probability: 2.0, comment: '1-3 loved ones search' },
        { kind: 'adjacent_to', category: 'spatial', probability: 0.5, comment: 'New anomaly adjacent to location' },
      ],
    },
    effects: {
      graphDensity: 0.1,
      clusterFormation: 0.2,
      diversityImpact: 0.7,
      comment: 'Creates mystery nodes with searcher connections; changes NPC status to missing',
    },
    parameters: {
      activationChance: {
        value: 0.1,
        min: 0.01,
        max: 0.5,
        description: 'Probability this template activates per epoch (throttle)',
      },
      mythicProximityMultiplier: {
        value: 2.0,
        min: 1.0,
        max: 5.0,
        description: 'Weight multiplier for mythic NPCs near anomalies',
      },
      renownedProximityMultiplier: {
        value: 1.5,
        min: 1.0,
        max: 3.0,
        description: 'Weight multiplier for renowned NPCs near anomalies',
      },
      maxSearchers: {
        value: 3,
        min: 1,
        max: 10,
        description: 'Maximum number of loved ones who search for victim',
      },
    },
    tags: ['mystery', 'rare-event', 'status-changing'],
  },

  // =========================================================================
  // STEP 1: APPLICABILITY - random_chance AND entity requirements
  // =========================================================================
  canApply: (graphView: TemplateGraphView) => {
    const { activationChance } = extractParams(mysteriousVanishing.metadata, { activationChance: 0.1 });

    // Strategy: random_chance
    if (!checkRandomChance(activationChance)) {
      return false;
    }

    // Strategy: entity_count_min(anomaly, 1)
    if (!checkEntityCountMin(graphView, 'location', 'anomaly', 1)) {
      return false;
    }

    // Strategy: by_prominence filter - need high-prominence NPCs
    const highProminenceNPCs = selectByProminence(graphView, 'npc', 'recognized')
      .filter(npc => npc.status === 'alive');

    return highProminenceNPCs.length >= 1;
  },

  // =========================================================================
  // STEP 2: SELECTION - high-prominence NPCs
  // =========================================================================
  findTargets: (graphView: TemplateGraphView) => {
    // Strategy: by_prominence(recognized+)
    return selectByProminence(graphView, 'npc', 'recognized')
      .filter(npc => npc.status === 'alive');
  },

  // =========================================================================
  // STEPS 3-5: CREATION, RELATIONSHIPS, STATE
  // =========================================================================
  expand: (graphView: TemplateGraphView, target?: HardState): TemplateResult => {
    const { mythicProximityMultiplier, renownedProximityMultiplier, maxSearchers } = extractParams(
      mysteriousVanishing.metadata,
      { mythicProximityMultiplier: 2.0, renownedProximityMultiplier: 1.5, maxSearchers: 3 }
    );

    const anomalies = graphView.findEntities({ kind: 'location', subtype: 'anomaly' });

    if (anomalies.length === 0) {
      return emptyResult('Cannot create vanishing - no anomalies exist');
    }

    const candidates = selectByProminence(graphView, 'npc', 'recognized')
      .filter(npc => npc.status === 'alive');

    if (candidates.length === 0) {
      return emptyResult('Cannot create vanishing - no high-prominence NPCs');
    }

    // ------- STEP 2: WEIGHTED SELECTION -------

    // Strategy: weighted_random by anomaly proximity
    const weightedCandidates = candidates.map(candidate => {
      const location = graphView.getLocation(candidate.id);
      if (!location) return { candidate, weight: 0 };

      let proximityScore = 0;

      if (location.subtype === 'anomaly') {
        proximityScore = 10;
      } else {
        const adjacentLocations = location.links
          .filter(l => l.kind === 'adjacent_to')
          .map(l => graphView.getEntity(l.dst))
          .filter(loc => loc !== undefined) as HardState[];

        const nearbyAnomalies = adjacentLocations.filter(loc => loc.subtype === 'anomaly');
        proximityScore = nearbyAnomalies.length * 3;
      }

      if (candidate.prominence === 'mythic') proximityScore *= mythicProximityMultiplier;
      if (candidate.prominence === 'renowned') proximityScore *= renownedProximityMultiplier;

      return { candidate, weight: proximityScore };
    }).filter(wc => wc.weight > 0);

    if (weightedCandidates.length === 0) {
      return emptyResult('No NPCs near anomalies to vanish');
    }

    // Weighted random selection
    const totalWeight = weightedCandidates.reduce((sum, wc) => sum + wc.weight, 0);
    let roll = Math.random() * totalWeight;
    let victim = weightedCandidates[0].candidate;

    for (const wc of weightedCandidates) {
      roll -= wc.weight;
      if (roll <= 0) {
        victim = wc.candidate;
        break;
      }
    }

    const victimLocation = graphView.getLocation(victim.id);

    if (!victimLocation) {
      return emptyResult(`${victim.name} has no location for vanishing event`);
    }

    // ------- STEP 3: CREATION -------

    const entities: Partial<HardState>[] = [];
    const relationships: Relationship[] = [];
    let anomalyId: string;

    if (victimLocation.subtype === 'anomaly') {
      anomalyId = victimLocation.id;
    } else {
      // Strategy: createEntityPartial for new anomaly
      entities.push(createEntityPartial('location', 'anomaly', {
        status: 'thriving',
        prominence: 'recognized',
        culture: victimLocation.culture,
        description: `A strange glow lingers where ${victim.name} was last seen. The ice here seems different, colder, almost aware.`,
        tags: { mystery: true, vanishing: true, anomaly: true }
      }));

      anomalyId = 'will-be-assigned-0';

      // Strategy: spatial(adjacent_to)
      relationships.push(
        createRelationship('adjacent_to', anomalyId, victimLocation.id)
      );
    }

    // ------- STEP 4: RELATIONSHIPS -------

    // Strategy: spatial(last_seen_at)
    relationships.push(
      createRelationship('last_seen_at', victim.id, anomalyId)
    );

    // ------- STEP 5: STATE - archive victim's relationships -------

    const victimRelationships = graphView.getAllRelationships().filter(r =>
      (r.src === victim.id || r.dst === victim.id) && r.status !== 'historical'
    );

    victimRelationships.forEach(rel => {
      graphView.archiveRelationship(rel.src, rel.dst, rel.kind);
    });

    // Find loved ones for searching_for relationships
    const lovers = graphView.getRelatedEntities(victim.id, 'lover_of', 'dst');
    const followers = graphView.getRelatedEntities(victim.id, 'follower_of', 'dst');
    const mentees = graphView.getRelatedEntities(victim.id, 'mentor_of', 'src');
    const lovedOnes = [...lovers, ...followers, ...mentees];

    const uniqueLovedOnes = Array.from(new Set(lovedOnes.map(lo => lo.id)))
      .map(id => graphView.getEntity(id))
      .filter(e => e !== undefined && e.status === 'alive') as HardState[];

    // Strategy: social(searching_for)
    const searchers = pickMultiple(uniqueLovedOnes, Math.min(maxSearchers, uniqueLovedOnes.length));
    searchers.forEach(searcher => {
      relationships.push(
        createRelationship('searching_for', searcher.id, victim.id)
      );
    });

    return templateResult(
      entities,
      relationships,
      `${victim.name} mysteriously vanishes near ${victimLocation.name}. ${searchers.length} individuals begin a desperate search. All relationships archived as historical.`
    );
  }
};
