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
import NameForgeHost from './remotes/NameForgeHost';
import CosmographerHost from './remotes/CosmographerHost';
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
  enumerist: ['entityKinds', 'relationshipKinds', 'cultures'],
  names: ['workshop', 'optimizer', 'generate'],
  cosmography: ['planes', 'cultures', 'entities', 'relationships'],
  simulation: [],
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

  const validTab = ['enumerist', 'names', 'cosmography', 'simulation'].includes(tab)
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
        ek.id === entityKindId ? { ...ek, semanticPlane } : ek
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

  // Extract semantic data for Cosmographer (keyed by entity kind ID)
  const semanticData = useMemo(() => {
    if (!currentProject) return {};
    const data = {};
    currentProject.entityKinds.forEach((ek) => {
      if (ek.semanticPlane) {
        data[ek.id] = ek.semanticPlane;
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
    if (!currentProject) return { entityKinds: [], relationshipKinds: [], cultures: [] };
    return {
      entityKinds: currentProject.entityKinds,
      relationshipKinds: currentProject.relationshipKinds,
      cultures: currentProject.cultures.map((c) => ({
        id: c.id,
        name: c.name,
        description: c.description,
        color: c.color,
      })),
    };
  }, [currentProject?.entityKinds, currentProject?.relationshipKinds, currentProject?.cultures]);

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
          />
        );

      case 'names':
        return (
          <NameForgeHost
            schema={schema}
            namingData={namingData}
            onNamingDataChange={updateCultureNaming}
            activeSection={activeSection}
            onSectionChange={setActiveSection}
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
            activeSection={activeSection}
            onSectionChange={setActiveSection}
          />
        );

      case 'simulation':
        return (
          <div style={{ padding: '40px', textAlign: 'center', color: '#666' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>

            </div>
            <div>Lore Weave integration coming soon...</div>
          </div>
        );

      default:
        return null;
    }
  };

  if (loading) {
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
