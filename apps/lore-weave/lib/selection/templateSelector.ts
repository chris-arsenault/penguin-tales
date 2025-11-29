import { Graph, GrowthTemplate } from '../engine/types';
import {
  DistributionTargets,
  DistributionState,
  DeviationScore,
  GuidedWeights,
} from '../statistics/types';
import { DistributionTracker } from '../statistics/distributionTracker';

/**
 * Statistically-guided template selection
 * Adjusts template probabilities based on distribution targets
 */
export class TemplateSelector {
  private tracker: DistributionTracker;
  private targets: DistributionTargets;
  private templates: GrowthTemplate[];

  constructor(targets: DistributionTargets, templates: GrowthTemplate[]) {
    this.targets = targets;
    this.templates = templates;
    this.tracker = new DistributionTracker(targets);
  }

  /**
   * Select templates with statistical guidance
   * Returns weighted templates adjusted based on deviation from targets
   */
  public selectTemplates(
    graph: Graph,
    availableTemplates: GrowthTemplate[],
    eraWeights: Record<string, number>,
    count: number
  ): GrowthTemplate[] {
    // Measure current state
    const state = this.tracker.measureState(graph);
    const deviation = this.tracker.calculateDeviation(state, graph.currentEra.name);

    // Calculate adjusted weights
    const guidedWeights = this.calculateGuidedWeights(
      availableTemplates,
      eraWeights,
      state,
      deviation
    );

    // Select templates based on adjusted probabilities
    const selected: GrowthTemplate[] = [];
    for (let i = 0; i < count; i++) {
      const template = this.weightedRandom(guidedWeights);
      if (template) {
        selected.push(template);
      }
    }

    return selected;
  }

