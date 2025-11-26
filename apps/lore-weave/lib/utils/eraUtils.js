/**
 * Era Utilities
 *
 * Generic functions for working with Era configurations.
 * These are framework utilities that work with any domain's era definitions.
 */
/**
 * Select the appropriate era based on the current epoch.
 * Distributes epochs evenly across eras.
 */
export function selectEra(epoch, eras, epochsPerEra = 2) {
    const eraIndex = Math.floor(epoch / epochsPerEra);
    return eras[Math.min(eraIndex, eras.length - 1)];
}
/**
 * Get the era-modified weight for a template.
 * Returns baseWeight * era modifier (defaults to 1.0 if not specified).
 */
export function getTemplateWeight(era, templateId, baseWeight = 1.0) {
    const modifier = era.templateWeights[templateId] ?? 1.0;
    return baseWeight * modifier;
}
/**
 * Get the era modifier for a system.
 * Returns baseValue * era modifier (defaults to 1.0 if not specified).
 */
export function getSystemModifier(era, systemId, baseValue = 1.0) {
    const modifier = era.systemModifiers[systemId] ?? 1.0;
    return baseValue * modifier;
}
//# sourceMappingURL=eraUtils.js.map