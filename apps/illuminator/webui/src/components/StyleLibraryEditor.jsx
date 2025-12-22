/**
 * StyleLibraryEditor - Manage artistic and composition styles
 *
 * Allows users to:
 * - View all styles in the library
 * - Add new artistic/composition styles
 * - Edit existing styles
 * - Delete styles
 * - Reset to defaults
 */

import { useState, useCallback } from 'react';

/**
 * Generate a unique ID for a new style
 */
function generateStyleId(prefix) {
  return `${prefix}-${Date.now().toString(36)}`;
}

/**
 * Style card component for displaying a single style
 */
function StyleCard({ style, type, onEdit, onDelete }) {
  return (
    <div className="illuminator-style-card">
      <div className="illuminator-style-card-header">
        <div className="illuminator-style-card-title">{style.name}</div>
        <div className="illuminator-style-card-actions">
          <button
            onClick={() => onEdit(style)}
            className="illuminator-btn-icon"
            title="Edit style"
          >
            Edit
          </button>
          <button
            onClick={() => onDelete(style.id)}
            className="illuminator-btn-icon illuminator-btn-danger"
            title="Delete style"
          >
            Delete
          </button>
        </div>
      </div>
      {style.description && (
        <div className="illuminator-style-card-description">{style.description}</div>
      )}
      <div className="illuminator-style-card-prompt">
        <strong>Prompt:</strong> {style.promptFragment}
      </div>
      {style.keywords?.length > 0 && (
        <div className="illuminator-style-card-keywords">
          {style.keywords.map((kw) => (
            <span key={kw} className="illuminator-style-keyword">{kw}</span>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Modal for editing a style
 */
function StyleEditModal({ style, type, onSave, onCancel }) {
  const [formData, setFormData] = useState({
    id: style?.id || '',
    name: style?.name || '',
    description: style?.description || '',
    promptFragment: style?.promptFragment || '',
    keywords: style?.keywords?.join(', ') || '',
  });

  const isNew = !style?.id;

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    const result = {
      id: isNew ? generateStyleId(type) : formData.id,
      name: formData.name.trim(),
      promptFragment: formData.promptFragment.trim(),
    };

    if (formData.description.trim()) {
      result.description = formData.description.trim();
    }

    if (type === 'artistic' && formData.keywords.trim()) {
      result.keywords = formData.keywords.split(',').map((k) => k.trim()).filter(Boolean);
    }

    onSave(result, isNew);
  };

  const isValid = formData.name.trim() && formData.promptFragment.trim();

  return (
    <div className="illuminator-modal-overlay" onClick={onCancel}>
      <div className="illuminator-modal" onClick={(e) => e.stopPropagation()}>
        <div className="illuminator-modal-header">
          <h3>{isNew ? 'Add' : 'Edit'} {type === 'artistic' ? 'Artistic' : 'Composition'} Style</h3>
          <button onClick={onCancel} className="illuminator-modal-close">&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="illuminator-modal-body">
          <div className="illuminator-form-group">
            <label className="illuminator-label">Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              className="illuminator-input"
              placeholder="e.g., Oil Painting"
              autoFocus
            />
          </div>

          <div className="illuminator-form-group">
            <label className="illuminator-label">Description</label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              className="illuminator-input"
              placeholder="Brief description of the style"
            />
          </div>

          <div className="illuminator-form-group">
            <label className="illuminator-label">Prompt Fragment *</label>
            <textarea
              value={formData.promptFragment}
              onChange={(e) => handleChange('promptFragment', e.target.value)}
              className="illuminator-textarea"
              rows={3}
              placeholder="e.g., oil painting style, rich textures, visible brushstrokes"
            />
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
              This text will be injected into the image generation prompt.
            </p>
          </div>

          {type === 'artistic' && (
            <div className="illuminator-form-group">
              <label className="illuminator-label">Keywords</label>
              <input
                type="text"
                value={formData.keywords}
                onChange={(e) => handleChange('keywords', e.target.value)}
                className="illuminator-input"
                placeholder="e.g., traditional, classical, painterly"
              />
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Comma-separated keywords for categorization.
              </p>
            </div>
          )}

          <div className="illuminator-modal-footer">
            <button type="button" onClick={onCancel} className="illuminator-btn">
              Cancel
            </button>
            <button type="submit" disabled={!isValid} className="illuminator-btn illuminator-btn-primary">
              {isNew ? 'Add Style' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/**
 * Main StyleLibraryEditor component
 */
export default function StyleLibraryEditor({
  styleLibrary,
  loading,
  isCustom,
  onAddArtisticStyle,
  onUpdateArtisticStyle,
  onDeleteArtisticStyle,
  onAddCompositionStyle,
  onUpdateCompositionStyle,
  onDeleteCompositionStyle,
  onReset,
}) {
  const [editingStyle, setEditingStyle] = useState(null);
  const [editingType, setEditingType] = useState(null);
  const [confirmReset, setConfirmReset] = useState(false);

  const handleEditArtistic = useCallback((style) => {
    setEditingStyle(style);
    setEditingType('artistic');
  }, []);

  const handleEditComposition = useCallback((style) => {
    setEditingStyle(style);
    setEditingType('composition');
  }, []);

  const handleAddArtistic = useCallback(() => {
    setEditingStyle({});
    setEditingType('artistic');
  }, []);

  const handleAddComposition = useCallback(() => {
    setEditingStyle({});
    setEditingType('composition');
  }, []);

  const handleSaveStyle = useCallback(async (styleData, isNew) => {
    if (editingType === 'artistic') {
      if (isNew) {
        await onAddArtisticStyle(styleData);
      } else {
        await onUpdateArtisticStyle(styleData.id, styleData);
      }
    } else {
      if (isNew) {
        await onAddCompositionStyle(styleData);
      } else {
        await onUpdateCompositionStyle(styleData.id, styleData);
      }
    }
    setEditingStyle(null);
    setEditingType(null);
  }, [editingType, onAddArtisticStyle, onUpdateArtisticStyle, onAddCompositionStyle, onUpdateCompositionStyle]);

  const handleDeleteArtistic = useCallback(async (id) => {
    if (window.confirm('Delete this artistic style?')) {
      await onDeleteArtisticStyle(id);
    }
  }, [onDeleteArtisticStyle]);

  const handleDeleteComposition = useCallback(async (id) => {
    if (window.confirm('Delete this composition style?')) {
      await onDeleteCompositionStyle(id);
    }
  }, [onDeleteCompositionStyle]);

  const handleReset = useCallback(async () => {
    await onReset();
    setConfirmReset(false);
  }, [onReset]);

  const handleCloseModal = useCallback(() => {
    setEditingStyle(null);
    setEditingType(null);
  }, []);

  if (loading) {
    return (
      <div className="illuminator-card">
        <p style={{ color: 'var(--text-muted)', textAlign: 'center' }}>Loading style library...</p>
      </div>
    );
  }

  return (
    <div>
      {/* Status bar */}
      <div className="illuminator-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ fontWeight: 500 }}>Style Library</span>
            <span style={{ marginLeft: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>
              {isCustom ? '(customized)' : '(defaults)'}
            </span>
          </div>
          <div>
            {isCustom && !confirmReset && (
              <button
                onClick={() => setConfirmReset(true)}
                className="illuminator-btn"
                style={{ fontSize: '12px' }}
              >
                Reset to Defaults
              </button>
            )}
            {confirmReset && (
              <span style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Reset all styles?</span>
                <button onClick={handleReset} className="illuminator-btn illuminator-btn-danger" style={{ fontSize: '12px' }}>
                  Yes, Reset
                </button>
                <button onClick={() => setConfirmReset(false)} className="illuminator-btn" style={{ fontSize: '12px' }}>
                  Cancel
                </button>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Artistic Styles */}
      <div className="illuminator-card">
        <div className="illuminator-card-header">
          <h2 className="illuminator-card-title">
            Artistic Styles
            <span style={{ fontWeight: 400, fontSize: '14px', color: 'var(--text-muted)', marginLeft: '8px' }}>
              ({styleLibrary.artisticStyles.length})
            </span>
          </h2>
          <button onClick={handleAddArtistic} className="illuminator-btn illuminator-btn-primary" style={{ fontSize: '12px' }}>
            + Add Style
          </button>
        </div>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>
          Artistic styles define the visual rendering approach (e.g., oil painting, watercolor, digital art).
        </p>

        <div className="illuminator-style-grid">
          {styleLibrary.artisticStyles.map((style) => (
            <StyleCard
              key={style.id}
              style={style}
              type="artistic"
              onEdit={handleEditArtistic}
              onDelete={handleDeleteArtistic}
            />
          ))}
        </div>

        {styleLibrary.artisticStyles.length === 0 && (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>
            No artistic styles defined. Add one to get started.
          </p>
        )}
      </div>

      {/* Composition Styles */}
      <div className="illuminator-card">
        <div className="illuminator-card-header">
          <h2 className="illuminator-card-title">
            Composition Styles
            <span style={{ fontWeight: 400, fontSize: '14px', color: 'var(--text-muted)', marginLeft: '8px' }}>
              ({styleLibrary.compositionStyles.length})
            </span>
          </h2>
          <button onClick={handleAddComposition} className="illuminator-btn illuminator-btn-primary" style={{ fontSize: '12px' }}>
            + Add Style
          </button>
        </div>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>
          Composition styles define framing and visual arrangement (e.g., portrait, establishing shot, action scene).
        </p>

        <div className="illuminator-style-grid">
          {styleLibrary.compositionStyles.map((style) => (
            <StyleCard
              key={style.id}
              style={style}
              type="composition"
              onEdit={handleEditComposition}
              onDelete={handleDeleteComposition}
            />
          ))}
        </div>

        {styleLibrary.compositionStyles.length === 0 && (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>
            No composition styles defined. Add one to get started.
          </p>
        )}
      </div>

      {/* Edit Modal */}
      {editingStyle && editingType && (
        <StyleEditModal
          style={editingStyle}
          type={editingType}
          onSave={handleSaveStyle}
          onCancel={handleCloseModal}
        />
      )}
    </div>
  );
}
