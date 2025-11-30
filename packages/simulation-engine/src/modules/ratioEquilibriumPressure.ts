/**
 * Ratio Equilibrium Pressure Module
 *
 * Pressure module that creates self-regulating feedback.
 * Pressure increases when a population ratio deviates from equilibrium,
 * driving rules to correct the imbalance.
 *
 * Examples:
 * - If predators exceed equilibrium ratio, pressure rises to trigger culling
 * - If merchants are below equilibrium, pressure rises to spawn more
 * - If faction balance shifts, pressure rises to trigger rebalancing events
 *
 * Extracted from lore-weave's homeostatic pressure systems.
 */

import type { RatioEquilibriumPressureParams } from '@canonry/world-schema';
import type { ModuleContext, PressureResult, ModuleDefinition } from './registry.js';
import { moduleRegistry } from './registry.js';

// ============================================================================
// DEFAULTS
// ============================================================================

const DEFAULT_PARAMS: RatioEquilibriumPressureParams = {
  measureKind: 'npc',
  measureSubtype: undefined,
  equilibriumRatio: 0.5,
  sensitivity: 10,
  baseValue: 50,
};

// ============================================================================
// IMPLEMENTATION
// ============================================================================

/**
 * Count entities matching criteria
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
 * Count total entities of a kind (all subtypes)
 */
function countAllOfKind(context: ModuleContext, kind: string): number {
  let count = 0;
  for (const entity of context.state.entities.values()) {
    if (entity.kind === kind) count++;
  }
  return count;
}

/**
 * Calculate equilibrium-seeking pressure
 *
 * When the current ratio equals equilibrium, pressure = baseValue
 * When ratio > equilibrium, pressure > baseValue (trigger reduction)
 * When ratio < equilibrium, pressure < baseValue (trigger creation)
 *
 * The "surplus" version inverts this - pressure rises when ratio is LOW
 *
 * @param params - Module configuration
 * @param context - Simulation context
 * @returns Pressure result with computed value and deviation
 */
export function ratioEquilibriumPressure(
  params: RatioEquilibriumPressureParams,
  context: ModuleContext
): PressureResult {
  const config = { ...DEFAULT_PARAMS, ...params };

  // Count the measured population
  const measuredCount = countEntities(context, config.measureKind, config.measureSubtype);

  // Count total of that kind
  const totalCount = countAllOfKind(context, config.measureKind);

  // Calculate current ratio
  const currentRatio = totalCount > 0 ? measuredCount / totalCount : 0;

  // Calculate deviation from equilibrium
  const deviation = currentRatio - config.equilibriumRatio;

  // Calculate pressure:
  // - At equilibrium: baseValue
  // - Above equilibrium: baseValue + (deviation * sensitivity)
  // - Below equilibrium: baseValue - (|deviation| * sensitivity)
  const pressureAdjustment = deviation * config.sensitivity * 100;
  const value = Math.max(0, Math.min(100, config.baseValue + pressureAdjustment));

  return {
    value,
    components: {
      measuredCount,
      totalCount,
      currentRatio,
      equilibriumRatio: config.equilibriumRatio,
      deviation,
      baseValue: config.baseValue,
      pressureAdjustment,
    },
  };
}

/**
 * Inverse equilibrium pressure - pressure rises when ratio is LOW
 * Useful for triggering creation rules when population is below target
 */
export function deficitPressure(
  params: RatioEquilibriumPressureParams,
  context: ModuleContext
): PressureResult {
  const config = { ...DEFAULT_PARAMS, ...params };

  const measuredCount = countEntities(context, config.measureKind, config.measureSubtype);
  const totalCount = countAllOfKind(context, config.measureKind);
  const currentRatio = totalCount > 0 ? measuredCount / totalCount : 0;

  // Invert: pressure rises when ratio is BELOW equilibrium
  const deficit = config.equilibriumRatio - currentRatio;
  const pressureAdjustment = Math.max(0, deficit) * config.sensitivity * 100;
  const value = Math.max(0, Math.min(100, config.baseValue + pressureAdjustment));

  return {
    value,
    components: {
      measuredCount,
      totalCount,
      currentRatio,
      equilibriumRatio: config.equilibriumRatio,
      deficit,
      baseValue: config.baseValue,
      pressureAdjustment,
    },
  };
}

/**
 * Surplus pressure - pressure rises when ratio is HIGH
 * Useful for triggering culling/removal rules when overpopulated
 */
export function surplusPressure(
  params: RatioEquilibriumPressureParams,
  context: ModuleContext
): PressureResult {
  const config = { ...DEFAULT_PARAMS, ...params };

  const measuredCount = countEntities(context, config.measureKind, config.measureSubtype);
  const totalCount = countAllOfKind(context, config.measureKind);
  const currentRatio = totalCount > 0 ? measuredCount / totalCount : 0;

  // Pressure rises when ratio is ABOVE equilibrium
  const surplus = currentRatio - config.equilibriumRatio;
  const pressureAdjustment = Math.max(0, surplus) * config.sensitivity * 100;
  const value = Math.max(0, Math.min(100, config.baseValue + pressureAdjustment));

  return {
    value,
    components: {
      measuredCount,
      totalCount,
      currentRatio,
      equilibriumRatio: config.equilibriumRatio,
      surplus,
      baseValue: config.baseValue,
      pressureAdjustment,
    },
  };
}

// ============================================================================
// REGISTER MODULE
// ============================================================================

const ratioEquilibriumModule: ModuleDefinition<RatioEquilibriumPressureParams, PressureResult> = {
  id: 'ratio_equilibrium_pressure',
  name: 'Ratio Equilibrium Pressure',
  description: 'Pressure based on deviation from target population ratio',
  category: 'pressure',
  defaults: DEFAULT_PARAMS,
  execute: (params, context) => ratioEquilibriumPressure(params, context),
};

const deficitPressureModule: ModuleDefinition<RatioEquilibriumPressureParams, PressureResult> = {
  id: 'deficit_pressure',
  name: 'Deficit Pressure',
  description: 'Pressure that rises when population is below target',
  category: 'pressure',
  defaults: DEFAULT_PARAMS,
  execute: (params, context) => deficitPressure(params, context),
};

const surplusPressureModule: ModuleDefinition<RatioEquilibriumPressureParams, PressureResult> = {
  id: 'surplus_pressure',
  name: 'Surplus Pressure',
  description: 'Pressure that rises when population exceeds target',
  category: 'pressure',
  defaults: DEFAULT_PARAMS,
  execute: (params, context) => surplusPressure(params, context),
};

moduleRegistry.register(ratioEquilibriumModule);
moduleRegistry.register(deficitPressureModule);
moduleRegistry.register(surplusPressureModule);
