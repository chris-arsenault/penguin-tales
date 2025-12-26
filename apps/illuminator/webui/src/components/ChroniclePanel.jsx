/**
 * ChroniclePanel - Narrative generation interface
 *
 * Provides UI for generating long-form narrative content via single-shot LLM generation.
 * Includes wizard for entity/event selection and style configuration.
 */

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import ChronicleReviewPanel from './ChronicleReviewPanel';
import EventsPanel from './EventsPanel';
import { ChronicleWizard } from './ChronicleWizard';
import {
  buildEntityStoryContext,
  buildChronicleContext,
} from '../lib/chronicleContextBuilder';
import { useChronicleGeneration, deriveStatus } from '../hooks/useChronicleGeneration';
import { buildChronicleImagePrompt } from '../lib/promptTemplates';
import { resolveStyleSelection } from './StyleSelector';
import {
  updateStoryImageRef,
  generateStoryId,
  deriveTitleFromRoles,
  deriveFocusType,
  createChronicleShell,
} from '../lib/chronicleStorage';

const REFINEMENT_STEPS = new Set(['summary', 'image_refs', 'prose_blend']);

// Content type definitions
const CONTENT_TYPES = [
  { id: 'chronicles', label: 'Chronicles', description: 'Generate long-form narrative content' },
  { id: 'events', label: 'Events', description: 'View narrative events from simulation' },
];

// Badge colors for chronicle-first display
const FOCUS_TYPE_COLORS = {
  single: { bg: 'rgba(59, 130, 246, 0.15)', text: '#3b82f6', border: 'rgba(59, 130, 246, 0.3)' },
  ensemble: { bg: 'rgba(168, 85, 247, 0.15)', text: '#a855f7', border: 'rgba(168, 85, 247, 0.3)' },
  relationship: { bg: 'rgba(236, 72, 153, 0.15)', text: '#ec4899', border: 'rgba(236, 72, 153, 0.3)' },
  event: { bg: 'rgba(249, 115, 22, 0.15)', text: '#f97316', border: 'rgba(249, 115, 22, 0.3)' },
};

function ChronicleItemCard({ item, isSelected, onClick }) {
  const getStatusLabel = () => {
    switch (item.status) {
      case 'not_started':
        return { label: 'Not Started', color: 'var(--text-muted)' };
      case 'generating':
        return { label: 'Generating...', color: '#3b82f6' };
      case 'assembly_ready':
        return { label: 'Assembly Ready', color: '#f59e0b' };
      case 'editing':
        return { label: 'Editing...', color: '#3b82f6' };
      case 'validating':
        return { label: 'Validating...', color: '#3b82f6' };
      case 'validation_ready':
        return { label: 'Review', color: '#f59e0b' };
      case 'failed': {
        const stepLabels = {
          validate: 'Validate',
          edit: 'Edit',
          generate_v2: 'Generation',
        };
        const stepLabel = stepLabels[item.failureStep] || 'Generation';
        return { label: `${stepLabel} Failed`, color: '#ef4444' };
      }
      case 'complete':
        return { label: 'Complete', color: '#10b981' };
      default:
        return { label: 'Unknown', color: 'var(--text-muted)' };
    }
  };

  // Build chronicle-first badges
  const badges = useMemo(() => {
    const b = [];

    // Focus type badge (single/ensemble/relationship/event)
    if (item.focusType) {
      const colors = FOCUS_TYPE_COLORS[item.focusType] || FOCUS_TYPE_COLORS.single;
      b.push({ label: item.focusType, colors });
    }

    // Role count badge (shows cast composition)
    if (item.primaryCount > 0 || item.supportingCount > 0) {
      const roleLabel = item.primaryCount > 0 && item.supportingCount > 0
        ? `${item.primaryCount} primary, ${item.supportingCount} supporting`
        : item.primaryCount > 0
        ? `${item.primaryCount} primary`
        : `${item.supportingCount} supporting`;
      b.push({
        label: roleLabel,
        colors: { bg: 'rgba(34, 197, 94, 0.15)', text: '#22c55e', border: 'rgba(34, 197, 94, 0.3)' },
      });
    }

    return b;
  }, [item.focusType, item.primaryCount, item.supportingCount]);

  const status = getStatusLabel();

  return (
    <div
      onClick={onClick}
      style={{
        padding: '12px 16px',
        background: isSelected ? 'var(--bg-tertiary)' : 'var(--bg-secondary)',
        border: `1px solid ${isSelected ? 'var(--accent-primary)' : 'var(--border-color)'}`,
        borderRadius: '6px',
        cursor: 'pointer',
        marginBottom: '8px',
        transition: 'all 0.15s',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
        <span style={{ fontWeight: 500, fontSize: '14px', flex: 1 }}>{item.name}</span>
        <span style={{ fontSize: '11px', color: status.color, fontWeight: 500, whiteSpace: 'nowrap' }}>
          {status.label}
        </span>
      </div>

      {/* Chronicle metadata badges */}
      {badges.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '8px' }}>
          {badges.map((badge, idx) => (
            <span
              key={idx}
              style={{
                display: 'inline-block',
                padding: '2px 6px',
                fontSize: '10px',
                fontWeight: 500,
                background: badge.colors.bg,
                color: badge.colors.text,
                border: `1px solid ${badge.colors.border}`,
                borderRadius: '4px',
              }}
            >
              {badge.label}
            </span>
          ))}
        </div>
      )}

    </div>
  );
}

