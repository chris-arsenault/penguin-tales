/**
 * Adaptive mutation system with parameter impact tracking
 *
 * Strategies:
 * 1. Impact-based mutation: Learn which parameters affect fitness most
 * 2. Component-focused mutation: Mutate parameters related to weak fitness components
 * 3. Simulated annealing: Decrease mutation rate over time
 */

import { Genome, Individual, ParameterMetadata } from './types';
import { ConfigLoader } from './configLoader';

// ============================================================================
// ADAPTIVE MUTATION CONFIGURATION
// ============================================================================
export interface AdaptiveMutationConfig {
  strategy: 'impact' | 'component' | 'annealing' | 'hybrid';

  // Impact-based settings
  impactLearningRate: number;        // How quickly to adapt to parameter impacts (0-1)
  impactBoostFactor: number;         // Multiply mutation rate by this for high-impact params
  impactHistoryWindow: number;       // Generations to consider for impact calculation

  // Simulated annealing settings
  initialMutationRate: number;       // Starting mutation rate
  finalMutationRate: number;         // Ending mutation rate
  annealingSchedule: 'linear' | 'exponential' | 'cosine';

  // Component-focused settings
  componentThreshold: number;        // Focus on components below this fitness
  componentMutationBoost: number;    // Boost mutation for weak component params
}

const DEFAULT_CONFIG: AdaptiveMutationConfig = {
  strategy: 'hybrid',
  impactLearningRate: 0.1,
  impactBoostFactor: 3.0,
  impactHistoryWindow: 5,
  initialMutationRate: 0.15,
  finalMutationRate: 0.05,
  annealingSchedule: 'exponential',
  componentThreshold: 0.7,
  componentMutationBoost: 2.0
};
// ============================================================================

interface ParameterImpact {
  path: string;
  impact: number;           // Correlation with fitness changes (0-1)
  variance: number;         // How much this parameter varies
  lastValues: number[];     // Recent values for tracking
}

interface FitnessHistory {
  generation: number;
  fitness: number;
  genome: Genome;
  fitnessBreakdown?: {
    entityDistribution: number;
    prominenceDistribution: number;
    relationshipDiversity: number;
    connectivity: number;
    overall: number;
  };
}

// Map parameter names to fitness components they likely affect
const PARAMETER_TO_COMPONENT: Record<string, string[]> = {
  // Relationship formation parameters affect connectivity and diversity
  'relationship': ['connectivity', 'relationshipDiversity'],
  'friendship': ['connectivity', 'relationshipDiversity'],
  'romance': ['connectivity', 'relationshipDiversity'],
  'mentorship': ['connectivity', 'relationshipDiversity'],

  // Entity creation parameters affect distribution
  'num': ['entityDistribution'],
  'count': ['entityDistribution'],
  'size': ['entityDistribution'],

  // Prominence-related parameters
  'prominence': ['prominenceDistribution'],
  'Gain': ['prominenceDistribution'],
  'Decay': ['prominenceDistribution', 'connectivity'],

  // Reinforcement affects connectivity
  'reinforcement': ['connectivity'],
  'culling': ['connectivity']
};

export class AdaptiveMutation {
  private config: AdaptiveMutationConfig;
  private configLoader: ConfigLoader;
  private parameterMetadata: ParameterMetadata[];

  private parameterImpacts: Map<string, ParameterImpact>;
  private fitnessHistory: FitnessHistory[] = [];
  private currentGeneration: number = 0;

  constructor(
    configLoader: ConfigLoader,
    parameterMetadata: ParameterMetadata[],
    config?: Partial<AdaptiveMutationConfig>
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.configLoader = configLoader;
    this.parameterMetadata = parameterMetadata;

    // Initialize parameter impacts
    this.parameterImpacts = new Map();
    for (const param of parameterMetadata) {
      this.parameterImpacts.set(param.path, {
        path: param.path,
        impact: 0.5, // Start neutral
        variance: 0,
        lastValues: []
      });
    }
  }

  /**
   * Record an individual's fitness for learning
   */
  recordIndividual(individual: Individual): void {
    this.fitnessHistory.push({
      generation: individual.generation,
      fitness: individual.fitness,
      genome: new Map(individual.genome),
      fitnessBreakdown: individual.fitnessBreakdown
    });

    // Update parameter impacts
    if (this.fitnessHistory.length >= 2) {
      this.updateParameterImpacts();
    }
  }

  /**
   * Update generation counter for annealing
   */
  setGeneration(generation: number): void {
    this.currentGeneration = generation;
  }

  /**
   * Calculate adaptive mutation rate for a specific parameter
   */
  getMutationRate(paramPath: string, baseMutationRate: number, fitnessBreakdown?: Individual['fitnessBreakdown']): number {
    let mutationRate = baseMutationRate;

    // Apply annealing
    if (this.config.strategy === 'annealing' || this.config.strategy === 'hybrid') {
      mutationRate = this.applyAnnealing(baseMutationRate);
    }

    // Apply impact-based adjustment
    if (this.config.strategy === 'impact' || this.config.strategy === 'hybrid') {
      const impact = this.parameterImpacts.get(paramPath);
      if (impact && impact.impact > 0.7) {
        // High-impact parameters get more mutation
        mutationRate *= this.config.impactBoostFactor;
      } else if (impact && impact.impact < 0.3) {
        // Low-impact parameters get less mutation
        mutationRate *= 0.5;
      }
    }

    // Apply component-focused adjustment
    if ((this.config.strategy === 'component' || this.config.strategy === 'hybrid') && fitnessBreakdown) {
      const componentBoost = this.getComponentBoost(paramPath, fitnessBreakdown);
      mutationRate *= componentBoost;
    }

    return Math.min(mutationRate, 0.5); // Cap at 50%
  }

