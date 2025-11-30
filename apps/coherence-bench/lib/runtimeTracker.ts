/**
 * Runtime Tracker
 *
 * Tracks live simulation metrics during execution.
 * This is Phase 2 of the two-phase coherence model (simulation time).
 */

import type {
  RuntimeMetricsReport,
  RuntimeMetricsInput,
  RuleFiring,
  RuntimeAlert,
} from './types.js';

// ============================================================================
// INTERNAL STATE
// ============================================================================

interface TrackerState {
  /** Distribution targets from config */
  targets: RuntimeMetricsInput['targets'];
  /** Rule firing history */
  ruleFirings: RuleFiring[];
  /** Pressure history */
  pressureHistory: Map<string, Array<{ tick: number; value: number }>>;
  /** Alerts generated */
  alerts: RuntimeAlert[];
  /** Alert counter for IDs */
  alertCounter: number;
  /** Era statistics */
  eraStats: Map<string, {
    entitiesCreated: number;
    relationshipsCreated: number;
    occurrences: number;
    ruleFirings: Map<string, number>;
  }>;
  /** Last tick processed */
  lastTick: number;
}

// ============================================================================
// TRACKER CLASS
// ============================================================================

/**
 * Runtime coherence tracker
 */
export class RuntimeCoherenceTracker {
  private state: TrackerState;
  private config: {
    hubThreshold: number;
    pressureHistoryLength: number;
    alertCooldown: Map<string, number>;
  };

  constructor() {
    this.state = {
      targets: null,
      ruleFirings: [],
      pressureHistory: new Map(),
      alerts: [],
      alertCounter: 0,
      eraStats: new Map(),
      lastTick: 0,
    };
    this.config = {
      hubThreshold: 10,
      pressureHistoryLength: 100,
      alertCooldown: new Map(),
    };
  }

  /**
   * Initialize with distribution targets
   */
  initialize(targets: unknown): void {
    this.state.targets = targets;
    this.state.ruleFirings = [];
    this.state.pressureHistory.clear();
    this.state.alerts = [];
    this.state.alertCounter = 0;
    this.state.eraStats.clear();
    this.state.lastTick = 0;
    this.config.alertCooldown.clear();
  }

  /**
   * Record a rule firing
   */
  recordRuleFiring(firing: RuleFiring): void {
    this.state.ruleFirings.push(firing);

    // Update era stats
    let eraStats = this.state.eraStats.get(firing.era);
    if (!eraStats) {
      eraStats = {
        entitiesCreated: 0,
        relationshipsCreated: 0,
        occurrences: 0,
        ruleFirings: new Map(),
      };
      this.state.eraStats.set(firing.era, eraStats);
    }

    eraStats.entitiesCreated += firing.entitiesCreated;
    eraStats.relationshipsCreated += firing.relationshipsCreated;
    eraStats.ruleFirings.set(
      firing.ruleId,
      (eraStats.ruleFirings.get(firing.ruleId) || 0) + 1
    );
  }

  /**
   * Update metrics with new simulation state
   */
  update(input: RuntimeMetricsInput): RuntimeMetricsReport {
    this.state.lastTick = input.state.currentTick;

    // Record pressure values
    for (const [pressureId, value] of Object.entries(input.state.pressures)) {
      let history = this.state.pressureHistory.get(pressureId);
      if (!history) {
        history = [];
        this.state.pressureHistory.set(pressureId, history);
      }
      history.push({ tick: input.state.currentTick, value });

      // Trim history
      if (history.length > this.config.pressureHistoryLength) {
        history.shift();
      }
    }

    // Process new rule firings from history
    for (const firing of input.history.ruleFirings) {
      if (!this.state.ruleFirings.some(f =>
        f.ruleId === firing.ruleId &&
        f.tick === firing.tick
      )) {
        this.recordRuleFiring(firing);
      }
    }

    // Generate report
    return this.generateReport(input);
  }

  /**
   * Get current metrics
   */
  getMetrics(): RuntimeMetricsReport | null {
    // Can't generate without input
    return null;
  }

  /**
   * Get alerts since last check
   */
  getAlerts(): RuntimeAlert[] {
    return [...this.state.alerts];
  }

  /**
   * Get final report
   */
  finalize(): RuntimeMetricsReport | null {
    return null;
  }

  // ============================================================================
  // INTERNAL METHODS
  // ============================================================================

