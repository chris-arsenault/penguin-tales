/**
 * The Canonry - Unified World-Building Suite
 *
 * Shell application that hosts name-forge, cosmographer, and lore-weave
 * as module federation remotes with a unified WorldSeedProject schema.
 */

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useProjectStorage } from './storage/useProjectStorage';
import { loadUiState, saveUiState } from './storage/uiState';
import { loadSimulationRun, saveSimulationRun } from './storage/simulationStore';
import ProjectManager from './components/ProjectManager';
import Navigation from './components/Navigation';
import SchemaEditor from './components/SchemaEditor';
import LandingPage from './components/LandingPage';
import HelpModal from './components/HelpModal';
import { computeTagUsage, computeSchemaUsage } from '@penguin-tales/shared-components';
import { validateAllConfigs } from '../../../lore-weave/lib/engine/configSchemaValidator';
import NameForgeHost from './remotes/NameForgeHost';
import CosmographerHost from './remotes/CosmographerHost';
import CoherenceEngineHost from './remotes/CoherenceEngineHost';
import LoreWeaveHost from './remotes/LoreWeaveHost';
import ArchivistHost from './remotes/ArchivistHost';
import { colors, typography, spacing } from './theme';

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
  'archivist',
];

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
  const [simulationResults, setSimulationResults] = useState(null);
  const [simulationState, setSimulationState] = useState(null);
  const simulationOwnerRef = useRef(null);
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
  } = useProjectStorage();

  useEffect(() => {
    let cancelled = false;
    if (!currentProject?.id) {
      simulationOwnerRef.current = null;
      setSimulationResults(null);
      setSimulationState(null);
      return undefined;
    }

    simulationOwnerRef.current = null;
    setSimulationResults(null);
    setSimulationState(null);
    loadSimulationRun(currentProject.id).then((run) => {
      if (cancelled) return;
      simulationOwnerRef.current = currentProject.id;
      setSimulationResults(run?.simulationResults || null);
      setSimulationState(run?.simulationState || null);
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
    saveSimulationRun(currentProject.id, {
      simulationResults,
      simulationState,
    });
  }, [currentProject?.id, simulationResults, simulationState]);

  // Handle viewing simulation results in Archivist
  const handleViewInArchivist = useCallback((simulationResults) => {
    // Build per-kind map configs from semantic plane data
    const perKindMaps = {};

    currentProject?.entityKinds?.forEach(ek => {
      if (ek.semanticPlane) {
        const sp = ek.semanticPlane;
        // Build map config with axis labels
        perKindMaps[ek.kind] = {
          entityKind: ek.kind,
          name: `${ek.description || ek.kind} Semantic Map`,
          description: `Coordinate space for ${ek.description || ek.kind}`,
          bounds: { min: 0, max: 100 },
          hasZAxis: !!sp.axes?.z,
          zAxisLabel: sp.axes?.z?.name,
          xAxis: sp.axes?.x,
          yAxis: sp.axes?.y,
          zAxis: sp.axes?.z,
        };
      }
    });

    // Build per-kind regions from coordinateState (includes both seed and emergent regions)
    // coordinateState is the authoritative source - it contains all regions after simulation
    const perKindRegions = {};
    const coordRegions = simulationResults.coordinateState?.regions;

    // Build culture color lookup for emergent regions that don't have explicit colors
    const cultureColors = {};
    currentProject?.cultures?.forEach(c => {
      if (c.id && c.color) {
        cultureColors[c.id] = c.color;
      }
    });

    if (coordRegions) {
      Object.entries(coordRegions).forEach(([entityKind, regions]) => {
        if (regions && regions.length > 0) {
          perKindRegions[entityKind] = regions.map(r => ({
            id: r.id,
            label: r.label,
            description: r.description,
            bounds: r.bounds,
            metadata: {
              // Use region's color, or look up culture's color
              color: r.color || (r.culture && cultureColors[r.culture]),
              culture: r.culture,
              tags: r.tags,
              subtype: r.culture ? 'colony' : 'default',
              emergent: r.emergent,
              createdAt: r.createdAt,
              createdBy: r.createdBy,
            },
          }));
        }
      });
    }

    // Build uiSchema for Archivist
    const uiSchema = {
      worldName: currentProject?.name || 'Simulation Results',
      worldIcon: '🌍',
      entityKinds: currentProject?.entityKinds || [],
      relationshipKinds: currentProject?.relationshipKinds || [],
      prominenceLevels: ['forgotten', 'marginal', 'recognized', 'renowned', 'mythic'],
      cultures: currentProject?.cultures?.map(c => ({
        id: c.id,
        name: c.name,
        description: c.description,
        color: c.color,
      })) || [],
      perKindMaps,
      perKindRegions,
    };

    // Transform simulation results to archivist WorldState format
    const worldData = {
      metadata: {
        ...simulationResults.metadata,
        enrichmentTriggers: {},
      },
      hardState: simulationResults.hardState || [],
      relationships: simulationResults.relationships || [],
      pressures: simulationResults.pressures || {},
      history: simulationResults.history || [],
      uiSchema,
    };
    setArchivistData({ worldData, loreData: null, imageData: null });
    setActiveTab('archivist');
    setActiveSectionForTab('archivist', 'explorer');
    setShowHome(false);
  }, [currentProject, setActiveSectionForTab]);

  // Update functions that auto-save
  const updateEntityKinds = useCallback(
    (entityKinds) => save({ entityKinds }),
    [save]
  );

  const updateRelationshipKinds = useCallback(
    (relationshipKinds) => save({ relationshipKinds }),
    [save]
  );

  const updateCultures = useCallback(
    (cultures) => save({ cultures }),
    [save]
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
    (tagRegistry) => save({ tagRegistry }),
    [save]
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
      const cultures = currentProject.cultures.map((c) =>
        c.id === cultureId ? { ...c, naming: namingData } : c
      );
      save({ cultures });
    },
    [currentProject, save]
  );

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
    if (!currentProject) {
      return {
        id: '',
        name: '',
        version: '',
        entityKinds: [],
        relationshipKinds: [],
        cultures: [],
        tagRegistry: [],
      };
    }
    return {
      id: currentProject.id,
      name: currentProject.name,
      version: currentProject.version,
      entityKinds: currentProject.entityKinds,
      relationshipKinds: currentProject.relationshipKinds,
      cultures: currentProject.cultures,
      tagRegistry: currentProject.tagRegistry || [],
    };
  }, [
    currentProject?.id,
    currentProject?.name,
    currentProject?.version,
    currentProject?.entityKinds,
    currentProject?.relationshipKinds,
    currentProject?.cultures,
    currentProject?.tagRegistry,
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
    });
  }, [currentProject?.cultures, currentProject?.seedEntities, currentProject?.generators, currentProject?.systems, currentProject?.pressures, currentProject?.entityKinds]);

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

    const cultures = currentProject.cultures?.map(c => c.id) || [];
    const entityKinds = currentProject.entityKinds?.map(k => typeof k === 'string' ? k : k.kind) || [];
    const relationshipKinds = currentProject.relationshipKinds?.map(k => typeof k === 'string' ? k : k.kind) || [];

    return validateAllConfigs({
      templates: currentProject.generators || [],
      pressures: currentProject.pressures || [],
      systems: currentProject.systems || [],
      eras: currentProject.eras || [],
      actions: currentProject.actions || [],
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
    currentProject?.cultures,
    currentProject?.entityKinds,
    currentProject?.relationshipKinds,
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
            project={currentProject}
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
      case 'archivist':
        // Keep both LoreWeaveHost and ArchivistHost mounted so simulation state persists
        // when exporting to Archivist and navigating back
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
                onViewInArchivist={handleViewInArchivist}
                simulationResults={simulationResults}
                onSimulationResultsChange={setSimulationResults}
                simulationState={simulationState}
                onSimulationStateChange={setSimulationState}
              />
            </div>
            <div style={{ display: activeTab === 'archivist' ? 'contents' : 'none' }}>
              <ArchivistHost
                worldData={archivistData?.worldData}
                loreData={archivistData?.loreData}
                imageData={archivistData?.imageData}
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
        onGoHome={handleGoHome}
        validationResult={validationResult}
        onNavigateToValidation={handleNavigateToValidation}
        onRemoveProperty={handleRemoveProperty}
        simulationState={simulationState}
        systems={currentProject?.systems || []}
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
