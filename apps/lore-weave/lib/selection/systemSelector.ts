import { Graph, SimulationSystem } from '../engine/types';
import {
  DistributionTargets,
  DistributionState,
  DeviationScore,
} from '../statistics/types';
import { DistributionTracker } from '../statistics/distributionTracker';

/**
 * Distribution-guided system modifier adjustment
 * Uses base modifiers from era configuration - metadata-based adjustments removed
 */
export class SystemSelector {
  private tracker: DistributionTracker;
  private targets: DistributionTargets;

  constructor(targets: DistributionTargets) {
    this.targets = targets;
    this.tracker = new DistributionTracker(targets);
  }

  /**
   * Calculate modifiers for systems based on era configuration
   * Returns map of system ID -> modifier
   */
  public calculateSystemModifiers(
    graph: Graph,
    systems: SimulationSystem[],
    eraModifiers: Record<string, number>
  ): Record<string, number> {
    const adjustedModifiers: Record<string, number> = {};

    systems.forEach((system) => {
      const baseModifier = eraModifiers[system.id] ?? 1.0;

      // Clamp to reasonable bounds (0.2x to 2.0x)
      const adjustedModifier = Math.max(0.2, Math.min(2.0, baseModifier));

      adjustedModifiers[system.id] = adjustedModifier;
    });

    return adjustedModifiers;
  }

  /**
   * Get current distribution state (for monitoring)
   */
  public getState(graph: Graph): DistributionState {
    return this.tracker.measureState(graph);
  }

  /**
   * Get current deviation (for monitoring)
   */
  public getDeviation(graph: Graph): DeviationScore {
    const state = this.tracker.measureState(graph);
    return this.tracker.calculateDeviation(state, graph.currentEra.name);
  }
}
