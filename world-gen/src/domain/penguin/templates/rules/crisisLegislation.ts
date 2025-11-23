import { GrowthTemplate, TemplateResult, Graph } from '../../../../types/engine';
import { HardState, Relationship } from '../../../../types/worldTypes';
import { pickRandom, findEntities, slugifyName } from '../../../../utils/helpers';

/**
 * Crisis Legislation Template
 *
 * Emergency laws enacted during times of conflict or resource scarcity.
 * Creates edicts, taboos, or social rules in response to crises.
 */
export const crisisLegislation: GrowthTemplate = {
  id: 'crisis_legislation',
  name: 'Crisis Law',

  metadata: {
    produces: {
      entityKinds: [
        {
          kind: 'rules',
          subtype: 'various',
          count: { min: 1, max: 1 },
          prominence: [{ level: 'recognized', probability: 1.0 }],
        },
      ],
      relationships: [
        { kind: 'applies_in', category: 'political', probability: 1.0, comment: 'Law applies in colony' },
      ],
    },
    effects: {
      graphDensity: 0.2,
      clusterFormation: 0.3,
      diversityImpact: 0.5,
      comment: 'Creates emergency laws in response to crises',
    },
    tags: ['crisis-driven', 'legislation'],
  },

  canApply: (graph: Graph) => {
    const conflict = graph.pressures.get('conflict') || 0;
    const scarcity = graph.pressures.get('resource_scarcity') || 0;
    return conflict > 40 || scarcity > 40;
  },
  
  findTargets: (graph: Graph) => findEntities(graph, { kind: 'location', subtype: 'colony' }),
  
  expand: (graph: Graph, target?: HardState): TemplateResult => {
    const colony = target || pickRandom(findEntities(graph, { kind: 'location', subtype: 'colony' }));
    const ruleType = pickRandom(['edict', 'taboo', 'social']);
    
    return {
      entities: [{
        kind: 'rules',
        subtype: ruleType,
        name: `${colony.name} ${pickRandom(['Protection', 'Rationing', 'Defense'])} ${ruleType}`,
        description: `Emergency measure enacted in ${colony.name}`,
        status: 'enacted',
        prominence: 'recognized',
        tags: ['crisis', `name:${slugifyName(colony.name)}`]
      }],
      relationships: [
        { kind: 'applies_in', src: 'will-be-assigned-0', dst: colony.id }
      ],
      description: `New ${ruleType} enacted in ${colony.name}`
    };
  }
};
