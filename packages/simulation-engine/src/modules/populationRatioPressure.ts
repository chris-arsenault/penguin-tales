/**
 * Population Ratio Pressure Module
 *
 * Pressure module that calculates pressure based on the ratio
 * of two entity populations. This enables dynamic pressure that
 * responds to actual world state.
 *
 * Examples:
 * - predator_pressure = count(predators) / count(prey) * multiplier
 * - faction_dominance = count(faction_members) / count(total_npcs)
 * - resource_scarcity = count(consumers) / count(resources)
 *
 * Extracted from lore-weave's dynamic pressure systems.
 */

import type { PopulationRatioPressureParams, EntityQuery } from '@canonry/world-schema';
import type { ModuleContext, PressureResult, ModuleDefinition } from './registry.js';
import { moduleRegistry } from './registry.js';

// ============================================================================
// DEFAULTS
// ============================================================================

const DEFAULT_PARAMS: PopulationRatioPressureParams = {
  numeratorKind: 'npc',
  numeratorSubtype: undefined,
  denominatorKind: 'npc',
  denominatorSubtype: undefined,
  multiplier: 1.0,
  offset: 0,
};

// ============================================================================
// IMPLEMENTATION
// ============================================================================

/**
 * Count entities matching kind/subtype criteria
 */
function countEntities(
  context: ModuleContext,
  kind: string,
  subtype?: string
): number {
  let count = 0;

  for (const entity of context.state.entities.values()) {
    if (entity.kind !== kind) continue;
    if (subtype && entity.subtype !== subtype) continue;
    count++;
  }

  return count;
}

/**
 * Calculate pressure based on population ratio
 *
 * Formula: (numerator_count / denominator_count) * multiplier + offset
 *
 * @param params - Module configuration
 * @param context - Simulation context
 * @returns Pressure result with computed value
 */
export function populationRatioPressure(
  params: PopulationRatioPressureParams,
  context: ModuleContext
): PressureResult {
  const config = { ...DEFAULT_PARAMS, ...params };

  const numeratorCount = countEntities(
    context,
    config.numeratorKind,
    config.numeratorSubtype
  );

  const denominatorCount = countEntities(
    context,
    config.denominatorKind,
    config.denominatorSubtype
  );

  // Handle division by zero - if no denominator, pressure is maximal
  let ratio: number;
  if (denominatorCount === 0) {
    ratio = numeratorCount > 0 ? 100 : 0;
  } else {
    ratio = numeratorCount / denominatorCount;
  }

  const value = ratio * config.multiplier + config.offset;

  return {
    value,
    components: {
      numeratorCount,
      denominatorCount,
      ratio,
      multiplier: config.multiplier,
      offset: config.offset,
    },
  };
}

// ============================================================================
// REGISTER MODULE
// ============================================================================

const populationRatioPressureModule: ModuleDefinition<PopulationRatioPressureParams, PressureResult> = {
  id: 'population_ratio_pressure',
  name: 'Population Ratio Pressure',
  description: 'Calculates pressure as ratio of two entity populations',
  category: 'pressure',
  defaults: DEFAULT_PARAMS,
  execute: (params, context) => populationRatioPressure(params, context),
};

moduleRegistry.register(populationRatioPressureModule);
