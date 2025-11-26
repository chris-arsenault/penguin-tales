#!/usr/bin/env node

/**
 * FOCUSED OPTIMIZER - Only optimizes high-impact parameters
 *
 * Use this mode when:
 * - Standard optimization shows minimal improvement
 * - You want to focus on specific problems (violations, balance, etc.)
 * - You need faster iterations (fewer parameters = faster evaluation)
 */

import * as path from 'path';
import * as os from 'os';
import { ConfigLoader } from './configLoader';
import { FitnessEvaluator } from './fitnessEvaluator';
import { GeneticAlgorithm } from './geneticAlgorithm';
import { WorldGenRunner } from './worldGenRunner';
import { EvolutionTracker } from './tracker';
import { AdaptiveMutation } from './adaptiveMutation';
import { getFocusedParameters, expandParameterBounds } from './focusedOptimizer';
import { GAConfig, Population } from './types';

async function main() {
  console.log('========================================');
  console.log('FOCUSED PARAMETER OPTIMIZER');
  console.log('  Targeting: Violation-Critical Params');
  console.log('========================================\n');

  // Configuration
  const worldGenPath = path.resolve(__dirname, '../../world-gen');
  const configPath = path.join(worldGenPath, 'config', 'templateSystemParameters.json');
  const outputDir = path.resolve(__dirname, '../output');

  const gaConfig: GAConfig = {
    populationSize: 30,
    maxGenerations: 100,
    elitismCount: 3,
    mutationRate: 0.15,  // Higher base rate for focused params
    tournamentSize: 5,
    parallelExecutions: Math.min(os.cpus().length, 8)
  };

  console.log('Loading parameters...');
  const configLoader = new ConfigLoader(configPath);
  const { genome: baseGenome, metadata: allMetadata } = configLoader.loadParameters();

  // FOCUS ON VIOLATION-CRITICAL PARAMETERS ONLY
  const focusedMetadata = getFocusedParameters(allMetadata, 'violations');

  // Expand bounds for more aggressive exploration
  const expandedMetadata = focusedMetadata.map(m => expandParameterBounds(m, 2.5));

  console.log(`Total parameters: ${allMetadata.length}`);
  console.log(`Focused parameters: ${focusedMetadata.length} (violation-critical)`);
  console.log(`Parameter bounds expanded: 2.5x\n`);

  console.log('Focused parameters:');
  focusedMetadata.forEach(p => {
    const parts = p.path.split('.');
    const name = parts[parts.length - 1];
    console.log(`  - ${name}`);
  });
  console.log('');

  const fitnessEvaluator = new FitnessEvaluator();

  // More aggressive adaptive mutation for focused params
  const adaptiveMutation = new AdaptiveMutation(configLoader, expandedMetadata, {
    strategy: 'hybrid',
    impactBoostFactor: 8.0,          // Very high boost!
    initialMutationRate: 0.50,       // Start at 50%
    finalMutationRate: 0.10,         // End at 10%
    annealingSchedule: 'exponential'
  });

  // Create GA with focused parameters
  const geneticAlgorithm = new GeneticAlgorithm(gaConfig, configLoader, expandedMetadata, adaptiveMutation);
  const worldGenRunner = new WorldGenRunner(
    worldGenPath,
    configLoader,
    fitnessEvaluator,
    gaConfig.parallelExecutions
  );
  const tracker = new EvolutionTracker(outputDir, configLoader, 5);

  console.log('Fitness configuration:');
  console.log('  Violation penalty: 40% (PRIMARY FOCUS)');
  console.log('  Other components: 60%\n');

  console.log('Adaptive mutation (AGGRESSIVE):');
  console.log('  Initial: 50% → Final: 10%');
  console.log('  Impact boost: 8x for influential params');
  console.log('  Parameter bounds: 2.5x wider\n');

  // Create initial population
  console.log('Creating initial population...');

  // Create focused genome with only the parameters we're optimizing
  const focusedGenome = new Map();
  for (const param of focusedMetadata) {
    focusedGenome.set(param.path, baseGenome.get(param.path) || param.default);
  }

  let currentPopulation = geneticAlgorithm.createInitialPopulation(focusedGenome);

  // Evolution loop
  const startTime = Date.now();

  for (let generation = 0; generation < gaConfig.maxGenerations; generation++) {
    const genStartTime = Date.now();

    console.log(`\n${'='.repeat(60)}`);
    console.log(`Generation ${generation + 1}/${gaConfig.maxGenerations}`);
    console.log('='.repeat(60));

    // Merge focused genomes with full base genome for evaluation
    const fullPopulation = currentPopulation.map(ind => ({
      ...ind,
      genome: new Map([...baseGenome, ...ind.genome]) // Focused params override base
    }));

    // Evaluate population
    console.log(`Evaluating ${currentPopulation.length} individuals...`);
    const results = await worldGenRunner.evaluateBatch(fullPopulation);

    const failures = results.filter(r => !r.success);
    if (failures.length > 0) {
      console.warn(`⚠️  ${failures.length} evaluations failed`);
    }

    // Update with fitness (but keep focused genomes)
    currentPopulation = results.map((r, i) => ({
      ...r.individual,
      genome: currentPopulation[i].genome // Keep only focused params
    }));

    // Record for learning
    geneticAlgorithm.recordPopulation(currentPopulation);

    const stats = geneticAlgorithm.calculatePopulationStats(currentPopulation);

    const population: Population = {
      generation,
      individuals: currentPopulation,
      stats
    };

    tracker.recordGeneration(population);
    tracker.printProgress(generation);

    const genTime = ((Date.now() - genStartTime) / 1000).toFixed(1);
    console.log(`\nGeneration completed in ${genTime}s`);

    // Print impact report every 5 generations (more frequent for focused mode)
    if ((generation + 1) % 5 === 0) {
      const adaptive = geneticAlgorithm.getAdaptiveMutation();
      if (adaptive) {
        adaptive.printImpactReport();
      }
    }

    // Check convergence
    if (generation > 10 && stats.diversity < 0.03) {
      console.log('\n⚠️  Population converged. Stopping early.');
      break;
    }

    // Evolve
    if (generation < gaConfig.maxGenerations - 1) {
      currentPopulation = geneticAlgorithm.evolve(currentPopulation);
    }
  }

  // Cleanup
  worldGenRunner.cleanupAll();

  const totalTime = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
  console.log(`\nTotal optimization time: ${totalTime} minutes`);

  tracker.printSummary();
  tracker.saveAll();

  console.log('\n✅ Focused optimization complete!');
  console.log('Note: Only violation-critical parameters were optimized.');
  console.log('Other parameters remain at default values.');
}

main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
