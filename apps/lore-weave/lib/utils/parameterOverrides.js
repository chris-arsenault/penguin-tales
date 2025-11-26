/**
 * Deep merge utility for nested objects
 */
function deepMerge(target, source) {
    const output = { ...target };
    for (const key in source) {
        if (source[key] !== undefined) {
            if (isObject(target[key]) && isObject(source[key])) {
                // @ts-ignore - we know these are objects
                output[key] = deepMerge(target[key], source[key]);
            }
            else {
                // @ts-ignore
                output[key] = source[key];
            }
        }
    }
    return output;
}
function isObject(item) {
    return item && typeof item === 'object' && !Array.isArray(item);
}
/**
 * Apply parameter overrides to templates
 */
export function applyTemplateOverrides(templates, overrides) {
    if (!overrides.templates)
        return templates;
    return templates.map(template => {
        const override = overrides.templates?.[template.id];
        if (!override || !override.metadata || !template.metadata) {
            return template;
        }
        // Deep merge the override metadata into template metadata
        const mergedMetadata = deepMerge(template.metadata, override.metadata);
        return {
            ...template,
            metadata: mergedMetadata
        };
    });
}
/**
 * Apply parameter overrides to systems
 */
export function applySystemOverrides(systems, overrides) {
    if (!overrides.systems)
        return systems;
    return systems.map(system => {
        const override = overrides.systems?.[system.id];
        if (!override || !override.metadata || !system.metadata) {
            return system;
        }
        // Deep merge the override metadata into system metadata
        const mergedMetadata = deepMerge(system.metadata, override.metadata);
        return {
            ...system,
            metadata: mergedMetadata
        };
    });
}
/**
 * Apply all parameter overrides to templates and systems
 */
export function applyParameterOverrides(templates, systems, overrides) {
    return {
        templates: applyTemplateOverrides(templates, overrides),
        systems: applySystemOverrides(systems, overrides)
    };
}
//# sourceMappingURL=parameterOverrides.js.map