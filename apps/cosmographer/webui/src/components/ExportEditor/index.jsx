/**
 * ExportEditor - Preview and download world seed JSON.
 * Validates the seed before export and shows any issues.
 */

import React, { useState, useMemo } from 'react';

const styles = {
  container: {
    display: 'flex',
    gap: '24px',
    height: '100%'
  },
  mainPanel: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column'
  },
  header: {
    marginBottom: '16px'
  },
  title: {
    fontSize: '24px',
    fontWeight: 600,
    marginBottom: '8px'
  },
  subtitle: {
    color: '#888',
    fontSize: '14px'
  },
  toolbar: {
    display: 'flex',
    gap: '12px',
    marginBottom: '16px'
  },
  exportButton: {
    padding: '10px 20px',
    fontSize: '14px',
    backgroundColor: '#e94560',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer'
  },
  exportButtonDisabled: {
    backgroundColor: '#444',
    cursor: 'not-allowed'
  },
  copyButton: {
    padding: '10px 20px',
    fontSize: '14px',
    backgroundColor: '#0f3460',
    color: '#aaa',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer'
  },
  previewContainer: {
    flex: 1,
    backgroundColor: '#16213e',
    borderRadius: '8px',
    padding: '16px',
    overflow: 'auto'
  },
  previewCode: {
    fontFamily: 'monospace',
    fontSize: '12px',
    color: '#aaa',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-all'
  },
  sidebar: {
    width: '300px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px'
  },
  statsBox: {
    backgroundColor: '#16213e',
    borderRadius: '8px',
    padding: '16px'
  },
  statsTitle: {
    fontSize: '14px',
    fontWeight: 500,
    marginBottom: '12px'
  },
  statRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '13px',
    marginBottom: '8px'
  },
  statLabel: {
    color: '#888'
  },
  statValue: {
    color: '#eee'
  },
  validationBox: {
    backgroundColor: '#16213e',
    borderRadius: '8px',
    padding: '16px',
    flex: 1,
    overflow: 'auto'
  },
  validationTitle: {
    fontSize: '14px',
    fontWeight: 500,
    marginBottom: '12px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  validationIcon: {
    fontSize: '16px'
  },
  issueList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  issue: {
    padding: '8px 10px',
    backgroundColor: '#1a1a2e',
    borderRadius: '4px',
    fontSize: '12px',
    borderLeft: '3px solid'
  },
  issueError: {
    borderLeftColor: '#e94560',
    color: '#e94560'
  },
  issueWarning: {
    borderLeftColor: '#f0a500',
    color: '#f0a500'
  },
  issueInfo: {
    borderLeftColor: '#4a90d9',
    color: '#aaa'
  },
  successMessage: {
    color: '#4caf50',
    fontSize: '13px'
  }
};

function validateProject(project) {
  const issues = [];

  // Check for entity kinds
  const entityKinds = project?.worldSchema?.entityKinds || [];
  if (entityKinds.length === 0) {
    issues.push({ type: 'error', message: 'No entity kinds defined in schema' });
  }

  // Check for relationship kinds
  const relationshipKinds = project?.worldSchema?.relationshipKinds || [];
  if (relationshipKinds.length === 0) {
    issues.push({ type: 'warning', message: 'No relationship kinds defined' });
  }

  // Check for cultures
  const cultures = project?.cultures || [];
  if (cultures.length === 0) {
    issues.push({ type: 'warning', message: 'No cultures defined' });
  }

  // Check for semantic planes
  const planes = project?.semanticPlanes || [];
  if (planes.length === 0) {
    issues.push({ type: 'warning', message: 'No semantic planes defined' });
  }

  // Check entity kind coverage for planes
  entityKinds.forEach(kind => {
    const hasPlane = planes.some(p => p.entityKind === kind.id);
    if (!hasPlane) {
      issues.push({
        type: 'info',
        message: `No semantic plane for entity kind "${kind.name}"`
      });
    }
  });

  // Check for entities
  const entities = project?.seedEntities || [];
  if (entities.length === 0) {
    issues.push({ type: 'warning', message: 'No seed entities defined' });
  }

  // Validate entity references
  entities.forEach(entity => {
    if (!entityKinds.find(k => k.id === entity.kind)) {
      issues.push({
        type: 'error',
        message: `Entity "${entity.name}" references unknown kind "${entity.kind}"`
      });
    }
    if (entity.culture && !cultures.find(c => c.id === entity.culture)) {
      issues.push({
        type: 'error',
        message: `Entity "${entity.name}" references unknown culture "${entity.culture}"`
      });
    }
  });

  // Check for relationships
  const relationships = project?.seedRelationships || [];

  // Validate relationship references
  relationships.forEach(rel => {
    if (!relationshipKinds.find(k => k.id === rel.kind)) {
      issues.push({
        type: 'error',
        message: `Relationship references unknown kind "${rel.kind}"`
      });
    }
    if (!entities.find(e => e.id === rel.srcId)) {
      issues.push({
        type: 'error',
        message: `Relationship references unknown source entity "${rel.srcId}"`
      });
    }
    if (!entities.find(e => e.id === rel.dstId)) {
      issues.push({
        type: 'error',
        message: `Relationship references unknown destination entity "${rel.dstId}"`
      });
    }
  });

  // Check for region coverage in planes
  planes.forEach(plane => {
    if (!plane.regions || plane.regions.length === 0) {
      issues.push({
        type: 'info',
        message: `Semantic plane "${plane.name}" has no regions defined`
      });
    }
  });

  return issues;
}

