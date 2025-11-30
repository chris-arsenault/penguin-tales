/**
 * Prominence Evolution Module
 *
 * Dynamics module that handles the rise and fall of entity prominence
 * based on their connectivity and activity in the world.
 * Well-connected entities become more prominent; isolated ones fade.
 *
 * Examples:
 * - NPCs with many relationships become renowned
 * - Isolated factions fade to marginal status
 * - Central trading hubs become mythic locations
 *
 * Extracted from lore-weave's prominence tracking systems.
 */

import type { ProminenceEvolutionParams, Prominence } from '@canonry/world-schema';
import type { RuntimeEntity } from '../types.js';
import type { ModuleContext, DynamicsResult, ModuleDefinition } from './registry.js';
import { moduleRegistry } from './registry.js';
import { seededRandom } from '../conditions.js';

// ============================================================================
// DEFAULTS
// ============================================================================

const DEFAULT_PARAMS: ProminenceEvolutionParams = {
  connectionThresholdBase: 6,
  promotionChance: 0.3,
  demotionThreshold: 2.0,
  demotionChance: 0.7,
};

// ============================================================================
// PROMINENCE LEVELS
// ============================================================================

const PROMINENCE_ORDER: Prominence[] = [
  'forgotten',
  'marginal',
  'recognized',
  'renowned',
  'mythic',
];

function getProminenceIndex(prominence: Prominence): number {
  return PROMINENCE_ORDER.indexOf(prominence);
}

function getProminenceFromIndex(index: number): Prominence {
  return PROMINENCE_ORDER[Math.max(0, Math.min(PROMINENCE_ORDER.length - 1, index))];
}

function canPromote(prominence: Prominence): boolean {
  return getProminenceIndex(prominence) < PROMINENCE_ORDER.length - 1;
}

function canDemote(prominence: Prominence): boolean {
  return getProminenceIndex(prominence) > 0;
}

function promote(prominence: Prominence): Prominence {
  const index = getProminenceIndex(prominence);
  return getProminenceFromIndex(index + 1);
}

function demote(prominence: Prominence): Prominence {
  const index = getProminenceIndex(prominence);
  return getProminenceFromIndex(index - 1);
}

// ============================================================================
// IMPLEMENTATION
// ============================================================================

/**
 * Count active relationships for an entity
 */
function countActiveRelationships(entityId: string, context: ModuleContext): number {
  let count = 0;
  for (const rel of context.state.relationships.values()) {
    if (rel.archived) continue;
    if (rel.srcId === entityId || rel.dstId === entityId) {
      count++;
    }
  }
  return count;
}

/**
 * Calculate weighted relationship score (considering relationship strength)
 */
function calculateRelationshipScore(entityId: string, context: ModuleContext): number {
  let score = 0;
  for (const rel of context.state.relationships.values()) {
    if (rel.archived) continue;
    if (rel.srcId === entityId || rel.dstId === entityId) {
      // Stronger relationships (lower distance) contribute more
      score += 1.0 - rel.distance;
    }
  }
  return score;
}

/**
 * Process prominence evolution for all entities
 *
 * @param params - Module configuration
 * @param context - Simulation context
 * @returns Dynamics result with prominence changes
 */
export function prominenceEvolution(
  params: ProminenceEvolutionParams,
  context: ModuleContext
): DynamicsResult {
  const config = { ...DEFAULT_PARAMS, ...params };
  const result: DynamicsResult = {
    modifications: [],
  };

  for (const entity of context.state.entities.values()) {
    const relationshipScore = calculateRelationshipScore(entity.id, context);
    const currentIndex = getProminenceIndex(entity.prominence);

    // Calculate promotion threshold based on current prominence
    // Higher prominence requires more connections to maintain/improve
    const promotionThreshold = config.connectionThresholdBase * (currentIndex + 1);
    const maintenanceThreshold = config.demotionThreshold * (currentIndex + 1);

    let newProminence: Prominence | undefined;

    // Check for promotion
    if (relationshipScore >= promotionThreshold && canPromote(entity.prominence)) {
      const roll = seededRandom(context.state);
      if (roll < config.promotionChance) {
        newProminence = promote(entity.prominence);
      }
    }
    // Check for demotion
    else if (relationshipScore < maintenanceThreshold && canDemote(entity.prominence)) {
      const roll = seededRandom(context.state);
      if (roll < config.demotionChance) {
        newProminence = demote(entity.prominence);
      }
    }

    if (newProminence && newProminence !== entity.prominence) {
      result.modifications!.push({
        entityId: entity.id,
        changes: {
          prominence: newProminence,
        },
      });
    }
  }

  return result;
}

/**
 * Get prominence distribution across all entities
 */
export function getProminenceDistribution(
  context: ModuleContext
): Record<Prominence, number> {
  const distribution: Record<Prominence, number> = {
    forgotten: 0,
    marginal: 0,
    recognized: 0,
    renowned: 0,
    mythic: 0,
  };

  for (const entity of context.state.entities.values()) {
    distribution[entity.prominence]++;
  }

  return distribution;
}

// ============================================================================
// REGISTER MODULE
// ============================================================================

const prominenceEvolutionModule: ModuleDefinition<ProminenceEvolutionParams, DynamicsResult> = {
  id: 'prominence_evolution',
  name: 'Prominence Evolution',
  description: 'Handles rise and fall of entity prominence based on connectivity',
  category: 'dynamics',
  defaults: DEFAULT_PARAMS,
  execute: (params, context) => prominenceEvolution(params, context),
};

moduleRegistry.register(prominenceEvolutionModule);
