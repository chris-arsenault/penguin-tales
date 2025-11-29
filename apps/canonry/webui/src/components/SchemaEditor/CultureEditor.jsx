/**
 * CultureEditor - Edit culture identity (id, name, description, color)
 *
 * This edits the BASE culture identity only.
 * - Axis biases and home regions are edited in Cosmographer
 * - Naming data is edited in Name Forge
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
  cultureList: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.sm,
  },
  cultureCard: {
    backgroundColor: colors.bgSecondary,
    borderRadius: radius.lg,
    border: `1px solid ${colors.border}`,
    overflow: 'hidden',
  },
  cultureHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: `${spacing.md} ${spacing.lg}`,
    cursor: 'pointer',
  },
  cultureHeaderLeft: {
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
  colorDot: {
    width: '16px',
    height: '16px',
    borderRadius: '50%',
    border: `2px solid ${colors.border}`,
  },
  cultureName: {
    fontWeight: typography.weightMedium,
    fontFamily: typography.fontFamily,
    color: colors.textPrimary,
  },
  cultureId: {
    color: colors.textMuted,
    fontSize: typography.sizeXs,
    fontFamily: typography.fontFamily,
  },
  cultureSummary: {
    fontSize: typography.sizeXs,
    fontFamily: typography.fontFamily,
    color: colors.textMuted,
  },
  cultureBody: {
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
  colorSection: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  colorPickerDot: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    cursor: 'pointer',
    border: `3px solid ${colors.border}`,
  },
  colorPicker: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  colorOption: {
    width: '24px',
    height: '24px',
    borderRadius: radius.sm,
    cursor: 'pointer',
    border: '2px solid transparent',
  },
  actionsRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  badge: {
    padding: `2px ${spacing.sm}`,
    backgroundColor: colors.bgTertiary,
    borderRadius: radius.sm,
    fontSize: typography.sizeXs,
    fontFamily: typography.fontFamily,
    color: colors.textMuted,
  },
  infoBox: {
    backgroundColor: colors.bgSecondary,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: typography.sizeSm,
    fontFamily: typography.fontFamily,
    color: colors.textSecondary,
    marginTop: spacing.lg,
  },
};

const PRESET_COLORS = [
  '#ff6b7a', '#ff8f6b', '#ffb366', '#ffdd59',
  '#7bed9f', '#66ddb3', '#6c9bff', '#5352ed',
  '#a55eea', '#ff6b81', '#70a1ff', '#eccc68',
  '#ff7f50', '#20bf6b', '#0fb9b1', '#778ca3',
];

export default function CultureEditor({ cultures, onChange }) {
  const [expandedCultures, setExpandedCultures] = useState({});

  // Use stable key for expand/collapse tracking (falls back to id for existing cultures)
  const getStableKey = (culture) => culture._key || culture.id;

  const toggleCulture = (stableKey) => {
    setExpandedCultures((prev) => ({ ...prev, [stableKey]: !prev[stableKey] }));
  };

  const addCulture = () => {
    const stableKey = `culture_${Date.now()}`;
    const newCulture = {
      id: stableKey,
      name: 'New Culture',
      description: '',
      color: PRESET_COLORS[cultures.length % PRESET_COLORS.length],
      _key: stableKey, // Stable key for React, never changes
    };
    onChange([...cultures, newCulture]);
    setExpandedCultures((prev) => ({ ...prev, [stableKey]: true }));
  };

  const updateCulture = (cultureId, updates) => {
    onChange(
      cultures.map((c) => (c.id === cultureId ? { ...c, ...updates } : c))
    );
  };

  const deleteCulture = (cultureId) => {
    if (confirm('Delete this culture?')) {
      onChange(cultures.filter((c) => c.id !== cultureId));
    }
  };

  const getCultureSummary = (culture) => {
    const parts = [];
    if (culture.naming?.domains?.length) {
      parts.push(`${culture.naming.domains.length} domains`);
    }
    if (culture.axisBiases && Object.keys(culture.axisBiases).length) {
      parts.push('axis biases');
    }
    return parts.length > 0 ? parts.join(', ') : 'not configured';
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.title}>Cultures</div>
        <div style={styles.subtitle}>
          Define cultural groups with their own naming conventions and placement biases.
        </div>
      </div>

      <div style={styles.toolbar}>
        <span style={styles.count}>
          {cultures.length} culture{cultures.length !== 1 ? 's' : ''}
        </span>
        <button style={styles.addButton} onClick={addCulture}>
          + Add Culture
        </button>
      </div>

      {cultures.length === 0 ? (
        <div style={styles.emptyState}>
          No cultures defined yet. Add one to give your world cultural diversity.
        </div>
      ) : (
        <div style={styles.cultureList}>
          {cultures.map((culture) => {
            const stableKey = getStableKey(culture);
            const isExpanded = expandedCultures[stableKey];

            return (
              <div key={stableKey} style={styles.cultureCard}>
                <div
                  style={styles.cultureHeader}
                  onClick={() => toggleCulture(stableKey)}
                >
                  <div style={styles.cultureHeaderLeft}>
                    <span
                      style={{
                        ...styles.expandIcon,
                        transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                      }}
                    >
                      ▶
                    </span>
                    <div
                      style={{ ...styles.colorDot, backgroundColor: culture.color }}
                    />
                    <span style={styles.cultureName}>{culture.name}</span>
                    <span style={styles.cultureId}>({culture.id})</span>
                  </div>
                  <div style={styles.cultureSummary}>
                    {getCultureSummary(culture)}
                  </div>
                </div>

                {isExpanded && (
                  <div style={styles.cultureBody}>
                    {/* Name and Description */}
                    <div style={styles.formRow}>
                      <div style={styles.formGroup}>
                        <label style={styles.label}>Name</label>
                        <input
                          style={styles.input}
                          value={culture.name}
                          onChange={(e) =>
                            updateCulture(culture.id, { name: e.target.value })
                          }
                          placeholder="Culture name"
                        />
                      </div>
                      <div style={styles.formGroup}>
                        <label style={styles.label}>ID</label>
                        <input
                          style={styles.input}
                          value={culture.id}
                          onChange={(e) => {
                            const newId = e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, '');
                            if (newId && !cultures.some((c) => c.id === newId && c.id !== culture.id)) {
                              // Just update the ID - expanded state uses stable _key, not id
                              updateCulture(culture.id, { id: newId });
                            }
                          }}
                          placeholder="culture-id"
                        />
                      </div>
                    </div>

                    <div style={styles.formRow}>
                      <div style={styles.formGroup}>
                        <label style={styles.label}>Description</label>
                        <input
                          style={styles.input}
                          value={culture.description || ''}
                          onChange={(e) =>
                            updateCulture(culture.id, { description: e.target.value })
                          }
                          placeholder="Optional description"
                        />
                      </div>
                    </div>

                    {/* Color Selection */}
                    <div style={styles.colorSection}>
                      <div
                        style={{
                          ...styles.colorPickerDot,
                          backgroundColor: culture.color,
                        }}
                      />
                      <div style={styles.colorPicker}>
                        {PRESET_COLORS.map((color) => (
                          <div
                            key={color}
                            style={{
                              ...styles.colorOption,
                              backgroundColor: color,
                              borderColor:
                                culture.color === color ? '#fff' : 'transparent',
                            }}
                            onClick={() => updateCulture(culture.id, { color })}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Info about other editors */}
                    <div style={styles.infoBox}>
                      <strong>Additional configuration:</strong>
                      <ul style={{ margin: '8px 0 0 16px', padding: 0 }}>
                        <li>
                          <strong>Names tab</strong> — Configure naming domains, grammars,
                          and profiles
                        </li>
                        <li>
                          <strong>Cosmography tab</strong> — Configure axis biases and home
                          regions
                        </li>
                      </ul>
                    </div>

                    {/* Actions */}
                    <div style={styles.actionsRow}>
                      <div style={{ display: 'flex', gap: spacing.sm }}>
                        {culture.naming && (
                          <span style={styles.badge}>has naming</span>
                        )}
                        {culture.axisBiases && (
                          <span style={styles.badge}>has biases</span>
                        )}
                      </div>
                      <button
                        style={styles.deleteButton}
                        onClick={() => deleteCulture(culture.id)}
                      >
                        Delete Culture
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
