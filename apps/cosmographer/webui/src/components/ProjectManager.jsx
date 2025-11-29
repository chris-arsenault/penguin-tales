/**
 * ProjectManager - Sidebar for managing world seed projects.
 */

import React, { useState, useRef } from 'react';

const styles = {
  container: {
    width: '280px',
    backgroundColor: '#16213e',
    borderRight: '1px solid #0f3460',
    display: 'flex',
    flexDirection: 'column',
    height: '100%'
  },
  header: {
    padding: '16px',
    borderBottom: '1px solid #0f3460'
  },
  title: {
    fontSize: '18px',
    fontWeight: 600,
    color: '#e94560',
    marginBottom: '12px'
  },
  actions: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap'
  },
  button: {
    padding: '6px 12px',
    fontSize: '12px',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    backgroundColor: '#0f3460',
    color: '#eee',
    transition: 'background-color 0.2s'
  },
  buttonPrimary: {
    backgroundColor: '#e94560'
  },
  projectList: {
    flex: 1,
    overflowY: 'auto',
    padding: '8px'
  },
  projectItem: {
    padding: '12px',
    marginBottom: '8px',
    backgroundColor: '#1a1a2e',
    borderRadius: '6px',
    cursor: 'pointer',
    border: '2px solid transparent',
    transition: 'border-color 0.2s'
  },
  projectItemActive: {
    borderColor: '#e94560'
  },
  projectName: {
    fontSize: '14px',
    fontWeight: 500,
    marginBottom: '4px'
  },
  projectMeta: {
    fontSize: '11px',
    color: '#888',
    display: 'flex',
    gap: '12px'
  },
  projectActions: {
    display: 'flex',
    gap: '4px',
    marginTop: '8px'
  },
  smallButton: {
    padding: '4px 8px',
    fontSize: '10px',
    border: 'none',
    borderRadius: '3px',
    cursor: 'pointer',
    backgroundColor: '#0f3460',
    color: '#aaa'
  },
  emptyState: {
    textAlign: 'center',
    padding: '40px 20px',
    color: '#666'
  },
  modal: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000
  },
  modalContent: {
    backgroundColor: '#1a1a2e',
    padding: '24px',
    borderRadius: '8px',
    width: '400px'
  },
  modalTitle: {
    fontSize: '16px',
    fontWeight: 600,
    marginBottom: '16px'
  },
  input: {
    width: '100%',
    padding: '10px',
    fontSize: '14px',
    backgroundColor: '#16213e',
    border: '1px solid #0f3460',
    borderRadius: '4px',
    color: '#eee',
    marginBottom: '16px'
  },
  modalActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '8px'
  }
};

export default function ProjectManager({
  projects,
  currentProject,
  onCreateProject,
  onOpenProject,
  onDeleteProject,
  onDuplicateProject,
  onExportProject,
  onImportProject
}) {
  const [showNewModal, setShowNewModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const fileInputRef = useRef(null);

  const handleCreate = () => {
    if (newProjectName.trim()) {
      onCreateProject(newProjectName.trim());
      setNewProjectName('');
      setShowNewModal(false);
    }
  };

  const handleImport = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        onImportProject(event.target.result);
      } catch (err) {
        alert('Failed to import: ' + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleExport = () => {
    const json = onExportProject();
    if (!json) return;

    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentProject?.name || 'world'}.cosmographer.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.title}>Cosmographer</div>
        <div style={styles.actions}>
          <button
            style={{ ...styles.button, ...styles.buttonPrimary }}
            onClick={() => setShowNewModal(true)}
          >
            + New World
          </button>
          <button style={styles.button} onClick={() => fileInputRef.current?.click()}>
            Import
          </button>
          <button
            style={styles.button}
            onClick={handleExport}
            disabled={!currentProject}
          >
            Export
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            style={{ display: 'none' }}
            onChange={handleImport}
          />
        </div>
      </div>

      <div style={styles.projectList}>
        {projects.length === 0 ? (
          <div style={styles.emptyState}>
            <p>No worlds yet.</p>
            <p>Create one to get started!</p>
          </div>
        ) : (
          projects.map((project) => (
            <div
              key={project.id}
              style={{
                ...styles.projectItem,
                ...(currentProject?.id === project.id ? styles.projectItemActive : {})
              }}
              onClick={() => onOpenProject(project.id)}
            >
              <div style={styles.projectName}>{project.name}</div>
              <div style={styles.projectMeta}>
                <span>{project.entityCount} entities</span>
                <span>{project.cultureCount} cultures</span>
              </div>
              <div style={styles.projectMeta}>
                {formatDate(project.updatedAt)}
              </div>
              <div style={styles.projectActions} onClick={(e) => e.stopPropagation()}>
                <button
                  style={styles.smallButton}
                  onClick={() => onDuplicateProject(project.id)}
                >
                  Duplicate
                </button>
                <button
                  style={{ ...styles.smallButton, color: '#e94560' }}
                  onClick={() => {
                    if (confirm(`Delete "${project.name}"?`)) {
                      onDeleteProject(project.id);
                    }
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {showNewModal && (
        <div style={styles.modal} onClick={() => setShowNewModal(false)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalTitle}>Create New World</div>
            <input
              style={styles.input}
              type="text"
              placeholder="World name..."
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              autoFocus
            />
            <div style={styles.modalActions}>
              <button style={styles.button} onClick={() => setShowNewModal(false)}>
                Cancel
              </button>
              <button
                style={{ ...styles.button, ...styles.buttonPrimary }}
                onClick={handleCreate}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
