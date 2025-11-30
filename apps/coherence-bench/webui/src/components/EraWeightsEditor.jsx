/**
 * EraWeightsEditor - Edit per-era rule weights and pressure drifts
 */

import React, { useState } from 'react';
import { colors, typography, spacing, radius, components } from '../theme.js';

const styles = {
  container: {
    maxWidth: '1000px',
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
  tabBar: {
    display: 'flex',
    gap: spacing.xs,
    marginBottom: spacing.xl,
    borderBottom: `1px solid ${colors.border}`,
    paddingBottom: spacing.sm,
    flexWrap: 'wrap',
  },
  tab: {
    padding: `${spacing.sm} ${spacing.lg}`,
    fontSize: typography.sizeMd,
    fontWeight: typography.weightMedium,
    fontFamily: typography.fontFamily,
    border: 'none',
    borderRadius: `${radius.md} ${radius.md} 0 0`,
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  tabActive: {
    backgroundColor: colors.accentEnumerist,
    color: colors.bgSidebar,
  },
  tabInactive: {
    backgroundColor: 'transparent',
    color: colors.textSecondary,
  },
  tabDeleteButton: {
    marginLeft: spacing.sm,
    padding: '2px 6px',
    fontSize: typography.sizeXs,
    backgroundColor: 'transparent',
    border: 'none',
    color: 'inherit',
    cursor: 'pointer',
    opacity: 0.7,
  },
  section: {
    marginBottom: spacing.xxl,
  },
  sectionTitle: {
    fontSize: typography.sizeLg,
    fontWeight: typography.weightSemibold,
    color: colors.textPrimary,
    marginBottom: spacing.lg,
    borderBottom: `1px solid ${colors.border}`,
    paddingBottom: spacing.sm,
  },
  ruleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.bgSecondary,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
  },
  ruleName: {
    flex: 1,
    fontSize: typography.sizeMd,
    color: colors.textPrimary,
  },
  ruleId: {
    fontSize: typography.sizeXs,
    color: colors.textMuted,
    fontFamily: 'monospace',
  },
  sliderContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing.sm,
    width: '200px',
  },
  slider: {
    flex: 1,
    accentColor: colors.accentEnumerist,
  },
  sliderValue: {
    fontSize: typography.sizeSm,
    color: colors.textSecondary,
    minWidth: '50px',
    textAlign: 'right',
  },
  pressureRow: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.bgSecondary,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
  },
  pressureName: {
    flex: 1,
    fontSize: typography.sizeMd,
    color: colors.textPrimary,
  },
  driftInput: {
    ...components.input,
    width: '100px',
    textAlign: 'center',
  },
  driftLabel: {
    fontSize: typography.sizeXs,
    color: colors.textMuted,
    marginLeft: spacing.xs,
  },
  noRules: {
    padding: spacing.lg,
    textAlign: 'center',
    color: colors.textMuted,
    fontSize: typography.sizeSm,
    backgroundColor: colors.bgTertiary,
    borderRadius: radius.md,
  },
  eraSelect: {
    ...components.select,
    width: '200px',
  },
  addEraContainer: {
    display: 'flex',
    gap: spacing.md,
    alignItems: 'center',
    padding: spacing.lg,
    backgroundColor: colors.bgSecondary,
    borderRadius: radius.md,
  },
};

