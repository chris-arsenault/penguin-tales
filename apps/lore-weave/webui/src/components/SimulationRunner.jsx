/**
 * SimulationRunner - Runs the Lore Weave simulation
 *
 * This component handles:
 * - Simulation parameter configuration
 * - Running the WorldEngine simulation in a web worker
 * - Real-time dashboard visualization
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { createDomainSchemaFromJSON } from '@lib';
import { useSimulationWorker } from '../hooks/useSimulationWorker';
import SimulationDashboard from './SimulationDashboard';

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
  card: {
    backgroundColor: '#1e3a5f',
    borderRadius: '8px',
    padding: '24px',
    border: '1px solid rgba(59, 130, 246, 0.3)',
    marginBottom: '24px',
  },
  cardTitle: {
    fontSize: '16px',
    fontWeight: 600,
    color: '#ffffff',
    marginBottom: '16px',
  },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
    gap: '16px',
  },
  formGroup: {
    marginBottom: '0',
  },
  label: {
    display: 'block',
    fontSize: '12px',
    color: '#93c5fd',
    marginBottom: '6px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  input: {
    width: '100%',
    padding: '10px 12px',
    fontSize: '14px',
    backgroundColor: '#0a1929',
    border: '1px solid rgba(59, 130, 246, 0.3)',
    borderRadius: '6px',
    color: '#ffffff',
    boxSizing: 'border-box',
  },
  buttonRow: {
    display: 'flex',
    gap: '12px',
    marginTop: '20px',
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
  runButtonDisabled: {
    background: '#1e3a5f',
    color: '#60a5fa',
    cursor: 'not-allowed',
  },
  abortButton: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 24px',
    fontSize: '15px',
    fontWeight: 500,
    backgroundColor: '#ef4444',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  secondaryButton: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 24px',
    fontSize: '15px',
    fontWeight: 500,
    backgroundColor: 'transparent',
    color: '#93c5fd',
    border: '1px solid rgba(59, 130, 246, 0.3)',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  viewResultsButton: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 24px',
    fontSize: '15px',
    fontWeight: 600,
    background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  warning: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    border: '1px solid rgba(245, 158, 11, 0.3)',
    borderRadius: '8px',
    padding: '16px',
    marginBottom: '24px',
    color: '#f59e0b',
    fontSize: '14px',
  },
  errorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    borderRadius: '8px',
    padding: '16px',
    marginBottom: '24px',
    color: '#ef4444',
    fontSize: '14px',
  },
  configToggle: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginTop: '16px',
    padding: '8px 0',
    fontSize: '13px',
    color: '#93c5fd',
    cursor: 'pointer',
    borderTop: '1px solid rgba(59, 130, 246, 0.3)',
  },
  configOutput: {
    marginTop: '16px',
    backgroundColor: '#0c1f2e',
    borderRadius: '6px',
    padding: '16px',
    fontFamily: 'monospace',
    fontSize: '11px',
    color: '#93c5fd',
    overflow: 'auto',
    maxHeight: '300px',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
  copyButton: {
    padding: '4px 12px',
    fontSize: '12px',
    backgroundColor: '#1e3a5f',
    color: '#93c5fd',
    border: '1px solid rgba(59, 130, 246, 0.3)',
    borderRadius: '4px',
    cursor: 'pointer',
    marginLeft: '8px',
  },
  stepButton: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 24px',
    fontSize: '15px',
    fontWeight: 500,
    background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  resetButton: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 24px',
    fontSize: '15px',
    fontWeight: 500,
    backgroundColor: 'transparent',
    color: '#f59e0b',
    border: '1px solid #f59e0b',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  buttonGroup: {
    display: 'flex',
    gap: '8px',
  },
  stepIndicator: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '8px 16px',
    backgroundColor: '#0a1929',
    borderRadius: '6px',
    fontSize: '13px',
    color: '#93c5fd',
  },
};

/**
 * Build CoordinateContextConfig from canonry's semantic and culture data.
 */
