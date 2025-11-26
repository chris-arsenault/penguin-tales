/**
 * Fitness Worker for parallel evaluation
 *
 * This worker is spawned by Piscina to evaluate fitness in parallel threads.
 */

import { computeFitness } from "../fitness.js";
import type { NamingDomain } from "../../lib/types/domain.js";
import type {
  ValidationSettings,
  FitnessWeights,
  EvaluationResult,
} from "../optimization.js";

export interface FitnessTask {
  config: NamingDomain;
  validationSettings: ValidationSettings;
  fitnessWeights: FitnessWeights;
  siblingDomains: NamingDomain[];
  iteration: number;
}

/**
 * Worker entry point - evaluates fitness for a single configuration
 */
export default async function evaluateFitness(
  task: FitnessTask
): Promise<EvaluationResult> {
  const { config, validationSettings, fitnessWeights, siblingDomains, iteration } =
    task;

  return computeFitness(
    config,
    {
      consonantWeights: [],
      vowelWeights: [],
      templateWeights: [],
      structureWeights: [],
      apostropheRate: 0,
      hyphenRate: 0,
      lengthMin: 0,
      lengthMax: 0,
    },
    validationSettings,
    fitnessWeights,
    siblingDomains,
    iteration,
    false // not verbose in worker
  );
}
