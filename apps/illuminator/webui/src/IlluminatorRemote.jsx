/**
 * IlluminatorRemote - Module Federation entry point for Illuminator
 *
 * This component is loaded by The Canonry shell and receives:
 * - projectId: Current project ID
 * - schema: Read-only world schema (entityKinds, cultures)
 * - worldData: Simulation results from lore-weave
 * - onEnrichmentComplete: Callback when enrichment changes
 *
 * Architecture:
 * - Entity-centric view (Entities tab is primary)
 * - UI-side queue management
 * - Worker is a pure executor
 * - Enrichment state stored on entities and persisted
 */

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import './App.css';
import EntityBrowser from './components/EntityBrowser';
import ChroniclePanel from './components/ChroniclePanel';
import WorldContextEditor from './components/WorldContextEditor';
import EntityGuidanceEditor from './components/EntityGuidanceEditor';
import VisualIdentityPanel from './components/VisualIdentityPanel';
import ActivityPanel from './components/ActivityPanel';
import ConfigPanel from './components/ConfigPanel';
import CostsPanel from './components/CostsPanel';
import StoragePanel from './components/StoragePanel';
import TraitPaletteSection from './components/TraitPaletteSection';
import StyleLibraryEditor from './components/StyleLibraryEditor';
import StaticPagesPanel from './components/StaticPagesPanel';
import { useEnrichmentQueue } from './hooks/useEnrichmentQueue';
import { useStyleLibrary } from './hooks/useStyleLibrary';
import {
  buildDescriptionPromptFromGuidance,
  buildImagePromptFromGuidance,
  getVisualConfigFromGuidance,
  createDefaultEntityGuidance,
  createDefaultCultureIdentities,
  buildProseHints,
} from './lib/promptBuilders';
import { buildEntityIndex, buildRelationshipIndex, resolveEraInfo } from './lib/worldData';
import { resolveStyleSelection } from './components/StyleSelector';
import { exportImagePrompts, downloadImagePromptExport } from './lib/workerStorage';
import { getEnrichmentResults } from './lib/enrichmentStorage';
import { applyEnrichmentResult } from './lib/enrichmentTypes';
import { getResolvedLLMCallSettings } from './lib/llmModelSettings';

// Expose diagnostic functions on window for console access (for Module Federation)
if (typeof window !== 'undefined') {
  window.illuminatorDebug = {
    /** Export all image prompt data (original, refined, revised) as array */
    exportImagePrompts,
    /** Download image prompt data as JSON file */
    downloadImagePromptExport,
  };
}

// Tabs ordered by workflow: setup → work → monitor → manage
const TABS = [
  { id: 'configure', label: 'Configure' },   // 1. Set API keys and models
  { id: 'context', label: 'Context' },       // 2. Define world context
  { id: 'guidance', label: 'Guidance' },      // 3. Per-kind entity guidance
  { id: 'identity', label: 'Identity' },     // 4. Visual identity per culture
  { id: 'styles', label: 'Styles' },         // 5. Manage style library
  { id: 'entities', label: 'Entities' },     // 6. Main enrichment work
  { id: 'chronicle', label: 'Chronicle' },   // 7. Wiki-ready long-form content
  { id: 'pages', label: 'Pages' },           // 8. Static pages (user-authored)
  { id: 'activity', label: 'Activity' },     // 9. Monitor queue
  { id: 'costs', label: 'Costs' },           // 10. Track spending
  { id: 'storage', label: 'Storage' },       // 11. Manage images
  { id: 'traits', label: 'Traits' },         // 12. Visual trait palettes
];

// Default image prompt template for Claude formatting
const DEFAULT_IMAGE_PROMPT_TEMPLATE = `Reformat the below prompt into something appropriate for generating a {{modelName}} image of an entity. Avoid bestiary/manuscript/folio style pages - instead create artwork that directly represents the subject as if they exist in the world.

Original prompt:
{{prompt}}`;

// Default enrichment config
// Note: LLM model settings are now managed per-call-type via llmModelSettings.ts
// and configured in the LLMCallConfigPanel. Only image-related settings remain here.
const DEFAULT_CONFIG = {
  imageModel: 'gpt-image-1.5',
  imageSize: 'auto',
  imageQuality: 'auto',
  minProminenceForImage: 'mythic',
  numWorkers: 4,
  // Multishot prompting options
  requireDescription: false,
  useClaudeForImagePrompt: false,
  claudeImagePromptTemplate: DEFAULT_IMAGE_PROMPT_TEMPLATE,
};

const normalizeEnrichmentConfig = (config) => {
  if (!config) return null;
  // Remove legacy model fields that have been migrated to per-call settings
  const { textModel, chronicleModel, textModal, chronicleModal, thinkingModel, thinkingBudget, useThinkingForDescriptions, ...rest } = config;
  return { ...DEFAULT_CONFIG, ...rest };
};

const shouldApplyPersistedResult = (enrichment, type, result) => {
  if (!result?.generatedAt) return true;
  if (type === 'description') {
    // Text enrichment metadata now in enrichment.text (not enrichment.description)
    return (enrichment?.text?.generatedAt || 0) <= result.generatedAt;
  }
  if (type === 'image') {
    return (enrichment?.image?.generatedAt || 0) <= result.generatedAt;
  }
  if (type === 'entityChronicle') {
    return (enrichment?.entityChronicle?.generatedAt || 0) <= result.generatedAt;
  }
  return true;
};

