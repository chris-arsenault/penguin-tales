import { GrowthTemplate, TemplateResult } from '../../../../types/engine';
import { TemplateGraphView } from '../../../../services/templateGraphView';
import { HardState, NPCSubtype } from '../../../../types/worldTypes';
import { generateName, pickRandom, slugifyName } from '../../../../utils/helpers';

/**
 * Family Expansion Template
 *
 * Creates new NPCs as children of existing NPCs in colonies.
 * Children inherit parents' subtypes with some variation.
 */
export const familyExpansion: GrowthTemplate = {
  id: 'family_expansion',
  name: 'Family Growth',

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

  canApply: (graphView: TemplateGraphView) => {
    // Need at least 2 NPCs in same location
    const npcs = graphView.findEntities({ kind: 'npc', status: 'alive' });
    return npcs.length >= 2;
  },

  findTargets: (graphView: TemplateGraphView) => {
    // Find pairs of NPCs in same colony
    const npcs = graphView.findEntities({ kind: 'npc', status: 'alive' });
    const colonies = graphView.findEntities({ kind: 'location', subtype: 'colony' });

    const validTargets: HardState[] = [];
    for (const colony of colonies) {
      const colonyNpcs = npcs.filter(npc =>
        graphView.hasRelationship(npc.id, colony.id, 'resident_of')
      );
      if (colonyNpcs.length >= 2) {
        validTargets.push(colonyNpcs[0]); // Use first as target
      }
    }
    return validTargets;
  },

  expand: (graphView: TemplateGraphView, target?: HardState): TemplateResult => {
    if (!target) throw new Error('Family expansion requires a target NPC');

    // Find parent's location
    const residentOf = graphView.getRelatedEntities(target.id, 'resident_of', 'src');
    if (residentOf.length === 0) {
      // Parent has no home - fail gracefully
      return {
        entities: [],
        relationships: [],
        description: `${target.name} is homeless, cannot raise children`
      };
    }

    const colony = residentOf[0];
    if (!colony) {
      return {
        entities: [],
        relationships: [],
        description: `${target.name}'s home no longer exists`
      };
    }

    // Extract parameters from metadata
    const params = familyExpansion.metadata?.parameters || {};
    const numChildrenMin = params.numChildrenMin?.value ?? 1;
    const numChildrenMax = params.numChildrenMax?.value ?? 3;
    const inheritSubtypeChance = params.inheritSubtypeChance?.value ?? 0.7;
    const joinParentFactionChance = params.joinParentFactionChance?.value ?? 0.5;

    // Generate children
    const numChildren = Math.floor(Math.random() * (numChildrenMax - numChildrenMin + 1)) + numChildrenMin;
    const children: Partial<HardState>[] = [];
    const relationships: any[] = [];

    // Inherit subtype from parents with variation
    const subtypes: NPCSubtype[] = ['merchant', 'hero', 'mayor', 'outlaw'];
    const parentSubtype = target.subtype as NPCSubtype;

    for (let i = 0; i < numChildren; i++) {
      const childSubtype = Math.random() > inheritSubtypeChance
        ? pickRandom(subtypes)
        : parentSubtype;

      children.push({
        kind: 'npc',
        subtype: childSubtype,
        name: generateName(),
        description: `Child of ${target.name}, raised in ${colony.name}`,
        status: 'alive',
        prominence: 'marginal',
        culture: target.culture,  // Inherit parent's culture
        tags: ['second_generation']
      });

      // Create relationships for each child
      relationships.push({
        kind: 'mentor_of',
        src: target.id,
        dst: `will-be-assigned-${i}`
      });

      // Children live in parent's colony
      relationships.push({
        kind: 'resident_of',
        src: `will-be-assigned-${i}`,
        dst: colony.id
      });

      // If parent is in a faction, children might join
      const parentFactions = graphView.getRelatedEntities(target.id, 'member_of', 'src');
      if (parentFactions.length > 0 && Math.random() < joinParentFactionChance) {
        relationships.push({
          kind: 'member_of',
          src: `will-be-assigned-${i}`,
          dst: parentFactions[0].id
        });
      }
    }

    return {
      entities: children,
      relationships,
      description: `${target.name} raises ${numChildren} ${numChildren === 1 ? 'child' : 'children'} in ${colony.name}`
    };
  }
};
