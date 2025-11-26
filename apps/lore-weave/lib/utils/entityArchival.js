/**
 * Entity Archival Utilities
 *
 * Domain-agnostic utilities for archiving entities and relationships,
 * and transferring relationships between entities. Used by SimulationSystems
 * that need to consolidate or supersede entities.
 */
import { FRAMEWORK_STATUS, FRAMEWORK_RELATIONSHIP_KINDS } from '../types/frameworkPrimitives';
import { archiveRelationship, addRelationship } from './helpers';
/**
 * Mark an entity as historical and optionally archive its relationships.
 *
 * @param graph - The world graph
 * @param entityId - ID of entity to archive
 * @param options - Archival options
 */
export function archiveEntity(graph, entityId, options = {}) {
    const entity = graph.entities.get(entityId);
    if (!entity)
        return;
    const { archiveRelationships: shouldArchiveRels = true, excludeRelationshipKinds = [], status = FRAMEWORK_STATUS.HISTORICAL } = options;
    // Mark entity as historical
    entity.status = status;
    entity.updatedAt = graph.tick;
    // Archive relationships if requested
    if (shouldArchiveRels) {
        const entityRelationships = graph.relationships.filter(r => (r.src === entityId || r.dst === entityId) &&
            r.status !== FRAMEWORK_STATUS.HISTORICAL &&
            !excludeRelationshipKinds.includes(r.kind));
        entityRelationships.forEach(rel => {
            archiveRelationship(graph, rel.src, rel.dst, rel.kind);
        });
    }
}
/**
 * Archive multiple entities at once.
 *
 * @param graph - The world graph
 * @param entityIds - IDs of entities to archive
 * @param options - Archival options
 */
export function archiveEntities(graph, entityIds, options = {}) {
    entityIds.forEach(id => archiveEntity(graph, id, options));
}
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
export function transferRelationships(graph, sourceIds, targetId, options = {}) {
    const { excludeKinds = [FRAMEWORK_RELATIONSHIP_KINDS.PART_OF], sourceOnly = false, destinationOnly = false, archiveOriginals = true } = options;
    const sourceIdSet = new Set(sourceIds);
    const transferred = new Set();
    // Find all relationships involving source entities
    const toTransfer = graph.relationships.filter(r => (sourceIdSet.has(r.src) || sourceIdSet.has(r.dst)) &&
        r.status !== FRAMEWORK_STATUS.HISTORICAL &&
        !excludeKinds.includes(r.kind));
    toTransfer.forEach(rel => {
        let newSrc = rel.src;
        let newDst = rel.dst;
        // Determine new endpoints
        if (sourceIdSet.has(rel.src) && !destinationOnly) {
            newSrc = targetId;
        }
        if (sourceIdSet.has(rel.dst) && !sourceOnly) {
            newDst = targetId;
        }
        // Skip if no change (shouldn't happen with proper source filtering)
        if (newSrc === rel.src && newDst === rel.dst)
            return;
        // Avoid self-loops
        if (newSrc === newDst)
            return;
        // Avoid duplicates
        const key = `${newSrc}:${newDst}:${rel.kind}`;
        if (transferred.has(key))
            return;
        // Create new relationship
        addRelationship(graph, rel.kind, newSrc, newDst);
        transferred.add(key);
        // Archive original if requested
        if (archiveOriginals) {
            archiveRelationship(graph, rel.src, rel.dst, rel.kind);
        }
    });
    return transferred.size;
}
/**
 * Create part_of relationships from members to a container entity.
 *
 * @param graph - The world graph
 * @param memberIds - IDs of member entities
 * @param containerId - ID of container entity
 * @returns Number of relationships created
 */
export function createPartOfRelationships(graph, memberIds, containerId) {
    let created = 0;
    memberIds.forEach(memberId => {
        // Check if relationship already exists
        const exists = graph.relationships.some(r => r.kind === FRAMEWORK_RELATIONSHIP_KINDS.PART_OF &&
            r.src === memberId &&
            r.dst === containerId &&
            r.status !== FRAMEWORK_STATUS.HISTORICAL);
        if (!exists) {
            addRelationship(graph, FRAMEWORK_RELATIONSHIP_KINDS.PART_OF, memberId, containerId);
            created++;
        }
    });
    return created;
}
/**
 * Get all active relationships for an entity.
 *
 * @param graph - The world graph
 * @param entityId - ID of entity
 * @param direction - Filter by direction ('src', 'dst', or 'both')
 * @returns Active relationships
 */
export function getActiveRelationships(graph, entityId, direction = 'both') {
    return graph.relationships.filter(r => {
        if (r.status === FRAMEWORK_STATUS.HISTORICAL)
            return false;
        switch (direction) {
            case 'src':
                return r.src === entityId;
            case 'dst':
                return r.dst === entityId;
            case 'both':
                return r.src === entityId || r.dst === entityId;
        }
    });
}
/**
 * Get all historical relationships for an entity.
 *
 * @param graph - The world graph
 * @param entityId - ID of entity
 * @returns Historical relationships
 */
export function getHistoricalRelationships(graph, entityId) {
    return graph.relationships.filter(r => r.status === FRAMEWORK_STATUS.HISTORICAL &&
        (r.src === entityId || r.dst === entityId));
}
/**
 * Check if an entity is historical.
 *
 * @param entity - Entity to check
 * @returns True if entity is historical
 */
export function isHistoricalEntity(entity) {
    return entity.status === FRAMEWORK_STATUS.HISTORICAL;
}
/**
 * Get all entities that are part of a container entity.
 *
 * @param graph - The world graph
 * @param containerId - ID of container entity
 * @returns Member entities
 */
export function getPartOfMembers(graph, containerId) {
    const memberIds = graph.relationships
        .filter(r => r.kind === FRAMEWORK_RELATIONSHIP_KINDS.PART_OF &&
        r.dst === containerId &&
        r.status !== FRAMEWORK_STATUS.HISTORICAL)
        .map(r => r.src);
    return memberIds
        .map(id => graph.entities.get(id))
        .filter((e) => e !== undefined);
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
export function supersedeEntity(graph, oldEntityId, newEntityId, options = {}) {
    const { archiveSuperseded = true, createSupersedes = true, ...transferOptions } = options;
    // Create supersedes relationship (new supersedes old)
    if (createSupersedes) {
        addRelationship(graph, FRAMEWORK_RELATIONSHIP_KINDS.SUPERSEDES, newEntityId, oldEntityId);
    }
    // Transfer relationships from old to new
    transferRelationships(graph, [oldEntityId], newEntityId, {
        ...transferOptions,
        excludeKinds: [
            ...(transferOptions.excludeKinds || []),
            FRAMEWORK_RELATIONSHIP_KINDS.SUPERSEDES,
            FRAMEWORK_RELATIONSHIP_KINDS.PART_OF
        ]
    });
    // Archive old entity
    if (archiveSuperseded) {
        archiveEntity(graph, oldEntityId, {
            archiveRelationships: false, // Already handled by transfer
            excludeRelationshipKinds: [
                FRAMEWORK_RELATIONSHIP_KINDS.SUPERSEDES,
                FRAMEWORK_RELATIONSHIP_KINDS.PART_OF
            ]
        });
    }
}
//# sourceMappingURL=entityArchival.js.map