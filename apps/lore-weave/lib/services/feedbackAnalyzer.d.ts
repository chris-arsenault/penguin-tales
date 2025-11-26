/**
 * Feedback Analyzer Service
 *
 * Validates that declared feedback loops are functioning correctly.
 * Detects broken loops and suggests corrections.
 */
import { Graph, EngineConfig } from '../types/engine';
import { PopulationMetrics } from './populationTracker';
export interface FeedbackLoop {
    id: string;
    type: 'negative' | 'positive';
    source: string;
    mechanism: string[];
    target: string;
    strength: number;
    delay: number;
    active: boolean;
    lastValidated: number;
}
export interface ValidationResult {
    loop: FeedbackLoop;
    valid: boolean;
    correlation: number;
    expectedCorrelation: number;
    reason?: string;
    recommendation?: string;
}
export declare class FeedbackAnalyzer {
    private loops;
    private validationHistory;
    private config?;
    constructor(loops: FeedbackLoop[], config?: EngineConfig);
    /**
     * Validate all feedback loops
     */
    validateAll(metrics: PopulationMetrics, graph: Graph): ValidationResult[];
    private validateLoop;
    /**
     * Parse metric path (e.g., "npc:hero.count" or "conflict.value")
     */
    private parseMetricPath;
    /**
     * Calculate Pearson correlation between two time series with optional delay
     */
    private calculateCorrelation;
    /**
     * Get broken loops
     */
    getBrokenLoops(results: ValidationResult[]): ValidationResult[];
    /**
     * Get loop by ID
     */
    getLoop(id: string): FeedbackLoop | undefined;
    /**
     * Update loop coefficient (for auto-tuning)
     */
    updateLoopStrength(id: string, newStrength: number): void;
    /**
     * ENFORCEMENT 4: Generate detailed diagnostics for broken feedback loops
     * Checks component contracts to identify why loops are not functioning
     */
    generateDetailedDiagnostics(brokenLoop: ValidationResult): string[];
    /**
     * Print detailed diagnostics for all broken loops
     */
    printDetailedDiagnostics(results: ValidationResult[]): void;
}
//# sourceMappingURL=feedbackAnalyzer.d.ts.map