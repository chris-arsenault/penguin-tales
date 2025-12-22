/**
 * Worker Factory
 *
 * Creates enrichment workers with SharedWorker preference and regular Worker fallback.
 *
 * SharedWorker benefits:
 * - Persists across page navigations (same origin)
 * - Shared across tabs - work continues even if one tab closes
 * - Single instance reduces memory usage
 *
 * Fallback to regular Worker for:
 * - Browsers without SharedWorker support (older Safari)
 * - When SharedWorker instantiation fails
 */

import type { WorkerConfig, WorkerOutbound } from '../workers/enrichment.worker';

export interface WorkerHandle {
  postMessage: (message: unknown) => void;
  onmessage: ((event: MessageEvent<WorkerOutbound>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  terminate: () => void;
  type: 'shared' | 'dedicated';
}

/**
 * Check if SharedWorker is supported
 */
export function isSharedWorkerSupported(): boolean {
  return typeof SharedWorker !== 'undefined';
}

/**
 * Create a worker handle that abstracts SharedWorker vs regular Worker
 */
export function createWorker(config: WorkerConfig): WorkerHandle {
  // Try SharedWorker first
  if (isSharedWorkerSupported()) {
    try {
      const sharedWorker = new SharedWorker(
        new URL('../workers/enrichment.shared-worker.ts', import.meta.url),
        { type: 'module', name: 'illuminator-enrichment' }
      );

      const handle: WorkerHandle = {
        type: 'shared',
        onmessage: null,
        onerror: null,

        postMessage(message: unknown) {
          sharedWorker.port.postMessage(message);
        },

        terminate() {
          // SharedWorkers can't be terminated from client - they close when all ports disconnect
          sharedWorker.port.close();
        },
      };

      // Wire up event handlers through port
      sharedWorker.port.onmessage = (event: MessageEvent<WorkerOutbound>) => {
        handle.onmessage?.(event);
      };

      sharedWorker.onerror = (event: ErrorEvent) => {
        handle.onerror?.(event);
      };

      sharedWorker.port.start();

      // Send init config
      handle.postMessage({ type: 'init', config });

      console.log('[WorkerFactory] Created SharedWorker');
      return handle;
    } catch (err) {
      console.warn('[WorkerFactory] SharedWorker failed, falling back to dedicated Worker:', err);
    }
  }

  // Fallback to regular Worker
  const worker = new Worker(
    new URL('../workers/enrichment.worker.ts', import.meta.url),
    { type: 'module' }
  );

  const handle: WorkerHandle = {
    type: 'dedicated',
    onmessage: null,
    onerror: null,

    postMessage(message: unknown) {
      worker.postMessage(message);
    },

    terminate() {
      worker.terminate();
    },
  };

  worker.onmessage = (event: MessageEvent<WorkerOutbound>) => {
    handle.onmessage?.(event);
  };

  worker.onerror = (event: ErrorEvent) => {
    handle.onerror?.(event);
  };

  // Send init config
  handle.postMessage({ type: 'init', config });

  console.log('[WorkerFactory] Created dedicated Worker (SharedWorker not available)');
  return handle;
}

/**
 * Create multiple worker handles (for parallel processing)
 *
 * Note: When using SharedWorker, all handles connect to the same worker instance.
 * For dedicated workers, each handle is a separate worker.
 */
export function createWorkerPool(config: WorkerConfig, count: number): WorkerHandle[] {
  const handles: WorkerHandle[] = [];

  for (let i = 0; i < count; i++) {
    handles.push(createWorker(config));
  }

  return handles;
}
