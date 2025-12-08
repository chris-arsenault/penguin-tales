/**
 * Statistics Types
 *
 * Types for statistics collection, distribution tracking, and fitness evaluation.
 */

import { Prominence } from '../core/worldTypes';

// ============================================================================
// EPOCH AND DISTRIBUTION STATS
// ============================================================================

export interface EpochStats {
  epoch: number;
  tick: number;
  era: string;

  // Entity metrics
  totalEntities: number;
  entitiesByKind: Record<string, number>;
  entitiesBySubtype: Record<string, number>;
  entitiesCreated: number;

  // Relationship metrics
  totalRelationships: number;
  relationshipsByType: Record<string, number>;
  relationshipsCreated: number;

  // Pressure values
  pressures: Record<string, number>;

  // Growth metrics
  growthTarget: number;
  growthActual: number;
  relationshipGrowthRate: number;
}

export interface DistributionStats {
  // Entity distribution
  entityKindRatios: Record<string, number>;
  entityKindDeviation: number;

  // Prominence distribution
  prominenceRatios: Record<string, number>;
  prominenceDeviation: number;

  // Relationship distribution
  relationshipTypeRatios: Record<string, number>;
  relationshipDiversity: number;
  relationshipDeviation: number;

  // Graph connectivity
  graphMetrics: {
    clusters: number;
    avgClusterSize: number;
    isolatedNodes: number;
    isolatedNodeRatio: number;
    avgDegree: number;
  };
  connectivityDeviation: number;

  // Overall deviation score
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
  // Template execution
  templatesApplied: Record<string, number>;
  totalTemplateApplications: number;

  // System execution
  systemsExecuted: Record<string, number>;
  totalSystemExecutions: number;

  // Warnings and throttling
  warnings: number;
  relationshipBudgetHits: number;
  aggressiveSystemWarnings: Record<string, number>;

  // Growth metrics
  averageRelationshipGrowthRate: number;
  maxRelationshipGrowthRate: number;
  relationshipGrowthHistory: number[];

  // Protected relationship violations (for genetic algorithm tuning)
  protectedRelationshipViolations: {
    totalViolations: number;
    violationsByKind: Record<string, number>;
    violationRate: number;  // violations per tick
    avgStrength: number;     // average strength of violating relationships
  };
}

export interface TemporalStats {
  totalTicks: number;
  totalEpochs: number;
  ticksPerEpoch: number;

  // Era progression
  erasVisited: string[];
  ticksPerEra: Record<string, number>;

  // Generation efficiency
  entitiesPerTick: number;
  relationshipsPerTick: number;
  entitiesPerEpoch: number;
  relationshipsPerEpoch: number;
}

export interface FitnessMetrics {
  // Distribution fitness (0-1, higher is better)
  entityDistributionFitness: number;
  prominenceDistributionFitness: number;
  relationshipDiversityFitness: number;
  connectivityFitness: number;

  // Overall fitness (0-1, higher is better)
  overallFitness: number;

  // Constraint violations (0 = no violations)
  constraintViolations: number;

  // Efficiency metrics
  convergenceRate: number;  // How quickly did distributions converge
  stabilityScore: number;   // How stable were the metrics
}

export interface SimulationStatistics {
  // Metadata
  generatedAt: string;
  totalTicks: number;
  totalEpochs: number;
  generationTimeMs: number;

  // Final counts
  finalEntityCount: number;
  finalRelationshipCount: number;
  finalHistoryEventCount: number;

  // Per-epoch tracking
  epochStats: EpochStats[];

  // Distribution analysis
  distributionStats: DistributionStats;

  // Enrichment analytics
  enrichmentStats: EnrichmentStats;

  // Validation results
  validationStats: ValidationStats;

  // System performance
  performanceStats: SystemPerformanceStats;

  // Temporal analysis
  temporalStats: TemporalStats;

  // Fitness evaluation
  fitnessMetrics: FitnessMetrics;

