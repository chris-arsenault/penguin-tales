/**
 * EraEditor - Edit era definitions
 *
 * Eras define the narrative periods of the simulation with themes
 * that influence rule weights.
 */

import React, { useState } from 'react';
import { colors, typography, spacing, radius, components } from '../theme.js';

const styles = {
  container: {
    maxWidth: '900px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.xxl,
  },
  headerContent: {
    flex: 1,
  },
  title: {
    fontSize: typography.sizeXxl,
    fontWeight: typography.weightSemibold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  description: {
    fontSize: typography.sizeMd,
    color: colors.textSecondary,
    lineHeight: '1.6',
  },
  addButton: {
    ...components.buttonPrimary,
    display: 'flex',
    alignItems: 'center',
    gap: spacing.xs,
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.md,
  },
  card: {
    ...components.card,
    overflow: 'hidden',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottom: `1px solid ${colors.border}`,
    cursor: 'pointer',
    transition: 'background-color 0.15s',
  },
  cardHeaderLeft: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    gap: spacing.md,
  },
  dragHandle: {
    color: colors.textMuted,
    cursor: 'grab',
    fontSize: typography.sizeLg,
  },
  cardTitle: {
    fontSize: typography.sizeLg,
    fontWeight: typography.weightSemibold,
    color: colors.textPrimary,
  },
  cardId: {
    fontSize: typography.sizeXs,
    color: colors.textMuted,
    fontFamily: 'monospace',
    marginLeft: spacing.sm,
  },
  cardMeta: {
    display: 'flex',
    gap: spacing.lg,
    fontSize: typography.sizeXs,
    color: colors.textSecondary,
  },
  badge: {
    display: 'inline-block',
    padding: `2px ${spacing.sm}`,
    fontSize: typography.sizeXs,
    backgroundColor: colors.bgTertiary,
    borderRadius: '10px',
    color: colors.textSecondary,
  },
  themeBadge: {
    display: 'inline-block',
    padding: `2px ${spacing.sm}`,
    fontSize: typography.sizeXs,
    backgroundColor: colors.accentSimulationLight,
    color: colors.bgPrimary,
    borderRadius: '10px',
    marginRight: spacing.xs,
  },
  cardActions: {
    display: 'flex',
    gap: spacing.sm,
    alignItems: 'center',
  },
  iconButton: {
    padding: spacing.xs,
    backgroundColor: 'transparent',
    border: 'none',
    color: colors.textMuted,
    cursor: 'pointer',
    fontSize: typography.sizeMd,
    borderRadius: radius.sm,
  },
  deleteButton: {
    color: colors.danger,
  },
  expandIcon: {
    fontSize: typography.sizeLg,
    color: colors.textMuted,
    transition: 'transform 0.2s',
  },
  cardBody: {
    padding: spacing.lg,
  },
  field: {
    marginBottom: spacing.md,
  },
  label: {
    fontSize: typography.sizeXs,
    fontWeight: typography.weightMedium,
    color: colors.textMuted,
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
    display: 'block',
  },
  input: {
    ...components.input,
  },
  textarea: {
    ...components.input,
    minHeight: '80px',
    resize: 'vertical',
    fontFamily: typography.fontFamily,
  },
  row: {
    display: 'grid',
    gridTemplateColumns: '2fr 1fr',
    gap: spacing.md,
  },
  row3: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr',
    gap: spacing.md,
  },
  themesContainer: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  themeTag: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: spacing.xs,
    padding: `${spacing.xs} ${spacing.sm}`,
    fontSize: typography.sizeSm,
    backgroundColor: colors.bgTertiary,
    color: colors.textSecondary,
    borderRadius: radius.sm,
    border: `1px solid ${colors.border}`,
  },
  themeRemove: {
    cursor: 'pointer',
    opacity: 0.6,
    fontSize: typography.sizeXs,
  },
  themeInput: {
    ...components.input,
    padding: `${spacing.xs} ${spacing.sm}`,
    fontSize: typography.sizeSm,
    width: '120px',
  },
  empty: {
    padding: spacing.xxxl,
    textAlign: 'center',
    color: colors.textMuted,
    backgroundColor: colors.bgSecondary,
    borderRadius: radius.lg,
    border: `2px dashed ${colors.border}`,
  },
  emptyIcon: {
    fontSize: '48px',
    marginBottom: spacing.md,
  },
  orderInfo: {
    fontSize: typography.sizeXs,
    color: colors.textMuted,
    marginTop: spacing.lg,
    padding: spacing.md,
    backgroundColor: colors.bgTertiary,
    borderRadius: radius.md,
    border: `1px solid ${colors.border}`,
  },
};

function generateEraId(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '') || `era_${Date.now()}`;
}

