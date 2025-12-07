/**
 * The Canonry - Unified World-Building Suite
 *
 * Shell application that hosts name-forge, cosmographer, and lore-weave
 * as module federation remotes with a unified WorldSeedProject schema.
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useProjectStorage } from './storage/useProjectStorage';
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

// Valid sub-nav values for each tab
const VALID_SUBNAV = {
  enumerist: ['entityKinds', 'relationshipKinds', 'cultures', 'tags'],
  names: ['workshop', 'optimizer', 'generate'],
  cosmography: ['planes', 'cultures', 'entities', 'relationships'],
  coherence: ['pressures', 'eras', 'generators', 'actions', 'systems'],
  simulation: ['configure', 'targets', 'validate', 'run', 'results'],
  archivist: ['explorer'],
};

// URL state management
function getInitialState() {
  const params = new URLSearchParams(window.location.search);
  const tab = params.get('tab');
  const section = params.get('section');

  // If no tab param, show home (landing page)
  if (!tab) {
    return { tab: null, section: null, showHome: true };
  }

  const validTab = ['enumerist', 'names', 'cosmography', 'coherence', 'simulation', 'archivist'].includes(tab)
    ? tab
    : 'enumerist';

  const validSection = VALID_SUBNAV[validTab]?.includes(section)
    ? section
    : VALID_SUBNAV[validTab]?.[0] || null;

  return { tab: validTab, section: validSection, showHome: false };
}

function updateUrl(tab, section, showHome) {
  const url = new URL(window.location.href);
  if (showHome) {
    url.searchParams.delete('tab');
    url.searchParams.delete('section');
  } else {
    url.searchParams.set('tab', tab);
    if (section) {
      url.searchParams.set('section', section);
    } else {
      url.searchParams.delete('section');
    }
  }
  window.history.replaceState({}, '', url);
}

export default function App() {
  const initialState = getInitialState();
  const [activeTab, setActiveTab] = useState(initialState.tab);
  const [activeSection, setActiveSection] = useState(initialState.section);
  const [showHome, setShowHome] = useState(initialState.showHome);
  const [helpModalOpen, setHelpModalOpen] = useState(false);
  const [archivistData, setArchivistData] = useState(null);
  const [simulationResults, setSimulationResults] = useState(null);
  const [simulationState, setSimulationState] = useState(null);

  // Handle tab change - reset section to first valid for new tab
  const handleTabChange = useCallback((newTab) => {
    setActiveTab(newTab);
    const defaultSection = VALID_SUBNAV[newTab]?.[0] || null;
    setActiveSection(defaultSection);
    setShowHome(false);
  }, []);

  // Handle going home (clicking logo)
  const handleGoHome = useCallback(() => {
    setShowHome(true);
  }, []);

  // Handle navigation from landing page cards
  const handleLandingNavigate = useCallback((tabId) => {
    setActiveTab(tabId);
    const defaultSection = VALID_SUBNAV[tabId]?.[0] || null;
    setActiveSection(defaultSection);
    setShowHome(false);
  }, []);

  // Sync state changes to URL
  useEffect(() => {
    updateUrl(activeTab, activeSection, showHome);
  }, [activeTab, activeSection, showHome]);

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
    setActiveSection('explorer');
    setShowHome(false);
  }, [currentProject]);

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

  // Update semantic plane for an entity kind (for Cosmographer)
  const updateEntityKindSemanticPlane = useCallback(
    (entityKindId, semanticPlane) => {
      if (!currentProject) return;
      const entityKinds = currentProject.entityKinds.map((ek) =>
        ek.kind === entityKindId ? { ...ek, semanticPlane } : ek
      );
      save({ entityKinds });
    },
    [currentProject, save]
  );

  // Update a single culture's visual data (for Cosmographer)
  const updateCultureVisuals = useCallback(
    (cultureId, visualData) => {
      if (!currentProject) return;
      const cultures = currentProject.cultures.map((c) =>
        c.id === cultureId
          ? { ...c, axisBiases: visualData.axisBiases, homeRegions: visualData.homeRegions }
          : c
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

  // Extract semantic data for Cosmographer (keyed by entity kind)
  const semanticData = useMemo(() => {
    if (!currentProject) return {};
    const data = {};
    currentProject.entityKinds.forEach((ek) => {
      if (ek.semanticPlane) {
        data[ek.kind] = ek.semanticPlane;
      }
    });
    return data;
  }, [currentProject?.entityKinds]);

  // Extract culture visuals for Cosmographer (keyed by culture ID)
  const cultureVisuals = useMemo(() => {
    if (!currentProject) return {};
    const data = {};
    currentProject.cultures.forEach((culture) => {
      data[culture.id] = {
        axisBiases: culture.axisBiases || {},
        homeRegions: culture.homeRegions || {},
      };
    });
    return data;
  }, [currentProject?.cultures]);

  // Derived data for remotes (read-only schema)
  const schema = useMemo(() => {
    if (!currentProject) return { entityKinds: [], relationshipKinds: [], cultures: [], tagRegistry: [] };
    return {
      entityKinds: currentProject.entityKinds,
      relationshipKinds: currentProject.relationshipKinds,
      cultures: currentProject.cultures.map((c) => ({
        id: c.id,
        name: c.name,
        description: c.description,
        color: c.color,
      })),
      tagRegistry: currentProject.tagRegistry || [],
    };
  }, [currentProject?.entityKinds, currentProject?.relationshipKinds, currentProject?.cultures, currentProject?.tagRegistry]);

  // Compute tag usage across all tools
  const tagUsage = useMemo(() => {
    if (!currentProject) return {};
    return computeTagUsage(currentProject.cultures, currentProject.seedEntities);
  }, [currentProject?.cultures, currentProject?.seedEntities]);

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
    currentProject?.cultures,
    currentProject?.entityKinds,
    currentProject?.relationshipKinds,
  ]);

  // Navigate to validation tab
  const handleNavigateToValidation = useCallback(() => {
    setActiveTab('simulation');
    setActiveSection('validate');
    setShowHome(false);
  }, []);

  // Remove property from config at given path (for validation error quick-fix)
  const handleRemoveProperty = useCallback((path, propName) => {
    if (!currentProject || !path || !propName) return;

    // Parse path like "item_id"/nested/path
    const match = path.match(/^"([^"]+)"\/(.+)$/);
    if (!match) return;

    const [, itemId, restPath] = match;
    const pathSegments = restPath.split('/');

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
            schema={schema}
            namingData={namingData}
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
            semanticData={semanticData}
            cultureVisuals={cultureVisuals}
            namingData={namingData}
            seedEntities={currentProject.seedEntities}
            seedRelationships={currentProject.seedRelationships}
            onSemanticDataChange={updateEntityKindSemanticPlane}
            onCultureVisualsChange={updateCultureVisuals}
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
            namingData={namingData}
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
                schema={schema}
                eras={currentProject?.eras || []}
                pressures={currentProject?.pressures || []}
                generators={currentProject?.generators || []}
                systems={currentProject?.systems || []}
                seedEntities={currentProject?.seedEntities || []}
                seedRelationships={currentProject?.seedRelationships || []}
                namingData={namingData}
                semanticData={semanticData}
                cultureVisuals={cultureVisuals}
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