  private generateReport(input: RuntimeMetricsInput): RuntimeMetricsReport {
    const entityDistribution = this.analyzeEntityDistribution(input);
    const relationshipCoverage = this.analyzeRelationshipCoverage(input);
    const cultureRepresentation = this.analyzeCultureRepresentation(input);
    const connectivity = this.analyzeConnectivity(input);
    const pressureTrajectories = this.analyzePressureTrajectories(input);
    const ruleEffectiveness = this.analyzeRuleEffectiveness();
    const eraDistribution = this.buildEraDistribution(input);

    // Generate alerts based on analysis
    this.generateAlerts(
      input,
      entityDistribution,
      relationshipCoverage,
      connectivity,
      pressureTrajectories
    );

    // Calculate health scores
    const health = this.calculateHealth(
      entityDistribution,
      relationshipCoverage,
      cultureRepresentation,
      connectivity
    );

    return {
      capturedAt: new Date().toISOString(),
      tick: input.state.currentTick,
      era: input.state.currentEra,
      entityDistribution,
      relationshipCoverage,
      cultureRepresentation,
      eraDistribution,
      connectivity,
      pressureTrajectories,
      ruleEffectiveness,
      alerts: this.state.alerts,
      health,
    };
  }

  private analyzeEntityDistribution(
    input: RuntimeMetricsInput
  ): RuntimeMetricsReport['entityDistribution'] {
    const distribution: RuntimeMetricsReport['entityDistribution'] = {};
    const targets = this.state.targets as {
      entities?: Record<string, { total: number | { min: number; max: number }; subtypes?: Record<string, number> }>;
    } | null;

    // Count entities by kind
    const counts = new Map<string, { total: number; subtypes: Map<string, number> }>();

    for (const entity of input.graph.entities) {
      let kindData = counts.get(entity.kind);
      if (!kindData) {
        kindData = { total: 0, subtypes: new Map() };
        counts.set(entity.kind, kindData);
      }
      kindData.total++;
      kindData.subtypes.set(
        entity.subtype,
        (kindData.subtypes.get(entity.subtype) || 0) + 1
      );
    }

    // Build distribution report
    for (const [kind, data] of counts) {
      const targetSpec = targets?.entities?.[kind]?.total;
      const target = targetSpec
        ? typeof targetSpec === 'number'
          ? { min: targetSpec * 0.8, max: targetSpec * 1.2 }
          : targetSpec
        : { min: 0, max: Infinity };

      const subtypeTargets = targets?.entities?.[kind]?.subtypes || {};
      const subtypes: RuntimeMetricsReport['entityDistribution'][string]['subtypes'] = {};

      for (const [subtype, count] of data.subtypes) {
        const targetProportion = subtypeTargets[subtype] || 0;
        const actualProportion = data.total > 0 ? count / data.total : 0;
        subtypes[subtype] = {
          targetProportion,
          actualProportion,
          count,
        };
      }

      let status: 'on_target' | 'under' | 'over' = 'on_target';
      if (data.total < target.min) {
        status = 'under';
      } else if (data.total > target.max) {
        status = 'over';
      }

      distribution[kind] = {
        kind,
        target,
        actual: data.total,
        subtypes,
        status,
      };
    }

    return distribution;
  }

  private analyzeRelationshipCoverage(
    input: RuntimeMetricsInput
  ): RuntimeMetricsReport['relationshipCoverage'] {
    const coverage: RuntimeMetricsReport['relationshipCoverage'] = {};
    const targets = this.state.targets as {
      relationships?: { coverage?: Record<string, number> };
    } | null;

    // Count relationships by kind
    const counts = new Map<string, number>();
    for (const rel of input.graph.relationships) {
      counts.set(rel.kind, (counts.get(rel.kind) || 0) + 1);
    }

    const totalRelationships = input.graph.relationships.length;

    for (const [kind, count] of counts) {
      const targetCoverage = targets?.relationships?.coverage?.[kind] || 0;
      const actualCoverage = totalRelationships > 0 ? count / totalRelationships : 0;

      let status: 'on_target' | 'under' | 'over' = 'on_target';
      const tolerance = 0.1;
      if (actualCoverage < targetCoverage - tolerance) {
        status = 'under';
      } else if (actualCoverage > targetCoverage + tolerance) {
        status = 'over';
      }

      coverage[kind] = {
        kind,
        targetCoverage,
        actualCoverage,
        count,
        status,
      };
    }

    return coverage;
  }

