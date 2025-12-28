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
  getPalette,
  getHistoricalTraits,
  updatePaletteItems,
  type TraitGuidance,
  type PaletteItem,
} from '../lib/traitRegistry';
import {
  createChronicle,
  updateChronicleAssembly,
  updateChronicleCohesion,
  updateChronicleEdit,
  updateChronicleSummary,
  updateChronicleImageRefs,
  updateChronicleProseBlend,
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

// ============================================================================
// Types
// ============================================================================

export interface WorkerConfig {
  anthropicApiKey: string;
  openaiApiKey: string;
  textModel: string;
  chronicleModel?: string;  // Model for chronicles (defaults to textModel)
  imageModel: string;
  imageSize: string;
  imageQuality: string;
  numWorkers?: number;
  useClaudeForImagePrompt?: boolean;
  claudeImagePromptTemplate?: string;
  // Thinking model configuration (for complex reasoning tasks like palette curation)
  thinkingModel?: string;       // Model ID (sonnet/opus - must support extended thinking)
  thinkingBudget?: number;      // Token budget for extended thinking (0 = disabled)
  // Use thinking model for description generation (visual thesis benefits from reasoning)
  useThinkingForDescriptions?: boolean;
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

function parseDescriptionPayload(text: string): {
  summary: string;
  description: string;
  aliases: string[];
  visualThesis: string;
  visualTraits: string[];
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
  const visualThesis = typeof obj.visualThesis === 'string' ? obj.visualThesis.trim() : '';
  const aliases = Array.isArray(obj.aliases)
    ? obj.aliases
      .filter((alias): alias is string => typeof alias === 'string')
      .map((alias) => alias.trim())
      .filter(Boolean)
    : [];
  const visualTraits = Array.isArray(obj.visualTraits)
    ? obj.visualTraits
      .filter((trait): trait is string => typeof trait === 'string')
      .map((trait) => trait.trim())
      .filter(Boolean)
    : [];

  if (!summary || !description) {
    throw new Error('Description payload requires summary and description');
  }

  return { summary, description, aliases, visualThesis, visualTraits };
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
- Status indicates current state: "active" = alive/operating, "dead/historical" = past tense appropriate
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
 * Step 2: Visual thesis prompt - ONE silhouette sentence
 * Uses fighting game/anime roster design as reference domain
 * @param visualAvoid - Optional project-specific elements to avoid (overused motifs)
 */
export function buildVisualThesisPrompt(visualAvoid?: string): string {
  // RULES at top for maximum attention
  let prompt = `RULES (non-negotiable):
- ONE sentence only - no compound sentences
- Describe WHAT you see, not WHY it exists
- No: "as if", "as though", "suggesting", "seeming"
- Shape only - no colors, textures, or surface details
- REQUIRE structural elements: headgear, armor, tools, weapons, magical effects, scars, clothing
- Body language alone is NOT enough - there must be equipment or permanent body modifications`;

  // Add project-specific avoid list immediately after rules
  if (visualAvoid) {
    prompt += `

AVOID THESE (will cause rejection):
${visualAvoid}`;
  }

  prompt += `

You design characters for a fighting game roster or anime ensemble cast.

Each character must be INSTANTLY RECOGNIZABLE from silhouette alone - like Overwatch heroes, League of Legends champions, or My Hero Academia students. When you see 20 characters as solid black shapes at thumbnail size, each one must be unmistakable.

The visual thesis is the ONE THING that makes this character's shape unique in the roster.

THINK LIKE A CHARACTER DESIGNER:
- What's their "read" at thumbnail size?
- What silhouette element would a cosplayer exaggerate?
- If this were a fighting game select screen, what makes them pop?

SHAPE ELEMENTS (prioritize structural over gestural):
- Structural gear: oversized weapons, distinctive hats, floating objects, massive armor
- Profile extensions: mounted equipment, carried tools, backpacks, capes
- Body modifications: scars, missing limbs, unusual proportions, asymmetry
- Body shape: proportions, mass distribution (but NOT pose or gesture)

OUTPUT FORMAT:
Return JSON with key: visualThesis
- visualThesis: ONE sentence, the dominant shape signal`;

  // REWRITES section commented out - examples were teaching flipper gestures
  // REWRITES (causation → pure shape):
  // - "Flipper raised as if blessing" → "Flipper raised, palm-forward, frozen at chest height"
  // - "Hunched from years of labor" → "Shoulders drawn forward, spine curved into permanent stoop"
  // - "Scarred flank showing battles" → "Asymmetrical bulk, left side visibly larger"

  return prompt;
}

/**
 * Step 3: Visual traits prompt - 2-4 traits EXPANDING the visual identity
 * The thesis is the primary silhouette signal; traits add distinctive secondary features
 */
export function buildVisualTraitsPrompt(guidance?: TraitGuidance): string {
  let prompt = `You're completing a character design brief for an action figure or concept art.

The thesis defines the PRIMARY silhouette. Your job is to add 2-4 ADDITIONAL distinctive features that make this character unique - things the thesis didn't cover.

Think action figure accessories: what extra details would the toy include? What would make collectors say "that's definitely [character name]"?

TRAITS SHOULD ADD, NOT REPEAT:
- If thesis mentions robes → traits could add floating orbs, glowing eyes, unusual footwear
- If thesis mentions armor → traits could add trophy skulls, ritual scars, bound weapons
- Find what's MISSING from the thesis that would make the design more distinctive

RULES:
- 2-4 traits only, each 3-8 words
- Each trait adds something NEW to the visual identity
- Draw from the description for ideas the thesis missed
- Mix body features and equipment`;

  if (guidance && guidance.assignedCategories.length > 0) {
    prompt += `

DIRECTIONS TO EXPLORE (not constraints):
${guidance.assignedCategories.map(p => `
### ${p.category}
${p.description}
Examples: ${p.examples.join(' · ')}`).join('\n')}

Use these as inspiration. You may go beyond them if the description suggests something more distinctive.`;
  }

  prompt += `

OUTPUT: Return JSON only. No prose. No explanation.
{ "visualTraits": ["trait 1", "trait 2", "trait 3"] }`;

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

  // Use configured model (user controls whether it's thinking or not)
  const model = config.textModel || 'claude-sonnet-4-20250514';

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

  // Strip output format instructions from task.prompt - each step has its own format
  const entityContext = task.prompt
    .replace(/OUTPUT FORMAT.*$/s, '')
    .replace(/FORMAT:\s*\n.*$/s, '')
    .trim();

  const narrativeResult = await llmClient.complete({
    systemPrompt: buildNarrativePrompt(),
    prompt: entityContext,
    model,
    maxTokens: 1024,
    temperature: 0.7,
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
    totalActualCost += calculateActualTextCost(narrativeResult.usage.inputTokens, narrativeResult.usage.outputTokens, model);
  }

  // ============================================================================
  // Step 2: Visual Thesis (given description)
  // ============================================================================
  console.log('[Worker] Description chain step 2: Visual Thesis');

  // Build slimmed down visual context - remove noise that doesn't inform silhouette
  // Extract only: entity basics, world, era (skip tags, relationships, tone, constraints)
  const worldMatch = entityContext.match(/WORLD:\s*(.+?)(?:\n\n|\nENTITY:)/s);
  const eraMatch = entityContext.match(/ERA:\s*(.+?)(?:\n---|$)/s);
  const worldContext = worldMatch ? worldMatch[1].trim() : '';
  const eraContext = eraMatch ? eraMatch[1].trim() : '';

  const visualContext = `Entity: ${task.entityName} (${task.entityKind})
Culture: ${task.entityCulture || 'unaffiliated'}
World: ${worldContext}
Era: ${eraContext}`;

  const thesisPrompt = `${visualContext}

DESCRIPTION (extract visual elements from this):
${narrativePayload.description}

Generate the visual thesis - focus on structural elements, not gestures or poses.`;

  const thesisResult = await llmClient.complete({
    systemPrompt: buildVisualThesisPrompt(task.visualAvoid),
    prompt: thesisPrompt,
    model,
    maxTokens: 256,
    temperature: 0.7,
  });
  chainDebug.thesis = thesisResult.debug;

  if (isAborted()) {
    return { success: false, error: 'Task aborted', debug: thesisResult.debug };
  }

  if (thesisResult.error || !thesisResult.text) {
    return { success: false, error: `Visual thesis step failed: ${thesisResult.error || 'Empty response'}`, debug: thesisResult.debug };
  }

  // Parse thesis response
  let visualThesis = '';
  try {
    const parsed = parseJsonField<Record<string, unknown>>(thesisResult.text, 'visualThesis');
    visualThesis = typeof parsed.visualThesis === 'string' ? parsed.visualThesis.trim() : '';
    if (!visualThesis) {
      throw new Error('Missing visualThesis');
    }
  } catch (err) {
    return {
      success: false,
      error: `Visual thesis parse failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
      debug: thesisResult.debug,
    };
  }

  // Accumulate costs
  if (thesisResult.usage) {
    totalInputTokens += thesisResult.usage.inputTokens;
    totalOutputTokens += thesisResult.usage.outputTokens;
    totalActualCost += calculateActualTextCost(thesisResult.usage.inputTokens, thesisResult.usage.outputTokens, model);
  }

  // ============================================================================
  // Step 3: Visual Traits (given thesis + palette guidance)
  // ============================================================================
  console.log('[Worker] Description chain step 3: Visual Traits');

  // Fetch trait guidance for diversity (run-scoped avoidance, project-scoped palette)
  let traitGuidance: TraitGuidance | undefined;
  try {
    if (task.projectId && task.simulationRunId && task.entityKind) {
      traitGuidance = await getTraitGuidance(
        task.projectId,
        task.simulationRunId,
        task.entityKind
      );
    }
  } catch (err) {
    // Non-fatal - continue without guidance
    console.warn('[Worker] Failed to fetch trait guidance:', err);
  }

  const traitsPrompt = `THESIS (the primary silhouette - don't repeat, expand):
${visualThesis}

${visualContext}

DESCRIPTION (source material for additional distinctive features):
${narrativePayload.description}

Generate 2-4 visual traits that ADD to the thesis - features it didn't cover.`;

  const traitsResult = await llmClient.complete({
    systemPrompt: buildVisualTraitsPrompt(traitGuidance),
    prompt: traitsPrompt,
    model,
    maxTokens: 512,
    temperature: 0.7,
  });
  chainDebug.traits = traitsResult.debug;

  if (isAborted()) {
    return { success: false, error: 'Task aborted', debug: traitsResult.debug };
  }

  if (traitsResult.error || !traitsResult.text) {
    return { success: false, error: `Visual traits step failed: ${traitsResult.error || 'Empty response'}`, debug: traitsResult.debug };
  }

  // Parse traits response
  let visualTraits: string[] = [];
  try {
    const parsed = parseJsonField<Record<string, unknown>>(traitsResult.text, 'visualTraits');
    visualTraits = Array.isArray(parsed.visualTraits)
      ? parsed.visualTraits.filter((t): t is string => typeof t === 'string').map(t => t.trim()).filter(Boolean)
      : [];
  } catch (err) {
    return {
      success: false,
      error: `Visual traits parse failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
      debug: traitsResult.debug,
    };
  }

  // Accumulate costs
  if (traitsResult.usage) {
    totalInputTokens += traitsResult.usage.inputTokens;
    totalOutputTokens += traitsResult.usage.outputTokens;
    totalActualCost += calculateActualTextCost(traitsResult.usage.inputTokens, traitsResult.usage.outputTokens, model);
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

  // Calculate estimated cost (for comparison)
  const estimate = estimateTextCost(task.prompt, 'description', model);

  // Save cost record with combined totals
  await saveCostRecord({
    id: generateCostId(),
    timestamp: Date.now(),
    projectId: task.projectId,
    simulationRunId: task.simulationRunId,
    entityId: task.entityId,
    entityName: task.entityName,
    entityKind: task.entityKind,
    type: 'description' as CostType,
    model,
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
      model,
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
  const textModel = config.chronicleModel || config.textModel || 'claude-sonnet-4-20250514';
  console.log(`[Worker] Chronicle step=${step} for entity=${task.entityId}, model=${textModel}`);

  // V2 single-shot generation - primary generation path
  if (step === 'generate_v2') {
    if (!task.chronicleContext) {
      return { success: false, error: 'Chronicle context required for generate_v2 step' };
    }
    return executeV2GenerationStep(task, config, llmClient, isAborted, textModel);
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
    return executeEditStep(task, chronicleRecord, config, llmClient, isAborted, textModel);
  }

  if (step === 'summary') {
    if (!task.chronicleContext) {
      return { success: false, error: 'Chronicle context required for summary step' };
    }
    return executeSummaryStep(task, chronicleRecord, config, llmClient, isAborted, textModel);
  }

  if (step === 'image_refs') {
    if (!task.chronicleContext) {
      return { success: false, error: 'Chronicle context required for image refs step' };
    }
    return executeImageRefsStep(task, chronicleRecord, config, llmClient, isAborted, textModel);
  }

  if (step === 'prose_blend') {
    if (!task.chronicleContext) {
      return { success: false, error: 'Chronicle context required for prose blend step' };
    }
    return executeProseBlendStep(task, chronicleRecord, config, llmClient, isAborted, textModel);
  }

  if (step === 'validate') {
    if (!task.chronicleContext) {
      return { success: false, error: 'Chronicle context required for validate step' };
    }
    return executeValidateStep(task, chronicleRecord, config, llmClient, isAborted, textModel);
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

  if (!task.chronicleId) {
    return { success: false, error: 'chronicleId required for generate_v2 step' };
  }

  const chronicleId = task.chronicleId;
  console.log(`[Worker] V2 generation for chronicle=${chronicleId}, style="${narrativeStyle.name}"`);

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
  // (in useChronicleGeneration.ts acceptChronicle) to avoid double-bracketing issues.

  // Calculate cost
  const cost = {
    estimated: estimate.estimatedCost,
    actual: result.usage
      ? calculateActualTextCost(result.usage.inputTokens, result.usage.outputTokens, textModel)
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
      model: textModel,
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
    model: textModel,
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
  chronicleRecord: Awaited<ReturnType<typeof getChronicle>>,
  config: WorkerConfig,
  llmClient: LLMClient,
  isAborted: () => boolean,
  textModel: string
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

  console.log('[Worker] Editing chronicle based on validation feedback...');

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
    model: textModel,
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
  isAborted: () => boolean,
  textModel: string
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

  console.log('[Worker] Validating cohesion...');
  const validationPrompt = buildV2ValidationPrompt(chronicleRecord.assembledContent, context, narrativeStyle);
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
    model: textModel,
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
      model: textModel,
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
    .map((entity) => `- ${entity.id}: ${entity.name}`)
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
  context: ChronicleGenerationContext
): string {
  const entityList = formatImageRefEntities(context);
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

function buildProseBlendPrompt(content: string): string {
  return `Rewrite the chronicle into a more cohesive, freeform narrative while keeping ALL relevant details.
Rules:
- Preserve names, dates, facts, and outcomes.
- Avoid dropping any information.
- Smooth transitions and remove outline-like phrasing.
- If the text is already a discrete document (letter, decree, log), keep that form and polish the prose.
Return ONLY the rewritten chronicle content.

Chronicle:
${content}`;
}

async function executeSummaryStep(
  task: WorkerTask,
  chronicleRecord: Awaited<ReturnType<typeof getChronicle>>,
  config: WorkerConfig,
  llmClient: LLMClient,
  isAborted: () => boolean,
  textModel: string
): Promise<TaskResult> {
  if (!chronicleRecord) {
    return { success: false, error: 'Chronicle record missing for summary' };
  }
  if (!chronicleRecord.assembledContent) {
    return { success: false, error: 'Chronicle has no assembled content to summarize' };
  }

  const chronicleId = chronicleRecord.chronicleId;
  const summaryPrompt = buildSummaryPrompt(chronicleRecord.assembledContent);
  const summaryEstimate = estimateTextCost(summaryPrompt, 'description', textModel);

  const summaryResult = await llmClient.complete({
    systemPrompt: 'You are a careful editor who writes concise, faithful summaries. Always respond with valid JSON.',
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
      ? calculateActualTextCost(summaryResult.usage.inputTokens, summaryResult.usage.outputTokens, textModel)
      : summaryEstimate.estimatedCost,
    inputTokens: summaryResult.usage?.inputTokens || summaryEstimate.inputTokens,
    outputTokens: summaryResult.usage?.outputTokens || summaryEstimate.outputTokens,
  };

  await updateChronicleSummary(chronicleId, summaryText, summaryCost, textModel, title);

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
    model: textModel,
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
  chronicleRecord: Awaited<ReturnType<typeof getChronicle>>,
  config: WorkerConfig,
  llmClient: LLMClient,
  isAborted: () => boolean,
  textModel: string
): Promise<TaskResult> {
  if (!chronicleRecord) {
    return { success: false, error: 'Chronicle record missing for image refs' };
  }
  if (!chronicleRecord.assembledContent) {
    return { success: false, error: 'Chronicle has no assembled content for image refs' };
  }

  const chronicleId = chronicleRecord.chronicleId;
  const context = deserializeChronicleContext(task.chronicleContext!);
  const imageRefsPrompt = buildImageRefsPrompt(chronicleRecord.assembledContent, context);
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

  await updateChronicleImageRefs(chronicleId, imageRefs, imageRefsCost, textModel);

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
    model: textModel,
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
  chronicleRecord: Awaited<ReturnType<typeof getChronicle>>,
  config: WorkerConfig,
  llmClient: LLMClient,
  isAborted: () => boolean,
  textModel: string
): Promise<TaskResult> {
  if (!chronicleRecord) {
    return { success: false, error: 'Chronicle record missing for prose blending' };
  }
  if (!chronicleRecord.assembledContent) {
    return { success: false, error: 'Chronicle has no assembled content to blend' };
  }

  const chronicleId = chronicleRecord.chronicleId;
  const blendPrompt = buildProseBlendPrompt(chronicleRecord.assembledContent);
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

  await updateChronicleProseBlend(chronicleId, blendedContent, blendCost, textModel);

  await saveCostRecord({
    id: generateCostId(),
    timestamp: Date.now(),
    projectId: task.projectId,
    simulationRunId: task.simulationRunId,
    entityId: task.entityId,
    entityName: task.entityName,
    entityKind: task.entityKind,
    chronicleId,
    type: 'chronicleProseBlend' as CostType,
    model: textModel,
    estimatedCost: blendCost.estimated,
    actualCost: blendCost.actual,
    inputTokens: blendCost.inputTokens,
    outputTokens: blendCost.outputTokens,
  });

  return {
    success: true,
    result: {
      chronicleId,
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

// ============================================================================
// Palette Expansion Task
// ============================================================================

const PALETTE_EXPANSION_SYSTEM_PROMPT = `You curate visual trait palettes for worldbuilding. Each category gets assigned to entities to ensure visual diversity.

THUMBNAIL TEST (critical):
If two categories would look similar when rendered as 128px thumbnails or black silhouettes, they are NOT orthogonal.
- FAIL: "Weathered Feathers" vs "Environmental Scarring" → both produce worn-looking entities
- FAIL: "Ceremonial Gear" vs "Technological Adornments" → both add stuff to the body
- PASS: "Asymmetric Build" vs "Gait Abnormality" → one changes shape, one changes motion

THINK LIKE A RENDERER:
Each category must create a distinct: silhouette, motion profile, spatial footprint, or high-contrast signal.
Color/hue differences alone are insufficient. Semantic differences are insufficient.
Ask: "Would an artist draw these differently?"

MUNDANE MATTERS:
The most memorable characters have simple, drawable distinctions: a missing finger, a pronounced limp, sun-weathered skin, a distinctive hat.
Ground categories in what survives stylization.`;

interface CultureContext {
  name: string;
  description?: string;
  visualIdentity?: Record<string, string>;
}

function buildPaletteExpansionPrompt(
  entityKind: string,
  worldContext: string,
  currentPalette: PaletteItem[],
  _historicalTraits: string[], // Unused in new approach
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

  // Current palette summary
  let paletteSection = '';
  if (currentPalette.length > 0) {
    const lines = currentPalette.map(p => `- [${p.id}] "${p.category}" (used ${p.timesUsed}x)`);
    paletteSection = `\nCurrent categories (${currentPalette.length}):\n${lines.join('\n')}\n`;
  }

  // Dimension hints based on entity type
  const dimensionHints = entityKind === 'location'
    ? 'shape/architecture, surface/texture, condition/age, atmosphere, activity, cultural markers'
    : 'body shape, surface patterns, condition/scars, movement/gait, equipment, presence/aura';

  return `Curate a visual trait palette for "${entityKind}" entities.

WORLD: ${worldContext || 'A fantasy world.'}
${cultureSection}${paletteSection}
TASK:
${currentPalette.length === 0
    ? `Create 6-8 initial categories spanning different visual dimensions (${dimensionHints}).`
    : `Review the ${currentPalette.length} existing categories. Remove overlapping ones, then add categories for underrepresented dimensions.`}

Each category must pass the SILHOUETTE TEST:
- Would this trait be visible in a black silhouette or simple animation?
- Would an artist draw this differently from other categories?
- Does this change shape, motion, or spatial presence (not just color/texture)?

DIMENSION BOUNDARIES:
- SURFACE = patterns, materials, textures (NOT damage or wear)
- CONDITION = damage, aging, scars, modifications (NOT patterns)
- EQUIPMENT = items that change the outline/negative space (NOT decorative detail)

GOOD CATEGORIES (each reads differently at thumbnail size):
- "Limb Asymmetry" — missing/extra/malformed limbs, uneven proportions
- "Occupational Deformation" — specific muscle development, repetitive stress changes
- "Mobility Impairment" — limps, favoring sides, compensatory movements
- "Spatial Presence" — personal space behavior, how they occupy a room

OUTPUT (JSON only):
{
  "removedCategories": ["palette_id_1"],
  "mergedCategories": [{"keepId": "palette_x", "mergeFromIds": ["palette_y"], "newDescription": "..."}],
  "newCategories": [
    {"category": "Name", "description": "What this means", "examples": ["example 1", "example 2", "example 3"]}
  ]
}`;
}

interface PaletteExpansionResponse {
  removedCategories?: string[];
  mergedCategories?: Array<{
    keepId: string;
    mergeFromIds: string[];
    newDescription: string;
  }>;
  newCategories?: Array<{
    category: string;
    description: string;
    examples: string[];
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

  return {
    removedCategories: Array.isArray(parsed.removedCategories)
      ? parsed.removedCategories.filter((id: unknown) => typeof id === 'string')
      : [],
    mergedCategories: Array.isArray(parsed.mergedCategories)
      ? parsed.mergedCategories.filter((m: unknown) =>
          m && typeof m === 'object' &&
          typeof (m as Record<string, unknown>).keepId === 'string'
        )
      : [],
    newCategories: Array.isArray(parsed.newCategories)
      ? parsed.newCategories.filter((c: unknown) =>
          c && typeof c === 'object' &&
          typeof (c as Record<string, unknown>).category === 'string'
        )
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

  // Use thinking model for palette curation (complex reasoning task)
  const thinkingModel = config.thinkingModel || 'claude-sonnet-4-5-20250929';
  const thinkingBudget = config.thinkingBudget ?? 8192;

  // Gather current state
  const currentPalette = await getPalette(task.projectId, entityKind);
  const historicalTraits = await getHistoricalTraits(task.projectId, entityKind);

  const prompt = buildPaletteExpansionPrompt(
    entityKind,
    worldContext,
    currentPalette?.items || [],
    historicalTraits,
    task.paletteCultureContext
  );

  const estimate = estimateTextCost(prompt, 'description', thinkingModel);

  // max_tokens must be > thinking budget; add response budget on top
  const responseBudget = 4096;
  const totalMaxTokens = thinkingBudget > 0 ? thinkingBudget + responseBudget : responseBudget;

  const result = await llmClient.complete({
    systemPrompt: PALETTE_EXPANSION_SYSTEM_PROMPT,
    prompt,
    model: thinkingModel,
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

  // Apply updates
  await updatePaletteItems(task.projectId, entityKind, {
    removeIds: expansion.removedCategories,
    merges: expansion.mergedCategories,
    newItems: expansion.newCategories,
  });

  // Calculate costs
  const inputTokens = result.usage?.inputTokens || estimate.inputTokens;
  const outputTokens = result.usage?.outputTokens || estimate.outputTokens;
  const actualCost = result.usage
    ? calculateActualTextCost(inputTokens, outputTokens, thinkingModel)
    : estimate.estimatedCost;

  // Save cost record
  await saveCostRecord({
    id: generateCostId(),
    timestamp: Date.now(),
    projectId: task.projectId,
    simulationRunId: task.simulationRunId,
    type: 'paletteExpansion' as CostType,
    model: thinkingModel,
    estimatedCost: estimate.estimatedCost,
    actualCost,
    inputTokens,
    outputTokens,
  });

  return {
    success: true,
    result: {
      generatedAt: Date.now(),
      model: thinkingModel,
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
