import { GrowthTemplate, TemplateResult, ComponentPurpose } from '@lore-weave/core/types/engine';
import { TemplateGraphView } from '@lore-weave/core/services/templateGraphView';
import { HardState } from '@lore-weave/core/types/worldTypes';
import { pickRandom, hasTag } from '@lore-weave/core/utils/helpers';

/**
 * Anomaly Manifestation Template
 *
 * Strange magical phenomena appear in the wilderness between colonies.
 * Uses region-based placement to ensure anomalies spawn:
 * - In wilderness (not inside colony regions)
 * - Reasonably close to at least one colony (for discoverability)
 * - At low z values (caverns/underwater for mystical feel)
 *
 * Creates mysterious locations that attract cults and magic users.
 */
export const anomalyManifestation: GrowthTemplate = {
  id: 'anomaly_manifestation',
  name: 'Anomaly Appears',

  contract: {
    purpose: ComponentPurpose.ENTITY_CREATION,
    enabledBy: {
      pressures: [
        { name: 'magical_instability', threshold: 30 }
      ],
      entityCounts: [
        { kind: 'location', min: 1 }  // Needs locations to be adjacent to
      ]
    },
    affects: {
      entities: [
        { kind: 'location', operation: 'create', count: { min: 1, max: 1 } }
      ],
      relationships: [
        { kind: 'adjacent_to', operation: 'create', count: { min: 0, max: 2 } },
        { kind: 'discovered_by', operation: 'create', count: { min: 0, max: 1 } }
      ]
    }
  },

  metadata: {
    produces: {
      entityKinds: [
        {
          kind: 'location',
          subtype: 'anomaly',
          count: { min: 1, max: 1 },
          prominence: [{ level: 'recognized', probability: 1.0 }],
        },
      ],
      relationships: [
        { kind: 'adjacent_to', category: 'spatial', probability: 1.0, comment: 'Adjacent to existing location' },
        { kind: 'discovered_by', category: 'spatial', probability: 0.7, comment: 'Magic user discovers it' },
      ],
    },
    effects: {
      graphDensity: 0.3,
      clusterFormation: 0.4,
      diversityImpact: 0.8,
      comment: 'Creates mystical locations in the wilderness between settlements',
    },
    parameters: {
      activationChance: {
        value: 0.2,
        min: 0.05,
        max: 0.5,
        description: 'Probability of manifestation when magical_instability is low',
      },
      minDistanceFromColonies: {
        value: 8,
        min: 5,
        max: 20,
        description: 'Minimum distance from colony centers'
      },
      maxDistanceFromColonies: {
        value: 25,
        min: 15,
        max: 40,
        description: 'Maximum distance from any colony (for discoverability)'
      }
    },
    tags: ['mystical', 'pressure-driven', 'region-aware'],
  },

  canApply: (graphView: TemplateGraphView) => {
    const params = anomalyManifestation.metadata?.parameters || {};
    const activationChance = params.activationChance?.value ?? 0.2;

    const magic = graphView.getPressure('magical_instability') || 0;
    return magic > 30 || Math.random() < activationChance;
  },

  findTargets: (graphView: TemplateGraphView) => graphView.findEntities({ kind: 'location' }),

  expand: (graphView: TemplateGraphView, target?: HardState): TemplateResult => {
    const anomalyName = `${pickRandom(['Shimmering', 'Frozen', 'Dark', 'Whispering', 'Void'])} ${pickRandom(['Rift', 'Vortex', 'Echo', 'Fissure', 'Gate'])}`;

    // Check if region system is available
    if (graphView.hasRegionSystem()) {
      const params = anomalyManifestation.metadata?.parameters || {};
      const minDistance = (params.minDistanceFromColonies?.value as number) ?? 8;
      const maxDistance = (params.maxDistanceFromColonies?.value as number) ?? 25;

      // Get colony positions
      // Need to cast through unknown due to Coordinate vs Point type difference
      const colonies = graphView.findEntities({ kind: 'location', subtype: 'colony' });
      const colonyPoints = colonies
        .map(c => c.coordinates?.region)
        .filter(p => p != null) as unknown as Array<{ x: number; y: number; z: number }>;

      if (colonyPoints.length === 0) {
        throw new Error(
          `anomaly_manifestation: No colonies have region coordinates configured. ` +
          `Cannot place anomaly without spatial reference points.`
        );
      }

      // Try to find a wilderness position between colonies
      const maxAttempts = 20;
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        // Generate point in wilderness (low z for caverns/underwater mystical feel)
        const referencePoint = {
          x: 15 + Math.random() * 70,  // 15-85 range
          y: 20 + Math.random() * 60,  // 20-80 range
          z: 5 + Math.random() * 25    // Cavern level: 5-30
        };

        // Check distance constraints from all colonies
        const distances = colonyPoints.map(p => {
          const dx = referencePoint.x - p.x;
          const dy = referencePoint.y - p.y;
          return Math.sqrt(dx * dx + dy * dy);
        });

        const minDist = Math.min(...distances);
        const maxDist = Math.max(...distances);

        // Anomaly should be in wilderness (min from colonies) but not too remote (max)
        if (minDist >= minDistance && minDist <= maxDistance) {
          // Check we're not inside a colony region
          const lookup = graphView.lookupRegion(referencePoint);
          const inColonyRegion = lookup?.all.some(r =>
            r.metadata?.subtype === 'colony'
          );

          if (!inColonyRegion) {
            // Create emergent region for the anomaly
            const regionResult = graphView.createEmergentRegion(
              referencePoint,
              anomalyName,
              `A mysterious phenomenon in the deep ice`
            );

            if (regionResult.success && regionResult.region) {
              // Find nearest colony for culture inheritance
              const nearestColony = colonies.reduce((nearest, colony) => {
                const p = colony.coordinates?.region as { x: number; y: number; z: number } | undefined;
                if (!p) return nearest;
                const d = Math.sqrt(
                  Math.pow(referencePoint.x - p.x, 2) +
                  Math.pow(referencePoint.y - p.y, 2)
                );
                if (!nearest || d < nearest.distance) {
                  return { colony, distance: d };
                }
                return nearest;
              }, null as { colony: HardState; distance: number } | null);

              // Place the anomaly
              const entityId = graphView.addEntityInRegion(
                {
                  kind: 'location',
                  subtype: 'anomaly',
                  name: anomalyName,
                  description: `A mysterious phenomenon deep in the ice, ${nearestColony ? `near ${nearestColony.colony.name}` : 'in the remote wastes'}`,
                  status: 'unspoiled',
                  prominence: 'recognized',
                  culture: nearestColony?.colony.culture,
                  tags: { anomaly: true, mystical: true, caverns: true }
                },
                regionResult.region.id,
                { minDistance: 2 }
              );

              if (entityId) {
                const relationships: any[] = [];

                // Add adjacent_to relationship to nearest colony
                if (nearestColony) {
                  relationships.push({
                    kind: 'adjacent_to',
                    src: entityId,
                    dst: nearestColony.colony.id
                  });
                  relationships.push({
                    kind: 'adjacent_to',
                    src: nearestColony.colony.id,
                    dst: entityId
                  });
                }

                // Maybe discovered by a magic user
                const magicUsers = graphView.findEntities({}).filter(
                  e => (e.kind === 'npc' && hasTag(e.tags, 'magic')) ||
                       (e.kind === 'npc' && e.links.some(l => l.kind === 'practitioner_of'))
                );

                if (magicUsers.length > 0 && Math.random() < 0.7) {
                  const discoverer = pickRandom(magicUsers);
                  relationships.push({
                    kind: 'discovered_by',
                    src: entityId,
                    dst: discoverer.id
                  });
                }

                return {
                  entities: [],  // Already added
                  relationships,
                  description: `${anomalyName} manifests in the wilderness between settlements`
                };
              }
            }
          }
        }
      }

      // Couldn't find valid placement
      return {
        entities: [],
        relationships: [],
        description: `Magical energies dissipate before an anomaly can form`
      };
    }

    // Region system is REQUIRED for anomaly placement
    throw new Error(
      `anomaly_manifestation: Region system is not configured. ` +
      `Cannot place anomaly without spatial coordinates.`
    );
  }
};
