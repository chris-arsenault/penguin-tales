import { GrowthTemplate, TemplateResult, Graph } from '../../types/engine';
import { HardState, Relationship } from '../../types/worldTypes';
import { pickRandom, findEntities } from '../../utils/helpers';

/**
 * Magic Discovery Template
 *
 * Heroes discover magical abilities near anomalies.
 * Creates magic abilities linked to the discoverer and manifestation location.
 */
export const magicDiscovery: GrowthTemplate = {
  id: 'magic_discovery',
  name: 'Magical Discovery',

  metadata: {
    produces: {
      entityKinds: [
        {
          kind: 'abilities',
          subtype: 'magic',
          count: { min: 1, max: 1 },
          prominence: [{ level: 'recognized', probability: 1.0 }],
        },
      ],
      relationships: [
        { kind: 'discoverer_of', category: 'cultural', probability: 1.0, comment: 'Hero discovers magic' },
        { kind: 'manifests_at', category: 'spatial', probability: 1.0, comment: 'Magic manifests at anomaly' },
      ],
    },
    effects: {
      graphDensity: 0.3,
      clusterFormation: 0.4,
      diversityImpact: 0.9,
      comment: 'Creates mystical abilities linked to anomalies and heroes',
    },
    tags: ['mystical', 'ability-creation'],
  },

  canApply: (graph: Graph) => findEntities(graph, { kind: 'location', subtype: 'anomaly' }).length > 0,

  findTargets: (graph: Graph) => findEntities(graph, { kind: 'npc', subtype: 'hero' }),
  
  expand: (graph: Graph, target?: HardState): TemplateResult => {
    const hero = target || pickRandom(findEntities(graph, { kind: 'npc', subtype: 'hero' }));
    const anomaly = pickRandom(findEntities(graph, { kind: 'location', subtype: 'anomaly' }));
    
    return {
      entities: [{
        kind: 'abilities',
        subtype: 'magic',
        name: `${pickRandom(['Frost', 'Ice', 'Glow'])} ${pickRandom(['Ward', 'Sight', 'Bond'])}`,
        description: `Mystical ability discovered by ${hero.name}`,
        status: 'emergent',
        prominence: 'recognized',
        tags: ['magic', 'mystical']
      }],
      relationships: [
        { kind: 'discoverer_of', src: hero.id, dst: 'will-be-assigned-0' },
        { kind: 'manifests_at', src: 'will-be-assigned-0', dst: anomaly.id }
      ],
      description: `${hero.name} discovers magical ability`
    };
  }
};
