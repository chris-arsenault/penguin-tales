/**
 * Cosmographer - Visual World Seed Builder
 *
 * Main application shell with tab-based navigation.
 */

import React, { useState } from 'react';
import { useProjectStorage } from './storage/useProjectStorage.js';
import ProjectManager from './components/ProjectManager.jsx';
import SchemaEditor from './components/SchemaEditor/index.jsx';
import CultureEditor from './components/CultureEditor/index.jsx';
import SemanticPlaneEditor from './components/SemanticPlane/index.jsx';
import EntityEditor from './components/EntityEditor/index.jsx';
import RelationshipEditor from './components/RelationshipEditor/index.jsx';

const TABS = [
  { id: 'schema', label: 'Schema', icon: '📋' },
  { id: 'cultures', label: 'Cultures', icon: '🎭' },
  { id: 'planes', label: 'Semantic Planes', icon: '🗺️' },
  { id: 'entities', label: 'Entities', icon: '📍' },
  { id: 'relationships', label: 'Relationships', icon: '🔗' },
  { id: 'export', label: 'Export', icon: '📦' }
];

const styles = {
  container: {
    display: 'flex',
    height: '100vh',
    backgroundColor: '#1a1a2e'
  },
  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden'
  },
  tabBar: {
    display: 'flex',
    backgroundColor: '#16213e',
    borderBottom: '1px solid #0f3460',
    padding: '0 16px'
  },
  tab: {
    padding: '12px 20px',
    fontSize: '14px',
    color: '#888',
    cursor: 'pointer',
    borderBottom: '2px solid transparent',
    transition: 'all 0.2s',
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  tabActive: {
    color: '#eee',
    borderBottomColor: '#e94560'
  },
  tabDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed'
  },
  content: {
    flex: 1,
    padding: '24px',
    overflowY: 'auto'
  },
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: '#666'
  },
  noProject: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: '#666'
  },
  noProjectTitle: {
    fontSize: '24px',
    marginBottom: '8px'
  },
  placeholder: {
    textAlign: 'center',
    color: '#666',
    marginTop: '100px'
  },
  placeholderTitle: {
    fontSize: '20px',
    marginBottom: '8px'
  }
};

function TabContent({ tab, project, onSave }) {
  switch (tab) {
    case 'schema':
      return <SchemaEditor project={project} onSave={onSave} />;
    case 'cultures':
      return <CultureEditor project={project} onSave={onSave} />;
    case 'planes':
      return <SemanticPlaneEditor project={project} onSave={onSave} />;
    case 'entities':
      return <EntityEditor project={project} onSave={onSave} />;
    case 'relationships':
      return <RelationshipEditor project={project} onSave={onSave} />;

    default: {
      const placeholders = {
        export: {
          title: 'Export',
          desc: 'Preview and download the world seed JSON.'
        }
      };

      const info = placeholders[tab] || { title: 'Unknown', desc: '' };

      return (
        <div style={styles.placeholder}>
          <div style={styles.placeholderTitle}>{info.title}</div>
          <div>{info.desc}</div>
          <div style={{ marginTop: '20px', color: '#444' }}>
            Coming soon...
          </div>
        </div>
      );
    }
  }
}

export default function App() {
  const [activeTab, setActiveTab] = useState('schema');

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
    importProject
  } = useProjectStorage();

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>Loading...</div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
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

      <div style={styles.main}>
        <div style={styles.tabBar}>
          {TABS.map((tab) => (
            <div
              key={tab.id}
              style={{
                ...styles.tab,
                ...(activeTab === tab.id ? styles.tabActive : {}),
                ...(!currentProject ? styles.tabDisabled : {})
              }}
              onClick={() => currentProject && setActiveTab(tab.id)}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </div>
          ))}
        </div>

        <div style={styles.content}>
          {!currentProject ? (
            <div style={styles.noProject}>
              <div style={styles.noProjectTitle}>No world selected</div>
              <div>Create or open a world to begin.</div>
            </div>
          ) : (
            <TabContent
              tab={activeTab}
              project={currentProject}
              onSave={save}
            />
          )}
        </div>
      </div>

      {error && (
        <div style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          backgroundColor: '#e94560',
          color: 'white',
          padding: '12px 20px',
          borderRadius: '4px'
        }}>
          Error: {error}
        </div>
      )}
    </div>
  );
}
