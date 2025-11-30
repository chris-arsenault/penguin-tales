/**
 * Condition Evaluator
 *
 * Evaluates rule conditions against the current simulation state.
 */

import type { Condition, EntityQuery } from '@canonry/world-schema';
import type { SimulationState, RuntimeEntity, ExecutionContext } from './types.js';

// ============================================================================
// ENTITY QUERY
// ============================================================================

/**
 * Find entities matching a query
 */
export function queryEntities(
  state: SimulationState,
  query: EntityQuery
): RuntimeEntity[] {
  const results: RuntimeEntity[] = [];

  for (const entity of state.entities.values()) {
    if (matchesQuery(entity, query, state)) {
      results.push(entity);
    }
  }

  return results;
}

/**
 * Check if an entity matches a query
 */
function matchesQuery(
  entity: RuntimeEntity,
  query: EntityQuery,
  state: SimulationState
): boolean {
  // Kind match
  if (query.kind && entity.kind !== query.kind) {
    return false;
  }

  // Subtype match
  if (query.subtype && entity.subtype !== query.subtype) {
    return false;
  }

  // Status match
  if (query.status && entity.status !== query.status) {
    return false;
  }

  // Culture match
  if (query.culture && entity.cultureId !== query.culture) {
    return false;
  }

  // Tag match
  if (query.hasTag && !entity.tags.includes(query.hasTag)) {
    return false;
  }

  // Relationship checks
  if (query.hasRelationship) {
    const hasRel = hasRelationship(
      entity.id,
      query.hasRelationship.kind,
      query.hasRelationship.direction,
      state
    );
    if (!hasRel) {
      return false;
    }
  }

  if (query.notHasRelationship) {
    const hasRel = hasRelationship(
      entity.id,
      query.notHasRelationship.kind,
      query.notHasRelationship.direction,
      state
    );
    if (hasRel) {
      return false;
    }
  }

  return true;
}

/**
 * Check if an entity has a relationship of a specific kind
 */
function hasRelationship(
  entityId: string,
  kind: string,
  direction: 'incoming' | 'outgoing',
  state: SimulationState
): boolean {
  for (const rel of state.relationships.values()) {
    if (rel.archived) continue;
    if (rel.kind !== kind) continue;

    if (direction === 'outgoing' && rel.srcId === entityId) {
      return true;
    }
    if (direction === 'incoming' && rel.dstId === entityId) {
      return true;
    }
  }

  return false;
}

// ============================================================================
// CONDITION EVALUATION
// ============================================================================

/**
 * Evaluate a single condition
 */
export function evaluateCondition(
  condition: Condition,
  ctx: ExecutionContext
): boolean {
  let result: boolean;

  switch (condition.type) {
    case 'entity_count_below':
      result = evaluateEntityCountBelow(condition.params, ctx);
      break;
    case 'entity_count_above':
      result = evaluateEntityCountAbove(condition.params, ctx);
      break;
    case 'entity_count_range':
      result = evaluateEntityCountRange(condition.params, ctx);
      break;
    case 'entity_exists':
      result = evaluateEntityExists(condition.params, ctx);
      break;
    case 'pressure_above':
      result = evaluatePressureAbove(condition.params, ctx);
      break;
    case 'pressure_below':
      result = evaluatePressureBelow(condition.params, ctx);
      break;
    case 'pressure_range':
      result = evaluatePressureRange(condition.params, ctx);
      break;
    case 'relationship_exists':
      result = evaluateRelationshipExists(condition.params, ctx);
      break;
    case 'entity_has_relationship':
      result = evaluateEntityHasRelationship(condition.params, ctx);
      break;
    case 'current_era':
      result = evaluateCurrentEra(condition.params, ctx);
      break;
    case 'tick_range':
      result = evaluateTickRange(condition.params, ctx);
      break;
    case 'random_chance':
      result = evaluateRandomChance(condition.params, ctx);
      break;
    default:
      console.warn(`Unknown condition type: ${condition.type}`);
      result = false;
  }

  // Apply negation if specified
  return condition.negate ? !result : result;
}

/**
 * Evaluate all conditions (AND logic)
 */
export function evaluateConditions(
  conditions: Condition[],
  ctx: ExecutionContext
): boolean {
  for (const condition of conditions) {
    if (!evaluateCondition(condition, ctx)) {
      return false;
    }
  }
  return true;
}

// ============================================================================
// CONDITION IMPLEMENTATIONS
// ============================================================================

function evaluateEntityCountBelow(
  params: Record<string, unknown>,
  ctx: ExecutionContext
): boolean {
  const kind = params.kind as string;
  const subtype = params.subtype as string | undefined;
  const count = params.count as number;

  const query: EntityQuery = { kind };
  if (subtype) query.subtype = subtype;

  const entities = queryEntities(ctx.state, query);
  return entities.length < count;
}

