/**
 * Cluster Pattern Discovery
 *
 * Analyzes generated names to discover effective consonant clusters
 * and proposes new clusters based on patterns in high-fitness domains.
 */

import { createRNG } from "../../utils/rng.js";
import { generateWordWithDebug } from "../phonology.js";
import type { NamingDomain } from "../../types/domain.js";

/**
 * Cluster frequency data
 */
interface ClusterStats {
  cluster: string;
  frequency: number;
  positions: ("onset" | "coda" | "medial")[];
}

/**
 * Extract clusters from a name
 */
export function extractClusters(name: string, consonants: Set<string>): string[] {
  const clusters: string[] = [];
  let currentCluster = "";

  for (const char of name.toLowerCase()) {
    if (consonants.has(char)) {
      currentCluster += char;
    } else {
      if (currentCluster.length >= 2) {
        clusters.push(currentCluster);
      }
      currentCluster = "";
    }
  }

  if (currentCluster.length >= 2) {
    clusters.push(currentCluster);
  }

  return clusters;
}

/**
 * Analyze cluster usage in generated names
 */
export function analyzeClusterUsage(
  names: string[],
  domain: NamingDomain
): Map<string, ClusterStats> {
  const consonantSet = new Set(domain.phonology.consonants.map(c => c.toLowerCase()));
  const stats = new Map<string, ClusterStats>();

  for (const name of names) {
    const clusters = extractClusters(name, consonantSet);

    for (const cluster of clusters) {
      if (!stats.has(cluster)) {
        stats.set(cluster, {
          cluster,
          frequency: 0,
          positions: [],
        });
      }

      const s = stats.get(cluster)!;
      s.frequency++;

      // Determine position
      const idx = name.toLowerCase().indexOf(cluster);
      if (idx === 0) {
        if (!s.positions.includes("onset")) s.positions.push("onset");
      } else if (idx + cluster.length === name.length) {
        if (!s.positions.includes("coda")) s.positions.push("coda");
      } else {
        if (!s.positions.includes("medial")) s.positions.push("medial");
      }
    }
  }

  return stats;
}

/**
 * Generate sample names from a domain
 */
export function generateSampleNames(
  domain: NamingDomain,
  count: number,
  seed: string
): string[] {
  const rng = createRNG(seed);
  const names: string[] = [];

  for (let i = 0; i < count; i++) {
    try {
      const { word } = generateWordWithDebug(rng, domain.phonology);
      names.push(word);
    } catch {
      // Skip failed generations
    }
  }

  return names;
}

/**
 * Discover common clusters from names
 */
export function discoverCommonClusters(
  domain: NamingDomain,
  sampleSize: number = 500,
  seed: string = "cluster-discovery"
): ClusterStats[] {
  const names = generateSampleNames(domain, sampleSize, seed);
  const stats = analyzeClusterUsage(names, domain);

  // Sort by frequency
  const sorted = Array.from(stats.values())
    .sort((a, b) => b.frequency - a.frequency);

  return sorted;
}

/**
 * Borrow effective clusters from sibling domains
 */
export function borrowClustersFromSiblings(
  targetDomain: NamingDomain,
  siblingDomains: NamingDomain[],
  maxBorrow: number = 5,
  seed: string = "borrow"
): string[] {
  const rng = createRNG(seed);

  // Analyze clusters in each sibling
  const allClusters = new Map<string, { count: number; sources: string[] }>();

  for (const sibling of siblingDomains) {
    const clusters = discoverCommonClusters(sibling, 200, `${seed}-${sibling.id}`);

    for (const cs of clusters.slice(0, 20)) { // Top 20 from each
      if (!allClusters.has(cs.cluster)) {
        allClusters.set(cs.cluster, { count: 0, sources: [] });
      }
      const entry = allClusters.get(cs.cluster)!;
      entry.count += cs.frequency;
      entry.sources.push(sibling.id);
    }
  }

  // Filter out clusters already in target
  const existingClusters = new Set(targetDomain.phonology.favoredClusters || []);
  const candidates = Array.from(allClusters.entries())
    .filter(([cluster]) => !existingClusters.has(cluster))
    .sort((a, b) => b[1].count - a[1].count);

  // Check if target has the consonants to form these clusters
  const targetConsonants = new Set(targetDomain.phonology.consonants.map(c => c.toLowerCase()));

  const validCandidates = candidates.filter(([cluster]) => {
    for (const char of cluster) {
      if (!targetConsonants.has(char)) return false;
    }
    return true;
  });

  // Select top candidates
  return validCandidates.slice(0, maxBorrow).map(([cluster]) => cluster);
}

/**
 * Synthesize new clusters from domain's consonants
 */