  private analyzeCultureRepresentation(
    input: RuntimeMetricsInput
  ): RuntimeMetricsReport['cultureRepresentation'] {
    const representation: RuntimeMetricsReport['cultureRepresentation'] = {};
    const targets = this.state.targets as {
      cultures?: { minEntitiesPerCulture?: number };
    } | null;

    // Count entities by culture
    const counts = new Map<string, number>();
    for (const entity of input.graph.entities) {
      if (entity.culture) {
        counts.set(entity.culture, (counts.get(entity.culture) || 0) + 1);
      }
    }

    const totalEntities = input.graph.entities.length;
    const targetMin = targets?.cultures?.minEntitiesPerCulture || 0;

    for (const [cultureId, count] of counts) {
      const proportion = totalEntities > 0 ? count / totalEntities : 0;

      let status: 'represented' | 'under_represented' | 'over_represented' = 'represented';
      if (count < targetMin) {
        status = 'under_represented';
      } else if (proportion > 0.5) {
        status = 'over_represented';
      }

      representation[cultureId] = {
        name: cultureId, // Would need culture lookup for real name
        entityCount: count,
        proportion,
        targetMinEntities: targetMin,
        status,
      };
    }

    return representation;
  }

  private analyzeConnectivity(
    input: RuntimeMetricsInput
  ): RuntimeMetricsReport['connectivity'] {
    const entityRelCount = new Map<string, number>();

    // Count relationships per entity
    for (const rel of input.graph.relationships) {
      entityRelCount.set(rel.src, (entityRelCount.get(rel.src) || 0) + 1);
      entityRelCount.set(rel.dst, (entityRelCount.get(rel.dst) || 0) + 1);
    }

    // Find orphans (no relationships)
    const orphanEntities: string[] = [];
    for (const entity of input.graph.entities) {
      if (!entityRelCount.has(entity.id) || entityRelCount.get(entity.id) === 0) {
        orphanEntities.push(entity.id);
      }
    }

    // Find hubs (many relationships)
    const hubEntities: Array<{ id: string; name: string; relationshipCount: number }> = [];
    for (const entity of input.graph.entities) {
      const count = entityRelCount.get(entity.id) || 0;
      if (count > this.config.hubThreshold) {
        hubEntities.push({
          id: entity.id,
          name: entity.name,
          relationshipCount: count,
        });
      }
    }

    // Sort hubs by relationship count
    hubEntities.sort((a, b) => b.relationshipCount - a.relationshipCount);

    // Calculate average relationships per entity
    let totalRels = 0;
    for (const count of entityRelCount.values()) {
      totalRels += count;
    }
    const averageRelationshipsPerEntity = input.graph.entities.length > 0
      ? totalRels / input.graph.entities.length
      : 0;

    // Calculate graph connectedness using Union-Find
    const graphConnectedness = this.calculateConnectedness(input);

    return {
      averageRelationshipsPerEntity,
      orphanEntities: orphanEntities.slice(0, 20), // Limit to first 20
      hubEntities: hubEntities.slice(0, 10), // Limit to top 10
      graphConnectedness,
    };
  }

  private calculateConnectedness(input: RuntimeMetricsInput): number {
    if (input.graph.entities.length === 0) return 1;

    // Simple Union-Find
    const parent = new Map<string, string>();
    const rank = new Map<string, number>();

    const find = (x: string): string => {
      if (!parent.has(x)) {
        parent.set(x, x);
        rank.set(x, 0);
      }
      if (parent.get(x) !== x) {
        parent.set(x, find(parent.get(x)!));
      }
      return parent.get(x)!;
    };

    const union = (x: string, y: string): void => {
      const px = find(x);
      const py = find(y);
      if (px === py) return;

      const rx = rank.get(px) || 0;
      const ry = rank.get(py) || 0;

      if (rx < ry) {
        parent.set(px, py);
      } else if (rx > ry) {
        parent.set(py, px);
      } else {
        parent.set(py, px);
        rank.set(px, rx + 1);
      }
    };

    // Initialize all entities
    for (const entity of input.graph.entities) {
      find(entity.id);
    }

    // Union connected entities
    for (const rel of input.graph.relationships) {
      union(rel.src, rel.dst);
    }

    // Count component sizes
    const componentSizes = new Map<string, number>();
    for (const entity of input.graph.entities) {
      const root = find(entity.id);
      componentSizes.set(root, (componentSizes.get(root) || 0) + 1);
    }

    // Find largest component
    let maxSize = 0;
    for (const size of componentSizes.values()) {
      if (size > maxSize) maxSize = size;
    }

    return input.graph.entities.length > 0
      ? maxSize / input.graph.entities.length
      : 1;
  }

