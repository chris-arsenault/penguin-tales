/**
 * RelationshipKindEditor - Define relationship types with collapsible cards and improved UX.
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
    gap: '8px'
  },
  relCard: {
    backgroundColor: '#16213e',
    borderRadius: '8px',
    border: '1px solid #0f3460',
    overflow: 'hidden'
  },
  relHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 16px',
    cursor: 'pointer'
  },
  relHeaderLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },
  expandIcon: {
    fontSize: '12px',
    color: '#888',
    transition: 'transform 0.2s',
    width: '16px'
  },
  relId: {
    color: '#666',
    fontSize: '11px'
  },
  relSummary: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '11px',
    color: '#666'
  },
  summaryKind: {
    padding: '2px 6px',
    backgroundColor: '#0f3460',
    borderRadius: '3px',
    fontSize: '10px'
  },
  relBody: {
    padding: '16px',
    borderTop: '1px solid #0f3460'
  },
  formRow: {
    display: 'flex',
    gap: '12px',
    marginBottom: '16px',
    alignItems: 'flex-start'
  },
  formGroup: {
    flex: 1
  },
  label: {
    fontSize: '12px',
    color: '#888',
    marginBottom: '6px',
    display: 'block'
  },
  input: {
    width: '100%',
    padding: '8px 10px',
    fontSize: '14px',
    backgroundColor: '#1a1a2e',
    border: '1px solid #0f3460',
    borderRadius: '4px',
    color: '#eee',
    boxSizing: 'border-box'
  },
  textarea: {
    width: '100%',
    padding: '8px 10px',
    fontSize: '13px',
    backgroundColor: '#1a1a2e',
    border: '1px solid #0f3460',
    borderRadius: '4px',
    color: '#eee',
    resize: 'vertical',
    minHeight: '60px',
    boxSizing: 'border-box'
  },
  constraintsSection: {
    backgroundColor: '#1a1a2e',
    borderRadius: '6px',
    padding: '16px',
    marginBottom: '16px'
  },
  constraintsTitle: {
    fontSize: '13px',
    fontWeight: 500,
    color: '#ccc',
    marginBottom: '12px'
  },
  constraintRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px'
  },
  kindBox: {
    flex: 1
  },
  kindBoxLabel: {
    fontSize: '11px',
    color: '#888',
    marginBottom: '8px',
    display: 'flex',
    justifyContent: 'space-between'
  },
  kindGrid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px'
  },
  kindChip: {
    padding: '6px 10px',
    borderRadius: '4px',
    fontSize: '12px',
    cursor: 'pointer',
    transition: 'background-color 0.15s',
    border: '1px solid transparent'
  },
  kindChipActive: {
    backgroundColor: '#e94560',
    color: 'white'
  },
  kindChipInactive: {
    backgroundColor: '#0f3460',
    color: '#aaa',
    border: '1px solid #0f3460'
  },
  arrow: {
    fontSize: '24px',
    color: '#666',
    fontWeight: 300
  },
  optionsRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  checkbox: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '13px',
    color: '#aaa',
    cursor: 'pointer'
  },
  deleteButton: {
    padding: '6px 12px',
    fontSize: '12px',
    backgroundColor: 'transparent',
    color: '#e94560',
    border: '1px solid #e94560',
    borderRadius: '4px',
    cursor: 'pointer'
  },
  emptyState: {
    color: '#666',
    fontSize: '13px',
    textAlign: 'center',
    padding: '20px'
  },
  anyLabel: {
    fontSize: '10px',
    color: '#888',
    fontStyle: 'italic'
  }
};

function generateId(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

export default function RelationshipKindEditor({ relationshipKinds = [], entityKinds = [], onChange }) {
  const [expandedRels, setExpandedRels] = useState({});

  const toggleRel = (relId) => {
    setExpandedRels(prev => ({ ...prev, [relId]: !prev[relId] }));
  };

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
    setExpandedRels(prev => ({ ...prev, [newRel.id]: true }));
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

  const getSummary = (rel) => {
    const srcNames = rel.srcKinds?.length > 0
      ? rel.srcKinds.map(id => entityKinds.find(k => k.id === id)?.name || id).slice(0, 2)
      : ['Any'];
    const dstNames = rel.dstKinds?.length > 0
      ? rel.dstKinds.map(id => entityKinds.find(k => k.id === id)?.name || id).slice(0, 2)
      : ['Any'];

    return { srcNames, dstNames };
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
          {relationshipKinds.map((rel) => {
            const isExpanded = expandedRels[rel.id];
            const { srcNames, dstNames } = getSummary(rel);

            return (
              <div key={rel.id} style={styles.relCard}>
                <div
                  style={styles.relHeader}
                  onClick={() => toggleRel(rel.id)}
                >
                  <div style={styles.relHeaderLeft}>
                    <span style={{
                      ...styles.expandIcon,
                      transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)'
                    }}>
                      ▶
                    </span>
                    <span style={{ fontWeight: 500 }}>{rel.name}</span>
                    <span style={styles.relId}>({rel.id})</span>
                    {rel.symmetric && (
                      <span style={{ fontSize: '11px', color: '#888' }}>↔ symmetric</span>
                    )}
                  </div>
                  <div style={styles.relSummary}>
                    {srcNames.map((name, i) => (
                      <span key={i} style={styles.summaryKind}>{name}</span>
                    ))}
                    {rel.srcKinds?.length > 2 && <span>+{rel.srcKinds.length - 2}</span>}
                    <span style={{ color: '#666' }}>→</span>
                    {dstNames.map((name, i) => (
                      <span key={i} style={styles.summaryKind}>{name}</span>
                    ))}
                    {rel.dstKinds?.length > 2 && <span>+{rel.dstKinds.length - 2}</span>}
                  </div>
                </div>

                {isExpanded && (
                  <div style={styles.relBody}>
                    {/* Name and Description */}
                    <div style={styles.formRow}>
                      <div style={styles.formGroup}>
                        <label style={styles.label}>Name</label>
                        <input
                          style={styles.input}
                          value={rel.name}
                          onChange={(e) => updateRel(rel.id, {
                            name: e.target.value,
                            id: generateId(e.target.value) || rel.id
                          })}
                          placeholder="Relationship name"
                        />
                      </div>
                    </div>

                    <div style={styles.formRow}>
                      <div style={styles.formGroup}>
                        <label style={styles.label}>Description (optional)</label>
                        <textarea
                          style={styles.textarea}
                          value={rel.description || ''}
                          onChange={(e) => updateRel(rel.id, { description: e.target.value })}
                          placeholder="Describe what this relationship represents..."
                        />
                      </div>
                    </div>

                    {/* Entity Kind Constraints */}
                    <div style={styles.constraintsSection}>
                      <div style={styles.constraintsTitle}>Entity Kind Constraints</div>

                      {entityKinds.length === 0 ? (
                        <div style={{ color: '#666', fontSize: '12px' }}>
                          Define entity kinds first to set constraints.
                        </div>
                      ) : (
                        <div style={styles.constraintRow}>
                          <div style={styles.kindBox}>
                            <div style={styles.kindBoxLabel}>
                              <span>Source Kinds</span>
                              {rel.srcKinds?.length === 0 && (
                                <span style={styles.anyLabel}>accepts any</span>
                              )}
                            </div>
                            <div style={styles.kindGrid}>
                              {entityKinds.map((kind) => (
                                <div
                                  key={kind.id}
                                  style={{
                                    ...styles.kindChip,
                                    ...(rel.srcKinds?.includes(kind.id)
                                      ? styles.kindChipActive
                                      : styles.kindChipInactive)
                                  }}
                                  onClick={() => toggleKind(rel.id, 'srcKinds', kind.id)}
                                >
                                  {kind.name}
                                </div>
                              ))}
                            </div>
                          </div>

                          <div style={styles.arrow}>→</div>

                          <div style={styles.kindBox}>
                            <div style={styles.kindBoxLabel}>
                              <span>Destination Kinds</span>
                              {rel.dstKinds?.length === 0 && (
                                <span style={styles.anyLabel}>accepts any</span>
                              )}
                            </div>
                            <div style={styles.kindGrid}>
                              {entityKinds.map((kind) => (
                                <div
                                  key={kind.id}
                                  style={{
                                    ...styles.kindChip,
                                    ...(rel.dstKinds?.includes(kind.id)
                                      ? styles.kindChipActive
                                      : styles.kindChipInactive)
                                  }}
                                  onClick={() => toggleKind(rel.id, 'dstKinds', kind.id)}
                                >
                                  {kind.name}
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Options */}
                    <div style={styles.optionsRow}>
                      <label style={styles.checkbox}>
                        <input
                          type="checkbox"
                          checked={rel.symmetric || false}
                          onChange={(e) => updateRel(rel.id, { symmetric: e.target.checked })}
                        />
                        Symmetric (A→B implies B→A)
                      </label>

                      <button
                        style={styles.deleteButton}
                        onClick={() => deleteRel(rel.id)}
                      >
                        Delete Relationship
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
