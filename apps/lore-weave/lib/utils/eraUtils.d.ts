/**
 * Era Utilities
 *
 * Generic functions for working with Era configurations.
 * These are framework utilities that work with any domain's era definitions.
 */
import { Era } from '../types/engine';
/**
 * Select the appropriate era based on the current epoch.
 * Distributes epochs evenly across eras.
 */
export declare function selectEra(epoch: number, eras: Era[], epochsPerEra?: number): Era;
/**
 * Get the era-modified weight for a template.
 * Returns baseWeight * era modifier (defaults to 1.0 if not specified).
 */
export declare function getTemplateWeight(era: Era, templateId: string, baseWeight?: number): number;
/**
 * Get the era modifier for a system.
 * Returns baseValue * era modifier (defaults to 1.0 if not specified).
 */
export declare function getSystemModifier(era: Era, systemId: string, baseValue?: number): number;
//# sourceMappingURL=eraUtils.d.ts.map