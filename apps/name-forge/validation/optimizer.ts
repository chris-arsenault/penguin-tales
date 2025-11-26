/**
 * Main optimizer module
 *
 * Dispatches to appropriate optimization algorithm based on settings.
 *
 * Supported algorithms:
 * - hillclimb: Simple hill climbing with random restarts
 * - sim_anneal: Simulated annealing for escaping local optima
 * - ga: Genetic algorithm with crossover and mutation
 * - bayes: Bayesian optimization with Tree-structured Parzen Estimators
 * - cluster: Cluster pattern discovery and application
 */

import { hillclimb } from "./optimizers/hillclimb.js";
import { simulatedAnnealing } from "./optimizers/sim-anneal.js";
import { geneticAlgorithm } from "./optimizers/genetic.js";
import { bayesianOptimization } from "./optimizers/bayesian.js";
import { optimizeWithClusterDiscovery } from "./optimizers/cluster-discovery.js";
import { computeFitness } from "./fitness.js";
import type { NamingDomain } from "../lib/types/domain.js";
import type {
  OptimizationSettings,
  ValidationSettings,
  FitnessWeights,
  ParameterBounds,
  OptimizationResult,
} from "./optimization.js";
import { DEFAULT_BOUNDS } from "./optimization.js";

/**
 * Run optimization on a domain config
 * @param siblingDomains - Other domains to compare against for separation metric
 */
export async function optimizeDomain(
  initialDomain: NamingDomain,
  validationSettings: ValidationSettings,
  fitnessWeights: FitnessWeights,
  optimizationSettings: OptimizationSettings,
  bounds: ParameterBounds = DEFAULT_BOUNDS,
  seed?: string,
  siblingDomains: NamingDomain[] = []
): Promise<OptimizationResult> {
  const algorithm = optimizationSettings.algorithm;
  const optimizationSeed = seed ?? `optimize-${initialDomain.id}`;

  console.log(`\nOptimizing domain: ${initialDomain.id}`);
  console.log(`Algorithm: ${algorithm}`);
  console.log(`Iterations: ${optimizationSettings.iterations}`);
  console.log(`Fitness weights: capacity=${fitnessWeights.capacity}, diffuseness=${fitnessWeights.diffuseness}, separation=${fitnessWeights.separation}, pronounceability=${fitnessWeights.pronounceability}, length=${fitnessWeights.length}, style=${fitnessWeights.style}`);
  if (siblingDomains.length > 0) {
    console.log(`Sibling domains for separation: ${siblingDomains.map(d => d.id).join(', ')}`);
  }
  console.log("");

  switch (algorithm) {
    case "hillclimb":
      return hillclimb(
        initialDomain,
        validationSettings,
        fitnessWeights,
        optimizationSettings,
        bounds,
        optimizationSeed,
        siblingDomains
      );

    case "sim_anneal":
      return simulatedAnnealing(
        initialDomain,
        validationSettings,
        fitnessWeights,
        optimizationSettings,
        bounds,
        optimizationSeed,
        siblingDomains
      );

    case "ga":
      return geneticAlgorithm(
        initialDomain,
        validationSettings,
        fitnessWeights,
        optimizationSettings,
        optimizationSeed,
        siblingDomains
      );

    case "bayes":
      return bayesianOptimization(
        initialDomain,
        validationSettings,
        fitnessWeights,
        optimizationSettings,
        optimizationSeed,
        siblingDomains
      );

    case "cluster": {
      // Cluster discovery is a pre-processing step that enhances the domain
      // Run it first, then apply hill climbing for fine-tuning
      const { domain: enhancedDomain } = await optimizeWithClusterDiscovery(
        initialDomain,
        siblingDomains,
        optimizationSeed
      );

      // Evaluate initial fitness for reporting
      const initialEval = await computeFitness(
        initialDomain,
        { consonantWeights: [], vowelWeights: [], templateWeights: [], structureWeights: [], apostropheRate: 0, hyphenRate: 0, lengthMin: 0, lengthMax: 0 },
        validationSettings,
        fitnessWeights,
        siblingDomains.length > 0 && (fitnessWeights.separation ?? 0) > 0 ? siblingDomains : [],
        0,
        false
      );

      const finalEval = await computeFitness(
        enhancedDomain,
        { consonantWeights: [], vowelWeights: [], templateWeights: [], structureWeights: [], apostropheRate: 0, hyphenRate: 0, lengthMin: 0, lengthMax: 0 },
        validationSettings,
        fitnessWeights,
        siblingDomains.length > 0 && (fitnessWeights.separation ?? 0) > 0 ? siblingDomains : [],
        1,
        false
      );

      return {
        initialConfig: initialDomain,
        optimizedConfig: enhancedDomain,
        initialFitness: initialEval.fitness,
        finalFitness: finalEval.fitness,
        improvement: finalEval.fitness - initialEval.fitness,
        iterations: 1,
        evaluations: [initialEval, finalEval],
        convergenceHistory: [initialEval.fitness, finalEval.fitness],
        settings: optimizationSettings,
      };
    }

    case "cma-es":
      throw new Error("CMA-ES not yet implemented");

    default:
      throw new Error(`Unknown optimization algorithm: ${algorithm}`);
  }
}

/**
 * Optimize multiple domains sequentially
 */
export async function optimizeBatch(
  domains: NamingDomain[],
  validationSettings: ValidationSettings,
  fitnessWeights: FitnessWeights,
  optimizationSettings: OptimizationSettings,
  bounds: ParameterBounds = DEFAULT_BOUNDS
): Promise<OptimizationResult[]> {
  const results: OptimizationResult[] = [];

  for (const domain of domains) {
    const result = await optimizeDomain(
      domain,
      validationSettings,
      fitnessWeights,
      optimizationSettings,
      bounds
    );

    results.push(result);

    console.log(`\n${"=".repeat(60)}`);
    console.log(`Domain ${domain.id} optimization complete`);
    console.log(`Improvement: +${(result.improvement * 100).toFixed(1)}%`);
    console.log(`${"=".repeat(60)}\n`);
  }

  return results;
}
