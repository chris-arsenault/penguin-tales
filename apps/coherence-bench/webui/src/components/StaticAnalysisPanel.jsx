/**
 * StaticAnalysisPanel - Live static analysis feedback
 *
 * This component runs static analysis on the simulation config
 * and displays issues inline as the user edits rules.
 *
 * Note: This is a simplified in-browser implementation that doesn't
 * require importing the coherence-bench library. It performs basic
 * coverage analysis to provide quick feedback during editing.
 */

import React, { useMemo } from 'react';
import { colors, typography, spacing, radius } from '../theme.js';

const styles = {
  container: {
    backgroundColor: colors.bgSecondary,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.xl,
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: typography.sizeSm,
    fontWeight: typography.weightSemibold,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  healthScore: {
    fontSize: typography.sizeMd,
    fontWeight: typography.weightSemibold,
  },
  healthGood: {
    color: colors.success,
  },
  healthWarning: {
    color: colors.warning,
  },
  healthCritical: {
    color: colors.danger,
  },
  issues: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.xs,
  },
  issue: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.sm,
    fontSize: typography.sizeXs,
  },
  issueCritical: {
    backgroundColor: 'rgba(255, 107, 122, 0.1)',
    borderLeft: `3px solid ${colors.danger}`,
  },
  issueWarning: {
    backgroundColor: 'rgba(255, 204, 102, 0.1)',
    borderLeft: `3px solid ${colors.warning}`,
  },
  issueInfo: {
    backgroundColor: 'rgba(108, 155, 255, 0.1)',
    borderLeft: `3px solid ${colors.accentEnumerist}`,
  },
  issueIcon: {
    fontSize: typography.sizeSm,
    flexShrink: 0,
  },
  issueContent: {
    flex: 1,
  },
  issueMessage: {
    color: colors.textPrimary,
    fontWeight: typography.weightMedium,
  },
  issueDetails: {
    color: colors.textMuted,
    marginTop: '2px',
  },
  summary: {
    display: 'flex',
    gap: spacing.lg,
    fontSize: typography.sizeXs,
    color: colors.textMuted,
  },
  emptyState: {
    textAlign: 'center',
    color: colors.success,
    fontSize: typography.sizeSm,
    padding: spacing.md,
  },
  collapse: {
    marginTop: spacing.sm,
    padding: `${spacing.xs} ${spacing.sm}`,
    backgroundColor: 'transparent',
    border: 'none',
    color: colors.textMuted,
    fontSize: typography.sizeXs,
    cursor: 'pointer',
    textAlign: 'center',
    width: '100%',
  },
};

/**
 * Analyze pressure reachability - can a pressure reach a given threshold?
 * Returns { reachable, ticksNeeded, bestEra, reason }
 */
function analyzePressureReachability(pressureId, threshold, simulation, eras, ticksPerEra) {
  const pressure = simulation.pressures?.find(p => p.id === pressureId);
  if (!pressure) {
    return { reachable: false, reason: 'Pressure not found' };
  }

  const initialValue = pressure.initialValue;
  const equilibrium = pressure.equilibrium ?? 50;
  const decayRate = pressure.decayRate ?? 0;
  const range = pressure.range || { min: 0, max: 100 };

  // If already above threshold, it's reachable
  if (initialValue >= threshold) {
    return { reachable: true, ticksNeeded: 0, reason: 'Already at threshold' };
  }

  // Simulate pressure evolution across eras
  let currentValue = initialValue;
  let totalTicks = 0;
  let bestEra = null;
  let reachedThreshold = false;

  for (const eraId of Object.keys(simulation.eraRuleWeights || {})) {
    const eraWeights = simulation.eraRuleWeights[eraId];
    const eraDrift = eraWeights?.pressureDrift?.[pressureId] ?? 0;

    // Simulate ticks in this era
    for (let tick = 0; tick < ticksPerEra; tick++) {
      // Apply era drift
      currentValue += eraDrift;

      // Apply decay toward equilibrium
      if (decayRate > 0) {
        const diff = equilibrium - currentValue;
        currentValue += diff * decayRate;
      }

      // Clamp to range
      currentValue = Math.max(range.min, Math.min(range.max, currentValue));

      totalTicks++;

      if (currentValue >= threshold) {
        reachedThreshold = true;
        bestEra = eraId;
        break;
      }
    }

    if (reachedThreshold) break;
  }

  if (reachedThreshold) {
    return {
      reachable: true,
      ticksNeeded: totalTicks,
      bestEra,
      reason: `Reaches threshold at tick ${totalTicks} (era: ${bestEra})`
    };
  }

  // Calculate theoretical max the pressure could reach
  // (highest era drift without decay consideration)
  let maxDrift = 0;
  let maxDriftEra = null;
  for (const [eraId, eraWeights] of Object.entries(simulation.eraRuleWeights || {})) {
    const drift = eraWeights?.pressureDrift?.[pressureId] ?? 0;
    if (drift > maxDrift) {
      maxDrift = drift;
      maxDriftEra = eraId;
    }
  }

  // Calculate theoretical maximum if no decay
  const theoreticalMax = Math.min(range.max, initialValue + maxDrift * ticksPerEra * Object.keys(simulation.eraRuleWeights || {}).length);

  return {
    reachable: false,
    theoreticalMax,
    maxDriftEra,
    currentMax: currentValue,
    reason: `Max reachable: ${Math.round(currentValue)} (need ${threshold}). Highest drift: ${maxDrift}/tick in ${maxDriftEra || 'no era'}`
  };
}

