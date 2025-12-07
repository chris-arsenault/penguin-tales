/**
 * RelationshipsTab - Configure relationships between entities
 */

import React, { useState, useMemo } from 'react';
import { ReferenceDropdown } from '../../shared';

/**
 * Safely display a value that should be a string.
 * If it's an object, log a warning and return a fallback.
 */
function safeDisplay(value, fallback = '?', label = 'value') {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'object') {
    console.warn(`[RelationshipsTab] Expected string for ${label} but got object:`, value);
    return `[object]`;
  }
  return String(value);
}

// ============================================================================
// RelationshipCard - Individual relationship editor card
// ============================================================================

function RelationshipCard({ rel, onChange, onRemove, schema, availableRefs }) {
  const [expanded, setExpanded] = useState(false);
  const [hovering, setHovering] = useState(false);

  const relationshipKindOptions = (schema?.relationshipKinds || []).map((rk) => ({
    value: rk.kind,
    label: rk.description || rk.kind,
  }));

  const updateField = (field, value) => {
    onChange({ ...rel, [field]: value });
  };

  return (
    <div className="item-card">
      <div
        className={`item-card-header ${hovering ? 'item-card-header-hover' : ''}`}
        onClick={() => setExpanded(!expanded)}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
      >
        <div className="rel-visual">
          <span className="rel-ref">{safeDisplay(rel.src, '?', 'src')}</span>
          <span className="rel-arrow">→</span>
          <span className="rel-kind">{safeDisplay(rel.kind, '?', 'kind')}</span>
          <span className="rel-arrow">→</span>
          <span className="rel-ref">{safeDisplay(rel.dst, '?', 'dst')}</span>
          {rel.bidirectional && <span className="rel-bidirectional">↔</span>}
        </div>
        <div className="item-card-actions">
          <button className="btn-icon">{expanded ? '▲' : '▼'}</button>
          <button className="btn-icon btn-icon-danger" onClick={(e) => { e.stopPropagation(); onRemove(); }}>×</button>
        </div>
      </div>

      {expanded && (
        <div className="item-card-body">
          <div className="form-grid">
            <ReferenceDropdown
              label="Relationship Kind"
              value={rel.kind}
              onChange={(v) => updateField('kind', v)}
              options={relationshipKindOptions}
            />
            <ReferenceDropdown
              label="Source"
              value={rel.src}
              onChange={(v) => updateField('src', v)}
              options={availableRefs.map((r) => ({ value: r, label: r }))}
            />
            <ReferenceDropdown
              label="Destination"
              value={rel.dst}
              onChange={(v) => updateField('dst', v)}
              options={availableRefs.map((r) => ({ value: r, label: r }))}
            />
            <div className="form-group">
              <label className="label">Strength</label>
              <input
                type="number"
                value={rel.strength ?? ''}
                onChange={(e) => updateField('strength', parseFloat(e.target.value) || undefined)}
                className="input"
                step="0.1"
                min="0"
                max="1"
                placeholder="0.8"
              />
            </div>
          </div>

          <div style={{ marginTop: '16px' }}>
            <label className="label">Bidirectional</label>
            <div className="toggle-container">
              <div
                onClick={() => updateField('bidirectional', !rel.bidirectional)}
                className={`toggle ${rel.bidirectional ? 'toggle-on' : ''}`}
              >
                <div className={`toggle-knob ${rel.bidirectional ? 'toggle-knob-on' : ''}`} />
              </div>
              <span className="toggle-label">
                {rel.bidirectional ? 'Creates relationships in both directions' : 'One-way relationship'}
              </span>
            </div>
          </div>

          {/* Condition - show as JSON */}
          {rel.condition && (
            <div style={{ marginTop: '16px' }}>
              <label className="label">Condition (JSON)</label>
              <textarea
                value={JSON.stringify(rel.condition, null, 2)}
                onChange={(e) => { try { updateField('condition', JSON.parse(e.target.value)); } catch { /* Ignore parse errors */ } }}
                className="textarea"
                style={{ minHeight: '60px' }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// RelationshipsTab - Main tab component
// ============================================================================

/**
 * @param {Object} props
 * @param {Object} props.generator - The generator being edited
 * @param {Function} props.onChange - Callback when generator changes
 * @param {Object} props.schema - Domain schema
 */
export function RelationshipsTab({ generator, onChange, schema }) {
  const relationships = generator.relationships || [];

  const availableRefs = useMemo(() => {
    const refs = ['$target'];
    Object.keys(generator.variables || {}).forEach((v) => refs.push(v));
    (generator.creation || []).forEach((c) => { if (c.entityRef) refs.push(c.entityRef); });
    return refs;
  }, [generator.variables, generator.creation]);

  const handleAdd = () => {
    onChange({
      ...generator,
      relationships: [...relationships, {
        kind: schema?.relationshipKinds?.[0]?.kind || 'ally_of',
        src: availableRefs[1] || '$entity1',
        dst: '$target',
        strength: 0.8,
      }],
    });
  };

  return (
    <div>
      <div className="section">
        <div className="section-title">Relationships</div>
        <div className="section-desc">
          Define relationships created between entities. Use entity references like <code className="inline-code">$target</code>,
          created entities like <code className="inline-code">$hero</code>, or variables like <code className="inline-code">$faction</code>.
        </div>

        {relationships.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🔗</div>
            <div className="empty-state-title">No relationships</div>
            <div className="empty-state-desc">
              This generator doesn't create any relationships. Add relationships to connect entities.
            </div>
          </div>
        ) : (
          relationships.map((rel, index) => (
            <RelationshipCard
              key={index}
              rel={rel}
              onChange={(updated) => {
                const newRels = [...relationships];
                newRels[index] = updated;
                onChange({ ...generator, relationships: newRels });
              }}
              onRemove={() => onChange({ ...generator, relationships: relationships.filter((_, i) => i !== index) })}
              schema={schema}
              availableRefs={availableRefs}
            />
          ))
        )}

        <button
          className="btn-add"
          onClick={handleAdd}
        >
          + Add Relationship
        </button>
      </div>
    </div>
  );
}

export default RelationshipsTab;
