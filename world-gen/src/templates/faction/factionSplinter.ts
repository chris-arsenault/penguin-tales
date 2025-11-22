import { GrowthTemplate, TemplateResult, Graph } from '../../types/engine';
import { HardState, FactionSubtype, Relationship } from '../../types/worldTypes';
import { generateName, pickRandom, findEntities } from '../../utils/helpers';

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
      subtype: Math.random() > 0.5 ? 'hero' : 'outlaw',
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
