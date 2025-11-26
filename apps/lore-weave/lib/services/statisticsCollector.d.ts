import { Graph, EngineConfig } from '../types/engine';
import { SimulationStatistics, EnrichmentStats, ValidationStats } from '../types/statistics';
/**
 * Statistics Collector
 * Tracks all metrics needed for genetic algorithm fitness evaluation
 */
export declare class StatisticsCollector {
    private epochStats;
    private templateApplications;
    private systemExecutions;
    private aggressiveSystemWarnings;
    private warningCount;
    private budgetHitCount;
    private relationshipGrowthHistory;
    private erasVisited;
    private ticksPerEra;
    private startTime;
    constructor();
    /**
     * Record epoch statistics
     */
    recordEpoch(graph: Graph, epoch: number, entitiesCreated: number, relationshipsCreated: number, growthTarget: number): void;
    /**
     * Record template application
     */
    recordTemplateApplication(templateId: string): void;
    /**
     * Record system execution
     */
    recordSystemExecution(systemId: string): void;
    /**
     * Record warning
     */
    recordWarning(warningType: 'budget' | 'aggressive' | 'growth', systemId?: string): void;
    /**
     * Calculate distribution statistics
     */
    private calculateDistributionStats;
    /**
     * Calculate deviation between actual and target ratios
     */
    private calculateDeviation;
    /**
     * Calculate fitness metrics
     */
    private calculateFitnessMetrics;
    /**
     * Generate final statistics
     */
    generateStatistics(graph: Graph, config: EngineConfig, enrichmentAnalytics: EnrichmentStats, validationResults: ValidationStats): SimulationStatistics;
}
//# sourceMappingURL=statisticsCollector.d.ts.map