  /**
   * Calculate adjusted weights based on distribution targets
   */
  private calculateGuidedWeights(
    templates: GrowthTemplate[],
    eraWeights: Record<string, number>,
    state: DistributionState,
    deviation: DeviationScore
  ): GuidedWeights[] {
    const tuning = this.targets.tuning;
    const guidedWeights: GuidedWeights[] = [];

    templates.forEach((template) => {
      const baseWeight = eraWeights[template.id] || 1.0;
      let adjustedWeight = baseWeight;
      const adjustmentReasons: string[] = [];

      // Skip if template has no metadata
      if (!template.metadata) {
        guidedWeights.push({
          templateId: template.id,
          baseWeight,
          adjustedWeight,
          adjustmentReason: ['No metadata - using base weight'],
          finalProbability: 0, // Will be calculated later
        });
        return;
      }

      const metadata = template.metadata;

      // Adjust based on entity kind needs
      if (deviation.entityKind.score > tuning.convergenceThreshold) {
        metadata.produces.entityKinds.forEach((kindInfo) => {
          const kindDeviation = deviation.entityKind.deviations[kindInfo.kind];
          const currentRatio = state.entityKindRatios[kindInfo.kind] || 0;
          const targetRatio =
            this.targets.global.entityKindDistribution.targets[kindInfo.kind] || 0;

          if (kindDeviation !== undefined) {
            if (currentRatio < targetRatio) {
              // We need more of this kind
              const boost = 1 + kindDeviation * tuning.correctionStrength.entityKind;
              adjustedWeight *= boost;
              adjustmentReasons.push(`+${((boost - 1) * 100).toFixed(0)}% (need more ${kindInfo.kind})`);
            } else if (currentRatio > targetRatio) {
              // We have too many of this kind
              const penalty = 1 - kindDeviation * tuning.correctionStrength.entityKind * 0.5;
              adjustedWeight *= Math.max(0.2, penalty);
              adjustmentReasons.push(`${((penalty - 1) * 100).toFixed(0)}% (too many ${kindInfo.kind})`);
            }
          }
        });
      }

      // Adjust based on prominence needs
      if (deviation.prominence.score > tuning.convergenceThreshold) {
        metadata.produces.entityKinds.forEach((kindInfo) => {
          kindInfo.prominence.forEach((promInfo) => {
            const promDeviation = deviation.prominence.deviations[promInfo.level];
            const currentRatio = state.prominenceRatios[promInfo.level] || 0;
            const targetRatio =
              this.targets.global.prominenceDistribution.targets[promInfo.level] || 0;

            if (promDeviation !== undefined && promInfo.probability > 0.3) {
              if (currentRatio < targetRatio) {
                const boost = 1 + promDeviation * tuning.correctionStrength.prominence;
                adjustedWeight *= boost;
                adjustmentReasons.push(
                  `+${((boost - 1) * 100).toFixed(0)}% (need more ${promInfo.level})`
                );
              } else if (currentRatio > targetRatio) {
                const penalty = 1 - promDeviation * tuning.correctionStrength.prominence * 0.5;
                adjustedWeight *= Math.max(0.2, penalty);
                adjustmentReasons.push(
                  `${((penalty - 1) * 100).toFixed(0)}% (too many ${promInfo.level})`
                );
              }
            }
          });
        });
      }

      // Adjust based on relationship diversity
      if (deviation.relationship.score > tuning.convergenceThreshold) {
        const maxRatio = deviation.relationship.maxTypeRatio;
        const targetMaxRatio = this.targets.global.relationshipDistribution.maxSingleTypeRatio;

        if (maxRatio > targetMaxRatio) {
          // Penalize templates that create over-represented relationship types
          metadata.produces.relationships.forEach((relInfo) => {
            const currentRatio = state.relationshipTypeRatios[relInfo.kind] || 0;
            if (currentRatio > targetMaxRatio * 0.8) {
              const penalty = 0.5;
              adjustedWeight *= penalty;
              adjustmentReasons.push(
                `${((penalty - 1) * 100).toFixed(0)}% (${relInfo.kind} over-represented)`
              );
            }
          });
        }

        // Boost templates that increase diversity
        if (metadata.effects.diversityImpact > 0.3) {
          const boost = 1 + metadata.effects.diversityImpact * tuning.correctionStrength.relationship;
          adjustedWeight *= boost;
          adjustmentReasons.push(`+${((boost - 1) * 100).toFixed(0)}% (increases diversity)`);
        }
      }

      // Adjust based on connectivity targets
      if (deviation.connectivity.score > tuning.convergenceThreshold) {
        const currentClusters = state.graphMetrics.clusters;
        const targetClusters = this.targets.global.graphConnectivity.targetClusters.preferred;

        // Boost cluster-forming templates if we need more clusters
        if (currentClusters < targetClusters && metadata.effects.clusterFormation > 0.3) {
          const boost = 1 + metadata.effects.clusterFormation * tuning.correctionStrength.connectivity;
          adjustedWeight *= boost;
          adjustmentReasons.push(`+${((boost - 1) * 100).toFixed(0)}% (forms clusters)`);
        }

        // Boost dispersing templates if we have too many clusters
        if (currentClusters > targetClusters && metadata.effects.clusterFormation < -0.3) {
          const boost = 1 + Math.abs(metadata.effects.clusterFormation) * tuning.correctionStrength.connectivity;
          adjustedWeight *= boost;
          adjustmentReasons.push(`+${((boost - 1) * 100).toFixed(0)}% (disperses clusters)`);
        }
      }

      // Clamp to min/max
      adjustedWeight = Math.max(
        tuning.minTemplateWeight,
        Math.min(tuning.maxTemplateWeight, adjustedWeight)
      );

      if (adjustmentReasons.length === 0) {
        adjustmentReasons.push('Within target ranges');
      }

      guidedWeights.push({
        templateId: template.id,
        baseWeight,
        adjustedWeight,
        adjustmentReason: adjustmentReasons,
        finalProbability: 0, // Will be calculated next
      });
    });

    // Calculate final probabilities (normalize to sum to 1)
    const totalWeight = guidedWeights.reduce((sum, gw) => sum + gw.adjustedWeight, 0);
    guidedWeights.forEach((gw) => {
      gw.finalProbability = totalWeight > 0 ? gw.adjustedWeight / totalWeight : 0;
    });

    return guidedWeights;
  }

  /**
   * Weighted random selection
   */
  private weightedRandom(guidedWeights: GuidedWeights[]): GrowthTemplate | null {
    const rand = Math.random();
    let cumulative = 0;

    for (const gw of guidedWeights) {
      cumulative += gw.finalProbability;
      if (rand <= cumulative) {
        // Find the template
        const template = this.findTemplateById(gw.templateId);
        return template;
      }
    }

    // Fallback to last template
    return guidedWeights.length > 0
      ? this.findTemplateById(guidedWeights[guidedWeights.length - 1].templateId)
      : null;
  }

  /**
   * Find template by ID
   */
  private findTemplateById(id: string): GrowthTemplate | null {
    return this.templates.find(t => t.id === id) || null;
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