export default function EraEditor({ eras, onChange }) {
  const [expandedId, setExpandedId] = useState(null);
  const [newTheme, setNewTheme] = useState('');

  const handleAdd = () => {
    const newEra = {
      id: `era_${Date.now()}`,
      name: 'New Era',
      description: '',
      ticks: 20,
      themes: [],
    };
    onChange([...eras, newEra]);
    setExpandedId(newEra.id);
  };

  const handleDelete = (id) => {
    onChange(eras.filter((e) => e.id !== id));
    if (expandedId === id) setExpandedId(null);
  };

  const handleUpdate = (id, updates) => {
    onChange(eras.map((e) => (e.id === id ? { ...e, ...updates } : e)));
  };

  const handleMove = (index, direction) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= eras.length) return;
    const newEras = [...eras];
    [newEras[index], newEras[newIndex]] = [newEras[newIndex], newEras[index]];
    onChange(newEras);
  };

  const handleAddTheme = (id, theme) => {
    if (!theme.trim()) return;
    const era = eras.find((e) => e.id === id);
    if (!era) return;
    const themes = [...(era.themes || []), theme.trim().toLowerCase()];
    handleUpdate(id, { themes });
    setNewTheme('');
  };

  const handleRemoveTheme = (id, themeToRemove) => {
    const era = eras.find((e) => e.id === id);
    if (!era) return;
    const themes = (era.themes || []).filter((t) => t !== themeToRemove);
    handleUpdate(id, { themes });
  };

  const toggleExpand = (id) => {
    setExpandedId(expandedId === id ? null : id);
  };

  if (!eras || eras.length === 0) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <div style={styles.headerContent}>
            <h2 style={styles.title}>Eras</h2>
            <p style={styles.description}>
              Define the narrative periods of your world's history. Each era influences
              which rules fire and how pressures evolve.
            </p>
          </div>
          <button style={styles.addButton} onClick={handleAdd}>
            + Add Era
          </button>
        </div>
        <div style={styles.empty}>
          <div style={styles.emptyIcon}>📜</div>
          <div>No eras defined yet.</div>
          <div style={{ marginTop: spacing.sm, fontSize: typography.sizeSm }}>
            Add eras to create a narrative arc for your world's history.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.headerContent}>
          <h2 style={styles.title}>Eras</h2>
          <p style={styles.description}>
            Define the narrative periods of your world's history. Each era influences
            which rules fire and how pressures evolve.
          </p>
        </div>
        <button style={styles.addButton} onClick={handleAdd}>
          + Add Era
        </button>
      </div>

      <div style={styles.list}>
        {eras.map((era, index) => (
          <div key={era.id} style={styles.card}>
            <div style={styles.cardHeader} onClick={() => toggleExpand(era.id)}>
              <div style={styles.cardHeaderLeft}>
                <span style={styles.dragHandle}>☰</span>
                <div>
                  <span style={styles.cardTitle}>{era.name}</span>
                  <span style={styles.cardId}>{era.id}</span>
                  <div style={styles.cardMeta}>
                    <span style={styles.badge}>{era.ticks || 20} ticks</span>
                    <span>Era {index + 1} of {eras.length}</span>
                  </div>
                </div>
              </div>
              <div style={styles.cardActions}>
                <button
                  style={styles.iconButton}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleMove(index, -1);
                  }}
                  disabled={index === 0}
                  title="Move up"
                >
                  ▲
                </button>
                <button
                  style={styles.iconButton}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleMove(index, 1);
                  }}
                  disabled={index === eras.length - 1}
                  title="Move down"
                >
                  ▼
                </button>
                <button
                  style={{ ...styles.iconButton, ...styles.deleteButton }}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(era.id);
                  }}
                  title="Delete era"
                >
                  🗑
                </button>
                <span
                  style={{
                    ...styles.expandIcon,
                    transform: expandedId === era.id ? 'rotate(180deg)' : 'rotate(0deg)',
                  }}
                >
                  ▼
                </span>
              </div>
            </div>

            {expandedId === era.id && (
              <div style={styles.cardBody}>
                <div style={styles.row}>
                  <div style={styles.field}>
                    <label style={styles.label}>Name</label>
                    <input
                      type="text"
                      style={styles.input}
                      value={era.name}
                      onChange={(e) => handleUpdate(era.id, { name: e.target.value })}
                      placeholder="e.g., The Great Thaw"
                    />
                  </div>
                  <div style={styles.field}>
                    <label style={styles.label}>Ticks (duration)</label>
                    <input
                      type="number"
                      style={styles.input}
                      value={era.ticks || 20}
                      onChange={(e) =>
                        handleUpdate(era.id, { ticks: parseInt(e.target.value) || 20 })
                      }
                      min={1}
                    />
                  </div>
                </div>

                <div style={styles.field}>
                  <label style={styles.label}>ID (used in era weights)</label>
                  <input
                    type="text"
                    style={styles.input}
                    value={era.id}
                    onChange={(e) => handleUpdate(era.id, { id: e.target.value || era.id })}
                    placeholder="e.g., expansion"
                  />
                </div>

                <div style={styles.field}>
                  <label style={styles.label}>Description</label>
                  <textarea
                    style={styles.textarea}
                    value={era.description || ''}
                    onChange={(e) => handleUpdate(era.id, { description: e.target.value })}
                    placeholder="Describe the themes and events of this era..."
                  />
                </div>

                <div style={styles.field}>
                  <label style={styles.label}>Themes</label>
                  <div style={styles.themesContainer}>
                    {(era.themes || []).map((theme) => (
                      <span key={theme} style={styles.themeTag}>
                        {theme}
                        <span
                          style={styles.themeRemove}
                          onClick={() => handleRemoveTheme(era.id, theme)}
                        >
                          ✕
                        </span>
                      </span>
                    ))}
                    <input
                      type="text"
                      style={styles.themeInput}
                      value={newTheme}
                      onChange={(e) => setNewTheme(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddTheme(era.id, newTheme);
                        }
                      }}
                      onBlur={() => {
                        if (newTheme) handleAddTheme(era.id, newTheme);
                      }}
                      placeholder="+ Add theme"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div style={styles.orderInfo}>
        <strong>Era Order:</strong> Eras run in sequence from top to bottom. The simulation
        progresses through each era based on tick count. Configure era-specific rule weights
        in the "Era Weights" section.
      </div>
    </div>
  );
}
