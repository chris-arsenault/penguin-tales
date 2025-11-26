#!/usr/bin/env node
/**
 * Markov Chain Trainer for Name Generation
 *
 * Trains character-level Markov chains from name lists.
 * Output is a compact JSON model that can be used for generation.
 *
 * Usage:
 *   node markov-trainer.js <input-file> <output-file> [order=3]
 *
 * Input: Text file with one name per line
 * Output: JSON model file
 */

const fs = require('fs');
const path = require('path');

const START = '^';
const END = '$';

function trainMarkovChain(names, order = 3) {
  const transitions = {};
  const startStates = {};

  for (const name of names) {
    if (!name || name.length < 2) continue;

    // Normalize: lowercase, trim
    const normalized = name.toLowerCase().trim();

    // Pad with start/end markers
    const padded = START.repeat(order) + normalized + END;

    // Record start state
    const startKey = padded.slice(0, order);
    startStates[startKey] = (startStates[startKey] || 0) + 1;

    // Build transition counts
    for (let i = 0; i < padded.length - order; i++) {
      const state = padded.slice(i, i + order);
      const next = padded[i + order];

      if (!transitions[state]) {
        transitions[state] = {};
      }
      transitions[state][next] = (transitions[state][next] || 0) + 1;
    }
  }

  // Convert counts to probabilities
  const model = {
    order,
    startStates: normalize(startStates),
    transitions: {}
  };

  for (const [state, nexts] of Object.entries(transitions)) {
    model.transitions[state] = normalize(nexts);
  }

  return model;
}

function normalize(counts) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const probs = {};
  for (const [key, count] of Object.entries(counts)) {
    probs[key] = Math.round((count / total) * 10000) / 10000; // 4 decimal places
  }
  return probs;
}

function generateName(model, minLen = 3, maxLen = 12) {
  const { order, startStates, transitions } = model;

  // Pick start state
  let state = weightedRandom(startStates);
  let result = '';

  for (let i = 0; i < maxLen + order; i++) {
    const nextProbs = transitions[state];
    if (!nextProbs) break;

    const next = weightedRandom(nextProbs);
    if (next === END) {
      if (result.length >= minLen) break;
      // Too short, try to continue
      continue;
    }

    result += next;
    state = state.slice(1) + next;
  }

  // Capitalize first letter
  return result.charAt(0).toUpperCase() + result.slice(1);
}

function weightedRandom(probs) {
  const r = Math.random();
  let sum = 0;
  for (const [item, prob] of Object.entries(probs)) {
    sum += prob;
    if (r <= sum) return item;
  }
  return Object.keys(probs)[0];
}

// Stats about model
function modelStats(model) {
  const stateCount = Object.keys(model.transitions).length;
  const avgTransitions = Object.values(model.transitions)
    .reduce((sum, t) => sum + Object.keys(t).length, 0) / stateCount;

  return {
    order: model.order,
    states: stateCount,
    avgTransitionsPerState: Math.round(avgTransitions * 10) / 10,
    sizeBytes: JSON.stringify(model).length
  };
}

// CLI
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.log('Usage: node markov-trainer.js <input-file> <output-file> [order=3]');
    console.log('');
    console.log('Example:');
    console.log('  node markov-trainer.js norse-names.txt models/norse.json 3');
    process.exit(1);
  }

  const [inputFile, outputFile, orderArg] = args;
  const order = parseInt(orderArg) || 3;

  // Read names
  const content = fs.readFileSync(inputFile, 'utf-8');
  const names = content.split('\n').filter(n => n.trim());

  console.log(`Training on ${names.length} names with order ${order}...`);

  // Train
  const model = trainMarkovChain(names, order);

  // Stats
  const stats = modelStats(model);
  console.log('Model stats:', stats);

  // Sample generation
  console.log('\nSample names:');
  for (let i = 0; i < 10; i++) {
    console.log(' ', generateName(model));
  }

  // Save
  fs.mkdirSync(path.dirname(outputFile), { recursive: true });
  fs.writeFileSync(outputFile, JSON.stringify(model, null, 2));
  console.log(`\nSaved to ${outputFile}`);
}

module.exports = { trainMarkovChain, generateName, modelStats };
