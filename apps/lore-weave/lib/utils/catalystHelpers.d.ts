/**
 * Catalyst Helper Utilities
 *
 * Framework-level helpers for working with the catalyst system.
 * These are domain-agnostic and work with any entity type.
 */
import { HardState, Relationship, CatalyzedEvent } from '../types/worldTypes';
import { Graph } from '../types/engine';
/**
 * Get all entities that can act (have catalyst.canAct = true)
 * @param graph - The world graph
 * @param category - Filter by agent category
 * @returns Array of agent entities
 */
export declare function getAgentsByCategory(graph: Graph, category?: 'first-order' | 'second-order' | 'all'): HardState[];
/**
 * Check if an entity can perform an action in a specific domain
 * @param entity - The entity to check
 * @param actionDomain - The action domain (e.g., 'political', 'magical')
 * @returns True if entity can act in this domain
 */
export declare function canPerformAction(entity: HardState, actionDomain: string): boolean;
/**
 * Get entity's influence in a specific domain
 * Default implementation returns base influence.
 * Domains can override to provide domain-specific influence calculations.
 * @param entity - The entity
 * @param actionDomain - The action domain
 * @returns Influence score (0-1)
 */
export declare function getInfluence(entity: HardState, actionDomain: string): number;
/**
 * Record catalyst attribution on a relationship
 * @param relationship - The relationship to attribute
 * @param catalystId - ID of the agent that caused this
 * @returns The relationship with attribution added
 */
export declare function recordCatalyst(relationship: Relationship, catalystId: string): Relationship;
/**
 * Get all events (relationships/entities) catalyzed by an entity
 * @param graph - The world graph
 * @param entityId - ID of the catalyst entity
 * @returns Array of relationships and entities caused by this catalyst
 */
export declare function getCatalyzedEvents(graph: Graph, entityId: string): (Relationship | HardState)[];
/**
 * Get count of events catalyzed by entity
 * Used for prominence evolution and influence calculations
 * @param graph - The world graph
 * @param entityId - ID of the catalyst entity
 * @returns Number of events catalyzed
 */
export declare function getCatalyzedEventCount(graph: Graph, entityId: string): number;
/**
 * Add a catalyzed event to an entity's record
 * @param entity - The catalyst entity
 * @param event - The event to record
 */
export declare function addCatalyzedEvent(entity: HardState, event: CatalyzedEvent): void;
/**
 * Check if entity has a specific relationship
 * @param entity - The entity to check
 * @param relationshipKind - The relationship kind to look for
 * @param direction - Check as 'src' or 'dst' or 'both'
 * @returns True if relationship exists
 */
export declare function hasRelationship(entity: HardState, relationshipKind: string, direction?: 'src' | 'dst' | 'both'): boolean;
/**
 * Calculate action attempt chance based on entity properties
 * @param entity - The entity attempting action
 * @param baseRate - Base action attempt rate (from system parameters)
 * @returns Probability of action attempt this tick
 */
export declare function calculateAttemptChance(entity: HardState, baseRate: number): number;
/**
 * Initialize or update catalyst properties for an entity
 * This is a helper for domain code to set up catalyst properties
 * @param entity - The entity to initialize
 * @param canAct - Can this entity perform actions?
 * @param actionDomains - Which domains can it act in?
 * @param initialInfluence - Starting influence (default 0.5)
 */
export declare function initializeCatalyst(entity: HardState, canAct: boolean, actionDomains?: string[], initialInfluence?: number): void;
/**
 * Smart catalyst initialization based on entity type and prominence.
 * Automatically determines action domains and influence based on entity properties.
 * Requires graph with domain schema for action domain mapping.
 *
 * @param entity - The entity to initialize
 * @param graph - Graph with domain schema
 */
export declare function initializeCatalystSmart(entity: HardState, graph: Graph): void;
/**
 * Update entity influence based on action outcome
 * @param entity - The entity whose influence to update
 * @param success - Whether the action succeeded
 * @param magnitude - How impactful was the action (0-1)
 */
export declare function updateInfluence(entity: HardState, success: boolean, magnitude?: number): void;
//# sourceMappingURL=catalystHelpers.d.ts.map