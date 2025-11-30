/**
 * Coherence Analyzer
 *
 * Analyzes CoherenceMetadata to detect structural issues in simulation configurations.
 * Works purely with static metadata - no runtime simulation required.
 */

import type {
  CoherenceMetadata,
  CoherenceReport,
  EntityCoverageReport,
  TagFlowReport,
  RelationshipFlowReport,
  PressureEquilibriumReport,
  FeedbackLoopValidationReport,
  ParameterRecommendation
} from './types.js';

/**
 * Analyze entity coverage - which templates create which entity kinds
 */
function analyzeEntityCoverage(metadata: CoherenceMetadata): EntityCoverageReport {
  const byKind: EntityCoverageReport['byKind'] = {};
  const schemaKinds = new Set(metadata.schema.entityKinds.map(ek => ek.kind));

  // Initialize all schema-defined kinds
  for (const entityKind of metadata.schema.entityKinds) {
    for (const subtype of entityKind.subtypes) {
      const key = `${entityKind.kind}:${subtype}`;
      byKind[key] = {
        target: 0,
        actualCreators: 0,
        creators: [],
        modifiers: [],
        status: 'uncreated',
        issues: []
      };
    }
    // Also track the kind itself without subtype
    byKind[entityKind.kind] = {
      target: 0,
      actualCreators: 0,
      creators: [],
      modifiers: [],
      status: 'uncreated',
      issues: []
    };
  }

  // Analyze templates that create entities
  for (const template of metadata.templates) {
    for (const produces of template.produces.entityKinds) {
      const key = produces.subtype ? `${produces.kind}:${produces.subtype}` : produces.kind;

      if (!byKind[key]) {
        byKind[key] = {
          target: 0,
          actualCreators: 0,
          creators: [],
          modifiers: [],
          status: 'uncreated',
          issues: []
        };
      }

      byKind[key].creators.push({
        templateId: template.id,
        expectedCount: produces.count,
        primary: byKind[key].creators.length === 0 // First creator is primary
      });
      byKind[key].actualCreators++;
    }
  }

  // Analyze entity registries for target counts
  for (const registry of metadata.entityRegistries) {
    const key = registry.subtype ? `${registry.kind}:${registry.subtype}` : registry.kind;
    if (byKind[key]) {
      byKind[key].target = registry.expectedDistribution.targetCount;

      // Mark primary creators from registry
      for (const creator of registry.creators) {
        const existingCreator = byKind[key].creators.find(c => c.templateId === creator.templateId);
        if (existingCreator) {
          existingCreator.primary = creator.primary;
        }
      }
    }
  }

  // Analyze systems that modify entities
  for (const system of metadata.systems) {
    if (system.affects?.entities) {
      for (const affected of system.affects.entities) {
        if (affected.operation === 'modify') {
          const key = affected.subtype ? `${affected.kind}:${affected.subtype}` : affected.kind;
          if (byKind[key]) {
            byKind[key].modifiers.push({
              systemId: system.id,
              operation: affected.operation
            });
          }
        }
      }
    }
  }

  // Determine status for each kind
  for (const [key, data] of Object.entries(byKind)) {
    if (data.actualCreators === 0) {
      data.status = 'uncreated';
      if (schemaKinds.has(key.split(':')[0])) {
        data.issues.push(`No template creates ${key}`);
      }
    } else if (data.target > 0 && data.actualCreators > data.target * 0.5) {
      data.status = 'over-served';
      data.issues.push(`${data.actualCreators} creators for target of ${data.target}`);
    } else if (data.target > 0 && data.actualCreators < Math.ceil(data.target / 10)) {
      data.status = 'under-served';
      data.issues.push(`Only ${data.actualCreators} creator(s) for target of ${data.target}`);
    } else {
      data.status = 'healthy';
    }
  }

  // Calculate summary
  const values = Object.values(byKind);
  return {
    byKind,
    summary: {
      totalKinds: values.length,
      healthyKinds: values.filter(v => v.status === 'healthy').length,
      underServedKinds: values.filter(v => v.status === 'under-served').length,
      overServedKinds: values.filter(v => v.status === 'over-served').length,
      uncreatedKinds: values.filter(v => v.status === 'uncreated').length
    }
  };
}

