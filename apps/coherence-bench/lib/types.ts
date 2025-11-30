/**
 * Coherence Bench Types
 *
 * Domain-agnostic types for coherence analysis of simulation systems.
 * These types represent the metadata and analysis results that can be
 * extracted from any template/system-based world generation framework.
 */

// ============================================================================
// TEMPLATE INTROSPECTION
// ============================================================================

/**
 * Static metadata extracted from a growth template.
 */
export interface TemplateIntrospection {
  id: string;
  name: string;

  produces: {
    entityKinds: Array<{
      kind: string;
      subtype: string;
      count: { min: number; max: number };
      prominence?: Array<{ level: string; probability: number }>;
    }>;
    relationships: Array<{
      kind: string;
      category?: string;
      probability: number;
      comment?: string;
    }>;
  };

  effects: {
    graphDensity: number;
    clusterFormation: number;
    diversityImpact: number;
    comment?: string;
  };

  parameters: Record<string, {
    value: number;
    min?: number;
    max?: number;
    description: string;
  }>;

  declaredTags: string[];

  purpose?: string;

  enabledBy?: {
    pressures: Array<{ name: string; threshold: number }>;
    entityCounts: Array<{ kind: string; subtype?: string; min: number; max?: number }>;
    eras: string[];
  };

  affects?: {
    entities: Array<{
      kind: string;
      subtype?: string;
      operation: 'create' | 'modify' | 'delete';
      count?: { min: number; max: number };
    }>;
    relationships: Array<{
      kind: string;
      operation: 'create' | 'delete';
      count?: { min: number; max: number };
    }>;
    pressures: Array<{
      name: string;
      delta?: number;
      formula?: string;
    }>;
    tags: Array<{
      operation: 'add' | 'remove' | 'propagate';
      pattern: string;
    }>;
  };

  analysis: {
    tagsProduced: string[];
    tagsConsumed: string[];
    relationshipsCreated: string[];
    entityKindsCreated: string[];
  };
}

// ============================================================================
// SYSTEM INTROSPECTION
// ============================================================================

/**
 * Static metadata extracted from a simulation system.
 */
export interface SystemIntrospection {
  id: string;
  name: string;

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

  parameters: Record<string, {
    value: number;
    min?: number;
    max?: number;
    description: string;
  }>;

  triggers?: {
    pressures?: string[];
    graphConditions?: string[];
    comment?: string;
  };

  purpose?: string;

  enabledBy?: {
    pressures: Array<{ name: string; threshold: number }>;
    entityCounts: Array<{ kind: string; subtype?: string; min: number; max?: number }>;
    eras: string[];
  };

  affects?: {
    entities: Array<{
      kind: string;
      subtype?: string;
      operation: 'create' | 'modify' | 'delete';
      count?: { min: number; max: number };
    }>;
    relationships: Array<{
      kind: string;
      operation: 'create' | 'delete';
      count?: { min: number; max: number };
    }>;
    pressures: Array<{
      name: string;
      delta?: number;
      formula?: string;
    }>;
    tags: Array<{
      operation: 'add' | 'remove' | 'propagate';
      pattern: string;
    }>;
  };

  analysis: {
    tagsProduced: string[];
    tagsConsumed: string[];
    relationshipsCreated: string[];
    relationshipsConsumed: string[];
  };
}

// ============================================================================
// PRESSURE INTROSPECTION
// ============================================================================

export interface PressureIntrospection {
  id: string;
  name: string;
  initialValue: number;
  decay: number;

  sources: Array<{
    component: string;
    delta?: number;
    formula?: string;
  }>;

  sinks: Array<{
    component: string;
    delta?: number;
    formula?: string;
  }>;

  affects: Array<{
    component: string;
    effect: 'enabler' | 'amplifier' | 'suppressor';
    threshold?: number;
    factor?: number;
  }>;

  equilibrium: {
    expectedRange: [number, number];
    restingPoint: number;
    oscillationPeriod?: number;
  };
}

