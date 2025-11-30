/**
 * Trade Route Establishment Template
 *
 * Strategy-based template for economic network formation.
 *
 * Pipeline:
 *   1. Applicability: entity_count_min(faction, 2) AND NOT all_trading
 *   2. Selection: by_kind(faction) with available partners filter
 *   3. Creation: none (relationship-only template)
 *   4. Relationships: bidirectional(trades_with) with catalyst attribution
 */

import { GrowthTemplate, TemplateResult, ComponentPurpose } from '@lore-weave/core';
import { TemplateGraphView } from '@lore-weave/core';
import { HardState, Relationship } from '@lore-weave/core';
import { pickRandom, extractParams } from '@lore-weave/core';

import {
  // Step 1: Applicability
  checkEntityCountMin,
  // Step 2: Selection
  selectByKind,
  selectByPreferenceOrder,
  // Step 4: Relationships
  createRelationship,
  // Result helpers
  emptyResult,
  templateResult
} from '../../utils/strategyExecutors';
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

  // =========================================================================
  // STEP 1: APPLICABILITY - entity_count_min AND NOT all_trading
  // =========================================================================
  canApply(graphView: TemplateGraphView): boolean {
    // Strategy: entity_count_min(faction, 2)
    if (!checkEntityCountMin(graphView, 'faction', undefined, 2)) {
      return false;
    }

    // Strategy: check for available trade partners
    const factions = selectByKind(graphView, 'faction');

    return factions.some(faction => {
      const tradingWith = graphView.getRelatedEntities(faction.id, 'trades_with', 'both');
      const tradingPartnerIds = new Set(tradingWith.map(t => t.id));

      const potentialPartners = factions.filter(f =>
        f.id !== faction.id && !tradingPartnerIds.has(f.id)
      );

      return potentialPartners.length > 0;
    });
  },

  // =========================================================================
  // STEP 2: SELECTION - factions with available partners
  // =========================================================================
  findTargets(graphView: TemplateGraphView): HardState[] {
    // Strategy: by_kind(faction) with partner availability filter
    const factions = selectByKind(graphView, 'faction');

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

  // =========================================================================
  // STEPS 3-4: CREATION & RELATIONSHIPS
  // =========================================================================
  expand(graphView: TemplateGraphView, target?: HardState): TemplateResult {
    if (!target || target.kind !== 'faction') {
      return emptyResult('No valid faction target');
    }

    // Find existing trade partners
    const tradingWith = graphView.getRelatedEntities(target.id, 'trades_with', 'both');
    const tradingPartnerIds = new Set(tradingWith.map(t => t.id));

    // Strategy: by_kind(faction) - find potential partners
    const factions = selectByKind(graphView, 'faction');
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
      return emptyResult(`${target.name} has no available trade partners`);
    }

    // Prefer partners who are allied or neutral
    const allies = potentialPartners.filter(f =>
      graphView.hasRelationship(target.id, f.id, 'allied_with') ||
      graphView.hasRelationship(f.id, target.id, 'allied_with')
    );

    const partner = allies.length > 0
      ? pickRandom(allies)
      : pickRandom(potentialPartners);

    // Strategy: by_preference_order for catalyst (merchant > leader > faction)
    const members = graphView.getRelatedEntities(target.id, 'member_of', 'dst');
    const merchants = members.filter(m => m.subtype === 'merchant');
    const leaders = graphView.getRelatedEntities(target.id, 'leader_of', 'dst');

    const catalyst = merchants.length > 0
      ? pickRandom(merchants)
      : leaders.length > 0
        ? pickRandom(leaders)
        : target;

    // ------- STEP 4: RELATIONSHIPS -------

    // Strategy: bidirectional(trades_with) with catalyst
    const relationships: Relationship[] = [
      createRelationship('trades_with', target.id, partner.id, { strength: 0.6 }),
      createRelationship('trades_with', partner.id, target.id, { strength: 0.6 })
    ];

    // Add catalyst attribution manually (not part of standard createRelationship)
    relationships[0].catalyzedBy = catalyst.id;
    relationships[1].catalyzedBy = catalyst.id;

    return templateResult(
      [],
      relationships,
      `${target.name} establishes trade route with ${partner.name} (catalyzed by ${catalyst.name})`
    );
  }
};
