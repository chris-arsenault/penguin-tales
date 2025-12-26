/**
 * Enrichment Core - Shared logic for enrichment workers
 *
 * This module contains the core task execution logic used by both
 * the SharedWorker and dedicated Worker implementations.
 */

import { LLMClient } from '../lib/llmClient';
import { ImageClient } from '../lib/imageClient';
import type {
  EnrichmentType,
  WorkerTask,
  WorkerResult,
  EnrichmentResult,
  SerializableChronicleContext,
  ChronicleStep,
  NetworkDebugInfo,
} from '../lib/enrichmentTypes';
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
  updateStorySection,
  updateStoryAssembly,
  updateStoryCohesion,
  updateStoryEdit,
  updateStoryFailure,
  generateStoryId,
  markSectionsComplete,
  getStory,
} from '../lib/chronicleStorage';
import type { ChronicleGenerationContext, ChroniclePlan, EntityContext, CohesionReport } from '../lib/chronicleTypes';
import { buildSelectionContext } from '../lib/chronicle/selection';
import { getPipeline } from '../lib/chronicle/pipelineRegistry';
import { applyFocusToContext } from '../lib/chronicle/focus';
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
  | { type: 'error'; taskId: string; error: string; debug?: NetworkDebugInfo };

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

function stripLeadingWrapper(text: string): string {
  if (!text) return text;
  let result = text.trim();

  const fenced = result.match(/```(?:markdown|md)?\s*([\s\S]*?)```/);
  if (fenced) {
    result = fenced[1].trim();
  }

  result = result.replace(/^(Here\s+is|Here's|Below\s+is)[^\n]*\n+/i, '');
  return result.trim();
}

async function markStoryFailure(
  storyId: string,
  step: ChronicleStep,
  error: string
): Promise<void> {
  try {
    await updateStoryFailure(storyId, step, error);
  } catch (err) {
    console.error('[Worker] Failed to record story failure:', err);
  }
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
  debug?: NetworkDebugInfo;
} | {
  success: false;
  error: string;
  debug?: NetworkDebugInfo;
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
  const taskType: CostType = 'description';
  const estimate = estimateTextCost(task.prompt, 'description', textModel);

  const result = await llmClient.complete({
    systemPrompt: buildSystemPrompt(),
    prompt: task.prompt,
    maxTokens: 512,
    temperature: 0.7,
  });
  const debug = result.debug;

  if (isAborted()) {
    return { success: false, error: 'Task aborted' };
  }

  if (result.error) {
    return { success: false, error: result.error, debug };
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
    debug,
  };
}

// ============================================================================
// Entity Story Task Execution
// ============================================================================

/**
 * Convert serializable chronicle context to full generation context
 */
function deserializeChronicleContext(ctx: SerializableChronicleContext): ChronicleGenerationContext {
  // Convert entities to EntityContext format
  const entities: EntityContext[] = ctx.entities.map((e) => ({
    id: e.id,
    name: e.name,
    kind: e.kind,
    subtype: e.subtype,
    prominence: e.prominence,
    culture: e.culture,
    status: e.status,
    tags: e.tags || {},
    description: e.description,
    enrichedDescription: e.enrichedDescription,
    createdAt: e.createdAt,
    updatedAt: e.updatedAt,
  }));

  const entity: EntityContext | undefined = ctx.entity
    ? {
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
    }
    : undefined;

  return {
    worldName: ctx.worldName,
    worldDescription: ctx.worldDescription,
    canonFacts: ctx.canonFacts,
    tone: ctx.tone,
    targetType: ctx.targetType,
    targetId: ctx.targetId,
    era: ctx.era
      ? {
        id: ctx.era.id,
        name: ctx.era.name,
        description: ctx.era.description,
      }
      : undefined,
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

  // For plan step, we need chronicleContext. For other steps, we need storyId.
  if (step === 'plan') {
    if (!task.chronicleContext) {
      return { success: false, error: 'Chronicle context required for plan step' };
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
    if (!task.chronicleContext) {
      return { success: false, error: 'Chronicle context required for expand step' };
    }
    return executeExpandStep(task, storyRecord, config, llmClient, isAborted, textModel);
  }

  if (step === 'assemble') {
    if (!task.chronicleContext) {
      return { success: false, error: 'Chronicle context required for assemble step' };
    }
    return executeAssembleStep(task, storyRecord, config, llmClient, isAborted, textModel);
  }

  if (step === 'edit') {
    if (!task.chronicleContext) {
      return { success: false, error: 'Chronicle context required for edit step' };
    }
    return executeEditStep(task, storyRecord, config, llmClient, isAborted, textModel);
  }

  if (step === 'validate') {
    if (!task.chronicleContext) {
      return { success: false, error: 'Chronicle context required for validate step' };
    }
    return executeValidateStep(task, storyRecord, config, llmClient, isAborted, textModel);
  }

  return { success: false, error: `Unknown step: ${step}` };
}

/**
 * Step 1: Generate chronicle plan
 */
async function executePlanStep(
  task: WorkerTask,
  config: WorkerConfig,
  llmClient: LLMClient,
  isAborted: () => boolean,
  textModel: string
): Promise<TaskResult> {
  const chronicleContext = task.chronicleContext!;
  const context = deserializeChronicleContext(chronicleContext);
  const narrativeStyle = chronicleContext.narrativeStyle;
  if (!narrativeStyle) {
    return { success: false, error: 'Narrative style is required for plan generation' };
  }
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
  const failPlan = async (message: string, debug?: NetworkDebugInfo): Promise<TaskResult> => {
    await markStoryFailure(storyId, 'plan', message);
    return { success: false, error: message, debug };
  };

  const styleInfo = narrativeStyle ? ` with style="${narrativeStyle.name}"` : '';
  console.log(`[Worker] Step 1: Generating plan${styleInfo}...`);
  const pipeline = getPipeline(narrativeStyle.format);
  const selection = buildSelectionContext(context, narrativeStyle);
  const planPrompt = pipeline.buildPlanPrompt(context, narrativeStyle, selection);
  const planEstimate = estimateTextCost(planPrompt, 'description', textModel);

  const planResult = await llmClient.complete({
    systemPrompt: pipeline.getSystemPrompt('plan', narrativeStyle),
    prompt: planPrompt,
    maxTokens: 4096,
    temperature: 0.7,
  });
  const debug = planResult.debug;

  if (isAborted()) {
    return failPlan('Task aborted', debug);
  }

  if (planResult.error) {
    return failPlan(`Plan generation failed: ${planResult.error}`, debug);
  }

  const planCost = {
    estimated: planEstimate.estimatedCost,
    actual: planResult.usage
      ? calculateActualTextCost(planResult.usage.inputTokens, planResult.usage.outputTokens, textModel)
      : planEstimate.estimatedCost,
    inputTokens: planResult.usage?.inputTokens || planEstimate.inputTokens,
    outputTokens: planResult.usage?.outputTokens || planEstimate.outputTokens,
  };

  let plan: ChroniclePlan;
  try {
    plan = pipeline.parsePlanResponse(planResult.text, context, narrativeStyle, selection);
    plan.generatedAt = Date.now();
    plan.model = textModel;
  } catch (err) {
    return failPlan(`Failed to parse plan: ${err}`, debug);
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
    debug,
  };
}

/**
 * Step 2: Expand all sections
 */
async function executeExpandStep(
  task: WorkerTask,
  storyRecord: Awaited<ReturnType<typeof getStory>>,
  config: WorkerConfig,
  llmClient: LLMClient,
  isAborted: () => boolean,
  textModel: string
): Promise<TaskResult> {
  if (!storyRecord) {
    return { success: false, error: 'Story record missing for expansion' };
  }

  const storyId = storyRecord.storyId;
  const failExpand = async (message: string, debug?: NetworkDebugInfo): Promise<TaskResult> => {
    await markStoryFailure(storyId, 'expand', message);
    return { success: false, error: message, debug };
  };

  if (!storyRecord.plan) {
    return failExpand('Chronicle has no plan to expand');
  }

  const context = deserializeChronicleContext(task.chronicleContext!);
  const plan = storyRecord.plan;
  const narrativeStyle = task.chronicleContext!.narrativeStyle;
  if (!narrativeStyle) {
    return failExpand('Narrative style is required for section expansion');
  }
  if (plan.format !== narrativeStyle.format) {
    return failExpand('Narrative style format does not match plan format');
  }
  const pipeline = getPipeline(plan.format);
  const focusedContext = applyFocusToContext(context, plan.focus);

  console.log(`[Worker] Step 2: Expanding ${plan.sections.length} sections...`);

  let totalEstimatedCost = 0;
  let totalActualCost = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let lastDebug: NetworkDebugInfo | undefined;

  const expandedSections: { id: string; content: string }[] = [];

  for (let i = 0; i < plan.sections.length; i++) {
    if (isAborted()) {
      return failExpand('Task aborted');
    }

    const section = plan.sections[i];
    const sectionPrompt = pipeline.buildSectionPrompt(
      section,
      i,
      plan,
      focusedContext,
      expandedSections,
      narrativeStyle
    );
    const sectionEstimate = estimateTextCost(sectionPrompt, 'description', textModel);

    const sectionResult = await llmClient.complete({
      systemPrompt: pipeline.getSystemPrompt('expand', narrativeStyle, plan),
      prompt: sectionPrompt,
      maxTokens: 2048,
      temperature: 0.7,
    });
    const debug = sectionResult.debug;
    lastDebug = debug;

    if (isAborted()) {
      return failExpand('Task aborted', debug);
    }

    if (sectionResult.error) {
      return failExpand(`Section ${i + 1} generation failed: ${sectionResult.error}`, debug);
    }

    let sectionContent = '';
    try {
      sectionContent = pipeline.parseSectionResponse(sectionResult.text);
    } catch (err) {
      return failExpand(`Failed to parse section ${i + 1}: ${err}`, debug);
    }
    expandedSections.push({ id: section.id, content: sectionContent });

    const sectionCost = {
      estimated: sectionEstimate.estimatedCost,
      actual: sectionResult.usage
        ? calculateActualTextCost(sectionResult.usage.inputTokens, sectionResult.usage.outputTokens, textModel)
        : sectionEstimate.estimatedCost,
      inputTokens: sectionResult.usage?.inputTokens || sectionEstimate.inputTokens,
      outputTokens: sectionResult.usage?.outputTokens || sectionEstimate.outputTokens,
    };
    totalEstimatedCost += sectionCost.estimated;
    totalActualCost += sectionCost.actual;
    totalInputTokens += sectionCost.inputTokens;
    totalOutputTokens += sectionCost.outputTokens;

    await updateStorySection(storyId, i, sectionContent, sectionCost);

    // Save cost record independently for each section
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
      estimatedCost: sectionCost.estimated,
      actualCost: sectionCost.actual,
      inputTokens: sectionCost.inputTokens,
      outputTokens: sectionCost.outputTokens,
    });

    console.log(`[Worker] Step 2: Section ${i + 1}/${plan.sections.length} saved`);
  }

  // Mark sections as complete - pauses for user review
  await markSectionsComplete(storyId);
  console.log('[Worker] Step 2 complete - sections saved, awaiting user review');

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
    debug: lastDebug,
  };
}

/**
 * Step 3: Assemble chronicle (no LLM call, just assembly)
 */
async function executeAssembleStep(
  task: WorkerTask,
  storyRecord: Awaited<ReturnType<typeof getStory>>,
  config: WorkerConfig,
  llmClient: LLMClient,
  isAborted: () => boolean,
  textModel: string
): Promise<TaskResult> {
  if (!storyRecord) {
    return { success: false, error: 'Story record missing for assembly' };
  }

  const storyId = storyRecord.storyId;
  const failAssemble = async (message: string, debug?: NetworkDebugInfo): Promise<TaskResult> => {
    await markStoryFailure(storyId, 'assemble', message);
    return { success: false, error: message, debug };
  };

  if (!storyRecord.plan) {
    return failAssemble('Chronicle has no plan to assemble');
  }

  const context = deserializeChronicleContext(task.chronicleContext!);
  const plan = storyRecord.plan;
  const narrativeStyle = task.chronicleContext!.narrativeStyle;
  if (!narrativeStyle) {
    return failAssemble('Narrative style is required for assembly');
  }
  if (plan.format !== narrativeStyle.format) {
    return failAssemble('Narrative style format does not match plan format');
  }
  const pipeline = getPipeline(plan.format);
  const focusedContext = applyFocusToContext(context, plan.focus);

  console.log('[Worker] Step 3: Assembling chronicle...');

  const assemblyResult = pipeline.assemble(plan, focusedContext);

  if (!assemblyResult.success || !assemblyResult.content) {
    return failAssemble(`Assembly failed: ${assemblyResult.error || 'Unknown error'}`);
  }

  let assembledContent = assemblyResult.content;
  let assemblyCost = {
    estimated: 0,
    actual: 0,
    inputTokens: 0,
    outputTokens: 0,
  };

  const stitchPrompt = pipeline.buildStitchPrompt(assembledContent, plan, focusedContext, narrativeStyle);
  const stitchEstimate = estimateTextCost(stitchPrompt, 'description', textModel);

  const stitchResult = await llmClient.complete({
    systemPrompt: pipeline.getSystemPrompt('assemble', narrativeStyle, plan),
    prompt: stitchPrompt,
    maxTokens: 3072,
    temperature: 0.2,
  });
  const debug = stitchResult.debug;

  if (isAborted()) {
    return failAssemble('Task aborted', debug);
  }

  if (stitchResult.error || !stitchResult.text) {
    return failAssemble(`Assembly stitching failed: ${stitchResult.error || 'Empty response'}`, debug);
  }

  assembledContent = stitchResult.text.trim();

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

  // Save assembled content - sets status to assembly_ready (pauses for user review)
  await updateStoryAssembly(storyId, assembledContent);
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
    debug,
  };
}

