/**
 * Unified Condition Evaluator
 *
 * Single dispatch point for all condition types.
 * Replaces multiple implementations across:
 * - evaluateApplicabilityRule (templateInterpreter)
 * - evaluateVariantCondition (templateInterpreter)
 * - evaluateCondition (thresholdTrigger)
 * - checkTransitionConditions (eraTransition)
 */

import { HardState } from '../../core/worldTypes';
import { hasTag, getTagValue } from '../../utils';
import { evaluateGraphPath } from '../graphPath';
import type { RuleContext } from '../context';
import {
  applyOperator,
  normalizeDirection,
  normalizeOperator,
  prominenceIndex,
} from '../types';
import type { Direction } from '../types';
import type {
  Condition,
  ConditionResult,
  PressureCondition,
  PressureCompareCondition,
  PressureAnyAboveCondition,
  EntityCountCondition,
  RelationshipCountCondition,
  RelationshipExistsCondition,
  TagExistsCondition,
  TagAbsentCondition,
  StatusCondition,
  ProminenceCondition,
  TimeElapsedCondition,
  CooldownElapsedCondition,
  CreationsPerEpochCondition,
  EraMatchCondition,
  RandomChanceCondition,
  GraphPathCondition,
  EntityExistsCondition,
  EntityHasRelationshipCondition,
  AndCondition,
  OrCondition,
} from './types';

// Re-export types
export * from './types';

/**
 * Evaluate a condition against the current context.
 *
 * @param condition - The condition to evaluate
 * @param ctx - The rule context
 * @param entity - Optional entity for per-entity conditions (uses ctx.self if not provided)
 * @returns ConditionResult with passed status and diagnostic info
 */
export function evaluateCondition(
  condition: Condition,
  ctx: RuleContext,
  entity?: HardState
): ConditionResult {
  // Use provided entity or context's self
  const self = entity ?? ctx.self;

  switch (condition.type) {
    // =========================================================================
    // PRESSURE CONDITIONS
    // =========================================================================

    case 'pressure':
      return evaluatePressure(condition, ctx);

    case 'pressure_compare':
      return evaluatePressureCompare(condition, ctx);

    case 'pressure_any_above':
      return evaluatePressureAnyAbove(condition, ctx);

    // =========================================================================
    // ENTITY COUNT CONDITIONS
    // =========================================================================

    case 'entity_count':
      return evaluateEntityCount(condition, ctx);

    // =========================================================================
    // RELATIONSHIP CONDITIONS
    // =========================================================================

    case 'relationship_count':
      return evaluateRelationshipCount(condition, ctx, self);

    case 'relationship_exists':
      return evaluateRelationshipExists(condition, ctx, self);

    // =========================================================================
    // TAG CONDITIONS
    // =========================================================================

    case 'tag_exists':
      return evaluateTagExists(condition, ctx, self);

    case 'tag_absent':
      return evaluateTagAbsent(condition, ctx, self);

    // =========================================================================
    // STATUS/PROMINENCE CONDITIONS
    // =========================================================================

    case 'status':
      return evaluateStatus(condition, self);

    case 'prominence':
      return evaluateProminence(condition, self);

    // =========================================================================
    // TIME CONDITIONS
    // =========================================================================

    case 'time_elapsed':
      return evaluateTimeElapsed(condition, ctx, self);

    case 'cooldown_elapsed':
      return evaluateCooldownElapsed(condition, ctx);

    case 'creations_per_epoch':
      return evaluateCreationsPerEpoch(condition, ctx);

    // =========================================================================
    // ERA CONDITIONS
    // =========================================================================

    case 'era_match':
      return evaluateEraMatch(condition, ctx);

    // =========================================================================
    // PROBABILITY CONDITIONS
    // =========================================================================

    case 'random_chance':
      return evaluateRandomChance(condition);

    // =========================================================================
    // GRAPH PATH CONDITIONS
    // =========================================================================

    case 'graph_path':
      return evaluateGraphPathCondition(condition, ctx, self);

    // =========================================================================
    // ENTITY EXISTENCE CONDITIONS
    // =========================================================================

    case 'entity_exists':
      return evaluateEntityExists(condition, ctx);

    case 'entity_has_relationship':
      return evaluateEntityHasRelationship(condition, ctx);

    // =========================================================================
    // COMPOSITE CONDITIONS
    // =========================================================================

    case 'and':
      return evaluateAnd(condition, ctx, self);

    case 'or':
      return evaluateOr(condition, ctx, self);

    case 'always':
      return { passed: true, diagnostic: 'always', details: {} };

    default:
      return {
        passed: false,
        diagnostic: `unknown condition type: ${(condition as Condition).type}`,
        details: { condition },
      };
  }
}

