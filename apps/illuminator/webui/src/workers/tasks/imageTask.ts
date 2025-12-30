import type { WorkerTask } from '../../lib/enrichmentTypes';
import { estimateTextCost, estimateImageCost, calculateActualTextCost, calculateActualImageCost } from '../../lib/costEstimation';
import { saveImage, generateImageId } from '../../lib/workerStorage';
import { saveCostRecord, generateCostId } from '../../lib/costStorage';
import { calcTokenBudget } from '../../lib/llmBudget';
import { getCallConfig } from './llmCallConfig';
import type { TaskHandler } from './taskTypes';
import type { LLMClient } from '../../lib/llmClient';
import type { ResolvedLLMCallConfig } from '../../lib/llmModelSettings';

interface ImagePromptFormatResult {
  prompt: string;
  cost?: {
    estimated: number;
    actual: number;
    inputTokens: number;
    outputTokens: number;
  };
}

/**
 * Format an image prompt using Claude (multishot prompting)
 */
async function formatImagePromptWithClaude(
  originalPrompt: string,
  config: { useClaudeForImagePrompt?: boolean; claudeImagePromptTemplate?: string; imageModel?: string },
  llmClient: LLMClient,
  callConfig: ResolvedLLMCallConfig
): Promise<ImagePromptFormatResult> {
  if (!config.useClaudeForImagePrompt || !config.claudeImagePromptTemplate) {
    return { prompt: originalPrompt };
  }

  if (!llmClient.isEnabled()) {
    console.warn('[Worker] Claude not configured, skipping image prompt formatting');
    return { prompt: originalPrompt };
  }

  const imageModel = config.imageModel || 'dall-e-3';
  const formattingPrompt = config.claudeImagePromptTemplate
    .replace(/\{\{modelName\}\}/g, imageModel)
    .replace(/\{\{prompt\}\}/g, originalPrompt);

  const estimate = estimateTextCost(formattingPrompt, 'description', callConfig.model);
  const { totalMaxTokens, thinkingBudget } = calcTokenBudget(callConfig, 1024);

  try {
    const result = await llmClient.complete({
      systemPrompt: 'You are a prompt engineer specializing in image generation. Respond only with the reformatted prompt, no explanations or preamble.',
      prompt: formattingPrompt,
      model: callConfig.model,
      maxTokens: totalMaxTokens,
      temperature: 0.3,
      thinkingBudget,
    });

    if (result.text && !result.error) {
      console.log('[Worker] Formatted image prompt with Claude');

      let actualCost = estimate.estimatedCost;
      let inputTokens = estimate.inputTokens;
      let outputTokens = estimate.outputTokens;

      if (result.usage) {
        inputTokens = result.usage.inputTokens;
        outputTokens = result.usage.outputTokens;
        actualCost = calculateActualTextCost(inputTokens, outputTokens, callConfig.model);
      }

      return {
        prompt: result.text.trim(),
        cost: {
          estimated: estimate.estimatedCost,
          actual: actualCost,
          inputTokens,
          outputTokens,
        },
      };
    }
  } catch (err) {
    console.warn('[Worker] Failed to format image prompt with Claude:', err);
  }

  return { prompt: originalPrompt };
}

export const imageTask = {
  type: 'image',
  async execute(task, context) {
    const { config, llmClient, imageClient, isAborted } = context;

    if (!imageClient.isEnabled()) {
      return { success: false, error: 'Image generation not configured - missing OpenAI API key' };
    }

    const imageModel = config.imageModel || 'dall-e-3';
    const imageSize = config.imageSize || '1024x1024';
    const imageQuality = config.imageQuality || 'standard';
    const estimatedCost = estimateImageCost(imageModel, imageSize, imageQuality);

    // Store original prompt before any refinement
    const originalPrompt = task.prompt;
    const formattingConfig = getCallConfig(config, 'image.promptFormatting');
    const formatResult = await formatImagePromptWithClaude(originalPrompt, config, llmClient, formattingConfig);
    const finalPrompt = formatResult.prompt;

    // Save imagePrompt cost record if Claude was used
    if (formatResult.cost) {
      await saveCostRecord({
        id: generateCostId(),
        timestamp: Date.now(),
        projectId: task.projectId,
        simulationRunId: task.simulationRunId,
        entityId: task.entityId,
        entityName: task.entityName,
        entityKind: task.entityKind,
        type: 'imagePrompt',
        model: formattingConfig.model,
        estimatedCost: formatResult.cost.estimated,
        actualCost: formatResult.cost.actual,
        inputTokens: formatResult.cost.inputTokens,
        outputTokens: formatResult.cost.outputTokens,
      });
    }

    if (isAborted()) {
      return { success: false, error: 'Task aborted' };
    }

    const result = await imageClient.generate({ prompt: finalPrompt });
    const debug = result.debug;

    if (isAborted()) {
      return { success: false, error: 'Task aborted' };
    }

    if (result.error) {
      return { success: false, error: result.error, debug };
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
      // Chronicle image fields
      imageType: task.imageType,
      chronicleId: task.chronicleId,
      imageRefId: task.imageRefId,
      sceneDescription: task.sceneDescription,
    });

    // Save cost record independently
    await saveCostRecord({
      id: generateCostId(),
      timestamp: Date.now(),
      projectId: task.projectId,
      simulationRunId: task.simulationRunId,
      entityId: task.entityId,
      entityName: task.entityName,
      entityKind: task.entityKind,
      type: 'image',
      model: imageModel,
      estimatedCost,
      actualCost,
      inputTokens: result.usage?.inputTokens || 0,
      outputTokens: result.usage?.outputTokens || 0,
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
      debug,
    };
  },
} satisfies TaskHandler<WorkerTask & { type: 'image' }>;
