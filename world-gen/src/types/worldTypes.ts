// Core types from your specification
export type Prominence =
    | 'forgotten'
    | 'marginal'
    | 'recognized'
    | 'renowned'
    | 'mythic';

export interface HardState {
    id: string;              // stable ID in the graph
    kind: 'npc' | 'location' | 'faction' | 'rules' | 'abilities';
    subtype: string;
    name: string;
    description: string;
    status: string;
    prominence: Prominence;
    tags: string[];          // <= 10
    links: Relationship[];
    createdAt: number;       // tick or epoch index
    updatedAt: number;
}

export interface Relationship {
    kind: string;   // must be allowed by the (src.kind, dst.kind) matrix
    src: string;    // HardState.id
    dst: string;    // HardState.id
    strength?: number;  // 0.0 (weak/spatial) to 1.0 (strong/narrative) - optional for backward compat
}

// Schema types
export interface WorldSchema {
    hardState: Array<{
        kind: string;
        subtype: string[];
        status: string[];
    }>;
    relationships: Record<string, Record<string, string[]>>;
}

// Utility type for entity creation
export type EntityKind = HardState['kind'];
export type NPCSubtype = 'merchant' | 'mayor' | 'hero' | 'outlaw';
export type LocationSubtype = 'iceberg' | 'colony' | 'igloo' | 'geographic_feature' | 'anomaly';
export type FactionSubtype = 'political' | 'criminal' | 'cult' | 'company';
export type RulesSubtype = 'edict' | 'taboo' | 'social' | 'natural';
export type AbilitiesSubtype = 'magic' | 'faith' | 'technology' | 'physical';

// Status types for each entity kind (expanded for new mechanics)
export type NPCStatus = 'alive' | 'dead' | 'fictional' | 'missing';
export type FactionStatus = 'active' | 'disbanded' | 'waning';
export type LocationStatus = 'thriving' | 'waning' | 'abandoned';
export type RulesStatus = 'active' | 'forgotten' | 'proposed' | 'enacted' | 'repealed';
export type AbilitiesStatus = 'active' | 'lost';

// Discovery tracking (emergent system)
export interface DiscoveryState {
  currentThreshold: number;     // Difficulty threshold for next discovery
  lastDiscoveryTick: number;    // Last tick a discovery occurred
  discoveriesThisEpoch: number; // Count for current epoch
}
