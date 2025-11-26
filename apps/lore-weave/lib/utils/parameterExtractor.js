/**
 * Parameter Extractor Utility
 *
 * Simplifies extraction of parameters from template/system metadata.
 * Eliminates repetitive optional chaining and null coalescing patterns.
 *
 * Usage:
 * ```typescript
 * const params = new ParameterExtractor(template.metadata);
 * const throttleChance = params.get('throttleChance', 0.3);
 *
 * // Or extract multiple at once:
 * const { throttleChance, baseChance, maxAttempts } = params.getAll({
 *   throttleChance: 0.3,
 *   baseChance: 0.2,
 *   maxAttempts: 5
 * });
 * ```
 */
export class ParameterExtractor {
    metadata;
    constructor(metadata) {
        this.metadata = metadata;
    }
    /**
     * Get a single parameter value with default fallback
     * @param key Parameter key
     * @param defaultValue Default value if parameter not found
     * @returns Parameter value or default
     */
    get(key, defaultValue) {
        return this.metadata?.parameters?.[key]?.value ?? defaultValue;
    }
    /**
     * Extract multiple parameters at once using an object of defaults
     * @param defaults Object mapping parameter names to default values
     * @returns Object with all parameter values (extracted or defaulted)
     */
    getAll(defaults) {
        const result = { ...defaults };
        for (const [key, defaultValue] of Object.entries(defaults)) {
            result[key] = this.get(key, defaultValue);
        }
        return result;
    }
    /**
     * Get a parameter with validation
     * @param key Parameter key
     * @param defaultValue Default value
     * @param validator Validation function (throws on invalid)
     * @returns Validated parameter value
     */
    getValidated(key, defaultValue, validator) {
        const value = this.get(key, defaultValue);
        if (!validator(value)) {
            throw new Error(`Parameter '${key}' failed validation: got ${JSON.stringify(value)}`);
        }
        return value;
    }
    /**
     * Get a numeric parameter with bounds checking
     * @param key Parameter key
     * @param defaultValue Default value
     * @param min Minimum allowed value
     * @param max Maximum allowed value
     * @returns Bounded numeric value
     */
    getNumber(key, defaultValue, min, max) {
        let value = this.get(key, defaultValue);
        if (min !== undefined && value < min) {
            value = min;
        }
        if (max !== undefined && value > max) {
            value = max;
        }
        return value;
    }
    /**
     * Get a boolean parameter
     * @param key Parameter key
     * @param defaultValue Default value
     * @returns Boolean value
     */
    getBoolean(key, defaultValue) {
        return this.get(key, defaultValue);
    }
    /**
     * Get a string parameter
     * @param key Parameter key
     * @param defaultValue Default value
     * @returns String value
     */
    getString(key, defaultValue) {
        return this.get(key, defaultValue);
    }
    /**
     * Check if a parameter exists (regardless of value)
     * @param key Parameter key
     * @returns True if parameter is defined
     */
    has(key) {
        return this.metadata?.parameters?.[key] !== undefined;
    }
    /**
     * Get all parameter keys
     * @returns Array of all parameter keys
     */
    keys() {
        return Object.keys(this.metadata?.parameters || {});
    }
}
/**
 * Helper function to quickly extract parameters from metadata
 * @param metadata Component metadata
 * @param defaults Object mapping parameter names to defaults
 * @returns Extracted parameters
 */
export function extractParams(metadata, defaults) {
    const extractor = new ParameterExtractor(metadata);
    return extractor.getAll(defaults);
}
//# sourceMappingURL=parameterExtractor.js.map