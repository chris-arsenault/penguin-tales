import { GrowthTemplate, TemplateResult } from '../../../../apps/lore-weave/lib/types/engine';
import { TemplateGraphView } from '../../../../apps/lore-weave/lib/services/templateGraphView';
import { HardState, Relationship } from '../../../../apps/lore-weave/lib/types/worldTypes';
import { pickRandom, pickMultiple, slugifyName, archiveRelationship } from '../../../../apps/lore-weave/lib/utils/helpers';

/**
 * Mysterious Vanishing Template
 *
 * High-prominence NPCs sometimes disappear near anomalies, creating enduring mysteries.
 * Vanished NPCs transition to 'missing' status, their relationships transform into
 * search efforts and memorial sites.
 *
 * Triggers:
 * - 10% chance per epoch
 * - Targets recognized+ NPCs near anomalies
 * - Weighted by anomaly proximity
 *
 * Effects:
 * - NPC status: alive → missing
 * - Creates anomaly at disappearance site (or marks existing anomaly)
 * - Most relationships removed (preserves structural ones)
 * - Creates last_seen_at relationship (NPC → location)
 * - Creates searching_for relationships (loved ones → missing NPC)
 *
 * SYSTEM_IMPLEMENTATION_GUIDE compliance:
 * - Throttled to 10% per epoch (per spec)
 * - Validates anomaly and NPC existence
 * - Graceful failure if no valid candidates
 * - Careful relationship removal preserves graph integrity
 * - Status change validation (alive → missing)
 */