function evaluateEntityCountAbove(
  params: Record<string, unknown>,
  ctx: ExecutionContext
): boolean {
  const kind = params.kind as string;
  const subtype = params.subtype as string | undefined;
  const count = params.count as number;

  const query: EntityQuery = { kind };
  if (subtype) query.subtype = subtype;

  const entities = queryEntities(ctx.state, query);
  return entities.length > count;
}

function evaluateEntityCountRange(
  params: Record<string, unknown>,
  ctx: ExecutionContext
): boolean {
  const kind = params.kind as string;
  const subtype = params.subtype as string | undefined;
  const min = params.min as number;
  const max = params.max as number;

  const query: EntityQuery = { kind };
  if (subtype) query.subtype = subtype;

  const entities = queryEntities(ctx.state, query);
  return entities.length >= min && entities.length <= max;
}

function evaluateEntityExists(
  params: Record<string, unknown>,
  ctx: ExecutionContext
): boolean {
  const query: EntityQuery = {
    kind: params.kind as string,
  };
  if (params.subtype) query.subtype = params.subtype as string;
  if (params.status) query.status = params.status as string;
  if (params.culture) query.culture = params.culture as string;
  if (params.hasTag) query.hasTag = params.hasTag as string;

  const entities = queryEntities(ctx.state, query);
  return entities.length > 0;
}

function evaluatePressureAbove(
  params: Record<string, unknown>,
  ctx: ExecutionContext
): boolean {
  const pressureId = params.pressure as string;
  const threshold = params.threshold as number;

  const value = ctx.state.pressures.get(pressureId) ?? 0;
  return value > threshold;
}

function evaluatePressureBelow(
  params: Record<string, unknown>,
  ctx: ExecutionContext
): boolean {
  const pressureId = params.pressure as string;
  const threshold = params.threshold as number;

  const value = ctx.state.pressures.get(pressureId) ?? 0;
  return value < threshold;
}

function evaluatePressureRange(
  params: Record<string, unknown>,
  ctx: ExecutionContext
): boolean {
  const pressureId = params.pressure as string;
  const min = params.min as number;
  const max = params.max as number;

  const value = ctx.state.pressures.get(pressureId) ?? 0;
  return value >= min && value <= max;
}

function evaluateRelationshipExists(
  params: Record<string, unknown>,
  ctx: ExecutionContext
): boolean {
  const kind = params.kind as string;

  for (const rel of ctx.state.relationships.values()) {
    if (!rel.archived && rel.kind === kind) {
      return true;
    }
  }
  return false;
}

function evaluateEntityHasRelationship(
  params: Record<string, unknown>,
  ctx: ExecutionContext
): boolean {
  const entityQuery: EntityQuery = {
    kind: params.entityKind as string,
  };
  if (params.entitySubtype) entityQuery.subtype = params.entitySubtype as string;

  const relationshipKind = params.relationshipKind as string;
  const direction = (params.direction as 'incoming' | 'outgoing') || 'outgoing';

  const entities = queryEntities(ctx.state, entityQuery);
  for (const entity of entities) {
    if (hasRelationship(entity.id, relationshipKind, direction, ctx.state)) {
      return true;
    }
  }
  return false;
}

function evaluateCurrentEra(
  params: Record<string, unknown>,
  ctx: ExecutionContext
): boolean {
  const eraId = params.era as string;
  return ctx.state.currentEra === eraId;
}

function evaluateTickRange(
  params: Record<string, unknown>,
  ctx: ExecutionContext
): boolean {
  const min = params.min as number | undefined;
  const max = params.max as number | undefined;

  if (min !== undefined && ctx.state.tick < min) return false;
  if (max !== undefined && ctx.state.tick > max) return false;
  return true;
}

function evaluateRandomChance(
  params: Record<string, unknown>,
  ctx: ExecutionContext
): boolean {
  const probability = params.probability as number;
  const random = seededRandom(ctx.state);
  return random < probability;
}

// ============================================================================
// RANDOM NUMBER GENERATION
// ============================================================================

/**
 * Generate a seeded random number (0-1) and update state
 */
export function seededRandom(state: SimulationState): number {
  // Simple LCG PRNG
  const a = 1664525;
  const c = 1013904223;
  const m = 2 ** 32;

  state.randomState = (a * state.randomState + c) % m;
  return state.randomState / m;
}

/**
 * Generate a random integer in range [min, max]
 */
export function randomInt(state: SimulationState, min: number, max: number): number {
  return Math.floor(seededRandom(state) * (max - min + 1)) + min;
}

/**
 * Pick a random element from an array
 */
export function randomPick<T>(state: SimulationState, array: T[]): T | undefined {
  if (array.length === 0) return undefined;
  const index = randomInt(state, 0, array.length - 1);
  return array[index];
}

/**
 * Pick multiple random elements from an array (without replacement)
 */
export function randomPickN<T>(state: SimulationState, array: T[], n: number): T[] {
  if (n >= array.length) return [...array];

  const result: T[] = [];
  const copy = [...array];

  for (let i = 0; i < n; i++) {
    const index = randomInt(state, 0, copy.length - 1);
    result.push(copy[index]);
    copy.splice(index, 1);
  }

  return result;
}