// =============================================================================
// PRESSURE EVALUATORS
// =============================================================================

function evaluatePressure(
  condition: PressureCondition,
  ctx: RuleContext
): ConditionResult {
  const value = ctx.graph.getPressure(condition.pressureId);
  const minOk = condition.min === undefined || value >= condition.min;
  const maxOk = condition.max === undefined || value <= condition.max;
  const passed = minOk && maxOk;

  const range = `${condition.min ?? '-∞'} to ${condition.max ?? '∞'}`;
  return {
    passed,
    diagnostic: `pressure ${condition.pressureId}=${value.toFixed(1)} (${range})`,
    details: {
      pressureId: condition.pressureId,
      value,
      min: condition.min,
      max: condition.max,
    },
  };
}

function evaluatePressureCompare(
  condition: PressureCompareCondition,
  ctx: RuleContext
): ConditionResult {
  const valueA = ctx.graph.getPressure(condition.pressureA);
  const valueB = ctx.graph.getPressure(condition.pressureB);
  const op = normalizeOperator(condition.operator);
  const passed = applyOperator(valueA, op, valueB);

  return {
    passed,
    diagnostic: `${condition.pressureA}(${valueA.toFixed(1)}) ${op} ${condition.pressureB}(${valueB.toFixed(1)})`,
    details: {
      pressureA: condition.pressureA,
      pressureB: condition.pressureB,
      valueA,
      valueB,
      operator: op,
    },
  };
}

function evaluatePressureAnyAbove(
  condition: PressureAnyAboveCondition,
  ctx: RuleContext
): ConditionResult {
  const values: Record<string, number> = {};
  let passed = false;

  for (const id of condition.pressureIds) {
    const value = ctx.graph.getPressure(id);
    values[id] = value;
    if (value > condition.threshold) {
      passed = true;
    }
  }

  return {
    passed,
    diagnostic: `any pressure > ${condition.threshold}: ${passed}`,
    details: { pressureIds: condition.pressureIds, values, threshold: condition.threshold },
  };
}

// =============================================================================
// ENTITY COUNT EVALUATORS
// =============================================================================

function evaluateEntityCount(
  condition: EntityCountCondition,
  ctx: RuleContext
): ConditionResult {
  let entities = ctx.graph.findEntities({ kind: condition.kind });
  if (condition.subtype) {
    entities = entities.filter((e) => e.subtype === condition.subtype);
  }
  if (condition.status) {
    entities = entities.filter((e) => e.status === condition.status);
  }

  const count = entities.length;
  const minOk = condition.min === undefined || count >= condition.min;

  // Apply overshoot factor for max check
  const effectiveMax =
    condition.max !== undefined
      ? Math.floor(condition.max * (condition.overshootFactor ?? 1.5))
      : undefined;
  const maxOk = effectiveMax === undefined || count < effectiveMax;

  const passed = minOk && maxOk;

  const desc = `${condition.kind}${condition.subtype ? ':' + condition.subtype : ''}`;
  return {
    passed,
    diagnostic: `${desc} count=${count} (${condition.min ?? 0} to ${effectiveMax ?? '∞'})`,
    details: {
      kind: condition.kind,
      subtype: condition.subtype,
      status: condition.status,
      count,
      min: condition.min,
      max: condition.max,
      effectiveMax,
    },
  };
}

// =============================================================================
// RELATIONSHIP EVALUATORS
// =============================================================================

