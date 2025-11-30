/**
 * Faction Splinter Template
 *
 * Strategy-based template for faction schisms.
 *
 * Pipeline:
 *   1. Applicability: entity_count_min(faction/members, 1)
 *   2. Selection: by_kind(faction) with member count filter
 *   3. Creation: faction + optional leader with lineage distance
 *   4. Relationships: lineage(split_from), conflict(at_war_with), hierarchical(leader_of, member_of)
 *   5. State: archive_relationship for defecting leader
 */

import { GrowthTemplate, TemplateResult, ComponentPurpose } from '@lore-weave/core';
import { TemplateGraphView } from '@lore-weave/core';
import { HardState, FactionSubtype, Relationship } from '@lore-weave/core';
import { pickRandom, extractParams } from '@lore-weave/core';

import {
  // Step 2: Selection
  selectByKind,
  // Step 3: Creation
  createEntityPartial,
  randomCount,
  // Step 4: Relationships
  createRelationship,
  createLineageRelationship,
  // Result helpers
  emptyResult,
  templateResult
} from '../../utils/strategyExecutors';

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
        { name: 'cultural_tension', threshold: 25 },
        { name: 'conflict', threshold: 5 }
      ],
      entityCounts: [
        { kind: 'faction', min: 1 }
      ]
    },
    affects: {
      entities: [
        { kind: 'faction', operation: 'create', count: { min: 1, max: 1 } },
        { kind: 'npc', operation: 'create', count: { min: 0, max: 1 } }
      ],
      relationships: [
        { kind: 'split_from', operation: 'create', count: { min: 1, max: 1 } },
        { kind: 'leader_of', operation: 'create', count: { min: 1, max: 1 } },
        { kind: 'member_of', operation: 'create', count: { min: 2, max: 5 } },
        { kind: 'enemy_of', operation: 'create', count: { min: 0, max: 1 } },
        { kind: 'rival_of', operation: 'create', count: { min: 0, max: 2 } }
      ],
      pressures: [
        { name: 'conflict', delta: 3 },
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

  // =========================================================================
  // STEP 1: APPLICABILITY - faction with members
  // =========================================================================
  canApply: (graphView: TemplateGraphView) => {
    const factions = graphView.findEntities({ kind: 'faction' });
    return factions.some(f => {
      const members = graphView.getRelatedEntities(f.id, 'member_of', 'dst');
      return members.length >= 1;
    });
  },

  // =========================================================================
  // STEP 2: SELECTION - factions with members
  // =========================================================================
  findTargets: (graphView: TemplateGraphView) => {
    // Strategy: by_kind(faction) with member count filter
    const factions = graphView.findEntities({ kind: 'faction' });
    return factions.filter(f => {
      const members = graphView.getRelatedEntities(f.id, 'member_of', 'dst');
      return members.length >= 1;
    });
  },

  // =========================================================================
  // STEPS 3-5: CREATION, RELATIONSHIPS, STATE
  // =========================================================================
  expand: (graphView: TemplateGraphView, target?: HardState): TemplateResult => {
    const { leaderHeroChance } = extractParams(factionSplinter.metadata, { leaderHeroChance: 0.5 });

    const parentFaction = target || pickRandom(graphView.findEntities({ kind: 'faction' }));

    if (!parentFaction) {
      return emptyResult('Cannot create splinter - no factions exist');
    }

    // ------- STEP 3: CREATION -------

    const splinterType = determineSplinterType(parentFaction.subtype as FactionSubtype);

    // Determine ideological distance based on type change
    const isRadicalSplit = splinterType !== parentFaction.subtype;
    const distanceRange = isRadicalSplit
      ? { min: 0.6, max: 0.8 }   // Revolutionary change
      : { min: 0.15, max: 0.35 }; // Incremental difference

    const parentTags = Object.keys(parentFaction.tags || {}).slice(0, 2);
    const splinterTags: Record<string, boolean> = { splinter: true };
    parentTags.forEach(tag => { splinterTags[tag] = true; });

    // Strategy: createEntityPartial for splinter faction
    const splinter = createEntityPartial('faction', splinterType, {
      status: 'waning',
      prominence: 'marginal',
      culture: parentFaction.culture,
      description: `A splinter group that broke away from ${parentFaction.name}`,
      tags: splinterTags
    });

    // Try to find existing member to lead the splinter
    const members = graphView.getRelatedEntities(parentFaction.id, 'member_of', 'dst');
    const allRelationships = graphView.getAllRelationships();
    const nonLeaders = members.filter(m =>
      !allRelationships.some(r => r.src === m.id && r.kind === 'leader_of')
    );
    const leaderEntity = nonLeaders.length > 0 ? pickRandom(nonLeaders) : pickRandom(members);

    // If no suitable leader from faction, create a new one
    let leader: Partial<HardState> | undefined = undefined;
    if (!leaderEntity) {
      leader = createEntityPartial('npc', Math.random() < leaderHeroChance ? 'hero' : 'outlaw', {
        status: 'alive',
        prominence: 'recognized',
        culture: parentFaction.culture,
        description: `Charismatic leader of a splinter faction that broke away from ${parentFaction.name}`,
        tags: { rebel: true, charismatic: true }
      });
    }

    // Find parent faction's location
    const controlsRelations = graphView.getRelatedEntities(parentFaction.id, 'controls', 'src');
    const occupiesRelations = graphView.getRelatedEntities(parentFaction.id, 'occupies', 'src');

    let location = controlsRelations.length > 0 ? controlsRelations[0] :
                   occupiesRelations.length > 0 ? occupiesRelations[0] : undefined;

    if (!location) {
      const colonies = selectByKind(graphView, 'location', ['colony']);
      location = colonies.length > 0 ? pickRandom(colonies) : undefined;
    }

    if (!location) {
      return emptyResult(`${parentFaction.name} cannot splinter - no locations available`);
    }

    // ------- STEP 4 & 5: RELATIONSHIPS & STATE -------

    const relationships: Relationship[] = [];

    // Strategy: lineage(split_from) with ideological distance
    relationships.push(
      createLineageRelationship('split_from', 'will-be-assigned-0', parentFaction.id, distanceRange)
    );

    // Strategy: conflict(at_war_with)
    relationships.push(
      createRelationship('at_war_with', 'will-be-assigned-0', parentFaction.id)
    );

    // Strategy: spatial(occupies)
    relationships.push(
      createRelationship('occupies', 'will-be-assigned-0', location.id)
    );

    // Add leader relationships
    if (leaderEntity) {
      // Strategy: archive_relationship - defection from parent faction
      graphView.archiveRelationship(leaderEntity.id, parentFaction.id, 'member_of');

      relationships.push(
        createRelationship('leader_of', leaderEntity.id, 'will-be-assigned-0'),
        createRelationship('member_of', leaderEntity.id, 'will-be-assigned-0'),
        createRelationship('resident_of', leaderEntity.id, location.id)
      );
    } else if (leader) {
      relationships.push(
        createRelationship('leader_of', 'will-be-assigned-1', 'will-be-assigned-0'),
        createRelationship('member_of', 'will-be-assigned-1', 'will-be-assigned-0'),
        createRelationship('resident_of', 'will-be-assigned-1', location.id)
      );
    }

    const entities = leader ? [splinter, leader] : [splinter];
    const leaderDesc = leaderEntity ? leaderEntity.name : 'a new leader';

    return templateResult(
      entities,
      relationships,
      `${leaderDesc} leads a splinter faction in breaking away from ${parentFaction.name}`
    );
  }
};
