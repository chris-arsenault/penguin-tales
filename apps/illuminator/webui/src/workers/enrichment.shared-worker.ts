/**
 * Enrichment SharedWorker
 *
 * SharedWorker version that persists across page navigations within the same origin.
 * Falls back to regular Worker if SharedWorker is not supported.
 *
 * SharedWorkers use a port-based communication model:
 * - Each tab/window that connects gets its own MessagePort
 * - The worker maintains state across all connections
 * - Work in progress survives page navigations (within same origin)
 */

import type { EnrichmentType, WorkerTask, WorkerResult, EnrichmentResult } from '../lib/enrichmentTypes';
import {
  type WorkerConfig,
  type WorkerInbound,
  type WorkerOutbound,
  createClients,
  executeImageTask,
  executeTextTask,
  executeEntityStoryTask,
} from './enrichmentCore';
import type { LLMClient } from '../lib/llmClient';
import type { ImageClient } from '../lib/imageClient';

// SharedWorker context
const ctx = self as unknown as SharedWorkerGlobalScope;

// ============================================================================
// State
// ============================================================================

let config: WorkerConfig | null = null;
let llmClient: LLMClient | null = null;
let imageClient: ImageClient | null = null;

// Track active tasks and their originating ports
const activeTasks = new Map<string, { port: MessagePort; aborted: boolean }>();

// Track all connected ports
const connectedPorts = new Set<MessagePort>();

// ============================================================================
// Task Execution
// ============================================================================

async function executeTask(task: WorkerTask, port: MessagePort): Promise<void> {
  const taskState = activeTasks.get(task.id);
  const checkAborted = () => taskState?.aborted ?? false;

  port.postMessage({ type: 'started', taskId: task.id });

  try {
    let result;

    if (task.type === 'image') {
      result = await executeImageTask(task, config!, llmClient!, imageClient!, checkAborted);
    } else if (task.type === 'entityStory') {
      result = await executeEntityStoryTask(task, config!, llmClient!, checkAborted);
    } else {
      result = await executeTextTask(task, config!, llmClient!, checkAborted);
    }

    if (!result.success) {
      port.postMessage({
        type: 'error',
        taskId: task.id,
        error: result.error || 'Unknown error',
        debug: result.debug,
      });
      return;
    }

    port.postMessage({
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
    port.postMessage({
      type: 'error',
      taskId: task.id,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  } finally {
    activeTasks.delete(task.id);
  }
}

// ============================================================================
// Connection Handler
// ============================================================================

ctx.onconnect = (event: MessageEvent) => {
  const port = event.ports[0];
  connectedPorts.add(port);

  port.onmessage = async (e: MessageEvent<WorkerInbound>) => {
    const message = e.data;

    switch (message.type) {
      case 'init': {
        config = message.config;
        console.log('[SharedWorker] Init with chronicleModel:', config.chronicleModel || '(not set)', 'textModel:', config.textModel || '(not set)');
        const clients = createClients(config);
        llmClient = clients.llmClient;
        imageClient = clients.imageClient;
        port.postMessage({ type: 'ready' });
        break;
      }

      case 'execute': {
        if (!config) {
          port.postMessage({
            type: 'error',
            taskId: message.task.id,
            error: 'Worker not initialized - call init first',
          });
          break;
        }

        activeTasks.set(message.task.id, { port, aborted: false });
        executeTask(message.task, port);
        break;
      }

      case 'abort': {
        if (message.taskId) {
          const taskState = activeTasks.get(message.taskId);
          if (taskState) {
            taskState.aborted = true;
            port.postMessage({
              type: 'error',
              taskId: message.taskId,
              error: 'Task aborted by user',
            });
          }
        }
        break;
      }
    }
  };

  port.onmessageerror = () => {
    connectedPorts.delete(port);
  };

  port.start();
};

export type { WorkerTask, WorkerResult, EnrichmentResult, EnrichmentType };