function AssembledContentViewer({ content, wordCount, onCopy }) {
  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px',
        }}
      >
        <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
          {wordCount.toLocaleString()} words
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={onCopy}
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border-color)',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Copy
          </button>
        </div>
      </div>

      <div
        style={{
          padding: '20px',
          background: 'var(--bg-primary)',
          border: '1px solid var(--border-color)',
          borderRadius: '8px',
          fontSize: '14px',
          lineHeight: 1.8,
          maxHeight: '600px',
          overflow: 'auto',
          whiteSpace: 'pre-wrap',
        }}
      >
        {content}
      </div>
    </div>
  );
}

export default function ChroniclePanel({
  worldData,
  entities,
  queue,
  onEnqueue,
  onCancel,
  worldContext,
  projectId,
  simulationRunId,
  buildPrompt,
  styleLibrary,
  styleSelection,
  promptTemplates,
}) {
  // Load persisted state from localStorage
  const [activeType, setActiveType] = useState(() => {
    const saved = localStorage.getItem('illuminator:chronicle:activeType');
    const allowed = new Set(CONTENT_TYPES.map((type) => type.id));
    if (saved && allowed.has(saved)) return saved;
    return 'chronicles';
  });
  const [selectedItemId, setSelectedItemId] = useState(() => {
    const saved = localStorage.getItem('illuminator:chronicle:selectedItemId');
    return saved || null;
  });
  const [selectedNarrativeStyleId, setSelectedNarrativeStyleId] = useState(() => {
    const saved = localStorage.getItem('illuminator:chronicle:narrativeStyleId');
    return saved || 'epic-drama';
  });

  // Persist state changes to localStorage
  useEffect(() => {
    localStorage.setItem('illuminator:chronicle:activeType', activeType);
  }, [activeType]);

  useEffect(() => {
    if (selectedItemId) {
      localStorage.setItem('illuminator:chronicle:selectedItemId', selectedItemId);
    } else {
      localStorage.removeItem('illuminator:chronicle:selectedItemId');
    }
  }, [selectedItemId]);

  useEffect(() => {
    localStorage.setItem('illuminator:chronicle:narrativeStyleId', selectedNarrativeStyleId);
  }, [selectedNarrativeStyleId]);

  // State for restart confirmation modal
  const [showRestartModal, setShowRestartModal] = useState(false);
  const [pendingRestartEntityId, setPendingRestartEntityId] = useState(null);

  // State for wizard modal
  const [showWizard, setShowWizard] = useState(false);

  // Style library loading state (derived from prop)
  const stylesLoading = !styleLibrary;

  // Use the chronicle generation hook
  // Returns chronicle records Map<entityId, StoryRecord> loaded from IndexedDB
  const {
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
  } = useChronicleGeneration(projectId, simulationRunId, queue, onEnqueue);

  // Get the selected narrative style
  const selectedNarrativeStyle = useMemo(() => {
    if (stylesLoading || !styleLibrary?.narrativeStyles) return null;
    return styleLibrary.narrativeStyles.find((s) => s.id === selectedNarrativeStyleId);
  }, [styleLibrary, selectedNarrativeStyleId, stylesLoading]);

  // Build entity map for lookups
  const entityMap = useMemo(() => {
    if (!entities) return new Map();
    return new Map(entities.map((e) => [e.id, e]));
  }, [entities]);

  const eventMap = useMemo(() => {
    if (!worldData?.narrativeHistory) return new Map();
    return new Map(worldData.narrativeHistory.map((e) => [e.id, e]));
  }, [worldData]);

  // Helper to get status considering both IndexedDB and queue state
  const getEffectiveStatus = useCallback((entityId, story) => {
    // First check queue for running/queued tasks for this entity
    const queueTask = queue.find(
      (item) => item.type === 'entityStory' &&
        item.entityId === entityId &&
        !REFINEMENT_STEPS.has(item.chronicleStep || '')
    );

    if (queueTask) {
      if (queueTask.status === 'running') {
        // Map chronicleStep to status
        switch (queueTask.chronicleStep) {
          case 'validate': return 'validating';
          case 'edit': return 'editing';
          case 'generate_v2': return 'generating';
          default: return deriveStatus(story);
        }
      }
      if (queueTask.status === 'queued') {
        switch (queueTask.chronicleStep) {
          case 'edit': return 'editing';
          case 'validate': return 'validating';
          case 'generate_v2': return 'generating';
          default: return deriveStatus(story);
        }
      }
    }

    // Fall back to IndexedDB-derived status
    return deriveStatus(story);
  }, [queue]);

  // Build list of chronicle items from stories (chronicle-first architecture)
  const chronicleItems = useMemo(() => {
    const items = [];

    // Get all chronicles from storage
    const allChronicles = Array.from(stories.values());

    // All chronicles shown in the chronicles tab
    const filteredChronicles = activeType === 'chronicles' ? allChronicles : [];

    // Sort by most recent first
    filteredChronicles.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

    for (const story of filteredChronicles) {
      // Derive display name from title or role assignments
      const displayName = story.title ||
        (story.roleAssignments?.length > 0
          ? story.roleAssignments.filter(r => r.isPrimary).map(r => r.entityName).join(' & ') ||
            story.roleAssignments[0]?.entityName
          : story.entityName) ||
        'Untitled Chronicle';

      // Count primary and supporting roles
      const primaryCount = story.roleAssignments?.filter(r => r.isPrimary).length || 0;
      const supportingCount = (story.roleAssignments?.length || 0) - primaryCount;

      items.push({
        id: story.storyId,
        type: 'chronicles',
        targetId: story.entrypointId || story.entityId,
        storyId: story.storyId,
        name: displayName,
        status: getEffectiveStatus(story.entrypointId || story.entityId, story),

        // Chronicle-first metadata
        title: story.title,
        focusType: story.focusType,
        roleAssignments: story.roleAssignments,
        narrativeStyleId: story.narrativeStyleId,
        primaryCount,
        supportingCount,

        // Pipeline data
        plan: story.plan,
        sectionsCompleted: story.sectionsCompleted,
        sectionsTotal: story.sectionsTotal,
        assembledContent: story.assembledContent,
        cohesionReport: story.cohesionReport,
        finalContent: story.finalContent,
        failureStep: story.failureStep,
        failureReason: story.failureReason,
        editVersion: story.editVersion ?? 0,
        pipelineVersion: story.pipelineVersion,

        // V2-specific
        selectionSummary: story.selectionSummary,

        // Refinement fields
        summary: story.summary,
        summaryGeneratedAt: story.summaryGeneratedAt,
        summaryModel: story.summaryModel,
        imageRefs: story.imageRefs,
        imageRefsGeneratedAt: story.imageRefsGeneratedAt,
        imageRefsModel: story.imageRefsModel,
        proseBlendGeneratedAt: story.proseBlendGeneratedAt,
        proseBlendModel: story.proseBlendModel,
        validationStale: story.validationStale,

        // Timestamps
        createdAt: story.createdAt,
        updatedAt: story.updatedAt,
      });
    }

    return items;
  }, [activeType, stories, getEffectiveStatus]);

  // Get selected item
  const selectedItem = useMemo(() => {
    return chronicleItems.find((item) => item.id === selectedItemId);
  }, [chronicleItems, selectedItemId]);

  const refinementState = useMemo(() => {
    if (!selectedItem) return null;
    const isRunning = (step) => queue.some(
      (item) => item.type === 'entityStory' &&
        item.entityId === selectedItem.targetId &&
        item.chronicleStep === step &&
        (item.status === 'queued' || item.status === 'running')
    );

    return {
      summary: {
        generatedAt: selectedItem.summaryGeneratedAt,
        model: selectedItem.summaryModel,
        running: isRunning('summary'),
      },
      imageRefs: {
        generatedAt: selectedItem.imageRefsGeneratedAt,
        model: selectedItem.imageRefsModel,
        running: isRunning('image_refs'),
      },
      proseBlend: {
        generatedAt: selectedItem.proseBlendGeneratedAt,
        model: selectedItem.proseBlendModel,
        running: isRunning('prose_blend'),
      },
    };
  }, [selectedItem, queue]);

  // Clear selection if stored item no longer exists in current data
  useEffect(() => {
    if (selectedItemId && chronicleItems.length > 0 && !selectedItem) {
      console.log('[Chronicle] Stored selectedItemId not found in current items, clearing');
      setSelectedItemId(null);
    }
  }, [selectedItemId, chronicleItems, selectedItem]);

  // Build generation context for selected item
  const generationContext = useMemo(() => {
    if (!selectedItem || !worldData) return null;

    try {
      const wc = {
        name: worldContext?.name || 'The World',
        description: worldContext?.description || '',
        canonFacts: worldContext?.canonFacts || [],
        tone: worldContext?.tone || '',
      };

      // Chronicles use the entity story context builder
      if (selectedItem.type === 'chronicles') {
        return buildEntityStoryContext(selectedItem.targetId, worldData, wc);
      }
    } catch (e) {
      console.error('Failed to build generation context:', e);
    }
    return null;
  }, [selectedItem, worldData, worldContext]);

  // Handle chronicle generation (single-shot)
  const handleGenerateChronicle = useCallback(() => {
    if (!selectedItem || !generationContext) return;
    if (!selectedNarrativeStyle) return;
    generateV2(selectedItem.id, generationContext, selectedNarrativeStyle);
  }, [selectedItem, generationContext, generateV2, selectedNarrativeStyle]);

  // Handle accept chronicle - saves to IndexedDB (no entity enrichment copy needed)
  const handleAcceptChronicle = useCallback(async () => {
    if (!selectedItem || !entities || entities.length === 0) return;
    await acceptStory(selectedItem.storyId, entities);
  }, [selectedItem, entities, acceptStory]);

  const handleCorrectSuggestions = useCallback(() => {
    if (!selectedItem || !generationContext) return;
    if (!selectedNarrativeStyle) return;
    correctSuggestions(selectedItem.storyId, generationContext, selectedNarrativeStyle);
  }, [selectedItem, generationContext, selectedNarrativeStyle, correctSuggestions]);

  const handleGenerateSummary = useCallback(() => {
    if (!selectedItem || !generationContext) return;
    if (!selectedNarrativeStyle) return;
    generateSummary(selectedItem.storyId, generationContext, selectedNarrativeStyle);
  }, [selectedItem, generationContext, selectedNarrativeStyle, generateSummary]);

  const handleGenerateImageRefs = useCallback(() => {
    if (!selectedItem || !generationContext) return;
    if (!selectedNarrativeStyle) return;
    generateImageRefs(selectedItem.storyId, generationContext, selectedNarrativeStyle);
  }, [selectedItem, generationContext, selectedNarrativeStyle, generateImageRefs]);

  const handleBlendProse = useCallback(() => {
    if (!selectedItem || !generationContext) return;
    if (!selectedNarrativeStyle) return;
    blendProse(selectedItem.storyId, generationContext, selectedNarrativeStyle);
  }, [selectedItem, generationContext, selectedNarrativeStyle, blendProse]);

  const handleRevalidate = useCallback(() => {
    if (!selectedItem || !generationContext) return;
    if (!selectedNarrativeStyle) return;
    revalidateStory(selectedItem.storyId, generationContext, selectedNarrativeStyle);
  }, [selectedItem, generationContext, selectedNarrativeStyle, revalidateStory]);

  // Handle regenerate (delete and go back to start screen) - uses restart modal
  const handleRegenerate = useCallback(() => {
    if (!selectedItem) return;
    // Use the same restart modal - use storyId for chronicle-first
    setPendingRestartEntityId(selectedItem.storyId);
    setShowRestartModal(true);
  }, [selectedItem]);

  // Handle restart with confirmation modal (for completed chronicles)
  const handleRestartClick = useCallback((storyId) => {
    setPendingRestartEntityId(storyId);
    setShowRestartModal(true);
  }, []);

  const handleRestartConfirm = useCallback(async () => {
    if (pendingRestartEntityId) {
      await restartStory(pendingRestartEntityId);
    }
    setShowRestartModal(false);
    setPendingRestartEntityId(null);
  }, [pendingRestartEntityId, restartStory]);

  const handleRestartCancel = useCallback(() => {
    setShowRestartModal(false);
    setPendingRestartEntityId(null);
  }, []);

  // Prepare wizard data
  const wizardEntities = useMemo(() => {
    if (!entities) return [];
    return entities
      .filter((e) => e.kind !== 'era')
      .map((e) => ({
        id: e.id,
        name: e.name,
        kind: e.kind,
        subtype: e.subtype,
        prominence: e.prominence,
        culture: e.culture,
        status: e.status,
        tags: e.tags || {},
        summary: e.enrichment?.description?.summary,
        description: e.enrichment?.description?.description,
        aliases: e.enrichment?.description?.aliases || [],
        coordinates: e.coordinates,
        createdAt: e.createdAt,
        updatedAt: e.updatedAt,
      }));
  }, [entities]);

  const wizardRelationships = useMemo(() => {
    if (!worldData?.relationships) return [];
    return worldData.relationships.map((r) => {
      const src = entityMap.get(r.src);
      const dst = entityMap.get(r.dst);
      return {
        src: r.src,
        dst: r.dst,
        kind: r.kind,
        strength: r.strength,
        sourceName: src?.name || r.src,
        sourceKind: src?.kind || 'unknown',
        targetName: dst?.name || r.dst,
        targetKind: dst?.kind || 'unknown',
      };
    });
  }, [worldData, entityMap]);

  const wizardEvents = useMemo(() => {
    if (!worldData?.narrativeHistory) return [];
    return worldData.narrativeHistory.map((e) => ({
      id: e.id,
      tick: e.tick,
      era: e.era,
      eventKind: e.eventKind,
      significance: e.significance,
      headline: e.headline,
      description: e.description,
      subjectId: e.subject?.id,
      subjectName: e.subject?.name,
      objectId: e.object?.id,
      objectName: e.object?.name,
      stateChanges: e.stateChanges,
      narrativeTags: e.narrativeTags,
    }));
  }, [worldData]);

  // Handle wizard completion
  const handleWizardGenerate = useCallback(async (wizardConfig) => {
    if (!worldData || !worldContext) {
      console.error('[Chronicle Wizard] Missing worldData or worldContext');
      return;
    }

    // Get the narrative style from library
    const narrativeStyle = styleLibrary?.narrativeStyles?.find(
      (s) => s.id === wizardConfig.narrativeStyleId
    );
    if (!narrativeStyle) {
      console.error('[Chronicle Wizard] Narrative style not found:', wizardConfig.narrativeStyleId);
      return;
    }

    // Generate unique story ID (chronicle-first: ID is independent of entities)
    const storyId = generateStoryId();

    // Build chronicle selections (chronicle-first format)
    const selections = {
      roleAssignments: wizardConfig.roleAssignments,
      selectedEventIds: wizardConfig.selectedEventIds,
      selectedRelationshipIds: wizardConfig.selectedRelationshipIds,
      entrypointId: wizardConfig.entryPointId, // Mechanical only, not identity
    };

    // Build world context
    const wc = {
      name: worldContext?.name || 'The World',
      description: worldContext?.description || '',
      canonFacts: worldContext?.canonFacts || [],
      tone: worldContext?.tone || '',
    };

    // Build the chronicle generation context (chronicle-first)
    const context = buildChronicleContext(selections, worldData, wc);

    // Derive chronicle metadata from role assignments
    const title = deriveTitleFromRoles(wizardConfig.roleAssignments);

    // Chronicle metadata for storage (passed to generation functions)
    const chronicleMetadata = {
      storyId,
      title,
      roleAssignments: wizardConfig.roleAssignments,
      narrativeStyleId: wizardConfig.narrativeStyleId,
      selectedEntityIds: wizardConfig.roleAssignments.map(r => r.entityId),
      selectedEventIds: wizardConfig.selectedEventIds,
      selectedRelationshipIds: wizardConfig.selectedRelationshipIds,
      entrypointId: wizardConfig.entryPointId,
    };

    console.log('[Chronicle Wizard] Generated chronicle:', {
      storyId,
      title,
      roleCount: wizardConfig.roleAssignments.length,
      events: wizardConfig.selectedEventIds.length,
      relationships: wizardConfig.selectedRelationshipIds.length,
    });

    // Create shell record in IndexedDB BEFORE generation
    // This provides immediate UI feedback while generation is in progress
    try {
      await createChronicleShell(storyId, {
        projectId: simulationRunId ? simulationRunId.split('_')[0] : 'unknown',
        simulationRunId: simulationRunId || 'unknown',
        model: 'pending', // Will be updated by worker
        title,
        narrativeStyleId: wizardConfig.narrativeStyleId,
        roleAssignments: wizardConfig.roleAssignments,
        selectedEntityIds: wizardConfig.roleAssignments.map(r => r.entityId),
        selectedEventIds: wizardConfig.selectedEventIds,
        selectedRelationshipIds: wizardConfig.selectedRelationshipIds,
        entrypointId: wizardConfig.entryPointId,
      });
      // Refresh to show the new shell record
      await refresh();
    } catch (err) {
      console.error('[Chronicle Wizard] Failed to create shell record:', err);
    }

    // Generate the chronicle
    generateV2(storyId, context, narrativeStyle, chronicleMetadata);

    // Select the newly generated chronicle by its storyId
    setSelectedItemId(storyId);
    setActiveType('chronicles');

    // Close the wizard
    setShowWizard(false);
  }, [worldData, worldContext, styleLibrary, generateV2, simulationRunId, refresh]);

  // Handle generating a chronicle image
  const handleGenerateChronicleImage = useCallback(
    (ref, prompt, _styleInfo) => {
      if (!selectedItem?.storyId) return;
      if (!entities?.length) return;

      // Get the entrypoint entity to use as the "entity" for the queue item
      const entrypointEntity = entities.find((e) => e.id === selectedItem.targetId);
      if (!entrypointEntity) return;

      // First, update the image ref status to 'generating'
      updateStoryImageRef(selectedItem.storyId, ref.refId, {
        status: 'generating',
      }).then(() => refresh());

      // Enqueue the image generation task
      onEnqueue([
        {
          entity: entrypointEntity,
          type: 'image',
          prompt,
          // Chronicle image specific fields
          storyId: selectedItem.storyId,
          imageRefId: ref.refId,
          sceneDescription: ref.sceneDescription,
          imageType: 'chronicle',
        },
      ]);
    },
    [selectedItem, entities, onEnqueue, refresh]
  );

  // Track completed chronicle image tasks and update story records
  const processedChronicleImageTasksRef = useRef(new Set());
  useEffect(() => {
    for (const task of queue) {
      // Look for completed chronicle image tasks that we haven't processed yet
      if (
        task.type === 'image' &&
        task.imageType === 'chronicle' &&
        task.status === 'complete' &&
        task.storyId &&
        task.imageRefId &&
        task.result?.imageId &&
        !processedChronicleImageTasksRef.current.has(task.id)
      ) {
        // Mark as processed to avoid duplicate updates
        processedChronicleImageTasksRef.current.add(task.id);

        // Update the story's image ref with the generated image ID
        updateStoryImageRef(task.storyId, task.imageRefId, {
          status: 'complete',
          generatedImageId: task.result.imageId,
        }).then(() => refresh());
      }

      // Also handle failed chronicle image tasks
      if (
        task.type === 'image' &&
        task.imageType === 'chronicle' &&
        task.status === 'error' &&
        task.storyId &&
        task.imageRefId &&
        !processedChronicleImageTasksRef.current.has(task.id)
      ) {
        processedChronicleImageTasksRef.current.add(task.id);

        updateStoryImageRef(task.storyId, task.imageRefId, {
          status: 'failed',
          error: task.error || 'Image generation failed',
        }).then(() => refresh());
      }
    }
  }, [queue, refresh]);

  // Calculate stats
  const stats = useMemo(() => {
    const byStatus = {
      not_started: 0,
      planning: 0,
      plan_ready: 0,
      expanding: 0,
      sections_ready: 0,
      assembling: 0,
      assembly_ready: 0,
      editing: 0,
      validating: 0,
      validation_ready: 0,
      failed: 0,
      complete: 0,
    };
    for (const item of chronicleItems) {
      byStatus[item.status] = (byStatus[item.status] || 0) + 1;
    }
    return byStatus;
  }, [chronicleItems]);

  const activeTypeLabel = useMemo(() => {
    return 'chronicle';
  }, []);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div
        style={{
          padding: '16px',
          borderBottom: '1px solid var(--border-color)',
          background: 'var(--bg-secondary)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>Chronicles</h2>
            <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
              Generate long-form narrative content
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              {stats.complete} / {chronicleItems.length} complete
            </span>
            <button
              onClick={() => setShowWizard(true)}
              disabled={!styleLibrary || !entities?.length}
              className="illuminator-button illuminator-button-primary"
              style={{
                padding: '8px 16px',
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <span style={{ fontSize: '14px' }}>✨</span>
              New Chronicle
            </button>
          </div>
        </div>
      </div>

      {/* Content type tabs */}
      <div
        style={{
          display: 'flex',
          borderBottom: '1px solid var(--border-color)',
          background: 'var(--bg-primary)',
        }}
      >
        {CONTENT_TYPES.map((type) => (
          <button
            key={type.id}
            onClick={() => {
              setActiveType(type.id);
              setSelectedItemId(null);
            }}
            style={{
              padding: '12px 20px',
              border: 'none',
              background: activeType === type.id ? 'var(--bg-secondary)' : 'transparent',
              borderBottom:
                activeType === type.id
                  ? '2px solid var(--accent-primary)'
                  : '2px solid transparent',
              color: activeType === type.id ? 'var(--text-primary)' : 'var(--text-muted)',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: activeType === type.id ? 600 : 400,
            }}
          >
            {type.label}
          </button>
        ))}
      </div>

      {/* Main content area */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Events tab - full width panel */}
        {activeType === 'events' ? (
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <EventsPanel worldData={worldData} entityMap={entityMap} />
          </div>
        ) : (
          <>
            {/* Left panel: Item list */}
            <div
              style={{
                width: '300px',
                borderRight: '1px solid var(--border-color)',
                overflow: 'auto',
                padding: '16px',
              }}
            >
              {chronicleItems.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                  <div style={{ fontSize: '14px' }}>No items available</div>
                  <div style={{ fontSize: '12px', marginTop: '4px' }}>
                    Run a simulation to populate world data.
                  </div>
                </div>
              ) : (
                chronicleItems.map((item) => (
                  <ChronicleItemCard
                    key={item.id}
                    item={item}
                    isSelected={item.id === selectedItemId}
                    onClick={() => setSelectedItemId(item.id)}
                  />
                ))
              )}
            </div>

        {/* Right panel: Selected item detail */}
        <div style={{ flex: 1, overflow: 'auto', padding: '24px' }}>
          {!selectedItem ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                color: 'var(--text-muted)',
              }}
            >
              Select an item to begin generation
            </div>
          ) : (
            <>
              {/* Pipeline stage content */}
              {selectedItem.status === 'not_started' && (
                    <div
                      style={{
                        textAlign: 'center',
                        padding: '48px',
                        background: 'var(--bg-secondary)',
                        borderRadius: '8px',
                        border: '1px solid var(--border-color)',
                      }}
                    >
                      <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚡</div>
                      <h3 style={{ margin: '0 0 8px 0', fontSize: '18px' }}>
                        Ready to Generate
                      </h3>
                      <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>
                        Generate a narrative in a single LLM call.
                      </p>

                      {/* Narrative Style Selector */}
                      <div style={{ marginBottom: '24px', maxWidth: '400px', margin: '0 auto 24px auto' }}>
                        <label
                          style={{
                            display: 'block',
                            fontSize: '13px',
                            fontWeight: 500,
                            marginBottom: '8px',
                            textAlign: 'left',
                            color: 'var(--text-secondary)',
                          }}
                        >
                          Narrative Style
                        </label>
                        <select
                          value={selectedNarrativeStyleId}
                          onChange={(e) => setSelectedNarrativeStyleId(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '10px 12px',
                            fontSize: '14px',
                            background: 'var(--bg-primary)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '6px',
                            color: 'var(--text-primary)',
                            cursor: 'pointer',
                          }}
                        >
                          {styleLibrary?.narrativeStyles?.map((style) => (
                            <option key={style.id} value={style.id}>
                              {style.name}
                            </option>
                          ))}
                        </select>
                        {selectedNarrativeStyle && (
                          <div
                            style={{
                              marginTop: '8px',
                              padding: '12px',
                              background: 'var(--bg-tertiary)',
                              borderRadius: '6px',
                              textAlign: 'left',
                            }}
                          >
                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                              {selectedNarrativeStyle.description}
                            </div>
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                              {/* Format badge */}
                              <span
                                style={{
                                  fontSize: '10px',
                                  padding: '2px 6px',
                                  background: selectedNarrativeStyle.format === 'document' ? '#059669' : 'var(--accent-primary)',
                                  color: 'white',
                                  borderRadius: '4px',
                                }}
                              >
                                {selectedNarrativeStyle.format === 'document'
                                  ? selectedNarrativeStyle.documentConfig?.documentType || 'document'
                                  : selectedNarrativeStyle.plotStructure?.type || 'narrative'}
                              </span>
                              {/* Word count badge */}
                              <span
                                style={{
                                  fontSize: '10px',
                                  padding: '2px 6px',
                                  background: 'var(--bg-secondary)',
                                  borderRadius: '4px',
                                  color: 'var(--text-muted)',
                                }}
                              >
                                {selectedNarrativeStyle.format === 'document'
                                  ? `${selectedNarrativeStyle.documentConfig?.wordCount?.min || 500}-${selectedNarrativeStyle.documentConfig?.wordCount?.max || 1500} words`
                                  : `${selectedNarrativeStyle.pacing?.totalWordCount?.min || 1000}-${selectedNarrativeStyle.pacing?.totalWordCount?.max || 2000} words`}
                              </span>
                              {/* Scenes/sections badge */}
                              <span
                                style={{
                                  fontSize: '10px',
                                  padding: '2px 6px',
                                  background: 'var(--bg-secondary)',
                                  borderRadius: '4px',
                                  color: 'var(--text-muted)',
                                }}
                              >
                                {selectedNarrativeStyle.format === 'document'
                                  ? `${selectedNarrativeStyle.documentConfig?.sections?.length || 0} sections`
                                  : `${selectedNarrativeStyle.pacing?.sceneCount?.min || 3}-${selectedNarrativeStyle.pacing?.sceneCount?.max || 5} sections`}
                              </span>
                            </div>
                            {selectedNarrativeStyle.tags && selectedNarrativeStyle.tags.length > 0 && (
                              <div style={{ marginTop: '8px', display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                {selectedNarrativeStyle.tags.map((tag) => (
                                  <span
                                    key={tag}
                                    style={{
                                      fontSize: '10px',
                                      padding: '2px 6px',
                                      background: 'rgba(99, 102, 241, 0.2)',
                                      borderRadius: '4px',
                                      color: 'var(--text-muted)',
                                    }}
                                  >
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <button
                        onClick={handleGenerateChronicle}
                        disabled={stylesLoading || !selectedNarrativeStyle}
                        className="illuminator-button illuminator-button-primary"
                        style={{
                          padding: '12px 24px',
                          fontSize: '14px',
                          opacity: !stylesLoading && selectedNarrativeStyle ? 1 : 0.5,
                        }}
                      >
                        Generate Chronicle
                      </button>
                    </div>
                  )}

              {/* In-progress states - show spinner */}
              {(selectedItem.status === 'validating' ||
                selectedItem.status === 'editing' ||
                selectedItem.status === 'generating_v2') && (
                <div style={{ textAlign: 'center', padding: '48px' }}>
                  <div
                    style={{
                      width: '48px',
                      height: '48px',
                      margin: '0 auto 16px',
                      border: '4px solid var(--bg-tertiary)',
                      borderTopColor: 'var(--accent-primary)',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite',
                    }}
                  />
                  <h3 style={{ margin: '0 0 8px 0' }}>
                    {selectedItem.status === 'validating' && 'Validating Cohesion...'}
                    {selectedItem.status === 'editing' && 'Applying Suggestions...'}
                    {selectedItem.status === 'generating_v2' && 'Generating Chronicle...'}
                  </h3>
                  <div style={{ color: 'var(--text-muted)' }}>
                    <p>Generation in progress. This typically takes 30-60 seconds.</p>
                  </div>
                </div>
              )}

              {selectedItem.status === 'failed' && (
                <div style={{ padding: '24px', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px' }}>
                  <h3 style={{ margin: '0 0 8px 0', color: '#ef4444' }}>Generation Failed</h3>
                  <p style={{ margin: '0 0 16px 0', color: 'var(--text-secondary)' }}>
                    {selectedItem.failureReason || 'Chronicle generation failed. Please regenerate to try again.'}
                  </p>
                  <button
                    onClick={handleRegenerate}
                    className="illuminator-button illuminator-button-primary"
                    style={{ padding: '10px 18px', fontSize: '13px' }}
                  >
                    Regenerate
                  </button>
                </div>
              )}

              {/* Review states - assembly_ready, validation_ready, complete */}
              {(selectedItem.status === 'assembly_ready' ||
                selectedItem.status === 'validation_ready' ||
                selectedItem.status === 'complete') && (
                <ChronicleReviewPanel
                  item={selectedItem}
                  onContinueToValidation={() => {
                    if (generationContext && selectedNarrativeStyle) {
                      revalidateStory(selectedItem.storyId, generationContext, selectedNarrativeStyle);
                    }
                  }}
                  onValidate={() => {
                    if (generationContext && selectedNarrativeStyle) {
                      revalidateStory(selectedItem.storyId, generationContext, selectedNarrativeStyle);
                    }
                  }}
                  onAddImages={handleGenerateImageRefs}
                  onAccept={handleAcceptChronicle}
                  onRegenerate={handleRegenerate}
                  onCorrectSuggestions={handleCorrectSuggestions}
                  onGenerateSummary={handleGenerateSummary}
                  onGenerateImageRefs={handleGenerateImageRefs}
                  onBlendProse={handleBlendProse}
                  onRevalidate={handleRevalidate}
                  onGenerateChronicleImage={handleGenerateChronicleImage}
                  isGenerating={isGenerating}
                  refinements={refinementState}
                  entities={entityMap}
                  styleLibrary={styleLibrary}
                  cultures={worldData?.schema?.cultures}
                  promptTemplates={promptTemplates}
                  worldContext={worldContext}
                />
              )}
            </>
          )}
        </div>
      </>
    )}
      </div>

      {/* Restart confirmation modal */}
      {showRestartModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={handleRestartCancel}
        >
          <div
            style={{
              background: 'var(--bg-primary)',
              borderRadius: '12px',
              padding: '24px',
              maxWidth: '400px',
              width: '90%',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 12px 0', fontSize: '18px' }}>Restart Chronicle?</h3>
            <p style={{ margin: '0 0 20px 0', color: 'var(--text-secondary)', fontSize: '14px', lineHeight: 1.6 }}>
              This will permanently delete the generated chronicle content and start over from the beginning.
              This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={handleRestartCancel}
                style={{
                  padding: '10px 20px',
                  fontSize: '14px',
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleRestartConfirm}
                style={{
                  padding: '10px 20px',
                  fontSize: '14px',
                  background: '#dc2626',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                }}
              >
                Delete & Restart
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Chronicle Wizard Modal */}
      <ChronicleWizard
        isOpen={showWizard}
        onClose={() => setShowWizard(false)}
        onGenerate={handleWizardGenerate}
        narrativeStyles={styleLibrary?.narrativeStyles || []}
        entities={wizardEntities}
        relationships={wizardRelationships}
        events={wizardEvents}
      />

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
