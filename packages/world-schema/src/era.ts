/**
 * Era Types
 *
 * Eras define the temporal structure of world history.
 * They are owned by Cosmographer as part of world topology.
 */

/**
 * Definition of an era in world history
 */
export interface EraDefinition {
  /** Unique identifier */
  id: string;
  /** Display name (e.g., "The Primordial Age") */
  name: string;
  /** Human-readable description */
  description?: string;
  /** Position in sequence (0-indexed) */
  order: number;
  /** Duration in simulation ticks */
  ticks: number;
  /** Narrative themes for this era (used in description generation) */
  themes: string[];
  /** Hex color for timeline visualization */
  color?: string;
  /**
   * Pressure biases for this era.
   * These describe the "feel" of the era but mechanics are in simulation config.
   * Key = pressure ID, value = bias (positive = elevated, negative = suppressed)
   */
  pressureBiases?: Record<string, number>;
}
