/**
 * Relationship Decay Module
 *
 * Dynamics module that handles the natural weakening of relationships
 * over time. Relationships that aren't reinforced gradually decay,
 * which can lead to disconnection or archival.
 *
 * Examples:
 * - Friendships decay if not reinforced by shared experiences
 * - Alliances weaken without diplomatic contact
 * - Trade relationships fade without transactions
 *
 * Extracted from lore-weave's relationship maintenance systems.
 */

import type { RelationshipDecayParams } from '@canonry/world-schema';
import type { RuntimeRelationship } from '../types.js';
import type { ModuleContext, DynamicsResult, ModuleDefinition } from './registry.js';
import { moduleRegistry } from './registry.js';

// ============================================================================
// DEFAULTS
// ============================================================================

const DEFAULT_PARAMS: RelationshipDecayParams = {
  decayRate: 0.02,
  decayFloor: 0.1,
  gracePeriodTicks: 20,
  protectedKinds: [],
};

// ============================================================================
// IMPLEMENTATION
// ============================================================================

/**
 * Process decay for a single relationship
 */
function processRelationshipDecay(
  rel: RuntimeRelationship,
  config: RelationshipDecayParams,
  currentTick: number
): { newDistance?: number; shouldArchive?: boolean } | null {
  // Skip archived relationships
  if (rel.archived) return null;

  // Skip protected kinds
  if (config.protectedKinds.includes(rel.kind)) return null;

  // Calculate age
  const age = currentTick - rel.createdAtTick;

  // Grace period - no decay yet
  if (age < config.gracePeriodTicks) return null;

  // Calculate decay amount based on age beyond grace period
  const ticksSinceGrace = age - config.gracePeriodTicks;
  const decayAmount = config.decayRate * ticksSinceGrace;

  // Calculate new distance (distance represents weakness, so we increase it)
  const newDistance = Math.min(1.0, rel.distance + decayAmount);

  // Check if relationship should be archived (distance too high)
  const shouldArchive = newDistance > (1.0 - config.decayFloor);

  return {
    newDistance: shouldArchive ? undefined : newDistance,
    shouldArchive,
  };
}

/**
 * Apply relationship decay across all relationships
 *
 * @param params - Module configuration
 * @param context - Simulation context
 * @returns Dynamics result with relationship modifications
 */
export function relationshipDecay(
  params: RelationshipDecayParams,
  context: ModuleContext
): DynamicsResult {
  const config = { ...DEFAULT_PARAMS, ...params };
  const result: DynamicsResult = {
    relationshipChanges: [],
  };

  for (const rel of context.state.relationships.values()) {
    const decay = processRelationshipDecay(rel, config, context.tick);
    if (decay) {
      result.relationshipChanges!.push({
        relationshipId: rel.id,
        changes: {
          distance: decay.newDistance,
          archive: decay.shouldArchive,
        },
      });
    }
  }

  return result;
}

/**
 * Check if a specific relationship has decayed beyond a threshold
 */
export function isRelationshipDecayed(
  rel: RuntimeRelationship,
  threshold: number = 0.8
): boolean {
  return rel.distance > threshold;
}

/**
 * Calculate remaining "strength" of a relationship (inverse of distance)
 */
export function relationshipStrength(rel: RuntimeRelationship): number {
  return 1.0 - rel.distance;
}

// ============================================================================
// REGISTER MODULE
// ============================================================================

const relationshipDecayModule: ModuleDefinition<RelationshipDecayParams, DynamicsResult> = {
  id: 'relationship_decay',
  name: 'Relationship Decay',
  description: 'Applies natural decay to relationships over time',
  category: 'dynamics',
  defaults: DEFAULT_PARAMS,
  execute: (params, context) => relationshipDecay(params, context),
};

moduleRegistry.register(relationshipDecayModule);
