/**
 * DistributionTargetsEditor - Edit coherence distribution targets
 */

import React from 'react';
import { colors, typography, spacing, radius, components } from '../theme.js';

const styles = {
  container: {
    maxWidth: '800px',
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
  card: {
    ...components.card,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  cardTitle: {
    fontSize: typography.sizeMd,
    fontWeight: typography.weightSemibold,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  row: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  row3: {
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
  },
  hint: {
    fontSize: typography.sizeXs,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  entityKindRow: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.bgTertiary,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
  },
  entityKindName: {
    flex: 1,
    fontSize: typography.sizeMd,
    fontWeight: typography.weightMedium,
    color: colors.textPrimary,
  },
  entityKindInput: {
    ...components.input,
    width: '100px',
  },
  relationshipRow: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.bgTertiary,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
  },
  relationshipName: {
    flex: 1,
    fontSize: typography.sizeMd,
    fontWeight: typography.weightMedium,
    color: colors.textPrimary,
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
    minWidth: '40px',
    textAlign: 'right',
  },
};

export default function DistributionTargetsEditor({ targets, schema, onChange }) {
  const entityKinds = schema.entityKinds || [];
  const relationshipKinds = schema.relationshipKinds || [];

  const handleUpdate = (path, value) => {
    const updated = { ...targets };
    const parts = path.split('.');
    let current = updated;

    for (let i = 0; i < parts.length - 1; i++) {
      if (!current[parts[i]]) {
        current[parts[i]] = {};
      }
      current = current[parts[i]];
    }

    current[parts[parts.length - 1]] = value;
    onChange(updated);
  };

  const handleEntityTarget = (kindId, total) => {
    const entities = { ...targets.entities };
    if (total === '' || total === 0) {
      delete entities[kindId];
    } else {
      entities[kindId] = { total: parseInt(total) || 0 };
    }
    onChange({ ...targets, entities });
  };

  const handleRelationshipCoverage = (kindId, coverage) => {
    const relationships = { ...targets.relationships };
    const coverageMap = { ...relationships.coverage };
    if (coverage === 0) {
      delete coverageMap[kindId];
    } else {
      coverageMap[kindId] = coverage;
    }
    relationships.coverage = coverageMap;
    onChange({ ...targets, relationships });
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>Distribution Targets</h2>
        <p style={styles.description}>
          Set coherence targets for the simulation. The coherence analyzer will validate
          that your rules can achieve these targets.
        </p>
      </div>

      {/* Entity Targets */}
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>Entity Distribution</h3>
        <p style={{ ...styles.description, marginBottom: spacing.lg }}>
          Target counts for each entity kind by the end of simulation.
        </p>

        {entityKinds.map((ek) => (
          <div key={ek.id} style={styles.entityKindRow}>
            <span style={styles.entityKindName}>{ek.name}</span>
            <input
              type="number"
              style={styles.entityKindInput}
              value={targets.entities?.[ek.id]?.total || ''}
              onChange={(e) => handleEntityTarget(ek.id, e.target.value)}
              placeholder="Count"
              min={0}
            />
          </div>
        ))}

        {entityKinds.length === 0 && (
          <div style={{ color: colors.textMuted, fontSize: typography.sizeSm }}>
            Define entity kinds in Enumerist to set targets.
          </div>
        )}
      </div>

      {/* Relationship Coverage */}
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>Relationship Coverage</h3>
        <p style={{ ...styles.description, marginBottom: spacing.lg }}>
          Target coverage (0-100%) for each relationship kind.
        </p>

        {relationshipKinds.map((rk) => (
          <div key={rk.id} style={styles.relationshipRow}>
            <span style={styles.relationshipName}>{rk.name}</span>
            <div style={styles.sliderContainer}>
              <input
                type="range"
                style={styles.slider}
                value={(targets.relationships?.coverage?.[rk.id] || 0) * 100}
                onChange={(e) => handleRelationshipCoverage(rk.id, parseFloat(e.target.value) / 100)}
                min={0}
                max={100}
              />
              <span style={styles.sliderValue}>
                {Math.round((targets.relationships?.coverage?.[rk.id] || 0) * 100)}%
              </span>
            </div>
          </div>
        ))}

        {relationshipKinds.length === 0 && (
          <div style={{ color: colors.textMuted, fontSize: typography.sizeSm }}>
            Define relationship kinds in Enumerist to set targets.
          </div>
        )}
      </div>

      {/* Connectivity */}
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>Connectivity</h3>

        <div style={styles.card}>
          <div style={styles.row}>
            <div style={styles.field}>
              <label style={styles.label}>Min Relationships per Entity</label>
              <input
                type="number"
                style={styles.input}
                value={targets.relationships?.connectivity?.minPerEntity || 1}
                onChange={(e) =>
                  handleUpdate(
                    'relationships.connectivity.minPerEntity',
                    parseInt(e.target.value) || 1
                  )
                }
                min={0}
              />
              <div style={styles.hint}>Minimum connections each entity should have</div>
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Max Hub Size</label>
              <input
                type="number"
                style={styles.input}
                value={targets.relationships?.connectivity?.maxHubSize || 20}
                onChange={(e) =>
                  handleUpdate(
                    'relationships.connectivity.maxHubSize',
                    parseInt(e.target.value) || 20
                  )
                }
                min={1}
              />
              <div style={styles.hint}>Maximum connections for any single entity</div>
            </div>
          </div>
        </div>
      </div>

      {/* Culture */}
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>Culture Representation</h3>

        <div style={styles.card}>
          <div style={styles.row}>
            <div style={styles.field}>
              <label style={styles.label}>Min Entities per Culture</label>
              <input
                type="number"
                style={styles.input}
                value={targets.cultures?.minEntitiesPerCulture || 5}
                onChange={(e) =>
                  handleUpdate('cultures.minEntitiesPerCulture', parseInt(e.target.value) || 5)
                }
                min={0}
              />
              <div style={styles.hint}>Minimum entities each culture should have</div>
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Max Variance</label>
              <input
                type="number"
                style={styles.input}
                value={targets.cultures?.maxVariance || 0.3}
                onChange={(e) =>
                  handleUpdate('cultures.maxVariance', parseFloat(e.target.value) || 0.3)
                }
                min={0}
                max={1}
                step={0.1}
              />
              <div style={styles.hint}>Maximum allowed variance in culture distribution (0-1)</div>
            </div>
          </div>
        </div>
      </div>

      {/* Temporal */}
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>Temporal Distribution</h3>

        <div style={styles.card}>
          <div style={styles.row}>
            <div style={styles.field}>
              <label style={styles.label}>Min Entities per Era</label>
              <input
                type="number"
                style={styles.input}
                value={targets.temporal?.minEntitiesPerEra || 10}
                onChange={(e) =>
                  handleUpdate('temporal.minEntitiesPerEra', parseInt(e.target.value) || 10)
                }
                min={0}
              />
              <div style={styles.hint}>Minimum new entities created each era</div>
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Occurrences per Era</label>
              <input
                type="text"
                style={styles.input}
                value={
                  typeof targets.temporal?.occurrencesPerEra === 'object'
                    ? `${targets.temporal.occurrencesPerEra.min}-${targets.temporal.occurrencesPerEra.max}`
                    : targets.temporal?.occurrencesPerEra || '3-10'
                }
                onChange={(e) => {
                  const match = e.target.value.match(/^(\d+)-(\d+)$/);
                  if (match) {
                    handleUpdate('temporal.occurrencesPerEra', {
                      min: parseInt(match[1]),
                      max: parseInt(match[2]),
                    });
                  } else {
                    handleUpdate('temporal.occurrencesPerEra', parseInt(e.target.value) || 5);
                  }
                }}
                placeholder="e.g., 3-10 or 5"
              />
              <div style={styles.hint}>Target occurrences (events) per era</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