export function synthesizeClusters(
  domain: NamingDomain,
  count: number = 10,
  seed: string = "synth"
): string[] {
  const rng = createRNG(seed);
  const consonants = domain.phonology.consonants;

  if (consonants.length < 2) return [];

  const newClusters: string[] = [];
  const existingClusters = new Set(domain.phonology.favoredClusters || []);

  // Common cluster patterns
  const patterns = [
    // Stop + liquid (very common)
    { first: ["p", "b", "t", "d", "k", "g"], second: ["l", "r"] },
    // S + stop
    { first: ["s"], second: ["p", "t", "k"] },
    // Nasal + stop
    { first: ["m", "n"], second: ["b", "d", "g", "p", "t", "k"] },
    // Fricative + approximant
    { first: ["f", "v", "th", "s"], second: ["l", "r", "w"] },
  ];

  // Generate pattern-based clusters
  for (const pattern of patterns) {
    for (const f of pattern.first) {
      if (!consonants.includes(f)) continue;
      for (const s of pattern.second) {
        if (!consonants.includes(s)) continue;
        const cluster = f + s;
        if (!existingClusters.has(cluster) && !newClusters.includes(cluster)) {
          newClusters.push(cluster);
        }
      }
    }
  }

  // Shuffle and return requested count
  const shuffled = newClusters.sort(() => rng() - 0.5);
  return shuffled.slice(0, count);
}

/**
 * Analyze which clusters improve fitness
 * (Would need integration with fitness function)
 */
export interface ClusterSuggestion {
  cluster: string;
  source: "discovered" | "borrowed" | "synthesized";
  confidence: "high" | "medium" | "low";
  reason: string;
}

/**
 * Get cluster suggestions for a domain
 */
export function suggestClusters(
  domain: NamingDomain,
  siblingDomains: NamingDomain[] = [],
  seed: string = "suggest"
): ClusterSuggestion[] {
  const suggestions: ClusterSuggestion[] = [];

  // Discover common patterns in current generation
  const discovered = discoverCommonClusters(domain, 300, `${seed}-discover`);
  const existingClusters = new Set(domain.phonology.favoredClusters || []);

  // High-frequency emergent clusters
  for (const cs of discovered.slice(0, 5)) {
    if (!existingClusters.has(cs.cluster)) {
      suggestions.push({
        cluster: cs.cluster,
        source: "discovered",
        confidence: cs.frequency > 50 ? "high" : cs.frequency > 20 ? "medium" : "low",
        reason: `Appears ${cs.frequency} times in generated names`,
      });
    }
  }

  // Borrowed from siblings
  if (siblingDomains.length > 0) {
    const borrowed = borrowClustersFromSiblings(domain, siblingDomains, 3, `${seed}-borrow`);
    for (const cluster of borrowed) {
      suggestions.push({
        cluster,
        source: "borrowed",
        confidence: "medium",
        reason: `Effective in sibling domains`,
      });
    }
  }

  // Synthesized from patterns
  const synthesized = synthesizeClusters(domain, 5, `${seed}-synth`);
  for (const cluster of synthesized) {
    if (!suggestions.some(s => s.cluster === cluster)) {
      suggestions.push({
        cluster,
        source: "synthesized",
        confidence: "low",
        reason: `Follows common phonotactic patterns`,
      });
    }
  }

  return suggestions;
}

/**
 * Apply cluster suggestions to domain
 */
export function applyClusterSuggestions(
  domain: NamingDomain,
  suggestions: ClusterSuggestion[],
  maxApply: number = 5
): NamingDomain {
  // Sort by confidence
  const sorted = [...suggestions].sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 };
    return order[a.confidence] - order[b.confidence];
  });

  const toApply = sorted.slice(0, maxApply).map(s => s.cluster);
  const existingClusters = domain.phonology.favoredClusters || [];

  return {
    ...domain,
    phonology: {
      ...domain.phonology,
      favoredClusters: [...existingClusters, ...toApply],
    },
  };
}

/**
 * Cluster-based optimization step
 */
export async function optimizeWithClusterDiscovery(
  domain: NamingDomain,
  siblingDomains: NamingDomain[] = [],
  seed: string = "cluster-opt"
): Promise<{
  domain: NamingDomain;
  suggestions: ClusterSuggestion[];
  applied: string[];
}> {
  console.log("\n=== Cluster Discovery ===");

  // Get suggestions
  const suggestions = suggestClusters(domain, siblingDomains, seed);

  console.log(`Found ${suggestions.length} cluster suggestions:`);
  for (const s of suggestions.slice(0, 10)) {
    console.log(`  [${s.confidence}] "${s.cluster}" (${s.source}): ${s.reason}`);
  }

  // Apply top suggestions
  const toApply = suggestions
    .filter(s => s.confidence !== "low")
    .slice(0, 5);

  const newDomain = applyClusterSuggestions(domain, toApply, 5);

  console.log(`Applied ${toApply.length} clusters: ${toApply.map(s => s.cluster).join(", ")}`);

  return {
    domain: newDomain,
    suggestions,
    applied: toApply.map(s => s.cluster),
  };
}
