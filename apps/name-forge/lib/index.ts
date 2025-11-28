/**
 * World Gen Naming - Domain-aware procedural name generation
 *
 * Main library exports for programmatic use
 */

// Types and schemas
export * from "./types/domain.js";
export * from "./types/schema.js";
export * from "./types/kg.js";
export * from "./types/profile.js"; // Phase 4: Profile system
export * from "./types/integration.js"; // KG integration interface

// Core generation
export * from "./generator.js";
export * from "./phonology.js";
export * from "./morphology.js";
export * from "./style.js";
export * from "./domain-selector.js";
export * from "./phonotactic-pipeline.js";
export * from "./markov.js";

// Phase 4: Profile-based generation
export * from "./profile-executor.js";

// Utilities
export * from "./utils/rng.js";
export * from "./utils/helpers.js";
