/**
 * Coherence Bench Library
 *
 * Domain-agnostic coherence analysis for simulation systems.
 * Supports two-phase validation:
 * - Phase 1: Static analysis at design time (rules, pressures, coverage)
 * - Phase 2: Runtime metrics during simulation (distribution, connectivity, health)
 */

// Types
export type {
  // Template introspection (legacy - for existing TypeScript-based domains)
  TemplateIntrospection,
  SystemIntrospection,
  PressureIntrospection,
  FeedbackLoopIntrospection,
  TagIntrospection,
  EntityRegistryIntrospection,
  EraIntrospection,

  // Schema types
  EntityKindSchema,
  RelationshipKindSchema,
  CultureSchema,

  // Main metadata structure (legacy)
  CoherenceMetadata,

  // Legacy report types
  EntityCoverageReport,
  TagFlowReport,
  RelationshipFlowReport,
  PressureEquilibriumReport,
  FeedbackLoopValidationReport,
  ParameterRecommendation,
  CoherenceReport,

  // Phase 1: Static Analysis (Design Time)
  StaticIssue,
  StaticAnalysisReport,
  StaticAnalyzer,
  StaticAnalysisInput,

  // Phase 2: Runtime Metrics (Simulation Time)
  RuleFiring,
  RuntimeAlert,
  RuntimeMetricsReport,
  RuntimeTracker,
  RuntimeMetricsInput,
} from './types.js';

// Analyzer (legacy - for CoherenceMetadata-based analysis)
export { analyzeCoherence, validateMetadata } from './analyzer.js';

// Static Analyzer (Phase 1 - design time analysis for SimulationConfig)
export { analyzeStatic, validateStaticInput } from './staticAnalyzer.js';

// Runtime Tracker (Phase 2 - live metrics during simulation)
export { RuntimeCoherenceTracker, createRuntimeTracker } from './runtimeTracker.js';