// ============================================================================
// FEEDBACK LOOP INTROSPECTION
// ============================================================================

export interface FeedbackLoopIntrospection {
  id: string;
  type: 'negative' | 'positive';
  source: string;
  mechanism: string[];
  target: string;
  strength: number;
  delay: number;
  active: boolean;
}

// ============================================================================
// TAG INTROSPECTION
// ============================================================================

export interface TagIntrospection {
  tag: string;
  category: 'status' | 'trait' | 'affiliation' | 'behavior' | 'theme' | 'location' | 'unknown';
  rarity: 'common' | 'uncommon' | 'rare' | 'legendary' | 'unknown';
  description: string;
  usageCount: number;
  templates: string[];
  entityKinds: string[];
  minUsage?: number;
  maxUsage?: number;
  relatedTags?: string[];
  conflictingTags?: string[];
  consolidateInto?: string;
}

// ============================================================================
// ENTITY REGISTRY INTROSPECTION
// ============================================================================

export interface EntityRegistryIntrospection {
  kind: string;
  subtype?: string;

  creators: Array<{
    templateId: string;
    primary: boolean;
    targetCount?: number;
  }>;

  modifiers: Array<{
    systemId: string;
    operation: string;
  }>;

  expectedDistribution: {
    targetCount: number;
    prominenceDistribution: Record<string, number>;
  };
}

// ============================================================================
// ERA INTROSPECTION
// ============================================================================

export interface EraIntrospection {
  id: string;
  name: string;
  description: string;
  templateWeights: Record<string, number>;
  systemModifiers: Record<string, number>;
  pressureModifiers?: Record<string, number>;
}

// ============================================================================
// SCHEMA TYPES
// ============================================================================

export interface EntityKindSchema {
  kind: string;
  subtypes: string[];
  statusValues: string[];
  defaultStatus: string;
}

export interface RelationshipKindSchema {
  kind: string;
  srcKinds: string[];
  dstKinds: string[];
  category: string;
  mutability: 'mutable' | 'immutable';
  protected: boolean;
  isLineage: boolean;
}

export interface CultureSchema {
  id: string;
  name: string;
  description?: string;
}

// ============================================================================
// COMPLETE COHERENCE METADATA
// ============================================================================

/**
 * Complete metadata export for coherence analysis.
 * This is the top-level structure that domains export.
 */
export interface CoherenceMetadata {
  exportedAt: string;
  domainId: string;
  domainVersion: string;

  templates: TemplateIntrospection[];
  systems: SystemIntrospection[];
  pressures: PressureIntrospection[];
  feedbackLoops: FeedbackLoopIntrospection[];
  tagRegistry: TagIntrospection[];
  entityRegistries: EntityRegistryIntrospection[];
  eras: EraIntrospection[];

  schema: {
    entityKinds: EntityKindSchema[];
    relationshipKinds: RelationshipKindSchema[];
    cultures: CultureSchema[];
  };
}

// ============================================================================
// ANALYSIS REPORT TYPES
// ============================================================================

export interface EntityCoverageReport {
  byKind: Record<string, {
    target: number;
    actualCreators: number;
    creators: Array<{
      templateId: string;
      expectedCount: { min: number; max: number };
      primary: boolean;
    }>;
    modifiers: Array<{
      systemId: string;
      operation: string;
    }>;
    status: 'healthy' | 'under-served' | 'over-served' | 'uncreated';
    issues: string[];
  }>;
  summary: {
    totalKinds: number;
    healthyKinds: number;
    underServedKinds: number;
    overServedKinds: number;
    uncreatedKinds: number;
  };
}

export interface TagFlowReport {
  byTag: Record<string, {
    category: string;
    rarity: string;
    producers: Array<{ componentId: string; componentType: 'template' | 'system' }>;
    consumers: Array<{ componentId: string; componentType: 'template' | 'system' }>;
    status: 'healthy' | 'orphan' | 'unused' | 'over-produced';
    issues: string[];
  }>;
  summary: {
    totalTags: number;
    healthyTags: number;
    orphanTags: number;
    unusedTags: number;
    overProducedTags: number;
  };
  orphanList: string[];
  unusedList: string[];
}

