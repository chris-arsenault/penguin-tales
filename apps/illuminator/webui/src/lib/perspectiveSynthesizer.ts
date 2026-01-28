/**
 * Perspective Synthesizer
 *
 * Synthesizes a world perspective brief from entity constellation analysis.
 * Uses LLM to generate a focused perspective that adjusts emphasis while
 * maintaining world coherence.
 */

import type { LLMClient } from './llmClient';
import type { EntityContext, EraContext } from './chronicleTypes';
import type { EntityConstellation } from './constellationAnalyzer';
import type { ResolvedLLMCallConfig } from './llmModelSettings';
import { runTextCall } from './llmTextCall';

// =============================================================================
// Types
// =============================================================================

/**
 * Canon fact with metadata for relevance scoring
 */
export interface CanonFactWithMetadata {
  id: string;
  text: string;

  // Relevance boosters
  relevantCultures: string[]; // ["nightshelf", "aurora_stack", "*"]
  relevantKinds: string[]; // ["artifact", "npc", "*"]
  relevantTags: string[]; // ["trade", "conflict", "magic"]
  relevantRelationships: string[]; // ["ally", "rival", "trade_partner"]

  // Base priority (0-1)
  basePriority: number;

  // Is this a core world truth that should never be excluded?
  isCore: boolean;
}

/**
 * Tone fragments for composable tone assembly
 */
export interface ToneFragments {
  // Always included (~200 words)
  core: string;

  // Included based on dominant culture (~100 words each)
  cultureOverlays: {
    nightshelf?: string;
    aurora_stack?: string;
    orca?: string;
    mixed?: string;
  };

  // Included based on entity kind focus (~80 words each)
  kindOverlays: {
    character?: string;
    place?: string;
    object?: string;
    event?: string;
    mixed?: string;
  };
}

/**
 * Scored fact for prioritization
 */
export interface ScoredFact {
  fact: CanonFactWithMetadata;
  score: number;
}

/**
 * Output of perspective synthesis
 */
export interface PerspectiveSynthesis {
  brief: string; // 150-200 words of perspective guidance
  prioritizedFactIds: string[]; // Fact IDs in order of relevance
  suggestedMotifs: string[]; // 2-3 short phrases for recurring themes
}

/**
 * Input for perspective synthesis
 */
export interface PerspectiveSynthesisInput {
  constellation: EntityConstellation;
  entities: EntityContext[];
  focalEra?: EraContext;
  factsWithMetadata: CanonFactWithMetadata[];
  toneFragments: ToneFragments;
}

/**
 * Full result including LLM usage
 */
export interface PerspectiveSynthesisResult {
  synthesis: PerspectiveSynthesis;
  assembledTone: string;
  prioritizedFacts: string[];
  usage: {
    inputTokens: number;
    outputTokens: number;
    actualCost: number;
  };
}

// =============================================================================
// Fact Scoring
// =============================================================================

/**
 * Score facts based on relevance to the entity constellation
 */
export function scoreFacts(
  facts: CanonFactWithMetadata[],
  constellation: EntityConstellation
): ScoredFact[] {
  return facts.map((fact) => {
    let score = fact.basePriority;

    // Culture boost
    if (
      fact.relevantCultures.includes('*') ||
      fact.relevantCultures.some((c) => constellation.cultures[c])
    ) {
      score += 0.2;
    }

    // Kind boost
    if (
      fact.relevantKinds.includes('*') ||
      fact.relevantKinds.some((k) => constellation.kinds[k])
    ) {
      score += 0.15;
    }

    // Tag boost
    const matchingTags = fact.relevantTags.filter((t) =>
      constellation.prominentTags.includes(t)
    );
    score += matchingTags.length * 0.1;

    // Relationship boost
    const matchingRels = fact.relevantRelationships.filter(
      (r) => constellation.relationshipKinds[r]
    );
    score += matchingRels.length * 0.1;

    // Conflict/trade boost
    if (
      fact.relevantTags.includes('conflict') ||
      fact.relevantRelationships.includes('enemy')
    ) {
      if (constellation.hasConflict) {
        score += 0.1;
      }
    }
    if (
      fact.relevantTags.includes('trade') ||
      fact.relevantRelationships.includes('trade_partner')
    ) {
      if (constellation.hasTrade) {
        score += 0.1;
      }
    }

    // Core facts get minimum floor
    if (fact.isCore) {
      score = Math.max(score, 0.8);
    }

    return { fact, score };
  });
}

// =============================================================================
// Tone Assembly
// =============================================================================

/**
 * Assemble tone from fragments based on constellation
 */
export function assembleTone(
  fragments: ToneFragments,
  constellation: EntityConstellation
): string {
  const parts: string[] = [fragments.core];

  // Add culture overlay
  if (constellation.cultureBalance === 'single' || constellation.cultureBalance === 'dominant') {
    const culture = constellation.dominantCulture;
    if (culture && fragments.cultureOverlays[culture as keyof typeof fragments.cultureOverlays]) {
      parts.push(
        `\nCULTURAL LENS (${culture.toUpperCase()}):\n` +
          fragments.cultureOverlays[culture as keyof typeof fragments.cultureOverlays]
      );
    }
  } else if (fragments.cultureOverlays.mixed) {
    parts.push(`\nCULTURAL LENS (CROSS-CULTURAL):\n` + fragments.cultureOverlays.mixed);
  }

  // Add kind overlay
  if (constellation.kindFocus !== 'mixed') {
    const kindOverlay =
      fragments.kindOverlays[constellation.kindFocus as keyof typeof fragments.kindOverlays];
    if (kindOverlay) {
      parts.push(
        `\nFOCUS LENS (${constellation.kindFocus.toUpperCase()}):\n` + kindOverlay
      );
    }
  } else if (fragments.kindOverlays.mixed) {
    parts.push(`\nFOCUS LENS (MIXED):\n` + fragments.kindOverlays.mixed);
  }

  return parts.join('\n');
}

