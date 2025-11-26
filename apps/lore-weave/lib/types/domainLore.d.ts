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
    getWorldName(): string;
    getCanonFacts(): string[];
    getCulturalGroups(): CulturalGroup[];
    getNamingRules(): NamingRules;
    getRelationshipPatterns(): string[];
    getTechnologyNotes(): string[];
    getMagicSystemNotes(): string[];
    getConflictPatterns(): string[];
    getGeographyConstraints(): GeographyConstraints;
    getActionDomainDescriptions(): Record<string, string>;
    getEntityEnrichmentPrompt(kind: string, subtype: string): string | null;
    getRelationshipEnrichmentPrompt(kind: string): string | null;
    getOccurrenceEnrichmentPrompt(subtype: string): string | null;
    getEraEnrichmentPrompt(subtype: string): string | null;
}
//# sourceMappingURL=domainLore.d.ts.map