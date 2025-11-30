/**
 * Kinship Constellation Template
 *
 * Strategy-based template for creating extended family structures with internal dynamics.
 *
 * Pipeline:
 *   1. Applicability: entity_count_min(faction, 1) AND entity_count_min(colony, 1) AND entity_count_max(npc, 100)
 *   2. Selection: by_kind(faction)
 *   3. Creation: batch_varied family members with Ising model trait assignment
 *   4. Relationships: spatial(resident_of), hierarchical(member_of), social(mentor_of, rival_of, lover_of)
 */

import { GrowthTemplate, TemplateResult, ComponentPurpose } from '@lore-weave/core';
import { TemplateGraphView } from '@lore-weave/core';
import { HardState, Relationship } from '@lore-weave/core';
import { pickRandom, hasTag, extractParams } from '@lore-weave/core';

import {
  // Step 1: Applicability
  checkEntityCountMin,
  checkNotSaturated,
  // Step 2: Selection
  selectByKind,
  // Step 3: Creation
  createEntityPartial,
  randomCount,
  // Step 4: Relationships
  createRelationship,
  // Result helpers
  emptyResult,
  templateResult
} from '../../utils/strategyExecutors';

interface FamilyMember {
  role: 'matriarch' | 'patriarch' | 'provider' | 'prodigy' | 'blacksheep' | 'bridge' | 'hermit';
  trait: number;
  subtype: 'merchant' | 'hero' | 'outlaw' | 'mayor';
}

