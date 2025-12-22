/**
 * Types for Illuminator - LLM enrichment module
 *
 * These are the types needed from lore-weave for enrichment integration.
 * When illuminator is built as a standalone module, these will be imported
 * from @lore-weave/core instead.
 */

import type {
  HistoryEvent as CanonryHistoryEvent,
  Prominence as CanonryProminence,
  WorldEntity,
  WorldRelationship,
} from '@canonry/world-schema';

// Re-export from llm types
export * from './llm/types';

export type HardState = WorldEntity;
export type Relationship = WorldRelationship;
export type HistoryEvent = CanonryHistoryEvent;
export type Prominence = CanonryProminence;

export interface Era {
  id: string;
  name: string;
  description: string;
  templateWeights: Record<string, number>;
  systemModifiers: Record<string, number>;
  pressureModifiers?: Record<string, number>;
}

/**
 * Minimal Graph interface for enrichment
 */
export interface Graph {
  tick: number;
  currentEra: Era;
  history: HistoryEvent[];

  getEntity(id: string): HardState | undefined;
  getEntities(): HardState[];
  forEachEntity(callback: (entity: HardState, id: string) => void): void;
  findRelationships(criteria: { kind?: string; src?: string; dst?: string }): Relationship[];
  getRelationships(): Relationship[];
  getEntityRelationships(entityId: string, direction?: 'src' | 'dst' | 'both'): Relationship[];
}

/**
 * LLM configuration for enrichment
 */
export interface LLMConfig {
  enabled: boolean;
  model: string;
  apiKey?: string;
  maxTokens?: number;
  temperature?: number;
}

/**
 * Enrichment mode configuration
 */
export type EnrichmentMode = 'off' | 'partial' | 'full';

export interface EnrichmentConfig {
  batchSize: number;
  mode: EnrichmentMode;
  maxEntityEnrichments?: number;
  maxRelationshipEnrichments?: number;
  maxEraNarratives?: number;
}
