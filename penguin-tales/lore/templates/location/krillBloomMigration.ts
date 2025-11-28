import { GrowthTemplate, TemplateResult, ComponentPurpose } from '@lore-weave/core/types/engine';
import { TemplateGraphView } from '@lore-weave/core/graph/templateGraphView';
import { HardState, Relationship } from '@lore-weave/core/types/worldTypes';
import { pickRandom, pickMultiple, hasTag } from '@lore-weave/core/utils/helpers';

/**
 * Krill Bloom Migration Template
 *
 * Creates resource nodes (krill blooms) at frontier locations maximally distant from colonies.
 * Uses simplified Voronoi tessellation concept - places blooms at boundaries between territories.
 *
 * Mathematical Foundation:
 * Voronoi cell boundary: V_i = {x : d(x, colony_i) < d(x, colony_j) ∀j ≠ i}
 * Placement score: score(x) = min_i(d(x, colony_i)) * resource_potential(x)
 *
 * Simplified Implementation:
 * - Find locations equidistant from multiple colonies
 * - Prefer locations with no existing blooms
 * - Create new paths (adjacent_to) to connect blooms
 *
 * SYSTEM_IMPLEMENTATION_GUIDE compliance:
 * - Throttled by pressure trigger (scarcity > 60) or 5% random
 * - Validates colony existence
 * - Graceful failure if no valid placement
 * - Creates 2-4 resource nodes to avoid spam
 * - NPCs get proper resident_of relationships
 */

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

  canApply: (graphView: TemplateGraphView) => {
    const params = krillBloomMigration.metadata?.parameters || {};
    const activationChance = params.activationChance?.value ?? 0.05;

    const scarcity = graphView.getPressure('resource_scarcity') || 0;
    const colonies = graphView.findEntities({ kind: 'location', subtype: 'colony' });
    const existingBlooms = graphView.findEntities({ kind: 'location', subtype: 'geographic_feature' })
      .filter(gf => hasTag(gf.tags, 'krill') || hasTag(gf.tags, 'bloom'));

    // Triggered by high scarcity or random chance
    const triggered = scarcity > 60 || Math.random() < activationChance;

    // Requires at least 2 colonies and not too many existing blooms
    return triggered && colonies.length >= 2 && existingBlooms.length < 10;
  },

  findTargets: (graphView: TemplateGraphView) => {
    // Targets are colonies (blooms appear between them)
    return graphView.findEntities({ kind: 'location', subtype: 'colony' });
  },

  expand: (graphView: TemplateGraphView, target?: HardState): TemplateResult => {
    // Extract parameters from metadata
    const params = krillBloomMigration.metadata?.parameters || {};
    const bloomCountMin = params.bloomCountMin?.value ?? 2;
    const bloomCountMax = params.bloomCountMax?.value ?? 4;
    const techDiscoveryChance = params.techDiscoveryChance?.value ?? 0.1;

    const colonies = graphView.findEntities({ kind: 'location', subtype: 'colony' });

    // VALIDATION: Need at least 2 colonies
    if (colonies.length < 2) {
      return {
        entities: [],
        relationships: [],
        description: 'Cannot create krill bloom - insufficient colonies for frontier'
      };
    }

    const entities: Partial<HardState>[] = [];
    const relationships: Relationship[] = [];

    // Determine bloom count
    const bloomCount = Math.floor(Math.random() * (bloomCountMax - bloomCountMin + 1)) + bloomCountMin;

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
        // Create new geographic feature
        const newBloomIndex = entities.length;
        bloomIds.push(`will-be-assigned-${newBloomIndex}`);

        // Connect new bloom to 2 nearest colonies
        // Since we don't have the new location's position yet, connect to random colonies
        // (In a real Voronoi implementation, we'd place at cell boundaries)
        const selectedColonies = pickMultiple(colonies, Math.min(2, colonies.length));

        // Derive coordinates for new bloom - place between selected colonies
        const bloomCoords = graphView.deriveCoordinates(
          selectedColonies,
          'location',
          undefined,
          { maxDistance: 15 }  // Add some randomness to spread blooms out
        );

        entities.push({
          kind: 'location',
          subtype: 'geographic_feature',
          description: `Massive bioluminescent krill swarms dance in these waters, drawing merchants and hunters from across the berg.`,
          status: 'thriving',
          prominence: 'recognized',
          culture: selectedColonies[0]?.culture || 'aurora-stack',  // Inherit culture from nearest colony
          tags: { krill: true, bloom: true, resource: true },
          coordinates: bloomCoords
        });

        selectedColonies.forEach(colony => {
          relationships.push({
            kind: 'adjacent_to',
            src: `will-be-assigned-${newBloomIndex}`,
            dst: colony.id
          });
        });
      }
    }

    // === STEP 3: Create Explorers/Merchants ===
    // 1-2 NPCs discover the blooms
    const discovererCount = Math.min(2, actualBloomCount);

    for (let i = 0; i < discovererCount; i++) {
      // FIXED: Don't filter by status='active' - use any faction
      const allFactions = graphView.findEntities({ kind: 'faction' });
      const faction = allFactions.length > 0 ? pickRandom(allFactions) : undefined;
      const homeColony = pickRandom(colonies);

      if (!faction || !homeColony) continue;

      // Derive coordinates for NPC near their home colony
      const npcCoords = graphView.deriveCoordinates(
        [homeColony],
        'npc',
        undefined,
        { maxDistance: 5 }
      );

      entities.push({
        kind: 'npc',
        subtype: 'merchant',
        description: `An enterprising merchant who discovered the krill blooms and now leads expeditions to harvest them.`,
        status: 'alive',
        prominence: 'marginal', // Discoverers start marginal
        culture: homeColony.culture,  // Inherit culture from home colony
        tags: { explorer: true, merchant: true, krill: true },
        coordinates: npcCoords
      });

      const npcIndex = entities.length - 1;

      // REQUIRED: Add resident_of
      relationships.push({
        kind: 'resident_of',
        src: `will-be-assigned-${npcIndex}`,
        dst: homeColony.id
      });

      // Add member_of
      relationships.push({
        kind: 'member_of',
        src: `will-be-assigned-${npcIndex}`,
        dst: faction.id
      });

      // Add explorer_of relationship to a bloom
      if (bloomIds.length > 0) {
        const bloomIndex = Math.min(i, bloomIds.length - 1);
        relationships.push({
          kind: 'explorer_of',
          src: `will-be-assigned-${npcIndex}`,
          dst: bloomIds[bloomIndex]
        });
      }
    }

    // === STEP 4: Technology Innovation ===
    // Chance to discover new fishing technology
    if (Math.random() < techDiscoveryChance) {
      // FIXED: Don't filter by status='active' - accept any status
      const abilities = graphView.findEntities({ kind: 'abilities', subtype: 'technology' });
      if (abilities.length > 0 && entities.length > 0) {
        const ability = pickRandom(abilities);
        const discoverer = entities.length - 1; // Last NPC created

        relationships.push({
          kind: 'discoverer_of',
          src: `will-be-assigned-${discoverer}`,
          dst: ability.id
        });
      }
    }

    return {
      entities,
      relationships,
      description: `Krill bloom discovered! ${actualBloomCount} new resource sites open frontier territories`
    };
  }
};
