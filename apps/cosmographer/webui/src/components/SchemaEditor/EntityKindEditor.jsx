/**
 * EntityKindEditor - Edit entity kinds with collapsible sections for subtypes, statuses, and semantic plane.
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
  kindList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  kindCard: {
    backgroundColor: '#16213e',
    borderRadius: '8px',
    border: '1px solid #0f3460',
    overflow: 'hidden'
  },
  kindHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 16px',
    cursor: 'pointer',
    backgroundColor: '#16213e'
  },
  kindHeaderLeft: {
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
  kindName: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  kindId: {
    color: '#666',
    fontSize: '11px'
  },
  kindSummary: {
    fontSize: '11px',
    color: '#666'
  },
  kindBody: {
    padding: '0 16px 16px 16px',
    borderTop: '1px solid #0f3460'
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
  inputSmall: {
    width: '120px',
    padding: '4px 8px',
    fontSize: '12px'
  },
  inputAxis: {
    width: '90px',
    padding: '4px 8px',
    fontSize: '12px',
    backgroundColor: '#1a1a2e',
    border: '1px solid #0f3460',
    borderRadius: '4px',
    color: '#eee'
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
  accordion: {
    marginTop: '12px',
    backgroundColor: '#1a1a2e',
    borderRadius: '6px',
    overflow: 'hidden'
  },
  accordionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 12px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 500,
    color: '#ccc'
  },
  accordionHeaderLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  accordionIcon: {
    fontSize: '10px',
    color: '#666',
    transition: 'transform 0.2s'
  },
  accordionBadge: {
    fontSize: '10px',
    padding: '2px 6px',
    backgroundColor: '#0f3460',
    borderRadius: '10px',
    color: '#888'
  },
  accordionBody: {
    padding: '12px',
    borderTop: '1px solid #0f3460'
  },
  tagList: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px'
  },
  tag: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '4px 8px',
    backgroundColor: '#0f3460',
    borderRadius: '4px',
    fontSize: '12px'
  },
  tagRemove: {
    cursor: 'pointer',
    color: '#888',
    marginLeft: '4px'
  },
  addSmallButton: {
    padding: '4px 10px',
    fontSize: '11px',
    backgroundColor: '#0f3460',
    color: '#aaa',
    border: 'none',
    borderRadius: '3px',
    cursor: 'pointer'
  },
  inlineForm: {
    display: 'flex',
    gap: '6px',
    marginTop: '8px'
  },
  emptyState: {
    color: '#666',
    fontSize: '13px',
    textAlign: 'center',
    padding: '20px'
  },
  axisRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '8px'
  },
  axisLabel: {
    width: '20px',
    fontSize: '12px',
    fontWeight: 600,
    color: '#e94560'
  },
  axisArrow: {
    color: '#666',
    fontSize: '12px'
  },
  emptyTag: {
    color: '#666',
    fontSize: '12px',
    fontStyle: 'italic'
  }
};

function generateId(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

export default function EntityKindEditor({ entityKinds = [], onChange }) {
  const [expandedKinds, setExpandedKinds] = useState({});
  const [expandedSections, setExpandedSections] = useState({});
  const [newSubtype, setNewSubtype] = useState('');
  const [newStatus, setNewStatus] = useState('');
  const [addingSubtype, setAddingSubtype] = useState(null);
  const [addingStatus, setAddingStatus] = useState(null);

  const toggleKind = (kindId) => {
    setExpandedKinds(prev => ({ ...prev, [kindId]: !prev[kindId] }));
  };

  const toggleSection = (kindId, section) => {
    const key = `${kindId}-${section}`;
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const isSectionExpanded = (kindId, section) => {
    return expandedSections[`${kindId}-${section}`];
  };

  const addEntityKind = () => {
    const newKind = {
      id: `kind_${Date.now()}`,
      name: 'New Kind',
      subtypes: [],
      statuses: [
        { id: 'active', name: 'Active', isTerminal: false },
        { id: 'inactive', name: 'Inactive', isTerminal: true }
      ],
      semanticPlane: {
        axes: {
          x: { name: 'X Axis', lowLabel: 'Low', highLabel: 'High' },
          y: { name: 'Y Axis', lowLabel: 'Low', highLabel: 'High' },
          z: { name: 'Z Axis', lowLabel: 'Low', highLabel: 'High' }
        },
        regions: []
      }
    };
    onChange([...entityKinds, newKind]);
    setExpandedKinds(prev => ({ ...prev, [newKind.id]: true }));
  };

  const updateKind = (kindId, updates) => {
    onChange(entityKinds.map(k =>
      k.id === kindId ? { ...k, ...updates } : k
    ));
  };

  const deleteKind = (kindId) => {
    onChange(entityKinds.filter(k => k.id !== kindId));
  };

  const addSubtype = (kindId) => {
    const kind = entityKinds.find(k => k.id === kindId);
    if (!kind || !newSubtype.trim()) return;

    const subtype = {
      id: generateId(newSubtype),
      name: newSubtype.trim(),
      description: ''
    };

    updateKind(kindId, {
      subtypes: [...kind.subtypes, subtype]
    });
    setNewSubtype('');
    setAddingSubtype(null);
  };

  const removeSubtype = (kindId, subtypeId) => {
    const kind = entityKinds.find(k => k.id === kindId);
    if (!kind) return;

    updateKind(kindId, {
      subtypes: kind.subtypes.filter(s => s.id !== subtypeId)
    });
  };

  const addStatus = (kindId) => {
    const kind = entityKinds.find(k => k.id === kindId);
    if (!kind || !newStatus.trim()) return;

    const status = {
      id: generateId(newStatus),
      name: newStatus.trim(),
      isTerminal: false
    };

    updateKind(kindId, {
      statuses: [...kind.statuses, status]
    });
    setNewStatus('');
    setAddingStatus(null);
  };

  const removeStatus = (kindId, statusId) => {
    const kind = entityKinds.find(k => k.id === kindId);
    if (!kind) return;

    updateKind(kindId, {
      statuses: kind.statuses.filter(s => s.id !== statusId)
    });
  };

  const toggleTerminal = (kindId, statusId) => {
    const kind = entityKinds.find(k => k.id === kindId);
    if (!kind) return;

    updateKind(kindId, {
      statuses: kind.statuses.map(s =>
        s.id === statusId ? { ...s, isTerminal: !s.isTerminal } : s
      )
    });
  };

  const updateAxis = (kindId, axis, field, value) => {
    const kind = entityKinds.find(k => k.id === kindId);
    if (!kind) return;

    const semanticPlane = kind.semanticPlane || {
      axes: {
        x: { name: 'X Axis', lowLabel: 'Low', highLabel: 'High' },
        y: { name: 'Y Axis', lowLabel: 'Low', highLabel: 'High' },
        z: { name: 'Z Axis', lowLabel: 'Low', highLabel: 'High' }
      },
      regions: []
    };

    updateKind(kindId, {
      semanticPlane: {
        ...semanticPlane,
        axes: {
          ...semanticPlane.axes,
          [axis]: {
            ...semanticPlane.axes[axis],
            [field]: value
          }
        }
      }
    });
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.title}>Entity Kinds</div>
        <button style={styles.addButton} onClick={addEntityKind}>
          + Add Kind
        </button>
      </div>

      {entityKinds.length === 0 ? (
        <div style={styles.emptyState}>
          No entity kinds defined. Add one to get started.
        </div>
      ) : (
        <div style={styles.kindList}>
          {entityKinds.map((kind) => {
            const isExpanded = expandedKinds[kind.id];
            return (
              <div key={kind.id} style={styles.kindCard}>
                <div
                  style={styles.kindHeader}
                  onClick={() => toggleKind(kind.id)}
                >
                  <div style={styles.kindHeaderLeft}>
                    <span style={{
                      ...styles.expandIcon,
                      transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)'
                    }}>
                      ▶
                    </span>
                    <span style={{ fontWeight: 500 }}>{kind.name}</span>
                    <span style={styles.kindId}>({kind.id})</span>
                  </div>
                  <div style={styles.kindSummary}>
                    {kind.subtypes.length} subtypes · {kind.statuses.length} statuses
                  </div>
                </div>

                {isExpanded && (
                  <div style={styles.kindBody}>
                    {/* Name input */}
                    <div style={{ marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <input
                        style={styles.input}
                        value={kind.name}
                        onChange={(e) => updateKind(kind.id, {
                          name: e.target.value,
                          id: generateId(e.target.value) || kind.id
                        })}
                        placeholder="Kind name"
                        onClick={(e) => e.stopPropagation()}
                      />
                      <button
                        style={styles.deleteButton}
                        onClick={(e) => { e.stopPropagation(); deleteKind(kind.id); }}
                      >
                        Delete Kind
                      </button>
                    </div>

                    {/* Subtypes Accordion */}
                    <div style={styles.accordion}>
                      <div
                        style={styles.accordionHeader}
                        onClick={() => toggleSection(kind.id, 'subtypes')}
                      >
                        <div style={styles.accordionHeaderLeft}>
                          <span style={{
                            ...styles.accordionIcon,
                            transform: isSectionExpanded(kind.id, 'subtypes') ? 'rotate(90deg)' : 'rotate(0deg)'
                          }}>▶</span>
                          <span>Subtypes</span>
                          <span style={styles.accordionBadge}>{kind.subtypes.length}</span>
                        </div>
                      </div>
                      {isSectionExpanded(kind.id, 'subtypes') && (
                        <div style={styles.accordionBody}>
                          <div style={styles.tagList}>
                            {kind.subtypes.map((subtype) => (
                              <div key={subtype.id} style={styles.tag}>
                                {subtype.name}
                                <span
                                  style={styles.tagRemove}
                                  onClick={() => removeSubtype(kind.id, subtype.id)}
                                >
                                  ×
                                </span>
                              </div>
                            ))}
                            {kind.subtypes.length === 0 && (
                              <span style={styles.emptyTag}>No subtypes defined</span>
                            )}
                          </div>
                          {addingSubtype === kind.id ? (
                            <div style={styles.inlineForm}>
                              <input
                                style={{ ...styles.input, ...styles.inputSmall, flex: 1 }}
                                value={newSubtype}
                                onChange={(e) => setNewSubtype(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && addSubtype(kind.id)}
                                placeholder="Subtype name"
                                autoFocus
                              />
                              <button style={styles.addSmallButton} onClick={() => addSubtype(kind.id)}>
                                Add
                              </button>
                              <button
                                style={styles.addSmallButton}
                                onClick={() => { setAddingSubtype(null); setNewSubtype(''); }}
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              style={{ ...styles.addSmallButton, marginTop: '8px' }}
                              onClick={() => setAddingSubtype(kind.id)}
                            >
                              + Add Subtype
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Statuses Accordion */}
                    <div style={styles.accordion}>
                      <div
                        style={styles.accordionHeader}
                        onClick={() => toggleSection(kind.id, 'statuses')}
                      >
                        <div style={styles.accordionHeaderLeft}>
                          <span style={{
                            ...styles.accordionIcon,
                            transform: isSectionExpanded(kind.id, 'statuses') ? 'rotate(90deg)' : 'rotate(0deg)'
                          }}>▶</span>
                          <span>Statuses</span>
                          <span style={styles.accordionBadge}>{kind.statuses.length}</span>
                        </div>
                      </div>
                      {isSectionExpanded(kind.id, 'statuses') && (
                        <div style={styles.accordionBody}>
                          <div style={styles.tagList}>
                            {kind.statuses.map((status) => (
                              <div
                                key={status.id}
                                style={{
                                  ...styles.tag,
                                  backgroundColor: status.isTerminal ? '#4a1942' : '#0f3460',
                                  cursor: 'pointer'
                                }}
                                onClick={() => toggleTerminal(kind.id, status.id)}
                                title={status.isTerminal ? 'Terminal status (click to toggle)' : 'Click to make terminal'}
                              >
                                {status.name}
                                {status.isTerminal && <span style={{ marginLeft: '4px' }}>⏹</span>}
                                <span
                                  style={styles.tagRemove}
                                  onClick={(e) => { e.stopPropagation(); removeStatus(kind.id, status.id); }}
                                >
                                  ×
                                </span>
                              </div>
                            ))}
                          </div>
                          {addingStatus === kind.id ? (
                            <div style={styles.inlineForm}>
                              <input
                                style={{ ...styles.input, ...styles.inputSmall, flex: 1 }}
                                value={newStatus}
                                onChange={(e) => setNewStatus(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && addStatus(kind.id)}
                                placeholder="Status name"
                                autoFocus
                              />
                              <button style={styles.addSmallButton} onClick={() => addStatus(kind.id)}>
                                Add
                              </button>
                              <button
                                style={styles.addSmallButton}
                                onClick={() => { setAddingStatus(null); setNewStatus(''); }}
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              style={{ ...styles.addSmallButton, marginTop: '8px' }}
                              onClick={() => setAddingStatus(kind.id)}
                            >
                              + Add Status
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Semantic Plane Accordion */}
                    <div style={styles.accordion}>
                      <div
                        style={styles.accordionHeader}
                        onClick={() => toggleSection(kind.id, 'semanticPlane')}
                      >
                        <div style={styles.accordionHeaderLeft}>
                          <span style={{
                            ...styles.accordionIcon,
                            transform: isSectionExpanded(kind.id, 'semanticPlane') ? 'rotate(90deg)' : 'rotate(0deg)'
                          }}>▶</span>
                          <span>Semantic Plane Axes</span>
                        </div>
                      </div>
                      {isSectionExpanded(kind.id, 'semanticPlane') && (
                        <div style={styles.accordionBody}>
                          {['x', 'y', 'z'].map((axis) => {
                            const axisConfig = kind.semanticPlane?.axes?.[axis] || { name: '', lowLabel: '', highLabel: '' };
                            return (
                              <div key={axis} style={styles.axisRow}>
                                <span style={styles.axisLabel}>{axis.toUpperCase()}</span>
                                <input
                                  style={styles.inputAxis}
                                  value={axisConfig.lowLabel}
                                  onChange={(e) => updateAxis(kind.id, axis, 'lowLabel', e.target.value)}
                                  placeholder="Low"
                                  title="Low label"
                                />
                                <span style={styles.axisArrow}>←</span>
                                <input
                                  style={{ ...styles.inputAxis, width: '110px' }}
                                  value={axisConfig.name}
                                  onChange={(e) => updateAxis(kind.id, axis, 'name', e.target.value)}
                                  placeholder="Axis name"
                                  title="Axis name"
                                />
                                <span style={styles.axisArrow}>→</span>
                                <input
                                  style={styles.inputAxis}
                                  value={axisConfig.highLabel}
                                  onChange={(e) => updateAxis(kind.id, axis, 'highLabel', e.target.value)}
                                  placeholder="High"
                                  title="High label"
                                />
                              </div>
                            );
                          })}
                        </div>
                      )}
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
