/**
 * Enrichment Service Worker
 *
 * Executes enrichment tasks outside the page lifecycle so work continues
 * across full reloads/HMR and results persist to IndexedDB.
 */

import type { EnrichmentType, WorkerTask, WorkerResult, EnrichmentResult } from '../lib/enrichmentTypes';
import {
  type WorkerConfig,
  type WorkerInbound,
  type WorkerOutbound,
  createClients,
  executeTask as executeEnrichmentTask,
} from '../workers/enrichmentCore';
import type { LLMClient } from '../lib/llmClient';
import type { ImageClient } from '../lib/imageClient';
import { saveEnrichmentResult } from '../lib/enrichmentStorage';

const ctx = self as unknown as ServiceWorkerGlobalScope;

type ServiceWorkerMessage =
  | ({ type: 'connect'; handleId: string })
  | ({ handleId: string } & WorkerInbound);

// ============================================================================
// State
// ============================================================================

let config: WorkerConfig | null = null;
let llmClient: LLMClient | null = null;
let imageClient: ImageClient | null = null;

const handlePorts = new Map<string, MessagePort>();
const pendingReady = new Set<string>();
const activeTasks = new Map<string, { handleId: string; aborted: boolean }>();

// ============================================================================
// Lifecycle
// ============================================================================

ctx.addEventListener('install', (event) => {
  event.waitUntil(ctx.skipWaiting());
});

ctx.addEventListener('activate', (event) => {
  event.waitUntil(ctx.clients.claim());
});

// ============================================================================
// Helpers
// ============================================================================

function safePostMessage(handleId: string, message: WorkerOutbound): void {
  const port = handlePorts.get(handleId);
  if (!port) return;

  try {
    port.postMessage(message);
  } catch {
    handlePorts.delete(handleId);
  }
}

async function persistResult(task: WorkerTask, result?: EnrichmentResult): Promise<void> {
  if (!result) return;
  if (!task.projectId || !task.simulationRunId) return;

  try {
    await saveEnrichmentResult({
      projectId: task.projectId,
      simulationRunId: task.simulationRunId,
      entityId: task.entityId,
      entityName: task.entityName,
      entityKind: task.entityKind,
      type: task.type,
      result,
      imageType: task.imageType,
      chronicleId: task.chronicleId,
      imageRefId: task.imageRefId,
    });
  } catch (err) {
    console.warn('[ServiceWorker] Failed to persist enrichment result:', err);
  }
}

// ============================================================================
// Task Execution
// ============================================================================

async function executeTask(task: WorkerTask, handleId: string): Promise<void> {
  const taskState = activeTasks.get(task.id);
  const checkAborted = () => taskState?.aborted ?? false;

  safePostMessage(handleId, { type: 'started', taskId: task.id });

  try {
    let result;

    result = await executeEnrichmentTask(task, {
      config: config!,
      llmClient: llmClient!,
      imageClient: imageClient!,
      isAborted: checkAborted,
    });

    if (!result.success) {
      safePostMessage(handleId, {
        type: 'error',
        taskId: task.id,
        error: result.error || 'Unknown error',
        debug: result.debug,
      });
      return;
    }

    await persistResult(task, result.result);

    safePostMessage(handleId, {
      type: 'complete',
      result: {
        id: task.id,
        entityId: task.entityId,
        type: task.type,
        success: true,
        result: result.result,
        debug: result.debug,
      },
    });
  } catch (error) {
    safePostMessage(handleId, {
      type: 'error',
      taskId: task.id,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  } finally {
    activeTasks.delete(task.id);
  }
}

// ============================================================================
// Message Handling
// ============================================================================

function handleInit(handleId: string, nextConfig: WorkerConfig): void {
  config = nextConfig;
  console.log('[ServiceWorker] Init - LLM call settings:', config.llmCallSettings);
  const clients = createClients(config);
  llmClient = clients.llmClient;
  imageClient = clients.imageClient;

  if (handlePorts.has(handleId)) {
    safePostMessage(handleId, { type: 'ready' });
  } else {
    pendingReady.add(handleId);
  }
}

function handleAbort(handleId: string, taskId?: string): void {
  if (!taskId) return;
  const taskState = activeTasks.get(taskId);
  if (taskState) {
    taskState.aborted = true;
    safePostMessage(handleId, {
      type: 'error',
      taskId,
      error: 'Task aborted by user',
    });
  }
}

ctx.addEventListener('message', (event) => {
  const message = event.data as ServiceWorkerMessage | undefined;
  if (!message || typeof message !== 'object' || !('type' in message)) return;

  if (message.type === 'connect') {
    const handleId = message.handleId;
    const port = event.ports[0];
    if (handleId && port) {
      handlePorts.set(handleId, port);
      port.start();
      if (pendingReady.has(handleId)) {
        pendingReady.delete(handleId);
        safePostMessage(handleId, { type: 'ready' });
      }
    }
    return;
  }

  if (!('handleId' in message) || !message.handleId) return;
  const handleId = message.handleId;

  switch (message.type) {
    case 'init':
      event.waitUntil(Promise.resolve(handleInit(handleId, message.config)));
      break;

    case 'execute':
      if (!config) {
        safePostMessage(handleId, {
          type: 'error',
          taskId: message.task.id,
          error: 'Worker not initialized - call init first',
        });
        return;
      }
      activeTasks.set(message.task.id, { handleId, aborted: false });
      event.waitUntil(executeTask(message.task, handleId));
      break;

    case 'abort':
      event.waitUntil(Promise.resolve(handleAbort(handleId, message.taskId)));
      break;
  }
});

export type { WorkerTask, WorkerResult, EnrichmentResult, EnrichmentType };
