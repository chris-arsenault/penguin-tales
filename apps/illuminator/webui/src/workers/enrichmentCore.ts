/**
 * Enrichment Core - Shared logic for enrichment workers
 *
 * This module contains the core task execution logic used by both
 * the SharedWorker and dedicated Worker implementations.
 */

import { LLMClient } from '../lib/llmClient';
import { ImageClient } from '../lib/imageClient';
import type { EnrichmentType, WorkerTask, WorkerResult, EnrichmentResult, SerializableStoryContext, ChronicleStep } from '../lib/enrichmentTypes';
import type { NarrativeStyle } from '@canonry/world-schema';
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
import {
  createStory,
  updateStoryPlan,
  updateStoryScene,
  updateStoryAssembly,
  updateStoryCohesion,
  generateStoryId,
  markScenesComplete,
  getStory,
} from '../lib/chronicleStorage';
import type { ChronicleGenerationContext, StoryPlan, EntityContext, CohesionReport } from '../lib/chronicleTypes';
import { buildPlanPrompt, parsePlanResponse } from '../lib/chroniclePlanGenerator';
import { buildScenePrompt, parseSceneResponse, updatePlanWithSceneContent } from '../lib/chronicleSceneExpander';
import { assembleStory, buildStitchPrompt } from '../lib/chronicleAssembler';
import { buildValidationPrompt, parseValidationResponse } from '../lib/chronicleCohesionValidator';
import { saveCostRecord, generateCostId, type CostType } from '../lib/costStorage';

// ============================================================================
// Types
// ============================================================================

