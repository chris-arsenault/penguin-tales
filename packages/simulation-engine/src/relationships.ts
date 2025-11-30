/**
 * Relationship Creation
 *
 * Handles relationship creation from templates.
 */

import type { RelationshipTemplate, OccurrenceTemplate } from '@canonry/world-schema';
import type { RuntimeRelationship, RuntimeOccurrence, ExecutionContext } from './types.js';
import { resolveEntityRef, resolveCount } from './entities.js';
import { seededRandom, randomInt } from './conditions.js';

// ============================================================================
// DISTANCE RESOLUTION
// ============================================================================

/**
 * Resolve distance specification
 */
function resolveDistance(
  spec: number | { min: number; max: number } | undefined,
  ctx: ExecutionContext
): number {
  if (spec === undefined) {
    return 0.5; // Default semantic distance
  }

  if (typeof spec === 'number') {
    return spec;
  }

  // Range - generate random value
  return spec.min + seededRandom(ctx.state) * (spec.max - spec.min);
}

// ============================================================================
// RELATIONSHIP CREATION
// ============================================================================

/**
 * Create relationships from a template
 */
export function createRelationships(
  template: RelationshipTemplate,
  ctx: ExecutionContext
): RuntimeRelationship[] {
  const fromEntities = resolveEntityRef(template.from, ctx);
  const toEntities = resolveEntityRef(template.to, ctx);

  if (fromEntities.length === 0 || toEntities.length === 0) {
    return [];
  }

  const relationships: RuntimeRelationship[] = [];

  // Determine iteration mode
  if (template.forEach === 'from') {
    // One relationship per 'from' entity
    for (const from of fromEntities) {
      // Pick a random 'to' entity
      const toIndex = randomInt(ctx.state, 0, toEntities.length - 1);
      const to = toEntities[toIndex];

      relationships.push({
        id: `rel_${++ctx.state.relationshipCounter}`,
        kind: template.kind,
        srcId: from.id,
        dstId: to.id,
        distance: resolveDistance(template.distance, ctx),
        metadata: template.metadata ? { ...template.metadata } : undefined,
        createdAtTick: ctx.state.tick,
        archived: false,
      });
    }
  } else if (template.forEach === 'to') {
    // One relationship per 'to' entity
    for (const to of toEntities) {
      // Pick a random 'from' entity
      const fromIndex = randomInt(ctx.state, 0, fromEntities.length - 1);
      const from = fromEntities[fromIndex];

      relationships.push({
        id: `rel_${++ctx.state.relationshipCounter}`,
        kind: template.kind,
        srcId: from.id,
        dstId: to.id,
        distance: resolveDistance(template.distance, ctx),
        metadata: template.metadata ? { ...template.metadata } : undefined,
        createdAtTick: ctx.state.tick,
        archived: false,
      });
    }
  } else {
    // Default: one relationship between first from and first to
    // Or one relationship per pair if small sets
    if (fromEntities.length === 1 && toEntities.length === 1) {
      relationships.push({
        id: `rel_${++ctx.state.relationshipCounter}`,
        kind: template.kind,
        srcId: fromEntities[0].id,
        dstId: toEntities[0].id,
        distance: resolveDistance(template.distance, ctx),
        metadata: template.metadata ? { ...template.metadata } : undefined,
        createdAtTick: ctx.state.tick,
        archived: false,
      });
    } else {
      // Connect first from to first to
      relationships.push({
        id: `rel_${++ctx.state.relationshipCounter}`,
        kind: template.kind,
        srcId: fromEntities[0].id,
        dstId: toEntities[0].id,
        distance: resolveDistance(template.distance, ctx),
        metadata: template.metadata ? { ...template.metadata } : undefined,
        createdAtTick: ctx.state.tick,
        archived: false,
      });
    }
  }

  return relationships;
}

/**
 * Create multiple relationships from templates
 */
export function createAllRelationships(
  templates: RelationshipTemplate[] | undefined,
  ctx: ExecutionContext
): RuntimeRelationship[] {
  const relationships: RuntimeRelationship[] = [];

  if (!templates || templates.length === 0) {
    return relationships;
  }

  for (const template of templates) {
    relationships.push(...createRelationships(template, ctx));
  }

  return relationships;
}

/**
 * Add created relationships to the simulation state
 */
export function commitRelationships(
  relationships: RuntimeRelationship[],
  ctx: ExecutionContext
): void {
  for (const rel of relationships) {
    ctx.state.relationships.set(rel.id, rel);
  }
}

// ============================================================================
// RELATIONSHIP ARCHIVAL
// ============================================================================

/**
 * Archive a relationship (mark as historical)
 */
export function archiveRelationship(
  relationshipId: string,
  ctx: ExecutionContext
): boolean {
  const rel = ctx.state.relationships.get(relationshipId);
  if (!rel) return false;

  rel.archived = true;
  return true;
}

/**
 * Delete a relationship completely
 */
export function deleteRelationship(
  relationshipId: string,
  ctx: ExecutionContext
): boolean {
  return ctx.state.relationships.delete(relationshipId);
}

// ============================================================================
// OCCURRENCE CREATION
// ============================================================================

/**
 * Interpolate occurrence description
 */
function interpolateOccurrenceDescription(
  template: string,
  ctx: ExecutionContext
): string {
  return template.replace(/\{([^.}]+)\.([^}]+)\}/g, (match, refName, field) => {
    const entities = ctx.createdEntities.get(refName) || ctx.selectedEntities.get(refName);
    if (!entities || entities.length === 0) return match;

    const entity = entities[0];
    switch (field) {
      case 'name':
        return entity.name;
      case 'kind':
        return entity.kind;
      case 'subtype':
        return entity.subtype;
      case 'culture':
        return entity.cultureId || 'unknown';
      default:
        return match;
    }
  });
}

/**
 * Create an occurrence from a template
 */
export function createOccurrence(
  template: OccurrenceTemplate,
  ctx: ExecutionContext
): RuntimeOccurrence {
  // Collect all entity IDs involved
  const entityIds: string[] = [];
  for (const entities of ctx.createdEntities.values()) {
    entityIds.push(...entities.map(e => e.id));
  }
  for (const entities of ctx.selectedEntities.values()) {
    entityIds.push(...entities.map(e => e.id));
  }

  return {
    id: `occ_${++ctx.state.occurrenceCounter}`,
    kind: template.kind,
    description: interpolateOccurrenceDescription(template.descriptionTemplate, ctx),
    era: ctx.state.currentEra,
    tick: ctx.state.tick,
    entityIds: [...new Set(entityIds)], // Deduplicate
  };
}

/**
 * Add occurrence to state
 */
export function commitOccurrence(
  occurrence: RuntimeOccurrence,
  ctx: ExecutionContext
): void {
  ctx.state.occurrences.push(occurrence);
}
