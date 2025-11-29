/**
 * EntityKindEditor - Edit entity kinds (id, name, subtypes, statuses)
 *
 * This is the authoritative place to define entity kinds.
 * Semantic planes are edited in Cosmographer.
 */

import React, { useState } from 'react';

const styles = {
  container: {
    maxWidth: '900px',
  },
  header: {
    marginBottom: '24px',
  },
  title: {
    fontSize: '24px',
    fontWeight: 600,
    marginBottom: '8px',
  },
  subtitle: {
    color: '#888',
    fontSize: '14px',
  },
  toolbar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
  },
  addButton: {
    padding: '8px 16px',
    fontSize: '13px',
    backgroundColor: '#e94560',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  kindList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  kindCard: {
    backgroundColor: '#16213e',
    borderRadius: '8px',
    border: '1px solid #0f3460',
    overflow: 'hidden',
  },
  kindHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 16px',
    cursor: 'pointer',
  },
  kindHeaderLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  expandIcon: {
    fontSize: '12px',
    color: '#888',
    transition: 'transform 0.2s',
    width: '16px',
  },
  kindName: {
    fontWeight: 500,
  },
  kindId: {
    color: '#666',
    fontSize: '11px',
  },
  kindSummary: {
    fontSize: '11px',
    color: '#666',
  },
  kindBody: {
    padding: '16px',
    borderTop: '1px solid #0f3460',
  },
  formRow: {
    display: 'flex',
    gap: '12px',
    marginBottom: '16px',
    alignItems: 'flex-start',
  },
  formGroup: {
    flex: 1,
  },
  label: {
    fontSize: '12px',
    color: '#888',
    marginBottom: '6px',
    display: 'block',
  },
  input: {
    width: '100%',
    padding: '8px 10px',
    fontSize: '14px',
    backgroundColor: '#1a1a2e',
    border: '1px solid #0f3460',
    borderRadius: '4px',
    color: '#eee',
    boxSizing: 'border-box',
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
    boxSizing: 'border-box',
  },
  section: {
    marginBottom: '16px',
  },
  sectionTitle: {
    fontSize: '13px',
    fontWeight: 500,
    color: '#ccc',
    marginBottom: '8px',
  },
  itemList: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px',
    marginBottom: '8px',
  },
  item: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '4px 8px',
    backgroundColor: '#1a1a2e',
    borderRadius: '4px',
    fontSize: '12px',
  },
  itemRemove: {
    background: 'none',
    border: 'none',
    color: '#e94560',
    cursor: 'pointer',
    padding: '0 2px',
    fontSize: '14px',
  },
  addItemRow: {
    display: 'flex',
    gap: '8px',
  },
  addItemInput: {
    flex: 1,
    padding: '6px 10px',
    fontSize: '12px',
    backgroundColor: '#1a1a2e',
    border: '1px solid #0f3460',
    borderRadius: '4px',
    color: '#eee',
  },
  addItemButton: {
    padding: '6px 12px',
    fontSize: '12px',
    backgroundColor: '#0f3460',
    color: '#ccc',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  actionsRow: {
    display: 'flex',
    justifyContent: 'flex-end',
    marginTop: '16px',
  },
  deleteButton: {
    padding: '6px 12px',
    fontSize: '12px',
    backgroundColor: 'transparent',
    color: '#e94560',
    border: '1px solid #e94560',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  emptyState: {
    color: '#666',
    fontSize: '14px',
    textAlign: 'center',
    padding: '40px',
  },
  checkbox: {
    marginRight: '6px',
  },
};

export default function EntityKindEditor({ entityKinds, onChange }) {
  const [expandedKinds, setExpandedKinds] = useState({});
  const [newSubtype, setNewSubtype] = useState({});
  const [newStatus, setNewStatus] = useState({});

  // Use stable key for expand/collapse tracking (falls back to id for existing kinds)
  const getStableKey = (kind) => kind._key || kind.id;

  const toggleKind = (stableKey) => {
    setExpandedKinds((prev) => ({ ...prev, [stableKey]: !prev[stableKey] }));
  };

  const addEntityKind = () => {
    const stableKey = `kind_${Date.now()}`;
    const newKind = {
      id: stableKey,
      name: 'New Entity Kind',
      description: '',
      subtypes: [],
      statuses: [{ id: 'active', name: 'Active', isTerminal: false }],
      defaultStatus: 'active',
      _key: stableKey, // Stable key for React, never changes
    };
    onChange([...entityKinds, newKind]);
    setExpandedKinds((prev) => ({ ...prev, [stableKey]: true }));
  };

  const updateKind = (kindId, updates) => {
    onChange(
      entityKinds.map((k) => (k.id === kindId ? { ...k, ...updates } : k))
    );
  };

  const deleteKind = (kindId) => {
    if (confirm('Delete this entity kind? This cannot be undone.')) {
      onChange(entityKinds.filter((k) => k.id !== kindId));
    }
  };

  const addSubtype = (kindId) => {
    const name = newSubtype[kindId]?.trim();
    if (!name) return;

    const kind = entityKinds.find((k) => k.id === kindId);
    if (!kind) return;

    const subtype = { id: generateId(name), name };
    updateKind(kindId, { subtypes: [...kind.subtypes, subtype] });
    setNewSubtype((prev) => ({ ...prev, [kindId]: '' }));
  };

  const removeSubtype = (kindId, subtypeId) => {
    const kind = entityKinds.find((k) => k.id === kindId);
    if (!kind) return;
    updateKind(kindId, {
      subtypes: kind.subtypes.filter((s) => s.id !== subtypeId),
    });
  };

  const addStatus = (kindId) => {
    const name = newStatus[kindId]?.trim();
    if (!name) return;

    const kind = entityKinds.find((k) => k.id === kindId);
    if (!kind) return;

    const status = { id: generateId(name), name, isTerminal: false };
    updateKind(kindId, { statuses: [...kind.statuses, status] });
    setNewStatus((prev) => ({ ...prev, [kindId]: '' }));
  };

  const removeStatus = (kindId, statusId) => {
    const kind = entityKinds.find((k) => k.id === kindId);
    if (!kind) return;
    updateKind(kindId, {
      statuses: kind.statuses.filter((s) => s.id !== statusId),
    });
  };

  const toggleStatusTerminal = (kindId, statusId) => {
    const kind = entityKinds.find((k) => k.id === kindId);
    if (!kind) return;
    updateKind(kindId, {
      statuses: kind.statuses.map((s) =>
        s.id === statusId ? { ...s, isTerminal: !s.isTerminal } : s
      ),
    });
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.title}>Entity Kinds</div>
        <div style={styles.subtitle}>
          Define the types of entities that exist in your world.
        </div>
      </div>

      <div style={styles.toolbar}>
        <span style={{ color: '#888', fontSize: '13px' }}>
          {entityKinds.length} kind{entityKinds.length !== 1 ? 's' : ''}
        </span>
        <button style={styles.addButton} onClick={addEntityKind}>
          + Add Entity Kind
        </button>
      </div>

      {entityKinds.length === 0 ? (
        <div style={styles.emptyState}>
          No entity kinds defined yet. Add one to get started.
        </div>
      ) : (
        <div style={styles.kindList}>
          {entityKinds.map((kind) => {
            const stableKey = getStableKey(kind);
            const isExpanded = expandedKinds[stableKey];
            return (
              <div key={stableKey} style={styles.kindCard}>
                <div
                  style={styles.kindHeader}
                  onClick={() => toggleKind(stableKey)}
                >
                  <div style={styles.kindHeaderLeft}>
                    <span
                      style={{
                        ...styles.expandIcon,
                        transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                      }}
                    >
                      ▶
                    </span>
                    <span style={styles.kindName}>{kind.name}</span>
                    <span style={styles.kindId}>({kind.id})</span>
                  </div>
                  <div style={styles.kindSummary}>
                    {kind.subtypes.length} subtypes, {kind.statuses.length} statuses
                  </div>
                </div>

                {isExpanded && (
                  <div style={styles.kindBody}>
                    {/* Name and ID */}
                    <div style={styles.formRow}>
                      <div style={styles.formGroup}>
                        <label style={styles.label}>Name</label>
                        <input
                          style={styles.input}
                          value={kind.name}
                          onChange={(e) =>
                            updateKind(kind.id, { name: e.target.value })
                          }
                          placeholder="Entity kind name"
                        />
                      </div>
                      <div style={styles.formGroup}>
                        <label style={styles.label}>ID</label>
                        <input
                          style={styles.input}
                          value={kind.id}
                          onChange={(e) => {
                            const newId = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '');
                            if (newId && !entityKinds.some((k) => k.id === newId && k.id !== kind.id)) {
                              updateKind(kind.id, { id: newId });
                            }
                          }}
                          placeholder="entity_kind_id"
                        />
                      </div>
                    </div>

                    {/* Description */}
                    <div style={styles.formRow}>
                      <div style={styles.formGroup}>
                        <label style={styles.label}>Description</label>
                        <input
                          style={styles.input}
                          value={kind.description || ''}
                          onChange={(e) =>
                            updateKind(kind.id, { description: e.target.value })
                          }
                          placeholder="Optional description"
                        />
                      </div>
                    </div>

                    {/* Subtypes */}
                    <div style={styles.section}>
                      <div style={styles.sectionTitle}>Subtypes</div>
                      <div style={styles.itemList}>
                        {kind.subtypes.map((subtype) => (
                          <div key={subtype.id} style={styles.item}>
                            <span>{subtype.name}</span>
                            <button
                              style={styles.itemRemove}
                              onClick={() => removeSubtype(kind.id, subtype.id)}
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                      <div style={styles.addItemRow}>
                        <input
                          style={styles.addItemInput}
                          value={newSubtype[kind.id] || ''}
                          onChange={(e) =>
                            setNewSubtype((prev) => ({
                              ...prev,
                              [kind.id]: e.target.value,
                            }))
                          }
                          placeholder="New subtype name"
                          onKeyDown={(e) =>
                            e.key === 'Enter' && addSubtype(kind.id)
                          }
                        />
                        <button
                          style={styles.addItemButton}
                          onClick={() => addSubtype(kind.id)}
                        >
                          Add
                        </button>
                      </div>
                    </div>

                    {/* Statuses */}
                    <div style={styles.section}>
                      <div style={styles.sectionTitle}>Statuses</div>
                      <div style={styles.itemList}>
                        {kind.statuses.map((status) => (
                          <div key={status.id} style={styles.item}>
                            <input
                              type="checkbox"
                              style={styles.checkbox}
                              checked={status.isTerminal}
                              onChange={() =>
                                toggleStatusTerminal(kind.id, status.id)
                              }
                              title="Terminal status"
                            />
                            <span
                              style={{
                                textDecoration: status.isTerminal
                                  ? 'line-through'
                                  : 'none',
                                opacity: status.isTerminal ? 0.7 : 1,
                              }}
                            >
                              {status.name}
                            </span>
                            <button
                              style={styles.itemRemove}
                              onClick={() => removeStatus(kind.id, status.id)}
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                      <div style={styles.addItemRow}>
                        <input
                          style={styles.addItemInput}
                          value={newStatus[kind.id] || ''}
                          onChange={(e) =>
                            setNewStatus((prev) => ({
                              ...prev,
                              [kind.id]: e.target.value,
                            }))
                          }
                          placeholder="New status name"
                          onKeyDown={(e) =>
                            e.key === 'Enter' && addStatus(kind.id)
                          }
                        />
                        <button
                          style={styles.addItemButton}
                          onClick={() => addStatus(kind.id)}
                        >
                          Add
                        </button>
                      </div>
                      <div style={{ fontSize: '11px', color: '#666', marginTop: '4px' }}>
                        Check the box to mark as terminal (entity "ends" in this status)
                      </div>
                    </div>

                    {/* Default Status */}
                    <div style={styles.formRow}>
                      <div style={styles.formGroup}>
                        <label style={styles.label}>Default Status</label>
                        <select
                          style={styles.input}
                          value={kind.defaultStatus || ''}
                          onChange={(e) =>
                            updateKind(kind.id, { defaultStatus: e.target.value })
                          }
                        >
                          <option value="">-- Select --</option>
                          {kind.statuses.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Delete */}
                    <div style={styles.actionsRow}>
                      <button
                        style={styles.deleteButton}
                        onClick={() => deleteKind(kind.id)}
                      >
                        Delete Entity Kind
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
