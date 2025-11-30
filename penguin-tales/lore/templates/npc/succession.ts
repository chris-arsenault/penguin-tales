/**
 * Leadership Succession Template
 *
 * Strategy-based template for replacing dead/old leaders.
 *
 * Pipeline:
 *   1. Applicability: status_match(mayor/dead) OR tick_threshold
 *   2. Selection: by_kind(npc/mayor) with age/status filter
 *   3. Creation: near_reference with culture inheritance
 *   4. Relationships: hierarchical(leader_of, resident_of, member_of)
 *   5. State: archive_relationship for old leader
 */

import { GrowthTemplate, TemplateResult, ComponentPurpose } from '@lore-weave/core';
import { TemplateGraphView } from '@lore-weave/core';
import { HardState, Relationship } from '@lore-weave/core';
import { pickRandom } from '@lore-weave/core';

import {
  // Step 2: Selection
  selectByKind,
  // Step 3: Creation
  deriveCoordinatesNearReference,
  createEntityPartial,
  // Step 4: Relationships
  createRelationship,
  // Result helpers
  emptyResult,
  templateResult
} from '../../utils/strategyExecutors';

export const succession: GrowthTemplate = {
  id: 'succession',
  name: 'Leadership Succession',

  contract: {
    purpose: ComponentPurpose.ENTITY_CREATION,
    enabledBy: {
      entityCounts: [
        { kind: 'npc', min: 1 }
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
        { kind: 'inspired_by', operation: 'create', count: { min: 0, max: 1 } }
      ],
      pressures: [
        { name: 'stability', delta: -1 }
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

  // =========================================================================
  // STEP 1: APPLICABILITY - status_match OR tick_threshold
  // =========================================================================
  canApply: (graphView: TemplateGraphView) => {
    // Strategy: status_match(dead) OR tick_threshold(50)
    const mayors = selectByKind(graphView, 'npc', ['mayor']);
    return mayors.some(m => m.status === 'dead' || graphView.tick > 50);
  },

  // =========================================================================
  // STEP 2: SELECTION - mayors needing succession
  // =========================================================================
  findTargets: (graphView: TemplateGraphView) => {
    // Strategy: by_kind(npc/mayor) with age/status filter
    const mayors = selectByKind(graphView, 'npc', ['mayor']);
    return mayors.filter(m => m.status === 'dead' || (graphView.tick - m.createdAt) > 40);
  },

  // =========================================================================
  // STEPS 3-5: CREATION, RELATIONSHIPS, STATE
  // =========================================================================
  expand: (graphView: TemplateGraphView, target?: HardState): TemplateResult => {
    // Resolve target
    const oldLeader = target || pickRandom(selectByKind(graphView, 'npc', ['mayor']));

    if (!oldLeader) {
      return emptyResult('No mayor to succeed');
    }

    // Find the colony the old leader governed
    const leadsColonies = graphView.getRelatedEntities(oldLeader.id, 'leader_of', 'src')
      .filter(e => e.kind === 'location');

    if (leadsColonies.length === 0) {
      return emptyResult(`${oldLeader.name} had no colony to succeed`);
    }

    const colony = leadsColonies[0];

    // ------- STEP 5: STATE - archive old relationship -------
    graphView.archiveRelationship(oldLeader.id, colony.id, 'leader_of');

    // ------- STEP 3: CREATION -------

    // Strategy: deriveCoordinatesNearReference
    const coords = deriveCoordinatesNearReference(graphView, 'npc', [colony], colony.culture);

    // Strategy: createEntityPartial
    const newLeader = createEntityPartial('npc', 'mayor', {
      status: 'alive',
      prominence: 'marginal',
      culture: colony.culture,
      description: `Successor to ${oldLeader.name} in ${colony.name}`,
      tags: { successor: true },
      coordinates: coords
    });

    // ------- STEP 4: RELATIONSHIPS -------

    const relationships: Relationship[] = [];

    // Strategy: hierarchical(leader_of) - leads colony
    relationships.push(
      createRelationship('leader_of', 'will-be-assigned-0', colony.id)
    );

    // Strategy: hierarchical(resident_of) - lives in colony
    relationships.push(
      createRelationship('resident_of', 'will-be-assigned-0', colony.id)
    );

    // Check for faction leadership inheritance
    const leadsFactions = graphView.getRelatedEntities(oldLeader.id, 'leader_of', 'src')
      .filter(e => e.kind === 'faction');

    if (leadsFactions.length > 0) {
      const faction = leadsFactions[0];
      // Archive old faction leadership
      graphView.archiveRelationship(oldLeader.id, faction.id, 'leader_of');

      // Strategy: hierarchical(leader_of) - leads faction
      relationships.push(
        createRelationship('leader_of', 'will-be-assigned-0', faction.id)
      );

      // Strategy: hierarchical(member_of) - joins faction
      relationships.push(
        createRelationship('member_of', 'will-be-assigned-0', faction.id)
      );
    }

    return templateResult(
      [newLeader],
      relationships,
      `New mayor succeeds ${oldLeader.name} in ${colony.name}`
    );
  }
};
