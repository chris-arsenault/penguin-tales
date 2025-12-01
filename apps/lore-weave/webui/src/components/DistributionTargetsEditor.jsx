/**
 * DistributionTargetsEditor - Editor for statistical distribution targets
 *
 * Allows editing of distribution targets that guide the simulation toward
 * desired statistical outcomes for entity kinds, prominence, relationships,
 * and graph connectivity.
 */

import React, { useState, useCallback } from 'react';

// Arctic Blue base theme with purple accent
const ACCENT_COLOR = '#6d28d9';
const ACCENT_GRADIENT = 'linear-gradient(135deg, #6d28d9 0%, #8b5cf6 100%)';

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
  section: {
    marginBottom: '32px',
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '16px',
  },
  sectionTitle: {
    fontSize: '18px',
    fontWeight: 600,
    color: '#ffffff',
  },
  sectionDescription: {
    fontSize: '13px',
    color: '#60a5fa',
    marginBottom: '16px',
  },
  card: {
    backgroundColor: '#1e3a5f',
    borderRadius: '8px',
    padding: '20px',
    border: '1px solid rgba(59, 130, 246, 0.3)',
    marginBottom: '16px',
  },
  cardTitle: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#ffffff',
    marginBottom: '12px',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: '12px',
  },
  inputGroup: {
    marginBottom: '12px',
  },
  label: {
    display: 'block',
    fontSize: '12px',
    color: '#60a5fa',
    marginBottom: '4px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  input: {
    width: '100%',
    padding: '8px 12px',
    fontSize: '14px',
    backgroundColor: '#0a1929',
    border: '1px solid rgba(59, 130, 246, 0.3)',
    borderRadius: '6px',
    color: '#ffffff',
    outline: 'none',
  },
  smallInput: {
    width: '80px',
    padding: '6px 10px',
    fontSize: '13px',
    backgroundColor: '#0a1929',
    border: '1px solid rgba(59, 130, 246, 0.3)',
    borderRadius: '4px',
    color: '#ffffff',
    outline: 'none',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '8px 0',
    borderBottom: '1px solid rgba(59, 130, 246, 0.15)',
  },
  rowLabel: {
    flex: 1,
    fontSize: '13px',
    color: '#93c5fd',
  },
  rowValue: {
    fontSize: '13px',
    color: '#ffffff',
    fontFamily: 'monospace',
  },
  button: {
    padding: '8px 16px',
    fontSize: '13px',
    fontWeight: 500,
    backgroundColor: ACCENT_COLOR,
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  dangerButton: {
    backgroundColor: '#dc2626',
  },
  emptyState: {
    textAlign: 'center',
    padding: '40px 20px',
    color: '#60a5fa',
  },
  emptyStateTitle: {
    fontSize: '16px',
    fontWeight: 600,
    marginBottom: '8px',
    color: '#93c5fd',
  },
  emptyStateText: {
    fontSize: '14px',
    marginBottom: '16px',
  },
  tabs: {
    display: 'flex',
    gap: '4px',
    marginBottom: '20px',
    borderBottom: '1px solid rgba(59, 130, 246, 0.3)',
    paddingBottom: '12px',
  },
  tab: {
    padding: '8px 16px',
    fontSize: '13px',
    fontWeight: 500,
    backgroundColor: 'transparent',
    color: '#93c5fd',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  tabActive: {
    background: ACCENT_GRADIENT,
    color: 'white',
  },
  percentage: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
  },
  percentageBar: {
    width: '60px',
    height: '6px',
    backgroundColor: '#0a1929',
    borderRadius: '3px',
    overflow: 'hidden',
  },
  percentageFill: {
    height: '100%',
    backgroundColor: ACCENT_COLOR,
    borderRadius: '3px',
  },
  comment: {
    fontSize: '12px',
    color: '#60a5fa',
    fontStyle: 'italic',
    marginTop: '4px',
  },
};

const SUBTABS = [
  { id: 'global', label: 'Global Targets' },
  { id: 'entities', label: 'Entity Targets' },
  { id: 'eras', label: 'Per-Era Overrides' },
  { id: 'tuning', label: 'Tuning Parameters' },
];

