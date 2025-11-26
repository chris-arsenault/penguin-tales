/**
 * Spec Loader (Phase 5)
 *
 * Load and validate generation specs from JSON/YAML files.
 */

import { readFileSync } from "fs";
import { z } from "zod";
import type {
  LexemeSlotSpec,
  BatchSpec,
  PosTag,
  SourceMode,
  QualityFilter,
} from "../../lib/types/builder-spec.js";

/**
 * Zod schemas for validation
 */

const PosTagSchema = z.enum([
  "noun",
  "noun_proper",
  "noun_abstract",
  "verb",
  "verb_3sg",
  "verb_past",
  "verb_gerund",
  "adj",
  "adv",
  "prep",
  "ordinal",
  "any",
]);

const SourceModeSchema = z.enum(["llm", "corpus", "mixed"]);

const QualityFilterSchema = z
  .object({
    minLength: z.number().optional(),
    maxLength: z.number().optional(),
    forbiddenSubstrings: z.array(z.string()).optional(),
    bannedWords: z.array(z.string()).optional(),
    allowedPattern: z.string().optional(),
    requireCapitalized: z.boolean().optional(),
    llmCritic: z.boolean().optional(),
  })
  .optional();

const LexemeSlotSpecSchema = z.object({
  id: z.string(),
  cultureId: z.string(),
  pos: PosTagSchema,
  style: z.string(),
  targetCount: z.number().min(1),
  sourceMode: SourceModeSchema,
  corpusPath: z.string().optional(),
  qualityFilter: QualityFilterSchema,
  examples: z.array(z.string()).optional(),
  description: z.string().optional(),
});

const BatchSpecSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  lexemeSpecs: z.array(LexemeSlotSpecSchema),
});

/**
 * Load and validate a lexeme slot spec from JSON file
 */
export function loadLexemeSlotSpec(path: string): LexemeSlotSpec {
  const content = readFileSync(path, "utf-8");
  const data = JSON.parse(content);
  return LexemeSlotSpecSchema.parse(data);
}

/**
 * Load and validate a batch spec from JSON file
 */
export function loadBatchSpec(path: string): BatchSpec {
  const content = readFileSync(path, "utf-8");
  const data = JSON.parse(content);
  return BatchSpecSchema.parse(data);
}

/**
 * Validate a lexeme slot spec (without loading from file)
 */
export function validateLexemeSlotSpec(spec: unknown): LexemeSlotSpec {
  return LexemeSlotSpecSchema.parse(spec);
}

/**
 * Validate a batch spec (without loading from file)
 */
export function validateBatchSpec(spec: unknown): BatchSpec {
  return BatchSpecSchema.parse(spec);
}

/**
 * Parse spec from JSON string
 */
export function parseSpecFromJSON<T>(
  json: string,
  type: "lexeme" | "batch"
): T {
  const data = JSON.parse(json);

  switch (type) {
    case "lexeme":
      return LexemeSlotSpecSchema.parse(data) as T;
    case "batch":
      return BatchSpecSchema.parse(data) as T;
    default:
      throw new Error(`Unknown spec type: ${type}`);
  }
}

/**
 * Helper to create a default lexeme slot spec
 */
export function createDefaultLexemeSpec(
  overrides: Partial<LexemeSlotSpec>
): LexemeSlotSpec {
  return {
    id: overrides.id || "unnamed_lexeme",
    cultureId: overrides.cultureId || "generic",
    pos: overrides.pos || "noun",
    style: overrides.style || "fantasy, neutral",
    targetCount: overrides.targetCount || 30,
    sourceMode: overrides.sourceMode || "llm",
    ...overrides,
  };
}
