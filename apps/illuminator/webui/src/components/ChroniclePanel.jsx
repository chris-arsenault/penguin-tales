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
import { buildChronicleContext } from '../lib/chronicleContextBuilder';
import { generateNameBank, extractCultureIds } from '../lib/chronicle/nameBank';
import { useChronicleGeneration, deriveStatus } from '../hooks/useChronicleGeneration';
import { buildChronicleImagePrompt } from '../lib/promptBuilders';
import { resolveStyleSelection } from './StyleSelector';
import {
  updateChronicleImageRef,
  generateChronicleId,
  deriveTitleFromRoles,
  createChronicleShell,
} from '../lib/chronicleStorage';

const REFINEMENT_STEPS = new Set(['summary', 'image_refs']);

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
  entityGuidance,
  cultureIdentities,
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

  // State for restart confirmation modal
  const [showRestartModal, setShowRestartModal] = useState(false);
  const [pendingRestartChronicleId, setPendingRestartChronicleId] = useState(null);

  // State for wizard modal
  const [showWizard, setShowWizard] = useState(false);
  // Seed for restarting with previous settings
  const [wizardSeed, setWizardSeed] = useState(null);

  // Name bank for invented characters (culture ID -> array of names)
  const [nameBank, setNameBank] = useState({});

  // Style library loading state (derived from prop)
  const stylesLoading = !styleLibrary;

  // Use the chronicle generation hook
  // Returns chronicle records Map<chronicleId, ChronicleRecord> loaded from IndexedDB
  const {
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
  } = useChronicleGeneration(projectId, simulationRunId, queue, onEnqueue);

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
  const getEffectiveStatus = useCallback((chronicleId, chronicle) => {
    // First check queue for running/queued tasks for this chronicle
    const queueTask = queue.find(
      (item) => item.type === 'entityChronicle' &&
        item.chronicleId === chronicleId &&
        !REFINEMENT_STEPS.has(item.chronicleStep || '')
    );

    if (queueTask) {
      if (queueTask.status === 'running') {
        // Map chronicleStep to status
        switch (queueTask.chronicleStep) {
          case 'validate': return 'validating';
          case 'edit': return 'editing';
          case 'generate_v2': return 'generating';
          default: return deriveStatus(chronicle);
        }
      }
      if (queueTask.status === 'queued') {
        switch (queueTask.chronicleStep) {
          case 'edit': return 'editing';
          case 'validate': return 'validating';
          case 'generate_v2': return 'generating';
          default: return deriveStatus(chronicle);
        }
      }
    }

    // Fall back to IndexedDB-derived status
    return deriveStatus(chronicle);
  }, [queue]);

  // Build list of chronicle items from storage (chronicle-first architecture)
  const chronicleItems = useMemo(() => {
    const items = [];

    // Get all chronicles from storage
    const allChronicles = Array.from(chronicles.values());

    // All chronicles shown in the chronicles tab
    const filteredChronicles = activeType === 'chronicles' ? allChronicles : [];

    // Sort by most recent first
    filteredChronicles.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

    for (const chronicle of filteredChronicles) {
      // Derive display name from title or role assignments
      const displayName = chronicle.title ||
        (chronicle.roleAssignments?.length > 0
          ? chronicle.roleAssignments.filter(r => r.isPrimary).map(r => r.entityName).join(' & ') ||
            chronicle.roleAssignments[0]?.entityName
          : '') ||
        'Untitled Chronicle';

      // Count primary and supporting roles
      const primaryCount = chronicle.roleAssignments?.filter(r => r.isPrimary).length || 0;
      const supportingCount = (chronicle.roleAssignments?.length || 0) - primaryCount;

      items.push({
        id: chronicle.chronicleId,
        type: 'chronicles',
        chronicleId: chronicle.chronicleId,
        entrypointId: chronicle.entrypointId,
        name: displayName,
        status: getEffectiveStatus(chronicle.chronicleId, chronicle),

        // Chronicle-first metadata
        title: chronicle.title,
        format: chronicle.format,
        focusType: chronicle.focusType,
        roleAssignments: chronicle.roleAssignments,
        narrativeStyleId: chronicle.narrativeStyleId,
        narrativeStyle: chronicle.narrativeStyle,
        primaryCount,
        supportingCount,
        selectedEntityIds: chronicle.selectedEntityIds,
        selectedEventIds: chronicle.selectedEventIds,
        selectedRelationshipIds: chronicle.selectedRelationshipIds,

        // Pipeline data
        assembledContent: chronicle.assembledContent,
        cohesionReport: chronicle.cohesionReport,
        finalContent: chronicle.finalContent,
        failureStep: chronicle.failureStep,
        failureReason: chronicle.failureReason,
        editVersion: chronicle.editVersion ?? 0,

        // V2-specific
        selectionSummary: chronicle.selectionSummary,

        // Refinement fields
        summary: chronicle.summary,
        summaryGeneratedAt: chronicle.summaryGeneratedAt,
        summaryModel: chronicle.summaryModel,
        imageRefs: chronicle.imageRefs,
        imageRefsGeneratedAt: chronicle.imageRefsGeneratedAt,
        imageRefsModel: chronicle.imageRefsModel,
        validationStale: chronicle.validationStale,

        // Timestamps
        createdAt: chronicle.createdAt,
        updatedAt: chronicle.updatedAt,
        model: chronicle.model,
      });
    }

    return items;
  }, [activeType, chronicles, getEffectiveStatus]);

  // Get selected item
  const selectedItem = useMemo(() => {
    return chronicleItems.find((item) => item.id === selectedItemId);
  }, [chronicleItems, selectedItemId]);

  // Get the narrative style from the selected chronicle's stored seed data
  const selectedNarrativeStyle = useMemo(() => {
    if (selectedItem?.narrativeStyle) return selectedItem.narrativeStyle;
    if (!selectedItem?.narrativeStyleId) return null;
    if (stylesLoading || !styleLibrary?.narrativeStyles) return null;
    return styleLibrary.narrativeStyles.find((s) => s.id === selectedItem.narrativeStyleId);
  }, [selectedItem?.narrativeStyle, selectedItem?.narrativeStyleId, styleLibrary, stylesLoading]);

  const refinementState = useMemo(() => {
    if (!selectedItem) return null;
    const isRunning = (step) => queue.some(
      (item) => item.type === 'entityChronicle' &&
        item.chronicleId === selectedItem.chronicleId &&
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
    };
  }, [selectedItem, queue]);

  // Clear selection if stored item no longer exists in current data
  useEffect(() => {
    if (selectedItemId && chronicleItems.length > 0 && !selectedItem) {
      console.log('[Chronicle] Stored selectedItemId not found in current items, clearing');
      setSelectedItemId(null);
    }
  }, [selectedItemId, chronicleItems, selectedItem]);

  // Generate name bank when selected chronicle's entities change
  useEffect(() => {
    if (!selectedItem?.roleAssignments || !worldData?.hardState || !worldData?.schema?.cultures) {
      return;
    }

    // Get entity IDs from role assignments
    const entityIds = selectedItem.roleAssignments.map(r => r.entityId);
    const selectedEntities = worldData.hardState.filter(e => entityIds.includes(e.id));
    const cultureIds = extractCultureIds(selectedEntities);

    if (cultureIds.length === 0) {
      setNameBank({});
      return;
    }

    // Generate names for each culture
    generateNameBank(worldData.schema.cultures, cultureIds)
      .then(bank => {
        console.log('[Chronicle] Generated name bank:', bank);
        setNameBank(bank);
      })
      .catch(e => {
        console.warn('[Chronicle] Failed to generate name bank:', e);
        setNameBank({});
      });
  }, [selectedItem?.roleAssignments, worldData?.hardState, worldData?.schema?.cultures]);

  // Build generation context for selected item
  const generationContext = useMemo(() => {
    if (!selectedItem || !worldData || !selectedNarrativeStyle) return null;

    try {
      const wc = {
        name: worldContext?.name || 'The World',
        description: worldContext?.description || '',
        canonFacts: worldContext?.canonFacts || [],
        tone: worldContext?.tone || '',
      };

      // Extract prose hints from entity guidance (if available)
      const proseHints = {};
      for (const [kind, guidance] of Object.entries(entityGuidance || {})) {
        if (guidance?.proseHint) {
          proseHints[kind] = guidance.proseHint;
        }
      }

      // Chronicles use the chronicle-first context builder
      if (selectedItem.type === 'chronicles') {
        return buildChronicleContext(
          {
            roleAssignments: selectedItem.roleAssignments || [],
            selectedEventIds: selectedItem.selectedEventIds || [],
            selectedRelationshipIds: selectedItem.selectedRelationshipIds || [],
            entrypointId: selectedItem.entrypointId,
          },
          worldData,
          wc,
          selectedNarrativeStyle,
          nameBank,
          proseHints,
          cultureIdentities?.descriptive
        );
      }
    } catch (e) {
      console.error('Failed to build generation context:', e);
    }
    return null;
  }, [selectedItem, worldData, worldContext, nameBank, entityGuidance, cultureIdentities, selectedNarrativeStyle]);

  // Handle accept chronicle - saves to IndexedDB (wiki links applied at render time in Chronicler)
  const handleAcceptChronicle = useCallback(async () => {
    if (!selectedItem) return;
    await acceptChronicle(selectedItem.chronicleId);
  }, [selectedItem, acceptChronicle]);

  const handleCorrectSuggestions = useCallback(() => {
    if (!selectedItem || !generationContext) return;
    correctSuggestions(selectedItem.chronicleId, generationContext);
  }, [selectedItem, generationContext, correctSuggestions]);

  const handleGenerateSummary = useCallback(() => {
    if (!selectedItem || !generationContext) return;
    generateSummary(selectedItem.chronicleId, generationContext);
  }, [selectedItem, generationContext, generateSummary]);

  const handleGenerateImageRefs = useCallback(() => {
    if (!selectedItem || !generationContext) return;
    generateImageRefs(selectedItem.chronicleId, generationContext);
  }, [selectedItem, generationContext, generateImageRefs]);

  const handleRevalidate = useCallback(() => {
    if (!selectedItem || !generationContext) return;
    revalidateChronicle(selectedItem.chronicleId, generationContext);
  }, [selectedItem, generationContext, revalidateChronicle]);

  // Handle regenerate (delete and go back to start screen) - uses restart modal
  const handleRegenerate = useCallback(() => {
    if (!selectedItem) return;
    // Use the same restart modal - use chronicleId for chronicle-first
    setPendingRestartChronicleId(selectedItem.chronicleId);
    setShowRestartModal(true);
  }, [selectedItem]);

  // Handle restart with confirmation modal (for completed chronicles)
  const handleRestartClick = useCallback((chronicleId) => {
    setPendingRestartChronicleId(chronicleId);
    setShowRestartModal(true);
  }, []);

  const handleRestartConfirm = useCallback(async () => {
    if (pendingRestartChronicleId) {
      // Get the chronicle record to extract seed before deleting
      const chronicle = chronicles.get(pendingRestartChronicleId);
      if (chronicle) {
        // Extract seed from the chronicle record
        const seed = {
          narrativeStyleId: chronicle.narrativeStyleId,
          narrativeStyle: chronicle.narrativeStyle,
          entrypointId: chronicle.entrypointId,
          roleAssignments: chronicle.roleAssignments || [],
          selectedEventIds: chronicle.selectedEventIds || [],
          selectedRelationshipIds: chronicle.selectedRelationshipIds || [],
        };
        setWizardSeed(seed);
      }

      // Delete the chronicle
      await restartChronicle(pendingRestartChronicleId);

      // Open wizard with seed
      setShowWizard(true);
    }
    setShowRestartModal(false);
    setPendingRestartChronicleId(null);
  }, [pendingRestartChronicleId, restartChronicle, chronicles]);

  const handleRestartCancel = useCallback(() => {
    setShowRestartModal(false);
    setPendingRestartChronicleId(null);
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
        summary: e.summary,
        description: e.description,
        aliases: e.enrichment?.text?.aliases || [],
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
    const events = worldData.narrativeHistory.map((e) => ({
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

    return events;
  }, [worldData]);

  // Build era temporal info from era entities
  // NOTE: Era boundaries come directly from entity.temporal.startTick/endTick.
  // Do NOT compute boundaries from events - this causes overlap bugs and is incorrect.
  // Eras define their own authoritative tick ranges.
  const wizardEras = useMemo(() => {
    if (!entities) return [];

    // Get era entities that have temporal data
    const eraEntities = entities.filter((e) => e.kind === 'era' && e.temporal);
    if (eraEntities.length === 0) return [];

    // Sort by startTick to determine order
    const sortedEras = [...eraEntities].sort(
      (a, b) => a.temporal.startTick - b.temporal.startTick
    );

    // Map directly from era entity temporal data - no computation
    return sortedEras.map((era, index) => {
      const startTick = era.temporal.startTick;
      // TODO: Get actual max tick from simulation config or world data
      // Last era may not have endTick defined yet (ongoing era)
      const endTick = era.temporal.endTick ?? 150;
      return {
        id: era.id,
        name: era.name,
        summary: era.summary || '',
        order: index,
        startTick,
        endTick,
        duration: endTick - startTick,
      };
    });
  }, [entities]);

  // Handle wizard completion
  const handleWizardGenerate = useCallback(async (wizardConfig) => {
    if (!worldData || !worldContext) {
      console.error('[Chronicle Wizard] Missing worldData or worldContext');
      return;
    }

    // Get the narrative style from library
    const narrativeStyle = wizardConfig.narrativeStyle || styleLibrary?.narrativeStyles?.find(
      (s) => s.id === wizardConfig.narrativeStyleId
    );
    if (!narrativeStyle) {
      console.error('[Chronicle Wizard] Narrative style not found:', wizardConfig.narrativeStyleId);
      return;
    }

    // Generate unique chronicle ID (chronicle-first: ID is independent of entities)
    const chronicleId = generateChronicleId();

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

    // Generate name bank for invented characters
    // Must be done here (not in useEffect) because wizard creates new chronicles
    const entityIds = wizardConfig.roleAssignments.map(r => r.entityId);
    const selectedEntities = worldData.hardState?.filter(e => entityIds.includes(e.id)) || [];
    const cultureIds = extractCultureIds(selectedEntities);
    let wizardNameBank = {};
    if (cultureIds.length > 0 && worldData.schema?.cultures) {
      try {
        wizardNameBank = await generateNameBank(worldData.schema.cultures, cultureIds);
        console.log('[Chronicle Wizard] Generated name bank:', wizardNameBank);
      } catch (e) {
        console.warn('[Chronicle Wizard] Failed to generate name bank:', e);
      }
    }

    // Extract prose hints from entity guidance (if available)
    const proseHints = {};
    for (const [kind, guidance] of Object.entries(entityGuidance || {})) {
      if (guidance?.proseHint) {
        proseHints[kind] = guidance.proseHint;
      }
    }

    // Build the chronicle generation context (chronicle-first)
    const context = buildChronicleContext(
      selections,
      worldData,
      wc,
      narrativeStyle,
      wizardNameBank,
      proseHints,
      cultureIdentities?.descriptive,
      wizardConfig.temporalContext
    );

    // Derive chronicle metadata from role assignments
    const title = deriveTitleFromRoles(wizardConfig.roleAssignments);

    // Chronicle metadata for storage (passed to generation functions)
    const chronicleMetadata = {
      chronicleId,
      title,
      format: narrativeStyle.format,
      roleAssignments: wizardConfig.roleAssignments,
      narrativeStyleId: wizardConfig.narrativeStyleId,
      narrativeStyle,
      selectedEntityIds: wizardConfig.roleAssignments.map(r => r.entityId),
      selectedEventIds: wizardConfig.selectedEventIds,
      selectedRelationshipIds: wizardConfig.selectedRelationshipIds,
      entrypointId: wizardConfig.entryPointId,
    };

    console.log('[Chronicle Wizard] Generated chronicle:', {
      chronicleId,
      title,
      roleCount: wizardConfig.roleAssignments.length,
      events: wizardConfig.selectedEventIds.length,
      relationships: wizardConfig.selectedRelationshipIds.length,
    });

    // Create shell record in IndexedDB BEFORE generation
    // This provides immediate UI feedback while generation is in progress
    try {
      await createChronicleShell(chronicleId, {
        projectId: simulationRunId ? simulationRunId.split('_')[0] : 'unknown',
        simulationRunId: simulationRunId || 'unknown',
        model: 'pending', // Will be updated by worker
        title,
        format: narrativeStyle.format,
        narrativeStyleId: wizardConfig.narrativeStyleId,
        narrativeStyle,
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
    generateV2(chronicleId, context, chronicleMetadata);

    // Select the newly generated chronicle by its chronicleId
    setSelectedItemId(chronicleId);
    setActiveType('chronicles');

    // Close the wizard
    setShowWizard(false);
  }, [worldData, worldContext, styleLibrary, generateV2, simulationRunId, refresh, entityGuidance]);

  // Handle generating a chronicle image
  const handleGenerateChronicleImage = useCallback(
    (ref, prompt, _styleInfo) => {
      if (!selectedItem?.chronicleId) return;

      // First, update the image ref status to 'generating'
      updateChronicleImageRef(selectedItem.chronicleId, ref.refId, {
        status: 'generating',
      }).then(() => refresh());

      // Use the chronicleId as the entityId for storage - chronicle images belong to chronicles, not entities
      const chronicleEntity = {
        id: selectedItem.chronicleId,
        name: selectedItem.name || 'Chronicle',
        kind: 'chronicle',
      };

      // Enqueue the image generation task
      onEnqueue([
        {
          entity: chronicleEntity,
          type: 'image',
          prompt,
          // Chronicle image specific fields
          chronicleId: selectedItem.chronicleId,
          imageRefId: ref.refId,
          sceneDescription: ref.sceneDescription,
          imageType: 'chronicle',
        },
      ]);
    },
    [selectedItem, onEnqueue, refresh]
  );

  // Track completed chronicle image tasks and update chronicle records
  const processedChronicleImageTasksRef = useRef(new Set());
  useEffect(() => {
    for (const task of queue) {
      // Look for completed chronicle image tasks that we haven't processed yet
      if (
        task.type === 'image' &&
        task.imageType === 'chronicle' &&
        task.status === 'complete' &&
        task.chronicleId &&
        task.imageRefId &&
        task.result?.imageId &&
        !processedChronicleImageTasksRef.current.has(task.id)
      ) {
        // Mark as processed to avoid duplicate updates
        processedChronicleImageTasksRef.current.add(task.id);

        // Update the chronicle's image ref with the generated image ID
        updateChronicleImageRef(task.chronicleId, task.imageRefId, {
          status: 'complete',
          generatedImageId: task.result.imageId,
        }).then(() => refresh());
      }

      // Also handle failed chronicle image tasks
      if (
        task.type === 'image' &&
        task.imageType === 'chronicle' &&
        task.status === 'error' &&
        task.chronicleId &&
        task.imageRefId &&
        !processedChronicleImageTasksRef.current.has(task.id)
      ) {
        processedChronicleImageTasksRef.current.add(task.id);

        updateChronicleImageRef(task.chronicleId, task.imageRefId, {
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
              {/* Not started = generation failed before producing content */}
              {selectedItem.status === 'not_started' && (
                <div style={{ padding: '24px', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px' }}>
                  <h3 style={{ margin: '0 0 8px 0', color: '#ef4444' }}>Generation Failed</h3>
                  <p style={{ margin: '0 0 16px 0', color: 'var(--text-secondary)' }}>
                    {selectedItem.failureReason || 'Chronicle generation failed before producing content.'}
                  </p>
                  <button
                    onClick={handleRegenerate}
                    className="illuminator-button illuminator-button-primary"
                    style={{ padding: '10px 18px', fontSize: '13px' }}
                  >
                    Delete &amp; Restart
                  </button>
                </div>
              )}

              {/* In-progress states - show spinner */}
              {(selectedItem.status === 'validating' ||
                selectedItem.status === 'editing' ||
                selectedItem.status === 'generating') && (
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
                    {selectedItem.status === 'generating' && 'Generating Chronicle...'}
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
                    if (generationContext) {
                      revalidateChronicle(selectedItem.chronicleId, generationContext);
                    }
                  }}
                  onValidate={() => {
                    if (generationContext) {
                      revalidateChronicle(selectedItem.chronicleId, generationContext);
                    }
                  }}
                  onAddImages={handleGenerateImageRefs}
                  onAccept={handleAcceptChronicle}
                  onRegenerate={handleRegenerate}
                  onCorrectSuggestions={handleCorrectSuggestions}
                  onGenerateSummary={handleGenerateSummary}
                  onGenerateImageRefs={handleGenerateImageRefs}
                  onRevalidate={handleRevalidate}
                  onGenerateChronicleImage={handleGenerateChronicleImage}
                  isGenerating={isGenerating}
                  refinements={refinementState}
                  entities={entities}
                  styleLibrary={styleLibrary}
                  cultures={worldData?.schema?.cultures}
                  entityGuidance={entityGuidance}
                  cultureIdentities={cultureIdentities}
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
              This will delete the current chronicle and open the wizard with the same settings.
              You can modify the settings before regenerating.
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
        onClose={() => {
          setShowWizard(false);
          setWizardSeed(null); // Clear seed after close
        }}
        onGenerate={handleWizardGenerate}
        narrativeStyles={styleLibrary?.narrativeStyles || []}
        entities={wizardEntities}
        relationships={wizardRelationships}
        events={wizardEvents}
        entityKinds={worldData?.schema?.entityKinds || []}
        eras={wizardEras}
        initialSeed={wizardSeed}
      />

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
