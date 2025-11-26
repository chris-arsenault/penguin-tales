/**
 * File Writer (Phase 5)
 *
 * Write generated lexemes to JSON files.
 */

import { writeFileSync, mkdirSync, existsSync } from "fs";
import { dirname } from "path";
import type { LexemeGenerationResult } from "../../lib/types/builder-spec.js";
import type { LexemeList } from "../../lib/types/profile.js";

/**
 * Write options
 */
export interface WriteOptions {
  metaDomain?: string; // Meta-domain (test, penguin, etc.)
  outputDir?: string; // Base output directory (overrides metaDomain if set)
  overwrite?: boolean; // Overwrite existing files
  prettyPrint?: boolean; // Format JSON with indentation
  verbose?: boolean; // Log file writes
}

/**
 * Write lexeme generation result to JSON file
 */
export function writeLexemeResult(
  result: LexemeGenerationResult,
  options?: WriteOptions
): string {
  const metaDomain = options?.metaDomain || 'test';
  const opts = {
    outputDir: options?.outputDir || `./data/${metaDomain}/lexemes`,
    overwrite: true,
    prettyPrint: true,
    verbose: false,
    ...options,
  };

  // Create LexemeList structure
  const lexemeList: { lexemeLists: LexemeList[] } = {
    lexemeLists: [
      {
        id: result.spec.id,
        description: result.spec.description,
        entries: result.entries,
      },
    ],
  };

  // Determine filename
  const filename = `${result.spec.cultureId}-${result.spec.pos}.json`;
  const filepath = `${opts.outputDir}/${filename}`;

  // Ensure directory exists
  ensureDirectoryExists(filepath);

  // Check if file exists
  if (!opts.overwrite && existsSync(filepath)) {
    throw new Error(`File already exists: ${filepath} (use --overwrite to replace)`);
  }

  // Write file
  const content = opts.prettyPrint
    ? JSON.stringify(lexemeList, null, 2)
    : JSON.stringify(lexemeList);

  writeFileSync(filepath, content + "\n", "utf-8");

  if (opts.verbose) {
    console.log(`  Written to: ${filepath}`);
  }

  return filepath;
}

/**
 * Write multiple lexeme results to a single file
 */
export function writeLexemeResults(
  results: LexemeGenerationResult[],
  outputPath: string,
  options?: WriteOptions
): string {
  const opts = {
    overwrite: true,
    prettyPrint: true,
    verbose: false,
    ...options,
  };

  // Combine into single structure
  const combined: { lexemeLists: LexemeList[] } = {
    lexemeLists: results.map((r) => ({
      id: r.spec.id,
      description: r.spec.description,
      entries: r.entries,
    })),
  };

  // Ensure directory exists
  ensureDirectoryExists(outputPath);

  // Check if file exists
  if (!opts.overwrite && existsSync(outputPath)) {
    throw new Error(`File already exists: ${outputPath} (use --overwrite to replace)`);
  }

  // Write file
  const content = opts.prettyPrint
    ? JSON.stringify(combined, null, 2)
    : JSON.stringify(combined);

  writeFileSync(outputPath, content + "\n", "utf-8");

  if (opts.verbose) {
    console.log(`  Written ${results.length} lexeme lists to: ${outputPath}`);
  }

  return outputPath;
}

/**
 * Ensure directory exists for a file path
 */
function ensureDirectoryExists(filepath: string): void {
  const dir = dirname(filepath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

/**
 * Generate summary report for generation results
 */
export function generateSummaryReport(
  lexemeResults: LexemeGenerationResult[]
): string {
  let report = "=== Generation Summary ===\n\n";

  // Lexeme stats
  if (lexemeResults.length > 0) {
    report += "Lexeme Lists:\n";
    let totalEntries = 0;
    let totalFiltered = 0;
    let totalTokens = 0;

    for (const result of lexemeResults) {
      totalEntries += result.entries.length;
      totalFiltered += result.filtered;
      totalTokens += result.metadata?.tokensUsed || 0;

      report += `  - ${result.spec.id}: ${result.entries.length} entries`;
      if (result.filtered > 0) {
        report += ` (${result.filtered} filtered)`;
      }
      report += "\n";
    }

    report += `\nTotal: ${totalEntries} entries, ${totalFiltered} filtered, ${totalTokens} tokens\n`;
  }

  return report;
}
