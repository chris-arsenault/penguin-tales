import { GrowthTemplate, TemplateResult, Graph } from '../../types/engine';
import { HardState, NPCSubtype } from '../../types/worldTypes';
import { generateName, pickRandom, findEntities, slugifyName } from '../../utils/helpers';

/**
 * Family Expansion Template
 *
 * Creates new NPCs as children of existing NPCs in colonies.
 * Children inherit parents' subtypes with some variation.
 */
export const familyExpansion: GrowthTemplate = {
  id: 'family_expansion',
  name: 'Family Growth',

  canApply: (graph: Graph) => {
    // Need at least 2 NPCs in same location
    const npcs = findEntities(graph, { kind: 'npc', status: 'alive' });
    return npcs.length >= 2;
  },

  findTargets: (graph: Graph) => {
    // Find pairs of NPCs in same colony
    const npcs = findEntities(graph, { kind: 'npc', status: 'alive' });
    const colonies = findEntities(graph, { kind: 'location', subtype: 'colony' });

    const validTargets: HardState[] = [];
    for (const colony of colonies) {
      const colonyNpcs = npcs.filter(npc =>
        npc.links.some(l => l.kind === 'resident_of' && l.dst === colony.id)
      );
      if (colonyNpcs.length >= 2) {
        validTargets.push(colonyNpcs[0]); // Use first as target
      }
    }
    return validTargets;
  },

  expand: (graph: Graph, target?: HardState): TemplateResult => {
    if (!target) throw new Error('Family expansion requires a target NPC');

    // Find parent's location
    const residentLink = target.links.find(l => l.kind === 'resident_of');
    if (!residentLink) {
      // Parent has no home - fail gracefully
      return {
        entities: [],
        relationships: [],
        description: `${target.name} is homeless, cannot raise children`
      };
    }

    const colony = graph.entities.get(residentLink.dst);
    if (!colony) {
      return {
        entities: [],
        relationships: [],
        description: `${target.name}'s home no longer exists`
      };
    }

    // Generate 1-3 children
    const numChildren = Math.floor(Math.random() * 3) + 1;
    const children: Partial<HardState>[] = [];
    const relationships: any[] = [];

    // Inherit subtype from parents with variation
    const subtypes: NPCSubtype[] = ['merchant', 'hero', 'mayor', 'outlaw'];
    const parentSubtype = target.subtype as NPCSubtype;

    for (let i = 0; i < numChildren; i++) {
      const childSubtype = Math.random() > 0.7
        ? pickRandom(subtypes)
        : parentSubtype;

      children.push({
        kind: 'npc',
        subtype: childSubtype,
        name: generateName(),
        description: `Child of ${target.name}, raised in ${colony.name}`,
        status: 'alive',
        prominence: 'marginal',
        tags: ['second_generation', `name:${slugifyName(colony.name)}`]
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

      // If parent is in a faction, children might join (50% chance)
      const parentFaction = target.links.find(l => l.kind === 'member_of');
      if (parentFaction && Math.random() > 0.5) {
        relationships.push({
          kind: 'member_of',
          src: `will-be-assigned-${i}`,
          dst: parentFaction.dst
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
