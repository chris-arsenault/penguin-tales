/**
 * Population Tracker Service
 *
 * Real-time monitoring of entity/relationship populations for feedback control.
 * Tracks counts, targets, deviations, and trends to enable homeostatic regulation.
 */
export class PopulationTracker {
    metrics;
    distributionTargets;
    historyWindow = 10; // Ticks to keep in history
    domainSchema;
    constructor(distributionTargets, domainSchema) {
        this.distributionTargets = distributionTargets;
        this.domainSchema = domainSchema;
        this.metrics = {
            tick: 0,
            entities: new Map(),
            relationships: new Map(),
            pressures: new Map()
        };
        // Initialize all known subtypes with zero counts
        this.initializeSubtypeMetrics();
    }
    /**
     * Initialize metrics for all known subtypes from domain schema
     * This ensures feedback loops can find metrics even for zero-count subtypes
     */
    initializeSubtypeMetrics() {
        this.domainSchema.entityKinds.forEach(kindDef => {
            kindDef.subtypes.forEach(subtype => {
                const key = `${kindDef.kind}:${subtype}`;
                this.metrics.entities.set(key, {
                    kind: kindDef.kind,
                    subtype,
                    count: 0,
                    target: this.getEntityTarget(kindDef.kind, subtype),
                    deviation: -1, // All start below target
                    trend: 0,
                    history: []
                });
            });
        });
    }
    /**
     * Update metrics from current graph state
     */
    update(graph) {
        this.metrics.tick = graph.tick;
        this.updateEntityMetrics(graph);
        this.updateRelationshipMetrics(graph);
        this.updatePressureMetrics(graph);
    }
    updateEntityMetrics(graph) {
        // Use graph.subtypeMetrics if available (populated by statisticsCollector)
        // Otherwise count from graph.entities
        const entityCounts = new Map();
        if (graph.subtypeMetrics && graph.subtypeMetrics.size > 0) {
            // Use pre-computed subtype metrics
            graph.subtypeMetrics.forEach((count, key) => {
                entityCounts.set(key, count);
            });
        }
        else {
            // Fallback: count entities manually
            Array.from(graph.entities.values()).forEach(entity => {
                const key = `${entity.kind}:${entity.subtype}`;
                entityCounts.set(key, (entityCounts.get(key) || 0) + 1);
            });
        }
        // Update ALL metrics (including zero-count subtypes from initialization)
        this.metrics.entities.forEach((existing, key) => {
            const [kind, subtype] = key.split(':');
            const count = entityCounts.get(key) || 0;
            // Get target from distribution targets
            const target = this.getEntityTarget(kind, subtype);
            // Calculate deviation
            const deviation = target > 0 ? (count - target) / target : 0;
            // Update history and calculate trend
            const history = [...existing.history];
            history.push(count);
            if (history.length > this.historyWindow)
                history.shift();
            const trend = this.calculateTrend(history);
            // Update existing entry
            this.metrics.entities.set(key, {
                kind,
                subtype,
                count,
                target,
                deviation,
                trend,
                history
            });
        });
        // Add any NEW subtypes discovered at runtime (not in schema)
        entityCounts.forEach((count, key) => {
            if (!this.metrics.entities.has(key)) {
                const [kind, subtype] = key.split(':');
                const target = this.getEntityTarget(kind, subtype);
                const deviation = target > 0 ? (count - target) / target : 0;
                this.metrics.entities.set(key, {
                    kind,
                    subtype,
                    count,
                    target,
                    deviation,
                    trend: 0,
                    history: [count]
                });
            }
        });
    }
    updateRelationshipMetrics(graph) {
        // Group relationships by kind
        const relationshipCounts = new Map();
        graph.relationships.forEach(rel => {
            relationshipCounts.set(rel.kind, (relationshipCounts.get(rel.kind) || 0) + 1);
        });
        // Update metrics for each relationship type
        relationshipCounts.forEach((count, kind) => {
            const existing = this.metrics.relationships.get(kind);
            // Get target (if defined)
            const target = this.getRelationshipTarget(kind);
            // Calculate deviation
            const deviation = target > 0 ? (count - target) / target : 0;
            // Update history and calculate trend
            const history = existing?.history || [];
            history.push(count);
            if (history.length > this.historyWindow)
                history.shift();
            const trend = this.calculateTrend(history);
            this.metrics.relationships.set(kind, {
                kind,
                count,
                target,
                deviation,
                trend,
                history: [...history]
            });
        });
    }
    updatePressureMetrics(graph) {
        graph.pressures.forEach((value, id) => {
            const existing = this.metrics.pressures.get(id);
            // Get target (ideal equilibrium)
            const target = this.getPressureTarget(id);
            // Calculate deviation
            const deviation = target > 0 ? (value - target) / target : 0;
            // Update history and calculate trend
            const history = existing?.history || [];
            history.push(value);
            if (history.length > this.historyWindow)
                history.shift();
            const trend = this.calculateTrend(history);
            this.metrics.pressures.set(id, {
                id,
                value,
                target,
                deviation,
                trend,
                history: [...history]
            });
        });
    }
    /**
     * Calculate trend as moving average of deltas
     */
    calculateTrend(history) {
        if (history.length < 2)
            return 0;
        let sumDeltas = 0;
        for (let i = 1; i < history.length; i++) {
            sumDeltas += (history[i] - history[i - 1]);
        }
        return sumDeltas / (history.length - 1);
    }
    getEntityTarget(kind, subtype) {
        const targetsWithEntities = this.distributionTargets;
        return targetsWithEntities.entities?.[kind]?.[subtype]?.target || 0;
    }
    getRelationshipTarget(kind) {
        // Could be extended to have relationship targets in distribution config
        return 0;
    }
    getPressureTarget(id) {
        // Ideal equilibrium targets for pressures
        const targets = {
            'resource_scarcity': 30, // Moderate scarcity drives trade/exploration
            'conflict': 40, // Some conflict creates drama
            'magical_instability': 25, // Moderate magic creates mystery
            'cultural_tension': 35, // Some tension drives cultural evolution
            'stability': 60, // High stability is good
            'external_threat': 15 // Low external threat with occasional spikes
        };
        return targets[id] || 50;
    }
    /**
     * Get current metrics
     */
    getMetrics() {
        return this.metrics;
    }
    /**
     * Get entities that are significantly over/under target
     */
    getOutliers(threshold = 0.3) {
        const overpopulated = [];
        const underpopulated = [];
        this.metrics.entities.forEach(metric => {
            if (metric.target === 0)
                return; // Skip entity types with no target
            if (metric.deviation > threshold) {
                overpopulated.push(metric);
            }
            else if (metric.deviation < -threshold) {
                underpopulated.push(metric);
            }
        });
        return { overpopulated, underpopulated };
    }
    /**
     * Get summary statistics
     */
    getSummary() {
        let totalEntities = 0;
        let totalRelationships = 0;
        let sumDeviations = 0;
        let maxDeviation = 0;
        let entityCount = 0;
        this.metrics.entities.forEach(metric => {
            totalEntities += metric.count;
            if (metric.target > 0) {
                sumDeviations += Math.abs(metric.deviation);
                maxDeviation = Math.max(maxDeviation, Math.abs(metric.deviation));
                entityCount++;
            }
        });
        this.metrics.relationships.forEach(metric => {
            totalRelationships += metric.count;
        });
        const pressureDeviations = new Map();
        this.metrics.pressures.forEach(metric => {
            pressureDeviations.set(metric.id, metric.deviation);
        });
        return {
            totalEntities,
            totalRelationships,
            avgEntityDeviation: entityCount > 0 ? sumDeviations / entityCount : 0,
            maxEntityDeviation: maxDeviation,
            pressureDeviations
        };
    }
}
//# sourceMappingURL=populationTracker.js.map