/**
 * useChronicleGeneration - Hook for managing chronicle generation
 *
 * ARCHITECTURE (chronicle-first):
 * - Chronicles are top-level objects, not tied to specific entities
 * - Stories are keyed by storyId (not entityId)
 * - Role assignments define the chronicle's identity
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
import type { ChronicleGenerationContext } from '../lib/chronicleTypes';
import type { SerializableChronicleContext, QueueItem, EnrichmentType, ChronicleStep, AcceptedChronicle } from '../lib/enrichmentTypes';
import type { NarrativeStyle } from '@canonry/world-schema';
import {
  getStoriesForSimulation,
  deleteStory as deleteStoryInDb,
  acceptStory as acceptStoryInDb,
  type StoryRecord,
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
export function deriveStatus(record: StoryRecord | undefined): string {
  if (!record) return 'not_started';

  if (record.status === 'failed') return 'failed';

  // Check for in-progress states (worker is running)
  if (record.status === 'validating' ||
      record.status === 'editing' ||
      record.status === 'generating_v2') {
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
  storyId: string;
  title?: string;
  focusType: 'single' | 'ensemble' | 'relationship' | 'event';
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
  // Story records keyed by storyId (chronicle-first: not entityId)
  stories: Map<string, StoryRecord>;

  // Actions (chronicle-first: use storyId, not entityId)
  generateV2: (storyId: string, context: ChronicleGenerationContext, narrativeStyle: NarrativeStyle, metadata?: ChronicleMetadata) => void;

  // Post-generation refinements
  correctSuggestions: (storyId: string, context: ChronicleGenerationContext, narrativeStyle: NarrativeStyle) => void;
  generateSummary: (storyId: string, context: ChronicleGenerationContext, narrativeStyle: NarrativeStyle) => void;
  generateImageRefs: (storyId: string, context: ChronicleGenerationContext, narrativeStyle: NarrativeStyle) => void;
  blendProse: (storyId: string, context: ChronicleGenerationContext, narrativeStyle: NarrativeStyle) => void;
  revalidateStory: (storyId: string, context: ChronicleGenerationContext, narrativeStyle: NarrativeStyle) => void;
  acceptStory: (storyId: string, entities: WikiLinkEntity[]) => Promise<AcceptedChronicle | null>;
  restartStory: (storyId: string) => Promise<void>;

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

    // Chronicle-first: use focus instead of targetType/targetId
    targetType: context.targetType,
    targetId: context.targetId,

    // Chronicle focus (primary identity)
    focus: context.focus
      ? {
        type: context.focus.type,
        roleAssignments: context.focus.roleAssignments,
        primaryEntityIds: context.focus.primaryEntityIds,
        supportingEntityIds: context.focus.supportingEntityIds,
        selectedEntityIds: context.focus.selectedEntityIds,
        selectedEventIds: context.focus.selectedEventIds,
        selectedRelationshipIds: context.focus.selectedRelationshipIds,
      }
      : undefined,

    era: context.era
      ? {
        id: context.era.id,
        name: context.era.name,
        description: context.era.description,
      }
      : undefined,

    // Legacy: entity field for backwards compat (deprecated)
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
        summary: context.entity.summary,
        description: context.entity.description,
        aliases: context.entity.aliases,
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
    chronicleMetadata?: ChronicleMetadata;
  }>) => void
): UseChronicleGenerationReturn {
  // Stories loaded from IndexedDB, keyed by storyId (chronicle-first)
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

      // Build map keyed by storyId (chronicle-first: not entityId)
      const storyMap = new Map<string, StoryRecord>();
      for (const record of records) {
        // Use storyId as the key (each chronicle has its own unique ID)
        storyMap.set(record.storyId, record);
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
  // Generate chronicle (single-shot)
  // -------------------------------------------------------------------------

  const generateV2 = useCallback(
    (storyId: string, context: ChronicleGenerationContext, narrativeStyle: NarrativeStyle, metadata?: ChronicleMetadata) => {
      // Chronicle-first: use focus, not entity
      if (!context.focus && !context.entity) {
        console.error('[Chronicle V2] Focus or entity context required');
        return;
      }

      console.log(`[Chronicle V2] Starting single-shot generation for ${storyId}`);

      if (!narrativeStyle) {
        console.error('[Chronicle V2] Narrative style required for generation');
        return;
      }

      const chronicleContext = serializeContext(context, narrativeStyle);

      // Build entity reference for queue (uses first primary entity from focus, or legacy entity)
      const primaryEntity = context.focus?.primaryEntityIds?.[0]
        ? context.entities.find(e => e.id === context.focus?.primaryEntityIds?.[0])
        : context.entity;

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
            // Fallback: create minimal entity reference from storyId
            id: storyId,
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
        type: 'entityStory' as EnrichmentType,
        prompt: '',
        chronicleContext,
        chronicleStep: 'generate_v2',
        storyId: metadata?.storyId || storyId,
        chronicleMetadata: metadata,
      }]);
    },
    [onEnqueue]
  );

  // -------------------------------------------------------------------------
  // Helper: Build entity reference for queue from context
  // -------------------------------------------------------------------------

  const buildEntityRef = useCallback((
    storyId: string,
    context: ChronicleGenerationContext,
    story?: StoryRecord
  ) => {
    const primaryEntity = context.focus?.primaryEntityIds?.[0]
      ? context.entities.find(e => e.id === context.focus?.primaryEntityIds?.[0])
      : context.entity;

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
          id: storyId,
          name: story?.title || 'Chronicle',
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
    (storyId: string, context: ChronicleGenerationContext, narrativeStyle: NarrativeStyle) => {
      const story = stories.get(storyId);
      if (!story) {
        console.error('[Chronicle] No story found for storyId', storyId);
        return;
      }
      if (!story.cohesionReport || !story.assembledContent) {
        console.error('[Chronicle] No validation report or assembled content to revise');
        return;
      }
      if (!narrativeStyle) {
        console.error('[Chronicle] Narrative style required to correct suggestions');
        return;
      }

      onEnqueue([{
        entity: buildEntityRef(storyId, context, story),
        type: 'entityStory' as EnrichmentType,
        prompt: '',
        chronicleContext: serializeContext(context, narrativeStyle),
        chronicleStep: 'edit',
        storyId,
      }]);
    },
    [stories, onEnqueue, buildEntityRef]
  );

  const generateSummary = useCallback(
    (storyId: string, context: ChronicleGenerationContext, narrativeStyle: NarrativeStyle) => {
      const story = stories.get(storyId);
      if (!story) {
        console.error('[Chronicle] No story found for storyId', storyId);
        return;
      }
      if (story.finalContent) {
        console.error('[Chronicle] Summary refinements are only available before acceptance');
        return;
      }
      if (!story.assembledContent) {
        console.error('[Chronicle] No assembled content to summarize');
        return;
      }
      if (!narrativeStyle) {
        console.error('[Chronicle] Narrative style required to generate summary');
        return;
      }

      onEnqueue([{
        entity: buildEntityRef(storyId, context, story),
        type: 'entityStory' as EnrichmentType,
        prompt: '',
        chronicleContext: serializeContext(context, narrativeStyle),
        chronicleStep: 'summary',
        storyId,
      }]);
    },
    [stories, onEnqueue, buildEntityRef]
  );

  const generateImageRefs = useCallback(
    (storyId: string, context: ChronicleGenerationContext, narrativeStyle: NarrativeStyle) => {
      const story = stories.get(storyId);
      if (!story) {
        console.error('[Chronicle] No story found for storyId', storyId);
        return;
      }
      if (story.finalContent) {
        console.error('[Chronicle] Image refs are only available before acceptance');
        return;
      }
      if (!story.assembledContent) {
        console.error('[Chronicle] No assembled content to draft image refs');
        return;
      }
      if (!narrativeStyle) {
        console.error('[Chronicle] Narrative style required to generate image refs');
        return;
      }

      onEnqueue([{
        entity: buildEntityRef(storyId, context, story),
        type: 'entityStory' as EnrichmentType,
        prompt: '',
        chronicleContext: serializeContext(context, narrativeStyle),
        chronicleStep: 'image_refs',
        storyId,
      }]);
    },
    [stories, onEnqueue, buildEntityRef]
  );

  const blendProse = useCallback(
    (storyId: string, context: ChronicleGenerationContext, narrativeStyle: NarrativeStyle) => {
      const story = stories.get(storyId);
      if (!story) {
        console.error('[Chronicle] No story found for storyId', storyId);
        return;
      }
      if (story.finalContent) {
        console.error('[Chronicle] Prose blending is only available before acceptance');
        return;
      }
      if (!story.assembledContent) {
        console.error('[Chronicle] No assembled content to blend');
        return;
      }
      if (!narrativeStyle) {
        console.error('[Chronicle] Narrative style required to blend prose');
        return;
      }

      onEnqueue([{
        entity: buildEntityRef(storyId, context, story),
        type: 'entityStory' as EnrichmentType,
        prompt: '',
        chronicleContext: serializeContext(context, narrativeStyle),
        chronicleStep: 'prose_blend',
        storyId,
      }]);
    },
    [stories, onEnqueue, buildEntityRef]
  );

  const revalidateStory = useCallback(
    (storyId: string, context: ChronicleGenerationContext, narrativeStyle: NarrativeStyle) => {
      const story = stories.get(storyId);
      if (!story) {
        console.error('[Chronicle] No story found for storyId', storyId);
        return;
      }
      if (!story.assembledContent) {
        console.error('[Chronicle] No assembled content to validate');
        return;
      }
      if (!narrativeStyle) {
        console.error('[Chronicle] Narrative style required to revalidate');
        return;
      }

      onEnqueue([{
        entity: buildEntityRef(storyId, context, story),
        type: 'entityStory' as EnrichmentType,
        prompt: '',
        chronicleContext: serializeContext(context, narrativeStyle),
        chronicleStep: 'validate',
        storyId,
      }]);
    },
    [stories, onEnqueue, buildEntityRef]
  );

  // -------------------------------------------------------------------------
  // Accept story (mark complete)
  // -------------------------------------------------------------------------

  const acceptStory = useCallback(async (storyId: string, entities: WikiLinkEntity[]) => {
    const story = stories.get(storyId);
    if (!story) {
      console.error('[Chronicle] No story found for storyId', storyId);
      return null;
    }
    if (!story.assembledContent) {
      console.error('[Chronicle] Cannot accept without assembled content');
      return null;
    }
    if (!entities || entities.length === 0) {
      console.error('[Chronicle] Entity dictionary required to apply backrefs on accept');
      return null;
    }

    try {
      const linkResult = applyWikiLinks(story.assembledContent, entities);
      await acceptStoryInDb(storyId, linkResult.content);
      await loadStories(); // Reload to reflect change

      const plan = story.plan;
      // Chronicle-first: use title from story or derive from role assignments
      const fallbackTitle = story.title ||
        (story.roleAssignments?.filter(r => r.isPrimary).map(r => r.entityName).join(' & ')) ||
        story.entityName ||
        'Untitled Chronicle';

      // Use selectedEntityIds from story (chronicle-first), fallback to plan focus
      const selectedEntities = story.selectedEntityIds?.length
        ? story.selectedEntityIds
        : plan?.focus?.selectedEntityIds?.length
        ? plan.focus.selectedEntityIds
        : story.roleAssignments?.map(r => r.entityId) || [];

      return {
        chronicleId: storyId,
        title: plan?.title || fallbackTitle,
        format: plan?.format || 'story',
        content: linkResult.content,
        summary: story.summary,
        imageRefs: story.imageRefs,
        entrypointId: story.entrypointId || story.entityId,
        entityIds: selectedEntities,
        generatedAt: plan?.generatedAt,
        acceptedAt: Date.now(),
        model: plan?.model || story.model,
      };
    } catch (err) {
      console.error('[Chronicle] Failed to accept story:', err);
      return null;
    }
  }, [stories, loadStories]);

  // -------------------------------------------------------------------------
  // Restart story (delete and reset)
  // -------------------------------------------------------------------------

  const restartStory = useCallback(async (storyId: string) => {
    const story = stories.get(storyId);

    if (story) {
      try {
        await deleteStoryInDb(storyId);
        console.log(`[Chronicle] Deleted story ${storyId}`);
      } catch (err) {
        console.error('[Chronicle] Failed to delete story:', err);
      }
    }

    // Remove from local state immediately
    setStories((prev) => {
      const next = new Map(prev);
      next.delete(storyId);
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
    generateV2,
    correctSuggestions,
    generateSummary,
    generateImageRefs,
    blendProse,
    revalidateStory,
    acceptStory,
    restartStory,
    isGenerating,
    refresh,
  };
}