/**
 * Step 3.5: Edit chronicle based on validation suggestions, then re-validate
 */
async function executeEditStep(
  task: WorkerTask,
  storyRecord: Awaited<ReturnType<typeof getStory>>,
  config: WorkerConfig,
  llmClient: LLMClient,
  isAborted: () => boolean,
  textModel: string
): Promise<TaskResult> {
  if (!storyRecord) {
    return { success: false, error: 'Story record missing for editing' };
  }

  const storyId = storyRecord.storyId;
  const failEdit = async (message: string, debug?: NetworkDebugInfo): Promise<TaskResult> => {
    await markStoryFailure(storyId, 'edit', message);
    return { success: false, error: message, debug };
  };

  if (!storyRecord.plan || !storyRecord.assembledContent) {
    return failEdit('Chronicle has no assembled content to edit');
  }
  if (!storyRecord.cohesionReport) {
    return failEdit('Chronicle has no validation report to edit against');
  }

  const context = deserializeChronicleContext(task.chronicleContext!);
  const plan = storyRecord.plan;
  const narrativeStyle = task.chronicleContext!.narrativeStyle;
  if (!narrativeStyle) {
    return failEdit('Narrative style is required for editing');
  }
  if (plan.format !== narrativeStyle.format) {
    return failEdit('Narrative style format does not match plan format');
  }
  const pipeline = getPipeline(plan.format);

  console.log('[Worker] Step 3.5: Editing chronicle based on validation feedback...');

  const editPrompt = pipeline.buildEditPrompt(
    storyRecord.assembledContent,
    plan,
    context,
    narrativeStyle,
    storyRecord.cohesionReport
  );
  const editEstimate = estimateTextCost(editPrompt, 'description', textModel);

  const editResult = await llmClient.complete({
    systemPrompt: pipeline.getSystemPrompt('edit', narrativeStyle, plan),
    prompt: editPrompt,
    maxTokens: 4096,
    temperature: 0.3,
  });
  const debug = editResult.debug;

  if (isAborted()) {
    return failEdit('Task aborted', debug);
  }

  if (editResult.error || !editResult.text) {
    return failEdit(`Edit failed: ${editResult.error || 'Empty response'}`, debug);
  }

  const actualCost = editResult.usage
    ? calculateActualTextCost(editResult.usage.inputTokens, editResult.usage.outputTokens, textModel)
    : editEstimate.estimatedCost;
  const editCost = {
    estimated: editEstimate.estimatedCost,
    actual: actualCost,
    inputTokens: editResult.usage?.inputTokens || editEstimate.inputTokens,
    outputTokens: editResult.usage?.outputTokens || editEstimate.outputTokens,
  };

  const cleanedContent = stripLeadingWrapper(editResult.text);

  await updateStoryEdit(storyId, cleanedContent, editCost);

  await saveCostRecord({
    id: generateCostId(),
    timestamp: Date.now(),
    projectId: task.projectId,
    simulationRunId: task.simulationRunId,
    entityId: task.entityId,
    entityName: task.entityName,
    entityKind: task.entityKind,
    storyId,
    type: 'storyRevision',
    model: textModel,
    estimatedCost: editCost.estimated,
    actualCost: editCost.actual,
    inputTokens: editCost.inputTokens,
    outputTokens: editCost.outputTokens,
  });

  if (isAborted()) {
    return failEdit('Task aborted', debug);
  }

  const updatedStoryRecord = {
    ...storyRecord,
    assembledContent: cleanedContent,
  };

  const validationResult = await executeValidateStep(
    task,
    updatedStoryRecord,
    config,
    llmClient,
    isAborted,
    textModel
  );

  if (!validationResult.success) {
    return {
      success: false,
      error: validationResult.error || 'Validation failed after edit',
      debug: validationResult.debug || debug,
    };
  }

  return {
    success: true,
    result: validationResult.result,
    debug: validationResult.debug || debug,
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
  if (!storyRecord) {
    return { success: false, error: 'Story record missing for validation' };
  }

  const storyId = storyRecord.storyId;
  const failValidate = async (message: string, debug?: NetworkDebugInfo): Promise<TaskResult> => {
    await markStoryFailure(storyId, 'validate', message);
    return { success: false, error: message, debug };
  };

  if (!storyRecord.plan || !storyRecord.assembledContent) {
    return failValidate('Chronicle has no assembled content to validate');
  }

  const context = deserializeChronicleContext(task.chronicleContext!);
  const plan = storyRecord.plan;
  const narrativeStyle = task.chronicleContext!.narrativeStyle;
  if (!narrativeStyle) {
    return failValidate('Narrative style is required for validation');
  }
  if (plan.format !== narrativeStyle.format) {
    return failValidate('Narrative style format does not match plan format');
  }
  const pipeline = getPipeline(plan.format);
  const focusedContext = applyFocusToContext(context, plan.focus);

  console.log('[Worker] Step 4: Validating cohesion...');

  const validationPrompt = pipeline.buildValidationPrompt(
    storyRecord.assembledContent,
    plan,
    focusedContext,
    narrativeStyle
  );
  const validationEstimate = estimateTextCost(validationPrompt, 'description', textModel);

  const validationResult = await llmClient.complete({
    systemPrompt: pipeline.getSystemPrompt('validate', narrativeStyle, plan),
    prompt: validationPrompt,
    maxTokens: 2048,
    temperature: 0.3,
  });
  const debug = validationResult.debug;

  if (isAborted()) {
    return failValidate('Task aborted', debug);
  }

  const validationCost = {
    estimated: validationEstimate.estimatedCost,
    actual: validationResult.usage
      ? calculateActualTextCost(validationResult.usage.inputTokens, validationResult.usage.outputTokens, textModel)
      : validationEstimate.estimatedCost,
    inputTokens: validationResult.usage?.inputTokens || validationEstimate.inputTokens,
    outputTokens: validationResult.usage?.outputTokens || validationEstimate.outputTokens,
  };

  if (validationResult.error || !validationResult.text) {
    return failValidate(`Validation failed: ${validationResult.error || 'Empty response'}`, debug);
  }

  let cohesionReport: CohesionReport;
  try {
    cohesionReport = pipeline.parseValidationResponse(validationResult.text, plan);
    cohesionReport.generatedAt = Date.now();
    cohesionReport.model = textModel;
  } catch (err) {
    return failValidate(`Failed to parse validation response: ${err}`, debug);
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
    debug,
  };
}

 

// Re-export types
export type { WorkerTask, WorkerResult, EnrichmentResult, EnrichmentType };
