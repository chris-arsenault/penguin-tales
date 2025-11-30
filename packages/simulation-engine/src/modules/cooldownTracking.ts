/**
 * Cooldown Tracking Module
 *
 * Dynamics module that prevents entities from taking the same action
 * too frequently. Uses tags to track when actions were last taken.
 *
 * Examples:
 * - Entities can only form new romances every N ticks
 * - Conflicts between same parties have a cooldown
 * - Trade agreements need time to establish
 *
 * Extracted from lore-weave's action throttling systems.
 */

import type { CooldownParams } from '@canonry/world-schema';
import type { RuntimeEntity } from '../types.js';
import type { ModuleContext, FilterResult, DynamicsResult, ModuleDefinition } from './registry.js';
import { moduleRegistry } from './registry.js';

// ============================================================================
// DEFAULTS
// ============================================================================

const DEFAULT_PARAMS: CooldownParams = {
  cooldownTicks: 10,
  actionType: 'action',
};

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Generate the cooldown tag for an action type
 */
function getCooldownTag(actionType: string): string {
  return `cooldown_${actionType}`;
}

/**
 * Parse the cooldown expiry tick from a tag
 * Tag format: cooldown_{actionType}_{expiryTick}
 */
function parseCooldownExpiry(tag: string, actionType: string): number | null {
  const prefix = `cooldown_${actionType}_`;
  if (!tag.startsWith(prefix)) return null;

  const expiryStr = tag.slice(prefix.length);
  const expiry = parseInt(expiryStr, 10);
  return isNaN(expiry) ? null : expiry;
}

/**
 * Create a cooldown tag with expiry tick
 */
function createCooldownTag(actionType: string, expiryTick: number): string {
  return `cooldown_${actionType}_${expiryTick}`;
}

// ============================================================================
// IMPLEMENTATION
// ============================================================================

/**
 * Check if an entity is currently on cooldown for an action
 *
 * @param params - Module configuration
 * @param context - Simulation context
 * @param entity - Entity to check
 * @returns Filter result indicating if entity can act
 */
export function checkCooldown(
  params: CooldownParams,
  context: ModuleContext,
  entity: RuntimeEntity
): FilterResult {
  const config = { ...DEFAULT_PARAMS, ...params };

  // Look for any cooldown tag for this action type
  for (const tag of entity.tags) {
    const expiry = parseCooldownExpiry(tag, config.actionType);
    if (expiry !== null) {
      if (context.tick < expiry) {
        const remaining = expiry - context.tick;
        return {
          passes: false,
          reason: `On cooldown for ${config.actionType}: ${remaining} ticks remaining`,
        };
      }
    }
  }

  return {
    passes: true,
    reason: `No active cooldown for ${config.actionType}`,
  };
}

/**
 * Apply cooldown to an entity after an action
 *
 * @param params - Module configuration
 * @param context - Simulation context
 * @param entityId - Entity to apply cooldown to
 * @returns Dynamics result with tag modifications
 */
export function applyCooldown(
  params: CooldownParams,
  context: ModuleContext,
  entityId: string
): DynamicsResult {
  const config = { ...DEFAULT_PARAMS, ...params };
  const entity = context.state.entities.get(entityId);

  if (!entity) {
    return { modifications: [] };
  }

  // Find and remove any existing cooldown tags for this action
  const tagsToRemove = entity.tags.filter(tag =>
    parseCooldownExpiry(tag, config.actionType) !== null
  );

  // Calculate new expiry tick
  const expiryTick = context.tick + config.cooldownTicks;
  const newTag = createCooldownTag(config.actionType, expiryTick);

  return {
    modifications: [{
      entityId,
      changes: {
        removeTags: tagsToRemove,
        addTags: [newTag],
      },
    }],
  };
}

/**
 * Clean up expired cooldown tags from all entities
 *
 * @param context - Simulation context
 * @param actionTypes - Action types to clean up (empty = all)
 * @returns Dynamics result with tag removals
 */
export function cleanupExpiredCooldowns(
  context: ModuleContext,
  actionTypes?: string[]
): DynamicsResult {
  const result: DynamicsResult = {
    modifications: [],
  };

  for (const entity of context.state.entities.values()) {
    const tagsToRemove: string[] = [];

    for (const tag of entity.tags) {
      if (!tag.startsWith('cooldown_')) continue;

      // Parse the action type and expiry
      const parts = tag.split('_');
      if (parts.length < 3) continue;

      const actionType = parts[1];
      if (actionTypes && !actionTypes.includes(actionType)) continue;

      const expiry = parseInt(parts[2], 10);
      if (isNaN(expiry)) continue;

      if (context.tick >= expiry) {
        tagsToRemove.push(tag);
      }
    }

    if (tagsToRemove.length > 0) {
      result.modifications!.push({
        entityId: entity.id,
        changes: {
          removeTags: tagsToRemove,
        },
      });
    }
  }

  return result;
}

/**
 * Get remaining cooldown ticks for an entity
 */
export function getRemainingCooldown(
  entity: RuntimeEntity,
  actionType: string,
  currentTick: number
): number {
  for (const tag of entity.tags) {
    const expiry = parseCooldownExpiry(tag, actionType);
    if (expiry !== null && currentTick < expiry) {
      return expiry - currentTick;
    }
  }
  return 0;
}

// ============================================================================
// REGISTER MODULE
// ============================================================================

const cooldownCheckModule: ModuleDefinition<CooldownParams, FilterResult> = {
  id: 'cooldown_check',
  name: 'Cooldown Check',
  description: 'Checks if an entity is on cooldown for an action',
  category: 'filtering',
  defaults: DEFAULT_PARAMS,
  execute: (params, context, ...args) => checkCooldown(params, context, args[0] as RuntimeEntity),
};

const cooldownApplyModule: ModuleDefinition<CooldownParams, DynamicsResult> = {
  id: 'cooldown_apply',
  name: 'Apply Cooldown',
  description: 'Applies cooldown to an entity after an action',
  category: 'dynamics',
  defaults: DEFAULT_PARAMS,
  execute: (params, context, ...args) => applyCooldown(params, context, args[0] as string),
};

moduleRegistry.register(cooldownCheckModule);
moduleRegistry.register(cooldownApplyModule);
