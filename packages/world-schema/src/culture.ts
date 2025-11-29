/**
 * Culture Types
 *
 * A culture represents a distinct group within the world with its own
 * naming conventions, visual identity, and semantic placement biases.
 */

import type { CultureNamingData } from './naming.js';

/**
 * Axis biases for a single entity kind (x, y, z each 0-100)
 */
export interface AxisBias {
  x: number;
  y: number;
  z: number;
}

/**
 * Visual data for a culture (Cosmographer)
 */
export interface CultureVisualData {
  /** Axis biases per entity kind (key = entityKind.id) */
  axisBiases: Record<string, AxisBias>;
  /** Home regions per entity kind (key = entityKind.id, value = region IDs) */
  homeRegions: Record<string, string[]>;
}

/**
 * Complete definition of a culture
 */
export interface CultureDefinition {
  /** Unique identifier */
  id: string;
  /** Display name */
  name: string;
  /** Human-readable description */
  description?: string;

  // === Lore-Weave: World Context ===
  /** Associated location (homeland) if any */
  homeland?: string;

  // === Cosmographer: Visual Identity ===
  /** Hex color for visualization */
  color?: string;
  /** Axis biases per entity kind (key = entityKind.id) */
  axisBiases?: Record<string, AxisBias>;
  /** Home regions per entity kind (key = entityKind.id, value = region IDs) */
  homeRegions?: Record<string, string[]>;

  // === Name-Forge: Naming Resources ===
  /** Naming configuration (domains, lexemes, grammars, profiles) */
  naming?: CultureNamingData;
}
