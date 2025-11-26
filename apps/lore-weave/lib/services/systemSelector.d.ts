import { Graph, SimulationSystem } from '../types/engine';
import { DistributionTargets } from '../types/distribution';
/**
 * Distribution-guided system modifier adjustment
 * Weights systems based on what relationships they create and how that affects distribution
 */
export declare class SystemSelector {
    private tracker;
    private targets;
    constructor(targets: DistributionTargets);
    /**
     * Calculate adjusted modifiers for systems based on distribution needs
     * Returns map of system ID -> adjusted modifier
     */
    calculateSystemModifiers(graph: Graph, systems: SimulationSystem[], eraModifiers: Record<string, number>): Record<string, number>;
}
//# sourceMappingURL=systemSelector.d.ts.map