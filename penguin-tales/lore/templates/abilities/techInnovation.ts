/**
 * Technology Innovation Template
 *
 * Strategy-based template for merchant factions developing technologies.
 *
 * Pipeline:
 *   1. Applicability: entity_count_min(faction/company, 1)
 *   2. Selection: by_kind(faction/company) with tech count limit
 *   3. Creation: near_reference with culture inheritance
 *   4. Relationships: wields(faction → tech), practitioner_of(members → tech)
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
  selectByRelationship,
  // Step 3: Creation
  deriveCoordinatesNearReference,
  createEntityPartial,
  // Step 4: Relationships
  createRelationship,
  // Result helpers
  emptyResult,
  templateResult
} from '../../utils/strategyExecutors';

export const techInnovation: GrowthTemplate = {
  id: 'tech_innovation',
  name: 'Technology Development',

  contract: {
    purpose: ComponentPurpose.ENTITY_CREATION,
    enabledBy: {
      entityCounts: [
        { kind: 'faction', min: 1 }
      ]
    },
    affects: {
      entities: [
        { kind: 'abilities', operation: 'create', count: { min: 1, max: 1 } }
      ],
      relationships: [
        { kind: 'wields', operation: 'create', count: { min: 1, max: 1 } },
        { kind: 'practitioner_of', operation: 'create', count: { min: 1, max: 3 } }
      ]
    }
  },

  metadata: {
    produces: {
      entityKinds: [
        {
          kind: 'abilities',
          subtype: 'technology',
          count: { min: 1, max: 1 },
          prominence: [{ level: 'marginal', probability: 1.0 }],
        },
      ],
      relationships: [
        { kind: 'wields', category: 'cultural', probability: 1.0, comment: 'Faction wields technology' },
        { kind: 'practitioner_of', category: 'cultural', probability: 2.0, comment: '1-3 faction members practice' },
      ],
    },
    effects: {
      graphDensity: 0.4,
      clusterFormation: 0.5,
      diversityImpact: 0.7,
      comment: 'Creates technology abilities developed by merchant factions',
    },
    parameters: {
      maxPractitioners: {
        value: 3,
        min: 1,
        max: 10,
        description: 'Maximum number of faction members who practice new technology',
      },
      maxTechPerFaction: {
        value: 4,
        min: 1,
        max: 10,
        description: 'Maximum technologies per faction',
      },
    },
    tags: ['technology', 'ability-creation'],
  },

  // =========================================================================
  // STEP 1: APPLICABILITY - company factions exist
  // =========================================================================
  canApply: (graphView: TemplateGraphView) => {
    // Strategy: entity_count_min(faction/company, 1)
    return checkEntityCountMin(graphView, 'faction', 'company', 1);
  },

  // =========================================================================
  // STEP 2: SELECTION - companies with room for more tech
  // =========================================================================
  findTargets: (graphView: TemplateGraphView) => {
    const { maxTechPerFaction } = extractParams(techInnovation.metadata, { maxTechPerFaction: 4 });

    // Strategy: by_kind(faction/company) with tech count filter
    const companies = selectByKind(graphView, 'faction', ['company']);

    return companies.filter(faction => {
      const techCount = graphView.getAllRelationships().filter(r =>
        r.kind === 'wields' && r.src === faction.id
      ).length;
      return techCount < maxTechPerFaction;
    });
  },

  // =========================================================================
  // STEPS 3-4: CREATION & RELATIONSHIPS
  // =========================================================================
  expand: (graphView: TemplateGraphView, target?: HardState): TemplateResult => {
    const { maxPractitioners } = extractParams(techInnovation.metadata, { maxPractitioners: 3 });

    // Resolve target faction
    const faction = target || pickRandom(selectByKind(graphView, 'faction', ['company']));

    if (!faction) {
      return emptyResult('Cannot develop technology - no company factions exist');
    }

    // Find faction members who can practice the new tech
    const members = graphView.findEntities({}).filter(
      e => e.kind === 'npc' && e.links.some(l => l.kind === 'member_of' && l.dst === faction.id)
    );

    if (members.length === 0) {
      return emptyResult(`${faction.name} has no members to develop new technology`);
    }

    // ------- STEP 3: CREATION -------

    // Find existing tech from same faction for reference
    const existingTech = graphView.findEntities({ kind: 'abilities', subtype: 'technology' })
      .filter(tech => graphView.hasRelationship(faction.id, tech.id, 'wields'));

    const practitioners = members.slice(0, Math.min(maxPractitioners, members.length));

    const referenceEntities: HardState[] = [faction, ...practitioners];
    if (existingTech.length > 0) {
      referenceEntities.push(existingTech[0]);
    }

    const cultureId = faction.culture ?? 'default';

    // Strategy: deriveCoordinatesNearReference
    const coords = deriveCoordinatesNearReference(graphView, 'abilities', referenceEntities, cultureId);

    // Strategy: createEntityPartial
    const technology = createEntityPartial('abilities', 'technology', {
      status: 'discovered',
      prominence: 'marginal',
      culture: faction.culture,
      description: `Innovation developed by ${faction.name}`,
      tags: { technology: true, innovation: true },
      coordinates: coords
    });

    // ------- STEP 4: RELATIONSHIPS -------

    const relationships: Relationship[] = [];

    // Strategy: wields - faction owns technology
    relationships.push(
      createRelationship('wields', faction.id, 'will-be-assigned-0')
    );

    // Strategy: practitioner_of - members practice technology
    practitioners.forEach(npc => {
      relationships.push(
        createRelationship('practitioner_of', npc.id, 'will-be-assigned-0')
      );
    });

    return templateResult(
      [technology],
      relationships,
      `${faction.name} develops new technology`
    );
  }
};
