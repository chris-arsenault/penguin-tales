import type { WorkerTask, DescriptionChainDebug } from '../../lib/enrichmentTypes';
import { estimateTextCost, calculateActualTextCost } from '../../lib/costEstimation';
import { saveCostRecord, generateCostId, type CostType } from '../../lib/costStorage';
import {
  getTraitGuidance,
  registerUsedTraits,
  incrementPaletteUsage,
  type TraitGuidance,
} from '../../lib/traitRegistry';
import { calcTokenBudget } from '../../lib/llmBudget';
import { getCallConfig } from './llmCallConfig';
import { stripLeadingWrapper, extractFirstJsonObject } from './textParsing';
import type { TaskHandler } from './taskTypes';

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

// ============================================================================
// Chain Prompts: Narrative -> Visual Thesis -> Visual Traits
// ============================================================================

/**
 * Step 1: Narrative prompt - rich description, summary, aliases
 * This is the creative writing step - prioritize personality, relationships, legacy
 */
function buildNarrativePrompt(): string {
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
function buildVisualThesisPrompt(
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
function buildVisualTraitsPrompt(
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
Examples: ${p.examples.join(', ')}`).join('\n')}

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

export const descriptionTask = {
  type: 'description',
  async execute(task, context) {
    const { config, llmClient, isAborted } = context;

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

    const narrativeConfig = getCallConfig(config, 'description.narrative');
    const { totalMaxTokens: narrativeMaxTokens, thinkingBudget: narrativeThinking } = calcTokenBudget(narrativeConfig, 1024);

    // Strip output format instructions from task.prompt - each step has its own format
    const entityContext = task.prompt
      .replace(/OUTPUT FORMAT.*$/s, '')
      .replace(/FORMAT:\s*\n.*$/s, '')
      .trim();

    const narrativeResult = await llmClient.complete({
      systemPrompt: buildNarrativePrompt(),
      prompt: entityContext,
      model: narrativeConfig.model,
      maxTokens: narrativeMaxTokens,
      temperature: 0.7,
      thinkingBudget: narrativeThinking,
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
      totalActualCost += calculateActualTextCost(narrativeResult.usage.inputTokens, narrativeResult.usage.outputTokens, narrativeConfig.model);
    }

    // ============================================================================
    // Step 2: Visual Thesis (given description)
    // ============================================================================
    console.log('[Worker] Description chain step 2: Visual Thesis');

    const thesisConfig = getCallConfig(config, 'description.visualThesis');
    const { totalMaxTokens: thesisMaxTokens, thinkingBudget: thesisThinking } = calcTokenBudget(thesisConfig, 256);

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
      model: thesisConfig.model,
      maxTokens: thesisMaxTokens,
      temperature: 0.7,
      thinkingBudget: thesisThinking,
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
      totalActualCost += calculateActualTextCost(thesisResult.usage.inputTokens, thesisResult.usage.outputTokens, thesisConfig.model);
    }

    // ============================================================================
    // Step 3: Visual Traits (given thesis + palette guidance)
    // ============================================================================
    console.log('[Worker] Description chain step 3: Visual Traits');

    const traitsConfig = getCallConfig(config, 'description.visualTraits');
    const { totalMaxTokens: traitsMaxTokens, thinkingBudget: traitsThinking } = calcTokenBudget(traitsConfig, 512);

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
      model: traitsConfig.model,
      maxTokens: traitsMaxTokens,
      temperature: 0.7,
      thinkingBudget: traitsThinking,
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
    .map(line => line.replace(/^[-*\u2022]\s*/, '').trim())  // Strip bullet markers
    .filter(line => line.length > 0);  // Filter empty lines

    // Accumulate costs
    if (traitsResult.usage) {
      totalInputTokens += traitsResult.usage.inputTokens;
      totalOutputTokens += traitsResult.usage.outputTokens;
      totalActualCost += calculateActualTextCost(traitsResult.usage.inputTokens, traitsResult.usage.outputTokens, traitsConfig.model);
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
    const estimate = estimateTextCost(task.prompt, 'description', narrativeConfig.model);

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
      model: narrativeConfig.model,
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
        model: narrativeConfig.model,  // Primary model for display
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
  },
} satisfies TaskHandler<WorkerTask & { type: 'description' }>;
