/**
 * Tag Filter Module
 *
 * Filtering module that evaluates entities based on their tags.
 * Can require certain tags, forbid others, and prefer some.
 *
 * Examples:
 * - Only warriors can participate in battles (required: warrior)
 * - Pacifists cannot participate in conflicts (forbidden: peaceful)
 * - Prefer experienced entities (prefer: veteran, seasoned)
 *
 * Extracted from lore-weave's tag-based selection logic.
 */

import type { TagFilterParams } from '@canonry/world-schema';
import type { RuntimeEntity } from '../types.js';
import type { ModuleContext, FilterResult, ScoringResult, ModuleDefinition } from './registry.js';
import { moduleRegistry } from './registry.js';

// ============================================================================
// DEFAULTS
// ============================================================================

const DEFAULT_PARAMS: TagFilterParams = {
  requiredTags: [],
  forbiddenTags: [],
  preferTags: [],
  preferBoost: 1.5,
};

// ============================================================================
// IMPLEMENTATION
// ============================================================================

/**
 * Check if entity has all required tags
 */
function hasAllTags(entity: RuntimeEntity, tags: string[]): boolean {
  return tags.every((tag: string) => entity.tags.includes(tag));
}

/**
 * Check if entity has any forbidden tags
 */
function hasAnyForbiddenTags(entity: RuntimeEntity, tags: string[]): boolean {
  return tags.some((tag: string) => entity.tags.includes(tag));
}

/**
 * Count how many preferred tags an entity has
 */
function countPreferredTags(entity: RuntimeEntity, tags: string[]): number {
  return tags.filter((tag: string) => entity.tags.includes(tag)).length;
}

/**
 * Filter an entity based on tag requirements
 *
 * @param params - Module configuration
 * @param context - Simulation context
 * @param entity - Entity to filter
 * @returns Filter result indicating pass/fail
 */
export function tagFilter(
  params: TagFilterParams,
  context: ModuleContext,
  entity: RuntimeEntity
): FilterResult {
  const config = { ...DEFAULT_PARAMS, ...params };

  // Check required tags
  if (config.requiredTags.length > 0) {
    if (!hasAllTags(entity, config.requiredTags)) {
      const missing = config.requiredTags.filter(t => !entity.tags.includes(t));
      return {
        passes: false,
        reason: `Missing required tags: ${missing.join(', ')}`,
      };
    }
  }

  // Check forbidden tags
  if (config.forbiddenTags.length > 0) {
    if (hasAnyForbiddenTags(entity, config.forbiddenTags)) {
      const found = config.forbiddenTags.filter(t => entity.tags.includes(t));
      return {
        passes: false,
        reason: `Has forbidden tags: ${found.join(', ')}`,
      };
    }
  }

  return {
    passes: true,
    reason: 'Passed all tag requirements',
  };
}

/**
 * Score an entity based on tag preferences
 * (combines filtering with scoring for preferred tags)
 *
 * @param params - Module configuration
 * @param context - Simulation context
 * @param entity - Entity to score
 * @returns Score result with preference boost
 */
export function tagFilterScore(
  params: TagFilterParams,
  context: ModuleContext,
  entity: RuntimeEntity
): ScoringResult {
  const config = { ...DEFAULT_PARAMS, ...params };

  // First check if entity passes hard requirements
  const filterResult = tagFilter(params, context, entity);
  if (!filterResult.passes) {
    return {
      score: 0,
      reason: filterResult.reason,
    };
  }

  // Calculate preference boost
  if (config.preferTags.length === 0) {
    return {
      score: 1.0,
      reason: 'No tag preferences specified',
    };
  }

  const matchCount = countPreferredTags(entity, config.preferTags);
  if (matchCount === 0) {
    return {
      score: 1.0,
      reason: 'No preferred tags matched',
    };
  }

  // Boost scales with number of matching preferred tags
  const boost = Math.pow(config.preferBoost, matchCount);

  return {
    score: boost,
    reason: `${matchCount} preferred tags matched (boost ${boost.toFixed(2)})`,
  };
}

// ============================================================================
// REGISTER MODULE
// ============================================================================

const tagFilterModule: ModuleDefinition<TagFilterParams, FilterResult> = {
  id: 'tag_filter',
  name: 'Tag Filter',
  description: 'Filters entities based on required, forbidden, and preferred tags',
  category: 'filtering',
  defaults: DEFAULT_PARAMS,
  execute: (params, context, ...args) => tagFilter(params, context, args[0] as RuntimeEntity),
};

const tagFilterScoreModule: ModuleDefinition<TagFilterParams, ScoringResult> = {
  id: 'tag_filter_score',
  name: 'Tag Filter (Scoring)',
  description: 'Scores entities based on tag requirements and preferences',
  category: 'scoring',
  defaults: DEFAULT_PARAMS,
  execute: (params, context, ...args) => tagFilterScore(params, context, args[0] as RuntimeEntity),
};

moduleRegistry.register(tagFilterModule);
moduleRegistry.register(tagFilterScoreModule);
