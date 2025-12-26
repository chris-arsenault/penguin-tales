/**
 * Chronicle V2 Types
 *
 * Minimal types for the single-shot chronicle generation pipeline.
 */

import type {
  EntityContext,
  RelationshipContext,
  NarrativeEventContext,
} from '../chronicleTypes';

/**
 * Configuration for V2 entity/event selection.
 * Uses simple random sampling instead of elaborate scoring.
 */
export interface V2SelectionConfig {
  /** Maximum entities to include (default: 6) */
  maxEntities: number;
  /** Maximum events to include (default: 4) */
  maxEvents: number;
  /** Maximum relationships to include (default: 10) */
  maxRelationships: number;
  /** Optional seed for reproducible random sampling */
  randomSeed?: number;
}

/**
 * Result of V2 selection - what goes into the prompt.
 */
export interface V2SelectionResult {
  /** The graph entry point entity */
  entrypoint: EntityContext;
  /** Other entities from the 2-hop neighborhood */
  entities: EntityContext[];
  /** Relationships between selected entities */
  relationships: RelationshipContext[];
  /** Events involving selected entities */
  events: NarrativeEventContext[];
}

/**
 * V2 generation result stored in IndexedDB.
 */
export interface V2GenerationResult {
  /** Story ID */
  storyId: string;
  /** Entity ID (graph entry point) */
  entityId: string;
  /** Generated narrative content */
  content: string;
  /** Pipeline version marker */
  pipelineVersion: 'v2';
  /** Summary of what was selected for the prompt */
  selectionSummary: {
    entityCount: number;
    eventCount: number;
    relationshipCount: number;
  };
  /** When generated */
  generatedAt: number;
  /** Model used */
  model: string;
  /** Cost tracking */
  estimatedCost: number;
  actualCost: number;
  inputTokens: number;
  outputTokens: number;
}

/**
 * Default selection config.
 */
export const DEFAULT_V2_CONFIG: V2SelectionConfig = {
  maxEntities: 6,
  maxEvents: 4,
  maxRelationships: 10,
};
