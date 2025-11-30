/**
 * Krill Bloom Migration Template
 *
 * Strategy-based template for resource node creation at frontier locations.
 *
 * Pipeline:
 *   1. Applicability: pressure_threshold(scarcity, 60) OR random_chance(0.05)
 *                     AND entity_count_min(colony, 2) AND entity_count_max(bloom, 10)
 *   2. Selection: by_kind(location/colony)
 *   3. Creation: voronoi_frontier placement with batch_varied blooms
 *   4. Relationships: spatial(adjacent_to), discovery(explorer_of, discoverer_of)
 *
 * Mathematical Foundation:
 * Voronoi cell boundary: V_i = {x : d(x, colony_i) < d(x, colony_j) ∀j ≠ i}
 * Placement score: score(x) = min_i(d(x, colony_i)) * resource_potential(x)
 */

import { GrowthTemplate, TemplateResult, ComponentPurpose } from '@lore-weave/core';
import { TemplateGraphView } from '@lore-weave/core';
import { HardState, Relationship } from '@lore-weave/core';
import { pickRandom, pickMultiple, hasTag, extractParams } from '@lore-weave/core';

import {
  // Step 1: Applicability
  checkPressureThreshold,
  checkRandomChance,
  checkEntityCountMin,
  checkNotSaturated,
  // Step 2: Selection
  selectByKind,
  // Step 3: Creation
  createEntityPartial,
  deriveCoordinatesNearReference,
  randomCount,
  // Step 4: Relationships
  createRelationship,
  // Result helpers
  emptyResult,
  templateResult
} from '../../utils/strategyExecutors';

// Helper: Calculate graph distance (BFS)
function graphDistance(graphView: TemplateGraphView, from: string, to: string): number {
  if (from === to) return 0;

  const visited = new Set<string>();
  const queue: Array<{ id: string; distance: number }> = [{ id: from, distance: 0 }];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current.id === to) return current.distance;

    if (visited.has(current.id)) continue;
    visited.add(current.id);

    const entity = graphView.getEntity(current.id);
    if (!entity) continue;

    entity.links
      .filter(l => l.kind === 'adjacent_to')
      .forEach(link => {
        if (!visited.has(link.dst)) {
          queue.push({ id: link.dst, distance: current.distance + 1 });
        }
      });
  }

  return Infinity; // Unreachable
}

