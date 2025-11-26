import type { MorphologyProfile } from "./types/domain.js";
import { pickWeighted, pickRandom } from "./utils/rng.js";

/**
 * Apply morphological structure to a base word (root)
 * @param rootSyllables - Original syllables from phonology (used to track syllable boundaries)
 */
export function applyMorphology(
  rng: () => number,
  root: string,
  profile: MorphologyProfile,
  rootSyllables?: string[]
): { result: string; structure: string; parts: string[]; syllables: string[] } {
  // Pick a structure pattern
  const structure = pickWeighted(
    rng,
    profile.structure,
    profile.structureWeights
  );

  const parts: string[] = [];
  const syllables: string[] = [];
  let result = "";

  // Parse and apply structure
  // Supported patterns: "root", "root-suffix", "prefix-root", "prefix-root-suffix", "root-root"
  const tokens = structure.split("-");

  for (const token of tokens) {
    switch (token) {
      case "root":
        result += root;
        parts.push(`root:${root}`);
        // Add root syllables
        if (rootSyllables && rootSyllables.length > 0) {
          syllables.push(...rootSyllables);
        } else {
          syllables.push(root); // Treat whole root as one syllable
        }
        break;

      case "prefix":
        if (profile.prefixes && profile.prefixes.length > 0) {
          const prefix = pickWeighted(
            rng,
            profile.prefixes,
            profile.prefixWeights
          );
          result += prefix;
          parts.push(`prefix:${prefix}`);
          syllables.push(prefix); // Prefix becomes a syllable
        }
        break;

      case "suffix":
        if (profile.suffixes && profile.suffixes.length > 0) {
          const suffix = pickWeighted(
            rng,
            profile.suffixes,
            profile.suffixWeights
          );
          result += suffix;
          parts.push(`suffix:${suffix}`);
          syllables.push(suffix); // Suffix becomes a syllable
        }
        break;

      case "infix":
        // Infixes are inserted in the middle of the root
        if (profile.infixes && profile.infixes.length > 0 && root.length > 2) {
          const infix = pickRandom(rng, profile.infixes);
          const mid = Math.floor(root.length / 2);
          result = result.slice(0, -root.length) + root.slice(0, mid) + infix + root.slice(mid);
          parts.push(`infix:${infix}`);
          // For infixes, we can't easily track syllables - leave as-is
        }
        break;

      case "wordroot":
        // Use a predefined word root instead of generated phonology
        if (profile.wordRoots && profile.wordRoots.length > 0) {
          const wordRoot = pickRandom(rng, profile.wordRoots);
          result += wordRoot;
          parts.push(`wordroot:${wordRoot}`);
          syllables.push(wordRoot); // Treat wordroot as one syllable
        } else {
          // Fallback to generated root
          result += root;
          parts.push(`root:${root}`);
          if (rootSyllables && rootSyllables.length > 0) {
            syllables.push(...rootSyllables);
          } else {
            syllables.push(root);
          }
        }
        break;

      case "honorific":
        // Add honorific (usually as prefix with space)
        if (profile.honorifics && profile.honorifics.length > 0) {
          const honorific = pickRandom(rng, profile.honorifics);
          result = honorific + " " + result;
          parts.push(`honorific:${honorific}`);
          // Honorifics are separate words, don't add to syllables
        }
        break;

      default:
        // Unknown token, skip
        break;
    }
  }

  return { result, structure, parts, syllables };
}

/**
 * Apply morphology with multiple candidates and pick best
 * Useful for avoiding overly long or awkward combinations
 * @param rootSyllables - Original syllables from phonology (used to track syllable boundaries)
 */
export function applyMorphologyBest(
  rng: () => number,
  root: string,
  profile: MorphologyProfile,
  candidateCount: number = 3,
  maxLength: number = 20,
  rootSyllables?: string[]
): { result: string; structure: string; parts: string[]; syllables: string[] } {
  const candidates: {
    result: string;
    structure: string;
    parts: string[];
    syllables: string[];
    score: number;
  }[] = [];

  for (let i = 0; i < candidateCount; i++) {
    const morphed = applyMorphology(rng, root, profile, rootSyllables);

    // Score based on length (prefer moderate length)
    let score = 1.0;
    if (morphed.result.length > maxLength) {
      score *= 0.5; // Penalize overly long names
    }
    if (morphed.result.length < 3) {
      score *= 0.5; // Penalize overly short names
    }

    candidates.push({ ...morphed, score });
  }

  // Pick weighted by score
  const scores = candidates.map((c) => c.score);
  const totalScore = scores.reduce((sum, s) => sum + s, 0);

  const r = rng() * totalScore;
  let cumulative = 0;
  for (const candidate of candidates) {
    cumulative += candidate.score;
    if (r < cumulative) {
      return {
        result: candidate.result,
        structure: candidate.structure,
        parts: candidate.parts,
        syllables: candidate.syllables,
      };
    }
  }

  // Fallback
  return {
    result: candidates[0].result,
    structure: candidates[0].structure,
    parts: candidates[0].parts,
    syllables: candidates[0].syllables,
  };
}

/**
 * Check if a morphology profile can actually modify names
 * (i.e., has at least some affixes or structures beyond "root")
 */
export function canApplyMorphology(profile: MorphologyProfile): boolean {
  // Check if there are any non-root structures
  const hasComplexStructures = profile.structure.some(
    (s) => s !== "root" && s.includes("-")
  );

  if (!hasComplexStructures) {
    return false;
  }

  // Check if there are any affixes available
  const hasAffixes =
    (profile.prefixes && profile.prefixes.length > 0) ||
    (profile.suffixes && profile.suffixes.length > 0) ||
    (profile.infixes && profile.infixes.length > 0) ||
    (profile.wordRoots && profile.wordRoots.length > 0);

  return Boolean(hasAffixes);
}

/**
 * Generate a compound name (root-root structure)
 * Useful for location names and titles
 */
export function generateCompound(
  rng: () => number,
  root1: string,
  root2: string,
  separator: string = ""
): string {
  return root1 + separator + root2;
}

/**
 * Apply honorific prefix
 */
export function applyHonorific(
  rng: () => number,
  name: string,
  profile: MorphologyProfile
): string {
  if (!profile.honorifics || profile.honorifics.length === 0) {
    return name;
  }

  const honorific = pickRandom(rng, profile.honorifics);
  return `${honorific} ${name}`;
}
