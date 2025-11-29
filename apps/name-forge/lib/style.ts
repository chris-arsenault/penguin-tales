import type { StyleRules } from "./types/domain.js";
import { chance } from "./utils/rng.js";
import {
  applyCapitalization,
  findSyllableBoundaries,
  insertAtBoundary,
  endsWithAny,
} from "./utils/helpers.js";

/**
 * Apply stylistic transforms to a name
 */
export function applyStyle(
  rng: () => number,
  name: string,
  style: StyleRules,
  syllables?: string[]
): { result: string; transforms: string[] } {
  let result = name;
  const transforms: string[] = [];

  // Apply defaults for optional fields
  const apostropheRate = style.apostropheRate ?? 0;
  const hyphenRate = style.hyphenRate ?? 0;
  const capitalization = style.capitalization ?? "title";

  // Determine which markers to insert
  const wantApostrophe = apostropheRate > 0 && chance(rng, apostropheRate);
  const wantHyphen = hyphenRate > 0 && chance(rng, hyphenRate);

  // Insert markers at syllable boundaries (avoiding adjacent placement)
  if ((wantApostrophe || wantHyphen) && syllables && syllables.length > 1) {
    const boundaries = findSyllableBoundaries(result, syllables);

    if (boundaries.length > 0) {
      if (wantApostrophe && wantHyphen) {
        // Both wanted - place at different boundaries if possible
        if (boundaries.length >= 2) {
          // Multiple boundaries: pick two different ones
          const shuffled = [...boundaries].sort(() => rng() - 0.5);
          const apoIdx = shuffled[0];
          const hypIdx = shuffled[1];

          // Insert at higher index first to preserve positions
          if (apoIdx > hypIdx) {
            result = result.slice(0, apoIdx) + "'" + result.slice(apoIdx);
            result = result.slice(0, hypIdx) + "-" + result.slice(hypIdx);
          } else {
            result = result.slice(0, hypIdx) + "-" + result.slice(hypIdx);
            result = result.slice(0, apoIdx) + "'" + result.slice(apoIdx);
          }
          transforms.push("apostrophe", "hyphen");
        } else {
          // Only one boundary: randomly pick one marker
          if (rng() < 0.5) {
            result = insertAtBoundary(result, "'", boundaries, rng);
            transforms.push("apostrophe");
          } else {
            result = insertAtBoundary(result, "-", boundaries, rng);
            transforms.push("hyphen");
          }
        }
      } else if (wantApostrophe) {
        result = insertAtBoundary(result, "'", boundaries, rng);
        transforms.push("apostrophe");
      } else if (wantHyphen) {
        result = insertAtBoundary(result, "-", boundaries, rng);
        transforms.push("hyphen");
      }
    }
  }

  // Apply capitalization
  result = applyCapitalization(result, capitalization);
  transforms.push(`cap:${capitalization}`);

  return { result, transforms };
}

/**
 * Check if a name has a preferred ending
 */
export function hasPreferredEnding(
  name: string,
  preferredEndings?: string[]
): boolean {
  if (!preferredEndings || preferredEndings.length === 0) {
    return false;
  }
  return endsWithAny(name, preferredEndings);
}

/**
 * Generate multiple candidates and boost those with preferred endings
 */
export function selectWithPreferredEndings<T>(
  rng: () => number,
  candidates: T[],
  nameExtractor: (candidate: T) => string,
  preferredEndings?: string[],
  boost: number = 2.0
): T {
  if (
    !preferredEndings ||
    preferredEndings.length === 0 ||
    candidates.length === 0
  ) {
    // No preference, pick uniformly
    return candidates[Math.floor(rng() * candidates.length)];
  }

  // Calculate weights
  const weights = candidates.map((candidate) => {
    const name = nameExtractor(candidate);
    return hasPreferredEnding(name, preferredEndings) ? boost : 1.0;
  });

  // Weighted selection
  const total = weights.reduce((sum, w) => sum + w, 0);
  const r = rng() * total;
  let cumulative = 0;

  for (let i = 0; i < candidates.length; i++) {
    cumulative += weights[i];
    if (r < cumulative) {
      return candidates[i];
    }
  }

  // Fallback
  return candidates[candidates.length - 1];
}

/**
 * Apply rhythm-based adjustments to a name
 * This is a placeholder for future enhancement
 */
export function applyRhythmBias(
  name: string,
  rhythmBias?: "soft" | "harsh" | "staccato" | "flowing" | "neutral"
): string {
  // For now, rhythm bias is primarily enforced during phonology generation
  // This could be extended to do post-processing transformations
  switch (rhythmBias) {
    case "soft":
      // Could soften harsh consonant clusters
      return name;
    case "harsh":
      // Could emphasize consonants
      return name;
    case "staccato":
      // Could add more syllable breaks
      return name;
    case "flowing":
      // Could smooth transitions
      return name;
    case "neutral":
    default:
      return name;
  }
}

/**
 * Validate that a name meets style constraints
 */
export function validateStyle(name: string, style: StyleRules): boolean {
  // Basic validation
  if (name.length === 0) {
    return false;
  }

  // Could add more complex validation:
  // - Check apostrophe/hyphen placement
  // - Verify capitalization
  // - Ensure no double apostrophes, etc.

  return true;
}

/**
 * Apply all stylistic transforms and select best candidate
 */
export function applyStyleWithCandidates(
  rng: () => number,
  candidates: string[],
  style: StyleRules,
  syllablesPerCandidate?: string[][]
): string {
  if (candidates.length === 0) {
    throw new Error("No candidates provided");
  }

  // Generate styled versions
  const styledCandidates = candidates.map((name, index) => {
    const syllables = syllablesPerCandidate?.[index];
    const { result } = applyStyle(rng, name, style, syllables);
    return result;
  });

  // Select with preferred endings boost
  return selectWithPreferredEndings(
    rng,
    styledCandidates,
    (name) => name,
    style.preferredEndings,
    style.preferredEndingBoost
  );
}

/**
 * Strip style markers for comparison
 * Useful for validation and deduplication
 */
export function normalizeForComparison(name: string): string {
  return name
    .toLowerCase()
    .replace(/['\-\s]/g, "") // Remove apostrophes, hyphens, spaces
    .trim();
}

/**
 * Check if two names are too similar (considering style variations)
 */
export function areTooSimilar(name1: string, name2: string): boolean {
  const norm1 = normalizeForComparison(name1);
  const norm2 = normalizeForComparison(name2);
  return norm1 === norm2;
}
