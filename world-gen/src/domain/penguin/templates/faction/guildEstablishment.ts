import { GrowthTemplate, TemplateResult, Graph } from '../../../../types/engine';
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

  canApply: (graph: Graph) => {
    const merchants = findEntities(graph, { kind: 'npc', subtype: 'merchant' });
    const colonies = findEntities(graph, { kind: 'location', subtype: 'colony' });
    return merchants.length >= 2 && colonies.length > 0;
  },
  
  findTargets: (graph: Graph) => {
    return findEntities(graph, { kind: 'location', subtype: 'colony' })
      .filter(c => !Array.from(graph.entities.values()).some(e =>
        e.kind === 'faction' &&
        e.subtype === 'company' &&
        e.links.some(l => l.kind === 'controls' && l.dst === c.id)
      ));
  },
  
  expand: (graph: Graph, target?: HardState): TemplateResult => {
    const colony = target || pickRandom(
      findEntities(graph, { kind: 'location', subtype: 'colony' })
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
      tags: ['trade', 'guild', `name:${slugifyName(colony.name)}`]
    };
    
    // Use existing merchants instead of creating new ones (catalyst model)
    const existingMerchants = findEntities(graph, { kind: 'npc', subtype: 'merchant', status: 'alive' })
      .filter(m => !m.links.some(l => l.kind === 'member_of')) // Prefer unaffiliated merchants
      .slice(0, 3);

    // If no unaffiliated merchants, take any merchants
    const merchantsToRecruit = existingMerchants.length > 0
      ? existingMerchants
      : findEntities(graph, { kind: 'npc', subtype: 'merchant', status: 'alive' }).slice(0, 3);

    const relationships: Relationship[] = [
      { kind: 'controls', src: 'will-be-assigned-0', dst: colony.id }
    ];

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

    return {
      entities: [guild], // No new NPCs created, use existing merchants
      relationships,
      description: `${merchantsToRecruit.length} merchants organize into ${guild.name}`
    };
  }
};
