#!/usr/bin/env node
/**
 * CLI for automated content generation (Phase 5)
 *
 * Usage:
 *   npm run generate -- lexeme <spec-file>
 *   npm run generate -- batch <spec-file>
 */

import { Command } from "commander";
import { createLLMClient } from "./builder/llm-client.js";
import { generateLexemeList, generateLexemeLists } from "./builder/lexeme-generator.js";
import {
  loadLexemeSlotSpec,
  loadBatchSpec,
} from "./builder/spec-loader.js";
import {
  writeLexemeResult,
  writeLexemeResults,
  generateSummaryReport,
} from "./builder/file-writer.js";
import type { LLMConfig } from "../lib/types/builder-spec.js";

const program = new Command();

program
  .name("namegen-generate")
  .description("Automated content generation for world-gen-naming")
  .version("0.1.0");

/**
 * Generate lexeme list from spec
 */
program
  .command("lexeme")
  .description("Generate a lexeme list from a spec file")
  .argument("<spec-file>", "Path to lexeme slot spec JSON file")
  .option("-o, --output <dir>", "Output directory", "./lexemes")
  .option("--no-overwrite", "Don't overwrite existing files")
  .option("--api-key <key>", "Anthropic API key (or use ANTHROPIC_API_KEY env)")
  .option("--model <name>", "Model to use", "claude-haiku-4-5-20251001")
  .option("--temperature <temp>", "Temperature (0-1)", "1.0")
  .option("-v, --verbose", "Verbose output", false)
  .action(async (specFile, options) => {
    try {
      console.log(`Loading spec from: ${specFile}`);
      const spec = loadLexemeSlotSpec(specFile);

      const llmConfig: LLMConfig = {
        provider: "anthropic",
        apiKey: options.apiKey,
        model: options.model,
        temperature: parseFloat(options.temperature),
      };

      const client = createLLMClient(llmConfig);

      const result = await generateLexemeList(spec, client, {
        verbose: options.verbose,
      });

      const filepath = writeLexemeResult(result, {
        outputDir: options.output,
        overwrite: options.overwrite,
        verbose: options.verbose,
      });

      console.log(`\n✅ Generated ${result.entries.length} entries`);
      console.log(`   Written to: ${filepath}`);

      if (result.filtered > 0) {
        console.log(`   Filtered: ${result.filtered} entries`);
      }
    } catch (error) {
      console.error(`\n❌ Error: ${(error as Error).message}`);
      process.exit(1);
    }
  });

/**
 * Generate batch (multiple lexemes)
 */
program
  .command("batch")
  .description("Generate multiple lexemes from a batch spec")
  .argument("<spec-file>", "Path to batch spec JSON file")
  .option("-o, --output <dir>", "Lexeme output directory", "./lexemes")
  .option("--no-overwrite", "Don't overwrite existing files")
  .option("--api-key <key>", "Anthropic API key (or use ANTHROPIC_API_KEY env)")
  .option("--model <name>", "Model to use", "claude-haiku-4-5-20251001")
  .option("--temperature <temp>", "Temperature (0-1)", "1.0")
  .option("-v, --verbose", "Verbose output", false)
  .option("--continue-on-error", "Continue even if some generations fail", true)
  .action(async (specFile, options) => {
    try {
      console.log(`Loading batch spec from: ${specFile}`);
      const batch = loadBatchSpec(specFile);

      const llmConfig: LLMConfig = {
        provider: "anthropic",
        apiKey: options.apiKey,
        model: options.model,
        temperature: parseFloat(options.temperature),
      };

      const client = createLLMClient(llmConfig);

      const startTime = Date.now();

      // Generate lexemes
      const lexemeResults = await generateLexemeLists(
        batch.lexemeSpecs,
        client,
        {
          verbose: options.verbose,
          continueOnError: options.continueOnError,
        }
      );

      // Write lexeme results
      for (const result of lexemeResults.results) {
        writeLexemeResult(result, {
          outputDir: options.output,
          overwrite: options.overwrite,
          verbose: options.verbose,
        });
      }

      const duration = Date.now() - startTime;

      // Print summary
      console.log("\n" + generateSummaryReport(lexemeResults.results));

      console.log(`Duration: ${(duration / 1000).toFixed(1)}s`);

      // Report errors
      if (lexemeResults.errors.length > 0) {
        console.log(`\n⚠️  ${lexemeResults.errors.length} generation(s) failed`);
        process.exit(1);
      } else {
        console.log(`\n✅ Batch generation complete!`);
      }
    } catch (error) {
      console.error(`\n❌ Error: ${(error as Error).message}`);
      process.exit(1);
    }
  });

program.parse();
