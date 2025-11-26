/**
 * Entity Archival Utilities
 *
 * Domain-agnostic utilities for archiving entities and relationships,
 * and transferring relationships between entities. Used by SimulationSystems
 * that need to consolidate or supersede entities.
 */
import { Graph } from '../types/engine';
import { HardState, Relationship } from '../types/worldTypes';
/**
 * Options for archiving an entity
 */
export interface ArchiveEntityOptions {
    /** Archive all relationships involving this entity (default: true) */
    archiveRelationships?: boolean;
    /** Relationship kinds to exclude from archival */
    excludeRelationshipKinds?: string[];
    /** Custom status to set (default: 'historical') */
    status?: string;
}
/**
 * Options for transferring relationships
 */
export interface TransferRelationshipsOptions {
    /** Relationship kinds to exclude from transfer */
    excludeKinds?: string[];
    /** Only transfer relationships where entity is source */
    sourceOnly?: boolean;
    /** Only transfer relationships where entity is destination */
    destinationOnly?: boolean;
    /** Archive original relationships after transfer (default: true) */
    archiveOriginals?: boolean;
}
/**
 * Mark an entity as historical and optionally archive its relationships.
 *
 * @param graph - The world graph
 * @param entityId - ID of entity to archive
 * @param options - Archival options
 */
export declare function archiveEntity(graph: Graph, entityId: string, options?: ArchiveEntityOptions): void;
/**
 * Archive multiple entities at once.
 *
 * @param graph - The world graph
 * @param entityIds - IDs of entities to archive
 * @param options - Archival options
 */
export declare function archiveEntities(graph: Graph, entityIds: string[], options?: ArchiveEntityOptions): void;
/**
 * Transfer relationships from source entities to a target entity.
 * Creates new relationships with the target and optionally archives originals.
 *
 * @param graph - The world graph
 * @param sourceIds - IDs of entities to transfer relationships from
 * @param targetId - ID of entity to transfer relationships to
 * @param options - Transfer options
 * @returns Number of relationships transferred
 */
export declare function transferRelationships(graph: Graph, sourceIds: string[], targetId: string, options?: TransferRelationshipsOptions): number;
/**
 * Create part_of relationships from members to a container entity.
 *
 * @param graph - The world graph
 * @param memberIds - IDs of member entities
 * @param containerId - ID of container entity
 * @returns Number of relationships created
 */
export declare function createPartOfRelationships(graph: Graph, memberIds: string[], containerId: string): number;
/**
 * Get all active relationships for an entity.
 *
 * @param graph - The world graph
 * @param entityId - ID of entity
 * @param direction - Filter by direction ('src', 'dst', or 'both')
 * @returns Active relationships
 */
export declare function getActiveRelationships(graph: Graph, entityId: string, direction?: 'src' | 'dst' | 'both'): Relationship[];
/**
 * Get all historical relationships for an entity.
 *
 * @param graph - The world graph
 * @param entityId - ID of entity
 * @returns Historical relationships
 */
export declare function getHistoricalRelationships(graph: Graph, entityId: string): Relationship[];
/**
 * Check if an entity is historical.
 *
 * @param entity - Entity to check
 * @returns True if entity is historical
 */
export declare function isHistoricalEntity(entity: HardState): boolean;
/**
 * Get all entities that are part of a container entity.
 *
 * @param graph - The world graph
 * @param containerId - ID of container entity
 * @returns Member entities
 */
export declare function getPartOfMembers(graph: Graph, containerId: string): HardState[];
/**
 * Options for superseding an entity
 */
export interface SupersedeEntityOptions extends TransferRelationshipsOptions {
    /** Archive the superseded entity (default: true) */
    archiveSuperseded?: boolean;
    /** Create supersedes relationship (default: true) */
    createSupersedes?: boolean;
}
/**
 * Supersede one entity with another.
 * Creates supersedes relationship, transfers relationships, and archives original.
 *
 * @param graph - The world graph
 * @param oldEntityId - ID of entity being superseded
 * @param newEntityId - ID of new entity
 * @param options - Supersede options
 */
export declare function supersedeEntity(graph: Graph, oldEntityId: string, newEntityId: string, options?: SupersedeEntityOptions): void;
//# sourceMappingURL=entityArchival.d.ts.map