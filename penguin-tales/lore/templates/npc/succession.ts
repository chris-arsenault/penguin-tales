import { GrowthTemplate, TemplateResult, ComponentPurpose } from '@lore-weave/core/types/engine';
import { TemplateGraphView } from '@lore-weave/core/services/templateGraphView';
import { HardState, Relationship } from '@lore-weave/core/types/worldTypes';
import { pickRandom, slugifyName, archiveRelationship } from '@lore-weave/core/utils/helpers';

export const succession: GrowthTemplate = {
  id: 'succession',
  name: 'Leadership Succession',

  contract: {
    purpose: ComponentPurpose.ENTITY_CREATION,
    enabledBy: {
      entityCounts: [
        { kind: 'npc', min: 1 }  // Requires existing NPCs
      ]
    },
    affects: {
      entities: [
        { kind: 'npc', operation: 'create', count: { min: 1, max: 1 } }
      ],
      relationships: [
        { kind: 'leader_of', operation: 'create', count: { min: 1, max: 2 } },
        { kind: 'resident_of', operation: 'create', count: { min: 1, max: 1 } },
        { kind: 'member_of', operation: 'create', count: { min: 0, max: 1 } },
        { kind: 'inspired_by', operation: 'create', count: { min: 0, max: 1 } }  // Lineage
      ],
      pressures: [
        { name: 'stability', delta: -1 }  // Succession creates brief instability
      ]
    }
  },

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

  canApply: (graphView: TemplateGraphView) => {
    const mayors = graphView.findEntities({ kind: 'npc', subtype: 'mayor' });
    return mayors.some(m => m.status === 'dead' || graphView.tick > 50);
  },

  findTargets: (graphView: TemplateGraphView) => {
    const mayors = graphView.findEntities({ kind: 'npc', subtype: 'mayor' });
    return mayors.filter(m => m.status === 'dead' || (graphView.tick - m.createdAt) > 40);
  },

  expand: (graphView: TemplateGraphView, target?: HardState): TemplateResult => {
    const oldLeader = target || pickRandom(graphView.findEntities({ kind: 'npc', subtype: 'mayor' }));

    if (!oldLeader) {
      return {
        entities: [],
        relationships: [],
        description: 'No mayor to succeed'
      };
    }

    // Find the colony the old leader governed
    const leadsColonies = graphView.getRelatedEntities(oldLeader.id, 'leader_of', 'src')
      .filter(e => e.kind === 'location');

    if (leadsColonies.length === 0) {
      // Old leader has no colony - fail gracefully
      return {
        entities: [],
        relationships: [],
        description: `${oldLeader.name} had no colony to succeed`
      };
    }

    const colony = leadsColonies[0];

    // Archive old leader_of relationship to colony (temporal tracking)
    const graph = graphView.getInternalGraph();
    archiveRelationship(graph, oldLeader.id, colony.id, 'leader_of');

    // Derive coordinates from colony (new leader will live there)
    const coords = graphView.deriveCoordinates(
      [colony],
      'npc',
      'physical',
      { maxDistance: 0.2, minDistance: 0.05 }
    );

    if (!coords) {
      return {
        entities: [],
        relationships: [],
        description: `Cannot place successor - ${colony.name} has no coordinates`
      };
    }

    const newLeader: Partial<HardState> = {
      kind: 'npc',
      subtype: 'mayor',
      description: `Successor to ${oldLeader.name} in ${colony.name}`,
      status: 'alive',
      prominence: 'marginal', // New leaders start marginal, must earn respect
      culture: colony.culture,  // Inherit culture from colony
      tags: { successor: true },
      coordinates: coords
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
    const leadsFactions = graphView.getRelatedEntities(oldLeader.id, 'leader_of', 'src')
      .filter(e => e.kind === 'faction');

    if (leadsFactions.length > 0) {
      const faction = leadsFactions[0];
      // Archive old leader_of relationship to faction (temporal tracking)
      archiveRelationship(graph, oldLeader.id, faction.id, 'leader_of');

      relationships.push({
        kind: 'leader_of',
        src: 'will-be-assigned-0',
        dst: faction.id
      });
      relationships.push({
        kind: 'member_of',  // New leader joins faction
        src: 'will-be-assigned-0',
        dst: faction.id
      });
    }

    return {
      entities: [newLeader],
      relationships,
      description: `New mayor succeeds ${oldLeader.name} in ${colony.name}`
    };
  }
};
