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
import PromptTemplateEditor from './components/PromptTemplateEditor';
import VisualIdentityPanel from './components/VisualIdentityPanel';
import ActivityPanel from './components/ActivityPanel';
import ConfigPanel from './components/ConfigPanel';
import CostsPanel from './components/CostsPanel';
import StoragePanel from './components/StoragePanel';
import StyleLibraryEditor from './components/StyleLibraryEditor';
import { useEnrichmentQueue } from './hooks/useEnrichmentQueue';
import { useStyleLibrary } from './hooks/useStyleLibrary';
import {
  createDefaultPromptTemplates,
  buildDescriptionPrompt,
  buildImagePrompt,
  getEffectiveTemplate,
  mergeWithDefaults,
} from './lib/promptTemplates';
import { buildEntityIndex, buildRelationshipIndex, resolveEraInfo } from './lib/worldData';
import { resolveStyleSelection } from './components/StyleSelector';

// Tabs ordered by workflow: setup → work → monitor → manage
const TABS = [
  { id: 'configure', label: 'Configure' },   // 1. Set API keys and models
  { id: 'context', label: 'Context' },       // 2. Define world context
  { id: 'templates', label: 'Templates' },   // 3. Customize prompts
  { id: 'identity', label: 'Identity' },     // 4. Visual identity per culture
  { id: 'styles', label: 'Styles' },         // 5. Manage style library
  { id: 'entities', label: 'Entities' },     // 6. Main enrichment work
  { id: 'chronicle', label: 'Chronicle' },   // 8. Wiki-ready long-form content
  { id: 'activity', label: 'Activity' },     // 9. Monitor queue
  { id: 'costs', label: 'Costs' },           // 10. Track spending
  { id: 'storage', label: 'Storage' },       // 11. Manage images
];

// Default image prompt template for Claude formatting
const DEFAULT_IMAGE_PROMPT_TEMPLATE = `Reformat the below prompt into something appropriate for generating a {{modelName}} image of an entity. Avoid bestiary/manuscript/folio style pages - instead create artwork that directly represents the subject as if they exist in the world.

Original prompt:
{{prompt}}`;

