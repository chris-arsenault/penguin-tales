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
  DescriptionChainDebug,
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
  getTraitGuidance,
  registerUsedTraits,
  incrementPaletteUsage,
  updatePaletteItems,
  type TraitGuidance,
} from '../lib/traitRegistry';
import {
  createChronicle,
  updateChronicleAssembly,
  updateChronicleCohesion,
  updateChronicleEdit,
  updateChronicleSummary,
  updateChronicleImageRefs,
  updateChronicleFailure,
  getChronicle,
} from '../lib/chronicleStorage';
import type {
  ChronicleGenerationContext,
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
import type { LLMCallType, ResolvedLLMCallConfig } from '../lib/llmCallTypes';

// ============================================================================
// Types
// ============================================================================

/**
 * Resolved LLM call settings - model and thinking budget per call type.
 * All values are resolved (no undefined) - ready to use directly.
 */
export type ResolvedLLMCallSettings = Record<LLMCallType, ResolvedLLMCallConfig>;

export interface WorkerConfig {
  anthropicApiKey: string;
  openaiApiKey: string;
  imageModel: string;
  imageSize: string;
  imageQuality: string;
  numWorkers?: number;
  useClaudeForImagePrompt?: boolean;
  claudeImagePromptTemplate?: string;

  // Per-call LLM configuration (model + thinking budget)
  llmCallSettings: ResolvedLLMCallSettings;
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

  const fenced = result.match(/```(?:markdown|md|json)?\s*([\s\S]*?)```/);
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

async function markChronicleFailure(
  chronicleId: string,
  step: ChronicleStep,
  error: string
): Promise<void> {
  try {
    await updateChronicleFailure(chronicleId, step, error);
  } catch (err) {
    console.error('[Worker] Failed to record chronicle failure:', err);
  }
}

// ============================================================================
// Chain Prompts: Narrative → Visual Thesis → Visual Traits
// ============================================================================

/**
 * Humanize relationship strength for more natural prompt text
 */
export function humanizeStrength(strength: number | undefined): string {
  if (strength === undefined) return 'moderate';
  if (strength >= 0.7) return 'strong';
  if (strength >= 0.4) return 'moderate';
  return 'weak';
}

/**
 * Humanize prominence level for natural prompt text
 */
export function humanizeProminence(prominence: string): string {
  switch (prominence) {
    case 'mythic': return 'legendary, world-shaping';
    case 'renowned': return 'widely famous';
    case 'recognized': return 'notable within their sphere';
    case 'marginal': return 'locally known';
    case 'forgotten': return 'obscure, fading from memory';
    default: return prominence;
  }
}

/**
 * Step 1: Narrative prompt - rich description, summary, aliases
 * This is the creative writing step - prioritize personality, relationships, legacy
 */
export function buildNarrativePrompt(): string {
  return `You are a creative writer helping to build rich, consistent world lore.

READING THE DATA:
- Prominence indicates fame scope: "legendary" = world-shaping, "locally known" = personal-scale stories
- Status indicates current state: "active" = alive/operating, "historical" = no longer active (past tense appropriate)
- Relationships marked [strong] are defining connections; [moderate] are significant; [weak] are flavor
- Tags like "leader: true" indicate core identity traits - these should inform characterization
- Cultural Peers are other entities of same culture - use for grounding references
- Era indicates the time period most associated with this entity

Use [strong] relationships as anchors for the narrative. [weak] relationships are color, not plot.

WRITING FOCUS:
- Personality: How do they think, speak, carry themselves?
- Relationships: What ONE [strong] connection most shaped who they are?
- Legacy: How are they remembered? What mark did they leave?
- Specificity: Name actual places, people, events from their world

IMPORTANT: Do NOT write a tour of relationships. The description should be ABOUT the entity, not a catalog. Reference ONE relationship that truly defines them.

Bad: "She oversees the treasury of Place X, discovered the caverns of Place Y, and manages trade at Place Z."
Good: "Pisa carried herself with the measured deliberation of someone who had learned to read currents beneath ice. She rose to prominence under High-Beak Auditor Selka's tutelage, absorbing the auditor's obsession with precise accounting but tempering it with genuine concern for survival."

OUTPUT FORMAT:
Return JSON with keys: summary, description, aliases
- description: 3-5 sentences, rich with personality and world-grounding
- summary: 1-2 sentences, compressed and faithful to description
- aliases: array of alternate names or titles (can be empty)

Be vivid and specific. Let the entity's nature lead.`;
}

/**
 * Step 2: Visual thesis prompt - ONE sentence describing the dominant visual feature
 *
 * @param kindInstructions - REQUIRED per-kind domain instructions (VFX, environment, character)
 * @param visualAvoid - Optional project-specific elements to avoid
 */
export function buildVisualThesisPrompt(
  kindInstructions: string,
  visualAvoid?: string
): string {
  // Common rules at top
  let prompt = `RULES (non-negotiable):
- ONE sentence only - no compound sentences
- Describe WHAT you see, not WHY it exists
- No: "as if", "as though", "suggesting", "seeming"
- Shape only - no colors, textures, or surface details`;

  // Add project-specific avoid list
  if (visualAvoid) {
    prompt += `

AVOID: ${visualAvoid}`;
  }

  // Per-kind instructions (REQUIRED)
  prompt += `

${kindInstructions}`;

  // Common output format - plain text
  prompt += `

OUTPUT: One sentence describing the dominant visual feature. No JSON, no preamble.`;

  return prompt;
}

/**
 * Step 3: Visual traits prompt - 2-4 traits EXPANDING the visual identity
 *
 * @param kindInstructions - REQUIRED per-kind domain instructions
 * @param guidance - Optional palette guidance for diversity
 * @param subtype - Optional entity subtype for context
 */
export function buildVisualTraitsPrompt(
  kindInstructions: string,
  guidance?: TraitGuidance,
  subtype?: string
): string {
  // Per-kind instructions (REQUIRED)
  let prompt = kindInstructions;

  // Add subtype context if available
  if (subtype) {
    prompt += `\n\nSUBTYPE: ${subtype} (let this inform the visual style)`;
  }

  // Add palette guidance if available - REQUIRED directions, not optional
  if (guidance && guidance.assignedCategories.length > 0) {
    prompt += `

REQUIRED DIRECTIONS (you MUST address at least one):
${guidance.assignedCategories.map(p => `
### ${p.category}
${p.description}
Examples: ${p.examples.join(' · ')}`).join('\n')}

At least one of your traits MUST explore one of these assigned directions. The other traits can go beyond them if the description suggests something more distinctive.`;
  }

  // Common output format - one trait per line
  prompt += `

RULES:
- 2-4 traits only, each 3-8 words
- Each trait adds something NEW to the visual identity
${guidance && guidance.assignedCategories.length > 0 ? '- At least ONE trait must address an assigned direction above' : ''}

OUTPUT: 2-4 traits, one per line. No numbering, no JSON, no preamble.`;

  return prompt;
}

// Legacy combined prompt (kept for reference, but no longer used)
export function buildSystemPrompt(guidance?: TraitGuidance): string {
  let basePrompt = `You are a creative writer helping to build rich, consistent world lore.

Write descriptions that capture the ESSENCE of the entity - their personality, appearance, mannerisms, or defining traits. The description should stand on its own and make the entity feel real and distinctive.
Provide a summary that is a compressed, faithful version of the description. The summary must not contradict or introduce new facts.
You must respond with JSON only. Do not include markdown, code fences, or extra text.

IMPORTANT: Do NOT write a tour of the entity's relationships. The description should be ABOUT the entity, not a catalog of places they've been or people they know. You may reference ONE relationship that truly defines or shaped them, but only if it reveals something essential about who they are - not as a list item.

Bad example (relationship catalog): "She oversees the treasury of Place X, discovered the caverns of Place Y, and manages trade at Place Z."
Good example (entity-focused): "Her obsidian beak angles perpetually downward, as if still searching for miscounted coins. Every word she speaks has the weight of a merchant's scale."

VISUAL THESIS (critical - do this first):
The visual thesis is ONE sentence describing what makes this entity's SILHOUETTE distinctive.

SILHOUETTE TEST: If you filled this entity's outline solid black at 64px, would this feature still be visible and distinctive?

SILHOUETTE ELEMENTS (what changes the outline):
- Body shape: posture, proportions, mass distribution, asymmetry
- Structural gear: oversized weapons, wide hats, floating objects, massive armor pieces
- Profile extensions: wings, tails, mounted equipment, carried tools

Use relationships, tags, and era to CHOOSE what fits - but don't explain WHY in the thesis.

GOOD (changes silhouette):
- "Compact, hunched frame with shoulders drawn permanently forward"
- "Towering figure with an oversized ceremonial scythe slung across the back"
- "Wide-brimmed hat casting the entire upper body in shadow"
- "Three luminous orbs orbiting at waist height"
- "Lopsided mass with one shoulder dramatically higher than the other"

BAD (explains causation):
- "Hunched from decades of guarding" ← don't explain why
- "Carries a scythe inherited from his master" ← don't narrate history

BAD (surface detail, not silhouette):
- "Ritual scars across the chest" ← invisible at 64px
- "Ornate earrings" ← too small
- "Red ceremonial pants" ← color, not shape
- "Intricate tattoo patterns" ← surface decoration

BAD (too generic):
- "Impressive figure" ← no shape information
- "Distinguished-looking with wise eyes" ← eyes don't show in silhouette

VISUAL TRAITS: Generate 2-4 traits that SUPPORT the visual thesis. Every trait should reinforce or complement the thesis - they are supporting details, not independent features.`;

  // Add positive category assignment if available
  if (guidance && guidance.assignedCategories.length > 0) {
    basePrompt += `

VISUAL DIRECTION ASSIGNMENT:
This entity's visual identity should emphasize these thematic directions:
${guidance.assignedCategories.map(p => `
### ${p.category}
${p.description}
Examples: ${p.examples.join(' · ')}`).join('\n')}

Create traits that fit within these assigned directions while being unique to this specific entity. You may include 1 trait outside these directions if it truly defines the entity.`;
  } else {
    // Default guidance when no palette exists yet
    basePrompt += `

Consider these independent visual dimensions:
- FORM: Unusual shape, size, proportions, or silhouette
- SURFACE: Distinctive colors, patterns, textures, or markings
- CONDITION: Signs of age, wear, damage, enhancement, or transformation
- PRESENCE: How they move, stand, or affect space around them
- CULTURAL: Accessories, modifications, symbols, or status markers`;
  }

  basePrompt += `

DISTINCTIVENESS MANDATE:
- The visual thesis IS the 50-foot identifier - if it isn't, revise it
- Traits support the thesis; they don't compete with it
- Favor stylized exaggeration over anatomical realism
- Mix the grandiose with the grounded - not everything needs to be supernatural
- Avoid generic fantasy tropes (glowing eyes, mysterious aura) unless truly fitting

OUTPUT FORMAT:
Return JSON with keys: summary, description, aliases, visualThesis, visualTraits
- visualThesis: ONE sentence - the dominant visual signal (silhouette-testable)
- visualTraits: 2-4 supporting traits that reinforce the thesis

Be concise but vivid.`;

  return basePrompt;
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

  const { model, thinkingBudget } = getCallParams(config, 'image.promptFormatting');
  const imageModel = config.imageModel || 'dall-e-3';
  const formattingPrompt = config.claudeImagePromptTemplate
    .replace(/\{\{modelName\}\}/g, imageModel)
    .replace(/\{\{prompt\}\}/g, originalPrompt);

  const estimate = estimateTextCost(formattingPrompt, 'description', model);

  try {
    const result = await llmClient.complete({
      systemPrompt: 'You are a prompt engineer specializing in image generation. Respond only with the reformatted prompt, no explanations or preamble.',
      prompt: formattingPrompt,
      model,
      maxTokens: 1024,
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
        actualCost = calculateActualTextCost(inputTokens, outputTokens, model);
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
  // LLMClient model is set per-call; use a default for the base client
  const llmClient = new LLMClient({
    enabled: Boolean(config.anthropicApiKey),
    apiKey: config.anthropicApiKey,
    model: 'claude-sonnet-4-5-20250929', // Default; overridden per call
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

/**
 * Helper to get call config with optional thinking budget
 */
function getCallParams(config: WorkerConfig, callType: LLMCallType): { model: string; thinkingBudget?: number } {
  const callConfig = config.llmCallSettings[callType];
  return {
    model: callConfig.model,
    thinkingBudget: callConfig.thinkingBudget > 0 ? callConfig.thinkingBudget : undefined,
  };
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
}

/**
 * Helper to parse a single JSON field from LLM response
 */
function parseJsonField<T>(text: string, fieldName: string): T {
  const cleaned = stripLeadingWrapper(text);
  const candidate = extractFirstJsonObject(cleaned) || cleaned;
  const parsed = JSON.parse(candidate);
  if (!parsed || typeof parsed !== 'object') {
    throw new Error(`Expected JSON object with ${fieldName}`);
  }
  return parsed as T;
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

  // Track cumulative costs across all chain steps
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalActualCost = 0;

  // Track debug info for all steps
  const chainDebug: DescriptionChainDebug = {};

  // ============================================================================
  // Step 1: Narrative (description, summary, aliases)
  // ============================================================================
  console.log('[Worker] Description chain step 1: Narrative');

  const narrativeParams = getCallParams(config, 'description.narrative');

  // Strip output format instructions from task.prompt - each step has its own format
  const entityContext = task.prompt
    .replace(/OUTPUT FORMAT.*$/s, '')
    .replace(/FORMAT:\s*\n.*$/s, '')
    .trim();

  const narrativeResult = await llmClient.complete({
    systemPrompt: buildNarrativePrompt(),
    prompt: entityContext,
    model: narrativeParams.model,
    maxTokens: 1024,
    temperature: 0.7,
    thinkingBudget: narrativeParams.thinkingBudget,
  });
  chainDebug.narrative = narrativeResult.debug;

  if (isAborted()) {
    return { success: false, error: 'Task aborted', debug: narrativeResult.debug };
  }

  if (narrativeResult.error || !narrativeResult.text) {
    return { success: false, error: `Narrative step failed: ${narrativeResult.error || 'Empty response'}`, debug: narrativeResult.debug };
  }

  // Parse narrative response
  let narrativePayload: { summary: string; description: string; aliases: string[] };
  try {
    const parsed = parseJsonField<Record<string, unknown>>(narrativeResult.text, 'summary/description');
    narrativePayload = {
      summary: typeof parsed.summary === 'string' ? parsed.summary.trim() : '',
      description: typeof parsed.description === 'string' ? parsed.description.trim() : '',
      aliases: Array.isArray(parsed.aliases)
        ? parsed.aliases.filter((a): a is string => typeof a === 'string').map(a => a.trim()).filter(Boolean)
        : [],
    };
    if (!narrativePayload.summary || !narrativePayload.description) {
      throw new Error('Missing summary or description');
    }
  } catch (err) {
    return {
      success: false,
      error: `Narrative parse failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
      debug: narrativeResult.debug,
    };
  }

  // Accumulate costs
  if (narrativeResult.usage) {
    totalInputTokens += narrativeResult.usage.inputTokens;
    totalOutputTokens += narrativeResult.usage.outputTokens;
    totalActualCost += calculateActualTextCost(narrativeResult.usage.inputTokens, narrativeResult.usage.outputTokens, narrativeParams.model);
  }

  // ============================================================================
  // Step 2: Visual Thesis (given description)
  // ============================================================================
  console.log('[Worker] Description chain step 2: Visual Thesis');

  const thesisParams = getCallParams(config, 'description.visualThesis');

  // Build slimmed down visual context - remove noise that doesn't inform silhouette
  // Extract: entity basics and CULTURAL VISUAL IDENTITY (for visual thesis/traits)
  // NOTE: World description removed - it's noise for silhouette decisions. Culture identity has the visual signal.
  const visualIdentityMatch = entityContext.match(/CULTURAL VISUAL IDENTITY[^:]*:\n((?:- [A-Z_]+: .+\n?)+)/);
  const visualIdentityContext = visualIdentityMatch ? visualIdentityMatch[0].trim() : '';

  const visualContext = `Entity: ${task.entityName} (${task.entityKind})
Culture: ${task.entityCulture || 'unaffiliated'}${visualIdentityContext ? `\n\n${visualIdentityContext}` : ''}`;

  // Validate instructions are provided (from defaults or per-kind override)
  if (!task.visualThesisInstructions) {
    return {
      success: false,
      error: `Missing visualThesisInstructions for entity kind '${task.entityKind}'. Configure in entityGuidance.${task.entityKind}.visualThesis`,
    };
  }

  // Build thesis prompt - use per-kind framing if provided
  const thesisFraming = task.visualThesisFraming || '';
  const thesisPrompt = `${thesisFraming ? thesisFraming + '\n\n' : ''}${visualContext}

DESCRIPTION (extract visual elements from this):
${narrativePayload.description}

Generate the visual thesis.`;

  // Build system prompt with per-kind instructions
  const thesisSystemPrompt = buildVisualThesisPrompt(task.visualThesisInstructions, task.visualAvoid);

  const thesisResult = await llmClient.complete({
    systemPrompt: thesisSystemPrompt,
    prompt: thesisPrompt,
    model: thesisParams.model,
    maxTokens: thesisParams.thinkingBudget ? thesisParams.thinkingBudget + 256 : 256,
    temperature: 0.7,
    thinkingBudget: thesisParams.thinkingBudget,
  });
  chainDebug.thesis = thesisResult.debug;

  if (isAborted()) {
    return { success: false, error: 'Task aborted', debug: thesisResult.debug };
  }

  if (thesisResult.error || !thesisResult.text) {
    return { success: false, error: `Visual thesis step failed: ${thesisResult.error || 'Empty response'}`, debug: thesisResult.debug };
  }

  // Parse thesis response - plain text, just trim
  const visualThesis = thesisResult.text.trim();
  if (!visualThesis) {
    return {
      success: false,
      error: 'Visual thesis step returned empty response',
      debug: thesisResult.debug,
    };
  }

  // Accumulate costs
  if (thesisResult.usage) {
    totalInputTokens += thesisResult.usage.inputTokens;
    totalOutputTokens += thesisResult.usage.outputTokens;
    totalActualCost += calculateActualTextCost(thesisResult.usage.inputTokens, thesisResult.usage.outputTokens, thesisParams.model);
  }

  // ============================================================================
  // Step 3: Visual Traits (given thesis + palette guidance)
  // ============================================================================
  console.log('[Worker] Description chain step 3: Visual Traits');

  const traitsParams = getCallParams(config, 'description.visualTraits');

  // Fetch trait guidance for diversity (run-scoped avoidance, project-scoped palette)
  // Pass subtype and era to filter categories relevant to this entity
  let traitGuidance: TraitGuidance | undefined;
  try {
    if (task.projectId && task.simulationRunId && task.entityKind) {
      traitGuidance = await getTraitGuidance(
        task.projectId,
        task.simulationRunId,
        task.entityKind,
        task.entitySubtype,
        task.entityEraId
      );
    }
  } catch (err) {
    // Non-fatal - continue without guidance
    console.warn('[Worker] Failed to fetch trait guidance:', err);
  }

  // Validate instructions are provided (from defaults or per-kind override)
  if (!task.visualTraitsInstructions) {
    return {
      success: false,
      error: `Missing visualTraitsInstructions for entity kind '${task.entityKind}'. Configure in entityGuidance.${task.entityKind}.visualTraits`,
    };
  }

  // Build traits prompt - use per-kind framing if provided
  const traitsFraming = task.visualTraitsFraming || '';
  const traitsPrompt = `${traitsFraming ? traitsFraming + '\n\n' : ''}THESIS (the primary silhouette - don't repeat, expand):
${visualThesis}

${visualContext}

DESCRIPTION (source material for additional distinctive features):
${narrativePayload.description}

Generate 2-4 visual traits that ADD to the thesis - features it didn't cover.`;

  // Build system prompt with per-kind instructions (include subtype for context)
  const traitsSystemPrompt = buildVisualTraitsPrompt(task.visualTraitsInstructions, traitGuidance, task.entitySubtype);

  const traitsResult = await llmClient.complete({
    systemPrompt: traitsSystemPrompt,
    prompt: traitsPrompt,
    model: traitsParams.model,
    maxTokens: traitsParams.thinkingBudget ? traitsParams.thinkingBudget + 512 : 512,
    temperature: 0.7,
    thinkingBudget: traitsParams.thinkingBudget,
  });
  chainDebug.traits = traitsResult.debug;

  if (isAborted()) {
    return { success: false, error: 'Task aborted', debug: traitsResult.debug };
  }

  if (traitsResult.error || !traitsResult.text) {
    return { success: false, error: `Visual traits step failed: ${traitsResult.error || 'Empty response'}`, debug: traitsResult.debug };
  }

  // Parse traits response - one trait per line
  const visualTraits = traitsResult.text
    .split('\n')
    .map(line => line.replace(/^[-*•]\s*/, '').trim())  // Strip bullet markers
    .filter(line => line.length > 0);  // Filter empty lines

  // Accumulate costs
  if (traitsResult.usage) {
    totalInputTokens += traitsResult.usage.inputTokens;
    totalOutputTokens += traitsResult.usage.outputTokens;
    totalActualCost += calculateActualTextCost(traitsResult.usage.inputTokens, traitsResult.usage.outputTokens, traitsParams.model);
  }

  // ============================================================================
  // Register traits and save cost record
  // ============================================================================

  // Register generated traits for future diversity guidance
  try {
    if (task.projectId && task.simulationRunId && task.entityKind && visualTraits.length > 0) {
      await registerUsedTraits(
        task.projectId,
        task.simulationRunId,
        task.entityKind,
        task.entityId,
        task.entityName,
        visualTraits
      );
      // Increment palette category usage counters (for weighted selection)
      await incrementPaletteUsage(task.projectId, task.entityKind, visualTraits);
    }
  } catch (err) {
    // Non-fatal - continue without registration
    console.warn('[Worker] Failed to register traits:', err);
  }

  // Calculate estimated cost (for comparison) - use narrative model as base
  const estimate = estimateTextCost(task.prompt, 'description', narrativeParams.model);

  // Save cost record with combined totals (use narrative model as primary for record)
  await saveCostRecord({
    id: generateCostId(),
    timestamp: Date.now(),
    projectId: task.projectId,
    simulationRunId: task.simulationRunId,
    entityId: task.entityId,
    entityName: task.entityName,
    entityKind: task.entityKind,
    type: 'description' as CostType,
    model: narrativeParams.model,
    estimatedCost: estimate.estimatedCost,
    actualCost: totalActualCost,
    inputTokens: totalInputTokens,
    outputTokens: totalOutputTokens,
  });

  console.log(`[Worker] Description chain complete: ${totalInputTokens} in / ${totalOutputTokens} out, $${totalActualCost.toFixed(4)}`);

  return {
    success: true,
    result: {
      summary: narrativePayload.summary,
      description: narrativePayload.description,
      aliases: narrativePayload.aliases,
      visualThesis,
      visualTraits,
      generatedAt: Date.now(),
      model: narrativeParams.model,  // Primary model for display
      estimatedCost: estimate.estimatedCost,
      actualCost: totalActualCost,
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      // Include chain debug for all 3 steps
      chainDebug,
    },
    // Legacy single debug field for error reporting
    debug: traitsResult.debug,
  };
}

// ============================================================================
// Chronicle Task Execution
// ============================================================================

/**
 * Convert serializable chronicle context to full generation context.
 * IMPORTANT: When adding fields to ChronicleGenerationContext, add them here too.
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

  return {
    worldName: ctx.worldName,
    worldDescription: ctx.worldDescription,
    canonFacts: ctx.canonFacts,
    tone: ctx.tone,
    focus: ctx.focus,
    era: ctx.era
      ? {
        id: ctx.era.id,
        name: ctx.era.name,
        description: ctx.era.description,
      }
      : undefined,
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
    nameBank: ctx.nameBank,
    proseHints: ctx.proseHints,
    culturalIdentities: ctx.culturalIdentities,
  };
}

/**
 * Execute a SINGLE step of chronicle generation.
 * Each step pauses for user review before proceeding to the next.
 */
export async function executeEntityChronicleTask(
  task: WorkerTask,
  config: WorkerConfig,
  llmClient: LLMClient,
  isAborted: () => boolean
): Promise<TaskResult> {
  if (!llmClient.isEnabled()) {
    return { success: false, error: 'Text generation not configured - missing Anthropic API key' };
  }

  const step = task.chronicleStep || 'generate_v2';
  console.log(`[Worker] Chronicle step=${step} for entity=${task.entityId}`);

  // V2 single-shot generation - primary generation path
  if (step === 'generate_v2') {
    if (!task.chronicleContext) {
      return { success: false, error: 'Chronicle context required for generate_v2 step' };
    }
    return executeV2GenerationStep(task, config, llmClient, isAborted);
  }

  // For post-generation steps, we need the existing chronicle
  if (!task.chronicleId) {
    return { success: false, error: `chronicleId required for ${step} step` };
  }

  const chronicleRecord = await getChronicle(task.chronicleId);
  if (!chronicleRecord) {
    return { success: false, error: `Chronicle ${task.chronicleId} not found` };
  }

  if (step === 'edit') {
    if (!task.chronicleContext) {
      return { success: false, error: 'Chronicle context required for edit step' };
    }
    return executeEditStep(task, chronicleRecord, config, llmClient, isAborted);
  }

  if (step === 'summary') {
    if (!task.chronicleContext) {
      return { success: false, error: 'Chronicle context required for summary step' };
    }
    return executeSummaryStep(task, chronicleRecord, config, llmClient, isAborted);
  }

  if (step === 'image_refs') {
    if (!task.chronicleContext) {
      return { success: false, error: 'Chronicle context required for image refs step' };
    }
    return executeImageRefsStep(task, chronicleRecord, config, llmClient, isAborted);
  }

  if (step === 'validate') {
    if (!task.chronicleContext) {
      return { success: false, error: 'Chronicle context required for validate step' };
    }
    return executeValidateStep(task, chronicleRecord, config, llmClient, isAborted);
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
  isAborted: () => boolean
): Promise<TaskResult> {
  const chronicleContext = task.chronicleContext!;
  const context = deserializeChronicleContext(chronicleContext);
  const narrativeStyle = chronicleContext.narrativeStyle;

  if (!narrativeStyle) {
    return { success: false, error: 'Narrative style is required for V2 generation' };
  }

  if (!task.chronicleId) {
    return { success: false, error: 'chronicleId required for generate_v2 step' };
  }

  const { model, thinkingBudget } = getCallParams(config, 'chronicle.generation');
  const chronicleId = task.chronicleId;
  console.log(`[Worker] V2 generation for chronicle=${chronicleId}, style="${narrativeStyle.name}", model=${model}`);

  // Simple entity/event selection from 2-hop neighborhood
  const selection = selectEntitiesV2(context, DEFAULT_V2_CONFIG);
  console.log(`[Worker] V2 selected ${selection.entities.length} entities, ${selection.events.length} events, ${selection.relationships.length} relationships`);

  // Build single-shot prompt
  const prompt = buildV2Prompt(context, narrativeStyle, selection);
  const baseMaxTokens = getMaxTokensFromStyle(narrativeStyle);
  const maxTokens = thinkingBudget ? thinkingBudget + baseMaxTokens : baseMaxTokens;
  const systemPrompt = getV2SystemPrompt(narrativeStyle);
  const estimate = estimateTextCost(prompt, 'description', model);

  console.log(`[Worker] V2 prompt length: ${prompt.length} chars, maxTokens: ${maxTokens}`);

  // Single LLM call
  const result = await llmClient.complete({
    systemPrompt,
    prompt,
    model,
    maxTokens,
    temperature: 0.7,
    thinkingBudget,
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
  // (in useChronicleGeneration.ts acceptChronicle) to avoid double-bracketing issues.

  // Calculate cost
  const cost = {
    estimated: estimate.estimatedCost,
    actual: result.usage
      ? calculateActualTextCost(result.usage.inputTokens, result.usage.outputTokens, model)
      : estimate.estimatedCost,
    inputTokens: result.usage?.inputTokens || estimate.inputTokens,
    outputTokens: result.usage?.outputTokens || estimate.outputTokens,
  };

  // Save chronicle directly to assembled state (single-shot generation)
  try {
    const focus = context.focus;
    const existingChronicle = await getChronicle(chronicleId);
    const roleAssignments = existingChronicle?.roleAssignments ?? focus?.roleAssignments ?? [];
    const selectedEntityIds = existingChronicle?.selectedEntityIds ?? focus?.selectedEntityIds ?? [];
    const selectedEventIds = existingChronicle?.selectedEventIds ?? focus?.selectedEventIds ?? [];
    const selectedRelationshipIds = existingChronicle?.selectedRelationshipIds ?? focus?.selectedRelationshipIds ?? [];

    await createChronicle(chronicleId, {
      projectId: task.projectId,
      simulationRunId: task.simulationRunId,
      model,
      title: existingChronicle?.title,
      format: existingChronicle?.format || narrativeStyle.format,
      narrativeStyleId: existingChronicle?.narrativeStyleId || narrativeStyle.id,
      roleAssignments,
      selectedEntityIds,
      selectedEventIds,
      selectedRelationshipIds,
      entrypointId: existingChronicle?.entrypointId,
      assembledContent: result.text,
      selectionSummary: {
        entityCount: selection.entities.length,
        eventCount: selection.events.length,
        relationshipCount: selection.relationships.length,
      },
      cost,
    });
    console.log(`[Worker] Chronicle saved: ${chronicleId}`);
  } catch (err) {
    return { success: false, error: `Failed to save chronicle: ${err}` };
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
    chronicleId,
    type: 'chronicleV2',
    model,
    estimatedCost: cost.estimated,
    actualCost: cost.actual,
    inputTokens: cost.inputTokens,
    outputTokens: cost.outputTokens,
  });

  return {
    success: true,
    result: {
      chronicleId,
      generatedAt: Date.now(),
      model,
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
  chronicleRecord: Awaited<ReturnType<typeof getChronicle>>,
  config: WorkerConfig,
  llmClient: LLMClient,
  isAborted: () => boolean
): Promise<TaskResult> {
  if (!chronicleRecord) {
    return { success: false, error: 'Chronicle record missing for editing' };
  }

  const chronicleId = chronicleRecord.chronicleId;
  const failEdit = async (message: string, debug?: NetworkDebugInfo): Promise<TaskResult> => {
    await markChronicleFailure(chronicleId, 'edit', message);
    return { success: false, error: message, debug };
  };

  if (!chronicleRecord.assembledContent) {
    return failEdit('Chronicle has no assembled content to edit');
  }
  if (!chronicleRecord.cohesionReport) {
    return failEdit('Chronicle has no validation report to edit against');
  }

  const { model, thinkingBudget } = getCallParams(config, 'chronicle.edit');
  console.log(`[Worker] Editing chronicle based on validation feedback, model=${model}...`);

  // Build edit prompt from validation issues
  const issues = chronicleRecord.cohesionReport.issues || [];
  const issueList = issues
    .map((issue, i) => `${i + 1}. [${issue.severity}] ${issue.description}\n   Suggestion: ${issue.suggestion}`)
    .join('\n\n');

  const editPrompt = `Revise the chronicle below based on the validation feedback.

## Validation Issues
${issueList || 'No specific issues identified.'}

## Original Chronicle
${chronicleRecord.assembledContent}

## Instructions
1. Address each issue while preserving the overall narrative flow
2. Maintain entity names, facts, and relationships accurately
3. Return ONLY the revised chronicle text, no explanations`;

  const editEstimate = estimateTextCost(editPrompt, 'description', model);
  const maxTokens = thinkingBudget ? thinkingBudget + 4096 : 4096;

  const editResult = await llmClient.complete({
    systemPrompt: 'You are a narrative editor. Revise the chronicle to address the validation feedback while maintaining quality and consistency.',
    prompt: editPrompt,
    model,
    maxTokens,
    temperature: 0.3,
    thinkingBudget,
  });
  const debug = editResult.debug;

  if (isAborted()) {
    return failEdit('Task aborted', debug);
  }

  if (editResult.error || !editResult.text) {
    return failEdit(`Edit failed: ${editResult.error || 'Empty response'}`, debug);
  }

  const actualCost = editResult.usage
    ? calculateActualTextCost(editResult.usage.inputTokens, editResult.usage.outputTokens, model)
    : editEstimate.estimatedCost;
  const editCost = {
    estimated: editEstimate.estimatedCost,
    actual: actualCost,
    inputTokens: editResult.usage?.inputTokens || editEstimate.inputTokens,
    outputTokens: editResult.usage?.outputTokens || editEstimate.outputTokens,
  };

  const cleanedContent = stripLeadingWrapper(editResult.text);

  await updateChronicleEdit(chronicleId, cleanedContent, editCost);

  await saveCostRecord({
    id: generateCostId(),
    timestamp: Date.now(),
    projectId: task.projectId,
    simulationRunId: task.simulationRunId,
    entityId: task.entityId,
    entityName: task.entityName,
    entityKind: task.entityKind,
    chronicleId,
    type: 'chronicleRevision',
    model,
    estimatedCost: editCost.estimated,
    actualCost: editCost.actual,
    inputTokens: editCost.inputTokens,
    outputTokens: editCost.outputTokens,
  });

  if (isAborted()) {
    return failEdit('Task aborted', debug);
  }

  const updatedChronicleRecord = {
    ...chronicleRecord,
    assembledContent: cleanedContent,
  };

  const validationResult = await executeValidateStep(
    task,
    updatedChronicleRecord,
    config,
    llmClient,
    isAborted
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

4. **Narrative Coherence**: Does the chronicle flow logically? Is there a clear beginning, middle, and end?

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
  chronicleRecord: Awaited<ReturnType<typeof getChronicle>>,
  config: WorkerConfig,
  llmClient: LLMClient,
  isAborted: () => boolean
): Promise<TaskResult> {
  if (!chronicleRecord) {
    return { success: false, error: 'Chronicle record missing for validation' };
  }

  const chronicleId = chronicleRecord.chronicleId;
  const failValidate = async (message: string, debug?: NetworkDebugInfo): Promise<TaskResult> => {
    await markChronicleFailure(chronicleId, 'validate', message);
    return { success: false, error: message, debug };
  };

  if (!chronicleRecord.assembledContent) {
    return failValidate('Chronicle has no assembled content to validate');
  }

  const context = deserializeChronicleContext(task.chronicleContext!);
  const narrativeStyle = task.chronicleContext!.narrativeStyle;
  if (!narrativeStyle) {
    return failValidate('Narrative style is required for validation');
  }

  const { model, thinkingBudget } = getCallParams(config, 'chronicle.validation');
  console.log(`[Worker] Validating cohesion, model=${model}...`);
  const validationPrompt = buildV2ValidationPrompt(chronicleRecord.assembledContent, context, narrativeStyle);
  const systemPrompt = 'You are a narrative quality evaluator. Analyze the chronicle and provide a structured assessment.';

  const validationEstimate = estimateTextCost(validationPrompt, 'description', model);
  const maxTokens = thinkingBudget ? thinkingBudget + 4096 : 4096;

  const validationResult = await llmClient.complete({
    systemPrompt,
    prompt: validationPrompt,
    model,
    maxTokens,
    temperature: 0.3,
    thinkingBudget,
  });
  const debug = validationResult.debug;

  if (isAborted()) {
    return failValidate('Task aborted', debug);
  }

  const validationCost = {
    estimated: validationEstimate.estimatedCost,
    actual: validationResult.usage
      ? calculateActualTextCost(validationResult.usage.inputTokens, validationResult.usage.outputTokens, model)
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
    cohesionReport.model = model;
  } catch (err) {
    return failValidate(`Failed to parse validation response: ${err}`, debug);
  }

  await updateChronicleCohesion(chronicleId, cohesionReport, validationCost);
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
    chronicleId,
    type: 'chronicleValidation',
    model,
    estimatedCost: validationCost.estimated,
    actualCost: validationCost.actual,
    inputTokens: validationCost.inputTokens,
    outputTokens: validationCost.outputTokens,
  });

  return {
    success: true,
    result: {
      chronicleId,
      generatedAt: Date.now(),
      model,
      estimatedCost: validationCost.estimated,
      actualCost: validationCost.actual,
      inputTokens: validationCost.inputTokens,
      outputTokens: validationCost.outputTokens,
    },
    debug,
  };
}

function buildSummaryPrompt(content: string): string {
  return `Generate a title and summary for the chronicle below.

Rules:
- Title: A compelling, evocative title (3-8 words) that captures the essence of the chronicle
- Summary: 2-4 sentences summarizing the key events and outcome
- Keep both factual and faithful to the chronicle
- Mention key entities in the summary

Chronicle:
${content}

Return ONLY valid JSON in this exact format:
{"title": "...", "summary": "..."}`;
}

function formatImageRefEntities(context: ChronicleGenerationContext): string {
  if (context.entities.length === 0) return '(none)';

  return context.entities
    .map((entity) => `- ${entity.id}: ${entity.name} (${entity.kind})`)
    .join('\n');
}

/**
 * Split content into roughly equal chunks for distributed image placement.
 * Splits at whitespace boundaries to avoid cutting words.
 * Returns 3-7 chunks, weighted by content length (longer = more chunks).
 */
function splitIntoChunks(content: string): Array<{ index: number; text: string; startOffset: number }> {
  // Estimate word count for chunk calculation
  const wordCount = content.split(/\s+/).length;

  // Calculate chunk count: 3-7, weighted by length
  // Under 500 words: 3 chunks, 500-1000: 4, 1000-2000: 5, 2000-3000: 6, 3000+: 7
  let baseChunkCount: number;
  if (wordCount < 500) baseChunkCount = 3;
  else if (wordCount < 1000) baseChunkCount = 4;
  else if (wordCount < 2000) baseChunkCount = 5;
  else if (wordCount < 3000) baseChunkCount = 6;
  else baseChunkCount = 7;

  // Add slight randomness: ±1 chunk
  const randomOffset = Math.random() < 0.3 ? -1 : (Math.random() > 0.7 ? 1 : 0);
  const chunkCount = Math.max(3, Math.min(7, baseChunkCount + randomOffset));

  const targetChunkSize = Math.ceil(content.length / chunkCount);
  const chunks: Array<{ index: number; text: string; startOffset: number }> = [];

  let currentStart = 0;
  for (let i = 0; i < chunkCount; i++) {
    const targetEnd = Math.min(currentStart + targetChunkSize, content.length);

    // Find next whitespace after target end (don't cut words)
    let actualEnd = targetEnd;
    if (targetEnd < content.length) {
      // Look for whitespace within 50 chars after target
      const searchEnd = Math.min(targetEnd + 50, content.length);
      for (let j = targetEnd; j < searchEnd; j++) {
        if (/\s/.test(content[j])) {
          actualEnd = j;
          break;
        }
      }
      // If no whitespace found, use target (rare edge case)
      if (actualEnd === targetEnd && targetEnd < content.length) {
        actualEnd = targetEnd;
      }
    }

    chunks.push({
      index: i,
      text: content.substring(currentStart, actualEnd),
      startOffset: currentStart,
    });

    currentStart = actualEnd;

    // Skip leading whitespace for next chunk
    while (currentStart < content.length && /\s/.test(content[currentStart])) {
      currentStart++;
    }

    // If we've consumed all content, stop
    if (currentStart >= content.length) break;
  }

  return chunks;
}

function buildImageRefsPrompt(
  content: string,
  context: ChronicleGenerationContext
): string {
  const entityList = formatImageRefEntities(context);
  const chunks = splitIntoChunks(content);

  // Build chunk display with markers (full text, no truncation)
  const chunksDisplay = chunks.map((chunk, i) => {
    return `### CHUNK ${i + 1} of ${chunks.length}
${chunk.text}
---`;
  }).join('\n\n');

  return `You are adding image references to a chronicle. Your task is to identify optimal placement points for images that enhance the narrative.

## Available Entities
${entityList}

## Instructions
The chronicle has been divided into ${chunks.length} chunks. For EACH chunk, decide whether it deserves an image (0 or 1 per chunk). This ensures images are distributed throughout the narrative.

For each image, choose one type:

1. **Entity Reference** (type: "entity_ref") - Use when a specific entity is prominently featured
   - Best for: Introductions, key moments focused on a single entity

2. **Scene Prompt** (type: "prompt_request") - Use for scenes involving multiple entities or environments
   - Best for: Multi-entity scenes, locations, action moments, atmospheric shots
   - REQUIRED: Include involvedEntityIds with at least one entity that appears in the scene

## Output Format
Return a JSON object. For each image placement, provide an entry with anchorText from the relevant chunk:
{
  "imageRefs": [
    {
      "type": "entity_ref",
      "entityId": "<entity id from list above>",
      "anchorText": "<exact 5-15 word phrase from the chronicle>",
      "size": "small|medium|large|full-width",
      "caption": "<optional>"
    },
    {
      "type": "prompt_request",
      "sceneDescription": "<vivid 1-2 sentence scene description>",
      "involvedEntityIds": ["<entity-id-1>", "<entity-id-2>"],
      "anchorText": "<exact 5-15 word phrase from the chronicle>",
      "size": "small|medium|large|full-width",
      "caption": "<optional>"
    }
  ]
}

## Size Guidelines
- small: 150px, supplementary/margin images
- medium: 300px, standard single-entity images
- large: 450px, key scenes
- full-width: 100%, establishing shots

## Rules
- Suggest 0 or 1 image per chunk (total 2-5 images for the whole chronicle)
- anchorText MUST be an exact phrase from that chunk's text
- entityId and involvedEntityIds MUST use IDs from the Available Entities list
- For prompt_request, involvedEntityIds MUST contain at least one entity ID
- Return valid JSON only, no markdown

## Chronicle Chunks
${chunksDisplay}`;
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
        anchorText,
        size,
        caption,
      } as EntityImageRef;
    } else if (ref.type === 'prompt_request') {
      const sceneDescription = typeof ref.sceneDescription === 'string' ? ref.sceneDescription : '';
      if (!sceneDescription) {
        throw new Error(`prompt_request at index ${index} missing sceneDescription`);
      }
      // Parse involvedEntityIds - can be array of strings or empty
      let involvedEntityIds: string[] | undefined;
      if (Array.isArray(ref.involvedEntityIds)) {
        involvedEntityIds = ref.involvedEntityIds
          .filter((id): id is string => typeof id === 'string' && id.length > 0);
        if (involvedEntityIds.length === 0) {
          involvedEntityIds = undefined;
        }
      }
      return {
        refId,
        type: 'prompt_request',
        sceneDescription,
        involvedEntityIds,
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

async function executeSummaryStep(
  task: WorkerTask,
  chronicleRecord: Awaited<ReturnType<typeof getChronicle>>,
  config: WorkerConfig,
  llmClient: LLMClient,
  isAborted: () => boolean
): Promise<TaskResult> {
  if (!chronicleRecord) {
    return { success: false, error: 'Chronicle record missing for summary' };
  }
  if (!chronicleRecord.assembledContent) {
    return { success: false, error: 'Chronicle has no assembled content to summarize' };
  }

  const { model, thinkingBudget } = getCallParams(config, 'chronicle.summary');
  const chronicleId = chronicleRecord.chronicleId;
  const summaryPrompt = buildSummaryPrompt(chronicleRecord.assembledContent);
  const summaryEstimate = estimateTextCost(summaryPrompt, 'description', model);
  const maxTokens = thinkingBudget ? thinkingBudget + 512 : 512;

  const summaryResult = await llmClient.complete({
    systemPrompt: 'You are a careful editor who writes concise, faithful summaries. Always respond with valid JSON.',
    prompt: summaryPrompt,
    model,
    maxTokens,
    temperature: 0.3,
    thinkingBudget,
  });
  const debug = summaryResult.debug;

  if (isAborted()) {
    return { success: false, error: 'Task aborted', debug };
  }

  if (summaryResult.error || !summaryResult.text) {
    return { success: false, error: `Summary failed: ${summaryResult.error || 'Empty response'}`, debug };
  }

  // Parse JSON response for title and summary
  let title: string | undefined;
  let summaryText: string;

  try {
    const cleaned = stripLeadingWrapper(summaryResult.text).trim();
    // Use extractFirstJsonObject for robust JSON extraction
    const jsonStr = extractFirstJsonObject(cleaned) || cleaned;
    const parsed = JSON.parse(jsonStr);
    title = parsed.title?.trim();
    summaryText = parsed.summary?.trim();
    if (!summaryText) {
      return { success: false, error: 'Summary response missing summary field', debug };
    }
  } catch {
    // Fallback: treat entire response as summary (backwards compat)
    summaryText = stripLeadingWrapper(summaryResult.text).replace(/\s+/g, ' ').trim();
    if (!summaryText) {
      return { success: false, error: 'Summary response empty', debug };
    }
  }

  const summaryCost = {
    estimated: summaryEstimate.estimatedCost,
    actual: summaryResult.usage
      ? calculateActualTextCost(summaryResult.usage.inputTokens, summaryResult.usage.outputTokens, model)
      : summaryEstimate.estimatedCost,
    inputTokens: summaryResult.usage?.inputTokens || summaryEstimate.inputTokens,
    outputTokens: summaryResult.usage?.outputTokens || summaryEstimate.outputTokens,
  };

  await updateChronicleSummary(chronicleId, summaryText, summaryCost, model, title);

  await saveCostRecord({
    id: generateCostId(),
    timestamp: Date.now(),
    projectId: task.projectId,
    simulationRunId: task.simulationRunId,
    entityId: task.entityId,
    entityName: task.entityName,
    entityKind: task.entityKind,
    chronicleId,
    type: 'chronicleSummary' as CostType,
    model,
    estimatedCost: summaryCost.estimated,
    actualCost: summaryCost.actual,
    inputTokens: summaryCost.inputTokens,
    outputTokens: summaryCost.outputTokens,
  });

  return {
    success: true,
    result: {
      chronicleId,
      generatedAt: Date.now(),
      model,
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
  chronicleRecord: Awaited<ReturnType<typeof getChronicle>>,
  config: WorkerConfig,
  llmClient: LLMClient,
  isAborted: () => boolean
): Promise<TaskResult> {
  if (!chronicleRecord) {
    return { success: false, error: 'Chronicle record missing for image refs' };
  }
  if (!chronicleRecord.assembledContent) {
    return { success: false, error: 'Chronicle has no assembled content for image refs' };
  }

  const { model, thinkingBudget } = getCallParams(config, 'chronicle.imageRefs');
  const chronicleId = chronicleRecord.chronicleId;
  const context = deserializeChronicleContext(task.chronicleContext!);
  const imageRefsPrompt = buildImageRefsPrompt(chronicleRecord.assembledContent, context);
  const imageRefsEstimate = estimateTextCost(imageRefsPrompt, 'description', model);
  const maxTokens = thinkingBudget ? thinkingBudget + 2048 : 2048;

  const imageRefsResult = await llmClient.complete({
    systemPrompt: 'You are planning draft image placements for a chronicle.',
    prompt: imageRefsPrompt,
    model,
    maxTokens,
    temperature: 0.4,
    thinkingBudget,
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

  // Calculate anchorIndex for each ref based on position in assembled content
  const assembledContent = chronicleRecord.assembledContent;
  for (const ref of parsedRefs) {
    if (ref.anchorText) {
      const anchorLower = ref.anchorText.toLowerCase();
      const contentLower = assembledContent.toLowerCase();
      const index = contentLower.indexOf(anchorLower);
      if (index >= 0) {
        ref.anchorIndex = index;
      }
    }
  }

  // Create structured ChronicleImageRefs object
  const imageRefs: ChronicleImageRefs = {
    refs: parsedRefs,
    generatedAt: Date.now(),
    model,
  };

  const imageRefsCost = {
    estimated: imageRefsEstimate.estimatedCost,
    actual: imageRefsResult.usage
      ? calculateActualTextCost(imageRefsResult.usage.inputTokens, imageRefsResult.usage.outputTokens, model)
      : imageRefsEstimate.estimatedCost,
    inputTokens: imageRefsResult.usage?.inputTokens || imageRefsEstimate.inputTokens,
    outputTokens: imageRefsResult.usage?.outputTokens || imageRefsEstimate.outputTokens,
  };

  await updateChronicleImageRefs(chronicleId, imageRefs, imageRefsCost, model);

  await saveCostRecord({
    id: generateCostId(),
    timestamp: Date.now(),
    projectId: task.projectId,
    simulationRunId: task.simulationRunId,
    entityId: task.entityId,
    entityName: task.entityName,
    entityKind: task.entityKind,
    chronicleId,
    type: 'chronicleImageRefs' as CostType,
    model,
    estimatedCost: imageRefsCost.estimated,
    actualCost: imageRefsCost.actual,
    inputTokens: imageRefsCost.inputTokens,
    outputTokens: imageRefsCost.outputTokens,
  });

  return {
    success: true,
    result: {
      chronicleId,
      generatedAt: Date.now(),
      model,
      estimatedCost: imageRefsCost.estimated,
      actualCost: imageRefsCost.actual,
      inputTokens: imageRefsCost.inputTokens,
      outputTokens: imageRefsCost.outputTokens,
    },
    debug,
  };
}

// ============================================================================
// Palette Expansion Task
// ============================================================================

const PALETTE_EXPANSION_SYSTEM_PROMPT = `You curate visual trait palettes for worldbuilding. Each category gets assigned to entities to ensure visual diversity.

THUMBNAIL TEST:
Each category must be visible at 128px or in black silhouette.
Color/hue differences alone are insufficient. Semantic differences are insufficient.
Ask: "Would an artist draw these differently?"

MUNDANE MATTERS:
The most memorable visuals have simple, drawable distinctions: a missing finger, a pronounced limp, sun-weathered skin, a distinctive hat.
Ground categories in what survives stylization.`;

interface CultureContext {
  name: string;
  description?: string;
  visualIdentity?: Record<string, string>;
}

interface EraContext {
  id: string;
  name: string;
  description?: string;
}

function buildPaletteExpansionPrompt(
  entityKind: string,
  worldContext: string,
  subtypes: string[],
  eras: EraContext[],
  cultureContext?: CultureContext[]
): string {
  // Build culture section if available
  let cultureSection = '';
  if (cultureContext && cultureContext.length > 0) {
    const cultureLines = cultureContext.map(c => {
      const parts = [c.name];
      if (c.description) parts.push(c.description);
      if (c.visualIdentity) {
        const traditions = Object.entries(c.visualIdentity)
          .map(([k, v]) => `${k}: ${v}`)
          .join('; ');
        if (traditions) parts.push(`Visual: ${traditions}`);
      }
      return `- ${parts.join(' — ')}`;
    }).join('\n');
    cultureSection = `\nCultures in this world:\n${cultureLines}\n`;
  }

  // Build subtypes section - REQUIRED, fail if none provided
  if (subtypes.length === 0) {
    throw new Error(`Cannot generate palette for ${entityKind}: no subtypes defined. Define subtypes in the schema.`);
  }
  const subtypesList = subtypes.join(', ');
  const subtypesSection = `\nALLOWED SUBTYPES for ${entityKind} (use ONLY these exact values): ${subtypesList}\n`;

  // Build eras section
  let erasSection = '';
  if (eras.length > 0) {
    const eraLines = eras.map(e => `- ${e.id}: "${e.name}"${e.description ? ` — ${e.description}` : ''}`).join('\n');
    erasSection = `\nERAS in this world (use exact IDs):\n${eraLines}\n`;
  }

  // Dimension hints based on entity type
  const dimensionHints = entityKind === 'location'
    ? 'shape/architecture, surface/texture, condition/age, atmosphere, activity, cultural markers'
    : 'body shape, surface patterns, condition/scars, movement/gait, equipment, presence/aura';

  return `Generate a visual trait palette for "${entityKind}" entities.

WORLD: ${worldContext || 'A fantasy world.'}
${cultureSection}${subtypesSection}${erasSection}
TASK:
Generate TWO types of categories:

## PART 1: Subtype Categories (6-10 categories)
Cover the visual dimensions (${dimensionHints}).

CRITICAL RULES FOR SUBTYPES:
- Every category MUST have a "subtypes" array with 1+ values from: [${subtypesList}]
- You can ONLY use these exact subtype values - do NOT invent new ones
- Each category should apply to 1-2 subtypes (be specific, not universal)
- Ensure good coverage: each subtype should have 3-5 categories that include it
- Categories that would "apply to all" should instead be split into subtype-specific variants

## PART 2: Era Categories (one per era)
${eras.length > 0
    ? `For EACH era listed above, create exactly ONE category specific to "${entityKind}".
- Era categories reflect material conditions or dominant activities of that time
- Era categories apply to ALL subtypes (leave subtypes empty)
- Use the exact era ID from the list above`
    : 'No eras defined - skip era categories.'}

Each category must pass the SILHOUETTE TEST:
- Visible at 128px or in black silhouette
- An artist would draw this differently from other categories
- Changes shape, motion, or spatial presence (not just color/texture)

OUTPUT (JSON only):
{
  "categories": [
    {
      "category": "Name",
      "description": "What this means visually",
      "examples": ["example 1", "example 2", "example 3"],
      "subtypes": ["${subtypes[0]}"],  // REQUIRED: 1+ subtypes from allowed list
      "era": null
    },
    {
      "category": "Era-Specific Name",
      "description": "How this era manifests for ${entityKind}",
      "examples": ["example 1", "example 2", "example 3"],
      "subtypes": [],  // Era categories: empty (apply to all)
      "era": "era-id"
    }
  ]
}`;
}

interface PaletteExpansionResponse {
  categories: Array<{
    category: string;
    description: string;
    examples: string[];
    subtypes?: string[];
    era?: string;
  }>;
}

function parsePaletteExpansionResponse(text: string): PaletteExpansionResponse {
  // Extract JSON from response
  let jsonStr = text.trim();

  // Try to find JSON object if wrapped in other text
  const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    jsonStr = jsonMatch[0];
  }

  const parsed = JSON.parse(jsonStr);

  // Handle both old format (newCategories) and new format (categories)
  const rawCategories = parsed.categories || parsed.newCategories || [];

  return {
    categories: Array.isArray(rawCategories)
      ? rawCategories
          .filter((c: unknown) =>
            c && typeof c === 'object' &&
            typeof (c as Record<string, unknown>).category === 'string'
          )
          .map((c: Record<string, unknown>) => ({
            category: c.category as string,
            description: (c.description as string) || '',
            examples: Array.isArray(c.examples)
              ? (c.examples as unknown[]).filter((e): e is string => typeof e === 'string')
              : [],
            subtypes: Array.isArray(c.subtypes)
              ? (c.subtypes as unknown[]).filter((s): s is string => typeof s === 'string')
              : undefined,
            // era can be null, undefined, or a string - only keep if it's a non-empty string
            era: typeof c.era === 'string' && c.era.length > 0 ? c.era : undefined,
          }))
      : [],
  };
}

export async function executePaletteExpansionTask(
  task: WorkerTask,
  config: WorkerConfig,
  llmClient: LLMClient,
  isAborted: () => boolean
): Promise<TaskResult> {
  if (!llmClient.isEnabled()) {
    return { success: false, error: 'LLM client not configured' };
  }

  const entityKind = task.paletteEntityKind;
  const worldContext = task.paletteWorldContext || '';

  if (!entityKind) {
    return { success: false, error: 'Entity kind required for palette expansion' };
  }

  // Use per-call settings for palette expansion
  const { model, thinkingBudget } = getCallParams(config, 'palette.expansion');

  // Get available subtypes and eras for this entity kind
  const subtypes = task.paletteSubtypes || [];
  const eras = task.paletteEras || [];

  const prompt = buildPaletteExpansionPrompt(
    entityKind,
    worldContext,
    subtypes,
    eras,
    task.paletteCultureContext
  );

  const estimate = estimateTextCost(prompt, 'description', model);

  // max_tokens must be > thinking budget; add response budget on top
  const responseBudget = 4096;
  const totalMaxTokens = thinkingBudget > 0 ? thinkingBudget + responseBudget : responseBudget;

  const result = await llmClient.complete({
    systemPrompt: PALETTE_EXPANSION_SYSTEM_PROMPT,
    prompt,
    model,
    maxTokens: totalMaxTokens,
    thinkingBudget: thinkingBudget > 0 ? thinkingBudget : undefined,
  });
  const debug = result.debug;

  if (isAborted()) {
    return { success: false, error: 'Task aborted', debug };
  }

  if (result.error || !result.text) {
    return { success: false, error: result.error || 'Empty response', debug };
  }

  // Parse response
  let expansion: PaletteExpansionResponse;
  try {
    expansion = parsePaletteExpansionResponse(result.text);
  } catch (err) {
    return {
      success: false,
      error: `Failed to parse expansion response: ${err instanceof Error ? err.message : 'Unknown error'}`,
      debug,
    };
  }

  // Apply updates - replace entire palette with new categories
  await updatePaletteItems(task.projectId, entityKind, {
    newItems: expansion.categories,
  });

  // Calculate costs
  const inputTokens = result.usage?.inputTokens || estimate.inputTokens;
  const outputTokens = result.usage?.outputTokens || estimate.outputTokens;
  const actualCost = result.usage
    ? calculateActualTextCost(inputTokens, outputTokens, model)
    : estimate.estimatedCost;

  // Save cost record
  await saveCostRecord({
    id: generateCostId(),
    timestamp: Date.now(),
    projectId: task.projectId,
    simulationRunId: task.simulationRunId,
    type: 'paletteExpansion' as CostType,
    model,
    estimatedCost: estimate.estimatedCost,
    actualCost,
    inputTokens,
    outputTokens,
  });

  return {
    success: true,
    result: {
      generatedAt: Date.now(),
      model,
      estimatedCost: estimate.estimatedCost,
      actualCost,
      inputTokens,
      outputTokens,
    },
    debug,
  };
}

// Re-export types
export type { WorkerTask, WorkerResult, EnrichmentResult, EnrichmentType };
