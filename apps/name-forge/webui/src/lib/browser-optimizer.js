/**
 * Browser-compatible optimizer
 *
 * Thin wrapper around the name-forge lib optimizer.
 */

// Import algorithms directly
import { hillclimb } from '@lib/optimizer/hillclimb.js';
import { simulatedAnnealing } from '@lib/optimizer/sim-anneal.js';
import { bayesianOptimization } from '@lib/optimizer/bayesian.js';
import { geneticAlgorithm } from '@lib/optimizer/genetic.js';
import { DEFAULT_BOUNDS } from '@lib/optimizer/optimization.js';

// Import validation metrics
import { validateCapacity } from '@lib/validation/metrics/capacity.js';
import { validateDiffuseness } from '@lib/validation/metrics/diffuseness.js';
import { validateSeparation } from '@lib/validation/metrics/separation.js';

import { generatePhonotacticName } from '@lib/phonotactic-pipeline.js';
import { createRNG } from '@lib/utils/rng.js';

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
  const seed = `optimize-${domain.id}-${Date.now()}`;

  onProgress?.('Starting optimization...');

  try {
    let result;

    switch (algorithm) {
      case 'hillclimb':
        result = await hillclimb(
          domain,
          validationSettings,
          fitnessWeights,
          optimizationSettings,
          DEFAULT_BOUNDS,
          seed,
          siblingDomains
        );
        break;

      case 'sim_anneal':
        result = await simulatedAnnealing(
          domain,
          validationSettings,
          fitnessWeights,
          optimizationSettings,
          DEFAULT_BOUNDS,
          seed,
          siblingDomains
        );
        break;

      case 'bayes':
        result = await bayesianOptimization(
          domain,
          validationSettings,
          fitnessWeights,
          optimizationSettings,
          seed,
          siblingDomains
        );
        break;

      case 'ga':
        result = await geneticAlgorithm(
          domain,
          validationSettings,
          fitnessWeights,
          optimizationSettings,
          seed,
          siblingDomains
        );
        break;

      default:
        throw new Error(`Unknown algorithm: ${algorithm}`);
    }

    onProgress?.('Optimization complete!');
    return result;
  } catch (error) {
    onProgress?.(`Error: ${error.message}`);
    throw error;
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

/**
 * Validate a domain configuration
 *
 * Returns metrics without running full optimization.
 */
export async function validateDomain(domain, sampleSize = 500, siblingDomains = []) {
  const seed = `validate-${Date.now()}`;

  const capacityReport = validateCapacity(domain, { sampleSize, seed: `${seed}-cap` });
  const diffusenessReport = validateDiffuseness(domain, { sampleSize, seed: `${seed}-diff` });

  let separationReport = null;
  if (siblingDomains.length > 0) {
    const allDomains = [domain, ...siblingDomains];
    const perDomainSample = Math.floor(sampleSize / allDomains.length);
    separationReport = validateSeparation(allDomains, { sampleSize: perDomainSample, seed: `${seed}-sep` });
  }

  return {
    capacity: capacityReport,
    diffuseness: diffusenessReport,
    separation: separationReport,
  };
}

// Re-export useful constants
export { DEFAULT_BOUNDS };
