import type { NamingDomain, DomainMatch } from "../types/domain.js";

/**
 * Match score calculation for a domain against entity criteria
 */
function calculateMatchScore(
  domain: NamingDomain,
  kind: string,
  subKind?: string,
  tags: string[] = []
): { score: number; reason: string } {
  let score = 0;
  const reasons: string[] = [];

  // Check kind match (required)
  if (!domain.appliesTo.kind.includes(kind)) {
    return { score: 0, reason: "kind mismatch" };
  }
  score += 100;
  reasons.push(`kind=${kind}`);

  // Check subKind match (if specified by domain)
  if (domain.appliesTo.subKind && domain.appliesTo.subKind.length > 0) {
    if (subKind && domain.appliesTo.subKind.includes(subKind)) {
      score += 50;
      reasons.push(`subKind=${subKind}`);
    } else if (!subKind) {
      // Domain wants subKind but entity doesn't have one - partial penalty
      score -= 10;
      reasons.push("subKind unspecified");
    } else {
      // SubKind mismatch
      return { score: 0, reason: "subKind mismatch" };
    }
  }

  // Check tag overlap (more matching tags = higher score)
  if (domain.appliesTo.tags && domain.appliesTo.tags.length > 0) {
    const matchingTags = domain.appliesTo.tags.filter((tag) =>
      tags.includes(tag)
    );

    if (matchingTags.length > 0) {
      // Boost score based on tag overlap
      const tagScore = (matchingTags.length / domain.appliesTo.tags.length) * 50;
      score += tagScore;
      reasons.push(`tags=[${matchingTags.join(",")}]`);
    } else {
      // Domain wants specific tags but entity has none
      score -= 20;
      reasons.push("no matching tags");
    }
  }

  // Bonus for exact tag match (entity has all required tags and no extras)
  if (domain.appliesTo.tags && domain.appliesTo.tags.length > 0) {
    const hasAllRequiredTags = domain.appliesTo.tags.every((tag) =>
      tags.includes(tag)
    );
    if (hasAllRequiredTags) {
      score += 10;
      reasons.push("all required tags present");
    }
  }

  return {
    score,
    reason: reasons.join(", "),
  };
}

/**
 * Select the best matching domain for an entity
 */
export function selectDomain(
  domains: NamingDomain[],
  kind: string,
  subKind?: string,
  tags: string[] = []
): NamingDomain | null {
  if (domains.length === 0) {
    return null;
  }

  let bestMatch: DomainMatch | null = null;

  for (const domain of domains) {
    const { score, reason } = calculateMatchScore(domain, kind, subKind, tags);

    if (score > 0) {
      if (!bestMatch || score > bestMatch.score) {
        bestMatch = { domain, score, reason };
      }
    }
  }

  return bestMatch?.domain ?? null;
}

/**
 * Get all matching domains ranked by score
 */
export function rankDomains(
  domains: NamingDomain[],
  kind: string,
  subKind?: string,
  tags: string[] = []
): DomainMatch[] {
  const matches: DomainMatch[] = [];

  for (const domain of domains) {
    const { score, reason } = calculateMatchScore(domain, kind, subKind, tags);

    if (score > 0) {
      matches.push({ domain, score, reason });
    }
  }

  // Sort by score descending
  matches.sort((a, b) => b.score - a.score);

  return matches;
}

/**
 * Check if a domain matches entity criteria (boolean)
 */
export function domainMatches(
  domain: NamingDomain,
  kind: string,
  subKind?: string,
  tags: string[] = []
): boolean {
  const { score } = calculateMatchScore(domain, kind, subKind, tags);
  return score > 0;
}

/**
 * Find all domains that match a given kind
 */
export function findDomainsForKind(
  domains: NamingDomain[],
  kind: string
): NamingDomain[] {
  return domains.filter((domain) => domain.appliesTo.kind.includes(kind));
}

/**
 * Validate that domains don't have conflicts
 * Two domains conflict if they match the exact same criteria with equal specificity
 */
export function findDomainConflicts(
  domains: NamingDomain[]
): Array<{ domain1: NamingDomain; domain2: NamingDomain; reason: string }> {
  const conflicts: Array<{
    domain1: NamingDomain;
    domain2: NamingDomain;
    reason: string;
  }> = [];

  for (let i = 0; i < domains.length; i++) {
    for (let j = i + 1; j < domains.length; j++) {
      const d1 = domains[i];
      const d2 = domains[j];

      // Check if they have identical appliesTo criteria
      const sameKinds =
        JSON.stringify(d1.appliesTo.kind.sort()) ===
        JSON.stringify(d2.appliesTo.kind.sort());
      const sameSubKinds =
        JSON.stringify(d1.appliesTo.subKind?.sort()) ===
        JSON.stringify(d2.appliesTo.subKind?.sort());
      const sameTags =
        JSON.stringify(d1.appliesTo.tags?.sort()) ===
        JSON.stringify(d2.appliesTo.tags?.sort());

      if (sameKinds && sameSubKinds && sameTags) {
        conflicts.push({
          domain1: d1,
          domain2: d2,
          reason: "identical matching criteria",
        });
      }
    }
  }

  return conflicts;
}

/**
 * Get debug info about domain selection
 */
export function explainDomainSelection(
  domains: NamingDomain[],
  kind: string,
  subKind?: string,
  tags: string[] = []
): string {
  const ranked = rankDomains(domains, kind, subKind, tags);

  if (ranked.length === 0) {
    return `No domains match (kind=${kind}, subKind=${subKind}, tags=[${tags.join(",")}])`;
  }

  const lines = [
    `Entity criteria: kind=${kind}, subKind=${subKind ?? "none"}, tags=[${tags.join(",")}]`,
    "",
    "Matching domains (ranked):",
  ];

  for (const match of ranked) {
    lines.push(
      `  ${match.domain.id}: score=${match.score.toFixed(1)} (${match.reason})`
    );
  }

  return lines.join("\n");
}
