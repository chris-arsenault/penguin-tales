/**
 * Trait Palette Expansion
 *
 * LLM-powered generation of novel visual trait categories.
 * Includes deduplication of existing palette items.
 */

import { LLMClient } from './llmClient';
import {
  getPalette,
  updatePaletteItems,
  getHistoricalTraits,
  countUsedTraits,
  type TraitPalette,
  type PaletteItem,
} from './traitRegistry';
import { saveCostRecord, generateCostId } from './costStorage';
import { estimateTextCost, calculateActualTextCost } from './costEstimation';

// ============================================================================
// Types
// ============================================================================

export interface PaletteExpansionRequest {
  projectId: string;
  entityKind: string;
  worldContext: string;         // Brief world description for tone
  simulationRunId?: string;     // For cost tracking
}

export interface PaletteExpansionResult {
  success: boolean;
  palette?: TraitPalette;
  error?: string;
  stats?: {
    removed: number;
    merged: number;
    added: number;
  };
  cost?: {
    estimated: number;
    actual: number;
    inputTokens: number;
    outputTokens: number;
  };
}

interface ExpansionResponse {
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

// ============================================================================
// Prompt Building
// ============================================================================

function buildExpansionPrompt(
  entityKind: string,
  worldContext: string,
  currentPalette: PaletteItem[],
  historicalTraits: string[]
): string {
  const paletteSection = currentPalette.length > 0
    ? currentPalette.map(p =>
      `- [${p.id}] ${p.category} (used ${p.timesUsed}x): ${p.description}`
    ).join('\n')
    : '(no categories yet)';

  // Dedupe and limit historical traits
  const uniqueTraits = [...new Set(historicalTraits)];
  const traitSample = uniqueTraits.slice(0, 50);
  const traitsSection = traitSample.length > 0
    ? traitSample.map(t => `- ${t}`).join('\n')
    : '(no traits generated yet)';

  return `You are designing a VISUAL TRAIT PALETTE for "${entityKind}" entities.

## World Context
${worldContext}

## Current Palette Categories
${paletteSection}

## Traits Already Generated (avoid similarity to these)
${traitsSection}
${uniqueTraits.length > 50 ? `\n... and ${uniqueTraits.length - 50} more` : ''}

## Your Task

1. **DEDUPLICATE**: Review current categories. If any overlap significantly or are too similar, mark them for removal or merging. Be aggressive - fewer distinct categories is better than many overlapping ones.

2. **EXPAND**: Add 5-8 NEW categories that are COMPLETELY DIFFERENT from:
   - The existing palette categories
   - The traits already generated

3. **GRANDIOSITY**: Every category MUST produce traits that are:
   - Impossible to overlook - visible across a battlefield or plaza
   - Unique silhouettes - distinguishable in shadow or at great distance
   - Bold physical manifestations - NOT subtle coloring or minor details
   - Memorable enough to identify an entity by ONE trait alone

Think about what makes "${entityKind}" entities visually distinctive in this world. Consider:
- Physical form and structure
- Supernatural or magical manifestations
- Environmental effects they create
- Adornments, modifications, or missing elements
- Scale, proportion, and silhouette
- Movement and presence

## Output Format (JSON only, no markdown)

{
  "removedCategories": ["id1", "id2"],
  "mergedCategories": [
    {
      "keepId": "palette_xxx",
      "mergeFromIds": ["palette_yyy"],
      "newDescription": "Combined description covering both"
    }
  ],
  "newCategories": [
    {
      "category": "Gravitational Anomalies",
      "description": "Physical distortions in how weight and mass manifest around this entity",
      "examples": [
        "Small objects orbit slowly around their head in a lazy halo",
        "Their footsteps crack stone despite a slight, wiry build",
        "Their cloak billows perpetually upward as if underwater"
      ]
    }
  ]
}

Return ONLY valid JSON. No explanation, no markdown code blocks.`;
}

const EXPANSION_SYSTEM_PROMPT = `You are a visual design consultant specializing in distinctive character and entity design. Your goal is to create trait categories that produce INSTANTLY RECOGNIZABLE visual features - the kind an artist needs to make each entity unmistakable at a glance.

Avoid:
- Subtle variations (eye color, minor scars, slight differences)
- Generic fantasy tropes unless truly distinctive
- Traits that require close inspection to notice
- Similar categories that would produce overlapping results

Prefer:
- Dramatic, impossible-to-miss features
- Supernatural or physics-defying manifestations
- Unique silhouettes and body shapes
- Environmental effects visible from a distance`;

// ============================================================================
// Response Parsing
// ============================================================================

function extractFirstJsonObject(text: string): string | null {
  let inString = false;
  let escaped = false;
  let depth = 0;
  let start = -1;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
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
      if (depth === 0) start = i;
      depth++;
    } else if (char === '}') {
      depth--;
      if (depth === 0 && start !== -1) {
        return text.slice(start, i + 1);
      }
    }
  }

  return null;
}

