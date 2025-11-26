/**
 * Browser-compatible optimizer
 *
 * This module wraps the validation/optimizer code for browser usage.
 * All computation runs in the main thread (no workers needed).
 */

// Import from parent directories using Vite aliases
import { createRNG } from '@lib/utils/rng.js';
import { generatePhonotacticName } from '@lib/phonotactic-pipeline.js';
import { batchScorePronounceability } from '@lib/pronounceability.js';
import {
  encodeParameters,
  decodeParameters,
  perturbParameters,
} from '@lib/parameter-encoder.js';

// Validation metrics
import { validateCapacity } from '@validation/metrics/capacity.js';
import { validateDiffuseness } from '@validation/metrics/diffuseness.js';
import { validateSeparation } from '@validation/metrics/separation.js';
import { DEFAULT_BOUNDS } from '@validation/optimization.js';

/**
 * Normalize capacity metrics to 0-1 score (higher is better)
 */
function normalizeCapacityScore(report, settings) {
  const collisionRate = report?.collisionRate ?? 0;
  const collisionScore = Math.max(0, 1 - collisionRate / 0.1);

  const entropy = report?.entropy ?? 3;
  const entropyScore = Math.min(1, Math.max(0, (entropy - 2) / 3));

  const score = (collisionScore + entropyScore) / 2;
  return isNaN(score) ? 0.5 : score;
}

/**
 * Normalize diffuseness metrics to 0-1 score (higher is better)
 */
function normalizeDiffusenessScore(report, settings) {
  const levenshteinP5 = report?.levenshteinNN?.p5 ?? 0.3;
  const minNN = settings.minNN_p5 ?? 0.3;
  const levenshteinScore = minNN > 0 ? Math.min(1, levenshteinP5 / minNN) : 0.5;

  const shapeP5 = report?.shapeNN?.p5 ?? 0.2;
  const minShape = settings.minShapeNN_p5 ?? 0.2;
  const shapeScore = minShape > 0 ? Math.min(1, shapeP5 / minShape) : 0.5;

  const score = (levenshteinScore + shapeScore) / 2;
  return isNaN(score) ? 0.5 : score;
}

/**
 * Normalize separation metrics to 0-1 score (higher is better)
 */
function normalizeSeparationScore(report, settings) {
  const classifierScore = report?.classifierAccuracy ?? 0.5;

  const distances = Object.values(report?.pairwiseDistances ?? {});
  const minDistance = distances.length > 0 ? Math.min(...distances) : 1;
  const minCentroid = settings.minCentroidDistance ?? 0.2;
  const centroidScore = minCentroid > 0 ? Math.min(1, minDistance / minCentroid) : 0.5;

  const score = (classifierScore + centroidScore) / 2;
  return isNaN(score) ? 0.5 : score;
}

/**
 * Compute fitness score for a domain configuration
 */
async function computeFitness(config, theta, settings, weights, otherDomains = [], iteration = 0, onProgress) {
  const requiredNames = settings.requiredNames ?? 500;
  const sampleFactor = settings.sampleFactor ?? 10;
  const maxSampleSize = settings.maxSampleSize ?? 5000;

  const mergedSettings = {
    ...settings,
    requiredNames,
    sampleFactor,
    maxSampleSize,
    minNN_p5: settings.minNN_p5 ?? 0.3,
    minShapeNN_p5: settings.minShapeNN_p5 ?? 0.2,
    minCentroidDistance: settings.minCentroidDistance ?? 0.2,
  };

  const sampleSize = Math.min(maxSampleSize, requiredNames * sampleFactor);

  onProgress?.(`Computing metrics (${sampleSize} samples)...`);

  // Run capacity and diffuseness
  const capacityReport = validateCapacity(config, {
    sampleSize,
    seed: `fitness-${iteration}-capacity`,
  });

  const diffusenessReport = validateDiffuseness(config, {
    sampleSize,
    seed: `fitness-${iteration}-diffuseness`,
  });

  // Separation if other domains provided
  let separationScore = 1.0;
  if (otherDomains.length > 0 && weights.separation > 0) {
    const allDomains = [config, ...otherDomains];
    const perDomainSample = Math.floor(sampleSize / allDomains.length);

    onProgress?.(`Computing separation (${allDomains.length} domains)...`);
    const separationReport = validateSeparation(allDomains, {
      sampleSize: perDomainSample,
      seed: `fitness-${iteration}-separation`,
    });
    separationScore = normalizeSeparationScore(separationReport, mergedSettings);
  }

  const capacityScore = normalizeCapacityScore(capacityReport, mergedSettings);
  const diffusenessScore = normalizeDiffusenessScore(diffusenessReport, mergedSettings);

  // Calculate weighted fitness
  const w = {
    capacity: weights.capacity ?? 0.2,
    diffuseness: weights.diffuseness ?? 0.2,
    separation: weights.separation ?? 0.2,
    pronounceability: weights.pronounceability ?? 0.3,
    length: weights.length ?? 0.1,
  };

  const totalWeight = w.capacity + w.diffuseness + w.separation + w.pronounceability + w.length;

  // Placeholder scores for pronounceability and length (simplified for browser)
  const pronounceabilityScore = 0.7; // Default reasonable score
  const lengthScore = 0.8;

  const fitness = totalWeight > 0
    ? (w.capacity * capacityScore +
       w.diffuseness * diffusenessScore +
       w.separation * separationScore +
       w.pronounceability * pronounceabilityScore +
       w.length * lengthScore) / totalWeight
    : 0;

  return {
    config,
    theta,
    fitness,
    scores: {
      capacity: capacityScore,
      diffuseness: diffusenessScore,
      separation: separationScore,
      pronounceability: pronounceabilityScore,
      length: lengthScore,
    },
    iteration,
    timestamp: Date.now(),
  };
}

