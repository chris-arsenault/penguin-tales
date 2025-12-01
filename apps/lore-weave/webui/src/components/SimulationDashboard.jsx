/**
 * SimulationDashboard - Real-time visualization of simulation progress
 *
 * Layout:
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │ Overview Bar (status, progress, key stats)                          │
 * ├─────────────────────────────────┬───────────────────────────────────┤
 * │ Left Panel                      │ Right Panel                       │
 * │ - Epoch Timeline                │ - Population Metrics              │
 * │ - Pressure Gauges               │ - Template Usage                  │
 * │                                 │ - System Health                   │
 * ├─────────────────────────────────┴───────────────────────────────────┤
 * │ Log Stream (collapsible)                                            │
 * └─────────────────────────────────────────────────────────────────────┘
 */

import React, { useState, useMemo } from 'react';

// Use Canonry theme colors for consistency
const ACCENT_COLOR = '#a78bfa';  // Lore Weave purple (from theme.accentSimulation)
const ACCENT_LIGHT = '#c4b5fd';  // Light purple (from theme.accentSimulationLight)
const SUCCESS_COLOR = '#22c55e'; // theme.success
const WARNING_COLOR = '#f59e0b'; // theme.warning
const ERROR_COLOR = '#ef4444';   // theme.danger
const INFO_COLOR = '#3b82f6';    // theme.accent

// Background colors from theme
const BG_PRIMARY = '#0a1929';    // theme.bgPrimary
const BG_SECONDARY = '#1e3a5f';  // theme.bgSecondary
const BG_TERTIARY = '#2d4a6f';   // theme.bgTertiary

// Text colors from theme
const TEXT_PRIMARY = '#ffffff';   // theme.textPrimary
const TEXT_SECONDARY = '#93c5fd'; // theme.textSecondary
const TEXT_MUTED = '#60a5fa';     // theme.textMuted

// Border color from theme
const BORDER_COLOR = 'rgba(59, 130, 246, 0.3)';

