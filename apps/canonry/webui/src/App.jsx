/**
 * The Canonry - Unified World-Building Suite
 *
 * Shell application that hosts name-forge, cosmographer, and lore-weave
 * as module federation remotes with a unified WorldSeedProject schema.
 */

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useProjectStorage } from './storage/useProjectStorage';
import { loadUiState, saveUiState } from './storage/uiState';
import {
  loadWorldStore,
  loadSimulationData,
  loadWorldData,
  saveWorldData,
  loadWorldContext,
  saveWorldContext,
  saveEntityGuidance,
  saveCultureIdentities,
  saveEnrichmentConfig,
  saveStyleSelection,
  getSlots,
  getSlot,
  getActiveSlotIndex,
  setActiveSlotIndex as persistActiveSlotIndex,
  saveSlot,
  saveToSlot,
  loadSlot,
  clearSlot,
  updateSlotTitle,
  generateSlotTitle,
} from './storage/worldStore';
import ProjectManager from './components/ProjectManager';
import Navigation from './components/Navigation';
import SchemaEditor from './components/SchemaEditor';
import LandingPage from './components/LandingPage';
import HelpModal from './components/HelpModal';
import { computeTagUsage, computeSchemaUsage } from '@penguin-tales/shared-components';
import { validateAllConfigs } from '../../../lore-weave/lib/engine/configSchemaValidator';
import {
  mergeFrameworkSchemaSlice,
  FRAMEWORK_ENTITY_KIND_VALUES,
  FRAMEWORK_RELATIONSHIP_KIND_VALUES,
  FRAMEWORK_CULTURES,
  FRAMEWORK_CULTURE_DEFINITIONS,
  FRAMEWORK_TAG_VALUES,
} from '@canonry/world-schema';
import NameForgeHost from './remotes/NameForgeHost';
import CosmographerHost from './remotes/CosmographerHost';
import CoherenceEngineHost from './remotes/CoherenceEngineHost';
import LoreWeaveHost from './remotes/LoreWeaveHost';
import IlluminatorHost from './remotes/IlluminatorHost';
import ArchivistHost from './remotes/ArchivistHost';
import ChroniclerHost from './remotes/ChroniclerHost';
import { getImagesByProject, loadImage } from './storage/imageStore';
import { colors, typography, spacing } from './theme';

/**
 * Extract loreData from enriched entities
 * Converts entity.enrichment into LoreRecord format for Chronicler
 *
 * Note: Summary and description are now stored directly on entity (entity.summary, entity.description).
 * The enrichment.text object contains metadata (aliases, visual traits, etc.).
 * Description lore records are no longer created - Chronicler reads entity.summary/description directly.
 */
function extractLoreDataFromEntities(worldData) {
  if (!worldData?.hardState) return null;

  const records = [];
  for (const entity of worldData.hardState) {
    const enrichment = entity.enrichment;
    if (!enrichment) continue;

    // Extract era narrative as LoreRecord (still uses lore record format)
    if (enrichment.eraNarrative?.text) {
      records.push({
        id: `era_${entity.id}`,
        type: entity.kind === 'era' ? 'era_chapter' : 'entity_chronicle',
        targetId: entity.id,
        text: enrichment.eraNarrative.text,
        metadata: {
          generatedAt: enrichment.eraNarrative.generatedAt,
          model: enrichment.eraNarrative.model,
        },
      });
    }

    // Chronicles are now loaded directly from IndexedDB by Chronicler
    // No longer stored in entity.enrichment.chronicles
  }

  if (records.length === 0) return null;

  return {
    llmEnabled: true,
    model: 'mixed',
    records,
  };
}

/**
 * Extract loreData from enriched entities
 * Note: Chronicles are now loaded directly from IndexedDB by Chronicler,
 * so this no longer needs to augment chronicle imageRefs.
 */
async function extractLoreDataWithCurrentImageRefs(worldData) {
  // Just delegate to the synchronous function
  // The async wrapper is kept for backwards compatibility with existing callers
  return extractLoreDataFromEntities(worldData);
}

/**
 * Load images from IndexedDB and format for Chronicler
 * Returns ImageMetadata with object URLs for display
 */
async function loadImageDataForProject(projectId, worldData) {
  if (!projectId || !worldData?.hardState) return null;

  try {
    const images = await getImagesByProject(projectId);
    if (!images || images.length === 0) return null;

    const imageById = new Map(images.map((img) => [img.imageId, img]));
    const imageCache = new Map();
    const results = [];

    // Load images referenced by the current simulation entities
    for (const entity of worldData.hardState) {
      const imageId = entity?.enrichment?.image?.imageId;
      if (!imageId) continue;

      const imageRecord = imageById.get(imageId);
      if (!imageRecord) continue;

      let cached = imageCache.get(imageId);
      if (!cached) {
        const imageData = await loadImage(imageId);
        if (!imageData?.url) continue;
        cached = {
          url: imageData.url,
          prompt: imageData.originalPrompt || imageData.finalPrompt || imageData.revisedPrompt || '',
        };
        imageCache.set(imageId, cached);
      }

      results.push({
        entityId: entity.id,
        entityName: entity?.name || imageRecord.entityName || 'Unknown',
        entityKind: entity?.kind || imageRecord.entityKind || 'unknown',
        prompt: cached.prompt || imageRecord.originalPrompt || imageRecord.finalPrompt || '',
        localPath: cached.url, // Object URL for display
        imageId,
      });
    }

    // Also load chronicle images (imageType === 'chronicle')
    for (const imageRecord of images) {
      if (imageRecord.imageType !== 'chronicle') continue;
      if (imageCache.has(imageRecord.imageId)) continue; // Already loaded

      const imageData = await loadImage(imageRecord.imageId);
      if (!imageData?.url) continue;

      imageCache.set(imageRecord.imageId, {
        url: imageData.url,
        prompt: imageData.originalPrompt || imageData.finalPrompt || imageData.revisedPrompt || '',
      });

      results.push({
        entityId: imageRecord.entityId || 'chronicle',
        entityName: imageRecord.entityName || 'Chronicle Image',
        entityKind: imageRecord.entityKind || 'chronicle',
        prompt: imageData.originalPrompt || imageData.finalPrompt || imageRecord.originalPrompt || '',
        localPath: imageData.url,
        imageId: imageRecord.imageId,
        // Chronicle-specific metadata
        imageType: 'chronicle',
        chronicleId: imageRecord.chronicleId,
        imageRefId: imageRecord.imageRefId,
      });
    }

    if (results.length === 0) return null;

    return {
      generatedAt: new Date().toISOString(),
      totalImages: results.length,
      results,
    };
  } catch (err) {
    console.error('Failed to load images for project:', err);
    return null;
  }
}

