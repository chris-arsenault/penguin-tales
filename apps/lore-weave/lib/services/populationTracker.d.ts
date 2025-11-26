/**
 * Population Tracker Service
 *
 * Real-time monitoring of entity/relationship populations for feedback control.
 * Tracks counts, targets, deviations, and trends to enable homeostatic regulation.
 */
import { Graph } from '../types/engine';
import { DistributionTargets } from '../types/distribution';
import { DomainSchema } from '../types/domainSchema';
export interface EntityMetric {
    kind: string;
    subtype: string;
    count: number;
    target: number;
    deviation: number;
    trend: number;
    history: number[];
}
export interface RelationshipMetric {
    kind: string;
    count: number;
    target: number;
    deviation: number;
    trend: number;
    history: number[];
}
export interface PressureMetric {
    id: string;
    value: number;
    target: number;
    deviation: number;
    trend: number;
    history: number[];
}
export interface PopulationMetrics {
    tick: number;
    entities: Map<string, EntityMetric>;
    relationships: Map<string, RelationshipMetric>;
    pressures: Map<string, PressureMetric>;
}
export declare class PopulationTracker {
    private metrics;
    private distributionTargets;
    private historyWindow;
    private domainSchema;
    constructor(distributionTargets: DistributionTargets, domainSchema: DomainSchema);
    /**
     * Initialize metrics for all known subtypes from domain schema
     * This ensures feedback loops can find metrics even for zero-count subtypes
     */
    private initializeSubtypeMetrics;
    /**
     * Update metrics from current graph state
     */
    update(graph: Graph): void;
    private updateEntityMetrics;
    private updateRelationshipMetrics;
    private updatePressureMetrics;
    /**
     * Calculate trend as moving average of deltas
     */
    private calculateTrend;
    private getEntityTarget;
    private getRelationshipTarget;
    private getPressureTarget;
    /**
     * Get current metrics
     */
    getMetrics(): PopulationMetrics;
    /**
     * Get entities that are significantly over/under target
     */
    getOutliers(threshold?: number): {
        overpopulated: EntityMetric[];
        underpopulated: EntityMetric[];
    };
    /**
     * Get summary statistics
     */
    getSummary(): {
        totalEntities: number;
        totalRelationships: number;
        avgEntityDeviation: number;
        maxEntityDeviation: number;
        pressureDeviations: Map<string, number>;
    };
}
//# sourceMappingURL=populationTracker.d.ts.map