import { GrowthTemplate, TemplateResult, ComponentPurpose } from '../../../../types/engine';
import { TemplateGraphView } from '../../../../services/templateGraphView';
import { HardState } from '../../../../types/worldTypes';
import { pickRandom } from '../../../../utils/helpers';

/**
 * Anomaly Manifestation Template
 *
 * Strange magical phenomena appear, triggered by high magical instability.
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
        { kind: 'adjacent_to', operation: 'create', count: { min: 1, max: 1 } },
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
      comment: 'Creates mystical locations that attract cults and magic users',
    },
    parameters: {
      activationChance: {
        value: 0.2,
        min: 0.05,
        max: 0.5,
        description: 'Probability of manifestation when magical_instability is low',
      },
    },
    tags: ['mystical', 'pressure-driven'],
  },

  canApply: (graphView: TemplateGraphView) => {
    const params = anomalyManifestation.metadata?.parameters || {};
    const activationChance = params.activationChance?.value ?? 0.2;

    const magic = graphView.getPressure('magical_instability') || 0;
    return magic > 30 || Math.random() < activationChance;
  },
  
  findTargets: (graphView: TemplateGraphView) => graphView.findEntities({ kind: 'location' }),
  
  expand: (graphView: TemplateGraphView, target?: HardState): TemplateResult => {
    // Find a location to be adjacent to (prefer colonies for discoverability)
    const locations = graphView.findEntities({ kind: 'location' });
    const nearbyLocation = target || pickRandom(locations);

    if (!nearbyLocation) {
      // No locations exist - fail gracefully
      return {
        entities: [],
        relationships: [],
        description: 'Cannot manifest anomaly - no locations exist'
      };
    }

    const anomalyName = `${pickRandom(['Shimmering', 'Frozen', 'Dark'])} ${pickRandom(['Rift', 'Vortex', 'Echo'])}`;

    const relationships: any[] = [
      {
        kind: 'adjacent_to',
        src: 'will-be-assigned-0',
        dst: nearbyLocation.id
      }
    ];

    // If there are magic users, one might discover it
    const magicUsers = graphView.findEntities({}).filter(
      e => (e.kind === 'npc' && e.tags.includes('magic')) ||
           (e.kind === 'npc' && e.links.some(l => l.kind === 'practitioner_of'))
    );

    if (magicUsers.length > 0) {
      const discoverer = pickRandom(magicUsers);
      relationships.push({
        kind: 'discovered_by',
        src: 'will-be-assigned-0',
        dst: discoverer.id
      });
    }

    return {
      entities: [{
        kind: 'location',
        subtype: 'anomaly',
        name: anomalyName,
        description: `A mysterious phenomenon near ${nearbyLocation.name}`,
        status: 'unspoiled',
        prominence: 'recognized',
        tags: ['anomaly', 'mysterious']
      }],
      relationships,
      description: `${anomalyName} manifests near ${nearbyLocation.name}`
    };
  }
};