/**
 * Extract pressure conditions from a rule
 */
function extractPressureConditions(rule) {
  const conditions = [];
  for (const cond of rule.conditions || []) {
    if (cond.type === 'pressure_above' && cond.params?.pressure && cond.params?.threshold) {
      conditions.push({
        pressureId: cond.params.pressure,
        threshold: cond.params.threshold,
        type: 'above'
      });
    }
    if (cond.type === 'pressure_below' && cond.params?.pressure && cond.params?.threshold) {
      conditions.push({
        pressureId: cond.params.pressure,
        threshold: cond.params.threshold,
        type: 'below'
      });
    }
  }
  return conditions;
}

/**
 * Extract entity existence conditions from a rule
 */
function extractEntityConditions(rule) {
  const conditions = [];
  for (const cond of rule.conditions || []) {
    if (cond.type === 'entity_exists' && cond.params?.kind) {
      conditions.push({
        kind: cond.params.kind,
        subtype: cond.params.subtype,
        type: 'exists'
      });
    }
    if (cond.type === 'entity_count_above' && cond.params?.kind) {
      conditions.push({
        kind: cond.params.kind,
        subtype: cond.params.subtype,
        threshold: cond.params.threshold,
        type: 'count_above'
      });
    }
    if (cond.type === 'relationship_exists' && cond.params?.kind) {
      conditions.push({
        relationshipKind: cond.params.kind,
        type: 'relationship_exists'
      });
    }
  }
  return conditions;
}

/**
 * Find which rules can create a specific entity kind/subtype
 */
function findCreatorRules(entityKind, entitySubtype, rules) {
  const creators = [];
  for (const rule of rules) {
    for (const template of rule.create || []) {
      if (template.kind === entityKind && (!entitySubtype || template.subtype === entitySubtype)) {
        creators.push(rule.id);
      }
    }
  }
  return creators;
}

/**
 * Find which rules can create a specific relationship kind
 */
function findRelationshipCreatorRules(relationshipKind, rules) {
  const creators = [];
  for (const rule of rules) {
    for (const conn of rule.connect || []) {
      if (conn.kind === relationshipKind) {
        creators.push(rule.id);
      }
    }
  }
  return creators;
}

/**
 * Simple static analysis for live feedback in the browser.
 * This analyzes pressure reachability, dependency chains, and rule viability.
 */
