/**
 * Simulation Engine
 *
 * Main engine that orchestrates the simulation.
 */

import type {
  GenerationRule,
  SimulationRule,
  PressureEffect,
  ModifySpec,
  DisconnectSpec,
} from '@canonry/world-schema';
import type {
  SimulationState,
  ExecutionContext,
  EngineConfig,
  RuntimeEntity,
  RuntimeRelationship,
  RuleExecutionResult,
  TickResult,
  EraResult,
  SimulationResult,
} from './types.js';
import { evaluateConditions, seededRandom } from './conditions.js';
import { createEntities, commitEntities, resolveEntityRef } from './entities.js';
import { executeSelections } from './selection.js';
import {
  createAllRelationships,
  commitRelationships,
  createOccurrence,
  commitOccurrence,
  archiveRelationship,
  deleteRelationship,
} from './relationships.js';

// ============================================================================
// STATE INITIALIZATION
// ============================================================================

/**
 * Create initial simulation state
 */
function createInitialState(config: EngineConfig): SimulationState {
  const state: SimulationState = {
    entities: new Map(),
    relationships: new Map(),
    occurrences: [],
    pressures: new Map(),
    tick: 0,
    currentEra: config.eras[0]?.id || 'default',
    entityCounter: 0,
    relationshipCounter: 0,
    occurrenceCounter: 0,
    randomState: config.simulation.settings.randomSeed ?? Date.now(),
  };

  // Initialize pressures
  for (const pressure of config.simulation.pressures) {
    state.pressures.set(pressure.id, pressure.initialValue);
  }

  // Add seed entities
  if (config.seedEntities) {
    for (const entity of config.seedEntities) {
      state.entities.set(entity.id, entity);
      state.entityCounter = Math.max(
        state.entityCounter,
        parseInt(entity.id.replace('entity_', '')) || 0
      );
    }
  }

  // Add seed relationships
  if (config.seedRelationships) {
    for (const rel of config.seedRelationships) {
      state.relationships.set(rel.id, rel);
      state.relationshipCounter = Math.max(
        state.relationshipCounter,
        parseInt(rel.id.replace('rel_', '')) || 0
      );
    }
  }

  return state;
}

/**
 * Create execution context
 */
function createContext(
  config: EngineConfig,
  state: SimulationState
): ExecutionContext {
  return {
    config: config.simulation,
    state,
    createdEntities: new Map(),
    selectedEntities: new Map(),
    cultures: config.cultures,
    eras: config.eras,
    generateName: config.generateName || defaultNameGenerator,
  };
}

/**
 * Default name generator (placeholder)
 */
function defaultNameGenerator(cultureId: string, kind: string): string {
  const prefixes = ['Ancient', 'Noble', 'Dark', 'Swift', 'Wise', 'Bold'];
  const suffixes = ['wind', 'stone', 'fire', 'shadow', 'light', 'star'];
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];
  return `${prefix}${suffix}`;
}

// ============================================================================
// RULE EXECUTION
// ============================================================================

/**
 * Execute a generation rule
 */
function executeGenerationRule(
  rule: GenerationRule,
  ctx: ExecutionContext
): RuleExecutionResult {
  // Clear context for this rule
  ctx.createdEntities.clear();
  ctx.selectedEntities.clear();

  const result: RuleExecutionResult = {
    ruleId: rule.id,
    success: false,
    entitiesCreated: [],
    relationshipsCreated: [],
    pressureChanges: [],
  };

  try {
    // Check conditions
    if (!evaluateConditions(rule.conditions, ctx)) {
      return result;
    }

    // Create entities (if create templates exist)
    if (rule.create && rule.create.length > 0) {
      for (const template of rule.create) {
        const entities = createEntities(template, ctx);
        result.entitiesCreated.push(...entities);
      }
    }

    // Commit entities to state
    commitEntities(result.entitiesCreated, ctx);

    // Create relationships
    const relationships = createAllRelationships(rule.connect, ctx);
    result.relationshipsCreated.push(...relationships);
    commitRelationships(relationships, ctx);

    // Apply pressure effects
    if (rule.pressureEffects) {
      applyPressureEffects(rule.pressureEffects, ctx, result);
    }

    // Create occurrence if specified
    if (rule.occurrence) {
      const occurrence = createOccurrence(rule.occurrence, ctx);
      commitOccurrence(occurrence, ctx);
      result.occurrence = occurrence;
    }

    result.success = true;
  } catch (error) {
    result.error = error instanceof Error ? error.message : 'Unknown error';
  }

  return result;
}

