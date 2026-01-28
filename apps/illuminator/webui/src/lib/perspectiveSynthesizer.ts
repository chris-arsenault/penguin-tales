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
 * Canon fact with relevance metadata for perspective synthesis.
 * All facts are world truths - relevance metadata guides what gets
 * foregrounded for a given entity constellation.
 */
export interface CanonFactWithMetadata {
  id: string;
  text: string;

  // Relevance signals
  relevantCultures: string[]; // ["nightshelf", "aurora_stack", "*"]
  relevantKinds: string[]; // ["artifact", "npc", "*"]
  relevantTags: string[]; // ["trade", "conflict", "magic"]
  relevantRelationships: string[]; // ["ally", "rival", "trade_partner"]

  // Base priority (0-1) - higher = more likely to be foregrounded
  basePriority: number;
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
 * A fact selected and interpreted for this constellation
 */
export interface FactFacet {
  factId: string;
  interpretation: string; // How this truth manifests for these entities
}

/**
 * Output of perspective synthesis
 */
export interface PerspectiveSynthesis {
  /** 150-200 words of perspective guidance for this chronicle */
  brief: string;
  /** Selected facts with their faceted interpretations for this constellation */
  facets: FactFacet[];
  /** 2-3 short phrases that might echo through this chronicle */
  suggestedMotifs: string[];
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
  /** All facts formatted for generation - core facts with faceted interpretations first */
  facetedFacts: string[];
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
 * Score all facts based on relevance to the entity constellation.
 * Higher scores = more relevant to this constellation.
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

    // Conflict/trade/family boost
    if (
      fact.relevantTags.includes('conflict') ||
      fact.relevantRelationships.includes('enemy')
    ) {
      if (constellation.hasConflict) score += 0.1;
    }
    if (
      fact.relevantTags.includes('trade') ||
      fact.relevantRelationships.includes('trade_partner')
    ) {
      if (constellation.hasTrade) score += 0.1;
    }

    return { fact, score };
  }).sort((a, b) => b.score - a.score);
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

const SYSTEM_PROMPT = `You are a perspective consultant for a fantasy chronicle series. Your job is to help each chronicle feel like a distinct window into the same world - not a different world, but a different FACET of the same truths.

World facts should manifest DIFFERENTLY depending on who the chronicle is about:
- For miners: "the ice remembers" might mean the heat of ancient fires
- For diplomats: it might mean every broken promise frozen in the walls
- For raiders: it might mean the blood of past hunts

You are choosing WHICH facts to foreground and HOW they manifest for these specific characters.

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

  // Format facts with relevance scores
  const factsDisplay = scoredFacts
    .map((sf) => `[${sf.score.toFixed(2)}] ${sf.fact.id}: ${sf.fact.text}`)
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

WORLD FACTS (with relevance scores for this constellation):
${factsDisplay}

CORE TONE:
${toneFragments.core}

---

Based on this constellation, provide a JSON object with:

1. "brief": A perspective brief (150-200 words) describing what lens this chronicle should view the world through. What concerns, fears, or preoccupations would these specific entities have? How do the world's truths manifest for THEM specifically?

2. "facets": Select 4-6 facts most relevant to this constellation. For each, provide a faceted interpretation - how this truth manifests or is experienced by THESE specific entities. The interpretation should feel natural to their culture, role, and circumstances.

3. "suggestedMotifs": 2-3 short phrases that might echo through this chronicle. These should feel natural to the entities involved - the way THEY would express the world's truths.

Output format:
{
  "brief": "...",
  "facets": [
    {"factId": "ice-remembers", "interpretation": "For these miners, the ice remembers the heat..."},
    {"factId": "flipper-accord", "interpretation": "The trade agreement weighs on them as..."}
  ],
  "suggestedMotifs": ["phrase one", "phrase two"]
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

  // Score all facts by relevance to constellation
  const scoredFacts = scoreFacts(factsWithMetadata, constellation);

  // Assemble tone from fragments
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
    temperature: 0.7, // Allow variation
  });

  // Parse response
  let synthesis: PerspectiveSynthesis;
  try {
    const text = callResult.result.text.trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON object found in response');
    }
    const parsed = JSON.parse(jsonMatch[0]);

    if (!parsed.brief) {
      throw new Error('Missing brief in synthesis');
    }

    // Normalize facets
    const facets: FactFacet[] = Array.isArray(parsed.facets)
      ? parsed.facets.map((f: { factId?: string; interpretation?: string }) => ({
          factId: f.factId || '',
          interpretation: f.interpretation || '',
        }))
      : [];

    // Normalize suggestedMotifs
    const suggestedMotifs: string[] = Array.isArray(parsed.suggestedMotifs)
      ? parsed.suggestedMotifs.filter((m: unknown): m is string => typeof m === 'string')
      : [];

    synthesis = {
      brief: parsed.brief,
      facets,
      suggestedMotifs,
    };
  } catch (err) {
    throw new Error(
      `Perspective synthesis failed to produce valid output: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  // Build faceted facts for generation
  // Each selected fact gets its faceted interpretation
  const factMap = new Map(factsWithMetadata.map((f) => [f.id, f]));
  const facetedFacts: string[] = synthesis.facets
    .filter((f) => f.factId && f.interpretation)
    .map((f) => {
      const baseFact = factMap.get(f.factId);
      if (baseFact) {
        return `${baseFact.text} [For this chronicle: ${f.interpretation}]`;
      }
      return f.interpretation;
    });

  return {
    synthesis,
    assembledTone,
    facetedFacts,
    usage: callResult.usage,
  };
}
