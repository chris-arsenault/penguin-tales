/**
 * Relationship Builder Utility
 *
 * Provides fluent API for creating relationships with validation and consistency.
 * Reduces boilerplate in templates and systems.
 */
export class RelationshipBuilder {
    relationships = [];
    /**
     * Add a relationship with fluent API
     * @param kind - Relationship type
     * @param src - Source entity ID
     * @param dst - Destination entity ID
     * @param strength - Optional relationship strength (0-1)
     */
    add(kind, src, dst, strength) {
        const rel = { kind, src, dst };
        if (strength !== undefined) {
            rel.strength = strength;
        }
        this.relationships.push(rel);
        return this;
    }
    /**
     * Add multiple relationships of the same kind from one source to multiple destinations
     * @param kind - Relationship type
     * @param src - Source entity ID
     * @param destinations - Array of destination entity IDs
     * @param strength - Optional relationship strength
     */
    addManyFrom(kind, src, destinations, strength) {
        destinations.forEach(dst => {
            this.add(kind, src, dst, strength);
        });
        return this;
    }
    /**
     * Add multiple relationships of the same kind from multiple sources to one destination
     * @param kind - Relationship type
     * @param sources - Array of source entity IDs
     * @param dst - Destination entity ID
     * @param strength - Optional relationship strength
     */
    addManyTo(kind, sources, dst, strength) {
        sources.forEach(src => {
            this.add(kind, src, dst, strength);
        });
        return this;
    }
    /**
     * Add bidirectional relationship (creates two relationships)
     * @param kind - Relationship type
     * @param entity1 - First entity ID
     * @param entity2 - Second entity ID
     * @param strength - Optional relationship strength
     */
    addBidirectional(kind, entity1, entity2, strength) {
        this.add(kind, entity1, entity2, strength);
        this.add(kind, entity2, entity1, strength);
        return this;
    }
    /**
     * Add relationship only if it doesn't already exist in the graph
     * @param graph - Current graph state
     * @param kind - Relationship type
     * @param src - Source entity ID
     * @param dst - Destination entity ID
     * @param strength - Optional relationship strength
     */
    addIfNotExists(graph, kind, src, dst, strength) {
        const exists = graph.relationships.some(r => r.kind === kind && r.src === src && r.dst === dst);
        if (!exists) {
            this.add(kind, src, dst, strength);
        }
        return this;
    }
    /**
     * Get all relationships built so far
     */
    build() {
        return this.relationships;
    }
    /**
     * Clear all relationships and start fresh
     */
    clear() {
        this.relationships = [];
        return this;
    }
    /**
     * Get count of relationships
     */
    count() {
        return this.relationships.length;
    }
}
/**
 * Helper function to create a new RelationshipBuilder
 * Usage: buildRelationships().add(...).add(...).build()
 */
export function buildRelationships() {
    return new RelationshipBuilder();
}
/**
 * Quick helper to create a single relationship
 * @param kind - Relationship type
 * @param src - Source entity ID
 * @param dst - Destination entity ID
 * @param strength - Optional relationship strength
 */
export function createRelationship(kind, src, dst, strength) {
    const rel = { kind, src, dst };
    if (strength !== undefined) {
        rel.strength = strength;
    }
    return rel;
}
//# sourceMappingURL=relationshipBuilder.js.map