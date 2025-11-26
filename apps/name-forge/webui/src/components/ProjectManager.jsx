import { useState } from 'react';

/**
 * ProjectManager component
 *
 * Handles project selection, creation, export, and import.
 * Replaces the old MetaDomainManager with local storage support.
 */
function ProjectManager({
  projects,
  currentProject,
  loading,
  error,
  storageAvailable,
  onCreateProject,
  onLoadProject,
  onDeleteProject,
  onExportProject,
  onImportProject,
  onClearError
}) {
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);

  const handleCreate = async () => {
    if (!newProjectName.trim()) return;

    try {
      await onCreateProject(newProjectName.trim());
      setNewProjectName('');
      setShowNewDialog(false);
    } catch (err) {
      // Error handled by hook
    }
  };

  const handleDelete = async (id) => {
    try {
      await onDeleteProject(id);
      setShowDeleteConfirm(null);
    } catch (err) {
      // Error handled by hook
    }
  };

  const handleImport = async () => {
    try {
      await onImportProject();
    } catch (err) {
      // Error handled by hook
    }
  };

  return (
    <div className="project-manager">
      <h3>Projects</h3>

      {!storageAvailable && (
        <div className="warning" style={{ marginBottom: '1rem' }}>
          Browser storage unavailable. Projects won't persist.
        </div>
      )}

      {error && (
        <div className="error" style={{ marginBottom: '1rem' }}>
          {error}
          <button
            onClick={onClearError}
            style={{ marginLeft: '0.5rem', padding: '0.25rem 0.5rem' }}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Current Project */}
      {currentProject && (
        <div style={{
          background: 'rgba(212, 175, 55, 0.15)',
          border: '1px solid var(--gold-accent)',
          borderRadius: '6px',
          padding: '0.75rem',
          marginBottom: '1rem'
        }}>
          <div style={{ fontWeight: 'bold', color: 'var(--gold-accent)' }}>
            {currentProject.name}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--arctic-frost)', marginTop: '0.25rem' }}>
            {Object.keys(currentProject.cultures || {}).length} cultures
            {' • '}
            Updated {new Date(currentProject.updatedAt).toLocaleDateString()}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
            <button
              className="secondary"
              style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
              onClick={() => onExportProject()}
              title="Download project as JSON"
            >
              Export
            </button>
            <button
              className="danger"
              style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
              onClick={() => setShowDeleteConfirm(currentProject.id)}
              title="Delete this project"
            >
              Delete
            </button>
          </div>
        </div>
      )}

      {/* Project List */}
      {projects.length > 0 && (
        <div style={{ marginBottom: '1rem' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--arctic-frost)', marginBottom: '0.5rem' }}>
            Switch Project:
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            {projects
              .filter(p => p.id !== currentProject?.id)
              .slice(0, 5)
              .map(project => (
                <div
                  key={project.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '0.5rem',
                    background: 'rgba(30, 58, 95, 0.3)',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                  onClick={() => onLoadProject(project.id)}
                >
                  <span style={{ fontSize: '0.85rem' }}>{project.name}</span>
                  <button
                    className="danger"
                    style={{ fontSize: '0.7rem', padding: '0.15rem 0.4rem' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowDeleteConfirm(project.id);
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <button className="primary" onClick={() => setShowNewDialog(true)}>
          + New Project
        </button>
        <button className="secondary" onClick={handleImport}>
          Import Project
        </button>
      </div>

      {/* New Project Dialog */}
      {showNewDialog && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }} onClick={() => setShowNewDialog(false)}>
          <div style={{
            background: 'var(--arctic-dark)',
            borderRadius: '8px',
            padding: '1.5rem',
            minWidth: '300px',
            border: '2px solid var(--arctic-ice)'
          }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 1rem 0' }}>New Project</h3>
            <div className="form-group">
              <label>Project Name</label>
              <input
                type="text"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder="My Fantasy World"
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
              <button className="primary" onClick={handleCreate}>
                Create
              </button>
              <button className="secondary" onClick={() => setShowNewDialog(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }} onClick={() => setShowDeleteConfirm(null)}>
          <div style={{
            background: 'var(--arctic-dark)',
            borderRadius: '8px',
            padding: '1.5rem',
            minWidth: '300px',
            border: '2px solid rgba(239, 68, 68, 0.5)'
          }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 1rem 0', color: 'var(--error-color)' }}>Delete Project?</h3>
            <p>This action cannot be undone. The project will be permanently deleted.</p>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
              <button className="danger" onClick={() => handleDelete(showDeleteConfirm)}>
                Delete
              </button>
              <button className="secondary" onClick={() => setShowDeleteConfirm(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ProjectManager;
