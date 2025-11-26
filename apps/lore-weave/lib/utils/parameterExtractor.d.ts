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
import { TemplateMetadata, SystemMetadata } from '../types/distribution';
type ComponentMetadata = TemplateMetadata | SystemMetadata;
export declare class ParameterExtractor {
    private metadata?;
    constructor(metadata?: ComponentMetadata);
    /**
     * Get a single parameter value with default fallback
     * @param key Parameter key
     * @param defaultValue Default value if parameter not found
     * @returns Parameter value or default
     */
    get<T>(key: string, defaultValue: T): T;
    /**
     * Extract multiple parameters at once using an object of defaults
     * @param defaults Object mapping parameter names to default values
     * @returns Object with all parameter values (extracted or defaulted)
     */
    getAll<T extends Record<string, any>>(defaults: T): T;
    /**
     * Get a parameter with validation
     * @param key Parameter key
     * @param defaultValue Default value
     * @param validator Validation function (throws on invalid)
     * @returns Validated parameter value
     */
    getValidated<T>(key: string, defaultValue: T, validator: (value: T) => boolean): T;
    /**
     * Get a numeric parameter with bounds checking
     * @param key Parameter key
     * @param defaultValue Default value
     * @param min Minimum allowed value
     * @param max Maximum allowed value
     * @returns Bounded numeric value
     */
    getNumber(key: string, defaultValue: number, min?: number, max?: number): number;
    /**
     * Get a boolean parameter
     * @param key Parameter key
     * @param defaultValue Default value
     * @returns Boolean value
     */
    getBoolean(key: string, defaultValue: boolean): boolean;
    /**
     * Get a string parameter
     * @param key Parameter key
     * @param defaultValue Default value
     * @returns String value
     */
    getString(key: string, defaultValue: string): string;
    /**
     * Check if a parameter exists (regardless of value)
     * @param key Parameter key
     * @returns True if parameter is defined
     */
    has(key: string): boolean;
    /**
     * Get all parameter keys
     * @returns Array of all parameter keys
     */
    keys(): string[];
}
/**
 * Helper function to quickly extract parameters from metadata
 * @param metadata Component metadata
 * @param defaults Object mapping parameter names to defaults
 * @returns Extracted parameters
 */
export declare function extractParams<T extends Record<string, any>>(metadata: ComponentMetadata | undefined, defaults: T): T;
export {};
//# sourceMappingURL=parameterExtractor.d.ts.map