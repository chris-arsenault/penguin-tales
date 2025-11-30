/**
 * Static Analyzer
 *
 * Analyzes simulation configuration at design time to detect:
 * - Entity coverage gaps (which rules create which entity kinds)
 * - Relationship coverage gaps
 * - Pressure balance (sources and sinks)
 * - Tag flow (produced vs consumed)
 * - Era completeness
 * - Feedback loop validity
 *
 * This is Phase 1 of the two-phase coherence model (design time).
 */

import type {
  StaticAnalysisInput,
  StaticAnalysisReport,
  StaticIssue,
} from './types.js';

// ============================================================================
// INTERNAL TYPES
// ============================================================================

type GenerationRule = StaticAnalysisInput['simulation']['generationRules'][0];
type SimulationRule = StaticAnalysisInput['simulation']['simulationRules'][0];
type AnyRule = GenerationRule | SimulationRule;

interface ConditionLike {
  type?: string;
  params?: Record<string, unknown>;
}

interface EntityProducer {
  ruleId: string;
  kind: string;
  subtype?: string;
}

interface EntityConsumer {
  ruleId: string;
  kind: string;
  subtype?: string;
}

interface RelationshipProducer {
  ruleId: string;
  kind: string;
}

interface RelationshipConsumer {
  ruleId: string;
  kind: string;
}

interface TagProducer {
  ruleId: string;
  tag: string;
}

interface TagConsumer {
  ruleId: string;
  tag: string;
}

// ============================================================================
// EXTRACTION UTILITIES
// ============================================================================

/**
 * Safely cast condition to a typed object
 */
function asCondition(cond: unknown): ConditionLike | null {
  if (!cond || typeof cond !== 'object') return null;
  return cond as ConditionLike;
}

/**
 * Extract entity producers from metadata.produces
 */
function extractEntityProducersFromMetadata(rule: AnyRule): EntityProducer[] {
  const producers: EntityProducer[] = [];

  if (rule.metadata?.produces?.entityKinds) {
    for (const ek of rule.metadata.produces.entityKinds as Array<{ kind?: string; subtype?: string }>) {
      if (ek.kind) {
        producers.push({
          ruleId: rule.id,
          kind: ek.kind,
          subtype: ek.subtype,
        });
      }
    }
  }

  return producers;
}

/**
 * Extract entity consumers from metadata.requires and conditions
 */
function extractEntityConsumersFromRule(rule: AnyRule): EntityConsumer[] {
  const consumers: EntityConsumer[] = [];

  // From metadata.requires
  if (rule.metadata?.requires?.entityKinds) {
    for (const ek of rule.metadata.requires.entityKinds as Array<{ kind?: string; subtype?: string }>) {
      if (ek.kind) {
        consumers.push({
          ruleId: rule.id,
          kind: ek.kind,
          subtype: ek.subtype,
        });
      }
    }
  }

  // From conditions
  for (const rawCond of rule.conditions) {
    const cond = asCondition(rawCond);
    if (!cond) continue;

    if (cond.type === 'entity_exists' || cond.type === 'entity_count_below') {
      const params = cond.params as { kind?: string; subtype?: string } | undefined;
      if (params?.kind) {
        consumers.push({
          ruleId: rule.id,
          kind: params.kind,
          subtype: params.subtype,
        });
      }
    }
  }

  return consumers;
}

/**
 * Extract relationship producers from metadata
 */
function extractRelationshipProducersFromMetadata(rule: AnyRule): RelationshipProducer[] {
  const producers: RelationshipProducer[] = [];

  if (rule.metadata?.produces?.relationships) {
    for (const rel of rule.metadata.produces.relationships as Array<{ kind?: string }>) {
      if (rel.kind) {
        producers.push({
          ruleId: rule.id,
          kind: rel.kind,
        });
      }
    }
  }

  return producers;
}

/**
 * Extract relationship consumers from metadata and conditions
 */
function extractRelationshipConsumersFromRule(rule: AnyRule): RelationshipConsumer[] {
  const consumers: RelationshipConsumer[] = [];

  if (rule.metadata?.requires?.relationships) {
    for (const rel of rule.metadata.requires.relationships as Array<{ kind?: string }>) {
      if (rel.kind) {
        consumers.push({
          ruleId: rule.id,
          kind: rel.kind,
        });
      }
    }
  }

  // From conditions
  for (const rawCond of rule.conditions) {
    const cond = asCondition(rawCond);
    if (!cond) continue;

    if (cond.type === 'relationship_exists' || cond.type === 'entity_has_relationship') {
      const params = cond.params as { kind?: string } | undefined;
      if (params?.kind) {
        consumers.push({
          ruleId: rule.id,
          kind: params.kind,
        });
      }
    }
  }

  return consumers;
}

