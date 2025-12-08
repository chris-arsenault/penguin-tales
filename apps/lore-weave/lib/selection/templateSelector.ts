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
 * Uses base weights from era configuration - metadata-based adjustments removed
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
   * Returns weighted templates based on era weights
   */
  public selectTemplates(
    graph: Graph,
    availableTemplates: GrowthTemplate[],
    eraWeights: Record<string, number>,
    count: number
  ): GrowthTemplate[] {
    // Calculate weights using base era weights
    const guidedWeights = this.calculateGuidedWeights(
      availableTemplates,
      eraWeights
    );

    // Select templates based on probabilities
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
   * Calculate weights based on era configuration
   * Entity-kind deficit adjustments are handled in worldEngine via declarative template introspection
   */
  private calculateGuidedWeights(
    templates: GrowthTemplate[],
    eraWeights: Record<string, number>
  ): GuidedWeights[] {
    const tuning = this.targets.tuning;
    const guidedWeights: GuidedWeights[] = [];

    templates.forEach((template) => {
      const baseWeight = eraWeights[template.id] || 1.0;

      // Clamp to min/max
      const adjustedWeight = Math.max(
        tuning.minTemplateWeight,
        Math.min(tuning.maxTemplateWeight, baseWeight)
      );

      guidedWeights.push({
        templateId: template.id,
        baseWeight,
        adjustedWeight,
        adjustmentReason: ['Using era weight'],
        finalProbability: 0,
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
