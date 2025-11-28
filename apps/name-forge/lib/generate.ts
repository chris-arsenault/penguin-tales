/**
 * Name Generation Engine
 *
 * Single entrypoint for all name generation in name-forge.
 * Extracted from webui/src/lib/browser-generator.js to provide
 * a reusable lib that works in browser and Node.js.
 */

import { createRNG, pickRandom } from "./utils/rng.js";
import { generatePhonotacticName } from "./phonotactic-pipeline.js";
import type { NamingDomain } from "./types/domain.js";
import type {
  Culture,
  Grammar,
  LexemeList,
  Profile,
  StrategyGroup,
  Strategy,
  GenerateRequest,
  GenerateResult,
} from "./types/project.js";

// ============================================================================
// Markov Types (inline to avoid circular deps with markov.ts)
// ============================================================================

export interface MarkovModel {
  order: number;
  startStates: Record<string, number>;
  transitions: Record<string, Record<string, number>>;
}

// ============================================================================
// Generation Context (internal)
// ============================================================================

interface GenerationContext {
  rng: () => number;
  domains: NamingDomain[];
  grammars: Grammar[];
  lexemeLists: LexemeList[];
  markovModels: Map<string, MarkovModel>;
  userContext: Record<string, string>;
}

interface GrammarExpansionContext {
  usedMarkov: boolean;
  userContext: Record<string, string>;
}

// ============================================================================
// Main Generation Function
// ============================================================================

/**
 * Generate names using a culture's configuration.
 *
 * @param culture - The culture containing domains, grammars, lexemes, profiles
 * @param request - Generation parameters
 * @param markovModels - Optional pre-loaded Markov models (keyed by model ID)
 * @returns Generated names and strategy usage statistics
 */
export function generate(
  culture: Culture,
  request: GenerateRequest,
  markovModels?: Map<string, MarkovModel>
): GenerateResult {
  const {
    profileId,
    kind,
    subtype,
    prominence,
    tags = [],
    context = {},
    count = 10,
    seed,
  } = request;

  // Find the profile
  const profile = profileId
    ? culture.profiles.find((p) => p.id === profileId)
    : culture.profiles[0];

  if (!profile) {
    throw new Error(
      `Profile not found: ${profileId || "(default)"} in culture ${culture.id}`
    );
  }

  // Build generation context
  const rng = createRNG(seed || `gen-${Date.now()}`);
  const genContext: GenerationContext = {
    rng,
    domains: culture.domains,
    grammars: culture.grammars,
    lexemeLists: Object.values(culture.lexemeLists),
    markovModels: markovModels || new Map(),
    userContext: context,
  };

  // Find matching strategy group
  const matchingGroup = findMatchingGroup(
    profile.strategyGroups,
    kind,
    subtype,
    prominence,
    tags
  );

  const names: string[] = [];
  const strategyUsage: Record<string, number> = {
    grammar: 0,
    phonotactic: 0,
    markov: 0,
    fallback: 0,
  };

  // Generate names
  for (let i = 0; i < count; i++) {
    const { name, strategyType } = generateSingleName(
      matchingGroup,
      genContext,
      i
    );
    names.push(name);
    strategyUsage[strategyType] = (strategyUsage[strategyType] || 0) + 1;
  }

  return { names, strategyUsage };
}

/**
 * Generate a single name for a specific entity.
 * Convenience function for lore-weave integration.
 *
 * @param culture - The culture to use
 * @param request - Generation parameters (count is ignored, always returns 1)
 * @param markovModels - Optional pre-loaded Markov models
 * @returns The generated name
 */
export function generateOne(
  culture: Culture,
  request: Omit<GenerateRequest, "count">,
  markovModels?: Map<string, MarkovModel>
): string {
  const result = generate(culture, { ...request, count: 1 }, markovModels);
  return result.names[0];
}

// ============================================================================
// Strategy Group Selection
// ============================================================================

/**
 * Find the best matching strategy group based on entity attributes.
 */
