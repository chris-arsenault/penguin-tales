/**
 * Domain Lore Provider Interface
 *
 * Framework-level interface for domain-specific lore.
 * Domains implement this to provide LLM enrichment context.
 *
 * This abstraction separates domain-specific knowledge (penguin colonies,
 * ice magic, etc.) from the framework-level enrichment service.
 */

export interface CulturalGroup {
  name: string;
  values: string[];
  style: string;
  notes?: string[];
}

export interface NamingRules {
  patterns: string[];
  toneGuidance: Record<string, string>;
  earnedNameRules?: string;
}

export interface GeographyConstraints {
  scale: string;
  characteristics: string[];
}

/**
 * Main interface for domain-specific lore provision
 */
export interface DomainLoreProvider {
  // Core world identity
  getWorldName(): string;
  getCanonFacts(): string[];

  // Cultural and social structures
  getCulturalGroups(): CulturalGroup[];
  getNamingRules(): NamingRules;
  getRelationshipPatterns(): string[];

  // Domain-specific mechanics
  getTechnologyNotes(): string[];
  getMagicSystemNotes(): string[];
  getConflictPatterns(): string[];

  // Geography and setting
  getGeographyConstraints(): GeographyConstraints;

  // Action domain descriptions (for catalyst model)
  getActionDomainDescriptions(): Record<string, string>;

  // Entity-specific enrichment prompts
  getEntityEnrichmentPrompt(kind: string, subtype: string): string | null;
  getRelationshipEnrichmentPrompt(kind: string): string | null;
  getOccurrenceEnrichmentPrompt(subtype: string): string | null;
  getEraEnrichmentPrompt(subtype: string): string | null;

  // Validation terms (optional - for LLM output quality checking)
  getGeographicTerms?(): string[];    // Terms expected in geographic feature names
  getMysticalTerms?(): string[];      // Terms expected in anomaly/mystical location names
  getLoreCues?(): string[];           // General lore cues that should appear in descriptions
}
