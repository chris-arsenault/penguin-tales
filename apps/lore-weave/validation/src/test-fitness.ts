#!/usr/bin/env node

/**
 * Test fitness function to ensure it's not backwards
 */

import { FitnessEvaluator } from './fitnessEvaluator';
import { WorldGenStats } from './types';

console.log('Testing Fitness Function Logic\n');
console.log('===============================\n');

const evaluator = new FitnessEvaluator();

// Test case 1: Low violations (good)
const goodStats: WorldGenStats = {
  fitnessMetrics: {
    entityDistributionFitness: 0.85,
    prominenceDistributionFitness: 0.85,
    relationshipDiversityFitness: 0.85,
    connectivityFitness: 0.85,
    overallFitness: 0.85,
    constraintViolations: 0,
    convergenceRate: 0.8,
    stabilityScore: 0.8
  },
  validationStats: {
    totalChecks: 5,
    passed: 5,
    failed: 0
  },
  performanceStats: {
    protectedRelationshipViolations: {
      totalViolations: 100,
      violationsByKind: {},
      violationRate: 1.0,  // LOW violations (good!)
      avgStrength: 0.9
    }
  },
  finalEntityCount: 150,
  finalRelationshipCount: 300,
  totalTicks: 120,
  generationTimeMs: 800
};

// Test case 2: High violations (bad)
const badStats: WorldGenStats = {
  ...goodStats,
  performanceStats: {
    protectedRelationshipViolations: {
      totalViolations: 1500,
      violationsByKind: {},
      violationRate: 15.0,  // HIGH violations (bad!)
      avgStrength: 0.1
    }
  }
};

const goodResult = evaluator.evaluateIndividual(goodStats);
const badResult = evaluator.evaluateIndividual(badStats);

console.log('Test Case 1: LOW violations (1.0/tick)');
console.log(`  Fitness: ${goodResult.fitness.toFixed(4)}`);
console.log(`  Violation score: ${goodResult.violationMetrics?.violationScore.toFixed(4)}`);

console.log('\nTest Case 2: HIGH violations (15.0/tick)');
console.log(`  Fitness: ${badResult.fitness.toFixed(4)}`);
console.log(`  Violation score: ${badResult.violationMetrics?.violationScore.toFixed(4)}`);

console.log('\n--- VALIDATION ---');

const correct = goodResult.fitness > badResult.fitness;
const fitnessGap = goodResult.fitness - badResult.fitness;

if (correct) {
  console.log(`✅ PASSED: Low violations = HIGHER fitness`);
  console.log(`   Fitness gap: ${fitnessGap.toFixed(4)}`);
  console.log(`   ${(fitnessGap / goodResult.fitness * 100).toFixed(1)}% difference`);
} else {
  console.log(`❌ FAILED: Fitness function is BACKWARDS!`);
  console.log(`   Low violations got: ${goodResult.fitness.toFixed(4)}`);
  console.log(`   High violations got: ${badResult.fitness.toFixed(4)}`);
  console.log(`   BUG: We're PENALIZING good configs!`);
}

// Test population size sensitivity
console.log('\n--- POPULATION SIZE ANALYSIS ---');
const popSizes = [10, 20, 30, 50, 100];

console.log('\nPopulation size vs genetic diversity:');
popSizes.forEach(size => {
  // Rough estimate: diversity ∝ sqrt(popSize) for tournament selection
  const tournamentSize = 5;
  const selectionPressure = tournamentSize / size;
  const diversityFactor = Math.sqrt(size) / 10;

  console.log(`  ${size} individuals: diversity factor ${diversityFactor.toFixed(2)}, pressure ${selectionPressure.toFixed(3)}`);
});

console.log('\nRecommendation:');
console.log('  Current: 30 individuals (diversity factor: 0.55)');
console.log('  For 60+ parameters: Consider 50-100 individuals');
console.log('  For focused mode (13 params): 30 is reasonable');

// Test mutation rate sensitivity
console.log('\n--- MUTATION RATE ANALYSIS ---');
const paramCount = 60;
const mutationRates = [0.05, 0.10, 0.20, 0.40];

console.log('\nMutation rate vs parameters changed per child:');
mutationRates.forEach(rate => {
  const avgParamsChanged = paramCount * rate;
  console.log(`  ${(rate * 100).toFixed(0)}% mutation: ~${avgParamsChanged.toFixed(0)} params changed per individual`);
});

console.log('\nCurrent settings:');
console.log('  Initial: 40% = ~24 params changed per individual (VERY aggressive)');
console.log('  Final: 8% = ~5 params changed per individual');
console.log('\n⚠️  If violations going UP, mutation might be TOO aggressive!');
console.log('     Try reducing initialMutationRate to 0.15-0.20');
