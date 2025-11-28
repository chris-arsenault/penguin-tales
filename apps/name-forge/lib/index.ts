/**
 * Name Forge - Domain-aware procedural name generation
 *
 * Main library exports for programmatic use.
 */

// ============================================================================
// Core Generation API
// ============================================================================

export {
  generate,
  generateOne,
  generateFromDomain,
  testDomain,
  type MarkovModel,
  type TestDomainResult,
} from "./generate.js";

// ============================================================================
// Project Types (canonical schema matching UI)
// ============================================================================

export type {
  // Core types
  Culture,
  Grammar,
  Profile,
  Strategy,
  StrategyGroup,
  GroupConditions,
  LexemeList,
  // Project structure
  Project,
  WorldSchema,
  EntityKindDefinition,
  // Generation
  GenerateRequest,
  GenerateResult,
} from "./types/project.js";

export {
  // Zod schemas for validation
  LexemeListSchema,
  GrammarSchema,
  StrategySchema,
  StrategyGroupSchema,
  GroupConditionsSchema,
  ProfileSchema,
} from "./types/project.js";

// ============================================================================
// Domain Types (phonotactic configuration)
// ============================================================================

export type {
  NamingDomain,
  PhonologyProfile,
  MorphologyProfile,
  StyleRules,
  AppliesTo,
  Prominence,
} from "./types/domain.js";

// ============================================================================
// Low-level APIs (for advanced use / optimizer)
// ============================================================================

// Phonotactic generation
export { generatePhonotacticName, executePhonotacticPipeline } from "./phonotactic-pipeline.js";
export { generateWord, generateWords, generateWordWithDebug } from "./phonology.js";
export { applyMorphology } from "./morphology.js";
export { applyStyle } from "./style.js";

// Markov generation
export {
  generateFromMarkov,
  generateNamesFromMarkov,
  loadMarkovModel,
  getMarkovModel,
  MARKOV_MODELS,
  type MarkovModelId,
} from "./markov.js";

// Utilities
export { createRNG, pickRandom, pickWeighted } from "./utils/rng.js";

// Validation schemas
export {
  NamingDomainSchema,
  PhonologyProfileSchema,
  MorphologyProfileSchema,
  StyleRulesSchema,
  DomainCollectionSchema,
} from "./types/schema.js";
