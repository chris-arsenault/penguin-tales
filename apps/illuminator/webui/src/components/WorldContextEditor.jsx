/**
 * WorldContextEditor - Configure world context for LLM prompts
 *
 * Simplified context editor focused on world-level information.
 * Entity-specific context (relationships, cultural peers, etc.) is now
 * built automatically from the actual graph data.
 *
 * Only exposes:
 * - World name and description
 * - Canon facts (things that must not be contradicted)
 * - Tone (optional style guide for generated content)
 */

import { useState, useCallback } from 'react';
import { LocalTextArea } from '@penguin-tales/shared-components';

const DESCRIPTION_TEXTAREA_STYLE = Object.freeze({ minHeight: '100px', resize: 'vertical' });
const TONE_TEXTAREA_STYLE = Object.freeze({ minHeight: '80px', resize: 'vertical' });

function EditableList({ items, onChange, placeholder }) {
  const [newItem, setNewItem] = useState('');

  const handleAdd = () => {
    if (newItem.trim()) {
      onChange([...items, newItem.trim()]);
      setNewItem('');
    }
  };

  const handleRemove = (index) => {
    onChange(items.filter((_, i) => i !== index));
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
        <input
          type="text"
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="illuminator-input"
          style={{ flex: 1 }}
        />
        <button
          onClick={handleAdd}
          className="illuminator-button illuminator-button-secondary"
          disabled={!newItem.trim()}
        >
          Add
        </button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {items.map((item, index) => (
          <div
            key={index}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 10px',
              background: 'var(--bg-tertiary)',
              borderRadius: '4px',
              fontSize: '12px',
            }}
          >
            <span style={{ flex: 1 }}>{item}</span>
            <button
              onClick={() => handleRemove(index)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--danger)',
                cursor: 'pointer',
                padding: '2px 6px',
              }}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function WorldContextEditor({ worldContext, onWorldContextChange }) {
  const updateField = useCallback(
    (field, value) => {
      onWorldContextChange({ [field]: value });
    },
    [onWorldContextChange]
  );

  return (
    <div>
      {/* Info Banner */}
      <div
        style={{
          padding: '12px 16px',
          marginBottom: '16px',
          background: 'var(--bg-tertiary)',
          borderRadius: '6px',
          borderLeft: '3px solid var(--accent-color)',
        }}
      >
        <div style={{ fontWeight: 500, marginBottom: '4px' }}>
          Entity context is built automatically
        </div>
        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
          Relationships, cultural peers, faction members, and entity age are extracted from the
          simulation data. This panel only configures world-level context that applies to all
          entities.
        </div>
      </div>

      {/* World Identity */}
      <div className="illuminator-card">
        <div className="illuminator-card-header">
          <h2 className="illuminator-card-title">World Identity</h2>
        </div>

        <div className="illuminator-form-group">
          <label className="illuminator-label">World Name</label>
          <input
            type="text"
            value={worldContext.name || ''}
            onChange={(e) => updateField('name', e.target.value)}
            placeholder="e.g., The Frozen Realms of Aurora Berg"
            className="illuminator-input"
          />
        </div>

        <div className="illuminator-form-group">
          <label className="illuminator-label">World Description</label>
          <LocalTextArea
            value={worldContext.description || ''}
            onChange={(value) => updateField('description', value)}
            placeholder="Brief description of your world's setting, themes, and what makes it unique..."
            className="illuminator-input"
            style={DESCRIPTION_TEXTAREA_STYLE}
          />
        </div>
      </div>

      {/* Canon Facts */}
      <div className="illuminator-card">
        <div className="illuminator-card-header">
          <h2 className="illuminator-card-title">Canon Facts</h2>
        </div>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>
          Established facts about your world that must not be contradicted in generated content.
          These help ensure consistency across all enriched entities.
        </p>
        <EditableList
          items={worldContext.canonFacts || []}
          onChange={(items) => updateField('canonFacts', items)}
          placeholder="Add a canon fact..."
        />
      </div>

      {/* Tone */}
      <div className="illuminator-card">
        <div className="illuminator-card-header">
          <h2 className="illuminator-card-title">Tone & Style</h2>
        </div>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>
          Optional guidance for the overall tone and style of generated descriptions.
        </p>
        <div className="illuminator-form-group">
          <LocalTextArea
            value={worldContext.tone || ''}
            onChange={(value) => updateField('tone', value)}
            placeholder="e.g., Evocative and mythic, with hints of mystery. Focus on sensory details and emotional weight rather than dry facts..."
            className="illuminator-input"
            style={TONE_TEXTAREA_STYLE}
          />
        </div>
      </div>
    </div>
  );
}
