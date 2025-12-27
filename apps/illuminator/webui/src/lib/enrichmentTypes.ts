/**
 * Enrichment Types
 *
 * Defines the data model for entity enrichment state.
 * Enrichment data is stored on entities and persisted to IndexedDB.
 */

import type { NarrativeStyle } from '@canonry/world-schema';
import type { ChronicleFormat, ChronicleImageRefs } from './chronicleTypes';

export type EnrichmentType = 'description' | 'image' | 'entityChronicle' | 'paletteExpansion';

export interface NetworkDebugInfo {
  request: string;
  response?: string;
}

export type EnrichmentStatus = 'missing' | 'queued' | 'running' | 'complete' | 'error';

export interface EnrichmentResult {
  summary?: string;
  description?: string;
  aliases?: string[];
  /** Distinctive visual traits for image generation */
  visualTraits?: string[];
  imageId?: string;  // Reference to stored image (worker saves directly to IndexedDB)
  chronicleId?: string;  // Reference to stored chronicle in chronicleStore
  revisedPrompt?: string;
  generatedAt: number;
  model: string;
  // Cost tracking
  estimatedCost?: number;
  actualCost?: number;
  inputTokens?: number;
  outputTokens?: number;
  // Debug info (persisted for description enrichments)
  debug?: NetworkDebugInfo;
}

export interface EnrichmentError {
  message: string;
  occurredAt: number;
}

export interface AcceptedChronicle {
  chronicleId: string;
  title: string;
  format: ChronicleFormat;
  content: string;
  summary?: string;
  imageRefs?: ChronicleImageRefs;
  entrypointId: string;
  entityIds: string[];
  generatedAt?: number;
  acceptedAt: number;
  model?: string;
}

/**
 * Enrichment state stored on each entity
 */
export interface EntityEnrichment {
  description?: {
    summary: string;
    description: string;
    aliases: string[];
    /** Distinctive visual traits for image generation (e.g., scars, unusual build, distinctive gear) */
    visualTraits: string[];
    generatedAt: number;
    model: string;
    estimatedCost?: number;
    actualCost?: number;
    inputTokens?: number;
    outputTokens?: number;
    /** Debug request/response from most recent generation */
    debug?: NetworkDebugInfo;
  };
  image?: {
    imageId: string;  // Reference to stored image in imageStore
    generatedAt: number;
    model: string;
    revisedPrompt?: string;
    estimatedCost?: number;
    actualCost?: number;
    inputTokens?: number;  // GPT Image models return token usage
    outputTokens?: number;
  };
  entityChronicle?: {
    chronicleId: string;  // Reference to stored chronicle in chronicleStore
    generatedAt: number;
    model: string;
    estimatedCost?: number;
    actualCost?: number;
    inputTokens?: number;
    outputTokens?: number;
  };
  chronicles?: AcceptedChronicle[];
}

/**
 * Queue item - represents a pending enrichment request
 */
export interface QueueItem {
  id: string;                 // Unique ID: `${type}_${entityId}`
  entityId: string;
  entityName: string;
  entityKind: string;
  entityCulture?: string;
  /** Unique ID for the simulation run - used to associate content with specific world state */
  simulationRunId?: string;
  type: EnrichmentType;
  prompt: string;
  status: 'queued' | 'running' | 'complete' | 'error';
  queuedAt: number;
  startedAt?: number;
  completedAt?: number;
  result?: EnrichmentResult;
  error?: string;
  debug?: NetworkDebugInfo;
  // Cost tracking
  estimatedCost?: number;
  // For entityChronicle tasks
  chronicleContext?: SerializableChronicleContext;
  chronicleStep?: ChronicleStep;
  chronicleId?: string;
  // For chronicle image tasks
  imageRefId?: string;
  sceneDescription?: string;
  imageType?: 'entity' | 'chronicle';
  // For palette expansion tasks
  paletteEntityKind?: string;
  paletteWorldContext?: string;
  /** Culture visual identities for grounding palette in world lore */
  paletteCultureContext?: Array<{
    name: string;
    description?: string;
    visualIdentity?: Record<string, string>;
  }>;
}

/**
 * Serializable chronicle context (for entityChronicle tasks)
 * Maps are converted to Record objects for serialization
 */
export interface SerializableChronicleContext {
  // World context
  worldName: string;
  worldDescription: string;
  canonFacts: string[];
  tone: string;

  // Chronicle focus (primary identity - chronicle-first architecture)
  focus: {
    type: 'single' | 'ensemble' | 'relationship' | 'event';
    roleAssignments: Array<{
      role: string;
      entityId: string;
      entityName: string;
      entityKind: string;
      isPrimary: boolean;
    }>;
    primaryEntityIds: string[];
    supportingEntityIds: string[];
    selectedEntityIds: string[];
    selectedEventIds: string[];
    selectedRelationshipIds: string[];
  };

  // Optional era context (if available)
  era?: {
    id: string;
    name: string;
    description?: string;
  };

  // All entities (for cross-referencing)
  entities: Array<{
    id: string;
    name: string;
    kind: string;
    subtype?: string;
    prominence: string;
    culture?: string;
    status: string;
    tags: Record<string, string>;
    summary?: string;
    description?: string;
    aliases?: string[];
    createdAt: number;
    updatedAt: number;
  }>;

