import { Graph } from '../engine/types';
import { HardState } from '../core/worldTypes';

/**
 * Validation result for a single check
 */
export interface ValidationResult {
  name: string;
  passed: boolean;
  failureCount: number;
  details: string;
  failedEntities?: HardState[];
}

/**
 * Complete validation report
 */
export interface ValidationReport {
  totalChecks: number;
  passed: number;
  failed: number;
  results: ValidationResult[];
}

/**
 * Validate that all entities have at least one connection (incoming or outgoing)
 */
export function validateConnectedEntities(graph: Graph): ValidationResult {
  const unconnected = graph.getEntities().filter(entity => {
    // Check for outgoing relationships (in entity.links)
    const hasOutgoing = entity.links.length > 0;

    // Check for incoming relationships (where entity is dst)
    const hasIncoming = graph.getRelationships().some(r => r.dst === entity.id);

    return !hasOutgoing && !hasIncoming;
  });

  const passed = unconnected.length === 0;

  let details = passed
    ? 'All entities have at least one connection'
    : `${unconnected.length} entities have no connections:\n`;

  if (!passed) {
    // Group by kind for summary
    const byKind = new Map<string, number>();
    unconnected.forEach(e => {
      const key = `${e.kind}:${e.subtype}`;
      byKind.set(key, (byKind.get(key) || 0) + 1);
    });

    byKind.forEach((count, kind) => {
      details += `  - ${kind}: ${count}\n`;
    });

    // Add sample entities
    details += '\nSample unconnected entities:\n';
    unconnected.slice(0, 5).forEach(e => {
      details += `  - ${e.name} (${e.kind}:${e.subtype}, created tick ${e.createdAt})\n`;
    });
  }

  return {
    name: 'Connected Entities',
    passed,
    failureCount: unconnected.length,
    details,
    failedEntities: unconnected
  };
}

/**
 * Validate that entities have required structural relationships
 * Uses domain schema to determine requirements (no hardcoded entity kinds!)
 */
export function validateNPCStructure(graph: Graph): ValidationResult {
  const invalidEntities: HardState[] = [];
  const missingByKindSubtype = new Map<string, Map<string, number>>();

  // Check all entities against domain schema requirements
  for (const entity of graph.getEntities()) {
    if (!graph.config.domain.validateEntityStructure) {
      // Domain doesn't provide validation - skip
      continue;
    }

    const validation = graph.config.domain.validateEntityStructure(entity);

    if (!validation.valid) {
      invalidEntities.push(entity);

      // Track missing relationships by kind:subtype
      const key = `${entity.kind}:${entity.subtype}`;
      if (!missingByKindSubtype.has(key)) {
        missingByKindSubtype.set(key, new Map());
      }
      const subtypeMap = missingByKindSubtype.get(key)!;

      validation.missing.forEach(relKind => {
        subtypeMap.set(relKind, (subtypeMap.get(relKind) || 0) + 1);
      });
    }
  }

  const passed = invalidEntities.length === 0;

  let details = passed
    ? 'All entities have required relationships'
    : `${invalidEntities.length} entities missing required relationships:\n`;

  if (!passed) {
    // Group by kind:subtype and missing relationships
    missingByKindSubtype.forEach((relMap, kindSubtype) => {
      relMap.forEach((count, relKind) => {
        details += `  - ${kindSubtype}: ${count} (missing ${relKind})\n`;
      });
    });
  }

  return {
    name: 'Entity Structure',  // Renamed from 'NPC Structure'
    passed,
    failureCount: invalidEntities.length,
    details,
    failedEntities: invalidEntities
  };
}

/**
 * Validate that all relationship references point to existing entities
 */
export function validateRelationshipIntegrity(graph: Graph): ValidationResult {
  const brokenRelationships: string[] = [];

  graph.getRelationships().forEach((rel, index) => {
    const srcExists = graph.getEntity(rel.src) !== undefined;
    const dstExists = graph.getEntity(rel.dst) !== undefined;

    if (!srcExists || !dstExists) {
      const srcName = graph.getEntity(rel.src)?.name || rel.src;
      const dstName = graph.getEntity(rel.dst)?.name || rel.dst;
      brokenRelationships.push(
        `[${index}] ${rel.kind}: ${srcName} → ${dstName} ` +
        `(${!srcExists ? 'src missing' : ''} ${!dstExists ? 'dst missing' : ''})`
      );
    }
  });

  const passed = brokenRelationships.length === 0;

  let details = passed
    ? 'All relationships reference existing entities'
    : `${brokenRelationships.length} broken relationships:\n`;

  if (!passed) {
    brokenRelationships.slice(0, 10).forEach(msg => {
      details += `  - ${msg}\n`;
    });
    if (brokenRelationships.length > 10) {
      details += `  ... and ${brokenRelationships.length - 10} more\n`;
    }
  }

  return {
    name: 'Relationship Integrity',
    passed,
    failureCount: brokenRelationships.length,
    details
  };
}

/**
 * Validate that entity links match actual relationships
 */
export function validateLinkSync(graph: Graph): ValidationResult {
  const mismatchedEntities: string[] = [];

  graph.forEachEntity(entity => {
    // Count relationships where this entity is src
    const actualRels = graph.getRelationships().filter(r => r.src === entity.id);
    const linkCount = entity.links.length;
    const actualCount = actualRels.length;

    if (linkCount !== actualCount) {
      mismatchedEntities.push(
        `${entity.name}: ${linkCount} in links array, ${actualCount} in relationships`
      );
    }
  });

  const passed = mismatchedEntities.length === 0;

  let details = passed
    ? 'All entity links match relationships'
    : `${mismatchedEntities.length} entities with mismatched links:\n`;

  if (!passed) {
    mismatchedEntities.slice(0, 10).forEach(msg => {
      details += `  - ${msg}\n`;
    });
    if (mismatchedEntities.length > 10) {
      details += `  ... and ${mismatchedEntities.length - 10} more\n`;
    }
  }

  return {
    name: 'Link Synchronization',
    passed,
    failureCount: mismatchedEntities.length,
    details
  };
}

// validateLorePresence moved to @illuminator

/**
 * Run all validators and generate a complete report
 */
export function validateWorld(graph: Graph): ValidationReport {
  const results: ValidationResult[] = [
    validateConnectedEntities(graph),
    validateNPCStructure(graph),
    validateRelationshipIntegrity(graph),
    validateLinkSync(graph)
    // validateLorePresence moved to @illuminator
  ];

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  return {
    totalChecks: results.length,
    passed,
    failed,
    results
  };
}
