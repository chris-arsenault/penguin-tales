/**
 * SimulationRunner - Run and monitor simulation execution
 *
 * Wires project data to the simulation engine and provides
 * progress tracking and result visualization.
 */

import React, { useState, useCallback, useRef } from 'react';
import { colors, typography, spacing, radius } from '../theme.js';

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.xl,
  },
  section: {
    backgroundColor: colors.bgSecondary,
    borderRadius: radius.lg,
    padding: spacing.xl,
    border: `1px solid ${colors.border}`,
  },
  sectionTitle: {
    fontSize: typography.sizeXl,
    fontWeight: typography.weightSemibold,
    color: colors.textPrimary,
    marginBottom: spacing.lg,
  },
  controls: {
    display: 'flex',
    gap: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  runButton: {
    padding: `${spacing.md} ${spacing.xxl}`,
    fontSize: typography.sizeLg,
    fontWeight: typography.weightSemibold,
    fontFamily: typography.fontFamily,
    backgroundColor: colors.accentSimulation,
    color: colors.bgPrimary,
    border: 'none',
    borderRadius: radius.md,
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  runButtonDisabled: {
    backgroundColor: colors.bgTertiary,
    color: colors.textMuted,
    cursor: 'not-allowed',
  },
  stopButton: {
    padding: `${spacing.md} ${spacing.xl}`,
    fontSize: typography.sizeMd,
    fontWeight: typography.weightMedium,
    fontFamily: typography.fontFamily,
    backgroundColor: 'transparent',
    color: colors.danger,
    border: `1px solid ${colors.danger}`,
    borderRadius: radius.md,
    cursor: 'pointer',
  },
  exportButton: {
    padding: `${spacing.md} ${spacing.xl}`,
    fontSize: typography.sizeMd,
    fontWeight: typography.weightMedium,
    fontFamily: typography.fontFamily,
    backgroundColor: colors.success,
    color: colors.bgPrimary,
    border: 'none',
    borderRadius: radius.md,
    cursor: 'pointer',
  },
  progressContainer: {
    marginBottom: spacing.xl,
  },
  progressBar: {
    height: '8px',
    backgroundColor: colors.bgTertiary,
    borderRadius: radius.sm,
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.accentSimulation,
    transition: 'width 0.1s ease-out',
  },
  progressText: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: typography.sizeSm,
    color: colors.textSecondary,
  },
  stats: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
    gap: spacing.lg,
    marginBottom: spacing.xl,
  },
  statCard: {
    backgroundColor: colors.bgTertiary,
    padding: spacing.lg,
    borderRadius: radius.md,
    textAlign: 'center',
  },
  statValue: {
    fontSize: typography.sizeXxl,
    fontWeight: typography.weightBold,
    color: colors.accentSimulation,
    marginBottom: spacing.xs,
  },
  statLabel: {
    fontSize: typography.sizeSm,
    color: colors.textMuted,
  },
  eraProgress: {
    display: 'flex',
    gap: spacing.sm,
    flexWrap: 'wrap',
    marginBottom: spacing.lg,
  },
  eraChip: {
    padding: `${spacing.xs} ${spacing.md}`,
    fontSize: typography.sizeXs,
    borderRadius: radius.sm,
    backgroundColor: colors.bgTertiary,
    color: colors.textMuted,
  },
  eraChipActive: {
    backgroundColor: colors.accentSimulation,
    color: colors.bgPrimary,
  },
  eraChipComplete: {
    backgroundColor: colors.success,
    color: colors.bgPrimary,
  },
  log: {
    maxHeight: '300px',
    overflow: 'auto',
    backgroundColor: colors.bgTertiary,
    padding: spacing.md,
    borderRadius: radius.md,
    fontFamily: 'monospace',
    fontSize: typography.sizeXs,
    color: colors.textSecondary,
  },
  logEntry: {
    padding: `${spacing.xs} 0`,
    borderBottom: `1px solid ${colors.border}`,
  },
  logTick: {
    color: colors.textMuted,
    marginRight: spacing.sm,
  },
  logRule: {
    color: colors.accentSimulation,
  },
  logSuccess: {
    color: colors.success,
  },
  logError: {
    color: colors.danger,
  },
  resultsSection: {
    marginTop: spacing.xl,
  },
  eraResult: {
    padding: spacing.lg,
    backgroundColor: colors.bgTertiary,
    borderRadius: radius.md,
    marginBottom: spacing.md,
  },
  eraResultHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  eraResultName: {
    fontSize: typography.sizeLg,
    fontWeight: typography.weightSemibold,
    color: colors.textPrimary,
  },
  eraResultStats: {
    display: 'flex',
    gap: spacing.lg,
    fontSize: typography.sizeSm,
    color: colors.textSecondary,
  },
  validationErrors: {
    backgroundColor: 'rgba(255, 107, 122, 0.1)',
    border: `1px solid ${colors.danger}`,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.xl,
  },
  validationTitle: {
    fontSize: typography.sizeMd,
    fontWeight: typography.weightSemibold,
    color: colors.danger,
    marginBottom: spacing.sm,
  },
  validationItem: {
    fontSize: typography.sizeSm,
    color: colors.textSecondary,
    padding: `${spacing.xs} 0`,
  },
};

