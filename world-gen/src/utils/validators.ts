import { Graph } from '../types/engine';
import { HardState } from '../types/worldTypes';

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
  const unconnected = Array.from(graph.entities.values()).filter(entity => {
    // Check for outgoing relationships (in entity.links)
    const hasOutgoing = entity.links.length > 0;

    // Check for incoming relationships (where entity is dst)
    const hasIncoming = graph.relationships.some(r => r.dst === entity.id);

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
 * Validate that NPCs have required structural relationships
 */
export function validateNPCStructure(graph: Graph): ValidationResult {
  const npcs = Array.from(graph.entities.values()).filter(e => e.kind === 'npc');
  const invalidNPCs: HardState[] = [];

  npcs.forEach(npc => {
    if (npc.status === 'alive') {
      // Living NPCs should have a location
      const hasLocation = npc.links.some(l => l.kind === 'resident_of');
      if (!hasLocation) {
        invalidNPCs.push(npc);
      }
    }
  });

  const passed = invalidNPCs.length === 0;

  let details = passed
    ? 'All living NPCs have required relationships'
    : `${invalidNPCs.length} NPCs missing required relationships:\n`;

  if (!passed) {
    // Group by subtype
    const bySubtype = new Map<string, number>();
    invalidNPCs.forEach(e => {
      bySubtype.set(e.subtype, (bySubtype.get(e.subtype) || 0) + 1);
    });

    bySubtype.forEach((count, subtype) => {
      details += `  - ${subtype}: ${count} (missing resident_of)\n`;
    });
  }

  return {
    name: 'NPC Structure',
    passed,
    failureCount: invalidNPCs.length,
    details,
    failedEntities: invalidNPCs
  };
}

/**
 * Validate that all relationship references point to existing entities
 */
export function validateRelationshipIntegrity(graph: Graph): ValidationResult {
  const brokenRelationships: string[] = [];

  graph.relationships.forEach((rel, index) => {
    const srcExists = graph.entities.has(rel.src);
    const dstExists = graph.entities.has(rel.dst);

    if (!srcExists || !dstExists) {
      const srcName = graph.entities.get(rel.src)?.name || rel.src;
      const dstName = graph.entities.get(rel.dst)?.name || rel.dst;
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

  graph.entities.forEach(entity => {
    // Count relationships where this entity is src
    const actualRels = graph.relationships.filter(r => r.src === entity.id);
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

/**
 * Run all validators and generate a complete report
 */
export function validateWorld(graph: Graph): ValidationReport {
  const results: ValidationResult[] = [
    validateConnectedEntities(graph),
    validateNPCStructure(graph),
    validateRelationshipIntegrity(graph),
    validateLinkSync(graph)
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
