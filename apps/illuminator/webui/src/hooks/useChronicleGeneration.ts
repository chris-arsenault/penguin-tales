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
import type { NarrativeStyle } from '@canonry/world-schema';
import type { ChronicleGenerationContext, ChronicleTemporalContext } from '../lib/chronicleTypes';
import type { QueueItem, EnrichmentType, ChronicleStep, AcceptedChronicle } from '../lib/enrichmentTypes';
import {
  getChroniclesForSimulation,
  deleteChronicle as deleteChronicleInDb,
  acceptChronicle as acceptChronicleInDb,
  updateChronicleFailure,
  type ChronicleRecord,
} from '../lib/chronicleStorage';

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
  narrativeStyle?: NarrativeStyle;
  selectedEntityIds: string[];
  selectedEventIds: string[];
  selectedRelationshipIds: string[];
  entrypointId?: string;
  temporalContext?: ChronicleTemporalContext | null;
}

export interface UseChronicleGenerationReturn {
  // Chronicle records keyed by chronicleId (chronicle-first: not entityId)
  chronicles: Map<string, ChronicleRecord>;

  // Actions (chronicle-first: use chronicleId, not entityId)
  generateV2: (chronicleId: string, context: ChronicleGenerationContext, metadata?: ChronicleMetadata) => void;

  // Post-generation refinements
  correctSuggestions: (chronicleId: string, context: ChronicleGenerationContext) => void;
  generateSummary: (chronicleId: string, context: ChronicleGenerationContext) => void;
  generateImageRefs: (chronicleId: string, context: ChronicleGenerationContext) => void;
  revalidateChronicle: (chronicleId: string, context: ChronicleGenerationContext) => void;
  regenerateWithTemperature: (chronicleId: string, temperature: number) => void;
  acceptChronicle: (chronicleId: string) => Promise<AcceptedChronicle | null>;
  restartChronicle: (chronicleId: string) => Promise<void>;

  // Status
  isGenerating: boolean;

  // Manual reload from IndexedDB
  refresh: () => Promise<void>;
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
    chronicleContext?: ChronicleGenerationContext;
    chronicleStep?: ChronicleStep;
    chronicleId?: string;
    chronicleMetadata?: ChronicleMetadata;
    chronicleTemperature?: number;
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
    (chronicleId: string, context: ChronicleGenerationContext, metadata?: ChronicleMetadata) => {
      if (!context.focus) {
        console.error('[Chronicle V2] Focus context required');
        return;
      }

      const narrativeStyle = context.narrativeStyle;
      console.log(`[Chronicle V2] Starting single-shot generation for ${chronicleId}`);

      if (!narrativeStyle) {
        console.error('[Chronicle V2] Narrative style required for generation');
        return;
      }

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
        chronicleContext: context,
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
    (chronicleId: string, context: ChronicleGenerationContext) => {
      const chronicle = chronicles.get(chronicleId);
      if (!chronicle) {
        console.error('[Chronicle] No chronicle found for chronicleId', chronicleId);
        return;
      }
      if (!chronicle.cohesionReport || !chronicle.assembledContent) {
        console.error('[Chronicle] No validation report or assembled content to revise');
        return;
      }
      const narrativeStyle = context.narrativeStyle;
      if (!narrativeStyle) {
        console.error('[Chronicle] Narrative style required to correct suggestions');
        return;
      }

      onEnqueue([{
        entity: buildEntityRef(chronicleId, context, chronicle),
        type: 'entityChronicle' as EnrichmentType,
        prompt: '',
        chronicleContext: context,
        chronicleStep: 'edit',
        chronicleId,
      }]);
    },
    [chronicles, onEnqueue, buildEntityRef]
  );

  const generateSummary = useCallback(
    (chronicleId: string, context: ChronicleGenerationContext) => {
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
      const narrativeStyle = context.narrativeStyle;
      if (!narrativeStyle) {
        console.error('[Chronicle] Narrative style required to generate summary');
        return;
      }

      onEnqueue([{
        entity: buildEntityRef(chronicleId, context, chronicle),
        type: 'entityChronicle' as EnrichmentType,
        prompt: '',
        chronicleContext: context,
        chronicleStep: 'summary',
        chronicleId,
      }]);
    },
    [chronicles, onEnqueue, buildEntityRef]
  );

