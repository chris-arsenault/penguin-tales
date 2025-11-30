/**
 * ConditionEditor - Edit rule conditions
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
    display: 'flex',
    gap: spacing.sm,
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  field: {
    flex: 1,
    minWidth: '120px',
  },
  label: {
    fontSize: typography.sizeXs,
    color: colors.textMuted,
    marginBottom: '2px',
    display: 'block',
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
  checkbox: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing.xs,
    fontSize: typography.sizeSm,
    color: colors.textSecondary,
  },
};

const CONDITION_TYPES = [
  { value: 'entity_count_below', label: 'Entity Count Below' },
  { value: 'entity_count_above', label: 'Entity Count Above' },
  { value: 'entity_exists', label: 'Entity Exists' },
  { value: 'pressure_above', label: 'Pressure Above' },
  { value: 'pressure_below', label: 'Pressure Below' },
  { value: 'pressure_range', label: 'Pressure Range' },
  { value: 'random_chance', label: 'Random Chance' },
  { value: 'current_era', label: 'Current Era' },
  { value: 'relationship_exists', label: 'Relationship Exists' },
];

export default function ConditionEditor({
  conditions,
  pressures,
  entityKinds,
  relationshipKinds,
  onChange,
}) {
  const handleDelete = (index) => {
    onChange(conditions.filter((_, i) => i !== index));
  };

  const handleUpdate = (index, updates) => {
    onChange(conditions.map((c, i) => (i === index ? { ...c, ...updates } : c)));
  };

  const handleParamChange = (index, paramName, value) => {
    const condition = conditions[index];
    handleUpdate(index, {
      params: { ...condition.params, [paramName]: value },
    });
  };

  const renderConditionParams = (condition, index) => {
    switch (condition.type) {
      case 'entity_count_below':
      case 'entity_count_above':
        return (
          <div style={styles.row}>
            <div style={styles.field}>
              <label style={styles.label}>Entity Kind</label>
              <select
                style={styles.select}
                value={condition.params?.kind || ''}
                onChange={(e) => handleParamChange(index, 'kind', e.target.value)}
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
              <label style={styles.label}>Count</label>
              <input
                type="number"
                style={styles.input}
                value={condition.params?.count || 0}
                onChange={(e) => handleParamChange(index, 'count', parseInt(e.target.value) || 0)}
                min={0}
              />
            </div>
          </div>
        );

      case 'entity_exists':
        return (
          <div style={styles.row}>
            <div style={styles.field}>
              <label style={styles.label}>Entity Kind</label>
              <select
                style={styles.select}
                value={condition.params?.kind || ''}
                onChange={(e) => handleParamChange(index, 'kind', e.target.value)}
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
              <label style={styles.label}>Status (optional)</label>
              <input
                type="text"
                style={styles.input}
                value={condition.params?.status || ''}
                onChange={(e) => handleParamChange(index, 'status', e.target.value)}
                placeholder="Any status"
              />
            </div>
          </div>
        );

      case 'pressure_above':
      case 'pressure_below':
        return (
          <div style={styles.row}>
            <div style={styles.field}>
              <label style={styles.label}>Pressure</label>
              <select
                style={styles.select}
                value={condition.params?.pressure || ''}
                onChange={(e) => handleParamChange(index, 'pressure', e.target.value)}
              >
                <option value="">Select pressure...</option>
                {pressures.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Value</label>
              <input
                type="number"
                style={styles.input}
                value={condition.params?.value || 0}
                onChange={(e) => handleParamChange(index, 'value', parseFloat(e.target.value) || 0)}
              />
            </div>
          </div>
        );

      case 'pressure_range':
        return (
          <div style={styles.row}>
            <div style={styles.field}>
              <label style={styles.label}>Pressure</label>
              <select
                style={styles.select}
                value={condition.params?.pressure || ''}
                onChange={(e) => handleParamChange(index, 'pressure', e.target.value)}
              >
                <option value="">Select pressure...</option>
                {pressures.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Min</label>
              <input
                type="number"
                style={styles.input}
                value={condition.params?.min || 0}
                onChange={(e) => handleParamChange(index, 'min', parseFloat(e.target.value) || 0)}
              />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Max</label>
              <input
                type="number"
                style={styles.input}
                value={condition.params?.max || 100}
                onChange={(e) => handleParamChange(index, 'max', parseFloat(e.target.value) || 100)}
              />
            </div>
          </div>
        );

      case 'random_chance':
        return (
          <div style={styles.row}>
            <div style={styles.field}>
              <label style={styles.label}>Chance (0-1)</label>
              <input
                type="number"
                style={styles.input}
                value={condition.params?.chance || 0.5}
                onChange={(e) =>
                  handleParamChange(index, 'chance', parseFloat(e.target.value) || 0.5)
                }
                min={0}
                max={1}
                step={0.05}
              />
            </div>
          </div>
        );

      case 'current_era':
        return (
          <div style={styles.row}>
            <div style={styles.field}>
              <label style={styles.label}>Era ID</label>
              <input
                type="text"
                style={styles.input}
                value={condition.params?.era || ''}
                onChange={(e) => handleParamChange(index, 'era', e.target.value)}
                placeholder="Enter era ID"
              />
            </div>
          </div>
        );

      case 'relationship_exists':
        return (
          <div style={styles.row}>
            <div style={styles.field}>
              <label style={styles.label}>Relationship Kind</label>
              <select
                style={styles.select}
                value={condition.params?.kind || ''}
                onChange={(e) => handleParamChange(index, 'kind', e.target.value)}
              >
                <option value="">Select kind...</option>
                {relationshipKinds.map((rk) => (
                  <option key={rk.id} value={rk.id}>
                    {rk.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        );

      default:
        return (
          <div style={{ color: colors.textMuted, fontSize: typography.sizeXs }}>
            Configure params in JSON mode
          </div>
        );
    }
  };

  if (!conditions || conditions.length === 0) {
    return (
      <div style={styles.empty}>
        No conditions - rule always fires when selected
      </div>
    );
  }

  return (
    <div style={styles.list}>
      {conditions.map((condition, index) => (
        <div key={index} style={styles.item}>
          <div style={styles.itemHeader}>
            <select
              style={styles.select}
              value={condition.type}
              onChange={(e) => handleUpdate(index, { type: e.target.value, params: {} })}
            >
              {CONDITION_TYPES.map((ct) => (
                <option key={ct.value} value={ct.value}>
                  {ct.label}
                </option>
              ))}
            </select>
            <div style={{ display: 'flex', gap: spacing.sm, alignItems: 'center' }}>
              <label style={styles.checkbox}>
                <input
                  type="checkbox"
                  checked={condition.negate || false}
                  onChange={(e) => handleUpdate(index, { negate: e.target.checked })}
                />
                NOT
              </label>
              <button style={styles.deleteButton} onClick={() => handleDelete(index)}>
                ✕
              </button>
            </div>
          </div>
          {renderConditionParams(condition, index)}
        </div>
      ))}
    </div>
  );
}
