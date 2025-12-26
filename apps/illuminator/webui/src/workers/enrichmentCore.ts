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
  updateStoryAssembly,
  updateStoryCohesion,
  updateStoryEdit,
  updateStorySummary,
  updateStoryImageRefs,
  updateStoryProseBlend,
  updateStoryFailure,
  generateStoryId,
  getStory,
} from '../lib/chronicleStorage';
import type {
  ChronicleGenerationContext,
  ChroniclePlan,
  EntityContext,
  CohesionReport,
  ChronicleImageRefs,
  ChronicleImageRef,
  EntityImageRef,
  PromptRequestRef,
  ChronicleImageSize,
} from '../lib/chronicleTypes';
import { saveCostRecord, generateCostId, type CostType } from '../lib/costStorage';
import {
  selectEntitiesV2,
  buildV2Prompt,
  getMaxTokensFromStyle,
  getV2SystemPrompt,
  DEFAULT_V2_CONFIG,
} from '../lib/chronicle/v2';
import type {
  NarrativeStyle,
  StoryNarrativeStyle,
  DocumentNarrativeStyle,
} from '@canonry/world-schema';

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

function extractFirstJsonObject(text: string): string | null {
  let inString = false;
  let escaped = false;
  let depth = 0;
  let start = -1;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === '{') {
      if (depth === 0) {
        start = i;
      }
      depth += 1;
      continue;
    }

    if (char === '}') {
      depth -= 1;
      if (depth === 0 && start !== -1) {
        return text.slice(start, i + 1);
      }
    }
  }

  return null;
}

