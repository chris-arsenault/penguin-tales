/**
 * React hook for managing enrichment web worker
 *
 * Provides:
 * - Worker lifecycle management
 * - Task queue management
 * - Real-time progress updates
 * - Entity-level task control
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import type {
  WorkerOutbound,
  EnrichmentTask,
  EnrichmentConfig,
  DomainContext,
  TaskFilter,
  EnrichmentResult,
  HardState,
} from '../workers/enrichment.worker';

export type EnrichmentStatus =
  | 'idle'
  | 'initializing'
  | 'ready'
  | 'running'
  | 'paused'
  | 'complete'
  | 'error';

export interface EnrichmentState {
  status: EnrichmentStatus;
  tasks: EnrichmentTask[];
  completedCount: number;
  totalCount: number;
  runningTaskIds: string[];
  error: string | null;
  enrichedEntities: HardState[] | null;
}

export interface UseEnrichmentWorkerReturn {
  state: EnrichmentState;
  initialize: (config: EnrichmentConfig, worldData: HardState[], domainContext: DomainContext) => void;
  runAll: () => void;
  runFiltered: (filter: TaskFilter) => void;
  runEntity: (entityId: string) => void;
  runTask: (taskId: string) => void;
  runTasks: (taskIds: string[]) => void;
  pause: () => void;
  resume: () => void;
  abort: () => void;
  reset: (entityIds?: string[]) => void;
  isRunning: boolean;
  isPaused: boolean;
}

const initialState: EnrichmentState = {
  status: 'idle',
  tasks: [],
  completedCount: 0,
  totalCount: 0,
  runningTaskIds: [],
  error: null,
  enrichedEntities: null,
};

export function useEnrichmentWorker(): UseEnrichmentWorkerReturn {
  const [state, setState] = useState<EnrichmentState>(initialState);
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

  const handleMessage = useCallback((event: MessageEvent<WorkerOutbound>) => {
    const message = event.data;

    setState((prev) => {
      switch (message.type) {
        case 'queueBuilt':
          return {
            ...prev,
            status: 'ready',
            tasks: message.tasks,
            totalCount: message.tasks.length,
            completedCount: message.tasks.filter((t) => t.status === 'complete').length,
          };

        case 'taskStarted':
          return {
            ...prev,
            status: 'running',
            runningTaskIds: [...prev.runningTaskIds, message.taskId],
            tasks: prev.tasks.map((t) =>
              t.id === message.taskId ? { ...t, status: 'running' as const } : t
            ),
          };

        case 'taskComplete': {
          const updatedTasks = prev.tasks.map((t) =>
            t.id === message.taskId
              ? { ...t, status: 'complete' as const, result: message.result, runAt: Date.now() }
              : t
          );
          return {
            ...prev,
            tasks: updatedTasks,
            runningTaskIds: prev.runningTaskIds.filter((id) => id !== message.taskId),
            completedCount: updatedTasks.filter((t) => t.status === 'complete').length,
          };
        }

        case 'taskError': {
          const updatedTasks = prev.tasks.map((t) =>
            t.id === message.taskId ? { ...t, status: 'error' as const, error: message.error } : t
          );
          return {
            ...prev,
            tasks: updatedTasks,
            runningTaskIds: prev.runningTaskIds.filter((id) => id !== message.taskId),
          };
        }

        case 'progress':
          return {
            ...prev,
            completedCount: message.completed,
            totalCount: message.total,
            runningTaskIds: message.running,
          };

        case 'batchComplete':
          return {
            ...prev,
            tasks: prev.tasks.map((t) => {
              const completed = message.completedTasks.find((ct) => ct.id === t.id);
              return completed || t;
            }),
          };

        case 'allComplete':
          return {
            ...prev,
            status: 'complete',
            runningTaskIds: [],
            enrichedEntities: message.enrichedEntities,
          };

        case 'error':
          return {
            ...prev,
            status: 'error',
            error: message.message,
          };

        default:
          return prev;
      }
    });
  }, []);

  const createWorker = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.terminate();
    }

    workerRef.current = new Worker(
      new URL('../workers/enrichment.worker.ts', import.meta.url),
      { type: 'module' }
    );

    workerRef.current.onmessage = handleMessage;

    workerRef.current.onerror = (error) => {
      setState((prev) => ({
        ...prev,
        status: 'error',
        error: error.message || 'Worker error',
      }));
    };

    return workerRef.current;
  }, [handleMessage]);

  const initialize = useCallback(
    (config: EnrichmentConfig, worldData: HardState[], domainContext: DomainContext) => {
      setState({
        ...initialState,
        status: 'initializing',
      });

      const worker = createWorker();
      worker.postMessage({
        type: 'init',
        config,
        worldData,
        domainContext,
      });
    },
    [createWorker]
  );

  const runAll = useCallback(() => {
    if (workerRef.current) {
      setState((prev) => ({ ...prev, status: 'running' }));
      workerRef.current.postMessage({ type: 'runAll' });
    }
  }, []);

  const runFiltered = useCallback((filter: TaskFilter) => {
    if (workerRef.current) {
      setState((prev) => ({ ...prev, status: 'running' }));
      workerRef.current.postMessage({ type: 'runFiltered', filter });
    }
  }, []);

  const runEntity = useCallback((entityId: string) => {
    if (workerRef.current) {
      setState((prev) => ({ ...prev, status: 'running' }));
      workerRef.current.postMessage({ type: 'runEntity', entityId });
    }
  }, []);

  const runTask = useCallback((taskId: string) => {
    if (workerRef.current) {
      setState((prev) => ({ ...prev, status: 'running' }));
      workerRef.current.postMessage({ type: 'runTask', taskId });
    }
  }, []);

  const runTasks = useCallback((taskIds: string[]) => {
    if (workerRef.current) {
      setState((prev) => ({ ...prev, status: 'running' }));
      workerRef.current.postMessage({ type: 'runTasks', taskIds });
    }
  }, []);

  const pause = useCallback(() => {
    if (workerRef.current) {
      setState((prev) => ({ ...prev, status: 'paused' }));
      workerRef.current.postMessage({ type: 'pause' });
    }
  }, []);

  const resume = useCallback(() => {
    if (workerRef.current) {
      setState((prev) => ({ ...prev, status: 'running' }));
      workerRef.current.postMessage({ type: 'resume' });
    }
  }, []);

  const abort = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
      setState((prev) => ({
        ...prev,
        status: 'idle',
        runningTaskIds: [],
      }));
    }
  }, []);

  const reset = useCallback((entityIds?: string[]) => {
    if (workerRef.current) {
      workerRef.current.postMessage({ type: 'reset', entityIds });
    }
  }, []);

  const isRunning = state.status === 'initializing' || state.status === 'running';
  const isPaused = state.status === 'paused';

  return {
    state,
    initialize,
    runAll,
    runFiltered,
    runEntity,
    runTask,
    runTasks,
    pause,
    resume,
    abort,
    reset,
    isRunning,
    isPaused,
  };
}

// Re-export types for convenience
export type { EnrichmentTask, EnrichmentConfig, DomainContext, TaskFilter, EnrichmentResult };
