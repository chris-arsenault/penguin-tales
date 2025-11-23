import { GrowthTemplate, TemplateResult, Graph } from '../../types/engine';
import { HardState, Relationship } from '../../types/worldTypes';
import { generateName, pickRandom, findEntities } from '../../utils/helpers';

export const outlawRecruitment: GrowthTemplate = {
  id: 'outlaw_recruitment',
  name: 'Criminal Recruitment',

  metadata: {
    produces: {
      entityKinds: [
        {
          kind: 'npc',
          subtype: 'outlaw',
          count: { min: 2, max: 4 },
          prominence: [{ level: 'marginal', probability: 1.0 }],
        },
      ],
      relationships: [
        { kind: 'member_of', category: 'political', probability: 3.0, comment: '2-4 outlaws join faction' },
        { kind: 'resident_of', category: 'spatial', probability: 3.0, comment: 'Outlaws reside in stronghold/colony' },
      ],
    },
    effects: {
      graphDensity: 0.5,
      clusterFormation: 0.7,
      diversityImpact: 0.3,
      comment: 'Expands criminal faction clusters',
    },
    parameters: {
      numOutlawsMin: {
        value: 2,
        min: 1,
        max: 4,
        description: 'Minimum number of outlaws recruited',
      },
      numOutlawsMax: {
        value: 4,
        min: 2,
        max: 10,
        description: 'Maximum number of outlaws recruited',
      },
    },
    tags: ['criminal', 'faction-expansion'],
  },

  canApply: (graph: Graph) => {
    const criminalFactions = findEntities(graph, { kind: 'faction', subtype: 'criminal' });
    return criminalFactions.length > 0;
  },
  
  findTargets: (graph: Graph) => {
    return findEntities(graph, { kind: 'faction', subtype: 'criminal' });
  },
  
  expand: (graph: Graph, target?: HardState): TemplateResult => {
    const faction = target || pickRandom(findEntities(graph, { kind: 'faction', subtype: 'criminal' }));

    // Extract parameters from metadata
    const params = outlawRecruitment.metadata?.parameters || {};
    const numOutlawsMin = params.numOutlawsMin?.value ?? 2;
    const numOutlawsMax = params.numOutlawsMax?.value ?? 4;

    const numOutlaws = Math.floor(Math.random() * (numOutlawsMax - numOutlawsMin + 1)) + numOutlawsMin;
    const outlaws: Partial<HardState>[] = [];
    
    for (let i = 0; i < numOutlaws; i++) {
      outlaws.push({
        kind: 'npc',
        subtype: 'outlaw',
        name: generateName('outlaw'),
        description: `A shady character working for ${faction.name}`,
        status: 'alive',
        prominence: 'marginal',
        tags: ['criminal', 'recruit']
      });
    }
    
    // Find faction stronghold or any colony
    const strongholdLink = faction.links.find(l => l.kind === 'controls');
    let location = strongholdLink ? graph.entities.get(strongholdLink.dst) : undefined;

    // Fallback: if faction has no stronghold, use any colony
    if (!location) {
      const colonies = findEntities(graph, { kind: 'location', subtype: 'colony' });
      location = colonies.length > 0 ? pickRandom(colonies) : undefined;
    }

    // If still no location, fail gracefully
    if (!location) {
      return {
        entities: [],
        relationships: [],
        description: `${faction.name} has nowhere to recruit outlaws`
      };
    }

    const relationships: Relationship[] = outlaws.flatMap((_, i) => [
      {
        kind: 'member_of',
        src: `will-be-assigned-${i}`,
        dst: faction.id
      },
      {
        kind: 'resident_of',
        src: `will-be-assigned-${i}`,
        dst: location.id
      }
    ]);
    
    return {
      entities: outlaws,
      relationships,
      description: `${faction.name} recruits new members`
    };
  }
};
