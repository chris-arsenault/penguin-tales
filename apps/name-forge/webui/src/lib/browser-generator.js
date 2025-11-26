/**
 * Browser-compatible name generator
 *
 * Generates names using profiles, domains, grammars, and lexemes
 * entirely in the browser (no server required).
 */

import { createRNG, pickRandom, pickWeighted } from '@lib/utils/rng.js';
import { generatePhonotacticName } from '@lib/phonotactic-pipeline.js';

/**
 * Generate test names using a profile
 *
 * @param {Object} options
 * @param {Object} options.profile - The naming profile with strategyGroups
 * @param {Array} options.domains - Available domains for phonotactic generation
 * @param {Array} options.grammars - Available grammars for grammar-based generation
 * @param {Object} options.lexemes - Lexeme lists keyed by ID
 * @param {number} options.count - Number of names to generate
 * @param {string} options.seed - Optional seed for reproducibility
 * @returns {Object} { names: string[], strategyUsage: Record<string, number> }
 */
export function generateTestNames({
  profile,
  domains = [],
  grammars = [],
  lexemes = {},
  count = 10,
  seed
}) {
  if (!profile) {
    throw new Error('Profile required');
  }

  const rng = createRNG(seed || `test-${Date.now()}`);
  const names = [];
  const strategyUsage = { grammar: 0, phonotactic: 0, fallback: 0 };

  // Get default strategy group (lowest priority / fallback)
  const groups = profile.strategyGroups || [];
  const sortedGroups = [...groups].sort((a, b) => (a.priority || 0) - (b.priority || 0));
  const defaultGroup = sortedGroups[0];

  if (!defaultGroup?.strategies?.length) {
    // No strategies - generate fallback names
    for (let i = 0; i < count; i++) {
      names.push(generateFallbackName(lexemes, rng, i));
      strategyUsage.fallback++;
    }
    return { names, strategyUsage };
  }

  const allStrategies = defaultGroup.strategies;

  // Calculate total weight
  const totalWeight = allStrategies.reduce((sum, s) => sum + (s.weight || 0), 0);

  // Separate strategies by type
  const grammarStrategies = allStrategies.filter(s => (s.type || s.kind) === 'grammar');
  const phonotacticStrategies = allStrategies.filter(s => (s.type || s.kind) === 'phonotactic');

  const grammarWeight = grammarStrategies.reduce((sum, s) => sum + (s.weight || 0), 0) / (totalWeight || 1);
  const phonotacticWeight = phonotacticStrategies.reduce((sum, s) => sum + (s.weight || 0), 0) / (totalWeight || 1);

  // Convert lexemes object to array for easier lookup
  const lexemeLists = Object.entries(lexemes)
    .filter(([, list]) => !list.type || list.type === 'lexeme')
    .map(([id, list]) => ({
      id,
      entries: list.entries || []
    }));

  for (let i = 0; i < count; i++) {
    let name;
    let strategyUsed;

    const roll = rng();

    if (grammarStrategies.length > 0 && roll < grammarWeight) {
      // Use grammar strategy
      const strategy = pickRandom(rng, grammarStrategies);
      const grammar = grammars.find(g => g.id === strategy.grammarId);

      if (grammar) {
        name = expandGrammar(grammar, lexemeLists, domains, rng);
        strategyUsed = 'grammar';
      } else {
        name = generateFallbackName(lexemes, rng, i);
        strategyUsed = 'fallback';
      }
    } else if (phonotacticStrategies.length > 0) {
      // Use phonotactic strategy
      const strategy = pickRandom(rng, phonotacticStrategies);
      const domain = domains.find(d => d.id === strategy.domainId);

      if (domain) {
        name = generatePhonotacticName(rng, domain);
        strategyUsed = 'phonotactic';
      } else if (domains.length > 0) {
        // Use any available domain
        name = generatePhonotacticName(rng, domains[0]);
        strategyUsed = 'phonotactic';
      } else {
        name = generateFallbackName(lexemes, rng, i);
        strategyUsed = 'fallback';
      }
    } else {
      name = generateFallbackName(lexemes, rng, i);
      strategyUsed = 'fallback';
    }

    strategyUsage[strategyUsed] = (strategyUsage[strategyUsed] || 0) + 1;
    names.push(name);
  }

  return { names, strategyUsage };
}

