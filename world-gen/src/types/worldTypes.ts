// Core types from your specification
export type Prominence =
    | 'forgotten'
    | 'marginal'
    | 'recognized'
    | 'renowned'
    | 'mythic';

export interface HardState {
    id: string;              // stable ID in the graph
    kind: string;            // Domain defines valid values (was: 'npc' | 'location' | 'faction' | 'rules' | 'abilities')
    subtype: string;
    name: string;
    description: string;
    status: string;
    prominence: Prominence;
    tags: string[];          // <= 10
    links: Relationship[];
    createdAt: number;       // tick or epoch index
    updatedAt: number;

    // Catalyst properties (optional - only for entities that can act)
    catalyst?: CatalystProperties;

    // Temporal properties (optional - only for era and occurrence entities)
    temporal?: {
        startTick: number;
        endTick: number | null;
    };
}

// Catalyst system types
export interface CatalyzedEvent {
    relationshipId?: string;  // ID of relationship this catalyzed
    entityId?: string;        // ID of entity this catalyzed
    action: string;           // Description of action taken
    tick: number;             // When this occurred
}

export interface CatalystProperties {
    canAct: boolean;              // Can this entity perform actions?
    actionDomains: string[];      // Domain-defined action categories
    influence: number;            // 0-1, affects action success probability
    catalyzedEvents: CatalyzedEvent[]; // What has this entity caused
}

export interface Relationship {
    kind: string;   // must be allowed by the (src.kind, dst.kind) matrix
    src: string;    // HardState.id
    dst: string;    // HardState.id
    strength?: number;  // 0.0 (weak/spatial) to 1.0 (strong/narrative) - optional for backward compat
    distance?: number;  // Cognitive similarity distance (lower = more similar, 0-1 normalized)
    catalyzedBy?: string;  // ID of agent that caused this relationship
    category?: string;     // Domain-defined relationship category (e.g., 'political', 'immutable_fact')
    createdAt?: number;    // Tick when relationship was created

    // Temporal tracking (for day 0 coherence)
    status?: 'active' | 'historical';  // Defaults to 'active'
    archivedAt?: number;  // Tick when relationship was archived (became historical)
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

// DEPRECATED: Domain-specific types moved to domain schema
// These are kept for backward compatibility but should not be used in new code
// TODO: Remove after migration complete
export type EntityKind = string; // was: HardState['kind']
export type NPCSubtype = string; // was: 'merchant' | 'mayor' | 'hero' | 'outlaw'
export type LocationSubtype = string; // was: 'iceberg' | 'colony' | 'igloo' | 'geographic_feature' | 'anomaly'
export type FactionSubtype = string; // was: 'political' | 'criminal' | 'cult' | 'company'
export type RulesSubtype = string; // was: 'edict' | 'taboo' | 'social' | 'natural'
export type AbilitiesSubtype = string; // was: 'magic' | 'faith' | 'technology' | 'physical'

// DEPRECATED: Domain-specific status types
export type NPCStatus = string; // was: 'alive' | 'dead' | 'fictional' | 'missing'
export type FactionStatus = string; // was: 'active' | 'disbanded' | 'waning'
export type LocationStatus = string; // was: 'thriving' | 'waning' | 'abandoned'
export type RulesStatus = string; // was: 'active' | 'forgotten' | 'proposed' | 'enacted' | 'repealed'
export type AbilitiesStatus = string; // was: 'active' | 'lost'

// Discovery tracking (emergent system)
export interface DiscoveryState {
  currentThreshold: number;     // Difficulty threshold for next discovery
  lastDiscoveryTick: number;    // Last tick a discovery occurred
  discoveriesThisEpoch: number; // Count for current epoch
}