// =============================================================================
// LLM Synthesis
// =============================================================================

const SYSTEM_PROMPT = `You are a perspective consultant for a fantasy chronicle series. Your job is to help each chronicle feel like a distinct window into the same world - not a different world, but a different EMPHASIS within the same world.

You will receive:
1. An analysis of which entities this chronicle focuses on
2. Core tone guidance for the world
3. A list of world facts with relevance scores

Your output is a brief perspective guide that tells the story generator what to EMPHASIZE for this specific chronicle. You are NOT creating new facts or changing the world - you are choosing what to foreground and what to let recede.

IMPORTANT: Output ONLY valid JSON. No markdown, no explanation, no commentary.`;

function buildUserPrompt(
  input: PerspectiveSynthesisInput,
  scoredFacts: ScoredFact[]
): string {
  const { constellation, entities, focalEra, toneFragments } = input;

  const entitySummaries = entities
    .slice(0, 10)
    .map(
      (e) =>
        `- ${e.name} (${e.kind}, ${e.culture || 'unknown'}): ${e.summary || e.description?.slice(0, 100) || 'No description'}`
    )
    .join('\n');

  const factList = scoredFacts
    .sort((a, b) => b.score - a.score)
    .map((f) => `[${f.score.toFixed(2)}] ${f.fact.id}: ${f.fact.text}`)
    .join('\n');

  return `CHRONICLE FOCUS:
${constellation.focusSummary}

Dominant culture: ${constellation.dominantCulture || 'mixed'}
Entity focus: ${constellation.kindFocus}
Era: ${focalEra?.name || 'unspecified'}
Prominent themes: ${constellation.prominentTags.join(', ') || 'none identified'}
Relationship dynamics: ${constellation.hasConflict ? 'conflict present' : ''} ${constellation.hasTrade ? 'trade present' : ''} ${constellation.hasFamilial ? 'family bonds' : ''}

ENTITIES IN THIS CHRONICLE:
${entitySummaries}

WORLD FACTS (with relevance scores):
${factList}

CORE TONE:
${toneFragments.core}

---

Based on this specific chronicle's focus, provide a JSON object with:

1. "brief": A perspective brief (150-200 words) describing what lens this chronicle should view the world through. What concerns, fears, or preoccupations would these specific entities have? What aspects of the world feel most present to THEM? Do NOT invent new world facts. Do NOT contradict existing facts. Choose what to emphasize - what's in foreground vs background for these characters.

2. "prioritizedFactIds": An array of 3-5 fact IDs in order of relevance for THIS specific story.

3. "suggestedMotifs": An array of 2-3 short phrases that might echo through this chronicle. These should feel natural to the entities involved. Avoid "the ice remembers" unless this chronicle is specifically about memory/artifacts.

Output format:
{
  "brief": "...",
  "prioritizedFactIds": ["fact-id-1", "fact-id-2", ...],
  "suggestedMotifs": ["phrase one", "phrase two", ...]
}`;
}

/**
 * Synthesize perspective using LLM
 */
export async function synthesizePerspective(
  input: PerspectiveSynthesisInput,
  llmClient: LLMClient,
  callConfig: ResolvedLLMCallConfig
): Promise<PerspectiveSynthesisResult> {
  const { constellation, factsWithMetadata, toneFragments } = input;

  // Score facts
  const scoredFacts = scoreFacts(factsWithMetadata, constellation);

  // Assemble tone
  const assembledTone = assembleTone(toneFragments, constellation);

  // Build prompt
  const userPrompt = buildUserPrompt(input, scoredFacts);

  // Make LLM call
  const callResult = await runTextCall({
    llmClient,
    callType: 'perspective.synthesis',
    callConfig,
    systemPrompt: SYSTEM_PROMPT,
    prompt: userPrompt,
    temperature: 0.7, // Allow some variation
  });

  // Parse response
  let synthesis: PerspectiveSynthesis;
  try {
    const text = callResult.result.text.trim();
    // Try to extract JSON from the response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON object found in response');
    }
    synthesis = JSON.parse(jsonMatch[0]);

    // Validate structure
    if (!synthesis.brief || !Array.isArray(synthesis.prioritizedFactIds)) {
      throw new Error('Invalid synthesis structure');
    }
    if (!Array.isArray(synthesis.suggestedMotifs)) {
      synthesis.suggestedMotifs = [];
    }
  } catch (err) {
    // LLM failed to produce valid JSON - throw error per user requirement
    throw new Error(
      `Perspective synthesis failed to produce valid output: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  // Get prioritized fact texts
  const factMap = new Map(factsWithMetadata.map((f) => [f.id, f.text]));
  const prioritizedFacts = synthesis.prioritizedFactIds
    .map((id) => factMap.get(id))
    .filter((text): text is string => text !== undefined);

  return {
    synthesis,
    assembledTone,
    prioritizedFacts,
    usage: callResult.usage,
  };
}
