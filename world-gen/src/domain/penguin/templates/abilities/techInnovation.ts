import { GrowthTemplate, TemplateResult, ComponentPurpose } from '../../../../types/engine';
import { TemplateGraphView } from '../../../../services/templateGraphView';
import { HardState, Relationship } from '../../../../types/worldTypes';
import { pickRandom } from '../../../../utils/helpers';

/**
 * Technology Innovation Template
 *
 * Merchant factions develop new technologies to improve efficiency.
 * Creates technology abilities linked to the developing faction.
 */
export const techInnovation: GrowthTemplate = {
  id: 'tech_innovation',
  name: 'Technology Development',

  contract: {
    purpose: ComponentPurpose.ENTITY_CREATION,
    enabledBy: {
      entityCounts: [
        { kind: 'faction', min: 1 }  // Need company factions to innovate
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
    },
    tags: ['technology', 'ability-creation'],
  },

  canApply: (graphView: TemplateGraphView) => graphView.findEntities({ kind: 'faction', subtype: 'company' }).length > 0,

  findTargets: (graphView: TemplateGraphView) => {
    const maxTechPerFaction = 4; // Limit to 4 technologies per faction
    const companies = graphView.findEntities({ kind: 'faction', subtype: 'company' });

    // Filter out factions that have already developed too many technologies
    return companies.filter(faction => {
      const techCount = graphView.getAllRelationships().filter(r =>
        r.kind === 'wields' && r.src === faction.id
      ).length;
      return techCount < maxTechPerFaction;
    });
  },
  
  expand: (graphView: TemplateGraphView, target?: HardState): TemplateResult => {
    const faction = target || pickRandom(graphView.findEntities({ kind: 'faction', subtype: 'company' }));

    if (!faction) {
      // No company faction exists - fail gracefully
      return {
        entities: [],
        relationships: [],
        description: 'Cannot develop technology - no company factions exist'
      };
    }

    // Find faction members who can practice the new tech
    const members = graphView.findEntities({}).filter(
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
        tags: ['technology', 'innovation']
      }],
      relationships,
      description: `${faction.name} develops new technology`
    };
  }
};