/**
 * Expand a grammar rule to generate a name
 *
 * Grammar format: { id, start, rules: { symbol: [["token1", "token2"], [...]] } }
 * Token types:
 *   - slot:lexeme_id   → pick from lexeme list
 *   - domain:domain_id → generate phonotactic name from domain
 *   - markov:model_id  → generate from Markov chain (not supported in browser)
 *   - other            → literal text or rule reference
 */
function expandGrammar(grammar, lexemeLists, domains, rng) {
  const startSymbol = grammar.start || 'name';
  const rules = grammar.rules || {};

  return expandSymbol(startSymbol, rules, lexemeLists, domains, rng, 0);
}

function expandSymbol(symbol, rules, lexemeLists, domains, rng, depth) {
  if (depth > 10) {
    return symbol; // Prevent infinite recursion
  }

  const productions = rules[symbol];
  if (!productions || productions.length === 0) {
    // No rule for this symbol - treat as literal/slot
    return resolveToken(symbol, lexemeLists, domains, rng, depth);
  }

  // Pick random production
  const production = pickRandom(rng, productions);

  // Expand each token in the production
  const parts = production.map(token => {
    // Check if token contains multiple references separated by hyphens
    if (token.includes('-') && (token.includes('slot:') || token.includes('domain:') || token.includes('markov:'))) {
      const subParts = token.split('-');
      return subParts.map(part => resolveToken(part.trim(), lexemeLists, domains, rng, depth)).join('-');
    }
    return resolveToken(token, lexemeLists, domains, rng, depth);
  });

  return parts.join(' ').trim();
}

function resolveToken(token, lexemeLists, domains, rng, depth = 0) {
  // Check for ^ terminator suffix (e.g., "domain:tech^'s" → resolve domain, append "'s")
  let suffix = '';
  let baseToken = token;
  const caretIndex = token.indexOf('^');
  if (caretIndex !== -1) {
    baseToken = token.substring(0, caretIndex);
    suffix = token.substring(caretIndex + 1);
  }

  // Handle slot:listId references (lexeme lists)
  if (baseToken.startsWith('slot:')) {
    const listId = baseToken.substring(5);
    const list = lexemeLists.find(l => l.id === listId);
    if (list && list.entries.length > 0) {
      return pickRandom(rng, list.entries) + suffix;
    }
    return listId + suffix; // Return the ID if list not found
  }

  // Handle domain:domainId references (phonotactic generation)
  if (baseToken.startsWith('domain:')) {
    const domainId = baseToken.substring(7);
    const domain = domains.find(d => d.id === domainId);
    if (domain) {
      return generatePhonotacticName(rng, domain) + suffix;
    }
    return domainId + suffix; // Return the ID if domain not found
  }

  // Handle markov:modelId references (not supported in browser without loading models)
  if (baseToken.startsWith('markov:')) {
    const modelId = baseToken.substring(7);
    // Fall back to a simple generated name since Markov models aren't loaded
    // Generate a pseudo-markov name using available domains
    if (domains.length > 0) {
      return generatePhonotacticName(rng, domains[0]) + suffix;
    }
    return modelId + suffix;
  }

  // Return literal as-is
  return token;
}

/**
 * Generate a fallback name from available lexeme lists
 */
function generateFallbackName(lexemes, rng, index) {
  const lexemeLists = Object.values(lexemes).filter(l => l.entries?.length > 0);

  if (lexemeLists.length === 0) {
    return `Name-${index + 1}`;
  }

  const parts = [];
  const numParts = Math.floor(rng() * 2) + 1; // 1-2 parts

  for (let i = 0; i < numParts; i++) {
    const list = pickRandom(rng, lexemeLists);
    if (list.entries.length > 0) {
      parts.push(pickRandom(rng, list.entries));
    }
  }

  if (parts.length === 0) {
    return `Name-${index + 1}`;
  }

  // Capitalize first letter
  const name = parts.join('-');
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/**
 * Generate names directly from a domain (without profile)
 */
export function generateNamesFromDomain(domain, count = 10, seed) {
  const rng = createRNG(seed || `domain-${Date.now()}`);
  const names = [];

  for (let i = 0; i < count; i++) {
    names.push(generatePhonotacticName(rng, domain));
  }

  return names;
}
