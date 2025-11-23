/**
 * Fitness evaluator - calculates weighted fitness from world-gen stats
 */

import * as fs from 'fs';
import { WorldGenStats, FitnessWeights, Individual } from './types';

// ============================================================================
// EASILY CHANGEABLE FITNESS WEIGHTS
// ============================================================================
// Adjust these weights to change optimization priorities
// All weights should sum to 1.0 for normalized fitness scores
const DEFAULT_WEIGHTS: FitnessWeights = {
  entityDistribution: 0.15,      // How balanced entity kinds are
  prominenceDistribution: 0.15,  // How balanced prominence levels are
  relationshipDiversity: 0.2,    // How diverse relationship types are
  connectivity: 0.15,            // How well-connected the graph is
  overall: 0.35                  // Overall fitness from world-gen
};
// ============================================================================

export class FitnessEvaluator {
  private weights: FitnessWeights;

  constructor(weights?: FitnessWeights) {
    this.weights = weights || DEFAULT_WEIGHTS;
    this.validateWeights();
  }

  /**
   * Validate that weights are reasonable
   */
  private validateWeights(): void {
    const sum = Object.values(this.weights).reduce((a, b) => a + b, 0);
    if (Math.abs(sum - 1.0) > 0.01) {
      console.warn(`Warning: Fitness weights sum to ${sum.toFixed(3)}, not 1.0. Results may be unnormalized.`);
    }
  }

  /**
   * Load stats from a JSON file
   */
  loadStats(statsPath: string): WorldGenStats | null {
    try {
      const data = JSON.parse(fs.readFileSync(statsPath, 'utf-8'));
      return data as WorldGenStats;
    } catch (error) {
      console.error(`Failed to load stats from ${statsPath}:`, error);
      return null;
    }
  }

  /**
   * Calculate weighted fitness from stats
   */
  calculateFitness(stats: WorldGenStats): number {
    const metrics = stats.fitnessMetrics;

    const weightedFitness =
      this.weights.entityDistribution * metrics.entityDistributionFitness +
      this.weights.prominenceDistribution * metrics.prominenceDistributionFitness +
      this.weights.relationshipDiversity * metrics.relationshipDiversityFitness +
      this.weights.connectivity * metrics.connectivityFitness +
      this.weights.overall * metrics.overallFitness;

    return weightedFitness;
  }

  /**
   * Calculate fitness and get detailed breakdown
   */
  evaluateIndividual(stats: WorldGenStats): {
    fitness: number;
    breakdown: Individual['fitnessBreakdown'];
  } {
    const metrics = stats.fitnessMetrics;
    const fitness = this.calculateFitness(stats);

    return {
      fitness,
      breakdown: {
        entityDistribution: metrics.entityDistributionFitness,
        prominenceDistribution: metrics.prominenceDistributionFitness,
        relationshipDiversity: metrics.relationshipDiversityFitness,
        connectivity: metrics.connectivityFitness,
        overall: metrics.overallFitness
      }
    };
  }

  /**
   * Evaluate from a stats file path
   */
  evaluateFromFile(statsPath: string): {
    fitness: number;
    breakdown: Individual['fitnessBreakdown'];
  } | null {
    const stats = this.loadStats(statsPath);
    if (!stats) {
      return null;
    }

    return this.evaluateIndividual(stats);
  }

  /**
   * Get current weights (for reporting)
   */
  getWeights(): FitnessWeights {
    return { ...this.weights };
  }

  /**
   * Set new weights
   */
  setWeights(weights: FitnessWeights): void {
    this.weights = weights;
    this.validateWeights();
  }
}
