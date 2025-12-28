/**
 * Enrichment Worker - Single Task Executor with Direct Persistence
 *
 * This worker executes enrichment tasks AND persists images directly to IndexedDB.
 * By persisting in the worker (before notifying main thread), we minimize data loss
 * when users navigate away mid-operation.
 *
 * Flow:
 * 1. Receive task from main thread
 * 2. Make API call
 * 3. For images: save blob to IndexedDB immediately
 * 4. Notify main thread of completion (with imageId, not blob)
 *
 * Messages:
 * - init: Set up API clients with keys and config
 * - execute: Run a single enrichment task
 * - abort: Cancel current task (if possible)
 */

import type { EnrichmentType, WorkerTask, WorkerResult, EnrichmentResult } from '../lib/enrichmentTypes';
import {
  type WorkerConfig,
  type WorkerInbound,
  type WorkerOutbound,
  createClients,
  executeImageTask,
  executeTextTask,
  executeEntityChronicleTask,
  executePaletteExpansionTask,
} from './enrichmentCore';
import type { LLMClient } from '../lib/llmClient';
import type { ImageClient } from '../lib/imageClient';

// Worker context
const ctx: Worker = self as unknown as Worker;

// ============================================================================
// State
// ============================================================================

let config: WorkerConfig | null = null;
let llmClient: LLMClient | null = null;
let imageClient: ImageClient | null = null;
let currentTaskId: string | null = null;
let isAborted = false;

// ============================================================================
// Helpers
// ============================================================================

function emit(message: WorkerOutbound): void {
  ctx.postMessage(message);
}

// ============================================================================
// Task Execution
// ============================================================================

async function executeTask(task: WorkerTask): Promise<WorkerResult> {
  currentTaskId = task.id;
  isAborted = false;

  emit({ type: 'started', taskId: task.id });

  const checkAborted = () => isAborted;

  try {
    let result;

    if (task.type === 'image') {
      result = await executeImageTask(task, config!, llmClient!, imageClient!, checkAborted);
    } else if (task.type === 'entityChronicle') {
      result = await executeEntityChronicleTask(task, config!, llmClient!, checkAborted);
    } else if (task.type === 'paletteExpansion') {
      result = await executePaletteExpansionTask(task, config!, llmClient!, checkAborted);
    } else {
      result = await executeTextTask(task, config!, llmClient!, checkAborted);
    }

    if (!result.success) {
      return {
        id: task.id,
        entityId: task.entityId,
        type: task.type,
        success: false,
        error: result.error,
        debug: result.debug,
      };
    }

    return {
      id: task.id,
      entityId: task.entityId,
      type: task.type,
      success: true,
      result: result.result,
      debug: result.debug,
    };
  } catch (error) {
    return {
      id: task.id,
      entityId: task.entityId,
      type: task.type,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  } finally {
    currentTaskId = null;
  }
}

// ============================================================================
// Message Handler
// ============================================================================

ctx.onmessage = async (event: MessageEvent<WorkerInbound>) => {
  const message = event.data;

  switch (message.type) {
    case 'init': {
      config = message.config;
      console.log('[Worker] Init - textModel:', config.textModel, 'thinkingModel:', config.thinkingModel, 'useThinkingForDescriptions:', config.useThinkingForDescriptions, 'thinkingBudget:', config.thinkingBudget);
      const clients = createClients(config);
      llmClient = clients.llmClient;
      imageClient = clients.imageClient;
      emit({ type: 'ready' });
      break;
    }

    case 'execute': {
      if (!config) {
        emit({
          type: 'error',
          taskId: message.task.id,
          error: 'Worker not initialized - call init first',
        });
        break;
      }

      const result = await executeTask(message.task);

      if (result.success) {
        emit({ type: 'complete', result });
      } else {
        emit({
          type: 'error',
          taskId: result.id,
          error: result.error || 'Unknown error',
          debug: result.debug,
        });
      }
      break;
    }

    case 'abort': {
      isAborted = true;
      const taskIdToAbort = message.taskId || currentTaskId;
      if (taskIdToAbort) {
        emit({
          type: 'error',
          taskId: taskIdToAbort,
          error: 'Task aborted by user',
        });
      }
      break;
    }
  }
};

// Re-export types for consumers
export type {
  WorkerTask,
  WorkerResult,
  EnrichmentResult,
  EnrichmentType,
  WorkerConfig,
  WorkerInbound,
  WorkerOutbound,
};
