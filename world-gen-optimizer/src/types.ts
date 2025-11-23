/**
 * Type definitions for the genetic algorithm optimizer
 */

// Genome: flat map of parameter paths to values
export type Genome = Map<string, number>;

// Parameter metadata for constraint enforcement
export interface ParameterMetadata {
  path: string;           // e.g., "templates.cultFormation.metadata.parameters.numCultists.value"
  type: 'int' | 'float';  // integer or floating-point
  min: number;            // minimum value
  max: number;            // maximum value
  default: number;        // default/initial value
}

// Individual in the population
export interface Individual {
  id: string;             // unique identifier
  genome: Genome;         // parameter configuration
  fitness: number;        // overall fitness score
  fitnessBreakdown?: {    // detailed fitness metrics
    entityDistribution: number;
    prominenceDistribution: number;
    relationshipDiversity: number;
    connectivity: number;
    overall: number;
  };
  generation: number;     // generation this individual was created in
}

// Population for a generation
export interface Population {
  generation: number;
  individuals: Individual[];
  stats: {
    bestFitness: number;
    averageFitness: number;
    worstFitness: number;
    diversity: number;    // genetic diversity metric
  };
}

// Statistics from world-gen output
export interface WorldGenStats {
  fitnessMetrics: {
    entityDistributionFitness: number;
    prominenceDistributionFitness: number;
    relationshipDiversityFitness: number;
    connectivityFitness: number;
    overallFitness: number;
    constraintViolations: number;
    convergenceRate: number;
    stabilityScore: number;
  };
  validationStats: {
    totalChecks: number;
    passed: number;
    failed: number;
  };
  performanceStats: {
    protectedRelationshipViolations: {
      totalViolations: number;
      violationsByKind: Record<string, number>;
      violationRate: number;
      avgStrength: number;
    };
  };
  finalEntityCount: number;
  finalRelationshipCount: number;
  totalTicks: number;
  generationTimeMs: number;
}

// Evolution history tracking
export interface GenerationRecord {
  generation: number;
  timestamp: string;
  bestFitness: number;
  averageFitness: number;
  worstFitness: number;
  diversity: number;
  bestIndividual: {
    id: string;
    fitness: number;
    fitnessBreakdown: Individual['fitnessBreakdown'];
  };
}

// Top configuration tracking
export interface TopConfiguration {
  rank: number;
  individual: Individual;
  discoveredInGeneration: number;
  timestamp: string;
}

// GA configuration
export interface GAConfig {
  populationSize: number;
  maxGenerations: number;
  elitismCount: number;        // number of top individuals to preserve
  mutationRate: number;         // probability of mutating each gene
  tournamentSize: number;       // for tournament selection
  parallelExecutions: number;   // number of concurrent world-gen runs
}

// Fitness weights (easily changeable)
export interface FitnessWeights {
  entityDistribution: number;
  prominenceDistribution: number;
  relationshipDiversity: number;
  connectivity: number;
  overall: number;
}