const styles = {
  app: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    backgroundColor: colors.bgPrimary,
    color: colors.textPrimary,
    fontFamily: typography.fontFamily,
  },
  content: {
    flex: 1,
    overflow: 'hidden',
  },
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: colors.textMuted,
  },
  footer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
    padding: `${spacing.sm} ${spacing.lg}`,
    backgroundColor: colors.bgPrimary,
    borderTop: `1px solid ${colors.border}`,
    fontSize: typography.sizeSm,
    color: colors.textMuted,
    flexShrink: 0,
  },
};

const VALID_TABS = [
  'enumerist',
  'names',
  'cosmography',
  'coherence',
  'simulation',
  'illuminator',
  'archivist',
  'chronicler',
];

const SLOT_EXPORT_FORMAT = 'canonry-slot-export';
const SLOT_EXPORT_VERSION = 1;

function isWorldOutput(candidate) {
  if (!candidate || typeof candidate !== 'object') return false;
  return Boolean(
    candidate.schema &&
    candidate.metadata &&
    Array.isArray(candidate.hardState) &&
    Array.isArray(candidate.relationships) &&
    candidate.pressures &&
    typeof candidate.pressures === 'object'
  );
}

function normalizeUiState(raw) {
  const activeTab = VALID_TABS.includes(raw?.activeTab) ? raw.activeTab : null;
  const activeSectionByTab = raw?.activeSectionByTab && typeof raw.activeSectionByTab === 'object'
    ? { ...raw.activeSectionByTab }
    : {};
  if (activeTab && typeof raw?.activeSection === 'string') {
    activeSectionByTab[activeTab] = raw.activeSection;
  }
  const activeSection = activeTab ? (activeSectionByTab[activeTab] ?? null) : null;
  const showHome = typeof raw?.showHome === 'boolean' ? raw.showHome : !activeTab;
  return {
    activeTab,
    activeSectionByTab,
    activeSection,
    showHome: activeTab ? showHome : true,
    helpModalOpen: !!raw?.helpModalOpen,
  };
}

