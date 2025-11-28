import { GrowthTemplate, TemplateResult, ComponentPurpose } from '@lore-weave/core/types/engine';
import { TemplateGraphView } from '@lore-weave/core/graph/templateGraphView';
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
    // Find reference locations (colonies, other anomalies, or geographic features)
    const colonies = graphView.findEntities({ kind: 'location', subtype: 'colony' });
    const existingAnomalies = graphView.findEntities({ kind: 'location', subtype: 'anomaly' });
    const geographicFeatures = graphView.findEntities({ kind: 'location', subtype: 'geographic_feature' });

    // Build reference entities - prefer placing near existing mystical sites or remote locations
    const referenceEntities: HardState[] = [];
    if (existingAnomalies.length > 0) {
      referenceEntities.push(pickRandom(existingAnomalies));
    }
    if (geographicFeatures.length > 0) {
      referenceEntities.push(pickRandom(geographicFeatures));
    }
    if (colonies.length > 0) {
      referenceEntities.push(pickRandom(colonies));
    }

    // Use target if provided
    if (target && !referenceEntities.includes(target)) {
      referenceEntities.push(target);
    }

    if (referenceEntities.length === 0) {
      return {
        entities: [],
        relationships: [],
        description: `Magical energies dissipate - no anchor points for anomaly`
      };
    }

    // Derive coordinates for the anomaly (place away from civilization)
    const coords = graphView.deriveCoordinates(
      referenceEntities,
      'location',
      'physical',
      { maxDistance: 0.5, minDistance: 0.2 }  // Further away than normal for wilderness feel
    );

    if (!coords) {
      return {
        entities: [],
        relationships: [],
        description: `Magical energies dissipate before an anomaly can form`
      };
    }

    // Find nearest colony for culture inheritance
    const nearestColony = colonies.length > 0 ? pickRandom(colonies) : null;

    const anomaly: Partial<HardState> = {
      kind: 'location',
      subtype: 'anomaly',
      description: `A mysterious phenomenon deep in the ice, ${nearestColony ? `near ${nearestColony.name}` : 'in the remote wastes'}`,
      status: 'unspoiled',
      prominence: 'recognized',
      culture: nearestColony?.culture || 'world',
      tags: { anomaly: true, mystical: true, caverns: true },
      coordinates: coords
    };

    const relationships: any[] = [];

    // Add adjacent_to relationship to nearest reference location
    if (referenceEntities.length > 0) {
      const nearestRef = referenceEntities[0];
      relationships.push({
        kind: 'adjacent_to',
        src: 'will-be-assigned-0',
        dst: nearestRef.id
      });
      relationships.push({
        kind: 'adjacent_to',
        src: nearestRef.id,
        dst: 'will-be-assigned-0'
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
        src: 'will-be-assigned-0',
        dst: discoverer.id
      });
    }

    return {
      entities: [anomaly],
      relationships,
      description: `A mysterious anomaly manifests in the wilderness between settlements`
    };
  }
};
