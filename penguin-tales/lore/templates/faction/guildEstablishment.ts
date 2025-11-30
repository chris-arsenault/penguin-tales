/**
 * Guild Establishment Template
 *
 * Strategy-based template for merchant guilds forming in colonies.
 *
 * Pipeline:
 *   1. Applicability: entity_count_min(merchant, 2) AND entity_count_min(colony, 1)
 *   2. Selection: by_kind(location/colony) with no existing guild filter
 *   3. Creation: faction + selection_hybrid merchants
 *   4. Relationships: hierarchical(controls, member_of), spatial(resident_of)
 */

import { GrowthTemplate, TemplateResult, ComponentPurpose } from '@lore-weave/core';
import { TemplateGraphView } from '@lore-weave/core';
import { HardState, Relationship } from '@lore-weave/core';
import { pickRandom, buildRelationships } from '@lore-weave/core';

import {
  // Step 1: Applicability
  checkEntityCountMin,
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

export const guildEstablishment: GrowthTemplate = {
  id: 'guild_establishment',
  name: 'Guild Formation',

  contract: {
    purpose: ComponentPurpose.ENTITY_CREATION,
    enabledBy: {
      entityCounts: [
        { kind: 'npc', min: 2 },
        { kind: 'location', min: 1 }
      ]
    },
    affects: {
      entities: [
        { kind: 'faction', operation: 'create', count: { min: 1, max: 1 } },
        { kind: 'npc', operation: 'create', count: { min: 0, max: 2 } }
      ],
      relationships: [
        { kind: 'controls', operation: 'create', count: { min: 1, max: 1 } },
        { kind: 'member_of', operation: 'create', count: { min: 0, max: 5 } },
        { kind: 'resident_of', operation: 'create', count: { min: 0, max: 5 } }
      ],
      pressures: []
    }
  },

  metadata: {
    produces: {
      entityKinds: [
        {
          kind: 'faction',
          subtype: 'company',
          count: { min: 1, max: 1 },
          prominence: [{ level: 'recognized', probability: 1.0 }],
        },
      ],
      relationships: [
        { kind: 'controls', category: 'political', probability: 1.0, comment: 'Guild controls colony trade' },
        { kind: 'member_of', category: 'political', probability: 2.5, comment: '2-3 merchants join guild' },
        { kind: 'resident_of', category: 'spatial', probability: 2.5, comment: 'Merchants reside in colony' },
      ],
    },
    effects: {
      graphDensity: 0.6,
      clusterFormation: 0.8,
      diversityImpact: 0.4,
      comment: 'Forms tight economic clusters within colonies',
    },
    tags: ['economic', 'colony-centric', 'cluster-forming'],
  },

  // =========================================================================
  // STEP 1: APPLICABILITY - entity_count_min requirements
  // =========================================================================
  canApply: (graphView: TemplateGraphView) => {
    // Strategy: entity_count_min(merchant, 2) AND entity_count_min(colony, 1)
    if (!checkEntityCountMin(graphView, 'npc', 'merchant', 2)) {
      return false;
    }
    if (!checkEntityCountMin(graphView, 'location', 'colony', 1)) {
      return false;
    }
    return true;
  },

  // =========================================================================
  // STEP 2: SELECTION - colonies without guilds
  // =========================================================================
  findTargets: (graphView: TemplateGraphView) => {
    // Strategy: by_kind(location/colony) with relationship filter
    const colonies = selectByKind(graphView, 'location', ['colony']);
    const companies = graphView.findEntities({ kind: 'faction', subtype: 'company' });

    // Filter out colonies that already have a guild controlling them
    return colonies.filter(colony => {
      return !companies.some(company =>
        graphView.hasRelationship(company.id, colony.id, 'controls')
      );
    });
  },

  // =========================================================================
  // STEPS 3-4: CREATION & RELATIONSHIPS
  // =========================================================================
  expand: (graphView: TemplateGraphView, target?: HardState): TemplateResult => {
    // Resolve target colony
    const colony = target || pickRandom(selectByKind(graphView, 'location', ['colony']));

    if (!colony) {
      return emptyResult('Cannot establish guild - no colonies exist');
    }

    // ------- STEP 3: CREATION -------

    // Find reference entities for coordinate placement
    const existingCompanies = graphView.findEntities({ kind: 'faction', subtype: 'company' });

    const referenceEntities: HardState[] = [colony];
    if (existingCompanies.length > 0) {
      referenceEntities.push(...existingCompanies.slice(0, 2));
    }

    const cultureId = colony.culture ?? 'default';

    // Strategy: createEntityPartial for guild
    const guildCoords = deriveCoordinatesNearReference(graphView, 'faction', referenceEntities, cultureId);
    const guild = createEntityPartial('faction', 'company', {
      status: 'state_sanctioned',
      prominence: 'recognized',
      culture: colony.culture,
      description: `A merchant guild controlling trade in ${colony.name}`,
      tags: { trade: true, guild: true, organized: true },
      coordinates: guildCoords
    });

    // Strategy: selection_hybrid for merchants
    const newMerchantCoords = deriveCoordinatesNearReference(graphView, 'npc', [colony], cultureId);

    const selectionResult = graphView.selectTargets('npc', 3, {
      prefer: {
        subtypes: ['merchant'],
        sameLocationAs: colony.id,
        sameCultureAs: colony.culture,
        preferenceBoost: 3.0
      },
      avoid: {
        relationshipKinds: ['member_of', 'leader_of'],
        hubPenaltyStrength: 3.0,
        maxTotalRelationships: 10,
        differentCulturePenalty: 0.2
      },
      createIfSaturated: {
        threshold: 0.2,
        factory: () => ({
          kind: 'npc',
          subtype: 'merchant',
          description: `An independent merchant seeking guild membership`,
          status: 'alive',
          prominence: 'marginal',
          culture: colony.culture,
          tags: { trader: true, 'guild-founder': true },
          coordinates: newMerchantCoords
        }),
        maxCreated: 2
      },
      diversityTracking: {
        trackingId: 'guild_recruitment',
        strength: 2.0
      }
    });

    const merchantsToRecruit = selectionResult.existing;
    const newMerchants = selectionResult.created;

    // ------- STEP 4: RELATIONSHIPS -------

    const relationshipBuilder = buildRelationships();

    // Strategy: hierarchical(controls) - guild controls colony
    relationshipBuilder.add('controls', 'will-be-assigned-0', colony.id);

    // Add relationships for existing merchants
    const existingMerchantIds = merchantsToRecruit.map(m => m.id);
    relationshipBuilder
      .addManyTo('member_of', existingMerchantIds, 'will-be-assigned-0')
      .addManyTo('resident_of', existingMerchantIds, colony.id);

    // Add relationships for newly created merchants
    // Placeholder indices: 0=guild, 1+=new merchants
    newMerchants.forEach((_, index) => {
      const merchantPlaceholderId = `will-be-assigned-${1 + index}`;
      relationshipBuilder
        .add('member_of', merchantPlaceholderId, 'will-be-assigned-0')
        .add('resident_of', merchantPlaceholderId, colony.id);
    });

    const relationships = relationshipBuilder.build();

    // Build description
    const totalMerchants = merchantsToRecruit.length + newMerchants.length;
    const creationNote = newMerchants.length > 0
      ? ` (${newMerchants.length} new merchants recruited)`
      : '';

    return templateResult(
      [guild, ...newMerchants],
      relationships,
      `${totalMerchants} merchants organize into a trade guild in ${colony.name}${creationNote}`
    );
  }
};