export interface RelationshipFlowReport {
  byKind: Record<string, {
    category: string;
    producers: Array<{
      componentId: string;
      componentType: 'template' | 'system';
      frequency?: string;
      probability?: number;
    }>;
    consumers: Array<{
      componentId: string;
      componentType: 'system';
      usage: string;
    }>;
    status: 'healthy' | 'orphan' | 'unused' | 'over-created';
    issues: string[];
  }>;
  summary: {
    totalRelationshipKinds: number;
    healthyKinds: number;
    orphanKinds: number;
    unusedKinds: number;
    overCreatedKinds: number;
  };
  orphanList: string[];
  unusedList: string[];
}

export interface PressureEquilibriumReport {
  byPressure: Record<string, {
    currentValue: number;
    expectedRange: [number, number];
    predictedEquilibrium: number;
    sources: Array<{ component: string; delta?: number }>;
    sinks: Array<{ component: string; delta?: number }>;
    status: 'healthy' | 'no-sources' | 'no-sinks' | 'out-of-range';
    issues: string[];
  }>;
  summary: {
    totalPressures: number;
    healthyPressures: number;
    pressuresWithoutSources: number;
    pressuresWithoutSinks: number;
    pressuresOutOfRange: number;
  };
}

export interface FeedbackLoopValidationReport {
  byLoop: Record<string, {
    type: 'negative' | 'positive';
    source: string;
    target: string;
    declaredStrength: number;
    observedCorrelation?: number;
    status: 'healthy' | 'broken' | 'weak' | 'inverted' | 'untested';
    issues: string[];
    recommendations: string[];
  }>;
  summary: {
    totalLoops: number;
    healthyLoops: number;
    brokenLoops: number;
    weakLoops: number;
    invertedLoops: number;
    untestedLoops: number;
  };
}

export interface ParameterRecommendation {
  componentId: string;
  componentType: 'template' | 'system' | 'pressure';
  parameter: string;
  currentValue: number;
  recommendedValue: number;
  reason: string;
  confidence: 'low' | 'medium' | 'high';
  impact: string[];
}

/**
 * Complete coherence analysis report.
 */
export interface CoherenceReport {
  analyzedAt: string;
  domainId: string;

  entityCoverage: EntityCoverageReport;
  tagFlow: TagFlowReport;
  relationshipFlow: RelationshipFlowReport;
  pressureEquilibrium: PressureEquilibriumReport;
  feedbackLoopValidation: FeedbackLoopValidationReport;

  healthScore: {
    overall: number;
    entityCoverage: number;
    tagCoherence: number;
    relationshipFlow: number;
    pressureBalance: number;
    feedbackLoops: number;
  };

  recommendations: ParameterRecommendation[];

  criticalIssues: Array<{
    category: string;
    severity: 'error' | 'warning' | 'info';
    message: string;
    affectedComponents: string[];
    suggestedFix?: string;
  }>;
}

// ============================================================================
// STATIC ANALYSIS (Design Time) - Phase 1
// ============================================================================

/**
 * Issue found during static analysis
 */
export interface StaticIssue {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  category: 'entity_coverage' | 'relationship_coverage' | 'pressure' | 'tag_flow' | 'era' | 'feedback_loop';
  message: string;
  details: string;
  affectedComponents: string[];
  suggestion?: string;
}

/**
 * Static analysis report for simulation configuration.
 * Generated at design time (before running simulation).
 */
export interface StaticAnalysisReport {
  analyzedAt: string;

  /** Entity coverage analysis */
  entityCoverage: {
    [kindId: string]: {
      kind: string;
      subtypes: {
        [subtype: string]: {
          creators: string[];       // Rule IDs that create this
          consumers: string[];      // Rule IDs that require this
          status: 'covered' | 'orphan_creator' | 'missing_creator' | 'over_served';
        };
      };
    };
  };

