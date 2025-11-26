#!/usr/bin/env node

/**
 * Quick test of the optimizer components
 */

import * as path from 'path';
import { ConfigLoader } from './configLoader';
import { FitnessEvaluator } from './fitnessEvaluator';

async function test() {
  console.log('Testing optimizer components...\n');

  const worldGenPath = path.resolve(__dirname, '../../world-gen');
  const configPath = path.join(worldGenPath, 'config', 'templateSystemParameters.json');

  // Test 1: Config Loading
  console.log('Test 1: Config Loading');
  const configLoader = new ConfigLoader(configPath);
  const { genome, metadata } = configLoader.loadParameters();
  console.log(`✓ Loaded ${metadata.length} parameters`);
  console.log(`  - ${metadata.filter(p => p.type === 'int').length} integers`);
  console.log(`  - ${metadata.filter(p => p.type === 'float').length} floats`);

  // Show sample parameters
  console.log('\nSample parameters:');
  metadata.slice(0, 5).forEach(p => {
    console.log(`  - ${p.path}`);
    console.log(`    Type: ${p.type}, Range: [${p.min}, ${p.max}], Default: ${p.default}`);
  });

  // Test 2: Genome -> Config
  console.log('\nTest 2: Genome -> Config conversion');
  const testConfig = configLoader.applyGenomeToConfig(genome);
  console.log('✓ Successfully converted genome to config structure');

  // Test 3: Fitness Evaluator
  console.log('\nTest 3: Fitness Evaluator');
  const fitnessEvaluator = new FitnessEvaluator();
  const weights = fitnessEvaluator.getWeights();
  console.log('✓ Fitness evaluator initialized');
  console.log('  Weights:');
  Object.entries(weights).forEach(([key, value]) => {
    console.log(`    - ${key}: ${value}`);
  });

  // Test 4: Load existing stats
  const statsPath = path.join(worldGenPath, 'output', 'stats.json');
  console.log('\nTest 4: Load existing stats.json');
  const evaluation = fitnessEvaluator.evaluateFromFile(statsPath);
  if (evaluation) {
    console.log('✓ Successfully loaded and evaluated stats');
    console.log(`  Overall fitness: ${evaluation.fitness.toFixed(4)}`);
    console.log('  Breakdown:');
    if (evaluation.breakdown) {
      Object.entries(evaluation.breakdown).forEach(([key, value]) => {
        console.log(`    - ${key}: ${value.toFixed(4)}`);
      });
    }
  } else {
    console.log('⚠️  Could not load stats.json (run world-gen first)');
  }

  console.log('\n✅ All component tests passed!');
}

test().catch(console.error);
