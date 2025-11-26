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
export declare function calculateEntityKindCounts(entities: HardState[]): Record<string, number>;
/**
 * Calculate ratios from counts
 *
 * @param counts - Record of counts by key
 * @param total - Total count for normalization
 * @returns Record mapping keys to ratios (0-1)
 */
export declare function calculateRatios(counts: Record<string, number>, total: number): Record<string, number>;
/**
 * Calculate prominence distribution
 */
export declare function calculateProminenceDistribution(entities: HardState[]): {
    counts: Record<string, number>;
    ratios: Record<string, number>;
};
/**
 * Calculate relationship type distribution
 */
export declare function calculateRelationshipDistribution(graph: Graph): {
    counts: Record<string, number>;
    ratios: Record<string, number>;
    diversity: number;
};
/**
 * Calculate graph connectivity metrics
 */
export declare function calculateConnectivityMetrics(graph: Graph): {
    isolatedNodes: number;
    avgConnections: number;
    maxConnections: number;
    minConnections: number;
};
/**
 * Calculate subtype distribution
 */
export declare function calculateSubtypeDistribution(entities: HardState[]): {
    counts: Record<string, number>;
    ratios: Record<string, number>;
};
//# sourceMappingURL=distributionCalculations.d.ts.map