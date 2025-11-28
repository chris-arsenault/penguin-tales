import { GrowthTemplate, TemplateResult, ComponentPurpose } from '@lore-weave/core/types/engine';
import { TemplateGraphView } from '@lore-weave/core/graph/templateGraphView';
import { HardState, FactionSubtype, Relationship } from '@lore-weave/core/types/worldTypes';
import { pickRandom, archiveRelationship } from '@lore-weave/core/utils/helpers';

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

  contract: {
    purpose: ComponentPurpose.ENTITY_CREATION,
    enabledBy: {
      pressures: [
        { name: 'cultural_tension', threshold: 25 },  // FIXED: Lowered from 40 to 25
        { name: 'conflict', threshold: 5 }  // FIXED: Lowered from 10 to 5 (conflict can be as low as 8.1)
      ],
      entityCounts: [
        { kind: 'faction', min: 1 }  // Need existing faction to split from
      ]
    },
    affects: {
      entities: [
        { kind: 'faction', operation: 'create', count: { min: 1, max: 1 } },
        { kind: 'npc', operation: 'create', count: { min: 0, max: 1 } }  // FIXED: May use existing NPC as leader (0-1)
      ],
      relationships: [
        { kind: 'split_from', operation: 'create', count: { min: 1, max: 1 } },  // Lineage
        { kind: 'leader_of', operation: 'create', count: { min: 1, max: 1 } },
        { kind: 'member_of', operation: 'create', count: { min: 2, max: 5 } },
        { kind: 'enemy_of', operation: 'create', count: { min: 0, max: 1 } },
        { kind: 'rival_of', operation: 'create', count: { min: 0, max: 2 } }
      ],
      pressures: [
        { name: 'conflict', delta: 3 },  // Splits create conflict
        { name: 'cultural_tension', delta: 2 }
      ]
    }
  },

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
        { kind: 'split_from', category: 'immutable_fact', probability: 1.0, comment: 'Splinter lineage with ideological distance' },
        { kind: 'leader_of', category: 'institutional', probability: 1.0, comment: 'Leader leads splinter' },
        { kind: 'member_of', category: 'institutional', probability: 1.0, comment: 'Leader joins splinter' },
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
    // FIXED: Lowered from 2 to 1 member (even single-member factions can splinter with new recruits)
    return factions.some(f => {
      const members = graphView.getRelatedEntities(f.id, 'member_of', 'dst');
      return members.length >= 1;
    });
  },

  findTargets: (graphView: TemplateGraphView) => {
    const factions = graphView.findEntities({ kind: 'faction' });
    // FIXED: Lowered from 2 to 1 member (even single-member factions can splinter)
    return factions.filter(f => {
      const members = graphView.getRelatedEntities(f.id, 'member_of', 'dst');
      return members.length >= 1;
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

    // Determine ideological distance based on type change
    // Same type = minor disagreement (0.15-0.35)
    // Different type = major ideological shift (0.6-0.8)
    const isRadicalSplit = splinterType !== parentFaction.subtype;
    const ideologicalDistance = isRadicalSplit
      ? { min: 0.6, max: 0.8 }  // Revolutionary change
      : { min: 0.15, max: 0.35 };  // Incremental difference

    const parentTags = Object.keys(parentFaction.tags || {}).slice(0, 2);
    const splinterTags: Record<string, boolean> = { splinter: true };
    parentTags.forEach(tag => { splinterTags[tag] = true; });

    const splinter: Partial<HardState> = {
      kind: 'faction',
      subtype: splinterType,
      name: `${parentFaction.name} ${pickRandom(['Reformists', 'Radicals', 'Purists'])}`,
      description: `A splinter group that broke away from ${parentFaction.name}`,
      status: 'waning',
      prominence: 'marginal',
      culture: parentFaction.culture,  // Inherit culture from parent faction
      tags: splinterTags
    };

    // Use targetSelector to find NPCs from the parent faction to lead the splinter
    let leader: Partial<HardState> | undefined = undefined;
    let leaderEntity: HardState | undefined = undefined;

    const members = graphView.getRelatedEntities(parentFaction.id, 'member_of', 'dst');
    const graph = graphView.getInternalGraph();

    if (members.length > 0) {
      // Select a member from the parent faction to lead the splinter
      // Prefer non-leaders
      const nonLeaders = members.filter(m => !graph.getRelationships().filter(r => r.src === m.id && r.kind === 'leader_of').length);
      leaderEntity = nonLeaders.length > 0 ? pickRandom(nonLeaders) : pickRandom(members);
    }

    // If no suitable leader from faction, create a new one
    if (!leaderEntity) {
      leader = {
        kind: 'npc',
        subtype: Math.random() < leaderHeroChance ? 'hero' : 'outlaw',
        description: `Charismatic leader of the ${splinter.name}`,
        status: 'alive',
        prominence: 'recognized',
        culture: parentFaction.culture,  // Inherit culture from parent faction
        tags: { rebel: true, charismatic: true }
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

    // Create base relationships (distance will be added by engine using addRelationshipWithDistance)
    // We can't call addRelationshipWithDistance here because we don't have the graph yet
    // Instead, we store the distance range in a custom field that the engine will use
    const relationships: Relationship[] = [
      {
        kind: 'split_from',
        src: 'will-be-assigned-0',
        dst: parentFaction.id,
        // Store distance range as metadata - will be set by engine
        distance: ideologicalDistance.min + Math.random() * (ideologicalDistance.max - ideologicalDistance.min)
      },
      { kind: 'at_war_with', src: 'will-be-assigned-0', dst: parentFaction.id },
      { kind: 'occupies', src: 'will-be-assigned-0', dst: location.id }
    ];

    // Add leader relationships (either existing or new)
    if (leaderEntity) {
      // Use existing NPC as leader - archive their old faction membership (full defection)
      archiveRelationship(graph, leaderEntity.id, parentFaction.id, 'member_of');

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
