/**
 * EntityKindEditor - Edit entity kinds (id, name, subtypes, statuses)
 *
 * This is the authoritative place to define entity kinds.
 * Semantic planes are edited in Cosmographer.
 */

import React, { useState } from 'react';
import { colors, typography, spacing, radius, components } from '../../theme';

const styles = {
  container: {
    maxWidth: '900px',
  },
  header: {
    marginBottom: spacing.xxl,
  },
  title: {
    fontSize: typography.sizeTitle,
    fontWeight: typography.weightSemibold,
    fontFamily: typography.fontFamily,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: typography.sizeLg,
    fontFamily: typography.fontFamily,
  },
  toolbar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  count: {
    color: colors.textMuted,
    fontSize: typography.sizeMd,
    fontFamily: typography.fontFamily,
  },
  addButton: {
    ...components.buttonPrimary,
  },
  kindList: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.sm,
  },
  kindCard: {
    backgroundColor: colors.bgSecondary,
    borderRadius: radius.lg,
    border: `1px solid ${colors.border}`,
    overflow: 'hidden',
  },
  kindHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: `${spacing.md} ${spacing.lg}`,
    cursor: 'pointer',
  },
  kindHeaderLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing.md,
  },
  expandIcon: {
    fontSize: typography.sizeSm,
    color: colors.textMuted,
    transition: 'transform 0.2s',
    width: '16px',
  },
  kindName: {
    fontWeight: typography.weightMedium,
    fontFamily: typography.fontFamily,
    color: colors.textPrimary,
  },
  kindId: {
    color: colors.textMuted,
    fontSize: typography.sizeXs,
    fontFamily: typography.fontFamily,
  },
  kindSummary: {
    fontSize: typography.sizeXs,
    fontFamily: typography.fontFamily,
    color: colors.textMuted,
  },
  kindBody: {
    padding: spacing.lg,
    borderTop: `1px solid ${colors.border}`,
    backgroundColor: colors.bgTertiary,
  },
  formRow: {
    display: 'flex',
    gap: spacing.md,
    marginBottom: spacing.lg,
    alignItems: 'flex-start',
  },
  formGroup: {
    flex: 1,
  },
  label: {
    ...components.label,
  },
  input: {
    ...components.input,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: typography.sizeMd,
    fontWeight: typography.weightMedium,
    fontFamily: typography.fontFamily,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  itemList: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  item: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing.sm,
    padding: `${spacing.xs} ${spacing.sm}`,
    backgroundColor: colors.bgSecondary,
    borderRadius: radius.sm,
    fontSize: typography.sizeSm,
    fontFamily: typography.fontFamily,
    color: colors.textPrimary,
  },
  itemRemove: {
    background: 'none',
    border: 'none',
    color: colors.danger,
    cursor: 'pointer',
    padding: '0 2px',
    fontSize: typography.sizeLg,
  },
  addItemRow: {
    display: 'flex',
    gap: spacing.sm,
  },
  addItemInput: {
    flex: 1,
    padding: `${spacing.sm} ${spacing.md}`,
    fontSize: typography.sizeSm,
    fontFamily: typography.fontFamily,
    backgroundColor: colors.bgSecondary,
    border: `1px solid ${colors.border}`,
    borderRadius: radius.sm,
    color: colors.textPrimary,
  },
  addItemButton: {
    padding: `${spacing.sm} ${spacing.md}`,
    fontSize: typography.sizeSm,
    fontFamily: typography.fontFamily,
    backgroundColor: colors.buttonSecondary,
    color: colors.textSecondary,
    border: 'none',
    borderRadius: radius.sm,
    cursor: 'pointer',
  },
  actionsRow: {
    display: 'flex',
    justifyContent: 'flex-end',
    marginTop: spacing.lg,
  },
  deleteButton: {
    ...components.buttonDanger,
  },
  emptyState: {
    color: colors.textMuted,
    fontSize: typography.sizeLg,
    fontFamily: typography.fontFamily,
    textAlign: 'center',
    padding: spacing.xxxl,
  },
  checkbox: {
    marginRight: spacing.sm,
  },
  hint: {
    fontSize: typography.sizeXs,
    fontFamily: typography.fontFamily,
    color: colors.textMuted,
    marginTop: spacing.xs,
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
        <span style={styles.count}>
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
                      <div style={styles.hint}>
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