/**
 * Extract tags consumed by a rule (from conditions)
 */
function extractTagConsumersFromRule(rule: AnyRule): TagConsumer[] {
  const consumers: TagConsumer[] = [];

  for (const rawCond of rule.conditions) {
    const cond = asCondition(rawCond);
    if (!cond) continue;

    if (cond.type === 'entity_exists') {
      const params = cond.params as { hasTag?: string } | undefined;
      if (params?.hasTag) {
        consumers.push({ ruleId: rule.id, tag: params.hasTag });
      }
    }
  }

  return consumers;
}

/**
 * Extract pressure effects from metadata
 */
function extractPressureEffectsFromMetadata(
  rule: AnyRule,
  pressureId: string
): { isSource: boolean; isSink: boolean; delta: number } {
  // The metadata doesn't directly contain pressure effects in the StaticAnalysisInput
  // but we can check if there are pressure requirements
  if (rule.metadata?.requires?.pressures) {
    for (const p of rule.metadata.requires.pressures as Array<{ name?: string; range?: { min?: number; max?: number } }>) {
      if (p.name === pressureId) {
        // This rule depends on pressure but doesn't affect it
        return { isSource: false, isSink: false, delta: 0 };
      }
    }
  }

  return { isSource: false, isSink: false, delta: 0 };
}

// ============================================================================
// ANALYSIS FUNCTIONS
// ============================================================================

/**
 * Analyze entity coverage: which rules create which entity kinds
 */
function analyzeEntityCoverage(
  input: StaticAnalysisInput,
  issues: StaticIssue[]
): StaticAnalysisReport['entityCoverage'] {
  const coverage: StaticAnalysisReport['entityCoverage'] = {};

  // Initialize from schema
  for (const entityKind of input.schema.entityKinds) {
    coverage[entityKind.kind] = {
      kind: entityKind.kind,
      subtypes: {},
    };
    for (const subtype of entityKind.subtypes) {
      coverage[entityKind.kind].subtypes[subtype] = {
        creators: [],
        consumers: [],
        status: 'missing_creator',
      };
    }
  }

  // Helper to add producer
  const addProducer = (producer: EntityProducer) => {
    if (!coverage[producer.kind]) {
      coverage[producer.kind] = { kind: producer.kind, subtypes: {} };
    }
    const subtype = producer.subtype || '_default';
    if (!coverage[producer.kind].subtypes[subtype]) {
      coverage[producer.kind].subtypes[subtype] = {
        creators: [],
        consumers: [],
        status: 'missing_creator',
      };
    }
    if (!coverage[producer.kind].subtypes[subtype].creators.includes(producer.ruleId)) {
      coverage[producer.kind].subtypes[subtype].creators.push(producer.ruleId);
    }
  };

  // Helper to add consumer
  const addConsumer = (consumer: EntityConsumer) => {
    if (!coverage[consumer.kind]) {
      coverage[consumer.kind] = { kind: consumer.kind, subtypes: {} };
    }
    const subtype = consumer.subtype || '_default';
    if (!coverage[consumer.kind].subtypes[subtype]) {
      coverage[consumer.kind].subtypes[subtype] = {
        creators: [],
        consumers: [],
        status: 'missing_creator',
      };
    }
    if (!coverage[consumer.kind].subtypes[subtype].consumers.includes(consumer.ruleId)) {
      coverage[consumer.kind].subtypes[subtype].consumers.push(consumer.ruleId);
    }
  };

  // Analyze generation rules
  for (const rule of input.simulation.generationRules) {
    for (const producer of extractEntityProducersFromMetadata(rule)) {
      addProducer(producer);
    }
    for (const consumer of extractEntityConsumersFromRule(rule)) {
      addConsumer(consumer);
    }
  }

  // Analyze simulation rules
  for (const rule of input.simulation.simulationRules) {
    for (const producer of extractEntityProducersFromMetadata(rule)) {
      addProducer(producer);
    }
    for (const consumer of extractEntityConsumersFromRule(rule)) {
      addConsumer(consumer);
    }
  }

  // Determine status and collect issues
  for (const [kindId, kindData] of Object.entries(coverage)) {
    for (const [subtype, subtypeData] of Object.entries(kindData.subtypes)) {
      const hasCreators = subtypeData.creators.length > 0;
      const hasConsumers = subtypeData.consumers.length > 0;

      if (hasCreators && hasConsumers) {
        subtypeData.status = 'covered';
      } else if (hasCreators && !hasConsumers) {
        subtypeData.status = 'orphan_creator';
        issues.push({
          id: `entity_orphan_${kindId}_${subtype}`,
          severity: 'info',
          category: 'entity_coverage',
          message: `Entity ${kindId}:${subtype} is created but never required`,
          details: `Created by: ${subtypeData.creators.join(', ')}`,
          affectedComponents: subtypeData.creators,
        });
      } else if (!hasCreators && hasConsumers) {
        subtypeData.status = 'missing_creator';
        issues.push({
          id: `entity_missing_${kindId}_${subtype}`,
          severity: 'critical',
          category: 'entity_coverage',
          message: `Entity ${kindId}:${subtype} is required but never created`,
          details: `Required by: ${subtypeData.consumers.join(', ')}`,
          affectedComponents: subtypeData.consumers,
          suggestion: `Add a generation rule that creates ${kindId}:${subtype}`,
        });
      } else {
        subtypeData.status = 'missing_creator';
      }
    }
  }

  return coverage;
}