function findMatchingGroup(
  groups: StrategyGroup[],
  kind?: string,
  subtype?: string,
  prominence?: string,
  tags?: string[]
): StrategyGroup | null {
  if (!groups || groups.length === 0) {
    return null;
  }

  // Filter groups that match conditions
  const matchingGroups = groups.filter((group) => {
    const conditions = group.conditions;
    if (!conditions) return true; // No conditions = matches everything

    // Check entityKinds
    if (conditions.entityKinds && conditions.entityKinds.length > 0) {
      if (!kind || !conditions.entityKinds.includes(kind)) return false;
    }

    // Check subtypes
    if (conditions.subtypes && conditions.subtypes.length > 0) {
      if (conditions.subtypeMatchAll) {
        // All subtypes must match (doesn't make sense for single entity, but supported)
        if (!subtype || !conditions.subtypes.includes(subtype)) return false;
      } else {
        // Any subtype matches
        if (!subtype || !conditions.subtypes.includes(subtype)) return false;
      }
    }

    // Check prominence
    if (conditions.prominence && conditions.prominence.length > 0) {
      if (!prominence || !conditions.prominence.includes(prominence))
        return false;
    }

    // Check tags
    if (conditions.tags && conditions.tags.length > 0) {
      if (conditions.tagMatchAll) {
        // All tags must be present
        if (!conditions.tags.every((t) => tags?.includes(t))) return false;
      } else {
        // Any tag matches
        if (!conditions.tags.some((t) => tags?.includes(t))) return false;
      }
    }

    return true;
  });

  if (matchingGroups.length === 0) {
    // Fall back to first group (usually the default)
    return groups[0];
  }

  // Sort by priority (lower = higher priority) and return first
  matchingGroups.sort((a, b) => (a.priority || 0) - (b.priority || 0));
  return matchingGroups[0];
}

// ============================================================================
// Single Name Generation
// ============================================================================

/**
 * Generate a single name using the strategy group.
 */
function generateSingleName(
  group: StrategyGroup | null,
  ctx: GenerationContext,
  index: number
): { name: string; strategyType: string } {
  if (!group || !group.strategies || group.strategies.length === 0) {
    return {
      name: generateFallbackName(ctx.lexemeLists, ctx.rng, index),
      strategyType: "fallback",
    };
  }

  // Pick a strategy based on weights
  const strategy = pickWeightedStrategy(group.strategies, ctx.rng);

  if (strategy.type === "grammar" && strategy.grammarId) {
    const grammar = ctx.grammars.find((g) => g.id === strategy.grammarId);
    if (grammar) {
      const result = expandGrammar(grammar, ctx);
      return {
        name: result.name,
        strategyType: result.usedMarkov ? "markov" : "grammar",
      };
    }
  }

  if (strategy.type === "phonotactic" && strategy.domainId) {
    const domain = ctx.domains.find((d) => d.id === strategy.domainId);
    if (domain) {
      return {
        name: generatePhonotacticName(ctx.rng, domain),
        strategyType: "phonotactic",
      };
    }
    // Fall back to any available domain
    if (ctx.domains.length > 0) {
      return {
        name: generatePhonotacticName(ctx.rng, ctx.domains[0]),
        strategyType: "phonotactic",
      };
    }
  }

  return {
    name: generateFallbackName(ctx.lexemeLists, ctx.rng, index),
    strategyType: "fallback",
  };
}

/**
 * Pick a strategy using weighted random selection.
 */
function pickWeightedStrategy(
  strategies: Strategy[],
  rng: () => number
): Strategy {
  if (strategies.length === 1) return strategies[0];

  const totalWeight = strategies.reduce((sum, s) => sum + (s.weight || 0), 0);
  if (totalWeight === 0) return strategies[0];

  let roll = rng() * totalWeight;
  for (const strategy of strategies) {
    roll -= strategy.weight || 0;
    if (roll <= 0) return strategy;
  }

  return strategies[strategies.length - 1];
}

// ============================================================================
// Grammar Expansion
// ============================================================================