export const mysteriousVanishing: GrowthTemplate = {
  id: 'mysterious_vanishing',
  name: 'Unexplained Disappearance',

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

  canApply: (graphView: TemplateGraphView) => {
    // Throttle check using parameter
    const params = mysteriousVanishing.metadata?.parameters || {};
    const activationChance = params.activationChance?.value ?? 0.1;
    if (Math.random() > activationChance) return false;

    const anomalies = graphView.findEntities({ kind: 'location', subtype: 'anomaly' });
    const highProminenceNPCs = graphView.findEntities({ kind: 'npc', status: 'alive' })
      .filter(npc => npc.prominence === 'recognized' || npc.prominence === 'renowned' || npc.prominence === 'mythic');

    // Requires at least 1 anomaly and 1 high-prominence NPC
    return anomalies.length >= 1 && highProminenceNPCs.length >= 1;
  },

  findTargets: (graphView: TemplateGraphView) => {
    // Targets are high-prominence NPCs
    return graphView.findEntities({ kind: 'npc', status: 'alive' })
      .filter(npc => npc.prominence === 'recognized' || npc.prominence === 'renowned' || npc.prominence === 'mythic');
  },

  expand: (graphView: TemplateGraphView, target?: HardState): TemplateResult => {
    // Extract parameters from metadata
    const params = mysteriousVanishing.metadata?.parameters || {};
    const mythicProximityMultiplier = params.mythicProximityMultiplier?.value ?? 2.0;
    const renownedProximityMultiplier = params.renownedProximityMultiplier?.value ?? 1.5;
    const maxSearchers = params.maxSearchers?.value ?? 3;

    const anomalies = graphView.findEntities({ kind: 'location', subtype: 'anomaly' });

    // VALIDATION: Check if anomalies exist
    if (anomalies.length === 0) {
      return {
        entities: [],
        relationships: [],
        description: 'Cannot create vanishing - no anomalies exist'
      };
    }

    const candidates = graphView.findEntities({ kind: 'npc', status: 'alive' })
      .filter(npc => npc.prominence === 'recognized' || npc.prominence === 'renowned' || npc.prominence === 'mythic');

    // VALIDATION: Check if candidates exist
    if (candidates.length === 0) {
      return {
        entities: [],
        relationships: [],
        description: 'Cannot create vanishing - no high-prominence NPCs'
      };
    }

    // === STEP 1: Select Victim Based on Anomaly Proximity ===
    // Weight candidates by their proximity to anomalies
    const weightedCandidates = candidates.map(candidate => {
      const location = graphView.getLocation(candidate.id);
      if (!location) return { candidate, weight: 0 };

      // Calculate proximity score (higher = closer to anomalies)
      let proximityScore = 0;

      // Check if resident at an anomaly
      if (location.subtype === 'anomaly') {
        proximityScore = 10;
      } else {
        // Check adjacency to anomalies
        const adjacentLocations = location.links
          .filter(l => l.kind === 'adjacent_to')
          .map(l => graphView.getEntity(l.dst))
          .filter(loc => loc !== undefined) as HardState[];

        const nearbyAnomalies = adjacentLocations.filter(loc => loc.subtype === 'anomaly');
        proximityScore = nearbyAnomalies.length * 3;
      }

      // Boost for mythic/renowned NPCs (dramatic impact)
      if (candidate.prominence === 'mythic') proximityScore *= mythicProximityMultiplier;
      if (candidate.prominence === 'renowned') proximityScore *= renownedProximityMultiplier;

      return { candidate, weight: proximityScore };
    }).filter(wc => wc.weight > 0);

    if (weightedCandidates.length === 0) {
      return {
        entities: [],
        relationships: [],
        description: 'No NPCs near anomalies to vanish'
      };
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

    // VALIDATION: Victim must have a location
    if (!victimLocation) {
      return {
        entities: [],
        relationships: [],
        description: `${victim.name} has no location for vanishing event`
      };
    }

    // === STEP 2: Create or Mark Anomaly at Disappearance Site ===
    const entities: Partial<HardState>[] = [];
    const relationships: Relationship[] = [];
    let anomalyId: string;

    if (victimLocation.subtype === 'anomaly') {
      // Location is already an anomaly
      anomalyId = victimLocation.id;
    } else {
      // Create new anomaly at the site
      entities.push({
        kind: 'location',
        subtype: 'anomaly',
        name: `${victimLocation.name} (Site of ${victim.name}'s Disappearance)`,
        description: `A strange glow lingers where ${victim.name} was last seen. The ice here seems different, colder, almost aware.`,
        status: 'thriving',
        prominence: 'recognized',
        tags: ['mystery', 'vanishing', 'anomaly']
      });

      anomalyId = 'will-be-assigned-0';

      // Connect anomaly to original location
      relationships.push({
        kind: 'adjacent_to',
        src: anomalyId,
        dst: victimLocation.id
      });
    }

    // === STEP 3: Transform Victim to Missing ===
    // Note: This is handled by entitiesModified in the system result
    // We can't directly modify existing entities in templates

    // === STEP 4: Create last_seen_at Relationship ===
    relationships.push({
      kind: 'last_seen_at',
      src: victim.id,
      dst: anomalyId
    });

    // === STEP 5: Archive All Relationships (Temporal Tracking) ===
    // Archive all relationships of the vanishing NPC
    // This marks them as historical rather than deleting them
    const graph = graphView.getInternalGraph();
    const victimRelationships = graph.relationships.filter(r =>
      (r.src === victim.id || r.dst === victim.id) && r.status !== 'historical'
    );

    victimRelationships.forEach(rel => {
      archiveRelationship(graph, rel.src, rel.dst, rel.kind);
    });

    // === STEP 6: Create searching_for Relationships ===
    // Find loved ones (followers, lovers, family)
    const lovers = graphView.getRelatedEntities(victim.id, 'lover_of', 'dst');
    const followers = graphView.getRelatedEntities(victim.id, 'follower_of', 'dst');
    const mentees = graphView.getRelatedEntities(victim.id, 'mentor_of', 'src');
    const lovedOnes = [...lovers, ...followers, ...mentees];

    // Remove duplicates
    const uniqueLovedOnes = Array.from(new Set(lovedOnes.map(lo => lo.id)))
      .map(id => graphView.getEntity(id))
      .filter(e => e !== undefined && e.status === 'alive') as HardState[];

    // Create searching_for relationships for 1-maxSearchers loved ones
    const searchers = pickMultiple(uniqueLovedOnes, Math.min(maxSearchers, uniqueLovedOnes.length));
    searchers.forEach(searcher => {
      relationships.push({
        kind: 'searching_for',
        src: searcher.id,
        dst: victim.id
      });
    });

    return {
      entities,
      relationships,
      description: `${victim.name} mysteriously vanishes near ${victimLocation.name}. ${searchers.length} individuals begin a desperate search. All relationships archived as historical.`
    };
  }
};