// Default enrichment config
const DEFAULT_CONFIG = {
  textModel: 'claude-sonnet-4-5-20250929',
  chronicleModel: 'claude-sonnet-4-5-20250929',  // Model for entity stories
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

// Default world context
const DEFAULT_WORLD_CONTEXT = {
  name: '',
  description: '',
  canonFacts: [],
  tone: '',
};

const DESCRIPTION_FIELDS = [
  'text',
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
const STORY_FIELDS = [
  'storyId',
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
    if (left[field] !== right[field]) return false;
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
    isSectionEqual(left.description, right.description, DESCRIPTION_FIELDS) &&
    isSectionEqual(left.image, right.image, IMAGE_FIELDS) &&
    isSectionEqual(left.entityStory, right.entityStory, STORY_FIELDS) &&
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
  promptTemplates: externalPromptTemplates,
  onPromptTemplatesChange,
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
      return { ...DEFAULT_CONFIG, ...externalEnrichmentConfig };
    }
    try {
      const saved = localStorage.getItem('illuminator:config');
      if (saved) {
        return { ...DEFAULT_CONFIG, ...JSON.parse(saved) };
      }
    } catch {}
    return DEFAULT_CONFIG;
  });

  // Sync from external config when it changes
  useEffect(() => {
    if (externalEnrichmentConfig) {
      setLocalConfig({ ...DEFAULT_CONFIG, ...externalEnrichmentConfig });
    }
  }, [externalEnrichmentConfig]);

  // Use the local config as the active config
  const config = localConfig;

  // Wrapper to update config and sync to parent
  const setConfig = useCallback((updater) => {
    setLocalConfig((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      // Sync to parent if callback provided
      if (onEnrichmentConfigChange) {
        onEnrichmentConfigChange(next);
      } else {
        // Fallback to localStorage if no parent callback
        try {
          localStorage.setItem('illuminator:config', JSON.stringify(next));
        } catch {}
      }
      return next;
    });
  }, [onEnrichmentConfigChange]);

  // Style selection - use external prop if provided, else localStorage fallback
  const DEFAULT_STYLE_SELECTION = { artisticStyleId: null, compositionStyleId: null };
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

  // Sync from external style selection when it changes
  useEffect(() => {
    if (externalStyleSelection) {
      setLocalStyleSelection(externalStyleSelection);
    }
  }, [externalStyleSelection]);

  // Use the local style selection as the active one
  const styleSelection = localStyleSelection;

  // Wrapper to update style selection and sync to parent
  const setStyleSelection = useCallback((updater) => {
    setLocalStyleSelection((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      // Sync to parent if callback provided
      if (onStyleSelectionChange) {
        onStyleSelectionChange(next);
      } else {
        // Fallback to localStorage if no parent callback
        try {
          localStorage.setItem('illuminator:styleSelection', JSON.stringify(next));
        } catch {}
      }
      return next;
    });
  }, [onStyleSelectionChange]);

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

  // Prompt templates - edit locally and debounce sync to shell
  const [localPromptTemplates, setLocalPromptTemplates] = useState(() => createDefaultPromptTemplates());
  const promptTemplates = localPromptTemplates;
  const promptTemplatesSyncTimeoutRef = useRef(null);
  const promptTemplatesDirtyRef = useRef(false);
  const pendingPromptTemplatesRef = useRef(localPromptTemplates);
  const lastWorldDataRef = useRef(null);

  useEffect(() => {
    if (externalPromptTemplates === undefined) return;
    if (promptTemplatesSyncTimeoutRef.current) {
      clearTimeout(promptTemplatesSyncTimeoutRef.current);
      promptTemplatesSyncTimeoutRef.current = null;
    }
    promptTemplatesDirtyRef.current = false;
    const nextTemplates = externalPromptTemplates || createDefaultPromptTemplates();
    pendingPromptTemplatesRef.current = nextTemplates;
    setLocalPromptTemplates(nextTemplates);
  }, [externalPromptTemplates]);

  // Entities with enrichment state
  const [entities, setEntities] = useState([]);

  // Initialize entities from worldData
  // NOTE: We do NOT carry over enrichment from previous state based on ID matching.
  // Enrichment is persisted in worldData itself (via onEnrichmentComplete callback).
  // If entities have same IDs but come from different simulation runs, they should
  // NOT share enrichment - the enrichment belongs to the specific simulation.
  useEffect(() => {
    if (!worldData?.hardState) {
      setEntities([]);
      return;
    }

    // Use entities directly from worldData - enrichment is persisted there
    setEntities(worldData.hardState);
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
  const mergedPromptTemplates = useMemo(
    () => mergeWithDefaults(promptTemplates),
    [promptTemplates]
  );

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
  const handleEntityUpdate = useCallback((entityId, enrichment) => {
    setEntities((prev) =>
      prev.map((entity) =>
        entity.id === entityId
          ? { ...entity, enrichment: { ...entity.enrichment, ...enrichment } }
          : entity
      )
    );
  }, []);

  const handleChronicleAccepted = useCallback((entityId, chronicle) => {
    setEntities((prev) =>
      prev.map((entity) => {
        if (entity.id !== entityId) return entity;
        const existing = Array.isArray(entity.enrichment?.chronicles)
          ? entity.enrichment.chronicles
          : [];
        const updated = [
          ...existing.filter((entry) => entry.chronicleId !== chronicle.chronicleId),
          chronicle,
        ].sort((a, b) => (b.acceptedAt || 0) - (a.acceptedAt || 0));
        return {
          ...entity,
          enrichment: {
            ...entity.enrichment,
            chronicles: updated,
          },
        };
      })
    );
  }, []);

  // Extract simulationRunId from worldData for content association
  const simulationRunId = worldData?.metadata?.simulationRunId;

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
        textModel: config.textModel,
        chronicleModel: config.chronicleModel,
        imageModel: config.imageModel,
        imageSize: config.imageSize,
        imageQuality: config.imageQuality,
        // Multishot prompting options
        useClaudeForImagePrompt: config.useClaudeForImagePrompt,
        claudeImagePromptTemplate: config.claudeImagePromptTemplate,
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
      if (!local?.enrichment) return entity;
      if (isEnrichmentEqual(local.enrichment, entity.enrichment)) return entity;
      didChange = true;
      return { ...entity, enrichment: local.enrichment };
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

  // Check if we have world data
  const hasWorldData = worldData?.hardState?.length > 0;

  // Check if API keys are set
  const hasAnthropicKey = anthropicApiKey.length > 0;
  const hasOpenaiKey = openaiApiKey.length > 0;
  const hasRequiredKeys = hasAnthropicKey;

  // Build prompt for entity
  const buildPrompt = useCallback(
    (entity, type) => {
      const templates = mergedPromptTemplates;
      const relationships = (relationshipsByEntity.get(entity.id) || []).slice(0, 5).map((rel) => {
        const targetId = rel.src === entity.id ? rel.dst : rel.src;
        const target = entityById.get(targetId);
        return {
          kind: rel.kind,
          targetName: target?.name || targetId,
          targetKind: target?.kind || 'unknown',
          strength: rel.strength,
        };
      });

      // Build minimal context for prompt
      const context = {
        world: {
          name: worldContext.name || '[World Name]',
          description: worldContext.description || '',
          canonFacts: worldContext.canonFacts || [],
          tone: worldContext.tone || '',
        },
        entity: {
          entity: {
            id: entity.id,
            name: entity.name,
            kind: entity.kind,
            subtype: entity.subtype,
            prominence: entity.prominence,
            culture: entity.culture || '',
            status: entity.status || 'active',
            description: entity.description || '',
            tags: entity.tags || {},
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
        },
      };

      if (type === 'description') {
        const template = getEffectiveTemplate(templates, entity.kind, 'description');

        // Get descriptive identity for this entity's culture, filtered by entity kind's keys
        const cultureDescriptiveIdentity = templates.cultureDescriptiveIdentities?.[entity.culture] || {};
        const allowedDescriptiveKeys = templates.descriptiveIdentityKeysByKind?.[entity.kind] || [];
        const filteredDescriptiveIdentity = {};
        for (const key of allowedDescriptiveKeys) {
          if (cultureDescriptiveIdentity[key]) {
            filteredDescriptiveIdentity[key] = cultureDescriptiveIdentity[key];
          }
        }

        const descriptiveInfo = {
          descriptiveIdentity: Object.keys(filteredDescriptiveIdentity).length > 0 ? filteredDescriptiveIdentity : undefined,
        };

        return buildDescriptionPrompt(template, context, descriptiveInfo);
      } else if (type === 'image') {
        const template = getEffectiveTemplate(templates, entity.kind, 'image');
        // Include enriched description if available (for multishot prompting)
        const enrichedDescription = entity.enrichment?.description?.text;
        if (enrichedDescription) {
          context.entity.enrichedDescription = enrichedDescription;
        }

        // Resolve style selection for this entity
        const resolvedStyle = resolveStyleSelection({
          selection: styleSelection,
          entityCultureId: entity.culture,
          entityKind: entity.kind,
          cultures: worldSchema?.cultures || [],
          styleLibrary,
        });

        // Get visual identity for this entity's culture, filtered by entity kind's keys
        const cultureVisualIdentity = templates.cultureVisualIdentities?.[entity.culture] || {};
        const allowedKeys = templates.visualIdentityKeysByKind?.[entity.kind] || [];
        const filteredVisualIdentity = {};
        for (const key of allowedKeys) {
          if (cultureVisualIdentity[key]) {
            filteredVisualIdentity[key] = cultureVisualIdentity[key];
          }
        }

        // Build style info for the prompt
        const styleInfo = {
          artisticPromptFragment: resolvedStyle.artisticStyle?.promptFragment,
          compositionPromptFragment: resolvedStyle.compositionStyle?.promptFragment,
          cultureKeywords: resolvedStyle.cultureKeywords,
          visualIdentity: Object.keys(filteredVisualIdentity).length > 0 ? filteredVisualIdentity : undefined,
        };

        return buildImagePrompt(template, context, styleInfo);
      }

      return `Describe ${entity.name}, a ${entity.subtype} ${entity.kind}.`;
    },
    [
      worldContext,
      mergedPromptTemplates,
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

  const updatePromptTemplates = useCallback(
    (nextTemplates) => {
      setLocalPromptTemplates(nextTemplates);
      pendingPromptTemplatesRef.current = nextTemplates;
      if (!onPromptTemplatesChange) return;
      promptTemplatesDirtyRef.current = true;
      if (promptTemplatesSyncTimeoutRef.current) {
        clearTimeout(promptTemplatesSyncTimeoutRef.current);
      }
      promptTemplatesSyncTimeoutRef.current = setTimeout(() => {
        if (!promptTemplatesDirtyRef.current) return;
        promptTemplatesDirtyRef.current = false;
        onPromptTemplatesChange(pendingPromptTemplatesRef.current);
        promptTemplatesSyncTimeoutRef.current = null;
      }, 300);
    },
    [onPromptTemplatesChange]
  );

  useEffect(() => {
    return () => {
      if (worldContextSyncTimeoutRef.current) {
        clearTimeout(worldContextSyncTimeoutRef.current);
        worldContextSyncTimeoutRef.current = null;
      }
      if (promptTemplatesSyncTimeoutRef.current) {
        clearTimeout(promptTemplatesSyncTimeoutRef.current);
        promptTemplatesSyncTimeoutRef.current = null;
      }
      if (worldContextDirtyRef.current && onWorldContextChange) {
        onWorldContextChange(pendingWorldContextRef.current);
      }
      if (promptTemplatesDirtyRef.current && onPromptTemplatesChange) {
        onPromptTemplatesChange(pendingPromptTemplatesRef.current);
      }
    };
  }, [onWorldContextChange, onPromptTemplatesChange]);

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
              onChronicleAccepted={handleChronicleAccepted}
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

        {activeTab === 'templates' && (
          <div className="illuminator-content">
            <PromptTemplateEditor
              templates={promptTemplates}
              onTemplatesChange={updatePromptTemplates}
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
              templates={promptTemplates}
              onTemplatesChange={updatePromptTemplates}
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
              entityKinds={(worldSchema?.entityKinds || []).map((k) => k.id)}
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

        {activeTab === 'configure' && (
          <div className="illuminator-content">
            <ConfigPanel config={config} onConfigChange={updateConfig} worldSchema={worldSchema} />
          </div>
        )}
      </div>
    </div>
  );
}
