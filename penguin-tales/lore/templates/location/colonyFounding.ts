import { GrowthTemplate, TemplateResult, ComponentPurpose } from '@lore-weave/core';
import { TemplateGraphView } from '@lore-weave/core';
import { HardState } from '@lore-weave/core';
import { pickRandom } from '@lore-weave/core';

/**
 * Colony Founding Template
 *
 * New colonies are established in the wilderness, away from existing colonies.
 * Uses region-based placement to ensure realistic spacing:
 * - Minimum 20 units from existing colonies
 * - Placed in wilderness (not in existing colony regions)
 * - Creates emergent region for the new colony
 *
 * Limited to 5 colonies maximum to prevent overcrowding.
 */
export const colonyFounding: GrowthTemplate = {
  id: 'colony_founding',
  name: 'Colony Foundation',

  contract: {
    purpose: ComponentPurpose.ENTITY_CREATION,
    enabledBy: {
      entityCounts: [
        { kind: 'location', min: 1 },  // Requires iceberg
        { kind: 'npc', min: 20 }       // Population threshold
      ]
    },
    affects: {
      entities: [
        { kind: 'location', operation: 'create', count: { min: 1, max: 1 } }
      ],
      relationships: [
        { kind: 'contained_by', operation: 'create', count: { min: 1, max: 2 } }
      ]
    }
  },

  metadata: {
    produces: {
      entityKinds: [
        {
          kind: 'location',
          subtype: 'colony',
          count: { min: 1, max: 1 },
          prominence: [{ level: 'marginal', probability: 1.0 }],
        },
      ],
      relationships: [
        { kind: 'contained_by', category: 'spatial', probability: 1.0, comment: 'Colony on iceberg' },
      ],
    },
    effects: {
      graphDensity: 0.1,
      clusterFormation: 0.3,
      diversityImpact: 0.3,
      comment: 'Adds new colony nodes with realistic spatial placement',
    },
    parameters: {
      minDistanceFromColonies: {
        value: 20,
        min: 10,
        max: 40,
        description: 'Minimum distance from existing colonies'
      }
    },
    tags: ['expansion', 'colony-formation', 'region-aware'],
  },

  canApply: (graphView: TemplateGraphView) => {
    const colonies = graphView.findEntities({ kind: 'location', subtype: 'colony' });
    return colonies.length < 5 && graphView.getEntityCount() > 20;
  },

  findTargets: (graphView: TemplateGraphView) => graphView.findEntities({ kind: 'location', subtype: 'iceberg' }),

  expand: async (graphView: TemplateGraphView, target?: HardState): Promise<TemplateResult> => {
    const iceberg = target || pickRandom(graphView.findEntities({ kind: 'location', subtype: 'iceberg' }));

    // Determine culture based on existing colonies on this iceberg
    const existingColonies = graphView.findEntities({ kind: 'location', subtype: 'colony' });
    const colonyOnIceberg = existingColonies.find(c =>
      graphView.hasRelationship(c.id, iceberg.id, 'contained_by')
    );
    const culture = colonyOnIceberg?.culture || 'aurora-stack';

    // Check if region system is available
    if (graphView.hasRegionSystem()) {
      // Use region-based placement for realistic colony spacing
      const params = colonyFounding.metadata?.parameters || {};
      const minDistance = (params.minDistanceFromColonies?.value as number) ?? 20;

      // Get all existing colony coordinate points
      const existingColonyPoints = existingColonies
        .map(c => c.coordinates)
        .filter((p): p is { x: number; y: number; z: number } => p != null && 'x' in p);

      // Try to create an emergent region in the wilderness
      // Pick a random reference point away from existing colonies
      const referencePoint = {
        x: 20 + Math.random() * 60,  // 20-80 range to stay within Aurora Berg
        y: 25 + Math.random() * 55,  // 25-80 range
        z: 45 + Math.random() * 10   // Surface level: 45-55
      };

      // Check distance from all existing colonies
      const isFarEnough = existingColonyPoints.every(p => {
        const dx = referencePoint.x - p.x;
        const dy = referencePoint.y - p.y;
        return Math.sqrt(dx * dx + dy * dy) >= minDistance;
      });

      if (isFarEnough) {
        // Create emergent region for the new colony
        const regionResult = graphView.createEmergentRegion(
          referencePoint,
          'New Colony',
          `A new colony founded on ${iceberg.name}`
        );

        if (regionResult.success && regionResult.region) {
          // Place the colony within the new region using culture-aware placement
          const placementResult = graphView.deriveCoordinatesWithCulture(
            culture,
            'location',
            iceberg ? [iceberg] : undefined
          );

          // Use region center as fallback if culture placement fails
          const coords = placementResult?.coordinates ?? referencePoint;

          const entityId = await graphView.addEntity({
            kind: 'location',
            subtype: 'colony',
            description: `New colony established on ${iceberg.name} in the ${pickRandom(['northern', 'southern', 'eastern', 'western'])} reaches.`,
            status: 'thriving',
            prominence: 'marginal',
            culture,
            tags: { new: true, colony: true },
            coordinates: coords
          });

          if (entityId) {
            // Return minimal result - entity already added via graphView
            return {
              entities: [],  // Already added
              relationships: [
                { kind: 'contained_by', src: entityId, dst: iceberg.id }
              ],
              description: `A new colony founded on ${iceberg.name} at region ${regionResult.region.label}`
            };
          }
        }
      }

      // Fallback: couldn't find valid placement, skip this tick
      return {
        entities: [],
        relationships: [],
        description: `Could not find suitable location for new colony - all areas too close to existing settlements`
      };
    }

    // Region system is REQUIRED for colony placement
    throw new Error(
      `colony_founding: Region system is not configured. ` +
      `Cannot place colony without spatial coordinates.`
    );
  }
};