/**
 * Analyze relationship coverage
 */
function analyzeRelationshipCoverage(
  input: StaticAnalysisInput,
  issues: StaticIssue[]
): StaticAnalysisReport['relationshipCoverage'] {
  const coverage: StaticAnalysisReport['relationshipCoverage'] = {};

  // Initialize from schema
  for (const relKind of input.schema.relationshipKinds) {
    coverage[relKind.kind] = {
      kind: relKind.kind,
      creators: [],
      consumers: [],
      status: 'missing_creator',
    };
  }

  // Helper to add producer
  const addProducer = (producer: RelationshipProducer) => {
    if (!coverage[producer.kind]) {
      coverage[producer.kind] = {
        kind: producer.kind,
        creators: [],
        consumers: [],
        status: 'missing_creator',
      };
    }
    if (!coverage[producer.kind].creators.includes(producer.ruleId)) {
      coverage[producer.kind].creators.push(producer.ruleId);
    }
  };

  // Helper to add consumer
  const addConsumer = (consumer: RelationshipConsumer) => {
    if (!coverage[consumer.kind]) {
      coverage[consumer.kind] = {
        kind: consumer.kind,
        creators: [],
        consumers: [],
        status: 'missing_creator',
      };
    }
    if (!coverage[consumer.kind].consumers.includes(consumer.ruleId)) {
      coverage[consumer.kind].consumers.push(consumer.ruleId);
    }
  };

  // Analyze generation rules
  for (const rule of input.simulation.generationRules) {
    for (const producer of extractRelationshipProducersFromMetadata(rule)) {
      addProducer(producer);
    }
    for (const consumer of extractRelationshipConsumersFromRule(rule)) {
      addConsumer(consumer);
    }
  }

  // Analyze simulation rules
  for (const rule of input.simulation.simulationRules) {
    for (const producer of extractRelationshipProducersFromMetadata(rule)) {
      addProducer(producer);
    }
    for (const consumer of extractRelationshipConsumersFromRule(rule)) {
      addConsumer(consumer);
    }
  }

  // Determine status and collect issues
  for (const [kindId, data] of Object.entries(coverage)) {
    const hasCreators = data.creators.length > 0;
    const hasConsumers = data.consumers.length > 0;

    if (hasCreators && hasConsumers) {
      data.status = 'covered';
    } else if (hasCreators && !hasConsumers) {
      data.status = 'orphan_creator';
      issues.push({
        id: `rel_orphan_${kindId}`,
        severity: 'info',
        category: 'relationship_coverage',
        message: `Relationship ${kindId} is created but never queried`,
        details: `Created by: ${data.creators.join(', ')}`,
        affectedComponents: data.creators,
      });
    } else if (!hasCreators && hasConsumers) {
      data.status = 'missing_creator';
      issues.push({
        id: `rel_missing_${kindId}`,
        severity: 'warning',
        category: 'relationship_coverage',
        message: `Relationship ${kindId} is queried but never created`,
        details: `Queried by: ${data.consumers.join(', ')}`,
        affectedComponents: data.consumers,
        suggestion: `Add a rule that creates ${kindId} relationships`,
      });
    }
  }

  return coverage;
}