  /** Relationship coverage analysis */
  relationshipCoverage: {
    [kindId: string]: {
      kind: string;
      creators: string[];
      consumers: string[];
      status: 'covered' | 'orphan_creator' | 'missing_creator';
    };
  };

  /** Pressure balance analysis */
  pressureAnalysis: {
    [pressureId: string]: {
      name: string;
      sources: Array<{ ruleId: string; delta: number }>;
      sinks: Array<{ ruleId: string; delta: number }>;
      eraDrifts: Array<{ eraId: string; drift: number }>;
      equilibriumReachable: boolean;
      status: 'balanced' | 'source_only' | 'sink_only' | 'dormant';
    };
  };

  /** Tag flow analysis */
  tagFlow: {
    [tag: string]: {
      producers: string[];          // Rule IDs
      consumers: string[];          // Rule IDs (conditions that check this tag)
      status: 'flowing' | 'orphan' | 'unused';
    };
  };

  /** Era analysis */
  eraAnalysis: {
    [eraId: string]: {
      name: string;
      activeGenerationRules: string[];
      activeSimulationRules: string[];
      coverage: {
        hasEntityCreation: boolean;
        hasRelationshipCreation: boolean;
        hasSimulationActivity: boolean;
      };
      warnings: string[];
    };
  };

  /** Feedback loop validation */
  feedbackLoops: {
    [loopId: string]: {
      description: string;
      path: string[];               // Rule IDs in the loop
      status: 'valid' | 'broken' | 'weak';
      issues: string[];
    };
  };

  /** Summary metrics */
  summary: {
    totalIssues: number;
    criticalIssues: number;
    warnings: number;
    healthScore: number;            // 0-100
  };

  /** All issues found */
  issues: StaticIssue[];
}

// ============================================================================
// RUNTIME METRICS (Simulation Time) - Phase 2
// ============================================================================

/**
 * Record of a rule firing
 */
export interface RuleFiring {
  ruleId: string;
  tick: number;
  era: string;
  entitiesCreated: number;
  relationshipsCreated: number;
  success: boolean;
}

/**
 * Alert generated during simulation
 */
export interface RuntimeAlert {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  category: 'distribution' | 'connectivity' | 'pressure' | 'stagnation';
  message: string;
  tick: number;
  suggestion?: string;
}

/**
 * Runtime metrics report for live simulation tracking.
 * Updated periodically during simulation.
 */
export interface RuntimeMetricsReport {
  capturedAt: string;
  tick: number;
  era: string;

  /** Entity distribution vs targets */
  entityDistribution: {
    [kindId: string]: {
      kind: string;
      target: { min: number; max: number };
      actual: number;
      subtypes: {
        [subtype: string]: {
          targetProportion: number;
          actualProportion: number;
          count: number;
        };
      };
      status: 'on_target' | 'under' | 'over';
    };
  };

  /** Relationship coverage */
  relationshipCoverage: {
    [kindId: string]: {
      kind: string;
      targetCoverage: number;       // From distribution targets
      actualCoverage: number;       // Actual proportion
      count: number;
      status: 'on_target' | 'under' | 'over';
    };
  };

  /** Culture representation */
  cultureRepresentation: {
    [cultureId: string]: {
      name: string;
      entityCount: number;
      proportion: number;
      targetMinEntities: number;
      status: 'represented' | 'under_represented' | 'over_represented';
    };
  };

  /** Era distribution */
  eraDistribution: {
    [eraId: string]: {
      name: string;
      entitiesCreated: number;
      relationshipsCreated: number;
      occurrences: number;
      ruleFirings: Record<string, number>;  // ruleId -> count
    };
  };

  /** Connectivity health */
  connectivity: {
    averageRelationshipsPerEntity: number;
    orphanEntities: string[];       // Entity IDs with 0 relationships
    hubEntities: Array<{            // Entities exceeding hub threshold
      id: string;
      name: string;
      relationshipCount: number;
    }>;
    graphConnectedness: number;     // 0-1, proportion in largest component
  };

