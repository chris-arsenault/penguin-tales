/**
 * Relationship Builder Utility
 *
 * Provides fluent API for creating relationships with validation and consistency.
 * Reduces boilerplate in templates and systems.
 */
import { Relationship } from '../types/worldTypes';
import { Graph } from '../types/engine';
export declare class RelationshipBuilder {
    private relationships;
    /**
     * Add a relationship with fluent API
     * @param kind - Relationship type
     * @param src - Source entity ID
     * @param dst - Destination entity ID
     * @param strength - Optional relationship strength (0-1)
     */
    add(kind: string, src: string, dst: string, strength?: number): this;
    /**
     * Add multiple relationships of the same kind from one source to multiple destinations
     * @param kind - Relationship type
     * @param src - Source entity ID
     * @param destinations - Array of destination entity IDs
     * @param strength - Optional relationship strength
     */
    addManyFrom(kind: string, src: string, destinations: string[], strength?: number): this;
    /**
     * Add multiple relationships of the same kind from multiple sources to one destination
     * @param kind - Relationship type
     * @param sources - Array of source entity IDs
     * @param dst - Destination entity ID
     * @param strength - Optional relationship strength
     */
    addManyTo(kind: string, sources: string[], dst: string, strength?: number): this;
    /**
     * Add bidirectional relationship (creates two relationships)
     * @param kind - Relationship type
     * @param entity1 - First entity ID
     * @param entity2 - Second entity ID
     * @param strength - Optional relationship strength
     */
    addBidirectional(kind: string, entity1: string, entity2: string, strength?: number): this;
    /**
     * Add relationship only if it doesn't already exist in the graph
     * @param graph - Current graph state
     * @param kind - Relationship type
     * @param src - Source entity ID
     * @param dst - Destination entity ID
     * @param strength - Optional relationship strength
     */
    addIfNotExists(graph: Graph, kind: string, src: string, dst: string, strength?: number): this;
    /**
     * Get all relationships built so far
     */
    build(): Relationship[];
    /**
     * Clear all relationships and start fresh
     */
    clear(): this;
    /**
     * Get count of relationships
     */
    count(): number;
}
/**
 * Helper function to create a new RelationshipBuilder
 * Usage: buildRelationships().add(...).add(...).build()
 */
export declare function buildRelationships(): RelationshipBuilder;
/**
 * Quick helper to create a single relationship
 * @param kind - Relationship type
 * @param src - Source entity ID
 * @param dst - Destination entity ID
 * @param strength - Optional relationship strength
 */
export declare function createRelationship(kind: string, src: string, dst: string, strength?: number): Relationship;
//# sourceMappingURL=relationshipBuilder.d.ts.map