/**
 * Hill climbing optimizer (browser version)
 */
async function hillclimb(initialDomain, validationSettings, fitnessWeights, optimizationSettings, bounds, seed, siblingDomains, onProgress) {
  const rng = createRNG(seed);
  const useSeparation = siblingDomains.length > 0 && fitnessWeights.separation > 0;

  const iterations = optimizationSettings.iterations ?? 50;
  const convergenceThreshold = optimizationSettings.convergenceThreshold ?? 0.001;
  const convergenceWindow = optimizationSettings.convergenceWindow ?? 10;
  const stepSizes = optimizationSettings.stepSizes ?? {
    weights: 0.1,
    apostropheRate: 0.05,
    hyphenRate: 0.05,
    lengthRange: 1,
  };

  let currentTheta = encodeParameters(initialDomain);
  let currentDomain = initialDomain;

  onProgress?.('Evaluating initial configuration...');
  let currentEval = await computeFitness(
    currentDomain, currentTheta, validationSettings, fitnessWeights,
    useSeparation ? siblingDomains : [], 0, onProgress
  );

  const initialFitness = currentEval.fitness;
  let bestEval = currentEval;
  const evaluations = [currentEval];
  const convergenceHistory = [currentEval.fitness];

  let noImprovementCount = 0;
  let lastBestFitness = initialFitness;

  for (let i = 1; i <= iterations; i++) {
    onProgress?.(`Iteration ${i}/${iterations}...`);

    const proposedTheta = perturbParameters(currentTheta, stepSizes, rng);
    const proposedDomain = decodeParameters(proposedTheta, initialDomain, bounds);

    const proposedEval = await computeFitness(
      proposedDomain, proposedTheta, validationSettings, fitnessWeights,
      useSeparation ? siblingDomains : [], i, onProgress
    );

    evaluations.push(proposedEval);

    if (proposedEval.fitness > currentEval.fitness) {
      currentTheta = proposedTheta;
      currentDomain = proposedDomain;
      currentEval = proposedEval;

      if (proposedEval.fitness > bestEval.fitness) {
        bestEval = proposedEval;
        onProgress?.(`New best: ${bestEval.fitness.toFixed(4)} (+${((bestEval.fitness - initialFitness) * 100).toFixed(1)}%)`);
      }
    }

    convergenceHistory.push(bestEval.fitness);

    const improvement = bestEval.fitness - lastBestFitness;
    if (improvement < convergenceThreshold) {
      noImprovementCount++;
      if (noImprovementCount >= convergenceWindow) {
        onProgress?.(`Converged after ${i} iterations`);
        break;
      }
    } else {
      noImprovementCount = 0;
      lastBestFitness = bestEval.fitness;
    }

    // Allow UI to update
    await new Promise(resolve => setTimeout(resolve, 0));
  }

  return {
    initialConfig: initialDomain,
    optimizedConfig: bestEval.config,
    initialFitness,
    finalFitness: bestEval.fitness,
    improvement: bestEval.fitness - initialFitness,
    iterations: evaluations.length,
    evaluations,
    convergenceHistory,
    settings: optimizationSettings,
  };
}

