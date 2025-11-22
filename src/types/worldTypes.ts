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
    tags: string[];          // <= 5
    links: Relationship[];
    createdAt: number;       // tick or epoch index
    updatedAt: number;
}

export interface Relationship {
    kind: string;   // must be allowed by the (src.kind, dst.kind) matrix
    src: string;    // HardState.id
    dst: string;    // HardState.id
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
