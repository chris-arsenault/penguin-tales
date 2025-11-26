import { Graph, GrowthTemplate } from '../types/engine';
import { DistributionTargets, DistributionState, DeviationScore } from '../types/distribution';
/**
 * Statistically-guided template selection
 * Adjusts template probabilities based on distribution targets
 */
export declare class TemplateSelector {
    private tracker;
    private targets;
    private templates;
    constructor(targets: DistributionTargets, templates: GrowthTemplate[]);
    /**
     * Select templates with statistical guidance
     * Returns weighted templates adjusted based on deviation from targets
     */
    selectTemplates(graph: Graph, availableTemplates: GrowthTemplate[], eraWeights: Record<string, number>, count: number): GrowthTemplate[];
    /**
     * Calculate adjusted weights based on distribution targets
     */
    private calculateGuidedWeights;
    /**
     * Weighted random selection
     */
    private weightedRandom;
    /**
     * Find template by ID
     */
    private findTemplateById;
    /**
     * Get current distribution state (for monitoring)
     */
    getState(graph: Graph): DistributionState;
    /**
     * Get current deviation (for monitoring)
     */
    getDeviation(graph: Graph): DeviationScore;
}
//# sourceMappingURL=templateSelector.d.ts.map