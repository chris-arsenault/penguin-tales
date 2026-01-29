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
import DynamicsGenerationModal from './components/DynamicsGenerationModal';
import SummaryRevisionModal from './components/SummaryRevisionModal';
import RevisionFilterModal from './components/RevisionFilterModal';
import { useEnrichmentQueue } from './hooks/useEnrichmentQueue';
import { useDynamicsGeneration } from './hooks/useDynamicsGeneration';
import { useSummaryRevision } from './hooks/useSummaryRevision';
import { getPublishedStaticPagesForProject } from './lib/staticPageStorage';
import { getEntityUsageStats } from './lib/chronicleStorage';
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
import {
  buildProminenceScale,
  DEFAULT_PROMINENCE_DISTRIBUTION,
  prominenceThresholdFromScale,
  prominenceLabelFromScale,
  getEntityEvents,
  getEntityEffects,
} from '@canonry/world-schema';

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
const DEFAULT_IMAGE_PROMPT_TEMPLATE = `Transform the structured prompt below into a single, coherent image prompt for {{modelName}}. Do NOT simply reformat—actively synthesize and reshape:

Honor the VISUAL THESIS: This is the primary visual signal. The thesis describes the dominant silhouette feature that makes this entity instantly recognizable. Build the entire image around it.

Synthesize, don't list:
- Merge SUBJECT + CONTEXT + CULTURAL IDENTITY into a unified visual
- Apply STYLE (artistic approach) and COMPOSITION (framing/perspective) to shape the rendering
- Translate SUPPORTING TRAITS into concrete visual details that reinforce the thesis
- Incorporate COLOR PALETTE if provided

Establish clear composition and perspective:
- Honor the COMPOSITION directive for framing and vantage point
- Use environmental storytelling (objects, weathering, traces) to convey history
- The SETTING provides world context but the subject is the focus

Create specific visual instructions: Rather than listing adjectives, use concrete visual language: "weathered by decades of X," "visible scars of Y," "rendered in the style of Z"

Respect the AVOID list: These are hard constraints—elements that break the visual language.

Condense to a single, authoritative prompt: Output should be 150-300 words, reading as clear artistic direction that could be handed to a concept artist—not a bulleted list.
{{globalImageRules}}
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
  // Global image rules - domain-specific constraints injected into Claude image prompt
  globalImageRules: '',
  // Description generation options
  minEventSignificance: 0.25, // Include events above 'low' threshold
};

const normalizeEnrichmentConfig = (config) => {
  if (!config) return null;
  // Remove legacy model fields that have been migrated to per-call settings
  const { textModel, chronicleModel, textModal, chronicleModal, thinkingModel, thinkingBudget, useThinkingForDescriptions, ...rest } = config;
  return { ...DEFAULT_CONFIG, ...rest };
};

const buildSchemaContext = (schema) => {
  if (!schema) return '';
  const sections = [];
  if (schema.entityKinds?.length) {
    sections.push('Entity Kinds: ' + schema.entityKinds.map((k) => k.kind).join(', '));
  }
  if (schema.relationshipKinds?.length) {
    sections.push('Relationship Kinds: ' + schema.relationshipKinds.map((k) => k.kind).join(', '));
  }
  if (schema.cultures?.length) {
    sections.push('Cultures: ' + schema.cultures.map((c) => c.name || c.id).join(', '));
  }
  return sections.join('\n');
};

const resolveEntityEraId = (entity) => {
  if (!entity) return undefined;
  if (typeof entity.eraId === 'string' && entity.eraId) return entity.eraId;
  return undefined;
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
  // Structured fields - the canonical source of truth
  toneFragments: { core: '' },
  canonFactsWithMetadata: [],
  worldDynamics: [],
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
  const prominenceScale = useMemo(() => {
    const values = entities
      .map((entity) => entity.prominence)
      .filter((value) => typeof value === 'number' && Number.isFinite(value));
    return buildProminenceScale(values, { distribution: DEFAULT_PROMINENCE_DISTRIBUTION });
  }, [entities]);
  const renownedThreshold = useMemo(
    () => prominenceThresholdFromScale('renowned', prominenceScale),
    [prominenceScale]
  );
  const relationshipsByEntity = useMemo(
    () => buildRelationshipIndex(worldData?.relationships || []),
    [worldData?.relationships]
  );
  const currentEra = useMemo(
    () => resolveEraInfo(worldData?.metadata, entities),
    [worldData?.metadata, entities]
  );

  // Build era temporal info for description prompts (same format as chronicle wizard)
  // NOTE: Use era entity temporal data directly - do not compute ranges from history or ticks.
  const eraTemporalInfo = useMemo(() => {
    if (!entities?.length) return [];

    const eraEntities = entities.filter((e) => e.kind === 'era' && e.temporal?.startTick != null);
    if (eraEntities.length === 0) return [];

    const sortedEras = [...eraEntities].sort(
      (a, b) => a.temporal.startTick - b.temporal.startTick
    );

    const result = sortedEras.map((era, index) => {
      const startTick = era.temporal.startTick;
      const endTick = era.temporal.endTick ?? startTick;
      const eraId = resolveEntityEraId(era) || era.id;
      return {
        id: eraId,
        name: era.name,
        summary: era.summary || '',
        order: index,
        startTick,
        endTick,
        duration: endTick - startTick,
      };
    });

    console.log('[IlluminatorRemote] eraTemporalInfo built:', {
      eraCount: result.length,
      eraRanges: result.map(e => ({ id: e.id, name: e.name, start: e.startTick, end: e.endTick })),
    });

    return result;
  }, [entities]);

  const eraTemporalInfoByKey = useMemo(() => {
    if (!eraTemporalInfo.length || !entities?.length) return new Map();

    const byId = new Map(eraTemporalInfo.map((era) => [era.id, era]));
    const map = new Map(byId);

    for (const entity of entities) {
      if (entity.kind !== 'era') continue;
      const eraInfo = byId.get(entity.id);
      if (!eraInfo) continue;
      if (typeof entity.eraId === 'string' && entity.eraId) {
        map.set(entity.eraId, eraInfo);
      }
    }

    return map;
  }, [entities, eraTemporalInfo]);

  const prominentByCulture = useMemo(() => {
    const map = new Map();
    for (const entity of entities) {
      if (!entity.culture) continue;
      // Prominence at or above renowned
      if (typeof entity.prominence !== 'number' || entity.prominence < renownedThreshold) continue;
      const existing = map.get(entity.culture);
      if (existing) {
        existing.push(entity);
      } else {
        map.set(entity.culture, [entity]);
      }
    }
    return map;
  }, [entities, renownedThreshold]);

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
        globalImageRules: config.globalImageRules,
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

      const entityEraId = resolveEntityEraId(entity);
      const entityFocalEra = entityEraId ? eraTemporalInfoByKey.get(entityEraId) : undefined;
      const entityAllEras = eraTemporalInfo.length > 0 ? eraTemporalInfo : undefined;

      return {
        ...visualConfig,
        entityEraId,
        entityFocalEra,
        entityAllEras,
      };
    },
    [entityGuidance, eraTemporalInfo, eraTemporalInfoByKey]
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
          prominence: prominenceLabelFromScale(entity.prominence, prominenceScale),
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
        // Get entity events from narrative history (filtered by significance)
        const entityEvents = getEntityEvents(
          worldData?.narrativeHistory || [],
          {
            entityId: entity.id,
            minSignificance: config.minEventSignificance ?? 0.25,
            excludeProminenceOnly: true,
            limit: 10, // Cap at 10 events to avoid prompt bloat
          }
        );

        // Add events to entity context (use era name instead of tick)
        entityContext.events = entityEvents.map((e) => {
          // Get era name from entity index (era field is an ID)
          const eraEntity = entityById.get(e.era);
          const eraName = eraEntity?.name || e.era;
          return {
            era: eraName,
            description: e.description,
            significance: e.significance,
            effects: getEntityEffects(e, entity.id).map((eff) => ({
              type: eff.type,
              description: eff.description,
            })),
          };
        });
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
      worldData?.narrativeHistory,
      prominentByCulture,
      styleSelection,
      worldSchema?.cultures,
      styleLibrary,
      config.minEventSignificance,
      prominenceScale,
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

  // Dynamics generation (multi-turn LLM flow for world dynamics)
  const handleDynamicsAccepted = useCallback((proposedDynamics) => {
    if (!proposedDynamics?.length) return;
    const newDynamics = proposedDynamics.map((d, i) => ({
      id: `dyn_gen_${Date.now()}_${i}`,
      text: d.text,
      cultures: d.cultures?.length ? d.cultures : undefined,
      kinds: d.kinds?.length ? d.kinds : undefined,
      eraOverrides: d.eraOverrides && Object.keys(d.eraOverrides).length > 0 ? d.eraOverrides : undefined,
    }));
    const existing = worldContext?.worldDynamics || [];
    updateWorldContext({ worldDynamics: [...existing, ...newDynamics] });
  }, [worldContext, updateWorldContext]);

  const {
    run: dynamicsRun,
    isActive: isDynamicsActive,
    startGeneration: startDynamicsGeneration,
    submitFeedback: submitDynamicsFeedback,
    acceptDynamics,
    cancelGeneration: cancelDynamicsGeneration,
  } = useDynamicsGeneration(enqueue, handleDynamicsAccepted);

  // Summary revision (batch entity summary/description revision)
  const getEntityContextsForRevision = useCallback((entityIds) => {
    return entityIds.map((id) => {
      const entity = entityById.get(id);
      if (!entity) return null;

      const rels = (relationshipsByEntity.get(entity.id) || []).slice(0, 8).map((rel) => {
        const targetId = rel.src === entity.id ? rel.dst : rel.src;
        const target = entityById.get(targetId);
        return {
          kind: rel.kind,
          targetName: target?.name || targetId,
          targetKind: target?.kind || 'unknown',
        };
      });

      return {
        id: entity.id,
        name: entity.name,
        kind: entity.kind,
        subtype: entity.subtype || '',
        prominence: prominenceLabelFromScale(entity.prominence, prominenceScale),
        culture: entity.culture || '',
        status: entity.status || 'active',
        summary: entity.summary || '',
        description: entity.description || '',
        visualThesis: entity.enrichment?.text?.visualThesis || '',
        relationships: rels,
      };
    }).filter(Boolean);
  }, [entityById, relationshipsByEntity, prominenceScale]);

  const handleRevisionApplied = useCallback((patches) => {
    if (!patches?.length) return;
    // Apply patches to entities
    setEntities((prev) =>
      prev.map((entity) => {
        const patch = patches.find((p) => p.entityId === entity.id);
        if (!patch) return entity;
        return {
          ...entity,
          ...(patch.summary !== undefined ? { summary: patch.summary } : {}),
          ...(patch.description !== undefined ? { description: patch.description } : {}),
        };
      })
    );
  }, []);

  const {
    run: revisionRun,
    isActive: isRevisionActive,
    startRevision,
    continueToNextBatch,
    autoContineAll: autoContineAllRevision,
    togglePatchDecision,
    applyAccepted: applyAcceptedPatches,
    cancelRevision,
  } = useSummaryRevision(enqueue, getEntityContextsForRevision);

  // Revision filter modal state
  const [revisionFilter, setRevisionFilter] = useState({
    open: false,
    totalEligible: 0,
    usedInChronicles: 0,
    chronicleEntityIds: new Set(),
  });

  const handleOpenRevisionFilter = useCallback(async () => {
    if (!projectId || !simulationRunId) return;

    const eligible = entities.filter((e) => e.summary && e.description && !e.lockedSummary);

    let chronicleEntityIds = new Set();
    try {
      const usageStats = await getEntityUsageStats(simulationRunId);
      chronicleEntityIds = new Set(usageStats.keys());
    } catch (err) {
      console.warn('[Revision] Failed to load chronicle usage stats:', err);
    }

    const usedInChronicles = eligible.filter((e) => chronicleEntityIds.has(e.id)).length;

    setRevisionFilter({
      open: true,
      totalEligible: eligible.length,
      usedInChronicles,
      chronicleEntityIds,
    });
  }, [projectId, simulationRunId, entities]);

  const handleStartRevision = useCallback(async (excludeChronicleEntities) => {
    if (!projectId || !simulationRunId) return;

    setRevisionFilter((prev) => ({ ...prev, open: false }));

    // Load static pages for lore context
    let staticPagesContext = '';
    try {
      const pages = await getPublishedStaticPagesForProject(projectId);
      if (pages.length > 0) {
        staticPagesContext = pages
          .map((p) => `## ${p.title}\n\n${p.content}`)
          .join('\n\n---\n\n');
      }
    } catch (err) {
      console.warn('[Revision] Failed to load static pages:', err);
    }

    // Build world dynamics context
    const dynamicsContext = (worldContext?.worldDynamics || [])
      .map((d) => {
        let text = d.text;
        if (d.cultures?.length) text += ` [cultures: ${d.cultures.join(', ')}]`;
        if (d.kinds?.length) text += ` [kinds: ${d.kinds.join(', ')}]`;
        return `- ${text}`;
      })
      .join('\n');

    // Build schema context
    const schemaContext = buildSchemaContext(worldSchema);

    // Build entity contexts — exclude locked and optionally chronicle-used entities
    const revisionEntities = entities
      .filter((e) => {
        if (!e.summary || !e.description || e.lockedSummary) return false;
        if (excludeChronicleEntities && revisionFilter.chronicleEntityIds.has(e.id)) return false;
        return true;
      })
      .map((e) => {
        const rels = (relationshipsByEntity.get(e.id) || []).slice(0, 8).map((rel) => {
          const targetId = rel.src === e.id ? rel.dst : rel.src;
          const target = entityById.get(targetId);
          return {
            kind: rel.kind,
            targetName: target?.name || targetId,
            targetKind: target?.kind || 'unknown',
          };
        });

        return {
          id: e.id,
          name: e.name,
          kind: e.kind,
          subtype: e.subtype || '',
          prominence: prominenceLabelFromScale(e.prominence, prominenceScale),
          culture: e.culture || '',
          status: e.status || 'active',
          summary: e.summary || '',
          description: e.description || '',
          visualThesis: e.enrichment?.text?.visualThesis || '',
          relationships: rels,
        };
      });

    startRevision({
      projectId,
      simulationRunId,
      worldDynamicsContext: dynamicsContext,
      staticPagesContext,
      schemaContext,
      revisionGuidance: '',
      entities: revisionEntities,
    });
  }, [projectId, simulationRunId, worldContext, worldSchema, entities, entityById, relationshipsByEntity, prominenceScale, startRevision, revisionFilter.chronicleEntityIds]);

  const handleAcceptRevision = useCallback(() => {
    const patches = applyAcceptedPatches();
    handleRevisionApplied(patches);
  }, [applyAcceptedPatches, handleRevisionApplied]);

  const handleGenerateDynamics = useCallback(async () => {
    if (!projectId || !simulationRunId) return;

    // Load static pages for lore context
    let staticPagesContext = '';
    try {
      const pages = await getPublishedStaticPagesForProject(projectId);
      if (pages.length > 0) {
        staticPagesContext = pages
          .map((p) => `## ${p.title}\n\n${p.content}`)
          .join('\n\n---\n\n');
      }
    } catch (err) {
      console.warn('[Dynamics] Failed to load static pages:', err);
    }

    // Build schema context
    const schemaContext = buildSchemaContext(worldSchema);

    // Build entity context for search execution
    const entityContexts = entities.map((e) => ({
      id: e.id,
      name: e.name,
      kind: e.kind,
      subtype: e.subtype || '',
      culture: e.culture || '',
      status: e.status || '',
      summary: e.summary || '',
      description: e.description || '',
      tags: e.tags || {},
      eraId: e.eraId,
    }));

    const relationships = (worldData?.relationships || []).map((r) => ({
      src: r.src,
      dst: r.dst,
      kind: r.kind,
      weight: r.weight,
      srcName: entityById.get(r.src)?.name || r.src,
      dstName: entityById.get(r.dst)?.name || r.dst,
    }));

    startDynamicsGeneration({
      projectId,
      simulationRunId,
      staticPagesContext,
      schemaContext,
      entities: entityContexts,
      relationships,
    });
  }, [projectId, simulationRunId, worldSchema, entities, worldData, entityById, startDynamicsGeneration]);

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
              prominenceScale={prominenceScale}
              onStartRevision={handleOpenRevisionFilter}
              isRevising={isRevisionActive}
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
              eras={eraTemporalInfo}
              onGenerateDynamics={handleGenerateDynamics}
              isGeneratingDynamics={isDynamicsActive}
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
              prominenceScale={prominenceScale}
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

      {/* Dynamics Generation Modal */}
      <DynamicsGenerationModal
        run={dynamicsRun}
        isActive={isDynamicsActive}
        onSubmitFeedback={submitDynamicsFeedback}
        onAccept={acceptDynamics}
        onCancel={cancelDynamicsGeneration}
      />

      {/* Revision Filter Modal (pre-step) */}
      <RevisionFilterModal
        isOpen={revisionFilter.open}
        totalEligible={revisionFilter.totalEligible}
        usedInChronicles={revisionFilter.usedInChronicles}
        onStart={handleStartRevision}
        onCancel={() => setRevisionFilter((prev) => ({ ...prev, open: false }))}
      />

      {/* Summary Revision Modal */}
      <SummaryRevisionModal
        run={revisionRun}
        isActive={isRevisionActive}
        onContinue={continueToNextBatch}
        onAutoContine={autoContineAllRevision}
        onTogglePatch={togglePatchDecision}
        onAccept={handleAcceptRevision}
        onCancel={cancelRevision}
        getEntityContexts={getEntityContextsForRevision}
      />
    </div>
  );
}
