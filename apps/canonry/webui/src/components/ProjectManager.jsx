/**
 * ProjectManager - Header bar with project dropdown
 */

import React, { useState, useRef, useEffect } from 'react';

const styles = {
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 16px',
    backgroundColor: '#0a0a0f',
    borderBottom: '1px solid #1e1e2e',
    flexShrink: 0,
  },
  left: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  logo: {
    fontSize: '20px',
    fontWeight: 700,
    color: '#e94560',
    letterSpacing: '-0.5px',
  },
  projectSelector: {
    position: 'relative',
  },
  projectButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 12px',
    backgroundColor: '#1e1e2e',
    border: 'none',
    borderRadius: '4px',
    color: '#ccc',
    fontSize: '14px',
    cursor: 'pointer',
    minWidth: '200px',
    justifyContent: 'space-between',
  },
  projectName: {
    fontWeight: 500,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  chevron: {
    fontSize: '10px',
    color: '#666',
  },
  dropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    marginTop: '4px',
    backgroundColor: '#12121a',
    border: '1px solid #1e1e2e',
    borderRadius: '6px',
    minWidth: '320px',
    maxHeight: '400px',
    overflowY: 'auto',
    zIndex: 1000,
    boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
  },
  dropdownHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px',
    borderBottom: '1px solid #1e1e2e',
  },
  dropdownTitle: {
    fontSize: '12px',
    fontWeight: 600,
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  dropdownActions: {
    display: 'flex',
    gap: '8px',
  },
  smallButton: {
    padding: '4px 8px',
    fontSize: '11px',
    border: 'none',
    borderRadius: '3px',
    cursor: 'pointer',
    backgroundColor: '#1e1e2e',
    color: '#888',
  },
  smallButtonPrimary: {
    backgroundColor: '#e94560',
    color: 'white',
  },
  projectList: {
    padding: '8px',
  },
  projectItem: {
    padding: '10px 12px',
    borderRadius: '4px',
    cursor: 'pointer',
    marginBottom: '4px',
    backgroundColor: 'transparent',
    transition: 'background-color 0.15s',
  },
  projectItemActive: {
    backgroundColor: '#1e1e2e',
  },
  projectItemHover: {
    backgroundColor: '#1a1a24',
  },
  projectItemName: {
    fontSize: '14px',
    fontWeight: 500,
    color: '#e0e0e0',
    marginBottom: '2px',
  },
  projectItemMeta: {
    fontSize: '11px',
    color: '#666',
    display: 'flex',
    gap: '12px',
  },
  projectItemActions: {
    display: 'flex',
    gap: '4px',
    marginTop: '6px',
  },
  tinyButton: {
    padding: '2px 6px',
    fontSize: '10px',
    border: 'none',
    borderRadius: '2px',
    cursor: 'pointer',
    backgroundColor: '#0a0a0f',
    color: '#666',
  },
  emptyState: {
    padding: '20px',
    textAlign: 'center',
    color: '#666',
    fontSize: '13px',
  },
  right: {
    display: 'flex',
    gap: '8px',
  },
  button: {
    padding: '8px 14px',
    fontSize: '13px',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    transition: 'background-color 0.15s',
  },
  buttonPrimary: {
    backgroundColor: '#e94560',
    color: 'white',
  },
  buttonSecondary: {
    backgroundColor: '#1e1e2e',
    color: '#ccc',
  },
  hiddenInput: {
    display: 'none',
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
    zIndex: 1000,
  },
  modalContent: {
    backgroundColor: '#12121a',
    padding: '24px',
    borderRadius: '8px',
    width: '400px',
  },
  modalTitle: {
    fontSize: '16px',
    fontWeight: 600,
    marginBottom: '16px',
    color: '#e0e0e0',
  },
  input: {
    width: '100%',
    padding: '10px',
    fontSize: '14px',
    backgroundColor: '#0d0d14',
    border: '1px solid #1e1e2e',
    borderRadius: '4px',
    color: '#e0e0e0',
    marginBottom: '16px',
    boxSizing: 'border-box',
  },
  modalActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '8px',
  },
};

