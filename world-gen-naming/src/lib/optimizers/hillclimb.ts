/**
 * Hill-climbing optimizer
 *
 * Simple baseline optimizer that proposes random perturbations
 * and accepts improvements.
 */

import { createRNG } from "../../utils/rng.js";
import {
  encodeParameters,
  decodeParameters,
  perturbParameters,
  parameterDistance,
} from "../parameter-encoder.js";
import { computeFitness, computeFitnessLight } from "../fitness.js";
import type { NamingDomain } from "../../types/domain.js";
import type {
  OptimizationSettings,
  ValidationSettings,
  FitnessWeights,
  ParameterBounds,
  OptimizationResult,
  EvaluationResult,
} from "../../types/optimization.js";
import { DEFAULT_BOUNDS } from "../../types/optimization.js";

/**
 * Run hill-climbing optimization
 * @param siblingDomains - Other domains to compare against for separation metric
 */
export async function hillclimb(
  initialDomain: NamingDomain,
  validationSettings: ValidationSettings,
  fitnessWeights: FitnessWeights,
  optimizationSettings: OptimizationSettings,
  bounds: ParameterBounds = DEFAULT_BOUNDS,
  seed: string = "hillclimb",
  siblingDomains: NamingDomain[] = []
): Promise<OptimizationResult> {
  const rng = createRNG(seed);

  // Use full fitness (with separation) if we have sibling domains, otherwise lightweight
  const useSeparation = siblingDomains.length > 0 && fitnessWeights.separation > 0;

  // Apply defaults
  const iterations = optimizationSettings.iterations ?? 100;
  const verbose = optimizationSettings.verbose ?? false;
  const convergenceThreshold = optimizationSettings.convergenceThreshold ?? 0.001;
  const convergenceWindow = optimizationSettings.convergenceWindow ?? 10;
  const stepSizes = optimizationSettings.stepSizes ?? {
    weights: 0.1,
    apostropheRate: 0.05,
    hyphenRate: 0.05,
    lengthRange: 1,
  };

  // Encode initial parameters
  let currentTheta = encodeParameters(initialDomain);
  let currentDomain = initialDomain;

  // Evaluate initial fitness
  console.log("Evaluating initial configuration...");
  let currentEval = useSeparation
    ? await computeFitness(currentDomain, currentTheta, validationSettings, fitnessWeights, siblingDomains, 0, verbose)
    : await computeFitnessLight(currentDomain, currentTheta, validationSettings, fitnessWeights, 0, verbose);

  const initialFitness = currentEval.fitness;

  // Always log initial fitness (regardless of verbose)
  console.log(`Initial fitness: ${initialFitness.toFixed(4)}`);
  console.log(
    `  Capacity: ${currentEval.scores.capacity.toFixed(3)}, ` +
    `Diffuseness: ${currentEval.scores.diffuseness.toFixed(3)}, ` +
    `Separation: ${currentEval.scores.separation.toFixed(3)}`
  );
  console.log(`Starting ${iterations} iterations (each takes ~${useSeparation ? '60-90' : '5-10'}s)...`);
  let bestEval = currentEval;
  const evaluations: EvaluationResult[] = [currentEval];
  const convergenceHistory: number[] = [currentEval.fitness];

  // Track convergence
  let noImprovementCount = 0;
  let lastBestFitness = initialFitness;

  // Hill-climbing loop
  for (let i = 1; i <= iterations; i++) {
    const iterStart = Date.now();
    // Always show progress for long-running optimization
    console.log(`\n[${i}/${iterations}] Evaluating...`);

    // Propose perturbation
    const proposedTheta = perturbParameters(currentTheta, stepSizes, rng);
    const proposedDomain = decodeParameters(proposedTheta, initialDomain, bounds);

    // Evaluate proposed config
    const proposedEval = useSeparation
      ? await computeFitness(proposedDomain, proposedTheta, validationSettings, fitnessWeights, siblingDomains, i, verbose)
      : await computeFitnessLight(proposedDomain, proposedTheta, validationSettings, fitnessWeights, i, verbose);

    const iterElapsed = ((Date.now() - iterStart) / 1000).toFixed(1);
    console.log(`[${i}/${iterations}] Fitness: ${proposedEval.fitness.toFixed(4)} (${iterElapsed}s)`);

    evaluations.push(proposedEval);

    // Accept if better
    if (proposedEval.fitness > currentEval.fitness) {
      currentTheta = proposedTheta;
      currentDomain = proposedDomain;
      currentEval = proposedEval;

      if (proposedEval.fitness > bestEval.fitness) {
        bestEval = proposedEval;
        console.log(
          `  -> New best! ${bestEval.fitness.toFixed(4)} (+${((bestEval.fitness - initialFitness) * 100).toFixed(1)}%)`
        );
      }
    }

    convergenceHistory.push(bestEval.fitness);

    // Check for convergence
    const improvement = bestEval.fitness - lastBestFitness;
    if (improvement < convergenceThreshold) {
      noImprovementCount++;
      if (noImprovementCount >= convergenceWindow) {
        console.log(
          `\nConverged after ${i} iterations (no improvement for ${noImprovementCount} iterations)`
        );
        break;
      }
    } else {
      noImprovementCount = 0;
      lastBestFitness = bestEval.fitness;
    }
  }

  const finalFitness = bestEval.fitness;
  const finalImprovement = finalFitness - initialFitness;

  console.log("\n=== Optimization complete ===");
  console.log(`Initial fitness: ${initialFitness.toFixed(4)}`);
  console.log(`Final fitness: ${finalFitness.toFixed(4)}`);
  console.log(`Improvement: +${(finalImprovement * 100).toFixed(1)}%`);
  console.log(`Total evaluations: ${evaluations.length}`);

  return {
    initialConfig: initialDomain,
    optimizedConfig: bestEval.config,
    initialFitness,
    finalFitness,
    improvement: finalImprovement,
    iterations: evaluations.length,
    evaluations,
    convergenceHistory,
    settings: optimizationSettings,
  };
}
