import { GrowthTemplate, TemplateResult, Graph } from '../../types/engine';
import { HardState, Relationship } from '../../types/worldTypes';
import { generateName, pickRandom, findEntities, slugifyName } from '../../utils/helpers';

export const succession: GrowthTemplate = {
  id: 'succession',
  name: 'Leadership Succession',

  metadata: {
    produces: {
      entityKinds: [
        {
          kind: 'npc',
          subtype: 'mayor',
          count: { min: 1, max: 1 },
          prominence: [{ level: 'marginal', probability: 1.0 }],
        },
      ],
      relationships: [
        { kind: 'leader_of', category: 'political', probability: 1.5, comment: 'Leads colony and possibly faction' },
        { kind: 'resident_of', category: 'spatial', probability: 1.0, comment: 'Lives in governed colony' },
        { kind: 'member_of', category: 'political', probability: 0.5, comment: 'Joins faction if predecessor led one' },
      ],
    },
    effects: {
      graphDensity: 0.3,
      clusterFormation: 0.4,
      diversityImpact: 0.2,
      comment: 'Replaces dead/old leaders with new ones, maintaining political structure',
    },
    tags: ['succession', 'leadership-change'],
  },

  canApply: (graph: Graph) => {
    const mayors = findEntities(graph, { kind: 'npc', subtype: 'mayor' });
    return mayors.some(m => m.status === 'dead' || graph.tick > 50);
  },
  
  findTargets: (graph: Graph) => {
    const mayors = findEntities(graph, { kind: 'npc', subtype: 'mayor' });
    return mayors.filter(m => m.status === 'dead' || (graph.tick - m.createdAt) > 40);
  },
  
  expand: (graph: Graph, target?: HardState): TemplateResult => {
    const oldLeader = target || pickRandom(findEntities(graph, { kind: 'npc', subtype: 'mayor' }));

    // Find the colony the old leader governed
    const leaderOfLink = oldLeader.links.find(l => l.kind === 'leader_of');
    if (!leaderOfLink) {
      // Old leader has no colony - fail gracefully
      return {
        entities: [],
        relationships: [],
        description: `${oldLeader.name} had no colony to succeed`
      };
    }

    const colony = graph.entities.get(leaderOfLink.dst);
    if (!colony) {
      return {
        entities: [],
        relationships: [],
        description: `${oldLeader.name}'s colony no longer exists`
      };
    }

    const newLeader: Partial<HardState> = {
      kind: 'npc',
      subtype: 'mayor',
      name: generateName('mayor'),
      description: `Successor to ${oldLeader.name} in ${colony.name}`,
      status: 'alive',
      prominence: 'marginal', // New leaders start marginal, must earn respect
      tags: ['successor', `name:${slugifyName(colony.name)}`]
    };

    const relationships: Relationship[] = [
      {
        kind: 'leader_of',
        src: 'will-be-assigned-0',
        dst: colony.id
      },
      {
        kind: 'resident_of',  // New mayor lives in the colony
        src: 'will-be-assigned-0',
        dst: colony.id
      }
    ];

    // Check for faction leadership too
    const factionLeaderLink = oldLeader.links.find(l =>
      l.kind === 'leader_of' && graph.entities.get(l.dst)?.kind === 'faction'
    );
    if (factionLeaderLink) {
      relationships.push({
        kind: 'leader_of',
        src: 'will-be-assigned-0',
        dst: factionLeaderLink.dst
      });
      relationships.push({
        kind: 'member_of',  // New leader joins faction
        src: 'will-be-assigned-0',
        dst: factionLeaderLink.dst
      });
    }

    return {
      entities: [newLeader],
      relationships,
      description: `${newLeader.name} succeeds ${oldLeader.name} in ${colony.name}`
    };
  }
};