/**
 * Analyze tag flow - which components produce and consume tags
 */
function analyzeTagFlow(metadata: CoherenceMetadata): TagFlowReport {
  const byTag: TagFlowReport['byTag'] = {};

  // Initialize from tag registry
  for (const tagInfo of metadata.tagRegistry) {
    byTag[tagInfo.tag] = {
      category: tagInfo.category,
      rarity: tagInfo.rarity,
      producers: [],
      consumers: [],
      status: 'unused',
      issues: []
    };
  }

  // Find tag producers from templates
  for (const template of metadata.templates) {
    for (const tag of template.analysis.tagsProduced) {
      if (!byTag[tag]) {
        byTag[tag] = {
          category: 'unknown',
          rarity: 'unknown',
          producers: [],
          consumers: [],
          status: 'unused',
          issues: []
        };
      }
      byTag[tag].producers.push({
        componentId: template.id,
        componentType: 'template'
      });
    }

    // Tags consumed by templates
    for (const tag of template.analysis.tagsConsumed) {
      if (!byTag[tag]) {
        byTag[tag] = {
          category: 'unknown',
          rarity: 'unknown',
          producers: [],
          consumers: [],
          status: 'unused',
          issues: []
        };
      }
      byTag[tag].consumers.push({
        componentId: template.id,
        componentType: 'template'
      });
    }
  }

  // Find tag producers/consumers from systems
  for (const system of metadata.systems) {
    for (const tag of system.analysis.tagsProduced) {
      if (!byTag[tag]) {
        byTag[tag] = {
          category: 'unknown',
          rarity: 'unknown',
          producers: [],
          consumers: [],
          status: 'unused',
          issues: []
        };
      }
      byTag[tag].producers.push({
        componentId: system.id,
        componentType: 'system'
      });
    }

    for (const tag of system.analysis.tagsConsumed) {
      if (!byTag[tag]) {
        byTag[tag] = {
          category: 'unknown',
          rarity: 'unknown',
          producers: [],
          consumers: [],
          status: 'unused',
          issues: []
        };
      }
      byTag[tag].consumers.push({
        componentId: system.id,
        componentType: 'system'
      });
    }
  }

  // Determine status for each tag
  const orphanList: string[] = [];
  const unusedList: string[] = [];

  for (const [tag, data] of Object.entries(byTag)) {
    const hasProducers = data.producers.length > 0;
    const hasConsumers = data.consumers.length > 0;

    if (!hasProducers && hasConsumers) {
      data.status = 'orphan';
      data.issues.push('Tag is consumed but never produced');
      orphanList.push(tag);
    } else if (hasProducers && !hasConsumers) {
      data.status = 'unused';
      data.issues.push('Tag is produced but never consumed');
      unusedList.push(tag);
    } else if (hasProducers && data.producers.length > 5) {
      data.status = 'over-produced';
      data.issues.push(`Tag is produced by ${data.producers.length} components`);
    } else if (hasProducers && hasConsumers) {
      data.status = 'healthy';
    }
  }

  const values = Object.values(byTag);
  return {
    byTag,
    summary: {
      totalTags: values.length,
      healthyTags: values.filter(v => v.status === 'healthy').length,
      orphanTags: values.filter(v => v.status === 'orphan').length,
      unusedTags: values.filter(v => v.status === 'unused').length,
      overProducedTags: values.filter(v => v.status === 'over-produced').length
    },
    orphanList,
    unusedList
  };
}

/**
 * Analyze relationship flow - which components create and consume relationships
 */
