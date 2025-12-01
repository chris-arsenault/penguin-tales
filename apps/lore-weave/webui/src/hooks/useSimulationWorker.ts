/**
 * React hook for managing simulation web worker
 *
 * Provides:
 * - Worker lifecycle management (start, terminate)
 * - Real-time progress updates
 * - Log streaming
 * - Epoch/population statistics
 * - Final results
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import type {
  SimulationEvent,
  ProgressPayload,
  LogPayload,
  ValidationPayload,
  EpochStartPayload,
  EpochStatsPayload,
  GrowthPhasePayload,
  PopulationPayload,
  TemplateUsagePayload,
  CoordinateStatsPayload,
  TagHealthPayload,
  SystemHealthPayload,
  EntityBreakdownPayload,
  CatalystStatsPayload,
  RelationshipBreakdownPayload,
  NotableEntitiesPayload,
  SampleHistoryPayload,
  SimulationResultPayload,
  ErrorPayload
} from '../../../lib/observer/types';
import type { EngineConfig } from '../../../lib/engine/types';
import type { HardState } from '../../../lib/core/worldTypes';

// Maximum log entries to keep in memory
const MAX_LOG_ENTRIES = 1000;

export interface SimulationState {
  status: 'idle' | 'initializing' | 'validating' | 'running' | 'finalizing' | 'paused' | 'complete' | 'error';
  progress: ProgressPayload | null;
  validation: ValidationPayload | null;
  currentEpoch: EpochStartPayload | null;
  epochStats: EpochStatsPayload[];
  growthPhases: GrowthPhasePayload[];
  populationReport: PopulationPayload | null;
  templateUsage: TemplateUsagePayload | null;
  coordinateStats: CoordinateStatsPayload | null;
  tagHealth: TagHealthPayload | null;
  systemHealth: SystemHealthPayload | null;
  // Final diagnostics
  entityBreakdown: EntityBreakdownPayload | null;
  catalystStats: CatalystStatsPayload | null;
  relationshipBreakdown: RelationshipBreakdownPayload | null;
  notableEntities: NotableEntitiesPayload | null;
  sampleHistory: SampleHistoryPayload | null;
  result: SimulationResultPayload | null;
  error: ErrorPayload | null;
  logs: LogPayload[];
}

export interface UseSimulationWorkerReturn {
  state: SimulationState;
  start: (config: EngineConfig, initialState: HardState[]) => void;
  startStepping: (config: EngineConfig, initialState: HardState[]) => void;
  step: () => void;
  runToCompletion: () => void;
  reset: () => void;
  abort: () => void;
  clearLogs: () => void;
  isRunning: boolean;
  isPaused: boolean;
}

const initialState: SimulationState = {
  status: 'idle',
  progress: null,
  validation: null,
  currentEpoch: null,
  epochStats: [],
  growthPhases: [],
  populationReport: null,
  templateUsage: null,
  coordinateStats: null,
  tagHealth: null,
  systemHealth: null,
  entityBreakdown: null,
  catalystStats: null,
  relationshipBreakdown: null,
  notableEntities: null,
  sampleHistory: null,
  result: null,
  error: null,
  logs: []
};

export function useSimulationWorker(): UseSimulationWorkerReturn {
  const [state, setState] = useState<SimulationState>(initialState);
  const workerRef = useRef<Worker | null>(null);

  // Cleanup worker on unmount
  useEffect(() => {
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, []);

  const handleMessage = useCallback((event: MessageEvent<SimulationEvent>) => {
    const message = event.data;

    setState(prev => {
      switch (message.type) {
        case 'progress':
          // Map progress phase to status (includes 'paused')
          const status = message.payload.phase as SimulationState['status'];
          return {
            ...prev,
            status,
            progress: message.payload
          };

        case 'log':
          // Limit log entries to prevent memory issues
          const newLogs = [...prev.logs, message.payload];
          if (newLogs.length > MAX_LOG_ENTRIES) {
            newLogs.splice(0, newLogs.length - MAX_LOG_ENTRIES);
          }
          return {
            ...prev,
            logs: newLogs
          };

        case 'validation':
          return {
            ...prev,
            validation: message.payload
          };

        case 'epoch_start':
          return {
            ...prev,
            currentEpoch: message.payload
          };

        case 'epoch_stats':
          return {
            ...prev,
            epochStats: [...prev.epochStats, message.payload]
          };

        case 'growth_phase':
          return {
            ...prev,
            growthPhases: [...prev.growthPhases, message.payload]
          };

        case 'population_report':
          return {
            ...prev,
            populationReport: message.payload
          };

        case 'template_usage':
          return {
            ...prev,
            templateUsage: message.payload
          };

        case 'coordinate_stats':
          return {
            ...prev,
            coordinateStats: message.payload
          };

        case 'tag_health':
          return {
            ...prev,
            tagHealth: message.payload
          };

        case 'system_health':
          return {
            ...prev,
            systemHealth: message.payload
          };

        case 'entity_breakdown':
          return {
            ...prev,
            entityBreakdown: message.payload
          };

        case 'catalyst_stats':
          return {
            ...prev,
            catalystStats: message.payload
          };

        case 'relationship_breakdown':
          return {
            ...prev,
            relationshipBreakdown: message.payload
          };

        case 'notable_entities':
          return {
            ...prev,
            notableEntities: message.payload
          };

        case 'sample_history':
          return {
            ...prev,
            sampleHistory: message.payload
          };

        case 'complete':
          return {
            ...prev,
            status: 'complete',
            result: message.payload
          };

        case 'error':
          return {
            ...prev,
            status: 'error',
            error: message.payload
          };

        default:
          return prev;
      }
    });
  }, []);

  const start = useCallback((config: EngineConfig, initialState: HardState[]) => {
    // Terminate existing worker if any
    if (workerRef.current) {
      workerRef.current.terminate();
    }

    // Reset state
    setState({
      ...initialState as unknown as SimulationState,
      status: 'initializing',
      epochStats: [],
      growthPhases: [],
      logs: []
    });

    // Create new worker using Vite's web worker support
    // Import the worker as a module - Vite bundles it appropriately
    workerRef.current = new Worker(
      new URL('../workers/simulation.worker.ts', import.meta.url),
      { type: 'module' }
    );

    workerRef.current.onmessage = handleMessage;

    workerRef.current.onerror = (error) => {
      setState(prev => ({
        ...prev,
        status: 'error',
        error: {
          message: error.message || 'Worker error',
          phase: 'worker',
          context: {}
        }
      }));
    };

    // Start simulation
    workerRef.current.postMessage({
      type: 'start',
      config,
      initialState
    });
  }, [handleMessage]);

  const startStepping = useCallback((config: EngineConfig, initialEntities: HardState[]) => {
    // Terminate existing worker if any
    if (workerRef.current) {
      workerRef.current.terminate();
    }

    // Reset state
    setState({
      ...initialState as unknown as SimulationState,
      status: 'initializing',
      epochStats: [],
      growthPhases: [],
      logs: []
    });

    // Create new worker
    workerRef.current = new Worker(
      new URL('../workers/simulation.worker.ts', import.meta.url),
      { type: 'module' }
    );

    workerRef.current.onmessage = handleMessage;

    workerRef.current.onerror = (error) => {
      setState(prev => ({
        ...prev,
        status: 'error',
        error: {
          message: error.message || 'Worker error',
          phase: 'worker',
          context: {}
        }
      }));
    };

    // Initialize for stepping (doesn't run automatically)
    workerRef.current.postMessage({
      type: 'startStepping',
      config,
      initialState: initialEntities
    });
  }, [handleMessage]);

  const step = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.postMessage({ type: 'step' });
    }
  }, []);

  const runToCompletion = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.postMessage({ type: 'runToCompletion' });
    }
  }, []);

  const reset = useCallback(() => {
    if (workerRef.current) {
      // Reset state but keep worker
      setState(prev => ({
        ...prev,
        status: 'initializing',
        epochStats: [],
        growthPhases: [],
        populationReport: null,
        templateUsage: null,
        coordinateStats: null,
        tagHealth: null,
        systemHealth: null,
        entityBreakdown: null,
        catalystStats: null,
        relationshipBreakdown: null,
        notableEntities: null,
        sampleHistory: null,
        result: null,
        error: null
      }));
      workerRef.current.postMessage({ type: 'reset' });
    }
  }, []);

  const abort = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
      setState(prev => ({
        ...prev,
        status: 'idle'
      }));
    }
  }, []);

  const clearLogs = useCallback(() => {
    setState(prev => ({
      ...prev,
      logs: []
    }));
  }, []);

  const isRunning = state.status === 'initializing' ||
                   state.status === 'validating' ||
                   state.status === 'running' ||
                   state.status === 'finalizing';

  const isPaused = state.status === 'paused';

  return {
    state,
    start,
    startStepping,
    step,
    runToCompletion,
    reset,
    abort,
    clearLogs,
    isRunning,
    isPaused
  };
}