function evaluateRelationshipCount(
  condition: RelationshipCountCondition,
  ctx: RuleContext,
  self?: HardState
): ConditionResult {
  if (!self) {
    return { passed: false, diagnostic: 'no entity for relationship count', details: {} };
  }

  const direction = normalizeDirection(condition.direction);
  let count = 0;

  // Use graph relationships as the single source of truth
  const allRelationships = ctx.graph.getAllRelationships();
  for (const link of allRelationships) {
    if (condition.relationshipKind && link.kind !== condition.relationshipKind) {
      continue;
    }

    // Check if entity is involved in this relationship
    let entityInvolved = false;
    if (direction === 'both') {
      entityInvolved = link.src === self.id || link.dst === self.id;
    } else if (direction === 'src') {
      entityInvolved = link.src === self.id;
    } else {
      entityInvolved = link.dst === self.id;
    }

    if (entityInvolved) {
      count++;
    }
  }

  const minOk = condition.min === undefined || count >= condition.min;
  const maxOk = condition.max === undefined || count <= condition.max;
  const passed = minOk && maxOk;

  return {
    passed,
    diagnostic: `relationship count=${count} (${condition.min ?? 0} to ${condition.max ?? '∞'})`,
    details: {
      relationshipKind: condition.relationshipKind,
      direction,
      count,
      min: condition.min,
      max: condition.max,
    },
  };
}

function evaluateRelationshipExists(
  condition: RelationshipExistsCondition,
  ctx: RuleContext,
  self?: HardState
): ConditionResult {
  if (!self) {
    return { passed: false, diagnostic: 'no entity for relationship exists', details: {} };
  }

  const direction = normalizeDirection(condition.direction);

  // Resolve 'with' entity if provided
  let withEntityId: string | undefined;
  if (condition.with) {
    const withEntity = resolveEntityRef(condition.with, ctx, self);
    withEntityId = withEntity?.id;
  }

  // Use graph relationships as the single source of truth
  const allRelationships = ctx.graph.getAllRelationships();
  const passed = allRelationships.some((link) => {
    if (link.kind !== condition.relationshipKind) return false;

    // Check direction and entity involvement
    let entityMatches = false;
    if (direction === 'both') {
      entityMatches = link.src === self.id || link.dst === self.id;
    } else if (direction === 'src') {
      entityMatches = link.src === self.id;
    } else {
      entityMatches = link.dst === self.id;
    }

    if (!entityMatches) return false;

    // Check 'with' entity
    if (withEntityId) {
      const otherId = link.src === self.id ? link.dst : link.src;
      if (otherId !== withEntityId) return false;
    }

    // Check target kind/subtype/status
    if (condition.targetKind || condition.targetSubtype || condition.targetStatus) {
      const otherId = link.src === self.id ? link.dst : link.src;
      const other = ctx.graph.getEntity(otherId);
      if (!other) return false;
      if (condition.targetKind && other.kind !== condition.targetKind) return false;
      if (condition.targetSubtype && other.subtype !== condition.targetSubtype) return false;
      if (condition.targetStatus && other.status !== condition.targetStatus) return false;
    }

    return true;
  });

  return {
    passed,
    diagnostic: `relationship ${condition.relationshipKind} exists: ${passed}`,
    details: {
      relationshipKind: condition.relationshipKind,
      direction,
      with: condition.with,
      withEntityId,
    },
  };
}

// =============================================================================
// TAG EVALUATORS
// =============================================================================

function evaluateTagExists(
  condition: TagExistsCondition,
  ctx: RuleContext,
  self?: HardState
): ConditionResult {
  const entity = resolveEntityRef(condition.entity, ctx, self);

  if (!entity) {
    return {
      passed: false,
      diagnostic: 'no entity for tag check',
      details: { entityRef: condition.entity },
    };
  }

  const has = hasTag(entity.tags, condition.tag);
  let passed = has;

  if (has && condition.value !== undefined) {
    const actualValue = getTagValue(entity.tags, condition.tag);
    passed = actualValue === condition.value;
  }

  return {
    passed,
    diagnostic: `tag '${condition.tag}' ${passed ? 'exists' : 'missing'}${condition.value !== undefined ? ` (value=${condition.value})` : ''}`,
    details: {
      tag: condition.tag,
      value: condition.value,
      hasTag: has,
      entityRef: condition.entity,
      entityId: entity.id,
    },
  };
}

