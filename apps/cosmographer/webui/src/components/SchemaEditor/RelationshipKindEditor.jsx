/**
 * RelationshipKindEditor - Define relationship types with constraints.
 */

import React, { useState } from 'react';

const styles = {
  container: {
    marginBottom: '24px'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px'
  },
  title: {
    fontSize: '16px',
    fontWeight: 600
  },
  addButton: {
    padding: '6px 12px',
    fontSize: '12px',
    backgroundColor: '#e94560',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer'
  },
  relList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  relCard: {
    backgroundColor: '#16213e',
    borderRadius: '8px',
    padding: '16px',
    border: '1px solid #0f3460'
  },
  relHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px'
  },
  input: {
    padding: '6px 10px',
    fontSize: '14px',
    backgroundColor: '#1a1a2e',
    border: '1px solid #0f3460',
    borderRadius: '4px',
    color: '#eee',
    width: '180px'
  },
  inputWide: {
    width: '100%',
    marginTop: '8px'
  },
  deleteButton: {
    padding: '4px 8px',
    fontSize: '11px',
    backgroundColor: 'transparent',
    color: '#e94560',
    border: '1px solid #e94560',
    borderRadius: '3px',
    cursor: 'pointer'
  },
  row: {
    display: 'flex',
    gap: '16px',
    marginTop: '12px',
    alignItems: 'flex-start'
  },
  field: {
    flex: 1
  },
  label: {
    fontSize: '12px',
    color: '#888',
    marginBottom: '4px'
  },
  select: {
    padding: '6px 10px',
    fontSize: '13px',
    backgroundColor: '#1a1a2e',
    border: '1px solid #0f3460',
    borderRadius: '4px',
    color: '#eee',
    width: '100%'
  },
  checkbox: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginTop: '12px',
    fontSize: '13px',
    color: '#aaa'
  },
  emptyState: {
    color: '#666',
    fontSize: '13px',
    textAlign: 'center',
    padding: '20px'
  },
  kindTag: {
    display: 'inline-block',
    padding: '2px 6px',
    backgroundColor: '#0f3460',
    borderRadius: '3px',
    fontSize: '11px',
    marginRight: '4px',
    marginBottom: '4px'
  }
};

function generateId(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

export default function RelationshipKindEditor({ relationshipKinds = [], entityKinds = [], onChange }) {
  const addRelationship = () => {
    const newRel = {
      id: `rel_${Date.now()}`,
      name: 'New Relationship',
      description: '',
      srcKinds: [],
      dstKinds: [],
      symmetric: false
    };
    onChange([...relationshipKinds, newRel]);
  };

  const updateRel = (relId, updates) => {
    onChange(relationshipKinds.map(r =>
      r.id === relId ? { ...r, ...updates } : r
    ));
  };

  const deleteRel = (relId) => {
    onChange(relationshipKinds.filter(r => r.id !== relId));
  };

  const toggleKind = (relId, field, kindId) => {
    const rel = relationshipKinds.find(r => r.id === relId);
    if (!rel) return;

    const current = rel[field] || [];
    const updated = current.includes(kindId)
      ? current.filter(k => k !== kindId)
      : [...current, kindId];

    updateRel(relId, { [field]: updated });
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.title}>Relationship Kinds</div>
        <button style={styles.addButton} onClick={addRelationship}>
          + Add Relationship
        </button>
      </div>

      {relationshipKinds.length === 0 ? (
        <div style={styles.emptyState}>
          No relationship kinds defined. Add one to connect entities.
        </div>
      ) : (
        <div style={styles.relList}>
          {relationshipKinds.map((rel) => (
            <div key={rel.id} style={styles.relCard}>
              <div style={styles.relHeader}>
                <input
                  style={styles.input}
                  value={rel.name}
                  onChange={(e) => updateRel(rel.id, {
                    name: e.target.value,
                    id: generateId(e.target.value) || rel.id
                  })}
                  placeholder="Relationship name"
                />
                <span style={{ color: '#666', fontSize: '12px', marginLeft: '8px' }}>
                  ({rel.id})
                </span>
                <button
                  style={{ ...styles.deleteButton, marginLeft: 'auto' }}
                  onClick={() => deleteRel(rel.id)}
                >
                  Delete
                </button>
              </div>

              <input
                style={{ ...styles.input, ...styles.inputWide }}
                value={rel.description || ''}
                onChange={(e) => updateRel(rel.id, { description: e.target.value })}
                placeholder="Description (optional)"
              />

              <div style={styles.row}>
                <div style={styles.field}>
                  <div style={styles.label}>
                    Source Kinds {rel.srcKinds?.length === 0 && '(any)'}
                  </div>
                  <div>
                    {entityKinds.map((kind) => (
                      <span
                        key={kind.id}
                        style={{
                          ...styles.kindTag,
                          backgroundColor: rel.srcKinds?.includes(kind.id) ? '#e94560' : '#0f3460',
                          cursor: 'pointer'
                        }}
                        onClick={() => toggleKind(rel.id, 'srcKinds', kind.id)}
                      >
                        {kind.name}
                      </span>
                    ))}
                    {entityKinds.length === 0 && (
                      <span style={{ color: '#666', fontSize: '12px' }}>Define entity kinds first</span>
                    )}
                  </div>
                </div>

                <div style={{ fontSize: '20px', color: '#666', alignSelf: 'center' }}>→</div>

                <div style={styles.field}>
                  <div style={styles.label}>
                    Destination Kinds {rel.dstKinds?.length === 0 && '(any)'}
                  </div>
                  <div>
                    {entityKinds.map((kind) => (
                      <span
                        key={kind.id}
                        style={{
                          ...styles.kindTag,
                          backgroundColor: rel.dstKinds?.includes(kind.id) ? '#e94560' : '#0f3460',
                          cursor: 'pointer'
                        }}
                        onClick={() => toggleKind(rel.id, 'dstKinds', kind.id)}
                      >
                        {kind.name}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <label style={styles.checkbox}>
                <input
                  type="checkbox"
                  checked={rel.symmetric || false}
                  onChange={(e) => updateRel(rel.id, { symmetric: e.target.checked })}
                />
                Symmetric (A→B implies B→A)
              </label>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
