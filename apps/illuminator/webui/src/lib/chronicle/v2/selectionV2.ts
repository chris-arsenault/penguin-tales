/**
 * Chronicle V2 Selection
 *
 * Simplified entity/event selection using random sampling
 * instead of elaborate scoring. Transparent about its arbitrariness.
 */

import type {
  ChronicleGenerationContext,
  EntityContext,
  RelationshipContext,
  NarrativeEventContext,
} from '../chronicleTypes';
import type { V2SelectionConfig, V2SelectionResult } from './types';
import { DEFAULT_V2_CONFIG } from './types';

/**
 * Build the 2-hop neighborhood graph from the entry point.
 */
function build2HopNeighborhood(
  entrypointId: string,
  relationships: RelationshipContext[]
): Set<string> {
  const adjacency = new Map<string, Set<string>>();

  for (const rel of relationships) {
    if (!adjacency.has(rel.src)) adjacency.set(rel.src, new Set());
    if (!adjacency.has(rel.dst)) adjacency.set(rel.dst, new Set());
    adjacency.get(rel.src)!.add(rel.dst);
    adjacency.get(rel.dst)!.add(rel.src);
  }

  const neighbors = new Set<string>([entrypointId]);

  // First hop
  const firstHop = adjacency.get(entrypointId) || new Set();
  for (const id of firstHop) {
    neighbors.add(id);
  }

  // Second hop
  for (const id of firstHop) {
    const secondHop = adjacency.get(id) || new Set();
    for (const id2 of secondHop) {
      neighbors.add(id2);
    }
  }

  return neighbors;
}

/**
 * Simple seeded random number generator for reproducibility.
 * Uses a basic LCG algorithm.
 */
function createSeededRandom(seed?: number): () => number {
  let state = seed ?? Date.now();
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

/**
 * Random sample from an array.
 */
function randomSample<T>(arr: T[], count: number, random: () => number): T[] {
  if (arr.length <= count) return [...arr];

  const result: T[] = [];
  const available = [...arr];

  for (let i = 0; i < count && available.length > 0; i++) {
    const index = Math.floor(random() * available.length);
    result.push(available[index]);
    available.splice(index, 1);
  }

  return result;
}

/**
 * Select entities for V2 chronicle generation.
 *
 * Uses random sampling from the 2-hop neighborhood instead of
 * elaborate scoring. All entities in the neighborhood are equally
 * viable candidates.
 */
export function selectEntitiesV2(
  context: ChronicleGenerationContext,
  config: V2SelectionConfig = DEFAULT_V2_CONFIG
): V2SelectionResult {
  if (!context.entity) {
    throw new Error('V2 selection requires an entrypoint entity');
  }

  const entrypoint = context.entity;
  const random = createSeededRandom(config.randomSeed);

  // Build 2-hop neighborhood
  const neighborIds = build2HopNeighborhood(entrypoint.id, context.relationships);

  // Filter entities to those in the neighborhood (excluding entry point and eras)
  const neighborEntities = context.entities.filter(
    (e) => neighborIds.has(e.id) && e.id !== entrypoint.id && e.kind !== 'era'
  );

  // Random sample entities
  const selectedEntities = randomSample(
    neighborEntities,
    config.maxEntities,
    random
  );

  // Get all entity IDs we're working with
  const selectedEntityIds = new Set([
    entrypoint.id,
    ...selectedEntities.map((e) => e.id),
  ]);

  // Filter relationships to those between selected entities
  const selectedRelationships = context.relationships
    .filter((r) => selectedEntityIds.has(r.src) && selectedEntityIds.has(r.dst))
    .slice(0, config.maxRelationships);

  // Filter events to those involving selected entities
  const relevantEvents = context.events.filter((e) => {
    if (e.subjectId && selectedEntityIds.has(e.subjectId)) return true;
    if (e.objectId && selectedEntityIds.has(e.objectId)) return true;
    if (e.stateChanges?.some((sc) => selectedEntityIds.has(sc.entityId))) return true;
    return false;
  });

  // Random sample events
  const selectedEvents = randomSample(
    relevantEvents,
    config.maxEvents,
    random
  );

  return {
    entrypoint,
    entities: selectedEntities,
    relationships: selectedRelationships,
    events: selectedEvents,
  };
}
