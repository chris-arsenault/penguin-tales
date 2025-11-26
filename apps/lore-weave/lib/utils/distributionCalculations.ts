import { Graph } from '../types/engine';
import { HardState } from '../types/worldTypes';

/**
 * Distribution Calculations Module
 *
 * Pure functions for calculating distribution statistics from graph data.
 * Extracted from StatisticsCollector for reusability and testability.
 *
 * @module distributionCalculations
 */

/**
 * Calculate entity count by kind
 *
 * @param entities - Array of entities to count
 * @returns Record mapping entity kind to count
 *
 * @example
 * const counts = calculateEntityKindCounts([npc1, npc2, faction1]);
 * // { npc: 2, faction: 1 }
 */
export function calculateEntityKindCounts(entities: HardState[]): Record<string, number> {
  const counts: Record<string, number> = {};
  entities.forEach(e => {
    counts[e.kind] = (counts[e.kind] || 0) + 1;
  });
  return counts;
}

/**
 * Calculate ratios from counts
 *
 * @param counts - Record of counts by key
 * @param total - Total count for normalization
 * @returns Record mapping keys to ratios (0-1)
 */
export function calculateRatios(
  counts: Record<string, number>,
  total: number
): Record<string, number> {
  const ratios: Record<string, number> = {};
  Object.keys(counts).forEach(key => {
    ratios[key] = total > 0 ? counts[key] / total : 0;
  });
  return ratios;
}

/**
 * Calculate prominence distribution
 */
export function calculateProminenceDistribution(entities: HardState[]): {
  counts: Record<string, number>;
  ratios: Record<string, number>;
} {
  const counts: Record<string, number> = {
    forgotten: 0,
    marginal: 0,
    recognized: 0,
    renowned: 0,
    mythic: 0
  };

  entities.forEach(e => {
    counts[e.prominence]++;
  });

  const ratios = calculateRatios(counts, entities.length);

  return { counts, ratios };
}

/**
 * Calculate relationship type distribution
 */
export function calculateRelationshipDistribution(graph: Graph): {
  counts: Record<string, number>;
  ratios: Record<string, number>;
  diversity: number;
} {
  const counts: Record<string, number> = {};
  graph.relationships.forEach(r => {
    counts[r.kind] = (counts[r.kind] || 0) + 1;
  });

  const ratios = calculateRatios(counts, graph.relationships.length);

  // Shannon entropy for diversity
  let diversity = 0;
  Object.values(ratios).forEach(ratio => {
    if (ratio > 0) {
      diversity -= ratio * Math.log2(ratio);
    }
  });

  return { counts, ratios, diversity };
}

/**
 * Calculate graph connectivity metrics
 */
export function calculateConnectivityMetrics(graph: Graph): {
  isolatedNodes: number;
  avgConnections: number;
  maxConnections: number;
  minConnections: number;
} {
  const connectionCounts = new Map<string, number>();

  graph.relationships.forEach(r => {
    connectionCounts.set(r.src, (connectionCounts.get(r.src) || 0) + 1);
    connectionCounts.set(r.dst, (connectionCounts.get(r.dst) || 0) + 1);
  });

  const isolatedNodes = Array.from(graph.entities.keys()).filter(id =>
    !connectionCounts.has(id)
  ).length;

  const connectionValues = Array.from(connectionCounts.values());
  const avgConnections = connectionValues.length > 0
    ? connectionValues.reduce((sum, c) => sum + c, 0) / connectionValues.length
    : 0;

  const maxConnections = connectionValues.length > 0
    ? Math.max(...connectionValues)
    : 0;

  const minConnections = connectionValues.length > 0
    ? Math.min(...connectionValues)
    : 0;

  return {
    isolatedNodes,
    avgConnections,
    maxConnections,
    minConnections
  };
}

/**
 * Calculate subtype distribution
 */
export function calculateSubtypeDistribution(entities: HardState[]): {
  counts: Record<string, number>;
  ratios: Record<string, number>;
} {
  const counts: Record<string, number> = {};

  entities.forEach(e => {
    const subtypeKey = `${e.kind}:${e.subtype}`;
    counts[subtypeKey] = (counts[subtypeKey] || 0) + 1;
  });

  const ratios = calculateRatios(counts, entities.length);

  return { counts, ratios };
}