  private analyzePressureTrajectories(
    input: RuntimeMetricsInput
  ): RuntimeMetricsReport['pressureTrajectories'] {
    const trajectories: RuntimeMetricsReport['pressureTrajectories'] = {};

    for (const [pressureId, value] of Object.entries(input.state.pressures)) {
      const history = this.state.pressureHistory.get(pressureId) || [];
      const trend = this.calculateTrend(history);

      trajectories[pressureId] = {
        name: pressureId, // Would need pressure lookup for real name
        current: value,
        history: [...history],
        trend,
      };
    }

    return trajectories;
  }

  private calculateTrend(
    history: Array<{ tick: number; value: number }>
  ): 'rising' | 'falling' | 'stable' | 'oscillating' {
    if (history.length < 3) return 'stable';

    // Look at recent values
    const recent = history.slice(-10);
    const values = recent.map(h => h.value);

    // Calculate linear regression slope
    const n = values.length;
    const sumX = (n * (n - 1)) / 2;
    const sumY = values.reduce((a, b) => a + b, 0);
    const sumXY = values.reduce((sum, y, i) => sum + i * y, 0);
    const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);

    // Check for oscillation
    let directionChanges = 0;
    for (let i = 2; i < values.length; i++) {
      const prev = values[i - 1] - values[i - 2];
      const curr = values[i] - values[i - 1];
      if ((prev > 0 && curr < 0) || (prev < 0 && curr > 0)) {
        directionChanges++;
      }
    }

    if (directionChanges > values.length / 3) {
      return 'oscillating';
    }