/**
 * Expand a grammar rule to generate a name.
 *
 * Token types:
 * - slot:listId     → pick from lexeme list
 * - domain:domainId → generate phonotactic name
 * - markov:modelId  → generate from Markov chain
 * - context:key     → use context value
 * - symbol          → expand another rule
 * - literal         → use as-is
 * - ^suffix         → append suffix (e.g., "domain:tech^'s")
 */
function expandGrammar(
  grammar: Grammar,
  ctx: GenerationContext
): { name: string; usedMarkov: boolean } {
  const startSymbol = grammar.start || "name";
  const rules = grammar.rules || {};
  const expansionCtx: GrammarExpansionContext = {
    usedMarkov: false,
    userContext: ctx.userContext,
  };

  const name = expandSymbol(startSymbol, rules, ctx, expansionCtx, 0);
  return { name, usedMarkov: expansionCtx.usedMarkov };
}

/**
 * Recursively expand a grammar symbol.
 */
function expandSymbol(
  symbol: string,
  rules: Record<string, string[][]>,
  ctx: GenerationContext,
  expansionCtx: GrammarExpansionContext,
  depth: number
): string {
  if (depth > 10) {
    return symbol; // Prevent infinite recursion
  }

  const productions = rules[symbol];
  if (!productions || productions.length === 0) {
    // No rule for this symbol - treat as terminal/slot
    return resolveToken(symbol, rules, ctx, expansionCtx, depth);
  }

  // Pick random production
  const production = pickRandom(ctx.rng, productions);

  // Expand each token in the production
  const parts = production.map((token) => {
    // Check if token contains multiple references separated by hyphens
    if (
      token.includes("-") &&
      (token.includes("slot:") ||
        token.includes("domain:") ||
        token.includes("markov:") ||
        token.includes("context:"))
    ) {
      const subParts = token.split("-");
      return subParts
        .map((part) => {
          const trimmed = part.trim();
          if (rules[trimmed]) {
            return expandSymbol(trimmed, rules, ctx, expansionCtx, depth + 1);
          }
          return resolveToken(trimmed, rules, ctx, expansionCtx, depth);
        })
        .join("-");
    }

    // Check if token is a rule reference (non-terminal)
    if (rules[token]) {
      return expandSymbol(token, rules, ctx, expansionCtx, depth + 1);
    }

    return resolveToken(token, rules, ctx, expansionCtx, depth);
  });

  return parts.join(" ").trim();
}

/**
 * Resolve a terminal token to its value.
 */
function resolveToken(
  token: string,
  rules: Record<string, string[][]>,
  ctx: GenerationContext,
  expansionCtx: GrammarExpansionContext,
  depth: number
): string {
  // Check for ^ suffix (e.g., "domain:tech^'s")
  let suffix = "";
  let baseToken = token;
  const caretIndex = token.indexOf("^");
  if (caretIndex !== -1) {
    baseToken = token.substring(0, caretIndex);
    suffix = token.substring(caretIndex + 1);
  }

  // Handle slot:listId references (lexeme lists)
  if (baseToken.startsWith("slot:")) {
    const listId = baseToken.substring(5);
    const list = ctx.lexemeLists.find((l) => l.id === listId);
    if (list && list.entries.length > 0) {
      return pickRandom(ctx.rng, list.entries) + suffix;
    }
    return listId + suffix; // Return the ID if list not found
  }

  // Handle domain:domainId references (phonotactic generation)
  if (baseToken.startsWith("domain:")) {
    const domainId = baseToken.substring(7);
    const domain = ctx.domains.find((d) => d.id === domainId);
    if (domain) {
      return generatePhonotacticName(ctx.rng, domain) + suffix;
    }
    return domainId + suffix; // Return the ID if domain not found
  }

  // Handle markov:modelId references
  if (baseToken.startsWith("markov:")) {
    const modelId = baseToken.substring(7);
    const model = ctx.markovModels.get(modelId);

    if (model) {
      expansionCtx.usedMarkov = true;
      return generateFromMarkovModel(model, ctx.rng) + suffix;
    }

    // Fallback to phonotactic if model not available
    if (ctx.domains.length > 0) {
      return generatePhonotacticName(ctx.rng, ctx.domains[0]) + suffix;
    }
    return modelId + suffix;
  }

  // Handle context:key references (user-provided context values)
  if (baseToken.startsWith("context:")) {
    const key = baseToken.substring(8);
    const value = expansionCtx.userContext[key];
    return (value !== undefined && value !== null ? String(value) : "") + suffix;
  }

  // Return literal as-is
  return token;
}