export default function DistributionTargetsEditor({
  distributionTargets,
  schema,
  onDistributionTargetsChange,
}) {
  const [activeSubtab, setActiveSubtab] = useState('global');

  // Create default targets if none exist
  const createDefaultTargets = useCallback(() => {
    const defaultTargets = {
      $schema: 'Distribution targets for statistical world generation tuning',
      version: '1.0.0',
      global: {
        totalEntities: { target: 150, tolerance: 0.1 },
        entityKindDistribution: {
          type: 'uniform',
          targets: {},
          tolerance: 0.05,
        },
        prominenceDistribution: {
          type: 'normal',
          mean: 'recognized',
          stdDev: 1.0,
          targets: {
            forgotten: 0.10,
            marginal: 0.25,
            recognized: 0.30,
            renowned: 0.25,
            mythic: 0.10,
          },
        },
        relationshipDistribution: {
          type: 'diverse',
          maxSingleTypeRatio: 0.15,
          minTypesPresent: 12,
          minTypeRatio: 0.02,
        },
        graphConnectivity: {
          type: 'clustered',
          clusteringStrengthThreshold: 0.6,
          targetClusters: { min: 3, max: 8, preferred: 5 },
          clusterSizeDistribution: { type: 'powerlaw', alpha: 2.5 },
          densityTargets: { intraCluster: 0.65, interCluster: 0.12 },
          isolatedNodeRatio: { max: 0.05 },
        },
      },
      perEra: {},
      entities: [{}],
      tuning: {
        adjustmentSpeed: 0.3,
        deviationSensitivity: 1.5,
        minTemplateWeight: 0.05,
        maxTemplateWeight: 3.0,
        convergenceThreshold: 0.08,
        measurementInterval: 5,
        correctionStrength: {
          entityKind: 1.2,
          prominence: 0.8,
          relationship: 1.5,
          connectivity: 1.0,
        },
      },
      relationshipCategories: {},
    };

    // Populate entity kind targets from schema
    if (schema?.entityKinds) {
      const count = schema.entityKinds.length;
      const ratio = count > 0 ? 1.0 / count : 0;
      schema.entityKinds.forEach((ek) => {
        defaultTargets.global.entityKindDistribution.targets[ek.kind] = parseFloat(ratio.toFixed(2));
      });
    }

    onDistributionTargetsChange(defaultTargets);
  }, [schema, onDistributionTargetsChange]);

  // Update a nested path in the targets
  const updateTargets = useCallback((path, value) => {
    if (!distributionTargets) return;

    const newTargets = JSON.parse(JSON.stringify(distributionTargets));
    const parts = path.split('.');
    let current = newTargets;

    for (let i = 0; i < parts.length - 1; i++) {
      if (!current[parts[i]]) {
        current[parts[i]] = {};
      }
      current = current[parts[i]];
    }

    current[parts[parts.length - 1]] = value;
    onDistributionTargetsChange(newTargets);
  }, [distributionTargets, onDistributionTargetsChange]);

  // If no targets exist, show empty state
  if (!distributionTargets) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <h1 style={styles.title}>Distribution Targets</h1>
          <p style={styles.subtitle}>
            Configure statistical targets to guide world generation
          </p>
        </div>
        <div style={styles.emptyState}>
          <div style={styles.emptyStateTitle}>No Distribution Targets Configured</div>
          <div style={styles.emptyStateText}>
            Distribution targets guide the simulation toward desired statistical outcomes.
            They control entity kind ratios, prominence distribution, relationship diversity,
            and graph connectivity.
          </div>
          <button style={styles.button} onClick={createDefaultTargets}>
            Create Default Targets
          </button>
        </div>
      </div>
    );
  }

  const renderGlobalTargets = () => {
    const global = distributionTargets.global || {};

    return (
      <>
        {/* Total Entities */}
        <div style={styles.card}>
          <div style={styles.cardTitle}>Total Entities Target</div>
          <div style={styles.grid}>
            <div style={styles.inputGroup}>
              <label style={styles.label}>Target Count</label>
              <input
                type="number"
                style={styles.input}
                value={global.totalEntities?.target || 150}
                onChange={(e) => updateTargets('global.totalEntities.target', parseInt(e.target.value) || 0)}
              />
            </div>
            <div style={styles.inputGroup}>
              <label style={styles.label}>Tolerance (%)</label>
              <input
                type="number"
                step="0.01"
                style={styles.input}
                value={(global.totalEntities?.tolerance || 0.1) * 100}
                onChange={(e) => updateTargets('global.totalEntities.tolerance', (parseFloat(e.target.value) || 0) / 100)}
              />
            </div>
          </div>
        </div>

        {/* Entity Kind Distribution */}
        <div style={styles.card}>
          <div style={styles.cardTitle}>Entity Kind Distribution</div>
          <p style={styles.sectionDescription}>
            Target ratios for each entity kind (should sum to 1.0)
          </p>
          {Object.entries(global.entityKindDistribution?.targets || {}).map(([kind, ratio]) => (
            <div key={kind} style={styles.row}>
              <span style={styles.rowLabel}>{kind}</span>
              <div style={styles.percentage}>
                <div style={styles.percentageBar}>
                  <div style={{ ...styles.percentageFill, width: `${ratio * 100}%` }} />
                </div>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="1"
                  style={styles.smallInput}
                  value={ratio}
                  onChange={(e) => {
                    const newTargets = { ...global.entityKindDistribution.targets, [kind]: parseFloat(e.target.value) || 0 };
                    updateTargets('global.entityKindDistribution.targets', newTargets);
                  }}
                />
              </div>
            </div>
          ))}
          <div style={{ marginTop: '12px' }}>
            <span style={{ fontSize: '12px', color: '#60a5fa' }}>
              Total: {Object.values(global.entityKindDistribution?.targets || {}).reduce((a, b) => a + b, 0).toFixed(2)}
            </span>
          </div>
        </div>

        {/* Prominence Distribution */}
        <div style={styles.card}>
          <div style={styles.cardTitle}>Prominence Distribution</div>
          <p style={styles.sectionDescription}>
            Target ratios for prominence levels (should sum to 1.0)
          </p>
          {Object.entries(global.prominenceDistribution?.targets || {}).map(([level, ratio]) => (
            <div key={level} style={styles.row}>
              <span style={styles.rowLabel}>{level}</span>
              <div style={styles.percentage}>
                <div style={styles.percentageBar}>
                  <div style={{ ...styles.percentageFill, width: `${ratio * 100}%` }} />
                </div>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="1"
                  style={styles.smallInput}
                  value={ratio}
                  onChange={(e) => {
                    const newTargets = { ...global.prominenceDistribution.targets, [level]: parseFloat(e.target.value) || 0 };
                    updateTargets('global.prominenceDistribution.targets', newTargets);
                  }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Relationship Distribution */}
        <div style={styles.card}>
          <div style={styles.cardTitle}>Relationship Distribution</div>
          <div style={styles.grid}>
            <div style={styles.inputGroup}>
              <label style={styles.label}>Max Single Type Ratio</label>
              <input
                type="number"
                step="0.01"
                style={styles.input}
                value={global.relationshipDistribution?.maxSingleTypeRatio || 0.15}
                onChange={(e) => updateTargets('global.relationshipDistribution.maxSingleTypeRatio', parseFloat(e.target.value) || 0)}
              />
              <div style={styles.comment}>Prevents any one relationship type from dominating</div>
            </div>
            <div style={styles.inputGroup}>
              <label style={styles.label}>Min Types Present</label>
              <input
                type="number"
                style={styles.input}
                value={global.relationshipDistribution?.minTypesPresent || 12}
                onChange={(e) => updateTargets('global.relationshipDistribution.minTypesPresent', parseInt(e.target.value) || 0)}
              />
              <div style={styles.comment}>Minimum number of different relationship types</div>
            </div>
            <div style={styles.inputGroup}>
              <label style={styles.label}>Min Type Ratio</label>
              <input
                type="number"
                step="0.01"
                style={styles.input}
                value={global.relationshipDistribution?.minTypeRatio || 0.02}
                onChange={(e) => updateTargets('global.relationshipDistribution.minTypeRatio', parseFloat(e.target.value) || 0)}
              />
              <div style={styles.comment}>Minimum ratio for any present relationship type</div>
            </div>
          </div>
        </div>

        {/* Graph Connectivity */}
        <div style={styles.card}>
          <div style={styles.cardTitle}>Graph Connectivity</div>
          <div style={styles.grid}>
            <div style={styles.inputGroup}>
              <label style={styles.label}>Target Clusters (Min)</label>
              <input
                type="number"
                style={styles.input}
                value={global.graphConnectivity?.targetClusters?.min || 3}
                onChange={(e) => updateTargets('global.graphConnectivity.targetClusters.min', parseInt(e.target.value) || 0)}
              />
            </div>
            <div style={styles.inputGroup}>
              <label style={styles.label}>Target Clusters (Max)</label>
              <input
                type="number"
                style={styles.input}
                value={global.graphConnectivity?.targetClusters?.max || 8}
                onChange={(e) => updateTargets('global.graphConnectivity.targetClusters.max', parseInt(e.target.value) || 0)}
              />
            </div>
            <div style={styles.inputGroup}>
              <label style={styles.label}>Target Clusters (Preferred)</label>
              <input
                type="number"
                style={styles.input}
                value={global.graphConnectivity?.targetClusters?.preferred || 5}
                onChange={(e) => updateTargets('global.graphConnectivity.targetClusters.preferred', parseInt(e.target.value) || 0)}
              />
            </div>
            <div style={styles.inputGroup}>
              <label style={styles.label}>Clustering Threshold</label>
              <input
                type="number"
                step="0.1"
                style={styles.input}
                value={global.graphConnectivity?.clusteringStrengthThreshold || 0.6}
                onChange={(e) => updateTargets('global.graphConnectivity.clusteringStrengthThreshold', parseFloat(e.target.value) || 0)}
              />
              <div style={styles.comment}>Relationship strength needed to form clusters</div>
            </div>
            <div style={styles.inputGroup}>
              <label style={styles.label}>Intra-Cluster Density</label>
              <input
                type="number"
                step="0.01"
                style={styles.input}
                value={global.graphConnectivity?.densityTargets?.intraCluster || 0.65}
                onChange={(e) => updateTargets('global.graphConnectivity.densityTargets.intraCluster', parseFloat(e.target.value) || 0)}
              />
            </div>
            <div style={styles.inputGroup}>
              <label style={styles.label}>Inter-Cluster Density</label>
              <input
                type="number"
                step="0.01"
                style={styles.input}
                value={global.graphConnectivity?.densityTargets?.interCluster || 0.12}
                onChange={(e) => updateTargets('global.graphConnectivity.densityTargets.interCluster', parseFloat(e.target.value) || 0)}
              />
            </div>
            <div style={styles.inputGroup}>
              <label style={styles.label}>Max Isolated Node Ratio</label>
              <input
                type="number"
                step="0.01"
                style={styles.input}
                value={global.graphConnectivity?.isolatedNodeRatio?.max || 0.05}
                onChange={(e) => updateTargets('global.graphConnectivity.isolatedNodeRatio.max', parseFloat(e.target.value) || 0)}
              />
              <div style={styles.comment}>Maximum percentage of unconnected nodes</div>
            </div>
          </div>
        </div>
      </>
    );
  };

  const renderEntityTargets = () => {
    const entities = distributionTargets.entities?.[0] || {};

    // Group by entity kind
    const kindGroups = {};
    Object.entries(entities).forEach(([key, value]) => {
      if (key === 'comment') return;
      if (typeof value === 'object') {
        kindGroups[key] = value;
      }
    });

    return (
      <>
        <p style={styles.sectionDescription}>
          Per-subtype population targets for homeostatic control
        </p>
        {Object.entries(kindGroups).map(([kind, subtypes]) => (
          <div key={kind} style={styles.card}>
            <div style={styles.cardTitle}>{kind}</div>
            {Object.entries(subtypes).map(([subtype, config]) => (
              <div key={subtype} style={styles.row}>
                <span style={styles.rowLabel}>{subtype}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <label style={{ fontSize: '12px', color: '#60a5fa' }}>Target:</label>
                  <input
                    type="number"
                    style={styles.smallInput}
                    value={config.target || 0}
                    onChange={(e) => {
                      const newEntities = JSON.parse(JSON.stringify(distributionTargets.entities));
                      if (!newEntities[0][kind]) newEntities[0][kind] = {};
                      newEntities[0][kind][subtype] = { ...config, target: parseInt(e.target.value) || 0 };
                      updateTargets('entities', newEntities);
                    }}
                  />
                </div>
                {config.comment && (
                  <span style={{ fontSize: '11px', color: '#60a5fa', marginLeft: '8px' }}>
                    {config.comment}
                  </span>
                )}
              </div>
            ))}
          </div>
        ))}
      </>
    );
  };

  const renderEraOverrides = () => {
    const perEra = distributionTargets.perEra || {};

    return (
      <>
        <p style={styles.sectionDescription}>
          Per-era overrides adjust global targets for specific eras
        </p>
        {Object.entries(perEra).map(([eraName, overrides]) => (
          <div key={eraName} style={styles.card}>
            <div style={styles.cardTitle}>{eraName}</div>
            {overrides.comment && (
              <div style={styles.comment}>{overrides.comment}</div>
            )}
            {overrides.entityKindDistribution && (
              <div style={{ marginTop: '12px' }}>
                <label style={styles.label}>Entity Kind Overrides</label>
                {Object.entries(overrides.entityKindDistribution).map(([kind, ratio]) => (
                  <div key={kind} style={styles.row}>
                    <span style={styles.rowLabel}>{kind}</span>
                    <span style={styles.rowValue}>{typeof ratio === 'number' ? ratio.toFixed(2) : ratio}</span>
                  </div>
                ))}
              </div>
            )}
            {overrides.prominenceDistribution && (
              <div style={{ marginTop: '12px' }}>
                <label style={styles.label}>Prominence Overrides</label>
                {Object.entries(overrides.prominenceDistribution).map(([level, ratio]) => (
                  level !== 'comment' && (
                    <div key={level} style={styles.row}>
                      <span style={styles.rowLabel}>{level}</span>
                      <span style={styles.rowValue}>{typeof ratio === 'number' ? ratio.toFixed(2) : ratio}</span>
                    </div>
                  )
                ))}
              </div>
            )}
            {overrides.relationshipDistribution && (
              <div style={{ marginTop: '12px' }}>
                <label style={styles.label}>Preferred Relationships</label>
                <div style={{ fontSize: '13px', color: '#93c5fd' }}>
                  {overrides.relationshipDistribution.preferredTypes?.join(', ')}
                </div>
              </div>
            )}
          </div>
        ))}
        {Object.keys(perEra).length === 0 && (
          <div style={{ color: '#60a5fa', fontStyle: 'italic' }}>
            No era-specific overrides configured
          </div>
        )}
      </>
    );
  };

  const renderTuningParameters = () => {
    const tuning = distributionTargets.tuning || {};

    return (
      <>
        <p style={styles.sectionDescription}>
          Meta-parameters that control how the tuning system operates
        </p>
        <div style={styles.card}>
          <div style={styles.cardTitle}>Adjustment Parameters</div>
          <div style={styles.grid}>
            <div style={styles.inputGroup}>
              <label style={styles.label}>Adjustment Speed</label>
              <input
                type="number"
                step="0.1"
                style={styles.input}
                value={tuning.adjustmentSpeed || 0.3}
                onChange={(e) => updateTargets('tuning.adjustmentSpeed', parseFloat(e.target.value) || 0)}
              />
              <div style={styles.comment}>How quickly weights adjust (0-1)</div>
            </div>
            <div style={styles.inputGroup}>
              <label style={styles.label}>Deviation Sensitivity</label>
              <input
                type="number"
                step="0.1"
                style={styles.input}
                value={tuning.deviationSensitivity || 1.5}
                onChange={(e) => updateTargets('tuning.deviationSensitivity', parseFloat(e.target.value) || 0)}
              />
              <div style={styles.comment}>Multiplier for deviation detection</div>
            </div>
            <div style={styles.inputGroup}>
              <label style={styles.label}>Min Template Weight</label>
              <input
                type="number"
                step="0.01"
                style={styles.input}
                value={tuning.minTemplateWeight || 0.05}
                onChange={(e) => updateTargets('tuning.minTemplateWeight', parseFloat(e.target.value) || 0)}
              />
            </div>
            <div style={styles.inputGroup}>
              <label style={styles.label}>Max Template Weight</label>
              <input
                type="number"
                step="0.1"
                style={styles.input}
                value={tuning.maxTemplateWeight || 3.0}
                onChange={(e) => updateTargets('tuning.maxTemplateWeight', parseFloat(e.target.value) || 0)}
              />
            </div>
            <div style={styles.inputGroup}>
              <label style={styles.label}>Convergence Threshold</label>
              <input
                type="number"
                step="0.01"
                style={styles.input}
                value={tuning.convergenceThreshold || 0.08}
                onChange={(e) => updateTargets('tuning.convergenceThreshold', parseFloat(e.target.value) || 0)}
              />
              <div style={styles.comment}>When to consider targets met</div>
            </div>
            <div style={styles.inputGroup}>
              <label style={styles.label}>Measurement Interval</label>
              <input
                type="number"
                style={styles.input}
                value={tuning.measurementInterval || 5}
                onChange={(e) => updateTargets('tuning.measurementInterval', parseInt(e.target.value) || 0)}
              />
              <div style={styles.comment}>Ticks between measurements</div>
            </div>
          </div>
        </div>

        <div style={styles.card}>
          <div style={styles.cardTitle}>Correction Strength</div>
          <p style={styles.sectionDescription}>
            Relative weights for different deviation types when calculating corrections
          </p>
          <div style={styles.grid}>
            <div style={styles.inputGroup}>
              <label style={styles.label}>Entity Kind</label>
              <input
                type="number"
                step="0.1"
                style={styles.input}
                value={tuning.correctionStrength?.entityKind || 1.2}
                onChange={(e) => updateTargets('tuning.correctionStrength.entityKind', parseFloat(e.target.value) || 0)}
              />
            </div>
            <div style={styles.inputGroup}>
              <label style={styles.label}>Prominence</label>
              <input
                type="number"
                step="0.1"
                style={styles.input}
                value={tuning.correctionStrength?.prominence || 0.8}
                onChange={(e) => updateTargets('tuning.correctionStrength.prominence', parseFloat(e.target.value) || 0)}
              />
            </div>
            <div style={styles.inputGroup}>
              <label style={styles.label}>Relationship</label>
              <input
                type="number"
                step="0.1"
                style={styles.input}
                value={tuning.correctionStrength?.relationship || 1.5}
                onChange={(e) => updateTargets('tuning.correctionStrength.relationship', parseFloat(e.target.value) || 0)}
              />
            </div>
            <div style={styles.inputGroup}>
              <label style={styles.label}>Connectivity</label>
              <input
                type="number"
                step="0.1"
                style={styles.input}
                value={tuning.correctionStrength?.connectivity || 1.0}
                onChange={(e) => updateTargets('tuning.correctionStrength.connectivity', parseFloat(e.target.value) || 0)}
              />
            </div>
          </div>
        </div>
      </>
    );
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Distribution Targets</h1>
        <p style={styles.subtitle}>
          Configure statistical targets to guide world generation toward desired outcomes
        </p>
      </div>

      {/* Sub-tabs */}
      <div style={styles.tabs}>
        {SUBTABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveSubtab(tab.id)}
            style={{
              ...styles.tab,
              ...(activeSubtab === tab.id ? styles.tabActive : {}),
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={styles.section}>
        {activeSubtab === 'global' && renderGlobalTargets()}
        {activeSubtab === 'entities' && renderEntityTargets()}
        {activeSubtab === 'eras' && renderEraOverrides()}
        {activeSubtab === 'tuning' && renderTuningParameters()}
      </div>
    </div>
  );
}