/**
 * Simulated annealing optimizer (browser version)
 */
async function simulatedAnnealing(initialDomain, validationSettings, fitnessWeights, optimizationSettings, bounds, seed, siblingDomains, onProgress) {
  const rng = createRNG(seed);
  const useSeparation = siblingDomains.length > 0 && fitnessWeights.separation > 0;

  const iterations = optimizationSettings.iterations ?? 100;
  const initialTemperature = optimizationSettings.initialTemperature ?? 1.0;
  const coolingRate = optimizationSettings.coolingRate ?? 0.95;
  const stepSizes = {
    weights: 0.1,
    apostropheRate: 0.05,
    hyphenRate: 0.05,
    lengthRange: 1,
  };

  let currentTheta = encodeParameters(initialDomain);
  let currentDomain = initialDomain;
  let temperature = initialTemperature;

  onProgress?.('Evaluating initial configuration...');
  let currentEval = await computeFitness(
    currentDomain, currentTheta, validationSettings, fitnessWeights,
    useSeparation ? siblingDomains : [], 0, onProgress
  );

  const initialFitness = currentEval.fitness;
  let bestEval = currentEval;
  const evaluations = [currentEval];
  const convergenceHistory = [currentEval.fitness];

  for (let i = 1; i <= iterations; i++) {
    onProgress?.(`Iteration ${i}/${iterations} (T=${temperature.toFixed(3)})...`);

    const proposedTheta = perturbParameters(currentTheta, stepSizes, rng);
    const proposedDomain = decodeParameters(proposedTheta, initialDomain, bounds);

    const proposedEval = await computeFitness(
      proposedDomain, proposedTheta, validationSettings, fitnessWeights,
      useSeparation ? siblingDomains : [], i, onProgress
    );

    evaluations.push(proposedEval);

    const delta = proposedEval.fitness - currentEval.fitness;
    const acceptProbability = delta > 0 ? 1 : Math.exp(delta / temperature);

    if (rng() < acceptProbability) {
      currentTheta = proposedTheta;
      currentDomain = proposedDomain;
      currentEval = proposedEval;

      if (proposedEval.fitness > bestEval.fitness) {
        bestEval = proposedEval;
        onProgress?.(`New best: ${bestEval.fitness.toFixed(4)}`);
      }
    }

    convergenceHistory.push(bestEval.fitness);
    temperature *= coolingRate;

    await new Promise(resolve => setTimeout(resolve, 0));
  }

  return {
    initialConfig: initialDomain,
    optimizedConfig: bestEval.config,
    initialFitness,
    finalFitness: bestEval.fitness,
    improvement: bestEval.fitness - initialFitness,
    iterations: evaluations.length,
    evaluations,
    convergenceHistory,
    settings: optimizationSettings,
  };
}

/**
 * Main optimizer entry point
 */
export async function optimizeDomain(
  domain,
  validationSettings,
  fitnessWeights,
  optimizationSettings,
  siblingDomains = [],
  onProgress = null
) {
  const algorithm = optimizationSettings.algorithm || 'hillclimb';
  const bounds = DEFAULT_BOUNDS;
  const seed = `optimize-${domain.id}-${Date.now()}`;

  switch (algorithm) {
    case 'hillclimb':
      return hillclimb(domain, validationSettings, fitnessWeights, optimizationSettings, bounds, seed, siblingDomains, onProgress);

    case 'sim_anneal':
      return simulatedAnnealing(domain, validationSettings, fitnessWeights, optimizationSettings, bounds, seed, siblingDomains, onProgress);

    case 'ga':
      // Simplified: fall back to hill climbing
      onProgress?.('GA not available in browser, using hill climbing...');
      return hillclimb(domain, validationSettings, fitnessWeights, optimizationSettings, bounds, seed, siblingDomains, onProgress);

    case 'bayes':
      // Simplified: fall back to simulated annealing
      onProgress?.('Bayesian not available in browser, using simulated annealing...');
      return simulatedAnnealing(domain, validationSettings, fitnessWeights, optimizationSettings, bounds, seed, siblingDomains, onProgress);

    default:
      throw new Error(`Unknown algorithm: ${algorithm}`);
  }
}

/**
 * Generate test names using a domain
 */
export function generateTestNames(domain, count = 10, seed) {
  const rng = createRNG(seed || `test-${Date.now()}`);
  const names = [];

  for (let i = 0; i < count; i++) {
    names.push(generatePhonotacticName(rng, domain));
  }

  return names;
}