/**
 * Execute a simulation rule
 */
function executeSimulationRule(
  rule: SimulationRule,
  ctx: ExecutionContext
): RuleExecutionResult {
  // Clear context for this rule
  ctx.createdEntities.clear();
  ctx.selectedEntities.clear();

  const result: RuleExecutionResult = {
    ruleId: rule.id,
    success: false,
    entitiesCreated: [],
    relationshipsCreated: [],
    pressureChanges: [],
  };

  try {
    // Check conditions
    if (!evaluateConditions(rule.conditions, ctx)) {
      return result;
    }

    // Execute selections
    executeSelections(rule.select, ctx);

    // Create entities if specified
    if (rule.create) {
      for (const template of rule.create) {
        const entities = createEntities(template, ctx);
        result.entitiesCreated.push(...entities);
      }
      commitEntities(result.entitiesCreated, ctx);
    }

    // Apply modifications
    if (rule.modify) {
      applyModifications(rule.modify, ctx);
    }

    // Handle disconnections
    if (rule.disconnect) {
      applyDisconnections(rule.disconnect, ctx);
    }

    // Create relationships
    const relationships = createAllRelationships(rule.connect, ctx);
    result.relationshipsCreated.push(...relationships);
    commitRelationships(relationships, ctx);

    // Apply pressure effects
    if (rule.pressureEffects) {
      applyPressureEffects(rule.pressureEffects, ctx, result);
    }

    // Create occurrence if specified
    if (rule.occurrence) {
      const occurrence = createOccurrence(rule.occurrence, ctx);
      commitOccurrence(occurrence, ctx);
      result.occurrence = occurrence;
    }

    result.success = true;
  } catch (error) {
    result.error = error instanceof Error ? error.message : 'Unknown error';
  }

  return result;
}

/**
 * Apply pressure effects
 */
function applyPressureEffects(
  effects: PressureEffect[],
  ctx: ExecutionContext,
  result: RuleExecutionResult
): void {
  for (const effect of effects) {
    const current = ctx.state.pressures.get(effect.pressure) ?? 0;
    const pressure = ctx.config.pressures.find(p => p.id === effect.pressure);

    let newValue = current + effect.delta;

    // Clamp to range if defined
    if (pressure) {
      newValue = Math.max(pressure.range.min, Math.min(pressure.range.max, newValue));
    }

    ctx.state.pressures.set(effect.pressure, newValue);
    result.pressureChanges.push({ pressureId: effect.pressure, delta: effect.delta });
  }
}

/**
 * Apply entity modifications
 */
function applyModifications(
  mods: ModifySpec[],
  ctx: ExecutionContext
): void {
  for (const mod of mods) {
    const entities = resolveEntityRef(mod.target, ctx);

    for (const entity of entities) {
      if (mod.set) {
        if (mod.set.status !== undefined) {
          entity.status = mod.set.status;
        }
        if (mod.set.prominence !== undefined) {
          entity.prominence = mod.set.prominence;
        }
        if (mod.set.addTags) {
          for (const tag of mod.set.addTags) {
            if (!entity.tags.includes(tag)) {
              entity.tags.push(tag);
            }
          }
        }
        if (mod.set.removeTags) {
          entity.tags = entity.tags.filter(t => !mod.set!.removeTags!.includes(t));
        }
        entity.updatedAtTick = ctx.state.tick;
      }
    }
  }
}