  // Relationships involving target
  relationships: Array<{
    src: string;
    dst: string;
    kind: string;
    strength?: number;
    sourceName: string;
    sourceKind: string;
    targetName: string;
    targetKind: string;
  }>;

  // NarrativeEvents
  events: Array<{
    id: string;
    tick: number;
    era: string;
    eventKind: string;
    significance: number;
    headline: string;
    description?: string;
    subjectId?: string;
    subjectName?: string;
    objectId?: string;
    objectName?: string;
    narrativeTags?: string[];
  }>;

  // Narrative style for chronicle generation
  narrativeStyle: NarrativeStyle;
}

/**
 * Which step to run for entityChronicle tasks
 */
export type ChronicleStep =
  | 'generate_v2'  // Single-shot generation
  | 'validate'
  | 'edit'
  | 'summary'
  | 'image_refs'
  | 'prose_blend';

/**
 * Worker task - what we send to the worker (single task)
 * Includes metadata needed for worker to persist directly to IndexedDB
 */
export interface WorkerTask {
  id: string;
  entityId: string;
  entityName: string;
  entityKind: string;
  entityCulture?: string;
  projectId: string;
  /** Unique ID for the simulation run - used to associate content with specific world state */
  simulationRunId: string;
  type: EnrichmentType;
  prompt: string;
  // For entityChronicle tasks only
  chronicleContext?: SerializableChronicleContext;
  // Which step to run (for entityChronicle tasks)
  chronicleStep?: ChronicleStep;
  // Chronicle ID (for continuing existing chronicle, or for chronicle images)
  chronicleId?: string;
  // For chronicle image tasks
  imageRefId?: string;
  sceneDescription?: string;
  imageType?: 'entity' | 'chronicle';
  // For palette expansion tasks
  paletteEntityKind?: string;
  paletteWorldContext?: string;
  /** Culture visual identities for grounding palette in world lore */
  paletteCultureContext?: Array<{
    name: string;
    description?: string;
    visualIdentity?: Record<string, string>;
  }>;
}

/**
 * Worker result - what the worker returns
 */
export interface WorkerResult {
  id: string;
  entityId: string;
  type: EnrichmentType;
  success: boolean;
  result?: EnrichmentResult;
  error?: string;
  debug?: NetworkDebugInfo;
}

/**
 * Get enrichment status for an entity and type
 */
export function getEnrichmentStatus(
  entity: { id: string; enrichment?: EntityEnrichment },
  type: EnrichmentType,
  queueItems: QueueItem[]
): EnrichmentStatus {
  // Check queue first
  const queueItem = queueItems.find(
    (item) => item.entityId === entity.id && item.type === type
  );
  if (queueItem) {
    if (queueItem.status === 'running') return 'running';
    if (queueItem.status === 'queued') return 'queued';
    if (queueItem.status === 'error') return 'error';
  }

  // Check entity enrichment
  const enrichment = entity.enrichment;
  if (!enrichment) return 'missing';

  if (type === 'description' && enrichment.description?.summary && enrichment.description?.description) return 'complete';
  if (type === 'image' && enrichment.image?.imageId) return 'complete';
  if (type === 'entityChronicle' && enrichment.entityChronicle?.chronicleId) return 'complete';

  return 'missing';
}

/**
 * Check if entity needs enrichment of a given type
 */
export function needsEnrichment(
  entity: { enrichment?: EntityEnrichment },
  type: EnrichmentType
): boolean {
  const enrichment = entity.enrichment;
  if (!enrichment) return true;

  if (type === 'description') return !(enrichment.description?.summary && enrichment.description?.description);
  if (type === 'image') return !enrichment.image?.imageId;
  if (type === 'entityChronicle') return !enrichment.entityChronicle?.chronicleId;

  return true;
}

/**
 * Apply enrichment result to entity
 */
export function applyEnrichmentResult(
  entity: { enrichment?: EntityEnrichment },
  type: EnrichmentType,
  result: EnrichmentResult
): EntityEnrichment {
  const existing = entity.enrichment || {};

  if (type === 'description' && result.summary && result.description) {
    return {
      ...existing,
      description: {
        summary: result.summary,
        description: result.description,
        aliases: result.aliases || [],
        visualTraits: result.visualTraits || [],
        generatedAt: result.generatedAt,
        model: result.model,
        estimatedCost: result.estimatedCost,
        actualCost: result.actualCost,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        debug: result.debug,
      },
    };
  }

  if (type === 'image' && result.imageId) {
    return {
      ...existing,
      image: {
        imageId: result.imageId,
        generatedAt: result.generatedAt,
        model: result.model,
        revisedPrompt: result.revisedPrompt,
        estimatedCost: result.estimatedCost,
        actualCost: result.actualCost,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
      },
    };
  }

  if (type === 'entityChronicle' && result.chronicleId) {
    return {
      ...existing,
      entityChronicle: {
        chronicleId: result.chronicleId,
        generatedAt: result.generatedAt,
        model: result.model,
        estimatedCost: result.estimatedCost,
        actualCost: result.actualCost,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
      },
    };
  }

  return existing;
}
