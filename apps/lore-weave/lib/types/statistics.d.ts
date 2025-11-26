/**
 * Statistics types for genetic algorithm fitness evaluation
 */
export interface EpochStats {
    epoch: number;
    tick: number;
    era: string;
    totalEntities: number;
    entitiesByKind: Record<string, number>;
    entitiesBySubtype: Record<string, number>;
    entitiesCreated: number;
    totalRelationships: number;
    relationshipsByType: Record<string, number>;
    relationshipsCreated: number;
    pressures: Record<string, number>;
    growthTarget: number;
    growthActual: number;
    relationshipGrowthRate: number;
}
export interface DistributionStats {
    entityKindRatios: Record<string, number>;
    entityKindDeviation: number;
    prominenceRatios: Record<string, number>;
    prominenceDeviation: number;
    relationshipTypeRatios: Record<string, number>;
    relationshipDiversity: number;
    relationshipDeviation: number;
    graphMetrics: {
        clusters: number;
        avgClusterSize: number;
        isolatedNodes: number;
        isolatedNodeRatio: number;
        avgDegree: number;
    };
    connectivityDeviation: number;
    overallDeviation: number;
}
export interface EnrichmentStats {
    locationEnrichments: number;
    factionEnrichments: number;
    ruleEnrichments: number;
    abilityEnrichments: number;
    npcEnrichments: number;
    totalEnrichments: number;
}
export interface ValidationStats {
    totalChecks: number;
    passed: number;
    failed: number;
    results: Array<{
        name: string;
        passed: boolean;
        failureCount: number;
        details?: string;
    }>;
}
export interface SystemPerformanceStats {
    templatesApplied: Record<string, number>;
    totalTemplateApplications: number;
    systemsExecuted: Record<string, number>;
    totalSystemExecutions: number;
    warnings: number;
    relationshipBudgetHits: number;
    aggressiveSystemWarnings: Record<string, number>;
    averageRelationshipGrowthRate: number;
    maxRelationshipGrowthRate: number;
    relationshipGrowthHistory: number[];
    protectedRelationshipViolations: {
        totalViolations: number;
        violationsByKind: Record<string, number>;
        violationRate: number;
        avgStrength: number;
    };
}
export interface TemporalStats {
    totalTicks: number;
    totalEpochs: number;
    ticksPerEpoch: number;
    erasVisited: string[];
    ticksPerEra: Record<string, number>;
    entitiesPerTick: number;
    relationshipsPerTick: number;
    entitiesPerEpoch: number;
    relationshipsPerEpoch: number;
}
export interface FitnessMetrics {
    entityDistributionFitness: number;
    prominenceDistributionFitness: number;
    relationshipDiversityFitness: number;
    connectivityFitness: number;
    overallFitness: number;
    constraintViolations: number;
    convergenceRate: number;
    stabilityScore: number;
}
export interface SimulationStatistics {
    generatedAt: string;
    totalTicks: number;
    totalEpochs: number;
    generationTimeMs: number;
    finalEntityCount: number;
    finalRelationshipCount: number;
    finalHistoryEventCount: number;
    epochStats: EpochStats[];
    distributionStats: DistributionStats;
    enrichmentStats: EnrichmentStats;
    validationStats: ValidationStats;
    performanceStats: SystemPerformanceStats;
    temporalStats: TemporalStats;
    fitnessMetrics: FitnessMetrics;
    configSnapshot: {
        epochLength: number;
        simulationTicksPerGrowth: number;
        targetEntitiesPerKind: number;
        maxTicks: number;
        relationshipBudget?: {
            maxPerSimulationTick: number;
            maxPerGrowthPhase: number;
        };
        distributionTargetsEnabled: boolean;
    };
}
//# sourceMappingURL=statistics.d.ts.map