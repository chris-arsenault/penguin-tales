/**
 * Name Forge Service
 *
 * Thin wrapper around name-forge lib for lore-weave integration.
 * Uses the exact same types as name-forge - no mapping, no conversion.
 */

import {
  generateOne,
  type Culture,
  type Project,
} from 'name-forge';

// Re-export types for external use
export type {
  Culture,
  NamingDomain,
  LexemeList,
  Grammar,
  Profile,
  StrategyGroup,
  Strategy,
  GroupConditions,
} from 'name-forge';

/**
 * Project file type (same as name-forge Project)
 */
export type NameForgeProjectFile = Project;
export type NameForgeConfig = Project;

/**
 * Stats tracking for name generation
 */
export interface NameForgeStats {
  total: number;
  successes: number;
  failures: number;
  // culture -> kind -> { calls, failures }
  byCultureAndKind: Record<string, Record<string, { calls: number; failures: number }>>;
}

/**
 * Name generation service using name-forge lib.
 * Domain instantiates this with config and passes to framework.
 */
export class NameForgeService {
  private cultures: Record<string, Culture>;
  private stats: NameForgeStats;

  constructor(config: NameForgeProjectFile) {
    if (!config.cultures || Object.keys(config.cultures).length === 0) {
      throw new Error('NameForgeService: config.cultures is empty');
    }

    // Use cultures directly - no conversion needed
    this.cultures = config.cultures;

    // Initialize stats
    this.stats = {
      total: 0,
      successes: 0,
      failures: 0,
      byCultureAndKind: {},
    };
  }

  /**
   * Track a call result
   */
  private trackCall(culture: string, kind: string, success: boolean): void {
    this.stats.total++;
    if (success) {
      this.stats.successes++;
    } else {
      this.stats.failures++;
    }

    if (!this.stats.byCultureAndKind[culture]) {
      this.stats.byCultureAndKind[culture] = {};
    }
    if (!this.stats.byCultureAndKind[culture][kind]) {
      this.stats.byCultureAndKind[culture][kind] = { calls: 0, failures: 0 };
    }
    this.stats.byCultureAndKind[culture][kind].calls++;
    if (!success) {
      this.stats.byCultureAndKind[culture][kind].failures++;
    }
  }

  /**
   * Generate a name for an entity.
   *
   * @param kind - Entity kind (npc, location, etc.)
   * @param subtype - Entity subtype
   * @param prominence - Prominence level
   * @param tags - Entity tags (keys only, for condition matching)
   * @param cultureId - Culture to use for generation
   * @param context - Optional context for context: slots (e.g., { parent: "King Gorban" })
   * @returns Generated name, or 'unnamed' if generation fails
   */
  async generate(
    kind: string,
    subtype: string,
    prominence: string,
    tags: string[],
    cultureId: string,
    context?: Record<string, string>
  ): Promise<string> {
    const culture = this.cultures[cultureId];

    if (!culture) {
      console.error(
        `[NameForge] Culture '${cultureId}' not found. ` +
        `Available: ${Object.keys(this.cultures).join(', ')}`
      );
      this.trackCall(cultureId, kind, false);
      return 'unnamed';
    }

    if (!culture.profiles || culture.profiles.length === 0) {
      console.error(
        `[NameForge] Culture '${cultureId}' has no profiles`
      );
      this.trackCall(cultureId, kind, false);
      return 'unnamed';
    }

    try {
      const name = await generateOne(culture, {
        cultureId,
        kind,
        subtype,
        prominence,
        tags,
        context,
        seed: `${Date.now()}-${Math.random()}`,
      });

      if (!name) {
        console.warn(
          `[NameForge] Empty name returned for ${kind}:${subtype} ` +
          `(culture: ${cultureId}, tags: [${tags.join(', ')}])`
        );
        this.trackCall(cultureId, kind, false);
        return 'unnamed';
      }

      this.trackCall(cultureId, kind, true);
      return name;
    } catch (error) {
      console.error(
        `[NameForge] Generation failed for ${kind}:${subtype}:`,
        error instanceof Error ? error.message : error
      );
      this.trackCall(cultureId, kind, false);
      return 'unnamed';
    }
  }

  /**
   * Get available culture IDs
   */
  getAvailableCultures(): string[] {
    return Object.keys(this.cultures);
  }

  /**
   * Get name generation statistics
   */
  getStats(): NameForgeStats {
    return { ...this.stats };
  }

  /**
   * Print name generation statistics to console
   */
  printStats(): void {
    const { total, successes, failures, byCultureAndKind } = this.stats;

    if (total === 0) {
      console.log('\n📛 Name Generation: No calls made');
      return;
    }

    const successRate = ((successes / total) * 100).toFixed(1);

    console.log('\n📛 Name Generation Statistics:');
    console.log(`   Total: ${total} calls (${successes} success, ${failures} failed)`);
    console.log(`   Success rate: ${successRate}%`);

    // Print per culture/kind breakdown
    const cultures = Object.keys(byCultureAndKind).sort();
    for (const culture of cultures) {
      const kinds = byCultureAndKind[culture];
      const kindNames = Object.keys(kinds).sort();

      console.log(`   ${culture}:`);
      for (const kind of kindNames) {
        const { calls, failures: kindFailures } = kinds[kind];
        const failStr = kindFailures > 0 ? ` (${kindFailures} failed)` : '';
        console.log(`      ${kind}: ${calls}${failStr}`);
      }
    }

    if (failures > 0) {
      console.warn(`   ⚠️  ${failures} name generation failures`);
    }
  }
}
