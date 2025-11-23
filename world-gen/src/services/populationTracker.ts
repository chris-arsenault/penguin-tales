/**
 * Population Tracker Service
 *
 * Real-time monitoring of entity/relationship populations for feedback control.
 * Tracks counts, targets, deviations, and trends to enable homeostatic regulation.
 */

import { Graph } from '../types/engine';
import { HardState } from '../types/worldTypes';
import { DistributionTargets } from '../types/distribution';

export interface EntityMetric {
  kind: string;
  subtype: string;
  count: number;
  target: number;
  deviation: number;      // (count - target) / target
  trend: number;          // Moving average of count change
  history: number[];      // Last 10 tick counts
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

export class PopulationTracker {
  private metrics: PopulationMetrics;
  private distributionTargets: DistributionTargets;
  private historyWindow: number = 10; // Ticks to keep in history

  constructor(distributionTargets: DistributionTargets) {
    this.distributionTargets = distributionTargets;
    this.metrics = {
      tick: 0,
      entities: new Map(),
      relationships: new Map(),
      pressures: new Map()
    };
  }

  /**
   * Update metrics from current graph state
   */
  update(graph: Graph): void {
    this.metrics.tick = graph.tick;
    this.updateEntityMetrics(graph);
    this.updateRelationshipMetrics(graph);
    this.updatePressureMetrics(graph);
  }

  private updateEntityMetrics(graph: Graph): void {
    // Group entities by kind:subtype
    const entityCounts = new Map<string, number>();

    Array.from(graph.entities.values()).forEach(entity => {
      const key = `${entity.kind}:${entity.subtype}`;
      entityCounts.set(key, (entityCounts.get(key) || 0) + 1);
    });

    // Update metrics for each entity type
    entityCounts.forEach((count, key) => {
      const [kind, subtype] = key.split(':');
      const existing = this.metrics.entities.get(key);

      // Get target from distribution targets
      const target = this.getEntityTarget(kind, subtype);

      // Calculate deviation
      const deviation = target > 0 ? (count - target) / target : 0;

      // Update history and calculate trend
      const history = existing?.history || [];
      history.push(count);
      if (history.length > this.historyWindow) history.shift();

      const trend = this.calculateTrend(history);

      this.metrics.entities.set(key, {
        kind,
        subtype,
        count,
        target,
        deviation,
        trend,
        history: [...history]
      });
    });

    // Add zero counts for entity types in targets but not in graph
    const targetsWithEntities = this.distributionTargets as any;
    if (targetsWithEntities.entities) {
      Object.entries(targetsWithEntities.entities).forEach(([kind, subtypes]) => {
        Object.entries(subtypes as any).forEach(([subtype, config]: [string, any]) => {
          const key = `${kind}:${subtype}`;
          if (!entityCounts.has(key) && config.target > 0) {
            const existing = this.metrics.entities.get(key);
            const history = existing?.history || [];
            history.push(0);
            if (history.length > this.historyWindow) history.shift();

            this.metrics.entities.set(key, {
              kind,
              subtype,
              count: 0,
              target: config.target,
              deviation: -1,
              trend: this.calculateTrend(history),
              history: [...history]
            });
          }
        });
      });
    }
  }

  private updateRelationshipMetrics(graph: Graph): void {
    // Group relationships by kind
    const relationshipCounts = new Map<string, number>();

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
      if (history.length > this.historyWindow) history.shift();

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

  private updatePressureMetrics(graph: Graph): void {
    graph.pressures.forEach((value, id) => {
      const existing = this.metrics.pressures.get(id);

      // Get target (ideal equilibrium)
      const target = this.getPressureTarget(id);

      // Calculate deviation
      const deviation = target > 0 ? (value - target) / target : 0;

      // Update history and calculate trend
      const history = existing?.history || [];
      history.push(value);
      if (history.length > this.historyWindow) history.shift();

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
  private calculateTrend(history: number[]): number {
    if (history.length < 2) return 0;

    let sumDeltas = 0;
    for (let i = 1; i < history.length; i++) {
      sumDeltas += (history[i] - history[i - 1]);
    }

    return sumDeltas / (history.length - 1);
  }

  private getEntityTarget(kind: string, subtype: string): number {
    const targetsWithEntities = this.distributionTargets as any;
    return targetsWithEntities.entities?.[kind]?.[subtype]?.target || 0;
  }

  private getRelationshipTarget(kind: string): number {
    // Could be extended to have relationship targets in distribution config
    return 0;
  }

  private getPressureTarget(id: string): number {
    // Ideal equilibrium targets for pressures
    const targets: Record<string, number> = {
      'resource_scarcity': 30,    // Moderate scarcity drives trade/exploration
      'conflict': 40,              // Some conflict creates drama
      'magical_instability': 25,   // Moderate magic creates mystery
      'cultural_tension': 35,      // Some tension drives cultural evolution
      'stability': 60,             // High stability is good
      'external_threat': 15        // Low external threat with occasional spikes
    };

    return targets[id] || 50;
  }

  /**
   * Get current metrics
   */
  getMetrics(): PopulationMetrics {
    return this.metrics;
  }

  /**
   * Get entities that are significantly over/under target
   */
  getOutliers(threshold: number = 0.3): {
    overpopulated: EntityMetric[];
    underpopulated: EntityMetric[];
  } {
    const overpopulated: EntityMetric[] = [];
    const underpopulated: EntityMetric[] = [];

    this.metrics.entities.forEach(metric => {
      if (metric.target === 0) return; // Skip entity types with no target

      if (metric.deviation > threshold) {
        overpopulated.push(metric);
      } else if (metric.deviation < -threshold) {
        underpopulated.push(metric);
      }
    });

    return { overpopulated, underpopulated };
  }

  /**
   * Get summary statistics
   */
  getSummary(): {
    totalEntities: number;
    totalRelationships: number;
    avgEntityDeviation: number;
    maxEntityDeviation: number;
    pressureDeviations: Map<string, number>;
  } {
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

    const pressureDeviations = new Map<string, number>();
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
