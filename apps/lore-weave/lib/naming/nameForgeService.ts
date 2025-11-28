/**
 * Name Forge Service
 *
 * Wraps name-forge functionality for synchronous name generation.
 * Uses the webui project file format for configuration.
 */

import { createRNG, generatePhonotacticName, getMarkovModel } from 'name-forge';
import type { NamingDomain } from 'name-forge';

/**
 * Project file schema (exported from webui)
 */
export interface NameForgeProjectFile {
  id: string;
  name: string;
  version: string;
  createdAt: string;
  updatedAt: string;
  worldSchema: {
    hardState: Array<{ kind: string; subtype: string[]; status: string[] }>;
    relationships: Record<string, Record<string, string[]>>;
  };
  cultures: Record<string, CultureConfig>;
}

/**
 * Culture configuration within project file
 */
export interface CultureConfig {
  id: string;
  name: string;
  description: string;
  domains: NamingDomain[];
  lexemeLists: Record<string, LexemeListConfig>;
  lexemeSpecs: Record<string, unknown>;
  grammars: GrammarConfig[];
  profiles: ProfileConfig[];
}

export interface LexemeListConfig {
  id: string;
  description?: string;
  entries: string[];
  source?: string;
}

export interface GrammarConfig {
  id: string;
  start: string;
  rules: Record<string, string[][]>;
}

export interface ProfileConfig {
  id: string;
  name: string;
  strategyGroups: StrategyGroupConfig[];
}

export interface StrategyGroupConfig {
  name: string;
  priority: number;
  conditions: {
    entityKinds?: string[];
    prominence?: string[];
    subtypes?: string[];
    subtypeMatchAll?: boolean;
    tags?: string[];
    tagMatchAll?: boolean;
  } | null;
  strategies: StrategyConfig[];
}

export interface StrategyConfig {
  type: 'grammar' | 'phonotactic';
  weight: number;
  grammarId?: string;
  domainId?: string;
}

// Re-export for backward compatibility
export type NameForgeConfig = NameForgeProjectFile;

/**
 * Markov model cache
 */
const markovModelCache = new Map<string, MarkovModel>();

interface MarkovModel {
  startStates: Record<string, number>;
  transitions: Record<string, Record<string, number>>;
  order: number;
}

/**
 * Load a Markov model (from name-forge bundled data)
 */
function loadMarkovModel(modelId: string): MarkovModel | null {
  if (markovModelCache.has(modelId)) {
    return markovModelCache.get(modelId)!;
  }

  try {
    const model = getMarkovModel(modelId as any);
    if (model) {
      markovModelCache.set(modelId, model as unknown as MarkovModel);
      return model as unknown as MarkovModel;
    }
  } catch {
    // Model not available
  }

  return null;
}

/**
 * Weighted random selection
 */
function weightedRandom(probs: Record<string, number>, rng: () => number): string {
  const r = rng();
  let sum = 0;
  for (const [item, prob] of Object.entries(probs)) {
    sum += prob;
    if (r <= sum) return item;
  }
  return Object.keys(probs)[0];
}

/**
 * Generate from Markov model
 */
function generateFromMarkov(model: MarkovModel, rng: () => number): string {
  const minLength = 3;
  const maxLength = 12;

  let state = weightedRandom(model.startStates, rng);
  let result = '';

  for (let i = 0; i < maxLength + model.order; i++) {
    const nextProbs = model.transitions[state];
    if (!nextProbs) break;

    const next = weightedRandom(nextProbs, rng);
    if (next === '$') {
      if (result.length >= minLength) break;
      continue;
    }

    result += next;
    state = state.slice(1) + next;
  }

  return result.charAt(0).toUpperCase() + result.slice(1);
}

/**
 * Name generation service using name-forge.
 * Domain instantiates this with config and passes to framework.
 */
export class NameForgeService {
  private config: NameForgeProjectFile;
  private markovModels: Map<string, MarkovModel> = new Map();
  private markovModelsLoaded = false;

  constructor(config: NameForgeProjectFile) {
    this.config = config;

    if (!config.cultures || Object.keys(config.cultures).length === 0) {
      throw new Error('NameForgeService: config.cultures is empty');
    }

    // Pre-load Markov models referenced in grammars
    this.preloadMarkovModels();
  }

