import { Graph, EngineConfig } from '../types/engine';
import { HardState } from '../types/worldTypes';
import {
  SimulationStatistics,
  EpochStats,
  DistributionStats,
  EnrichmentStats,
  ValidationStats,
  SystemPerformanceStats,
  TemporalStats,
  FitnessMetrics
} from '../types/statistics';
import { getProminenceValue } from '../utils/helpers';

/**
 * Statistics Collector
 * Tracks all metrics needed for genetic algorithm fitness evaluation
 */
export class StatisticsCollector {
  private epochStats: EpochStats[] = [];
  private templateApplications: Map<string, number> = new Map();
  private systemExecutions: Map<string, number> = new Map();
  private aggressiveSystemWarnings: Map<string, number> = new Map();
  private warningCount: number = 0;
  private budgetHitCount: number = 0;
  private relationshipGrowthHistory: number[] = [];
  private erasVisited: Set<string> = new Set();
  private ticksPerEra: Map<string, number> = new Map();
  private startTime: number = Date.now();

  constructor() {}

  /**
   * Record epoch statistics
   */
  public recordEpoch(
    graph: Graph,
    epoch: number,
    entitiesCreated: number,
    relationshipsCreated: number,
    growthTarget: number
  ): void {
    // Count entities by kind and subtype
    const entitiesByKind: Record<string, number> = {};
    const entitiesBySubtype: Record<string, number> = {};

    for (const entity of graph.entities.values()) {
      entitiesByKind[entity.kind] = (entitiesByKind[entity.kind] || 0) + 1;
      const subtypeKey = `${entity.kind}:${entity.subtype}`;
      entitiesBySubtype[subtypeKey] = (entitiesBySubtype[subtypeKey] || 0) + 1;
    }

    // Count relationships by type
    const relationshipsByType: Record<string, number> = {};
    for (const rel of graph.relationships) {
      relationshipsByType[rel.kind] = (relationshipsByType[rel.kind] || 0) + 1;
    }

    // Calculate relationship growth rate
    const relationshipGrowthRate = graph.growthMetrics.averageGrowthRate;
    this.relationshipGrowthHistory.push(relationshipGrowthRate);

    // Track era
    this.erasVisited.add(graph.currentEra.id);
    this.ticksPerEra.set(
      graph.currentEra.id,
      (this.ticksPerEra.get(graph.currentEra.id) || 0) + 1
    );

    const epochStat: EpochStats = {
      epoch,
      tick: graph.tick,
      era: graph.currentEra.name,
      totalEntities: graph.entities.size,
      entitiesByKind,
      entitiesBySubtype,
      entitiesCreated,
      totalRelationships: graph.relationships.length,
      relationshipsByType,
      relationshipsCreated,
      pressures: Object.fromEntries(graph.pressures),
      growthTarget,
      growthActual: entitiesCreated,
      relationshipGrowthRate
    };

    this.epochStats.push(epochStat);
  }

  /**
   * Record template application
   */
  public recordTemplateApplication(templateId: string): void {
    this.templateApplications.set(
      templateId,
      (this.templateApplications.get(templateId) || 0) + 1
    );
  }

  /**
   * Record system execution
   */
  public recordSystemExecution(systemId: string): void {
    this.systemExecutions.set(
      systemId,
      (this.systemExecutions.get(systemId) || 0) + 1
    );
  }

  /**
   * Record warning
   */
  public recordWarning(warningType: 'budget' | 'aggressive' | 'growth', systemId?: string): void {
    this.warningCount++;

    if (warningType === 'budget') {
      this.budgetHitCount++;
    } else if (warningType === 'aggressive' && systemId) {
      this.aggressiveSystemWarnings.set(
        systemId,
        (this.aggressiveSystemWarnings.get(systemId) || 0) + 1
      );
    }
  }