function analyzeSimulation(simulation, schema) {
  const issues = [];

  if (!simulation) {
    return { issues, healthScore: 0 };
  }

  const entityKinds = schema?.entityKinds || [];
  const relationshipKinds = schema?.relationshipKinds || [];
  const eras = schema?.eras || [];
  const ticksPerEra = simulation.settings?.ticksPerEra || 20;

  // Track what's created and consumed
  const createdEntityKinds = new Set();
  const createdEntitySubtypes = new Map(); // kind -> Set of subtypes
  const consumedEntityKinds = new Set();
  const createdRelationshipKinds = new Set();
  const allRules = [...(simulation.generationRules || []), ...(simulation.simulationRules || [])];

  // Analyze generation rules
  for (const rule of simulation.generationRules || []) {
    // Track created entities from create templates
    for (const template of rule.create || []) {
      if (template.kind) {
        createdEntityKinds.add(template.kind);
        if (!createdEntitySubtypes.has(template.kind)) {
          createdEntitySubtypes.set(template.kind, new Set());
        }
        if (template.subtype) {
          createdEntitySubtypes.get(template.kind).add(template.subtype);
        }
      }
    }

    // Track created relationships
    for (const conn of rule.connect || []) {
      if (conn.kind) createdRelationshipKinds.add(conn.kind);
    }

    // Check conditions for consumed entity kinds
    for (const cond of rule.conditions || []) {
      if (cond.type === 'entity_exists' || cond.type === 'entity_count_below' || cond.type === 'entity_count_above') {
        if (cond.params?.kind) consumedEntityKinds.add(cond.params.kind);
      }
    }
  }

  // Analyze simulation rules
  for (const rule of simulation.simulationRules || []) {
    // Track relationships created
    for (const conn of rule.connect || []) {
      if (conn.kind) createdRelationshipKinds.add(conn.kind);
    }

    // Track entities created (some simulation rules create entities)
    for (const template of rule.create || []) {
      if (template.kind) {
        createdEntityKinds.add(template.kind);
        if (!createdEntitySubtypes.has(template.kind)) {
          createdEntitySubtypes.set(template.kind, new Set());
        }
        if (template.subtype) {
          createdEntitySubtypes.get(template.kind).add(template.subtype);
        }
      }
    }

    // Check select specs
    for (const sel of rule.select || []) {
      if (sel.query?.kind) consumedEntityKinds.add(sel.query.kind);
    }
  }

  // =========================================================================
  // PRESSURE REACHABILITY ANALYSIS
  // =========================================================================

  // Check each rule's pressure conditions for reachability
  for (const rule of allRules) {
    const pressureConditions = extractPressureConditions(rule);

    for (const cond of pressureConditions) {
      if (cond.type === 'above') {
        const analysis = analyzePressureReachability(
          cond.pressureId,
          cond.threshold,
          simulation,
          eras,
          ticksPerEra
        );

        if (!analysis.reachable) {
          const pressure = simulation.pressures?.find(p => p.id === cond.pressureId);
          issues.push({
            id: `pressure_unreachable_${rule.id}_${cond.pressureId}`,
            severity: 'critical',
            message: `"${rule.name}" requires ${pressure?.name || cond.pressureId} > ${cond.threshold}, but pressure can't reach it`,
            details: analysis.reason,
          });
        } else if (analysis.ticksNeeded > ticksPerEra * 2) {
          const pressure = simulation.pressures?.find(p => p.id === cond.pressureId);
          issues.push({
            id: `pressure_slow_${rule.id}_${cond.pressureId}`,
            severity: 'warning',
            message: `"${rule.name}" requires ${pressure?.name || cond.pressureId} > ${cond.threshold}, takes ~${analysis.ticksNeeded} ticks`,
            details: `Rule won't fire until era "${analysis.bestEra}". Consider lowering threshold or increasing drift.`,
          });
        }
      }
    }
  }

  // =========================================================================
  // DEPENDENCY CHAIN ANALYSIS
  // =========================================================================

  // Check for simulation rules that require entities that only simulation rules create
  // (chicken-and-egg problem)
  for (const rule of simulation.simulationRules || []) {
    const entityConditions = extractEntityConditions(rule);

    for (const cond of entityConditions) {
      if (cond.type === 'exists' || cond.type === 'count_above') {
        // Check if any generation rule creates this
        const genCreators = findCreatorRules(cond.kind, cond.subtype, simulation.generationRules || []);
        const simCreators = findCreatorRules(cond.kind, cond.subtype, simulation.simulationRules || []);

        if (genCreators.length === 0 && simCreators.length > 0) {
          const entityKind = entityKinds.find(ek => ek.id === cond.kind);
          issues.push({
            id: `dependency_loop_${rule.id}_${cond.kind}`,
            severity: 'warning',
            message: `"${rule.name}" needs ${entityKind?.name || cond.kind}${cond.subtype ? `/${cond.subtype}` : ''}, but only simulation rules create it`,
            details: `Circular dependency: simulation rules need entities that aren't seeded or generated. Created by: ${simCreators.join(', ')}`,
          });
        }

        if (genCreators.length === 0 && simCreators.length === 0) {
          // Check if it's in seed entities
          const seedEntities = schema?.seedEntities || [];
          const hasSeed = seedEntities.some(e =>
            e.kind === cond.kind && (!cond.subtype || e.subtype === cond.subtype)
          );

          if (!hasSeed) {
            const entityKind = entityKinds.find(ek => ek.id === cond.kind);
            issues.push({
              id: `no_source_${rule.id}_${cond.kind}`,
              severity: 'critical',
              message: `"${rule.name}" requires ${entityKind?.name || cond.kind}${cond.subtype ? `/${cond.subtype}` : ''}, but nothing creates it`,
              details: 'No seed entities, generation rules, or simulation rules create this entity type',
            });
          }
        }
      }

      if (cond.type === 'relationship_exists') {
        const creators = findRelationshipCreatorRules(cond.relationshipKind, allRules);

        // Check if seed relationships have this kind
        const seedRelationships = schema?.seedRelationships || [];
        const hasSeedRel = seedRelationships.some(r => r.kind === cond.relationshipKind);

        if (creators.length === 0 && !hasSeedRel) {
          const relKind = relationshipKinds.find(rk => rk.id === cond.relationshipKind);
          issues.push({
            id: `no_rel_source_${rule.id}_${cond.relationshipKind}`,
            severity: 'critical',
            message: `"${rule.name}" requires "${relKind?.name || cond.relationshipKind}" relationships, but nothing creates them`,
            details: 'No seed relationships or rules create this relationship kind',
          });
        }
      }
    }
  }

  // =========================================================================
  // ERA WEIGHT ANALYSIS
  // =========================================================================

  // Check for rules with no weight in any era
  const allRulesWithWeights = new Set();
  for (const eraWeights of Object.values(simulation.eraRuleWeights || {})) {
    for (const [ruleId, weight] of Object.entries(eraWeights.generationWeights || {})) {
      if (weight > 0) allRulesWithWeights.add(ruleId);
    }
    for (const [ruleId, weight] of Object.entries(eraWeights.simulationWeights || {})) {
      if (weight > 0) allRulesWithWeights.add(ruleId);
    }
  }

  for (const rule of simulation.generationRules || []) {
    if (!allRulesWithWeights.has(rule.id)) {
      issues.push({
        id: `rule_no_weight_${rule.id}`,
        severity: 'warning',
        message: `"${rule.name}" has no positive weight in any era`,
        details: 'This rule will never be selected. Add weight in Era Weights.',
      });
    }
  }

  for (const rule of simulation.simulationRules || []) {
    if (!allRulesWithWeights.has(rule.id)) {
      issues.push({
        id: `rule_no_weight_${rule.id}`,
        severity: 'warning',
        message: `"${rule.name}" has no positive weight in any era`,
        details: 'This rule will never be selected. Add weight in Era Weights.',
      });
    }
  }

  // Check for eras without configured weights
  const configuredEras = Object.keys(simulation.eraRuleWeights || {});
  if (configuredEras.length === 0 && (simulation.generationRules?.length > 0 || simulation.simulationRules?.length > 0)) {
    issues.push({
      id: 'no_era_weights',
      severity: 'critical',
      message: 'No era weights configured',
      details: 'Rules will not fire without era weight configuration',
    });
  }

  // =========================================================================
  // BOOTSTRAP ANALYSIS - Can the simulation actually start?
  // =========================================================================

  // Check if generation rules can fire in the first era (bootstrapping)
  const firstEraId = configuredEras[0];
  if (firstEraId) {
    const firstEraWeights = simulation.eraRuleWeights[firstEraId];
    const firstEraGenWeights = firstEraWeights?.generationWeights || {};

    // Find generation rules that have weight in first era
    const firstEraGenRules = (simulation.generationRules || []).filter(
      rule => (firstEraGenWeights[rule.id] || 0) > 0
    );

    // Check each first-era rule for initial viability
    let hasViableFirstEraRule = false;
    const blockedRules = [];

    for (const rule of firstEraGenRules) {
      const pressureConds = extractPressureConditions(rule);
      const entityConds = extractEntityConditions(rule);

      // Check if pressure conditions can be met at start
      let pressuresOk = true;
      let pressureBlocker = null;
      for (const cond of pressureConds) {
        if (cond.type === 'above') {
          const pressure = simulation.pressures?.find(p => p.id === cond.pressureId);
          if (pressure && pressure.initialValue < cond.threshold) {
            // Check if it can reach threshold in first era
            const analysis = analyzePressureReachability(
              cond.pressureId,
              cond.threshold,
              simulation,
              eras,
              ticksPerEra
            );
            if (!analysis.reachable || analysis.ticksNeeded > ticksPerEra) {
              pressuresOk = false;
              pressureBlocker = `${pressure.name} starts at ${pressure.initialValue}, needs ${cond.threshold}`;
            }
          }
        }
      }

      // Check if entity conditions can be met (from seeds)
      let entitiesOk = true;
      let entityBlocker = null;
      const seedEntities = schema?.seedEntities || [];
      for (const cond of entityConds) {
        if (cond.type === 'exists') {
          const hasSeed = seedEntities.some(e =>
            e.kind === cond.kind && (!cond.subtype || e.subtype === cond.subtype)
          );
          if (!hasSeed) {
            entitiesOk = false;
            entityBlocker = `Needs ${cond.kind}${cond.subtype ? '/' + cond.subtype : ''} but no seeds exist`;
          }
        }
      }

      if (pressuresOk && entitiesOk) {
        hasViableFirstEraRule = true;
      } else {
        blockedRules.push({
          rule,
          pressureBlocker,
          entityBlocker
        });
      }
    }

    // If no generation rules can fire initially, that's a critical issue
    if (firstEraGenRules.length > 0 && !hasViableFirstEraRule) {
      issues.push({
        id: 'no_bootstrap_rules',
        severity: 'critical',
        message: `No generation rules can fire at simulation start`,
        details: `All ${firstEraGenRules.length} first-era rules are blocked: ${blockedRules.map(b =>
          `"${b.rule.name}" (${b.pressureBlocker || b.entityBlocker})`
        ).join('; ')}`,
      });
    }

    // Warn about specific rules blocked at start
    for (const blocked of blockedRules) {
      if (blocked.pressureBlocker) {
        issues.push({
          id: `blocked_at_start_${blocked.rule.id}`,
          severity: 'warning',
          message: `"${blocked.rule.name}" blocked at start: ${blocked.pressureBlocker}`,
          details: 'This rule cannot fire until pressure conditions are met. Consider lowering threshold or increasing initial pressure value.',
        });
      }
    }
  }

  // =========================================================================
  // GROWTH VS SIMULATION BALANCE
  // =========================================================================

  // Check if simulation rules have entities to work with
  const seedEntityKinds = new Set((schema?.seedEntities || []).map(e => e.kind));
  const seedEntityCount = (schema?.seedEntities || []).length;

  // If there are simulation rules but few/no generation rules and few seeds
  if ((simulation.simulationRules || []).length > 0) {
    const genRuleCount = (simulation.generationRules || []).length;
    if (genRuleCount === 0 && seedEntityCount < 3) {
      issues.push({
        id: 'sim_without_gen',
        severity: 'critical',
        message: 'Simulation rules exist but no generation rules and few seed entities',
        details: `Only ${seedEntityCount} seed entities and no generation rules. Simulation rules need entities to work with.`,
      });
    }
  }

  // =========================================================================
  // PRESSURE EFFECT BALANCE ANALYSIS
  // =========================================================================

  // Check if pressure effects could create runaway or stagnant loops
  for (const pressure of simulation.pressures || []) {
    let totalPositiveEffect = 0;
    let totalNegativeEffect = 0;
    let rulesAffecting = [];

    for (const rule of allRules) {
      for (const effect of rule.pressureEffects || []) {
        if (effect.pressure === pressure.id) {
          if (effect.delta > 0) {
            totalPositiveEffect += effect.delta;
          } else {
            totalNegativeEffect += Math.abs(effect.delta);
          }
          rulesAffecting.push({ ruleId: rule.id, ruleName: rule.name, delta: effect.delta });
        }
      }
    }

    // Check for pressures that only go up or only go down
    if (totalPositiveEffect > 0 && totalNegativeEffect === 0) {
      issues.push({
        id: `pressure_runaway_${pressure.id}`,
        severity: 'warning',
        message: `"${pressure.name}" only increases from rules (no decreases)`,
        details: `Rules add +${totalPositiveEffect} total. May hit ceiling. Affected by: ${rulesAffecting.map(r => r.ruleName).join(', ')}`,
      });
    }

    if (totalNegativeEffect > 0 && totalPositiveEffect === 0 && pressure.naturalDrift <= 0) {
      issues.push({
        id: `pressure_drain_${pressure.id}`,
        severity: 'warning',
        message: `"${pressure.name}" only decreases from rules (no increases)`,
        details: `Rules subtract -${totalNegativeEffect} total with no positive drift. May hit floor.`,
      });
    }
  }

  // Calculate health score
  const criticalCount = issues.filter((i) => i.severity === 'critical').length;
  const warningCount = issues.filter((i) => i.severity === 'warning').length;
  const healthScore = Math.max(0, 100 - criticalCount * 20 - warningCount * 5);

  return { issues, healthScore };
}