  /**
   * Pre-load Markov models referenced in grammars
   */
  private preloadMarkovModels(): void {
    if (this.markovModelsLoaded) return;

    const modelIds = new Set<string>();

    for (const culture of Object.values(this.config.cultures)) {
      for (const grammar of culture.grammars || []) {
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
    }

    for (const modelId of modelIds) {
      const model = loadMarkovModel(modelId);
      if (model) {
        this.markovModels.set(modelId, model);
      }
    }

    this.markovModelsLoaded = true;
  }

  /**
   * Generate a name for an entity.
   * Called by framework's addEntity() - templates don't call this directly.
   */
  generate(
    kind: string,
    subtype: string,
    prominence: string,
    tags: string[],
    culture: string
  ): string {
    const cultureConfig = this.config.cultures[culture];

    if (!cultureConfig) {
      const available = Object.keys(this.config.cultures).join(', ');
      throw new Error(
        `NameForgeService: culture '${culture}' not found. ` +
        `Available: ${available}`
      );
    }

    if (!cultureConfig.profiles || cultureConfig.profiles.length === 0) {
      throw new Error(
        `NameForgeService: culture '${culture}' has no profiles`
      );
    }

    // Find the best matching profile (first one for now)
    const profile = cultureConfig.profiles[0];

    // Find the best matching strategy group based on conditions
    const matchingGroup = this.findMatchingGroup(profile.strategyGroups, kind, subtype, tags, prominence);

    if (!matchingGroup || matchingGroup.strategies.length === 0) {
      throw new Error(
        `NameForgeService: no matching strategy group for ${kind}:${subtype} in culture '${culture}'`
      );
    }

    // Create RNG with unique seed
    const seed = `${Date.now()}-${Math.random()}`;
    const rng = createRNG(seed);

    // Pick a strategy based on weights
    const strategy = this.pickStrategy(matchingGroup.strategies, rng);

    // Execute the strategy
    if (strategy.type === 'grammar' && strategy.grammarId) {
      const grammar = cultureConfig.grammars.find(g => g.id === strategy.grammarId);
      if (grammar) {
        return this.expandGrammar(grammar, cultureConfig, rng);
      }
    }

    if (strategy.type === 'phonotactic' && strategy.domainId) {
      const domain = cultureConfig.domains.find(d => d.id === strategy.domainId);
      if (domain) {
        return generatePhonotacticName(rng, domain);
      }
    }

    // Fallback to phonotactic from any available domain
    if (cultureConfig.domains.length > 0) {
      return generatePhonotacticName(rng, cultureConfig.domains[0]);
    }

    throw new Error(
      `NameForgeService: failed to generate name for ${kind}:${subtype} in culture '${culture}'`
    );
  }

  /**
   * Find the best matching strategy group based on conditions
   */
  private findMatchingGroup(
    groups: StrategyGroupConfig[],
    kind: string,
    subtype: string,
    tags: string[],
    prominence: string
  ): StrategyGroupConfig | null {
    // Filter groups that match conditions
    const matchingGroups = groups.filter(group => {
      const conditions = group.conditions;
      if (!conditions) return true; // No conditions = matches everything

      // Check entityKinds
      if (conditions.entityKinds && conditions.entityKinds.length > 0) {
        if (!conditions.entityKinds.includes(kind)) return false;
      }

      // Check subtypes
      if (conditions.subtypes && conditions.subtypes.length > 0) {
        if (!conditions.subtypes.includes(subtype)) return false;
      }

      // Check prominence
      if (conditions.prominence && conditions.prominence.length > 0) {
        if (!conditions.prominence.includes(prominence)) return false;
      }

      // Check tags
      if (conditions.tags && conditions.tags.length > 0) {
        if (conditions.tagMatchAll) {
          if (!conditions.tags.every(t => tags.includes(t))) return false;
        } else {
          if (!conditions.tags.some(t => tags.includes(t))) return false;
        }
      }

      return true;
    });

    if (matchingGroups.length === 0) return null;

    // Sort by priority (lower = higher priority) and return first
    matchingGroups.sort((a, b) => a.priority - b.priority);
    return matchingGroups[0];
  }

  /**
   * Pick a strategy based on weights
   */
  private pickStrategy(strategies: StrategyConfig[], rng: () => number): StrategyConfig {
    if (strategies.length === 1) return strategies[0];

    const totalWeight = strategies.reduce((sum, s) => sum + s.weight, 0);
    if (totalWeight === 0) return strategies[0];

    let roll = rng() * totalWeight;
    for (const strategy of strategies) {
      roll -= strategy.weight;
      if (roll <= 0) return strategy;
    }

    return strategies[strategies.length - 1];
  }

  /**
   * Expand a grammar to generate a name
   */
  private expandGrammar(grammar: GrammarConfig, culture: CultureConfig, rng: () => number): string {
    const startSymbol = grammar.start || 'name';
    return this.expandSymbol(startSymbol, grammar.rules, culture, rng, 0);
  }

  private expandSymbol(
    symbol: string,
    rules: Record<string, string[][]>,
    culture: CultureConfig,
    rng: () => number,
    depth: number
  ): string {
    if (depth > 10) return symbol; // Prevent infinite recursion

    const productions = rules[symbol];
    if (!productions || productions.length === 0) {
      return this.resolveToken(symbol, culture, rng, depth);
    }

    // Pick random production
    const productionIndex = Math.floor(rng() * productions.length);
    const production = productions[productionIndex];

    // Expand each token in the production
    const parts = production.map(token => {
      if (rules[token]) {
        return this.expandSymbol(token, rules, culture, rng, depth + 1);
      }
      return this.resolveToken(token, culture, rng, depth);
    });

    return parts.join(' ').trim();
  }

  private resolveToken(token: string, culture: CultureConfig, rng: () => number, depth: number): string {
    // Check for ^ suffix (e.g., "domain:tech^'s")
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
      const list = culture.lexemeLists[listId];
      if (list && list.entries.length > 0) {
        const index = Math.floor(rng() * list.entries.length);
        return list.entries[index] + suffix;
      }
      return listId + suffix;
    }

    // Handle domain:domainId references (phonotactic generation)
    if (baseToken.startsWith('domain:')) {
      const domainId = baseToken.substring(7);
      const domain = culture.domains.find(d => d.id === domainId);
      if (domain) {
        return generatePhonotacticName(rng, domain) + suffix;
      }
      return domainId + suffix;
    }

    // Handle markov:modelId references
    if (baseToken.startsWith('markov:')) {
      const modelId = baseToken.substring(7);
      const model = this.markovModels.get(modelId);

      if (model) {
        return generateFromMarkov(model, rng) + suffix;
      }

      // Fallback to phonotactic if model not loaded
      if (culture.domains.length > 0) {
        return generatePhonotacticName(rng, culture.domains[0]) + suffix;
      }
      return modelId + suffix;
    }

    // Return literal as-is
    return token;
  }

  /**
   * Get available culture IDs (for error messages/debugging)
   */
  getAvailableCultures(): string[] {
    return Object.keys(this.config.cultures);
  }
}