export const krillBloomMigration: GrowthTemplate = {
  id: 'krill_bloom_migration',
  name: 'Krill Bloom Discovery',

  contract: {
    purpose: ComponentPurpose.ENTITY_CREATION,
    enabledBy: {
      pressures: [
        { name: 'resource_scarcity', threshold: 60 }
      ],
      entityCounts: [
        { kind: 'location', min: 2 },  // Need colonies
        { kind: 'faction', min: 1 }    // Need factions for merchants
      ]
    },
    affects: {
      entities: [
        { kind: 'location', operation: 'create', count: { min: 0, max: 4 } },  // FIXED: 0-4 (may use existing geographic features)
        { kind: 'npc', operation: 'create', count: { min: 0, max: 2 } }  // Can create 0-2 merchants
      ],
      relationships: [
        { kind: 'adjacent_to', operation: 'create', count: { min: 4, max: 8 } },
        { kind: 'resident_of', operation: 'create', count: { min: 1, max: 2 } },
        { kind: 'member_of', operation: 'create', count: { min: 1, max: 2 } },
        { kind: 'explorer_of', operation: 'create', count: { min: 1, max: 2 } },
        { kind: 'discoverer_of', operation: 'create', count: { min: 0, max: 1 } }
      ],
      pressures: [
        { name: 'resource_scarcity', delta: -10 }  // Blooms reduce scarcity
      ]
    }
  },

  metadata: {
    produces: {
      entityKinds: [
        {
          kind: 'location',
          subtype: 'geographic_feature',
          count: { min: 2, max: 4 },
          prominence: [{ level: 'recognized', probability: 1.0 }],
        },
        {
          kind: 'npc',
          subtype: 'merchant',
          count: { min: 1, max: 2 },
          prominence: [{ level: 'marginal', probability: 1.0 }],
        },
      ],
      relationships: [
        { kind: 'adjacent_to', category: 'spatial', probability: 6.0, comment: '2-4 blooms connected to colonies' },
        { kind: 'resident_of', category: 'spatial', probability: 2.0, comment: '1-2 merchants reside' },
        { kind: 'member_of', category: 'political', probability: 2.0, comment: 'Merchants join factions' },
        { kind: 'explorer_of', category: 'spatial', probability: 2.0, comment: 'Merchants explore blooms' },
        { kind: 'discoverer_of', category: 'cultural', probability: 0.1, comment: 'Rare tech discovery' },
      ],
    },
    effects: {
      graphDensity: 0.7,
      clusterFormation: 0.5,
      diversityImpact: 0.6,
      comment: 'Creates resource frontier using Voronoi-like placement',
    },
    parameters: {
      activationChance: {
        value: 0.05,
        min: 0.01,
        max: 0.2,
        description: 'Probability when scarcity is low',
      },
      bloomCountMin: {
        value: 2,
        min: 1,
        max: 3,
        description: 'Minimum blooms per discovery',
      },
      bloomCountMax: {
        value: 4,
        min: 2,
        max: 8,
        description: 'Maximum blooms per discovery',
      },
      techDiscoveryChance: {
        value: 0.1,
        min: 0.0,
        max: 0.5,
        description: 'Probability of discovering fishing technology',
      },
    },
    tags: ['resource', 'voronoi-placement', 'frontier'],
  },

  // =========================================================================
  // STEP 1: APPLICABILITY - pressure OR random_chance AND entity counts
  // =========================================================================
  canApply: (graphView: TemplateGraphView) => {
    const { activationChance } = extractParams(krillBloomMigration.metadata, { activationChance: 0.05 });

    // Strategy: pressure_threshold(scarcity, 60) OR random_chance
    const scarcityTrigger = checkPressureThreshold(graphView, 'resource_scarcity', 60, 100);
    const randomTrigger = checkRandomChance(activationChance);

    if (!scarcityTrigger && !randomTrigger) {
      return false;
    }

    // Strategy: entity_count_min(colony, 2)
    if (!checkEntityCountMin(graphView, 'location', 'colony', 2)) {
      return false;
    }

    // Strategy: entity_count_max(bloom, 10) - check existing blooms
    const existingBlooms = graphView.findEntities({ kind: 'location', subtype: 'geographic_feature' })
      .filter(gf => hasTag(gf.tags, 'krill') || hasTag(gf.tags, 'bloom'));

    return existingBlooms.length < 10;
  },

  // =========================================================================
  // STEP 2: SELECTION - colonies to place blooms between
  // =========================================================================
  findTargets: (graphView: TemplateGraphView) => {
    // Strategy: by_kind(location/colony)
    return selectByKind(graphView, 'location', ['colony']);
  },

  // =========================================================================
  // STEPS 3-4: CREATION & RELATIONSHIPS
  // =========================================================================
  expand: (graphView: TemplateGraphView, target?: HardState): TemplateResult => {
    const { bloomCountMin, bloomCountMax, techDiscoveryChance } = extractParams(
      krillBloomMigration.metadata,
      { bloomCountMin: 2, bloomCountMax: 4, techDiscoveryChance: 0.1 }
    );

    // Strategy: by_kind(location/colony)
    const colonies = selectByKind(graphView, 'location', ['colony']);

    if (colonies.length < 2) {
      return emptyResult('Cannot create krill bloom - insufficient colonies for frontier');
    }

    // ------- STEP 3: CREATION - voronoi_frontier placement -------

    const entities: Partial<HardState>[] = [];
    const relationships: Relationship[] = [];

    // Strategy: randomCount for bloom creation
    const bloomCount = randomCount(bloomCountMin, bloomCountMax);

    // === STEP 1: Find Frontier Locations ===
    // Score existing geographic features by distance from nearest colony

    const allLocations = graphView.findEntities({ kind: 'location' });
    const candidates = allLocations.filter(loc =>
      loc.subtype === 'geographic_feature' &&
      !hasTag(loc.tags, 'krill') &&
      !hasTag(loc.tags, 'bloom')
    );

    // Score each candidate by minimum distance to any colony
    const scoredCandidates = candidates.map(candidate => {
      const distances = colonies.map(colony =>
        graphDistance(graphView, candidate.id, colony.id)
      );
      const minDistance = Math.min(...distances);

      // Prefer locations equidistant from multiple colonies
      const variance = Math.sqrt(
        distances.reduce((sum, d) => sum + Math.pow(d - minDistance, 2), 0) / distances.length
      );
      const frontierScore = minDistance / (1 + variance); // High score = far from all colonies, low variance

      return { location: candidate, score: frontierScore };
    });

    // Sort by score (best frontiers first)
    scoredCandidates.sort((a, b) => b.score - a.score);

    // === STEP 2: Create Krill Blooms ===
    const actualBloomCount = Math.min(bloomCount, scoredCandidates.length + 1);
    const bloomIds: string[] = []; // Track bloom IDs (either existing or placeholders)

    for (let i = 0; i < actualBloomCount; i++) {
      if (i < scoredCandidates.length) {
        // Transform existing geographic feature into krill bloom
        const location = scoredCandidates[i].location;
        bloomIds.push(location.id);

        // Check if location already has adjacent_to connections
        const existingConnections = location.links.filter(l => l.kind === 'adjacent_to');

        // If no connections, connect to nearest colonies
        if (existingConnections.length === 0) {
          // Find 2 nearest colonies by calculating distances
          const coloniesWithDistance = colonies.map(colony => ({
            colony,
            distance: graphDistance(graphView, location.id, colony.id)
          }));

          // Sort by distance and take nearest 2
          coloniesWithDistance.sort((a, b) => a.distance - b.distance);
          const nearestColonies = coloniesWithDistance.slice(0, 2).map(cd => cd.colony);

          // Create adjacent_to relationships
          nearestColonies.forEach(colony => {
            relationships.push({
              kind: 'adjacent_to',
              src: location.id,
              dst: colony.id
            });
          });
        }
      } else {
        // Strategy: createEntityPartial for new bloom
        const newBloomIndex = entities.length;
        bloomIds.push(`will-be-assigned-${newBloomIndex}`);

        const selectedColonies = pickMultiple(colonies, Math.min(2, colonies.length));

        // Strategy: deriveCoordinatesNearReference for placement
        const bloomCoords = deriveCoordinatesNearReference(
          graphView,
          'location',
          selectedColonies,
          selectedColonies[0]?.culture
        );

        entities.push(createEntityPartial('location', 'geographic_feature', {
          status: 'thriving',
          prominence: 'recognized',
          culture: selectedColonies[0]?.culture || 'aurora-stack',
          description: `Massive bioluminescent krill swarms dance in these waters, drawing merchants and hunters from across the berg.`,
          tags: { krill: true, bloom: true, resource: true },
          coordinates: bloomCoords
        }));

        // Strategy: spatial(adjacent_to)
        selectedColonies.forEach(colony => {
          relationships.push(
            createRelationship('adjacent_to', `will-be-assigned-${newBloomIndex}`, colony.id)
          );
        });
      }
    }

    // ------- STEP 4: RELATIONSHIPS - Create Explorers/Merchants -------

    const discovererCount = Math.min(2, actualBloomCount);
    const allFactions = selectByKind(graphView, 'faction');

    for (let i = 0; i < discovererCount; i++) {
      const faction = allFactions.length > 0 ? pickRandom(allFactions) : undefined;
      const homeColony = pickRandom(colonies);

      if (!faction || !homeColony) continue;

      // Strategy: deriveCoordinatesNearReference for NPC
      const npcCoords = deriveCoordinatesNearReference(graphView, 'npc', [homeColony], homeColony.culture);

      // Strategy: createEntityPartial for merchant
      entities.push(createEntityPartial('npc', 'merchant', {
        status: 'alive',
        prominence: 'marginal',
        culture: homeColony.culture,
        description: `An enterprising merchant who discovered the krill blooms and now leads expeditions to harvest them.`,
        tags: { explorer: true, merchant: true, krill: true },
        coordinates: npcCoords
      }));

      const npcIndex = entities.length - 1;

      // Strategy: spatial(resident_of)
      relationships.push(createRelationship('resident_of', `will-be-assigned-${npcIndex}`, homeColony.id));

      // Strategy: hierarchical(member_of)
      relationships.push(createRelationship('member_of', `will-be-assigned-${npcIndex}`, faction.id));

      // Strategy: discovery(explorer_of)
      if (bloomIds.length > 0) {
        const bloomIndex = Math.min(i, bloomIds.length - 1);
        relationships.push(createRelationship('explorer_of', `will-be-assigned-${npcIndex}`, bloomIds[bloomIndex]));
      }
    }

    // Strategy: discovery(discoverer_of) - Technology Innovation
    if (checkRandomChance(techDiscoveryChance)) {
      const abilities = selectByKind(graphView, 'abilities', ['technology']);
      if (abilities.length > 0 && entities.length > 0) {
        const ability = pickRandom(abilities);
        const discoverer = entities.length - 1;
        relationships.push(createRelationship('discoverer_of', `will-be-assigned-${discoverer}`, ability.id));
      }
    }

    return templateResult(
      entities,
      relationships,
      `Krill bloom discovered! ${actualBloomCount} new resource sites open frontier territories`
    );
  }
};