// Shared styles
const styles = {
  dashboard: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    padding: '16px',
    backgroundColor: BG_SECONDARY,
    borderRadius: '12px',
    border: `1px solid ${BORDER_COLOR}`,
  },
  overviewBar: {
    display: 'grid',
    gridTemplateColumns: '1fr 2fr 1fr',
    gap: '16px',
    alignItems: 'center',
    padding: '16px 20px',
    backgroundColor: BG_TERTIARY,
    borderRadius: '8px',
  },
  statusBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 16px',
    borderRadius: '20px',
    fontSize: '14px',
    fontWeight: 600,
  },
  progressSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  progressBar: {
    height: '8px',
    backgroundColor: BG_PRIMARY,
    borderRadius: '4px',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    background: `linear-gradient(90deg, ${ACCENT_COLOR} 0%, ${ACCENT_LIGHT} 100%)`,
    borderRadius: '4px',
    transition: 'width 0.3s ease',
  },
  progressText: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '12px',
    color: TEXT_MUTED,
  },
  statsRow: {
    display: 'flex',
    gap: '24px',
    justifyContent: 'flex-end',
  },
  statItem: {
    textAlign: 'right',
  },
  statValue: {
    fontSize: '18px',
    fontWeight: 600,
    color: TEXT_PRIMARY,
  },
  statLabel: {
    fontSize: '11px',
    color: TEXT_MUTED,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  mainContent: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '16px',
    minHeight: '400px',
  },
  panel: {
    backgroundColor: BG_TERTIARY,
    borderRadius: '8px',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
  },
  panelHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
    paddingBottom: '12px',
    borderBottom: `1px solid ${BORDER_COLOR}`,
  },
  panelTitle: {
    fontSize: '14px',
    fontWeight: 600,
    color: TEXT_PRIMARY,
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  panelContent: {
    flex: 1,
    overflow: 'auto',
  },
  logPanel: {
    backgroundColor: BG_TERTIARY,
    borderRadius: '8px',
    overflow: 'hidden',
  },
  logHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 16px',
    backgroundColor: BG_SECONDARY,
    cursor: 'pointer',
  },
  logContent: {
    maxHeight: '200px',
    overflow: 'auto',
    padding: '12px 16px',
    fontFamily: 'monospace',
    fontSize: '12px',
  },
  logEntry: {
    padding: '2px 0',
    color: TEXT_SECONDARY,
  },
  // Metric card styles
  metricGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '12px',
  },
  metricCard: {
    backgroundColor: BG_PRIMARY,
    borderRadius: '8px',
    padding: '12px',
  },
  metricHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px',
  },
  metricName: {
    fontSize: '12px',
    color: TEXT_MUTED,
  },
  metricValue: {
    fontSize: '20px',
    fontWeight: 600,
    color: TEXT_PRIMARY,
  },
  metricBar: {
    height: '4px',
    backgroundColor: BG_TERTIARY,
    borderRadius: '2px',
    overflow: 'hidden',
    marginTop: '8px',
  },
  // Timeline styles
  timeline: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  timelineItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '10px 12px',
    backgroundColor: BG_PRIMARY,
    borderRadius: '6px',
    borderLeft: '3px solid',
  },
  timelineIcon: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '14px',
  },
  timelineContent: {
    flex: 1,
  },
  timelineTitle: {
    fontSize: '13px',
    fontWeight: 500,
    color: TEXT_PRIMARY,
  },
  timelineSubtitle: {
    fontSize: '11px',
    color: TEXT_MUTED,
  },
  // Template list styles
  templateList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  templateItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '8px 12px',
    backgroundColor: BG_PRIMARY,
    borderRadius: '6px',
  },
  templateBar: {
    flex: 1,
    height: '6px',
    backgroundColor: BG_TERTIARY,
    borderRadius: '3px',
    overflow: 'hidden',
  },
  templateFill: {
    height: '100%',
    borderRadius: '3px',
    transition: 'width 0.3s ease',
  },
  templateName: {
    fontSize: '12px',
    color: TEXT_SECONDARY,
    width: '180px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  templateCount: {
    fontSize: '12px',
    fontWeight: 600,
    color: TEXT_PRIMARY,
    width: '40px',
    textAlign: 'right',
  },
  // Filter tabs
  filterTabs: {
    display: 'flex',
    gap: '4px',
    marginBottom: '12px',
  },
  filterTab: {
    padding: '6px 12px',
    fontSize: '12px',
    backgroundColor: 'transparent',
    border: `1px solid ${BORDER_COLOR}`,
    borderRadius: '4px',
    color: TEXT_MUTED,
    cursor: 'pointer',
  },
  filterTabActive: {
    backgroundColor: ACCENT_COLOR,
    borderColor: ACCENT_COLOR,
    color: 'white',
  },
  // Health indicator
  healthIndicator: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 16px',
    backgroundColor: BG_PRIMARY,
    borderRadius: '8px',
  },
  healthDot: {
    width: '12px',
    height: '12px',
    borderRadius: '50%',
  },
  healthText: {
    fontSize: '14px',
    color: TEXT_PRIMARY,
  },
  // Pressure gauge
  pressureGauge: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '8px 12px',
    backgroundColor: BG_PRIMARY,
    borderRadius: '6px',
  },
  pressureName: {
    fontSize: '12px',
    color: TEXT_SECONDARY,
    width: '120px',
  },
  pressureBar: {
    flex: 1,
    height: '8px',
    backgroundColor: BG_TERTIARY,
    borderRadius: '4px',
    overflow: 'hidden',
    position: 'relative',
  },
  pressureFill: {
    height: '100%',
    borderRadius: '4px',
    transition: 'width 0.3s ease',
  },
  pressureValue: {
    fontSize: '12px',
    fontWeight: 600,
    color: TEXT_PRIMARY,
    width: '50px',
    textAlign: 'right',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: TEXT_MUTED,
    fontSize: '14px',
    gap: '8px',
  },
  emptyIcon: {
    fontSize: '32px',
    opacity: 0.5,
  },
};

