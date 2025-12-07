/**
 * Validation rule implementations
 */

import {
  collectEntityKindRefs,
  collectRelationshipKindRefs,
  collectTagRefs,
  collectPressureIdRefs,
} from './collectors';

export const validationRules = {
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
   * 8. Generator Missing Lineage (WARNING)
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
            // Skip DSL-based subtypes (objects like {inherit: ...} or {random: [...]})
            if (typeof c.subtype === 'object') {
              // For random subtypes, validate the array values
              if (c.subtype.random && Array.isArray(c.subtype.random)) {
                for (const st of c.subtype.random) {
                  if (!subtypesByKind[c.kind].has(st)) {
                    invalid.push({ kind: c.kind, subtype: st, source: `generator "${gen.id}"` });
                  }
                }
              }
              // For inherit subtypes, skip validation (runtime-resolved)
              continue;
            }
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
      affectedItems: invalid.map((i, idx) => {
        const subtypeStr = typeof i.subtype === 'object' ? JSON.stringify(i.subtype) : i.subtype;
        return {
          id: `${i.kind}:${subtypeStr}:${i.source}:${idx}`,
          label: `${i.kind}:${subtypeStr}`,
          detail: `In ${i.source}`,
        };
      }),
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
      affectedItems: invalid.map((i, idx) => ({
        id: `${i.kind}:${i.status}:${i.source}:${idx}`,
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
   * 15. Undefined Tag References (WARNING)
   */
  undefinedTagRefs: (schema, generators, systems, pressures) => {
    const definedTags = new Set((schema.tagRegistry || []).map(t => t.tag));
    const refs = collectTagRefs(generators, systems, pressures);

    // Find tags that are referenced but not in registry
    const undefinedRefs = refs.filter(r => !definedTags.has(r.tag));

    if (undefinedRefs.length === 0) return null;

    // Group by tag for cleaner display
    const byTag = {};
    for (const r of undefinedRefs) {
      if (!byTag[r.tag]) byTag[r.tag] = [];
      byTag[r.tag].push(r);
    }

    return {
      id: 'undefined-tag-refs',
      title: 'Tags used but not in registry',
      message: 'These tags are referenced in generators, systems, or pressures but are not defined in the tag registry. They will still work at runtime but lack metadata like conflictingTags.',
      severity: 'warning',
      affectedItems: Object.entries(byTag).map(([tag, sources]) => ({
        id: tag,
        label: tag,
        detail: `Used by: ${sources.map(s => s.source).join(', ')}`,
      })),
    };
  },

  /**
   * 16. Conflicting Tags (WARNING) - Tags assigned together that are marked as conflicting
   */
  conflictingTagsInUse: (schema, generators) => {
    const tagRegistry = schema.tagRegistry || [];
    const conflictMap = {};
    for (const t of tagRegistry) {
      if (t.conflictingTags && t.conflictingTags.length > 0) {
        conflictMap[t.tag] = new Set(t.conflictingTags);
      }
    }

    const issues = [];

    // Check generators that assign multiple tags
    for (const gen of generators) {
      if (gen.enabled === false) continue;
      if (gen.creation) {
        for (const c of gen.creation) {
          if (c.tags && typeof c.tags === 'object') {
            const assignedTags = Object.keys(c.tags).filter(t => c.tags[t] === true);
            // Check for conflicts among assigned tags
            for (let i = 0; i < assignedTags.length; i++) {
              for (let j = i + 1; j < assignedTags.length; j++) {
                const tagA = assignedTags[i];
                const tagB = assignedTags[j];
                if (conflictMap[tagA]?.has(tagB) || conflictMap[tagB]?.has(tagA)) {
                  issues.push({
                    generator: gen.id,
                    tagA,
                    tagB,
                    entityKind: c.kind,
                  });
                }
              }
            }
          }
        }
      }
    }

    if (issues.length === 0) return null;

    return {
      id: 'conflicting-tags-in-use',
      title: 'Conflicting tags assigned together',
      message: 'These generators assign tags that are marked as conflicting in the tag registry. This may produce semantically inconsistent entities.',
      severity: 'warning',
      affectedItems: issues.map((i, idx) => ({
        id: `${i.generator}:${i.tagA}:${i.tagB}:${idx}`,
        label: `${i.tagA} + ${i.tagB}`,
        detail: `In generator "${i.generator}" creating ${i.entityKind}`,
      })),
    };
  },

  /**
   * 17. Numeric Range Validation (WARNING)
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

/**
 * Run all validations
 */
export function runValidations(schema, eras, pressures, generators, systems) {
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
    () => validationRules.undefinedTagRefs(schema, generators, systems, pressures),
    () => validationRules.conflictingTagsInUse(schema, generators),
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

export function getOverallStatus(results) {
  if (results.errors.length > 0) return 'error';
  if (results.warnings.length > 0) return 'warning';
  return 'clean';
}