function buildCoordinateContextConfig(semanticData, cultureVisuals) {
  const entityKinds = Object.entries(semanticData || {}).map(([kindId, data]) => ({
    id: kindId,
    semanticPlane: data ? {
      axes: data.axes || {
        x: { name: 'X', lowTag: 'low', highTag: 'high' },
        y: { name: 'Y', lowTag: 'low', highTag: 'high' },
      },
      regions: data.regions || [],
    } : undefined,
  }));

  const cultures = Object.entries(cultureVisuals || {}).map(([cultureId, data]) => ({
    id: cultureId,
    axisBiases: data.axisBiases || {},
    homeRegions: data.homeRegions || {},
  }));

  return { entityKinds, cultures };
}

export default function SimulationRunner({
  schema,
  eras,
  pressures,
  generators,
  systems,
  seedEntities,
  seedRelationships,
  namingData,
  semanticData,
  cultureVisuals,
  validation,
  isRunning,
  setIsRunning,
  onComplete,
  onViewResults,
  externalSimulationState,
  onSimulationStateChange,
}) {
  // Simulation parameters
  const [params, setParams] = useState({
    scaleFactor: 1.0,
    epochLength: 20,
    simulationTicksPerGrowth: 15,
    targetEntitiesPerKind: 30,
    maxTicks: 500,
  });

  const [showConfig, setShowConfig] = useState(false);

  // Use the simulation worker hook
  const {
    state: workerSimState,
    start: startWorker,
    startStepping: startSteppingWorker,
    step: stepWorker,
    runToCompletion: runToCompletionWorker,
    reset: resetWorker,
    abort: abortWorker,
    clearLogs: workerClearLogs,
    isRunning: workerIsRunning,
    isPaused: workerIsPaused
  } = useSimulationWorker();

  // Use external state if provided and worker is idle, otherwise use worker state
  // This preserves dashboard data when navigating away and back
  const simState = (workerSimState.status === 'idle' && externalSimulationState)
    ? externalSimulationState
    : workerSimState;

  // Sync worker state changes to external state
  useEffect(() => {
    if (onSimulationStateChange && workerSimState.status !== 'idle') {
      onSimulationStateChange(workerSimState);
    }
  }, [workerSimState, onSimulationStateChange]);

  // Wrap clearLogs to also clear external state
  const clearLogs = useCallback(() => {
    workerClearLogs();
    if (onSimulationStateChange && externalSimulationState) {
      onSimulationStateChange({ ...externalSimulationState, logs: [] });
    }
  }, [workerClearLogs, onSimulationStateChange, externalSimulationState]);

  // Sync running state with parent
  useEffect(() => {
    setIsRunning(workerIsRunning);
  }, [workerIsRunning, setIsRunning]);

  // Handle completion
  useEffect(() => {
    if (simState.status === 'complete' && simState.result) {
      const results = {
        metadata: simState.result.metadata,
        hardState: simState.result.hardState,
        relationships: simState.result.relationships,
        history: simState.result.history,
        pressures: simState.result.pressures,
        distributionMetrics: simState.result.distributionMetrics,
      };
      onComplete(results);
    }
  }, [simState.status, simState.result, onComplete]);

  // Build the coordinateContextConfig with correct structure
  const coordinateContextConfig = useMemo(() => {
    return buildCoordinateContextConfig(semanticData, cultureVisuals);
  }, [semanticData, cultureVisuals]);

  // Generate the EngineConfig that would be passed to WorldEngine
  const engineConfig = useMemo(() => {
    const domainSchemaJSON = {
      id: schema.id || 'canonry-domain',
      name: schema.name || 'Generated World',
      version: schema.version || '1.0.0',
      entityKinds: schema.entityKinds.map(ek => ({
        id: ek.id,
        kind: ek.kind || ek.id,
        name: ek.name || ek.description,
        description: ek.description || ek.name,
        subtypes: ek.subtypes || [],
        statuses: ek.statuses || [],
        color: ek.color,
        shape: ek.shape,
      })),
      relationshipKinds: schema.relationshipKinds.map(rk => ({
        id: rk.id,
        kind: rk.kind || rk.id,
        name: rk.name || rk.description,
        description: rk.description,
        srcKinds: rk.srcKinds || rk.sourceKinds || [],
        dstKinds: rk.dstKinds || rk.targetKinds || [],
      })),
      // Domain cultures (for DomainSchema)
      cultures: (schema.cultures || []).map(c => ({
        id: c.id,
        name: c.name,
        description: c.description,
      })),
    };

    // Build cultures array with naming config for EngineConfig.cultures
    // WorldEngine uses this to create NameForgeService
    const culturesWithNaming = (schema.cultures || []).map(c => ({
      id: c.id,
      name: c.name,
      description: c.description,
      // Include naming config for NameForgeService
      naming: namingData[c.id] || c.naming,
    }));

    return {
      domain: domainSchemaJSON,
      // Cultures with naming config - required by WorldEngine for NameForgeService
      cultures: culturesWithNaming,
      eras: eras.map(era => ({
        id: era.id,
        name: era.name,
        description: era.description,
        templateWeights: era.templateWeights || {},
        systemModifiers: era.systemModifiers || {},
        pressureModifiers: era.pressureModifiers || {},
      })),
      pressures: pressures,
      // Filter out disabled generators and systems
      templates: (generators || []).filter(g => g.enabled !== false),
      systems: (systems || []).filter(s => s.enabled !== false),
      epochLength: params.epochLength,
      simulationTicksPerGrowth: params.simulationTicksPerGrowth,
      targetEntitiesPerKind: params.targetEntitiesPerKind,
      maxTicks: params.maxTicks,
      maxRelationshipsPerType: 10,
      scaleFactor: params.scaleFactor,
      coordinateContextConfig,
      seedRelationships: seedRelationships || [],
    };
  }, [schema, eras, pressures, generators, systems, params, coordinateContextConfig, seedRelationships, namingData]);

  // Run simulation using web worker
  const runSimulation = useCallback(() => {
    if (!validation.isValid) return;

    // Convert domain schema from JSON
    const domain = createDomainSchemaFromJSON(engineConfig.domain);

    // Build the full config for WorldEngine (emitter is added by worker)
    const fullConfig = {
      ...engineConfig,
      domain,
    };

    const initialEntities = seedEntities || [];
    startWorker(fullConfig, initialEntities);
  }, [validation, engineConfig, seedEntities, startWorker]);

  // Start in step mode (initialize but pause)
  const startStepMode = useCallback(() => {
    if (!validation.isValid) return;

    const domain = createDomainSchemaFromJSON(engineConfig.domain);
    const fullConfig = {
      ...engineConfig,
      domain,
    };

    const initialEntities = seedEntities || [];
    startSteppingWorker(fullConfig, initialEntities);
  }, [validation, engineConfig, seedEntities, startSteppingWorker]);

  const handleParamChange = (field, value) => {
    setParams(prev => ({ ...prev, [field]: value }));
  };

  const copyConfig = useCallback(() => {
    navigator.clipboard.writeText(JSON.stringify(engineConfig, null, 2));
  }, [engineConfig]);

  // Show dashboard when running, paused, or has run
  const showDashboard = workerIsRunning ||
    workerIsPaused ||
    simState.status === 'complete' ||
    simState.status === 'error' ||
    simState.logs.length > 0;

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Run Simulation</h1>
        <p style={styles.subtitle}>
          Configure and run the world generation simulation
        </p>
      </div>

      {!validation.isValid && (
        <div style={styles.warning}>
          Configuration is incomplete. Please fix the issues before running the simulation.
        </div>
      )}

      {simState.error && (
        <div style={styles.errorBox}>
          <strong>Error:</strong> {simState.error.message}
          {simState.error.phase && <span> (during {simState.error.phase})</span>}
        </div>
      )}

      {/* Parameters Card - Compact when running */}
      <div style={styles.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: (workerIsRunning && !workerIsPaused) ? 0 : '16px' }}>
          <div style={styles.cardTitle}>
            Simulation Parameters
          </div>
          <div style={styles.buttonRow}>
            {workerIsRunning && !workerIsPaused ? (
              /* Running state - show stop button */
              <button
                style={styles.abortButton}
                onClick={abortWorker}
              >
                ◼ Stop
              </button>
            ) : workerIsPaused ? (
              /* Paused state - show step controls */
              <>
                <div style={styles.stepIndicator}>
                  <span>Epoch {simState.progress?.epoch || 0} / {simState.progress?.totalEpochs || 0}</span>
                  <span style={{ color: '#f59e0b' }}>PAUSED</span>
                </div>
                <div style={styles.buttonGroup}>
                  <button
                    style={styles.stepButton}
                    onClick={stepWorker}
                  >
                    ⏭ Next Epoch
                  </button>
                  <button
                    style={styles.runButton}
                    onClick={runToCompletionWorker}
                    title="Continue running all remaining epochs"
                  >
                    ▶ Continue
                  </button>
                  <button
                    style={styles.resetButton}
                    onClick={resetWorker}
                  >
                    ↻ Reset
                  </button>
                </div>
                {simState.status === 'complete' && onViewResults && (
                  <button
                    style={styles.viewResultsButton}
                    onClick={onViewResults}
                  >
                    ✓ View Results
                  </button>
                )}
              </>
            ) : (
              /* Idle or complete state - show run/step buttons */
              <>
                <div style={styles.buttonGroup}>
                  <button
                    style={{
                      ...styles.runButton,
                      ...(!validation.isValid ? styles.runButtonDisabled : {}),
                    }}
                    onClick={runSimulation}
                    disabled={!validation.isValid}
                  >
                    ▶ Run All
                  </button>
                  <button
                    style={{
                      ...styles.stepButton,
                      ...(!validation.isValid ? styles.runButtonDisabled : {}),
                    }}
                    onClick={startStepMode}
                    disabled={!validation.isValid}
                    title="Run one epoch at a time"
                  >
                    ⏯ Step Mode
                  </button>
                </div>
                {simState.status === 'complete' && onViewResults && (
                  <button
                    style={styles.viewResultsButton}
                    onClick={onViewResults}
                  >
                    ✓ View Results
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {!workerIsRunning && (
          <div style={styles.formGrid}>
            <div style={styles.formGroup}>
              <label style={styles.label}>Scale Factor</label>
              <input
                type="number"
                min="0.1"
                max="10"
                step="0.1"
                value={params.scaleFactor}
                onChange={(e) => handleParamChange('scaleFactor', parseFloat(e.target.value) || 1)}
                style={styles.input}
              />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>Epoch Length</label>
              <input
                type="number"
                min="5"
                max="100"
                value={params.epochLength}
                onChange={(e) => handleParamChange('epochLength', parseInt(e.target.value) || 20)}
                style={styles.input}
              />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>Sim Ticks / Growth</label>
              <input
                type="number"
                min="1"
                max="50"
                value={params.simulationTicksPerGrowth}
                onChange={(e) => handleParamChange('simulationTicksPerGrowth', parseInt(e.target.value) || 15)}
                style={styles.input}
              />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>Target / Kind</label>
              <input
                type="number"
                min="5"
                max="500"
                value={params.targetEntitiesPerKind}
                onChange={(e) => handleParamChange('targetEntitiesPerKind', parseInt(e.target.value) || 30)}
                style={styles.input}
              />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>Max Ticks</label>
              <input
                type="number"
                min="100"
                max="5000"
                value={params.maxTicks}
                onChange={(e) => handleParamChange('maxTicks', parseInt(e.target.value) || 500)}
                style={styles.input}
              />
            </div>
          </div>
        )}

        {/* Collapsible config output */}
        {!workerIsRunning && (
          <>
            <div
              style={styles.configToggle}
              onClick={() => setShowConfig(!showConfig)}
            >
              <span>{showConfig ? '▼' : '▶'}</span>
              <span>View Engine Configuration</span>
              <button
                style={styles.copyButton}
                onClick={(e) => { e.stopPropagation(); copyConfig(); }}
              >
                Copy
              </button>
            </div>
            {showConfig && (
              <div style={styles.configOutput}>
                {JSON.stringify(engineConfig, null, 2)}
              </div>
            )}
          </>
        )}
      </div>

      {/* Simulation Dashboard */}
      {showDashboard && (
        <SimulationDashboard
          simState={simState}
          onClearLogs={clearLogs}
        />
      )}
    </div>
  );
}
