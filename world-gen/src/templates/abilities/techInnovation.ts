import { GrowthTemplate, TemplateResult, Graph } from '../../types/engine';
import { HardState, Relationship } from '../../types/worldTypes';
import { pickRandom, findEntities } from '../../utils/helpers';

/**
 * Technology Innovation Template
 *
 * Merchant factions develop new technologies to improve efficiency.
 * Creates technology abilities linked to the developing faction.
 */
export const techInnovation: GrowthTemplate = {
  id: 'tech_innovation',
  name: 'Technology Development',

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
    },
    tags: ['technology', 'ability-creation'],
  },

  canApply: (graph: Graph) => findEntities(graph, { kind: 'faction', subtype: 'company' }).length > 0,

  findTargets: (graph: Graph) => findEntities(graph, { kind: 'faction', subtype: 'company' }),
  
  expand: (graph: Graph, target?: HardState): TemplateResult => {
    const faction = target || pickRandom(findEntities(graph, { kind: 'faction', subtype: 'company' }));

    if (!faction) {
      // No company faction exists - fail gracefully
      return {
        entities: [],
        relationships: [],
        description: 'Cannot develop technology - no company factions exist'
      };
    }

    // Find faction members who can practice the new tech
    const members = Array.from(graph.entities.values()).filter(
      e => e.kind === 'npc' && e.links.some(l => l.kind === 'member_of' && l.dst === faction.id)
    );

    if (members.length === 0) {
      // Faction has no members to practice the technology - fail gracefully
      return {
        entities: [],
        relationships: [],
        description: `${faction.name} has no members to develop new technology`
      };
    }

    // Extract parameters from metadata
    const params = techInnovation.metadata?.parameters || {};
    const maxPractitioners = params.maxPractitioners?.value ?? 3;

    const relationships: any[] = [
      { kind: 'wields', src: faction.id, dst: 'will-be-assigned-0' }
    ];

    // Add practitioner relationships for some faction members
    const practitioners = members.slice(0, Math.min(maxPractitioners, members.length));
    practitioners.forEach(npc => {
      relationships.push({
        kind: 'practitioner_of',
        src: npc.id,
        dst: 'will-be-assigned-0'
      });
    });

    return {
      entities: [{
        kind: 'abilities',
        subtype: 'technology',
        name: `${pickRandom(['Advanced', 'Improved', 'Enhanced'])} ${pickRandom(['Fishing', 'Ice', 'Navigation'])} Tech`,
        description: `Innovation developed by ${faction.name}`,
        status: 'discovered',
        prominence: 'marginal',
        tags: ['tech', 'innovation']
      }],
      relationships,
      description: `${faction.name} develops new technology`
    };
  }
};
