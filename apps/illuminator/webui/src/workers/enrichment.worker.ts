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
  generateImageId,
} from '../lib/workerStorage';

// Worker context
const ctx: Worker = self as unknown as Worker;

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
  // Multishot prompting options
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
let currentTaskId: string | null = null;
let isAborted = false;

// ============================================================================
// Helpers
// ============================================================================

function emit(message: WorkerOutbound): void {
  ctx.postMessage(message);
}

function buildSystemPrompt(): string {
  return `You are a creative writer helping to build rich, consistent world lore.

Write descriptions that capture the ESSENCE of the entity - their personality, appearance, mannerisms, or defining traits. The description should stand on its own and make the entity feel real and distinctive.

IMPORTANT: Do NOT write a tour of the entity's relationships. The description should be ABOUT the entity, not a catalog of places they've been or people they know. You may reference ONE relationship that truly defines or shaped them, but only if it reveals something essential about who they are - not as a list item.

Bad example (relationship catalog): "She oversees the treasury of Place X, discovered the caverns of Place Y, and manages trade at Place Z."
Good example (entity-focused): "Her obsidian beak angles perpetually downward, as if still searching for miscounted coins. Every word she speaks has the weight of a merchant's scale."

Be concise but vivid. Avoid generic fantasy tropes unless they fit the world's tone.`;
}

/**
 * Format an image prompt using Claude (multishot prompting)
 */
async function formatImagePromptWithClaude(originalPrompt: string): Promise<string> {
  if (!config?.useClaudeForImagePrompt || !config?.claudeImagePromptTemplate) {
    return originalPrompt;
  }

  if (!llmClient?.isEnabled()) {
    console.warn('[Worker] Claude not configured, skipping image prompt formatting');
    return originalPrompt;
  }

  const imageModel = config.imageModel || 'dall-e-3';

  // Replace template variables
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
      console.log('[Worker] Formatted image prompt with Claude');
      return result.text.trim();
    }
  } catch (err) {
    console.warn('[Worker] Failed to format image prompt with Claude:', err);
  }

  return originalPrompt;
}

// ============================================================================
// Task Execution
// ============================================================================

async function executeTask(task: WorkerTask): Promise<WorkerResult> {
  currentTaskId = task.id;
  isAborted = false;

  emit({ type: 'started', taskId: task.id });

  try {
    if (task.type === 'image') {
      // Image generation
      if (!imageClient?.isEnabled()) {
        throw new Error('Image generation not configured - missing OpenAI API key');
      }

      // Calculate estimated cost
      const imageModel = config?.imageModel || 'dall-e-3';
      const imageSize = config?.imageSize || '1024x1024';
      const imageQuality = config?.imageQuality || 'standard';
      const estimatedCost = estimateImageCost(imageModel, imageSize, imageQuality);

      // Optionally format the prompt with Claude first (multishot prompting)
      const finalPrompt = await formatImagePromptWithClaude(task.prompt);

      if (isAborted) {
        throw new Error('Task aborted');
      }

      const result = await imageClient.generate({ prompt: finalPrompt });

      if (isAborted) {
        throw new Error('Task aborted');
      }

      if (result.error) {
        throw new Error(result.error);
      }

      if (!result.imageBlob) {
        throw new Error('No image data returned from API');
      }

      if (isAborted) {
        throw new Error('Task aborted');
      }

      // Calculate actual cost (GPT Image models provide token usage, DALL-E uses per-image pricing)
      const actualCost = calculateActualImageCost(imageModel, imageSize, imageQuality, result.usage);
      const generatedAt = Date.now();

      // Generate imageId and save directly to IndexedDB (before notifying main thread)
      const imageId = generateImageId(task.entityId);

      try {
        await saveImage(imageId, result.imageBlob, {
          entityId: task.entityId,
          projectId: task.projectId,
          entityName: task.entityName,
          entityKind: task.entityKind,
          entityCulture: task.entityCulture,
          prompt: finalPrompt,  // Save the prompt used for generation
          generatedAt,
          model: imageModel,
          revisedPrompt: result.revisedPrompt,
          estimatedCost,
          actualCost,
          inputTokens: result.usage?.inputTokens,
          outputTokens: result.usage?.outputTokens,
        });
        // Note: Old images are NOT deleted - they remain in the library for potential reuse
      } catch (err) {
        console.error('[Worker] Failed to save image to IndexedDB:', err);
        throw new Error('Failed to save image to storage');
      }

      // Return imageId instead of blob - blob is already persisted
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

      return {
        id: task.id,
        entityId: task.entityId,
        type: task.type,
        success: true,
        result: enrichmentResult,
      };
    } else {
      // Text generation (description or eraNarrative)
      if (!llmClient?.isEnabled()) {
        throw new Error('Text generation not configured - missing Anthropic API key');
      }

      const textModel = config?.textModel || 'claude-sonnet-4-20250514';
      const taskType = task.type === 'eraNarrative' ? 'eraNarrative' :
                       task.type === 'relationship' ? 'relationship' : 'description';

      // Calculate estimated cost before API call
      const estimate = estimateTextCost(task.prompt, taskType, textModel);

      const result = await llmClient.complete({
        systemPrompt: buildSystemPrompt(),
        prompt: task.prompt,
        maxTokens: 512,
        temperature: 0.7,
      });

      if (isAborted) {
        throw new Error('Task aborted');
      }

      if (result.error) {
        throw new Error(result.error);
      }

      // Calculate actual cost from usage data
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

      return {
        id: task.id,
        entityId: task.entityId,
        type: task.type,
        success: true,
        result: enrichmentResult,
      };
    }
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

      // Initialize clients
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
export type { WorkerTask, WorkerResult, EnrichmentResult, EnrichmentType };