function resolveEntityRef(
  ref: string | undefined,
  ctx: RuleContext,
  self?: HardState
): HardState | undefined {
  if (!ref) return self;

  if (ref === '$self') {
    return self;
  }

  if (ref.startsWith('$')) {
    const name = ref.slice(1);
    const bound = ctx.entities?.[name];
    if (bound) return bound;
  }

  return ctx.resolver.resolveEntity(ref);
}

function evaluateTagAbsent(
  condition: TagAbsentCondition,
  ctx: RuleContext,
  self?: HardState
): ConditionResult {
  const entity = resolveEntityRef(condition.entity, ctx, self);

  if (!entity) {
    return {
      passed: true,
      diagnostic: 'no entity (tag absent trivially true)',
      details: { entityRef: condition.entity },
    };
  }

  const has = hasTag(entity.tags, condition.tag);
  const passed = !has;

  return {
    passed,
    diagnostic: `tag '${condition.tag}' ${passed ? 'absent' : 'present'}`,
    details: { tag: condition.tag, hasTag: has, entityRef: condition.entity, entityId: entity.id },
  };
}

// =============================================================================
// STATUS/PROMINENCE EVALUATORS
// =============================================================================

function evaluateStatus(
  condition: StatusCondition,
  self?: HardState
): ConditionResult {
  if (!self) {
    return { passed: false, diagnostic: 'no entity for status check', details: {} };
  }

  const matches = self.status === condition.status;
  const passed = condition.not ? !matches : matches;

  return {
    passed,
    diagnostic: `status ${condition.not ? '!=' : '=='} ${condition.status}: ${passed}`,
    details: { expectedStatus: condition.status, actualStatus: self.status, not: condition.not },
  };
}

function evaluateProminence(
  condition: ProminenceCondition,
  self?: HardState
): ConditionResult {
  if (!self) {
    return { passed: false, diagnostic: 'no entity for prominence check', details: {} };
  }

  const idx = prominenceIndex(self.prominence);
  const minIdx = condition.min ? prominenceIndex(condition.min) : 0;
  const maxIdx = condition.max ? prominenceIndex(condition.max) : 4;

  const passed = idx >= minIdx && idx <= maxIdx;

  return {
    passed,
    diagnostic: `prominence ${self.prominence} in [${condition.min ?? 'forgotten'}, ${condition.max ?? 'mythic'}]: ${passed}`,
    details: {
      prominence: self.prominence,
      prominenceIndex: idx,
      min: condition.min,
      max: condition.max,
    },
  };
}

// =============================================================================
// TIME EVALUATORS
// =============================================================================

function evaluateTimeElapsed(
  condition: TimeElapsedCondition,
  ctx: RuleContext,
  self?: HardState
): ConditionResult {
  if (!self) {
    return { passed: false, diagnostic: 'no entity for time check', details: {} };
  }

  const since = condition.since ?? 'updated';
  const timestamp = since === 'created' ? self.createdAt : self.updatedAt;
  const elapsed = ctx.tick - timestamp;
  const passed = elapsed >= condition.minTicks;

  return {
    passed,
    diagnostic: `time since ${since}=${elapsed} ticks (need ${condition.minTicks})`,
    details: { since, timestamp, elapsed, minTicks: condition.minTicks },
  };
}

function evaluateCooldownElapsed(
  condition: CooldownElapsedCondition,
  ctx: RuleContext
): ConditionResult {
  const rateLimitState = ctx.graph.rateLimitState;
  const lastTick = rateLimitState?.lastCreationTick ?? 0;
  const elapsed = ctx.tick - lastTick;
  const passed = elapsed >= condition.cooldownTicks;

  return {
    passed,
    diagnostic: `cooldown elapsed=${elapsed} ticks (need ${condition.cooldownTicks})`,
    details: { lastCreationTick: lastTick, elapsed, cooldownTicks: condition.cooldownTicks },
  };
}

function evaluateCreationsPerEpoch(
  condition: CreationsPerEpochCondition,
  ctx: RuleContext
): ConditionResult {
  const rateLimitState = ctx.graph.rateLimitState;
  const count = rateLimitState?.creationsThisEpoch ?? 0;
  const passed = count < condition.maxPerEpoch;

  return {
    passed,
    diagnostic: `creations this epoch=${count} (max ${condition.maxPerEpoch})`,
    details: { creationsThisEpoch: count, maxPerEpoch: condition.maxPerEpoch },
  };
}

