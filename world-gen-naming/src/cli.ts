#!/usr/bin/env node

import { Command } from "commander";
import { readFileSync } from "fs";
import { resolve } from "path";
import {
  NamingDomainSchema,
  DomainCollectionSchema,
  GenerationRequestSchema,
} from "./types/schema.js";
import type { NamingDomain, GenerationRequest } from "./types/domain.js";
import {
  generateNames,
  generateUniqueNames,
  explainGeneration,
  testDomain,
} from "./lib/generator.js";

const program = new Command();

program
  .name("namegen")
  .description("Domain-aware procedural name generation CLI")
  .version("0.1.0");

/**
 * Load domain(s) from a JSON file
 */
function loadDomains(path: string): NamingDomain[] {
  const fullPath = resolve(path);
  const content = readFileSync(fullPath, "utf-8");
  const json = JSON.parse(content);

  // Try parsing as single domain
  const singleResult = NamingDomainSchema.safeParse(json);
  if (singleResult.success) {
    return [singleResult.data];
  }

  // Try parsing as domain collection
  const collectionResult = DomainCollectionSchema.safeParse(json);
  if (collectionResult.success) {
    return collectionResult.data.domains;
  }

  // Neither worked, show errors
  throw new Error(
    `Invalid domain file format:\n${JSON.stringify(singleResult.error.errors, null, 2)}`
  );
}

/**
 * Generate command - create names from domains
 */
program
  .command("generate")
  .description("Generate names from domain configs")
  .requiredOption("-d, --domains <path>", "Path to domain config JSON file")
  .requiredOption("-k, --kind <kind>", "Entity kind (e.g., npc, location)")
  .option("-s, --subkind <subkind>", "Entity subkind")
  .option("-t, --tags <tags>", "Comma-separated tags", "")
  .option("-c, --count <count>", "Number of names to generate", "10")
  .option("--seed <seed>", "Random seed for deterministic generation")
  .option("--unique", "Ensure all generated names are unique")
  .option("--debug", "Show debug information for each name")
  .action((options) => {
    try {
      // Load domains
      const domains = loadDomains(options.domains);
      console.log(`Loaded ${domains.length} domain(s)\n`);

      // Parse request
      const tags = options.tags
        ? options.tags.split(",").map((t: string) => t.trim())
        : [];
      const count = parseInt(options.count, 10);

      const request: GenerationRequest = {
        kind: options.kind,
        subKind: options.subkind,
        tags,
        count,
        seed: options.seed,
      };

      // Validate request
      const validatedRequest = GenerationRequestSchema.parse(request);

      // Generate names
      const results = options.unique
        ? generateUniqueNames(domains, validatedRequest)
        : generateNames(domains, validatedRequest);

      if (results.length === 0) {
        console.log("No names generated (no matching domain found)");
        process.exit(1);
      }

      // Display results
      console.log(
        `Generated ${results.length} name(s) using domain: ${results[0].domainId}\n`
      );

      for (const result of results) {
        console.log(result.name);

        if (options.debug && result.debug) {
          console.log(`  Syllables: ${result.debug.syllables?.join("-")}`);
          console.log(`  Phonology: ${result.debug.phonology}`);
          console.log(`  Morphology: ${result.debug.morphology}`);
          console.log(`  Style: ${result.debug.style}`);
          console.log();
        }
      }
    } catch (error) {
      console.error("Error:", error);
      process.exit(1);
    }
  });

/**
 * Test command - test domain generation with statistics
 */
program
  .command("test")
  .description("Test a domain config with sample generation")
  .requiredOption("-d, --domain <path>", "Path to domain config JSON file")
  .option("-c, --count <count>", "Number of samples to generate", "100")
  .option("--seed <seed>", "Random seed for deterministic generation")
  .option("--show-samples", "Display all generated samples")
  .action((options) => {
    try {
      // Load domain (expect single domain for testing)
      const domains = loadDomains(options.domain);
      if (domains.length === 0) {
        console.error("No domains found in file");
        process.exit(1);
      }

      const domain = domains[0];
      const count = parseInt(options.count, 10);

      console.log(`Testing domain: ${domain.id}`);
      console.log(`Generating ${count} samples...\n`);

      // Run test
      const stats = testDomain(domain, count, options.seed);

      // Display statistics
      console.log("Statistics:");
      console.log(`  Total samples: ${stats.samples.length}`);
      console.log(`  Unique names: ${stats.uniqueCount}`);
      console.log(
        `  Collision rate: ${((1 - stats.uniqueCount / stats.samples.length) * 100).toFixed(2)}%`
      );
      console.log(`  Avg length: ${stats.avgLength.toFixed(1)} chars`);
      console.log(`  Length range: ${stats.minLength}-${stats.maxLength}`);

      if (options.showSamples) {
        console.log("\nSamples:");
        stats.samples.slice(0, 20).forEach((name) => console.log(`  ${name}`));
        if (stats.samples.length > 20) {
          console.log(`  ... and ${stats.samples.length - 20} more`);
        }
      }
    } catch (error) {
      console.error("Error:", error);
      process.exit(1);
    }
  });

/**
 * Explain command - show domain selection logic
 */
program
  .command("explain")
  .description("Explain which domain would be selected for an entity")
  .requiredOption("-d, --domains <path>", "Path to domain config JSON file")
  .requiredOption("-k, --kind <kind>", "Entity kind")
  .option("-s, --subkind <subkind>", "Entity subkind")
  .option("-t, --tags <tags>", "Comma-separated tags", "")
  .action((options) => {
    try {
      const domains = loadDomains(options.domains);
      const tags = options.tags
        ? options.tags.split(",").map((t: string) => t.trim())
        : [];

      const explanation = explainGeneration(
        domains,
        options.kind,
        options.subkind,
        tags
      );

      console.log(explanation);
    } catch (error) {
      console.error("Error:", error);
      process.exit(1);
    }
  });

/**
 * Validate command - validate domain config format
 */
program
  .command("validate")
  .description("Validate domain config file format")
  .requiredOption("-d, --domain <path>", "Path to domain config JSON file")
  .action((options) => {
    try {
      const domains = loadDomains(options.domain);

      console.log(`✓ Domain config is valid`);
      console.log(`  Loaded ${domains.length} domain(s):`);

      for (const domain of domains) {
        console.log(`  - ${domain.id}`);
        console.log(
          `    Applies to: kind=${domain.appliesTo.kind.join(",")}`
        );

        if (domain.appliesTo.subKind && domain.appliesTo.subKind.length > 0) {
          console.log(`    SubKinds: ${domain.appliesTo.subKind.join(",")}`);
        }

        if (domain.appliesTo.tags && domain.appliesTo.tags.length > 0) {
          console.log(`    Tags: ${domain.appliesTo.tags.join(",")}`);
        }

        console.log(
          `    Phonemes: ${domain.phonology.consonants.length}C + ${domain.phonology.vowels.length}V`
        );
        console.log(
          `    Syllable templates: ${domain.phonology.syllableTemplates.length}`
        );
        console.log(
          `    Length range: ${domain.phonology.lengthRange[0]}-${domain.phonology.lengthRange[1]} syllables`
        );
        console.log();
      }
    } catch (error) {
      console.error("✗ Validation failed:", error);
      process.exit(1);
    }
  });

program.parse();
