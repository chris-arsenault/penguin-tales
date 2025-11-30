/**
 * Declarative Pressure Types
 *
 * Defines the JSON-serializable structure for pressure definitions.
 * These can be created/edited via UI and loaded dynamically.
 */

import { PressureContract } from './types';

// =============================================================================
// FEEDBACK FACTOR TYPES
// =============================================================================

/**
 * Base interface for all feedback factors
 */
export interface BaseFeedbackFactor {
  /** Coefficient to multiply the result by */
  coefficient: number;
  /** Optional cap on this factor's contribution */
  cap?: number;
}

/**
 * Count entities matching criteria
 */
export interface EntityCountFactor extends BaseFeedbackFactor {
  type: 'entity_count';
  kind: string;
  subtype?: string;
  status?: string;
}

/**
 * Count relationships matching criteria
 */
export interface RelationshipCountFactor extends BaseFeedbackFactor {
  type: 'relationship_count';
  relationshipKinds: string[];
}

/**
 * Count entities with specific tags
 */
export interface TagCountFactor extends BaseFeedbackFactor {
  type: 'tag_count';
  tags: string[];
}

/**
 * Calculate ratio of two counts
 */
export interface RatioFactor extends BaseFeedbackFactor {
  type: 'ratio';
  numerator: SimpleCountFactor;
  denominator: SimpleCountFactor;
  /** Value to use if denominator is 0 (default: 0) */
  fallbackValue?: number;
}

/**
 * Simple count factor for use in ratios (no coefficient/cap)
 */
export type SimpleCountFactor =
  | { type: 'entity_count'; kind: string; subtype?: string; status?: string }
  | { type: 'relationship_count'; relationshipKinds: string[] }
  | { type: 'tag_count'; tags: string[] }
  | { type: 'total_entities' }
  | { type: 'constant'; value: number };

/**
 * Count entities with alive vs dead status (for leadership calculations)
 */
export interface StatusRatioFactor extends BaseFeedbackFactor {
  type: 'status_ratio';
  kind: string;
  subtype?: string;
  aliveStatus: string;
}

/**
 * Calculate ratio of cross-culture relationships to total relationships
 * Cross-culture = relationships where src and dst have different cultures
 */
export interface CrossCultureRatioFactor extends BaseFeedbackFactor {
  type: 'cross_culture_ratio';
  relationshipKinds: string[];
}

/**
 * Union of all feedback factor types
 */
export type FeedbackFactor =
  | EntityCountFactor
  | RelationshipCountFactor
  | TagCountFactor
  | RatioFactor
  | StatusRatioFactor
  | CrossCultureRatioFactor;

// =============================================================================
// DECLARATIVE PRESSURE DEFINITION
// =============================================================================

/**
 * Declarative pressure definition - JSON serializable
 */
export interface DeclarativePressure {
  id: string;
  name: string;

  /** Initial value (0-100) */
  initialValue: number;

  /** Natural decay per tick */
  decay: number;

  /** Growth calculation */
  growth: {
    /** Base growth added each tick (default: 0) */
    baseGrowth?: number;

    /** Factors that increase pressure */
    positiveFeedback: FeedbackFactor[];

    /** Factors that decrease pressure */
    negativeFeedback: FeedbackFactor[];

    /** Cap the final growth value (default: no cap) */
    maxGrowth?: number;
  };

  /** Documentation contract (optional, for UI display) */
  contract?: PressureContract;
}

// =============================================================================
// PRESSURES FILE STRUCTURE
// =============================================================================

/**
 * Shape of the pressures.json file
 */
export interface PressuresFile {
  $schema?: string;
  pressures: DeclarativePressure[];
}
