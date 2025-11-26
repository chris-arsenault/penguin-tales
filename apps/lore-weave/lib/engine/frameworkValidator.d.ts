/**
 * Framework Validator
 *
 * Validates that the framework configuration is internally consistent and can
 * achieve its intended emergent properties (narrative depth, statistical distributions).
 *
 * Runs at startup to catch configuration errors before generation begins.
 */
import { EngineConfig } from '../types/engine';
export interface ValidationResult {
    valid: boolean;
    errors: string[];
    warnings: string[];
}
export declare class FrameworkValidator {
    private config;
    constructor(config: EngineConfig);
    /**
     * Run all validations and return results
     */
    validate(): ValidationResult;
    /**
     * Validate Coverage
     *
     * Ensures:
     * - Every entity kind has at least one creator
     * - Every pressure has at least one source and one sink
     * - All referenced components exist
     */
    private validateCoverage;
    /**
     * Validate Equilibrium
     *
     * For each pressure, calculates predicted equilibrium and compares to declared range.
     * This helps catch configuration errors where pressures won't reach expected values.
     */
    private validateEquilibrium;
    /**
     * Validate Achievability
     *
     * For each entity kind, verifies that the target count is achievable
     * given the number and frequency of creators.
     */
    private validateAchievability;
    /**
     * Validate Contracts
     *
     * Validates that component contracts are consistent:
     * - Purpose matches component type
     * - Affects declarations are valid
     * - EnabledBy references exist
     */
    private validateContracts;
    /**
     * Check if a component exists (template, system, or pressure)
     */
    private componentExists;
    /**
     * Check if an entity kind exists in the domain schema
     */
    private entityKindExists;
}
//# sourceMappingURL=frameworkValidator.d.ts.map