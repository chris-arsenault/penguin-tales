/**
 * Proximity Decay Module
 *
 * Scoring module that adjusts scores based on spatial distance
 * in the semantic plane. Entities that are closer together
 * are more likely to form relationships.
 *
 * Examples:
 * - Close neighbors are more likely to befriend each other
 * - Distant entities are unlikely to trade directly
 * - Medium distance might be ideal for rivalries
 *
 * Extracted from lore-weave's semantic plane distance calculations.
 */

import type { ProximityDecayParams } from '@canonry/world-schema';
import type { RuntimeEntity } from '../types.js';
import type { ModuleContext, ScoringResult, ModuleDefinition } from './registry.js';
import { moduleRegistry } from './registry.js';

// ============================================================================
// DEFAULTS
// ============================================================================

const DEFAULT_PARAMS: ProximityDecayParams = {
  closeDistance: 15,
  mediumDistance: 30,
  closeBoost: 1.5,
  mediumBoost: 1.0,
  farPenalty: 0.3,
};

// ============================================================================
// IMPLEMENTATION
// ============================================================================

/**
 * Calculate Euclidean distance between two entities
 */
function calculateDistance(
  entity1: RuntimeEntity,
  entity2: RuntimeEntity
): number | null {
  if (!entity1.coordinates || !entity2.coordinates) {
    return null;
  }

  const dx = entity1.coordinates.x - entity2.coordinates.x;
  const dy = entity1.coordinates.y - entity2.coordinates.y;

  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Calculate proximity-based score
 *
 * @param params - Module configuration
 * @param context - Simulation context
 * @param entity - Entity being scored
 * @param referenceEntity - Entity to measure distance from
 * @returns Score result based on spatial proximity
 */
export function proximityDecay(
  params: ProximityDecayParams,
  context: ModuleContext,
  entity: RuntimeEntity,
  referenceEntity?: RuntimeEntity
): ScoringResult {
  const config = { ...DEFAULT_PARAMS, ...params };

  // If no reference entity, return neutral score
  if (!referenceEntity) {
    return {
      score: 1.0,
      reason: 'No reference entity for distance calculation',
    };
  }

  const distance = calculateDistance(entity, referenceEntity);

  // If either entity lacks coordinates, return neutral score
  if (distance === null) {
    return {
      score: 1.0,
      reason: 'Cannot calculate distance (missing coordinates)',
    };
  }

  // Apply distance-based scoring
  if (distance < config.closeDistance) {
    return {
      score: config.closeBoost,
      reason: `Close proximity (${distance.toFixed(1)} < ${config.closeDistance}) - boosted`,
    };
  } else if (distance < config.mediumDistance) {
    // Linear interpolation between medium boost and far penalty
    const t = (distance - config.closeDistance) / (config.mediumDistance - config.closeDistance);
    const score = config.mediumBoost * (1 - t) + config.farPenalty * t;
    return {
      score,
      reason: `Medium distance (${distance.toFixed(1)}) - interpolated score ${score.toFixed(2)}`,
    };
  } else {
    // Far distance - apply penalty
    // Additional decay for very far distances
    const extraDistance = distance - config.mediumDistance;
    const decayFactor = Math.exp(-extraDistance / 50);
    const score = config.farPenalty * decayFactor;

    return {
      score: Math.max(0.01, score), // Floor to prevent zero scores
      reason: `Far distance (${distance.toFixed(1)} > ${config.mediumDistance}) - penalized to ${score.toFixed(3)}`,
    };
  }
}

// ============================================================================
// REGISTER MODULE
// ============================================================================

const proximityDecayModule: ModuleDefinition<ProximityDecayParams, ScoringResult> = {
  id: 'proximity_decay',
  name: 'Proximity Decay',
  description: 'Adjusts scores based on spatial distance between entities',
  category: 'scoring',
  defaults: DEFAULT_PARAMS,
  execute: (params, context, ...args) =>
    proximityDecay(params, context, args[0] as RuntimeEntity, args[1] as RuntimeEntity | undefined),
};

moduleRegistry.register(proximityDecayModule);
