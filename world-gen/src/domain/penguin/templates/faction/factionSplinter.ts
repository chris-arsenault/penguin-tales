import { GrowthTemplate, TemplateResult, Graph } from '../../../../types/engine';
import { HardState, FactionSubtype, Relationship } from '../../../../types/worldTypes';
import { generateName, pickRandom, findEntities } from '../../../../utils/helpers';

function determineSplinterType(parentType: FactionSubtype): FactionSubtype {
  const transitions: Record<FactionSubtype, FactionSubtype[]> = {
    'company': ['company', 'criminal'],
    'political': ['political', 'cult'],
    'criminal': ['criminal', 'political'],
    'cult': ['cult', 'political']
  };
  return pickRandom(transitions[parentType] || [parentType]);
}

export const factionSplinter: GrowthTemplate = {
  id: 'faction_splinter',
  name: 'Faction Schism',

  metadata: {
    produces: {
      entityKinds: [
        {
          kind: 'faction',
          subtype: 'various',
          count: { min: 1, max: 1 },
          prominence: [{ level: 'marginal', probability: 1.0 }],
        },
        {
          kind: 'npc',
          subtype: 'various',
          count: { min: 1, max: 1 },
          prominence: [{ level: 'recognized', probability: 1.0 }],
        },
      ],
      relationships: [
        { kind: 'splinter_of', category: 'political', probability: 1.0, comment: 'Splinter linked to parent' },
        { kind: 'leader_of', category: 'political', probability: 1.0, comment: 'Leader leads splinter' },
        { kind: 'member_of', category: 'political', probability: 1.0, comment: 'Leader joins splinter' },
        { kind: 'resident_of', category: 'spatial', probability: 1.0, comment: 'Leader resides at location' },
        { kind: 'at_war_with', category: 'political', probability: 1.0, comment: 'Splinter wars with parent' },
        { kind: 'occupies', category: 'spatial', probability: 1.0, comment: 'Splinter occupies location' },
      ],
    },
    effects: {
      graphDensity: 0.4,
      clusterFormation: 0.6,
      diversityImpact: 0.7,
      comment: 'Creates new faction clusters with conflict relationships',
    },
    parameters: {
      leaderHeroChance: {
        value: 0.5,
        min: 0.0,
        max: 1.0,
        description: 'Probability splinter leader is hero vs outlaw',
      },
    },
    tags: ['conflict', 'faction-diversity'],
  },

  canApply: (graph: Graph) => {
    const factions = findEntities(graph, { kind: 'faction' });
    return factions.some(f => {
      const members = findEntities(graph, { kind: 'npc' })
        .filter(npc => npc.links.some(l => l.kind === 'member_of' && l.dst === f.id));
      return members.length >= 3;
    });
  },
  
  findTargets: (graph: Graph) => {
    const factions = findEntities(graph, { kind: 'faction' });
    return factions.filter(f => {
      const members = findEntities(graph, { kind: 'npc' })
        .filter(npc => npc.links.some(l => l.kind === 'member_of' && l.dst === f.id));
      return members.length >= 3;
    });
  },
  
  expand: (graph: Graph, target?: HardState): TemplateResult => {
    // Extract parameters from metadata
    const params = factionSplinter.metadata?.parameters || {};
    const leaderHeroChance = params.leaderHeroChance?.value ?? 0.5;

    const parentFaction = target || pickRandom(findEntities(graph, { kind: 'faction' }));

    if (!parentFaction) {
      // No faction exists - fail gracefully
      return {
        entities: [],
        relationships: [],
        description: 'Cannot create splinter - no factions exist'
      };
    }

    const splinterType = determineSplinterType(parentFaction.subtype as FactionSubtype);

    const splinter: Partial<HardState> = {
      kind: 'faction',
      subtype: splinterType,
      name: `${parentFaction.name} ${pickRandom(['Reformists', 'Radicals', 'Purists'])}`,
      description: `A splinter group that broke away from ${parentFaction.name}`,
      status: 'waning',
      prominence: 'marginal',
      tags: ['splinter', ...parentFaction.tags.slice(0, 2)]
    };

    const leader: Partial<HardState> = {
      kind: 'npc',
      subtype: Math.random() < leaderHeroChance ? 'hero' : 'outlaw',
      name: generateName('leader'),
      description: `Charismatic leader of the ${splinter.name}`,
      status: 'alive',
      prominence: 'recognized',
      tags: ['rebel', 'charismatic']
    };
    
    const parentLocation = graph.entities.get(
      parentFaction.links.find(l => l.kind === 'controls' || l.kind === 'occupies')?.dst || ''
    );

    // Fallback: if parent has no location, use any colony
    let location = parentLocation;
    if (!location) {
      const colonies = findEntities(graph, { kind: 'location', subtype: 'colony' });
      location = colonies.length > 0 ? pickRandom(colonies) : undefined;
    }

    if (!location) {
      // No location to splinter at - fail gracefully
      return {
        entities: [],
        relationships: [],
        description: `${parentFaction.name} cannot splinter - no locations available`
      };
    }

    const relationships: Relationship[] = [
      { kind: 'splinter_of', src: 'will-be-assigned-0', dst: parentFaction.id },
      { kind: 'leader_of', src: 'will-be-assigned-1', dst: 'will-be-assigned-0' },
      { kind: 'member_of', src: 'will-be-assigned-1', dst: 'will-be-assigned-0' },
      { kind: 'resident_of', src: 'will-be-assigned-1', dst: location.id },
      { kind: 'at_war_with', src: 'will-be-assigned-0', dst: parentFaction.id },
      { kind: 'occupies', src: 'will-be-assigned-0', dst: location.id }
    ];
    
    return {
      entities: [splinter, leader],
      relationships,
      description: `${parentFaction.name} splinters into rival factions`
    };
  }
};