function analyzeRelationshipFlow(metadata: CoherenceMetadata): RelationshipFlowReport {
  const byKind: RelationshipFlowReport['byKind'] = {};

  // Initialize from schema
  for (const relKind of metadata.schema.relationshipKinds) {
    byKind[relKind.kind] = {
      category: relKind.category,
      producers: [],
      consumers: [],
      status: 'unused',
      issues: []
    };
  }

  // Find producers from templates
  for (const template of metadata.templates) {
    for (const rel of template.produces.relationships) {
      if (!byKind[rel.kind]) {
        byKind[rel.kind] = {
          category: rel.category || 'unknown',
          producers: [],
          consumers: [],
          status: 'unused',
          issues: []
        };
      }
      byKind[rel.kind].producers.push({
        componentId: template.id,
        componentType: 'template',
        probability: rel.probability
      });
    }

    for (const relKind of template.analysis.relationshipsCreated) {
      if (!byKind[relKind]) {
        byKind[relKind] = {
          category: 'unknown',
          producers: [],
          consumers: [],
          status: 'unused',
          issues: []
        };
      }
      // Only add if not already added
      if (!byKind[relKind].producers.some(p => p.componentId === template.id)) {
        byKind[relKind].producers.push({
          componentId: template.id,
          componentType: 'template'
        });
      }
    }
  }

  // Find producers from systems
  for (const system of metadata.systems) {
    for (const rel of system.produces.relationships) {
      if (!byKind[rel.kind]) {
        byKind[rel.kind] = {
          category: rel.category || 'unknown',
          producers: [],
          consumers: [],
          status: 'unused',
          issues: []
        };
      }
      byKind[rel.kind].producers.push({
        componentId: system.id,
        componentType: 'system',
        frequency: rel.frequency
      });
    }

    for (const relKind of system.analysis.relationshipsCreated) {
      if (!byKind[relKind]) {
        byKind[relKind] = {
          category: 'unknown',
          producers: [],
          consumers: [],
          status: 'unused',
          issues: []
        };
      }
      if (!byKind[relKind].producers.some(p => p.componentId === system.id)) {
        byKind[relKind].producers.push({
          componentId: system.id,
          componentType: 'system'
        });
      }
    }

    // Find consumers from systems
    for (const relKind of system.analysis.relationshipsConsumed) {
      if (!byKind[relKind]) {
        byKind[relKind] = {
          category: 'unknown',
          producers: [],
          consumers: [],
          status: 'unused',
          issues: []
        };
      }
      byKind[relKind].consumers.push({
        componentId: system.id,
        componentType: 'system',
        usage: 'query'
      });
    }
  }

  // Determine status
  const orphanList: string[] = [];
  const unusedList: string[] = [];

  for (const [kind, data] of Object.entries(byKind)) {
    const hasProducers = data.producers.length > 0;
    const hasConsumers = data.consumers.length > 0;

    if (!hasProducers && hasConsumers) {
      data.status = 'orphan';
      data.issues.push('Relationship is queried but never created');
      orphanList.push(kind);
    } else if (hasProducers && !hasConsumers) {
      data.status = 'unused';
      data.issues.push('Relationship is created but never queried');
      unusedList.push(kind);
    } else if (hasProducers && data.producers.length > 10) {
      data.status = 'over-created';
      data.issues.push(`Relationship created by ${data.producers.length} components`);
    } else if (hasProducers && hasConsumers) {
      data.status = 'healthy';
    }
  }

  const values = Object.values(byKind);
  return {
    byKind,
    summary: {
      totalRelationshipKinds: values.length,
      healthyKinds: values.filter(v => v.status === 'healthy').length,
      orphanKinds: values.filter(v => v.status === 'orphan').length,
      unusedKinds: values.filter(v => v.status === 'unused').length,
      overCreatedKinds: values.filter(v => v.status === 'over-created').length
    },
    orphanList,
    unusedList
  };
}

/**
 * Analyze pressure equilibrium - do pressures have sources and sinks?
 */