  /**
   * Calculate distribution statistics
   */
  private calculateDistributionStats(
    graph: Graph,
    config: EngineConfig
  ): DistributionStats {
    const entities = Array.from(graph.entities.values());
    const totalEntities = entities.length;

    // Entity kind ratios
    const entityKindCounts: Record<string, number> = {};
    entities.forEach(e => {
      entityKindCounts[e.kind] = (entityKindCounts[e.kind] || 0) + 1;
    });
    const entityKindRatios: Record<string, number> = {};
    Object.keys(entityKindCounts).forEach(kind => {
      entityKindRatios[kind] = entityKindCounts[kind] / totalEntities;
    });

    // Prominence ratios
    const prominenceCounts: Record<string, number> = {
      forgotten: 0,
      marginal: 0,
      recognized: 0,
      renowned: 0,
      mythic: 0
    };
    entities.forEach(e => {
      prominenceCounts[e.prominence]++;
    });
    const prominenceRatios: Record<string, number> = {};
    Object.keys(prominenceCounts).forEach(level => {
      prominenceRatios[level] = prominenceCounts[level] / totalEntities;
    });

    // Relationship type ratios
    const totalRelationships = graph.relationships.length;
    const relationshipTypeCounts: Record<string, number> = {};
    graph.relationships.forEach(r => {
      relationshipTypeCounts[r.kind] = (relationshipTypeCounts[r.kind] || 0) + 1;
    });
    const relationshipTypeRatios: Record<string, number> = {};
    Object.keys(relationshipTypeCounts).forEach(type => {
      relationshipTypeRatios[type] = relationshipTypeCounts[type] / totalRelationships;
    });

    // Relationship diversity (Shannon entropy)
    let relationshipDiversity = 0;
    Object.values(relationshipTypeRatios).forEach(ratio => {
      if (ratio > 0) {
        relationshipDiversity -= ratio * Math.log2(ratio);
      }
    });

    // Graph connectivity metrics
    const connectionCounts = new Map<string, number>();
    graph.relationships.forEach(r => {
      connectionCounts.set(r.src, (connectionCounts.get(r.src) || 0) + 1);
      connectionCounts.set(r.dst, (connectionCounts.get(r.dst) || 0) + 1);
    });

    const isolatedNodes = Array.from(graph.entities.keys()).filter(id =>
      !connectionCounts.has(id)
    ).length;

    // Calculate clusters (simplified: connected components)
    const visited = new Set<string>();
    let clusters = 0;
    const clusterSizes: number[] = [];

    const dfs = (nodeId: string): number => {
      if (visited.has(nodeId)) return 0;
      visited.add(nodeId);
      let size = 1;

      graph.relationships.forEach(r => {
        if (r.src === nodeId && !visited.has(r.dst)) {
          size += dfs(r.dst);
        } else if (r.dst === nodeId && !visited.has(r.src)) {
          size += dfs(r.src);
        }
      });

      return size;
    };

    graph.entities.forEach((_, id) => {
      if (!visited.has(id)) {
        const clusterSize = dfs(id);
        clusters++;
        clusterSizes.push(clusterSize);
      }
    });

    const avgClusterSize = clusterSizes.length > 0
      ? clusterSizes.reduce((a, b) => a + b, 0) / clusterSizes.length
      : 0;

    const avgDegree = (totalRelationships * 2) / totalEntities;

    // Calculate deviations (if distribution targets exist)
    let entityKindDeviation = 0;
    let prominenceDeviation = 0;
    let relationshipDeviation = 0;
    let connectivityDeviation = 0;
    let overallDeviation = 0;

    if (config.distributionTargets) {
      // Entity kind deviation
      const entityTargets = config.distributionTargets.global.entityKindDistribution.targets;
      entityKindDeviation = this.calculateDeviation(entityKindRatios, entityTargets);

      // Prominence deviation
      const prominenceTargets = config.distributionTargets.global.prominenceDistribution.targets;
      prominenceDeviation = this.calculateDeviation(prominenceRatios, prominenceTargets);

      // Relationship diversity deviation (target: maximize entropy)
      const maxEntropy = Math.log2(Object.keys(relationshipTypeRatios).length || 1);
      relationshipDeviation = maxEntropy > 0 ? 1 - (relationshipDiversity / maxEntropy) : 0;

      // Connectivity deviation
      const targetClusters = config.distributionTargets.global.graphConnectivity.targetClusters.preferred;
      const targetIsolated = config.distributionTargets.global.graphConnectivity.isolatedNodeRatio.max;
      const clusterDev = Math.abs(clusters - targetClusters) / targetClusters;
      const isolatedDev = Math.max(0, (isolatedNodes / totalEntities) - targetIsolated);
      connectivityDeviation = (clusterDev + isolatedDev) / 2;

      // Overall deviation
      overallDeviation = (entityKindDeviation + prominenceDeviation + relationshipDeviation + connectivityDeviation) / 4;
    }

    return {
      entityKindRatios,
      entityKindDeviation,
      prominenceRatios,
      prominenceDeviation,
      relationshipTypeRatios,
      relationshipDiversity,
      relationshipDeviation,
      graphMetrics: {
        clusters,
        avgClusterSize,
        isolatedNodes,
        isolatedNodeRatio: isolatedNodes / totalEntities,
        avgDegree
      },
      connectivityDeviation,
      overallDeviation
    };
  }

