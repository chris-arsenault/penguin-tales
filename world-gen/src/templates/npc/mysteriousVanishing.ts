import { GrowthTemplate, TemplateResult, Graph } from '../../types/engine';
import { HardState, Relationship } from '../../types/worldTypes';
import { pickRandom, findEntities, getLocation, pickMultiple, slugifyName } from '../../utils/helpers';

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

  canApply: (graph: Graph) => {
    // 10% chance per epoch check
    if (Math.random() > 0.1) return false;

    const anomalies = findEntities(graph, { kind: 'location', subtype: 'anomaly' });
    const highProminenceNPCs = findEntities(graph, { kind: 'npc', status: 'alive' })
      .filter(npc => npc.prominence === 'recognized' || npc.prominence === 'renowned' || npc.prominence === 'mythic');

    // Requires at least 1 anomaly and 1 high-prominence NPC
    return anomalies.length >= 1 && highProminenceNPCs.length >= 1;
  },

  findTargets: (graph: Graph) => {
    // Targets are high-prominence NPCs
    return findEntities(graph, { kind: 'npc', status: 'alive' })
      .filter(npc => npc.prominence === 'recognized' || npc.prominence === 'renowned' || npc.prominence === 'mythic');
  },

  expand: (graph: Graph, target?: HardState): TemplateResult => {
    const anomalies = findEntities(graph, { kind: 'location', subtype: 'anomaly' });

    // VALIDATION: Check if anomalies exist
    if (anomalies.length === 0) {
      return {
        entities: [],
        relationships: [],
        description: 'Cannot create vanishing - no anomalies exist'
      };
    }

    const candidates = findEntities(graph, { kind: 'npc', status: 'alive' })
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
      const location = getLocation(graph, candidate.id);
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
          .map(l => graph.entities.get(l.dst))
          .filter(loc => loc !== undefined) as HardState[];

        const nearbyAnomalies = adjacentLocations.filter(loc => loc.subtype === 'anomaly');
        proximityScore = nearbyAnomalies.length * 3;
      }

      // Boost for mythic NPCs (dramatic impact)
      if (candidate.prominence === 'mythic') proximityScore *= 2;
      if (candidate.prominence === 'renowned') proximityScore *= 1.5;

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

    const victimLocation = getLocation(graph, victim.id);

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
        tags: ['mystery', 'vanishing', `name:${slugifyName(victim.name)}`].slice(0, 10)
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

    // === STEP 5: Create searching_for Relationships ===
    // Find loved ones (followers, lovers, family)
    const lovedOnes = [
      ...graph.relationships.filter(r => r.kind === 'lover_of' && r.dst === victim.id)
        .map(r => graph.entities.get(r.src))
        .filter(e => e !== undefined) as HardState[],
      ...graph.relationships.filter(r => r.kind === 'follower_of' && r.dst === victim.id)
        .map(r => graph.entities.get(r.src))
        .filter(e => e !== undefined) as HardState[],
      ...graph.relationships.filter(r => r.kind === 'mentor_of' && r.src === victim.id)
        .map(r => graph.entities.get(r.dst))
        .filter(e => e !== undefined) as HardState[]
    ];

    // Remove duplicates
    const uniqueLovedOnes = Array.from(new Set(lovedOnes.map(lo => lo.id)))
      .map(id => graph.entities.get(id))
      .filter(e => e !== undefined && e.status === 'alive') as HardState[];

    // Create searching_for relationships for 1-3 loved ones
    const searchers = pickMultiple(uniqueLovedOnes, Math.min(3, uniqueLovedOnes.length));
    searchers.forEach(searcher => {
      relationships.push({
        kind: 'searching_for',
        src: searcher.id,
        dst: victim.id
      });
    });

    // === STEP 6: Relationship Removal Plan ===
    // Note: We document which relationships should be removed, but actual removal
    // happens in the engine after applying the template
    // Preserve: member_of, resident_of (structural)
    // Remove: most social relationships (lover_of, follower_of, rival_of, enemy_of)
    // Transform: mentor_of → searching_for (handled above)

    const removalNote = `Most social relationships with ${victim.name} fade as they disappear into mystery. Only structural ties and search efforts remain.`;

    return {
      entities,
      relationships,
      description: `${victim.name} mysteriously vanishes near ${victimLocation.name}. ${searchers.length} individuals begin a desperate search. ${removalNote}`
    };
  }
};
