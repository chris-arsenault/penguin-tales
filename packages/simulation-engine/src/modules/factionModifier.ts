/**
 * Faction Modifier Module
 *
 * Scoring module that adjusts scores based on faction membership
 * and faction relationships. Entities in allied factions are boosted
 * for cooperation; enemies are boosted for conflict scenarios.
 *
 * Examples:
 * - Allied faction members cooperate more easily
 * - Enemy factions are more likely to fight each other
 * - Neutral factions have reduced interaction likelihood
 *
 * Extracted from lore-weave's faction-aware relationship systems.
 */

import type { FactionModifierParams } from '@canonry/world-schema';
import type { RuntimeEntity } from '../types.js';
import type { ModuleContext, ScoringResult, ModuleDefinition } from './registry.js';
import { moduleRegistry } from './registry.js';

// ============================================================================
// DEFAULTS
// ============================================================================

const DEFAULT_PARAMS: FactionModifierParams = {
  sharedFactionBoost: 2.0,
  alliedFactionBoost: 1.2,
  enemyFactionBoost: 3.0,
  neutralPenalty: 0.3,
  factionRelationshipKind: 'member_of',
};

// ============================================================================
// IMPLEMENTATION
// ============================================================================

/**
 * Find faction(s) an entity belongs to
 */
function findEntityFactions(
  entityId: string,
  factionRelKind: string,
  context: ModuleContext
): RuntimeEntity[] {
  const factions: RuntimeEntity[] = [];

  for (const rel of context.state.relationships.values()) {
    if (rel.archived) continue;
    if (rel.kind !== factionRelKind) continue;

    // Entity is source (member_of faction)
    if (rel.srcId === entityId) {
      const faction = context.state.entities.get(rel.dstId);
      if (faction && faction.kind === 'faction') {
        factions.push(faction);
      }
    }
  }

  return factions;
}

/**
 * Check relationship between two factions
 */
function getFactionRelationship(
  faction1: RuntimeEntity,
  faction2: RuntimeEntity,
  context: ModuleContext
): 'allied' | 'enemy' | 'neutral' {
  for (const rel of context.state.relationships.values()) {
    if (rel.archived) continue;

    const involves = (
      (rel.srcId === faction1.id && rel.dstId === faction2.id) ||
      (rel.srcId === faction2.id && rel.dstId === faction1.id)
    );

    if (!involves) continue;

    // Check relationship kind to determine stance
    if (rel.kind === 'ally_of' || rel.kind === 'allied_with') {
      return 'allied';
    }
    if (rel.kind === 'enemy_of' || rel.kind === 'rivals_with' || rel.kind === 'at_war_with') {
      return 'enemy';
    }
  }

  return 'neutral';
}

/**
 * Calculate faction-based score modifier
 *
 * @param params - Module configuration
 * @param context - Simulation context
 * @param entity - Entity being scored
 * @param referenceEntity - Entity to compare faction membership against
 * @param scenario - 'cooperation' or 'conflict' to determine which boosts apply
 * @returns Score result based on faction relationships
 */
export function factionModifier(
  params: FactionModifierParams,
  context: ModuleContext,
  entity: RuntimeEntity,
  referenceEntity?: RuntimeEntity,
  scenario: 'cooperation' | 'conflict' = 'cooperation'
): ScoringResult {
  const config = { ...DEFAULT_PARAMS, ...params };

  // If no reference entity, return neutral
  if (!referenceEntity) {
    return {
      score: 1.0,
      reason: 'No reference entity for faction comparison',
    };
  }

  // Find factions for both entities
  const entityFactions = findEntityFactions(entity.id, config.factionRelationshipKind, context);
  const refFactions = findEntityFactions(referenceEntity.id, config.factionRelationshipKind, context);

  // If either has no factions, return neutral
  if (entityFactions.length === 0 || refFactions.length === 0) {
    return {
      score: 1.0,
      reason: 'One or both entities have no faction membership',
    };
  }

  // Check for shared factions
  for (const ef of entityFactions) {
    for (const rf of refFactions) {
      if (ef.id === rf.id) {
        if (scenario === 'cooperation') {
          return {
            score: config.sharedFactionBoost,
            reason: `Shared faction (${ef.name}) - cooperation boosted`,
          };
        } else {
          // Same faction = less likely to fight
          return {
            score: config.neutralPenalty,
            reason: `Shared faction (${ef.name}) - conflict unlikely`,
          };
        }
      }
    }
  }

  // Check faction relationships
  let bestRelationship: 'allied' | 'enemy' | 'neutral' = 'neutral';
  let relationshipFactions: [string, string] | null = null;

  outerLoop: for (const ef of entityFactions) {
    for (const rf of refFactions) {
      const rel = getFactionRelationship(ef, rf, context);
      if (rel === 'allied') {
        bestRelationship = 'allied';
        relationshipFactions = [ef.name, rf.name];
        break outerLoop;
      } else if (rel === 'enemy') {
        // Only set if we haven't found allied yet
        if (bestRelationship === 'neutral') {
          bestRelationship = 'enemy';
          relationshipFactions = [ef.name, rf.name];
        }
      }
    }
  }

  // Apply scores based on relationship and scenario
  switch (bestRelationship) {
    case 'allied':
      if (scenario === 'cooperation') {
        return {
          score: config.alliedFactionBoost,
          reason: `Allied factions (${relationshipFactions?.join(' & ')}) - cooperation boosted`,
        };
      } else {
        return {
          score: config.neutralPenalty,
          reason: `Allied factions (${relationshipFactions?.join(' & ')}) - conflict unlikely`,
        };
      }

    case 'enemy':
      if (scenario === 'conflict') {
        return {
          score: config.enemyFactionBoost,
          reason: `Enemy factions (${relationshipFactions?.join(' vs ')}) - conflict likely`,
        };
      } else {
        return {
          score: config.neutralPenalty,
          reason: `Enemy factions (${relationshipFactions?.join(' vs ')}) - cooperation unlikely`,
        };
      }

    case 'neutral':
    default:
      return {
        score: config.neutralPenalty,
        reason: 'Neutral faction relationship - reduced interaction',
      };
  }
}

// ============================================================================
// REGISTER MODULE
// ============================================================================

const factionModifierModule: ModuleDefinition<FactionModifierParams, ScoringResult> = {
  id: 'faction_modifier',
  name: 'Faction Modifier',
  description: 'Adjusts scores based on faction membership and faction relationships',
  category: 'social',
  defaults: DEFAULT_PARAMS,
  execute: (params, context, ...args) =>
    factionModifier(
      params,
      context,
      args[0] as RuntimeEntity,
      args[1] as RuntimeEntity | undefined,
      (args[2] as 'cooperation' | 'conflict') || 'cooperation'
    ),
};

moduleRegistry.register(factionModifierModule);