export const kinshipConstellation: GrowthTemplate = {
  id: 'kinship_constellation',
  name: 'Extended Family Formation',

  contract: {
    purpose: ComponentPurpose.ENTITY_CREATION,
    enabledBy: {
      entityCounts: [
        { kind: 'faction', min: 1 },
        { kind: 'location', min: 1 }
      ]
    },
    affects: {
      entities: [
        { kind: 'npc', operation: 'create', count: { min: 5, max: 8 } }
      ],
      relationships: [
        { kind: 'resident_of', operation: 'create', count: { min: 5, max: 8 } },
        { kind: 'member_of', operation: 'create', count: { min: 5, max: 8 } },
        { kind: 'mentor_of', operation: 'create', count: { min: 1, max: 1 } },
        { kind: 'rival_of', operation: 'create', count: { min: 0, max: 2 } },
        { kind: 'lover_of', operation: 'create', count: { min: 0, max: 1 } }
      ]
    }
  },

  metadata: {
    produces: {
      entityKinds: [
        {
          kind: 'npc',
          subtype: 'various',
          count: { min: 5, max: 8 },
          prominence: [
            { level: 'marginal', probability: 0.75 },
            { level: 'recognized', probability: 0.25 },
          ],
        },
      ],
      relationships: [
        { kind: 'resident_of', category: 'spatial', probability: 7.0, comment: 'All family members reside in location' },
        { kind: 'member_of', category: 'political', probability: 7.0, comment: 'All family members join faction' },
        { kind: 'mentor_of', category: 'social', probability: 1.0, comment: 'Elder mentors prodigy' },
        { kind: 'rival_of', category: 'social', probability: 2.0, comment: 'Internal family rivalries' },
        { kind: 'lover_of', category: 'social', probability: 0.5, comment: 'Romance within family' },
      ],
    },
    effects: {
      graphDensity: 0.8,
      clusterFormation: 0.9,
      diversityImpact: 0.6,
      comment: 'Creates tight family clusters with internal diversity via Ising model',
    },
    parameters: {
      familySizeMin: { value: 5, min: 3, max: 6, description: 'Minimum family size' },
      familySizeMax: { value: 8, min: 5, max: 12, description: 'Maximum family size' },
      rivalryChance: { value: 0.4, min: 0.0, max: 0.8, description: 'Probability of rivalry between adjacent members with opposite traits' },
      romanceChance: { value: 0.5, min: 0.0, max: 0.8, description: 'Probability of romance between bridge and provider' },
      isingTemperature: { value: 1.0, min: 0.5, max: 2.0, description: 'Metropolis algorithm temperature (higher = more randomness)' },
      isingCouplingStrength: { value: -0.5, min: -1.0, max: 0.0, description: 'Ising coupling J (negative = opposites attract)' },
      isingExternalField: { value: 0.3, min: 0.0, max: 1.0, description: 'External field h magnitude (faction influence on traits)' },
    },
    tags: ['family', 'ising-model', 'cluster-forming'],
  },

  // =========================================================================
  // STEP 1: APPLICABILITY - faction AND colony AND NPC limit
  // =========================================================================
  canApply: (graphView: TemplateGraphView) => {
    // Strategy: entity_count_min(faction, 1) AND entity_count_min(colony, 1)
    if (!checkEntityCountMin(graphView, 'faction', undefined, 1)) return false;
    if (!checkEntityCountMin(graphView, 'location', 'colony', 1)) return false;

    // Strategy: entity_count_max(npc, 100)
    const npcs = graphView.findEntities({ kind: 'npc', status: 'alive' });
    return npcs.length < 100;
  },

  // =========================================================================
  // STEP 2: SELECTION - factions to attach family to
  // =========================================================================
  findTargets: (graphView: TemplateGraphView) => {
    // Strategy: by_kind(faction)
    return graphView.findEntities({ kind: 'faction' });
  },

  // =========================================================================
  // STEPS 3-4: CREATION & RELATIONSHIPS
  // =========================================================================
  expand: (graphView: TemplateGraphView, target?: HardState): TemplateResult => {
    const faction = target || pickRandom(graphView.findEntities({ kind: 'faction' }));

    if (!faction) {
      return emptyResult('Cannot create family - no factions exist');
    }

    // Find faction's location
    const controlledLocations = graphView.getRelatedEntities(faction.id, 'controls', 'src');
    let location = controlledLocations.length > 0 ? controlledLocations[0] : undefined;

    if (!location) {
      const colonies = selectByKind(graphView, 'location', ['colony']);
      location = colonies.length > 0 ? pickRandom(colonies) : undefined;
    }

    if (!location) {
      return emptyResult(`${faction.name} has no location for family settlement`);
    }

    // Extract parameters
    const params = extractParams(kinshipConstellation.metadata, {
      familySizeMin: 5, familySizeMax: 8, rivalryChance: 0.4, romanceChance: 0.5,
      isingTemperature: 1.0, isingCouplingStrength: -0.5, isingExternalField: 0.3
    });

    // ------- STEP 3: CREATION -------

    const familySize = randomCount(params.familySizeMin, params.familySizeMax);
    const familyMembers: FamilyMember[] = [];

    // Assign roles
    const roles: FamilyMember['role'][] = ['matriarch', 'provider', 'prodigy', 'blacksheep', 'bridge'];
    if (familySize > 5) roles.push('hermit');
    if (familySize > 6) roles.push('patriarch');
    if (familySize > 7) roles.push('provider');

    while (roles.length < familySize) {
      roles.push('provider');
    }

    // Initialize with random traits
    roles.forEach(role => {
      familyMembers.push({
        role,
        trait: Math.random() > 0.5 ? 1 : -1,
        subtype: 'merchant'
      });
    });

    // Metropolis algorithm for Ising model
    const J = params.isingCouplingStrength;
    const h = hasTag(faction.tags, 'traditional') ? params.isingExternalField : -params.isingExternalField;

    for (let iteration = 0; iteration < 50; iteration++) {
      const memberIndex = Math.floor(Math.random() * familyMembers.length);
      const member = familyMembers[memberIndex];

      const oldEnergy = calculateEnergy(familyMembers, memberIndex, J, h);
      member.trait *= -1;
      const newEnergy = calculateEnergy(familyMembers, memberIndex, J, h);

      const deltaE = newEnergy - oldEnergy;
      const acceptProb = Math.min(1, Math.exp(-deltaE / params.isingTemperature));

      if (Math.random() > acceptProb) {
        member.trait *= -1; // Reject
      }
    }

    // Assign subtypes based on roles
    familyMembers.forEach(member => {
      if (member.role === 'matriarch' || member.role === 'patriarch') {
        member.subtype = 'mayor';
      } else if (member.role === 'prodigy') {
        member.subtype = 'hero';
      } else if (member.role === 'blacksheep') {
        member.subtype = 'outlaw';
      } else {
        member.subtype = 'merchant';
      }
    });

    // Create entities
    const entities: Partial<HardState>[] = [];
    const relationships: Relationship[] = [];

    familyMembers.forEach((member, i) => {
      const tags: Record<string, boolean> = { family: true };
      if (member.trait > 0) tags.traditional = true;
      else tags.radical = true;
      if (member.role === 'prodigy') tags.talented = true;
      if (member.role === 'blacksheep') tags.rebellious = true;

      // Strategy: createEntityPartial
      entities.push(createEntityPartial('npc', member.subtype, {
        status: 'alive',
        prominence: member.role === 'prodigy' ? 'recognized' : 'marginal',
        culture: location.culture,
        description: `A ${member.role} in a family at ${location.name}, ${member.trait > 0 ? 'upholding tradition' : 'embracing change'}.`,
        tags
      }));

      // ------- STEP 4: RELATIONSHIPS -------

      // Strategy: spatial(resident_of)
      relationships.push(
        createRelationship('resident_of', `will-be-assigned-${i}`, location.id)
      );

      // Strategy: hierarchical(member_of)
      relationships.push(
        createRelationship('member_of', `will-be-assigned-${i}`, faction.id)
      );
    });

    // Strategy: social(mentor_of) - elder mentors prodigy
    if (familySize >= 2) {
      relationships.push(
        createRelationship('mentor_of', 'will-be-assigned-0', 'will-be-assigned-2')
      );
    }

    // Strategy: social(rival_of) - adjacent members with opposite traits
    for (let i = 0; i < familyMembers.length - 1; i++) {
      if (familyMembers[i].trait !== familyMembers[i + 1].trait) {
        if (Math.random() < params.rivalryChance) {
          relationships.push(
            createRelationship('rival_of', `will-be-assigned-${i}`, `will-be-assigned-${i + 1}`)
          );
        }
      }
    }

    // Strategy: social(lover_of) - bridge + provider romance
    if (familySize >= 5) {
      const bridgeIndex = familyMembers.findIndex(m => m.role === 'bridge');
      const providerIndex = familyMembers.findIndex(m => m.role === 'provider');

      if (bridgeIndex >= 0 && providerIndex >= 0 && bridgeIndex !== providerIndex) {
        const areRivals = relationships.some(
          r => r.kind === 'rival_of' &&
               ((r.src === `will-be-assigned-${bridgeIndex}` && r.dst === `will-be-assigned-${providerIndex}`) ||
                (r.src === `will-be-assigned-${providerIndex}` && r.dst === `will-be-assigned-${bridgeIndex}`))
        );

        if (!areRivals && Math.random() < params.romanceChance) {
          relationships.push(
            createRelationship('lover_of', `will-be-assigned-${bridgeIndex}`, `will-be-assigned-${providerIndex}`)
          );
        }
      }
    }

    return templateResult(
      entities,
      relationships,
      `An extended family emerges in ${location.name}, ${familySize} members strong with complex internal dynamics`
    );
  }
};

function calculateEnergy(members: FamilyMember[], index: number, J: number, h: number): number {
  const member = members[index];
  let energy = -h * member.trait;

  if (index > 0) {
    energy += -J * member.trait * members[index - 1].trait;
  }
  if (index < members.length - 1) {
    energy += -J * member.trait * members[index + 1].trait;
  }

  return energy;
}
