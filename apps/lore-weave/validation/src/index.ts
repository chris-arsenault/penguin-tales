#!/usr/bin/env node

/**
 * World-gen optimizer - Genetic algorithm for parameter optimization
 */

import * as path from 'path';
import * as os from 'os';
import { ConfigLoader } from './configLoader';
import { FitnessEvaluator } from './fitnessEvaluator';
import { GeneticAlgorithm } from './geneticAlgorithm';
import { WorldGenRunner } from './worldGenRunner';
import { EvolutionTracker } from './tracker';
import { AdaptiveMutation } from './adaptiveMutation';
import { GADiagnostics } from './diagnostics';
import { GAConfig, Population } from './types';

async function main() {
  console.log('========================================');
  console.log('WORLD-GEN GENETIC ALGORITHM OPTIMIZER');
  console.log('========================================\n');

  // Configuration
  const worldGenPath = path.resolve(__dirname, '../../world-gen');
  const configPath = path.join(worldGenPath, 'config', 'templateSystemParameters.json');
  const outputDir = path.resolve(__dirname, '../output');

  const gaConfig: GAConfig = {
    populationSize: 50,       // Increased for better diversity (was 30)
    maxGenerations: 100,
    elitismCount: 5,          // 10% elitism (5 out of 50)
    mutationRate: 0.1,        // Base mutation rate (adaptive will adjust)
    tournamentSize: 5,        // Tournament selection size
    parallelExecutions: Math.min(os.cpus().length, 8) // Use CPU cores, max 8
  };

  console.log('Configuration:');
  console.log(`  Population size: ${gaConfig.populationSize}`);
  console.log(`  Max generations: ${gaConfig.maxGenerations}`);
  console.log(`  Elitism: ${gaConfig.elitismCount} individuals`);
  console.log(`  Mutation rate: ${(gaConfig.mutationRate * 100).toFixed(0)}%`);
  console.log(`  Tournament size: ${gaConfig.tournamentSize}`);
  console.log(`  Parallel executions: ${gaConfig.parallelExecutions}`);
  console.log(`  World-gen path: ${worldGenPath}`);
  console.log(`  Config path: ${configPath}\n`);

  // Initialize components
  console.log('Initializing components...');
  const configLoader = new ConfigLoader(configPath);
  const { genome: baseGenome, metadata: parameterMetadata } = configLoader.loadParameters();

  console.log(`Loaded ${parameterMetadata.length} tunable parameters`);
  console.log(`  Integer parameters: ${parameterMetadata.filter(p => p.type === 'int').length}`);
  console.log(`  Float parameters: ${parameterMetadata.filter(p => p.type === 'float').length}\n`);

  const fitnessEvaluator = new FitnessEvaluator();

  // Initialize adaptive mutation
  const adaptiveMutation = new AdaptiveMutation(configLoader, parameterMetadata, {
    strategy: 'hybrid',              // Use combined strategies
    impactBoostFactor: 3.0,          // 3x mutation for high-impact params
    initialMutationRate: 0.15,       // Start with 15% mutation (more conservative)
    finalMutationRate: 0.05,         // End with 5% mutation
    annealingSchedule: 'exponential' // Exponential decay
  });

  const geneticAlgorithm = new GeneticAlgorithm(gaConfig, configLoader, parameterMetadata, adaptiveMutation);
  const worldGenRunner = new WorldGenRunner(
    worldGenPath,
    configLoader,
    fitnessEvaluator,
    gaConfig.parallelExecutions
  );
  const tracker = new EvolutionTracker(outputDir, configLoader, 5);
  const diagnostics = new GADiagnostics();

  console.log('Fitness weights:');
  const weights = fitnessEvaluator.getWeights();
  console.log(`  Entity distribution: ${weights.entityDistribution.toFixed(2)}`);
  console.log(`  Prominence distribution: ${weights.prominenceDistribution.toFixed(2)}`);
  console.log(`  Relationship diversity: ${weights.relationshipDiversity.toFixed(2)}`);
  console.log(`  Connectivity: ${weights.connectivity.toFixed(2)}`);
  console.log(`  Overall fitness: ${weights.overall.toFixed(2)}`);
  console.log(`  Violation penalty: 0.10\n`);

  console.log('Adaptive mutation enabled (hybrid strategy):');
  console.log(`  Initial mutation rate: 20% → 5% (exponential annealing)`);
  console.log(`  Impact-based boosting: 3x for influential parameters`);
  console.log(`  Component-focused: 2x for weak fitness components\n`);

  // Create initial population
  console.log('Creating initial population...');
  let currentPopulation = geneticAlgorithm.createInitialPopulation(baseGenome);

  // Evolution loop
  const startTime = Date.now();

  for (let generation = 0; generation < gaConfig.maxGenerations; generation++) {
    const genStartTime = Date.now();

    console.log(`\n${'='.repeat(60)}`);
    console.log(`Generation ${generation + 1}/${gaConfig.maxGenerations}`);
    console.log('='.repeat(60));

    // Evaluate population
    console.log(`Evaluating ${currentPopulation.length} individuals...`);
    const results = await worldGenRunner.evaluateBatch(currentPopulation);

    // Count failures
    const failures = results.filter(r => !r.success);
    if (failures.length > 0) {
      console.warn(`⚠️  ${failures.length} evaluations failed:`);
      failures.forEach(f => {
        console.warn(`   - ${f.individual.id}: ${f.error}`);
      });
    }

    // Update individuals with fitness scores
    currentPopulation = results.map(r => r.individual);

    // Record population for adaptive learning
    geneticAlgorithm.recordPopulation(currentPopulation);

    // Calculate population stats
    const stats = geneticAlgorithm.calculatePopulationStats(currentPopulation);

    const population: Population = {
      generation,
      individuals: currentPopulation,
      stats
    };

    // Track this generation
    tracker.recordGeneration(population);
    diagnostics.recordGeneration(population);

    tracker.printProgress(generation);

    const genTime = ((Date.now() - genStartTime) / 1000).toFixed(1);
    console.log(`\nGeneration completed in ${genTime}s`);

    // Print diagnostics every 5 generations
    if ((generation + 1) % 5 === 0) {
      diagnostics.printDiagnostics(generation);
    }

    // Print parameter impact report every 10 generations
    if ((generation + 1) % 10 === 0) {
      const adaptive = geneticAlgorithm.getAdaptiveMutation();
      if (adaptive) {
        adaptive.printImpactReport();
      }
    }

    // Check for convergence (optional early stopping)
    // Disabled - let it run full course to see if violations improve
    // if (generation > 10 && stats.diversity < 0.05) {
    //   console.log('\n⚠️  Population has converged (low diversity). Stopping early.');
    //   break;
    // }

    // Evolve to next generation (unless this is the last one)
    if (generation < gaConfig.maxGenerations - 1) {
      console.log('Evolving to next generation...');
      currentPopulation = geneticAlgorithm.evolve(currentPopulation);
    }
  }

  // Cleanup
  worldGenRunner.cleanupAll();

  // Final summary
  const totalTime = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
  console.log(`\nTotal optimization time: ${totalTime} minutes`);

  tracker.printSummary();

  // Save results
  console.log('\nSaving results...');
  tracker.saveAll();

  console.log('\n✅ Optimization complete!');
}

// Run main function
main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
