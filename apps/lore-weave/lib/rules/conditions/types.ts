/**
 * Unified Condition Types
 *
 * Consolidates condition types from:
 * - ApplicabilityRule (templateInterpreter)
 * - VariantCondition (templateInterpreter)
 * - TriggerCondition (thresholdTrigger)
 * - TransitionCondition (eraTransition)
 *
 * All conditions use `type` as the discriminant field.
 */

import type { ComparisonOperator, Direction, ProminenceLabel } from '../types';
import type { GraphPathAssertion } from '../../engine/declarativeTypes';

/**
 * Unified Condition type.
 * All conditions return boolean and can be composed.
 */
export type Condition =
  // Pressure conditions
  | PressureCondition
  | PressureCompareCondition
  | PressureAnyAboveCondition

  // Entity count conditions
  | EntityCountCondition

  // Relationship conditions
  | RelationshipCountCondition
  | RelationshipExistsCondition

  // Tag conditions
  | TagExistsCondition
  | TagAbsentCondition

  // Status/prominence conditions
  | StatusCondition
  | ProminenceCondition

  // Time conditions
  | TimeElapsedCondition

  // Era conditions
  | EraMatchCondition

  // Rate limiting conditions
  | CooldownElapsedCondition
  | CreationsPerEpochCondition

  // Probability conditions
  | RandomChanceCondition

  // Graph path conditions
  | GraphPathCondition

  // Entity existence
  | EntityExistsCondition
  | EntityHasRelationshipCondition

  // Composite conditions
  | AndCondition
  | OrCondition
  | AlwaysCondition;

// =============================================================================
// PRESSURE CONDITIONS
// =============================================================================

/**
 * Check if a pressure is within a range.
 * Replaces: pressure_threshold, pressure, pressure_above, pressure_below
 */
export interface PressureCondition {
  type: 'pressure';
  pressureId: string;
  min?: number;
  max?: number;
}

/**
 * Compare two pressures.
 * Replaces: pressure_compare
 */
export interface PressureCompareCondition {
  type: 'pressure_compare';
  pressureA: string;
  pressureB: string;
  operator?: ComparisonOperator; // Default: '>'
}

/**
 * Check if any of the given pressures exceeds a threshold.
 * Replaces: pressure_any_above
 */
export interface PressureAnyAboveCondition {
  type: 'pressure_any_above';
  pressureIds: string[];
  threshold: number;
}

// =============================================================================
// ENTITY COUNT CONDITIONS
// =============================================================================

/**
 * Check entity count against min/max bounds.
 * Replaces: entity_count_min, entity_count_max, entity_count
 */
export interface EntityCountCondition {
  type: 'entity_count';
  kind: string;
  subtype?: string;
  status?: string;
  min?: number;
  max?: number;
  overshootFactor?: number; // For max checks, default 1.5
}

// =============================================================================
// RELATIONSHIP CONDITIONS
// =============================================================================

/**
 * Check relationship count.
 * Replaces: relationship_count, connection_count
 */
export interface RelationshipCountCondition {
  type: 'relationship_count';
  relationshipKind?: string;
  direction?: Direction;
  min?: number;
  max?: number;
}

/**
 * Check if a specific relationship exists.
 * Replaces: relationship_exists
 */
export interface RelationshipExistsCondition {
  type: 'relationship_exists';
  relationshipKind: string;
  with?: string; // Entity reference
  direction?: Direction;
  targetKind?: string;
  targetSubtype?: string;
  targetStatus?: string;
}

// =============================================================================
// TAG CONDITIONS
// =============================================================================

/**
 * Check if a tag exists.
 * Replaces: tag_exists, has_tag
 */
export interface TagExistsCondition {
  type: 'tag_exists';
  /** Optional entity reference (defaults to ctx.self) */
  entity?: string;
  tag: string;
  value?: string | boolean;
}

/**
 * Check if a tag is absent.
 * Replaces: tag_absent, lacks_tag
 */
export interface TagAbsentCondition {
  type: 'tag_absent';
  /** Optional entity reference (defaults to ctx.self) */
  entity?: string;
  tag: string;
}

// =============================================================================
// STATUS/PROMINENCE CONDITIONS
// =============================================================================

/**
 * Check entity status.
 * Replaces: entity_status, has_status
 */
export interface StatusCondition {
  type: 'status';
  status: string;
  not?: boolean; // If true, check that status does NOT match
}

/**
 * Check entity prominence level.
 * Replaces: has_prominence
 */
export interface ProminenceCondition {
  type: 'prominence';
  min?: ProminenceLabel; // Minimum prominence level
  max?: ProminenceLabel; // Maximum prominence level
}

// =============================================================================
// TIME CONDITIONS
// =============================================================================

/**
 * Check time elapsed since entity creation or update.
 * Replaces: time_since_update, time, cooldown_elapsed
 */
export interface TimeElapsedCondition {
  type: 'time_elapsed';
  minTicks: number;
  since?: 'created' | 'updated'; // Default: 'updated'
}

/**
 * Check if cooldown has elapsed since last template application.
 */
export interface CooldownElapsedCondition {
  type: 'cooldown_elapsed';
  cooldownTicks: number;
}

/**
 * Check creations per epoch limit.
 */
export interface CreationsPerEpochCondition {
  type: 'creations_per_epoch';
  maxPerEpoch: number;
}

// =============================================================================
// ERA CONDITIONS
// =============================================================================

/**
 * Check if current era matches.
 * Replaces: era_match
 */
export interface EraMatchCondition {
  type: 'era_match';
  eras: string[];
}

// =============================================================================
// PROBABILITY CONDITIONS
// =============================================================================

/**
 * Random chance condition.
 * Replaces: random_chance, random
 */
export interface RandomChanceCondition {
  type: 'random_chance';
  chance: number; // 0-1
}

// =============================================================================
// GRAPH PATH CONDITIONS
// =============================================================================

/**
 * Check graph path assertion.
 * Replaces: graph_path (in filters, but can also be used as condition)
 */
export interface GraphPathCondition {
  type: 'graph_path';
  assert: GraphPathAssertion;
}

// =============================================================================
// ENTITY EXISTENCE CONDITIONS
// =============================================================================

/**
 * Check if an entity reference resolves.
 * Replaces: entity_exists
 */
export interface EntityExistsCondition {
  type: 'entity_exists';
  entity: string; // Entity reference
}

/**
 * Check if an entity has a relationship.
 * Replaces: entity_has_relationship
 */
export interface EntityHasRelationshipCondition {
  type: 'entity_has_relationship';
  entity: string;
  relationshipKind: string;
  direction?: Direction;
}

// =============================================================================
// COMPOSITE CONDITIONS
// =============================================================================

/**
 * All conditions must pass.
 */
export interface AndCondition {
  type: 'and';
  conditions: Condition[];
}

/**
 * At least one condition must pass.
 */
export interface OrCondition {
  type: 'or';
  conditions: Condition[];
}

/**
 * Always passes.
 */
export interface AlwaysCondition {
  type: 'always';
}

// =============================================================================
// RESULT TYPE
// =============================================================================

/**
 * Result of condition evaluation.
 * Includes diagnostic information for debugging.
 */
export interface ConditionResult {
  /** Whether the condition passed */
  passed: boolean;

  /** Human-readable explanation */
  diagnostic: string;

  /** Machine-readable details for debugging */
  details: Record<string, unknown>;
}
