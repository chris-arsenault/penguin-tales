import { GrowthTemplate, TemplateResult, Graph } from '../../../../types/engine';
import { HardState, Relationship } from '../../../../types/worldTypes';
import { generateName, pickRandom, findEntities, slugifyName } from '../../../../utils/helpers';

export const heroEmergence: GrowthTemplate = {
  id: 'hero_emergence',
  name: 'Hero Rises',

  metadata: {
    produces: {
      entityKinds: [
        {
          kind: 'npc',
          subtype: 'hero',
          count: { min: 1, max: 1 },
          prominence: [{ level: 'marginal', probability: 1.0 }],
        },
      ],
      relationships: [
        { kind: 'practitioner_of', category: 'cultural', probability: 0.8, comment: 'If abilities exist' },
        { kind: 'resident_of', category: 'spatial', probability: 1.0, comment: 'Hero lives in colony' },
      ],
    },
    effects: {
      graphDensity: 0.2,
      clusterFormation: 0.3,
      diversityImpact: 0.5,
      comment: 'Creates individual heroes with potential for ability practice',
    },
    tags: ['crisis-driven', 'individual'],
  },

  canApply: (graph: Graph) => {
    const conflictPressure = graph.pressures.get('conflict') || 0;
    return conflictPressure > 30 || graph.entities.size > 20;
  },
  
  findTargets: (graph: Graph) => {
    const colonies = findEntities(graph, { kind: 'location', subtype: 'colony' });
    return colonies.filter(c => c.status === 'thriving' || c.status === 'waning');
  },
  
  expand: (graph: Graph, target?: HardState): TemplateResult => {
    const colony = target || pickRandom(
      findEntities(graph, { kind: 'location', subtype: 'colony' })
    );

    if (!colony) {
      // No colony exists - fail gracefully
      return {
        entities: [],
        relationships: [],
        description: 'Cannot create hero - no colonies exist'
      };
    }

    const hero: Partial<HardState> = {
      kind: 'npc',
      subtype: 'hero',
      name: generateName('hero'),
      description: `A brave penguin who emerged during troubled times in ${colony.name}`,
      status: 'alive',
      prominence: 'marginal', // Heroes start marginal, must earn prominence
      tags: ['brave', 'emergent', `name:${slugifyName(colony.name)}`]
    };
    
    const abilities = findEntities(graph, { kind: 'abilities' });
    const relationships: Relationship[] = [];

    if (abilities.length > 0) {
      relationships.push({
        kind: 'practitioner_of',
        src: 'will-be-assigned-0',
        dst: pickRandom(abilities).id
      });
    }

    relationships.push({
      kind: 'resident_of',
      src: 'will-be-assigned-0',
      dst: colony.id
    });
    
    return {
      entities: [hero],
      relationships,
      description: `A new hero emerges in ${colony.name}`
    };
  }
};
