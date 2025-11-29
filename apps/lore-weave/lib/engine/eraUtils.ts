/**
 * Era Utilities
 *
 * Generic functions for working with Era configurations.
 * These are framework utilities that work with any domain's era definitions.
 */

import { Era } from '../engine/types';

/**
 * Select the appropriate era based on the current epoch.
 * Distributes epochs evenly across eras.
 */
export function selectEra(epoch: number, eras: Era[], epochsPerEra: number = 2): Era {
  const eraIndex = Math.floor(epoch / epochsPerEra);
  return eras[Math.min(eraIndex, eras.length - 1)];
}

/**
 * Get the era-modified weight for a template.
 * Returns baseWeight * era modifier (defaults to 1.0 if not specified).
 */
export function getTemplateWeight(
  era: Era,
  templateId: string,
  baseWeight: number = 1.0
): number {
  const modifier = era.templateWeights[templateId] ?? 1.0;
  return baseWeight * modifier;
}

/**
 * Get the era modifier for a system.
 * Returns baseValue * era modifier (defaults to 1.0 if not specified).
 */
export function getSystemModifier(
  era: Era,
  systemId: string,
  baseValue: number = 1.0
): number {
  const modifier = era.systemModifiers[systemId] ?? 1.0;
  return baseValue * modifier;
}
