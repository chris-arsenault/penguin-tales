/**
 * ValidationEditor - Comprehensive pre-run validation for world configuration
 *
 * Validates configuration to catch:
 * - ERRORS: Issues that will cause runtime crashes
 * - WARNINGS: Issues that will degrade story coherence
 *
 * Validation categories:
 * 1. Reference validation (entity kinds, relationship kinds, pressure IDs, etc.)
 * 2. Balance validation (pressure sources/sinks, orphan components)
 * 3. Configuration quality (numeric ranges, required fields)
 */

import React, { useMemo, useState } from 'react';
import DependencyViewer from './DependencyViewer';
import NamingProfileMappingViewer from './NamingProfileMappingViewer';

// Arctic Blue base theme with amber accent
const ACCENT_COLOR = '#f59e0b';

// Status colors
const STATUS_COLORS = {
  clean: '#22c55e',
  warning: '#f59e0b',
  error: '#ef4444',
};

const styles = {
  container: {
    padding: '24px',
    maxWidth: '1200px',
  },
  header: {
    marginBottom: '24px',
  },
  title: {
    fontSize: '24px',
    fontWeight: 600,
    color: '#ffffff',
    marginBottom: '8px',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  subtitle: {
    fontSize: '14px',
    color: '#93c5fd',
  },
  statusBadge: {
    fontSize: '12px',
    padding: '4px 12px',
    borderRadius: '12px',
    fontWeight: 500,
  },
  statusClean: {
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
    color: STATUS_COLORS.clean,
  },
  statusWarning: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    color: STATUS_COLORS.warning,
  },
  statusError: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    color: STATUS_COLORS.error,
  },
  summaryCards: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '16px',
    marginBottom: '24px',
  },
  summaryCard: {
    backgroundColor: '#1e3a5f',
    borderRadius: '8px',
    padding: '16px',
    border: '1px solid rgba(59, 130, 246, 0.3)',
    textAlign: 'center',
  },
  summaryValue: {
    fontSize: '32px',
    fontWeight: 700,
    marginBottom: '4px',
  },
  summaryLabel: {
    fontSize: '12px',
    color: '#93c5fd',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  section: {
    marginBottom: '24px',
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '12px',
  },
  sectionTitle: {
    fontSize: '16px',
    fontWeight: 600,
    color: '#ffffff',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  sectionCount: {
    fontSize: '12px',
    padding: '2px 8px',
    borderRadius: '10px',
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    color: ACCENT_COLOR,
  },
  issueList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  issueCard: {
    backgroundColor: '#1e3a5f',
    borderRadius: '8px',
    border: '1px solid rgba(59, 130, 246, 0.3)',
    overflow: 'hidden',
  },
  issueHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 16px',
    cursor: 'pointer',
    transition: 'background-color 0.15s',
  },
  issueHeaderHover: {
    backgroundColor: '#2d4a6f',
  },
  issueIcon: {
    fontSize: '18px',
  },
  issueTitle: {
    fontSize: '14px',
    fontWeight: 500,
    color: '#ffffff',
    flex: 1,
  },
  issueCount: {
    fontSize: '12px',
    padding: '2px 8px',
    borderRadius: '10px',
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    color: '#60a5fa',
  },
  issueSeverity: {
    fontSize: '11px',
    padding: '2px 8px',
    borderRadius: '4px',
    fontWeight: 500,
  },
  issueExpandIcon: {
    fontSize: '12px',
    color: '#60a5fa',
    transition: 'transform 0.2s',
  },
  issueContent: {
    padding: '12px 16px',
    backgroundColor: '#0a1929',
    borderTop: '1px solid rgba(59, 130, 246, 0.2)',
  },
  issueMessage: {
    fontSize: '13px',
    color: '#93c5fd',
    marginBottom: '12px',
    lineHeight: 1.5,
  },
  affectedItems: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px',
  },
  affectedItem: {
    fontSize: '12px',
    fontFamily: 'monospace',
    backgroundColor: '#1e3a5f',
    color: '#60a5fa',
    padding: '4px 8px',
    borderRadius: '4px',
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  affectedItemHover: {
    backgroundColor: '#2d4a6f',
    color: '#ffffff',
  },
  cleanState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '48px 24px',
    backgroundColor: '#1e3a5f',
    borderRadius: '12px',
    border: '1px solid rgba(34, 197, 94, 0.3)',
  },
  cleanIcon: {
    fontSize: '64px',
    marginBottom: '16px',
  },
  cleanTitle: {
    fontSize: '20px',
    fontWeight: 600,
    color: STATUS_COLORS.clean,
    marginBottom: '8px',
  },
  cleanMessage: {
    fontSize: '14px',
    color: '#93c5fd',
  },
  ruleInfo: {
    marginTop: '24px',
    padding: '16px',
    backgroundColor: '#0c1f2e',
    borderRadius: '8px',
    border: '1px solid rgba(59, 130, 246, 0.3)',
  },
  ruleTitle: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#ffffff',
    marginBottom: '12px',
  },
  ruleList: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
  },
  ruleItem: {
    fontSize: '13px',
    color: '#93c5fd',
    padding: '4px 0',
    paddingLeft: '20px',
    position: 'relative',
  },
  ruleBullet: {
    position: 'absolute',
    left: 0,
  },
  detailRow: {
    fontSize: '12px',
    color: '#60a5fa',
    marginTop: '4px',
    paddingLeft: '12px',
    borderLeft: '2px solid rgba(59, 130, 246, 0.3)',
  },
  exportRow: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
  },
  exportButton: {
    padding: '6px 12px',
    fontSize: '12px',
    fontWeight: 500,
    fontFamily: 'inherit',
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    color: '#60a5fa',
    border: '1px solid rgba(59, 130, 246, 0.3)',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'all 0.15s',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
  },
  exportButtonDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
};