function analyzePressureEquilibrium(metadata: CoherenceMetadata): PressureEquilibriumReport {
  const byPressure: PressureEquilibriumReport['byPressure'] = {};

  for (const pressure of metadata.pressures) {
    const hasSources = pressure.sources.length > 0;
    const hasSinks = pressure.sinks.length > 0;

    let status: 'healthy' | 'no-sources' | 'no-sinks' | 'out-of-range' = 'healthy';
    const issues: string[] = [];

    if (!hasSources) {
      status = 'no-sources';
      issues.push('Pressure has no sources - will only decay');
    }

    if (!hasSinks && pressure.decay === 0) {
      status = 'no-sinks';
      issues.push('Pressure has no sinks or decay - may grow unbounded');
    }

    // Check if initial value is within expected range
    if (pressure.initialValue < pressure.equilibrium.expectedRange[0] ||
        pressure.initialValue > pressure.equilibrium.expectedRange[1]) {
      if (status === 'healthy') status = 'out-of-range';
      issues.push(`Initial value ${pressure.initialValue} outside expected range [${pressure.equilibrium.expectedRange[0]}, ${pressure.equilibrium.expectedRange[1]}]`);
    }

    byPressure[pressure.id] = {
      currentValue: pressure.initialValue,
      expectedRange: pressure.equilibrium.expectedRange,
      predictedEquilibrium: pressure.equilibrium.restingPoint,
      sources: pressure.sources,
      sinks: pressure.sinks,
      status,
      issues
    };
  }

  const values = Object.values(byPressure);
  return {
    byPressure,
    summary: {
      totalPressures: values.length,
      healthyPressures: values.filter(v => v.status === 'healthy').length,
      pressuresWithoutSources: values.filter(v => v.status === 'no-sources').length,
      pressuresWithoutSinks: values.filter(v => v.status === 'no-sinks').length,
      pressuresOutOfRange: values.filter(v => v.status === 'out-of-range').length
    }
  };
}

/**
 * Validate feedback loops - are declared loops structurally valid?
 */
function validateFeedbackLoops(metadata: CoherenceMetadata): FeedbackLoopValidationReport {
  const byLoop: FeedbackLoopValidationReport['byLoop'] = {};

  const templateIds = new Set(metadata.templates.map(t => t.id));
  const systemIds = new Set(metadata.systems.map(s => s.id));
  const pressureIds = new Set(metadata.pressures.map(p => p.id));

  for (const loop of metadata.feedbackLoops) {
    const issues: string[] = [];
    const recommendations: string[] = [];
    let status: 'healthy' | 'broken' | 'weak' | 'inverted' | 'untested' = 'untested';

    // Check if source exists
    const sourceExists = templateIds.has(loop.source) ||
                         systemIds.has(loop.source) ||
                         pressureIds.has(loop.source);
    if (!sourceExists) {
      status = 'broken';
      issues.push(`Source '${loop.source}' not found in templates, systems, or pressures`);
    }

    // Check if target exists
    const targetExists = templateIds.has(loop.target) ||
                         systemIds.has(loop.target) ||
                         pressureIds.has(loop.target);
    if (!targetExists) {
      status = 'broken';
      issues.push(`Target '${loop.target}' not found in templates, systems, or pressures`);
    }

    // Check mechanism components
    for (const component of loop.mechanism) {
      const componentExists = templateIds.has(component) ||
                              systemIds.has(component) ||
                              pressureIds.has(component);
      if (!componentExists) {
        if (status !== 'broken') status = 'weak';
        issues.push(`Mechanism component '${component}' not found`);
      }
    }

    // Check strength validity
    if (loop.strength < 0.1) {
      if (status === 'untested') status = 'weak';
      recommendations.push('Consider increasing loop strength for noticeable effect');
    }

    if (issues.length === 0 && status === 'untested') {
      status = 'healthy';
    }

    byLoop[loop.id] = {
      type: loop.type,
      source: loop.source,
      target: loop.target,
      declaredStrength: loop.strength,
      status,
      issues,
      recommendations
    };
  }

  const values = Object.values(byLoop);
  return {
    byLoop,
    summary: {
      totalLoops: values.length,
      healthyLoops: values.filter(v => v.status === 'healthy').length,
      brokenLoops: values.filter(v => v.status === 'broken').length,
      weakLoops: values.filter(v => v.status === 'weak').length,
      invertedLoops: values.filter(v => v.status === 'inverted').length,
      untestedLoops: values.filter(v => v.status === 'untested').length
    }
  };
}