  /**
   * Calculate deviation between actual and target ratios
   */
  private calculateDeviation(
    actual: Record<string, number>,
    target: Record<string, number>
  ): number {
    let totalDeviation = 0;
    let count = 0;

    Object.keys(target).forEach(key => {
      const actualValue = actual[key] || 0;
      const targetValue = target[key] || 0;
      const deviation = Math.abs(actualValue - targetValue);
      totalDeviation += deviation;
      count++;
    });

    return count > 0 ? totalDeviation / count : 0;
  }

  /**
   * Calculate fitness metrics
   */
  private calculateFitnessMetrics(
    distributionStats: DistributionStats,
    config: EngineConfig
  ): FitnessMetrics {
    // Distribution fitness (inverted deviation, so 1 = perfect, 0 = worst)
    const entityDistributionFitness = 1 - Math.min(1, distributionStats.entityKindDeviation);
    const prominenceDistributionFitness = 1 - Math.min(1, distributionStats.prominenceDeviation);
    const relationshipDiversityFitness = 1 - Math.min(1, distributionStats.relationshipDeviation);
    const connectivityFitness = 1 - Math.min(1, distributionStats.connectivityDeviation);

    // Overall fitness (weighted average)
    const overallFitness = (
      entityDistributionFitness * 0.3 +
      prominenceDistributionFitness * 0.2 +
      relationshipDiversityFitness * 0.2 +
      connectivityFitness * 0.3
    );

    // Constraint violations
    let constraintViolations = 0;
    if (config.distributionTargets) {
      // Check if isolated nodes exceed max
      const maxIsolated = config.distributionTargets.global.graphConnectivity.isolatedNodeRatio.max;
      if (distributionStats.graphMetrics.isolatedNodeRatio > maxIsolated) {
        constraintViolations++;
      }

      // Check if any entity kind ratio is way off (> 50% deviation)
      if (distributionStats.entityKindDeviation > 0.5) {
        constraintViolations++;
      }
    }

    // Convergence rate (how quickly did deviation decrease)
    const convergenceRate = this.epochStats.length > 0
      ? 1 - (distributionStats.overallDeviation || 0)
      : 0;

    // Stability score (low variance in metrics over time)
    let stabilityScore = 1.0;
    if (this.relationshipGrowthHistory.length > 5) {
      const mean = this.relationshipGrowthHistory.reduce((a, b) => a + b, 0) / this.relationshipGrowthHistory.length;
      const variance = this.relationshipGrowthHistory.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / this.relationshipGrowthHistory.length;
      const stdDev = Math.sqrt(variance);
      stabilityScore = mean > 0 ? Math.max(0, 1 - (stdDev / mean)) : 1.0;
    }

    return {
      entityDistributionFitness,
      prominenceDistributionFitness,
      relationshipDiversityFitness,
      connectivityFitness,
      overallFitness,
      constraintViolations,
      convergenceRate,
      stabilityScore
    };
  }

