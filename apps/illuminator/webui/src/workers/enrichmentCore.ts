/**
 * Enrichment Core - Shared logic for enrichment workers
 *
 * This module contains the core task execution logic used by both
 * the SharedWorker and dedicated Worker implementations.
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
// Helpers
// ============================================================================

/**
 * Strip heading patterns from the beginning of generated text.
 */
export function stripLeadingHeading(text: string, entityName?: string): string {
  if (!text) return text;

  let result = text.trim();

  // Pattern 1: Markdown headings (# Name, ## Name, ### Name)
  const markdownHeadingMatch = result.match(/^#{1,6}\s+[^\n]+\n+(.*)$/s);
  if (markdownHeadingMatch) {
    result = markdownHeadingMatch[1].trim();
  }

  // Pattern 2: Underline headings (Name\n=== or Name\n---)
  const underlineHeadingMatch = result.match(/^[^\n]+\n[=\-]{3,}\n+(.*)$/s);
  if (underlineHeadingMatch) {
    result = underlineHeadingMatch[1].trim();
  }

  // Pattern 3: Bold name at start (**Name** or **Name**\n)
  const boldHeadingMatch = result.match(/^\*\*[^*]+\*\*\s*\n+(.*)$/s);
  if (boldHeadingMatch) {
    result = boldHeadingMatch[1].trim();
  }

  // Pattern 4: Name with colon at start (Name: or Name:\n)
  if (entityName) {
    const escapedName = entityName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const colonPattern = new RegExp(`^${escapedName}\\s*:\\s*\\n+(.*)$`, 'si');
    const colonMatch = result.match(colonPattern);
    if (colonMatch) {
      result = colonMatch[1].trim();
    }
  }

  // Pattern 5: Plain entity name as first line
  if (entityName) {
    const escapedName = entityName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const plainNamePattern = new RegExp(`^${escapedName}\\s*\\n+(.*)$`, 'si');
    const plainMatch = result.match(plainNamePattern);
    if (plainMatch) {
      result = plainMatch[1].trim();
    }
  }

  // Pattern 6: Generic "first line looks like a title"
  const lines = result.split('\n');
  if (lines.length >= 2) {
    const firstLine = lines[0].trim();
    const hasContent = lines.slice(1).some(l => l.trim().length > 0);
    if (hasContent && firstLine.length < 50 && !/[.!?]$/.test(firstLine)) {
      const looksLikeTitle = !/^(the|a|an|this|that|he|she|it|they)\s/i.test(firstLine);
      if (looksLikeTitle) {
        result = lines.slice(1).join('\n').trim();
      }
    }
  }

  return result;
}

export function buildSystemPrompt(): string {
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
export async function formatImagePromptWithClaude(
  originalPrompt: string,
  config: WorkerConfig,
  llmClient: LLMClient
): Promise<string> {
  if (!config.useClaudeForImagePrompt || !config.claudeImagePromptTemplate) {
    return originalPrompt;
  }

  if (!llmClient.isEnabled()) {
    console.warn('[Worker] Claude not configured, skipping image prompt formatting');
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
      console.log('[Worker] Formatted image prompt with Claude');
      return result.text.trim();
    }
  } catch (err) {
    console.warn('[Worker] Failed to format image prompt with Claude:', err);
  }

  return originalPrompt;
}

// ============================================================================
// Client Factory
// ============================================================================

export function createClients(config: WorkerConfig): { llmClient: LLMClient; imageClient: ImageClient } {
  const llmClient = new LLMClient({
    enabled: Boolean(config.anthropicApiKey),
    apiKey: config.anthropicApiKey,
    model: config.textModel || 'claude-sonnet-4-20250514',
  });

  const imageClient = new ImageClient({
    enabled: Boolean(config.openaiApiKey),
    apiKey: config.openaiApiKey,
    model: config.imageModel || 'dall-e-3',
    size: config.imageSize || '1024x1024',
    quality: config.imageQuality || 'standard',
  });

  return { llmClient, imageClient };
}

// ============================================================================
// Task Execution
// ============================================================================

export type TaskResult = {
  success: true;
  result: EnrichmentResult;
} | {
  success: false;
  error: string;
};

export async function executeImageTask(
  task: WorkerTask,
  config: WorkerConfig,
  llmClient: LLMClient,
  imageClient: ImageClient,
  isAborted: () => boolean
): Promise<TaskResult> {
  if (!imageClient.isEnabled()) {
    return { success: false, error: 'Image generation not configured - missing OpenAI API key' };
  }

  const imageModel = config.imageModel || 'dall-e-3';
  const imageSize = config.imageSize || '1024x1024';
  const imageQuality = config.imageQuality || 'standard';
  const estimatedCost = estimateImageCost(imageModel, imageSize, imageQuality);

  // Store original prompt before any refinement
  const originalPrompt = task.prompt;
  const finalPrompt = await formatImagePromptWithClaude(originalPrompt, config, llmClient);

  if (isAborted()) {
    return { success: false, error: 'Task aborted' };
  }

  const result = await imageClient.generate({ prompt: finalPrompt });

  if (isAborted()) {
    return { success: false, error: 'Task aborted' };
  }

  if (result.error) {
    return { success: false, error: result.error };
  }

  if (!result.imageBlob) {
    return { success: false, error: 'No image data returned from API' };
  }

  const actualCost = calculateActualImageCost(imageModel, imageSize, imageQuality, result.usage);
  const generatedAt = Date.now();
  const imageId = generateImageId(task.entityId);

  // Save directly to IndexedDB
  await saveImage(imageId, result.imageBlob, {
    entityId: task.entityId,
    projectId: task.projectId,
    entityName: task.entityName,
    entityKind: task.entityKind,
    entityCulture: task.entityCulture,
    originalPrompt,
    finalPrompt,
    generatedAt,
    model: imageModel,
    revisedPrompt: result.revisedPrompt,
    estimatedCost,
    actualCost,
    inputTokens: result.usage?.inputTokens,
    outputTokens: result.usage?.outputTokens,
  });

  return {
    success: true,
    result: {
      imageId,
      revisedPrompt: result.revisedPrompt,
      generatedAt,
      model: imageModel,
      estimatedCost,
      actualCost,
      inputTokens: result.usage?.inputTokens,
      outputTokens: result.usage?.outputTokens,
    },
  };
}

export async function executeTextTask(
  task: WorkerTask,
  config: WorkerConfig,
  llmClient: LLMClient,
  isAborted: () => boolean
): Promise<TaskResult> {
  if (!llmClient.isEnabled()) {
    return { success: false, error: 'Text generation not configured - missing Anthropic API key' };
  }

  const textModel = config.textModel || 'claude-sonnet-4-20250514';
  const taskType = task.type === 'eraNarrative' ? 'eraNarrative' :
                   task.type === 'relationship' ? 'relationship' : 'description';
  const estimate = estimateTextCost(task.prompt, taskType, textModel);

  const result = await llmClient.complete({
    systemPrompt: buildSystemPrompt(),
    prompt: task.prompt,
    maxTokens: 512,
    temperature: 0.7,
  });

  if (isAborted()) {
    return { success: false, error: 'Task aborted' };
  }

  if (result.error) {
    return { success: false, error: result.error };
  }

  let actualCost = estimate.estimatedCost;
  let inputTokens = estimate.inputTokens;
  let outputTokens = estimate.outputTokens;

  if (result.usage) {
    inputTokens = result.usage.inputTokens;
    outputTokens = result.usage.outputTokens;
    actualCost = calculateActualTextCost(inputTokens, outputTokens, textModel);
  }

  // Clean up the text - strip leading headings for descriptions
  let cleanedText = result.text;
  if (task.type === 'description' && cleanedText) {
    cleanedText = stripLeadingHeading(cleanedText, task.entityName);
  }

  return {
    success: true,
    result: {
      text: cleanedText,
      generatedAt: Date.now(),
      model: textModel,
      estimatedCost: estimate.estimatedCost,
      actualCost,
      inputTokens,
      outputTokens,
    },
  };
}

// Re-export types
export type { WorkerTask, WorkerResult, EnrichmentResult, EnrichmentType };
