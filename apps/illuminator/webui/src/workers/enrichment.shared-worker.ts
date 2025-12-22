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

import { LLMClient } from '../lib/llmClient';
import { ImageClient } from '../lib/imageClient';
import type { EnrichmentType, WorkerTask, WorkerResult, EnrichmentResult } from '../lib/enrichmentTypes';
import {
  estimateTextCost,
  estimateImageCost,
  calculateActualTextCost,
  calculateActualImageCost,
} from '../lib/costEstimation';
import {
  saveImage,
  deleteImage,
  generateImageId,
} from '../lib/workerStorage';

// SharedWorker context
const ctx = self as unknown as SharedWorkerGlobalScope;

// ============================================================================
// Types
// ============================================================================

export interface WorkerConfig {
  anthropicApiKey: string;
  openaiApiKey: string;
  textModel: string;
  imageModel: string;
  imageSize: string;
  imageQuality: string;
  numWorkers?: number;
  useClaudeForImagePrompt?: boolean;
  claudeImagePromptTemplate?: string;
}

export type WorkerInbound =
  | { type: 'init'; config: WorkerConfig }
  | { type: 'execute'; task: WorkerTask }
  | { type: 'abort'; taskId?: string };

export type WorkerOutbound =
  | { type: 'ready' }
  | { type: 'started'; taskId: string }
  | { type: 'complete'; result: WorkerResult }
  | { type: 'error'; taskId: string; error: string };

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
// Helpers
// ============================================================================

function buildSystemPrompt(): string {
  return `You are a creative writer helping to build rich, consistent world lore.

Write descriptions that capture the ESSENCE of the entity - their personality, appearance, mannerisms, or defining traits. The description should stand on its own and make the entity feel real and distinctive.

IMPORTANT: Do NOT write a tour of the entity's relationships. The description should be ABOUT the entity, not a catalog of places they've been or people they know. You may reference ONE relationship that truly defines or shaped them, but only if it reveals something essential about who they are - not as a list item.

Bad example (relationship catalog): "She oversees the treasury of Place X, discovered the caverns of Place Y, and manages trade at Place Z."
Good example (entity-focused): "Her obsidian beak angles perpetually downward, as if still searching for miscounted coins. Every word she speaks has the weight of a merchant's scale."

Be concise but vivid. Avoid generic fantasy tropes unless they fit the world's tone.`;
}

async function formatImagePromptWithClaude(originalPrompt: string): Promise<string> {
  if (!config?.useClaudeForImagePrompt || !config?.claudeImagePromptTemplate) {
    return originalPrompt;
  }

  if (!llmClient?.isEnabled()) {
    console.warn('[SharedWorker] Claude not configured, skipping image prompt formatting');
    return originalPrompt;
  }

  const imageModel = config.imageModel || 'dall-e-3';
  const formattingPrompt = config.claudeImagePromptTemplate
    .replace(/\{\{modelName\}\}/g, imageModel)
    .replace(/\{\{prompt\}\}/g, originalPrompt);

  try {
    const result = await llmClient.complete({
      systemPrompt: 'You are a prompt engineer specializing in image generation. Respond only with the reformatted prompt, no explanations or preamble.',
      prompt: formattingPrompt,
      maxTokens: 1024,
      temperature: 0.3,
    });

    if (result.text && !result.error) {
      console.log('[SharedWorker] Formatted image prompt with Claude');
      return result.text.trim();
    }
  } catch (err) {
    console.warn('[SharedWorker] Failed to format image prompt with Claude:', err);
  }

  return originalPrompt;
}

// ============================================================================
// Task Execution
// ============================================================================

