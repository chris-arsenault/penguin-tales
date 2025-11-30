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
  card: {
    backgroundColor: '#252535',
    borderRadius: '8px',
    padding: '24px',
    border: '1px solid #3d3d4d',
    marginBottom: '24px',
  },
  cardTitle: {
    fontSize: '16px',
    fontWeight: 600,
    color: '#f0f0f0',
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
    color: '#909090',
    marginBottom: '6px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  input: {
    width: '100%',
    padding: '10px 12px',
    fontSize: '14px',
    backgroundColor: '#1e1e2e',
    border: '1px solid #3d3d4d',
    borderRadius: '6px',
    color: '#f0f0f0',
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
    background: '#3d3d4d',
    color: '#707080',
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
    color: '#b0b0c0',
    border: '1px solid #3d3d4d',
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
    color: '#808090',
    cursor: 'pointer',
    borderTop: '1px solid #3d3d4d',
  },
  configOutput: {
    marginTop: '16px',
    backgroundColor: '#12121a',
    borderRadius: '6px',
    padding: '16px',
    fontFamily: 'monospace',
    fontSize: '11px',
    color: '#808090',
    overflow: 'auto',
    maxHeight: '300px',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
  copyButton: {
    padding: '4px 12px',
    fontSize: '12px',
    backgroundColor: '#252535',
    color: '#b0b0c0',
    border: '1px solid #3d3d4d',
    borderRadius: '4px',
    cursor: 'pointer',
    marginLeft: '8px',
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
        x: { name: 'X', lowLabel: 'Low', highLabel: 'High' },
        y: { name: 'Y', lowLabel: 'Low', highLabel: 'High' },
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
  seedEntities,
  seedRelationships,
  namingData,
  semanticData,
  cultureVisuals,
  validation,
  isRunning,
  setIsRunning,
  onComplete,
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
    state: simState,
    start: startWorker,
    abort: abortWorker,
    clearLogs,
    isRunning: workerIsRunning
  } = useSimulationWorker();

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
      cultures: (schema.cultures || []).map(c => ({
        id: c.id,
        name: c.name,
        description: c.description,
      })),
    };

    return {
      domain: domainSchemaJSON,
      eras: eras.map(era => ({
        id: era.id,
        name: era.name,
        description: era.description,
        templateWeights: era.templateWeights || {},
        systemModifiers: era.systemModifiers || {},
        pressureModifiers: era.pressureModifiers || {},
      })),
      pressures: pressures,
      templates: generators,
      systems: [],
      epochLength: params.epochLength,
      simulationTicksPerGrowth: params.simulationTicksPerGrowth,
      targetEntitiesPerKind: params.targetEntitiesPerKind,
      maxTicks: params.maxTicks,
      maxRelationshipsPerType: 10,
      scaleFactor: params.scaleFactor,
      coordinateContextConfig,
      seedRelationships: seedRelationships || [],
    };
  }, [schema, eras, pressures, generators, params, coordinateContextConfig, seedRelationships]);

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

  const handleParamChange = (field, value) => {
    setParams(prev => ({ ...prev, [field]: value }));
  };

  const copyConfig = useCallback(() => {
    navigator.clipboard.writeText(JSON.stringify(engineConfig, null, 2));
  }, [engineConfig]);

  // Show dashboard when running or has run
  const showDashboard = workerIsRunning ||
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: workerIsRunning ? 0 : '16px' }}>
          <div style={styles.cardTitle}>
            Simulation Parameters
          </div>
          <div style={styles.buttonRow}>
            {!workerIsRunning ? (
              <button
                style={{
                  ...styles.runButton,
                  ...(!validation.isValid ? styles.runButtonDisabled : {}),
                }}
                onClick={runSimulation}
                disabled={!validation.isValid}
              >
                ▶ Run Simulation
              </button>
            ) : (
              <button
                style={styles.abortButton}
                onClick={abortWorker}
              >
                ◼ Stop
              </button>
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