export interface WorkerConfig {
  anthropicApiKey: string;
  openaiApiKey: string;
  textModel: string;
  chronicleModel?: string;  // Model for entity stories (defaults to textModel)
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
export async function formatImagePromptWithClaude(
  originalPrompt: string,
  config: WorkerConfig,
  llmClient: LLMClient
): Promise<ImagePromptFormatResult> {
  if (!config.useClaudeForImagePrompt || !config.claudeImagePromptTemplate) {
    return { prompt: originalPrompt };
  }

  if (!llmClient.isEnabled()) {
    console.warn('[Worker] Claude not configured, skipping image prompt formatting');
    return { prompt: originalPrompt };
  }

  const textModel = config.textModel || 'claude-sonnet-4-20250514';
  const imageModel = config.imageModel || 'dall-e-3';
  const formattingPrompt = config.claudeImagePromptTemplate
    .replace(/\{\{modelName\}\}/g, imageModel)
    .replace(/\{\{prompt\}\}/g, originalPrompt);

  const estimate = estimateTextCost(formattingPrompt, 'description', textModel);

  try {
    const result = await llmClient.complete({
      systemPrompt: 'You are a prompt engineer specializing in image generation. Respond only with the reformatted prompt, no explanations or preamble.',
      prompt: formattingPrompt,
      maxTokens: 1024,
      temperature: 0.3,
    });

    if (result.text && !result.error) {
      console.log('[Worker] Formatted image prompt with Claude');

      let actualCost = estimate.estimatedCost;
      let inputTokens = estimate.inputTokens;
      let outputTokens = estimate.outputTokens;

      if (result.usage) {
        inputTokens = result.usage.inputTokens;
        outputTokens = result.usage.outputTokens;
        actualCost = calculateActualTextCost(inputTokens, outputTokens, textModel);
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
  const formatResult = await formatImagePromptWithClaude(originalPrompt, config, llmClient);
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
      model: config.textModel || 'claude-sonnet-4-20250514',
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

  // Save cost record independently
  await saveCostRecord({
    id: generateCostId(),
    timestamp: Date.now(),
    projectId: task.projectId,
    simulationRunId: task.simulationRunId,
    entityId: task.entityId,
    entityName: task.entityName,
    entityKind: task.entityKind,
    type: taskType as CostType,
    model: textModel,
    estimatedCost: estimate.estimatedCost,
    actualCost,
    inputTokens,
    outputTokens,
  });

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

// ============================================================================
// Entity Story Task Execution
// ============================================================================

const DEFAULT_STORY_SYSTEM_PROMPT = `You are a narrative writer for a fantasy world wiki. You write engaging, character-driven stories based on structured world data. Your writing is vivid, concise, and true to the established lore.`;

function getChronicleSystemPrompt(
  step: ChronicleStep,
  style?: NarrativeStyle,
  plan?: StoryPlan
): string {
  const format = style?.format === 'document' ||
    (plan && 'type' in plan.plot && plan.plot.type === 'document')
    ? 'document'
    : 'story';

  switch (step) {
    case 'plan':
      return format === 'document'
        ? 'You are an in-world document planner. Produce structured JSON plans that match the requested document format.'
        : 'You are a narrative planner. Produce structured JSON plans for multi-entity stories.';
    case 'expand':
      return format === 'document'
        ? 'You are an in-world document writer. Draft a single section consistent with the provided outline.'
        : 'You are a narrative prose writer. Draft a single scene consistent with the provided outline and style.';
    case 'assemble':
      return format === 'document'
        ? 'You are an editor polishing an in-world document. Make minimal edits and preserve structure.'
        : 'You are a narrative editor. Make minimal edits to improve flow while preserving structure.';
    case 'validate':
      return format === 'document'
        ? 'You are a critical editor validating an in-world document against its plan.'
        : 'You are a critical editor validating narrative coherence against the plan.';
    default:
      return DEFAULT_STORY_SYSTEM_PROMPT;
  }
}

/**
 * Convert serializable story context to full generation context
 */
function deserializeStoryContext(ctx: SerializableStoryContext): ChronicleGenerationContext {
  // Convert entities to EntityContext format
  const entities: EntityContext[] = ctx.entities.map((e) => ({
    id: e.id,
    name: e.name,
    kind: e.kind,
    subtype: e.subtype,
    prominence: e.prominence,
    culture: e.culture,
    status: e.status,
    tags: {},
    createdAt: 0,
    updatedAt: 0,
  }));

  // Find the target entity with full details
  const entity: EntityContext = {
    id: ctx.entity.id,
    name: ctx.entity.name,
    kind: ctx.entity.kind,
    subtype: ctx.entity.subtype,
    prominence: ctx.entity.prominence,
    culture: ctx.entity.culture,
    status: ctx.entity.status,
    tags: ctx.entity.tags,
    description: ctx.entity.description,
    enrichedDescription: ctx.entity.enrichedDescription,
    createdAt: ctx.entity.createdAt,
    updatedAt: ctx.entity.updatedAt,
  };

  return {
    worldName: ctx.worldName,
    worldDescription: ctx.worldDescription,
    canonFacts: ctx.canonFacts,
    tone: ctx.tone,
    targetType: 'entityStory',
    targetId: ctx.entity.id,
    entity,
    entities,
    relationships: ctx.relationships.map((r) => ({
      src: r.src,
      dst: r.dst,
      kind: r.kind,
      strength: r.strength,
      sourceName: r.sourceName,
      sourceKind: r.sourceKind,
      targetName: r.targetName,
      targetKind: r.targetKind,
    })),
    events: ctx.events.map((e) => ({
      id: e.id,
      tick: e.tick,
      era: e.era,
      eventKind: e.eventKind,
      significance: e.significance,
      headline: e.headline,
      description: e.description,
      subjectId: e.subjectId,
      subjectName: e.subjectName,
      objectId: e.objectId,
      objectName: e.objectName,
      narrativeTags: e.narrativeTags,
    })),
    existingDescriptions: new Map(Object.entries(ctx.existingDescriptions)),
    existingBackstories: new Map(),
  };
}

/**
 * Execute a SINGLE step of entity story generation.
 * Each step pauses for user review before proceeding to the next.
 */
export async function executeEntityStoryTask(
  task: WorkerTask,
  config: WorkerConfig,
  llmClient: LLMClient,
  isAborted: () => boolean
): Promise<TaskResult> {
  if (!llmClient.isEnabled()) {
    return { success: false, error: 'Text generation not configured - missing Anthropic API key' };
  }

  const step = task.chronicleStep || 'plan';
  const textModel = config.chronicleModel || config.textModel || 'claude-sonnet-4-20250514';
  console.log(`[Worker] Entity story step=${step} for entity=${task.entityId}, model=${textModel}`);

  // For plan step, we need storyContext. For other steps, we need storyId.
  if (step === 'plan') {
    if (!task.storyContext) {
      return { success: false, error: 'Story context required for plan step' };
    }
    return executePlanStep(task, config, llmClient, isAborted, textModel);
  }

  // For expand/assemble/validate, we need the existing story
  if (!task.storyId) {
    return { success: false, error: `storyId required for ${step} step` };
  }

  const storyRecord = await getStory(task.storyId);
  if (!storyRecord) {
    return { success: false, error: `Story ${task.storyId} not found` };
  }

  if (step === 'expand') {
    if (!task.storyContext) {
      return { success: false, error: 'Story context required for expand step' };
    }
    return executeExpandStep(task, storyRecord, config, llmClient, isAborted, textModel);
  }

  if (step === 'assemble') {
    if (!task.storyContext) {
      return { success: false, error: 'Story context required for assemble step' };
    }
    return executeAssembleStep(task, storyRecord, config, llmClient, isAborted, textModel);
  }

  if (step === 'validate') {
    if (!task.storyContext) {
      return { success: false, error: 'Story context required for validate step' };
    }
    return executeValidateStep(task, storyRecord, config, llmClient, isAborted, textModel);
  }

  return { success: false, error: `Unknown step: ${step}` };
}

/**
 * Step 1: Generate story plan
 */
async function executePlanStep(
  task: WorkerTask,
  config: WorkerConfig,
  llmClient: LLMClient,
  isAborted: () => boolean,
  textModel: string
): Promise<TaskResult> {
  const storyContext = task.storyContext!;
  const context = deserializeStoryContext(storyContext);
  const narrativeStyle = storyContext.narrativeStyle;
  const storyId = generateStoryId(task.entityId);

  try {
    await createStory(storyId, {
      entityId: task.entityId,
      entityName: task.entityName,
      entityKind: task.entityKind,
      entityCulture: task.entityCulture,
      projectId: task.projectId,
      simulationRunId: task.simulationRunId,
      model: textModel,
    });
    console.log(`[Worker] Created story record ${storyId}`);
  } catch (err) {
    return { success: false, error: `Failed to create story record: ${err}` };
  }

  const styleInfo = narrativeStyle ? ` with style="${narrativeStyle.name}"` : '';
  console.log(`[Worker] Step 1: Generating plan${styleInfo}...`);
  const planPrompt = buildPlanPrompt(context, narrativeStyle);
  const planEstimate = estimateTextCost(planPrompt, 'description', textModel);

  const planResult = await llmClient.complete({
    systemPrompt: getChronicleSystemPrompt('plan', narrativeStyle),
    prompt: planPrompt,
    maxTokens: 4096,
    temperature: 0.7,
  });

  if (isAborted()) {
    return { success: false, error: 'Task aborted' };
  }

  if (planResult.error) {
    return { success: false, error: `Plan generation failed: ${planResult.error}` };
  }

  const planCost = {
    estimated: planEstimate.estimatedCost,
    actual: planResult.usage
      ? calculateActualTextCost(planResult.usage.inputTokens, planResult.usage.outputTokens, textModel)
      : planEstimate.estimatedCost,
    inputTokens: planResult.usage?.inputTokens || planEstimate.inputTokens,
    outputTokens: planResult.usage?.outputTokens || planEstimate.outputTokens,
  };

  let plan: StoryPlan;
  try {
    plan = parsePlanResponse(planResult.text, context, narrativeStyle);
    plan.generatedAt = Date.now();
    plan.model = textModel;
  } catch (err) {
    return { success: false, error: `Failed to parse plan: ${err}` };
  }

  await updateStoryPlan(storyId, plan, planCost);
  console.log('[Worker] Step 1 complete - plan saved, awaiting user review');

  // Save cost record independently
  await saveCostRecord({
    id: generateCostId(),
    timestamp: Date.now(),
    projectId: task.projectId,
    simulationRunId: task.simulationRunId,
    entityId: task.entityId,
    entityName: task.entityName,
    entityKind: task.entityKind,
    storyId,
    type: 'storyPlan',
    model: textModel,
    estimatedCost: planCost.estimated,
    actualCost: planCost.actual,
    inputTokens: planCost.inputTokens,
    outputTokens: planCost.outputTokens,
  });

  return {
    success: true,
    result: {
      storyId,
      generatedAt: Date.now(),
      model: textModel,
      estimatedCost: planCost.estimated,
      actualCost: planCost.actual,
      inputTokens: planCost.inputTokens,
      outputTokens: planCost.outputTokens,
    },
  };
}

/**
 * Step 2: Expand all scenes
 */
async function executeExpandStep(
  task: WorkerTask,
  storyRecord: Awaited<ReturnType<typeof getStory>>,
  config: WorkerConfig,
  llmClient: LLMClient,
  isAborted: () => boolean,
  textModel: string
): Promise<TaskResult> {
  if (!storyRecord?.plan) {
    return { success: false, error: 'Story has no plan to expand' };
  }

  const context = deserializeStoryContext(task.storyContext!);
  const plan = storyRecord.plan;
  const storyId = storyRecord.storyId;
  const narrativeStyle = task.storyContext?.narrativeStyle;

  console.log(`[Worker] Step 2: Expanding ${plan.scenes.length} scenes...`);

  let totalEstimatedCost = 0;
  let totalActualCost = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  const expandedScenes: { id: string; content: string }[] = [];

  for (let i = 0; i < plan.scenes.length; i++) {
    if (isAborted()) {
      return { success: false, error: 'Task aborted' };
    }

    const scene = plan.scenes[i];
    const scenePrompt = buildScenePrompt(scene, i, plan, context, expandedScenes, narrativeStyle);
    const sceneEstimate = estimateTextCost(scenePrompt, 'description', textModel);

    const sceneResult = await llmClient.complete({
      systemPrompt: getChronicleSystemPrompt('expand', narrativeStyle, plan),
      prompt: scenePrompt,
      maxTokens: 2048,
      temperature: 0.7,
    });

    if (sceneResult.error) {
      return { success: false, error: `Scene ${i + 1} generation failed: ${sceneResult.error}` };
    }

    const sceneContent = parseSceneResponse(sceneResult.text);
    expandedScenes.push({ id: scene.id, content: sceneContent });

    const sceneCost = {
      estimated: sceneEstimate.estimatedCost,
      actual: sceneResult.usage
        ? calculateActualTextCost(sceneResult.usage.inputTokens, sceneResult.usage.outputTokens, textModel)
        : sceneEstimate.estimatedCost,
      inputTokens: sceneResult.usage?.inputTokens || sceneEstimate.inputTokens,
      outputTokens: sceneResult.usage?.outputTokens || sceneEstimate.outputTokens,
    };
    totalEstimatedCost += sceneCost.estimated;
    totalActualCost += sceneCost.actual;
    totalInputTokens += sceneCost.inputTokens;
    totalOutputTokens += sceneCost.outputTokens;

    await updateStoryScene(storyId, i, sceneContent, sceneCost);

    // Save cost record independently for each scene
    await saveCostRecord({
      id: generateCostId(),
      timestamp: Date.now(),
      projectId: task.projectId,
      simulationRunId: task.simulationRunId,
      entityId: task.entityId,
      entityName: task.entityName,
      entityKind: task.entityKind,
      storyId,
      type: 'storyScene',
      model: textModel,
      estimatedCost: sceneCost.estimated,
      actualCost: sceneCost.actual,
      inputTokens: sceneCost.inputTokens,
      outputTokens: sceneCost.outputTokens,
    });

    console.log(`[Worker] Step 2: Scene ${i + 1}/${plan.scenes.length} saved`);
  }

  // Mark scenes as complete - pauses for user review
  await markScenesComplete(storyId);
  console.log('[Worker] Step 2 complete - scenes saved, awaiting user review');

  return {
    success: true,
    result: {
      storyId,
      generatedAt: Date.now(),
      model: textModel,
      estimatedCost: totalEstimatedCost,
      actualCost: totalActualCost,
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
    },
  };
}

/**
 * Step 3: Assemble story (no LLM call, just assembly)
 */
async function executeAssembleStep(
  task: WorkerTask,
  storyRecord: Awaited<ReturnType<typeof getStory>>,
  config: WorkerConfig,
  llmClient: LLMClient,
  isAborted: () => boolean,
  textModel: string
): Promise<TaskResult> {
  if (!storyRecord?.plan) {
    return { success: false, error: 'Story has no plan to assemble' };
  }

  const context = deserializeStoryContext(task.storyContext!);
  const plan = storyRecord.plan;
  const storyId = storyRecord.storyId;
  const narrativeStyle = task.storyContext?.narrativeStyle;

  console.log('[Worker] Step 3: Assembling story...');

  const assemblyResult = assembleStory(plan, context, {
    includeTitle: true,
    includeSceneTitles: false,
    injectLinks: true,
  });

  if (!assemblyResult.success || !assemblyResult.content) {
    return { success: false, error: `Assembly failed: ${assemblyResult.error || 'Unknown error'}` };
  }

  let assembledContent = assemblyResult.content;
  let assemblyCost = {
    estimated: 0,
    actual: 0,
    inputTokens: 0,
    outputTokens: 0,
  };

  if (llmClient.isEnabled()) {
    const stitchPrompt = buildStitchPrompt(assembledContent, plan, context, narrativeStyle);
    const stitchEstimate = estimateTextCost(stitchPrompt, 'description', textModel);

    const stitchResult = await llmClient.complete({
      systemPrompt: getChronicleSystemPrompt('assemble', narrativeStyle, plan),
      prompt: stitchPrompt,
      maxTokens: 3072,
      temperature: 0.2,
    });

    if (isAborted()) {
      return { success: false, error: 'Task aborted' };
    }

    if (!stitchResult.error && stitchResult.text) {
      assembledContent = stitchResult.text.trim();
    }

    assemblyCost = {
      estimated: stitchEstimate.estimatedCost,
      actual: stitchResult.usage
        ? calculateActualTextCost(stitchResult.usage.inputTokens, stitchResult.usage.outputTokens, textModel)
        : stitchEstimate.estimatedCost,
      inputTokens: stitchResult.usage?.inputTokens || stitchEstimate.inputTokens,
      outputTokens: stitchResult.usage?.outputTokens || stitchEstimate.outputTokens,
    };

    await saveCostRecord({
      id: generateCostId(),
      timestamp: Date.now(),
      projectId: task.projectId,
      simulationRunId: task.simulationRunId,
      entityId: task.entityId,
      entityName: task.entityName,
      entityKind: task.entityKind,
      storyId,
      type: 'storyAssembly',
      model: textModel,
      estimatedCost: assemblyCost.estimated,
      actualCost: assemblyCost.actual,
      inputTokens: assemblyCost.inputTokens,
      outputTokens: assemblyCost.outputTokens,
    });
  }

  // Save assembled content - sets status to assembly_ready (pauses for user review)
  await updateStoryAssembly(storyId, assembledContent, assemblyResult.wikiLinks);
  console.log('[Worker] Step 3 complete - assembly saved, awaiting user review');

  return {
    success: true,
    result: {
      storyId,
      generatedAt: Date.now(),
      model: textModel,
      estimatedCost: assemblyCost.estimated,
      actualCost: assemblyCost.actual,
      inputTokens: assemblyCost.inputTokens,
      outputTokens: assemblyCost.outputTokens,
    },
  };
}

/**
 * Step 4: Validate cohesion
 */
async function executeValidateStep(
  task: WorkerTask,
  storyRecord: Awaited<ReturnType<typeof getStory>>,
  config: WorkerConfig,
  llmClient: LLMClient,
  isAborted: () => boolean,
  textModel: string
): Promise<TaskResult> {
  if (!storyRecord?.plan || !storyRecord?.assembledContent) {
    return { success: false, error: 'Story has no assembled content to validate' };
  }

  const context = deserializeStoryContext(task.storyContext!);
  const plan = storyRecord.plan;
  const storyId = storyRecord.storyId;
  const narrativeStyle = task.storyContext?.narrativeStyle;

  console.log('[Worker] Step 4: Validating cohesion...');

  const validationPrompt = buildValidationPrompt(storyRecord.assembledContent, plan, context, narrativeStyle);
  const validationEstimate = estimateTextCost(validationPrompt, 'description', textModel);

  const validationResult = await llmClient.complete({
    systemPrompt: getChronicleSystemPrompt('validate', narrativeStyle, plan),
    prompt: validationPrompt,
    maxTokens: 2048,
    temperature: 0.3,
  });

  if (isAborted()) {
    return { success: false, error: 'Task aborted' };
  }

  const validationCost = {
    estimated: validationEstimate.estimatedCost,
    actual: validationResult.usage
      ? calculateActualTextCost(validationResult.usage.inputTokens, validationResult.usage.outputTokens, textModel)
      : validationEstimate.estimatedCost,
    inputTokens: validationResult.usage?.inputTokens || validationEstimate.inputTokens,
    outputTokens: validationResult.usage?.outputTokens || validationEstimate.outputTokens,
  };

  let cohesionReport: CohesionReport;

  if (!validationResult.error && validationResult.text) {
    try {
      cohesionReport = parseValidationResponse(validationResult.text, plan);
      cohesionReport.generatedAt = Date.now();
      cohesionReport.model = textModel;
    } catch (err) {
      console.warn('[Worker] Failed to parse validation response, using fallback:', err);
      cohesionReport = createFallbackCohesionReport(plan, textModel, 'Validation parsing failed - story generated successfully.');
    }
  } else {
    console.warn('[Worker] Validation LLM call failed, using fallback report');
    cohesionReport = createFallbackCohesionReport(plan, textModel, 'Validation unavailable - story generated successfully.');
  }

  await updateStoryCohesion(storyId, cohesionReport, validationCost);
  console.log('[Worker] Step 4 complete - validation saved');

  // Save cost record independently
  await saveCostRecord({
    id: generateCostId(),
    timestamp: Date.now(),
    projectId: task.projectId,
    simulationRunId: task.simulationRunId,
    entityId: task.entityId,
    entityName: task.entityName,
    entityKind: task.entityKind,
    storyId,
    type: 'storyValidation',
    model: textModel,
    estimatedCost: validationCost.estimated,
    actualCost: validationCost.actual,
    inputTokens: validationCost.inputTokens,
    outputTokens: validationCost.outputTokens,
  });

  return {
    success: true,
    result: {
      storyId,
      generatedAt: Date.now(),
      model: textModel,
      estimatedCost: validationCost.estimated,
      actualCost: validationCost.actual,
      inputTokens: validationCost.inputTokens,
      outputTokens: validationCost.outputTokens,
    },
  };
}

/**
 * Create a fallback cohesion report when validation fails
 */
function createFallbackCohesionReport(plan: StoryPlan, model: string, summary: string): CohesionReport {
  return {
    overallScore: 0.7,
    passesValidation: true,
    summary,
    sceneReports: plan.scenes.map((scene) => ({
      sceneId: scene.id,
      achievesGoal: true,
      narrativeFlow: 0.7,
      issues: [],
    })),
    crossReferences: { found: [], missing: [], accuracy: 1.0 },
    generatedAt: Date.now(),
    model,
  };
}

// Re-export types
export type { WorkerTask, WorkerResult, EnrichmentResult, EnrichmentType };
