/**
 * The Canonry - Unified World-Building Suite
 *
 * Shell application that hosts name-forge, cosmographer, and lore-weave
 * as module federation remotes with a unified WorldSeedProject schema.
 */

import React, { useState, useMemo, useCallback } from 'react';
import { useProjectStorage } from './storage/useProjectStorage';
import ProjectManager from './components/ProjectManager';
import Navigation from './components/Navigation';
import SchemaEditor from './components/SchemaEditor';
import NameForgeHost from './remotes/NameForgeHost';
import CosmographerHost from './remotes/CosmographerHost';

const styles = {
  app: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    backgroundColor: '#0a0a0f',
    color: '#e0e0e0',
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
    color: '#666',
  },
  noProject: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: '#666',
    textAlign: 'center',
    padding: '40px',
  },
  footer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 16px',
    backgroundColor: '#0a0a0f',
    borderTop: '1px solid #1e1e2e',
    fontSize: '12px',
    color: '#666',
    flexShrink: 0,
  },
};

export default function App() {
  const [activeTab, setActiveTab] = useState('enumerist');

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
    if (!currentProject) {
      return (
        <div style={styles.noProject}>
          <div style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.3 }}>

          </div>
          <div style={{ fontSize: '18px', marginBottom: '8px' }}>No Project Selected</div>
          <div>Create or select a project to begin.</div>
        </div>
      );
    }

    switch (activeTab) {
      case 'enumerist':
        return (
          <SchemaEditor
            project={currentProject}
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
          />
        );

      case 'cosmography':
        return (
          <CosmographerHost
            schema={schema}
            semanticData={semanticData}
            cultureVisuals={cultureVisuals}
            seedEntities={currentProject.seedEntities}
            seedRelationships={currentProject.seedRelationships}
            onSemanticDataChange={updateEntityKindSemanticPlane}
            onCultureVisualsChange={updateCultureVisuals}
            onSeedEntitiesChange={updateSeedEntities}
            onSeedRelationshipsChange={updateSeedRelationships}
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
      />
      <Navigation activeTab={activeTab} onTabChange={setActiveTab} />
      <div style={styles.content}>{renderContent()}</div>
      <footer style={styles.footer}>
        <span>Copyright © 2025</span>
        <img src="/tsonu-combined.png" alt="tsonu" height="14" />
      </footer>
      {error && (
        <div
          style={{
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            backgroundColor: '#e94560',
            color: 'white',
            padding: '12px 20px',
            borderRadius: '4px',
          }}
        >
          Error: {error}
        </div>
      )}
    </div>
  );
}