  /**
   * Generate final statistics
   */
  public generateStatistics(
    graph: Graph,
    config: EngineConfig,
    enrichmentAnalytics: EnrichmentStats,
    validationResults: ValidationStats
  ): SimulationStatistics {
    const endTime = Date.now();
    const generationTimeMs = endTime - this.startTime;

    // Distribution stats
    const distributionStats = this.calculateDistributionStats(graph, config);

    // Fitness metrics
    const fitnessMetrics = this.calculateFitnessMetrics(distributionStats, config);

    // Calculate protected relationship violation stats
    const violationData = graph.protectedRelationshipViolations || [];
    let totalViolations = 0;
    const violationsByKind: Record<string, number> = {};
    let totalStrength = 0;

    violationData.forEach(entry => {
      entry.violations.forEach(violation => {
        totalViolations++;
        violationsByKind[violation.kind] = (violationsByKind[violation.kind] || 0) + 1;
        totalStrength += violation.strength;
      });
    });

    const violationRate = graph.tick > 0 ? totalViolations / graph.tick : 0;
    const avgStrength = totalViolations > 0 ? totalStrength / totalViolations : 0;

    // System performance stats
    const performanceStats: SystemPerformanceStats = {
      templatesApplied: Object.fromEntries(this.templateApplications),
      totalTemplateApplications: Array.from(this.templateApplications.values()).reduce((a, b) => a + b, 0),
      systemsExecuted: Object.fromEntries(this.systemExecutions),
      totalSystemExecutions: Array.from(this.systemExecutions.values()).reduce((a, b) => a + b, 0),
      warnings: this.warningCount,
      relationshipBudgetHits: this.budgetHitCount,
      aggressiveSystemWarnings: Object.fromEntries(this.aggressiveSystemWarnings),
      averageRelationshipGrowthRate: graph.growthMetrics.averageGrowthRate,
      maxRelationshipGrowthRate: Math.max(...this.relationshipGrowthHistory, 0),
      relationshipGrowthHistory: this.relationshipGrowthHistory,
      protectedRelationshipViolations: {
        totalViolations,
        violationsByKind,
        violationRate,
        avgStrength
      }
    };

    // Temporal stats
    const temporalStats: TemporalStats = {
      totalTicks: graph.tick,
      totalEpochs: this.epochStats.length,
      ticksPerEpoch: config.epochLength,
      erasVisited: Array.from(this.erasVisited),
      ticksPerEra: Object.fromEntries(this.ticksPerEra),
      entitiesPerTick: graph.entities.size / graph.tick,
      relationshipsPerTick: graph.relationships.length / graph.tick,
      entitiesPerEpoch: graph.entities.size / this.epochStats.length,
      relationshipsPerEpoch: graph.relationships.length / this.epochStats.length
    };

    return {
      generatedAt: new Date().toISOString(),
      totalTicks: graph.tick,
      totalEpochs: this.epochStats.length,
      generationTimeMs,
      finalEntityCount: graph.entities.size,
      finalRelationshipCount: graph.relationships.length,
      finalHistoryEventCount: graph.history.length,
      epochStats: this.epochStats,
      distributionStats,
      enrichmentStats: enrichmentAnalytics,
      validationStats: validationResults,
      performanceStats,
      temporalStats,
      fitnessMetrics,
      configSnapshot: {
        epochLength: config.epochLength,
        simulationTicksPerGrowth: config.simulationTicksPerGrowth,
        targetEntitiesPerKind: config.targetEntitiesPerKind,
        maxTicks: config.maxTicks,
        relationshipBudget: config.relationshipBudget,
        distributionTargetsEnabled: Boolean(config.distributionTargets)
      }
    };
  }
}
