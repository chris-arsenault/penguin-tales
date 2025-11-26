import { Graph } from '../types/engine';
import { DistributionTargets, DistributionState, DeviationScore } from '../types/distribution';
/**
 * Tracks distribution metrics and calculates deviations from targets
 */
export declare class DistributionTracker {
    private targets;
    constructor(targets: DistributionTargets);
    /**
     * Measure current state of the world
     */
    measureState(graph: Graph): DistributionState;
    /**
     * Calculate deviation from targets
     */
    calculateDeviation(state: DistributionState, eraName: string): DeviationScore;
    /**
     * Calculate graph connectivity metrics
     */
    private calculateGraphMetrics;
    /**
     * Merge era overrides with global targets
     */
    private mergeTargets;
}
//# sourceMappingURL=distributionTracker.d.ts.map