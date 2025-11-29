/**
 * EntityKindEditor - Edit entity kinds with their subtypes and statuses.
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
    gap: '12px'
  },
  kindCard: {
    backgroundColor: '#16213e',
    borderRadius: '8px',
    padding: '16px',
    border: '1px solid #0f3460'
  },
  kindHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px'
  },
  kindName: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  input: {
    padding: '6px 10px',
    fontSize: '14px',
    backgroundColor: '#1a1a2e',
    border: '1px solid #0f3460',
    borderRadius: '4px',
    color: '#eee',
    width: '150px'
  },
  inputSmall: {
    width: '120px',
    padding: '4px 8px',
    fontSize: '12px'
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
  section: {
    marginTop: '12px'
  },
  sectionTitle: {
    fontSize: '12px',
    color: '#888',
    marginBottom: '8px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
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
    padding: '2px 6px',
    fontSize: '10px',
    backgroundColor: '#0f3460',
    color: '#aaa',
    border: 'none',
    borderRadius: '3px',
    cursor: 'pointer'
  },
  emptyState: {
    color: '#666',
    fontSize: '13px',
    textAlign: 'center',
    padding: '20px'
  }
};

function generateId(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

export default function EntityKindEditor({ entityKinds = [], onChange }) {
  const [editingSubtype, setEditingSubtype] = useState(null);
  const [editingStatus, setEditingStatus] = useState(null);
  const [newSubtype, setNewSubtype] = useState('');
  const [newStatus, setNewStatus] = useState('');

  const addEntityKind = () => {
    const newKind = {
      id: `kind_${Date.now()}`,
      name: 'New Kind',
      subtypes: [],
      statuses: [
        { id: 'active', name: 'Active', isTerminal: false },
        { id: 'inactive', name: 'Inactive', isTerminal: true }
      ]
    };
    onChange([...entityKinds, newKind]);
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
    setEditingSubtype(null);
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
    setEditingStatus(null);
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
          {entityKinds.map((kind) => (
            <div key={kind.id} style={styles.kindCard}>
              <div style={styles.kindHeader}>
                <div style={styles.kindName}>
                  <input
                    style={styles.input}
                    value={kind.name}
                    onChange={(e) => updateKind(kind.id, {
                      name: e.target.value,
                      id: generateId(e.target.value) || kind.id
                    })}
                    placeholder="Kind name"
                  />
                  <span style={{ color: '#666', fontSize: '12px' }}>
                    ({kind.id})
                  </span>
                </div>
                <button
                  style={styles.deleteButton}
                  onClick={() => deleteKind(kind.id)}
                >
                  Delete
                </button>
              </div>

              {/* Subtypes */}
              <div style={styles.section}>
                <div style={styles.sectionTitle}>
                  <span>Subtypes</span>
                  {editingSubtype === kind.id ? (
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <input
                        style={{ ...styles.input, ...styles.inputSmall }}
                        value={newSubtype}
                        onChange={(e) => setNewSubtype(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && addSubtype(kind.id)}
                        placeholder="Subtype name"
                        autoFocus
                      />
                      <button
                        style={styles.addSmallButton}
                        onClick={() => addSubtype(kind.id)}
                      >
                        Add
                      </button>
                      <button
                        style={styles.addSmallButton}
                        onClick={() => { setEditingSubtype(null); setNewSubtype(''); }}
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <button
                      style={styles.addSmallButton}
                      onClick={() => setEditingSubtype(kind.id)}
                    >
                      + Add
                    </button>
                  )}
                </div>
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
                    <span style={{ color: '#666', fontSize: '12px' }}>None</span>
                  )}
                </div>
              </div>

              {/* Statuses */}
              <div style={styles.section}>
                <div style={styles.sectionTitle}>
                  <span>Statuses</span>
                  {editingStatus === kind.id ? (
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <input
                        style={{ ...styles.input, ...styles.inputSmall }}
                        value={newStatus}
                        onChange={(e) => setNewStatus(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && addStatus(kind.id)}
                        placeholder="Status name"
                        autoFocus
                      />
                      <button
                        style={styles.addSmallButton}
                        onClick={() => addStatus(kind.id)}
                      >
                        Add
                      </button>
                      <button
                        style={styles.addSmallButton}
                        onClick={() => { setEditingStatus(null); setNewStatus(''); }}
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <button
                      style={styles.addSmallButton}
                      onClick={() => setEditingStatus(kind.id)}
                    >
                      + Add
                    </button>
                  )}
                </div>
                <div style={styles.tagList}>
                  {kind.statuses.map((status) => (
                    <div
                      key={status.id}
                      style={{
                        ...styles.tag,
                        backgroundColor: status.isTerminal ? '#4a1942' : '#0f3460'
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
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
