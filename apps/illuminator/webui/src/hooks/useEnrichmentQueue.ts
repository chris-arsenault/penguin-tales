/**
 * useEnrichmentQueue - UI-side queue management with multiple workers
 *
 * This hook manages the enrichment queue in the UI thread.
 * Workers are pure executors - this hook handles:
 * - Queue state (pending, running, completed, errored items)
 * - Distributing tasks to workers based on estimated workload
 * - Receiving results and updating entity state
 * - Progress tracking
 *
 * Task distribution uses "soonest available" estimation:
 * workload = num_text_tasks + (10 * num_image_tasks)
 * Images take ~10x longer than text, so they count more.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import type {
  QueueItem,
  EnrichmentType,
  WorkerTask,
  WorkerResult,
  EntityEnrichment,
  EnrichmentResult,
  SerializableStoryContext,
  ChronicleStep,
} from '../lib/enrichmentTypes';
import { applyEnrichmentResult } from '../lib/enrichmentTypes';
import type { WorkerConfig, WorkerOutbound } from '../workers/enrichment.worker';
import { createWorker, type WorkerHandle } from '../lib/workerFactory';

export interface EnrichedEntity {
  id: string;
  name: string;
  kind: string;
  subtype: string;
  prominence: string;
  culture: string;
  status: string;
  description: string;
  tags: Record<string, unknown>;
  createdAt?: number;
  enrichment?: EntityEnrichment;
}

export interface QueueStats {
  queued: number;
  running: number;
  completed: number;
  errored: number;
  total: number;
}

export interface UseEnrichmentQueueReturn {
  // State
  queue: QueueItem[];
  isWorkerReady: boolean;
  stats: QueueStats;

  // Actions
  initialize: (config: WorkerConfig) => void;
  enqueue: (items: Array<{ entity: EnrichedEntity; type: EnrichmentType; prompt: string }>) => void;
  cancel: (itemId: string) => void;
  cancelAll: () => void;
  retry: (itemId: string) => void;
  clearCompleted: () => void;

  // Entity updates (call this when result comes back)
  getUpdatedEntity: (entity: EnrichedEntity) => EnrichedEntity;
}

// Cost weights for workload estimation
const TEXT_TASK_WEIGHT = 1;
const IMAGE_TASK_WEIGHT = 10;

interface WorkerState {
  worker: WorkerHandle;
  workerId: number;
  isReady: boolean;
  currentTaskId: string | null;
  // Track pending tasks assigned to this worker
  pendingTaskIds: Set<string>;
}

/**
 * Calculate estimated workload for a worker based on its assigned tasks
 */
function calculateWorkload(
  workerState: WorkerState,
  queue: QueueItem[]
): number {
  let workload = 0;

  // Add weight for current running task
  if (workerState.currentTaskId) {
    const currentTask = queue.find((q) => q.id === workerState.currentTaskId);
    if (currentTask) {
      workload += currentTask.type === 'image' ? IMAGE_TASK_WEIGHT : TEXT_TASK_WEIGHT;
    }
  }

  // Add weight for pending tasks assigned to this worker
  for (const taskId of workerState.pendingTaskIds) {
    const task = queue.find((q) => q.id === taskId);
    if (task && task.status === 'queued') {
      workload += task.type === 'image' ? IMAGE_TASK_WEIGHT : TEXT_TASK_WEIGHT;
    }
  }

  return workload;
}

/**
 * Find the worker with lowest estimated workload
 */
function findLeastBusyWorker(workers: WorkerState[], queue: QueueItem[]): WorkerState | null {
  const readyWorkers = workers.filter((w) => w.isReady);
  if (readyWorkers.length === 0) return null;

  let leastBusy = readyWorkers[0];
  let lowestWorkload = calculateWorkload(leastBusy, queue);

  for (let i = 1; i < readyWorkers.length; i++) {
    const workload = calculateWorkload(readyWorkers[i], queue);
    if (workload < lowestWorkload) {
      lowestWorkload = workload;
      leastBusy = readyWorkers[i];
    }
  }

  return leastBusy;
}

