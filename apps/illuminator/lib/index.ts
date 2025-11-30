/**
 * Illuminator - LLM-based enrichment for procedural world generation
 *
 * This module provides optional LLM enrichment capabilities for lore-weave.
 * It generates descriptions, narratives, and images for entities and relationships.
 *
 * When integrated with lore-weave, illuminator:
 * - Enriches entity descriptions using context from the world state
 * - Generates era narratives and history summaries
 * - Creates images for mythic entities
 * - Tracks name changes and entity evolution
 */

// Core services
export { EnrichmentService } from './llm/enrichmentService';
export { ImageGenerationService } from './llm/imageGenerationService';
export { LLMClient } from './llm/llmClient';
export { LoreValidator } from './llm/loreValidator';

// Types
export type {
  LoreRecord,
  LoreIndex,
  DomainLoreProvider,
  CulturalGroup,
  NamingRules,
  GeographyConstraints,
} from './llm/types';

export type {
  LLMConfig,
  EnrichmentMode,
  EnrichmentConfig,
  HardState,
  Relationship,
  Era,
  Graph,
  HistoryEvent,
} from './types';

// Enrichment helpers
export {
  createEnrichmentAnalytics,
  trackEnrichmentTrigger,
  getTotalEnrichmentTriggers,
  buildEnrichmentContext,
  createEntitySnapshot,
  EnrichmentQueue,
} from './enrichmentHelpers';

export type {
  EntitySnapshot,
  EnrichmentAnalytics,
  EnrichmentContext,
} from './enrichmentHelpers';

// Change detection (for selective enrichment)
export {
  detectLocationChanges,
  detectFactionChanges,
  detectRuleChanges,
  detectAbilityChanges,
  detectNPCChanges,
  detectEntityChanges,
  takeEntitySnapshot,
} from './engine/changeDetection';

// Name logging
export { NameLogger } from './naming/nameLogger';
