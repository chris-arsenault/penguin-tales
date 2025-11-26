/**
 * Builder Spec Types (Phase 5)
 *
 * Meta-schema for automated lexeme generation.
 * These specs describe WHAT to generate, not the generated content itself.
 */

/**
 * Source mode for generation
 */
export type SourceMode = "llm" | "corpus" | "mixed";

/**
 * Part of speech tags
 * Based on Penn Treebank POS tags, simplified for game content
 */
export type PosTag =
  | "noun" // Common noun
  | "noun_proper" // Proper noun
  | "noun_abstract" // Abstract noun
  | "verb" // Base form verb
  | "verb_3sg" // Third person singular present (walks, runs)
  | "verb_past" // Past tense
  | "verb_gerund" // -ing form
  | "adj" // Adjective
  | "adv" // Adverb
  | "prep" // Preposition
  | "ordinal" // First, second, third
  | "any"; // No POS restriction

/**
 * Quality filter configuration
 */
export interface QualityFilter {
  minLength?: number; // Minimum character length
  maxLength?: number; // Maximum character length
  forbiddenSubstrings?: string[]; // Substrings to reject
  bannedWords?: string[]; // Exact words to reject
  allowedPattern?: string; // Regex pattern (entries must match)
  requireCapitalized?: boolean; // Must start with capital
  llmCritic?: boolean; // Use LLM to filter out-of-place entries
}

/**
 * Specification for generating a lexeme list
 *
 * This describes HOW to generate a list, not the list itself.
 */
export interface LexemeSlotSpec {
  id: string; // Unique identifier, e.g., "argo_verbs_3sg"
  cultureId: string; // Culture identifier, e.g., "argonian"
  pos: PosTag; // Part of speech constraint
  style: string; // Natural language style description
  targetCount: number; // How many entries to generate
  sourceMode: SourceMode; // How to generate
  corpusPath?: string; // Path to corpus file (if sourceMode includes "corpus")
  qualityFilter?: QualityFilter; // Automatic quality filters
  examples?: string[]; // Seed examples to guide generation
  description?: string; // Human-readable description
}

/**
 * Batch generation spec
 * Allows generating multiple lexeme lists at once
 */
export interface BatchSpec {
  name: string; // Batch name, e.g., "argonian_complete"
  description?: string;
  lexemeSpecs: LexemeSlotSpec[];
}

/**
 * LLM provider configuration
 */
export interface LLMConfig {
  provider: "anthropic" | "openai";
  apiKey?: string; // If not provided, reads from env
  model?: string; // Model name (defaults to claude-3-5-sonnet for anthropic)
  maxTokens?: number;
  temperature?: number;
}

/**
 * Generation options
 */
export interface GenerationOptions {
  llmConfig: LLMConfig;
  dryRun?: boolean; // If true, don't actually call LLM
  verbose?: boolean; // If true, log detailed progress
  validateOutputs?: boolean; // Run validation metrics on generated content
  outputDir?: string; // Where to write generated files
}

/**
 * Generation result for a single lexeme list
 */
export interface LexemeGenerationResult {
  spec: LexemeSlotSpec;
  entries: string[];
  filtered: number; // How many entries were filtered out
  source: "llm" | "corpus" | "mixed";
  metadata?: {
    promptUsed?: string;
    tokensUsed?: number;
    durationMs?: number;
  };
}

/**
 * Generation result for a batch
 */
export interface BatchGenerationResult {
  batchName: string;
  lexemeResults: LexemeGenerationResult[];
  errors: Array<{ spec: string; error: string }>;
  totalDurationMs: number;
}