export default function EraWeightsEditor({
  eraRuleWeights,
  eras,
  generationRules,
  simulationRules,
  pressures,
  onChange,
}) {
  const [activeEra, setActiveEra] = useState(Object.keys(eraRuleWeights || {})[0] || null);
  const [newEraId, setNewEraId] = useState('');

  // Get eras that don't have weights yet
  const availableEras = eras.filter((era) => !eraRuleWeights?.[era.id]);

  const handleAddEra = () => {
    if (!newEraId) return;

    const newWeights = {
      eraId: newEraId,
      generationWeights: {},
      simulationWeights: {},
      pressureDrift: {},
    };

    // Initialize all rules with weight 1
    generationRules.forEach((rule) => {
      newWeights.generationWeights[rule.id] = 1;
    });
    simulationRules.forEach((rule) => {
      newWeights.simulationWeights[rule.id] = 1;
    });
    pressures.forEach((pressure) => {
      newWeights.pressureDrift[pressure.id] = 0;
    });

    onChange({
      ...eraRuleWeights,
      [newEraId]: newWeights,
    });

    setActiveEra(newEraId);
    setNewEraId('');
  };

  const handleDeleteEra = (eraId) => {
    const updated = { ...eraRuleWeights };
    delete updated[eraId];
    onChange(updated);

    if (activeEra === eraId) {
      setActiveEra(Object.keys(updated)[0] || null);
    }
  };

  const handleWeightChange = (eraId, ruleType, ruleId, weight) => {
    const eraWeights = eraRuleWeights[eraId] || {};
    const weightsKey = ruleType === 'generation' ? 'generationWeights' : 'simulationWeights';

    onChange({
      ...eraRuleWeights,
      [eraId]: {
        ...eraWeights,
        [weightsKey]: {
          ...eraWeights[weightsKey],
          [ruleId]: weight,
        },
      },
    });
  };

  const handleDriftChange = (eraId, pressureId, drift) => {
    const eraWeights = eraRuleWeights[eraId] || {};

    onChange({
      ...eraRuleWeights,
      [eraId]: {
        ...eraWeights,
        pressureDrift: {
          ...eraWeights.pressureDrift,
          [pressureId]: drift,
        },
      },
    });
  };

  const eraIds = Object.keys(eraRuleWeights || {});
  const currentWeights = activeEra ? eraRuleWeights[activeEra] : null;

  const getEraName = (eraId) => {
    const era = eras.find((e) => e.id === eraId);
    return era?.name || eraId;
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.headerContent}>
          <h2 style={styles.title}>Era Rule Weights</h2>
          <p style={styles.description}>
            Configure which rules fire and their relative weights during each era.
            Higher weights make rules more likely to be selected.
          </p>
        </div>
      </div>

      {/* Era Tabs */}
      {eraIds.length > 0 && (
        <div style={styles.tabBar}>
          {eraIds.map((eraId) => (
            <button
              key={eraId}
              style={{
                ...styles.tab,
                ...(activeEra === eraId ? styles.tabActive : styles.tabInactive),
              }}
              onClick={() => setActiveEra(eraId)}
            >
              {getEraName(eraId)}
              <span
                style={styles.tabDeleteButton}
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteEra(eraId);
                }}
              >
                ✕
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Add Era Section */}
      {(availableEras.length > 0 || eras.length === 0) && (
        <div style={styles.addEraContainer}>
          {eras.length > 0 ? (
            <>
              <select
                style={styles.eraSelect}
                value={newEraId}
                onChange={(e) => setNewEraId(e.target.value)}
              >
                <option value="">Select era to configure...</option>
                {availableEras.map((era) => (
                  <option key={era.id} value={era.id}>
                    {era.name}
                  </option>
                ))}
              </select>
              <button
                style={styles.addButton}
                onClick={handleAddEra}
                disabled={!newEraId}
              >
                + Configure Era
              </button>
            </>
          ) : (
            <div style={{ color: colors.textMuted }}>
              Define eras in Cosmographer first, then configure their weights here.
            </div>
          )}
        </div>
      )}

      {/* Era Content */}
      {currentWeights && (
        <>
          {/* Generation Rules */}
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>Generation Rules</h3>
            {generationRules.length === 0 ? (
              <div style={styles.noRules}>
                No generation rules defined. Add rules in the Generation Rules section.
              </div>
            ) : (
              generationRules.map((rule) => (
                <div key={rule.id} style={styles.ruleRow}>
                  <div style={{ flex: 1 }}>
                    <div style={styles.ruleName}>{rule.name}</div>
                    <div style={styles.ruleId}>{rule.id}</div>
                  </div>
                  <div style={styles.sliderContainer}>
                    <input
                      type="range"
                      style={styles.slider}
                      value={currentWeights.generationWeights?.[rule.id] ?? 1}
                      onChange={(e) =>
                        handleWeightChange(
                          activeEra,
                          'generation',
                          rule.id,
                          parseFloat(e.target.value)
                        )
                      }
                      min={0}
                      max={5}
                      step={0.1}
                    />
                    <span style={styles.sliderValue}>
                      {(currentWeights.generationWeights?.[rule.id] ?? 1).toFixed(1)}x
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Simulation Rules */}
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>Simulation Rules</h3>
            {simulationRules.length === 0 ? (
              <div style={styles.noRules}>
                No simulation rules defined. Add rules in the Simulation Rules section.
              </div>
            ) : (
              simulationRules.map((rule) => (
                <div key={rule.id} style={styles.ruleRow}>
                  <div style={{ flex: 1 }}>
                    <div style={styles.ruleName}>{rule.name}</div>
                    <div style={styles.ruleId}>{rule.id}</div>
                  </div>
                  <div style={styles.sliderContainer}>
                    <input
                      type="range"
                      style={styles.slider}
                      value={currentWeights.simulationWeights?.[rule.id] ?? 1}
                      onChange={(e) =>
                        handleWeightChange(
                          activeEra,
                          'simulation',
                          rule.id,
                          parseFloat(e.target.value)
                        )
                      }
                      min={0}
                      max={5}
                      step={0.1}
                    />
                    <span style={styles.sliderValue}>
                      {(currentWeights.simulationWeights?.[rule.id] ?? 1).toFixed(1)}x
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Pressure Drifts */}
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>Pressure Drifts</h3>
            <p style={{ ...styles.description, marginBottom: spacing.lg }}>
              Per-tick drift applied to each pressure during this era.
            </p>
            {pressures.length === 0 ? (
              <div style={styles.noRules}>
                No pressures defined. Add pressures in the Pressures section.
              </div>
            ) : (
              pressures.map((pressure) => (
                <div key={pressure.id} style={styles.pressureRow}>
                  <div style={{ flex: 1 }}>
                    <div style={styles.pressureName}>{pressure.name}</div>
                    <div style={styles.ruleId}>{pressure.id}</div>
                  </div>
                  <input
                    type="number"
                    style={styles.driftInput}
                    value={currentWeights.pressureDrift?.[pressure.id] ?? 0}
                    onChange={(e) =>
                      handleDriftChange(
                        activeEra,
                        pressure.id,
                        parseFloat(e.target.value) || 0
                      )
                    }
                    step={0.1}
                  />
                  <span style={styles.driftLabel}>per tick</span>
                </div>
              ))
            )}
          </div>
        </>
      )}

      {/* Empty State */}
      {eraIds.length === 0 && eras.length > 0 && (
        <div style={styles.empty}>
          <div style={styles.emptyIcon}>⚙️</div>
          <div>No era weights configured yet.</div>
          <div style={{ marginTop: spacing.sm, fontSize: typography.sizeSm }}>
            Select an era above to configure its rule weights.
          </div>
        </div>
      )}
    </div>
  );
}
