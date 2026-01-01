import { SimulationSystem, SystemResult, ComponentPurpose } from '../engine/types';
import { HardState, Relationship } from '../core/worldTypes';
import { WorldRuntime } from '../runtime/worldRuntime';
import { rollProbability } from '../utils';
import {
  createSystemContext,
  evaluateMetric,
  prepareMutation,
  applyOperator,
  selectEntities,
} from '../rules';
import type {
  ComparisonOperator,
  SelectionRule,
  Metric,
  Mutation,
  MutationResult,
  EntityModification,
} from '../rules';

/**
 * Connection Evolution System Factory
 *
 * Creates configurable systems that modify entity/relationship state
 * based on connection metrics. This is a domain-agnostic pattern that
 * can implement:
 * - Prominence evolution (fame/obscurity based on connections)
 * - Alliance formation (create relationships between entities with shared relationships)
 * - Status transitions based on graph topology
 *
 * The factory creates a SimulationSystem from a ConnectionEvolutionConfig.
 */

// =============================================================================
// CONFIGURATION TYPES
// =============================================================================

export type ConditionOperator = ComparisonOperator;

export type ThresholdValue =
  | number
  | 'prominence_scaled';    // (prominenceLevel + 1) * multiplier

export type ActionType = Extract<
  Mutation,
  | { type: 'adjust_prominence' }
  | { type: 'create_relationship' }
  | { type: 'change_status' }
  | { type: 'set_tag' }
>;

export type MetricConfig = Metric;

export interface EvolutionRule {
  /** Condition to check */
  condition: {
    operator: ConditionOperator;
    threshold: ThresholdValue;
    /** Multiplier for prominence_scaled threshold (default: 6) */
    multiplier?: number;
  };
  /** Probability of applying action when condition is met (0-1) */
  probability: number;
  /** Action to take */
  action: ActionType;
  /**
   * For create_relationship: create between matching entities that satisfy condition.
   * If true, pairs entities that both pass the condition.
   * If false/undefined, action applies to entity directly.
   */
  betweenMatching?: boolean;
}

export interface SubtypeBonus {
  subtype: string;
  bonus: number;
}

export interface ConnectionEvolutionConfig {
  /** Unique system identifier */
  id: string;
  /** Human-readable name */
  name: string;
  /** Optional description */
  description?: string;

  /** Selection rule for entities to evaluate */
  selection: SelectionRule;

  /** How to calculate the metric for each entity */
  metric: MetricConfig;

  /** Rules to apply based on metric value */
  rules: EvolutionRule[];

  /** Subtype bonuses added to metric value */
  subtypeBonuses?: SubtypeBonus[];

  /** Pressure changes when system runs and modifies entities */
  pressureChanges?: Record<string, number>;

  /** Throttle: only run on some ticks (0-1, default: 1.0 = every tick) */
  throttleChance?: number;
}

// =============================================================================
// METRIC CALCULATION
// =============================================================================

function calculateMetric(
  entity: HardState,
  config: MetricConfig,
  ctx: ReturnType<typeof createSystemContext>
): number {
  const result = evaluateMetric(config, ctx, entity);
  return result.value;
}

function resolveThreshold(
  threshold: ThresholdValue,
  entity: HardState,
  multiplier: number = 6
): number {
  if (typeof threshold === 'number') {
    return threshold;
  }
  // prominence_scaled: (prominenceLevel + 1) * multiplier
  // entity.prominence is now numeric (0-5), use floor to get level index
  const level = Math.floor(entity.prominence);
  return (level + 1) * multiplier;
}

function mergeMutationResult(
  result: MutationResult,
  modifications: Array<EntityModification & { narrativeGroupId?: string }>,
  relationships: Array<Relationship & { narrativeGroupId?: string }>,
  relationshipsAdjusted: Array<{ kind: string; src: string; dst: string; delta: number; narrativeGroupId?: string }>,
  pressureChanges: Record<string, number>,
  narrativeGroupId?: string
): void {
  if (!result.applied) return;

  if (result.entityModifications.length > 0) {
    for (const mod of result.entityModifications) {
      modifications.push(narrativeGroupId ? { ...mod, narrativeGroupId } : mod);
    }
  }

  if (result.relationshipsCreated.length > 0) {
    for (const rel of result.relationshipsCreated) {
      const relWithGroup = {
        kind: rel.kind,
        src: rel.src,
        dst: rel.dst,
        strength: rel.strength,
        category: rel.category,
        ...(narrativeGroupId ? { narrativeGroupId } : {}),
      };
      relationships.push(relWithGroup);
    }
  }

  if (result.relationshipsAdjusted.length > 0) {
    for (const adj of result.relationshipsAdjusted) {
      relationshipsAdjusted.push(narrativeGroupId ? { ...adj, narrativeGroupId } : adj);
    }
  }

  for (const [pressureId, delta] of Object.entries(result.pressureChanges)) {
    pressureChanges[pressureId] = (pressureChanges[pressureId] || 0) + delta;
  }
}