/**
 * Apply disconnections
 */
function applyDisconnections(
  specs: DisconnectSpec[],
  ctx: ExecutionContext
): void {
  for (const spec of specs) {
    const fromEntities = resolveEntityRef(spec.from, ctx);
    const toEntities = resolveEntityRef(spec.to, ctx);

    const fromIds = new Set(fromEntities.map(e => e.id));
    const toIds = new Set(toEntities.map(e => e.id));

    for (const rel of ctx.state.relationships.values()) {
      if (rel.kind === spec.kind && fromIds.has(rel.srcId) && toIds.has(rel.dstId)) {
        if (spec.archive) {
          archiveRelationship(rel.id, ctx);
        } else {
          deleteRelationship(rel.id, ctx);
        }
      }
    }
  }
}

// ============================================================================
// TICK EXECUTION
// ============================================================================

/**
 * Apply era pressure drifts
 */
function applyPressureDrift(
  eraId: string,
  ctx: ExecutionContext
): void {
  const eraWeights = ctx.config.eraRuleWeights[eraId];
  if (!eraWeights) return;

  for (const [pressureId, drift] of Object.entries(eraWeights.pressureDrift)) {
    const current = ctx.state.pressures.get(pressureId) ?? 0;
    const pressure = ctx.config.pressures.find(p => p.id === pressureId);

    let newValue = current + drift;

    // Also apply natural decay toward equilibrium
    if (pressure?.equilibrium !== undefined && pressure?.decayRate) {
      const diff = pressure.equilibrium - current;
      newValue += diff * pressure.decayRate;
    }

    // Clamp to range
    if (pressure) {
      newValue = Math.max(pressure.range.min, Math.min(pressure.range.max, newValue));
    }

    ctx.state.pressures.set(pressureId, newValue);
  }
}

/**
 * Select rules based on era weights
 */
function selectRules<T extends { id: string; weight?: number }>(
  rules: T[],
  weights: Record<string, number>,
  state: SimulationState
): T | null {
  // Filter to rules with positive weight
  const eligible = rules.filter(r => (weights[r.id] ?? 0) > 0);
  if (eligible.length === 0) return null;

  // Calculate total weight
  const weightedRules = eligible.map(r => ({
    rule: r,
    weight: (weights[r.id] ?? 1) * (r.weight ?? 1),
  }));

  const totalWeight = weightedRules.reduce((sum, w) => sum + w.weight, 0);
  let roll = seededRandom(state) * totalWeight;

  for (const { rule, weight } of weightedRules) {
    roll -= weight;
    if (roll <= 0) {
      return rule;
    }
  }

  return weightedRules[weightedRules.length - 1]?.rule ?? null;
}

/**
 * Execute a growth tick
 */
function executeGrowthTick(
  config: EngineConfig,
  state: SimulationState
): RuleExecutionResult[] {
  const ctx = createContext(config, state);
  const eraWeights = config.simulation.eraRuleWeights[state.currentEra];
  const results: RuleExecutionResult[] = [];

  if (!eraWeights) return results;

  // Select and execute generation rules (may fire multiple)
  const maxRules = 3; // Limit rules per tick to prevent runaway
  for (let i = 0; i < maxRules; i++) {
    const rule = selectRules(
      config.simulation.generationRules,
      eraWeights.generationWeights,
      state
    );

    if (!rule) break;

    const result = executeGenerationRule(rule, ctx);
    results.push(result);

    // Stop if max entities reached
    if (state.entities.size >= config.simulation.settings.maxEntities) {
      break;
    }
  }

  return results;
}

/**
 * Execute a simulation tick
 */
