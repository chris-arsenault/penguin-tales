/**
 * useChronicleGeneration - Hook for managing chronicle generation
 *
 * ARCHITECTURE (chronicle-first):
 * - Chronicles are top-level objects, not tied to specific entities
 * - Chronicles are keyed by chronicleId (not entityId)
 * - Role assignments define the chronicle's identity
 * - IndexedDB is the SINGLE SOURCE OF TRUTH for all chronicle data
 * - React state is a mirror of IndexedDB, refreshed on changes
 * - Status is DERIVED from what data is present, not stored separately
 * - Worker completion triggers reload via callback (no polling)
 *
 * DATA FLOW:
 * 1. User clicks generate → enqueue task → worker starts
 * 2. Worker saves to IndexedDB → posts completion message
 * 3. Queue marks item complete → this hook detects completion
 * 4. Hook reloads from IndexedDB → UI updates
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import type { ChronicleGenerationContext } from '../lib/chronicleTypes';
import type { SerializableChronicleContext, QueueItem, EnrichmentType, ChronicleStep, AcceptedChronicle } from '../lib/enrichmentTypes';
import type { NarrativeStyle } from '@canonry/world-schema';
import {
  getChroniclesForSimulation,
  deleteChronicle as deleteChronicleInDb,
  acceptChronicle as acceptChronicleInDb,
  type ChronicleRecord,
} from '../lib/chronicleStorage';
import type { WikiLinkEntity } from '../lib/wikiLinkService';
import { applyWikiLinks } from '../lib/wikiLinkService';

// ============================================================================
// Types
// ============================================================================

/**
 * Derive status from what's present in the record.
 * This eliminates status synchronization issues.
 */
export function deriveStatus(record: ChronicleRecord | undefined): string {
  if (!record) return 'not_started';

  if (record.status === 'failed') return 'failed';

  // Check for in-progress states (worker is running)
  if (record.status === 'validating' ||
      record.status === 'editing' ||
      record.status === 'generating') {
    return record.status;
  }

  // Derive from data presence (completed states)
  if (record.finalContent || record.status === 'complete') return 'complete';
  if (record.cohesionReport) return 'validation_ready';
  if (record.assembledContent) return 'assembly_ready';

  return 'not_started';
}

/**
 * Chronicle metadata passed when creating new chronicles
 */
export interface ChronicleMetadata {
  chronicleId: string;
  title?: string;
  format: 'story' | 'document';
  roleAssignments: Array<{
    role: string;
    entityId: string;
    entityName: string;
    entityKind: string;
    isPrimary: boolean;
  }>;
  narrativeStyleId: string;
  selectedEntityIds: string[];
  selectedEventIds: string[];
  selectedRelationshipIds: string[];
  entrypointId?: string;
}

export interface UseChronicleGenerationReturn {
  // Chronicle records keyed by chronicleId (chronicle-first: not entityId)
  chronicles: Map<string, ChronicleRecord>;

  // Actions (chronicle-first: use chronicleId, not entityId)
  generateV2: (chronicleId: string, context: ChronicleGenerationContext, narrativeStyle: NarrativeStyle, metadata?: ChronicleMetadata) => void;

  // Post-generation refinements
  correctSuggestions: (chronicleId: string, context: ChronicleGenerationContext, narrativeStyle: NarrativeStyle) => void;
  generateSummary: (chronicleId: string, context: ChronicleGenerationContext, narrativeStyle: NarrativeStyle) => void;
  generateImageRefs: (chronicleId: string, context: ChronicleGenerationContext, narrativeStyle: NarrativeStyle) => void;
  revalidateChronicle: (chronicleId: string, context: ChronicleGenerationContext, narrativeStyle: NarrativeStyle) => void;
  acceptChronicle: (chronicleId: string, entities: WikiLinkEntity[]) => Promise<AcceptedChronicle | null>;
  restartChronicle: (chronicleId: string) => Promise<void>;

  // Status
  isGenerating: boolean;

  // Manual reload from IndexedDB
  refresh: () => Promise<void>;
}

