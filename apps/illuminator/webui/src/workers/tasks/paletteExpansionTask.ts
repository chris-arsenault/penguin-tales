import type { WorkerTask } from '../../lib/enrichmentTypes';
import { estimateTextCost, calculateActualTextCost } from '../../lib/costEstimation';
import { saveCostRecord, generateCostId, type CostType } from '../../lib/costStorage';
import { updatePaletteItems } from '../../lib/traitRegistry';
import { calcTokenBudget } from '../../lib/llmBudget';
import { getCallConfig } from './llmCallConfig';
import type { TaskHandler } from './taskTypes';

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
      return `- ${parts.join(' - ')}`;
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
    const eraLines = eras.map(e => `- ${e.id}: "${e.name}"${e.description ? ` - ${e.description}` : ''}`).join('\n');
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

export const paletteExpansionTask = {
  type: 'paletteExpansion',
  async execute(task, context) {
    const { config, llmClient, isAborted } = context;

    if (!llmClient.isEnabled()) {
      return { success: false, error: 'LLM client not configured' };
    }

    const entityKind = task.paletteEntityKind;
    const worldContext = task.paletteWorldContext || '';

    if (!entityKind) {
      return { success: false, error: 'Entity kind required for palette expansion' };
    }

    // Use per-call settings for palette expansion
    const callConfig = getCallConfig(config, 'palette.expansion');

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

    const estimate = estimateTextCost(prompt, 'description', callConfig.model);
    const { totalMaxTokens, thinkingBudget } = calcTokenBudget(callConfig, 4096);

    const result = await llmClient.complete({
      systemPrompt: PALETTE_EXPANSION_SYSTEM_PROMPT,
      prompt,
      model: callConfig.model,
      maxTokens: totalMaxTokens,
      thinkingBudget,
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
      ? calculateActualTextCost(inputTokens, outputTokens, callConfig.model)
      : estimate.estimatedCost;

    // Save cost record
    await saveCostRecord({
      id: generateCostId(),
      timestamp: Date.now(),
      projectId: task.projectId,
      simulationRunId: task.simulationRunId,
      type: 'paletteExpansion' as CostType,
      model: callConfig.model,
      estimatedCost: estimate.estimatedCost,
      actualCost,
      inputTokens,
      outputTokens,
    });

    return {
      success: true,
      result: {
        generatedAt: Date.now(),
        model: callConfig.model,
        estimatedCost: estimate.estimatedCost,
        actualCost,
        inputTokens,
        outputTokens,
      },
      debug,
    };
  },
} satisfies TaskHandler<WorkerTask & { type: 'paletteExpansion' }>;
