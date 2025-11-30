/**
 * Entity Creation
 *
 * Handles entity creation from templates, including placement and naming.
 */

import type {
  EntityTemplate,
  EntityRef,
  CountSpec,
  Prominence,
  ProminenceDistribution,
} from '@canonry/world-schema';
import type { RuntimeEntity, ExecutionContext } from './types.js';
import { seededRandom, randomInt, randomPick, queryEntities } from './conditions.js';

// ============================================================================
// COUNT RESOLUTION
// ============================================================================

/**
 * Resolve a count specification to a concrete number
 */
export function resolveCount(spec: CountSpec, ctx: ExecutionContext): number {
  if (typeof spec === 'number') {
    return spec;
  }
  return randomInt(ctx.state, spec.min, spec.max);
}

// ============================================================================
// PROMINENCE RESOLUTION
// ============================================================================

/**
 * Resolve prominence from level or distribution
 */
function resolveProminence(
  spec: Prominence | ProminenceDistribution,
  ctx: ExecutionContext
): Prominence {
  if (typeof spec === 'string') {
    return spec;
  }

  // Distribution - pick based on probabilities
  const roll = seededRandom(ctx.state);
  let cumulative = 0;

  for (const entry of spec) {
    cumulative += entry.probability;
    if (roll < cumulative) {
      return entry.level;
    }
  }

  // Fallback to last level
  return spec[spec.length - 1].level;
}

// ============================================================================
// ENTITY REF RESOLUTION
// ============================================================================

/**
 * Resolve an entity reference to actual entities
 */
export function resolveEntityRef(
  ref: EntityRef,
  ctx: ExecutionContext
): RuntimeEntity[] {
  // Simple string ref - look up in created or selected entities
  if (typeof ref === 'string') {
    return (
      ctx.createdEntities.get(ref) ||
      ctx.selectedEntities.get(ref) ||
      []
    );
  }

  // Explicit ref
  if ('ref' in ref) {
    return (
      ctx.createdEntities.get(ref.ref) ||
      ctx.selectedEntities.get(ref.ref) ||
      []
    );
  }

  // Query existing entities
  if ('query' in ref) {
    return queryEntities(ctx.state, ref.query);
  }

  // Random from query
  if ('random' in ref) {
    const candidates = queryEntities(ctx.state, ref.random);
    const picked = randomPick(ctx.state, candidates);
    return picked ? [picked] : [];
  }

  return [];
}

// ============================================================================
// CULTURE RESOLUTION
// ============================================================================

/**
 * Resolve culture for entity placement
 */
function resolveCulture(
  spec: 'inherit' | 'random' | string,
  near: RuntimeEntity | undefined,
  ctx: ExecutionContext
): string | undefined {
  if (spec === 'inherit') {
    return near?.cultureId;
  }

  if (spec === 'random') {
    const culture = randomPick(ctx.state, ctx.cultures);
    return culture?.id;
  }

  // Specific culture ID
  return spec;
}

// ============================================================================
// COORDINATE GENERATION
// ============================================================================

/**
 * Generate coordinates for entity placement
 */
function generateCoordinates(
  strategy: 'culture_aware' | 'region_center' | 'random',
  near: RuntimeEntity | undefined,
  _cultureId: string | undefined,
  ctx: ExecutionContext
): { x: number; y: number } | undefined {
  switch (strategy) {
    case 'culture_aware':
      // If near an entity, place nearby with some jitter
      if (near?.coordinates) {
        const jitter = 0.1;
        return {
          x: near.coordinates.x + (seededRandom(ctx.state) - 0.5) * jitter,
          y: near.coordinates.y + (seededRandom(ctx.state) - 0.5) * jitter,
        };
      }
      // Fall through to random
      return {
        x: seededRandom(ctx.state),
        y: seededRandom(ctx.state),
      };

    case 'region_center':
      // For now, just use center of space
      // In a real implementation, this would use semantic regions
      return { x: 0.5, y: 0.5 };

    case 'random':
    default:
      return {
        x: seededRandom(ctx.state),
        y: seededRandom(ctx.state),
      };
  }
}

// ============================================================================
// DESCRIPTION INTERPOLATION
// ============================================================================

/**
 * Interpolate a description template with entity values
 */
function interpolateDescription(
  template: string,
  ctx: ExecutionContext
): string {
  // Simple interpolation: {ref.field} -> value
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

// ============================================================================
// ENTITY CREATION
// ============================================================================

/**
 * Create entities from a template
 */
export function createEntities(
  template: EntityTemplate,
  ctx: ExecutionContext
): RuntimeEntity[] {
  const count = resolveCount(template.count, ctx);
  const entities: RuntimeEntity[] = [];

  // Resolve 'near' entity for placement
  let nearEntity: RuntimeEntity | undefined;
  if (template.placement.near) {
    const nearEntities = resolveEntityRef(template.placement.near, ctx);
    nearEntity = randomPick(ctx.state, nearEntities);
  }

  for (let i = 0; i < count; i++) {
    // Resolve culture
    const cultureId = resolveCulture(
      template.placement.culture,
      nearEntity,
      ctx
    );

    // Generate coordinates
    const coordinates = generateCoordinates(
      template.placement.coordinateStrategy,
      nearEntity,
      cultureId,
      ctx
    );

    // Generate name
    const name = ctx.generateName(cultureId || 'default', template.kind);

    // Resolve prominence
    const prominence = resolveProminence(template.prominence, ctx);

    // Create entity
    const entity: RuntimeEntity = {
      id: `entity_${++ctx.state.entityCounter}`,
      kind: template.kind,
      subtype: template.subtype,
      name,
      description: '', // Will be interpolated after all entities are created
      status: template.status,
      prominence,
      tags: [...template.tags],
      cultureId,
      coordinates,
      createdInEra: ctx.state.currentEra,
      createdAtTick: ctx.state.tick,
      updatedAtTick: ctx.state.tick,
    };

    entities.push(entity);
  }

  // Store in context for reference resolution
  const existing = ctx.createdEntities.get(template.ref) || [];
  ctx.createdEntities.set(template.ref, [...existing, ...entities]);

  // Now interpolate descriptions (after all entities are in context)
  for (const entity of entities) {
    entity.description = interpolateDescription(template.descriptionTemplate, ctx);
  }

  return entities;
}

/**
 * Add created entities to the simulation state
 */
export function commitEntities(
  entities: RuntimeEntity[],
  ctx: ExecutionContext
): void {
  for (const entity of entities) {
    ctx.state.entities.set(entity.id, entity);
  }
}