    const threshold = 0.01;
    if (slope > threshold) return 'rising';
    if (slope < -threshold) return 'falling';
    return 'stable';
  }

  private analyzeRuleEffectiveness(): RuntimeMetricsReport['ruleEffectiveness'] {
    const effectiveness: RuntimeMetricsReport['ruleEffectiveness'] = {};

    // Aggregate by rule
    const ruleStats = new Map<string, {
      totalFirings: number;
      successCount: number;
      entitiesCreated: number;
      relationshipsCreated: number;
      lastFired: number;
    }>();

    for (const firing of this.state.ruleFirings) {
      let stats = ruleStats.get(firing.ruleId);
      if (!stats) {
        stats = {
          totalFirings: 0,
          successCount: 0,
          entitiesCreated: 0,
          relationshipsCreated: 0,
          lastFired: 0,
        };
        ruleStats.set(firing.ruleId, stats);
      }

      stats.totalFirings++;
      if (firing.success) stats.successCount++;
      stats.entitiesCreated += firing.entitiesCreated;
      stats.relationshipsCreated += firing.relationshipsCreated;
      stats.lastFired = Math.max(stats.lastFired, firing.tick);
    }

    for (const [ruleId, stats] of ruleStats) {
      effectiveness[ruleId] = {
        name: ruleId, // Would need rule lookup for real name
        totalFirings: stats.totalFirings,
        successRate: stats.totalFirings > 0
          ? stats.successCount / stats.totalFirings
          : 0,
        entitiesCreated: stats.entitiesCreated,
        relationshipsCreated: stats.relationshipsCreated,
        lastFired: stats.lastFired,
      };
    }

    return effectiveness;
  }

  private buildEraDistribution(
    input: RuntimeMetricsInput
  ): RuntimeMetricsReport['eraDistribution'] {
    const distribution: RuntimeMetricsReport['eraDistribution'] = {};

    for (const [eraId, stats] of this.state.eraStats) {
      const ruleFirings: Record<string, number> = {};
      for (const [ruleId, count] of stats.ruleFirings) {
        ruleFirings[ruleId] = count;
      }

      distribution[eraId] = {
        name: eraId, // Would need era lookup for real name
        entitiesCreated: stats.entitiesCreated,
        relationshipsCreated: stats.relationshipsCreated,
        occurrences: stats.occurrences,
        ruleFirings,
      };
    }

    return distribution;
  }

  private generateAlerts(
    input: RuntimeMetricsInput,
    entityDistribution: RuntimeMetricsReport['entityDistribution'],
    relationshipCoverage: RuntimeMetricsReport['relationshipCoverage'],
    connectivity: RuntimeMetricsReport['connectivity'],
    pressureTrajectories: RuntimeMetricsReport['pressureTrajectories']
  ): void {
    const tick = input.state.currentTick;

    // Check for entity imbalances
    for (const [kind, data] of Object.entries(entityDistribution)) {
      if (data.status === 'under' && data.actual < data.target.min * 0.5) {
        this.addAlert({
          id: `alert_${++this.state.alertCounter}`,
          severity: 'warning',
          category: 'distribution',
          message: `Entity kind '${kind}' is significantly under target (${data.actual}/${data.target.min})`,
          tick,
          suggestion: 'Check generation rule weights for this entity kind',
        });
      }
    }

    // Check for orphans
    if (connectivity.orphanEntities.length > input.graph.entities.length * 0.2) {
      this.addAlert({
        id: `alert_${++this.state.alertCounter}`,
        severity: 'warning',
        category: 'connectivity',
        message: `High number of orphan entities (${connectivity.orphanEntities.length} unconnected)`,
        tick,
        suggestion: 'Add simulation rules to create relationships',
      });
    }

    // Check for extreme pressures
    for (const [pressureId, data] of Object.entries(pressureTrajectories)) {
      if (data.current <= 0 || data.current >= 100) {
        this.addAlert({
          id: `alert_${++this.state.alertCounter}`,
          severity: 'critical',
          category: 'pressure',
          message: `Pressure '${pressureId}' at extreme value (${data.current.toFixed(1)})`,
          tick,
          suggestion: 'Check pressure sources and sinks for balance',
        });
      }
    }

    // Check for stagnation (no rule firings in a while)
    const recentFirings = this.state.ruleFirings.filter(f => f.tick > tick - 10);
    if (tick > 20 && recentFirings.length === 0) {
      this.addAlert({
        id: `alert_${++this.state.alertCounter}`,
        severity: 'warning',
        category: 'stagnation',
        message: 'No rules have fired in the last 10 ticks',
        tick,
        suggestion: 'Check rule conditions - may be too restrictive',
      });
    }
  }

  private addAlert(alert: RuntimeAlert): void {
    // Check cooldown to prevent spam
    const key = `${alert.category}_${alert.message.substring(0, 30)}`;
    const lastAlert = this.config.alertCooldown.get(key);

    if (lastAlert && alert.tick - lastAlert < 20) {
      return; // Still in cooldown
    }

    this.config.alertCooldown.set(key, alert.tick);
    this.state.alerts.push(alert);

    // Limit total alerts
    if (this.state.alerts.length > 100) {
      this.state.alerts = this.state.alerts.slice(-50);
    }
  }

  private calculateHealth(
    entityDistribution: RuntimeMetricsReport['entityDistribution'],
    relationshipCoverage: RuntimeMetricsReport['relationshipCoverage'],
    cultureRepresentation: RuntimeMetricsReport['cultureRepresentation'],
    connectivity: RuntimeMetricsReport['connectivity']
  ): RuntimeMetricsReport['health'] {
    // Entity balance score
    const entityEntries = Object.values(entityDistribution);
    const onTargetEntities = entityEntries.filter(e => e.status === 'on_target').length;
    const entityBalance = entityEntries.length > 0
      ? (onTargetEntities / entityEntries.length) * 100
      : 100;

    // Relationship coverage score
    const relEntries = Object.values(relationshipCoverage);
    const onTargetRels = relEntries.filter(r => r.status === 'on_target').length;
    const relationshipScore = relEntries.length > 0
      ? (onTargetRels / relEntries.length) * 100
      : 100;

    // Culture balance score
    const cultureEntries = Object.values(cultureRepresentation);
    const representedCultures = cultureEntries.filter(c => c.status === 'represented').length;
    const cultureBalance = cultureEntries.length > 0
      ? (representedCultures / cultureEntries.length) * 100
      : 100;

    // Connectivity score
    const connectivityScore = connectivity.graphConnectedness * 100;

    // Overall weighted average
    const overall = (
      entityBalance * 0.3 +
      relationshipScore * 0.25 +
      cultureBalance * 0.2 +
      connectivityScore * 0.25
    );

    return {
      entityBalance: Math.round(entityBalance),
      relationshipCoverage: Math.round(relationshipScore),
      cultureBalance: Math.round(cultureBalance),
      connectivity: Math.round(connectivityScore),
      overall: Math.round(overall),
    };
  }
}

/**
 * Create a new runtime tracker instance
 */
export function createRuntimeTracker(): RuntimeCoherenceTracker {
  return new RuntimeCoherenceTracker();
}