// Status badge component
function StatusBadge({ status }) {
  const getStatusConfig = (status) => {
    switch (status) {
      case 'idle':
        return { bg: BG_TERTIARY, color: TEXT_MUTED, label: 'Ready', icon: '○' };
      case 'initializing':
        return { bg: '#3b82f620', color: INFO_COLOR, label: 'Initializing', icon: '◐' };
      case 'validating':
        return { bg: '#f59e0b20', color: WARNING_COLOR, label: 'Validating', icon: '◑' };
      case 'running':
        return { bg: `${ACCENT_COLOR}20`, color: ACCENT_COLOR, label: 'Running', icon: '●' };
      case 'finalizing':
        return { bg: '#3b82f620', color: INFO_COLOR, label: 'Finalizing', icon: '◕' };
      case 'complete':
        return { bg: '#22c55e20', color: SUCCESS_COLOR, label: 'Complete', icon: '✓' };
      case 'error':
        return { bg: '#ef444420', color: ERROR_COLOR, label: 'Error', icon: '✕' };
      default:
        return { bg: BG_TERTIARY, color: TEXT_MUTED, label: status, icon: '○' };
    }
  };

  const config = getStatusConfig(status);

  return (
    <div style={{
      ...styles.statusBadge,
      backgroundColor: config.bg,
      color: config.color
    }}>
      <span>{config.icon}</span>
      <span>{config.label}</span>
    </div>
  );
}

// Progress overview component
function ProgressOverview({ progress, status }) {
  if (!progress) {
    return (
      <div style={styles.overviewBar}>
        <StatusBadge status={status} />
        <div style={styles.progressSection}>
          <div style={styles.progressBar}>
            <div style={{ ...styles.progressFill, width: '0%' }} />
          </div>
          <div style={styles.progressText}>
            <span>Waiting to start...</span>
            <span>0%</span>
          </div>
        </div>
        <div style={styles.statsRow}>
          <div style={styles.statItem}>
            <div style={styles.statValue}>0</div>
            <div style={styles.statLabel}>Entities</div>
          </div>
          <div style={styles.statItem}>
            <div style={styles.statValue}>0</div>
            <div style={styles.statLabel}>Relations</div>
          </div>
        </div>
      </div>
    );
  }

  const percent = status === 'complete' ? 100 :
    status === 'initializing' ? 5 :
    status === 'validating' ? 10 :
    status === 'finalizing' ? 95 :
    Math.min(90, 15 + (progress.tick / progress.maxTicks) * 75);

  return (
    <div style={styles.overviewBar}>
      <StatusBadge status={status} />
      <div style={styles.progressSection}>
        <div style={styles.progressBar}>
          <div style={{ ...styles.progressFill, width: `${percent}%` }} />
        </div>
        <div style={styles.progressText}>
          <span>Tick {progress.tick} / {progress.maxTicks} • Epoch {progress.epoch} / {progress.totalEpochs}</span>
          <span>{Math.round(percent)}%</span>
        </div>
      </div>
      <div style={styles.statsRow}>
        <div style={styles.statItem}>
          <div style={styles.statValue}>{progress.entityCount.toLocaleString()}</div>
          <div style={styles.statLabel}>Entities</div>
        </div>
        <div style={styles.statItem}>
          <div style={styles.statValue}>{progress.relationshipCount.toLocaleString()}</div>
          <div style={styles.statLabel}>Relations</div>
        </div>
      </div>
    </div>
  );
}

