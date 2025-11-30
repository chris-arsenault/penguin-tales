/**
 * Status Gate Module
 *
 * Filtering module that controls entity selection based on status.
 * Can require certain statuses or block others.
 *
 * Examples:
 * - Only active NPCs can participate in events
 * - Historical entities cannot form new relationships
 * - Only brewing occurrences can escalate
 *
 * Extracted from lore-weave's status-based selection logic.
 */

import type { StatusGateParams } from '@canonry/world-schema';
import type { RuntimeEntity } from '../types.js';
import type { ModuleContext, FilterResult, ScoringResult, ModuleDefinition } from './registry.js';
import { moduleRegistry } from './registry.js';

// ============================================================================
// DEFAULTS
// ============================================================================

const DEFAULT_PARAMS: StatusGateParams = {
  allowedStatuses: [],
  blockedStatuses: [],
};

// ============================================================================
// IMPLEMENTATION
// ============================================================================

/**
 * Check if entity passes status gate
 *
 * @param params - Module configuration
 * @param context - Simulation context
 * @param entity - Entity to check
 * @returns Filter result indicating pass/fail
 */
export function statusGate(
  params: StatusGateParams,
  context: ModuleContext,
  entity: RuntimeEntity
): FilterResult {
  const config = { ...DEFAULT_PARAMS, ...params };

  // If blocked statuses are specified, check if entity has any
  if (config.blockedStatuses.length > 0) {
    if (config.blockedStatuses.includes(entity.status)) {
      return {
        passes: false,
        reason: `Status "${entity.status}" is blocked`,
      };
    }
  }

  // If allowed statuses are specified, check if entity has one
  if (config.allowedStatuses.length > 0) {
    if (!config.allowedStatuses.includes(entity.status)) {
      return {
        passes: false,
        reason: `Status "${entity.status}" not in allowed list: ${config.allowedStatuses.join(', ')}`,
      };
    }
  }

  return {
    passes: true,
    reason: 'Status check passed',
  };
}

/**
 * Score variant - returns 0 for blocked, 1 for allowed
 * Can be composed with other scoring modules
 */
export function statusGateScore(
  params: StatusGateParams,
  context: ModuleContext,
  entity: RuntimeEntity
): ScoringResult {
  const filterResult = statusGate(params, context, entity);

  return {
    score: filterResult.passes ? 1.0 : 0,
    reason: filterResult.reason,
  };
}

/**
 * Common status presets for convenience
 */
export const STATUS_PRESETS = {
  /** Only active entities */
  activeOnly: (): StatusGateParams => ({
    allowedStatuses: ['active'],
    blockedStatuses: [],
  }),

  /** Exclude historical/archived entities */
  excludeHistorical: (): StatusGateParams => ({
    allowedStatuses: [],
    blockedStatuses: ['historical', 'archived', 'deceased', 'destroyed'],
  }),

  /** Only entities that can change (not finalized) */
  mutable: (): StatusGateParams => ({
    allowedStatuses: [],
    blockedStatuses: ['historical', 'archived', 'legendary', 'mythic', 'finalized'],
  }),

  /** Only brewing/active occurrences */
  ongoingEvents: (): StatusGateParams => ({
    allowedStatuses: ['brewing', 'active', 'escalating'],
    blockedStatuses: [],
  }),
};

// ============================================================================
// REGISTER MODULE
// ============================================================================

const statusGateModule: ModuleDefinition<StatusGateParams, FilterResult> = {
  id: 'status_gate',
  name: 'Status Gate',
  description: 'Filters entities based on their status',
  category: 'filtering',
  defaults: DEFAULT_PARAMS,
  execute: (params, context, ...args) => statusGate(params, context, args[0] as RuntimeEntity),
};

const statusGateScoreModule: ModuleDefinition<StatusGateParams, ScoringResult> = {
  id: 'status_gate_score',
  name: 'Status Gate (Scoring)',
  description: 'Scores entities based on status (0 for blocked, 1 for allowed)',
  category: 'scoring',
  defaults: DEFAULT_PARAMS,
  execute: (params, context, ...args) => statusGateScore(params, context, args[0] as RuntimeEntity),
};

moduleRegistry.register(statusGateModule);
moduleRegistry.register(statusGateScoreModule);
