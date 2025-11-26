/**
 * Entity Cluster Builder
 *
 * Simplifies creating groups of related entities with pre-connected relationships.
 * Handles placeholder ID generation and resolution automatically.
 *
 * Usage:
 * ```typescript
 * const cluster = new EntityClusterBuilder()
 *   .addEntity({ kind: 'faction', subtype: 'guild', name: 'Traders' })
 *   .addEntity({ kind: 'npc', subtype: 'merchant', name: 'Bob' })
 *   .relate(0, 1, 'member_of')  // merchant Bob joins guild
 *   .build();
 * ```
 */
import { HardState, Relationship } from '../types/worldTypes';
import { TemplateResult } from '../types/engine';
export declare class EntityClusterBuilder {
    private entities;
    private relationships;
    /**
     * Add an entity to the cluster
     * Returns the index of the added entity for use in relate()
     * @param entity - Partial entity (id will be assigned as placeholder)
     */
    addEntity(entity: Partial<HardState>): this;
    /**
     * Add multiple entities at once
     * @param entities - Array of partial entities
     */
    addEntities(entities: Array<Partial<HardState>>): this;
    /**
     * Create a relationship between entities in the cluster
     * @param fromIndex - Index of source entity (0-based)
     * @param toIndex - Index or ID of destination entity
     * @param kind - Relationship type
     * @param strength - Optional relationship strength
     */
    relate(fromIndex: number, toIndex: number | string, kind: string, strength?: number): this;
    /**
     * Create a relationship from a cluster entity to an existing entity
     * @param fromIndex - Index of source entity in cluster
     * @param toEntityId - ID of destination entity (already in graph)
     * @param kind - Relationship type
     * @param strength - Optional relationship strength
     */
    relateToExisting(fromIndex: number, toEntityId: string, kind: string, strength?: number): this;
    /**
     * Create a relationship from an existing entity to a cluster entity
     * @param fromEntityId - ID of source entity (already in graph)
     * @param toIndex - Index of destination entity in cluster
     * @param kind - Relationship type
     * @param strength - Optional relationship strength
     */
    relateFromExisting(fromEntityId: string, toIndex: number, kind: string, strength?: number): this;
    /**
     * Create relationships from one cluster entity to multiple others
     * @param fromIndex - Index of source entity
     * @param toIndices - Array of destination indices or IDs
     * @param kind - Relationship type
     * @param strength - Optional relationship strength
     */
    relateManyFrom(fromIndex: number, toIndices: Array<number | string>, kind: string, strength?: number): this;
    /**
     * Create relationships from multiple cluster entities to one
     * @param fromIndices - Array of source indices
     * @param toIndex - Destination index or ID
     * @param kind - Relationship type
     * @param strength - Optional relationship strength
     */
    relateManyTo(fromIndices: number[], toIndex: number | string, kind: string, strength?: number): this;
    /**
     * Create a bidirectional relationship between two cluster entities
     * @param index1 - First entity index
     * @param index2 - Second entity index
     * @param kind - Relationship type
     * @param strength - Optional relationship strength
     */
    relateBidirectional(index1: number, index2: number, kind: string, strength?: number): this;
    /**
     * Get the number of entities in the cluster
     */
    entityCount(): number;
    /**
     * Get the number of relationships in the cluster
     */
    relationshipCount(): number;
    /**
     * Build and return the TemplateResult
     * @param description - Description of what this cluster represents
     */
    buildWithDescription(description: string): TemplateResult;
    /**
     * Build and return raw entities and relationships
     */
    build(): {
        entities: Array<Partial<HardState>>;
        relationships: Relationship[];
    };
    /**
     * Clear all entities and relationships
     */
    clear(): this;
}
/**
 * Helper function to create a new EntityClusterBuilder
 * Usage: buildCluster().addEntity(...).relate(...).build()
 */
export declare function buildCluster(): EntityClusterBuilder;
//# sourceMappingURL=entityClusterBuilder.d.ts.map