  const generateImageRefs = useCallback(
    (chronicleId: string, context: ChronicleGenerationContext) => {
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
      const narrativeStyle = context.narrativeStyle;
      if (!narrativeStyle) {
        console.error('[Chronicle] Narrative style required to generate image refs');
        return;
      }

      onEnqueue([{
        entity: buildEntityRef(chronicleId, context, chronicle),
        type: 'entityChronicle' as EnrichmentType,
        prompt: '',
        chronicleContext: context,
        chronicleStep: 'image_refs',
        chronicleId,
      }]);
    },
    [chronicles, onEnqueue, buildEntityRef]
  );

  const regenerateWithTemperature = useCallback(
    (chronicleId: string, temperature: number) => {
      const chronicle = chronicles.get(chronicleId);
      if (!chronicle) {
        console.error('[Chronicle] No chronicle found for chronicleId', chronicleId);
        return;
      }
      if (chronicle.finalContent || chronicle.status === 'complete') {
        console.error('[Chronicle] Temperature regeneration is only available before acceptance');
        return;
      }
      if (!chronicle.generationSystemPrompt || !chronicle.generationUserPrompt) {
        console.error('[Chronicle] Stored prompts missing; cannot regenerate');
        return;
      }

      const primaryRole = chronicle.roleAssignments?.find((r) => r.isPrimary) || chronicle.roleAssignments?.[0];
      const entity = primaryRole
        ? {
            id: primaryRole.entityId,
            name: primaryRole.entityName,
            kind: primaryRole.entityKind,
            subtype: '',
            prominence: 'recognized',
            culture: '',
            status: 'active',
            description: '',
            tags: {},
          }
        : {
            id: chronicleId,
            name: chronicle.title || 'Chronicle',
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
        chronicleStep: 'regenerate_temperature',
        chronicleId,
        chronicleTemperature: temperature,
      }]);
    },
    [chronicles, onEnqueue]
  );

  const revalidateChronicle = useCallback(
    (chronicleId: string, context: ChronicleGenerationContext) => {
      const chronicle = chronicles.get(chronicleId);
      if (!chronicle) {
        console.error('[Chronicle] No chronicle found for chronicleId', chronicleId);
        return;
      }
      if (!chronicle.assembledContent) {
        console.error('[Chronicle] No assembled content to validate');
        return;
      }
      const narrativeStyle = context.narrativeStyle;
      if (!narrativeStyle) {
        console.error('[Chronicle] Narrative style required to revalidate');
        return;
      }

      onEnqueue([{
        entity: buildEntityRef(chronicleId, context, chronicle),
        type: 'entityChronicle' as EnrichmentType,
        prompt: '',
        chronicleContext: context,
        chronicleStep: 'validate',
        chronicleId,
      }]);
    },
    [chronicles, onEnqueue, buildEntityRef]
  );

  // -------------------------------------------------------------------------
  // Accept chronicle (mark complete)
  // -------------------------------------------------------------------------

  const acceptChronicle = useCallback(async (chronicleId: string) => {
    const chronicle = chronicles.get(chronicleId);
    if (!chronicle) {
      console.error('[Chronicle] No chronicle found for chronicleId', chronicleId);
      return null;
    }
    if (!chronicle.assembledContent) {
      console.error('[Chronicle] Cannot accept without assembled content');
      return null;
    }

    try {
      // Store raw content - wiki links are applied at render time in Chronicler
      await acceptChronicleInDb(chronicleId, chronicle.assembledContent);
      await loadChronicles(); // Reload to reflect change

      return {
        chronicleId,
        title: chronicle.title,
        format: chronicle.format,
        content: chronicle.assembledContent,
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
  // Cancel a stuck chronicle (force into failed state)
  // -------------------------------------------------------------------------

  const cancelChronicle = useCallback(async (chronicleId: string) => {
    try {
      await updateChronicleFailure(chronicleId, 'generate_v2', 'Cancelled by user');
      console.log(`[Chronicle] Cancelled chronicle ${chronicleId}`);
      await loadChronicles();
    } catch (err) {
      console.error('[Chronicle] Failed to cancel chronicle:', err);
    }
  }, [loadChronicles]);

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
    regenerateWithTemperature,
    acceptChronicle,
    cancelChronicle,
    restartChronicle,
    isGenerating,
    refresh,
  };
}
