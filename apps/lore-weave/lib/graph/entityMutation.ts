/**
 * Entity Mutation Utilities
 *
 * Functions for creating and modifying entities.
 */

import { Graph } from '../engine/types';
import { HardState, EntityTags } from '../core/worldTypes';
import { generateId } from '../core/idGeneration';
import { arrayToTags } from '../utils/tagUtils';

/**
 * Slugify a name for use in IDs or other contexts
 */
export function slugifyName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'unknown';
}

/**
 * Initial state normalization
 */
export function normalizeInitialState(entities: any[]): HardState[] {
  return entities.map((entity, index) => {
    if (!entity.name) {
      throw new Error(
        `normalizeInitialState: entity at index ${index} has no name. ` +
        `Initial state entities must have names defined in JSON.`
      );
    }
    if (!entity.coordinates) {
      throw new Error(
        `normalizeInitialState: entity "${entity.name}" at index ${index} has no coordinates. ` +
        `Initial state entities must have coordinates defined in JSON.`
      );
    }

    // Handle both old array format and new KVP format for tags
    let tags: EntityTags;
    if (Array.isArray(entity.tags)) {
      tags = arrayToTags(entity.tags);
    } else {
      tags = entity.tags || {};
    }

    return {
      id: entity.id || entity.name || generateId(entity.kind || 'unknown'),
      kind: entity.kind as HardState['kind'] || 'npc',
      subtype: entity.subtype || 'default',
      name: entity.name,
      description: entity.description || '',
      status: entity.status || 'alive',
      prominence: entity.prominence as HardState['prominence'] || 'marginal',
      culture: entity.culture || 'world',
      tags,
      links: entity.links || [],
      createdAt: 0,
      updatedAt: 0,
      coordinates: entity.coordinates
    };
  });
}

/**
 * Add entity to graph (coordinates required)
 * @param source - Optional source identifier for debugging (e.g., template ID)
 * @param placementStrategy - Optional placement strategy for debugging
 */
export async function addEntity(graph: Graph, entity: Partial<HardState>, source?: string, placementStrategy?: string): Promise<string> {
  // Coordinates are required - fail loudly
  // Check for valid numeric values, not just object existence
  const coords = entity.coordinates;
  if (!coords || typeof coords.x !== 'number' || typeof coords.y !== 'number') {
    throw new Error(
      `addEntity: valid coordinates {x: number, y: number, z?: number} are required. ` +
      `Entity kind: ${entity.kind || 'unknown'}, name: ${entity.name || 'unnamed'}. ` +
      `Received: ${JSON.stringify(coords)}. ` +
      `Use addEntityInRegion() or provide valid coordinates explicitly.`
    );
  }

  // Normalize tags: handle both old array format and new KVP format
  // Clone to avoid mutating source object
  let tags: EntityTags;
  if (Array.isArray(entity.tags)) {
    tags = arrayToTags(entity.tags);
  } else {
    tags = { ...(entity.tags || {}) };
  }

  // Delegate to Graph.createEntity() which enforces the contract:
  // coordinates (required) → tags → name (auto-generated if not provided)
  // Use validated coords to satisfy TypeScript (already validated above)
  const validCoords = { x: coords.x, y: coords.y, z: coords.z ?? 50 };

  return graph.createEntity({
    kind: entity.kind || 'npc',
    subtype: entity.subtype || 'default',
    coordinates: validCoords,
    tags,
    name: entity.name,  // May be undefined - createEntity will auto-generate
    description: entity.description,
    status: entity.status,
    prominence: entity.prominence,
    culture: entity.culture,
    temporal: entity.temporal,
    source,
    placementStrategy
  });
}

/**
 * Update entity in graph
 */
export function updateEntity(
  graph: Graph,
  entityId: string,
  changes: Partial<HardState>
): void {
  // Use Graph's updateEntity method to modify the actual entity, not a clone
  graph.updateEntity(entityId, changes);
}
