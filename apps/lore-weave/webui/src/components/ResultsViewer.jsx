/**
 * ResultsViewer - Displays simulation results
 *
 * Shows the output from a completed simulation run including:
 * - Entity and relationship counts
 * - Generated entities by type
 * - History events
 * - Pressure states
 */

import React, { useState, useMemo } from 'react';

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
    color: '#f0f0f0',
    marginBottom: '8px',
  },
  subtitle: {
    fontSize: '14px',
    color: '#808090',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '80px 40px',
    textAlign: 'center',
    color: '#707080',
  },
  emptyIcon: {
    fontSize: '64px',
    marginBottom: '24px',
    opacity: 0.5,
  },
  emptyTitle: {
    fontSize: '18px',
    fontWeight: 500,
    color: '#f0f0f0',
    marginBottom: '8px',
  },
  emptyText: {
    fontSize: '14px',
    marginBottom: '24px',
    maxWidth: '400px',
  },
  runButton: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 24px',
    fontSize: '15px',
    fontWeight: 600,
    background: `linear-gradient(135deg, ${ACCENT_COLOR} 0%, #8b5cf6 100%)`,
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
    gap: '16px',
    marginBottom: '24px',
  },
  statCard: {
    backgroundColor: '#252535',
    borderRadius: '8px',
    padding: '16px 20px',
    border: '1px solid #3d3d4d',
  },
  statLabel: {
    fontSize: '12px',
    color: '#707080',
    marginBottom: '4px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  statValue: {
    fontSize: '28px',
    fontWeight: 600,
    color: '#f0f0f0',
  },
  section: {
    backgroundColor: '#252535',
    borderRadius: '8px',
    padding: '24px',
    border: '1px solid #3d3d4d',
    marginBottom: '24px',
  },
  sectionTitle: {
    fontSize: '16px',
    fontWeight: 600,
    color: '#f0f0f0',
    marginBottom: '16px',
  },
  entityList: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
  },
  entityBadge: {
    padding: '6px 12px',
    backgroundColor: '#1e1e2e',
    border: '1px solid #3d3d4d',
    borderRadius: '6px',
    fontSize: '13px',
    color: '#b0b0c0',
  },
  pressureRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '12px',
  },
  pressureName: {
    width: '150px',
    fontSize: '14px',
    color: '#f0f0f0',
  },
  pressureBar: {
    flex: 1,
    height: '8px',
    backgroundColor: '#1e1e2e',
    borderRadius: '4px',
    overflow: 'hidden',
  },
  pressureFill: {
    height: '100%',
    borderRadius: '4px',
    transition: 'width 0.3s',
  },
  pressureValue: {
    width: '50px',
    textAlign: 'right',
    fontSize: '14px',
    color: '#b0b0c0',
  },
  exportButton: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 16px',
    fontSize: '13px',
    backgroundColor: '#1e1e2e',
    color: '#b0b0c0',
    border: '1px solid #3d3d4d',
    borderRadius: '6px',
    cursor: 'pointer',
    marginRight: '8px',
  },
  codeBlock: {
    backgroundColor: '#1a1a28',
    borderRadius: '6px',
    padding: '16px',
    fontFamily: 'monospace',
    fontSize: '12px',
    color: '#b0b0c0',
    overflow: 'auto',
    maxHeight: '400px',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
  tabs: {
    display: 'flex',
    gap: '4px',
    marginBottom: '16px',
    borderBottom: '1px solid #3d3d4d',
  },
  tab: {
    padding: '10px 16px',
    fontSize: '13px',
    fontWeight: 500,
    backgroundColor: 'transparent',
    border: 'none',
    borderBottom: '2px solid transparent',
    color: '#707080',
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  tabActive: {
    color: ACCENT_COLOR,
    borderBottom: `2px solid ${ACCENT_COLOR}`,
  },
};

export default function ResultsViewer({ results, schema, onNewRun }) {
  const [activeTab, setActiveTab] = useState('overview');

  // Process results for display
  const processedData = useMemo(() => {
    if (!results) return null;

    const { metadata, hardState, relationships, pressures, engineConfig } = results;

    // Group entities by kind
    const entityGroups = {};
    (hardState || []).forEach(entity => {
      const key = `${entity.kind}:${entity.subtype}`;
      if (!entityGroups[key]) entityGroups[key] = [];
      entityGroups[key].push(entity);
    });

    // Group relationships by kind
    const relationshipGroups = {};
    (relationships || []).forEach(rel => {
      if (!relationshipGroups[rel.kind]) relationshipGroups[rel.kind] = [];
      relationshipGroups[rel.kind].push(rel);
    });

    return {
      metadata,
      entityGroups,
      relationshipGroups,
      pressures: pressures || {},
      engineConfig,
    };
  }, [results]);

  if (!results) {
    return (
      <div style={styles.container}>
        <div style={styles.emptyState}>
          <div style={styles.emptyIcon}></div>
          <div style={styles.emptyTitle}>No Results Yet</div>
          <div style={styles.emptyText}>
            Run a simulation to see the generated world history here.
            You can review the configuration and adjust parameters before running.
          </div>
          <button style={styles.runButton} onClick={onNewRun}>
            Go to Run
          </button>
        </div>
      </div>
    );
  }

  const exportResults = () => {
    const blob = new Blob([JSON.stringify(results, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'lore-weave-results.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportConfig = () => {
    const blob = new Blob([JSON.stringify(processedData.engineConfig, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'engine-config.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Simulation Results</h1>
        <p style={styles.subtitle}>
          Generated world with {processedData.metadata?.entityCount || 0} entities
          and {processedData.metadata?.relationshipCount || 0} relationships
        </p>
      </div>

      {/* Action Buttons */}
      <div style={{ marginBottom: '24px' }}>
        <button style={styles.exportButton} onClick={exportResults}>
          Export Results
        </button>
        <button style={styles.exportButton} onClick={exportConfig}>
          Export Config
        </button>
        <button style={styles.runButton} onClick={onNewRun}>
          Run New Simulation
        </button>
      </div>

      {/* Stats Overview */}
      <div style={styles.statsGrid}>
        <StatCard label="Total Entities" value={processedData.metadata?.entityCount || 0} />
        <StatCard label="Total Relationships" value={processedData.metadata?.relationshipCount || 0} />
        <StatCard label="Final Tick" value={processedData.metadata?.tick || 0} />
        <StatCard label="Epochs" value={processedData.metadata?.epoch || 0} />
        <StatCard label="Final Era" value={processedData.metadata?.era || 'N/A'} />
      </div>

      {/* Tabs */}
      <div style={styles.tabs}>
        <button
          style={{ ...styles.tab, ...(activeTab === 'overview' ? styles.tabActive : {}) }}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button
          style={{ ...styles.tab, ...(activeTab === 'entities' ? styles.tabActive : {}) }}
          onClick={() => setActiveTab('entities')}
        >
          Entities
        </button>
        <button
          style={{ ...styles.tab, ...(activeTab === 'pressures' ? styles.tabActive : {}) }}
          onClick={() => setActiveTab('pressures')}
        >
          Pressures
        </button>
        <button
          style={{ ...styles.tab, ...(activeTab === 'config' ? styles.tabActive : {}) }}
          onClick={() => setActiveTab('config')}
        >
          Config
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <>
          {/* Entity Groups */}
          <div style={styles.section}>
            <div style={styles.sectionTitle}>
              Entity Breakdown ({Object.keys(processedData.entityGroups).length} types)
            </div>
            <div style={styles.entityList}>
              {Object.entries(processedData.entityGroups).map(([type, entities]) => (
                <span key={type} style={styles.entityBadge}>
                  {type}: {entities.length}
                </span>
              ))}
              {Object.keys(processedData.entityGroups).length === 0 && (
                <span style={{ color: '#707080', fontStyle: 'italic' }}>
                  No entities generated (mock run)
                </span>
              )}
            </div>
          </div>

          {/* Relationship Groups */}
          <div style={styles.section}>
            <div style={styles.sectionTitle}>
              Relationship Types ({Object.keys(processedData.relationshipGroups).length} kinds)
            </div>
            <div style={styles.entityList}>
              {Object.entries(processedData.relationshipGroups).map(([kind, rels]) => (
                <span key={kind} style={styles.entityBadge}>
                  {kind}: {rels.length}
                </span>
              ))}
              {Object.keys(processedData.relationshipGroups).length === 0 && (
                <span style={{ color: '#707080', fontStyle: 'italic' }}>
                  No relationships generated (mock run)
                </span>
              )}
            </div>
          </div>
        </>
      )}

      {activeTab === 'entities' && (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Generated Entities</div>
          {(results.hardState || []).length === 0 ? (
            <div style={{ color: '#707080', fontStyle: 'italic' }}>
              Entity generation is a mock in the current version.
              Run the CLI for actual entity generation.
            </div>
          ) : (
            <div style={styles.codeBlock}>
              {JSON.stringify(results.hardState, null, 2)}
            </div>
          )}
        </div>
      )}

      {activeTab === 'pressures' && (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Final Pressure States</div>
          {Object.entries(processedData.pressures).length === 0 ? (
            <div style={{ color: '#707080', fontStyle: 'italic' }}>
              No pressure data available
            </div>
          ) : (
            Object.entries(processedData.pressures).map(([name, value]) => (
              <PressureBar key={name} name={name} value={value} />
            ))
          )}
        </div>
      )}

      {activeTab === 'config' && (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Engine Configuration Used</div>
          <div style={styles.codeBlock}>
            {JSON.stringify(processedData.engineConfig, null, 2)}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div style={styles.statCard}>
      <div style={styles.statLabel}>{label}</div>
      <div style={styles.statValue}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </div>
    </div>
  );
}

function PressureBar({ name, value }) {
  const numValue = typeof value === 'number' ? value : 50;
  const percent = Math.max(0, Math.min(100, numValue));

  // Color based on value
  const color = percent > 70 ? '#ef4444' :
                percent > 30 ? '#f59e0b' : '#22c55e';

  return (
    <div style={styles.pressureRow}>
      <span style={styles.pressureName}>{name}</span>
      <div style={styles.pressureBar}>
        <div style={{
          ...styles.pressureFill,
          width: `${percent}%`,
          backgroundColor: color,
        }} />
      </div>
      <span style={styles.pressureValue}>{numValue.toFixed(0)}</span>
    </div>
  );
}