/**
 * Validate that the simulation config is ready to run
 */
function validateConfig(simulation, eras) {
  const errors = [];

  if (!simulation) {
    errors.push('No simulation configuration');
    return errors;
  }

  if (!simulation.generationRules?.length && !simulation.simulationRules?.length) {
    errors.push('No rules defined');
  }

  if (!eras?.length) {
    errors.push('No eras defined in project');
  }

  // Check that rules have weights in at least one era
  const eraWeights = simulation.eraRuleWeights || {};
  const hasAnyWeights = Object.values(eraWeights).some(
    (w) => Object.keys(w.generationWeights || {}).length > 0 || Object.keys(w.simulationWeights || {}).length > 0
  );

  if (!hasAnyWeights && (simulation.generationRules?.length || simulation.simulationRules?.length)) {
    errors.push('No era weights configured - rules will not fire');
  }

  return errors;
}

/**
 * Convert project data to engine config format
 */
function buildEngineConfig(project, onTick, onEraComplete) {
  const simulation = project.simulation || {};
  const eras = project.eras || [];

  // Convert eras to engine format
  const engineEras = eras.map((era) => ({
    id: era.id,
    name: era.name,
    ticks: simulation.settings?.ticksPerEra || 50,
    themes: era.themes || [],
  }));

  // Convert cultures
  const cultures = (project.cultures || []).map((c) => ({
    id: c.id,
    name: c.name,
  }));

  // Convert seed entities to runtime format
  const seedEntities = (project.seedEntities || []).map((e) => ({
    id: e.id,
    kind: e.kind,
    subtype: e.subtype || '',
    name: e.name,
    description: e.description || '',
    status: e.status || 'active',
    prominence: e.prominence || 'recognized',
    tags: e.tags || [],
    cultureId: e.cultureId,
    coordinates: e.coordinates,
    createdInEra: engineEras[0]?.id || 'seed',
    createdAtTick: 0,
    updatedAtTick: 0,
  }));

  // Convert seed relationships to runtime format
  const seedRelationships = (project.seedRelationships || []).map((r) => ({
    id: r.id,
    kind: r.kind,
    srcId: r.srcId,
    dstId: r.dstId,
    distance: r.distance || 0.5,
    metadata: r.metadata,
    createdAtTick: 0,
    archived: false,
  }));

  return {
    simulation,
    eras: engineEras,
    cultures,
    seedEntities,
    seedRelationships,
    onTick,
    onEraComplete,
  };
}

