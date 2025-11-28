/**
 * Name Forge Service
 *
 * Wraps name-forge library for synchronous name generation.
 * Framework owns this so domain never imports name-forge directly.
 */

import {
  generateFromProfile,
  resolveProfile,
  type ExecutionContext,
  type NamingProfile,
  type NamingDomain,
  type LexemeList,
  type GrammarRule,
} from 'name-forge';

/**
 * Name Forge culture configuration
 */
export interface NameForgeCultureConfig {
  id: string;
  name: string;
  domains: NamingDomain[];
  lexemeLists: Record<string, LexemeList>;
  grammars: GrammarRule[];
  profiles: NamingProfile[];
}

/**
 * Name Forge configuration (exported JSON from web UI)
 */
export interface NameForgeConfig {
  cultures: Record<string, NameForgeCultureConfig>;
}

/**
 * Name generation service using name-forge.
 * Domain instantiates this with config and passes to framework.
 */
export class NameForgeService {
  private config: NameForgeConfig;

  constructor(config: NameForgeConfig) {
    this.config = config;

    if (Object.keys(config.cultures).length === 0) {
      throw new Error('NameForgeService: config.cultures is empty');
    }
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

    if (cultureConfig.profiles.length === 0) {
      throw new Error(
        `NameForgeService: culture '${culture}' has no profiles`
      );
    }

    // Find the profile matching culture + entity kind
    const profile = resolveProfile(culture, kind, cultureConfig.profiles);

    if (!profile) {
      throw new Error(
        `NameForgeService: no profile found for culture '${culture}' and kind '${kind}'. ` +
        `Available profiles: ${cultureConfig.profiles.map(p => p.id).join(', ')}`
      );
    }

    const execContext: ExecutionContext = {
      domains: cultureConfig.domains,
      profiles: cultureConfig.profiles,
      lexemeLists: Object.values(cultureConfig.lexemeLists),
      grammarRules: cultureConfig.grammars,
      seed: `${Date.now()}-${Math.random()}`,
      entityAttributes: {
        tags,
        prominence: prominence as any,
        subtype,
      },
    };

    return generateFromProfile(profile, execContext);
  }

  /**
   * Get available culture IDs (for error messages/debugging)
   */
  getAvailableCultures(): string[] {
    return Object.keys(this.config.cultures);
  }
}
