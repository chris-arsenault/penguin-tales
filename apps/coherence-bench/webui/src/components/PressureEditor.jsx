/**
 * PressureEditor - Edit pressure definitions
 *
 * Pressures are global state variables that influence rule triggering
 * and create feedback loops in the simulation.
 */

import React, { useState } from 'react';
import { colors, typography, spacing, radius, components } from '../theme.js';

// Available pressure modules for dynamic calculation
const PRESSURE_MODULES = {
  population_ratio_pressure: {
    name: 'Population Ratio',
    description: 'Pressure based on entity population ratios',
    params: {
      targetKind: { type: 'string', default: 'npc', description: 'Entity kind to measure' },
      referenceKind: { type: 'string', default: 'location', description: 'Reference entity kind' },
      targetRatio: { type: 'number', default: 5.0, description: 'Ideal ratio' },
      sensitivity: { type: 'number', default: 0.3, description: 'How quickly pressure changes' },
    },
  },
  ratio_equilibrium_pressure: {
    name: 'Ratio Equilibrium',
    description: 'Self-regulating pressure toward equilibrium',
    params: {
      targetKind: { type: 'string', default: 'faction', description: 'Entity kind to measure' },
      equilibriumCount: { type: 'number', default: 5, description: 'Target count' },
      pressurePerDeficit: { type: 'number', default: 15, description: 'Pressure per missing entity' },
      pressurePerSurplus: { type: 'number', default: 10, description: 'Negative pressure per extra' },
    },
  },
};

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
    padding: spacing.lg,
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
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
  },
  cardActions: {
    display: 'flex',
    gap: spacing.sm,
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
  row: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
  },
  label: {
    fontSize: typography.sizeXs,
    fontWeight: typography.weightMedium,
    color: colors.textMuted,
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
  },
  input: {
    ...components.input,
    fontSize: typography.sizeMd,
  },
  inputSmall: {
    ...components.input,
    fontSize: typography.sizeMd,
    width: '100px',
  },
  textarea: {
    ...components.input,
    minHeight: '60px',
    resize: 'vertical',
    fontFamily: typography.fontFamily,
  },
  rangeRow: {
    display: 'flex',
    gap: spacing.md,
    alignItems: 'center',
  },
  rangeLabel: {
    fontSize: typography.sizeXs,
    color: colors.textMuted,
  },
  visualRow: {
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.bgTertiary,
    borderRadius: radius.md,
  },
  slider: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing.md,
  },
  sliderTrack: {
    flex: 1,
    height: '8px',
    backgroundColor: colors.bgSecondary,
    borderRadius: '4px',
    position: 'relative',
    overflow: 'hidden',
  },
  sliderFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    height: '100%',
    backgroundColor: colors.accentEnumerist,
    transition: 'width 0.2s',
  },
  sliderValue: {
    fontSize: typography.sizeSm,
    color: colors.textSecondary,
    minWidth: '40px',
    textAlign: 'right',
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
  dynamicSection: {
    marginTop: spacing.lg,
    padding: spacing.md,
    backgroundColor: colors.bgTertiary,
    borderRadius: radius.md,
    border: `1px solid ${colors.border}`,
  },
  dynamicHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  dynamicLabel: {
    fontSize: typography.sizeXs,
    fontWeight: typography.weightSemibold,
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  checkbox: {
    marginRight: spacing.sm,
  },
  moduleItem: {
    backgroundColor: colors.bgSecondary,
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginTop: spacing.sm,
  },
  moduleHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  moduleName: {
    fontSize: typography.sizeSm,
    fontWeight: typography.weightMedium,
    color: colors.textPrimary,
  },
  moduleParams: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: spacing.xs,
  },
  paramField: {
    display: 'flex',
    flexDirection: 'column',
  },
  paramLabel: {
    fontSize: '10px',
    color: colors.textMuted,
    marginBottom: '1px',
  },
  paramInput: {
    ...components.input,
    padding: '4px 8px',
    fontSize: typography.sizeXs,
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
  moduleSelect: {
    ...components.select,
    padding: '4px 8px',
    fontSize: typography.sizeXs,
  },
  hint: {
    fontSize: typography.sizeXs,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
};

function generateId(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

function createNewPressure() {
  const id = `pressure_${Date.now()}`;
  return {
    id,
    name: 'New Pressure',
    description: '',
    initialValue: 50,
    range: { min: 0, max: 100 },
    equilibrium: 50,
    decayRate: 0.1,
  };
}

export default function PressureEditor({ pressures, onChange }) {
  const [expandedId, setExpandedId] = useState(null);

  const handleAdd = () => {
    const newPressure = createNewPressure();
    onChange([...pressures, newPressure]);
    setExpandedId(newPressure.id);
  };

  const handleDelete = (id) => {
    onChange(pressures.filter((p) => p.id !== id));
    if (expandedId === id) setExpandedId(null);
  };

  const handleUpdate = (id, updates) => {
    onChange(pressures.map((p) => (p.id === id ? { ...p, ...updates } : p)));
  };

  const handleNameChange = (id, name) => {
    const pressure = pressures.find((p) => p.id === id);
    // Auto-generate ID from name if it was auto-generated before
    const newId = pressure.id.startsWith('pressure_') ? generateId(name) || pressure.id : pressure.id;
    handleUpdate(id, { name, id: newId });
  };

  const calculateFillPercent = (pressure) => {
    const range = pressure.range.max - pressure.range.min;
    if (range === 0) return 0;
    return ((pressure.initialValue - pressure.range.min) / range) * 100;
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.headerContent}>
          <h2 style={styles.title}>Pressures</h2>
          <p style={styles.description}>
            Pressures are global state variables that create feedback loops in your simulation.
            Rules can check pressure values in conditions and modify them as effects.
          </p>
        </div>
        <button style={styles.addButton} onClick={handleAdd}>
          + Add Pressure
        </button>
      </div>

      {pressures.length === 0 ? (
        <div style={styles.empty}>
          <div style={styles.emptyIcon}>📊</div>
          <div>No pressures defined yet.</div>
          <div style={{ marginTop: spacing.sm, fontSize: typography.sizeSm }}>
            Add pressures to create dynamic feedback loops in your simulation.
          </div>
        </div>
      ) : (
        <div style={styles.list}>
          {pressures.map((pressure) => (
            <div key={pressure.id} style={styles.card}>
              <div style={styles.cardHeader}>
                <div>
                  <div style={styles.cardTitle}>{pressure.name}</div>
                  <div style={styles.cardId}>{pressure.id}</div>
                </div>
                <div style={styles.cardActions}>
                  <button
                    style={{ ...styles.iconButton, ...styles.deleteButton }}
                    onClick={() => handleDelete(pressure.id)}
                    title="Delete pressure"
                  >
                    🗑
                  </button>
                </div>
              </div>

              <div style={styles.row}>
                <div style={styles.field}>
                  <label style={styles.label}>Name</label>
                  <input
                    type="text"
                    style={styles.input}
                    value={pressure.name}
                    onChange={(e) => handleNameChange(pressure.id, e.target.value)}
                  />
                </div>
                <div style={styles.field}>
                  <label style={styles.label}>Initial Value</label>
                  <input
                    type="number"
                    style={styles.input}
                    value={pressure.initialValue}
                    onChange={(e) =>
                      handleUpdate(pressure.id, { initialValue: parseFloat(e.target.value) || 0 })
                    }
                  />
                </div>
                <div style={styles.field}>
                  <label style={styles.label}>Equilibrium</label>
                  <input
                    type="number"
                    style={styles.input}
                    value={pressure.equilibrium ?? ''}
                    onChange={(e) =>
                      handleUpdate(pressure.id, {
                        equilibrium: e.target.value ? parseFloat(e.target.value) : undefined,
                      })
                    }
                    placeholder="Optional"
                  />
                </div>
              </div>

              <div style={styles.row}>
                <div style={styles.field}>
                  <label style={styles.label}>Min</label>
                  <input
                    type="number"
                    style={styles.input}
                    value={pressure.range.min}
                    onChange={(e) =>
                      handleUpdate(pressure.id, {
                        range: { ...pressure.range, min: parseFloat(e.target.value) || 0 },
                      })
                    }
                  />
                </div>
                <div style={styles.field}>
                  <label style={styles.label}>Max</label>
                  <input
                    type="number"
                    style={styles.input}
                    value={pressure.range.max}
                    onChange={(e) =>
                      handleUpdate(pressure.id, {
                        range: { ...pressure.range, max: parseFloat(e.target.value) || 100 },
                      })
                    }
                  />
                </div>
                <div style={styles.field}>
                  <label style={styles.label}>Decay Rate</label>
                  <input
                    type="number"
                    style={styles.input}
                    value={pressure.decayRate ?? ''}
                    onChange={(e) =>
                      handleUpdate(pressure.id, {
                        decayRate: e.target.value ? parseFloat(e.target.value) : undefined,
                      })
                    }
                    placeholder="0.0 - 1.0"
                    step="0.05"
                    min="0"
                    max="1"
                  />
                </div>
              </div>

              <div style={styles.field}>
                <label style={styles.label}>Description</label>
                <textarea
                  style={styles.textarea}
                  value={pressure.description || ''}
                  onChange={(e) => handleUpdate(pressure.id, { description: e.target.value })}
                  placeholder="Describe what this pressure represents..."
                />
              </div>

              <div style={styles.visualRow}>
                <div style={styles.slider}>
                  <span style={styles.sliderValue}>{pressure.range.min}</span>
                  <div style={styles.sliderTrack}>
                    <div
                      style={{
                        ...styles.sliderFill,
                        width: `${calculateFillPercent(pressure)}%`,
                      }}
                    />
                  </div>
                  <span style={styles.sliderValue}>{pressure.range.max}</span>
                </div>
                <div
                  style={{
                    textAlign: 'center',
                    marginTop: spacing.xs,
                    fontSize: typography.sizeXs,
                    color: colors.textMuted,
                  }}
                >
                  Initial: {pressure.initialValue}
                  {pressure.equilibrium !== undefined && ` → Equilibrium: ${pressure.equilibrium}`}
                </div>
              </div>

              {/* Dynamic Calculation Section */}
              <div style={styles.dynamicSection}>
                <div style={styles.dynamicHeader}>
                  <label style={styles.dynamicLabel}>
                    <input
                      type="checkbox"
                      style={styles.checkbox}
                      checked={!!pressure.dynamicCalculation}
                      onChange={(e) => {
                        if (e.target.checked) {
                          handleUpdate(pressure.id, {
                            dynamicCalculation: {
                              moduleId: 'population_ratio_pressure',
                              params: { ...PRESSURE_MODULES.population_ratio_pressure.params },
                            },
                          });
                        } else {
                          handleUpdate(pressure.id, { dynamicCalculation: undefined });
                        }
                      }}
                    />
                    Enable Dynamic Calculation
                  </label>
                </div>
                {pressure.dynamicCalculation && (
                  <DynamicCalculationEditor
                    calculation={pressure.dynamicCalculation}
                    onUpdate={(updates) => handleUpdate(pressure.id, {
                      dynamicCalculation: { ...pressure.dynamicCalculation, ...updates },
                    })}
                  />
                )}
                {!pressure.dynamicCalculation && (
                  <div style={styles.hint}>
                    Enable dynamic calculation to have this pressure automatically adjust based on simulation state.
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Component for editing dynamic calculation
function DynamicCalculationEditor({ calculation, onUpdate }) {
  const moduleDef = PRESSURE_MODULES[calculation.moduleId];

  const handleModuleChange = (moduleId) => {
    const newModuleDef = PRESSURE_MODULES[moduleId];
    const defaultParams = {};
    Object.entries(newModuleDef.params).forEach(([key, def]) => {
      defaultParams[key] = def.default;
    });
    onUpdate({ moduleId, params: defaultParams });
  };

  const handleParamChange = (paramName, value) => {
    onUpdate({
      params: { ...calculation.params, [paramName]: value },
    });
  };

  return (
    <div style={styles.moduleItem}>
      <div style={styles.moduleHeader}>
        <select
          style={styles.moduleSelect}
          value={calculation.moduleId}
          onChange={(e) => handleModuleChange(e.target.value)}
        >
          {Object.entries(PRESSURE_MODULES).map(([id, def]) => (
            <option key={id} value={id}>{def.name}</option>
          ))}
        </select>
      </div>
      {moduleDef && (
        <>
          <div style={styles.hint}>{moduleDef.description}</div>
          <div style={styles.moduleParams}>
            {Object.entries(moduleDef.params).map(([paramName, paramDef]) => (
              <div key={paramName} style={styles.paramField}>
                <label style={styles.paramLabel} title={paramDef.description}>
                  {paramName}
                </label>
                {paramDef.type === 'number' && (
                  <input
                    type="number"
                    style={styles.paramInput}
                    value={calculation.params?.[paramName] ?? paramDef.default}
                    onChange={(e) => handleParamChange(paramName, parseFloat(e.target.value) || 0)}
                    step="0.1"
                  />
                )}
                {paramDef.type === 'string' && (
                  <input
                    type="text"
                    style={styles.paramInput}
                    value={calculation.params?.[paramName] ?? paramDef.default}
                    onChange={(e) => handleParamChange(paramName, e.target.value)}
                  />
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