  /** Pressure trajectories */
  pressureTrajectories: {
    [pressureId: string]: {
      name: string;
      current: number;
      history: Array<{ tick: number; value: number }>;
      trend: 'rising' | 'falling' | 'stable' | 'oscillating';
    };
  };

  /** Rule effectiveness */
  ruleEffectiveness: {
    [ruleId: string]: {
      name: string;
      totalFirings: number;
      successRate: number;
      entitiesCreated: number;
      relationshipsCreated: number;
      lastFired: number;            // Tick
    };
  };

  /** Active alerts */
  alerts: RuntimeAlert[];

  /** Overall health metrics */
  health: {
    entityBalance: number;          // 0-100
    relationshipCoverage: number;   // 0-100
    cultureBalance: number;         // 0-100
    connectivity: number;           // 0-100
    overall: number;                // 0-100
  };
}

// ============================================================================
// COHERENCE BENCH INTERFACE
// ============================================================================

/**
 * Interface for static analysis (design time)
 */
export interface StaticAnalyzer {
  analyze(config: StaticAnalysisInput): StaticAnalysisReport;
}

/**
 * Input for static analysis
 */
export interface StaticAnalysisInput {
  schema: {
    entityKinds: EntityKindSchema[];
    relationshipKinds: RelationshipKindSchema[];
    cultures: CultureSchema[];
  };
  eras: EraIntrospection[];
  simulation: {
    pressures: Array<{ id: string; name: string; initialValue: number }>;
    generationRules: Array<{
      id: string;
      name: string;
      conditions: unknown[];
      create: unknown[];
      connect: unknown[];
      metadata: {
        produces?: { entityKinds?: unknown[]; relationships?: unknown[] };
        requires?: { entityKinds?: unknown[]; relationships?: unknown[]; pressures?: unknown[] };
        tags?: string[];
      };
    }>;
    simulationRules: Array<{
      id: string;
      name: string;
      conditions: unknown[];
      select: unknown[];
      connect: unknown[];
      metadata: {
        produces?: { entityKinds?: unknown[]; relationships?: unknown[] };
        requires?: { entityKinds?: unknown[]; relationships?: unknown[]; pressures?: unknown[] };
        tags?: string[];
      };
    }>;
    eraRuleWeights: Record<string, {
      generationWeights: Record<string, number>;
      simulationWeights: Record<string, number>;
      pressureDrift: Record<string, number>;
    }>;
    distributionTargets: unknown;
    feedbackLoops?: Array<{ id: string; description: string; chain: unknown[] }>;
  };
}

/**
 * Interface for runtime tracking (simulation time)
 */
export interface RuntimeTracker {
  /** Initialize with distribution targets */
  initialize(targets: unknown): void;

  /** Update with new simulation state */
  update(input: RuntimeMetricsInput): RuntimeMetricsReport;

  /** Record a rule firing */
  recordRuleFiring(firing: RuleFiring): void;

  /** Get current metrics */
  getMetrics(): RuntimeMetricsReport;

  /** Get alerts since last check */
  getAlerts(): RuntimeAlert[];

  /** Get final report */
  finalize(): RuntimeMetricsReport;
}

/**
 * Input for runtime metrics update
 */
export interface RuntimeMetricsInput {
  graph: {
    entities: Array<{
      id: string;
      kind: string;
      subtype: string;
      name: string;
      culture?: string;
      status: string;
    }>;
    relationships: Array<{
      id: string;
      kind: string;
      src: string;
      dst: string;
    }>;
  };
  state: {
    currentTick: number;
    currentEra: string;
    pressures: Record<string, number>;
  };
  history: {
    occurrences: Array<{ id: string; kind: string; tick: number }>;
    ruleFirings: RuleFiring[];
  };
  targets: unknown;
}