// =============================================================================
// ERA EVALUATORS
// =============================================================================

function evaluateEraMatch(
  condition: EraMatchCondition,
  ctx: RuleContext
): ConditionResult {
  const currentEraId = ctx.graph.currentEra?.id ?? '';
  const passed = condition.eras.includes(currentEraId);

  return {
    passed,
    diagnostic: `era ${currentEraId} in [${condition.eras.join(', ')}]: ${passed}`,
    details: { currentEra: currentEraId, allowedEras: condition.eras },
  };
}

// =============================================================================
// PROBABILITY EVALUATORS
// =============================================================================

function evaluateRandomChance(condition: RandomChanceCondition): ConditionResult {
  const roll = Math.random();
  const passed = roll < condition.chance;

  return {
    passed,
    diagnostic: `random ${(roll * 100).toFixed(1)}% < ${(condition.chance * 100).toFixed(1)}%`,
    details: { roll, chance: condition.chance },
  };
}

// =============================================================================
// GRAPH PATH EVALUATORS
// =============================================================================

function evaluateGraphPathCondition(
  condition: GraphPathCondition,
  ctx: RuleContext,
  self?: HardState
): ConditionResult {
  if (!self) {
    return { passed: false, diagnostic: 'no entity for graph path', details: {} };
  }

  const passed = evaluateGraphPath(self, condition.assert, ctx.resolver);

  return {
    passed,
    diagnostic: `graph path ${condition.assert.check}: ${passed}`,
    details: { assertion: condition.assert },
  };
}

// =============================================================================
// ENTITY EXISTENCE EVALUATORS
// =============================================================================

function evaluateEntityExists(
  condition: EntityExistsCondition,
  ctx: RuleContext
): ConditionResult {
  const entity = resolveEntityRef(condition.entity, ctx);
  const passed = entity !== undefined;

  return {
    passed,
    diagnostic: `entity ${condition.entity} exists: ${passed}`,
    details: { entityRef: condition.entity, entityId: entity?.id },
  };
}

function evaluateEntityHasRelationship(
  condition: EntityHasRelationshipCondition,
  ctx: RuleContext
): ConditionResult {
  const entity = resolveEntityRef(condition.entity, ctx);
  if (!entity) {
    return {
      passed: false,
      diagnostic: `entity ${condition.entity} not found`,
      details: { entityRef: condition.entity },
    };
  }

  const direction = normalizeDirection(condition.direction);
  const passed = ctx.graph.getAllRelationships().some((link) => {
    if (link.kind !== condition.relationshipKind) return false;
    if (direction === 'both') {
      return link.src === entity.id || link.dst === entity.id;
    }
    if (direction === 'src') {
      return link.src === entity.id;
    }
    return link.dst === entity.id;
  });

  return {
    passed,
    diagnostic: `entity ${condition.entity} has ${condition.relationshipKind}: ${passed}`,
    details: {
      entityRef: condition.entity,
      entityId: entity.id,
      relationshipKind: condition.relationshipKind,
      direction,
    },
  };
}

// =============================================================================
// COMPOSITE EVALUATORS
// =============================================================================

function evaluateAnd(
  condition: AndCondition,
  ctx: RuleContext,
  self?: HardState
): ConditionResult {
  const results = condition.conditions.map((c) => evaluateCondition(c, ctx, self));
  const passed = results.every((r) => r.passed);

  return {
    passed,
    diagnostic: `and(${results.map((r) => (r.passed ? 'T' : 'F')).join(',')})`,
    details: { results },
  };
}

function evaluateOr(
  condition: OrCondition,
  ctx: RuleContext,
  self?: HardState
): ConditionResult {
  const results = condition.conditions.map((c) => evaluateCondition(c, ctx, self));
  const passed = results.some((r) => r.passed);

  return {
    passed,
    diagnostic: `or(${results.map((r) => (r.passed ? 'T' : 'F')).join(',')})`,
    details: { results },
  };
}