/**
 * Generate parameter recommendations based on analysis
 */
function generateRecommendations(
  entityCoverage: EntityCoverageReport,
  tagFlow: TagFlowReport,
  relationshipFlow: RelationshipFlowReport,
  pressureEquilibrium: PressureEquilibriumReport,
  _feedbackLoops: FeedbackLoopValidationReport
): ParameterRecommendation[] {
  const recommendations: ParameterRecommendation[] = [];

  // Recommend adjustments for under-served entity kinds
  for (const [kind, data] of Object.entries(entityCoverage.byKind)) {
    if (data.status === 'under-served' && data.creators.length > 0) {
      const creator = data.creators[0];
      recommendations.push({
        componentId: creator.templateId,
        componentType: 'template',
        parameter: 'entityCount.max',
        currentValue: creator.expectedCount.max,
        recommendedValue: Math.ceil(creator.expectedCount.max * 1.5),
        reason: `Entity kind '${kind}' is under-served`,
        confidence: 'medium',
        impact: [`Increase ${kind} population by ~50%`]
      });
    }
  }

  // Recommend pressure adjustments
  for (const [pressureId, data] of Object.entries(pressureEquilibrium.byPressure)) {
    if (data.status === 'out-of-range') {
      recommendations.push({
        componentId: pressureId,
        componentType: 'pressure',
        parameter: 'initialValue',
        currentValue: data.currentValue,
        recommendedValue: data.predictedEquilibrium,
        reason: `Initial value outside expected range`,
        confidence: 'high',
        impact: ['Faster convergence to equilibrium']
      });
    }
  }

  void tagFlow;
  void relationshipFlow;

  return recommendations;
}

/**
 * Calculate health scores for each category
 */
function calculateHealthScores(
  entityCoverage: EntityCoverageReport,
  tagFlow: TagFlowReport,
  relationshipFlow: RelationshipFlowReport,
  pressureEquilibrium: PressureEquilibriumReport,
  feedbackLoops: FeedbackLoopValidationReport
): CoherenceReport['healthScore'] {
  const entityScore = entityCoverage.summary.totalKinds > 0
    ? entityCoverage.summary.healthyKinds / entityCoverage.summary.totalKinds
    : 1;

  const tagScore = tagFlow.summary.totalTags > 0
    ? tagFlow.summary.healthyTags / tagFlow.summary.totalTags
    : 1;

  const relScore = relationshipFlow.summary.totalRelationshipKinds > 0
    ? relationshipFlow.summary.healthyKinds / relationshipFlow.summary.totalRelationshipKinds
    : 1;

  const pressureScore = pressureEquilibrium.summary.totalPressures > 0
    ? pressureEquilibrium.summary.healthyPressures / pressureEquilibrium.summary.totalPressures
    : 1;

  const loopScore = feedbackLoops.summary.totalLoops > 0
    ? feedbackLoops.summary.healthyLoops / feedbackLoops.summary.totalLoops
    : 1;

  // Weighted average - entity and tag coverage are most important
  const overall = (
    entityScore * 0.25 +
    tagScore * 0.25 +
    relScore * 0.2 +
    pressureScore * 0.15 +
    loopScore * 0.15
  );

  return {
    overall: Math.round(overall * 100) / 100,
    entityCoverage: Math.round(entityScore * 100) / 100,
    tagCoherence: Math.round(tagScore * 100) / 100,
    relationshipFlow: Math.round(relScore * 100) / 100,
    pressureBalance: Math.round(pressureScore * 100) / 100,
    feedbackLoops: Math.round(loopScore * 100) / 100
  };
}

/**
 * Collect critical issues from all analyses
 */