const mergePersistedResults = (entities, records) => {
  if (!records.length || !entities.length) return entities;

  const recordsByEntity = new Map();
  for (const record of records) {
    if (record.type === 'paletteExpansion') continue;
    if (record.type === 'image' && record.imageType === 'chronicle') continue;
    if (!recordsByEntity.has(record.entityId)) {
      recordsByEntity.set(record.entityId, []);
    }
    recordsByEntity.get(record.entityId).push(record);
  }

  if (recordsByEntity.size === 0) return entities;

  let didChange = false;
  const next = entities.map((entity) => {
    const entityRecords = recordsByEntity.get(entity.id);
    if (!entityRecords) return entity;

    let result = { ...entity };
    let changed = false;
    for (const record of entityRecords) {
      if (!shouldApplyPersistedResult(result.enrichment, record.type, record.result)) continue;
      const output = applyEnrichmentResult(
        { enrichment: result.enrichment },
        record.type,
        record.result,
        entity.lockedSummary
      );
      result = {
        ...result,
        enrichment: output.enrichment,
        // Apply entity field updates from text enrichment
        ...(output.summary !== undefined && { summary: output.summary }),
        ...(output.description !== undefined && { description: output.description }),
      };
      changed = true;
    }

    if (changed) {
      didChange = true;
      return result;
    }
    return entity;
  });

  return didChange ? next : entities;
};

// Default world context
const DEFAULT_WORLD_CONTEXT = {
  name: '',
  description: '',
  canonFacts: [],
  tone: '',
};

// Fields in enrichment.text (summary/description are now on entity directly)
const TEXT_ENRICHMENT_FIELDS = [
  'aliases',
  'visualThesis',
  'visualTraits',
  'generatedAt',
  'model',
  'estimatedCost',
  'actualCost',
  'inputTokens',
  'outputTokens',
];
const IMAGE_FIELDS = [
  'url',
  'generatedAt',
  'model',
  'revisedPrompt',
  'estimatedCost',
  'actualCost',
];
const CHRONICLE_FIELDS = [
  'chronicleId',
  'generatedAt',
  'model',
  'estimatedCost',
  'actualCost',
  'inputTokens',
  'outputTokens',
];

const isSectionEqual = (left, right, fields) => {
  if (left === right) return true;
  if (!left || !right) return false;
  for (const field of fields) {
    const leftValue = left[field];
    const rightValue = right[field];
    if (Array.isArray(leftValue) || Array.isArray(rightValue)) {
      if (!Array.isArray(leftValue) || !Array.isArray(rightValue)) return false;
      if (leftValue.length !== rightValue.length) return false;
      for (let i = 0; i < leftValue.length; i += 1) {
        if (leftValue[i] !== rightValue[i]) return false;
      }
      continue;
    }
    if (leftValue !== rightValue) return false;
  }
  return true;
};

const isChroniclesEqual = (left, right) => {
  if (left === right) return true;
  if (!left && !right) return true;
  if (!Array.isArray(left) || !Array.isArray(right)) return false;
  if (left.length !== right.length) return false;

  const normalize = (chronicles) => chronicles
    .map((entry) => ({
      chronicleId: entry.chronicleId,
      title: entry.title,
      format: entry.format,
      content: entry.content,
      summary: entry.summary,
      imageRefs: entry.imageRefs,
      entrypointId: entry.entrypointId,
      acceptedAt: entry.acceptedAt,
      generatedAt: entry.generatedAt,
      model: entry.model,
      entityIds: Array.isArray(entry.entityIds) ? [...entry.entityIds].sort() : [],
    }))
    .sort((a, b) => (a.chronicleId || '').localeCompare(b.chronicleId || ''));

  return JSON.stringify(normalize(left)) === JSON.stringify(normalize(right));
};

const isEnrichmentEqual = (left, right) => {
  if (left === right) return true;
  if (!left || !right) return false;
  return (
    isSectionEqual(left.text, right.text, TEXT_ENRICHMENT_FIELDS) &&
    isSectionEqual(left.image, right.image, IMAGE_FIELDS) &&
    isSectionEqual(left.entityChronicle, right.entityChronicle, CHRONICLE_FIELDS) &&
    isChroniclesEqual(left.chronicles, right.chronicles)
  );
};