function evaluateCondition(
  value: number,
  operator: ConditionOperator,
  threshold: number
): boolean {
  return applyOperator(value, operator, threshold);
}

// =============================================================================
// SYSTEM FACTORY
// =============================================================================

/**
 * Create a SimulationSystem from a ConnectionEvolutionConfig
 */
export function createConnectionEvolutionSystem(
  config: ConnectionEvolutionConfig
): SimulationSystem {
  return {
    id: config.id,
    name: config.name,

    apply: (graphView: WorldRuntime, modifier: number = 1.0): SystemResult => {
      // Throttle check
      if (config.throttleChance !== undefined && config.throttleChance < 1.0) {
        if (Math.random() > config.throttleChance) {
          return {
            relationshipsAdded: [],
            entitiesModified: [],
            pressureChanges: {},
            description: `${config.name}: throttled`
          };
        }
      }

      const modifications: Array<EntityModification & { narrativeGroupId?: string }> = [];
      const relationships: Array<Relationship & { narrativeGroupId?: string }> = [];
      const relationshipsAdjusted: Array<{ kind: string; src: string; dst: string; delta: number; narrativeGroupId?: string }> = [];
      const pressureChanges: Record<string, number> = {};

      // Find entities to evaluate
      const ruleCtx = createSystemContext(graphView);
      const entities = selectEntities(config.selection, ruleCtx);

      // For create_relationship with betweenMatching, track matching entities per rule
      const matchingByRule = new Map<number, HardState[]>();

      // Evaluate each entity
      for (const entity of entities) {
        let metricValue = calculateMetric(entity, config.metric, ruleCtx);

        // Apply subtype bonuses
        if (config.subtypeBonuses && entity.subtype) {
          const bonus = config.subtypeBonuses.find(b => b.subtype === entity.subtype);
          if (bonus) {
            metricValue += bonus.bonus;
          }
        }

        // Evaluate each rule
        for (let ruleIdx = 0; ruleIdx < config.rules.length; ruleIdx++) {
          const rule = config.rules[ruleIdx];
          const threshold = resolveThreshold(
            rule.condition.threshold,
            entity,
            rule.condition.multiplier
          );

          if (!evaluateCondition(metricValue, rule.condition.operator, threshold)) {
            continue;
          }

          // Condition met - check probability
          if (!rollProbability(rule.probability, modifier)) {
            continue;
          }

          const entityCtx = { ...ruleCtx, self: entity };

          if (rule.action.type === 'create_relationship' && rule.betweenMatching) {
            // betweenMatching relationships are a unified narrative (coalition formation)
            // so we don't split by entity - they'll be grouped together
            if (!matchingByRule.has(ruleIdx)) {
              matchingByRule.set(ruleIdx, []);
            }
            matchingByRule.get(ruleIdx)!.push(entity);
          } else {
            // Individual actions (prominence, status, tags) are separate narratives per entity
            // Each entity's rise/fall is its own story
            const result = prepareMutation(rule.action as Mutation, entityCtx);
            mergeMutationResult(result, modifications, relationships, relationshipsAdjusted, pressureChanges, entity.id);
          }
        }
      }

      // Create relationships between matching entities (for betweenMatching rules)
      // NOTE: No narrativeGroupId here - coalition/alliance formation is ONE unified narrative
      // "Renowned figures formed alliances" not "X allied, Y allied, Z allied"
      for (const [ruleIdx, matchingEntities] of matchingByRule.entries()) {
        const rule = config.rules[ruleIdx];
        if (rule.action.type !== 'create_relationship') continue;

        // Create relationships between all pairs of matching entities
        for (let i = 0; i < matchingEntities.length; i++) {
          for (let j = i + 1; j < matchingEntities.length; j++) {
            const src = matchingEntities[i];
            const dst = matchingEntities[j];

            // Check if relationship already exists
            if (graphView.hasRelationship(src.id, dst.id, rule.action.kind)) {
              continue;
            }

            const pairCtx = {
              ...ruleCtx,
              entities: { ...(ruleCtx.entities ?? {}), member: src, member2: dst },
            };
            const result = prepareMutation(rule.action as Mutation, pairCtx);
            mergeMutationResult(result, modifications, relationships, relationshipsAdjusted, pressureChanges);
          }
        }
      }

      if (modifications.length > 0 || relationships.length > 0 || relationshipsAdjusted.length > 0) {
        for (const [pressureId, delta] of Object.entries(config.pressureChanges ?? {})) {
          pressureChanges[pressureId] = (pressureChanges[pressureId] || 0) + delta;
        }
      }

      return {
        relationshipsAdded: relationships,
        relationshipsAdjusted,
        entitiesModified: modifications as SystemResult['entitiesModified'],
        pressureChanges,
        description: `${config.name}: ${modifications.length} modified, ${relationships.length} relationships`
      };
    }
  };
}

