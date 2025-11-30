/**
 * Family Expansion Template
 *
 * Strategy-based template for creating children of existing NPCs.
 *
 * Pipeline:
 *   1. Applicability: entity_count_min(npc/alive, 2)
 *   2. Selection: by_kind(npc) with colony co-location filter
 *   3. Creation: near_reference within colony region
 *   4. Relationships: social(mentor_of), spatial(resident_of), optional(member_of)
 */

import { GrowthTemplate, TemplateResult, ComponentPurpose } from '@lore-weave/core';
import { TemplateGraphView } from '@lore-weave/core';
import { HardState, NPCSubtype, Relationship } from '@lore-weave/core';
import { pickRandom, extractParams } from '@lore-weave/core';

import {
  // Step 1: Applicability
  checkEntityCountMin,
  // Step 2: Selection
  selectByKind,
  // Step 3: Creation
  randomCount,
  // Step 4: Relationships
  createRelationship,
  // Result helpers
  emptyResult,
  templateResult
} from '../../utils/strategyExecutors';

export const familyExpansion: GrowthTemplate = {
  id: 'family_expansion',
  name: 'Family Growth',

  contract: {
    purpose: ComponentPurpose.ENTITY_CREATION,
    enabledBy: {
      entityCounts: [
        { kind: 'npc', min: 2 }
      ]
    },
    affects: {
      entities: [
        { kind: 'npc', operation: 'create', count: { min: 1, max: 3 } }
      ],
      relationships: [
        { kind: 'mentor_of', operation: 'create', count: { min: 1, max: 3 } },
        { kind: 'resident_of', operation: 'create', count: { min: 1, max: 3 } },
        { kind: 'member_of', operation: 'create', count: { min: 0, max: 2 } }
      ]
    }
  },

  metadata: {
    produces: {
      entityKinds: [
        {
          kind: 'npc',
          subtype: 'various',
          count: { min: 1, max: 3 },
          prominence: [{ level: 'marginal', probability: 1.0 }],
        },
      ],
      relationships: [
        { kind: 'mentor_of', category: 'social', probability: 2.0, comment: 'Parent mentors 1-3 children' },
        { kind: 'resident_of', category: 'spatial', probability: 2.0, comment: 'Children live in colony' },
        { kind: 'member_of', category: 'political', probability: 1.0, comment: '~50% join parent faction' },
      ],
    },
    effects: {
      graphDensity: 0.4,
      clusterFormation: 0.6,
      diversityImpact: 0.2,
      comment: 'Expands family clusters in colonies with modest subtype variation',
    },
    parameters: {
      numChildrenMin: {
        value: 1,
        min: 1,
        max: 3,
        description: 'Minimum number of children per family expansion',
      },
      numChildrenMax: {
        value: 3,
        min: 1,
        max: 10,
        description: 'Maximum number of children per family expansion',
      },
      inheritSubtypeChance: {
        value: 0.7,
        min: 0.0,
        max: 1.0,
        description: 'Probability child inherits parent subtype (vs random)',
      },
      joinParentFactionChance: {
        value: 0.5,
        min: 0.0,
        max: 1.0,
        description: 'Probability child joins parent faction (if parent has one)',
      },
    },
    tags: ['generational', 'colony-based', 'family'],
  },

  // =========================================================================
  // STEP 1: APPLICABILITY - entity_count_min
  // =========================================================================
  canApply: (graphView: TemplateGraphView) => {
    // Strategy: entity_count_min(npc/alive, 2)
    const npcs = graphView.findEntities({ kind: 'npc', status: 'alive' });
    return npcs.length >= 2;
  },

  // =========================================================================
  // STEP 2: SELECTION - NPCs in colonies with 2+ residents
  // =========================================================================
  findTargets: (graphView: TemplateGraphView) => {
    // Strategy: by_kind with colony co-location filter
    const npcs = graphView.findEntities({ kind: 'npc', status: 'alive' });
    const colonies = selectByKind(graphView, 'location', ['colony']);

    const validTargets: HardState[] = [];
    for (const colony of colonies) {
      const colonyNpcs = npcs.filter(npc =>
        graphView.hasRelationship(npc.id, colony.id, 'resident_of')
      );
      if (colonyNpcs.length >= 2) {
        validTargets.push(colonyNpcs[0]);
      }
    }
    return validTargets;
  },

  // =========================================================================
  // STEPS 3-4: CREATION & RELATIONSHIPS
  // =========================================================================
  expand: async (graphView: TemplateGraphView, target?: HardState): Promise<TemplateResult> => {
    if (!target) {
      return emptyResult('Family expansion requires a target NPC');
    }

    // Find parent's location
    const residentOf = graphView.getRelatedEntities(target.id, 'resident_of', 'src');
    if (residentOf.length === 0) {
      return emptyResult(`${target.name} is homeless, cannot raise children`);
    }

    const colony = residentOf[0];
    if (!colony) {
      return emptyResult(`${target.name}'s home no longer exists`);
    }

    // Extract parameters
    const { numChildrenMin, numChildrenMax, inheritSubtypeChance, joinParentFactionChance } = extractParams(
      familyExpansion.metadata,
      { numChildrenMin: 1, numChildrenMax: 3, inheritSubtypeChance: 0.7, joinParentFactionChance: 0.5 }
    );

    // ------- STEP 3: CREATION -------

    const numChildren = randomCount(numChildrenMin, numChildrenMax);
    const subtypes: NPCSubtype[] = ['merchant', 'hero', 'mayor', 'outlaw'];
    const parentSubtype = target.subtype as NPCSubtype;

    // Region system is required for family expansion
    if (!graphView.hasRegionSystem()) {
      throw new Error(
        `family_expansion: Region system is not configured. ` +
        `Cannot place children without spatial coordinates.`
      );
    }

    const colonyRegion = graphView.getEntityRegion(colony);
    if (!colonyRegion) {
      throw new Error(
        `family_expansion: Colony region not found. ` +
        `Cannot place children without spatial coordinates.`
      );
    }

    const createdChildIds: string[] = [];
    const relationships: Relationship[] = [];

    for (let i = 0; i < numChildren; i++) {
      const childSubtype = Math.random() > inheritSubtypeChance
        ? pickRandom(subtypes)
        : parentSubtype;

      // Place child within colony region, near parent
      const entityId = await graphView.addEntityNearEntity(
        {
          kind: 'npc',
          subtype: childSubtype,
          description: `Child of ${target.name}, raised in ${colony.name}`,
          status: 'alive',
          prominence: 'marginal',
          culture: target.culture,
          tags: { second_generation: true }
        },
        target,
        { maxSearchRadius: 5, minDistance: 1 }
      );

      if (entityId) {
        createdChildIds.push(entityId);

        // ------- STEP 4: RELATIONSHIPS -------

        // Strategy: social(mentor_of)
        relationships.push(
          createRelationship('mentor_of', target.id, entityId)
        );

        // Strategy: spatial(resident_of)
        relationships.push(
          createRelationship('resident_of', entityId, colony.id)
        );

        // Strategy: conditional(member_of) - if parent is in faction
        const parentFactions = graphView.getRelatedEntities(target.id, 'member_of', 'src');
        if (parentFactions.length > 0 && Math.random() < joinParentFactionChance) {
          relationships.push(
            createRelationship('member_of', entityId, parentFactions[0].id)
          );
        }
      }
    }

    if (createdChildIds.length === 0) {
      return emptyResult(`Failed to create children for ${target.name}`);
    }

    return templateResult(
      [],  // Entities already added via addEntityNearEntity
      relationships,
      `${target.name} raises ${createdChildIds.length} ${createdChildIds.length === 1 ? 'child' : 'children'} in ${colony.name}`
    );
  }
};
