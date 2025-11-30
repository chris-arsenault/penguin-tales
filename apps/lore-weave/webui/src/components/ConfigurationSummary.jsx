/**
 * ConfigurationSummary - Displays a summary of all configuration for the simulation
 *
 * Shows what data has been configured in canonry and is available for the simulation.
 */

import React from 'react';

// Arctic Blue base theme with purple accent
const ACCENT_COLOR = '#6d28d9';

const styles = {
  container: {
    maxWidth: '1200px',
  },
  header: {
    marginBottom: '24px',
  },
  title: {
    fontSize: '24px',
    fontWeight: 600,
    color: '#ffffff',
    marginBottom: '8px',
  },
  subtitle: {
    fontSize: '14px',
    color: '#93c5fd',
  },
  validationBox: {
    padding: '16px 20px',
    borderRadius: '8px',
    marginBottom: '24px',
  },
  validationValid: {
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    border: '1px solid rgba(34, 197, 94, 0.3)',
  },
  validationInvalid: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
  },
  validationTitle: {
    fontSize: '16px',
    fontWeight: 600,
    marginBottom: '8px',
  },
  validationList: {
    margin: 0,
    paddingLeft: '20px',
    fontSize: '14px',
  },
  issueItem: {
    color: '#ef4444',
    marginBottom: '4px',
  },
  warningItem: {
    color: '#f59e0b',
    marginBottom: '4px',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: '16px',
    marginBottom: '24px',
  },
  statCard: {
    backgroundColor: '#1e3a5f',
    borderRadius: '8px',
    padding: '16px 20px',
    border: '1px solid rgba(59, 130, 246, 0.3)',
  },
  statLabel: {
    fontSize: '12px',
    color: '#60a5fa',
    marginBottom: '4px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  statValue: {
    fontSize: '28px',
    fontWeight: 600,
    color: '#ffffff',
  },
  statZero: {
    color: '#ef4444',
  },
  section: {
    marginBottom: '24px',
  },
  sectionTitle: {
    fontSize: '18px',
    fontWeight: 600,
    color: '#ffffff',
    marginBottom: '16px',
  },
  itemList: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
  },
  itemBadge: {
    padding: '6px 12px',
    backgroundColor: '#0a1929',
    border: '1px solid rgba(59, 130, 246, 0.3)',
    borderRadius: '6px',
    fontSize: '13px',
    color: '#93c5fd',
  },
  runButton: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 24px',
    fontSize: '15px',
    fontWeight: 600,
    backgroundColor: ACCENT_COLOR,
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  runButtonDisabled: {
    backgroundColor: '#1e3a5f',
    color: '#60a5fa',
    cursor: 'not-allowed',
  },
  detailCard: {
    backgroundColor: '#1e3a5f',
    borderRadius: '8px',
    padding: '16px 20px',
    border: '1px solid rgba(59, 130, 246, 0.3)',
    marginBottom: '12px',
  },
  detailHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px',
  },
  detailName: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#ffffff',
  },
  detailId: {
    fontSize: '11px',
    color: '#60a5fa',
    backgroundColor: '#0c1f2e',
    padding: '2px 6px',
    borderRadius: '4px',
    fontFamily: 'monospace',
  },
  detailDescription: {
    fontSize: '13px',
    color: '#93c5fd',
  },
  emptyState: {
    color: '#60a5fa',
    fontStyle: 'italic',
    fontSize: '14px',
  },
};

