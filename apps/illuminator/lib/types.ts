/**
 * Types for Illuminator - LLM enrichment module
 *
 * These are the types needed from lore-weave for enrichment integration.
 * When illuminator is built as a standalone module, these will be imported
 * from @lore-weave/core instead.
 */

// Re-export from llm types
export * from './llm/types';

// Placeholder types that match lore-weave's types
// These will be replaced with imports from @lore-weave/core when illuminator is built

export interface HardState {
  id: string;
  kind: string;
  subtype: string;
  name: string;
  description: string;
  status: string;
  prominence: string;
  culture?: string;
  tags: Record<string, string | number | boolean>;
  links: Relationship[];
  coordinates?: { x: number; y: number; z?: number };
  temporal?: { startTick: number; endTick: number | null };
  createdAt: number;
  updatedAt: number;
}

export interface Relationship {
  kind: string;
  src: string;
  dst: string;
  strength?: number;
  distance?: number;
  category?: string;
  status?: string;
}

export interface Era {
  id: string;
  name: string;
  description: string;
  templateWeights: Record<string, number>;
  systemModifiers: Record<string, number>;
  pressureModifiers?: Record<string, number>;
}

export interface HistoryEvent {
  tick: number;
  era: string;
  type: 'growth' | 'simulation' | 'special';
  description: string;
  entitiesCreated: string[];
  relationshipsCreated: Relationship[];
  entitiesModified: string[];
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
