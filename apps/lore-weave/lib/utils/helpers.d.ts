import { Graph } from '../types/engine';
import { HardState, Relationship } from '../types/worldTypes';
import { NameGenerator } from '../types/domainSchema';
/**
 * Set the name generator to use for generating entity names.
 * Should be called during domain initialization.
 */
export declare function setNameGenerator(generator: NameGenerator): void;
/**
 * Generate a name using the current name generator.
 */
export declare function generateName(type?: string): string;
export declare function generateId(prefix: string): string;
export declare function pickRandom<T>(array: T[]): T;
export declare function pickMultiple<T>(array: T[], count: number): T[];
export declare function findEntities(graph: Graph, criteria: Partial<HardState>): HardState[];
export interface RelationshipQueryOptions {
    minStrength?: number;
    maxStrength?: number;
    sortByStrength?: boolean;
}
export declare function getRelated(graph: Graph, entityId: string, relationshipKind?: string, direction?: 'src' | 'dst' | 'both', options?: RelationshipQueryOptions): HardState[];
export declare function hasRelationship(graph: Graph, srcId: string, dstId: string, kind?: string): boolean;
export declare function getResidents(graph: Graph, locationId: string): HardState[];
export declare function getLocation(graph: Graph, npcId: string): HardState | undefined;
export declare function getFactionMembers(graph: Graph, factionId: string): HardState[];
export declare function getFactionLeader(graph: Graph, factionId: string): HardState | undefined;
export declare function getCoreFactionMembers(graph: Graph, factionId: string): HardState[];
export declare function getStrongAllies(graph: Graph, entityId: string): HardState[];
export declare function getWeakRelationships(graph: Graph, entityId: string): Relationship[];
export declare function getProminenceValue(prominence: HardState['prominence']): number;
export declare function adjustProminence(current: HardState['prominence'], delta: number): HardState['prominence'];
export declare function slugifyName(name: string): string;
export declare function upsertNameTag(entity: HardState, sourceName: string): void;
export declare function normalizeInitialState(entities: any[]): HardState[];
export declare function addEntity(graph: Graph, entity: Partial<HardState>): string;
/**
 * Check if a relationship kind requires distance (is a lineage relationship).
 * Requires graph with domain schema.
 */
export declare function isLineageRelationship(kind: string, graph: Graph): boolean;
/**
 * Get expected distance range for a lineage relationship kind.
 * Requires graph with domain schema.
 * Returns undefined for non-lineage relationships.
 */
export declare function getExpectedDistanceRange(kind: string, graph: Graph): {
    min: number;
    max: number;
} | undefined;
/**
 * Get narrative strength for a relationship kind (0.0-1.0).
 * Requires graph with domain schema.
 */
export declare function getRelationshipStrength(kind: string, graph: Graph): number;
/**
 * Get behavioral category for a relationship kind.
 * Requires graph with domain schema.
 */
export declare function getRelationshipCategory(kind: string, graph: Graph): string;
/**
 * Add a relationship between two entities.
 *
 * @param graph - The world graph
 * @param kind - Relationship type
 * @param srcId - Source entity ID
 * @param dstId - Destination entity ID
 * @param strengthOverride - Optional strength override (0.0-1.0). If not provided, auto-assigned based on kind.
 * @param distance - Optional cognitive similarity distance (0.0 = identical, 1.0 = maximally different)
 */
export declare function addRelationship(graph: Graph, kind: string, srcId: string, dstId: string, strengthOverride?: number, distance?: number): void;
export declare function updateEntity(graph: Graph, entityId: string, changes: Partial<HardState>): void;
/**
 * Add a relationship with a bounded random distance.
 * Used for lineage-based connectivity where entities link to existing same-kind entities.
 *
 * @param graph - The world graph
 * @param kind - Relationship type
 * @param srcId - Source entity ID
 * @param dstId - Destination entity ID
 * @param distanceRange - Min/max range for random distance selection
 * @param strengthOverride - Optional strength override (0.0-1.0)
 *
 * @example
 * // Incremental tech improvement (0.1-0.3 distance)
 * addRelationshipWithDistance(graph, 'derived_from', newTechId, oldTechId, { min: 0.1, max: 0.3 })
 *
 * @example
 * // Major faction split (0.6-0.8 distance)
 * addRelationshipWithDistance(graph, 'split_from', splinterId, parentId, { min: 0.6, max: 0.8 })
 */
