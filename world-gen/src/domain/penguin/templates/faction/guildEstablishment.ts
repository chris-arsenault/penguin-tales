import { GrowthTemplate, TemplateResult, ComponentPurpose } from '../../../../types/engine';
import { TemplateGraphView } from '../../../../services/templateGraphView';
import { HardState, Relationship } from '../../../../types/worldTypes';
import { generateName, pickRandom, findEntities, slugifyName } from '../../../../utils/helpers';

/**
 * Guild Establishment Template
 *
 * Merchant guilds form in colonies to control trade.
 * Creates the guild faction and 2-3 merchant members.
 */
export const guildEstablishment: GrowthTemplate = {
  id: 'guild_establishment',
  name: 'Guild Formation',

  contract: {
    purpose: ComponentPurpose.ENTITY_CREATION,
    enabledBy: {
      entityCounts: [
        { kind: 'npc', min: 2 },      // Needs merchants (checked in canApply)
        { kind: 'location', min: 1 }  // Needs colonies (checked in canApply)
      ]
    },
    affects: {
      entities: [
        { kind: 'faction', operation: 'create', count: { min: 1, max: 1 } },
        { kind: 'npc', operation: 'create', count: { min: 0, max: 2 } }  // FIXED: May create up to 2 new merchants (maxCreated=2)
      ],
      relationships: [
        { kind: 'controls', operation: 'create', count: { min: 1, max: 1 } },
        { kind: 'member_of', operation: 'create', count: { min: 0, max: 5 } },  // 0-5 merchants (can use existing)
        { kind: 'resident_of', operation: 'create', count: { min: 0, max: 5 } }  // 0-5 resident_of relationships
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

  canApply: (graphView: TemplateGraphView) => {
    const merchantCount = graphView.getEntityCount('npc', 'merchant');
    const colonyCount = graphView.getEntityCount('location', 'colony');
    return merchantCount >= 2 && colonyCount > 0;
  },

  findTargets: (graphView: TemplateGraphView) => {
    const colonies = graphView.findEntities({ kind: 'location', subtype: 'colony' });
    const companies = graphView.findEntities({ kind: 'faction', subtype: 'company' });

    // Filter out colonies that already have a guild controlling them
    return colonies.filter(colony => {
      return !companies.some(company =>
        graphView.hasRelationship(company.id, colony.id, 'controls')
      );
    });
  },
  
  expand: (graphView: TemplateGraphView, target?: HardState): TemplateResult => {
    const colony = target || pickRandom(
      graphView.findEntities({ kind: 'location', subtype: 'colony' })
    );

    if (!colony) {
      // No colony exists - fail gracefully
      return {
        entities: [],
        relationships: [],
        description: 'Cannot establish guild - no colonies exist'
      };
    }

    const guild: Partial<HardState> = {
      kind: 'faction',
      subtype: 'company',
      name: `${colony.name} ${pickRandom(['Traders', 'Merchants', 'Exchange'])}`,
      description: `A merchant guild controlling trade in ${colony.name}`,
      status: 'state_sanctioned',
      prominence: 'recognized',
      tags: ['trade', 'guild', 'organized']
    };
    
    // Use targetSelector to intelligently select merchants (prevents super-hubs)
    let merchantsToRecruit: HardState[] = [];
    let newMerchants: Array<Partial<HardState>> = [];

    // Smart selection with aggressive hub penalties (guilds are exclusive)
    const result = graphView.selectTargets('npc', 3, {
        prefer: {
          subtypes: ['merchant'],
          sameLocationAs: colony.id, // Prefer local merchants
          preferenceBoost: 3.0 // Strong preference for merchants
        },
        avoid: {
          relationshipKinds: ['member_of', 'leader_of'], // Penalize multi-faction NPCs
          hubPenaltyStrength: 3.0, // Very aggressive penalty (cubic)
          maxTotalRelationships: 10 // Hard cap on super-hubs
        },
        createIfSaturated: {
          threshold: 0.2, // If best score < 0.2, create new merchant
          factory: (gv, ctx) => ({
            kind: 'npc',
            subtype: 'merchant',
            name: generateName('npc'),
            description: `An independent merchant seeking guild membership`,
            status: 'alive',
            prominence: 'marginal',
            tags: ['trader', 'guild-founder']
          }),
          maxCreated: 2 // Max 2 new merchants per guild
        },
        diversityTracking: {
          trackingId: 'guild_recruitment',
          strength: 2.0 // Strong diversity pressure
        }
      });

    merchantsToRecruit = result.existing;
    newMerchants = result.created;

    const relationships: Relationship[] = [
      { kind: 'controls', src: 'will-be-assigned-0', dst: colony.id }
    ];

    // Add relationships for existing merchants
    merchantsToRecruit.forEach(merchant => {
      relationships.push({
        kind: 'member_of',
        src: merchant.id,
        dst: 'will-be-assigned-0'
      });
      relationships.push({
        kind: 'resident_of',
        src: merchant.id,
        dst: colony.id
      });
    });

    // Add relationships for newly created merchants
    // Base index: 0=guild, 1+ =new merchants
    newMerchants.forEach((newMerchant, index) => {
      const merchantPlaceholderId = `will-be-assigned-${1 + index}`;
      relationships.push({
        kind: 'member_of',
        src: merchantPlaceholderId,
        dst: 'will-be-assigned-0'
      });
      relationships.push({
        kind: 'resident_of',
        src: merchantPlaceholderId,
        dst: colony.id
      });
    });

    const totalMerchants = merchantsToRecruit.length + newMerchants.length;
    const creationNote = newMerchants.length > 0
      ? ` (${newMerchants.length} new merchants recruited)`
      : '';

    return {
      entities: [guild, ...newMerchants], // Include new merchants
      relationships,
      description: `${totalMerchants} merchants organize into ${guild.name}${creationNote}`
    };
  }
};