  /**
   * Apply simulated annealing to mutation rate
   */
  private applyAnnealing(baseMutationRate: number): number {
    const progress = this.currentGeneration / 100; // Assuming max 100 generations
    const { initialMutationRate, finalMutationRate, annealingSchedule } = this.config;

    let annealedRate: number;

    switch (annealingSchedule) {
      case 'linear':
        annealedRate = initialMutationRate - (progress * (initialMutationRate - finalMutationRate));
        break;

      case 'exponential':
        annealedRate = finalMutationRate + (initialMutationRate - finalMutationRate) * Math.exp(-5 * progress);
        break;

      case 'cosine':
        annealedRate = finalMutationRate + 0.5 * (initialMutationRate - finalMutationRate) *
                      (1 + Math.cos(Math.PI * progress));
        break;

      default:
        annealedRate = baseMutationRate;
    }

    return annealedRate;
  }

  /**
   * Get mutation boost based on weak fitness components
   */
  private getComponentBoost(paramPath: string, fitnessBreakdown: Individual['fitnessBreakdown']): number {
    if (!fitnessBreakdown) return 1.0;

    let boost = 1.0;

    // Check which components this parameter affects
    for (const [keyword, components] of Object.entries(PARAMETER_TO_COMPONENT)) {
      if (paramPath.toLowerCase().includes(keyword.toLowerCase())) {
        for (const component of components) {
          const componentValue = (fitnessBreakdown as any)[component];
          if (componentValue !== undefined && componentValue < this.config.componentThreshold) {
            // This component is weak and this parameter affects it
            boost = Math.max(boost, this.config.componentMutationBoost);
          }
        }
      }
    }

    return boost;
  }

  /**
   * Update parameter impact scores based on fitness history
   */
  private updateParameterImpacts(): void {
    const recentHistory = this.fitnessHistory.slice(-this.config.impactHistoryWindow);

    if (recentHistory.length < 2) return;

    for (const param of this.parameterMetadata) {
      const impact = this.parameterImpacts.get(param.path)!;

      // Calculate variance of this parameter across recent history
      const values = recentHistory.map(h => h.genome.get(param.path) || param.default);
      impact.lastValues = values;
      impact.variance = this.calculateVariance(values);

      // Calculate correlation between parameter changes and fitness changes
      if (impact.variance > 0.001) {
        const correlation = this.calculateCorrelation(
          recentHistory.map((h, i) => i > 0 ? (h.genome.get(param.path) || param.default) - (recentHistory[i-1].genome.get(param.path) || param.default) : 0).slice(1),
          recentHistory.map((h, i) => i > 0 ? h.fitness - recentHistory[i-1].fitness : 0).slice(1)
        );

        // Update impact with learning rate
        const newImpact = Math.abs(correlation); // Use absolute correlation
        impact.impact = impact.impact * (1 - this.config.impactLearningRate) +
                       newImpact * this.config.impactLearningRate;
      }
    }
  }

  /**
   * Calculate variance of values
   */
  private calculateVariance(values: number[]): number {
    if (values.length === 0) return 0;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
    return squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
  }

  /**
   * Calculate correlation between two arrays
   */
  private calculateCorrelation(x: number[], y: number[]): number {
    if (x.length !== y.length || x.length === 0) return 0;

    const n = x.length;
    const meanX = x.reduce((a, b) => a + b, 0) / n;
    const meanY = y.reduce((a, b) => a + b, 0) / n;

    let numerator = 0;
    let denomX = 0;
    let denomY = 0;

    for (let i = 0; i < n; i++) {
      const dx = x[i] - meanX;
      const dy = y[i] - meanY;
      numerator += dx * dy;
      denomX += dx * dx;
      denomY += dy * dy;
    }

    const denom = Math.sqrt(denomX * denomY);
    return denom === 0 ? 0 : numerator / denom;
  }

  /**
   * Get current parameter impacts (for reporting)
   */
  getParameterImpacts(): Map<string, ParameterImpact> {
    return new Map(this.parameterImpacts);
  }

  /**
   * Get top N most impactful parameters
   */
  getTopImpactParameters(n: number = 10): ParameterImpact[] {
    return Array.from(this.parameterImpacts.values())
      .sort((a, b) => b.impact - a.impact)
      .slice(0, n);
  }

  /**
   * Print impact report
   */
  printImpactReport(): void {
    const topParams = this.getTopImpactParameters(10);

    console.log('\n--- Parameter Impact Report ---');
    console.log('Top 10 most influential parameters:\n');

    topParams.forEach((param, index) => {
      console.log(`${index + 1}. ${param.path}`);
      console.log(`   Impact: ${param.impact.toFixed(3)} | Variance: ${param.variance.toFixed(4)}`);
    });

    console.log(`\nCurrent mutation strategy: ${this.config.strategy}`);
    if (this.config.strategy === 'annealing' || this.config.strategy === 'hybrid') {
      const currentRate = this.applyAnnealing(0.1);
      console.log(`Annealing progress: ${(this.currentGeneration / 100 * 100).toFixed(0)}% | Current base rate: ${currentRate.toFixed(3)}`);
    }
  }
}
