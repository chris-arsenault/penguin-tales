import { GrowthTemplate, TemplateResult, ComponentPurpose } from '@lore-weave/core/types/engine';
import { TemplateGraphView } from '@lore-weave/core/services/templateGraphView';
import { HardState, Relationship } from '@lore-weave/core/types/worldTypes';
import { pickRandom, findEntities, slugifyName } from '@lore-weave/core/utils/helpers';
import { buildRelationships } from '@lore-weave/core/utils/relationshipBuilder';

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

    // Find existing companies to place new guild in conceptual space
    const existingCompanies = graphView.findEntities({ kind: 'faction', subtype: 'company' });

    // Derive conceptual coordinates - place guild near colony and other guilds
    const referenceEntities: HardState[] = [colony];
    if (existingCompanies.length > 0) {
      // Place near existing companies (economic proximity)
      referenceEntities.push(...existingCompanies.slice(0, 2));
    }

    const conceptualCoords = graphView.deriveCoordinates(
      referenceEntities,
      'faction',
      'physical',
      { maxDistance: 0.3, minDistance: 0.1 }  // Trade guilds cluster together conceptually
    );

    if (!conceptualCoords) {
      throw new Error(
        `guild_establishment: Failed to derive coordinates for guild in ${colony.name}. ` +
        `This indicates the coordinate system is not properly configured for 'faction' entities.`
      );
    }

    const guild: Partial<HardState> = {
      kind: 'faction',
      subtype: 'company',
      name: `${colony.name} ${pickRandom(['Traders', 'Merchants', 'Exchange'])}`,
      description: `A merchant guild controlling trade in ${colony.name}`,
      status: 'state_sanctioned',
      prominence: 'recognized',
      culture: colony.culture,  // Inherit culture from colony
      tags: { trade: true, guild: true, organized: true },
      coordinates: conceptualCoords
    };

    // Pre-compute coordinates for potential new merchants (factory receives Graph, not TemplateGraphView)
    const newMerchantCoords = graphView.deriveCoordinates(
      [colony],
      'npc',
      'physical',
      { maxDistance: 0.3, minDistance: 0.1 }
    );

    if (!newMerchantCoords) {
      throw new Error(
        `guild_establishment: Failed to derive coordinates for potential new merchants in ${colony.name}. ` +
        `This indicates the coordinate system is not properly configured for 'npc' entities.`
      );
    }

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
          factory: () => ({
            kind: 'npc',
            subtype: 'merchant',
            description: `An independent merchant seeking guild membership`,
            status: 'alive',
            prominence: 'marginal',
            culture: colony.culture,  // Inherit culture from colony
            tags: { trader: true, 'guild-founder': true },
            coordinates: newMerchantCoords
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

    // Build relationships using fluent API
    const relationshipBuilder = buildRelationships();

    // Guild controls colony
    relationshipBuilder.add('controls', 'will-be-assigned-0', colony.id);

    // Add relationships for existing merchants
    const existingMerchantIds = merchantsToRecruit.map(m => m.id);
    relationshipBuilder
      .addManyTo('member_of', existingMerchantIds, 'will-be-assigned-0')
      .addManyTo('resident_of', existingMerchantIds, colony.id);

    // Add relationships for newly created merchants
    // Base index: 0=guild, 1+ =new merchants
    newMerchants.forEach((newMerchant, index) => {
      const merchantPlaceholderId = `will-be-assigned-${1 + index}`;
      relationshipBuilder
        .add('member_of', merchantPlaceholderId, 'will-be-assigned-0')
        .add('resident_of', merchantPlaceholderId, colony.id);
    });

    const relationships = relationshipBuilder.build();

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