// ============================================================================
// Markov Generation
// ============================================================================

/**
 * Generate a name from a Markov model.
 */
function generateFromMarkovModel(
  model: MarkovModel,
  rng: () => number,
  options: { minLength?: number; maxLength?: number } = {}
): string {
  const { minLength = 3, maxLength = 12 } = options;

  // Pick start state using weighted random
  let state = weightedRandom(model.startStates, rng);
  let result = "";

  for (let i = 0; i < maxLength + model.order; i++) {
    const nextProbs = model.transitions[state];
    if (!nextProbs) break;

    const next = weightedRandom(nextProbs, rng);
    if (next === "$") {
      // END token
      if (result.length >= minLength) break;
      continue;
    }

    result += next;
    state = state.slice(1) + next;
  }

  // Capitalize first letter
  return result.charAt(0).toUpperCase() + result.slice(1);
}

/**
 * Weighted random selection from a probability distribution.
 */
function weightedRandom(
  probs: Record<string, number>,
  rng: () => number
): string {
  const r = rng();
  let sum = 0;
  for (const [item, prob] of Object.entries(probs)) {
    sum += prob;
    if (r <= sum) return item;
  }
  return Object.keys(probs)[0];
}

// ============================================================================
// Fallback Generation
// ============================================================================

/**
 * Generate a fallback name when no strategy works.
 */
function generateFallbackName(
  lexemeLists: LexemeList[],
  rng: () => number,
  index: number
): string {
  const nonEmptyLists = lexemeLists.filter((l) => l.entries?.length > 0);

  if (nonEmptyLists.length === 0) {
    return `Name-${index + 1}`;
  }

  const parts: string[] = [];
  const numParts = Math.floor(rng() * 2) + 1; // 1-2 parts

  for (let i = 0; i < numParts; i++) {
    const list = pickRandom(rng, nonEmptyLists);
    if (list.entries.length > 0) {
      parts.push(pickRandom(rng, list.entries));
    }
  }

  if (parts.length === 0) {
    return `Name-${index + 1}`;
  }

  // Capitalize first letter
  const name = parts.join("-");
  return name.charAt(0).toUpperCase() + name.slice(1);
}

// ============================================================================
// Utility: Generate from Domain Directly
// ============================================================================

/**
 * Generate names directly from a domain (without profile).
 * Useful for testing domains in isolation.
 */
export function generateFromDomain(
  domain: NamingDomain,
  count: number = 10,
  seed?: string
): string[] {
  const rng = createRNG(seed || `domain-${Date.now()}`);
  const names: string[] = [];

  for (let i = 0; i < count; i++) {
    names.push(generatePhonotacticName(rng, domain));
  }

  return names;
}

// ============================================================================
// Test Domain (for validation/optimizer)
// ============================================================================

export interface TestDomainResult {
  samples: string[];
  uniqueCount: number;
  avgLength: number;
  minLength: number;
  maxLength: number;
}

/**
 * Test a domain by generating samples and computing statistics.
 * Used by validation metrics.
 */
export function testDomain(
  domain: NamingDomain,
  sampleSize: number = 100,
  seed?: string
): TestDomainResult {
  const samples = generateFromDomain(domain, sampleSize, seed);
  const uniqueSet = new Set(samples);

  const lengths = samples.map((s) => s.length);
  const totalLength = lengths.reduce((a, b) => a + b, 0);

  return {
    samples,
    uniqueCount: uniqueSet.size,
    avgLength: totalLength / samples.length,
    minLength: Math.min(...lengths),
    maxLength: Math.max(...lengths),
  };
}