/**
 * Analyze pressure balance (sources and sinks from era drifts)
 */
function analyzePressureBalance(
  input: StaticAnalysisInput,
  issues: StaticIssue[]
): StaticAnalysisReport['pressureAnalysis'] {
  const analysis: StaticAnalysisReport['pressureAnalysis'] = {};

  // Initialize from pressure definitions
  for (const pressure of input.simulation.pressures) {
    analysis[pressure.id] = {
      name: pressure.name,
      sources: [],
      sinks: [],
      eraDrifts: [],
      equilibriumReachable: false,
      status: 'dormant',
    };
  }

  // Analyze era pressure drifts (these are our primary source of pressure changes)
  for (const [eraId, eraWeights] of Object.entries(input.simulation.eraRuleWeights)) {
    for (const [pressureId, drift] of Object.entries(eraWeights.pressureDrift)) {
      if (analysis[pressureId]) {
        analysis[pressureId].eraDrifts.push({ eraId, drift });
      }
    }
  }

  // Determine status and collect issues
  for (const [pressureId, data] of Object.entries(analysis)) {
    const hasSources = data.sources.length > 0;
    const hasSinks = data.sinks.length > 0;
    const hasPositiveDrift = data.eraDrifts.some((d) => d.drift > 0);
    const hasNegativeDrift = data.eraDrifts.some((d) => d.drift < 0);
    const hasDrift = hasPositiveDrift || hasNegativeDrift;

    if ((hasSources || hasPositiveDrift) && (hasSinks || hasNegativeDrift)) {
      data.status = 'balanced';
      data.equilibriumReachable = true;
    } else if (hasSources || hasPositiveDrift) {
      data.status = 'source_only';
      data.equilibriumReachable = false;
      issues.push({
        id: `pressure_no_sink_${pressureId}`,
        severity: 'warning',
        category: 'pressure',
        message: `Pressure ${data.name} only increases, never decreases`,
        details: `Era drifts: ${data.eraDrifts.map((d) => `${d.eraId}:${d.drift}`).join(', ') || 'none'}`,
        affectedComponents: [pressureId],
        suggestion: 'Add negative era drift or rule effects to balance',
      });
    } else if (hasSinks || hasNegativeDrift) {
      data.status = 'sink_only';
      data.equilibriumReachable = false;
      issues.push({
        id: `pressure_no_source_${pressureId}`,
        severity: 'warning',
        category: 'pressure',
        message: `Pressure ${data.name} only decreases, never increases`,
        details: `Era drifts: ${data.eraDrifts.map((d) => `${d.eraId}:${d.drift}`).join(', ') || 'none'}`,
        affectedComponents: [pressureId],
        suggestion: 'Add positive era drift or rule effects to balance',
      });
    } else {
      data.status = 'dormant';
      if (!hasDrift) {
        issues.push({
          id: `pressure_dormant_${pressureId}`,
          severity: 'info',
          category: 'pressure',
          message: `Pressure ${data.name} has no era drifts configured`,
          details: 'This pressure will remain at its initial value unless rules affect it',
          affectedComponents: [pressureId],
        });
      }
    }
  }

  return analysis;
}

/**
 * Analyze tag flow (produced vs consumed)
 */
