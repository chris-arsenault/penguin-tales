/**
 * Name Forge Service
 *
 * Wrapper around name-forge lib for lore-weave integration.
 * Uses the exact same types as the UI - no mapping, no conversion.
 */

import {
  generate,
  generateOne,
  getMarkovModel,
  type Culture,
  type MarkovModel,
  type NamingDomain,
  type Project,
  type LexemeList,
  type Grammar,
  type Profile,
  type StrategyGroup,
  type Strategy,
  type GroupConditions,
} from 'name-forge';

// Re-export types for backward compatibility
export type {
  Culture,
  NamingDomain,
  LexemeList,
  Grammar,
  Profile,
  StrategyGroup,
  Strategy,
  GroupConditions,
};

/**
 * Project file type (same as name-forge Project)
 */
export type NameForgeProjectFile = Project;
export type NameForgeConfig = Project;

/**
 * Name generation service using name-forge lib.
 * Domain instantiates this with config and passes to framework.
 */
export class NameForgeService {
  private cultures: Record<string, Culture>;
  private markovModels: Map<string, MarkovModel> = new Map();

  constructor(config: NameForgeProjectFile) {
    if (!config.cultures || Object.keys(config.cultures).length === 0) {
      throw new Error('NameForgeService: config.cultures is empty');
    }

    // Use cultures directly - no conversion needed
    this.cultures = config.cultures;

    // Pre-load Markov models
    this.preloadMarkovModels();
  }

  /**
   * Pre-load Markov models referenced in grammars
   */
  private preloadMarkovModels(): void {
    const modelIds = new Set<string>();

    for (const culture of Object.values(this.cultures)) {
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

    // Note: getMarkovModel is async, models will be loaded on first use
    // For sync operation, call loadMarkovModels() after construction
  }

  /**
   * Ensure Markov models are loaded (call before generate if using markov)
   */
  async loadMarkovModels(): Promise<void> {
    const modelIds = new Set<string>();

    for (const culture of Object.values(this.cultures)) {
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
      if (!this.markovModels.has(modelId)) {
        const model = await getMarkovModel(modelId as any);
        if (model) {
          this.markovModels.set(modelId, model);
        }
      }
    }
  }

  /**
   * Generate a name for an entity.
   * Called by framework's addEntity() - templates don't call this directly.
   *
   * @param kind - Entity kind (npc, location, etc.)
   * @param subtype - Entity subtype
   * @param prominence - Prominence level
   * @param tags - Entity tags
   * @param cultureId - Culture to use for generation
   * @param context - Optional context for context: slots (e.g., { parent: "King Gorban" })
   */
  generate(
    kind: string,
    subtype: string,
    prominence: string,
    tags: string[],
    cultureId: string,
    context?: Record<string, string>
  ): string {
    const culture = this.cultures[cultureId];

    if (!culture) {
      const available = Object.keys(this.cultures).join(', ');
      throw new Error(
        `NameForgeService: culture '${cultureId}' not found. ` +
        `Available: ${available}`
      );
    }

    if (!culture.profiles || culture.profiles.length === 0) {
      throw new Error(
        `NameForgeService: culture '${cultureId}' has no profiles`
      );
    }

    return generateOne(
      culture,
      {
        cultureId: cultureId,
        kind: kind,
        subtype: subtype,
        prominence: prominence,
        tags: tags,
        context: context,
        seed: `${Date.now()}-${Math.random()}`,
      },
      this.markovModels
    );
  }

  /**
   * Generate multiple names for an entity type.
   */
  generateMany(
    count: number,
    kind: string,
    subtype: string,
    prominence: string,
    tags: string[],
    cultureId: string,
    context?: Record<string, string>
  ): string[] {
    const culture = this.cultures[cultureId];

    if (!culture) {
      const available = Object.keys(this.cultures).join(', ');
      throw new Error(
        `NameForgeService: culture '${cultureId}' not found. ` +
        `Available: ${available}`
      );
    }

    const result = generate(
      culture,
      {
        cultureId: cultureId,
        kind: kind,
        subtype: subtype,
        prominence: prominence,
        tags: tags,
        context: context,
        count: count,
        seed: `${Date.now()}-${Math.random()}`,
      },
      this.markovModels
    );

    return result.names;
  }

  /**
   * Get available culture IDs
   */
  getAvailableCultures(): string[] {
    return Object.keys(this.cultures);
  }
}
