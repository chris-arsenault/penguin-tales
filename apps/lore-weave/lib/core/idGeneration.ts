/**
 * ID Generation Utilities
 *
 * Functions for generating unique identifiers.
 */

// ID generation counter
let idCounter = 1000;

export function generateId(prefix: string): string {
  return `${prefix}_${idCounter++}`;
}

// ID generation for lore records
let loreRecordCounter = 0;

/**
 * Generate unique ID for lore records with timestamp and counter
 */
export function generateLoreId(prefix: string): string {
  return `${prefix}_${Date.now()}_${loreRecordCounter++}`;
}