function analyzeTagFlow(
  input: StaticAnalysisInput,
  issues: StaticIssue[]
): StaticAnalysisReport['tagFlow'] {
  const tagFlow: StaticAnalysisReport['tagFlow'] = {};

  // Helper to add producer
  const addProducer = (producer: TagProducer) => {
    if (!tagFlow[producer.tag]) {
      tagFlow[producer.tag] = { producers: [], consumers: [], status: 'unused' };
    }
    if (!tagFlow[producer.tag].producers.includes(producer.ruleId)) {
      tagFlow[producer.tag].producers.push(producer.ruleId);
    }
  };

  // Helper to add consumer
  const addConsumer = (consumer: TagConsumer) => {
    if (!tagFlow[consumer.tag]) {
      tagFlow[consumer.tag] = { producers: [], consumers: [], status: 'unused' };
    }
    if (!tagFlow[consumer.tag].consumers.includes(consumer.ruleId)) {
      tagFlow[consumer.tag].consumers.push(consumer.ruleId);
    }
  };

  // Analyze generation rules
  for (const rule of input.simulation.generationRules) {
    // Tags from metadata are the primary source
    if (rule.metadata?.tags) {
      for (const tag of rule.metadata.tags) {
        addProducer({ ruleId: rule.id, tag });
      }
    }
    for (const consumer of extractTagConsumersFromRule(rule)) {
      addConsumer(consumer);
    }
  }

  // Analyze simulation rules
  for (const rule of input.simulation.simulationRules) {
    if (rule.metadata?.tags) {
      for (const tag of rule.metadata.tags) {
        addProducer({ ruleId: rule.id, tag });
      }
    }
    for (const consumer of extractTagConsumersFromRule(rule)) {
      addConsumer(consumer);
    }
  }

  // Determine status and collect issues
  for (const [tag, data] of Object.entries(tagFlow)) {
    const hasProducers = data.producers.length > 0;
    const hasConsumers = data.consumers.length > 0;

    if (hasProducers && hasConsumers) {
      data.status = 'flowing';
    } else if (hasProducers && !hasConsumers) {
      data.status = 'unused';
      issues.push({
        id: `tag_unused_${tag}`,
        severity: 'info',
        category: 'tag_flow',
        message: `Tag '${tag}' is produced but never consumed`,
        details: `Produced by: ${data.producers.join(', ')}`,
        affectedComponents: data.producers,
      });
    } else if (!hasProducers && hasConsumers) {
      data.status = 'orphan';
      issues.push({
        id: `tag_orphan_${tag}`,
        severity: 'warning',
        category: 'tag_flow',
        message: `Tag '${tag}' is required but never produced`,
        details: `Required by: ${data.consumers.join(', ')}`,
        affectedComponents: data.consumers,
        suggestion: `Add a rule that produces entities with tag '${tag}'`,
      });
    }
  }

  return tagFlow;
}

/**
 * Analyze era completeness
 */
function analyzeEras(
  input: StaticAnalysisInput,
  issues: StaticIssue[]
): StaticAnalysisReport['eraAnalysis'] {
  const eraAnalysis: StaticAnalysisReport['eraAnalysis'] = {};

  for (const era of input.eras) {
    const eraWeights = input.simulation.eraRuleWeights[era.id];

    const activeGenerationRules: string[] = [];
    const activeSimulationRules: string[] = [];
    const warnings: string[] = [];

    if (eraWeights) {
      // Find active generation rules
      for (const [ruleId, weight] of Object.entries(eraWeights.generationWeights)) {
        if (weight > 0) {
          activeGenerationRules.push(ruleId);
        }
      }

      // Find active simulation rules
      for (const [ruleId, weight] of Object.entries(eraWeights.simulationWeights)) {
        if (weight > 0) {
          activeSimulationRules.push(ruleId);
        }
      }
    }

    // Check for entity creation in this era
    const hasEntityCreation = activeGenerationRules.some((ruleId) => {
      const rule = input.simulation.generationRules.find((r) => r.id === ruleId);
      return rule && extractEntityProducersFromMetadata(rule).length > 0;
    });

    // Check for relationship creation
    const hasRelationshipCreation =
      activeGenerationRules.some((ruleId) => {
        const rule = input.simulation.generationRules.find((r) => r.id === ruleId);
        return rule && extractRelationshipProducersFromMetadata(rule).length > 0;
      }) ||
      activeSimulationRules.some((ruleId) => {
        const rule = input.simulation.simulationRules.find((r) => r.id === ruleId);
        return rule && extractRelationshipProducersFromMetadata(rule).length > 0;
      });

    // Check for any simulation activity
    const hasSimulationActivity = activeSimulationRules.length > 0;

    // Generate warnings
    if (!hasEntityCreation && activeGenerationRules.length === 0) {
      warnings.push('No generation rules active in this era');
      issues.push({
        id: `era_no_generation_${era.id}`,
        severity: 'warning',
        category: 'era',
        message: `Era '${era.name}' has no active generation rules`,
        details: 'No entities will be created during this era',
        affectedComponents: [era.id],
        suggestion: 'Add generation rule weights for this era',
      });
    }

    if (!hasSimulationActivity) {
      warnings.push('No simulation rules active in this era');
      issues.push({
        id: `era_no_simulation_${era.id}`,
        severity: 'info',
        category: 'era',
        message: `Era '${era.name}' has no active simulation rules`,
        details: 'Entity relationships will not evolve during this era',
        affectedComponents: [era.id],
      });
    }

    eraAnalysis[era.id] = {
      name: era.name,
      activeGenerationRules,
      activeSimulationRules,
      coverage: {
        hasEntityCreation,
        hasRelationshipCreation,
        hasSimulationActivity,
      },
      warnings,
    };
  }

  return eraAnalysis;
}

