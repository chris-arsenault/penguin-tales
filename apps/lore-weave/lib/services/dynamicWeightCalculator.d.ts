/**
 * Dynamic Weight Calculator Service
 *
 * Adjusts template weights based on population deviation from targets.
 * Implements homeostatic control by suppressing template weights when entity populations
 * are above target and boosting weights when below target.
 */
import { GrowthTemplate } from '../types/engine';
import { PopulationMetrics } from './populationTracker';
export interface WeightAdjustment {
    templateId: string;
    baseWeight: number;
    adjustedWeight: number;
    adjustmentFactor: number;
    reason: string;
}
export declare class DynamicWeightCalculator {
    private deviationThreshold;
    private maxSuppressionFactor;
    private maxBoostFactor;
    /**
     * Calculate adjusted weight for a template based on population metrics
     */
    calculateWeight(template: GrowthTemplate, baseWeight: number, metrics: PopulationMetrics): WeightAdjustment;
    /**
     * Calculate weights for all templates
     */
    calculateAllWeights(templates: GrowthTemplate[], baseWeights: Map<string, number>, metrics: PopulationMetrics): Map<string, WeightAdjustment>;
    /**
     * Get templates that are being suppressed
     */
    getSuppressedTemplates(adjustments: Map<string, WeightAdjustment>): WeightAdjustment[];
    /**
     * Get templates that are being boosted
     */
    getBoostedTemplates(adjustments: Map<string, WeightAdjustment>): WeightAdjustment[];
    /**
     * Configure adjustment parameters
     */
    configure(options: {
        deviationThreshold?: number;
        maxSuppressionFactor?: number;
        maxBoostFactor?: number;
    }): void;
}
//# sourceMappingURL=dynamicWeightCalculator.d.ts.map