export default function IlluminatorRemote({
  projectId,
  schema,
  worldData,
  onEnrichmentComplete,
  worldContext: externalWorldContext,
  onWorldContextChange,
  entityGuidance: externalEntityGuidance,
  onEntityGuidanceChange,
  cultureIdentities: externalCultureIdentities,
  onCultureIdentitiesChange,
  enrichmentConfig: externalEnrichmentConfig,
  onEnrichmentConfigChange,
  styleSelection: externalStyleSelection,
  onStyleSelectionChange,
  activeSection,
  onSectionChange,
  activeSlotIndex = 0,
}) {
  // Show warning when enriching data in temporary slot
  const isTemporarySlot = activeSlotIndex === 0;

  // Use passed-in section or default to 'entities'
  const activeTab = activeSection || 'entities';
  const setActiveTab = onSectionChange || (() => {});

  // API Keys - optionally persisted to localStorage
  const [persistApiKeys, setPersistApiKeys] = useState(() => {
    try {
      return localStorage.getItem('illuminator:persistApiKeys') === 'true';
    } catch {
      return false;
    }
  });
  const [anthropicApiKey, setAnthropicApiKey] = useState(() => {
    try {
      if (localStorage.getItem('illuminator:persistApiKeys') === 'true') {
        return localStorage.getItem('illuminator:anthropicApiKey') || '';
      }
    } catch {}
    return '';
  });
  const [openaiApiKey, setOpenaiApiKey] = useState(() => {
    try {
      if (localStorage.getItem('illuminator:persistApiKeys') === 'true') {
        return localStorage.getItem('illuminator:openaiApiKey') || '';
      }
    } catch {}
    return '';
  });
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);

  // Persist API keys when enabled
  useEffect(() => {
    try {
      localStorage.setItem('illuminator:persistApiKeys', persistApiKeys ? 'true' : 'false');
      if (persistApiKeys) {
        localStorage.setItem('illuminator:anthropicApiKey', anthropicApiKey);
        localStorage.setItem('illuminator:openaiApiKey', openaiApiKey);
      } else {
        localStorage.removeItem('illuminator:anthropicApiKey');
        localStorage.removeItem('illuminator:openaiApiKey');
      }
    } catch {}
  }, [persistApiKeys, anthropicApiKey, openaiApiKey]);

  // Enrichment config - use external prop if provided, else localStorage fallback
  const [localConfig, setLocalConfig] = useState(() => {
    // Prefer external config, fall back to localStorage
    if (externalEnrichmentConfig) {
      return normalizeEnrichmentConfig(externalEnrichmentConfig) || DEFAULT_CONFIG;
    }
    try {
      const saved = localStorage.getItem('illuminator:config');
      if (saved) {
        return normalizeEnrichmentConfig(JSON.parse(saved)) || DEFAULT_CONFIG;
      }
    } catch {}
    return DEFAULT_CONFIG;
  });
  const pendingConfigSyncRef = useRef(null);
  const skipConfigSyncRef = useRef(false);

  // Sync from external config when it changes
  useEffect(() => {
    if (externalEnrichmentConfig) {
      const normalized = normalizeEnrichmentConfig(externalEnrichmentConfig) || DEFAULT_CONFIG;
      skipConfigSyncRef.current = true;
      setLocalConfig(normalized);
    }
  }, [externalEnrichmentConfig]);

  // Use the local config as the active config
  const config = localConfig;

  // Wrapper to update config and sync to parent
  const setConfig = useCallback((updater) => {
    setLocalConfig((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      pendingConfigSyncRef.current = next;
      return next;
    });
  }, []);

  useEffect(() => {
    if (skipConfigSyncRef.current) {
      skipConfigSyncRef.current = false;
      pendingConfigSyncRef.current = null;
      return;
    }
    const pending = pendingConfigSyncRef.current;
    if (!pending) return;
    pendingConfigSyncRef.current = null;
    if (onEnrichmentConfigChange) {
      onEnrichmentConfigChange(pending);
    } else {
      try {
        localStorage.setItem('illuminator:config', JSON.stringify(pending));
      } catch {}
    }
  }, [localConfig, onEnrichmentConfigChange]);

  // Style selection - use external prop if provided, else localStorage fallback
  // Default to 'random' for all style types to encourage visual variety
  const DEFAULT_STYLE_SELECTION = { artisticStyleId: 'random', compositionStyleId: 'random', colorPaletteId: 'random' };
  const [localStyleSelection, setLocalStyleSelection] = useState(() => {
    // Prefer external style selection, fall back to localStorage
    if (externalStyleSelection) {
      return externalStyleSelection;
    }
    try {
      const saved = localStorage.getItem('illuminator:styleSelection');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {}
    return DEFAULT_STYLE_SELECTION;
  });
  const pendingStyleSelectionSyncRef = useRef(null);
  const skipStyleSelectionSyncRef = useRef(false);

  // Sync from external style selection when it changes
  useEffect(() => {
    if (externalStyleSelection) {
      skipStyleSelectionSyncRef.current = true;
      setLocalStyleSelection(externalStyleSelection);
    }
  }, [externalStyleSelection]);

  // Use the local style selection as the active one
  const styleSelection = localStyleSelection;

  // Wrapper to update style selection and sync to parent
  const setStyleSelection = useCallback((updater) => {
    setLocalStyleSelection((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      pendingStyleSelectionSyncRef.current = next;
      return next;
    });
  }, []);

  useEffect(() => {
    if (skipStyleSelectionSyncRef.current) {
      skipStyleSelectionSyncRef.current = false;
      pendingStyleSelectionSyncRef.current = null;
      return;
    }
    const pending = pendingStyleSelectionSyncRef.current;
    if (!pending) return;
    pendingStyleSelectionSyncRef.current = null;
    if (onStyleSelectionChange) {
      onStyleSelectionChange(pending);
    } else {
      try {
        localStorage.setItem('illuminator:styleSelection', JSON.stringify(pending));
      } catch {}
    }
  }, [localStyleSelection, onStyleSelectionChange]);

  // Style library - loaded from IndexedDB or defaults from world-schema
  const {
    styleLibrary,
    loading: styleLibraryLoading,
    isCustom: hasCustomStyleLibrary,
    save: saveStyleLibrary,
    reset: resetStyleLibrary,
    addArtisticStyle,
    updateArtisticStyle,
    deleteArtisticStyle,
    addCompositionStyle,
    updateCompositionStyle,
    deleteCompositionStyle,
    addNarrativeStyle,
    updateNarrativeStyle,
    deleteNarrativeStyle,
  } = useStyleLibrary();

  // World context - edit locally and debounce sync to shell to avoid re-rendering MFEs on each keypress
  const [localWorldContext, setLocalWorldContext] = useState(DEFAULT_WORLD_CONTEXT);
  const worldContext = localWorldContext;
  const worldContextSyncTimeoutRef = useRef(null);
  const worldContextDirtyRef = useRef(false);
  const pendingWorldContextRef = useRef(localWorldContext);

  useEffect(() => {
    if (externalWorldContext === undefined) return;
    if (worldContextSyncTimeoutRef.current) {
      clearTimeout(worldContextSyncTimeoutRef.current);
      worldContextSyncTimeoutRef.current = null;
    }
    worldContextDirtyRef.current = false;
    const nextContext = externalWorldContext || DEFAULT_WORLD_CONTEXT;
    pendingWorldContextRef.current = nextContext;
    setLocalWorldContext(nextContext);
  }, [externalWorldContext]);

  // Entity guidance and culture identities - the canonical configuration format
  const [localEntityGuidance, setLocalEntityGuidance] = useState(() => createDefaultEntityGuidance());
  const [localCultureIdentities, setLocalCultureIdentities] = useState(() => createDefaultCultureIdentities());
  const entityGuidance = localEntityGuidance;
  const cultureIdentities = localCultureIdentities;
  const pendingEntityGuidanceRef = useRef(localEntityGuidance);
  const pendingCultureIdentitiesRef = useRef(localCultureIdentities);
  const lastWorldDataRef = useRef(null);

  // Sync entity guidance from external prop
  useEffect(() => {
    if (externalEntityGuidance === undefined) return;
    const nextEntityGuidance = externalEntityGuidance || createDefaultEntityGuidance();
    pendingEntityGuidanceRef.current = nextEntityGuidance;
    setLocalEntityGuidance(nextEntityGuidance);
  }, [externalEntityGuidance]);

  // Sync culture identities from external prop
  useEffect(() => {
    if (externalCultureIdentities === undefined) return;
    const nextCultureIdentities = externalCultureIdentities || createDefaultCultureIdentities();
    pendingCultureIdentitiesRef.current = nextCultureIdentities;
    setLocalCultureIdentities(nextCultureIdentities);
  }, [externalCultureIdentities]);

  // Entities with enrichment state
  const [entities, setEntities] = useState([]);
  const persistedEnrichmentRef = useRef({ projectId: null, simulationRunId: null });
  const lastSimulationRunIdRef = useRef(null);

  // Initialize entities from worldData
  // NOTE: Enrichment is persisted in worldData itself (via onEnrichmentComplete callback).
  // If entities have same IDs but come from different simulation runs, they should
  // NOT share enrichment - the enrichment belongs to the specific simulation.
  // However, when worldData reference changes during the same session, we preserve
  // local enrichment state (summary, description, enrichment) to avoid flash.
  useEffect(() => {
    if (!worldData?.hardState) {
      setEntities([]);
      lastSimulationRunIdRef.current = null;
      return;
    }

    const nextRunId = worldData?.metadata?.simulationRunId || null;
    const shouldPreserve = nextRunId && lastSimulationRunIdRef.current === nextRunId;
    lastSimulationRunIdRef.current = nextRunId;

    setEntities((prev) => {
      // If no previous state, use worldData directly
      if (!prev.length || !shouldPreserve) {
        return worldData.hardState;
      }

      // Build map of previous entities with their enrichment
      const prevById = new Map(prev.map((e) => [e.id, e]));

      // Merge worldData with preserved enrichment from previous state
      return worldData.hardState.map((entity) => {
        const prevEntity = prevById.get(entity.id);
        if (!prevEntity) return entity;

        // Preserve local enrichment state if it's newer or missing in worldData
        const hasLocalEnrichment = prevEntity.enrichment?.text?.generatedAt;
        const hasWorldEnrichment = entity.enrichment?.text?.generatedAt;

        if (hasLocalEnrichment && (!hasWorldEnrichment || prevEntity.enrichment.text.generatedAt > entity.enrichment.text.generatedAt)) {
          return {
            ...entity,
            enrichment: prevEntity.enrichment,
            summary: prevEntity.summary,
            description: prevEntity.description,
          };
        }

        return entity;
      });
    });
  }, [worldData]);

  const entityById = useMemo(() => buildEntityIndex(entities), [entities]);
  const relationshipsByEntity = useMemo(
    () => buildRelationshipIndex(worldData?.relationships || []),
    [worldData?.relationships]
  );
  const currentEra = useMemo(
    () => resolveEraInfo(worldData?.metadata, entities),
    [worldData?.metadata, entities]
  );

  // Build era temporal info for description prompts (same format as chronicle wizard)
  const eraTemporalInfo = useMemo(() => {
    if (!entities || !worldData?.history) return [];

    // Get era entities
    const eraEntities = entities.filter((e) => e.kind === 'era');
    if (eraEntities.length === 0) return [];

    // Sort by createdAt to determine order
    const sortedEras = [...eraEntities].sort((a, b) => a.createdAt - b.createdAt);

    // Build tick ranges from history events
    // Note: event.era contains the era NAME (e.g. 'expansion'), not the era ID
    const eraTickRangesByName = new Map();
    for (const event of worldData.history) {
      const eraName = event.era;
      if (!eraName) continue;
      const range = eraTickRangesByName.get(eraName) || { min: Infinity, max: -Infinity };
      range.min = Math.min(range.min, event.tick);
      range.max = Math.max(range.max, event.tick);
      eraTickRangesByName.set(eraName, range);
    }

    // Helper to find range by era name (case-insensitive, handles "The X" prefix)
    const findRangeForEra = (era) => {
      // Try exact name match
      if (eraTickRangesByName.has(era.name)) {
        return eraTickRangesByName.get(era.name);
      }
      // Try without "The " prefix
      const nameWithoutThe = era.name.replace(/^The\s+/i, '');
      if (eraTickRangesByName.has(nameWithoutThe)) {
        return eraTickRangesByName.get(nameWithoutThe);
      }
      // Try lowercase match
      const lowerName = era.name.toLowerCase();
      for (const [key, range] of eraTickRangesByName) {
        if (key.toLowerCase() === lowerName || key.toLowerCase() === nameWithoutThe.toLowerCase()) {
          return range;
        }
      }
      return null;
    };

    const result = sortedEras.map((era, index) => {
      const range = findRangeForEra(era) || { min: era.createdAt, max: era.createdAt };
      return {
        id: era.id,
        name: era.name,
        summary: era.summary || '',
        order: index,
        startTick: range.min,
        endTick: range.max + 1, // exclusive
        duration: range.max - range.min + 1,
      };
    });

    console.log('[IlluminatorRemote] eraTemporalInfo built:', {
      eraCount: result.length,
      historyEventCount: worldData.history.length,
      eraNameKeysInHistory: Array.from(eraTickRangesByName.keys()),
      eraRanges: result.map(e => ({ id: e.id, name: e.name, start: e.startTick, end: e.endTick })),
    });

    return result;
  }, [entities, worldData]);

  // Find the focal era for an entity based on its creation tick
  const findFocalEra = useCallback((createdAt) => {
    if (!eraTemporalInfo.length) return undefined;
    // Find era that contains this tick
    const focalEra = eraTemporalInfo.find(
      (era) => createdAt >= era.startTick && createdAt < era.endTick
    );
    // Fall back to last era if entity was created after all era ranges
    return focalEra || eraTemporalInfo[eraTemporalInfo.length - 1];
  }, [eraTemporalInfo]);

  const prominentByCulture = useMemo(() => {
    const map = new Map();
    for (const entity of entities) {
      if (!entity.culture) continue;
      if (!['mythic', 'renowned'].includes(entity.prominence)) continue;
      const existing = map.get(entity.culture);
      if (existing) {
        existing.push(entity);
      } else {
        map.set(entity.culture, [entity]);
      }
    }
    return map;
  }, [entities]);

  // Handle assigning an existing image from the library to an entity
  const handleAssignImage = useCallback((entityId, imageId, imageMetadata) => {
    const enrichment = {
      image: {
        imageId,
        generatedAt: imageMetadata?.generatedAt || Date.now(),
        model: imageMetadata?.model || 'assigned',
        revisedPrompt: imageMetadata?.revisedPrompt,
        // No cost for assignment - image already exists
        estimatedCost: 0,
        actualCost: 0,
      },
    };

    setEntities((prev) =>
      prev.map((entity) =>
        entity.id === entityId
          ? { ...entity, enrichment: { ...entity.enrichment, ...enrichment } }
          : entity
      )
    );
  }, []);

  // Handle entity enrichment update from queue
  // output is ApplyEnrichmentOutput with { enrichment, summary?, description? }
  const handleEntityUpdate = useCallback((entityId, output) => {
    setEntities((prev) =>
      prev.map((entity) =>
        entity.id === entityId
          ? {
              ...entity,
              enrichment: { ...entity.enrichment, ...output.enrichment },
              // Apply entity field updates from text enrichment
              ...(output.summary !== undefined && { summary: output.summary }),
              ...(output.description !== undefined && { description: output.description }),
            }
          : entity
      )
    );
  }, []);

  // Extract simulationRunId from worldData for content association
  const simulationRunId = worldData?.metadata?.simulationRunId;

  // Load persisted enrichment results for the active simulation
  useEffect(() => {
    if (!projectId || !simulationRunId || !worldData?.hardState?.length) return;
    if (
      persistedEnrichmentRef.current.projectId === projectId &&
      persistedEnrichmentRef.current.simulationRunId === simulationRunId
    ) {
      return;
    }

    persistedEnrichmentRef.current = { projectId, simulationRunId };
    let cancelled = false;

    getEnrichmentResults(projectId, simulationRunId)
      .then((records) => {
        if (cancelled || !records.length) return;

        setEntities((prev) => {
          const worldEntities = worldData?.hardState || prev;
          const worldIds = new Set(worldEntities.map((entity) => entity.id));
          const prevMatchesWorld =
            prev.length === worldEntities.length &&
            prev.every((entity) => worldIds.has(entity.id));
          const baseEntities = prevMatchesWorld ? prev : worldEntities;

          return mergePersistedResults(baseEntities, records);
        });
      })
      .catch((err) => {
        console.warn('[Illuminator] Failed to load persisted enrichments:', err);
      });

    return () => {
      cancelled = true;
    };
  }, [projectId, simulationRunId, worldData]);

  // Queue management
  const {
    queue,
    isWorkerReady,
    stats,
    initialize: initializeWorker,
    enqueue,
    cancel,
    cancelAll,
    retry,
    clearCompleted,
  } = useEnrichmentQueue(handleEntityUpdate, projectId, simulationRunId);

  // Initialize worker when API keys change
  useEffect(() => {
    if (anthropicApiKey || openaiApiKey) {
      initializeWorker({
        anthropicApiKey,
        openaiApiKey,
        imageModel: config.imageModel,
        imageSize: config.imageSize,
        imageQuality: config.imageQuality,
        // Multishot prompting options
        useClaudeForImagePrompt: config.useClaudeForImagePrompt,
        claudeImagePromptTemplate: config.claudeImagePromptTemplate,
        // Per-call LLM model settings (resolved from localStorage)
        llmCallSettings: getResolvedLLMCallSettings(),
      });
    }
  }, [anthropicApiKey, openaiApiKey, config, initializeWorker]);

  // Save enriched entities to IndexedDB when they change
  useEffect(() => {
    if (!worldData?.hardState?.length || !onEnrichmentComplete) return;
    if (worldData !== lastWorldDataRef.current) {
      lastWorldDataRef.current = worldData;
      return;
    }

    let didChange = false;
    const enrichedHardState = worldData.hardState.map((entity) => {
      const local = entityById.get(entity.id);
      if (!local) return entity;
      // Check for changes in enrichment, summary, or description
      const enrichmentChanged = local.enrichment && !isEnrichmentEqual(local.enrichment, entity.enrichment);
      const summaryChanged = local.summary !== entity.summary;
      const descriptionChanged = local.description !== entity.description;
      if (!enrichmentChanged && !summaryChanged && !descriptionChanged) return entity;
      didChange = true;
      return {
        ...entity,
        enrichment: local.enrichment,
        summary: local.summary,
        description: local.description,
      };
    });

    if (!didChange) return;

    const enrichedWorld = {
      ...worldData,
      hardState: enrichedHardState,
      metadata: {
        ...worldData.metadata,
        enriched: true,
        enrichedAt: Date.now(),
      },
    };
    onEnrichmentComplete(enrichedWorld);
  }, [entityById, worldData, onEnrichmentComplete]);

  // Build world schema from props
  const worldSchema = useMemo(() => {
    if (worldData?.schema) return worldData.schema;
    return schema || { entityKinds: [], relationshipKinds: [], cultures: [], tagRegistry: [] };
  }, [worldData?.schema, schema]);

  const simulationMetadata = useMemo(() => {
    if (!worldData?.metadata) return undefined;
    return {
      currentTick: worldData.metadata.tick,
      currentEra: currentEra || undefined,
    };
  }, [worldData?.metadata, currentEra]);

  // Extract era entities for palette generation
  const eraEntities = useMemo(() => {
    return entities
      .filter((e) => e.kind === 'era')
      .map((e) => ({
        id: e.id,
        name: e.name,
        description: e.description,
      }));
  }, [entities]);

  // Build subtypes by kind map for palette generation
  // Extract subtype IDs from Subtype objects ({ id, name } → id)
  const subtypesByKind = useMemo(() => {
    const map = {};
    for (const kindDef of worldSchema?.entityKinds || []) {
      if (kindDef.kind && kindDef.subtypes?.length > 0) {
        map[kindDef.kind] = kindDef.subtypes.map((st) => st.id);
      }
    }
    return map;
  }, [worldSchema?.entityKinds]);

  // Check if we have world data
  const hasWorldData = worldData?.hardState?.length > 0;

  // Check if API keys are set
  const hasAnthropicKey = anthropicApiKey.length > 0;
  const hasOpenaiKey = openaiApiKey.length > 0;
  const hasRequiredKeys = hasAnthropicKey;

  // Get visual config for an entity (thesis/traits prompts, avoid elements, era)
  const getVisualConfig = useCallback(
    (entity) => {
      const visualConfig = getVisualConfigFromGuidance(entityGuidance, entity.kind);

      // Find entity's era via created_during relationship (origin era)
      // Falls back to active_during if no created_during exists
      const entityRels = relationshipsByEntity.get(entity.id) || [];
      const eraRel = entityRels.find(r =>
        (r.kind === 'created_during' || r.kind === 'active_during') && r.src === entity.id
      );
      const entityEraId = eraRel?.dst;

      // Get focal era and all eras for description timeline
      const entityFocalEra = findFocalEra(entity.createdAt || 0);
      const entityAllEras = eraTemporalInfo.length > 0 ? eraTemporalInfo : undefined;

      return {
        ...visualConfig,
        entityEraId,
        entityFocalEra,
        entityAllEras,
      };
    },
    [entityGuidance, relationshipsByEntity, findFocalEra, eraTemporalInfo]
  );

  // Build prompt for entity using EntityGuidance and CultureIdentities directly
  const buildPrompt = useCallback(
    (entity, type) => {
      // Build relationships
      const relationships = (relationshipsByEntity.get(entity.id) || []).slice(0, 8).map((rel) => {
        const targetId = rel.src === entity.id ? rel.dst : rel.src;
        const target = entityById.get(targetId);
        return {
          kind: rel.kind,
          targetName: target?.name || targetId,
          targetKind: target?.kind || 'unknown',
          targetSubtype: target?.subtype,
          strength: rel.strength,
        };
      });

      // Build entity context
      const entityContext = {
        entity: {
          id: entity.id,
          name: entity.name,
          kind: entity.kind,
          subtype: entity.subtype,
          prominence: entity.prominence,
          culture: entity.culture || '',
          status: entity.status || 'active',
          summary: entity.summary || '',
          description: entity.description || '',
          tags: entity.tags || {},
          visualThesis: entity.enrichment?.text?.visualThesis || '',
          visualTraits: entity.enrichment?.text?.visualTraits || [],
        },
        relationships,
        era: {
          name: currentEra?.name || worldData?.metadata?.era || '',
          description: currentEra?.description,
        },
        entityAge: 'established',
        culturalPeers: (prominentByCulture.get(entity.culture) || [])
          .filter((peer) => peer.id !== entity.id)
          .slice(0, 3)
          .map((peer) => peer.name),
      };

      if (type === 'description') {
        return buildDescriptionPromptFromGuidance(
          entityGuidance,
          cultureIdentities,
          worldContext,
          entityContext
        );
      } else if (type === 'image') {
        // Resolve style selection for this entity
        const resolvedStyle = resolveStyleSelection({
          selection: styleSelection,
          entityCultureId: entity.culture,
          entityKind: entity.kind,
          cultures: worldSchema?.cultures || [],
          styleLibrary,
        });

        // Build style info for the prompt
        const styleInfo = {
          artisticPromptFragment: resolvedStyle.artisticStyle?.promptFragment,
          compositionPromptFragment: resolvedStyle.compositionStyle?.promptFragment,
          colorPalettePromptFragment: resolvedStyle.colorPalette?.promptFragment,
          cultureKeywords: resolvedStyle.cultureKeywords,
        };

        return buildImagePromptFromGuidance(
          entityGuidance,
          cultureIdentities,
          worldContext,
          entityContext,
          styleInfo
        );
      }

      return `Describe ${entity.name}, a ${entity.subtype} ${entity.kind}.`;
    },
    [
      worldContext,
      entityGuidance,
      cultureIdentities,
      relationshipsByEntity,
      entityById,
      currentEra,
      worldData?.metadata?.era,
      prominentByCulture,
      styleSelection,
      worldSchema?.cultures,
      styleLibrary,
    ]
  );

  // Update config
  const updateConfig = useCallback((updates) => {
    setConfig((prev) => ({ ...prev, ...updates }));
  }, []);

  const updateWorldContext = useCallback(
    (updates) => {
      setLocalWorldContext((prev) => {
        const merged = { ...prev, ...updates };
        pendingWorldContextRef.current = merged;
        if (onWorldContextChange) {
          worldContextDirtyRef.current = true;
          if (worldContextSyncTimeoutRef.current) {
            clearTimeout(worldContextSyncTimeoutRef.current);
          }
          worldContextSyncTimeoutRef.current = setTimeout(() => {
            if (!worldContextDirtyRef.current) return;
            worldContextDirtyRef.current = false;
            onWorldContextChange(pendingWorldContextRef.current);
            worldContextSyncTimeoutRef.current = null;
          }, 300);
        }
        return merged;
      });
    },
    [onWorldContextChange]
  );

  // Update entity guidance
  const entityGuidanceSyncTimeoutRef = useRef(null);
  const updateEntityGuidance = useCallback(
    (nextGuidance) => {
      setLocalEntityGuidance(nextGuidance);
      pendingEntityGuidanceRef.current = nextGuidance;
      if (!onEntityGuidanceChange) return;
      if (entityGuidanceSyncTimeoutRef.current) {
        clearTimeout(entityGuidanceSyncTimeoutRef.current);
      }
      entityGuidanceSyncTimeoutRef.current = setTimeout(() => {
        onEntityGuidanceChange(pendingEntityGuidanceRef.current);
        entityGuidanceSyncTimeoutRef.current = null;
      }, 300);
    },
    [onEntityGuidanceChange]
  );

  // Update culture identities
  const cultureIdentitiesSyncTimeoutRef = useRef(null);
  const updateCultureIdentities = useCallback(
    (nextIdentities) => {
      setLocalCultureIdentities(nextIdentities);
      pendingCultureIdentitiesRef.current = nextIdentities;
      if (!onCultureIdentitiesChange) return;
      if (cultureIdentitiesSyncTimeoutRef.current) {
        clearTimeout(cultureIdentitiesSyncTimeoutRef.current);
      }
      cultureIdentitiesSyncTimeoutRef.current = setTimeout(() => {
        onCultureIdentitiesChange(pendingCultureIdentitiesRef.current);
        cultureIdentitiesSyncTimeoutRef.current = null;
      }, 300);
    },
    [onCultureIdentitiesChange]
  );

  useEffect(() => {
    return () => {
      if (worldContextSyncTimeoutRef.current) {
        clearTimeout(worldContextSyncTimeoutRef.current);
        worldContextSyncTimeoutRef.current = null;
      }
      if (entityGuidanceSyncTimeoutRef.current) {
        clearTimeout(entityGuidanceSyncTimeoutRef.current);
        entityGuidanceSyncTimeoutRef.current = null;
      }
      if (cultureIdentitiesSyncTimeoutRef.current) {
        clearTimeout(cultureIdentitiesSyncTimeoutRef.current);
        cultureIdentitiesSyncTimeoutRef.current = null;
      }
      if (worldContextDirtyRef.current && onWorldContextChange) {
        onWorldContextChange(pendingWorldContextRef.current);
      }
    };
  }, [onWorldContextChange]);

  if (!hasWorldData) {
    return (
      <div className="illuminator-empty-state">
        <div className="illuminator-empty-state-icon">&#x2728;</div>
        <div className="illuminator-empty-state-title">No World Data</div>
        <div className="illuminator-empty-state-desc">
          Run a simulation in <strong>Lore Weave</strong> first, then return here to enrich your
          world with LLM-generated descriptions and images.
        </div>
      </div>
    );
  }

  return (
    <div className="illuminator-container">
      {/* Left sidebar with nav, progress, and API keys */}
      <div className="illuminator-sidebar">
        <nav className="illuminator-nav">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`illuminator-nav-button ${activeTab === tab.id ? 'active' : ''}`}
            >
              {tab.label}
              {tab.id === 'activity' && stats.running > 0 && (
                <span
                  style={{
                    marginLeft: 'auto',
                    background: '#f59e0b',
                    color: 'white',
                    padding: '2px 6px',
                    borderRadius: '10px',
                    fontSize: '10px',
                  }}
                >
                  {stats.running}
                </span>
              )}
              {tab.id === 'activity' && stats.errored > 0 && stats.running === 0 && (
                <span
                  style={{
                    marginLeft: 'auto',
                    background: '#ef4444',
                    color: 'white',
                    padding: '2px 6px',
                    borderRadius: '10px',
                    fontSize: '10px',
                  }}
                >
                  {stats.errored}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* API Key section */}
        <div className="illuminator-api-section">
          <button
            onClick={() => setShowApiKeyInput(!showApiKeyInput)}
            className={`illuminator-api-button ${hasRequiredKeys ? 'active' : ''}`}
          >
            {hasRequiredKeys ? 'API Keys Set' : 'Set API Keys'}
          </button>
          {showApiKeyInput && (
            <div className="illuminator-api-dropdown">
              <div className="illuminator-api-dropdown-title">Anthropic API Key</div>
              <p className="illuminator-api-dropdown-hint">Required for text enrichment.</p>
              <input
                type="password"
                value={anthropicApiKey}
                onChange={(e) => setAnthropicApiKey(e.target.value)}
                placeholder="sk-ant-..."
                className="illuminator-api-input"
              />
              <div className="illuminator-api-dropdown-title">OpenAI API Key</div>
              <p className="illuminator-api-dropdown-hint">Required for image generation.</p>
              <input
                type="password"
                value={openaiApiKey}
                onChange={(e) => setOpenaiApiKey(e.target.value)}
                placeholder="sk-..."
                className="illuminator-api-input"
              />
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginTop: '12px',
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={persistApiKeys}
                  onChange={(e) => setPersistApiKeys(e.target.checked)}
                />
                Remember API keys (stored in browser)
              </label>
              <button
                onClick={() => setShowApiKeyInput(false)}
                className="illuminator-api-button active"
                style={{ marginTop: '12px' }}
              >
                Done
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main content area */}
      <div className="illuminator-main">
        {/* Temporary slot warning */}
        {isTemporarySlot && (
          <div className="illuminator-temp-slot-warning">
            <span className="illuminator-temp-slot-warning-icon">⚠</span>
            <span>
              You are enriching data in a <strong>temporary slot</strong>, which will be
              automatically deleted when a new Lore Weave simulation is run. Consider saving to a
              permanent slot before enrichment.
            </span>
          </div>
        )}

        {/* No API keys warning */}
        {!hasRequiredKeys && activeTab === 'entities' && (
          <div
            style={{
              padding: '12px 16px',
              marginBottom: '16px',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '6px',
              fontSize: '13px',
            }}
          >
            Set your API keys in the sidebar to enable enrichment.
          </div>
        )}

        {activeTab === 'entities' && (
          <div className="illuminator-content">
            <EntityBrowser
              entities={entities}
              queue={queue}
              onEnqueue={enqueue}
              onCancel={cancel}
              onAssignImage={handleAssignImage}
              worldSchema={worldSchema}
              config={config}
              onConfigChange={updateConfig}
              buildPrompt={buildPrompt}
              getVisualConfig={getVisualConfig}
              styleLibrary={styleLibrary}
              styleSelection={styleSelection}
              onStyleSelectionChange={setStyleSelection}
            />
          </div>
        )}

        {activeTab === 'chronicle' && (
          <div className="illuminator-content">
            <ChroniclePanel
              worldData={worldData}
              entities={entities}
              queue={queue}
              onEnqueue={enqueue}
              onCancel={cancel}
              worldContext={worldContext}
              projectId={projectId}
              simulationRunId={simulationRunId}
              buildPrompt={buildPrompt}
              styleLibrary={styleLibrary}
              styleSelection={styleSelection}
              entityGuidance={entityGuidance}
              cultureIdentities={cultureIdentities}
            />
          </div>
        )}

        {activeTab === 'pages' && (
          <div className="illuminator-content">
            <StaticPagesPanel
              projectId={projectId}
              entities={entities}
            />
          </div>
        )}

        {activeTab === 'context' && (
          <div className="illuminator-content">
            <WorldContextEditor
              worldContext={worldContext}
              onWorldContextChange={updateWorldContext}
            />
          </div>
        )}

        {activeTab === 'guidance' && (
          <div className="illuminator-content">
            <EntityGuidanceEditor
              entityGuidance={entityGuidance}
              onEntityGuidanceChange={updateEntityGuidance}
              worldContext={worldContext}
              worldData={worldData}
              worldSchema={worldSchema}
              simulationMetadata={simulationMetadata}
            />
          </div>
        )}

        {activeTab === 'identity' && (
          <div className="illuminator-content">
            <VisualIdentityPanel
              cultures={worldSchema?.cultures || []}
              entityKinds={worldSchema?.entityKinds || []}
              cultureIdentities={cultureIdentities}
              onCultureIdentitiesChange={updateCultureIdentities}
            />
          </div>
        )}

        {activeTab === 'styles' && (
          <div className="illuminator-content">
            <StyleLibraryEditor
              styleLibrary={styleLibrary}
              loading={styleLibraryLoading}
              isCustom={hasCustomStyleLibrary}
              onAddArtisticStyle={addArtisticStyle}
              onUpdateArtisticStyle={updateArtisticStyle}
              onDeleteArtisticStyle={deleteArtisticStyle}
              onAddCompositionStyle={addCompositionStyle}
              onUpdateCompositionStyle={updateCompositionStyle}
              onDeleteCompositionStyle={deleteCompositionStyle}
              onAddNarrativeStyle={addNarrativeStyle}
              onUpdateNarrativeStyle={updateNarrativeStyle}
              onDeleteNarrativeStyle={deleteNarrativeStyle}
              onReset={resetStyleLibrary}
              entityKinds={(worldSchema?.entityKinds || []).map((k) => k.kind)}
            />
          </div>
        )}

        {activeTab === 'activity' && (
          <div className="illuminator-content">
            <ActivityPanel
              queue={queue}
              stats={stats}
              onCancel={cancel}
              onRetry={retry}
              onCancelAll={cancelAll}
              onClearCompleted={clearCompleted}
              enrichmentTriggers={worldData?.metadata?.enrichmentTriggers}
            />
          </div>
        )}

        {activeTab === 'costs' && (
          <div className="illuminator-content">
            <CostsPanel queue={queue} projectId={projectId} simulationRunId={simulationRunId} />
          </div>
        )}

        {activeTab === 'storage' && (
          <div className="illuminator-content">
            <StoragePanel projectId={projectId} />
          </div>
        )}

        {activeTab === 'traits' && (
          <div className="illuminator-content">
            <TraitPaletteSection
              projectId={projectId}
              simulationRunId={simulationRunId}
              worldContext={worldContext?.description || ''}
              entityKinds={(worldSchema?.entityKinds || []).map((k) => k.kind)}
              subtypesByKind={subtypesByKind}
              eras={eraEntities}
              cultures={(worldSchema?.cultures || []).map((c) => ({
                name: c.name,
                description: c.description,
                visualIdentity: c.visualIdentity,
              }))}
              enqueue={enqueue}
              queue={queue}
              isWorkerReady={isWorkerReady}
            />
          </div>
        )}

        {activeTab === 'configure' && (
          <div className="illuminator-content">
            <ConfigPanel config={config} onConfigChange={updateConfig} worldSchema={worldSchema} />
          </div>
        )}
      </div>
    </div>
  );
}