async function executeTask(task: WorkerTask, port: MessagePort): Promise<void> {
  const taskState = activeTasks.get(task.id);

  port.postMessage({ type: 'started', taskId: task.id });

  try {
    if (task.type === 'image') {
      if (!imageClient?.isEnabled()) {
        throw new Error('Image generation not configured - missing OpenAI API key');
      }

      const imageModel = config?.imageModel || 'dall-e-3';
      const imageSize = config?.imageSize || '1024x1024';
      const imageQuality = config?.imageQuality || 'standard';
      const estimatedCost = estimateImageCost(imageModel, imageSize, imageQuality);

      const finalPrompt = await formatImagePromptWithClaude(task.prompt);

      if (taskState?.aborted) throw new Error('Task aborted');

      const result = await imageClient.generate({ prompt: finalPrompt });

      if (taskState?.aborted) throw new Error('Task aborted');
      if (result.error) throw new Error(result.error);
      if (!result.imageBlob) throw new Error('No image data returned from API');

      const actualCost = calculateActualImageCost(imageModel, imageSize, imageQuality, result.usage);
      const generatedAt = Date.now();
      const imageId = generateImageId(task.entityId);

      // Save directly to IndexedDB
      await saveImage(imageId, result.imageBlob, {
        entityId: task.entityId,
        projectId: task.projectId,
        entityName: task.entityName,
        entityKind: task.entityKind,
        generatedAt,
        model: imageModel,
        revisedPrompt: result.revisedPrompt,
        estimatedCost,
        actualCost,
        inputTokens: result.usage?.inputTokens,
        outputTokens: result.usage?.outputTokens,
      });

      if (task.previousImageId) {
        try {
          await deleteImage(task.previousImageId);
        } catch (err) {
          console.warn('[SharedWorker] Failed to delete old image:', err);
        }
      }

      const enrichmentResult: EnrichmentResult = {
        imageId,
        revisedPrompt: result.revisedPrompt,
        generatedAt,
        model: imageModel,
        estimatedCost,
        actualCost,
        inputTokens: result.usage?.inputTokens,
        outputTokens: result.usage?.outputTokens,
      };

      port.postMessage({
        type: 'complete',
        result: {
          id: task.id,
          entityId: task.entityId,
          type: task.type,
          success: true,
          result: enrichmentResult,
        },
      });
    } else {
      // Text generation
      if (!llmClient?.isEnabled()) {
        throw new Error('Text generation not configured - missing Anthropic API key');
      }

      const textModel = config?.textModel || 'claude-sonnet-4-20250514';
      const taskType = task.type === 'eraNarrative' ? 'eraNarrative' :
                       task.type === 'relationship' ? 'relationship' : 'description';
      const estimate = estimateTextCost(task.prompt, taskType, textModel);

      const result = await llmClient.complete({
        systemPrompt: buildSystemPrompt(),
        prompt: task.prompt,
        maxTokens: 512,
        temperature: 0.7,
      });

      if (taskState?.aborted) throw new Error('Task aborted');
      if (result.error) throw new Error(result.error);

      let actualCost = estimate.estimatedCost;
      let inputTokens = estimate.inputTokens;
      let outputTokens = estimate.outputTokens;

      if (result.usage) {
        inputTokens = result.usage.inputTokens;
        outputTokens = result.usage.outputTokens;
        actualCost = calculateActualTextCost(inputTokens, outputTokens, textModel);
      }

      const enrichmentResult: EnrichmentResult = {
        text: result.text,
        generatedAt: Date.now(),
        model: textModel,
        estimatedCost: estimate.estimatedCost,
        actualCost,
        inputTokens,
        outputTokens,
      };

      port.postMessage({
        type: 'complete',
        result: {
          id: task.id,
          entityId: task.entityId,
          type: task.type,
          success: true,
          result: enrichmentResult,
        },
      });
    }
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

        llmClient = new LLMClient({
          enabled: Boolean(config.anthropicApiKey),
          apiKey: config.anthropicApiKey,
          model: config.textModel || 'claude-sonnet-4-20250514',
        });

        imageClient = new ImageClient({
          enabled: Boolean(config.openaiApiKey),
          apiKey: config.openaiApiKey,
          model: config.imageModel || 'dall-e-3',
          size: config.imageSize || '1024x1024',
          quality: config.imageQuality || 'standard',
        });

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
