/**
 * Semantic Axis System
 *
 * Defines meaningful coordinate axes for each entity kind's map.
 * Tags are mapped to positions on these axes based on semantic weights,
 * enabling automatic coordinate derivation from entity tags.
 *
 * Axes can be linked to pressures for feedback loop integration.
 */

/**
 * Definition of a single semantic axis.
 */
export interface SemanticAxis {
  /** Axis identifier (e.g., 'source', 'scope', 'alignment') */
  name: string;

  /** Concept at position 0 (e.g., 'physical', 'local', 'hostile') */
  lowConcept: string;

  /** Concept at position 100 (e.g., 'mystical', 'universal', 'friendly') */
  highConcept: string;

  /** Optional pressure this axis correlates with */
  relatedPressure?: string;

  /**
   * How position affects pressure (-1 to 1).
   * Positive: high position increases pressure
   * Negative: high position decreases pressure
   */
  pressureCorrelation?: number;
}

/**
 * Complete axis configuration for an entity kind.
 */
export interface EntityKindAxes {
  /** Entity kind this configuration applies to */
  entityKind: string;

  /** X-axis definition */
  x: SemanticAxis;

  /** Y-axis definition */
  y: SemanticAxis;

  /** Z-axis definition */
  z: SemanticAxis;
}

/**
 * Semantic weight for a tag on a specific axis.
 * Value 0-100 indicates position on the axis.
 */
export interface TagSemanticWeight {
  /** Axis name this weight applies to */
  axis: string;

  /** Position on the axis (0-100) */
  value: number;
}

/**
 * Extended tag metadata with semantic weights.
 */
export interface TagSemanticWeights {
  /** Tag name */
  tag: string;

  /** Weights per entity kind and axis */
  weights: {
    [entityKind: string]: {
      [axisName: string]: number;  // 0-100
    };
  };
}

/**
 * Result of semantic encoding.
 */
export interface SemanticEncodingResult {
  /** Encoded coordinates */
  coordinates: {
    x: number;
    y: number;
    z: number;
  };

  /** Tags that contributed to encoding */
  contributingTags: string[];

  /** Tags that had no weights configured (defaulted to 50) */
  unconfiguredTags: string[];

  /** Whether encoding used any configured weights */
  hasConfiguredWeights: boolean;
}

/**
 * Configuration for the semantic encoder.
 */
export interface SemanticEncoderConfig {
  /** Axis definitions per entity kind */
  axes: EntityKindAxes[];

  /** Tag weights */
  tagWeights: TagSemanticWeights[];

  /** Whether to warn about unconfigured tags */
  warnOnUnconfiguredTags: boolean;
}
