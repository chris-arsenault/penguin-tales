/**
 * Shared types for the rules library.
 *
 * This module contains common types used across all rule categories
 * (conditions, metrics, mutations, filters, selections).
 */

/**
 * Canonical comparison operators.
 * Replaces 'above'/'below' with standard symbols.
 */
export type ComparisonOperator = '>' | '<' | '>=' | '<=' | '==' | '!=';

/**
 * Canonical direction types.
 * Replaces 'out'/'in'/'any' with 'src'/'dst'/'both'.
 */
export type Direction = 'src' | 'dst' | 'both';

/**
 * Normalize direction aliases to canonical form.
 *
 * @param dir - Direction in any supported format
 * @returns Canonical direction
 */
export function normalizeDirection(
  dir: 'out' | 'in' | 'any' | 'src' | 'dst' | 'both' | undefined
): Direction {
  switch (dir) {
    case 'out':
      return 'src';
    case 'in':
      return 'dst';
    case 'any':
      return 'both';
    case 'src':
    case 'dst':
    case 'both':
      return dir;
    default:
      return 'both';
  }
}

/**
 * Normalize comparison operator aliases to canonical form.
 *
 * @param op - Operator in any supported format
 * @returns Canonical operator
 */
export function normalizeOperator(
  op: 'above' | 'below' | '>' | '<' | '>=' | '<=' | '==' | '!=' | undefined
): ComparisonOperator {
  switch (op) {
    case 'above':
      return '>';
    case 'below':
      return '<';
    case '>':
    case '<':
    case '>=':
    case '<=':
    case '==':
    case '!=':
      return op;
    default:
      return '>=';
  }
}

/**
 * Apply a comparison operator.
 *
 * @param a - Left operand
 * @param op - Comparison operator
 * @param b - Right operand
 * @returns Result of comparison
 */
export function applyOperator(a: number, op: ComparisonOperator, b: number): boolean {
  switch (op) {
    case '>':
      return a > b;
    case '<':
      return a < b;
    case '>=':
      return a >= b;
    case '<=':
      return a <= b;
    case '==':
      return a === b;
    case '!=':
      return a !== b;
  }
}

/**
 * Prominence levels in order from lowest to highest.
 */
export const PROMINENCE_ORDER = [
  'forgotten',
  'marginal',
  'recognized',
  'renowned',
  'mythic',
] as const;

export type Prominence = (typeof PROMINENCE_ORDER)[number];

/**
 * Get the numeric index of a prominence level.
 */
export function prominenceIndex(prominence: string): number {
  const idx = PROMINENCE_ORDER.indexOf(prominence as Prominence);
  return idx >= 0 ? idx : 2; // Default to 'recognized'
}

/**
 * Compare two prominence levels.
 *
 * @returns negative if a < b, 0 if equal, positive if a > b
 */
export function compareProminence(a: string, b: string): number {
  return prominenceIndex(a) - prominenceIndex(b);
}
