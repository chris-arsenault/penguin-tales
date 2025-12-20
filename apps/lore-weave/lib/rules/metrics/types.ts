/**
 * Unified Metric Types
 *
 * Consolidates metric/factor types from:
 * - FeedbackFactor (declarativePressureTypes)
 * - SimpleCountFactor (declarativePressureTypes)
 * - MetricConfig (connectionEvolution)
 *
 * All metrics use `type` as the discriminant field.
 */

import type { Direction } from '../types';

/**
 * Unified Metric type.
 * All metrics return a number.
 */
export type Metric =
  // Count metrics
  | EntityCountMetric
  | RelationshipCountMetric
  | TagCountMetric
  | TotalEntitiesMetric
  | ConstantMetric
  | ConnectionCountMetric

  // Ratio metrics
  | RatioMetric
  | StatusRatioMetric
  | CrossCultureRatioMetric

  // Evolution metrics
  | SharedRelationshipMetric
  | CatalyzedEventsMetric

  // Prominence metrics
  | ProminenceMultiplierMetric

  // Decay/falloff metrics
  | DecayRateMetric
  | FalloffMetric;

// =============================================================================
// COUNT METRICS
// =============================================================================

/**
 * Count entities matching criteria.
 */
export interface EntityCountMetric {
  type: 'entity_count';
  kind: string;
  subtype?: string;
  status?: string;
  coefficient?: number;
  cap?: number;
}

/**
 * Count relationships matching criteria.
 */
export interface RelationshipCountMetric {
  type: 'relationship_count';
  relationshipKinds?: string[];
  direction?: Direction;
  minStrength?: number;
  coefficient?: number;
  cap?: number;
}

/**
 * Count entities with specific tags.
 */
export interface TagCountMetric {
  type: 'tag_count';
  tags: string[];
  coefficient?: number;
  cap?: number;
}

/**
 * Total entity count in the graph.
 */
export interface TotalEntitiesMetric {
  type: 'total_entities';
  coefficient?: number;
  cap?: number;
}

/**
 * Constant value.
 */
export interface ConstantMetric {
  type: 'constant';
  value: number;
  coefficient?: number;
}

/**
 * Count all connections (relationships) involving an entity.
 * For per-entity metrics in connectionEvolution.
 */
export interface ConnectionCountMetric {
  type: 'connection_count';
  relationshipKinds?: string[];
  direction?: Direction;
  minStrength?: number;
  coefficient?: number;
  cap?: number;
}

// =============================================================================
// RATIO METRICS
// =============================================================================

/**
 * Simple count factor for use in ratios (no coefficient/cap).
 */
export type SimpleCountMetric =
  | { type: 'entity_count'; kind: string; subtype?: string; status?: string }
  | { type: 'relationship_count'; relationshipKinds?: string[] }
  | { type: 'tag_count'; tags: string[] }
  | { type: 'total_entities' }
  | { type: 'constant'; value: number };

/**
 * Calculate ratio of two counts.
 */
export interface RatioMetric {
  type: 'ratio';
  numerator: SimpleCountMetric;
  denominator: SimpleCountMetric;
  /** Value to use if denominator is 0 (default: 0) */
  fallbackValue?: number;
  coefficient?: number;
  cap?: number;
}

/**
 * Count entities with alive vs dead status.
 */
export interface StatusRatioMetric {
  type: 'status_ratio';
  kind: string;
  subtype?: string;
  aliveStatus: string;
  coefficient?: number;
  cap?: number;
}

/**
 * Calculate ratio of cross-culture relationships to total relationships.
 */
export interface CrossCultureRatioMetric {
  type: 'cross_culture_ratio';
  relationshipKinds: string[];
  coefficient?: number;
  cap?: number;
}

// =============================================================================
// EVOLUTION METRICS
// =============================================================================

/**
 * Count entities sharing a specific relationship.
 * (e.g., common enemies)
 */
export interface SharedRelationshipMetric {
  type: 'shared_relationship';
  sharedRelationshipKind: string;
  sharedDirection?: 'src' | 'dst';
  /** Minimum relationship strength to count */
  minStrength?: number;
  coefficient?: number;
  cap?: number;
}

/**
 * Number of catalyst events for an entity.
 */
export interface CatalyzedEventsMetric {
  type: 'catalyzed_events';
  coefficient?: number;
  cap?: number;
}

// =============================================================================
// PROMINENCE METRICS
// =============================================================================

/**
 * Prominence multiplier.
 * Returns a multiplier based on entity prominence level.
 */
export interface ProminenceMultiplierMetric {
  type: 'prominence_multiplier';
  /**
   * Multiplier mode:
   * - 'success_chance': For action success probability (0.6 - 1.5)
   * - 'action_rate': For action selection probability (0.3 - 2.0)
   */
  mode?: 'success_chance' | 'action_rate';
}

// =============================================================================
// DECAY/FALLOFF METRICS
// =============================================================================

/**
 * Decay rate value.
 */
export interface DecayRateMetric {
  type: 'decay_rate';
  rate: 'none' | 'slow' | 'medium' | 'fast';
}

/**
 * Distance falloff calculation.
 */
export interface FalloffMetric {
  type: 'falloff';
  falloffType: 'absolute' | 'none' | 'linear' | 'inverse_square' | 'sqrt' | 'exponential';
  distance: number;
  maxDistance?: number;
}

// =============================================================================
// RESULT TYPE
// =============================================================================

/**
 * Result of metric evaluation.
 * Includes diagnostic information for debugging.
 */
export interface MetricResult {
  /** The computed metric value */
  value: number;

  /** Human-readable explanation */
  diagnostic: string;

  /** Machine-readable details for debugging */
  details: Record<string, unknown>;
}
