/**
 * useChronicleGeneration - Hook for managing entity story generation
 *
 * ARCHITECTURE:
 * - IndexedDB is the SINGLE SOURCE OF TRUTH for all story data
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
import type { ChronicleGenerationContext, CohesionReport } from '../lib/chronicleTypes';
import type { SerializableChronicleContext, QueueItem, EnrichmentType, ChronicleStep } from '../lib/enrichmentTypes';
import type { NarrativeStyle } from '@canonry/world-schema';
import {
  getStoriesForSimulation,
  deleteStory as deleteStoryInDb,
  acceptStory as acceptStoryInDb,
  type StoryRecord,
} from '../lib/chronicleStorage';

// ============================================================================
// Types
// ============================================================================

/**
 * Derive status from what's present in the record.
 * This eliminates status synchronization issues.
 */
export function deriveStatus(record: StoryRecord | undefined): string {
  if (!record) return 'not_started';

  // Check for in-progress states (worker is running)
  // These are set by the storage layer when worker starts a step
  if (record.status === 'planning' ||
      record.status === 'expanding' ||
      record.status === 'assembling' ||
      record.status === 'validating') {
    return record.status;
  }

  // Derive from data presence (completed states)
  if (record.finalContent || record.status === 'complete') return 'complete';
  if (record.cohesionReport) return 'validation_ready';
  if (record.assembledContent) return 'assembly_ready';
  if (record.plan && record.sectionsCompleted >= record.sectionsTotal && record.sectionsTotal > 0) {
    return 'sections_ready';
  }
  if (record.plan) return 'plan_ready';

  return 'not_started';
}

export interface UseChronicleGenerationReturn {
  // Story records keyed by entityId (direct from IndexedDB)
  stories: Map<string, StoryRecord>;

  // Actions
  generateStory: (entityId: string, context: ChronicleGenerationContext, narrativeStyle: NarrativeStyle) => void;
  continueStory: (entityId: string, context: ChronicleGenerationContext, narrativeStyle: NarrativeStyle) => void;
  acceptStory: (entityId: string) => Promise<void>;
  restartStory: (entityId: string) => Promise<void>;

  // Status
  isGenerating: boolean;

  // Manual reload from IndexedDB
  refresh: () => Promise<void>;
}

// ============================================================================
// Context Serialization
// ============================================================================

