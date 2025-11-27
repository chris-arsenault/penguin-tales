import type { EntityCoordinates } from './coordinates';

// Core types from your specification
export type Prominence =
    | 'forgotten'
    | 'marginal'
    | 'recognized'
    | 'renowned'
    | 'mythic';

/**
 * Entity tags as key-value pairs.
 *
 * Keys are semantic categories, values are either:
 * - `true` for boolean flags (e.g., { mystical: true })
 * - strings for categorized attributes (e.g., { region: 'aurora_stack' })
 *
 * Common keys:
 * - `region`: Region ID where entity is located
 * - `culture`: Cultural affiliation
 * - `terrain`: Physical environment type
 * - `name`: Slugified entity name (system-generated)
 * - Domain-specific flags: anomaly, strategic, resource, etc.
 */
export type EntityTags = Record<string, string | boolean>;

export interface HardState {
    id: string;              // stable ID in the graph
    kind: string;            // Domain defines valid values
    subtype: string;
    name: string;
    description: string;
    status: string;
    prominence: Prominence;
    culture: string;  // Domain-defined cultural affiliation (e.g., 'aurora-stack', 'nightshelf', 'orca', 'world')
    tags: EntityTags;        // Key-value pairs for semantic tagging
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

    // Coordinates across multiple spaces (physical, political, social, etc.)
    coordinates: EntityCoordinates;
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

// Convenience type aliases for domain-specific subtypes and statuses
// These are string types - actual valid values are defined in domain schema
export type EntityKind = string;
export type NPCSubtype = string;
export type LocationSubtype = string;
export type FactionSubtype = string;
export type RulesSubtype = string;
export type AbilitiesSubtype = string;
export type NPCStatus = string;
export type FactionStatus = string;
export type LocationStatus = string;
export type RulesStatus = string;
export type AbilitiesStatus = string;

// Discovery tracking (emergent system)
export interface DiscoveryState {
  currentThreshold: number;     // Difficulty threshold for next discovery
  lastDiscoveryTick: number;    // Last tick a discovery occurred
  discoveriesThisEpoch: number; // Count for current epoch
}
