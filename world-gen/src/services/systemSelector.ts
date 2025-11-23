import { Graph, SimulationSystem } from '../types/engine';
import {
  DistributionTargets,
  DistributionState,
  DeviationScore,
} from '../types/distribution';
import { DistributionTracker } from './distributionTracker';

/**
 * Distribution-guided system modifier adjustment
 * Weights systems based on what relationships they create and how that affects distribution
 */
export class SystemSelector {
  private tracker: DistributionTracker;
  private targets: DistributionTargets;

  constructor(targets: DistributionTargets) {
    this.targets = targets;
    this.tracker = new DistributionTracker(targets);
  }

  /**
   * Calculate adjusted modifiers for systems based on distribution needs
   * Returns map of system ID -> adjusted modifier
   */
  public calculateSystemModifiers(
    graph: Graph,
    systems: SimulationSystem[],
    eraModifiers: Record<string, number>
  ): Record<string, number> {
    // Measure current state
    const state = this.tracker.measureState(graph);
    const deviation = this.tracker.calculateDeviation(state, graph.currentEra.name);

    const adjustedModifiers: Record<string, number> = {};
    const tuning = this.targets.tuning;

    systems.forEach((system) => {
      const baseModifier = eraModifiers[system.id] ?? 1.0;
      if (baseModifier === 0) {
        adjustedModifiers[system.id] = 0;
        return; // System disabled by era
      }

      let adjustedModifier = baseModifier;

      // Skip if system has no metadata
      if (!system.metadata) {
        adjustedModifiers[system.id] = baseModifier;
        return;
      }

      const metadata = system.metadata;

      // Adjust based on relationship diversity needs
      if (deviation.relationship.score > tuning.convergenceThreshold) {
        const maxRatio = deviation.relationship.maxTypeRatio;
        const targetMaxRatio = this.targets.global.relationshipDistribution.maxSingleTypeRatio;

        // Penalize systems that create over-represented relationship types
        if (maxRatio > targetMaxRatio) {
          metadata.produces.relationships.forEach((relInfo) => {
            const currentRatio = state.relationshipTypeRatios[relInfo.kind] || 0;
            if (currentRatio > targetMaxRatio * 0.8) {
              adjustedModifier *= 0.6; // Reduce modifier for over-represented types
            }
          });
        }

        // Boost systems that increase diversity
        if (metadata.effects.diversityImpact > 0.3) {
          const boost = 1 + metadata.effects.diversityImpact * tuning.correctionStrength.relationship * 0.5;
          adjustedModifier *= boost;
        }
      }

      // Adjust based on connectivity needs
      if (deviation.connectivity.score > tuning.convergenceThreshold) {
        const currentClusters = state.graphMetrics.clusters;
        const targetClusters = this.targets.global.graphConnectivity.targetClusters.preferred;

        // Boost cluster-forming systems if we need more clusters
        if (currentClusters < targetClusters && metadata.effects.clusterFormation > 0.3) {
          const boost = 1 + metadata.effects.clusterFormation * tuning.correctionStrength.connectivity * 0.5;
          adjustedModifier *= boost;
        }

        // Boost dispersing systems if we have too many clusters
        if (currentClusters > targetClusters && metadata.effects.clusterFormation < -0.3) {
          const boost = 1 + Math.abs(metadata.effects.clusterFormation) * tuning.correctionStrength.connectivity * 0.5;
          adjustedModifier *= boost;
        }

        // Adjust density-affecting systems
        const densityDev = deviation.connectivity.densityBalance;
        if (densityDev > 0.1) {
          if (metadata.effects.graphDensity > 0.3 && state.graphMetrics.intraClusterDensity < this.targets.global.graphConnectivity.densityTargets.intraCluster) {
            adjustedModifier *= 1.3; // Boost density-increasing systems
          } else if (metadata.effects.graphDensity < -0.3 && state.graphMetrics.intraClusterDensity > this.targets.global.graphConnectivity.densityTargets.intraCluster) {
            adjustedModifier *= 1.3; // Boost density-reducing systems
          }
        }
      }

      // Clamp to reasonable bounds (0.2x to 2.0x of base modifier)
      adjustedModifier = Math.max(0.2, Math.min(2.0, adjustedModifier));

      adjustedModifiers[system.id] = adjustedModifier;
    });

    return adjustedModifiers;
  }
}