function executeSimulationTick(
  config: EngineConfig,
  state: SimulationState
): RuleExecutionResult[] {
  const ctx = createContext(config, state);
  const eraWeights = config.simulation.eraRuleWeights[state.currentEra];
  const results: RuleExecutionResult[] = [];

  if (!eraWeights) return results;

  // Select and execute simulation rules
  const maxRules = 5;
  for (let i = 0; i < maxRules; i++) {
    const rule = selectRules(
      config.simulation.simulationRules,
      eraWeights.simulationWeights,
      state
    );

    if (!rule) break;

    const result = executeSimulationRule(rule, ctx);
    results.push(result);
  }

  return results;
}

// ============================================================================
// MAIN ENGINE
// ============================================================================

/**
 * Run the simulation engine
 */
export function runSimulation(config: EngineConfig): SimulationResult {
  const state = createInitialState(config);
  const eraResults: EraResult[] = [];
  const ratio = config.simulation.settings.growthSimulationRatio;

  for (const era of config.eras) {
    state.currentEra = era.id;
    const eraStartEntities = state.entities.size;
    const eraStartRelationships = state.relationships.size;
    const eraStartOccurrences = state.occurrences.length;

    for (let eraTick = 0; eraTick < era.ticks; eraTick++) {
      state.tick++;

      // Determine phase based on ratio
      // e.g., ratio of 2 means 2 growth ticks per 1 simulation tick
      const isGrowthPhase = eraTick % (ratio + 1) < ratio;
      const phase = isGrowthPhase ? 'growth' : 'simulation';

      let ruleResults: RuleExecutionResult[];

      if (isGrowthPhase) {
        ruleResults = executeGrowthTick(config, state);
      } else {
        ruleResults = executeSimulationTick(config, state);
      }

      // Apply pressure drift
      const ctx = createContext(config, state);
      applyPressureDrift(era.id, ctx);

      // Emit tick result
      const tickResult: TickResult = {
        tick: state.tick,
        era: era.id,
        phase,
        rulesFired: ruleResults,
        totalEntities: state.entities.size,
        totalRelationships: state.relationships.size,
      };

      if (config.onTick) {
        config.onTick(tickResult);
      }
    }

    // Emit era result
    const eraResult: EraResult = {
      eraId: era.id,
      eraName: era.name,
      ticks: era.ticks,
      entitiesCreated: state.entities.size - eraStartEntities,
      relationshipsCreated: state.relationships.size - eraStartRelationships,
      occurrences: state.occurrences.length - eraStartOccurrences,
    };

    eraResults.push(eraResult);

    if (config.onEraComplete) {
      config.onEraComplete(eraResult);
    }
  }

  return {
    state,
    eraResults,
    totalTicks: state.tick,
    totalEntities: state.entities.size,
    totalRelationships: state.relationships.size,
    totalOccurrences: state.occurrences.length,
  };
}

/**
 * Run a single tick (for step-by-step execution)
 */
export function runTick(
  config: EngineConfig,
  state: SimulationState,
  phase: 'growth' | 'simulation'
): TickResult {
  state.tick++;

  let ruleResults: RuleExecutionResult[];

  if (phase === 'growth') {
    ruleResults = executeGrowthTick(config, state);
  } else {
    ruleResults = executeSimulationTick(config, state);
  }

  // Apply pressure drift
  const ctx = createContext(config, state);
  applyPressureDrift(state.currentEra, ctx);

  return {
    tick: state.tick,
    era: state.currentEra,
    phase,
    rulesFired: ruleResults,
    totalEntities: state.entities.size,
    totalRelationships: state.relationships.size,
  };
}

/**
 * Transition to the next era
 */
export function transitionEra(
  config: EngineConfig,
  state: SimulationState
): string | null {
  const currentIndex = config.eras.findIndex(e => e.id === state.currentEra);
  if (currentIndex < 0 || currentIndex >= config.eras.length - 1) {
    return null;
  }

  const nextEra = config.eras[currentIndex + 1];
  state.currentEra = nextEra.id;
  return nextEra.id;
}