export declare function addRelationshipWithDistance(graph: Graph, kind: string, srcId: string, dstId: string, distanceRange: {
    min: number;
    max: number;
}, strengthOverride?: number): void;
/**
 * Archive a relationship by marking it as historical.
 * Used for temporal tracking to maintain day 0 coherence.
 *
 * @param graph - The world graph
 * @param src - Source entity ID
 * @param dst - Destination entity ID
 * @param kind - Relationship kind to archive
 */
export declare function archiveRelationship(graph: Graph, src: string, dst: string, kind: string): void;
/**
 * Modify relationship strength by delta
 * @param delta - Amount to change strength (+/- value)
 * @returns true if relationship was modified, false if not found
 */
export declare function modifyRelationshipStrength(graph: Graph, srcId: string, dstId: string, kind: string, delta: number): boolean;
export declare function validateRelationship(schema: any, srcKind: string, dstKind: string, relKind: string): boolean;
export declare function weightedRandom<T>(items: T[], weights: number[]): T | undefined;
/**
 * Check if a probabilistic event should occur, scaled by an era modifier.
 *
 * @param baseProbability - Base chance of the event occurring (0.0 to 1.0)
 *                         e.g., 0.3 = 30% chance
 * @param eraModifier - Era-based multiplier for the probability
 *                      > 1 increases likelihood, < 1 decreases it
 * @returns true if the event should occur
 *
 * @example
 * // 30% base chance, doubled in conflict era (modifier = 2)
 * if (rollProbability(0.3, eraModifier)) {
 *   createConflict();
 * }
 */
export declare function rollProbability(baseProbability: number, eraModifier?: number): boolean;
/**
 * Check if an entity can form a new relationship of a given type based on cooldown.
 *
 * @param graph - The world graph
 * @param entityId - The entity attempting to form a relationship
 * @param relationshipType - The type of relationship (e.g., 'lover_of', 'enemy_of')
 * @param cooldownTicks - Minimum ticks that must pass between forming relationships of this type
 * @returns true if the entity is not on cooldown for this relationship type
 */
export declare function canFormRelationship(graph: Graph, entityId: string, relationshipType: string, cooldownTicks: number): boolean;
/**
 * Record that an entity has formed a relationship, updating cooldown tracking.
 *
 * @param graph - The world graph
 * @param entityId - The entity that formed a relationship
 * @param relationshipType - The type of relationship formed
 */
export declare function recordRelationshipFormation(graph: Graph, entityId: string, relationshipType: string): void;
/**
 * Check if a new relationship is compatible with existing relationships.
 * Prevents contradictory relationships like being both lover and enemy.
 * Uses domain schema conflictsWith.
 *
 * @param graph - The world graph
 * @param srcId - Source entity ID
 * @param dstId - Destination entity ID
 * @param newKind - The relationship kind to check
 * @returns true if the new relationship is compatible with existing ones
 */
export declare function areRelationshipsCompatible(graph: Graph, srcId: string, dstId: string, newKind: string): boolean;
/**
 * Calculate relationship formation weight based on existing connection count.
 * Favors underconnected entities to balance network density and prevent hubs.
 *
 * @param entity - The entity to calculate weight for
 * @returns Weight multiplier (higher = more likely to form relationships)
 */
export declare function getConnectionWeight(entity: HardState): number;
/**
 * Determine the relationship between two sets of factions.
 *
 * @param factions1 - First set of factions
 * @param factions2 - Second set of factions
 * @param graph - The world graph
 * @returns 'allied', 'enemy', or 'neutral'
 */
export declare function getFactionRelationship(factions1: HardState[], factions2: HardState[], graph: Graph): 'allied' | 'enemy' | 'neutral';
/**
 * Safely parse JSON with automatic cleanup of markdown code blocks
 * Returns null if parsing fails
 */
export declare function parseJsonSafe<T = any>(raw: string): T | null;
/**
 * Split an array into chunks of a specified size
 */
export declare function chunk<T>(items: T[], size: number): T[][];
/**
 * Generate unique ID for lore records with timestamp and counter
 */
export declare function generateLoreId(prefix: string): string;
//# sourceMappingURL=helpers.d.ts.map