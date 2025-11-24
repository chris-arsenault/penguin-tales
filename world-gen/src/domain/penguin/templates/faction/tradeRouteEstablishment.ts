import { GrowthTemplate, TemplateResult, ComponentPurpose } from '../../../../types/engine';
import { TemplateGraphView } from '../../../../services/templateGraphView';
import { HardState, Relationship } from '../../../../types/worldTypes';

/**
 * Trade Route Establishment Template
 *
 * World-level template: Factions establish trade connections between locations.
 * Creates 'trades_with' relationships with catalyst attribution.
 *
 * Pattern: Faction (with leader) → establishes trade → Other faction/location
 * Result: Economic networks expand, not NPC count
 */
export const tradeRouteEstablishment: GrowthTemplate = {
  id: 'trade_route_establishment',
  name: 'Trade Route Establishment',

  contract: {
    purpose: ComponentPurpose.ENTITY_CREATION,
    enabledBy: {
      entityCounts: [
        { kind: 'faction', min: 2 }  // Need at least 2 factions to trade
      ]
    },
    affects: {
      entities: [],  // No new entities created
      relationships: [
        { kind: 'trades_with', operation: 'create', count: { min: 2, max: 2 } }  // Bidirectional
      ],
      pressures: []
    }
  },

  metadata: {
    produces: {
      entityKinds: [],
      relationships: [
        { kind: 'trades_with', category: 'economic', probability: 1.0, comment: 'Faction establishes trade route' }
      ]
    },
    effects: {
      graphDensity: 0.5,
      clusterFormation: 0.7,
      diversityImpact: 0.4,
      comment: 'Creates economic networks between factions'
    },
    parameters: {
      tradeFormationRate: {
        value: 0.6,
        min: 0.2,
        max: 1.0,
        description: 'How readily factions establish trade relationships'
      },
      merchantInfluence: {
        value: 0.2,
        min: 0.0,
        max: 0.5,
        description: 'Influence gain for merchants facilitating trade'
      }
    },
    tags: ['world-level', 'economic', 'trade']
  },

  canApply(graphView: TemplateGraphView): boolean {
    // Need factions that aren't already trading
    const factions = graphView.findEntities({ kind: 'faction' });

    if (factions.length < 2) return false;

    // Check if there are potential trade partners
    return factions.some(faction => {
      const tradingWith = graphView.getRelatedEntities(faction.id, 'trades_with', 'both');
      const tradingPartnerIds = new Set(tradingWith.map(t => t.id));

      const potentialPartners = factions.filter(f =>
        f.id !== faction.id &&
        !tradingPartnerIds.has(f.id)
      );

      return potentialPartners.length > 0;
    });
  },

  findTargets(graphView: TemplateGraphView): HardState[] {
    // Return factions with potential trade partners
    const factions = graphView.findEntities({ kind: 'faction' });

    return factions.filter(faction => {
      const tradingWith = graphView.getRelatedEntities(faction.id, 'trades_with', 'both');
      const tradingPartnerIds = new Set(tradingWith.map(t => t.id));

      const potentialPartners = factions.filter(f => {
        if (f.id === faction.id || tradingPartnerIds.has(f.id)) {
          return false;
        }

        // Can't trade with enemies
        const atWar = graphView.hasRelationship(faction.id, f.id, 'at_war_with') ||
                      graphView.hasRelationship(f.id, faction.id, 'at_war_with');

        return !atWar;
      });

      return potentialPartners.length > 0;
    });
  },

  expand(graphView: TemplateGraphView, target?: HardState): TemplateResult {
    if (!target || target.kind !== 'faction') {
      return {
        entities: [],
        relationships: [],
        description: 'No valid faction target'
      };
    }

    // Find existing trade partners
    const tradingWith = graphView.getRelatedEntities(target.id, 'trades_with', 'both');
    const tradingPartnerIds = new Set(tradingWith.map(t => t.id));

    // Find potential trade partners (factions that aren't at war)
    const factions = graphView.findEntities({ kind: 'faction' });
    const potentialPartners = factions.filter(faction => {
      if (faction.id === target.id || tradingPartnerIds.has(faction.id)) {
        return false;
      }

      // Can't trade with enemies
      const atWar = graphView.hasRelationship(target.id, faction.id, 'at_war_with') ||
                    graphView.hasRelationship(faction.id, target.id, 'at_war_with');

      return !atWar;
    });

    if (potentialPartners.length === 0) {
      return {
        entities: [],
        relationships: [],
        description: `${target.name} has no available trade partners`
      };
    }

    // Prefer partners who are allied or neutral
    const allies = potentialPartners.filter(f =>
      graphView.hasRelationship(target.id, f.id, 'allied_with') ||
      graphView.hasRelationship(f.id, target.id, 'allied_with')
    );

    const partner = allies.length > 0
      ? allies[Math.floor(Math.random() * allies.length)]
      : potentialPartners[Math.floor(Math.random() * potentialPartners.length)];

    // Find catalyst (merchant NPC if exists, otherwise leader, otherwise faction)
    const members = graphView.getRelatedEntities(target.id, 'member_of', 'dst');
    const merchants = members.filter(m => m.subtype === 'merchant');
    const leaders = graphView.getRelatedEntities(target.id, 'leader_of', 'dst');

    const catalyst = merchants.length > 0
      ? merchants[0]
      : leaders.length > 0
        ? leaders[0]
        : target;

    // Create bidirectional trades_with relationships
    const relationships: Relationship[] = [
      {
        kind: 'trades_with',
        src: target.id,
        dst: partner.id,
        strength: 0.6,
        catalyzedBy: catalyst.id
      },
      {
        kind: 'trades_with',
        src: partner.id,
        dst: target.id,
        strength: 0.6,
        catalyzedBy: catalyst.id
      }
    ];

    return {
      entities: [],
      relationships,
      description: `${target.name} establishes trade route with ${partner.name} (catalyzed by ${catalyst.name})`
    };
  }
};
