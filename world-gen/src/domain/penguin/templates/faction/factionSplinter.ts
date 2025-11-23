import { GrowthTemplate, TemplateResult } from '../../../../types/engine';
import { TemplateGraphView } from '../../../../services/templateGraphView';
import { HardState, FactionSubtype, Relationship } from '../../../../types/worldTypes';
import { generateName, pickRandom } from '../../../../utils/helpers';

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

  canApply: (graphView: TemplateGraphView) => {
    const factions = graphView.findEntities({ kind: 'faction' });
    return factions.some(f => {
      const members = graphView.getRelatedEntities(f.id, 'member_of', 'dst');
      return members.length >= 3;
    });
  },

  findTargets: (graphView: TemplateGraphView) => {
    const factions = graphView.findEntities({ kind: 'faction' });
    return factions.filter(f => {
      const members = graphView.getRelatedEntities(f.id, 'member_of', 'dst');
      return members.length >= 3;
    });
  },

  expand: (graphView: TemplateGraphView, target?: HardState): TemplateResult => {
    // Extract parameters from metadata
    const params = factionSplinter.metadata?.parameters || {};
    const leaderHeroChance = params.leaderHeroChance?.value ?? 0.5;

    const parentFaction = target || pickRandom(graphView.findEntities({ kind: 'faction' }));

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

    // Use targetSelector to find NPCs from the parent faction to lead the splinter
    let leader: Partial<HardState> | undefined = undefined;
    let leaderEntity: HardState | undefined = undefined;

    const members = graphView.getRelatedEntities(parentFaction.id, 'member_of', 'dst');

    if (members.length > 0) {
      // Select a member from the parent faction to lead the splinter
      // Prefer non-leaders
      const nonLeaders = members.filter(m => !graphView.getRelationships(m.id, 'leader_of').length);
      leaderEntity = nonLeaders.length > 0 ? pickRandom(nonLeaders) : pickRandom(members);
    }

    // If no suitable leader from faction, create a new one
    if (!leaderEntity) {
      leader = {
        kind: 'npc',
        subtype: Math.random() < leaderHeroChance ? 'hero' : 'outlaw',
        name: generateName('leader'),
        description: `Charismatic leader of the ${splinter.name}`,
        status: 'alive',
        prominence: 'recognized',
        tags: ['rebel', 'charismatic']
      };
    }

    // Find parent faction's location
    const controlsRelations = graphView.getRelatedEntities(parentFaction.id, 'controls', 'src');
    const occupiesRelations = graphView.getRelatedEntities(parentFaction.id, 'occupies', 'src');

    let location = controlsRelations.length > 0 ? controlsRelations[0] :
                   occupiesRelations.length > 0 ? occupiesRelations[0] : undefined;

    // Fallback: if parent has no location, use any colony
    if (!location) {
      const colonies = graphView.findEntities({ kind: 'location', subtype: 'colony' });
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
      { kind: 'at_war_with', src: 'will-be-assigned-0', dst: parentFaction.id },
      { kind: 'occupies', src: 'will-be-assigned-0', dst: location.id }
    ];

    // Add leader relationships (either existing or new)
    if (leaderEntity) {
      // Use existing NPC as leader
      relationships.push(
        { kind: 'leader_of', src: leaderEntity.id, dst: 'will-be-assigned-0' },
        { kind: 'member_of', src: leaderEntity.id, dst: 'will-be-assigned-0' },
        { kind: 'resident_of', src: leaderEntity.id, dst: location.id }
      );
    } else if (leader) {
      // Use newly created leader
      relationships.push(
        { kind: 'leader_of', src: 'will-be-assigned-1', dst: 'will-be-assigned-0' },
        { kind: 'member_of', src: 'will-be-assigned-1', dst: 'will-be-assigned-0' },
        { kind: 'resident_of', src: 'will-be-assigned-1', dst: location.id }
      );
    }

    const entities = leader ? [splinter, leader] : [splinter];
    const leaderName = leaderEntity ? leaderEntity.name : (leader ? leader.name : 'unknown leader');

    return {
      entities,
      relationships,
      description: `${leaderName} leads ${splinter.name} in breaking away from ${parentFaction.name}`
    };
  }
};