export default function SimulationRunner({ project }) {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ tick: 0, totalTicks: 0, era: '' });
  const [stats, setStats] = useState({ entities: 0, relationships: 0, occurrences: 0 });
  const [completedEras, setCompletedEras] = useState([]);
  const [eraResults, setEraResults] = useState([]);
  const [log, setLog] = useState([]);
  const [result, setResult] = useState(null);

  const abortRef = useRef(false);

  const simulation = project?.simulation;
  const eras = project?.eras || [];

  // Calculate total ticks
  const ticksPerEra = simulation?.settings?.ticksPerEra || 50;
  const totalTicks = eras.length * ticksPerEra;

  // Validate config
  const validationErrors = validateConfig(simulation, eras);
  const canRun = validationErrors.length === 0;

  const addLog = useCallback((entry) => {
    setLog((prev) => [...prev.slice(-99), entry]); // Keep last 100 entries
  }, []);

  const handleRun = useCallback(async () => {
    if (!canRun) return;

    setRunning(true);
    setProgress({ tick: 0, totalTicks, era: eras[0]?.name || '' });
    setStats({ entities: 0, relationships: 0, occurrences: 0 });
    setCompletedEras([]);
    setEraResults([]);
    setLog([]);
    setResult(null);
    abortRef.current = false;

    try {
      // Dynamically import the simulation engine
      const { runSimulation } = await import('@canonry/simulation-engine');

      const onTick = (tickResult) => {
        if (abortRef.current) return;

        setProgress({
          tick: tickResult.tick,
          totalTicks,
          era: eras.find((e) => e.id === tickResult.era)?.name || tickResult.era,
        });

        setStats({
          entities: tickResult.totalEntities,
          relationships: tickResult.totalRelationships,
          occurrences: 0, // Updated on era complete
        });

        // Log rules that fired
        for (const rule of tickResult.rulesFired) {
          if (rule.success) {
            addLog({
              tick: tickResult.tick,
              phase: tickResult.phase,
              ruleId: rule.ruleId,
              success: true,
              entities: rule.entitiesCreated.length,
              relationships: rule.relationshipsCreated.length,
            });
          } else if (rule.error) {
            addLog({
              tick: tickResult.tick,
              phase: tickResult.phase,
              ruleId: rule.ruleId,
              success: false,
              error: rule.error,
            });
          }
        }
      };

      const onEraComplete = (eraResult) => {
        if (abortRef.current) return;

        setCompletedEras((prev) => [...prev, eraResult.eraId]);
        setEraResults((prev) => [...prev, eraResult]);
      };

      const config = buildEngineConfig(project, onTick, onEraComplete);

      // Run simulation (this will be synchronous but uses callbacks)
      const simResult = runSimulation(config);

      setResult(simResult);
      setStats({
        entities: simResult.totalEntities,
        relationships: simResult.totalRelationships,
        occurrences: simResult.totalOccurrences,
      });
    } catch (error) {
      addLog({
        tick: 0,
        phase: 'error',
        ruleId: 'engine',
        success: false,
        error: error.message,
      });
    } finally {
      setRunning(false);
    }
  }, [canRun, project, eras, totalTicks, addLog]);

  const handleStop = useCallback(() => {
    abortRef.current = true;
    setRunning(false);
  }, []);

  /**
   * Export simulation results as JSON
   */
  const handleExport = useCallback(() => {
    if (!result) return;

    // Convert Maps to arrays for JSON serialization
    const exportData = {
      metadata: {
        exportedAt: new Date().toISOString(),
        projectName: project?.name || 'Untitled',
        totalTicks: result.totalTicks,
        totalEntities: result.totalEntities,
        totalRelationships: result.totalRelationships,
        totalOccurrences: result.totalOccurrences,
      },
      eraResults: result.eraResults,
      entities: Array.from(result.state.entities.values()),
      relationships: Array.from(result.state.relationships.values()),
      occurrences: result.state.occurrences,
      pressures: Object.fromEntries(result.state.pressures),
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `simulation-${project?.name || 'export'}-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [result, project]);

  const progressPercent = totalTicks > 0 ? (progress.tick / totalTicks) * 100 : 0;

  return (
    <div style={styles.container}>
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>Run Simulation</h3>

        {validationErrors.length > 0 && (
          <div style={styles.validationErrors}>
            <div style={styles.validationTitle}>Cannot run simulation</div>
            {validationErrors.map((error, i) => (
              <div key={i} style={styles.validationItem}>
                • {error}
              </div>
            ))}
          </div>
        )}

        <div style={styles.controls}>
          <button
            style={{
              ...styles.runButton,
              ...(running || !canRun ? styles.runButtonDisabled : {}),
            }}
            onClick={handleRun}
            disabled={running || !canRun}
          >
            {running ? 'Running...' : 'Run Simulation'}
          </button>

          {running && (
            <button style={styles.stopButton} onClick={handleStop}>
              Stop
            </button>
          )}
        </div>

        {/* Era Progress Chips */}
        {eras.length > 0 && (
          <div style={styles.eraProgress}>
            {eras.map((era) => {
              const isComplete = completedEras.includes(era.id);
              const isActive = progress.era === era.name && running;
              return (
                <span
                  key={era.id}
                  style={{
                    ...styles.eraChip,
                    ...(isComplete ? styles.eraChipComplete : {}),
                    ...(isActive ? styles.eraChipActive : {}),
                  }}
                >
                  {era.name}
                </span>
              );
            })}
          </div>
        )}

        {/* Progress Bar */}
        {(running || progress.tick > 0) && (
          <div style={styles.progressContainer}>
            <div style={styles.progressBar}>
              <div style={{ ...styles.progressFill, width: `${progressPercent}%` }} />
            </div>
            <div style={styles.progressText}>
              <span>
                Tick {progress.tick} / {totalTicks}
              </span>
              <span>{Math.round(progressPercent)}%</span>
            </div>
          </div>
        )}

        {/* Live Stats */}
        <div style={styles.stats}>
          <div style={styles.statCard}>
            <div style={styles.statValue}>{stats.entities}</div>
            <div style={styles.statLabel}>Entities</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statValue}>{stats.relationships}</div>
            <div style={styles.statLabel}>Relationships</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statValue}>{stats.occurrences}</div>
            <div style={styles.statLabel}>Occurrences</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statValue}>{completedEras.length}</div>
            <div style={styles.statLabel}>Eras Complete</div>
          </div>
        </div>
      </div>

      {/* Execution Log */}
      {log.length > 0 && (
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>Execution Log</h3>
          <div style={styles.log}>
            {log.map((entry, i) => (
              <div key={i} style={styles.logEntry}>
                <span style={styles.logTick}>[{entry.tick}]</span>
                <span style={styles.logRule}>{entry.ruleId}</span>
                {entry.success ? (
                  <span style={styles.logSuccess}>
                    {' '}
                    +{entry.entities} entities, +{entry.relationships} rels
                  </span>
                ) : (
                  <span style={styles.logError}> {entry.error || 'conditions not met'}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Era Results */}
      {eraResults.length > 0 && (
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>Era Results</h3>
          {eraResults.map((era) => (
            <div key={era.eraId} style={styles.eraResult}>
              <div style={styles.eraResultHeader}>
                <span style={styles.eraResultName}>{era.eraName}</span>
                <span style={{ fontSize: typography.sizeXs, color: colors.textMuted }}>
                  {era.ticks} ticks
                </span>
              </div>
              <div style={styles.eraResultStats}>
                <span>+{era.entitiesCreated} entities</span>
                <span>+{era.relationshipsCreated} relationships</span>
                <span>{era.occurrences} occurrences</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Final Summary */}
      {result && !running && (
        <div style={styles.section}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg }}>
            <h3 style={{ ...styles.sectionTitle, marginBottom: 0 }}>Simulation Complete</h3>
            <button style={styles.exportButton} onClick={handleExport}>
              Export Results
            </button>
          </div>
          <p style={{ color: colors.textSecondary, marginBottom: spacing.md }}>
            Completed {result.totalTicks} ticks across {result.eraResults.length} eras.
          </p>
          <div style={styles.stats}>
            <div style={styles.statCard}>
              <div style={styles.statValue}>{result.totalEntities}</div>
              <div style={styles.statLabel}>Total Entities</div>
            </div>
            <div style={styles.statCard}>
              <div style={styles.statValue}>{result.totalRelationships}</div>
              <div style={styles.statLabel}>Total Relationships</div>
            </div>
            <div style={styles.statCard}>
              <div style={styles.statValue}>{result.totalOccurrences}</div>
              <div style={styles.statLabel}>Total Occurrences</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