function parseExpansionResponse(text: string): ExpansionResponse {
  const jsonStr = extractFirstJsonObject(text);
  if (!jsonStr) {
    throw new Error('No JSON object found in expansion response');
  }

  const parsed = JSON.parse(jsonStr);

  // Validate structure
  const result: ExpansionResponse = {
    removedCategories: [],
    mergedCategories: [],
    newCategories: [],
  };

  if (Array.isArray(parsed.removedCategories)) {
    result.removedCategories = parsed.removedCategories.filter(
      (id: unknown) => typeof id === 'string'
    );
  }

  if (Array.isArray(parsed.mergedCategories)) {
    result.mergedCategories = parsed.mergedCategories
      .filter((m: unknown) =>
        m && typeof m === 'object' &&
        typeof (m as Record<string, unknown>).keepId === 'string' &&
        Array.isArray((m as Record<string, unknown>).mergeFromIds)
      )
      .map((m: Record<string, unknown>) => ({
        keepId: m.keepId as string,
        mergeFromIds: (m.mergeFromIds as unknown[]).filter(id => typeof id === 'string') as string[],
        newDescription: typeof m.newDescription === 'string' ? m.newDescription : '',
      }));
  }

  if (Array.isArray(parsed.newCategories)) {
    result.newCategories = parsed.newCategories
      .filter((c: unknown) =>
        c && typeof c === 'object' &&
        typeof (c as Record<string, unknown>).category === 'string' &&
        typeof (c as Record<string, unknown>).description === 'string'
      )
      .map((c: Record<string, unknown>) => ({
        category: c.category as string,
        description: c.description as string,
        examples: Array.isArray(c.examples)
          ? (c.examples as unknown[]).filter(e => typeof e === 'string') as string[]
          : [],
      }));
  }

  return result;
}

// ============================================================================
// Expansion Execution
// ============================================================================

