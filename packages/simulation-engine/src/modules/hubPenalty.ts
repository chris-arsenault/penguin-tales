/**
 * Hub Penalty Module
 *
 * Scoring module that penalizes entities with many relationships ("hubs").
 * This prevents runaway connectivity where a few entities become
 * connected to everything.
 *
 * Extracted from lore-weave's relationship formation logic.
 */

import type { HubPenaltyParams } from '@canonry/world-schema';
import type { RuntimeEntity } from '../types.js';
import type { ModuleContext, ScoringResult, ModuleDefinition } from './registry.js';
import { moduleRegistry } from './registry.js';

// ============================================================================
// DEFAULTS
// ============================================================================

const DEFAULT_PARAMS: HubPenaltyParams = {
  hubThreshold: 5,
  penaltyBase: 0.7,
  penaltyExponent: 1.0,
  relationshipKinds: undefined,
};

// ============================================================================
// IMPLEMENTATION
// ============================================================================

/**
 * Count relationships for an entity, optionally filtered by kind
 */
function countRelationships(
  entityId: string,
  context: ModuleContext,
  relationshipKinds?: string[]
): number {
  let count = 0;

  for (const rel of context.state.relationships.values()) {
    if (rel.archived) continue;

    // Check if this relationship involves our entity
    if (rel.srcId !== entityId && rel.dstId !== entityId) continue;

    // Filter by kind if specified
    if (relationshipKinds && relationshipKinds.length > 0) {
      if (!relationshipKinds.includes(rel.kind)) continue;
    }

    count++;
  }

  return count;
}

/**
 * Calculate hub penalty score for an entity
 *
 * @param params - Module configuration
 * @param context - Simulation context
 * @param entity - Entity to score
 * @returns Score result (lower = more penalized)
 */
export function hubPenalty(
  params: HubPenaltyParams,
  context: ModuleContext,
  entity: RuntimeEntity
): ScoringResult {
  const { hubThreshold, penaltyBase, penaltyExponent, relationshipKinds } = {
    ...DEFAULT_PARAMS,
    ...params,
  };

  const relationshipCount = countRelationships(entity.id, context, relationshipKinds);

  // No penalty if below threshold
  if (relationshipCount <= hubThreshold) {
    return {
      score: 1.0,
      reason: `${relationshipCount} relationships (under threshold ${hubThreshold})`,
    };
  }

  // Calculate exponential penalty
  const excessConnections = relationshipCount - hubThreshold;
  const penalty = Math.pow(penaltyBase, excessConnections * penaltyExponent);

  return {
    score: penalty,
    reason: `Hub penalty: ${relationshipCount} connections (${excessConnections} over threshold), score ${penalty.toFixed(3)}`,
  };
}

// ============================================================================
// REGISTER MODULE
// ============================================================================

const hubPenaltyModule: ModuleDefinition<HubPenaltyParams, ScoringResult> = {
  id: 'hub_penalty',
  name: 'Hub Penalty',
  description: 'Penalizes entities with many relationships to prevent hub formation',
  category: 'scoring',
  defaults: DEFAULT_PARAMS,
  execute: (params, context, ...args) => hubPenalty(params, context, args[0] as RuntimeEntity),
};

moduleRegistry.register(hubPenaltyModule);
