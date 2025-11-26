/**
 * Validation Orchestrator
 *
 * Orchestrates framework validation and displays results.
 * Extracted from WorldEngine constructor for Single Responsibility.
 */
import { EngineConfig } from '../types/engine';
/**
 * Validation result with formatted output
 */
export interface ValidationResult {
    hasErrors: boolean;
    hasWarnings: boolean;
    errors: string[];
    warnings: string[];
}
/**
 * Orchestrates validation and console output
 */
export declare class ValidationOrchestrator {
    /**
     * Run validation and display results
     * @throws Error if validation fails
     */
    static validateAndDisplay(config: EngineConfig): ValidationResult;
    /**
     * Display service initialization status
     */
    static displayServiceStatus(feedbackLoops: any[], metaEntityConfigs: any[], hasTargetSelector: boolean): void;
}
//# sourceMappingURL=validationOrchestrator.d.ts.map