export function useEnrichmentQueue(
  onEntityUpdate: (entityId: string, enrichment: EntityEnrichment) => void,
  projectId?: string,
  simulationRunId?: string
): UseEnrichmentQueueReturn {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [isWorkerReady, setIsWorkerReady] = useState(false);
  const workersRef = useRef<WorkerState[]>([]);
  const configRef = useRef<WorkerConfig | null>(null);
  const numWorkersRef = useRef<number>(4);
  const projectIdRef = useRef<string | undefined>(projectId);
  const simulationRunIdRef = useRef<string | undefined>(simulationRunId);

  // Keep projectId ref in sync
  useEffect(() => {
    projectIdRef.current = projectId;
  }, [projectId]);

  // Keep simulationRunId ref in sync
  useEffect(() => {
    simulationRunIdRef.current = simulationRunId;
  }, [simulationRunId]);

  // Track which tasks are assigned to which worker
  const taskWorkerMapRef = useRef<Map<string, number>>(new Map());

  // Refs for accessing latest values in callbacks (avoid stale closures)
  const queueRef = useRef<QueueItem[]>([]);
  const onEntityUpdateRef = useRef(onEntityUpdate);

  // Keep refs in sync
  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);

  useEffect(() => {
    onEntityUpdateRef.current = onEntityUpdate;
  }, [onEntityUpdate]);

  // Calculate stats
  const stats: QueueStats = {
    queued: queue.filter((item) => item.status === 'queued').length,
    running: queue.filter((item) => item.status === 'running').length,
    completed: queue.filter((item) => item.status === 'complete').length,
    errored: queue.filter((item) => item.status === 'error').length,
    total: queue.length,
  };

  // Process next item for a specific worker (uses refs to avoid stale closures)
  const processNextForWorker = useCallback(
    (workerId: number) => {
      const workerState = workersRef.current.find((w) => w.workerId === workerId);
      if (!workerState || !workerState.isReady || workerState.currentTaskId) return;

      // Use ref to get latest queue
      const currentQueue = queueRef.current;

      // Find next queued task assigned to this worker
      const nextItem = currentQueue.find(
        (item) =>
          item.status === 'queued' && taskWorkerMapRef.current.get(item.id) === workerId
      );

      if (!nextItem) return;

      workerState.currentTaskId = nextItem.id;
      workerState.pendingTaskIds.delete(nextItem.id);

      // Update status to running
      setQueue((prev) =>
        prev.map((item) =>
          item.id === nextItem.id
            ? { ...item, status: 'running' as const, startedAt: Date.now() }
            : item
        )
      );

      // Send to worker with all metadata needed for IndexedDB storage
      const task: WorkerTask = {
        id: nextItem.id,
        entityId: nextItem.entityId,
        entityName: nextItem.entityName,
        entityKind: nextItem.entityKind,
        entityCulture: nextItem.entityCulture,
        projectId: projectIdRef.current || 'unknown',
        simulationRunId: simulationRunIdRef.current || 'unknown',
        type: nextItem.type,
        prompt: nextItem.prompt,
        storyContext: nextItem.storyContext,
        chronicleStep: nextItem.chronicleStep,
        storyId: nextItem.storyId,
      };

      workerState.worker.postMessage({ type: 'execute', task });
    },
    [] // No dependencies - uses refs
  );

  // Handle worker messages (uses refs to avoid stale closures)
  const handleMessage = useCallback(
    (workerId: number) => (event: MessageEvent<WorkerOutbound>) => {
      const message = event.data;
      const workerState = workersRef.current.find((w) => w.workerId === workerId);

      switch (message.type) {
        case 'ready':
          if (workerState) {
            workerState.isReady = true;
          }
          // Check if all workers are ready
          if (workersRef.current.every((w) => w.isReady)) {
            setIsWorkerReady(true);
          }
          break;

        case 'started':
          // Already updated status when we sent the task
          break;

        case 'complete': {
          const result = message.result;

          if (workerState) {
            workerState.currentTaskId = null;
          }

          // Clean up task-worker mapping
          taskWorkerMapRef.current.delete(result.id);

          // Worker already saved image to IndexedDB, just update queue and notify parent
          setQueue((prev) =>
            prev.map((item) =>
              item.id === result.id
                ? {
                    ...item,
                    status: 'complete' as const,
                    completedAt: Date.now(),
                    result: result.result,
                  }
                : item
            )
          );

          // Notify parent to update entity
          if (result.result) {
            const enrichment = applyEnrichmentResult({}, result.type, result.result);
            onEntityUpdateRef.current(result.entityId, enrichment);
          }

          // Process next task for this worker
          setTimeout(() => processNextForWorker(workerId), 0);
          break;
        }

        case 'error': {
          if (workerState) {
            workerState.currentTaskId = null;
          }

          // Clean up task-worker mapping
          taskWorkerMapRef.current.delete(message.taskId);

          setQueue((prev) =>
            prev.map((item) =>
              item.id === message.taskId
                ? {
                    ...item,
                    status: 'error' as const,
                    completedAt: Date.now(),
                    error: message.error,
                  }
                : item
            )
          );

          // Process next task for this worker
          setTimeout(() => processNextForWorker(workerId), 0);
          break;
        }
      }
    },
    [processNextForWorker] // Only depends on processNextForWorker (which has no deps)
  );

  // Process queue when it changes - try to start work on idle workers
  useEffect(() => {
    if (!isWorkerReady) return;

    // For each idle worker, try to process next task
    for (const workerState of workersRef.current) {
      if (workerState.isReady && !workerState.currentTaskId) {
        processNextForWorker(workerState.workerId);
      }
    }
  }, [queue, isWorkerReady, processNextForWorker]);

  // Cleanup workers on unmount
  useEffect(() => {
    return () => {
      for (const workerState of workersRef.current) {
        workerState.worker.terminate();
      }
      workersRef.current = [];
    };
  }, []);

  // Initialize workers (SharedWorker with fallback to dedicated Worker)
  const initialize = useCallback(
    (config: WorkerConfig) => {
      // Terminate existing workers
      for (const workerState of workersRef.current) {
        workerState.worker.terminate();
      }
      workersRef.current = [];
      taskWorkerMapRef.current.clear();

      configRef.current = config;
      numWorkersRef.current = config.numWorkers || 4;
      setIsWorkerReady(false);

      // Create new workers using factory (SharedWorker with fallback)
      for (let i = 0; i < numWorkersRef.current; i++) {
        const worker = createWorker(config);

        const workerState: WorkerState = {
          worker,
          workerId: i,
          isReady: false,
          currentTaskId: null,
          pendingTaskIds: new Set(),
        };

        worker.onmessage = handleMessage(i);

        worker.onerror = (error) => {
          console.error(`Worker ${i} error:`, error);
          workerState.currentTaskId = null;
        };

        workersRef.current.push(workerState);
        // Note: createWorker already sends init message
      }
    },
    [handleMessage]
  );

  // Enqueue items - distribute to workers based on estimated workload
  const enqueue = useCallback(
    (items: Array<{ entity: EnrichedEntity; type: EnrichmentType; prompt: string; storyContext?: SerializableStoryContext; chronicleStep?: ChronicleStep; storyId?: string }>) => {
      const newItems: QueueItem[] = [];
      const currentQueue = queueRef.current;

      for (const item of items) {
        const queueItem: QueueItem = {
          id: `${item.type}_${item.entity.id}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          entityId: item.entity.id,
          entityName: item.entity.name,
          entityKind: item.entity.kind,
          entityCulture: item.entity.culture,
          type: item.type,
          prompt: item.prompt,
          status: 'queued' as const,
          queuedAt: Date.now(),
          storyContext: item.storyContext,
          chronicleStep: item.chronicleStep,
          storyId: item.storyId,
        };

        // Find the least busy worker and assign this task
        const leastBusyWorker = findLeastBusyWorker(workersRef.current, [...currentQueue, ...newItems]);
        if (leastBusyWorker) {
          taskWorkerMapRef.current.set(queueItem.id, leastBusyWorker.workerId);
          leastBusyWorker.pendingTaskIds.add(queueItem.id);
        } else {
          // No ready workers - assign to worker 0 by default
          taskWorkerMapRef.current.set(queueItem.id, 0);
          if (workersRef.current[0]) {
            workersRef.current[0].pendingTaskIds.add(queueItem.id);
          }
        }

        newItems.push(queueItem);
      }

      setQueue((prev) => [...prev, ...newItems]);
    },
    [] // No dependencies - uses refs
  );

  // Cancel a specific item
  const cancel = useCallback((itemId: string) => {
    setQueue((prev) => {
      const item = prev.find((i) => i.id === itemId);
      if (!item) return prev;

      const workerId = taskWorkerMapRef.current.get(itemId);

      // If running, abort the worker (include taskId for SharedWorker)
      if (item.status === 'running' && workerId !== undefined) {
        const workerState = workersRef.current.find((w) => w.workerId === workerId);
        if (workerState) {
          workerState.worker.postMessage({ type: 'abort', taskId: itemId });
          workerState.currentTaskId = null;
        }
      }

      // Clean up tracking
      taskWorkerMapRef.current.delete(itemId);
      for (const ws of workersRef.current) {
        ws.pendingTaskIds.delete(itemId);
      }

      // Remove from queue
      return prev.filter((i) => i.id !== itemId);
    });
  }, []);

  // Cancel all
  const cancelAll = useCallback(() => {
    // Get all running task IDs to abort
    const runningTasks = queueRef.current.filter((item) => item.status === 'running');

    for (const workerState of workersRef.current) {
      // Abort each running task on this worker
      if (workerState.currentTaskId) {
        workerState.worker.postMessage({ type: 'abort', taskId: workerState.currentTaskId });
      }
      workerState.currentTaskId = null;
      workerState.pendingTaskIds.clear();
    }
    taskWorkerMapRef.current.clear();
    setQueue([]);
  }, []);

  // Retry errored item
  const retry = useCallback((itemId: string) => {
    setQueue((prev) => {
      const item = prev.find((i) => i.id === itemId);
      if (!item || item.status !== 'error') return prev;

      // Reassign to least busy worker (use prev instead of ref since we're inside setQueue)
      const leastBusyWorker = findLeastBusyWorker(workersRef.current, prev);
      if (leastBusyWorker) {
        taskWorkerMapRef.current.set(itemId, leastBusyWorker.workerId);
        leastBusyWorker.pendingTaskIds.add(itemId);
      }

      return prev.map((i) =>
        i.id === itemId
          ? { ...i, status: 'queued' as const, error: undefined, queuedAt: Date.now() }
          : i
      );
    });
  }, []);

  // Clear completed items
  const clearCompleted = useCallback(() => {
    setQueue((prev) => {
      const completedIds = prev.filter((item) => item.status === 'complete').map((i) => i.id);
      for (const id of completedIds) {
        taskWorkerMapRef.current.delete(id);
      }
      return prev.filter((item) => item.status !== 'complete');
    });
  }, []);

  // Get updated entity with enrichment from queue results
  const getUpdatedEntity = useCallback(
    (entity: EnrichedEntity): EnrichedEntity => {
      const completedItems = queue.filter(
        (item) => item.entityId === entity.id && item.status === 'complete' && item.result
      );

      if (completedItems.length === 0) return entity;

      let enrichment = entity.enrichment || {};
      for (const item of completedItems) {
        if (item.result) {
          enrichment = applyEnrichmentResult({ enrichment }, item.type, item.result);
        }
      }

      return { ...entity, enrichment };
    },
    [queue]
  );

  return {
    queue,
    isWorkerReady,
    stats,
    initialize,
    enqueue,
    cancel,
    cancelAll,
    retry,
    clearCompleted,
    getUpdatedEntity,
  };
}
