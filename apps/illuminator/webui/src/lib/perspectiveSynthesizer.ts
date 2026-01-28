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
 * Canon fact with metadata for perspective synthesis.
 * Core facts are always included but presented through different facets.
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

  // Core facts are always included - the question is HOW they manifest
  isCore: boolean;

  // Culture/theme-specific interpretations of this fact
  facetHints?: Record<string, string>;
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
 * How a core fact manifests for this specific constellation
 */
export interface FactFacet {
  factId: string;
  interpretation: string; // How this truth manifests for these entities
}

/**
 * Output of perspective synthesis
 */
export interface PerspectiveSynthesis {
  brief: string; // 150-200 words of perspective guidance
  coreFacets: FactFacet[]; // How core truths manifest for this constellation
  contextualFacts: string[]; // Non-core facts relevant to this constellation
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
  /** All facts formatted for generation - core facts with faceted interpretations first */
  facetedFacts: string[];
  usage: {
    inputTokens: number;
    outputTokens: number;
    actualCost: number;
  };
}

// =============================================================================
// Fact Analysis
// =============================================================================

/**
 * Separate core facts from contextual facts and score contextual ones
 */
export function analyzeFacts(
  facts: CanonFactWithMetadata[],
  constellation: EntityConstellation
): { coreFacts: CanonFactWithMetadata[]; contextualFacts: ScoredFact[] } {
  const coreFacts: CanonFactWithMetadata[] = [];
  const contextualFacts: ScoredFact[] = [];

  for (const fact of facts) {
    if (fact.isCore) {
      coreFacts.push(fact);
    } else {
      // Score contextual facts for relevance
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

      contextualFacts.push({ fact, score });
    }
  }

  // Sort contextual facts by score
  contextualFacts.sort((a, b) => b.score - a.score);

  return { coreFacts, contextualFacts };
}

/**
 * Select the best facet hint for a core fact based on constellation
 */
