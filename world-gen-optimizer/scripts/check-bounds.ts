#!/usr/bin/env node

/**
 * Check if critical violation-related parameters are stuck at bounds
 */

import { ConfigLoader } from '../src/configLoader';
import * as path from 'path';
import * as fs from 'fs';

const worldGenPath = path.resolve(__dirname, '../../world-gen');
const configPath = path.join(worldGenPath, 'config', 'templateSystemParameters.json');

const configLoader = new ConfigLoader(configPath);
const { genome, metadata } = configLoader.loadParameters();

// Critical violation-related parameters
const criticalParams = [
  'relationship_decay',
  'relationship_reinforcement',
  'relationship_culling',
  'Decay',
  'reinforcement',
  'culling'
];

console.log('Checking if critical parameters are at bounds...\n');

let boundHits = 0;

for (const param of metadata) {
  const isCritical = criticalParams.some(keyword =>
    param.path.toLowerCase().includes(keyword.toLowerCase())
  );

  if (!isCritical) continue;

  const value = genome.get(param.path) || param.default;
  const range = param.max - param.min;
  const normalizedValue = (value - param.min) / range;

  const atMin = normalizedValue < 0.05;  // Within 5% of min
  const atMax = normalizedValue > 0.95;  // Within 5% of max

  if (atMin || atMax) {
    boundHits++;
    const boundType = atMin ? 'MIN' : 'MAX';
    console.log(`⚠️  ${param.path}`);
    console.log(`   At ${boundType}: ${value.toFixed(4)} (range: ${param.min} - ${param.max})`);
    console.log('');
  }
}

console.log(`\nTotal critical params at bounds: ${boundHits}`);

if (boundHits > 5) {
  console.log('\n❌ CONCLUSION: Many parameters stuck at bounds!');
  console.log('   → GA can\'t explore further');
  console.log('   → Need to widen parameter ranges OR');
  console.log('   → Violations are structurally unavoidable\n');
} else {
  console.log('\n✓ Most parameters have room to explore');
  console.log('  → Problem is likely structural, not bounds\n');
}