export default function App() {
  const initialUiState = normalizeUiState(loadUiState());
  const [activeTab, setActiveTab] = useState(initialUiState.activeTab);
  const [activeSectionByTab, setActiveSectionByTab] = useState(initialUiState.activeSectionByTab);
  const [showHome, setShowHome] = useState(initialUiState.showHome);
  const [helpModalOpen, setHelpModalOpen] = useState(initialUiState.helpModalOpen);
  const [archivistData, setArchivistData] = useState(null);
  const [worldContext, setWorldContext] = useState(null);
  const [entityGuidance, setEntityGuidance] = useState(null);
  const [cultureIdentities, setCultureIdentities] = useState(null);
  const [enrichmentConfig, setEnrichmentConfig] = useState(null);
  const [styleSelection, setStyleSelection] = useState(null);
  const [simulationResults, setSimulationResults] = useState(null);
  const [simulationState, setSimulationState] = useState(null);
  const [slots, setSlots] = useState({});
  const [activeSlotIndex, setActiveSlotIndex] = useState(0);
  const simulationOwnerRef = useRef(null);
  // Track whether we're loading from a saved slot (to skip auto-save to scratch)
  const isLoadingSlotRef = useRef(false);
  // Track the last saved simulation results object to detect new simulations
  const lastSavedResultsRef = useRef(null);
  const activeSection = activeTab ? (activeSectionByTab?.[activeTab] ?? null) : null;

  const setActiveSection = useCallback((section) => {
    if (!activeTab) return;
    setActiveSectionByTab((prev) => ({ ...prev, [activeTab]: section }));
  }, [activeTab]);

  const setActiveSectionForTab = useCallback((tabId, section) => {
    setActiveSectionByTab((prev) => ({ ...prev, [tabId]: section }));
  }, []);

  // Handle tab change
  const handleTabChange = useCallback((newTab) => {
    setActiveTab(newTab);
    setShowHome(false);
  }, []);

  // Handle going home (clicking logo)
  const handleGoHome = useCallback(() => {
    setShowHome(true);
  }, []);

  // Handle navigation from landing page cards
  const handleLandingNavigate = useCallback((tabId) => {
    setActiveTab(tabId);
    setShowHome(false);
  }, []);

  useEffect(() => {
    saveUiState({
      activeTab,
      activeSection,
      activeSectionByTab,
      showHome,
      helpModalOpen,
    });
  }, [activeTab, activeSection, activeSectionByTab, showHome, helpModalOpen]);

  const {
    projects,
    currentProject,
    loading,
    error,
    createProject,
    openProject,
    save,
    removeProject,
    duplicateProject,
    exportProject,
    importProject,
    reloadProjectFromDefaults,
    DEFAULT_PROJECT_ID,
  } = useProjectStorage();

  // Wrap reloadProjectFromDefaults to also update React state
  const handleReloadFromDefaults = useCallback(async () => {
    await reloadProjectFromDefaults();
    // Re-read worldStore since the useEffect won't re-run (same project ID)
    if (currentProject?.id) {
      const store = await loadWorldStore(currentProject.id);
      if (store?.worldContext) {
        setWorldContext(store.worldContext);
      }
      if (store?.entityGuidance) {
        setEntityGuidance(store.entityGuidance);
      }
      if (store?.cultureIdentities) {
        setCultureIdentities(store.cultureIdentities);
      }
      if (store?.enrichmentConfig) {
        setEnrichmentConfig(store.enrichmentConfig);
      }
      if (store?.styleSelection) {
        setStyleSelection(store.styleSelection);
      }
    }
  }, [reloadProjectFromDefaults, currentProject?.id]);

  const handleIlluminatorWorldDataChange = useCallback(async (enrichedWorld) => {
    // Extract loreData from enriched entities (with current imageRefs from ChronicleRecords)
    const loreData = await extractLoreDataWithCurrentImageRefs(enrichedWorld);

    // Load imageData from IndexedDB
    const imageData = await loadImageDataForProject(currentProject?.id, enrichedWorld);

    setArchivistData((prev) => {
      if (prev?.worldData === enrichedWorld && prev?.loreData === loreData) return prev;
      return {
        worldData: enrichedWorld,
        loreData,
        imageData,
      };
    });
  }, [currentProject?.id]);

  /**
   * Lazy image loader for Chronicler - loads images on-demand from IndexedDB
   * Uses an internal cache to avoid reloading the same image multiple times
   */
  const imageLoaderCacheRef = useRef(new Map());
  const imageLoader = useCallback(async (imageId) => {
    if (!imageId) return null;

    // Check cache first
    const cache = imageLoaderCacheRef.current;
    if (cache.has(imageId)) {
      return cache.get(imageId);
    }

    try {
      const imageData = await loadImage(imageId);
      const url = imageData?.url || null;
      cache.set(imageId, url);
      return url;
    } catch (err) {
      console.error('Failed to load image:', imageId, err);
      cache.set(imageId, null);
      return null;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    // Clear image loader cache on project change
    imageLoaderCacheRef.current.clear();

    if (!currentProject?.id) {
      simulationOwnerRef.current = null;
      setSimulationResults(null);
      setSimulationState(null);
      setArchivistData(null);
      setSlots({});
      setActiveSlotIndex(0);
      return undefined;
    }

    simulationOwnerRef.current = null;
    isLoadingSlotRef.current = false;
    lastSavedResultsRef.current = null;
    setSimulationResults(null);
    setSimulationState(null);
    setArchivistData(null);
    setWorldContext(null);
    setEntityGuidance(null);
    setCultureIdentities(null);
    setEnrichmentConfig(null);
    setStyleSelection(null);
    setSlots({});
    setActiveSlotIndex(0);

    // Load world store and run slots
    Promise.all([
      loadWorldStore(currentProject.id),
      getSlots(currentProject.id),
    ]).then(([store, loadedSlots]) => {
      if (cancelled) return;
      simulationOwnerRef.current = currentProject.id;

      // Set slots and active index
      const loadedActiveIndex = store?.activeSlotIndex ?? 0;
      setSlots(loadedSlots);
      setActiveSlotIndex(loadedActiveIndex);

      // Load data from active slot
      const activeSlot = loadedSlots[loadedActiveIndex];
      // Only skip auto-save if we actually loaded prior simulation/world data
      isLoadingSlotRef.current = Boolean(
        activeSlot?.simulationResults ||
        activeSlot?.simulationState ||
        activeSlot?.worldData
      );
      if (activeSlot) {
        // Track the loaded simulation results to prevent re-saving as "new"
        lastSavedResultsRef.current = activeSlot.simulationResults || null;
        setSimulationResults(activeSlot.simulationResults || null);
        setSimulationState(activeSlot.simulationState || null);
        if (activeSlot.worldData) {
          // Extract loreData from enriched entities (with current imageRefs) and load images
          Promise.all([
            extractLoreDataWithCurrentImageRefs(activeSlot.worldData),
            loadImageDataForProject(currentProject.id, activeSlot.worldData),
          ]).then(([loreData, imageData]) => {
            if (cancelled) return;
            setArchivistData({ worldData: activeSlot.worldData, loreData, imageData });
          });
        }
      }

      // Load shared data (world context, entity guidance, culture identities, and Illuminator config)
      if (store?.worldContext) {
        setWorldContext(store.worldContext);
      }
      if (store?.entityGuidance) {
        setEntityGuidance(store.entityGuidance);
      }
      if (store?.cultureIdentities) {
        setCultureIdentities(store.cultureIdentities);
      }
      if (store?.enrichmentConfig) {
        setEnrichmentConfig(store.enrichmentConfig);
      }
      if (store?.styleSelection) {
        setStyleSelection(store.styleSelection);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [currentProject?.id]);

  useEffect(() => {
    if (!currentProject?.id) return;
    if (simulationOwnerRef.current !== currentProject.id) return;
    if (!simulationResults && !simulationState) return;
    const status = simulationState?.status;
    if (status && status !== 'complete' && status !== 'error') return;

    // Skip auto-save to scratch if we're loading from a saved slot
    if (isLoadingSlotRef.current) {
      isLoadingSlotRef.current = false;
      return;
    }

    // Check if this is a genuinely new simulation (different results object)
    const isNewSimulation = Boolean(simulationResults && simulationResults !== lastSavedResultsRef.current);

    const worldData = simulationResults ?? null;
    const now = Date.now();
    let cancelled = false;

    const persist = async () => {
      const existingSlot = await getSlot(currentProject.id, 0) || {};
      let title = existingSlot.title || 'Scratch';
      let createdAt = existingSlot.createdAt || now;

      // Only generate new title for genuinely new simulations
      if (isNewSimulation && simulationResults?.hardState) {
        const entityCount = simulationResults.hardState.length;
        const date = new Date(now);
        const timeStr = date.toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        });
        title = `Run - ${timeStr} (${entityCount} entities)`;
        createdAt = now;
      }

      const slotData = {
        ...existingSlot,
        simulationResults,
        simulationState,
        worldData,
        title,
        createdAt,
      };

      await saveSlot(currentProject.id, 0, slotData);
      await persistActiveSlotIndex(currentProject.id, 0);
      if (cancelled) return;

      setSlots((prev) => ({ ...prev, 0: slotData }));

      // Track this simulation as saved
      lastSavedResultsRef.current = simulationResults || null;

      // Update archivistData for immediate use
      if (worldData) {
        Promise.all([
          extractLoreDataWithCurrentImageRefs(worldData),
          loadImageDataForProject(currentProject.id, worldData),
        ]).then(([loreData, imageData]) => {
          if (cancelled) return;
          setArchivistData({ worldData, loreData, imageData });
        });
      }

      // Ensure we're viewing scratch after new simulation
      setActiveSlotIndex(0);
    };

    persist().catch((err) => {
      console.error('Failed to save simulation results:', err);
    });

    return () => {
      cancelled = true;
    };
  }, [currentProject?.id, simulationResults, simulationState]);

  // Persist world data when it changes (for Archivist/Illuminator)
  useEffect(() => {
    if (!currentProject?.id) return;
    if (!archivistData?.worldData) return;
    saveWorldData(currentProject.id, archivistData.worldData);
  }, [currentProject?.id, archivistData]);

  // Persist world context when it changes (for Illuminator)
  useEffect(() => {
    if (!currentProject?.id) return;
    if (!worldContext) return;
    const timeoutId = setTimeout(() => {
      saveWorldContext(currentProject.id, worldContext);
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [currentProject?.id, worldContext]);

  // Persist entity guidance when it changes (for Illuminator)
  useEffect(() => {
    if (!currentProject?.id) return;
    if (!entityGuidance) return;
    const timeoutId = setTimeout(() => {
      saveEntityGuidance(currentProject.id, entityGuidance);
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [currentProject?.id, entityGuidance]);

  // Persist culture identities when they change (for Illuminator)
  useEffect(() => {
    if (!currentProject?.id) return;
    if (!cultureIdentities) return;
    const timeoutId = setTimeout(() => {
      saveCultureIdentities(currentProject.id, cultureIdentities);
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [currentProject?.id, cultureIdentities]);

  // Persist enrichment config when it changes (for Illuminator)
  useEffect(() => {
    if (!currentProject?.id) return;
    if (!enrichmentConfig) return;
    const timeoutId = setTimeout(() => {
      saveEnrichmentConfig(currentProject.id, enrichmentConfig);
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [currentProject?.id, enrichmentConfig]);

  // Persist style selection when it changes (for Illuminator)
  useEffect(() => {
    if (!currentProject?.id) return;
    if (!styleSelection) return;
    const timeoutId = setTimeout(() => {
      saveStyleSelection(currentProject.id, styleSelection);
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [currentProject?.id, styleSelection]);

  const mergeFrameworkOverrides = (items, existingItems, frameworkKeys, keyField) => {
    const filtered = (items || []).filter((item) => !item?.isFramework);
    const existingOverrides = (existingItems || []).filter((item) => frameworkKeys.has(item?.[keyField]));
    const existingKeys = new Set(filtered.map((item) => item?.[keyField]));
    const merged = [
      ...filtered,
      ...existingOverrides.filter((item) => !existingKeys.has(item?.[keyField])),
    ];
    return merged;
  };

  // Update functions that auto-save
  const updateEntityKinds = useCallback(
    (entityKinds) => {
      if (!currentProject) return;
      const frameworkKeys = new Set(FRAMEWORK_ENTITY_KIND_VALUES);
      const merged = mergeFrameworkOverrides(entityKinds, currentProject.entityKinds, frameworkKeys, 'kind');
      save({ entityKinds: merged });
    },
    [currentProject, save]
  );

  const updateRelationshipKinds = useCallback(
    (relationshipKinds) => {
      if (!currentProject) return;
      const frameworkKeys = new Set(FRAMEWORK_RELATIONSHIP_KIND_VALUES);
      const merged = mergeFrameworkOverrides(relationshipKinds, currentProject.relationshipKinds, frameworkKeys, 'kind');
      save({ relationshipKinds: merged });
    },
    [currentProject, save]
  );

  const updateCultures = useCallback(
    (cultures) => {
      if (!currentProject) return;
      const frameworkKeys = new Set(Object.values(FRAMEWORK_CULTURES));
      const merged = mergeFrameworkOverrides(cultures, currentProject.cultures, frameworkKeys, 'id');
      save({ cultures: merged });
    },
    [currentProject, save]
  );

  const updateSeedEntities = useCallback(
    (seedEntities) => save({ seedEntities }),
    [save]
  );

  const updateSeedRelationships = useCallback(
    (seedRelationships) => save({ seedRelationships }),
    [save]
  );

  const updateEras = useCallback(
    (eras) => save({ eras }),
    [save]
  );

  const updatePressures = useCallback(
    (pressures) => save({ pressures }),
    [save]
  );

  const updateGenerators = useCallback(
    (generators) => save({ generators }),
    [save]
  );

  const updateSystems = useCallback(
    (systems) => save({ systems }),
    [save]
  );

  const updateActions = useCallback(
    (actions) => save({ actions }),
    [save]
  );

  const updateTagRegistry = useCallback(
    (tagRegistry) => {
      if (!currentProject) return;
      const frameworkKeys = new Set(FRAMEWORK_TAG_VALUES);
      const merged = mergeFrameworkOverrides(tagRegistry, currentProject.tagRegistry, frameworkKeys, 'tag');
      save({ tagRegistry: merged });
    },
    [currentProject, save]
  );

  const updateAxisDefinitions = useCallback(
    (axisDefinitions) => save({ axisDefinitions }),
    [save]
  );

  const updateDistributionTargets = useCallback(
    (distributionTargets) => save({ distributionTargets }),
    [save]
  );

  // Add a single tag to the registry (for remotes)
  const addTag = useCallback(
    (newTag) => {
      if (!currentProject) return;
      const existingRegistry = currentProject.tagRegistry || [];
      // Don't add if already exists
      if (existingRegistry.some(t => t.tag === newTag.tag)) return;
      save({ tagRegistry: [...existingRegistry, newTag] });
    },
    [currentProject, save]
  );

  // Update a single culture's naming data (for Name Forge)
  const updateCultureNaming = useCallback(
    (cultureId, namingData) => {
      if (!currentProject) return;
      const existing = currentProject.cultures.find((c) => c.id === cultureId);
      if (existing) {
        const cultures = currentProject.cultures.map((c) =>
          c.id === cultureId ? { ...c, naming: namingData } : c
        );
        save({ cultures });
        return;
      }

      const baseCulture = FRAMEWORK_CULTURE_DEFINITIONS.find((c) => c.id === cultureId);
      if (!baseCulture) return;

      const cultures = [
        ...currentProject.cultures,
        { id: baseCulture.id, name: baseCulture.name, naming: namingData },
      ];
      save({ cultures });
    },
    [currentProject, save]
  );

  // ==========================================================================
  // Slot operations
  // ==========================================================================

  // Load a slot (switch active slot)
  const handleLoadSlot = useCallback(async (slotIndex) => {
    if (!currentProject?.id) return;

    try {
      await loadSlot(currentProject.id, slotIndex);
      setActiveSlotIndex(slotIndex);

      // Load data from storage to ensure we have the latest
      const [storedSlot, loadedSlots] = await Promise.all([
        getSlot(currentProject.id, slotIndex),
        getSlots(currentProject.id),
      ]);

      // Update local slots state with data from storage
      setSlots(loadedSlots);

      // Mark that we're loading from a saved slot (skip auto-save effect)
      isLoadingSlotRef.current = true;

      // Set simulation state from stored slot
      if (storedSlot) {
        // Track the loaded simulation results to prevent re-saving as "new"
        lastSavedResultsRef.current = storedSlot.simulationResults || null;
        setSimulationResults(storedSlot.simulationResults || null);
        setSimulationState(storedSlot.simulationState || null);
        if (storedSlot.worldData) {
          // Extract loreData (with current imageRefs) and load images
          const [loreData, imageData] = await Promise.all([
            extractLoreDataWithCurrentImageRefs(storedSlot.worldData),
            loadImageDataForProject(currentProject.id, storedSlot.worldData),
          ]);
          setArchivistData({ worldData: storedSlot.worldData, loreData, imageData });
        } else {
          setArchivistData(null);
        }
      } else {
        lastSavedResultsRef.current = null;
        setSimulationResults(null);
        setSimulationState(null);
        setArchivistData(null);
      }
    } catch (err) {
      console.error('Failed to load slot:', err);
    }
  }, [currentProject?.id]);

  // Save scratch to a slot (move data)
  const handleSaveToSlot = useCallback(async (targetSlotIndex) => {
    if (!currentProject?.id) return;

    try {
      await saveToSlot(currentProject.id, targetSlotIndex);

      // Reload slots from storage to ensure consistency
      const loadedSlots = await getSlots(currentProject.id);
      setSlots(loadedSlots);
      setActiveSlotIndex(targetSlotIndex);

      // Update the ref to match the saved slot's data (now in targetSlotIndex)
      const savedSlot = loadedSlots?.[targetSlotIndex];
      lastSavedResultsRef.current = savedSlot?.simulationResults || null;
    } catch (err) {
      console.error('Failed to save to slot:', err);
      alert(err.message || 'Failed to save to slot');
    }
  }, [currentProject?.id]);

  // Update slot title
  const handleUpdateSlotTitle = useCallback(async (slotIndex, title) => {
    if (!currentProject?.id) return;

    try {
      await updateSlotTitle(currentProject.id, slotIndex, title);
      setSlots((prev) => ({
        ...prev,
        [slotIndex]: { ...prev[slotIndex], title },
      }));
    } catch (err) {
      console.error('Failed to update slot title:', err);
    }
  }, [currentProject?.id]);

  // Clear a slot
  const handleClearSlot = useCallback(async (slotIndex) => {
    if (!currentProject?.id) return;

    try {
      await clearSlot(currentProject.id, slotIndex);

      // Reload slots from storage
      const loadedSlots = await getSlots(currentProject.id);
      setSlots(loadedSlots);

      // If we cleared the active slot, reset state
      if (slotIndex === activeSlotIndex) {
        // Mark as loading to prevent auto-save effect from triggering
        isLoadingSlotRef.current = true;
        lastSavedResultsRef.current = null;
        setSimulationResults(null);
        setSimulationState(null);
        setArchivistData(null);

        // If we cleared slot 0 (scratch), stay on it but with empty state
        // If we cleared a saved slot, switch to scratch (or first available)
        if (slotIndex !== 0) {
          // Find first slot with data, or default to scratch
          const availableSlot = loadedSlots[0] ? 0 : Object.keys(loadedSlots).map(Number).sort()[0];
          setActiveSlotIndex(availableSlot ?? 0);
        }
        // For slot 0, activeSlotIndex stays at 0 (scratch is always slot 0 even if empty)
      }
    } catch (err) {
      console.error('Failed to clear slot:', err);
    }
  }, [currentProject?.id, activeSlotIndex]);

  const parseSlotImportPayload = useCallback((payload) => {
    if (payload?.format === SLOT_EXPORT_FORMAT && payload?.version === SLOT_EXPORT_VERSION) {
      const worldData = payload.worldData || payload.simulationResults;
      if (!isWorldOutput(worldData)) {
        throw new Error('Slot export is missing a valid world output.');
      }
      return {
        worldData,
        simulationResults: payload.simulationResults ?? worldData,
        simulationState: payload.simulationState ?? null,
        worldContext: payload.worldContext,
        entityGuidance: payload.entityGuidance,
        cultureIdentities: payload.cultureIdentities,
        slotTitle: payload.slot?.title,
        slotCreatedAt: payload.slot?.createdAt,
      };
    }

    if (isWorldOutput(payload)) {
      return {
        worldData: payload,
        simulationResults: payload,
        simulationState: null,
      };
    }

    throw new Error('Unsupported import format. Expected a Canonry slot export or world output JSON.');
  }, []);

  const importSlotPayload = useCallback(async (slotIndex, payload, options = {}) => {
    if (!currentProject?.id) return;
    const parsed = parseSlotImportPayload(payload);
    const now = Date.now();
    const title = parsed.slotTitle
      || options.defaultTitle
      || (slotIndex === 0 ? 'Scratch' : generateSlotTitle(slotIndex, now));

    const slotData = {
      title,
      createdAt: parsed.slotCreatedAt ?? now,
      savedAt: now,
      simulationResults: parsed.simulationResults ?? parsed.worldData,
      simulationState: parsed.simulationState ?? null,
      worldData: parsed.worldData,
    };

    await saveSlot(currentProject.id, slotIndex, slotData);

    if (parsed.worldContext !== undefined) {
      setWorldContext(parsed.worldContext);
      await saveWorldContext(currentProject.id, parsed.worldContext);
    }
    if (parsed.entityGuidance !== undefined) {
      setEntityGuidance(parsed.entityGuidance);
      await saveEntityGuidance(currentProject.id, parsed.entityGuidance);
    }
    if (parsed.cultureIdentities !== undefined) {
      setCultureIdentities(parsed.cultureIdentities);
      await saveCultureIdentities(currentProject.id, parsed.cultureIdentities);
    }

    await handleLoadSlot(slotIndex);
  }, [
    currentProject?.id,
    parseSlotImportPayload,
    handleLoadSlot,
  ]);

  const handleExportSlot = useCallback((slotIndex) => {
    const slot = slots[slotIndex];
    if (!slot) {
      alert('Slot is empty.');
      return;
    }
    const worldData = slot.worldData || slot.simulationResults;
    if (!isWorldOutput(worldData)) {
      alert('Slot does not contain a valid world output.');
      return;
    }

    const exportPayload = {
      format: SLOT_EXPORT_FORMAT,
      version: SLOT_EXPORT_VERSION,
      exportedAt: new Date().toISOString(),
      slot: {
        index: slotIndex,
        title: slot.title || (slotIndex === 0 ? 'Scratch' : `Slot ${slotIndex}`),
        createdAt: slot.createdAt || null,
        savedAt: slot.savedAt || null,
      },
      worldData,
      simulationResults: slot.simulationResults || null,
      simulationState: slot.simulationState || null,
      worldContext: worldContext ?? null,
      entityGuidance: entityGuidance ?? null,
      cultureIdentities: cultureIdentities ?? null,
    };

    const safeBase = (exportPayload.slot.title || `slot-${slotIndex}`)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    const filename = `${safeBase || `slot-${slotIndex}`}.canonry-slot.json`;

    const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }, [slots, worldContext, entityGuidance, cultureIdentities]);

  const handleImportSlot = useCallback(async (slotIndex, file) => {
    if (!currentProject?.id || !file) return;
    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      await importSlotPayload(slotIndex, payload, { defaultTitle: 'Imported Output' });
    } catch (err) {
      console.error('Failed to import slot:', err);
      alert(err.message || 'Failed to import slot data');
    }
  }, [currentProject?.id, importSlotPayload]);

  const handleLoadExampleOutput = useCallback(async () => {
    if (!currentProject?.id) return;
    try {
      const baseUrl = import.meta.env.BASE_URL || '/';
      const response = await fetch(`${baseUrl}default-project/worldOutput.json`);
      if (!response.ok) {
        throw new Error('Example output not found.');
      }
      const payload = await response.json();
      await importSlotPayload(0, payload, { defaultTitle: 'Example Output' });
    } catch (err) {
      console.error('Failed to load example output:', err);
      alert(err.message || 'Failed to load example output');
    }
  }, [currentProject?.id, importSlotPayload]);

  // Check if scratch has data
  const hasDataInScratch = Boolean(slots[0]?.simulationResults);

  // Extract naming data for Name Forge (keyed by culture ID)
  const namingData = useMemo(() => {
    if (!currentProject) return {};
    const data = {};
    currentProject.cultures.forEach((culture) => {
      if (culture.naming) {
        data[culture.id] = culture.naming;
      }
    });
    return data;
  }, [currentProject?.cultures]);

  // Derived data for remotes (read-only schema)
  const schema = useMemo(() => {
    const baseSchema = currentProject
      ? {
          id: currentProject.id,
          name: currentProject.name,
          version: currentProject.version,
          entityKinds: currentProject.entityKinds || [],
          relationshipKinds: currentProject.relationshipKinds || [],
          cultures: currentProject.cultures || [],
          tagRegistry: currentProject.tagRegistry || [],
          axisDefinitions: currentProject.axisDefinitions || [],
          uiConfig: currentProject.uiConfig,
        }
      : {
          id: '',
          name: '',
          version: '',
          entityKinds: [],
          relationshipKinds: [],
          cultures: [],
          tagRegistry: [],
          axisDefinitions: [],
          uiConfig: undefined,
        };
    return mergeFrameworkSchemaSlice(baseSchema);
  }, [
    currentProject?.id,
    currentProject?.name,
    currentProject?.version,
    currentProject?.entityKinds,
    currentProject?.relationshipKinds,
    currentProject?.cultures,
    currentProject?.tagRegistry,
    currentProject?.axisDefinitions,
    currentProject?.uiConfig,
  ]);

  // Compute tag usage across all tools
  const tagUsage = useMemo(() => {
    if (!currentProject) return {};
    return computeTagUsage({
      cultures: currentProject.cultures,
      seedEntities: currentProject.seedEntities,
      generators: currentProject.generators,
      systems: currentProject.systems,
      pressures: currentProject.pressures,
      entityKinds: currentProject.entityKinds,
      axisDefinitions: currentProject.axisDefinitions,
    });
  }, [
    currentProject?.cultures,
    currentProject?.seedEntities,
    currentProject?.generators,
    currentProject?.systems,
    currentProject?.pressures,
    currentProject?.entityKinds,
    currentProject?.axisDefinitions,
  ]);

  // Compute schema element usage across Coherence Engine
  const schemaUsage = useMemo(() => {
    if (!currentProject) return {};
    return computeSchemaUsage({
      generators: currentProject.generators || [],
      systems: currentProject.systems || [],
      actions: currentProject.actions || [],
      pressures: currentProject.pressures || [],
      seedEntities: currentProject.seedEntities || [],
    });
  }, [
    currentProject?.generators,
    currentProject?.systems,
    currentProject?.actions,
    currentProject?.pressures,
    currentProject?.seedEntities,
  ]);

  // Compute structure validation for ValidationPopover
  const validationResult = useMemo(() => {
    if (!currentProject) return { valid: true, errors: [], warnings: [] };

    const cultures = schema.cultures?.map(c => c.id) || [];
    const entityKinds = schema.entityKinds?.map(k => k.kind) || [];
    const relationshipKinds = schema.relationshipKinds?.map(k => k.kind) || [];

    return validateAllConfigs({
      templates: currentProject.generators || [],
      pressures: currentProject.pressures || [],
      systems: currentProject.systems || [],
      eras: currentProject.eras || [],
      actions: currentProject.actions || [],
      seedEntities: currentProject.seedEntities || [],
      schema: {
        cultures,
        entityKinds,
        relationshipKinds,
      },
    });
  }, [
    currentProject?.generators,
    currentProject?.pressures,
    currentProject?.systems,
    currentProject?.eras,
    currentProject?.actions,
    currentProject?.seedEntities,
    schema,
  ]);

  // Navigate to validation tab
  const handleNavigateToValidation = useCallback(() => {
    setActiveTab('simulation');
    setActiveSectionForTab('simulation', 'validate');
    setShowHome(false);
  }, [setActiveSectionForTab]);

  // Remove property from config at given path (for validation error quick-fix)
  const handleRemoveProperty = useCallback((path, propName) => {
    if (!currentProject || !path || !propName) return;

    // Parse path - formats:
    // 1. Top-level property: "item_id" or "item_id/" (trailing slash from validator)
    // 2. Nested property: "item_id"/nested/path
    const topLevelMatch = path.match(/^"([^"]+)"(?:\/)?$/);
    const nestedMatch = path.match(/^"([^"]+)"\/(.+)$/);

    let itemId;
    let pathSegments = [];

    if (nestedMatch) {
      // Nested property (check first since it's more specific)
      itemId = nestedMatch[1];
      pathSegments = nestedMatch[2].split('/');
    } else if (topLevelMatch) {
      // Top-level property like "metadata" on the item itself
      itemId = topLevelMatch[1];
    } else {
      return;
    }

    // Try to find item in each config array
    const configArrays = [
      { key: 'generators', data: currentProject.generators, update: updateGenerators },
      { key: 'systems', data: currentProject.systems, update: updateSystems },
      { key: 'pressures', data: currentProject.pressures, update: updatePressures },
      { key: 'eras', data: currentProject.eras, update: updateEras },
      { key: 'actions', data: currentProject.actions, update: updateActions },
    ];

    for (const { data, update } of configArrays) {
      if (!data) continue;
      const itemIndex = data.findIndex(item => item.id === itemId);
      if (itemIndex === -1) continue;

      // Deep clone the item
      const newData = [...data];
      const item = JSON.parse(JSON.stringify(data[itemIndex]));

      if (pathSegments.length === 0) {
        // Top-level property - delete directly from item
        delete item[propName];
      } else {
        // Navigate to parent of the property to delete
        let obj = item;
        for (let i = 0; i < pathSegments.length; i++) {
          const seg = pathSegments[i];
          if (obj[seg] === undefined) return; // Path doesn't exist
          if (i === pathSegments.length - 1) {
            // At the target object, delete the property
            delete obj[seg][propName];
          } else {
            obj = obj[seg];
          }
        }
      }

      newData[itemIndex] = item;
      update(newData);
      return;
    }
  }, [currentProject, updateGenerators, updateSystems, updatePressures, updateEras, updateActions]);

  const renderContent = () => {
    // Show landing page if explicitly on home or no project selected
    if (showHome || !currentProject) {
      return (
        <LandingPage
          onNavigate={handleLandingNavigate}
          hasProject={!!currentProject}
        />
      );
    }

    switch (activeTab) {
      case 'enumerist':
        return (
          <SchemaEditor
            project={schema}
            activeSection={activeSection}
            onSectionChange={setActiveSection}
            onUpdateEntityKinds={updateEntityKinds}
            onUpdateRelationshipKinds={updateRelationshipKinds}
            onUpdateCultures={updateCultures}
            onUpdateTagRegistry={updateTagRegistry}
            tagUsage={tagUsage}
            schemaUsage={schemaUsage}
            namingData={namingData}
          />
        );

      case 'names':
        return (
          <NameForgeHost
            projectId={currentProject?.id}
            schema={schema}
            onNamingDataChange={updateCultureNaming}
            onAddTag={addTag}
            activeSection={activeSection}
            onSectionChange={setActiveSection}
            generators={currentProject?.generators || []}
          />
        );

      case 'cosmography':
        return (
          <CosmographerHost
            schema={schema}
            axisDefinitions={currentProject.axisDefinitions || []}
            seedEntities={currentProject.seedEntities}
            seedRelationships={currentProject.seedRelationships}
            onEntityKindsChange={updateEntityKinds}
            onCulturesChange={updateCultures}
            onAxisDefinitionsChange={updateAxisDefinitions}
            onTagRegistryChange={updateTagRegistry}
            onSeedEntitiesChange={updateSeedEntities}
            onSeedRelationshipsChange={updateSeedRelationships}
            onAddTag={addTag}
            activeSection={activeSection}
            onSectionChange={setActiveSection}
            schemaUsage={schemaUsage}
          />
        );

      case 'coherence':
        return (
          <CoherenceEngineHost
            projectId={currentProject?.id}
            schema={schema}
            eras={currentProject?.eras || []}
            onErasChange={updateEras}
            pressures={currentProject?.pressures || []}
            onPressuresChange={updatePressures}
            generators={currentProject?.generators || []}
            onGeneratorsChange={updateGenerators}
            actions={currentProject?.actions || []}
            onActionsChange={updateActions}
            systems={currentProject?.systems || []}
            onSystemsChange={updateSystems}
            activeSection={activeSection}
            onSectionChange={setActiveSection}
          />
        );

      case 'simulation':
      case 'illuminator':
      case 'archivist':
      case 'chronicler':
        // Keep LoreWeaveHost, IlluminatorHost, ArchivistHost, and ChroniclerHost mounted so state persists
        // when navigating between them
        return (
          <>
            <div style={{ display: activeTab === 'simulation' ? 'contents' : 'none' }}>
              <LoreWeaveHost
                projectId={currentProject?.id}
                schema={schema}
                eras={currentProject?.eras || []}
                pressures={currentProject?.pressures || []}
                generators={currentProject?.generators || []}
                systems={currentProject?.systems || []}
                actions={currentProject?.actions || []}
                seedEntities={currentProject?.seedEntities || []}
                seedRelationships={currentProject?.seedRelationships || []}
                distributionTargets={currentProject?.distributionTargets || null}
                onDistributionTargetsChange={updateDistributionTargets}
                activeSection={activeSection}
                onSectionChange={setActiveSection}
                simulationResults={simulationResults}
                onSimulationResultsChange={setSimulationResults}
                simulationState={simulationState}
                onSimulationStateChange={setSimulationState}
              />
            </div>
            <div style={{ display: activeTab === 'illuminator' ? 'contents' : 'none' }}>
              <IlluminatorHost
                projectId={currentProject?.id}
                schema={schema}
                worldData={archivistData?.worldData}
                onWorldDataChange={handleIlluminatorWorldDataChange}
                worldContext={worldContext}
                onWorldContextChange={setWorldContext}
                entityGuidance={entityGuidance}
                onEntityGuidanceChange={setEntityGuidance}
                cultureIdentities={cultureIdentities}
                onCultureIdentitiesChange={setCultureIdentities}
                enrichmentConfig={enrichmentConfig}
                onEnrichmentConfigChange={setEnrichmentConfig}
                styleSelection={styleSelection}
                onStyleSelectionChange={setStyleSelection}
                activeSection={activeSection}
                onSectionChange={setActiveSection}
                activeSlotIndex={activeSlotIndex}
              />
            </div>
            <div style={{ display: activeTab === 'archivist' ? 'contents' : 'none' }}>
              <ArchivistHost
                worldData={archivistData?.worldData}
                loreData={archivistData?.loreData}
                imageData={archivistData?.imageData}
              />
            </div>
            <div style={{ display: activeTab === 'chronicler' ? 'contents' : 'none' }}>
              <ChroniclerHost
                projectId={currentProject?.id}
                worldData={archivistData?.worldData}
                loreData={archivistData?.loreData}
                imageData={archivistData?.imageData}
                imageLoader={imageLoader}
              />
            </div>
          </>
        );

      default:
        return null;
    }
  };

  if (loading) {
    console.log('[Canonry] Project storage still loading');
    return (
      <div style={{ ...styles.app, alignItems: 'center', justifyContent: 'center' }}>
        <div style={styles.loading}>Loading...</div>
      </div>
    );
  }

  return (
    <div style={styles.app}>
      <ProjectManager
        projects={projects}
        currentProject={currentProject}
        onCreateProject={createProject}
        onOpenProject={openProject}
        onDeleteProject={removeProject}
        onDuplicateProject={duplicateProject}
        onExportProject={exportProject}
        onImportProject={importProject}
        onReloadFromDefaults={handleReloadFromDefaults}
        defaultProjectId={DEFAULT_PROJECT_ID}
        onGoHome={handleGoHome}
        validationResult={validationResult}
        onNavigateToValidation={handleNavigateToValidation}
        onRemoveProperty={handleRemoveProperty}
        simulationState={simulationState}
        systems={currentProject?.systems || []}
        slots={slots}
        activeSlotIndex={activeSlotIndex}
        onLoadSlot={handleLoadSlot}
        onSaveToSlot={handleSaveToSlot}
        onClearSlot={handleClearSlot}
        onUpdateSlotTitle={handleUpdateSlotTitle}
        onExportSlot={handleExportSlot}
        onImportSlot={handleImportSlot}
        onLoadExampleOutput={handleLoadExampleOutput}
        hasDataInScratch={hasDataInScratch}
      />
      {currentProject && !showHome && (
        <Navigation
          activeTab={activeTab}
          onTabChange={handleTabChange}
          onHelpClick={() => setHelpModalOpen(true)}
        />
      )}
      <div style={styles.content}>{renderContent()}</div>
      <footer style={styles.footer}>
        <span>Copyright © 2025</span>
        <img src="/tsonu-combined.png" alt="tsonu" height="14" />
      </footer>
      {error && (
        <div
          style={{
            position: 'fixed',
            bottom: spacing.xl,
            right: spacing.xl,
            backgroundColor: colors.danger,
            color: 'white',
            padding: `${spacing.md} ${spacing.xl}`,
            borderRadius: spacing.sm,
            fontSize: typography.sizeMd,
          }}
        >
          Error: {error}
        </div>
      )}
      <HelpModal
        isOpen={helpModalOpen}
        onClose={() => setHelpModalOpen(false)}
        activeTab={activeTab}
      />
    </div>
  );
}