  // Configuration snapshot (for reproducibility)
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

// ============================================================================
// DISTRIBUTION TARGETS
// ============================================================================

/**
 * Statistical distribution targets for world generation tuning
 */
export interface DistributionTargets {
  $schema?: string;
  version: string;
  global: GlobalTargets;
  perEra: Record<string, EraTargetOverrides>;
  tuning: TuningParameters;
  relationshipCategories: Record<string, string[] | string>;  // Allow comment field
}

export interface GlobalTargets {
  totalEntities: {
    target: number;
    tolerance: number;
    comment?: string;
  };
  entityKindDistribution: {
    type: 'uniform' | 'normal' | 'custom';
    targets: Record<string, number>;
    tolerance: number;
    comment?: string;
  };
  prominenceDistribution: {
    type: 'normal' | 'uniform' | 'powerlaw';
    mean?: string;
    stdDev?: number;
    targets: Record<Prominence, number>;
    perKind?: {
      enabled: boolean;
      comment?: string;
    };
    comment?: string;
  };
  relationshipDistribution: {
    type: 'diverse' | 'concentrated' | 'custom';
    maxSingleTypeRatio: number;
    minTypesPresent: number;
    minTypeRatio: number;
    preferredDiversity?: Record<string, number>;
    comment?: string;
  };
  graphConnectivity: {
    type: 'clustered' | 'uniform' | 'hierarchical';
    clusteringStrengthThreshold?: number;
    clusteringComment?: string;
    targetClusters: {
      min: number;
      max: number;
      preferred: number;
    };
    clusterSizeDistribution: {
      type: 'powerlaw' | 'normal' | 'uniform';
      alpha?: number;
      comment?: string;
    };
    densityTargets: {
      intraCluster: number;
      interCluster: number;
      comment?: string;
    };
    isolatedNodeRatio: {
      max: number;
      comment?: string;
    };
    comment?: string;
  };
}

export interface EraTargetOverrides {
  comment?: string;
  entityKindDistribution?: Partial<Record<string, number | string>>;
  prominenceDistribution?: Partial<Record<Prominence | string, number | string>>;
  relationshipDistribution?: {
    preferredTypes?: string[];
    preferredRatio?: number;
    comment?: string;
  };
  graphConnectivity?: {
    interCluster?: number;
    comment?: string;
  };
}

export interface TuningParameters {
  comment?: string;
  adjustmentSpeed: number;
  deviationSensitivity: number;
  minTemplateWeight: number;
  maxTemplateWeight: number;
  convergenceThreshold: number;
  measurementInterval: number;
  correctionStrength: {
    entityKind: number;
    prominence: number;
    relationship: number;
    connectivity: number;
  };
}

/**
 * Current measured state of the world
 */
export interface DistributionState {
  tick: number;
  totalEntities: number;
  entityKindCounts: Record<string, number>;
  entityKindRatios: Record<string, number>;
  prominenceCounts: Record<Prominence, number>;
  prominenceRatios: Record<Prominence, number>;
  prominenceByKind: Record<string, Record<Prominence, number>>;
  relationshipTypeCounts: Record<string, number>;
  relationshipTypeRatios: Record<string, number>;
  relationshipCategoryCounts: Record<string, number>;
  relationshipCategoryRatios: Record<string, number>;
  graphMetrics: {
    clusters: number;
    avgClusterSize: number;
    intraClusterDensity: number;
    interClusterDensity: number;
    isolatedNodes: number;
    isolatedNodeRatio: number;
  };
}

/**
 * Deviation from targets
 */
export interface DeviationScore {
  overall: number;
  entityKind: {
    score: number;
    deviations: Record<string, number>;
  };
  prominence: {
    score: number;
    deviations: Record<Prominence, number>;
    byKind?: Record<string, Record<Prominence, number>>;
  };
  relationship: {
    score: number;
    maxTypeRatio: number;
    typesPresent: number;
    categoryBalance: number;
  };
  connectivity: {
    score: number;
    clusterCount: number;
    densityBalance: number;
    isolatedNodes: number;
  };
}

/**
 * Adjusted template weights based on distribution guidance
 */
export interface GuidedWeights {
  templateId: string;
  baseWeight: number;
  adjustedWeight: number;
  adjustmentReason: string[];
  finalProbability: number;
}