function parseDescriptionPayload(text: string): {
  summary: string;
  description: string;
  aliases: string[];
} {
  const cleaned = stripLeadingWrapper(text);
  const candidate = extractFirstJsonObject(cleaned) || cleaned;
  let parsed: unknown;
  try {
    parsed = JSON.parse(candidate);
  } catch (err) {
    throw new Error('Failed to parse description JSON');
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Description payload must be a JSON object');
  }

  const obj = parsed as Record<string, unknown>;
  const summary = typeof obj.summary === 'string' ? obj.summary.trim() : '';
  const description = typeof obj.description === 'string' ? obj.description.trim() : '';
  const aliases = Array.isArray(obj.aliases)
    ? obj.aliases
      .filter((alias): alias is string => typeof alias === 'string')
      .map((alias) => alias.trim())
      .filter(Boolean)
    : [];

  if (!summary || !description) {
    throw new Error('Description payload requires summary and description');
  }

  return { summary, description, aliases };
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
Provide a summary that is a compressed, faithful version of the description. The summary must not contradict or introduce new facts.
You must respond with JSON only. Do not include markdown, code fences, or extra text.

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
      model: textModel,
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
    // Chronicle image fields
    imageType: task.imageType,
    storyId: task.storyId,
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
    model: textModel,
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

  let payload;
  try {
    payload = parseDescriptionPayload(result.text || '');
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to parse description payload',
      debug,
    };
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
      summary: payload.summary,
      description: payload.description,
      aliases: payload.aliases,
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
    summary: e.summary,
    description: e.description,
    aliases: e.aliases,
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
      summary: ctx.entity.summary,
      description: ctx.entity.description,
      aliases: ctx.entity.aliases,
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

  const step = task.chronicleStep || 'generate_v2';
  const textModel = config.chronicleModel || config.textModel || 'claude-sonnet-4-20250514';
  console.log(`[Worker] Entity story step=${step} for entity=${task.entityId}, model=${textModel}`);

  // V2 single-shot generation - primary generation path
  if (step === 'generate_v2') {
    if (!task.chronicleContext) {
      return { success: false, error: 'Chronicle context required for generate_v2 step' };
    }
    return executeV2GenerationStep(task, config, llmClient, isAborted, textModel);
  }

  // For post-generation steps, we need the existing story
  if (!task.storyId) {
    return { success: false, error: `storyId required for ${step} step` };
  }

  const storyRecord = await getStory(task.storyId);
  if (!storyRecord) {
    return { success: false, error: `Story ${task.storyId} not found` };
  }

  if (step === 'edit') {
    if (!task.chronicleContext) {
      return { success: false, error: 'Chronicle context required for edit step' };
    }
    return executeEditStep(task, storyRecord, config, llmClient, isAborted, textModel);
  }

  if (step === 'summary') {
    if (!task.chronicleContext) {
      return { success: false, error: 'Chronicle context required for summary step' };
    }
    return executeSummaryStep(task, storyRecord, config, llmClient, isAborted, textModel);
  }

  if (step === 'image_refs') {
    if (!task.chronicleContext) {
      return { success: false, error: 'Chronicle context required for image refs step' };
    }
    return executeImageRefsStep(task, storyRecord, config, llmClient, isAborted, textModel);
  }

  if (step === 'prose_blend') {
    if (!task.chronicleContext) {
      return { success: false, error: 'Chronicle context required for prose blend step' };
    }
    return executeProseBlendStep(task, storyRecord, config, llmClient, isAborted, textModel);
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
 * V2 Single-Shot Generation
 * One LLM call to generate the complete narrative, with deterministic post-processing.
 */
async function executeV2GenerationStep(
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
    return { success: false, error: 'Narrative style is required for V2 generation' };
  }

  const storyId = generateStoryId(task.entityId);
  console.log(`[Worker] V2 generation for entity=${task.entityId}, style="${narrativeStyle.name}"`);

  // Simple entity/event selection from 2-hop neighborhood
  const selection = selectEntitiesV2(context, DEFAULT_V2_CONFIG);
  console.log(`[Worker] V2 selected ${selection.entities.length} entities, ${selection.events.length} events, ${selection.relationships.length} relationships`);

  // Build single-shot prompt
  const prompt = buildV2Prompt(context, narrativeStyle, selection);
  const maxTokens = getMaxTokensFromStyle(narrativeStyle);
  const systemPrompt = getV2SystemPrompt(narrativeStyle);
  const estimate = estimateTextCost(prompt, 'description', textModel);

  console.log(`[Worker] V2 prompt length: ${prompt.length} chars, maxTokens: ${maxTokens}`);

  // Single LLM call
  const result = await llmClient.complete({
    systemPrompt,
    prompt,
    model: textModel,
    maxTokens,
    temperature: 0.7,
  });

  if (isAborted()) {
    return { success: false, error: 'Task aborted', debug: result.debug };
  }

  if (result.error || !result.text) {
    return {
      success: false,
      error: `V2 generation failed: ${result.error || 'No text returned'}`,
      debug: result.debug,
    };
  }

  // Note: Wikilinks are NOT applied here - they are applied once at acceptance time
  // (in useChronicleGeneration.ts acceptStory) to avoid double-bracketing issues.

  // Calculate cost
  const cost = {
    estimated: estimate.estimatedCost,
    actual: result.usage
      ? calculateActualTextCost(result.usage.inputTokens, result.usage.outputTokens, textModel)
      : estimate.estimatedCost,
    inputTokens: result.usage?.inputTokens || estimate.inputTokens,
    outputTokens: result.usage?.outputTokens || estimate.outputTokens,
  };

  // Save story directly to assembled state (single-shot generation)
  try {
    const focus = context.focus;
    await createStory(storyId, {
      projectId: task.projectId,
      simulationRunId: task.simulationRunId,
      model: textModel,
      narrativeStyleId: narrativeStyle.id,
      roleAssignments: focus?.roleAssignments || [],
      selectedEntityIds: focus?.selectedEntityIds || [],
      selectedEventIds: focus?.selectedEventIds || [],
      selectedRelationshipIds: focus?.selectedRelationshipIds || [],
      entrypointId: task.entityId,
      assembledContent: result.text,
      selectionSummary: {
        entityCount: selection.entities.length,
        eventCount: selection.events.length,
        relationshipCount: selection.relationships.length,
      },
      cost,
    });
    console.log(`[Worker] Story saved: ${storyId}`);
  } catch (err) {
    return { success: false, error: `Failed to save story: ${err}` };
  }

  // Record cost
  await saveCostRecord({
    id: generateCostId(),
    timestamp: Date.now(),
    projectId: task.projectId,
    simulationRunId: task.simulationRunId,
    entityId: task.entityId,
    entityName: task.entityName,
    entityKind: task.entityKind,
    storyId,
    type: 'storyV2',
    model: textModel,
    estimatedCost: cost.estimated,
    actualCost: cost.actual,
    inputTokens: cost.inputTokens,
    outputTokens: cost.outputTokens,
  });

  return {
    success: true,
    result: {
      storyId,
      generatedAt: Date.now(),
      model: textModel,
      estimatedCost: cost.estimated,
      actualCost: cost.actual,
      inputTokens: cost.inputTokens,
      outputTokens: cost.outputTokens,
    },
    debug: result.debug,
  };
}

/**
 * Edit chronicle based on validation suggestions, then re-validate
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

  if (!storyRecord.assembledContent) {
    return failEdit('Chronicle has no assembled content to edit');
  }
  if (!storyRecord.cohesionReport) {
    return failEdit('Chronicle has no validation report to edit against');
  }

  console.log('[Worker] Editing chronicle based on validation feedback...');

  // Build edit prompt from validation issues
  const issues = storyRecord.cohesionReport.issues || [];
  const issueList = issues
    .map((issue, i) => `${i + 1}. [${issue.severity}] ${issue.description}\n   Suggestion: ${issue.suggestion}`)
    .join('\n\n');

  const editPrompt = `Revise the chronicle below based on the validation feedback.

## Validation Issues
${issueList || 'No specific issues identified.'}

## Original Chronicle
${storyRecord.assembledContent}

## Instructions
1. Address each issue while preserving the overall narrative flow
2. Maintain entity names, facts, and relationships accurately
3. Return ONLY the revised chronicle text, no explanations`;

  const editEstimate = estimateTextCost(editPrompt, 'description', textModel);

  const editResult = await llmClient.complete({
    systemPrompt: 'You are a narrative editor. Revise the chronicle to address the validation feedback while maintaining quality and consistency.',
    prompt: editPrompt,
    model: textModel,
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
 * Build V2 validation prompt (simpler, no plan required)
 */
function buildV2ValidationPrompt(
  content: string,
  context: ChronicleGenerationContext,
  style: NarrativeStyle
): string {
  const isStory = style.format === 'story';
  const storyStyle = isStory ? (style as StoryNarrativeStyle) : null;
  const docStyle = !isStory ? (style as DocumentNarrativeStyle) : null;

  const wordCountTarget = isStory
    ? `${storyStyle!.pacing.totalWordCount.min}-${storyStyle!.pacing.totalWordCount.max}`
    : `${docStyle!.documentConfig.wordCount.min}-${docStyle!.documentConfig.wordCount.max}`;

  const sections: string[] = [];

  // Style expectations
  sections.push(`# Style: ${style.name}
Format: ${style.format}
Target word count: ${wordCountTarget}`);

  if (isStory && storyStyle!.plotStructure) {
    sections.push(`Plot structure: ${storyStyle!.plotStructure.type}`);
  }

  if (isStory && storyStyle!.proseDirectives) {
    const pd = storyStyle!.proseDirectives;
    sections.push(`Tone: ${pd.toneKeywords?.join(', ') || 'not specified'}
Dialogue style: ${pd.dialogueStyle || 'not specified'}
${pd.avoid?.length ? `Avoid: ${pd.avoid.join(', ')}` : ''}`);
  }

  if (!isStory && docStyle!.documentConfig) {
    const dc = docStyle!.documentConfig;
    sections.push(`Document type: ${dc.documentType}
Voice: ${dc.voice || 'not specified'}
${dc.toneKeywords?.length ? `Tone: ${dc.toneKeywords.join(', ')}` : ''}
${dc.avoid?.length ? `Avoid: ${dc.avoid.join(', ')}` : ''}`);
  }

  // Available entities
  sections.push(`# Entities Provided
${context.entities.map((e) => `- ${e.name} (${e.kind}${e.subtype ? `/${e.subtype}` : ''}, ${e.status})`).join('\n')}`);

  // Content
  sections.push(`# Chronicle Content
${content}`);

  // Task
  sections.push(`# Validation Task

Evaluate this chronicle and output a JSON cohesion report.

Check the following:

1. **Word Count**: Is the content within the target range (${wordCountTarget} words)?

2. **Style Adherence**: Does the narrative match the expected tone, format, and voice?

3. **Entity Usage**: Are entities from the provided list used appropriately? Are entity kinds (person, faction, location, etc.) treated correctly (e.g., factions are groups, not individual characters)?

4. **Narrative Coherence**: Does the story flow logically? Is there a clear beginning, middle, and end?

5. **Factual Consistency**: Are entity facts (names, relationships, status) consistent throughout?

Output this exact JSON structure:

\`\`\`json
{
  "overallScore": 85,
  "checks": {
    "wordCount": { "pass": true, "notes": "Approximately 2400 words, within target range" },
    "styleAdherence": { "pass": true, "notes": "Matches the expected tone and format" },
    "entityUsage": { "pass": true, "notes": "Entities used appropriately" },
    "narrativeCoherence": { "pass": true, "notes": "Clear narrative arc" },
    "factualConsistency": { "pass": true, "notes": "Facts are consistent" }
  },
  "issues": [
    {
      "severity": "minor",
      "checkType": "entityUsage",
      "description": "Faction name interpreted as character name",
      "suggestion": "Clarify that this is a group, not an individual"
    }
  ]
}
\`\`\`

Score guidelines:
- 90-100: Excellent, minimal issues
- 75-89: Good, minor issues only
- 60-74: Acceptable, some issues to address
- Below 60: Needs significant revision

Output ONLY the JSON, no other text.`);

  return sections.join('\n\n');
}

/**
 * Parse V2 validation response into CohesionReport format
 */
function parseV2ValidationResponse(text: string): CohesionReport {
  const cleaned = stripLeadingWrapper(text);
  const jsonStr = extractFirstJsonObject(cleaned);

  if (!jsonStr) {
    throw new Error('No JSON object found in V2 validation response');
  }

  const parsed = JSON.parse(jsonStr);

  // Map V2 checks to V1 cohesion report format
  const checks = parsed.checks || {};
  return {
    overallScore: parsed.overallScore || 0,
    checks: {
      plotStructure: checks.narrativeCoherence || { pass: true, notes: 'N/A for V2' },
      entityConsistency: checks.entityUsage || { pass: true, notes: 'N/A for V2' },
      sectionGoals: [], // V2 doesn't have sections
      resolution: checks.styleAdherence || { pass: true, notes: 'N/A for V2' },
      factualAccuracy: checks.factualConsistency || { pass: true, notes: 'N/A for V2' },
      themeExpression: checks.wordCount || { pass: true, notes: 'N/A for V2' },
    },
    issues: (parsed.issues || []).map((issue: { severity?: string; checkType?: string; description?: string; suggestion?: string }) => ({
      severity: issue.severity || 'minor',
      checkType: issue.checkType || 'unknown',
      description: issue.description || '',
      suggestion: issue.suggestion || '',
    })),
  };
}

/**
 * Validate cohesion
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

  if (!storyRecord.assembledContent) {
    return failValidate('Chronicle has no assembled content to validate');
  }

  const context = deserializeChronicleContext(task.chronicleContext!);
  const narrativeStyle = task.chronicleContext!.narrativeStyle;
  if (!narrativeStyle) {
    return failValidate('Narrative style is required for validation');
  }

  console.log('[Worker] Validating cohesion...');
  const validationPrompt = buildV2ValidationPrompt(storyRecord.assembledContent, context, narrativeStyle);
  const systemPrompt = 'You are a narrative quality evaluator. Analyze the chronicle and provide a structured assessment.';

  const validationEstimate = estimateTextCost(validationPrompt, 'description', textModel);

  const validationResult = await llmClient.complete({
    systemPrompt,
    prompt: validationPrompt,
    model: textModel,
    maxTokens: 4096,
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
    cohesionReport = parseV2ValidationResponse(validationResult.text);
    cohesionReport.generatedAt = Date.now();
    cohesionReport.model = textModel;
  } catch (err) {
    return failValidate(`Failed to parse validation response: ${err}`, debug);
  }

  await updateStoryCohesion(storyId, cohesionReport, validationCost);
  console.log('[Worker] Validation complete');

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

function buildSummaryPrompt(content: string, plan?: ChroniclePlan): string {
  const titleLine = plan?.title ? `Title: ${plan.title}` : '';
  const formatLine = plan?.format ? `Format: ${plan.format}` : '';
  const contextLines = [titleLine, formatLine].filter(Boolean).join('\n');

  return `Summarize the chronicle below in 2-4 sentences for a preview field.
Rules:
- Keep it factual and faithful to the chronicle.
- Mention key entities and the main outcome.
- Do not add new facts.
Return ONLY the summary text.

${contextLines ? `${contextLines}\n\n` : ''}Chronicle:
${content}`;
}

function formatImageRefEntities(plan: ChroniclePlan | undefined, context: ChronicleGenerationContext): string {
  const entityMap = new Map(context.entities.map((entity) => [entity.id, entity]));

  // For V2 stories (no plan), use all context entities
  // For V1 stories, use the selected entities from the plan
  let ids: string[];
  if (!plan) {
    // V2: use all entities from context
    ids = context.entities.map((e) => e.id);
  } else if (plan.focus?.selectedEntityIds?.length) {
    ids = plan.focus.selectedEntityIds;
  } else if (plan.entityRoles?.length) {
    ids = plan.entityRoles.map((role) => role.entityId);
  } else {
    ids = [];
  }

  const uniqueIds = Array.from(new Set(ids));
  if (uniqueIds.length === 0) return '(none)';

  return uniqueIds
    .map((id) => {
      const name = entityMap.get(id)?.name || id;
      return `- ${id}: ${name}`;
    })
    .join('\n');
}

/**
 * Extract section IDs and names from chronicle content
 */
function extractSectionInfo(content: string): Array<{ id: string; name: string }> {
  const sections: Array<{ id: string; name: string }> = [];
  const lines = content.split('\n');
  let sectionIndex = 0;

  for (const line of lines) {
    if (line.startsWith('## ')) {
      const name = line.replace('## ', '').trim();
      sections.push({
        id: `section-${sectionIndex}`,
        name,
      });
      sectionIndex++;
    }
  }

  // If no sections found, treat entire content as one section
  if (sections.length === 0) {
    sections.push({ id: 'section-0', name: 'Chronicle' });
  }

  return sections;
}

function buildImageRefsPrompt(
  content: string,
  plan: ChroniclePlan | undefined,
  context: ChronicleGenerationContext
): string {
  const entityList = formatImageRefEntities(plan, context);
  const sections = extractSectionInfo(content);
  const sectionList = sections.map(s => `- ${s.id}: "${s.name}"`).join('\n');

  return `You are adding image references to a chronicle. Your task is to identify optimal placement points for images that enhance the narrative.

## Available Entities (can reference their existing images)
${entityList}

## Chronicle Sections
${sectionList}

## Instructions
Analyze the chronicle and suggest 2-5 image placements. For each image:

1. **Entity References** - Use when an entity with an existing image is prominently featured:
   - Best for: Character introductions, key moments featuring specific entities
   - Anchor to specific descriptive text about that entity

2. **Prompt Requests** - Use for scenes, events, or concepts without existing images:
   - Best for: Battle scenes, landscapes, group gatherings, symbolic moments
   - Provide a vivid scene description that captures the moment

## Output Format
Return a JSON object with this exact structure:
{
  "imageRefs": [
    {
      "type": "entity_ref",
      "entityId": "<entity id from the list above>",
      "sectionId": "<section id from the list above>",
      "anchorText": "<exact 5-15 word phrase from the chronicle text to anchor near>",
      "size": "small|medium|large|full-width",
      "caption": "<optional caption for the image>"
    },
    {
      "type": "prompt_request",
      "sceneDescription": "<vivid 1-2 sentence description of the scene to generate>",
      "sectionId": "<section id from the list above>",
      "anchorText": "<exact 5-15 word phrase from the chronicle text to anchor near>",
      "size": "small|medium|large|full-width",
      "caption": "<optional caption for the image>"
    }
  ]
}

## Size Guidelines
- small: 150px thumbnail in margin, for supplementary images
- medium: 300px inline, standard size for character portraits
- large: 450px prominent, for key scenes
- full-width: 100% width, for dramatic establishing shots and major events

## Important Rules
- anchorText MUST be an exact phrase that appears in the chronicle text (5-15 words)
- entityId MUST match an ID from the Available Entities list
- sectionId MUST match an ID from the Chronicle Sections list
- Return valid JSON only, no markdown code blocks

## Chronicle Content
${content}`;
}

/**
 * Parse the LLM response for image refs into structured ChronicleImageRef array
 */
function parseImageRefsResponse(text: string): ChronicleImageRef[] {
  const cleaned = stripLeadingWrapper(text);
  const jsonStr = extractFirstJsonObject(cleaned);

  if (!jsonStr) {
    throw new Error('No JSON object found in image refs response');
  }

  let parsed: { imageRefs?: unknown[] };
  try {
    parsed = JSON.parse(jsonStr);
  } catch (e) {
    throw new Error(`Failed to parse image refs JSON: ${e instanceof Error ? e.message : 'Unknown error'}`);
  }

  if (!parsed.imageRefs || !Array.isArray(parsed.imageRefs)) {
    throw new Error('imageRefs array not found in response');
  }

  const validSizes: ChronicleImageSize[] = ['small', 'medium', 'large', 'full-width'];

  return parsed.imageRefs.map((ref: Record<string, unknown>, index: number) => {
    const refId = `imgref_${Date.now()}_${index}`;
    const sectionId = typeof ref.sectionId === 'string' ? ref.sectionId : `section-0`;
    const anchorText = typeof ref.anchorText === 'string' ? ref.anchorText : '';
    const rawSize = typeof ref.size === 'string' ? ref.size : 'medium';
    const size: ChronicleImageSize = validSizes.includes(rawSize as ChronicleImageSize)
      ? (rawSize as ChronicleImageSize)
      : 'medium';
    const caption = typeof ref.caption === 'string' ? ref.caption : undefined;

    if (ref.type === 'entity_ref') {
      const entityId = typeof ref.entityId === 'string' ? ref.entityId : '';
      if (!entityId) {
        throw new Error(`entity_ref at index ${index} missing entityId`);
      }
      return {
        refId,
        type: 'entity_ref',
        entityId,
        sectionId,
        anchorText,
        size,
        caption,
      } as EntityImageRef;
    } else if (ref.type === 'prompt_request') {
      const sceneDescription = typeof ref.sceneDescription === 'string' ? ref.sceneDescription : '';
      if (!sceneDescription) {
        throw new Error(`prompt_request at index ${index} missing sceneDescription`);
      }
      return {
        refId,
        type: 'prompt_request',
        sceneDescription,
        sectionId,
        anchorText,
        size,
        caption,
        status: 'pending',
      } as PromptRequestRef;
    } else {
      throw new Error(`Unknown image ref type at index ${index}: ${ref.type}`);
    }
  });
}

function buildProseBlendPrompt(content: string, plan?: ChroniclePlan): string {
  const titleLine = plan?.title ? `Title: ${plan.title}` : '';
  const formatLine = plan?.format ? `Format: ${plan.format}` : '';
  const contextLines = [titleLine, formatLine].filter(Boolean).join('\n');

  return `Rewrite the chronicle into a more cohesive, freeform narrative while keeping ALL relevant details.
Rules:
- Preserve names, dates, facts, and outcomes.
- Avoid dropping any information.
- Smooth transitions and remove outline-like phrasing.
- If the text is already a discrete document (letter, decree, log), keep that form and polish the prose.
Return ONLY the rewritten chronicle content.

${contextLines ? `${contextLines}\n\n` : ''}Chronicle:
${content}`;
}

async function executeSummaryStep(
  task: WorkerTask,
  storyRecord: Awaited<ReturnType<typeof getStory>>,
  config: WorkerConfig,
  llmClient: LLMClient,
  isAborted: () => boolean,
  textModel: string
): Promise<TaskResult> {
  if (!storyRecord) {
    return { success: false, error: 'Story record missing for summary' };
  }
  if (!storyRecord.assembledContent) {
    return { success: false, error: 'Chronicle has no assembled content to summarize' };
  }

  const storyId = storyRecord.storyId;
  const summaryPrompt = buildSummaryPrompt(storyRecord.assembledContent, storyRecord.plan);
  const summaryEstimate = estimateTextCost(summaryPrompt, 'description', textModel);

  const summaryResult = await llmClient.complete({
    systemPrompt: 'You are a careful editor who writes concise, faithful summaries.',
    prompt: summaryPrompt,
    model: textModel,
    maxTokens: 512,
    temperature: 0.3,
  });
  const debug = summaryResult.debug;

  if (isAborted()) {
    return { success: false, error: 'Task aborted', debug };
  }

  if (summaryResult.error || !summaryResult.text) {
    return { success: false, error: `Summary failed: ${summaryResult.error || 'Empty response'}`, debug };
  }

  const summaryText = stripLeadingWrapper(summaryResult.text).replace(/\s+/g, ' ').trim();
  if (!summaryText) {
    return { success: false, error: 'Summary response empty', debug };
  }

  const summaryCost = {
    estimated: summaryEstimate.estimatedCost,
    actual: summaryResult.usage
      ? calculateActualTextCost(summaryResult.usage.inputTokens, summaryResult.usage.outputTokens, textModel)
      : summaryEstimate.estimatedCost,
    inputTokens: summaryResult.usage?.inputTokens || summaryEstimate.inputTokens,
    outputTokens: summaryResult.usage?.outputTokens || summaryEstimate.outputTokens,
  };

  await updateStorySummary(storyId, summaryText, summaryCost, textModel);

  await saveCostRecord({
    id: generateCostId(),
    timestamp: Date.now(),
    projectId: task.projectId,
    simulationRunId: task.simulationRunId,
    entityId: task.entityId,
    entityName: task.entityName,
    entityKind: task.entityKind,
    storyId,
    type: 'storySummary' as CostType,
    model: textModel,
    estimatedCost: summaryCost.estimated,
    actualCost: summaryCost.actual,
    inputTokens: summaryCost.inputTokens,
    outputTokens: summaryCost.outputTokens,
  });

  return {
    success: true,
    result: {
      storyId,
      generatedAt: Date.now(),
      model: textModel,
      estimatedCost: summaryCost.estimated,
      actualCost: summaryCost.actual,
      inputTokens: summaryCost.inputTokens,
      outputTokens: summaryCost.outputTokens,
    },
    debug,
  };
}

async function executeImageRefsStep(
  task: WorkerTask,
  storyRecord: Awaited<ReturnType<typeof getStory>>,
  config: WorkerConfig,
  llmClient: LLMClient,
  isAborted: () => boolean,
  textModel: string
): Promise<TaskResult> {
  if (!storyRecord) {
    return { success: false, error: 'Story record missing for image refs' };
  }
  if (!storyRecord.assembledContent) {
    return { success: false, error: 'Chronicle has no assembled content for image refs' };
  }

  const storyId = storyRecord.storyId;
  const context = deserializeChronicleContext(task.chronicleContext!);
  const imageRefsPrompt = buildImageRefsPrompt(storyRecord.assembledContent, storyRecord.plan, context);
  const imageRefsEstimate = estimateTextCost(imageRefsPrompt, 'description', textModel);

  const imageRefsResult = await llmClient.complete({
    systemPrompt: 'You are planning draft image placements for a chronicle.',
    prompt: imageRefsPrompt,
    model: textModel,
    maxTokens: 2048,
    temperature: 0.4,
  });
  const debug = imageRefsResult.debug;

  if (isAborted()) {
    return { success: false, error: 'Task aborted', debug };
  }

  if (imageRefsResult.error || !imageRefsResult.text) {
    return { success: false, error: `Image refs failed: ${imageRefsResult.error || 'Empty response'}`, debug };
  }

  // Parse the response into structured image refs
  let parsedRefs: ChronicleImageRef[];
  try {
    parsedRefs = parseImageRefsResponse(imageRefsResult.text);
  } catch (e) {
    return {
      success: false,
      error: `Failed to parse image refs: ${e instanceof Error ? e.message : 'Unknown error'}`,
      debug,
    };
  }

  if (parsedRefs.length === 0) {
    return { success: false, error: 'No image refs found in response', debug };
  }

  // Create structured ChronicleImageRefs object
  const imageRefs: ChronicleImageRefs = {
    refs: parsedRefs,
    generatedAt: Date.now(),
    model: textModel,
  };

  const imageRefsCost = {
    estimated: imageRefsEstimate.estimatedCost,
    actual: imageRefsResult.usage
      ? calculateActualTextCost(imageRefsResult.usage.inputTokens, imageRefsResult.usage.outputTokens, textModel)
      : imageRefsEstimate.estimatedCost,
    inputTokens: imageRefsResult.usage?.inputTokens || imageRefsEstimate.inputTokens,
    outputTokens: imageRefsResult.usage?.outputTokens || imageRefsEstimate.outputTokens,
  };

  await updateStoryImageRefs(storyId, imageRefs, imageRefsCost, textModel);

  await saveCostRecord({
    id: generateCostId(),
    timestamp: Date.now(),
    projectId: task.projectId,
    simulationRunId: task.simulationRunId,
    entityId: task.entityId,
    entityName: task.entityName,
    entityKind: task.entityKind,
    storyId,
    type: 'storyImageRefs' as CostType,
    model: textModel,
    estimatedCost: imageRefsCost.estimated,
    actualCost: imageRefsCost.actual,
    inputTokens: imageRefsCost.inputTokens,
    outputTokens: imageRefsCost.outputTokens,
  });

  return {
    success: true,
    result: {
      storyId,
      generatedAt: Date.now(),
      model: textModel,
      estimatedCost: imageRefsCost.estimated,
      actualCost: imageRefsCost.actual,
      inputTokens: imageRefsCost.inputTokens,
      outputTokens: imageRefsCost.outputTokens,
    },
    debug,
  };
}

async function executeProseBlendStep(
  task: WorkerTask,
  storyRecord: Awaited<ReturnType<typeof getStory>>,
  config: WorkerConfig,
  llmClient: LLMClient,
  isAborted: () => boolean,
  textModel: string
): Promise<TaskResult> {
  if (!storyRecord) {
    return { success: false, error: 'Story record missing for prose blending' };
  }
  if (!storyRecord.assembledContent) {
    return { success: false, error: 'Chronicle has no assembled content to blend' };
  }

  const storyId = storyRecord.storyId;
  const blendPrompt = buildProseBlendPrompt(storyRecord.assembledContent, storyRecord.plan);
  const blendEstimate = estimateTextCost(blendPrompt, 'description', textModel);

  const blendResult = await llmClient.complete({
    systemPrompt: 'You are a narrative editor who smooths prose without losing details.',
    prompt: blendPrompt,
    model: textModel,
    maxTokens: 8192,
    temperature: 0.4,
  });
  const debug = blendResult.debug;

  if (isAborted()) {
    return { success: false, error: 'Task aborted', debug };
  }

  if (blendResult.error || !blendResult.text) {
    return { success: false, error: `Prose blend failed: ${blendResult.error || 'Empty response'}`, debug };
  }

  const blendedContent = stripLeadingWrapper(blendResult.text).trim();
  if (!blendedContent) {
    return { success: false, error: 'Prose blend response empty', debug };
  }

  const blendCost = {
    estimated: blendEstimate.estimatedCost,
    actual: blendResult.usage
      ? calculateActualTextCost(blendResult.usage.inputTokens, blendResult.usage.outputTokens, textModel)
      : blendEstimate.estimatedCost,
    inputTokens: blendResult.usage?.inputTokens || blendEstimate.inputTokens,
    outputTokens: blendResult.usage?.outputTokens || blendEstimate.outputTokens,
  };

  await updateStoryProseBlend(storyId, blendedContent, blendCost, textModel);

  await saveCostRecord({
    id: generateCostId(),
    timestamp: Date.now(),
    projectId: task.projectId,
    simulationRunId: task.simulationRunId,
    entityId: task.entityId,
    entityName: task.entityName,
    entityKind: task.entityKind,
    storyId,
    type: 'storyProseBlend' as CostType,
    model: textModel,
    estimatedCost: blendCost.estimated,
    actualCost: blendCost.actual,
    inputTokens: blendCost.inputTokens,
    outputTokens: blendCost.outputTokens,
  });

  return {
    success: true,
    result: {
      storyId,
      generatedAt: Date.now(),
      model: textModel,
      estimatedCost: blendCost.estimated,
      actualCost: blendCost.actual,
      inputTokens: blendCost.inputTokens,
      outputTokens: blendCost.outputTokens,
    },
    debug,
  };
}

 

// Re-export types
export type { WorkerTask, WorkerResult, EnrichmentResult, EnrichmentType };