export default function StaticAnalysisPanel({ simulation, schema, collapsed, onToggle }) {
  const analysis = useMemo(
    () => analyzeSimulation(simulation, schema),
    [simulation, schema]
  );

  const criticalCount = analysis.issues.filter((i) => i.severity === 'critical').length;
  const warningCount = analysis.issues.filter((i) => i.severity === 'warning').length;
  const infoCount = analysis.issues.filter((i) => i.severity === 'info').length;

  const healthClass =
    analysis.healthScore >= 80
      ? styles.healthGood
      : analysis.healthScore >= 50
        ? styles.healthWarning
        : styles.healthCritical;

  const getSeverityStyle = (severity) => {
    switch (severity) {
      case 'critical':
        return styles.issueCritical;
      case 'warning':
        return styles.issueWarning;
      default:
        return styles.issueInfo;
    }
  };

  const getSeverityIcon = (severity) => {
    switch (severity) {
      case 'critical':
        return '🔴';
      case 'warning':
        return '🟡';
      default:
        return '🔵';
    }
  };

  // Only show critical and warning issues by default
  const visibleIssues = collapsed
    ? analysis.issues.filter((i) => i.severity === 'critical')
    : analysis.issues;

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <span style={styles.title}>Static Analysis</span>
        <span style={{ ...styles.healthScore, ...healthClass }}>
          {analysis.healthScore}% healthy
        </span>
      </div>

      <div style={styles.summary}>
        <span>{criticalCount} critical</span>
        <span>{warningCount} warnings</span>
        <span>{infoCount} info</span>
      </div>

      {analysis.issues.length === 0 ? (
        <div style={styles.emptyState}>
          <span>✓</span> No issues detected
        </div>
      ) : (
        <>
          <div style={{ ...styles.issues, marginTop: spacing.sm }}>
            {visibleIssues.map((issue) => (
              <div
                key={issue.id}
                style={{ ...styles.issue, ...getSeverityStyle(issue.severity) }}
              >
                <span style={styles.issueIcon}>{getSeverityIcon(issue.severity)}</span>
                <div style={styles.issueContent}>
                  <div style={styles.issueMessage}>{issue.message}</div>
                  {issue.details && <div style={styles.issueDetails}>{issue.details}</div>}
                </div>
              </div>
            ))}
          </div>

          {analysis.issues.length > visibleIssues.length && (
            <button style={styles.collapse} onClick={onToggle}>
              {collapsed
                ? `Show ${analysis.issues.length - visibleIssues.length} more issues`
                : 'Show less'}
            </button>
          )}
        </>
      )}
    </div>
  );
}