function serializeContext(
  context: ChronicleGenerationContext,
  narrativeStyle: NarrativeStyle
): SerializableChronicleContext {
  const serialized: SerializableChronicleContext = {
    worldName: context.worldName,
    worldDescription: context.worldDescription,
    canonFacts: context.canonFacts,
    tone: context.tone,

    targetType: context.targetType,
    targetId: context.targetId,

    entity: context.entity
      ? {
        id: context.entity.id,
        name: context.entity.name,
        kind: context.entity.kind,
        subtype: context.entity.subtype,
        prominence: context.entity.prominence,
        culture: context.entity.culture,
        status: context.entity.status,
        tags: context.entity.tags,
        description: context.entity.description,
        enrichedDescription: context.entity.enrichedDescription,
        createdAt: context.entity.createdAt,
        updatedAt: context.entity.updatedAt,
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
    storyId?: string;
  }>) => void
): UseChronicleGenerationReturn {
  // Stories loaded from IndexedDB, keyed by entityId
  const [stories, setStories] = useState<Map<string, StoryRecord>>(new Map());

  // Track last simulation to detect changes
  const lastSimulationRunIdRef = useRef<string | undefined>(undefined);

  // Track which queue completions we've already processed
  const processedCompletionsRef = useRef<Set<string>>(new Set());

  // -------------------------------------------------------------------------
  // Load stories from IndexedDB
  // -------------------------------------------------------------------------

  const loadStories = useCallback(async () => {
    if (!simulationRunId) {
      console.log('[Chronicle] No simulationRunId, clearing stories');
      setStories(new Map());
      return;
    }

    try {
      const records = await getStoriesForSimulation(simulationRunId);
      console.log(`[Chronicle] Loaded ${records.length} stories from IndexedDB`);

      // Build map keyed by entityId (use most recent if multiple)
      const storyMap = new Map<string, StoryRecord>();
      for (const record of records) {
        const existing = storyMap.get(record.entityId);
        if (!existing || record.updatedAt > existing.updatedAt) {
          storyMap.set(record.entityId, record);
        }
      }

      setStories(storyMap);
    } catch (err) {
      console.error('[Chronicle] Failed to load stories:', err);
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
      loadStories();
    }
  }, [simulationRunId, loadStories]);

  // -------------------------------------------------------------------------
  // Watch queue for entityStory completions → reload from IndexedDB
  // -------------------------------------------------------------------------

  useEffect(() => {
    const storyTasks = queue.filter((item) => item.type === 'entityStory');

    // Find newly completed tasks
    const completedTasks = storyTasks.filter(
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
      loadStories();
    }
  }, [queue, loadStories]);

  // -------------------------------------------------------------------------
  // Compute isGenerating from queue
  // -------------------------------------------------------------------------

  const isGenerating = queue.some(
    (item) => item.type === 'entityStory' &&
              (item.status === 'queued' || item.status === 'running')
  );

  // -------------------------------------------------------------------------
  // Generate story (start from scratch)
  // -------------------------------------------------------------------------

  const generateStory = useCallback(
    (entityId: string, context: ChronicleGenerationContext, narrativeStyle: NarrativeStyle) => {
      if (!context.entity) {
        console.error('[Chronicle] Entity context required');
        return;
      }

      console.log(`[Chronicle] Starting story generation for ${entityId}`);

      if (!narrativeStyle) {
        console.error('[Chronicle] Narrative style required for generation');
        return;
      }
      const chronicleContext = serializeContext(context, narrativeStyle);

      const entity = {
        id: context.entity.id,
        name: context.entity.name,
        kind: context.entity.kind,
        subtype: context.entity.subtype || '',
        prominence: context.entity.prominence,
        culture: context.entity.culture || '',
        status: context.entity.status,
        description: context.entity.description || '',
        tags: context.entity.tags as Record<string, unknown>,
      };

      onEnqueue([{
        entity,
        type: 'entityStory' as EnrichmentType,
        prompt: '',
        chronicleContext,
        chronicleStep: 'plan',
      }]);
    },
    [onEnqueue]
  );

  // -------------------------------------------------------------------------
  // Continue story (next step)
  // -------------------------------------------------------------------------

  const continueStory = useCallback(
    (entityId: string, context: ChronicleGenerationContext, narrativeStyle: NarrativeStyle) => {
      const story = stories.get(entityId);
      if (!story?.storyId) {
        console.error('[Chronicle] No story found for entity', entityId);
        return;
      }

      const status = deriveStatus(story);
      let nextStep: ChronicleStep;

      switch (status) {
        case 'plan_ready':
          nextStep = 'expand';
          break;
        case 'sections_ready':
          nextStep = 'assemble';
          break;
        case 'assembly_ready':
          nextStep = 'validate';
          break;
        default:
          console.error('[Chronicle] Cannot continue from status:', status);
          return;
      }

      console.log(`[Chronicle] Continuing story ${story.storyId} to step=${nextStep}`);

      if (!narrativeStyle) {
        console.error('[Chronicle] Narrative style required to continue generation');
        return;
      }
      const chronicleContext = serializeContext(context, narrativeStyle);
      const entity = {
        id: context.entity!.id,
        name: context.entity!.name,
        kind: context.entity!.kind,
        subtype: context.entity!.subtype || '',
        prominence: context.entity!.prominence,
        culture: context.entity!.culture || '',
        status: context.entity!.status,
        description: context.entity!.description || '',
        tags: context.entity!.tags as Record<string, unknown>,
      };

      onEnqueue([{
        entity,
        type: 'entityStory' as EnrichmentType,
        prompt: '',
        chronicleContext,
        chronicleStep: nextStep,
        storyId: story.storyId,
      }]);
    },
    [stories, onEnqueue]
  );

  // -------------------------------------------------------------------------
  // Accept story (mark complete)
  // -------------------------------------------------------------------------

  const acceptStory = useCallback(async (entityId: string) => {
    const story = stories.get(entityId);
    if (!story?.storyId) return;

    try {
      await acceptStoryInDb(story.storyId);
      await loadStories(); // Reload to reflect change
    } catch (err) {
      console.error('[Chronicle] Failed to accept story:', err);
    }
  }, [stories, loadStories]);

  // -------------------------------------------------------------------------
  // Restart story (delete and reset)
  // -------------------------------------------------------------------------

  const restartStory = useCallback(async (entityId: string) => {
    const story = stories.get(entityId);

    if (story?.storyId) {
      try {
        await deleteStoryInDb(story.storyId);
        console.log(`[Chronicle] Deleted story ${story.storyId}`);
      } catch (err) {
        console.error('[Chronicle] Failed to delete story:', err);
      }
    }

    // Remove from local state immediately
    setStories((prev) => {
      const next = new Map(prev);
      next.delete(entityId);
      return next;
    });
  }, [stories]);

  // -------------------------------------------------------------------------
  // Manual refresh
  // -------------------------------------------------------------------------

  const refresh = useCallback(async () => {
    await loadStories();
  }, [loadStories]);

  return {
    stories,
    generateStory,
    continueStory,
    acceptStory,
    restartStory,
    isGenerating,
    refresh,
  };
}
