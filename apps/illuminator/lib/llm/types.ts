/**
 * LLM Types
 *
 * Types for LLM enrichment, lore indexing, and domain lore providers.
 */

import type { HardState, Relationship } from '../types';

// ============================================================================
// LORE INDEX AND RECORDS
// ============================================================================

export interface LoreIndex {
  sourceText: string;
  colonies: Array<{
    name: string;
    values: string[];
    style: string;
    notes?: string[];
  }>;
  factions: string[];
  namingRules: {
    patterns: string[];
    earnedNameRules: string;
    colonyTone: Record<string, string>;
  };
  relationshipPatterns: string[];
  techNotes: string[];
  magicNotes: string[];
  tensions: string[];
  canon: string[];
  legends: string[];

  // Geographic knowledge for exploration system
  geography: {
    constraints: {
      totalArea: string;
      verticalDepth: boolean;
      secretPassages: boolean;
    };
    knownLocations: Array<{
      name: string;
      type: string;
      status: 'active' | 'abandoned' | 'vanished';
      notes: string;
    }>;
    discoveryPrecedents: Array<{
      location: string;
      discoverer?: string;
      significance: string;
    }>;
  };

  // Location themes for discovery generation
  locationThemes: {
    resources: string[];
    mystical: string[];
    strategic: string[];
  };
}

export type LoreRecordType =
  | 'name'
  | 'description'
  | 'era_narrative'
  | 'relationship_backstory'
  | 'tech_magic'
  | 'discovery_event'
  | 'chain_link'
  | 'entity_change';

export interface LoreRecord {
  id: string;
  type: LoreRecordType;
  targetId?: string;
  relationship?: Relationship;
  text: string;
  warnings?: string[];
  cached?: boolean;
  metadata?: Record<string, any>;
}

export interface EnrichmentContext {
  graphSnapshot: {
    tick: number;
    era: string;
    pressures?: Record<string, number>;
    entities: ReadonlyMap<string, HardState>;  // Read-only snapshot for enrichment
    relationships: readonly Relationship[];  // Active relationships (current state)
    historicalRelationships?: readonly Relationship[];  // Archived relationships (past state for lore)
  };
  nearbyEntities?: HardState[];
  relatedHistory?: string[];
  catalystInfo?: {
    entityId: string;
    relationshipKind?: string;
  };
}

// ============================================================================
// DOMAIN LORE PROVIDER
// ============================================================================

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
