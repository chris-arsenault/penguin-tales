/**
 * Relationship Mutation Utilities
 *
 * Functions for creating and modifying relationships.
 */

import * as fs from 'fs';
import * as path from 'path';
import { Graph } from '../engine/types';
import { HardState, Relationship } from '../core/worldTypes';

// ===========================
// RELATIONSHIP SCHEMA HELPERS
// ===========================

/**
 * Check if a relationship kind requires distance (is a lineage relationship).
 */
export function isLineageRelationship(kind: string, graph: Graph): boolean {
  if (graph.config?.domain?.isLineageRelationship) {
    return graph.config.domain.isLineageRelationship(kind);
  }
  return false;
}

/**
 * Get expected distance range for a lineage relationship kind.
 */
export function getExpectedDistanceRange(kind: string, graph: Graph): { min: number; max: number } | undefined {
  if (graph.config?.domain?.getExpectedDistanceRange) {
    return graph.config.domain.getExpectedDistanceRange(kind);
  }
  return undefined;
}

/**
 * Get narrative strength for a relationship kind (0.0-1.0).
 */
export function getRelationshipStrength(kind: string, graph: Graph): number {
  if (graph.config?.domain?.getRelationshipStrength) {
    return graph.config.domain.getRelationshipStrength(kind);
  }
  return 0.5;
}

/**
 * Get behavioral category for a relationship kind.
 */
export function getRelationshipCategory(kind: string, graph: Graph): string {
  if (graph.config?.domain?.getRelationshipCategory) {
    return graph.config.domain.getRelationshipCategory(kind);
  }
  return 'social';
}

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
  strengthOverride?: number,
  distance?: number
): void {
  const domain = graph.config?.domain;

  // Auto-assign strength based on relationship kind, or use override
  const strength = strengthOverride ?? (domain?.getRelationshipStrength?.(kind) ?? 0.5);

  // Auto-assign category based on relationship kind
  const category = domain?.getRelationshipCategory?.(kind) ?? 'social';

  // LINEAGE ENFORCEMENT: Auto-assign distance for lineage relationships if missing
  let finalDistance = distance;
  const isLineage = domain?.isLineageRelationship?.(kind) ?? false;
  if (finalDistance === undefined && isLineage) {
    const range = domain?.getExpectedDistanceRange?.(kind);
    if (range) {
      finalDistance = range.min + Math.random() * (range.max - range.min);

      // Log warning for debugging (only occasionally to avoid spam)
      if (Math.random() < 0.05) {  // 5% sample rate
        console.warn(`⚠️  Auto-adding distance to ${kind} relationship (${srcId} → ${dstId}): ${finalDistance.toFixed(3)}`);
      }
    }
  }

  // Check relationship warning thresholds (per-kind, non-blocking)
  const srcEntity = graph.getEntity(srcId);
  if (srcEntity) {
    const existingOfType = srcEntity.links.filter(link => link.kind === kind).length;
    const threshold = domain?.getRelationshipWarningThreshold?.(srcEntity.kind, kind) ?? 10;

    if (existingOfType >= threshold) {
      const warningMessage =
        `⚠️  RELATIONSHIP WARNING (${srcEntity.kind.toUpperCase()}):\n` +
        `   Entity: ${srcEntity.name} (${srcEntity.id})\n` +
        `   Kind: ${srcEntity.kind}\n` +
        `   Relationship Type: ${kind}\n` +
        `   Current count: ${existingOfType}\n` +
        `   Warning threshold: ${threshold}\n` +
        `   Target: ${graph.getEntity(dstId)?.name || dstId}\n` +
        `   Tick: ${graph.tick}\n` +
        `   Era: ${graph.currentEra.name}\n` +
        `   ℹ️  This is a WARNING only - relationship will still be added\n`;

      try {
        const warningLogPath = path.join(process.cwd(), 'output', 'warnings.log');
        const timestamp = new Date().toISOString();
        const logEntry = `[${timestamp}] [Tick ${graph.tick}]\n${warningMessage}\n`;
        fs.appendFileSync(warningLogPath, logEntry);
      } catch (error) {
        // Silently fail - don't spam console with file write errors
      }
    }
  }

  graph.addRelationship(kind, srcId, dstId, strength, finalDistance, category);
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
  strengthOverride?: number
): void {
  // Validate range
  if (distanceRange.min < 0 || distanceRange.max > 1 || distanceRange.min > distanceRange.max) {
    console.warn(`Invalid distance range: [${distanceRange.min}, ${distanceRange.max}]. Using [0, 1].`);
    distanceRange = { min: 0, max: 1 };
  }

  const distance = distanceRange.min + Math.random() * (distanceRange.max - distanceRange.min);
  addRelationship(graph, kind, srcId, dstId, strengthOverride, distance);
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

/**
 * Validation helpers
 */
export function validateRelationship(
  schema: any,
  srcKind: string,
  dstKind: string,
  relKind: string
): boolean {
  const allowedRelations = schema.relationships[srcKind]?.[dstKind];
  return allowedRelations?.includes(relKind) || false;
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
 */
export function areRelationshipsCompatible(
  graph: Graph,
  srcId: string,
  dstId: string,
  newKind: string
): boolean {
  const existingRelationships = graph.getRelationships().filter(
    r => r.src === srcId && r.dst === dstId
  );
  const existingKinds = existingRelationships.map(r => r.kind);

  const domain = graph.config?.domain;
  if (domain?.checkRelationshipConflict) {
    return !domain.checkRelationshipConflict(existingKinds, newKind);
  }

  return true;
}
