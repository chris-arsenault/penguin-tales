import { HardState, Relationship } from './worldTypes';

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
  | 'chain_link';

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
  };
  nearbyEntities?: HardState[];
  relatedHistory?: string[];
}
