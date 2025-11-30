/**
 * SettingsEditor - Edit simulation settings
 */

import React from 'react';
import { colors, typography, spacing, radius, components } from '../theme.js';

const styles = {
  container: {
    maxWidth: '600px',
  },
  header: {
    marginBottom: spacing.xxl,
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
  field: {
    marginBottom: spacing.lg,
  },
  label: {
    display: 'block',
    fontSize: typography.sizeSm,
    fontWeight: typography.weightMedium,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  hint: {
    fontSize: typography.sizeXs,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  input: {
    ...components.input,
    width: '200px',
  },
  row: {
    display: 'flex',
    gap: spacing.lg,
  },
};

export default function SettingsEditor({ settings, onChange }) {
  const handleChange = (field, value) => {
    onChange({
      ...settings,
      [field]: value,
    });
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>Simulation Settings</h2>
        <p style={styles.description}>
          Configure the core simulation parameters that control how the world generation runs.
        </p>
      </div>

      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>Timing</h3>

        <div style={styles.field}>
          <label style={styles.label}>Ticks per Era</label>
          <input
            type="number"
            style={styles.input}
            value={settings.ticksPerEra || 50}
            onChange={(e) => handleChange('ticksPerEra', parseInt(e.target.value) || 50)}
            min={1}
            max={1000}
          />
          <div style={styles.hint}>
            Number of simulation ticks in each era before transitioning. More ticks allow more
            growth and evolution.
          </div>
        </div>

        <div style={styles.field}>
          <label style={styles.label}>Growth to Simulation Ratio</label>
          <input
            type="number"
            style={styles.input}
            value={settings.growthSimulationRatio || 2}
            onChange={(e) => handleChange('growthSimulationRatio', parseInt(e.target.value) || 2)}
            min={1}
            max={10}
          />
          <div style={styles.hint}>
            Ratio of growth ticks to simulation ticks. A ratio of 2 means 2 growth ticks for every
            1 simulation tick.
          </div>
        </div>
      </div>

      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>Limits</h3>

        <div style={styles.field}>
          <label style={styles.label}>Maximum Entities</label>
          <input
            type="number"
            style={styles.input}
            value={settings.maxEntities || 500}
            onChange={(e) => handleChange('maxEntities', parseInt(e.target.value) || 500)}
            min={10}
            max={10000}
          />
          <div style={styles.hint}>
            Maximum total entities the simulation will create. Generation rules stop firing when
            this limit is reached.
          </div>
        </div>
      </div>

      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>Reproducibility</h3>

        <div style={styles.field}>
          <label style={styles.label}>Random Seed (optional)</label>
          <input
            type="number"
            style={styles.input}
            value={settings.randomSeed || ''}
            onChange={(e) =>
              handleChange('randomSeed', e.target.value ? parseInt(e.target.value) : undefined)
            }
            placeholder="Leave empty for random"
          />
          <div style={styles.hint}>
            Set a specific seed to generate reproducible worlds. Leave empty to use current time as
            seed.
          </div>
        </div>
      </div>
    </div>
  );
}
