/**
 * DomainContextEditor - Configure world lore context for LLM prompts
 *
 * Allows users to define:
 * - World identity (name, description, canon facts)
 * - Cultural notes per culture
 * - Relationship and conflict patterns
 * - Technology and magic notes
 * - Geography constraints
 * - Custom prompt hints per entity/relationship kind
 */

import { useState, useCallback } from 'react';

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

export default function DomainContextEditor({
  domainContext,
  onDomainContextChange,
  worldSchema,
}) {
  const [expandedCulture, setExpandedCulture] = useState(null);

  const updateField = useCallback(
    (field, value) => {
      onDomainContextChange({ [field]: value });
    },
    [onDomainContextChange]
  );

  const updateCultureNote = useCallback(
    (cultureId, field, value) => {
      const notes = { ...domainContext.cultureNotes };
      notes[cultureId] = { ...(notes[cultureId] || {}), [field]: value };
      onDomainContextChange({ cultureNotes: notes });
    },
    [domainContext.cultureNotes, onDomainContextChange]
  );

  const cultures = worldSchema?.cultures || [];

  return (
    <div>
      {/* World Identity */}
      <div className="illuminator-card">
        <div className="illuminator-card-header">
          <h2 className="illuminator-card-title">World Identity</h2>
        </div>

        <div className="illuminator-form-group">
          <label className="illuminator-label">World Name</label>
          <input
            type="text"
            value={domainContext.worldName}
            onChange={(e) => updateField('worldName', e.target.value)}
            placeholder="e.g., The Frozen Realms of Aurora Berg"
            className="illuminator-input"
          />
        </div>

        <div className="illuminator-form-group">
          <label className="illuminator-label">World Description</label>
          <textarea
            value={domainContext.worldDescription}
            onChange={(e) => updateField('worldDescription', e.target.value)}
            placeholder="Brief description of your world's setting and tone..."
            className="illuminator-input"
            style={{ minHeight: '80px', resize: 'vertical' }}
          />
        </div>

        <div className="illuminator-form-group">
          <label className="illuminator-label">Canon Facts</label>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px' }}>
            Facts that must not be contradicted in generated content
          </p>
          <EditableList
            items={domainContext.canonFacts}
            onChange={(items) => updateField('canonFacts', items)}
            placeholder="Add a canon fact..."
          />
        </div>
      </div>

      {/* Cultural Notes */}
      {cultures.length > 0 && (
        <div className="illuminator-card">
          <div className="illuminator-card-header">
            <h2 className="illuminator-card-title">Cultural Notes</h2>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>
            Define naming style and values for each culture to guide LLM output
          </p>

          {cultures.map((culture) => {
            const notes = domainContext.cultureNotes[culture.id] || {};
            const isExpanded = expandedCulture === culture.id;

            return (
              <div
                key={culture.id}
                style={{
                  marginBottom: '8px',
                  border: '1px solid var(--border-color)',
                  borderRadius: '4px',
                }}
              >
                <button
                  onClick={() => setExpandedCulture(isExpanded ? null : culture.id)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 12px',
                    background: 'var(--bg-tertiary)',
                    border: 'none',
                    borderRadius: isExpanded ? '4px 4px 0 0' : '4px',
                    color: 'var(--text-color)',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <span style={{ color: culture.color || 'var(--text-muted)' }}>●</span>
                  <span style={{ flex: 1, fontWeight: 500 }}>{culture.name}</span>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    {isExpanded ? '▼' : '▶'}
                  </span>
                </button>

                {isExpanded && (
                  <div style={{ padding: '12px' }}>
                    <div className="illuminator-form-group">
                      <label className="illuminator-label">Naming Style</label>
                      <input
                        type="text"
                        value={notes.namingStyle || ''}
                        onChange={(e) => updateCultureNote(culture.id, 'namingStyle', e.target.value)}
                        placeholder="e.g., practical, trade-focused, concise"
                        className="illuminator-input"
                      />
                    </div>

                    <div className="illuminator-form-group">
                      <label className="illuminator-label">Core Values</label>
                      <EditableList
                        items={notes.values || []}
                        onChange={(items) => updateCultureNote(culture.id, 'values', items)}
                        placeholder="Add a value..."
                      />
                    </div>

                    <div className="illuminator-form-group">
                      <label className="illuminator-label">Visual/Descriptive Style</label>
                      <textarea
                        value={notes.styleNotes || ''}
                        onChange={(e) => updateCultureNote(culture.id, 'styleNotes', e.target.value)}
                        placeholder="Describe the visual style for this culture..."
                        className="illuminator-input"
                        style={{ minHeight: '60px', resize: 'vertical' }}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Patterns */}
      <div className="illuminator-card">
        <div className="illuminator-card-header">
          <h2 className="illuminator-card-title">World Patterns</h2>
        </div>

        <div className="illuminator-form-group">
          <label className="illuminator-label">Relationship Patterns</label>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px' }}>
            How relationships typically form in your world
          </p>
          <EditableList
            items={domainContext.relationshipPatterns}
            onChange={(items) => updateField('relationshipPatterns', items)}
            placeholder="e.g., Cross-colony relationships are rare but significant"
          />
        </div>

        <div className="illuminator-form-group">
          <label className="illuminator-label">Conflict Patterns</label>
          <EditableList
            items={domainContext.conflictPatterns}
            onChange={(items) => updateField('conflictPatterns', items)}
            placeholder="e.g., Wars are fought over fishing rights and territory"
          />
        </div>
      </div>

      {/* World Mechanics */}
      <div className="illuminator-card">
        <div className="illuminator-card-header">
          <h2 className="illuminator-card-title">World Mechanics</h2>
        </div>

        <div className="illuminator-form-group">
          <label className="illuminator-label">Technology Notes</label>
          <EditableList
            items={domainContext.technologyNotes}
            onChange={(items) => updateField('technologyNotes', items)}
            placeholder="e.g., Technology is communal and reliable"
          />
        </div>

        <div className="illuminator-form-group">
          <label className="illuminator-label">Magic Notes</label>
          <EditableList
            items={domainContext.magicNotes}
            onChange={(items) => updateField('magicNotes', items)}
            placeholder="e.g., Magic has costs and requires meditation"
          />
        </div>
      </div>

      {/* Geography */}
      <div className="illuminator-card">
        <div className="illuminator-card-header">
          <h2 className="illuminator-card-title">Geography</h2>
        </div>

        <div className="illuminator-form-group">
          <label className="illuminator-label">Scale</label>
          <input
            type="text"
            value={domainContext.geographyScale}
            onChange={(e) => updateField('geographyScale', e.target.value)}
            placeholder="e.g., 10 sq km of surface area"
            className="illuminator-input"
          />
        </div>

        <div className="illuminator-form-group">
          <label className="illuminator-label">Geographic Traits</label>
          <EditableList
            items={domainContext.geographyTraits}
            onChange={(items) => updateField('geographyTraits', items)}
            placeholder="e.g., vertical depth matters"
          />
        </div>
      </div>
    </div>
  );
}