// ============================================================================
// Context Serialization
// ============================================================================

/**
 * Serialize ChronicleGenerationContext for worker transport.
 * IMPORTANT: When adding fields to ChronicleGenerationContext, add them here too.
 */
function serializeContext(
  context: ChronicleGenerationContext,
  narrativeStyle: NarrativeStyle
): SerializableChronicleContext {
  const serialized: SerializableChronicleContext = {
    worldName: context.worldName,
    worldDescription: context.worldDescription,
    canonFacts: context.canonFacts,
    tone: context.tone,

    // Chronicle focus (primary identity)
    focus: {
      type: context.focus.type,
      roleAssignments: context.focus.roleAssignments,
      primaryEntityIds: context.focus.primaryEntityIds,
      supportingEntityIds: context.focus.supportingEntityIds,
      selectedEntityIds: context.focus.selectedEntityIds,
      selectedEventIds: context.focus.selectedEventIds,
      selectedRelationshipIds: context.focus.selectedRelationshipIds,
    },

    era: context.era
      ? {
        id: context.era.id,
        name: context.era.name,
        description: context.era.description,
      }
      : undefined,

    entities: context.entities.map((e) => ({
      id: e.id,
      name: e.name,
      kind: e.kind,
      subtype: e.subtype,
      prominence: e.prominence,
      culture: e.culture,
      status: e.status,
      tags: e.tags,
      summary: e.summary,
      description: e.description,
      aliases: e.aliases,
      createdAt: e.createdAt,
      updatedAt: e.updatedAt,
    })),

    relationships: context.relationships.map((r) => ({
      src: r.src,
      dst: r.dst,
      kind: r.kind,
      strength: r.strength,
      sourceName: r.sourceName,
      sourceKind: r.sourceKind,
      targetName: r.targetName,
      targetKind: r.targetKind,
    })),

    events: context.events.map((e) => ({
      id: e.id,
      tick: e.tick,
      era: e.era,
      eventKind: e.eventKind,
      significance: e.significance,
      headline: e.headline,
      description: e.description,
      subjectId: e.subjectId,
      subjectName: e.subjectName,
      objectId: e.objectId,
      objectName: e.objectName,
      narrativeTags: e.narrativeTags,
    })),

    narrativeStyle,

    // Name bank for invented characters
    nameBank: context.nameBank,

    // Prose hints for entity kinds
    proseHints: context.proseHints,

    // Cultural identities for cultures
    culturalIdentities: context.culturalIdentities,
  };
  return serialized;
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useChronicleGeneration(
  projectId: string | undefined,
  simulationRunId: string | undefined,
  queue: QueueItem[],
  onEnqueue: (items: Array<{
    entity: { id: string; name: string; kind: string; subtype: string; prominence: string; culture: string; status: string; description: string; tags: Record<string, unknown> };
    type: EnrichmentType;
    prompt: string;
    chronicleContext?: SerializableChronicleContext;
    chronicleStep?: ChronicleStep;
    chronicleId?: string;
    chronicleMetadata?: ChronicleMetadata;
  }>) => void
): UseChronicleGenerationReturn {
  // Chronicles loaded from IndexedDB, keyed by chronicleId (chronicle-first)
  const [chronicles, setChronicles] = useState<Map<string, ChronicleRecord>>(new Map());

  // Track last simulation to detect changes
  const lastSimulationRunIdRef = useRef<string | undefined>(undefined);

  // Track which queue completions we've already processed
  const processedCompletionsRef = useRef<Set<string>>(new Set());

  // -------------------------------------------------------------------------
  // Load chronicles from IndexedDB
  // -------------------------------------------------------------------------

  const loadChronicles = useCallback(async () => {
    if (!simulationRunId) {
      console.log('[Chronicle] No simulationRunId, clearing chronicles');
      setChronicles(new Map());
      return;
    }

    try {
      const records = await getChroniclesForSimulation(simulationRunId);
      console.log(`[Chronicle] Loaded ${records.length} chronicles from IndexedDB`);

      // Build map keyed by chronicleId (chronicle-first: not entityId)
      const chronicleMap = new Map<string, ChronicleRecord>();
      for (const record of records) {
        // Use chronicleId as the key (each chronicle has its own unique ID)
        chronicleMap.set(record.chronicleId, record);
      }

      setChronicles(chronicleMap);
    } catch (err) {
      console.error('[Chronicle] Failed to load chronicles:', err);
    }
  }, [simulationRunId]);

  // -------------------------------------------------------------------------
  // Load on mount and when simulation changes
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (simulationRunId !== lastSimulationRunIdRef.current) {
      console.log(`[Chronicle] Simulation changed: ${lastSimulationRunIdRef.current} → ${simulationRunId}`);
      lastSimulationRunIdRef.current = simulationRunId;
      processedCompletionsRef.current.clear();
      loadChronicles();
    }
  }, [simulationRunId, loadChronicles]);

  // -------------------------------------------------------------------------
  // Watch queue for entityChronicle completions → reload from IndexedDB
  // -------------------------------------------------------------------------

  useEffect(() => {
    const chronicleTasks = queue.filter((item) => item.type === 'entityChronicle');

    // Find newly completed tasks
    const completedTasks = chronicleTasks.filter(
      (item) => (item.status === 'complete' || item.status === 'error') &&
                !processedCompletionsRef.current.has(item.id)
    );

    if (completedTasks.length > 0) {
      // Mark as processed
      for (const task of completedTasks) {
        processedCompletionsRef.current.add(task.id);
        console.log(`[Chronicle] Task ${task.id} completed (${task.status}), reloading from IndexedDB`);
      }

      // Reload from IndexedDB to get fresh data
      loadChronicles();
    }
  }, [queue, loadChronicles]);

  // -------------------------------------------------------------------------
  // Compute isGenerating from queue
  // -------------------------------------------------------------------------

  const isGenerating = queue.some(
    (item) => item.type === 'entityChronicle' &&
              (item.status === 'queued' || item.status === 'running')
  );

  // -------------------------------------------------------------------------
  // Generate chronicle (single-shot)
  // -------------------------------------------------------------------------

  const generateV2 = useCallback(
    (chronicleId: string, context: ChronicleGenerationContext, narrativeStyle: NarrativeStyle, metadata?: ChronicleMetadata) => {
      if (!context.focus) {
        console.error('[Chronicle V2] Focus context required');
        return;
      }

      console.log(`[Chronicle V2] Starting single-shot generation for ${chronicleId}`);

      if (!narrativeStyle) {
        console.error('[Chronicle V2] Narrative style required for generation');
        return;
      }

      const chronicleContext = serializeContext(context, narrativeStyle);

      // Build entity reference for queue (uses first primary entity from focus)
      const primaryEntityId = context.focus.primaryEntityIds[0] || context.focus.selectedEntityIds[0];
      const primaryEntity = primaryEntityId
        ? context.entities.find((e) => e.id === primaryEntityId)
        : undefined;

      const entity = primaryEntity
        ? {
            id: primaryEntity.id,
            name: primaryEntity.name,
            kind: primaryEntity.kind,
            subtype: primaryEntity.subtype || '',
            prominence: primaryEntity.prominence,
            culture: primaryEntity.culture || '',
            status: primaryEntity.status,
            description: primaryEntity.description || '',
            tags: primaryEntity.tags as Record<string, unknown>,
          }
        : {
            // Fallback: create minimal entity reference from chronicleId
            id: chronicleId,
            name: metadata?.title || 'Chronicle',
            kind: 'chronicle',
            subtype: '',
            prominence: 'recognized',
            culture: '',
            status: 'active',
            description: '',
            tags: {},
          };

      onEnqueue([{
        entity,
        type: 'entityChronicle' as EnrichmentType,
        prompt: '',
        chronicleContext,
        chronicleStep: 'generate_v2',
        chronicleId: metadata?.chronicleId || chronicleId,
        chronicleMetadata: metadata,
      }]);
    },
    [onEnqueue]
  );

  // -------------------------------------------------------------------------
  // Helper: Build entity reference for queue from context
  // -------------------------------------------------------------------------

  const buildEntityRef = useCallback((
    chronicleId: string,
    context: ChronicleGenerationContext,
    chronicle?: ChronicleRecord
  ) => {
    const primaryEntityId = context.focus.primaryEntityIds[0] || context.focus.selectedEntityIds[0];
    const primaryEntity = primaryEntityId
      ? context.entities.find((e) => e.id === primaryEntityId)
      : undefined;

    return primaryEntity
      ? {
          id: primaryEntity.id,
          name: primaryEntity.name,
          kind: primaryEntity.kind,
          subtype: primaryEntity.subtype || '',
          prominence: primaryEntity.prominence,
          culture: primaryEntity.culture || '',
          status: primaryEntity.status,
          description: primaryEntity.description || '',
          tags: primaryEntity.tags as Record<string, unknown>,
        }
      : {
          id: chronicleId,
          name: chronicle?.title || 'Chronicle',
          kind: 'chronicle',
          subtype: '',
          prominence: 'recognized',
          culture: '',
          status: 'active',
          description: '',
          tags: {},
        };
  }, []);

  // -------------------------------------------------------------------------
  // Correct suggestions (apply validation feedback)
  // -------------------------------------------------------------------------

  const correctSuggestions = useCallback(
    (chronicleId: string, context: ChronicleGenerationContext, narrativeStyle: NarrativeStyle) => {
      const chronicle = chronicles.get(chronicleId);
      if (!chronicle) {
        console.error('[Chronicle] No chronicle found for chronicleId', chronicleId);
        return;
      }
      if (!chronicle.cohesionReport || !chronicle.assembledContent) {
        console.error('[Chronicle] No validation report or assembled content to revise');
        return;
      }
      if (!narrativeStyle) {
        console.error('[Chronicle] Narrative style required to correct suggestions');
        return;
      }

      onEnqueue([{
        entity: buildEntityRef(chronicleId, context, chronicle),
        type: 'entityChronicle' as EnrichmentType,
        prompt: '',
        chronicleContext: serializeContext(context, narrativeStyle),
        chronicleStep: 'edit',
        chronicleId,
      }]);
    },
    [chronicles, onEnqueue, buildEntityRef]
  );

  const generateSummary = useCallback(
    (chronicleId: string, context: ChronicleGenerationContext, narrativeStyle: NarrativeStyle) => {
      const chronicle = chronicles.get(chronicleId);
      if (!chronicle) {
        console.error('[Chronicle] No chronicle found for chronicleId', chronicleId);
        return;
      }
      if (chronicle.finalContent) {
        console.error('[Chronicle] Summary refinements are only available before acceptance');
        return;
      }
      if (!chronicle.assembledContent) {
        console.error('[Chronicle] No assembled content to summarize');
        return;
      }
      if (!narrativeStyle) {
        console.error('[Chronicle] Narrative style required to generate summary');
        return;
      }

      onEnqueue([{
        entity: buildEntityRef(chronicleId, context, chronicle),
        type: 'entityChronicle' as EnrichmentType,
        prompt: '',
        chronicleContext: serializeContext(context, narrativeStyle),
        chronicleStep: 'summary',
        chronicleId,
      }]);
    },
    [chronicles, onEnqueue, buildEntityRef]
  );

  const generateImageRefs = useCallback(
    (chronicleId: string, context: ChronicleGenerationContext, narrativeStyle: NarrativeStyle) => {
      const chronicle = chronicles.get(chronicleId);
      if (!chronicle) {
        console.error('[Chronicle] No chronicle found for chronicleId', chronicleId);
        return;
      }
      if (chronicle.finalContent) {
        console.error('[Chronicle] Image refs are only available before acceptance');
        return;
      }
      if (!chronicle.assembledContent) {
        console.error('[Chronicle] No assembled content to draft image refs');
        return;
      }
      if (!narrativeStyle) {
        console.error('[Chronicle] Narrative style required to generate image refs');
        return;
      }

      onEnqueue([{
        entity: buildEntityRef(chronicleId, context, chronicle),
        type: 'entityChronicle' as EnrichmentType,
        prompt: '',
        chronicleContext: serializeContext(context, narrativeStyle),
        chronicleStep: 'image_refs',
        chronicleId,
      }]);
    },
    [chronicles, onEnqueue, buildEntityRef]
  );

  const revalidateChronicle = useCallback(
    (chronicleId: string, context: ChronicleGenerationContext, narrativeStyle: NarrativeStyle) => {
      const chronicle = chronicles.get(chronicleId);
      if (!chronicle) {
        console.error('[Chronicle] No chronicle found for chronicleId', chronicleId);
        return;
      }
      if (!chronicle.assembledContent) {
        console.error('[Chronicle] No assembled content to validate');
        return;
      }
      if (!narrativeStyle) {
        console.error('[Chronicle] Narrative style required to revalidate');
        return;
      }

      onEnqueue([{
        entity: buildEntityRef(chronicleId, context, chronicle),
        type: 'entityChronicle' as EnrichmentType,
        prompt: '',
        chronicleContext: serializeContext(context, narrativeStyle),
        chronicleStep: 'validate',
        chronicleId,
      }]);
    },
    [chronicles, onEnqueue, buildEntityRef]
  );

  // -------------------------------------------------------------------------
  // Accept chronicle (mark complete)
  // -------------------------------------------------------------------------

  const acceptChronicle = useCallback(async (chronicleId: string, entities: WikiLinkEntity[]) => {
    const chronicle = chronicles.get(chronicleId);
    if (!chronicle) {
      console.error('[Chronicle] No chronicle found for chronicleId', chronicleId);
      return null;
    }
    if (!chronicle.assembledContent) {
      console.error('[Chronicle] Cannot accept without assembled content');
      return null;
    }
    if (!entities || entities.length === 0) {
      console.error('[Chronicle] Entity dictionary required to apply backrefs on accept');
      return null;
    }

    try {
      const linkResult = applyWikiLinks(chronicle.assembledContent, entities);
      await acceptChronicleInDb(chronicleId, linkResult.content);
      await loadChronicles(); // Reload to reflect change

      return {
        chronicleId,
        title: chronicle.title,
        format: chronicle.format,
        content: linkResult.content,
        summary: chronicle.summary,
        imageRefs: chronicle.imageRefs,
        entrypointId: chronicle.entrypointId,
        entityIds: chronicle.selectedEntityIds,
        generatedAt: chronicle.assembledAt,
        acceptedAt: Date.now(),
        model: chronicle.model,
      };
    } catch (err) {
      console.error('[Chronicle] Failed to accept chronicle:', err);
      return null;
    }
  }, [chronicles, loadChronicles]);

  // -------------------------------------------------------------------------
  // Restart chronicle (delete and reset)
  // -------------------------------------------------------------------------

  const restartChronicle = useCallback(async (chronicleId: string) => {
    const chronicle = chronicles.get(chronicleId);

    if (chronicle) {
      try {
        await deleteChronicleInDb(chronicleId);
        console.log(`[Chronicle] Deleted chronicle ${chronicleId}`);
      } catch (err) {
        console.error('[Chronicle] Failed to delete chronicle:', err);
      }
    }

    // Remove from local state immediately
    setChronicles((prev) => {
      const next = new Map(prev);
      next.delete(chronicleId);
      return next;
    });
  }, [chronicles]);

  // -------------------------------------------------------------------------
  // Manual refresh
  // -------------------------------------------------------------------------

  const refresh = useCallback(async () => {
    await loadChronicles();
  }, [loadChronicles]);

  return {
    chronicles,
    generateV2,
    correctSuggestions,
    generateSummary,
    generateImageRefs,
    revalidateChronicle,
    acceptChronicle,
    restartChronicle,
    isGenerating,
    refresh,
  };
}
