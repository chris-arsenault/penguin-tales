/**
 * Culture Affinity Module
 *
 * Scoring module that adjusts scores based on cultural alignment.
 * Entities from the same culture get boosted scores, while
 * cross-cultural selections can be penalized or boosted
 * (depending on the relationship type).
 *
 * Examples:
 * - Same culture boost for friendship formation
 * - Cross-culture penalty for romance (cultures rarely intermarry)
 * - Cross-culture boost for trade (different cultures have different goods)
 *
 * Extracted from lore-weave's culture-aware selection logic.
 */

import type { CultureAffinityParams } from '@canonry/world-schema';
import type { RuntimeEntity } from '../types.js';
import type { ModuleContext, ScoringResult, ModuleDefinition } from './registry.js';
import { moduleRegistry } from './registry.js';

// ============================================================================
// DEFAULTS
// ============================================================================

const DEFAULT_PARAMS: CultureAffinityParams = {
  sameCultureBoost: 1.5,
  differentCulturePenalty: 0.4,
  mode: 'prefer',
};

// ============================================================================
// IMPLEMENTATION
// ============================================================================

/**
 * Calculate culture affinity score
 *
 * @param params - Module configuration
 * @param context - Simulation context
 * @param entity - Entity being scored
 * @param referenceCultureId - Culture to compare against (optional)
 * @returns Score result based on cultural alignment
 */
export function cultureAffinity(
  params: CultureAffinityParams,
  context: ModuleContext,
  entity: RuntimeEntity,
  referenceCultureId?: string
): ScoringResult {
  const config = { ...DEFAULT_PARAMS, ...params };

  // If no reference culture, return neutral score
  if (!referenceCultureId) {
    return {
      score: 1.0,
      reason: 'No reference culture provided',
    };
  }

  // If entity has no culture, return neutral score
  if (!entity.cultureId) {
    return {
      score: 1.0,
      reason: 'Entity has no culture',
    };
  }

  const sameCulture = entity.cultureId === referenceCultureId;

  if (config.mode === 'prefer') {
    // Prefer same culture (typical for social bonds)
    if (sameCulture) {
      return {
        score: config.sameCultureBoost,
        reason: `Same culture (${entity.cultureId}) - boosted`,
      };
    } else {
      return {
        score: config.differentCulturePenalty,
        reason: `Different culture (${entity.cultureId} vs ${referenceCultureId}) - penalized`,
      };
    }
  } else {
    // Avoid same culture (prefer cross-cultural, e.g., trade)
    if (sameCulture) {
      return {
        score: config.differentCulturePenalty,
        reason: `Same culture (${entity.cultureId}) - penalized (cross-culture mode)`,
      };
    } else {
      return {
        score: config.sameCultureBoost,
        reason: `Different culture (${entity.cultureId} vs ${referenceCultureId}) - boosted (cross-culture mode)`,
      };
    }
  }
}

// ============================================================================
// REGISTER MODULE
// ============================================================================

const cultureAffinityModule: ModuleDefinition<CultureAffinityParams, ScoringResult> = {
  id: 'culture_affinity',
  name: 'Culture Affinity',
  description: 'Adjusts scores based on cultural alignment between entities',
  category: 'scoring',
  defaults: DEFAULT_PARAMS,
  execute: (params, context, ...args) =>
    cultureAffinity(params, context, args[0] as RuntimeEntity, args[1] as string | undefined),
};

moduleRegistry.register(cultureAffinityModule);
