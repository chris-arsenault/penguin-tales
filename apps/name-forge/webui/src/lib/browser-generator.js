/**
 * Browser-compatible name generator
 *
 * Thin wrapper around the name-forge lib that handles:
 * 1. Async Markov model loading from public directory
 * 2. Calling the lib's generate() function
 */

import { generate, generateFromDomain } from '@lib/generate.js';

// Markov model cache
const markovModelCache = new Map();

/**
 * Load a Markov model from the public directory
 */
async function loadMarkovModel(modelId) {
  if (markovModelCache.has(modelId)) {
    return markovModelCache.get(modelId);
  }

  try {
    const response = await fetch(`${import.meta.env.BASE_URL}markov-models/${modelId}.json`);
    if (!response.ok) {
      console.warn(`Markov model '${modelId}' not found`);
      return null;
    }
    const model = await response.json();
    markovModelCache.set(modelId, model);
    return model;
  } catch (error) {
    console.warn(`Failed to load Markov model '${modelId}':`, error);
    return null;
  }
}

/**
 * Pre-load Markov models referenced in grammars
 */
async function preloadMarkovModels(grammars) {
  const modelIds = new Set();

  for (const grammar of grammars) {
    for (const productions of Object.values(grammar.rules || {})) {
      for (const production of productions) {
        for (const token of production) {
          if (token.includes('markov:')) {
            const match = token.match(/markov:([a-z]+)/);
            if (match) {
              modelIds.add(match[1]);
            }
          }
        }
      }
    }
  }

  const models = new Map();
  await Promise.all(
    Array.from(modelIds).map(async (id) => {
      const model = await loadMarkovModel(id);
      if (model) {
        models.set(id, model);
      }
    })
  );

  return models;
}

/**
 * Generate names using a culture's configuration.
 *
 * @param {Object} options
 * @param {Object} options.culture - The culture object (from project.cultures[id])
 * @param {string} options.profileId - Which profile to use (optional, uses first if not specified)
 * @param {number} options.count - Number of names to generate
 * @param {string} options.seed - Optional seed for reproducibility
 * @param {Object} options.context - Context key-value pairs for context:key slots
 * @param {string} options.kind - Entity kind for condition matching
 * @param {string} options.subtype - Entity subtype for condition matching
 * @param {string} options.prominence - Prominence level for condition matching
 * @param {string[]} options.tags - Tags for condition matching
 * @returns {Promise<Object>} { names: string[], strategyUsage: Record<string, number> }
 */
export async function generateTestNames({
  culture,
  profileId,
  count = 10,
  seed,
  context = {},
  kind,
  subtype,
  prominence,
  tags = []
}) {
  if (!culture) {
    throw new Error('Culture required');
  }

  if (!culture.profiles || culture.profiles.length === 0) {
    throw new Error('Culture has no profiles');
  }

  // Pre-load any Markov models referenced in grammars
  const markovModels = await preloadMarkovModels(culture.grammars || []);

  // Call the lib's generate function directly with the culture
  const result = generate(culture, {
    cultureId: culture.id,
    profileId: profileId,
    context: context,
    count: count,
    seed: seed || `test-${Date.now()}`,
    kind: kind,
    subtype: subtype,
    prominence: prominence,
    tags: tags
  }, markovModels);

  return result;
}

/**
 * Generate names directly from a domain (without profile)
 */
export function generateNamesFromDomain(domain, count = 10, seed) {
  return generateFromDomain(domain, count, seed);
}