export default function ConfigurationSummary({
  schema,
  eras,
  pressures,
  generators,
  seedEntities,
  seedRelationships,
  namingData,
  semanticData,
  cultureVisuals,
  validation,
  onNavigateToRun,
}) {
  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Configuration Summary</h1>
        <p style={styles.subtitle}>
          Review the world configuration before running the simulation
        </p>
      </div>

      {/* Validation Status */}
      <div style={{
        ...styles.validationBox,
        ...(validation.isValid ? styles.validationValid : styles.validationInvalid),
      }}>
        <div style={{
          ...styles.validationTitle,
          color: validation.isValid ? '#22c55e' : '#ef4444',
        }}>
          {validation.isValid ? 'Configuration is ready' : 'Configuration incomplete'}
        </div>

        {validation.issues.length > 0 && (
          <ul style={styles.validationList}>
            {validation.issues.map((issue, i) => (
              <li key={i} style={styles.issueItem}>{issue}</li>
            ))}
          </ul>
        )}

        {validation.warnings.length > 0 && (
          <ul style={{ ...styles.validationList, marginTop: validation.issues.length > 0 ? '8px' : 0 }}>
            {validation.warnings.map((warning, i) => (
              <li key={i} style={styles.warningItem}>{warning}</li>
            ))}
          </ul>
        )}
      </div>

      {/* Stats Overview */}
      <div style={styles.statsGrid}>
        <StatCard label="Entity Kinds" value={validation.stats.entityKinds} />
        <StatCard label="Relationship Kinds" value={validation.stats.relationshipKinds} />
        <StatCard label="Cultures" value={validation.stats.cultures} />
        <StatCard label="Eras" value={validation.stats.eras} />
        <StatCard label="Pressures" value={validation.stats.pressures} />
        <StatCard label="Generators" value={validation.stats.generators} />
        <StatCard label="Seed Entities" value={validation.stats.seedEntities} />
        <StatCard label="Seed Relationships" value={validation.stats.seedRelationships} />
      </div>

      {/* Eras Detail */}
      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>Eras ({eras.length})</h2>
        {eras.length === 0 ? (
          <div style={styles.emptyState}>No eras defined. Configure eras in the Coherence Engine tab.</div>
        ) : (
          eras.map((era) => (
            <div key={era.id} style={styles.detailCard}>
              <div style={styles.detailHeader}>
                <span style={styles.detailName}>{era.name || era.id}</span>
                <span style={styles.detailId}>{era.id}</span>
              </div>
              {era.description && (
                <div style={styles.detailDescription}>{era.description}</div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Cultures */}
      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>Cultures ({schema.cultures.length})</h2>
        {schema.cultures.length === 0 ? (
          <div style={styles.emptyState}>No cultures defined. Configure cultures in the Enumerist tab.</div>
        ) : (
          <div style={styles.itemList}>
            {schema.cultures.map((culture) => (
              <span
                key={culture.id}
                style={{
                  ...styles.itemBadge,
                  borderColor: culture.color || '#3d3d4d',
                  color: culture.color || '#b0b0c0',
                }}
              >
                {culture.name}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Entity Kinds */}
      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>Entity Kinds ({schema.entityKinds.length})</h2>
        {schema.entityKinds.length === 0 ? (
          <div style={styles.emptyState}>No entity kinds defined. Configure entity kinds in the Enumerist tab.</div>
        ) : (
          <div style={styles.itemList}>
            {schema.entityKinds.map((ek) => (
              <span key={ek.id} style={styles.itemBadge}>
                {ek.name || ek.id}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Generators */}
      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>Generators ({generators.length})</h2>
        {generators.length === 0 ? (
          <div style={styles.emptyState}>No generators defined. Configure generators in the Coherence Engine tab.</div>
        ) : (
          <div style={styles.itemList}>
            {generators.map((gen) => (
              <span key={gen.id} style={styles.itemBadge}>
                {gen.name || gen.id}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Pressures */}
      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>Pressures ({pressures.length})</h2>
        {pressures.length === 0 ? (
          <div style={styles.emptyState}>No pressures defined. Configure pressures in the Coherence Engine tab.</div>
        ) : (
          <div style={styles.itemList}>
            {pressures.map((pressure) => (
              <span key={pressure.id} style={styles.itemBadge}>
                {pressure.name || pressure.id}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Run Button */}
      <button
        style={{
          ...styles.runButton,
          ...(validation.isValid ? {} : styles.runButtonDisabled),
        }}
        onClick={onNavigateToRun}
        disabled={!validation.isValid}
      >
        Continue to Run
      </button>
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div style={styles.statCard}>
      <div style={styles.statLabel}>{label}</div>
      <div style={{
        ...styles.statValue,
        ...(value === 0 ? styles.statZero : {}),
      }}>
        {value}
      </div>
    </div>
  );
}
