/**
 * Outlaw Recruitment Template
 *
 * Strategy-based template for criminal factions recruiting members.
 *
 * Pipeline:
 *   1. Applicability: entity_count_min(faction/criminal, 1)
 *   2. Selection: by_kind(faction/criminal)
 *   3. Creation: selection_hybrid NPCs (prefer existing, create if needed)
 *   4. Relationships: hierarchical(member_of), spatial(resident_of)
 */

import { GrowthTemplate, TemplateResult, ComponentPurpose } from '@lore-weave/core';
import { TemplateGraphView } from '@lore-weave/core';
import { HardState, Relationship } from '@lore-weave/core';
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

export const outlawRecruitment: GrowthTemplate = {
  id: 'outlaw_recruitment',
  name: 'Criminal Recruitment',

  contract: {
    purpose: ComponentPurpose.ENTITY_CREATION,
    enabledBy: {
      entityCounts: [
        { kind: 'faction', min: 1 }
      ]
    },
    affects: {
      entities: [
        { kind: 'npc', operation: 'create', count: { min: 0, max: 2 } }
      ],
      relationships: [
        { kind: 'member_of', operation: 'create', count: { min: 1, max: 2 } },
        { kind: 'resident_of', operation: 'create', count: { min: 1, max: 2 } }
      ]
    }
  },

  metadata: {
    produces: {
      entityKinds: [
        {
          kind: 'npc',
          subtype: 'outlaw',
          count: { min: 1, max: 2 },
          prominence: [{ level: 'marginal', probability: 1.0 }],
        },
      ],
      relationships: [
        { kind: 'member_of', category: 'political', probability: 2.0, comment: '1-2 outlaws join faction' },
        { kind: 'resident_of', category: 'spatial', probability: 2.0, comment: 'Outlaws reside in stronghold/colony' },
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
        value: 1,
        min: 1,
        max: 4,
        description: 'Minimum number of outlaws recruited',
      },
      numOutlawsMax: {
        value: 2,
        min: 2,
        max: 10,
        description: 'Maximum number of outlaws recruited',
      },
    },
    tags: ['criminal', 'faction-expansion'],
  },

  // =========================================================================
  // STEP 1: APPLICABILITY - criminal factions exist
  // =========================================================================
  canApply: (graphView: TemplateGraphView) => {
    // Strategy: entity_count_min(faction/criminal, 1)
    return checkEntityCountMin(graphView, 'faction', 'criminal', 1);
  },

  // =========================================================================
  // STEP 2: SELECTION - criminal factions
  // =========================================================================
  findTargets: (graphView: TemplateGraphView) => {
    // Strategy: by_kind(faction/criminal)
    return selectByKind(graphView, 'faction', ['criminal']);
  },

  // =========================================================================
  // STEPS 3-4: CREATION & RELATIONSHIPS
  // =========================================================================
  expand: (graphView: TemplateGraphView, target?: HardState): TemplateResult => {
    const faction = target || pickRandom(selectByKind(graphView, 'faction', ['criminal']));

    if (!faction) {
      return emptyResult('Cannot recruit outlaws - no criminal factions exist');
    }

    const { numOutlawsMin, numOutlawsMax } = extractParams(
      outlawRecruitment.metadata,
      { numOutlawsMin: 1, numOutlawsMax: 2 }
    );

    const numOutlaws = randomCount(numOutlawsMin, numOutlawsMax);

    // ------- STEP 3: CREATION - selection_hybrid -------

    const result = graphView.selectTargets('npc', numOutlaws, {
      prefer: {
        subtypes: ['merchant', 'hero'],
        sameCultureAs: faction.culture,
        preferenceBoost: 1.5
      },
      avoid: {
        relationshipKinds: ['member_of'],
        hubPenaltyStrength: 2.0,
        maxTotalRelationships: 12,
        differentCulturePenalty: 0.4
      },
      createIfSaturated: {
        threshold: 0.2,
        factory: () => ({
          kind: 'npc',
          subtype: 'outlaw',
          description: `A shady character working for ${faction.name}`,
          status: 'alive',
          prominence: 'marginal',
          culture: faction.culture,
          tags: { criminal: true, recruit: true }
        }),
        maxCreated: Math.ceil(numOutlaws * 0.7)
      },
      diversityTracking: {
        trackingId: 'outlaw_recruitment',
        strength: 1.5
      }
    });

    const recruitedNpcs = result.existing;
    const newOutlaws = result.created;

    // Find faction stronghold or any colony
    const controlled = graphView.getRelatedEntities(faction.id, 'controls', 'src');
    let location = controlled.length > 0 ? controlled[0] : undefined;

    if (!location) {
      const colonies = selectByKind(graphView, 'location', ['colony']);
      location = colonies.length > 0 ? pickRandom(colonies) : undefined;
    }

    if (!location) {
      return emptyResult(`${faction.name} has nowhere to recruit outlaws`);
    }

    // ------- STEP 4: RELATIONSHIPS -------

    const relationships: Relationship[] = [];

    // Add relationships for recruited existing NPCs
    recruitedNpcs.forEach(npc => {
      relationships.push(
        createRelationship('member_of', npc.id, faction.id),
        createRelationship('resident_of', npc.id, location.id)
      );
    });

    // Add relationships for newly created outlaws
    newOutlaws.forEach((_, i) => {
      relationships.push(
        createRelationship('member_of', `will-be-assigned-${i}`, faction.id),
        createRelationship('resident_of', `will-be-assigned-${i}`, location.id)
      );
    });

    const totalRecruits = recruitedNpcs.length + newOutlaws.length;
    const creationNote = newOutlaws.length > 0
      ? ` (${newOutlaws.length} new outlaws created)`
      : '';

    return templateResult(
      newOutlaws,
      relationships,
      `${faction.name} recruits ${totalRecruits} new members${creationNote}`
    );
  }
};
