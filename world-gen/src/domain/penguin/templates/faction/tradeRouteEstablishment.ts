import { GrowthTemplate, TemplateResult, Graph } from '../../../../types/engine';
import { HardState, Relationship } from '../../../../types/worldTypes';
import { findEntities, getRelated } from '../../../../utils/helpers';

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

  canApply(graph: Graph): boolean {
    // Need active factions that aren't already trading
    const factions = findEntities(graph, { kind: 'faction', status: 'active' });

    if (factions.length < 2) return false;

    // Check if there are potential trade partners
    return factions.some(faction => {
      const tradingPartners = graph.relationships
        .filter(r => r.kind === 'trades_with' && (r.src === faction.id || r.dst === faction.id))
        .map(r => r.src === faction.id ? r.dst : r.src);

      const potentialPartners = factions.filter(f =>
        f.id !== faction.id &&
        !tradingPartners.includes(f.id)
      );

      return potentialPartners.length > 0;
    });
  },

  findTargets(graph: Graph): HardState[] {
    // Return factions with potential trade partners
    const factions = findEntities(graph, { kind: 'faction', status: 'active' });

    return factions.filter(faction => {
      const tradingPartners = graph.relationships
        .filter(r => r.kind === 'trades_with' && (r.src === faction.id || r.dst === faction.id))
        .map(r => r.src === faction.id ? r.dst : r.src);

      const potentialPartners = factions.filter(f =>
        f.id !== faction.id &&
        !tradingPartners.includes(f.id) &&
        // Can't trade with enemies
        !graph.relationships.some(r =>
          r.kind === 'at_war_with' &&
          ((r.src === faction.id && r.dst === f.id) || (r.src === f.id && r.dst === faction.id))
        )
      );

      return potentialPartners.length > 0;
    });
  },

  expand(graph: Graph, target?: HardState): TemplateResult {
    if (!target || target.kind !== 'faction') {
      return {
        entities: [],
        relationships: [],
        description: 'No valid faction target'
      };
    }

    // Find existing trade partners
    const tradingPartners = graph.relationships
      .filter(r => r.kind === 'trades_with' && (r.src === target.id || r.dst === target.id))
      .map(r => r.src === target.id ? r.dst : r.src);

    // Find potential trade partners (factions that aren't at war)
    const factions = findEntities(graph, { kind: 'faction', status: 'active' });
    const potentialPartners = factions.filter(faction =>
      faction.id !== target.id &&
      !tradingPartners.includes(faction.id) &&
      // Can't trade with enemies
      !graph.relationships.some(r =>
        r.kind === 'at_war_with' &&
        ((r.src === target.id && r.dst === faction.id) || (r.src === faction.id && r.dst === target.id))
      )
    );

    if (potentialPartners.length === 0) {
      return {
        entities: [],
        relationships: [],
        description: `${target.name} has no available trade partners`
      };
    }

    // Prefer partners who are allied or neutral
    const allies = potentialPartners.filter(f =>
      graph.relationships.some(r =>
        r.kind === 'allied_with' &&
        ((r.src === target.id && r.dst === f.id) || (r.src === f.id && r.dst === target.id))
      )
    );

    const partner = allies.length > 0
      ? allies[Math.floor(Math.random() * allies.length)]
      : potentialPartners[Math.floor(Math.random() * potentialPartners.length)];

    // Find catalyst (merchant NPC if exists, otherwise leader, otherwise faction)
    const merchants = graph.relationships
      .filter(r => r.kind === 'member_of' && r.dst === target.id)
      .map(r => graph.entities.get(r.src))
      .filter((e): e is HardState => !!e && e.subtype === 'merchant');

    const leaders = getRelated(graph, target.id, 'leader_of', 'dst');

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
