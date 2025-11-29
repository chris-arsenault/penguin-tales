/**
 * RelationshipKindEditor - Edit relationship kinds
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
  relList: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.sm,
  },
  relCard: {
    backgroundColor: colors.bgSecondary,
    borderRadius: radius.lg,
    border: `1px solid ${colors.border}`,
    overflow: 'hidden',
  },
  relHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: `${spacing.md} ${spacing.lg}`,
    cursor: 'pointer',
  },
  relHeaderLeft: {
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
  relName: {
    fontWeight: typography.weightMedium,
    fontFamily: typography.fontFamily,
    color: colors.textPrimary,
  },
  relId: {
    color: colors.textMuted,
    fontSize: typography.sizeXs,
    fontFamily: typography.fontFamily,
  },
  relSummary: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing.sm,
    fontSize: typography.sizeXs,
    fontFamily: typography.fontFamily,
    color: colors.textMuted,
  },
  summaryKind: {
    padding: `2px ${spacing.sm}`,
    backgroundColor: colors.bgTertiary,
    borderRadius: radius.sm,
    fontSize: typography.sizeXs,
    fontFamily: typography.fontFamily,
  },
  relBody: {
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
  textarea: {
    ...components.input,
    resize: 'vertical',
    minHeight: '60px',
  },
  constraintsSection: {
    backgroundColor: colors.bgSecondary,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  constraintsTitle: {
    fontSize: typography.sizeMd,
    fontWeight: typography.weightMedium,
    fontFamily: typography.fontFamily,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  constraintRow: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing.lg,
  },
  kindBox: {
    flex: 1,
  },
  kindBoxLabel: {
    fontSize: typography.sizeXs,
    fontFamily: typography.fontFamily,
    color: colors.textMuted,
    marginBottom: spacing.sm,
    display: 'flex',
    justifyContent: 'space-between',
  },
  kindGrid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  kindChip: {
    padding: `${spacing.sm} ${spacing.md}`,
    borderRadius: radius.sm,
    fontSize: typography.sizeSm,
    fontFamily: typography.fontFamily,
    cursor: 'pointer',
    transition: 'background-color 0.15s',
    border: '1px solid transparent',
  },
  kindChipActive: {
    backgroundColor: colors.buttonPrimary,
    color: 'white',
  },
  kindChipInactive: {
    backgroundColor: colors.bgTertiary,
    color: colors.textSecondary,
    border: `1px solid ${colors.border}`,
  },
  arrow: {
    fontSize: typography.sizeTitle,
    color: colors.textMuted,
    fontWeight: typography.weightNormal,
  },
  optionsRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  checkbox: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing.sm,
    fontSize: typography.sizeMd,
    fontFamily: typography.fontFamily,
    color: colors.textSecondary,
    cursor: 'pointer',
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
  anyLabel: {
    fontSize: typography.sizeXs,
    fontFamily: typography.fontFamily,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  symmetricLabel: {
    fontSize: typography.sizeXs,
    fontFamily: typography.fontFamily,
    color: colors.textMuted,
  },
};

export default function RelationshipKindEditor({
  relationshipKinds,
  entityKinds,
  onChange,
}) {
  const [expandedRels, setExpandedRels] = useState({});

  // Use stable key for expand/collapse tracking (falls back to id for existing rels)
  const getStableKey = (rel) => rel._key || rel.id;

  const toggleRel = (stableKey) => {
    setExpandedRels((prev) => ({ ...prev, [stableKey]: !prev[stableKey] }));
  };

  const addRelationship = () => {
    const stableKey = `rel_${Date.now()}`;
    const newRel = {
      id: stableKey,
      name: 'New Relationship',
      description: '',
      srcKinds: [],
      dstKinds: [],
      symmetric: false,
      _key: stableKey, // Stable key for React, never changes
    };
    onChange([...relationshipKinds, newRel]);
    setExpandedRels((prev) => ({ ...prev, [stableKey]: true }));
  };

  const updateRel = (relId, updates) => {
    onChange(
      relationshipKinds.map((r) => (r.id === relId ? { ...r, ...updates } : r))
    );
  };

  const deleteRel = (relId) => {
    if (confirm('Delete this relationship kind?')) {
      onChange(relationshipKinds.filter((r) => r.id !== relId));
    }
  };

  const toggleKind = (relId, field, kindId) => {
    const rel = relationshipKinds.find((r) => r.id === relId);
    if (!rel) return;

    const current = rel[field] || [];
    const updated = current.includes(kindId)
      ? current.filter((k) => k !== kindId)
      : [...current, kindId];

    updateRel(relId, { [field]: updated });
  };

  const getSummary = (rel) => {
    const srcNames =
      rel.srcKinds?.length > 0
        ? rel.srcKinds
            .map((id) => entityKinds.find((k) => k.id === id)?.name || id)
            .slice(0, 2)
        : ['Any'];
    const dstNames =
      rel.dstKinds?.length > 0
        ? rel.dstKinds
            .map((id) => entityKinds.find((k) => k.id === id)?.name || id)
            .slice(0, 2)
        : ['Any'];

    return { srcNames, dstNames };
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.title}>Relationship Kinds</div>
        <div style={styles.subtitle}>
          Define how entities can be connected to each other.
        </div>
      </div>

      <div style={styles.toolbar}>
        <span style={styles.count}>
          {relationshipKinds.length} relationship
          {relationshipKinds.length !== 1 ? 's' : ''}
        </span>
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
            const stableKey = getStableKey(rel);
            const isExpanded = expandedRels[stableKey];
            const { srcNames, dstNames } = getSummary(rel);

            return (
              <div key={stableKey} style={styles.relCard}>
                <div
                  style={styles.relHeader}
                  onClick={() => toggleRel(stableKey)}
                >
                  <div style={styles.relHeaderLeft}>
                    <span
                      style={{
                        ...styles.expandIcon,
                        transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                      }}
                    >
                      ▶
                    </span>
                    <span style={styles.relName}>{rel.name}</span>
                    <span style={styles.relId}>({rel.id})</span>
                    {rel.symmetric && (
                      <span style={styles.symmetricLabel}>
                        ↔ symmetric
                      </span>
                    )}
                  </div>
                  <div style={styles.relSummary}>
                    {srcNames.map((name, i) => (
                      <span key={i} style={styles.summaryKind}>
                        {name}
                      </span>
                    ))}
                    {rel.srcKinds?.length > 2 && (
                      <span>+{rel.srcKinds.length - 2}</span>
                    )}
                    <span style={{ color: colors.textMuted }}>→</span>
                    {dstNames.map((name, i) => (
                      <span key={i} style={styles.summaryKind}>
                        {name}
                      </span>
                    ))}
                    {rel.dstKinds?.length > 2 && (
                      <span>+{rel.dstKinds.length - 2}</span>
                    )}
                  </div>
                </div>

                {isExpanded && (
                  <div style={styles.relBody}>
                    {/* Name and ID */}
                    <div style={styles.formRow}>
                      <div style={styles.formGroup}>
                        <label style={styles.label}>Name</label>
                        <input
                          style={styles.input}
                          value={rel.name}
                          onChange={(e) =>
                            updateRel(rel.id, { name: e.target.value })
                          }
                          placeholder="Relationship name"
                        />
                      </div>
                      <div style={styles.formGroup}>
                        <label style={styles.label}>ID</label>
                        <input
                          style={styles.input}
                          value={rel.id}
                          onChange={(e) => {
                            const newId = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '');
                            if (newId && !relationshipKinds.some((r) => r.id === newId && r.id !== rel.id)) {
                              updateRel(rel.id, { id: newId });
                            }
                          }}
                          placeholder="relationship_id"
                        />
                      </div>
                    </div>

                    <div style={styles.formRow}>
                      <div style={styles.formGroup}>
                        <label style={styles.label}>Description (optional)</label>
                        <textarea
                          style={styles.textarea}
                          value={rel.description || ''}
                          onChange={(e) =>
                            updateRel(rel.id, { description: e.target.value })
                          }
                          placeholder="Describe what this relationship represents..."
                        />
                      </div>
                    </div>

                    {/* Entity Kind Constraints */}
                    <div style={styles.constraintsSection}>
                      <div style={styles.constraintsTitle}>
                        Entity Kind Constraints
                      </div>

                      {entityKinds.length === 0 ? (
                        <div style={{ color: colors.textMuted, fontSize: typography.sizeSm }}>
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
                                      : styles.kindChipInactive),
                                  }}
                                  onClick={() =>
                                    toggleKind(rel.id, 'srcKinds', kind.id)
                                  }
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
                                      : styles.kindChipInactive),
                                  }}
                                  onClick={() =>
                                    toggleKind(rel.id, 'dstKinds', kind.id)
                                  }
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
                          onChange={(e) =>
                            updateRel(rel.id, { symmetric: e.target.checked })
                          }
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
