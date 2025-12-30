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
  type: 'shared' | 'dedicated' | 'service';
}

type GlobalSharedPool = typeof globalThis & {
  __illuminatorSharedWorkerPool?: WorkerHandle[];
};

type GlobalServiceWorkerState = typeof globalThis & {
  __illuminatorServiceWorkerPool?: WorkerHandle[];
  __illuminatorServiceWorkerRegistration?: Promise<ServiceWorkerRegistration> | null;
  __illuminatorServiceWorkerActive?: Promise<ServiceWorker> | null;
};

/**
 * Check if SharedWorker is supported
 */
export function isSharedWorkerSupported(): boolean {
  return typeof SharedWorker !== 'undefined';
}

export function isServiceWorkerSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    'serviceWorker' in navigator &&
    typeof window !== 'undefined' &&
    window.isSecureContext
  );
}

function getSharedWorkerPool(): WorkerHandle[] {
  const globalScope = globalThis as GlobalSharedPool;
  if (!globalScope.__illuminatorSharedWorkerPool) {
    globalScope.__illuminatorSharedWorkerPool = [];
  }
  return globalScope.__illuminatorSharedWorkerPool;
}

function getServiceWorkerPool(): WorkerHandle[] {
  const globalScope = globalThis as GlobalServiceWorkerState;
  if (!globalScope.__illuminatorServiceWorkerPool) {
    globalScope.__illuminatorServiceWorkerPool = [];
  }
  return globalScope.__illuminatorServiceWorkerPool;
}

function getServiceWorkerRegistration(): Promise<ServiceWorkerRegistration> {
  const globalScope = globalThis as GlobalServiceWorkerState;
  if (!globalScope.__illuminatorServiceWorkerRegistration) {
    const serviceWorkerUrl = new URL('../sw/enrichment.service-worker.ts', import.meta.url);
    globalScope.__illuminatorServiceWorkerRegistration = navigator.serviceWorker.register(
      serviceWorkerUrl,
      { type: 'module' }
    );
  }
  return globalScope.__illuminatorServiceWorkerRegistration;
}

function waitForActiveServiceWorker(
  registration: ServiceWorkerRegistration
): Promise<ServiceWorker> {
  if (registration.active) {
    return Promise.resolve(registration.active);
  }

  const candidate = registration.installing || registration.waiting;
  if (!candidate) {
    return Promise.reject(new Error('Service worker not available'));
  }

  return new Promise((resolve, reject) => {
    const handleStateChange = () => {
      if (candidate.state === 'activated') {
        candidate.removeEventListener('statechange', handleStateChange);
        resolve(candidate);
      } else if (candidate.state === 'redundant') {
        candidate.removeEventListener('statechange', handleStateChange);
        reject(new Error('Service worker became redundant'));
      }
    };

    candidate.addEventListener('statechange', handleStateChange);
  });
}

function getActiveServiceWorker(): Promise<ServiceWorker> {
  const globalScope = globalThis as GlobalServiceWorkerState;
  if (!globalScope.__illuminatorServiceWorkerActive) {
    globalScope.__illuminatorServiceWorkerActive = getServiceWorkerRegistration().then(
      waitForActiveServiceWorker
    );
  }
  return globalScope.__illuminatorServiceWorkerActive;
}

function createSharedWorkerHandle(): WorkerHandle {
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

  console.log('[WorkerFactory] Created SharedWorker port');
  return handle;
}

function createServiceWorkerHandle(): WorkerHandle {
  const handleId = `illuminator_sw_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const channel = new MessageChannel();
  const port = channel.port1;
  const pending: Array<Record<string, unknown>> = [];
  let isConnected = false;

  const handle: WorkerHandle = {
    type: 'service',
    onmessage: null,
    onerror: null,

    postMessage(message: unknown) {
      const payload = { ...(message as Record<string, unknown>), handleId };
      if (!isConnected) {
        pending.push(payload);
        return;
      }

      getActiveServiceWorker()
        .then((worker) => {
          worker.postMessage(payload);
        })
        .catch((err) => {
          handle.onerror?.(new ErrorEvent('error', { message: String(err) }));
        });
    },

    terminate() {
      port.close();
    },
  };

  port.onmessage = (event: MessageEvent<WorkerOutbound>) => {
    handle.onmessage?.(event);
  };

  port.onmessageerror = () => {
    handle.onerror?.(new ErrorEvent('error', { message: 'Service worker message error' }));
  };

  port.start();

  getActiveServiceWorker()
    .then((worker) => {
      worker.postMessage({ type: 'connect', handleId }, [channel.port2]);
      isConnected = true;
      for (const payload of pending) {
        worker.postMessage(payload);
      }
      pending.length = 0;
    })
    .catch((err) => {
      handle.onerror?.(new ErrorEvent('error', { message: String(err) }));
    });

  console.log('[WorkerFactory] Created ServiceWorker handle');
  return handle;
}

function createDedicatedWorkerHandle(): WorkerHandle {
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

  console.log('[WorkerFactory] Created dedicated Worker (SharedWorker not available)');
  return handle;
}

/**
 * Create a worker handle that abstracts SharedWorker vs regular Worker
 */
export function createWorker(config: WorkerConfig): WorkerHandle {
  if (isServiceWorkerSupported()) {
    const handle = createServiceWorkerHandle();
    handle.postMessage({ type: 'init', config });
    return handle;
  }

  // Try SharedWorker first
  if (isSharedWorkerSupported()) {
    try {
      const handle = createSharedWorkerHandle();
      handle.postMessage({ type: 'init', config });
      return handle;
    } catch (err) {
      console.warn('[WorkerFactory] SharedWorker failed, falling back to dedicated Worker:', err);
    }
  }

  // Fallback to regular Worker
  const handle = createDedicatedWorkerHandle();
  handle.postMessage({ type: 'init', config });
  return handle;
}

/**
 * Create multiple worker handles (for parallel processing)
 *
 * Note: When using SharedWorker, all handles connect to the same worker instance.
 * For dedicated workers, each handle is a separate worker.
 */
export function createWorkerPool(config: WorkerConfig, count: number): WorkerHandle[] {
  if (isServiceWorkerSupported()) {
    const pool = getServiceWorkerPool();
    const handles: WorkerHandle[] = [];

    for (let i = 0; i < count; i++) {
      if (pool[i]) {
        console.log('[WorkerFactory] Reusing ServiceWorker handle');
        handles.push(pool[i]);
      } else {
        const handle = createServiceWorkerHandle();
        pool[i] = handle;
        handles.push(handle);
      }
    }

    for (const handle of handles) {
      handle.postMessage({ type: 'init', config });
    }

    return handles;
  }

  if (isSharedWorkerSupported()) {
    const pool = getSharedWorkerPool();
    const handles: WorkerHandle[] = [];

    for (let i = 0; i < count; i++) {
      if (pool[i]) {
        console.log('[WorkerFactory] Reusing SharedWorker port');
        handles.push(pool[i]);
      } else {
        const handle = createSharedWorkerHandle();
        pool[i] = handle;
        handles.push(handle);
      }
    }

    for (const handle of handles) {
      handle.postMessage({ type: 'init', config });
    }

    return handles;
  }

  const handles: WorkerHandle[] = [];
  for (let i = 0; i < count; i++) {
    const handle = createDedicatedWorkerHandle();
    handle.postMessage({ type: 'init', config });
    handles.push(handle);
  }

  return handles;
}
