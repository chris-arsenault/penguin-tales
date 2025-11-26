import { Prominence } from './worldTypes';

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
 * Template metadata - declares what it produces
 */
export interface TemplateMetadata {
  produces: {
    entityKinds: Array<{
      kind: string;
      subtype: string;
      count: { min: number; max: number };
      prominence: Array<{ level: Prominence; probability: number }>;
    }>;
    relationships: Array<{
      kind: string;
      category?: string;
      probability: number;
      comment?: string;
    }>;
  };
  effects: {
    graphDensity: number; // -1 (reduces) to +1 (increases)
    clusterFormation: number; // -1 (disperses) to +1 (clusters)
    diversityImpact: number; // -1 (homogenizes) to +1 (diversifies)
    comment?: string;
  };
  parameters?: {
    [key: string]: {
      value: number;
      min?: number;
      max?: number;
      description: string;
    };
  };
  tags?: string[];
}

/**
 * System metadata - declares what it does
 */
export interface SystemMetadata {
  produces: {
    relationships: Array<{
      kind: string;
      category?: string;
      frequency: 'rare' | 'uncommon' | 'common' | 'very_common';
      comment?: string;
    }>;
    modifications: Array<{
      type: 'prominence' | 'status' | 'tags';
      frequency: 'rare' | 'uncommon' | 'common';
      comment?: string;
    }>;
  };
  effects: {
    graphDensity: number;
    clusterFormation: number;
    diversityImpact: number;
    comment?: string;
  };
  parameters?: {
    [key: string]: {
      value: number;
      min?: number;
      max?: number;
      description: string;
    };
  };
  triggers?: {
    pressures?: string[];
    graphConditions?: string[];
    comment?: string;
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
