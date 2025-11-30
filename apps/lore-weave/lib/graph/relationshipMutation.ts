/**
 * Relationship Mutation Utilities
 *
 * Functions for creating and modifying relationships.
 */

import { Graph } from '../engine/types';
import { Relationship } from '../core/worldTypes';

// ===========================
// RELATIONSHIP MUTATION
// ===========================

/**
 * Add a relationship between two entities.
 */
export function addRelationship(
  graph: Graph,
  kind: string,
  srcId: string,
  dstId: string,
  strength: number = 0.5,
  distance?: number
): void {
  graph.addRelationship(kind, srcId, dstId, strength, distance);
}

/**
 * Add a relationship with a bounded random distance.
 */
export function addRelationshipWithDistance(
  graph: Graph,
  kind: string,
  srcId: string,
  dstId: string,
  distanceRange: { min: number; max: number },
  strength: number = 0.5
): void {
  // Validate range
  if (distanceRange.min < 0 || distanceRange.max > 1 || distanceRange.min > distanceRange.max) {
    console.warn(`Invalid distance range: [${distanceRange.min}, ${distanceRange.max}]. Using [0, 1].`);
    distanceRange = { min: 0, max: 1 };
  }

  const distance = distanceRange.min + Math.random() * (distanceRange.max - distanceRange.min);
  addRelationship(graph, kind, srcId, dstId, strength, distance);
}

/**
 * Archive a relationship by marking it as historical.
 */
export function archiveRelationship(
  graph: Graph,
  src: string,
  dst: string,
  kind: string
): void {
  const rel = graph.getRelationships().find(r =>
    r.src === src &&
    r.dst === dst &&
    r.kind === kind &&
    r.status !== 'historical'
  );

  if (rel) {
    rel.status = 'historical';
    rel.archivedAt = graph.tick;
  }

  const srcEntity = graph.getEntity(src);
  if (srcEntity) {
    const link = srcEntity.links.find(l =>
      l.src === src &&
      l.dst === dst &&
      l.kind === kind &&
      l.status !== 'historical'
    );
    if (link) {
      link.status = 'historical';
      link.archivedAt = graph.tick;
    }
    srcEntity.updatedAt = graph.tick;
  }

  const dstEntity = graph.getEntity(dst);
  if (dstEntity) {
    dstEntity.updatedAt = graph.tick;
  }
}

/**
 * Modify relationship strength by delta
 */
export function modifyRelationshipStrength(
  graph: Graph,
  srcId: string,
  dstId: string,
  kind: string,
  delta: number
): boolean {
  const rel = graph.getRelationships().find(r =>
    r.src === srcId && r.dst === dstId && r.kind === kind
  );

  if (!rel) return false;

  const currentStrength = rel.strength ?? 0.5;
  rel.strength = Math.max(0.0, Math.min(1.0, currentStrength + delta));

  const srcEntity = graph.getEntity(srcId);
  const dstEntity = graph.getEntity(dstId);

  if (srcEntity) {
    const link = srcEntity.links.find(l =>
      l.kind === kind && l.src === srcId && l.dst === dstId
    );
    if (link) link.strength = rel.strength;
    srcEntity.updatedAt = graph.tick;
  }

  if (dstEntity) {
    dstEntity.updatedAt = graph.tick;
  }

  return true;
}

// ===========================
// RELATIONSHIP COOLDOWN
// ===========================

/**
 * Check if an entity can form a new relationship based on cooldown.
 */
export function canFormRelationship(
  graph: Graph,
  entityId: string,
  relationshipType: string,
  cooldownTicks: number
): boolean {
  const entityCooldowns = graph.relationshipCooldowns.get(entityId);
  if (!entityCooldowns) return true;

  const lastFormationTick = entityCooldowns.get(relationshipType);
  if (lastFormationTick === undefined) return true;

  return (graph.tick - lastFormationTick) >= cooldownTicks;
}

/**
 * Record that an entity has formed a relationship.
 */
export function recordRelationshipFormation(
  graph: Graph,
  entityId: string,
  relationshipType: string
): void {
  let entityCooldowns = graph.relationshipCooldowns.get(entityId);

  if (!entityCooldowns) {
    entityCooldowns = new Map();
    graph.relationshipCooldowns.set(entityId, entityCooldowns);
  }

  entityCooldowns.set(relationshipType, graph.tick);
}

/**
 * Check if a new relationship is compatible with existing relationships.
 * Returns true - all relationships are compatible (conflict checking removed).
 */
export function areRelationshipsCompatible(
  graph: Graph,
  srcId: string,
  dstId: string,
  newKind: string
): boolean {
  return true;
}