function buildExportData(project) {
  return {
    name: project.name,
    version: '1.0',
    exportedAt: new Date().toISOString(),
    worldSchema: {
      entityKinds: (project.worldSchema?.entityKinds || []).map(k => ({
        id: k.id,
        name: k.name,
        subtypes: k.subtypes || [],
        statuses: k.statuses || []
      })),
      relationshipKinds: (project.worldSchema?.relationshipKinds || []).map(k => ({
        id: k.id,
        name: k.name,
        srcKinds: k.srcKinds || [],
        dstKinds: k.dstKinds || []
      }))
    },
    cultures: (project.cultures || []).map(c => ({
      id: c.id,
      name: c.name,
      color: c.color,
      axisBiases: c.axisBiases || {}
    })),
    semanticPlanes: (project.semanticPlanes || []).map(p => ({
      id: p.id,
      name: p.name,
      entityKind: p.entityKind,
      axes: p.axes,
      bounds: p.bounds,
      regions: (p.regions || []).map(r => ({
        id: r.id,
        label: r.label,
        color: r.color,
        bounds: r.bounds
      }))
    })),
    seedEntities: (project.seedEntities || []).map(e => ({
      id: e.id,
      kind: e.kind,
      subtype: e.subtype,
      name: e.name,
      description: e.description,
      status: e.status,
      prominence: e.prominence,
      culture: e.culture,
      tags: e.tags || [],
      coordinates: e.coordinates
    })),
    seedRelationships: (project.seedRelationships || []).map(r => ({
      id: r.id,
      kind: r.kind,
      srcId: r.srcId,
      dstId: r.dstId,
      strength: r.strength
    }))
  };
}

export default function ExportEditor({ project }) {
  const [copied, setCopied] = useState(false);

  const issues = useMemo(() => validateProject(project), [project]);
  const exportData = useMemo(() => buildExportData(project), [project]);
  const jsonString = useMemo(() => JSON.stringify(exportData, null, 2), [exportData]);

  const hasErrors = issues.some(i => i.type === 'error');
  const hasWarnings = issues.some(i => i.type === 'warning');

  const handleExport = () => {
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.name.toLowerCase().replace(/\s+/g, '-')}-seed.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(jsonString);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const stats = {
    entityKinds: project?.worldSchema?.entityKinds?.length || 0,
    relationshipKinds: project?.worldSchema?.relationshipKinds?.length || 0,
    cultures: project?.cultures?.length || 0,
    planes: project?.semanticPlanes?.length || 0,
    entities: project?.seedEntities?.length || 0,
    relationships: project?.seedRelationships?.length || 0
  };

  return (
    <div style={styles.container}>
      <div style={styles.mainPanel}>
        <div style={styles.header}>
          <div style={styles.title}>Export</div>
          <div style={styles.subtitle}>
            Preview and download the world seed JSON for use with Lore Weave.
          </div>
        </div>

        <div style={styles.toolbar}>
          <button
            style={{
              ...styles.exportButton,
              ...(hasErrors ? styles.exportButtonDisabled : {})
            }}
            onClick={handleExport}
            disabled={hasErrors}
          >
            Download JSON
          </button>
          <button style={styles.copyButton} onClick={handleCopy}>
            {copied ? 'Copied!' : 'Copy to Clipboard'}
          </button>
        </div>

        <div style={styles.previewContainer}>
          <pre style={styles.previewCode}>{jsonString}</pre>
        </div>
      </div>

      <div style={styles.sidebar}>
        <div style={styles.statsBox}>
          <div style={styles.statsTitle}>Statistics</div>
          <div style={styles.statRow}>
            <span style={styles.statLabel}>Entity Kinds</span>
            <span style={styles.statValue}>{stats.entityKinds}</span>
          </div>
          <div style={styles.statRow}>
            <span style={styles.statLabel}>Relationship Kinds</span>
            <span style={styles.statValue}>{stats.relationshipKinds}</span>
          </div>
          <div style={styles.statRow}>
            <span style={styles.statLabel}>Cultures</span>
            <span style={styles.statValue}>{stats.cultures}</span>
          </div>
          <div style={styles.statRow}>
            <span style={styles.statLabel}>Semantic Planes</span>
            <span style={styles.statValue}>{stats.planes}</span>
          </div>
          <div style={styles.statRow}>
            <span style={styles.statLabel}>Seed Entities</span>
            <span style={styles.statValue}>{stats.entities}</span>
          </div>
          <div style={styles.statRow}>
            <span style={styles.statLabel}>Seed Relationships</span>
            <span style={styles.statValue}>{stats.relationships}</span>
          </div>
        </div>

        <div style={styles.validationBox}>
          <div style={styles.validationTitle}>
            <span style={styles.validationIcon}>
              {hasErrors ? '❌' : hasWarnings ? '⚠️' : '✅'}
            </span>
            Validation
          </div>

          {issues.length === 0 ? (
            <div style={styles.successMessage}>
              All checks passed. Ready to export.
            </div>
          ) : (
            <div style={styles.issueList}>
              {issues.map((issue, idx) => (
                <div
                  key={idx}
                  style={{
                    ...styles.issue,
                    ...(issue.type === 'error' ? styles.issueError : {}),
                    ...(issue.type === 'warning' ? styles.issueWarning : {}),
                    ...(issue.type === 'info' ? styles.issueInfo : {})
                  }}
                >
                  {issue.type === 'error' && '⛔ '}
                  {issue.type === 'warning' && '⚠️ '}
                  {issue.type === 'info' && 'ℹ️ '}
                  {issue.message}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