export default function ProjectManager({
  projects,
  currentProject,
  onCreateProject,
  onOpenProject,
  onDeleteProject,
  onDuplicateProject,
  onExportProject,
  onImportProject,
}) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [showNewModal, setShowNewModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [hoveredProject, setHoveredProject] = useState(null);
  const dropdownRef = useRef(null);
  const fileInputRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCreate = () => {
    if (newProjectName.trim()) {
      onCreateProject(newProjectName.trim());
      setNewProjectName('');
      setShowNewModal(false);
      setShowDropdown(false);
    }
  };

  const handleImport = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        onImportProject(event.target.result);
        setShowDropdown(false);
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
    a.download = `${currentProject?.name || 'world'}.canonry.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  return (
    <header style={styles.header}>
      <div style={styles.left}>
        <div style={styles.logo}>The Canonry</div>

        <div style={styles.projectSelector} ref={dropdownRef}>
          <button
            style={styles.projectButton}
            onClick={() => setShowDropdown(!showDropdown)}
          >
            <span style={styles.projectName}>
              {currentProject?.name || 'Select Project'}
            </span>
            <span style={styles.chevron}>{showDropdown ? '▲' : '▼'}</span>
          </button>

          {showDropdown && (
            <div style={styles.dropdown}>
              <div style={styles.dropdownHeader}>
                <span style={styles.dropdownTitle}>Projects</span>
                <div style={styles.dropdownActions}>
                  <button
                    style={{ ...styles.smallButton, ...styles.smallButtonPrimary }}
                    onClick={() => {
                      setShowDropdown(false);
                      setShowNewModal(true);
                    }}
                  >
                    + New
                  </button>
                  <button
                    style={styles.smallButton}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Import
                  </button>
                </div>
              </div>

              <div style={styles.projectList}>
                {projects.length === 0 ? (
                  <div style={styles.emptyState}>
                    No projects yet. Create one to get started!
                  </div>
                ) : (
                  projects.map((project) => (
                    <div
                      key={project.id}
                      style={{
                        ...styles.projectItem,
                        ...(currentProject?.id === project.id
                          ? styles.projectItemActive
                          : hoveredProject === project.id
                          ? styles.projectItemHover
                          : {}),
                      }}
                      onClick={() => {
                        onOpenProject(project.id);
                        setShowDropdown(false);
                      }}
                      onMouseEnter={() => setHoveredProject(project.id)}
                      onMouseLeave={() => setHoveredProject(null)}
                    >
                      <div style={styles.projectItemName}>{project.name}</div>
                      <div style={styles.projectItemMeta}>
                        <span>{project.entityCount} entities</span>
                        <span>{project.cultureCount} cultures</span>
                        <span>{formatDate(project.updatedAt)}</span>
                      </div>
                      <div
                        style={styles.projectItemActions}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          style={styles.tinyButton}
                          onClick={() => onDuplicateProject(project.id)}
                        >
                          Duplicate
                        </button>
                        <button
                          style={{ ...styles.tinyButton, color: '#e94560' }}
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
            </div>
          )}
        </div>
      </div>

      <div style={styles.right}>
        <button
          style={{ ...styles.button, ...styles.buttonSecondary }}
          onClick={handleExport}
          disabled={!currentProject}
        >
          Export
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          style={styles.hiddenInput}
          onChange={handleImport}
        />
      </div>

      {showNewModal && (
        <div style={styles.modal} onClick={() => setShowNewModal(false)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalTitle}>Create New Project</div>
            <input
              style={styles.input}
              type="text"
              placeholder="Project name..."
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              autoFocus
            />
            <div style={styles.modalActions}>
              <button
                style={{ ...styles.button, ...styles.buttonSecondary }}
                onClick={() => setShowNewModal(false)}
              >
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
    </header>
  );
}