export async function expandPalette(
  request: PaletteExpansionRequest,
  llmClient: LLMClient,
  textModel: string
): Promise<PaletteExpansionResult> {
  const { projectId, entityKind, worldContext } = request;

  if (!llmClient.isEnabled()) {
    return { success: false, error: 'LLM client not configured' };
  }

  // Gather current state
  const currentPalette = await getPalette(projectId, entityKind);
  const historicalTraits = await getHistoricalTraits(projectId, entityKind);

  const prompt = buildExpansionPrompt(
    entityKind,
    worldContext,
    currentPalette?.items || [],
    historicalTraits
  );

  const estimate = estimateTextCost(prompt, 'description', textModel);

  // Call LLM
  const result = await llmClient.complete({
    systemPrompt: EXPANSION_SYSTEM_PROMPT,
    prompt,
    model: textModel,
    maxTokens: 4096,
    temperature: 0.9,
  });

  if (result.error || !result.text) {
    return {
      success: false,
      error: result.error || 'Empty response from LLM',
    };
  }

  // Parse response
  let expansion: ExpansionResponse;
  try {
    expansion = parseExpansionResponse(result.text);
  } catch (err) {
    return {
      success: false,
      error: `Failed to parse expansion response: ${err instanceof Error ? err.message : 'Unknown error'}`,
    };
  }

  // Apply updates
  const updatedPalette = await updatePaletteItems(projectId, entityKind, {
    removeIds: expansion.removedCategories,
    merges: expansion.mergedCategories,
    newItems: expansion.newCategories,
  });

  // Calculate costs
  const inputTokens = result.usage?.inputTokens || estimate.inputTokens;
  const outputTokens = result.usage?.outputTokens || estimate.outputTokens;
  const actualCost = result.usage
    ? calculateActualTextCost(inputTokens, outputTokens, textModel)
    : estimate.estimatedCost;

  const cost = {
    estimated: estimate.estimatedCost,
    actual: actualCost,
    inputTokens,
    outputTokens,
  };

  // Save cost record
  await saveCostRecord({
    id: generateCostId(),
    timestamp: Date.now(),
    projectId,
    simulationRunId: request.simulationRunId,
    type: 'paletteExpansion',
    model: textModel,
    estimatedCost: cost.estimated,
    actualCost: cost.actual,
    inputTokens: cost.inputTokens,
    outputTokens: cost.outputTokens,
  });

  return {
    success: true,
    palette: updatedPalette,
    stats: {
      removed: expansion.removedCategories?.length || 0,
      merged: expansion.mergedCategories?.length || 0,
      added: expansion.newCategories?.length || 0,
    },
    cost,
  };
}

// ============================================================================
// Auto-Trigger Check
// ============================================================================

export interface AutoExpandCheck {
  shouldExpand: boolean;
  reason?: string;
}

const AUTO_EXPAND_TRAIT_THRESHOLD = 20;
const AUTO_EXPAND_MIN_PALETTE_SIZE = 5;
const AUTO_EXPAND_STALE_MS = 24 * 60 * 60 * 1000; // 24 hours

export async function shouldAutoExpandPalette(
  projectId: string,
  entityKind: string
): Promise<AutoExpandCheck> {
  const usedCount = await countUsedTraits(projectId, entityKind);
  const palette = await getPalette(projectId, entityKind);

  // Not enough usage to warrant expansion
  if (usedCount < AUTO_EXPAND_TRAIT_THRESHOLD) {
    return { shouldExpand: false };
  }

  // Palette doesn't exist or is too small
  if (!palette || palette.items.length < AUTO_EXPAND_MIN_PALETTE_SIZE) {
    return {
      shouldExpand: true,
      reason: `Palette has ${palette?.items.length || 0} categories, needs at least ${AUTO_EXPAND_MIN_PALETTE_SIZE}`,
    };
  }

  // Palette is stale
  const age = Date.now() - palette.updatedAt;
  if (age > AUTO_EXPAND_STALE_MS) {
    return {
      shouldExpand: true,
      reason: `Palette last updated ${Math.round(age / (60 * 60 * 1000))} hours ago`,
    };
  }

  return { shouldExpand: false };
}

// ============================================================================
// Convenience Wrapper
// ============================================================================

/**
 * Check if auto-expansion is needed and perform it if so.
 * Safe to call frequently - will no-op if expansion not needed.
 */
export async function maybeExpandPalette(
  request: PaletteExpansionRequest,
  llmClient: LLMClient,
  textModel: string
): Promise<PaletteExpansionResult | null> {
  const check = await shouldAutoExpandPalette(request.projectId, request.entityKind);

  if (!check.shouldExpand) {
    return null;
  }

  console.log(`[TraitPalette] Auto-expanding palette for ${request.entityKind}: ${check.reason}`);
  return expandPalette(request, llmClient, textModel);
}
