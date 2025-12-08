/**
 * Helper functions to collect references from configuration
 */

/**
 * Helper to collect all entity kind references from various config locations
 */
export function collectEntityKindRefs(generators, pressures, systems) {
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
export function collectRelationshipKindRefs(generators, pressures, systems) {
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
 * Helper to collect tag references from generators, systems, and pressures
 */
export function collectTagRefs(generators, systems, pressures) {
  const refs = [];

  // From generators - creation tags
  for (const gen of generators) {
    if (gen.enabled === false) continue;
    if (gen.creation) {
      for (const c of gen.creation) {
        if (c.tags && typeof c.tags === 'object') {
          for (const tag of Object.keys(c.tags)) {
            refs.push({ tag, source: `generator "${gen.id}" creation`, sourceId: gen.id, sourceType: 'generator' });
          }
        }
      }
    }
  }

  // From systems - thresholdTrigger conditions/actions, tagDiffusion convergence/divergence
  for (const sys of systems) {
    const cfg = sys.config;
    if (!cfg) continue;
    const sysId = cfg.id || sys.id;

    // thresholdTrigger
    if (sys.systemType === 'thresholdTrigger') {
      for (const cond of (cfg.conditions || [])) {
        if (cond.tag) {
          refs.push({ tag: cond.tag, source: `system "${sysId}" condition`, sourceId: sysId, sourceType: 'system' });
        }
        if (cond.type === 'has_any_tag' && Array.isArray(cond.tags)) {
          for (const tag of cond.tags) {
            refs.push({ tag, source: `system "${sysId}" has_any_tag`, sourceId: sysId, sourceType: 'system' });
          }
        }
      }
      for (const action of (cfg.actions || [])) {
        if (action.tag) {
          refs.push({ tag: action.tag, source: `system "${sysId}" action`, sourceId: sysId, sourceType: 'system' });
        }
      }
    }

    // tagDiffusion
    if (sys.systemType === 'tagDiffusion') {
      for (const tag of (cfg.convergence?.tags || [])) {
        refs.push({ tag, source: `system "${sysId}" convergence`, sourceId: sysId, sourceType: 'system' });
      }
      for (const tag of (cfg.divergence?.tags || [])) {
        refs.push({ tag, source: `system "${sysId}" divergence`, sourceId: sysId, sourceType: 'system' });
      }
    }
  }

  // From pressures - tag_count factors
  for (const p of pressures) {
    const checkFactors = (factors, source) => {
      for (const f of (factors || [])) {
        if (f.tag) {
          refs.push({ tag: f.tag, source, sourceId: p.id, sourceType: 'pressure' });
        }
        if (f.tags && Array.isArray(f.tags)) {
          for (const tag of f.tags) {
            refs.push({ tag, source, sourceId: p.id, sourceType: 'pressure' });
          }
        }
      }
    };
    checkFactors(p.growth?.positiveFeedback, `pressure "${p.id}" positiveFeedback`);
    checkFactors(p.growth?.negativeFeedback, `pressure "${p.id}" negativeFeedback`);
  }

  return refs;
}

/**
 * Helper to collect pressure ID references from all configuration sources
 */
export function collectPressureIdRefs(generators, systems, eras = [], actions = []) {
  const refs = [];

  // From generators
  for (const gen of generators) {
    if (gen.enabled === false) continue;

    // State updates (modify_pressure effects)
    if (gen.stateUpdates) {
      for (const u of gen.stateUpdates) {
        if (u.type === 'modify_pressure' && u.pressureId) {
          refs.push({ id: u.pressureId, source: `generator "${gen.id}" stateUpdates`, sourceId: gen.id, sourceType: 'generator' });
        }
      }
    }

    // Applicability rules (pressure_threshold, pressure_any_above)
    if (gen.applicability) {
      collectPressureRefsFromApplicability(gen.applicability, `generator "${gen.id}" applicability`, gen.id, 'generator', refs);
    }

    // Creation rules with fromPressure subtype selection
    if (gen.creation) {
      for (const c of gen.creation) {
        if (c.subtype && typeof c.subtype === 'object' && c.subtype.fromPressure) {
          for (const pId of Object.keys(c.subtype.fromPressure)) {
            refs.push({ id: pId, source: `generator "${gen.id}" creation fromPressure`, sourceId: gen.id, sourceType: 'generator' });
          }
        }
      }
    }
  }

  // From systems
  for (const sys of systems) {
    const cfg = sys.config;
    if (!cfg) continue;
    const sysId = cfg.id || sys.id;

    // Common pressureChanges field
    if (cfg.pressureChanges) {
      for (const pId of Object.keys(cfg.pressureChanges)) {
        refs.push({ id: pId, source: `system "${sysId}" pressureChanges`, sourceId: sysId, sourceType: 'system' });
      }
    }

    // ThresholdTrigger conditions and actions
    if (sys.systemType === 'thresholdTrigger') {
      // Conditions (pressure_above, pressure_below)
      for (const cond of (cfg.conditions || [])) {
        if ((cond.type === 'pressure_above' || cond.type === 'pressure_below') && cond.pressureId) {
          refs.push({ id: cond.pressureId, source: `system "${sysId}" condition`, sourceId: sysId, sourceType: 'system' });
        }
      }
      // Actions (modify_pressure)
      for (const action of (cfg.actions || [])) {
        if (action.type === 'modify_pressure' && action.pressureId) {
          refs.push({ id: action.pressureId, source: `system "${sysId}" action`, sourceId: sysId, sourceType: 'system' });
        }
      }
    }

    // TagDiffusion divergencePressure
    if (sys.systemType === 'tagDiffusion' && cfg.divergencePressure?.pressureName) {
      refs.push({ id: cfg.divergencePressure.pressureName, source: `system "${sysId}" divergencePressure`, sourceId: sysId, sourceType: 'system' });
    }
  }

  // From eras
  for (const era of eras) {
    // Exit conditions (pressure thresholds)
    if (era.exitConditions) {
      for (const cond of era.exitConditions) {
        if (cond.type === 'pressure' && cond.pressureId) {
          refs.push({ id: cond.pressureId, source: `era "${era.id}" exitCondition`, sourceId: era.id, sourceType: 'era' });
        }
      }
    }

    // Entry conditions (pressure thresholds)
    if (era.entryConditions) {
      for (const cond of era.entryConditions) {
        if (cond.type === 'pressure' && cond.pressureId) {
          refs.push({ id: cond.pressureId, source: `era "${era.id}" entryCondition`, sourceId: era.id, sourceType: 'era' });
        }
      }
    }

    // Exit effects (pressure changes)
    if (era.exitEffects?.pressureChanges) {
      for (const pId of Object.keys(era.exitEffects.pressureChanges)) {
        refs.push({ id: pId, source: `era "${era.id}" exitEffects`, sourceId: era.id, sourceType: 'era' });
      }
    }

    // Entry effects (pressure changes)
    if (era.entryEffects?.pressureChanges) {
      for (const pId of Object.keys(era.entryEffects.pressureChanges)) {
        refs.push({ id: pId, source: `era "${era.id}" entryEffects`, sourceId: era.id, sourceType: 'era' });
      }
    }
  }

  // From actions
  for (const action of actions) {
    if (action.enabled === false) continue;
    const actionId = action.id || action.name;

    // Actor required pressures
    if (action.actor?.requiredPressures) {
      for (const pId of Object.keys(action.actor.requiredPressures)) {
        refs.push({ id: pId, source: `action "${actionId}" actor.requiredPressures`, sourceId: actionId, sourceType: 'action' });
      }
    }

    // Probability pressure modifiers
    if (action.probability?.pressureModifiers) {
      for (const pId of action.probability.pressureModifiers) {
        refs.push({ id: pId, source: `action "${actionId}" probability.pressureModifiers`, sourceId: actionId, sourceType: 'action' });
      }
    }

    // Outcome pressure changes
    if (action.outcome?.pressureChanges) {
      for (const pId of Object.keys(action.outcome.pressureChanges)) {
        refs.push({ id: pId, source: `action "${actionId}" outcome.pressureChanges`, sourceId: actionId, sourceType: 'action' });
      }
    }
  }

  return refs;
}

/**
 * Helper to collect pressure refs from applicability rules (recursive)
 */
function collectPressureRefsFromApplicability(rules, source, sourceId, sourceType, refs) {
  for (const rule of rules) {
    if (rule.type === 'pressure_threshold' && rule.pressureId) {
      refs.push({ id: rule.pressureId, source, sourceId, sourceType });
    }
    if (rule.type === 'pressure_any_above' && rule.pressureIds) {
      for (const pId of rule.pressureIds) {
        refs.push({ id: pId, source, sourceId, sourceType });
      }
    }
    // Recurse into nested rules (and/or groups)
    if (rule.rules) {
      collectPressureRefsFromApplicability(rule.rules, source, sourceId, sourceType, refs);
    }
  }
}
