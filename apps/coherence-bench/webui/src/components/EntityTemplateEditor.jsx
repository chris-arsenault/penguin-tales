/**
 * EntityTemplateEditor - Edit entity creation templates
 */

import React from 'react';
import { colors, typography, spacing, radius, components } from '../theme.js';

const styles = {
  empty: {
    padding: spacing.lg,
    textAlign: 'center',
    color: colors.textMuted,
    fontSize: typography.sizeSm,
    backgroundColor: colors.bgTertiary,
    borderRadius: radius.md,
    border: `1px dashed ${colors.border}`,
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.md,
  },
  item: {
    backgroundColor: colors.bgTertiary,
    borderRadius: radius.md,
    padding: spacing.md,
    border: `1px solid ${colors.border}`,
  },
  itemHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  itemTitle: {
    fontSize: typography.sizeSm,
    fontWeight: typography.weightMedium,
    color: colors.textPrimary,
    fontFamily: 'monospace',
  },
  deleteButton: {
    padding: '2px 6px',
    fontSize: typography.sizeXs,
    backgroundColor: 'transparent',
    color: colors.danger,
    border: 'none',
    cursor: 'pointer',
    borderRadius: radius.sm,
  },
  row: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  row2: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
  },
  label: {
    fontSize: typography.sizeXs,
    color: colors.textMuted,
    marginBottom: '2px',
    textTransform: 'uppercase',
  },
  select: {
    ...components.select,
    padding: `${spacing.xs} ${spacing.sm}`,
    fontSize: typography.sizeSm,
  },
  input: {
    ...components.input,
    padding: `${spacing.xs} ${spacing.sm}`,
    fontSize: typography.sizeSm,
  },
  textarea: {
    ...components.input,
    padding: `${spacing.xs} ${spacing.sm}`,
    fontSize: typography.sizeSm,
    minHeight: '40px',
    resize: 'vertical',
    fontFamily: typography.fontFamily,
  },
  placementSection: {
    backgroundColor: colors.bgSecondary,
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginTop: spacing.sm,
  },
  sectionLabel: {
    fontSize: typography.sizeXs,
    color: colors.textMuted,
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
    fontWeight: typography.weightSemibold,
  },
};

const PROMINENCE_LEVELS = [
  { value: 'forgotten', label: 'Forgotten' },
  { value: 'marginal', label: 'Marginal' },
  { value: 'recognized', label: 'Recognized' },
  { value: 'renowned', label: 'Renowned' },
  { value: 'mythic', label: 'Mythic' },
];

const COORDINATE_STRATEGIES = [
  { value: 'culture_aware', label: 'Culture Aware' },
  { value: 'region_center', label: 'Region Center' },
  { value: 'random', label: 'Random' },
];

