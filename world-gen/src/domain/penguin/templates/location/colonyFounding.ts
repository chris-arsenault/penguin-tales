import { GrowthTemplate, TemplateResult, Graph } from '../../../../types/engine';
import { HardState, Relationship } from '../../../../types/worldTypes';
import { pickRandom, findEntities } from '../../../../utils/helpers';

/**
 * Colony Founding Template
 *
 * New colonies are established on icebergs as population expands.
 * Limited to 5 colonies maximum to prevent overcrowding.
 */
export const colonyFounding: GrowthTemplate = {
  id: 'colony_founding',
  name: 'Colony Foundation',

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
      comment: 'Adds new colony nodes for population expansion',
    },
    tags: ['expansion', 'colony-formation'],
  },

  canApply: (graph: Graph) => {
    const colonies = findEntities(graph, { kind: 'location', subtype: 'colony' });
    return colonies.length < 5 && graph.entities.size > 20;
  },
  
  findTargets: (graph: Graph) => findEntities(graph, { kind: 'location', subtype: 'iceberg' }),
  
  expand: (graph: Graph, target?: HardState): TemplateResult => {
    const iceberg = target || pickRandom(findEntities(graph, { kind: 'location', subtype: 'iceberg' }));
    
    return {
      entities: [{
        kind: 'location',
        subtype: 'colony',
        name: `${pickRandom(['North', 'South', 'East', 'West'])} ${pickRandom(['Haven', 'Roost', 'Perch'])}`,
        description: `New colony established on ${iceberg.name}`,
        status: 'thriving',
        prominence: 'marginal',
        tags: ['new', 'colony']
      }],
      relationships: [
        { kind: 'contained_by', src: 'will-be-assigned-0', dst: iceberg.id }
      ],
      description: `New colony founded on ${iceberg.name}`
    };
  }
};