export function selectFacetHint(
  fact: CanonFactWithMetadata,
  constellation: EntityConstellation
): string | undefined {
  if (!fact.facetHints) return undefined;

  // Priority: dominant culture > relationship theme > first available
  if (constellation.dominantCulture && fact.facetHints[constellation.dominantCulture]) {
    return fact.facetHints[constellation.dominantCulture];
  }
  if (constellation.hasConflict && fact.facetHints['conflict']) {
    return fact.facetHints['conflict'];
  }
  if (constellation.hasTrade && fact.facetHints['trade']) {
    return fact.facetHints['trade'];
  }
  if (constellation.hasFamilial && fact.facetHints['family']) {
    return fact.facetHints['family'];
  }

  return undefined;
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

The world has core truths that are ALWAYS present - like "the ice remembers." These truths should never be excluded, but they should MANIFEST DIFFERENTLY depending on who the chronicle is about:
- For miners: the ice remembers the heat of ancient fires
- For diplomats: the ice remembers every broken promise
- For raiders: the ice remembers the blood

You are choosing HOW the world's truths appear to these specific characters, not WHETHER they appear.

IMPORTANT: Output ONLY valid JSON. No markdown, no explanation, no commentary.`;

interface FactAnalysis {
  coreFacts: CanonFactWithMetadata[];
  contextualFacts: ScoredFact[];
}

function buildUserPrompt(
  input: PerspectiveSynthesisInput,
  factAnalysis: FactAnalysis
): string {
  const { constellation, entities, focalEra, toneFragments } = input;

  const entitySummaries = entities
    .slice(0, 10)
    .map(
      (e) =>
        `- ${e.name} (${e.kind}, ${e.culture || 'unknown'}): ${e.summary || e.description?.slice(0, 100) || 'No description'}`
    )
    .join('\n');

  // Format core facts with their facet hints
  const coreFactsDisplay = factAnalysis.coreFacts
    .map((f) => {
      const hint = selectFacetHint(f, constellation);
      return `- ${f.id}: "${f.text}"${hint ? `\n  Suggested facet for this constellation: "${hint}"` : ''}`;
    })
    .join('\n');

  // Format contextual facts with scores
  const contextualFactsDisplay = factAnalysis.contextualFacts
    .slice(0, 6) // Top 6 contextual facts
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

CORE WORLD TRUTHS (always present, but manifest differently):
${coreFactsDisplay}

CONTEXTUAL FACTS (include if relevant):
${contextualFactsDisplay || '(none scored highly)'}

CORE TONE:
${toneFragments.core}

---

Based on this specific chronicle's focus, provide a JSON object with:

1. "brief": A perspective brief (150-200 words) describing what lens this chronicle should view the world through. What concerns, fears, or preoccupations would these specific entities have? How do the core truths manifest for THEM specifically?

2. "coreFacets": For EACH core fact, describe how it manifests for this constellation. Use or adapt the suggested facet, or write your own interpretation that fits these entities.

3. "contextualFactIds": Which of the contextual facts (0-3) should be foregrounded for this story.

4. "suggestedMotifs": 2-3 short phrases that might echo through this chronicle. These should feel natural to the entities involved and reflect how they experience the world's truths.

Output format:
{
  "brief": "...",
  "coreFacets": [
    {"factId": "ice-remembers", "interpretation": "The ice remembers every blade forged..."},
    {"factId": "berg-nature", "interpretation": "The Berg's impossible scale means..."}
  ],
  "contextualFactIds": ["orca-raiders", "flipper-accord"],
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

  // Analyze facts: separate core from contextual
  const factAnalysis = analyzeFacts(factsWithMetadata, constellation);

  // Assemble tone
  const assembledTone = assembleTone(toneFragments, constellation);

  // Build prompt
  const userPrompt = buildUserPrompt(input, factAnalysis);

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
    const parsed = JSON.parse(jsonMatch[0]);

    // Validate and normalize structure
    if (!parsed.brief) {
      throw new Error('Missing brief in synthesis');
    }

    // Normalize coreFacets
    const coreFacets: FactFacet[] = Array.isArray(parsed.coreFacets)
      ? parsed.coreFacets.map((f: { factId?: string; interpretation?: string }) => ({
          factId: f.factId || '',
          interpretation: f.interpretation || '',
        }))
      : [];

    // Normalize contextualFacts (from contextualFactIds)
    const contextualFacts: string[] = Array.isArray(parsed.contextualFactIds)
      ? parsed.contextualFactIds.filter((id: unknown): id is string => typeof id === 'string')
      : [];

    // Normalize suggestedMotifs
    const suggestedMotifs: string[] = Array.isArray(parsed.suggestedMotifs)
      ? parsed.suggestedMotifs.filter((m: unknown): m is string => typeof m === 'string')
      : [];

    synthesis = {
      brief: parsed.brief,
      coreFacets,
      contextualFacts,
      suggestedMotifs,
    };
  } catch (err) {
    // LLM failed to produce valid JSON - throw error per user requirement
    throw new Error(
      `Perspective synthesis failed to produce valid output: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  // Build faceted facts for generation:
  // 1. Core facts with their faceted interpretations
  // 2. Contextual facts that were selected
  const facetedFacts: string[] = [];

  // Add core facts with faceted interpretations
  const coreFactMap = new Map(factAnalysis.coreFacts.map((f) => [f.id, f]));
  for (const facet of synthesis.coreFacets) {
    const coreFact = coreFactMap.get(facet.factId);
    if (coreFact) {
      // Include both the base fact and the faceted interpretation
      facetedFacts.push(`${coreFact.text} [For this chronicle: ${facet.interpretation}]`);
    }
  }

  // Add any core facts that weren't given facets (use base text)
  for (const coreFact of factAnalysis.coreFacts) {
    const hasFacet = synthesis.coreFacets.some((f) => f.factId === coreFact.id);
    if (!hasFacet) {
      facetedFacts.push(coreFact.text);
    }
  }

  // Add selected contextual facts
  const contextualFactMap = new Map(factAnalysis.contextualFacts.map((sf) => [sf.fact.id, sf.fact]));
  for (const factId of synthesis.contextualFacts) {
    const contextFact = contextualFactMap.get(factId);
    if (contextFact) {
      facetedFacts.push(contextFact.text);
    }
  }

  return {
    synthesis,
    assembledTone,
    facetedFacts,
    usage: callResult.usage,
  };
}