function collectCriticalIssues(
  entityCoverage: EntityCoverageReport,
  tagFlow: TagFlowReport,
  relationshipFlow: RelationshipFlowReport,
  pressureEquilibrium: PressureEquilibriumReport,
  feedbackLoops: FeedbackLoopValidationReport
): CoherenceReport['criticalIssues'] {
  const issues: CoherenceReport['criticalIssues'] = [];

  // Entity coverage issues
  for (const [kind, data] of Object.entries(entityCoverage.byKind)) {
    if (data.status === 'uncreated' && data.issues.length > 0) {
      issues.push({
        category: 'entity-coverage',
        severity: 'error',
        message: `Entity kind '${kind}' has no creator template`,
        affectedComponents: [],
        suggestedFix: 'Create a template that produces this entity kind'
      });
    }
  }

  // Tag flow issues
  for (const tag of tagFlow.orphanList) {
    issues.push({
      category: 'tag-flow',
      severity: 'error',
      message: `Tag '${tag}' is consumed but never produced`,
      affectedComponents: tagFlow.byTag[tag]?.consumers.map(c => c.componentId) || [],
      suggestedFix: 'Add a template or system that produces this tag'
    });
  }

  // Relationship flow issues
  for (const kind of relationshipFlow.orphanList) {
    issues.push({
      category: 'relationship-flow',
      severity: 'warning',
      message: `Relationship '${kind}' is queried but never created`,
      affectedComponents: relationshipFlow.byKind[kind]?.consumers.map(c => c.componentId) || [],
      suggestedFix: 'Add a template or system that creates this relationship'
    });
  }

  // Pressure issues
  for (const [pressureId, data] of Object.entries(pressureEquilibrium.byPressure)) {
    if (data.status === 'no-sources') {
      issues.push({
        category: 'pressure-equilibrium',
        severity: 'warning',
        message: `Pressure '${pressureId}' has no sources`,
        affectedComponents: [pressureId],
        suggestedFix: 'Add a component that increases this pressure'
      });
    }
  }

  // Feedback loop issues
  for (const [loopId, data] of Object.entries(feedbackLoops.byLoop)) {
    if (data.status === 'broken') {
      issues.push({
        category: 'feedback-loops',
        severity: 'error',
        message: `Feedback loop '${loopId}' has broken references`,
        affectedComponents: [data.source, data.target],
        suggestedFix: data.issues.join('; ')
      });
    }
  }

  return issues;
}

/**
 * Main analysis function - analyzes CoherenceMetadata and returns a full report
 */
export function analyzeCoherence(metadata: CoherenceMetadata): CoherenceReport {
  const entityCoverage = analyzeEntityCoverage(metadata);
  const tagFlow = analyzeTagFlow(metadata);
  const relationshipFlow = analyzeRelationshipFlow(metadata);
  const pressureEquilibrium = analyzePressureEquilibrium(metadata);
  const feedbackLoopValidation = validateFeedbackLoops(metadata);

  const healthScore = calculateHealthScores(
    entityCoverage,
    tagFlow,
    relationshipFlow,
    pressureEquilibrium,
    feedbackLoopValidation
  );

  const recommendations = generateRecommendations(
    entityCoverage,
    tagFlow,
    relationshipFlow,
    pressureEquilibrium,
    feedbackLoopValidation
  );

  const criticalIssues = collectCriticalIssues(
    entityCoverage,
    tagFlow,
    relationshipFlow,
    pressureEquilibrium,
    feedbackLoopValidation
  );

  return {
    analyzedAt: new Date().toISOString(),
    domainId: metadata.domainId,
    entityCoverage,
    tagFlow,
    relationshipFlow,
    pressureEquilibrium,
    feedbackLoopValidation,
    healthScore,
    recommendations,
    criticalIssues
  };
}

/**
 * Validate that metadata structure is complete
 */
export function validateMetadata(metadata: unknown): metadata is CoherenceMetadata {
  if (!metadata || typeof metadata !== 'object') return false;

  const m = metadata as Record<string, unknown>;

  return (
    typeof m.domainId === 'string' &&
    typeof m.domainVersion === 'string' &&
    Array.isArray(m.templates) &&
    Array.isArray(m.systems) &&
    Array.isArray(m.pressures) &&
    Array.isArray(m.feedbackLoops) &&
    Array.isArray(m.tagRegistry) &&
    Array.isArray(m.entityRegistries) &&
    Array.isArray(m.eras) &&
    m.schema !== null &&
    typeof m.schema === 'object'
  );
}