/**
 * Validate declared feedback loops
 */
function validateFeedbackLoops(
  input: StaticAnalysisInput,
  issues: StaticIssue[]
): StaticAnalysisReport['feedbackLoops'] {
  const feedbackLoops: StaticAnalysisReport['feedbackLoops'] = {};

  const allRuleIds = new Set([
    ...input.simulation.generationRules.map((r) => r.id),
    ...input.simulation.simulationRules.map((r) => r.id),
  ]);
  const allPressureIds = new Set(input.simulation.pressures.map((p) => p.id));

  for (const loop of input.simulation.feedbackLoops || []) {
    const loopIssues: string[] = [];
    const path: string[] = [];
    let status: 'valid' | 'broken' | 'weak' = 'valid';

    // Validate each component in the chain
    for (const rawStep of loop.chain) {
      const step = rawStep as { component?: string; effect?: string };
      if (!step.component) continue;

      path.push(step.component);

      const isRule = allRuleIds.has(step.component);
      const isPressure = allPressureIds.has(step.component);

      if (!isRule && !isPressure) {
        loopIssues.push(`Component '${step.component}' not found`);
        status = 'broken';
      }
    }

    // Check if the loop actually closes
    if (loop.chain.length < 2) {
      loopIssues.push('Feedback loop must have at least 2 components');
      status = 'broken';
    }

    if (status === 'broken') {
      issues.push({
        id: `feedback_broken_${loop.id}`,
        severity: 'critical',
        category: 'feedback_loop',
        message: `Feedback loop '${loop.id}' has broken references`,
        details: loopIssues.join('; '),
        affectedComponents: path,
        suggestion: 'Fix component references in the feedback loop declaration',
      });
    }

    feedbackLoops[loop.id] = {
      description: loop.description,
      path,
      status,
      issues: loopIssues,
    };
  }

  return feedbackLoops;
}

/**
 * Calculate summary metrics
 */
function calculateSummary(issues: StaticIssue[]): StaticAnalysisReport['summary'] {
  const criticalIssues = issues.filter((i) => i.severity === 'critical').length;
  const warnings = issues.filter((i) => i.severity === 'warning').length;
  const totalIssues = issues.length;

  // Calculate health score (0-100)
  // Critical issues have heavy penalty, warnings have moderate penalty
  const criticalPenalty = criticalIssues * 15;
  const warningPenalty = warnings * 5;
  const healthScore = Math.max(0, 100 - criticalPenalty - warningPenalty);

  return {
    totalIssues,
    criticalIssues,
    warnings,
    healthScore,
  };
}

// ============================================================================
// MAIN EXPORT
// ============================================================================

/**
 * Analyze simulation configuration statically (design time).
 *
 * This is Phase 1 of the two-phase coherence model.
 */
export function analyzeStatic(input: StaticAnalysisInput): StaticAnalysisReport {
  const issues: StaticIssue[] = [];

  const entityCoverage = analyzeEntityCoverage(input, issues);
  const relationshipCoverage = analyzeRelationshipCoverage(input, issues);
  const pressureAnalysis = analyzePressureBalance(input, issues);
  const tagFlow = analyzeTagFlow(input, issues);
  const eraAnalysis = analyzeEras(input, issues);
  const feedbackLoops = validateFeedbackLoops(input, issues);
  const summary = calculateSummary(issues);

  return {
    analyzedAt: new Date().toISOString(),
    entityCoverage,
    relationshipCoverage,
    pressureAnalysis,
    tagFlow,
    eraAnalysis,
    feedbackLoops,
    summary,
    issues,
  };
}

/**
 * Validate that input structure is complete
 */
export function validateStaticInput(input: unknown): input is StaticAnalysisInput {
  if (!input || typeof input !== 'object') return false;

  const i = input as Record<string, unknown>;

  return (
    i.schema !== null &&
    typeof i.schema === 'object' &&
    Array.isArray(i.eras) &&
    i.simulation !== null &&
    typeof i.simulation === 'object'
  );
}