export default function EntityTemplateEditor({ templates, entityKinds, cultures, onChange }) {
  const handleDelete = (index) => {
    onChange(templates.filter((_, i) => i !== index));
  };

  const handleUpdate = (index, updates) => {
    onChange(templates.map((t, i) => (i === index ? { ...t, ...updates } : t)));
  };

  const handlePlacementUpdate = (index, placementUpdates) => {
    const template = templates[index];
    handleUpdate(index, {
      placement: { ...template.placement, ...placementUpdates },
    });
  };

  const getSubtypes = (kindId) => {
    const kind = entityKinds.find((ek) => ek.id === kindId);
    return kind?.subtypes || [];
  };

  const getStatuses = (kindId) => {
    const kind = entityKinds.find((ek) => ek.id === kindId);
    return kind?.statuses || [];
  };

  if (!templates || templates.length === 0) {
    return <div style={styles.empty}>No entities to create</div>;
  }

  return (
    <div style={styles.list}>
      {templates.map((template, index) => (
        <div key={index} style={styles.item}>
          <div style={styles.itemHeader}>
            <span style={styles.itemTitle}>{template.ref || `entity_${index}`}</span>
            <button style={styles.deleteButton} onClick={() => handleDelete(index)}>
              ✕ Remove
            </button>
          </div>

          <div style={styles.row}>
            <div style={styles.field}>
              <label style={styles.label}>Ref Name</label>
              <input
                type="text"
                style={styles.input}
                value={template.ref || ''}
                onChange={(e) => handleUpdate(index, { ref: e.target.value })}
                placeholder="e.g., merchant"
              />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Kind</label>
              <select
                style={styles.select}
                value={template.kind || ''}
                onChange={(e) =>
                  handleUpdate(index, {
                    kind: e.target.value,
                    subtype: getSubtypes(e.target.value)[0]?.id || '',
                    status: getStatuses(e.target.value)[0]?.id || 'active',
                  })
                }
              >
                <option value="">Select kind...</option>
                {entityKinds.map((ek) => (
                  <option key={ek.id} value={ek.id}>
                    {ek.name}
                  </option>
                ))}
              </select>
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Subtype</label>
              <select
                style={styles.select}
                value={template.subtype || ''}
                onChange={(e) => handleUpdate(index, { subtype: e.target.value })}
              >
                <option value="">Select subtype...</option>
                {getSubtypes(template.kind).map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={styles.row}>
            <div style={styles.field}>
              <label style={styles.label}>Count</label>
              <input
                type="number"
                style={styles.input}
                value={typeof template.count === 'number' ? template.count : 1}
                onChange={(e) => handleUpdate(index, { count: parseInt(e.target.value) || 1 })}
                min={1}
              />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Status</label>
              <select
                style={styles.select}
                value={template.status || 'active'}
                onChange={(e) => handleUpdate(index, { status: e.target.value })}
              >
                {getStatuses(template.kind).map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.name}
                  </option>
                ))}
                {getStatuses(template.kind).length === 0 && (
                  <option value="active">Active</option>
                )}
              </select>
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Prominence</label>
              <select
                style={styles.select}
                value={template.prominence || 'marginal'}
                onChange={(e) => handleUpdate(index, { prominence: e.target.value })}
              >
                {PROMINENCE_LEVELS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={styles.placementSection}>
            <div style={styles.sectionLabel}>Placement</div>
            <div style={styles.row2}>
              <div style={styles.field}>
                <label style={styles.label}>Culture</label>
                <select
                  style={styles.select}
                  value={template.placement?.culture || 'random'}
                  onChange={(e) => handlePlacementUpdate(index, { culture: e.target.value })}
                >
                  <option value="random">Random Culture</option>
                  <option value="inherit">Inherit from Near</option>
                  {cultures.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Coordinate Strategy</label>
                <select
                  style={styles.select}
                  value={template.placement?.coordinateStrategy || 'culture_aware'}
                  onChange={(e) =>
                    handlePlacementUpdate(index, { coordinateStrategy: e.target.value })
                  }
                >
                  {COORDINATE_STRATEGIES.map((cs) => (
                    <option key={cs.value} value={cs.value}>
                      {cs.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div style={{ marginTop: spacing.sm }}>
            <div style={styles.field}>
              <label style={styles.label}>Tags (comma separated)</label>
              <input
                type="text"
                style={styles.input}
                value={(template.tags || []).join(', ')}
                onChange={(e) =>
                  handleUpdate(index, {
                    tags: e.target.value
                      .split(',')
                      .map((t) => t.trim())
                      .filter(Boolean),
                  })
                }
                placeholder="e.g., trader, wealthy, trusted"
              />
            </div>
          </div>

          <div style={{ marginTop: spacing.sm }}>
            <div style={styles.field}>
              <label style={styles.label}>Description Template</label>
              <textarea
                style={styles.textarea}
                value={template.descriptionTemplate || ''}
                onChange={(e) => handleUpdate(index, { descriptionTemplate: e.target.value })}
                placeholder="A {ref.subtype} from {ref.culture}..."
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
