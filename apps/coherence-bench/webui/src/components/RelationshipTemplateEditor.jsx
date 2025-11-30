/**
 * RelationshipTemplateEditor - Edit relationship creation templates
 */

import React from 'react';
import { colors, typography, spacing, radius, components } from '../theme.js';

/**
 * Format an EntityRef for display
 * EntityRef can be: string | { ref: string } | { query: EntityQuery } | { random: EntityQuery }
 */
function formatEntityRef(ref) {
  if (!ref) return '?';
  if (typeof ref === 'string') return ref;
  if (ref.ref) return ref.ref;
  if (ref.query) return `query:${ref.query.kind}${ref.query.subtype ? '/' + ref.query.subtype : ''}`;
  if (ref.random) return `random:${ref.random.kind}${ref.random.subtype ? '/' + ref.random.subtype : ''}`;
  return JSON.stringify(ref);
}

/**
 * Get the simple ref string from an EntityRef (for editing)
 */
function getRefValue(ref) {
  if (!ref) return '';
  if (typeof ref === 'string') return ref;
  if (ref.ref) return ref.ref;
  // For complex refs, we can't edit them simply - show as JSON
  return JSON.stringify(ref);
}

/**
 * Parse a ref string back to EntityRef
 * If it looks like JSON, parse it; otherwise treat as simple ref
 */
function parseRefValue(value) {
  if (!value) return undefined;
  // Try to parse as JSON for complex refs
  if (value.startsWith('{') || value.startsWith('[')) {
    try {
      return JSON.parse(value);
    } catch {
      // Not valid JSON, treat as simple ref
    }
  }
  // Simple ref - just the string or wrap in { ref: } for consistency
  return { ref: value };
}

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
    gap: spacing.sm,
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
    marginBottom: spacing.sm,
  },
  itemTitle: {
    fontSize: typography.sizeSm,
    fontWeight: typography.weightMedium,
    color: colors.textSecondary,
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
  hint: {
    fontSize: typography.sizeXs,
    color: colors.textMuted,
    marginTop: '2px',
  },
};

export default function RelationshipTemplateEditor({
  templates,
  relationshipKinds,
  entityRefs,
  onChange,
}) {
  const handleDelete = (index) => {
    onChange(templates.filter((_, i) => i !== index));
  };

  const handleUpdate = (index, updates) => {
    onChange(templates.map((t, i) => (i === index ? { ...t, ...updates } : t)));
  };

  if (!templates || templates.length === 0) {
    return <div style={styles.empty}>No relationships to create</div>;
  }

  return (
    <div style={styles.list}>
      {templates.map((template, index) => (
        <div key={index} style={styles.item}>
          <div style={styles.itemHeader}>
            <span style={styles.itemTitle}>
              {formatEntityRef(template.from)} → {template.kind || '?'} → {formatEntityRef(template.to)}
            </span>
            <button style={styles.deleteButton} onClick={() => handleDelete(index)}>
              ✕
            </button>
          </div>

          <div style={styles.row}>
            <div style={styles.field}>
              <label style={styles.label}>Kind</label>
              <select
                style={styles.select}
                value={template.kind || ''}
                onChange={(e) => handleUpdate(index, { kind: e.target.value })}
              >
                <option value="">Select kind...</option>
                {relationshipKinds.map((rk) => (
                  <option key={rk.id} value={rk.id}>
                    {rk.name}
                  </option>
                ))}
              </select>
            </div>
            <div style={styles.field}>
              <label style={styles.label}>From</label>
              <input
                type="text"
                style={styles.input}
                value={getRefValue(template.from)}
                onChange={(e) => handleUpdate(index, { from: parseRefValue(e.target.value) })}
                placeholder="Entity ref or JSON"
                list={`refs-from-${index}`}
              />
              <datalist id={`refs-from-${index}`}>
                {entityRefs.map((ref) => (
                  <option key={ref} value={ref} />
                ))}
              </datalist>
            </div>
            <div style={styles.field}>
              <label style={styles.label}>To</label>
              <input
                type="text"
                style={styles.input}
                value={getRefValue(template.to)}
                onChange={(e) => handleUpdate(index, { to: parseRefValue(e.target.value) })}
                placeholder="Entity ref or JSON"
                list={`refs-to-${index}`}
              />
              <datalist id={`refs-to-${index}`}>
                {entityRefs.map((ref) => (
                  <option key={ref} value={ref} />
                ))}
              </datalist>
            </div>
          </div>

          <div style={styles.row2}>
            <div style={styles.field}>
              <label style={styles.label}>For Each</label>
              <select
                style={styles.select}
                value={template.forEach || ''}
                onChange={(e) =>
                  handleUpdate(index, { forEach: e.target.value || undefined })
                }
              >
                <option value="">One relationship</option>
                <option value="from">Each 'from' entity</option>
                <option value="to">Each 'to' entity</option>
              </select>
              <div style={styles.hint}>When refs resolve to multiple entities</div>
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Distance (0-1)</label>
              <input
                type="number"
                style={styles.input}
                value={template.distance ?? ''}
                onChange={(e) =>
                  handleUpdate(index, {
                    distance: e.target.value ? parseFloat(e.target.value) : undefined,
                  })
                }
                placeholder="Default: 0.5"
                min={0}
                max={1}
                step={0.1}
              />
              <div style={styles.hint}>Semantic closeness</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
