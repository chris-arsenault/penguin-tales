/**
 * ProjectManager - Header bar with project dropdown
 */

import React, { useState, useRef, useEffect } from 'react';
import { colors, typography, spacing, radius, shadows } from '../theme';

const styles = {
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: `${spacing.md} ${spacing.lg}`,
    backgroundColor: colors.bgSidebar,
    borderBottom: `1px solid ${colors.border}`,
    flexShrink: 0,
  },
  left: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing.lg,
  },
  logo: {
    fontSize: typography.sizeXxl,
    fontWeight: typography.weightBold,
    fontFamily: typography.fontFamily,
    color: colors.accentEnumerist,
    letterSpacing: '-0.5px',
    cursor: 'pointer',
    transition: 'opacity 0.15s',
  },
  projectSelector: {
    position: 'relative',
  },
  projectButton: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing.sm,
    padding: `${spacing.sm} ${spacing.md}`,
    backgroundColor: colors.bgSecondary,
    border: `1px solid ${colors.border}`,
    borderRadius: radius.sm,
    color: colors.textPrimary,
    fontSize: typography.sizeLg,
    fontFamily: typography.fontFamily,
    cursor: 'pointer',
    minWidth: '200px',
    justifyContent: 'space-between',
  },
  projectName: {
    fontWeight: typography.weightMedium,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  chevron: {
    fontSize: typography.sizeXs,
    color: colors.textMuted,
  },
  dropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    marginTop: spacing.xs,
    backgroundColor: colors.bgSecondary,
    border: `1px solid ${colors.border}`,
    borderRadius: radius.lg,
    minWidth: '320px',
    maxHeight: '400px',
    overflowY: 'auto',
    zIndex: 1000,
    boxShadow: shadows.lg,
  },
  dropdownHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderBottom: `1px solid ${colors.border}`,
  },
  dropdownTitle: {
    fontSize: typography.sizeSm,
    fontWeight: typography.weightSemibold,
    fontFamily: typography.fontFamily,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  dropdownActions: {
    display: 'flex',
    gap: spacing.sm,
  },
  smallButton: {
    padding: `${spacing.xs} ${spacing.sm}`,
    fontSize: typography.sizeXs,
    fontFamily: typography.fontFamily,
    border: 'none',
    borderRadius: radius.sm,
    cursor: 'pointer',
    backgroundColor: colors.bgTertiary,
    color: colors.textSecondary,
  },
  smallButtonPrimary: {
    backgroundColor: colors.buttonPrimary,
    color: 'white',
  },
  projectList: {
    padding: spacing.sm,
  },
  projectItem: {
    padding: `${spacing.md} ${spacing.md}`,
    borderRadius: radius.sm,
    cursor: 'pointer',
    marginBottom: spacing.xs,
    backgroundColor: 'transparent',
    transition: 'background-color 0.15s',
  },
  projectItemActive: {
    backgroundColor: colors.bgTertiary,
  },
  projectItemHover: {
    backgroundColor: colors.bgPrimary,
  },
  projectItemName: {
    fontSize: typography.sizeLg,
    fontWeight: typography.weightMedium,
    fontFamily: typography.fontFamily,
    color: colors.textPrimary,
    marginBottom: '2px',
  },
  projectItemMeta: {
    fontSize: typography.sizeXs,
    fontFamily: typography.fontFamily,
    color: colors.textMuted,
    display: 'flex',
    gap: spacing.md,
  },
  projectItemActions: {
    display: 'flex',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  tinyButton: {
    padding: `2px ${spacing.sm}`,
    fontSize: typography.sizeXs,
    fontFamily: typography.fontFamily,
    border: 'none',
    borderRadius: '2px',
    cursor: 'pointer',
    backgroundColor: colors.bgSidebar,
    color: colors.textMuted,
  },
  emptyState: {
    padding: spacing.xl,
    textAlign: 'center',
    color: colors.textMuted,
    fontSize: typography.sizeMd,
    fontFamily: typography.fontFamily,
  },
  right: {
    display: 'flex',
    gap: spacing.sm,
  },
  button: {
    padding: `${spacing.sm} ${spacing.lg}`,
    fontSize: typography.sizeMd,
    fontWeight: typography.weightMedium,
    fontFamily: typography.fontFamily,
    border: 'none',
    borderRadius: radius.sm,
    cursor: 'pointer',
    transition: 'background-color 0.15s',
  },
  buttonPrimary: {
    backgroundColor: colors.buttonPrimary,
    color: 'white',
  },
  buttonSecondary: {
    backgroundColor: colors.bgSecondary,
    border: `1px solid ${colors.border}`,
    color: colors.textSecondary,
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
    backgroundColor: 'rgba(0,0,0,0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modalContent: {
    backgroundColor: colors.bgSecondary,
    padding: spacing.xxl,
    borderRadius: radius.lg,
    width: '400px',
    border: `1px solid ${colors.border}`,
  },
  modalTitle: {
    fontSize: typography.sizeXl,
    fontWeight: typography.weightSemibold,
    fontFamily: typography.fontFamily,
    marginBottom: spacing.lg,
    color: colors.textPrimary,
  },
  input: {
    width: '100%',
    padding: spacing.md,
    fontSize: typography.sizeLg,
    fontFamily: typography.fontFamily,
    backgroundColor: colors.bgTertiary,
    border: `1px solid ${colors.border}`,
    borderRadius: radius.sm,
    color: colors.textPrimary,
    marginBottom: spacing.lg,
    boxSizing: 'border-box',
  },
  modalActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: spacing.sm,
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
  onGoHome,
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

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      // Check file type - support both zip and legacy JSON
      if (file.name.endsWith('.zip') || file.type === 'application/zip') {
        // Import as zip file
        await onImportProject(file);
      } else {
        // Legacy JSON import
        const text = await file.text();
        await onImportProject(text);
      }
      setShowDropdown(false);
    } catch (err) {
      alert('Failed to import: ' + err.message);
    }
    e.target.value = '';
  };

  const handleExport = async () => {
    try {
      const zipBlob = await onExportProject();
      if (!zipBlob) return;

      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${currentProject?.name || 'world'}.canonry.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Failed to export: ' + err.message);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  return (
    <header style={styles.header}>
      <div style={styles.left}>
        <div
          style={styles.logo}
          onClick={onGoHome}
          onMouseEnter={(e) => (e.target.style.opacity = '0.8')}
          onMouseLeave={(e) => (e.target.style.opacity = '1')}
          title="Go to home"
        >
          The Canonry
        </div>

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
                          style={{ ...styles.tinyButton, color: colors.danger }}
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
          accept=".zip,.json"
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
