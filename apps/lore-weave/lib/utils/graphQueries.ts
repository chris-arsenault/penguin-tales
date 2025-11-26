import { Graph } from '../types/engine';
import { HardState, Relationship } from '../types/worldTypes';

/**
 * Graph Query Utilities
 *
 * Reusable query patterns for common graph operations.
 * Extracted to reduce code duplication and improve maintainability.
 *
 * @module graphQueries
 */

/**
 * Get all entities related to a given entity by a specific relationship kind
 *
 * @param graph - The graph to query
 * @param entityId - ID of the entity to find related entities for
 * @param relationshipKind - Type of relationship to filter by
 * @param direction - Whether the entity is the source or destination
 * @returns Array of related entities
 */
export function getEntitiesByRelationship(
  graph: Graph,
  entityId: string,
  relationshipKind: string,
  direction: 'src' | 'dst'
): HardState[] {
  const relatedIds = graph.relationships
    .filter(r => r.kind === relationshipKind && r[direction] === entityId)
    .map(r => direction === 'src' ? r.dst : r.src);

  return relatedIds
    .map(id => graph.entities.get(id))
    .filter((e): e is HardState => e !== undefined);
}

/**
 * Get all relationship IDs for an entity as a set
 *
 * @param graph - The graph to query
 * @param entityId - ID of the entity
 * @param relationshipKinds - Array of relationship kinds to include
 * @param direction - Optional direction filter ('src' or 'dst')
 * @returns Set of related entity IDs
 */
export function getRelationshipIdSet(
  graph: Graph,
  entityId: string,
  relationshipKinds: string[],
  direction?: 'src' | 'dst'
): Set<string> {
  return new Set(
    graph.relationships
      .filter(r => {
        if (!relationshipKinds.includes(r.kind)) return false;
        if (!direction) return r.src === entityId || r.dst === entityId;
        return r[direction] === entityId;
      })
      .map(r => r.src === entityId ? r.dst : r.src)
  );
}

/**
 * Count relationships of a specific kind for an entity
 *
 * @param graph - The graph to query
 * @param entityId - ID of the entity
 * @param relationshipKind - Type of relationship to count
 * @param direction - Optional direction filter
 * @returns Count of matching relationships
 */
export function countRelationships(
  graph: Graph,
  entityId: string,
  relationshipKind: string,
  direction?: 'src' | 'dst'
): number {
  return graph.relationships.filter(r => {
    if (r.kind !== relationshipKind) return false;
    if (!direction) return r.src === entityId || r.dst === entityId;
    return r[direction] === entityId;
  }).length;
}

/**
 * Find single relationship matching criteria
 *
 * @param graph - The graph to query
 * @param entityId - ID of the entity
 * @param relationshipKind - Type of relationship to find
 * @param direction - Direction filter
 * @returns First matching relationship or undefined
 */
export function findRelationship(
  graph: Graph,
  entityId: string,
  relationshipKind: string,
  direction: 'src' | 'dst'
): Relationship | undefined {
  return graph.relationships.find(r =>
    r.kind === relationshipKind && r[direction] === entityId
  );
}

/**
 * Get entity at other end of a relationship
 *
 * @param graph - The graph to query
 * @param relationship - The relationship to traverse
 * @param fromEntityId - ID of the starting entity
 * @returns Entity at the other end of the relationship, or undefined
 */
export function getRelatedEntity(
  graph: Graph,
  relationship: Relationship | undefined,
  fromEntityId: string
): HardState | undefined {
  if (!relationship) return undefined;
  const targetId = relationship.src === fromEntityId ? relationship.dst : relationship.src;
  return graph.entities.get(targetId);
}
