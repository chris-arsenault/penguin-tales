/**
 * SimulationRunner - Runs the Lore Weave simulation
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { createDomainSchemaFromJSON } from '@lib';
import SimulationDashboard from '../dashboard';
import DebugSettingsModal from '../DebugSettingsModal';
import ParameterForm from './ParameterForm';
import RunControls from './RunControls';
import ConfigViewer from './ConfigViewer';

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

const DEBUG_MODAL_PREFIX = 'loreweave:debugModal:';

function loadStoredBoolean(key) {
  if (!key || typeof localStorage === 'undefined') return false;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) === true : false;
  } catch {
    return false;
  }
}

function saveStoredBoolean(key, value) {
  if (!key || typeof localStorage === 'undefined') return;
  try {
    if (value) {
      localStorage.setItem(key, JSON.stringify(true));
    } else {
      localStorage.removeItem(key);
    }
  } catch {
    // Best-effort only.
  }
}

export default function SimulationRunner({
  projectId,
  schema,
  eras,
  pressures,
  generators,
  systems,
  actions,
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
  onViewInArchivist,
  externalSimulationState,
  onSimulationStateChange,
  simulationWorker,
}) {
  // Simulation parameters
  const [params, setParams] = useState({
    scaleFactor: 1.0,
    defaultMinDistance: 5,
    pressureDeltaSmoothing: 10,
    ticksPerEpoch: 15,
    maxEpochs: 10,
    targetEntitiesPerKind: 30,
    maxTicks: 500,
  });

  // Debug configuration
  const [debugConfig, setDebugConfig] = useState({
    enabled: false,
    enabledCategories: [],
  });
  const debugModalKey = projectId ? `${DEBUG_MODAL_PREFIX}${projectId}` : `${DEBUG_MODAL_PREFIX}global`;
  const [showDebugModal, setShowDebugModal] = useState(() => loadStoredBoolean(debugModalKey));

  useEffect(() => {
    setShowDebugModal(loadStoredBoolean(debugModalKey));
  }, [debugModalKey]);

  useEffect(() => {
    saveStoredBoolean(debugModalKey, showDebugModal);
  }, [debugModalKey, showDebugModal]);

  // Use simulation worker passed from parent
  const {
    state: workerSimState,
    start: startWorker,
    startStepping: startSteppingWorker,
    step: stepWorker,
    runToCompletion: runToCompletionWorker,
    reset: resetWorker,
    abort: abortWorker,
    clearLogs: workerClearLogs,
    requestExport: workerRequestExport,
    isRunning: workerIsRunning,
    isPaused: workerIsPaused
  } = simulationWorker;

  // Use external state if provided and worker is idle
  const simState = (workerSimState.status === 'idle' && externalSimulationState)
    ? externalSimulationState
    : workerSimState;

  // Sync worker state changes to external state
  const prevStatusRef = React.useRef(workerSimState.status);
  useEffect(() => {
    if (onSimulationStateChange && workerSimState.status !== 'idle') {
      if (prevStatusRef.current !== workerSimState.status) {
        prevStatusRef.current = workerSimState.status;
        onSimulationStateChange(workerSimState);
      }
    }
  }, [workerSimState.status, onSimulationStateChange]);

  // Wrap clearLogs to also clear external state
  const clearLogs = useCallback(() => {
    workerClearLogs();
    if (onSimulationStateChange && externalSimulationState) {
      onSimulationStateChange({ ...externalSimulationState, logs: [] });
    }
  }, [workerClearLogs, onSimulationStateChange, externalSimulationState]);

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
        coordinateState: simState.result.coordinateState,
      };
      onComplete(results);
    }
  }, [simState.status, simState.result, onComplete]);

  // Build coordinate context config
  const coordinateContextConfig = useMemo(() => {
    return buildCoordinateContextConfig(semanticData, cultureVisuals);
  }, [semanticData, cultureVisuals]);

  // Generate the EngineConfig
  const engineConfig = useMemo(() => {
    const domainSchemaJSON = {
      id: schema.id || 'canonry-domain',
      name: schema.name || 'Generated World',
      version: schema.version || '1.0.0',
      entityKinds: schema.entityKinds.map(ek => ({
        ...ek,
        kind: ek.kind || ek.id,
        name: ek.name || ek.description,
        description: ek.description || ek.name,
      })),
      relationshipKinds: schema.relationshipKinds.map(rk => ({
        ...rk,
        kind: rk.kind || rk.id,
        name: rk.name || rk.description,
        srcKinds: rk.srcKinds || rk.sourceKinds || [],
        dstKinds: rk.dstKinds || rk.targetKinds || [],
      })),
      cultures: schema.cultures || [],
    };

    const culturesWithNaming = (schema.cultures || []).map(c => ({
      ...c,
      naming: namingData[c.id] || c.naming,
    }));

    return {
      domain: domainSchemaJSON,
      cultures: culturesWithNaming,
      eras,
      pressures: pressures,
      templates: (generators || []).filter(g => g.enabled !== false),
      systems: (systems || []).filter(s => s.enabled !== false),
      actions: (actions || []).filter(a => a.enabled !== false),
      tagRegistry: schema.tagRegistry || [],
      ticksPerEpoch: params.ticksPerEpoch,
      maxEpochs: params.maxEpochs,
      targetEntitiesPerKind: params.targetEntitiesPerKind,
      maxTicks: params.maxTicks,
      maxRelationshipsPerType: 10,
      scaleFactor: params.scaleFactor,
      defaultMinDistance: params.defaultMinDistance,
      pressureDeltaSmoothing: params.pressureDeltaSmoothing,
      coordinateContextConfig,
      seedRelationships: seedRelationships || [],
      debugConfig,
    };
  }, [schema, eras, pressures, generators, systems, actions, params, coordinateContextConfig, seedRelationships, namingData, debugConfig]);

  // Run simulation
  const runSimulation = useCallback(() => {
    if (!validation.isValid) return;

    const domain = createDomainSchemaFromJSON(engineConfig.domain);
    const fullConfig = { ...engineConfig, domain };
    const initialEntities = seedEntities || [];
    startWorker(fullConfig, initialEntities);
  }, [validation, engineConfig, seedEntities, startWorker]);

  // Start in step mode
  const startStepMode = useCallback(() => {
    if (!validation.isValid) return;

    const domain = createDomainSchemaFromJSON(engineConfig.domain);
    const fullConfig = { ...engineConfig, domain };
    const initialEntities = seedEntities || [];
    startSteppingWorker(fullConfig, initialEntities);
  }, [validation, engineConfig, seedEntities, startSteppingWorker]);

  const handleParamChange = (field, value) => {
    setParams(prev => ({ ...prev, [field]: value }));
  };

  // Export to Archivist handling
  const [pendingExport, setPendingExport] = useState(false);

  const handleExportToArchivist = useCallback(() => {
    if (!onViewInArchivist) return;
    setPendingExport(true);
    workerRequestExport();
  }, [onViewInArchivist, workerRequestExport]);

  useEffect(() => {
    if (pendingExport && simState.stateExport && onViewInArchivist) {
      setPendingExport(false);
      const results = {
        metadata: {
          ...simState.stateExport.metadata,
          durationMs: 0,
        },
        hardState: simState.stateExport.hardState,
        relationships: simState.stateExport.relationships,
        history: simState.stateExport.history,
        pressures: simState.stateExport.pressures,
        coordinateState: simState.stateExport.coordinateState,
      };
      onViewInArchivist(results);
    }
  }, [pendingExport, simState.stateExport, onViewInArchivist]);

  // Show dashboard when running or has data
  const showDashboard = workerIsRunning ||
    workerIsPaused ||
    simState.status === 'complete' ||
    simState.status === 'error' ||
    simState.logs.length > 0;

  return (
    <div className="lw-container">
      <div className="lw-header">
        <h1 className="lw-title">Run Simulation</h1>
        <p className="lw-subtitle">
          Configure and run the world generation simulation
        </p>
      </div>

      {!validation.isValid && (
        <div className="lw-warning-box">
          Configuration is incomplete. Please fix the issues before running the simulation.
        </div>
      )}

      {simState.error && (
        <div className="lw-error-box">
          <strong>Error:</strong> {simState.error.message}
          {simState.error.phase && <span> (during {simState.error.phase})</span>}
        </div>
      )}

      {/* Parameters Card */}
      <div className="lw-card">
        <div className="lw-card-header" style={{ marginBottom: (workerIsRunning && !workerIsPaused) ? 0 : '16px' }}>
          <div className="lw-card-title" style={{ marginBottom: 0 }}>
            Simulation Parameters
          </div>
          <div className="lw-button-row" style={{ marginTop: 0 }}>
            <RunControls
              isRunning={workerIsRunning}
              isPaused={workerIsPaused}
              simState={simState}
              validation={validation}
              onRun={runSimulation}
              onStartStepMode={startStepMode}
              onStep={stepWorker}
              onRunToCompletion={runToCompletionWorker}
              onAbort={abortWorker}
              onReset={resetWorker}
              onExportToArchivist={handleExportToArchivist}
              onViewResults={onViewResults}
              showArchivist={!!onViewInArchivist}
            />
          </div>
        </div>

        {!workerIsRunning && (
          <ParameterForm params={params} onParamChange={handleParamChange} />
        )}

        {!workerIsRunning && (
          <ConfigViewer
            engineConfig={engineConfig}
            debugConfig={debugConfig}
            onShowDebugModal={() => setShowDebugModal(true)}
          />
        )}
      </div>

      {/* Simulation Dashboard */}
      {showDashboard && (
        <SimulationDashboard
          simState={simState}
          onClearLogs={clearLogs}
        />
      )}

      {/* Debug Settings Modal */}
      <DebugSettingsModal
        isOpen={showDebugModal}
        onClose={() => setShowDebugModal(false)}
        debugConfig={debugConfig}
        onDebugConfigChange={setDebugConfig}
      />
    </div>
  );
}
