/**
 * SimulationEmitter Event Types
 *
 * Defines all events emitted by WorldEngine during simulation.
 * These replace console.log calls and enable real-time UI updates via web worker.
 */

import { HardState, Relationship } from '../core/worldTypes';
import { Era, HistoryEvent } from '../engine/types';

// =============================================================================
// Event Payloads
// =============================================================================

export interface ProgressPayload {
  phase: 'initializing' | 'validating' | 'running' | 'finalizing';
  tick: number;
  maxTicks: number;
  epoch: number;
  totalEpochs: number;
  entityCount: number;
  relationshipCount: number;
}

export interface LogPayload {
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  timestamp: number;
  context?: Record<string, unknown>;
}

export interface ValidationPayload {
  status: 'success' | 'failed';
  errors: string[];
  warnings: string[];
}

export interface EpochStartPayload {
  epoch: number;
  era: {
    id: string;
    name: string;
    description: string;
  };
  tick: number;
}

export interface EpochStatsPayload {
  epoch: number;
  era: string;
  entitiesByKind: Record<string, number>;
  relationshipCount: number;
  pressures: Record<string, number>;
  entitiesCreated: number;
  relationshipsCreated: number;
  growthTarget: number;
}

export interface PopulationMetricPayload {
  kind: string;
  subtype: string;
  count: number;
  target: number;
  deviation: number;
}

export interface PopulationPayload {
  totalEntities: number;
  totalRelationships: number;
  avgDeviation: number;
  maxDeviation: number;
  entityMetrics: PopulationMetricPayload[];
  pressureMetrics: Array<{
    id: string;
    value: number;
    target: number;
    deviation: number;
  }>;
  outliers: {
    overpopulated: PopulationMetricPayload[];
    underpopulated: PopulationMetricPayload[];
  };
}

export interface TemplateUsagePayload {
  totalApplications: number;
  uniqueTemplatesUsed: number;
  totalTemplates: number;
  maxRunsPerTemplate: number;
  usage: Array<{
    templateId: string;
    count: number;
    percentage: number;
    status: 'healthy' | 'warning' | 'saturated';
  }>;
  unusedTemplates: Array<{
    templateId: string;
    diagnostic: string;
  }>;
}

export interface CoordinateStatsPayload {
  totalPlacements: number;
  byKind: Record<string, number>;
  regionUsage: Record<string, number>;
  cultureDistribution: Record<string, number>;
}

export interface SimulationResultPayload {
  metadata: {
    tick: number;
    epoch: number;
    era: string;
    entityCount: number;
    relationshipCount: number;
    historyEventCount: number;
    durationMs: number;
  };
  hardState: HardState[];
  relationships: Relationship[];
  history: HistoryEvent[];
  pressures: Record<string, number>;
  distributionMetrics?: {
    entityKindRatios: Record<string, number>;
    prominenceRatios: Record<string, number>;
    deviation: {
      overall: number;
      entityKind: number;
      prominence: number;
      relationship: number;
      connectivity: number;
    };
  };
  coordinateState?: unknown;
}

export interface ErrorPayload {
  message: string;
  stack?: string;
  phase: string;
  context?: Record<string, unknown>;
}

export interface TagHealthPayload {
  coverage: {
    totalEntities: number;
    entitiesWithTags: number;
    coveragePercentage: number;
  };
  diversity: {
    uniqueTags: number;
    shannonIndex: number;
    evenness: number;
  };
  issues: {
    orphanTagCount: number;
    overusedTagCount: number;
    conflictCount: number;
  };
}

export interface GrowthPhasePayload {
  epoch: number;
  entitiesCreated: number;
  target: number;
  templatesApplied: string[];
}

export interface SystemHealthPayload {
  populationHealth: number;
  status: 'stable' | 'functional' | 'needs_attention';
}

// =============================================================================
// Event Union Type
// =============================================================================

export type SimulationEvent =
  | { type: 'progress'; payload: ProgressPayload }
  | { type: 'log'; payload: LogPayload }
  | { type: 'validation'; payload: ValidationPayload }
  | { type: 'epoch_start'; payload: EpochStartPayload }
  | { type: 'epoch_stats'; payload: EpochStatsPayload }
  | { type: 'growth_phase'; payload: GrowthPhasePayload }
  | { type: 'population_report'; payload: PopulationPayload }
  | { type: 'template_usage'; payload: TemplateUsagePayload }
  | { type: 'coordinate_stats'; payload: CoordinateStatsPayload }
  | { type: 'tag_health'; payload: TagHealthPayload }
  | { type: 'system_health'; payload: SystemHealthPayload }
  | { type: 'complete'; payload: SimulationResultPayload }
  | { type: 'error'; payload: ErrorPayload };

// =============================================================================
// Emitter Interface
// =============================================================================

/**
 * SimulationEmitter interface.
 * WorldEngine requires this to emit events during simulation.
 * Implementations include:
 * - WorkerEmitter: Posts messages to main thread via postMessage
 * - ConsoleEmitter: For testing, logs to console (not for production use)
 */
export interface ISimulationEmitter {
  emit(event: SimulationEvent): void;

  // Convenience methods that construct events
  progress(payload: ProgressPayload): void;
  log(level: LogPayload['level'], message: string, context?: Record<string, unknown>): void;
  validation(payload: ValidationPayload): void;
  epochStart(payload: EpochStartPayload): void;
  epochStats(payload: EpochStatsPayload): void;
  growthPhase(payload: GrowthPhasePayload): void;
  populationReport(payload: PopulationPayload): void;
  templateUsage(payload: TemplateUsagePayload): void;
  coordinateStats(payload: CoordinateStatsPayload): void;
  tagHealth(payload: TagHealthPayload): void;
  systemHealth(payload: SystemHealthPayload): void;
  complete(payload: SimulationResultPayload): void;
  error(payload: ErrorPayload): void;
}

// =============================================================================
// Worker Message Types (for postMessage communication)
// =============================================================================

/**
 * Messages sent from main thread to worker
 */
export type WorkerInboundMessage =
  | { type: 'start'; config: unknown; initialState: HardState[] }
  | { type: 'abort' };

/**
 * Messages sent from worker to main thread
 */
export type WorkerOutboundMessage = SimulationEvent;