// Epoch timeline component
function EpochTimeline({ epochStats, currentEpoch, pressures }) {
  const recentEpochs = epochStats.slice(-5).reverse();

  return (
    <div style={styles.panel}>
      <div style={styles.panelHeader}>
        <div style={styles.panelTitle}>
          <span>⏱</span>
          Epoch Timeline
        </div>
        {currentEpoch && (
          <span style={{ fontSize: '12px', color: TEXT_MUTED }}>
            Era: {currentEpoch.era.name}
          </span>
        )}
      </div>
      <div style={styles.panelContent}>
        {recentEpochs.length === 0 ? (
          <div style={styles.emptyState}>
            <span style={styles.emptyIcon}>⏳</span>
            <span>No epochs completed yet</span>
          </div>
        ) : (
          <>
            <div style={styles.timeline}>
              {recentEpochs.map((epoch, i) => (
                <div
                  key={epoch.epoch}
                  style={{
                    ...styles.timelineItem,
                    borderLeftColor: i === 0 ? ACCENT_COLOR : BORDER_COLOR,
                    opacity: i === 0 ? 1 : 0.7
                  }}
                >
                  <div style={{
                    ...styles.timelineIcon,
                    backgroundColor: i === 0 ? `${ACCENT_COLOR}30` : BG_TERTIARY,
                    color: i === 0 ? ACCENT_COLOR : TEXT_MUTED
                  }}>
                    {epoch.epoch}
                  </div>
                  <div style={styles.timelineContent}>
                    <div style={styles.timelineTitle}>{epoch.era}</div>
                    <div style={styles.timelineSubtitle}>
                      +{epoch.entitiesCreated} entities • +{epoch.relationshipsCreated} relations
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Pressure Gauges */}
            {pressures && Object.keys(pressures).length > 0 && (
              <div style={{ marginTop: '16px' }}>
                <div style={{ fontSize: '12px', color: TEXT_MUTED, marginBottom: '8px' }}>
                  Current Pressures
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {Object.entries(pressures).slice(0, 5).map(([name, value]) => (
                    <div key={name} style={styles.pressureGauge}>
                      <span style={styles.pressureName}>{name}</span>
                      <div style={styles.pressureBar}>
                        <div style={{
                          ...styles.pressureFill,
                          width: `${Math.min(100, value)}%`,
                          backgroundColor: value > 70 ? ERROR_COLOR : value > 40 ? WARNING_COLOR : SUCCESS_COLOR
                        }} />
                      </div>
                      <span style={styles.pressureValue}>{value.toFixed(0)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// Population metrics component
function PopulationMetrics({ populationReport, epochStats }) {
  // Get latest epoch stats for entity breakdown
  const latestEpoch = epochStats[epochStats.length - 1];

  if (!populationReport && !latestEpoch) {
    return (
      <div style={styles.panel}>
        <div style={styles.panelHeader}>
          <div style={styles.panelTitle}>
            <span>📊</span>
            Population Metrics
          </div>
        </div>
        <div style={styles.panelContent}>
          <div style={styles.emptyState}>
            <span style={styles.emptyIcon}>📈</span>
            <span>Metrics will appear after first epoch</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.panel}>
      <div style={styles.panelHeader}>
        <div style={styles.panelTitle}>
          <span>📊</span>
          Population Metrics
        </div>
        {populationReport && (
          <span style={{
            fontSize: '12px',
            color: populationReport.avgDeviation < 0.2 ? SUCCESS_COLOR :
                   populationReport.avgDeviation < 0.4 ? WARNING_COLOR : ERROR_COLOR
          }}>
            {(populationReport.avgDeviation * 100).toFixed(1)}% avg deviation
          </span>
        )}
      </div>
      <div style={styles.panelContent}>
        {/* Entity counts by kind */}
        {latestEpoch && (
          <div style={styles.metricGrid}>
            {Object.entries(latestEpoch.entitiesByKind).map(([kind, count]) => (
              <div key={kind} style={styles.metricCard}>
                <div style={styles.metricHeader}>
                  <span style={styles.metricName}>{kind}</span>
                </div>
                <div style={styles.metricValue}>{count}</div>
              </div>
            ))}
          </div>
        )}

        {/* Population deviations */}
        {populationReport && populationReport.entityMetrics.length > 0 && (
          <div style={{ marginTop: '16px' }}>
            <div style={{ fontSize: '12px', color: TEXT_MUTED, marginBottom: '8px' }}>
              Population Health
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {populationReport.entityMetrics.slice(0, 6).map(metric => {
                const deviationPercent = Math.abs(metric.deviation * 100);
                const color = deviationPercent < 20 ? SUCCESS_COLOR :
                              deviationPercent < 40 ? WARNING_COLOR : ERROR_COLOR;
                return (
                  <div key={`${metric.kind}:${metric.subtype}`} style={styles.pressureGauge}>
                    <span style={styles.pressureName}>{metric.kind}:{metric.subtype}</span>
                    <div style={styles.pressureBar}>
                      <div style={{
                        ...styles.pressureFill,
                        width: `${(metric.count / metric.target) * 50}%`,
                        maxWidth: '100%',
                        backgroundColor: color
                      }} />
                    </div>
                    <span style={{ ...styles.pressureValue, color }}>
                      {metric.count}/{metric.target}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Template usage component
function TemplateUsage({ templateUsage, systemHealth }) {
  if (!templateUsage) {
    return (
      <div style={styles.panel}>
        <div style={styles.panelHeader}>
          <div style={styles.panelTitle}>
            <span>🔧</span>
            Template Usage
          </div>
        </div>
        <div style={styles.panelContent}>
          <div style={styles.emptyState}>
            <span style={styles.emptyIcon}>⚙️</span>
            <span>Template stats will appear here</span>
          </div>
        </div>
      </div>
    );
  }

  const maxCount = Math.max(...templateUsage.usage.map(t => t.count), 1);

  return (
    <div style={styles.panel}>
      <div style={styles.panelHeader}>
        <div style={styles.panelTitle}>
          <span>🔧</span>
          Template Usage
        </div>
        <span style={{ fontSize: '12px', color: TEXT_MUTED }}>
          {templateUsage.uniqueTemplatesUsed}/{templateUsage.totalTemplates} used
        </span>
      </div>
      <div style={styles.panelContent}>
        {/* System health indicator */}
        {systemHealth && (
          <div style={{ ...styles.healthIndicator, marginBottom: '12px' }}>
            <div style={{
              ...styles.healthDot,
              backgroundColor: systemHealth.status === 'stable' ? SUCCESS_COLOR :
                              systemHealth.status === 'functional' ? WARNING_COLOR : ERROR_COLOR
            }} />
            <span style={styles.healthText}>
              System Health: {(systemHealth.populationHealth * 100).toFixed(0)}%
            </span>
            <span style={{
              fontSize: '12px',
              color: TEXT_MUTED,
              marginLeft: 'auto'
            }}>
              {systemHealth.status}
            </span>
          </div>
        )}

        {/* Top templates */}
        <div style={styles.templateList}>
          {templateUsage.usage.slice(0, 8).map(template => {
            const fillColor = template.status === 'saturated' ? ERROR_COLOR :
                             template.status === 'warning' ? WARNING_COLOR : ACCENT_COLOR;
            return (
              <div key={template.templateId} style={styles.templateItem}>
                <span style={styles.templateName} title={template.templateId}>
                  {template.templateId}
                </span>
                <div style={styles.templateBar}>
                  <div style={{
                    ...styles.templateFill,
                    width: `${(template.count / maxCount) * 100}%`,
                    backgroundColor: fillColor
                  }} />
                </div>
                <span style={styles.templateCount}>{template.count}×</span>
              </div>
            );
          })}
        </div>

        {/* Unused templates warning */}
        {templateUsage.unusedTemplates.length > 0 && (
          <div style={{
            marginTop: '12px',
            padding: '8px 12px',
            backgroundColor: `${WARNING_COLOR}15`,
            borderRadius: '6px',
            fontSize: '12px',
            color: WARNING_COLOR
          }}>
            {templateUsage.unusedTemplates.length} templates never used
          </div>
        )}
      </div>
    </div>
  );
}

// Log stream component
function LogStream({ logs, onClear }) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [filter, setFilter] = useState('all');

  const filteredLogs = useMemo(() => {
    if (filter === 'all') return logs;
    return logs.filter(log => log.level === filter);
  }, [logs, filter]);

  const logCounts = useMemo(() => ({
    all: logs.length,
    info: logs.filter(l => l.level === 'info').length,
    warn: logs.filter(l => l.level === 'warn').length,
    error: logs.filter(l => l.level === 'error').length,
  }), [logs]);

  const getLogColor = (level) => {
    switch (level) {
      case 'error': return ERROR_COLOR;
      case 'warn': return WARNING_COLOR;
      case 'debug': return TEXT_MUTED;
      default: return TEXT_SECONDARY;
    }
  };

  return (
    <div style={styles.logPanel}>
      <div
        style={styles.logHeader}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '14px', fontWeight: 500, color: TEXT_PRIMARY }}>
            {isExpanded ? '▼' : '▶'} Log Stream
          </span>
          <span style={{ fontSize: '12px', color: TEXT_MUTED }}>
            {logs.length} entries
          </span>
          {logCounts.error > 0 && (
            <span style={{
              fontSize: '11px',
              padding: '2px 8px',
              backgroundColor: `${ERROR_COLOR}20`,
              color: ERROR_COLOR,
              borderRadius: '10px'
            }}>
              {logCounts.error} errors
            </span>
          )}
          {logCounts.warn > 0 && (
            <span style={{
              fontSize: '11px',
              padding: '2px 8px',
              backgroundColor: `${WARNING_COLOR}20`,
              color: WARNING_COLOR,
              borderRadius: '10px'
            }}>
              {logCounts.warn} warnings
            </span>
          )}
        </div>
        {logs.length > 0 && (
          <button
            onClick={(e) => { e.stopPropagation(); onClear(); }}
            style={{
              padding: '4px 12px',
              fontSize: '12px',
              backgroundColor: 'transparent',
              border: `1px solid ${BORDER_COLOR}`,
              borderRadius: '4px',
              color: TEXT_MUTED,
              cursor: 'pointer'
            }}
          >
            Clear
          </button>
        )}
      </div>
      {isExpanded && logs.length > 0 && (
        <>
          <div style={{ padding: '8px 16px', borderBottom: `1px solid ${BORDER_COLOR}` }}>
            <div style={styles.filterTabs}>
              {['all', 'info', 'warn', 'error'].map(f => (
                <button
                  key={f}
                  style={{
                    ...styles.filterTab,
                    ...(filter === f ? styles.filterTabActive : {})
                  }}
                  onClick={() => setFilter(f)}
                >
                  {f} ({logCounts[f] || 0})
                </button>
              ))}
            </div>
          </div>
          <div style={styles.logContent}>
            {filteredLogs.slice(-100).map((log, i) => (
              <div
                key={i}
                style={{
                  ...styles.logEntry,
                  color: getLogColor(log.level)
                }}
              >
                [{log.level.toUpperCase().padEnd(5)}] {log.message}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// Main dashboard component
export default function SimulationDashboard({ simState, onClearLogs }) {
  const {
    status,
    progress,
    currentEpoch,
    epochStats,
    populationReport,
    templateUsage,
    systemHealth,
    logs
  } = simState;

  // Extract pressures from latest epoch stats
  const pressures = epochStats.length > 0 ? epochStats[epochStats.length - 1].pressures : null;

  return (
    <div style={styles.dashboard}>
      {/* Overview Bar */}
      <ProgressOverview progress={progress} status={status} />

      {/* Main Content Grid */}
      <div style={styles.mainContent}>
        {/* Left Panel */}
        <EpochTimeline
          epochStats={epochStats}
          currentEpoch={currentEpoch}
          pressures={pressures}
        />

        {/* Right Panel - stacked */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <PopulationMetrics
            populationReport={populationReport}
            epochStats={epochStats}
          />
          <TemplateUsage
            templateUsage={templateUsage}
            systemHealth={systemHealth}
          />
        </div>
      </div>

      {/* Log Stream */}
      <LogStream logs={logs} onClear={onClearLogs} />
    </div>
  );
}