// ============================================================================
// EXPORT FUNCTIONS
// ============================================================================

function formatValidationForExport(validationResults) {
  const items = [];

  // Process errors
  for (const error of validationResults.errors) {
    for (const item of error.affectedItems) {
      items.push({
        severity: 'ERROR',
        category: error.id,
        title: error.title,
        message: error.message,
        itemId: item.id,
        itemLabel: item.label,
        detail: item.detail || '',
      });
    }
  }

  // Process warnings
  for (const warning of validationResults.warnings) {
    for (const item of warning.affectedItems) {
      items.push({
        severity: 'WARNING',
        category: warning.id,
        title: warning.title,
        message: warning.message,
        itemId: item.id,
        itemLabel: item.label,
        detail: item.detail || '',
      });
    }
  }

  return items;
}

function exportAsJson(validationResults) {
  const items = formatValidationForExport(validationResults);
  const json = JSON.stringify({
    exportedAt: new Date().toISOString(),
    summary: {
      errorCount: validationResults.errors.length,
      warningCount: validationResults.warnings.length,
      totalItems: items.length,
    },
    issues: items,
  }, null, 2);

  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `validation-report-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportAsCsv(validationResults) {
  const items = formatValidationForExport(validationResults);

  // CSV header
  const headers = ['Severity', 'Category', 'Title', 'Message', 'Item ID', 'Item Label', 'Detail'];

  // Escape CSV field
  const escapeField = (field) => {
    const str = String(field || '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  // Build CSV rows
  const rows = [
    headers.join(','),
    ...items.map(item => [
      item.severity,
      item.category,
      escapeField(item.title),
      escapeField(item.message),
      escapeField(item.itemId),
      escapeField(item.itemLabel),
      escapeField(item.detail),
    ].join(',')),
  ];

  const csv = rows.join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `validation-report-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ============================================================================
// VALIDATION RULES
// ============================================================================

/**
 * Helper to collect all entity kind references from various config locations
 */
function collectEntityKindRefs(generators, pressures, systems) {
  const refs = [];

  // From generators
  for (const gen of generators) {
    if (gen.enabled === false) continue;

    // Creation rules
    if (gen.creation) {
      for (const c of gen.creation) {
        if (c.kind) {
          refs.push({ kind: c.kind, subtype: c.subtype, source: `generator "${gen.id}" creation`, sourceId: gen.id, sourceType: 'generator' });
        }
      }
    }

    // Applicability rules
    if (gen.applicability) {
      collectEntityKindRefsFromRules(gen.applicability, `generator "${gen.id}" applicability`, gen.id, 'generator', refs);
    }

    // Selection rules
    if (gen.selection?.kind) {
      refs.push({ kind: gen.selection.kind, subtype: null, source: `generator "${gen.id}" selection`, sourceId: gen.id, sourceType: 'generator' });
    }
  }

  // From pressures
  for (const p of pressures) {
    if (p.growth?.positiveFeedback) {
      collectEntityKindRefsFromFactors(p.growth.positiveFeedback, `pressure "${p.id}" positiveFeedback`, p.id, 'pressure', refs);
    }
    if (p.growth?.negativeFeedback) {
      collectEntityKindRefsFromFactors(p.growth.negativeFeedback, `pressure "${p.id}" negativeFeedback`, p.id, 'pressure', refs);
    }
  }

  // From systems
  for (const sys of systems) {
    const cfg = sys.config;
    if (cfg?.entityKind) {
      refs.push({ kind: cfg.entityKind, subtype: null, source: `system "${cfg.id}"`, sourceId: cfg.id, sourceType: 'system' });
    }
  }

  return refs;
}

function collectEntityKindRefsFromRules(rules, source, sourceId, sourceType, refs) {
  for (const rule of rules) {
    if (rule.kind) {
      refs.push({ kind: rule.kind, subtype: rule.subtype, source, sourceId, sourceType });
    }
    if (rule.rules) {
      collectEntityKindRefsFromRules(rule.rules, source, sourceId, sourceType, refs);
    }
  }
}

function collectEntityKindRefsFromFactors(factors, source, sourceId, sourceType, refs) {
  for (const f of factors) {
    if (f.kind) {
      refs.push({ kind: f.kind, subtype: f.subtype, source, sourceId, sourceType });
    }
    if (f.numerator?.kind) {
      refs.push({ kind: f.numerator.kind, subtype: f.numerator.subtype, source, sourceId, sourceType });
    }
    if (f.denominator?.kind) {
      refs.push({ kind: f.denominator.kind, subtype: f.denominator.subtype, source, sourceId, sourceType });
    }
  }
}

/**
 * Helper to collect all relationship kind references
 */
function collectRelationshipKindRefs(generators, pressures, systems) {
  const refs = [];

  // From generators
  for (const gen of generators) {
    if (gen.enabled === false) continue;
    if (gen.relationships) {
      for (const r of gen.relationships) {
        if (r.kind) {
          refs.push({ kind: r.kind, source: `generator "${gen.id}"`, sourceId: gen.id, sourceType: 'generator' });
        }
      }
    }
    // Lineage in contract
    if (gen.contract?.lineage?.relationshipKind) {
      refs.push({ kind: gen.contract.lineage.relationshipKind, source: `generator "${gen.id}" lineage`, sourceId: gen.id, sourceType: 'generator' });
    }
  }

  // From pressures
  for (const p of pressures) {
    collectRelKindRefsFromFactors(p.growth?.positiveFeedback || [], `pressure "${p.id}"`, p.id, 'pressure', refs);
    collectRelKindRefsFromFactors(p.growth?.negativeFeedback || [], `pressure "${p.id}"`, p.id, 'pressure', refs);
  }

  // From systems
  for (const sys of systems) {
    const cfg = sys.config;
    if (cfg?.contagion?.relationshipKind) {
      refs.push({ kind: cfg.contagion.relationshipKind, source: `system "${cfg.id}"`, sourceId: cfg.id, sourceType: 'system' });
    }
    if (cfg?.vectors) {
      for (const v of cfg.vectors) {
        if (v.relationshipKind) {
          refs.push({ kind: v.relationshipKind, source: `system "${cfg.id}"`, sourceId: cfg.id, sourceType: 'system' });
        }
      }
    }
    if (cfg?.infectionAction?.relationshipKind) {
      refs.push({ kind: cfg.infectionAction.relationshipKind, source: `system "${cfg.id}"`, sourceId: cfg.id, sourceType: 'system' });
    }
    if (cfg?.metric?.sharedRelationshipKind) {
      refs.push({ kind: cfg.metric.sharedRelationshipKind, source: `system "${cfg.id}"`, sourceId: cfg.id, sourceType: 'system' });
    }
    if (cfg?.rules) {
      for (const r of cfg.rules) {
        if (r.action?.kind) {
          refs.push({ kind: r.action.kind, source: `system "${cfg.id}"`, sourceId: cfg.id, sourceType: 'system' });
        }
      }
    }
  }

  return refs;
}

function collectRelKindRefsFromFactors(factors, source, sourceId, sourceType, refs) {
  for (const f of factors) {
    if (f.relationshipKinds) {
      for (const k of f.relationshipKinds) {
        refs.push({ kind: k, source, sourceId, sourceType });
      }
    }
    if (f.numerator?.relationshipKinds) {
      for (const k of f.numerator.relationshipKinds) {
        refs.push({ kind: k, source, sourceId, sourceType });
      }
    }
    if (f.denominator?.relationshipKinds) {
      for (const k of f.denominator.relationshipKinds) {
        refs.push({ kind: k, source, sourceId, sourceType });
      }
    }
  }
}

/**
 * Helper to collect pressure ID references
 */
function collectPressureIdRefs(generators, systems) {
  const refs = [];

  // From generators
  for (const gen of generators) {
    if (gen.enabled === false) continue;
    if (gen.stateUpdates) {
      for (const u of gen.stateUpdates) {
        if (u.type === 'modify_pressure' && u.pressureId) {
          refs.push({ id: u.pressureId, source: `generator "${gen.id}"`, sourceId: gen.id, sourceType: 'generator' });
        }
      }
    }
  }

  // From systems
  for (const sys of systems) {
    const cfg = sys.config;
    if (cfg?.pressureChanges) {
      for (const pId of Object.keys(cfg.pressureChanges)) {
        refs.push({ id: pId, source: `system "${cfg.id}"`, sourceId: cfg.id, sourceType: 'system' });
      }
    }
  }

  return refs;
}

// ============================================================================
// VALIDATION RULE IMPLEMENTATIONS
// ============================================================================

const validationRules = {
  /**
   * 0. Generator format must be declarative (ERROR)
   */
  invalidGeneratorFormat: (_schema, generators) => {
    const invalid = [];

    for (const gen of generators) {
      if (gen.enabled === false) continue;

      const problems = [];
      if (gen.template) {
        problems.push('uses legacy "template" wrapper');
      }
      if (!gen.selection) {
        problems.push('missing selection');
      } else {
        if (!gen.selection.strategy) problems.push('missing selection.strategy');
        if (!gen.selection.kind) problems.push('missing selection.kind');
      }
      if (!Array.isArray(gen.creation)) problems.push('creation must be an array');
      if (!Array.isArray(gen.relationships)) problems.push('relationships must be an array');
      if (!Array.isArray(gen.stateUpdates)) problems.push('stateUpdates must be an array');

      if (problems.length > 0) {
        invalid.push({
          id: gen.id,
          name: gen.name || gen.id,
          detail: problems.join('; '),
        });
      }
    }

    if (invalid.length === 0) return null;

    return {
      id: 'invalid-generator-format',
      title: 'Generators use legacy or invalid shape',
      message: 'Generators must use the declarative template shape (selection/creation/relationships/stateUpdates). Legacy wrappers will crash the simulation.',
      severity: 'error',
      affectedItems: invalid.map(g => ({
        id: g.id,
        label: g.name,
        detail: g.detail,
      })),
    };
  },

  /**
   * 1. Invalid Entity Kind References (ERROR)
   */
  invalidEntityKind: (schema, generators, pressures, systems) => {
    const validKinds = new Set((schema.entityKinds || []).map(e => e.kind));
    const refs = collectEntityKindRefs(generators, pressures, systems);
    const invalid = refs.filter(r => !validKinds.has(r.kind));

    if (invalid.length === 0) return null;

    // Group by invalid kind
    const byKind = {};
    for (const r of invalid) {
      if (!byKind[r.kind]) byKind[r.kind] = [];
      byKind[r.kind].push(r);
    }

    return {
      id: 'invalid-entity-kind',
      title: 'Invalid entity kind references',
      message: 'These configurations reference entity kinds that do not exist in the schema. This will cause runtime crashes.',
      severity: 'error',
      affectedItems: Object.entries(byKind).map(([kind, sources]) => ({
        id: kind,
        label: kind,
        detail: `Referenced by: ${sources.map(s => s.source).join(', ')}`,
      })),
    };
  },

  /**
   * 2. Invalid Relationship Kind References (ERROR)
   */
  invalidRelationshipKind: (schema, generators, pressures, systems) => {
    const validKinds = new Set((schema.relationshipKinds || []).map(r => r.kind));
    const refs = collectRelationshipKindRefs(generators, pressures, systems);
    const invalid = refs.filter(r => !validKinds.has(r.kind));

    if (invalid.length === 0) return null;

    const byKind = {};
    for (const r of invalid) {
      if (!byKind[r.kind]) byKind[r.kind] = [];
      byKind[r.kind].push(r);
    }

    return {
      id: 'invalid-relationship-kind',
      title: 'Invalid relationship kind references',
      message: 'These configurations reference relationship kinds that do not exist in the schema. This will cause runtime crashes or silent failures.',
      severity: 'error',
      affectedItems: Object.entries(byKind).map(([kind, sources]) => ({
        id: kind,
        label: kind,
        detail: `Referenced by: ${sources.map(s => s.source).join(', ')}`,
      })),
    };
  },

  /**
   * 3. Invalid Pressure ID References (ERROR)
   */
  invalidPressureId: (pressures, generators, systems) => {
    const validIds = new Set(pressures.map(p => p.id));
    const refs = collectPressureIdRefs(generators, systems);
    const invalid = refs.filter(r => !validIds.has(r.id));

    if (invalid.length === 0) return null;

    const byId = {};
    for (const r of invalid) {
      if (!byId[r.id]) byId[r.id] = [];
      byId[r.id].push(r);
    }

    return {
      id: 'invalid-pressure-id',
      title: 'Invalid pressure ID references',
      message: 'These configurations reference pressure IDs that do not exist. This will cause runtime crashes when modifying pressures.',
      severity: 'error',
      affectedItems: Object.entries(byId).map(([id, sources]) => ({
        id,
        label: id,
        detail: `Referenced by: ${sources.map(s => s.source).join(', ')}`,
      })),
    };
  },

  /**
   * 4. Invalid Era Template References (ERROR)
   */
  invalidEraTemplateRef: (eras, generators) => {
    const validIds = new Set(generators.map(g => g.id));
    const invalid = [];

    for (const era of eras) {
      if (era.templateWeights) {
        for (const genId of Object.keys(era.templateWeights)) {
          if (!validIds.has(genId)) {
            invalid.push({ genId, eraId: era.id, eraName: era.name });
          }
        }
      }
    }

    if (invalid.length === 0) return null;

    return {
      id: 'invalid-era-template-ref',
      title: 'Invalid generator references in eras',
      message: 'These eras reference generators that do not exist. The weights will have no effect.',
      severity: 'error',
      affectedItems: invalid.map(i => ({
        id: `${i.eraId}:${i.genId}`,
        label: i.genId,
        detail: `In era "${i.eraName}"`,
      })),
    };
  },

  /**
   * 5. Invalid Era System References (ERROR)
   */
  invalidEraSystemRef: (eras, systems) => {
    const validIds = new Set(systems.map(s => s.config?.id).filter(Boolean));
    const invalid = [];

    for (const era of eras) {
      if (era.systemModifiers) {
        for (const sysId of Object.keys(era.systemModifiers)) {
          if (!validIds.has(sysId)) {
            invalid.push({ sysId, eraId: era.id, eraName: era.name });
          }
        }
      }
    }

    if (invalid.length === 0) return null;

    return {
      id: 'invalid-era-system-ref',
      title: 'Invalid system references in eras',
      message: 'These eras reference systems that do not exist. The modifiers will have no effect.',
      severity: 'error',
      affectedItems: invalid.map(i => ({
        id: `${i.eraId}:${i.sysId}`,
        label: i.sysId,
        detail: `In era "${i.eraName}"`,
      })),
    };
  },

  /**
   * 6. Pressure Without Sources (WARNING)
   */
  pressureWithoutSources: (pressures, generators, systems) => {
    const pressuresWithSources = new Set();

    // Check generators for positive pressure changes
    for (const gen of generators) {
      if (gen.enabled === false) continue;
      if (gen.stateUpdates) {
        for (const u of gen.stateUpdates) {
          if (u.type === 'modify_pressure' && u.delta > 0) {
            pressuresWithSources.add(u.pressureId);
          }
        }
      }
    }

    // Check systems for positive pressure changes
    for (const sys of systems) {
      const cfg = sys.config;
      if (cfg?.pressureChanges) {
        for (const [pId, delta] of Object.entries(cfg.pressureChanges)) {
          if (delta > 0) pressuresWithSources.add(pId);
        }
      }
    }

    // Also check if pressure has baseGrowth or positiveFeedback
    for (const p of pressures) {
      if (p.growth?.baseGrowth > 0 || (p.growth?.positiveFeedback?.length > 0)) {
        pressuresWithSources.add(p.id);
      }
    }

    const withoutSources = pressures.filter(p => !pressuresWithSources.has(p.id));

    if (withoutSources.length === 0) return null;

    return {
      id: 'pressure-without-sources',
      title: 'Pressures without sources',
      message: 'These pressures have no positive drivers (no generators/systems increase them, no baseGrowth, no positiveFeedback). They will decay to 0 and stay there.',
      severity: 'warning',
      affectedItems: withoutSources.map(p => ({
        id: p.id,
        label: p.name || p.id,
        detail: `Decay: ${p.decay}, no sources found`,
      })),
    };
  },

  /**
   * 7. Pressure Without Sinks (WARNING)
   */
  pressureWithoutSinks: (pressures, generators, systems) => {
    const pressuresWithSinks = new Set();

    // Check generators for negative pressure changes
    for (const gen of generators) {
      if (gen.enabled === false) continue;
      if (gen.stateUpdates) {
        for (const u of gen.stateUpdates) {
          if (u.type === 'modify_pressure' && u.delta < 0) {
            pressuresWithSinks.add(u.pressureId);
          }
        }
      }
    }

    // Check systems for negative pressure changes
    for (const sys of systems) {
      const cfg = sys.config;
      if (cfg?.pressureChanges) {
        for (const [pId, delta] of Object.entries(cfg.pressureChanges)) {
          if (delta < 0) pressuresWithSinks.add(pId);
        }
      }
    }

    // Check if pressure has decay or negativeFeedback
    for (const p of pressures) {
      if (p.decay > 0 || (p.growth?.negativeFeedback?.length > 0)) {
        pressuresWithSinks.add(p.id);
      }
    }

    const withoutSinks = pressures.filter(p => !pressuresWithSinks.has(p.id));

    if (withoutSinks.length === 0) return null;

    return {
      id: 'pressure-without-sinks',
      title: 'Pressures without sinks',
      message: 'These pressures have no negative drivers (no decay, no negativeFeedback, nothing decreases them). They will grow to 100 and saturate.',
      severity: 'warning',
      affectedItems: withoutSinks.map(p => ({
        id: p.id,
        label: p.name || p.id,
        detail: `Decay: ${p.decay || 0}`,
      })),
    };
  },

  /**
   * 8. Generator Missing Lineage (WARNING) - already implemented, keeping for completeness
   */
  generatorMissingLineage: (generators) => {
    const warnings = [];

    for (const gen of generators) {
      if (gen.enabled === false) continue;
      const createsEntities = gen.creation && gen.creation.length > 0;
      if (!createsEntities) continue;

      const hasContractLineage = gen.contract?.lineage != null;
      const hasInlineLineage = gen.creation.some(c => c.lineage != null);

      if (!hasContractLineage && !hasInlineLineage) {
        const entityTypes = gen.creation.map(c =>
          c.subtype ? `${c.kind}:${c.subtype}` : c.kind
        ).join(', ');
        warnings.push({ id: gen.id, name: gen.name || gen.id, entityTypes });
      }
    }

    if (warnings.length === 0) return null;

    return {
      id: 'generator-missing-lineage',
      title: 'Generators missing lineage configuration',
      message: 'These generators create entities but do not define lineage in their contract. Lineage ensures new entities are properly connected to existing ones.',
      severity: 'warning',
      affectedItems: warnings.map(w => ({
        id: w.id,
        label: w.name,
        detail: `Creates: ${w.entityTypes}`,
      })),
    };
  },

  /**
   * 9. Orphan Generators (WARNING)
   */
  orphanGenerators: (eras, generators) => {
    const referencedIds = new Set();
    for (const era of eras) {
      if (era.templateWeights) {
        for (const genId of Object.keys(era.templateWeights)) {
          referencedIds.add(genId);
        }
      }
    }

    const orphans = generators.filter(g => g.enabled !== false && !referencedIds.has(g.id));

    if (orphans.length === 0) return null;

    return {
      id: 'orphan-generators',
      title: 'Generators not referenced in any era',
      message: 'These generators are not referenced in any era\'s templateWeights. They will never execute during simulation.',
      severity: 'warning',
      affectedItems: orphans.map(g => ({
        id: g.id,
        label: g.name || g.id,
        detail: 'Not in any era templateWeights',
      })),
    };
  },

  /**
   * 10. Orphan Systems (WARNING)
   */
  orphanSystems: (eras, systems) => {
    const referencedIds = new Set();
    for (const era of eras) {
      if (era.systemModifiers) {
        for (const sysId of Object.keys(era.systemModifiers)) {
          referencedIds.add(sysId);
        }
      }
    }

    // Framework systems that always run
    const frameworkSystems = new Set(['era_spawner', 'era_transition', 'universal_catalyst']);

    const orphans = systems.filter(s => {
      const id = s.config?.id;
      return id && !frameworkSystems.has(id) && !referencedIds.has(id);
    });

    if (orphans.length === 0) return null;

    return {
      id: 'orphan-systems',
      title: 'Systems not referenced in any era',
      message: 'These systems are not referenced in any era\'s systemModifiers. They may not run with intended weights.',
      severity: 'warning',
      affectedItems: orphans.map(s => ({
        id: s.config?.id,
        label: s.config?.name || s.config?.id,
        detail: 'Not in any era systemModifiers',
      })),
    };
  },

  /**
   * 11. Zero-Weight Generators in All Eras (WARNING)
   */
  zeroWeightGenerators: (eras, generators) => {
    const zeroInAll = [];

    for (const gen of generators) {
      if (gen.enabled === false) continue;

      let hasNonZeroWeight = false;
      for (const era of eras) {
        const weight = era.templateWeights?.[gen.id];
        if (weight !== undefined && weight > 0) {
          hasNonZeroWeight = true;
          break;
        }
      }

      // Check if it's referenced at all
      const isReferenced = eras.some(e => e.templateWeights?.[gen.id] !== undefined);

      if (isReferenced && !hasNonZeroWeight) {
        zeroInAll.push(gen);
      }
    }

    if (zeroInAll.length === 0) return null;

    return {
      id: 'zero-weight-generators',
      title: 'Generators with zero weight in all eras',
      message: 'These generators are referenced in era templateWeights but always have weight 0. They are effectively disabled but not obviously so.',
      severity: 'warning',
      affectedItems: zeroInAll.map(g => ({
        id: g.id,
        label: g.name || g.id,
        detail: 'Weight is 0 in all eras where referenced',
      })),
    };
  },

  /**
   * 12. Invalid Subtype References (WARNING)
   */
  invalidSubtypeRef: (schema, generators, pressures) => {
    // Build map of valid subtypes per kind
    const subtypesByKind = {};
    for (const ek of (schema.entityKinds || [])) {
      subtypesByKind[ek.kind] = new Set((ek.subtypes || []).map(s => s.id));
    }

    const invalid = [];

    // Check generators
    for (const gen of generators) {
      if (gen.enabled === false) continue;
      if (gen.creation) {
        for (const c of gen.creation) {
          if (c.kind && c.subtype && subtypesByKind[c.kind]) {
            if (!subtypesByKind[c.kind].has(c.subtype)) {
              invalid.push({ kind: c.kind, subtype: c.subtype, source: `generator "${gen.id}"` });
            }
          }
        }
      }
    }

    // Check pressures
    for (const p of pressures) {
      const checkFactors = (factors, source) => {
        for (const f of (factors || [])) {
          if (f.kind && f.subtype && subtypesByKind[f.kind]) {
            if (!subtypesByKind[f.kind].has(f.subtype)) {
              invalid.push({ kind: f.kind, subtype: f.subtype, source });
            }
          }
          if (f.numerator?.kind && f.numerator?.subtype && subtypesByKind[f.numerator.kind]) {
            if (!subtypesByKind[f.numerator.kind].has(f.numerator.subtype)) {
              invalid.push({ kind: f.numerator.kind, subtype: f.numerator.subtype, source });
            }
          }
        }
      };
      checkFactors(p.growth?.positiveFeedback, `pressure "${p.id}"`);
      checkFactors(p.growth?.negativeFeedback, `pressure "${p.id}"`);
    }

    if (invalid.length === 0) return null;

    return {
      id: 'invalid-subtype-ref',
      title: 'Invalid subtype references',
      message: 'These configurations reference subtypes that do not exist for the specified entity kind.',
      severity: 'warning',
      affectedItems: invalid.map(i => ({
        id: `${i.kind}:${i.subtype}`,
        label: `${i.kind}:${i.subtype}`,
        detail: `In ${i.source}`,
      })),
    };
  },

  /**
   * 13. Invalid Status References (WARNING)
   */
  invalidStatusRef: (schema, generators) => {
    // Build map of valid statuses per kind
    const statusesByKind = {};
    for (const ek of (schema.entityKinds || [])) {
      statusesByKind[ek.kind] = new Set((ek.statuses || []).map(s => s.id));
    }

    const invalid = [];

    for (const gen of generators) {
      if (gen.enabled === false) continue;
      if (gen.creation) {
        for (const c of gen.creation) {
          if (c.kind && c.status && statusesByKind[c.kind]) {
            if (!statusesByKind[c.kind].has(c.status)) {
              invalid.push({ kind: c.kind, status: c.status, source: `generator "${gen.id}"` });
            }
          }
        }
      }
    }

    if (invalid.length === 0) return null;

    return {
      id: 'invalid-status-ref',
      title: 'Invalid status references',
      message: 'These generators set entity statuses that are not valid for the entity kind.',
      severity: 'warning',
      affectedItems: invalid.map(i => ({
        id: `${i.kind}:${i.status}`,
        label: `${i.kind} status "${i.status}"`,
        detail: `In ${i.source}`,
      })),
    };
  },

  /**
   * 14. Invalid Culture References (WARNING)
   */
  invalidCultureRef: (schema, _entityKinds) => {
    const validCultures = new Set((schema.cultures || []).map(c => c.id));
    const invalid = [];

    // Check semantic plane regions
    for (const ek of (schema.entityKinds || [])) {
      if (ek.semanticPlane?.regions) {
        for (const r of ek.semanticPlane.regions) {
          if (r.culture && !validCultures.has(r.culture)) {
            invalid.push({ culture: r.culture, source: `${ek.kind} region "${r.id}"` });
          }
        }
      }
    }

    if (invalid.length === 0) return null;

    return {
      id: 'invalid-culture-ref',
      title: 'Invalid culture references',
      message: 'These semantic plane regions reference cultures that do not exist. Name generation may fail.',
      severity: 'warning',
      affectedItems: invalid.map(i => ({
        id: i.culture,
        label: i.culture,
        detail: `In ${i.source}`,
      })),
    };
  },

  /**
   * 15. Numeric Range Validation (WARNING)
   */
  numericRangeIssues: (pressures, eras) => {
    const issues = [];

    // Check pressures
    for (const p of pressures) {
      if (p.initialValue !== undefined && (p.initialValue < 0 || p.initialValue > 100)) {
        issues.push({ source: `pressure "${p.id}"`, field: 'initialValue', value: p.initialValue, expected: '0-100' });
      }
      if (p.decay !== undefined && p.decay < 0) {
        issues.push({ source: `pressure "${p.id}"`, field: 'decay', value: p.decay, expected: '>= 0' });
      }
    }

    // Check era weights
    for (const era of eras) {
      if (era.templateWeights) {
        for (const [genId, weight] of Object.entries(era.templateWeights)) {
          if (weight < 0) {
            issues.push({ source: `era "${era.id}"`, field: `templateWeights.${genId}`, value: weight, expected: '>= 0' });
          }
        }
      }
      if (era.systemModifiers) {
        for (const [sysId, mod] of Object.entries(era.systemModifiers)) {
          if (mod < 0) {
            issues.push({ source: `era "${era.id}"`, field: `systemModifiers.${sysId}`, value: mod, expected: '>= 0' });
          }
        }
      }
    }

    if (issues.length === 0) return null;

    return {
      id: 'numeric-range-issues',
      title: 'Values outside expected ranges',
      message: 'These configuration values are outside their expected ranges, which may cause unexpected behavior.',
      severity: 'warning',
      affectedItems: issues.map(i => ({
        id: `${i.source}:${i.field}`,
        label: `${i.source}: ${i.field}`,
        detail: `Value: ${i.value}, Expected: ${i.expected}`,
      })),
    };
  },
};

// ============================================================================
// RUN ALL VALIDATIONS
// ============================================================================

function runValidations(schema, eras, pressures, generators, systems) {
  const results = {
    errors: [],
    warnings: [],
  };

  // Run each validation rule
  const rules = [
    () => validationRules.invalidGeneratorFormat(schema, generators),
    () => validationRules.invalidEntityKind(schema, generators, pressures, systems),
    () => validationRules.invalidRelationshipKind(schema, generators, pressures, systems),
    () => validationRules.invalidPressureId(pressures, generators, systems),
    () => validationRules.invalidEraTemplateRef(eras, generators),
    () => validationRules.invalidEraSystemRef(eras, systems),
    () => validationRules.pressureWithoutSources(pressures, generators, systems),
    () => validationRules.pressureWithoutSinks(pressures, generators, systems),
    () => validationRules.generatorMissingLineage(generators),
    () => validationRules.orphanGenerators(eras, generators),
    () => validationRules.orphanSystems(eras, systems),
    () => validationRules.zeroWeightGenerators(eras, generators),
    () => validationRules.invalidSubtypeRef(schema, generators, pressures),
    () => validationRules.invalidStatusRef(schema, generators),
    () => validationRules.invalidCultureRef(schema),
    () => validationRules.numericRangeIssues(pressures, eras),
  ];

  for (const rule of rules) {
    const result = rule();
    if (result) {
      if (result.severity === 'error') {
        results.errors.push(result);
      } else {
        results.warnings.push(result);
      }
    }
  }

  return results;
}

function getOverallStatus(results) {
  if (results.errors.length > 0) return 'error';
  if (results.warnings.length > 0) return 'warning';
  return 'clean';
}

// ============================================================================
// UI COMPONENTS
// ============================================================================

function IssueCard({ issue, onItemClick }) {
  const [expanded, setExpanded] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [hoveredItem, setHoveredItem] = useState(null);

  const severityStyles = {
    error: { ...styles.issueSeverity, ...styles.statusError },
    warning: { ...styles.issueSeverity, ...styles.statusWarning },
  };

  const icons = {
    error: '❌',
    warning: '⚠️',
  };

  return (
    <div style={styles.issueCard}>
      <div
        style={{
          ...styles.issueHeader,
          ...(hovering ? styles.issueHeaderHover : {}),
        }}
        onClick={() => setExpanded(!expanded)}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
      >
        <span style={styles.issueIcon}>{icons[issue.severity]}</span>
        <span style={styles.issueTitle}>{issue.title}</span>
        <span style={styles.issueCount}>{issue.affectedItems.length}</span>
        <span style={severityStyles[issue.severity]}>
          {issue.severity.toUpperCase()}
        </span>
        <span style={{
          ...styles.issueExpandIcon,
          transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
        }}>▼</span>
      </div>
      {expanded && (
        <div style={styles.issueContent}>
          <div style={styles.issueMessage}>{issue.message}</div>
          <div style={styles.affectedItems}>
            {issue.affectedItems.map(item => (
              <div key={item.id} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span
                  style={{
                    ...styles.affectedItem,
                    ...(hoveredItem === item.id ? styles.affectedItemHover : {}),
                  }}
                  title={item.detail}
                  onClick={(e) => {
                    e.stopPropagation();
                    onItemClick?.(item.id);
                  }}
                  onMouseEnter={() => setHoveredItem(item.id)}
                  onMouseLeave={() => setHoveredItem(null)}
                >
                  {item.label}
                </span>
                {item.detail && (
                  <span style={styles.detailRow}>{item.detail}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ValidationEditor({
  schema = { entityKinds: [], relationshipKinds: [], cultures: [], tagRegistry: [] },
  eras = [],
  pressures = [],
  generators = [],
  systems = [],
  usageMap = null,
  namingData = {},
  onNavigateToGenerator,
}) {
  const validationResults = useMemo(() =>
    runValidations(schema, eras, pressures, generators, systems),
    [schema, eras, pressures, generators, systems]
  );

  // Count orphans from usageMap for summary
  const orphanCounts = useMemo(() => {
    if (!usageMap?.validation?.orphans) return { generators: 0, systems: 0, pressures: 0, total: 0 };
    const orphans = usageMap.validation.orphans;
    const generators = orphans.filter(o => o.type === 'generator').length;
    const systems = orphans.filter(o => o.type === 'system').length;
    const pressures = orphans.filter(o => o.type === 'pressure').length;
    return { generators, systems, pressures, total: generators + systems + pressures };
  }, [usageMap]);

  const overallStatus = getOverallStatus(validationResults);
  const totalIssues = validationResults.errors.length + validationResults.warnings.length;

  const statusBadgeStyle = {
    ...styles.statusBadge,
    ...(overallStatus === 'clean' ? styles.statusClean :
        overallStatus === 'warning' ? styles.statusWarning :
        styles.statusError),
  };

  const handleItemClick = (itemId) => {
    if (onNavigateToGenerator) {
      onNavigateToGenerator(itemId);
    }
  };

  // Count total affected items
  const totalAffectedItems = [...validationResults.errors, ...validationResults.warnings]
    .reduce((sum, issue) => sum + issue.affectedItems.length, 0);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <h1 style={styles.title}>
              Validation
              <span style={statusBadgeStyle}>
                {overallStatus === 'clean' ? 'All Clear' :
                 `${totalIssues} ${totalIssues === 1 ? 'Issue' : 'Issues'}`}
              </span>
            </h1>
            <p style={styles.subtitle}>
              Pre-run validation checks for your world configuration.
              Fix issues here before running the simulation.
            </p>
          </div>
          {totalIssues > 0 && (
            <div style={styles.exportRow}>
              <button
                style={styles.exportButton}
                onClick={() => exportAsJson(validationResults)}
                title="Export validation report as JSON"
              >
                Export JSON
              </button>
              <button
                style={styles.exportButton}
                onClick={() => exportAsCsv(validationResults)}
                title="Export validation report as CSV"
              >
                Export CSV
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div style={{ ...styles.summaryCards, gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <div style={styles.summaryCard}>
          <div style={{ ...styles.summaryValue, color: STATUS_COLORS.error }}>
            {validationResults.errors.length}
          </div>
          <div style={styles.summaryLabel}>Errors</div>
        </div>
        <div style={styles.summaryCard}>
          <div style={{ ...styles.summaryValue, color: STATUS_COLORS.warning }}>
            {validationResults.warnings.length}
          </div>
          <div style={styles.summaryLabel}>Warnings</div>
        </div>
        <div style={styles.summaryCard}>
          <div style={{ ...styles.summaryValue, color: orphanCounts.total > 0 ? '#9ca3af' : '#60a5fa' }}>
            {orphanCounts.total}
          </div>
          <div style={styles.summaryLabel}>Unused</div>
        </div>
        <div style={styles.summaryCard}>
          <div style={{ ...styles.summaryValue, color: '#60a5fa' }}>
            {totalAffectedItems}
          </div>
          <div style={styles.summaryLabel}>Affected Items</div>
        </div>
      </div>

      {/* Clean state */}
      {overallStatus === 'clean' && (
        <div style={styles.cleanState}>
          <div style={styles.cleanIcon}>✓</div>
          <div style={styles.cleanTitle}>All Validations Passed</div>
          <div style={styles.cleanMessage}>
            Your configuration looks good. No issues detected.
          </div>
        </div>
      )}

      {/* Errors section */}
      {validationResults.errors.length > 0 && (
        <div style={styles.section}>
          <div style={styles.sectionHeader}>
            <div style={styles.sectionTitle}>
              <span>❌</span>
              Errors
            </div>
            <span style={{ ...styles.sectionCount, ...styles.statusError }}>
              {validationResults.errors.length}
            </span>
          </div>
          <div style={styles.issueList}>
            {validationResults.errors.map(error => (
              <IssueCard
                key={error.id}
                issue={error}
                onItemClick={handleItemClick}
              />
            ))}
          </div>
        </div>
      )}

      {/* Warnings section */}
      {validationResults.warnings.length > 0 && (
        <div style={styles.section}>
          <div style={styles.sectionHeader}>
            <div style={styles.sectionTitle}>
              <span>⚠️</span>
              Warnings
            </div>
            <span style={styles.sectionCount}>
              {validationResults.warnings.length}
            </span>
          </div>
          <div style={styles.issueList}>
            {validationResults.warnings.map(warning => (
              <IssueCard
                key={warning.id}
                issue={warning}
                onItemClick={handleItemClick}
              />
            ))}
          </div>
        </div>
      )}

      {/* Dependency Viewer */}
      {usageMap && (
        <div style={{ marginBottom: '24px' }}>
          <DependencyViewer usageMap={usageMap} />
        </div>
      )}

      {/* Naming Profile Mappings */}
      {Object.keys(namingData).length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <NamingProfileMappingViewer
            generators={generators}
            schema={schema}
            namingData={namingData}
          />
        </div>
      )}

      {/* Rule info */}
      <div style={styles.ruleInfo}>
        <div style={styles.ruleTitle}>Active Validation Rules ({Object.keys(validationRules).length})</div>
        <ul style={styles.ruleList}>
          <li style={styles.ruleItem}>
            <span style={{ ...styles.ruleBullet, color: STATUS_COLORS.error }}>●</span>
            <strong>Format & Reference Validation:</strong> Generator shape, entity kinds, relationship kinds, pressure IDs, era references
          </li>
          <li style={styles.ruleItem}>
            <span style={{ ...styles.ruleBullet, color: STATUS_COLORS.warning }}>●</span>
            <strong>Balance Validation:</strong> Pressure sources/sinks, orphan generators/systems
          </li>
          <li style={styles.ruleItem}>
            <span style={{ ...styles.ruleBullet, color: STATUS_COLORS.warning }}>●</span>
            <strong>Configuration Quality:</strong> Subtypes, statuses, cultures, numeric ranges
          </li>
        </ul>
      </div>
    </div>
  );
}

/**
 * Export validation status calculation for use by parent
 */
export function getValidationStatus(schema, eras, pressures, generators, systems) {
  const results = runValidations(
    schema || { entityKinds: [], relationshipKinds: [], cultures: [], tagRegistry: [] },
    eras || [],
    pressures || [],
    generators || [],
    systems || []
  );
  return {
    status: getOverallStatus(results),
    errorCount: results.errors.length,
    warningCount: results.warnings.length,
    totalIssues: results.errors.length + results.warnings.length,
  };
}
