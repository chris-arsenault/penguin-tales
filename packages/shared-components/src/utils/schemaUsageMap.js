/**
 * Schema Usage Map - Computes bidirectional reference tracking across all config elements
 *
 * This utility analyzes the relationships between:
 * - Schema (entity kinds, relationship kinds, statuses, subtypes, tags)
 * - Pressures (and their feedback factors)
 * - Eras (and their generator/system weights)
 * - Generators (and their entity/relationship references)
 * - Systems (and their entity/relationship/pressure references)
 * - Actions (and their actor/target/outcome references)
 *
 * Returns a comprehensive map showing:
 * 1. Where each element is used (forward references)
 * 2. What each element references (backward references)
 * 3. Validation status for each reference
 */

/**
 * Compute complete usage map for all schema elements
 */
export function computeUsageMap(schema, pressures, eras, generators, systems, actions) {
  const usageMap = {
    // Schema element usage tracking
    entityKinds: {},      // { kindId: { generators: [], systems: [], actions: [], pressures: [] } }
    subtypes: {},         // { subtype: { generators: [], systems: [], actions: [] } }
    statuses: {},         // { status: { generators: [], systems: [], actions: [] } }
    relationshipKinds: {},// { kindId: { generators: [], systems: [], actions: [], pressures: [] } }
    tags: {},             // { tag: { pressures: [], systems: [], generators: [] } }

    // Cross-tab reference tracking
    pressures: {},        // { pressureId: { generators: [], systems: [], actions: [], eras: [] } }
    generators: {},       // { generatorId: { eras: [{ id, weight }] } }
    systems: {},          // { systemId: { eras: [{ id, weight }] } }

    // Validation results
    validation: {
      invalidRefs: [],    // [{ type, id, field, refType, refId, location }]
      orphans: [],        // [{ type, id, reason }]
      compatibility: [],  // [{ type, id, field, issue }]
    }
  };

  // Initialize from schema
  initializeFromSchema(usageMap, schema);

  // Initialize pressure tracking
  initializePressures(usageMap, pressures);

  // Initialize generator/system tracking
  initializeGeneratorsAndSystems(usageMap, generators, systems);

  // Scan pressures for schema references
  scanPressureReferences(usageMap, pressures, schema);

  // Scan eras for generator/system references
  scanEraReferences(usageMap, eras, generators, systems);

  // Scan generators for all references
  scanGeneratorReferences(usageMap, generators, schema, pressures);

  // Scan systems for all references
  scanSystemReferences(usageMap, systems, schema, pressures);

  // Scan actions for all references
  scanActionReferences(usageMap, actions, schema, pressures);

  // Detect orphans (unused elements)
  detectOrphans(usageMap, schema, pressures, generators, systems);

  // Check relationship compatibility
  checkRelationshipCompatibility(usageMap, generators, actions, schema);

  return usageMap;
}

function initializeFromSchema(usageMap, schema) {
  // Entity kinds
  (schema?.entityKinds || []).forEach(ek => {
    usageMap.entityKinds[ek.kind] = { generators: [], systems: [], actions: [], pressures: [] };

    // Subtypes
    (ek.subtypes || []).forEach(st => {
      const subtypeId = typeof st === 'string' ? st : st.id;
      if (!usageMap.subtypes[subtypeId]) {
        usageMap.subtypes[subtypeId] = { generators: [], systems: [], actions: [] };
      }
    });

    // Statuses
    (ek.statuses || []).forEach(s => {
      const statusId = typeof s === 'string' ? s : s.id;
      if (!usageMap.statuses[statusId]) {
        usageMap.statuses[statusId] = { generators: [], systems: [], actions: [] };
      }
    });
  });

  // Relationship kinds
  (schema?.relationshipKinds || []).forEach(rk => {
    usageMap.relationshipKinds[rk.kind] = {
      generators: [],
      systems: [],
      actions: [],
      pressures: [],
      srcKinds: rk.srcKinds || [],
      dstKinds: rk.dstKinds || [],
    };
  });

  // Tags (from tag registry if available)
  (schema?.tagRegistry || []).forEach(t => {
    const tagId = typeof t === 'string' ? t : t.tag;
    usageMap.tags[tagId] = { pressures: [], systems: [], generators: [] };
  });
}

function initializePressures(usageMap, pressures) {
  (pressures || []).forEach(p => {
    usageMap.pressures[p.id] = { generators: [], systems: [], actions: [], feedbackSources: [], feedbackSinks: [] };
  });
}

function initializeGeneratorsAndSystems(usageMap, generators, systems) {
  (generators || []).forEach(g => {
    usageMap.generators[g.id] = { eras: [] };
  });

  (systems || []).forEach(s => {
    const sysId = s.config?.id || s.id;
    usageMap.systems[sysId] = { eras: [] };
  });
}

function scanPressureReferences(usageMap, pressures, schema) {
  (pressures || []).forEach(pressure => {
    const scanFeedbackFactors = (factors, isPositive) => {
      (factors || []).forEach(factor => {
        // Track entity kind references
        if (factor.kind && usageMap.entityKinds[factor.kind]) {
          usageMap.entityKinds[factor.kind].pressures.push({ id: pressure.id, factor: factor.type });
        } else if (factor.kind) {
          usageMap.validation.invalidRefs.push({
            type: 'pressure',
            id: pressure.id,
            field: `${isPositive ? 'positive' : 'negative'}Feedback.kind`,
            refType: 'entityKind',
            refId: factor.kind,
            location: `Pressure "${pressure.name || pressure.id}"`,
          });
        }

        // Track relationship kind references
        if (factor.relationshipKinds) {
          factor.relationshipKinds.forEach(rk => {
            if (usageMap.relationshipKinds[rk]) {
              usageMap.relationshipKinds[rk].pressures.push({ id: pressure.id, factor: factor.type });
            } else {
              usageMap.validation.invalidRefs.push({
                type: 'pressure',
                id: pressure.id,
                field: `${isPositive ? 'positive' : 'negative'}Feedback.relationshipKinds`,
                refType: 'relationshipKind',
                refId: rk,
                location: `Pressure "${pressure.name || pressure.id}"`,
              });
            }
          });
        }

        // Track tag references
        if (factor.tag) {
          if (!usageMap.tags[factor.tag]) {
            usageMap.tags[factor.tag] = { pressures: [], systems: [], generators: [], actions: [] };
          }
          usageMap.tags[factor.tag].pressures.push({ id: pressure.id, factor: factor.type });
        }

        // Track tags array (tag_count factor type)
        if (factor.tags && Array.isArray(factor.tags)) {
          factor.tags.forEach(tag => {
            if (!usageMap.tags[tag]) {
              usageMap.tags[tag] = { pressures: [], systems: [], generators: [], actions: [] };
            }
            usageMap.tags[tag].pressures.push({ id: pressure.id, factor: factor.type });
          });
        }

        // Track as feedback source/sink
        if (usageMap.pressures[pressure.id]) {
          if (isPositive) {
            usageMap.pressures[pressure.id].feedbackSources.push(factor);
          } else {
            usageMap.pressures[pressure.id].feedbackSinks.push(factor);
          }
        }
      });
    };

    scanFeedbackFactors(pressure.growth?.positiveFeedback, true);
    scanFeedbackFactors(pressure.growth?.negativeFeedback, false);
  });
}

function scanEraReferences(usageMap, eras, generators, systems) {
  const generatorIds = new Set((generators || []).map(g => g.id));
  const systemIds = new Set((systems || []).map(s => s.config?.id || s.id));

  (eras || []).forEach(era => {
    // Track generator references
    Object.entries(era.templateWeights || {}).forEach(([genId, weight]) => {
      if (usageMap.generators[genId]) {
        usageMap.generators[genId].eras.push({ id: era.id, name: era.name, weight });
      }
      if (!generatorIds.has(genId)) {
        usageMap.validation.invalidRefs.push({
          type: 'era',
          id: era.id,
          field: 'templateWeights',
          refType: 'generator',
          refId: genId,
          location: `Era "${era.name || era.id}"`,
        });
      }
    });

    // Track system references
    Object.entries(era.systemModifiers || {}).forEach(([sysId, weight]) => {
      if (usageMap.systems[sysId]) {
        usageMap.systems[sysId].eras.push({ id: era.id, name: era.name, weight });
      }
      if (!systemIds.has(sysId)) {
        usageMap.validation.invalidRefs.push({
          type: 'era',
          id: era.id,
          field: 'systemModifiers',
          refType: 'system',
          refId: sysId,
          location: `Era "${era.name || era.id}"`,
        });
      }
    });
  });
}

function scanGeneratorReferences(usageMap, generators, schema, pressures) {
  const pressureIds = new Set((pressures || []).map(p => p.id));

  (generators || []).forEach(gen => {
    const genRef = { id: gen.id, name: gen.name };

    // Scan applicability rules
    const scanApplicability = (rules) => {
      (rules || []).forEach(rule => {
        if (rule.kind && usageMap.entityKinds[rule.kind]) {
          usageMap.entityKinds[rule.kind].generators.push(genRef);
        } else if (rule.kind) {
          usageMap.validation.invalidRefs.push({
            type: 'generator',
            id: gen.id,
            field: 'applicability.kind',
            refType: 'entityKind',
            refId: rule.kind,
            location: `Generator "${gen.name || gen.id}"`,
          });
        }

        if (rule.pressureId) {
          if (usageMap.pressures[rule.pressureId]) {
            usageMap.pressures[rule.pressureId].generators.push(genRef);
          }
          if (!pressureIds.has(rule.pressureId)) {
            usageMap.validation.invalidRefs.push({
              type: 'generator',
              id: gen.id,
              field: 'applicability.pressureId',
              refType: 'pressure',
              refId: rule.pressureId,
              location: `Generator "${gen.name || gen.id}"`,
            });
          }
        }

        // Scan tag-based applicability rules
        if (rule.tags && Array.isArray(rule.tags)) {
          rule.tags.forEach(tag => {
            if (!usageMap.tags[tag]) {
              usageMap.tags[tag] = { pressures: [], systems: [], generators: [], actions: [] };
            }
            usageMap.tags[tag].generators.push(genRef);
          });
        }

        // Recurse for nested rules (or/and)
        if (rule.rules) {
          scanApplicability(rule.rules);
        }
      });
    };
    scanApplicability(gen.applicability);

    // Scan target selection
    if (gen.selection?.target) {
      const target = gen.selection.target;
      if (target.kind && usageMap.entityKinds[target.kind]) {
        usageMap.entityKinds[target.kind].generators.push(genRef);
      } else if (target.kind) {
        usageMap.validation.invalidRefs.push({
          type: 'generator',
          id: gen.id,
          field: 'selection.target.kind',
          refType: 'entityKind',
          refId: target.kind,
          location: `Generator "${gen.name || gen.id}"`,
        });
      }
    }

    // Scan entity creation
    (gen.creation || []).forEach((creation, idx) => {
      if (creation.kind && usageMap.entityKinds[creation.kind]) {
        usageMap.entityKinds[creation.kind].generators.push(genRef);
      } else if (creation.kind) {
        usageMap.validation.invalidRefs.push({
          type: 'generator',
          id: gen.id,
          field: `creation[${idx}].kind`,
          refType: 'entityKind',
          refId: creation.kind,
          location: `Generator "${gen.name || gen.id}"`,
        });
      }

      if (creation.subtype && usageMap.subtypes[creation.subtype]) {
        usageMap.subtypes[creation.subtype].generators.push(genRef);
      }

      if (creation.status && usageMap.statuses[creation.status]) {
        usageMap.statuses[creation.status].generators.push(genRef);
      }

      // Scan tags assigned to created entities
      if (creation.tags && typeof creation.tags === 'object') {
        Object.keys(creation.tags).forEach(tag => {
          if (!usageMap.tags[tag]) {
            usageMap.tags[tag] = { pressures: [], systems: [], generators: [], actions: [] };
          }
          usageMap.tags[tag].generators.push(genRef);
        });
      }
    });

    // Scan relationships
    (gen.relationships || []).forEach((rel, idx) => {
      if (rel.kind && usageMap.relationshipKinds[rel.kind]) {
        usageMap.relationshipKinds[rel.kind].generators.push(genRef);
      } else if (rel.kind) {
        usageMap.validation.invalidRefs.push({
          type: 'generator',
          id: gen.id,
          field: `relationships[${idx}].kind`,
          refType: 'relationshipKind',
          refId: rel.kind,
          location: `Generator "${gen.name || gen.id}"`,
        });
      }
    });

    // Scan effects/state updates for pressure references
    (gen.stateUpdates || []).forEach((update, idx) => {
      if (update.pressureId) {
        if (usageMap.pressures[update.pressureId]) {
          usageMap.pressures[update.pressureId].generators.push(genRef);
        }
        if (!pressureIds.has(update.pressureId)) {
          usageMap.validation.invalidRefs.push({
            type: 'generator',
            id: gen.id,
            field: `stateUpdates[${idx}].pressureId`,
            refType: 'pressure',
            refId: update.pressureId,
            location: `Generator "${gen.name || gen.id}"`,
          });
        }
      }
    });
  });
}

function scanSystemReferences(usageMap, systems, schema, pressures) {
  const pressureIds = new Set((pressures || []).map(p => p.id));

  (systems || []).forEach(sys => {
    const sysId = sys.config?.id || sys.id;
    const sysName = sys.config?.name || sysId;
    const sysRef = { id: sysId, name: sysName };
    const config = sys.config || {};

    // Entity filter references
    if (config.entityFilter?.kind) {
      if (usageMap.entityKinds[config.entityFilter.kind]) {
        usageMap.entityKinds[config.entityFilter.kind].systems.push(sysRef);
      } else {
        usageMap.validation.invalidRefs.push({
          type: 'system',
          id: sysId,
          field: 'entityFilter.kind',
          refType: 'entityKind',
          refId: config.entityFilter.kind,
          location: `System "${sysName}"`,
        });
      }
    }

    // Pressure changes
    Object.keys(config.pressureChanges || {}).forEach(pressureId => {
      if (usageMap.pressures[pressureId]) {
        usageMap.pressures[pressureId].systems.push(sysRef);
      }
      if (!pressureIds.has(pressureId)) {
        usageMap.validation.invalidRefs.push({
          type: 'system',
          id: sysId,
          field: 'pressureChanges',
          refType: 'pressure',
          refId: pressureId,
          location: `System "${sysName}"`,
        });
      }
    });

    // Type-specific scanning
    switch (sys.systemType) {
      case 'graphContagion':
        // Scan contagion source
        if (config.contagion?.relationshipKind) {
          const rk = config.contagion.relationshipKind;
          if (usageMap.relationshipKinds[rk]) {
            usageMap.relationshipKinds[rk].systems.push(sysRef);
          } else {
            usageMap.validation.invalidRefs.push({
              type: 'system',
              id: sysId,
              field: 'contagion.relationshipKind',
              refType: 'relationshipKind',
              refId: rk,
              location: `System "${sysName}"`,
            });
          }
        }
        // Scan vectors
        (config.vectors || []).forEach((vector, idx) => {
          if (vector.relationshipKind) {
            if (usageMap.relationshipKinds[vector.relationshipKind]) {
              usageMap.relationshipKinds[vector.relationshipKind].systems.push(sysRef);
            } else {
              usageMap.validation.invalidRefs.push({
                type: 'system',
                id: sysId,
                field: `vectors[${idx}].relationshipKind`,
                refType: 'relationshipKind',
                refId: vector.relationshipKind,
                location: `System "${sysName}"`,
              });
            }
          }
        });
        break;

      case 'connectionEvolution':
        // Scan metric relationship kind
        if (config.metric?.relationshipKind) {
          const rk = config.metric.relationshipKind;
          if (usageMap.relationshipKinds[rk]) {
            usageMap.relationshipKinds[rk].systems.push(sysRef);
          }
        }
        break;

      case 'thresholdTrigger':
        // Scan conditions
        (config.conditions || []).forEach((cond, idx) => {
          if (cond.relationshipKind && usageMap.relationshipKinds[cond.relationshipKind]) {
            usageMap.relationshipKinds[cond.relationshipKind].systems.push(sysRef);
          }
          if (cond.tag) {
            if (!usageMap.tags[cond.tag]) {
              usageMap.tags[cond.tag] = { pressures: [], systems: [], generators: [], actions: [] };
            }
            usageMap.tags[cond.tag].systems.push(sysRef);
          }
          // has_any_tag conditions
          if (cond.type === 'has_any_tag' && Array.isArray(cond.tags)) {
            cond.tags.forEach(tag => {
              if (!usageMap.tags[tag]) {
                usageMap.tags[tag] = { pressures: [], systems: [], generators: [], actions: [] };
              }
              usageMap.tags[tag].systems.push(sysRef);
            });
          }
        });
        // Scan actions
        (config.actions || []).forEach((action, idx) => {
          if (action.tag) {
            if (!usageMap.tags[action.tag]) {
              usageMap.tags[action.tag] = { pressures: [], systems: [], generators: [], actions: [] };
            }
            usageMap.tags[action.tag].systems.push(sysRef);
          }
          if (action.relationshipKind && usageMap.relationshipKinds[action.relationshipKind]) {
            usageMap.relationshipKinds[action.relationshipKind].systems.push(sysRef);
          }
        });
        // Scan clustering relationship kind
        if (config.clusterRelationshipKind && usageMap.relationshipKinds[config.clusterRelationshipKind]) {
          usageMap.relationshipKinds[config.clusterRelationshipKind].systems.push(sysRef);
        }
        break;

      case 'clusterFormation':
        // Scan clustering criteria
        (config.criteria || []).forEach((crit, idx) => {
          if (crit.relationshipKind && usageMap.relationshipKinds[crit.relationshipKind]) {
            usageMap.relationshipKinds[crit.relationshipKind].systems.push(sysRef);
          }
          // shared_tags criteria type
          if (crit.type === 'shared_tags' || crit.type === 'has_tags') {
            (crit.tags || []).forEach(tag => {
              if (!usageMap.tags[tag]) {
                usageMap.tags[tag] = { pressures: [], systems: [], generators: [], actions: [] };
              }
              usageMap.tags[tag].systems.push(sysRef);
            });
          }
        });
        // Scan meta entity kind
        if (config.metaEntity?.kind && usageMap.entityKinds[config.metaEntity.kind]) {
          usageMap.entityKinds[config.metaEntity.kind].systems.push(sysRef);
        }
        break;

      case 'tagDiffusion':
        if (config.connection?.connectionKind && usageMap.relationshipKinds[config.connection.connectionKind]) {
          usageMap.relationshipKinds[config.connection.connectionKind].systems.push(sysRef);
        }
        // Scan convergence/divergence tags
        if (config.convergence?.tags) {
          config.convergence.tags.forEach(tag => {
            if (!usageMap.tags[tag]) {
              usageMap.tags[tag] = { pressures: [], systems: [], generators: [], actions: [] };
            }
            usageMap.tags[tag].systems.push(sysRef);
          });
        }
        if (config.divergence?.tags) {
          config.divergence.tags.forEach(tag => {
            if (!usageMap.tags[tag]) {
              usageMap.tags[tag] = { pressures: [], systems: [], generators: [], actions: [] };
            }
            usageMap.tags[tag].systems.push(sysRef);
          });
        }
        break;
    }
  });
}

function scanActionReferences(usageMap, actions, schema, pressures) {
  const pressureIds = new Set((pressures || []).map(p => p.id));

  (actions || []).forEach(action => {
    const actionRef = { id: action.id, name: action.name };

    // Actor kinds
    (action.actor?.kinds || []).forEach(kind => {
      if (usageMap.entityKinds[kind]) {
        usageMap.entityKinds[kind].actions.push(actionRef);
      } else {
        usageMap.validation.invalidRefs.push({
          type: 'action',
          id: action.id,
          field: 'actor.kinds',
          refType: 'entityKind',
          refId: kind,
          location: `Action "${action.name || action.id}"`,
        });
      }
    });

    // Actor subtypes
    (action.actor?.subtypes || []).forEach(subtype => {
      if (usageMap.subtypes[subtype]) {
        usageMap.subtypes[subtype].actions.push(actionRef);
      }
    });

    // Actor required relationships
    (action.actor?.requiredRelationships || []).forEach(rk => {
      if (usageMap.relationshipKinds[rk]) {
        usageMap.relationshipKinds[rk].actions.push(actionRef);
      } else {
        usageMap.validation.invalidRefs.push({
          type: 'action',
          id: action.id,
          field: 'actor.requiredRelationships',
          refType: 'relationshipKind',
          refId: rk,
          location: `Action "${action.name || action.id}"`,
        });
      }
    });

    // Actor resolution relationship
    if (action.actorResolution?.relationshipKind) {
      const rk = action.actorResolution.relationshipKind;
      if (usageMap.relationshipKinds[rk]) {
        usageMap.relationshipKinds[rk].actions.push(actionRef);
      } else {
        usageMap.validation.invalidRefs.push({
          type: 'action',
          id: action.id,
          field: 'actorResolution.relationshipKind',
          refType: 'relationshipKind',
          refId: rk,
          location: `Action "${action.name || action.id}"`,
        });
      }
    }

    // Actor resolution target kind
    if (action.actorResolution?.targetKind) {
      if (usageMap.entityKinds[action.actorResolution.targetKind]) {
        usageMap.entityKinds[action.actorResolution.targetKind].actions.push(actionRef);
      }
    }

    // Targeting kind
    if (action.targeting?.kind) {
      if (usageMap.entityKinds[action.targeting.kind]) {
        usageMap.entityKinds[action.targeting.kind].actions.push(actionRef);
      } else {
        usageMap.validation.invalidRefs.push({
          type: 'action',
          id: action.id,
          field: 'targeting.kind',
          refType: 'entityKind',
          refId: action.targeting.kind,
          location: `Action "${action.name || action.id}"`,
        });
      }
    }

    // Targeting statuses
    (action.targeting?.statuses || []).forEach(status => {
      if (usageMap.statuses[status]) {
        usageMap.statuses[status].actions.push(actionRef);
      }
    });

    // Targeting exclude/require relationship kinds
    const scanRelationshipFilter = (filter, fieldPrefix) => {
      if (filter?.existingRelationship?.kind) {
        const rk = filter.existingRelationship.kind;
        if (usageMap.relationshipKinds[rk]) {
          usageMap.relationshipKinds[rk].actions.push(actionRef);
        }
      }
      if (filter?.hasRelationship?.kind) {
        const rk = filter.hasRelationship.kind;
        if (usageMap.relationshipKinds[rk]) {
          usageMap.relationshipKinds[rk].actions.push(actionRef);
        }
      }
    };
    scanRelationshipFilter(action.targeting?.exclude, 'targeting.exclude');
    scanRelationshipFilter(action.targeting?.require, 'targeting.require');

    // Outcome relationships
    (action.outcome?.relationships || []).forEach((rel, idx) => {
      if (rel.kind) {
        if (usageMap.relationshipKinds[rel.kind]) {
          usageMap.relationshipKinds[rel.kind].actions.push(actionRef);
        } else {
          usageMap.validation.invalidRefs.push({
            type: 'action',
            id: action.id,
            field: `outcome.relationships[${idx}].kind`,
            refType: 'relationshipKind',
            refId: rel.kind,
            location: `Action "${action.name || action.id}"`,
          });
        }
      }
    });

    // Outcome pressure changes
    Object.keys(action.outcome?.pressureChanges || {}).forEach(pressureId => {
      if (usageMap.pressures[pressureId]) {
        usageMap.pressures[pressureId].actions.push(actionRef);
      }
      if (!pressureIds.has(pressureId)) {
        usageMap.validation.invalidRefs.push({
          type: 'action',
          id: action.id,
          field: 'outcome.pressureChanges',
          refType: 'pressure',
          refId: pressureId,
          location: `Action "${action.name || action.id}"`,
        });
      }
    });

    // Probability pressure modifiers
    (action.probability?.pressureModifiers || []).forEach(pressureId => {
      if (usageMap.pressures[pressureId]) {
        usageMap.pressures[pressureId].actions.push(actionRef);
      }
      if (!pressureIds.has(pressureId)) {
        usageMap.validation.invalidRefs.push({
          type: 'action',
          id: action.id,
          field: 'probability.pressureModifiers',
          refType: 'pressure',
          refId: pressureId,
          location: `Action "${action.name || action.id}"`,
        });
      }
    });
  });
}

function detectOrphans(usageMap, schema, pressures, generators, systems) {
  // Check for unused entity kinds
  Object.entries(usageMap.entityKinds).forEach(([kind, usage]) => {
    const totalUsage = usage.generators.length + usage.systems.length + usage.actions.length + usage.pressures.length;
    if (totalUsage === 0) {
      usageMap.validation.orphans.push({
        type: 'entityKind',
        id: kind,
        reason: 'Not referenced by any generator, system, action, or pressure',
      });
    }
  });

  // Check for unused relationship kinds
  Object.entries(usageMap.relationshipKinds).forEach(([kind, usage]) => {
    const totalUsage = usage.generators.length + usage.systems.length + usage.actions.length + usage.pressures.length;
    if (totalUsage === 0) {
      usageMap.validation.orphans.push({
        type: 'relationshipKind',
        id: kind,
        reason: 'Not referenced by any generator, system, action, or pressure',
      });
    }
  });

  // Check for unused pressures
  Object.entries(usageMap.pressures).forEach(([pressureId, usage]) => {
    const totalUsage = usage.generators.length + usage.systems.length + usage.actions.length;
    if (totalUsage === 0) {
      usageMap.validation.orphans.push({
        type: 'pressure',
        id: pressureId,
        reason: 'Not referenced by any generator, system, or action',
      });
    }
  });

  // Check for generators not used in any era
  Object.entries(usageMap.generators).forEach(([genId, usage]) => {
    if (usage.eras.length === 0) {
      usageMap.validation.orphans.push({
        type: 'generator',
        id: genId,
        reason: 'Not included in any era',
      });
    }
  });

  // Check for systems not used in any era
  Object.entries(usageMap.systems).forEach(([sysId, usage]) => {
    if (usage.eras.length === 0) {
      usageMap.validation.orphans.push({
        type: 'system',
        id: sysId,
        reason: 'Not included in any era',
      });
    }
  });

  // Check for pressures with no feedback (will monotonically change)
  Object.entries(usageMap.pressures).forEach(([pressureId, usage]) => {
    if (usage.feedbackSources.length === 0 && usage.feedbackSinks.length === 0) {
      const pressure = pressures.find(p => p.id === pressureId);
      if (pressure && (pressure.homeostasis ?? 0) === 0) {
        usageMap.validation.orphans.push({
          type: 'pressure',
          id: pressureId,
          reason: 'No feedback or homeostasis defined - pressure will remain static',
        });
      }
    }
  });
}

function checkRelationshipCompatibility(usageMap, generators, actions, schema) {
  const relationshipKinds = {};
  (schema?.relationshipKinds || []).forEach(rk => {
    relationshipKinds[rk.kind] = {
      srcKinds: rk.srcKinds || [],
      dstKinds: rk.dstKinds || [],
    };
  });

  // Check generator relationship compatibility
  (generators || []).forEach(gen => {
    const createdKinds = new Set((gen.creation || []).map(c => c.kind));

    (gen.relationships || []).forEach((rel, idx) => {
      const rkDef = relationshipKinds[rel.kind];
      if (!rkDef) return; // Already flagged as invalid ref

      // Check if src/dst are compatible
      // This is a simplified check - in reality we'd need to resolve $target, $created, etc.
      if (rkDef.srcKinds.length > 0 || rkDef.dstKinds.length > 0) {
        // If the relationship has constraints, note it for review
        // Full compatibility checking would require runtime context
      }
    });
  });

  // Check action outcome relationship compatibility
  (actions || []).forEach(action => {
    (action.outcome?.relationships || []).forEach((rel, idx) => {
      const rkDef = relationshipKinds[rel.kind];
      if (!rkDef) return;

      // Basic compatibility check based on actor/target kinds
      const actorKinds = action.actor?.kinds || [];
      const targetKind = action.targeting?.kind;

      if (rkDef.srcKinds.length > 0 && rel.src === 'actor') {
        const compatible = actorKinds.some(k => rkDef.srcKinds.includes(k));
        if (!compatible && actorKinds.length > 0) {
          usageMap.validation.compatibility.push({
            type: 'action',
            id: action.id,
            field: `outcome.relationships[${idx}]`,
            issue: `Relationship "${rel.kind}" requires src to be one of [${rkDef.srcKinds.join(', ')}], but actor kinds are [${actorKinds.join(', ')}]`,
          });
        }
      }

      if (rkDef.dstKinds.length > 0 && rel.dst === 'target' && targetKind) {
        if (!rkDef.dstKinds.includes(targetKind)) {
          usageMap.validation.compatibility.push({
            type: 'action',
            id: action.id,
            field: `outcome.relationships[${idx}]`,
            issue: `Relationship "${rel.kind}" requires dst to be one of [${rkDef.dstKinds.join(', ')}], but target kind is "${targetKind}"`,
          });
        }
      }
    });
  });
}

/**
 * Get validation status for a specific element
 */
export function getElementValidation(usageMap, type, id) {
  const invalidRefs = usageMap.validation.invalidRefs.filter(
    ref => ref.type === type && ref.id === id
  );
  const compatibility = usageMap.validation.compatibility.filter(
    c => c.type === type && c.id === id
  );
  const isOrphan = usageMap.validation.orphans.some(
    o => o.type === type && o.id === id
  );

  return {
    isValid: invalidRefs.length === 0 && compatibility.length === 0,
    invalidRefs,
    compatibility,
    isOrphan,
  };
}

/**
 * Get usage summary for display
 */
export function getUsageSummary(usage) {
  const parts = [];
  if (usage.generators?.length > 0) {
    parts.push(`${usage.generators.length} generator${usage.generators.length !== 1 ? 's' : ''}`);
  }
  if (usage.systems?.length > 0) {
    parts.push(`${usage.systems.length} system${usage.systems.length !== 1 ? 's' : ''}`);
  }
  if (usage.actions?.length > 0) {
    parts.push(`${usage.actions.length} action${usage.actions.length !== 1 ? 's' : ''}`);
  }
  if (usage.pressures?.length > 0) {
    parts.push(`${usage.pressures.length} pressure${usage.pressures.length !== 1 ? 's' : ''}`);
  }
  if (usage.eras?.length > 0) {
    parts.push(`${usage.eras.length} era${usage.eras.length !== 1 ? 's' : ''}`);
  }
  return parts.length > 0 ? parts.join(', ') : 'Not used';
}

// =============================================================================
// Helper functions from Canonry for cross-tool usage display
// =============================================================================

/**
 * Utility function to compute tag usage across tools
 *
 * @param {Object} params - All sources that reference tags
 * @param {Array} params.cultures - Array of culture objects with naming.profiles
 * @param {Array} params.seedEntities - Array of seed entities with tags
 * @param {Array} params.generators - Array of generator configs
 * @param {Array} params.systems - Array of system configs
 * @param {Array} params.pressures - Array of pressure configs
 * @param {Array} params.entityKinds - Array of entity kind definitions (with semantic planes)
 * @returns {Object} - Map of tag -> { nameforge, seed, generators, systems, pressures, axis }
 */
export function computeTagUsage({ cultures, seedEntities, generators, systems, pressures, entityKinds } = {}) {
  const usage = {};

  const ensureTag = (tag) => {
    if (!usage[tag]) {
      usage[tag] = {};
    }
  };

  // Count tags used in Name Forge profiles
  (cultures || []).forEach(culture => {
    const profiles = culture.naming?.profiles || [];
    profiles.forEach(profile => {
      const groups = profile.strategyGroups || [];
      groups.forEach(group => {
        const tags = group.conditions?.tags || [];
        tags.forEach(tag => {
          ensureTag(tag);
          usage[tag].nameforge = (usage[tag].nameforge || 0) + 1;
        });
      });
    });
  });

  // Count tags used in seed entities (tags stored as { tag: true } object)
  (seedEntities || []).forEach(entity => {
    const tags = entity.tags || {};
    Object.keys(tags).forEach(tag => {
      ensureTag(tag);
      usage[tag].seed = (usage[tag].seed || 0) + 1;
    });
  });

  // Count tags used in generators
  (generators || []).forEach(gen => {
    // Tags in creation entries
    (gen.creation || []).forEach(creation => {
      if (creation.tags && typeof creation.tags === 'object') {
        Object.keys(creation.tags).forEach(tag => {
          ensureTag(tag);
          usage[tag].generators = (usage[tag].generators || 0) + 1;
        });
      }
    });

    // Tags in applicability rules
    const scanApplicabilityTags = (rules) => {
      (rules || []).forEach(rule => {
        if (rule.tags && Array.isArray(rule.tags)) {
          rule.tags.forEach(tag => {
            ensureTag(tag);
            usage[tag].generators = (usage[tag].generators || 0) + 1;
          });
        }
        // Recurse for nested rules (or/and)
        if (rule.rules) {
          scanApplicabilityTags(rule.rules);
        }
      });
    };
    scanApplicabilityTags(gen.applicability);

    // Tags in selection filters
    (gen.selection?.filters || []).forEach(filter => {
      if (filter.tag) {
        ensureTag(filter.tag);
        usage[filter.tag].generators = (usage[filter.tag].generators || 0) + 1;
      }
      if (filter.tags && Array.isArray(filter.tags)) {
        filter.tags.forEach(tag => {
          ensureTag(tag);
          usage[tag].generators = (usage[tag].generators || 0) + 1;
        });
      }
    });

    // Tags in stateUpdates (set_tag, remove_tag)
    (gen.stateUpdates || []).forEach(update => {
      if ((update.type === 'set_tag' || update.type === 'remove_tag') && update.tag) {
        ensureTag(update.tag);
        usage[update.tag].generators = (usage[update.tag].generators || 0) + 1;
      }
    });

    // Tags in variants
    (gen.variants?.options || []).forEach(variant => {
      // Tags in variant conditions
      if (variant.when?.tag) {
        ensureTag(variant.when.tag);
        usage[variant.when.tag].generators = (usage[variant.when.tag].generators || 0) + 1;
      }
      // Tags in variant effects
      if (variant.apply?.tags && typeof variant.apply.tags === 'object') {
        Object.entries(variant.apply.tags).forEach(([ref, tagMap]) => {
          Object.keys(tagMap).forEach(tag => {
            ensureTag(tag);
            usage[tag].generators = (usage[tag].generators || 0) + 1;
          });
        });
      }
    });
  });

  // Count tags used in systems
  (systems || []).forEach(sys => {
    const config = sys.config || {};

    // Tag diffusion systems
    if (sys.systemType === 'tagDiffusion') {
      (config.convergence?.tags || []).forEach(tag => {
        ensureTag(tag);
        usage[tag].systems = (usage[tag].systems || 0) + 1;
      });
      (config.divergence?.tags || []).forEach(tag => {
        ensureTag(tag);
        usage[tag].systems = (usage[tag].systems || 0) + 1;
      });
    }

    // Threshold trigger conditions
    if (sys.systemType === 'thresholdTrigger') {
      (config.conditions || []).forEach(cond => {
        if (cond.tag) {
          ensureTag(cond.tag);
          usage[cond.tag].systems = (usage[cond.tag].systems || 0) + 1;
        }
        if (cond.type === 'has_any_tag' && Array.isArray(cond.tags)) {
          cond.tags.forEach(tag => {
            ensureTag(tag);
            usage[tag].systems = (usage[tag].systems || 0) + 1;
          });
        }
      });
      // Threshold trigger actions
      (config.actions || []).forEach(action => {
        if (action.tag) {
          ensureTag(action.tag);
          usage[action.tag].systems = (usage[action.tag].systems || 0) + 1;
        }
      });
    }

    // Cluster formation criteria
    if (sys.systemType === 'clusterFormation') {
      (config.criteria || []).forEach(crit => {
        if ((crit.type === 'shared_tags' || crit.type === 'has_tags') && Array.isArray(crit.tags)) {
          crit.tags.forEach(tag => {
            ensureTag(tag);
            usage[tag].systems = (usage[tag].systems || 0) + 1;
          });
        }
      });
    }

    // Plane diffusion systems
    if (sys.systemType === 'planeDiffusion') {
      (config.tagFilters || []).forEach(tag => {
        ensureTag(tag);
        usage[tag].systems = (usage[tag].systems || 0) + 1;
      });
    }
  });

  // Count tags used in pressures (feedback factors)
  (pressures || []).forEach(pressure => {
    const scanFeedbackFactors = (factors) => {
      (factors || []).forEach(factor => {
        if (factor.tag) {
          ensureTag(factor.tag);
          usage[factor.tag].pressures = (usage[factor.tag].pressures || 0) + 1;
        }
        if (factor.tags && Array.isArray(factor.tags)) {
          factor.tags.forEach(tag => {
            ensureTag(tag);
            usage[tag].pressures = (usage[tag].pressures || 0) + 1;
          });
        }
      });
    };
    scanFeedbackFactors(pressure.growth?.positiveFeedback);
    scanFeedbackFactors(pressure.growth?.negativeFeedback);
  });

  // Count tags used as semantic plane axis labels
  (entityKinds || []).forEach(ek => {
    const axes = ek.semanticPlane?.axes || {};
    Object.values(axes).forEach(axis => {
      if (axis.lowTag) {
        ensureTag(axis.lowTag);
        usage[axis.lowTag].axis = (usage[axis.lowTag].axis || 0) + 1;
      }
      if (axis.highTag) {
        ensureTag(axis.highTag);
        usage[axis.highTag].axis = (usage[axis.highTag].axis || 0) + 1;
      }
    });
  });

  return usage;
}

/**
 * Get a summary of usage for an entity kind (for cross-tool badges)
 * @param {Object} schemaUsage - Output from computeSchemaUsage or usageMap.entityKinds
 * @param {string} kind - Entity kind ID
 * @returns {Object} - { coherence: number, seed: number } for ToolUsageBadges component
 */
export function getEntityKindUsageSummary(schemaUsage, kind) {
  const usage = schemaUsage?.entityKinds?.[kind];
  if (!usage) return { coherence: 0 };

  const coherenceTotal =
    (usage.generators?.length || 0) +
    (usage.systems?.length || 0) +
    (usage.actions?.length || 0) +
    (usage.pressures?.length || 0);

  const seedTotal = usage.seeds?.length || 0;

  return {
    coherence: coherenceTotal,
    ...(seedTotal > 0 && { seed: seedTotal }),
  };
}

/**
 * Get a summary of usage for a relationship kind (for cross-tool badges)
 * @param {Object} schemaUsage - Output from computeSchemaUsage or usageMap.relationshipKinds
 * @param {string} kind - Relationship kind ID
 * @returns {Object} - { coherence: number } for ToolUsageBadges component
 */
export function getRelationshipKindUsageSummary(schemaUsage, kind) {
  const usage = schemaUsage?.relationshipKinds?.[kind];
  if (!usage) return { coherence: 0 };

  const total =
    (usage.generators?.length || 0) +
    (usage.systems?.length || 0) +
    (usage.actions?.length || 0);

  return { coherence: total };
}

/**
 * Compute schema element usage (simpler version for badge display)
 *
 * Unlike computeUsageMap which focuses on validation, this function tracks
 * usage counts including seed entities for display in Canonry's schema editors.
 *
 * @param {Object} params
 * @param {Array} params.generators - Array of generator configs
 * @param {Array} params.systems - Array of system configs
 * @param {Array} params.actions - Array of action configs
 * @param {Array} params.pressures - Array of pressure configs
 * @param {Array} params.seedEntities - Array of seed entities
 * @returns {Object} - {
 *   entityKinds: { [kindId]: { generators: [], systems: [], actions: [], pressures: [], seeds: [] } },
 *   relationshipKinds: { [kindId]: { generators: [], systems: [], actions: [] } },
 *   subtypes: { [kindId]: { [subtypeId]: { generators: [], systems: [], seeds: [] } } },
 *   statuses: { [kindId]: { [statusId]: { generators: [], systems: [] } } }
 * }
 */
export function computeSchemaUsage({
  generators = [],
  systems = [],
  actions = [],
  pressures = [],
  seedEntities = [],
}) {
  const usage = {
    entityKinds: {},
    relationshipKinds: {},
    subtypes: {},
    statuses: {},
  };

  // Helper to ensure usage entry exists
  const ensureEntityKind = (kind) => {
    if (!usage.entityKinds[kind]) {
      usage.entityKinds[kind] = { generators: [], systems: [], actions: [], pressures: [], seeds: [] };
    }
  };

  const ensureRelationshipKind = (kind) => {
    if (!usage.relationshipKinds[kind]) {
      usage.relationshipKinds[kind] = { generators: [], systems: [], actions: [] };
    }
  };

  const ensureSubtype = (entityKind, subtype) => {
    if (!usage.subtypes[entityKind]) {
      usage.subtypes[entityKind] = {};
    }
    if (!usage.subtypes[entityKind][subtype]) {
      usage.subtypes[entityKind][subtype] = { generators: [], systems: [], seeds: [] };
    }
  };

  const ensureStatus = (entityKind, status) => {
    if (!usage.statuses[entityKind]) {
      usage.statuses[entityKind] = {};
    }
    if (!usage.statuses[entityKind][status]) {
      usage.statuses[entityKind][status] = { generators: [], systems: [] };
    }
  };

  // Analyze generators
  generators.forEach((gen) => {
    const genId = gen.id || gen.name || 'unnamed';

    // Entity kinds produced (in creation array)
    const creations = gen.creation || [];
    creations.forEach((c) => {
      if (c.kind) {
        ensureEntityKind(c.kind);
        usage.entityKinds[c.kind].generators.push(genId);
      }
      if (c.kind && c.subtype) {
        ensureSubtype(c.kind, c.subtype);
        usage.subtypes[c.kind][c.subtype].generators.push(genId);
      }
    });

    // Also check legacy entityKind field
    if (gen.entityKind) {
      ensureEntityKind(gen.entityKind);
      usage.entityKinds[gen.entityKind].generators.push(genId);
    }
    if (gen.entityKind && gen.subtype) {
      ensureSubtype(gen.entityKind, gen.subtype);
      usage.subtypes[gen.entityKind][gen.subtype].generators.push(genId);
    }

    // Selection kind (the kind being selected from)
    if (gen.selection?.kind) {
      ensureEntityKind(gen.selection.kind);
      usage.entityKinds[gen.selection.kind].generators.push(genId);
    }

    // Applicability rules that reference kinds
    const checkApplicability = (rules) => {
      for (const rule of rules || []) {
        if (rule.kind) {
          ensureEntityKind(rule.kind);
          usage.entityKinds[rule.kind].generators.push(genId);
        }
        if (rule.rules) {
          checkApplicability(rule.rules);
        }
      }
    };
    checkApplicability(gen.applicability);

    // Relationships created (in creation or at top level)
    const relationships = gen.relationships || [];
    relationships.forEach((rel) => {
      const relKind = typeof rel === 'string' ? rel : rel.kind;
      if (relKind) {
        ensureRelationshipKind(relKind);
        usage.relationshipKinds[relKind].generators.push(genId);
      }
    });

    // Relationships in creation entries
    creations.forEach((c) => {
      if (c.lineage?.relationshipKind) {
        ensureRelationshipKind(c.lineage.relationshipKind);
        usage.relationshipKinds[c.lineage.relationshipKind].generators.push(genId);
      }
    });

    // Target entity kinds (for relationship targets)
    const targets = gen.targets || gen.targetKinds || [];
    targets.forEach((target) => {
      const targetKind = typeof target === 'string' ? target : target.kind;
      if (targetKind) {
        ensureEntityKind(targetKind);
        usage.entityKinds[targetKind].generators.push(genId);
      }
    });

    // Requirements (entity kinds in conditions)
    if (gen.requires) {
      Object.entries(gen.requires).forEach(([key, value]) => {
        if (key === 'entityKind' || key === 'kind') {
          ensureEntityKind(value);
          usage.entityKinds[value].generators.push(genId);
        }
      });
    }
  });

  // Analyze systems
  systems.forEach((sys) => {
    // Systems can have config wrapper or be flat
    const cfg = sys.config || sys;
    const sysId = cfg.id || cfg.name || sys.systemType || 'unnamed';

    // Entity kinds operated on
    if (cfg.entityKind) {
      ensureEntityKind(cfg.entityKind);
      usage.entityKinds[cfg.entityKind].systems.push(sysId);
    }

    // Source and target kinds
    ['sourceKind', 'targetKind', 'srcKind', 'dstKind'].forEach((field) => {
      if (cfg[field]) {
        ensureEntityKind(cfg[field]);
        usage.entityKinds[cfg[field]].systems.push(sysId);
      }
    });

    // Entity kinds array
    const entityKinds = cfg.entityKinds || cfg.kinds || [];
    entityKinds.forEach((kind) => {
      ensureEntityKind(kind);
      usage.entityKinds[kind].systems.push(sysId);
    });

    // Relationships created/operated on
    if (cfg.relationshipKind) {
      ensureRelationshipKind(cfg.relationshipKind);
      usage.relationshipKinds[cfg.relationshipKind].systems.push(sysId);
    }

    const relationshipKinds = cfg.relationshipKinds || cfg.relationships || [];
    relationshipKinds.forEach((rel) => {
      const relKind = typeof rel === 'string' ? rel : rel.kind;
      if (relKind) {
        ensureRelationshipKind(relKind);
        usage.relationshipKinds[relKind].systems.push(sysId);
      }
    });

    // Subtype filters
    if (cfg.entityKind && cfg.subtype) {
      ensureSubtype(cfg.entityKind, cfg.subtype);
      usage.subtypes[cfg.entityKind][cfg.subtype].systems.push(sysId);
    }

    // Status transitions
    if (cfg.entityKind && cfg.fromStatus) {
      ensureStatus(cfg.entityKind, cfg.fromStatus);
      usage.statuses[cfg.entityKind][cfg.fromStatus].systems.push(sysId);
    }
    if (cfg.entityKind && cfg.toStatus) {
      ensureStatus(cfg.entityKind, cfg.toStatus);
      usage.statuses[cfg.entityKind][cfg.toStatus].systems.push(sysId);
    }
  });

  // Analyze actions
  actions.forEach((action) => {
    const actionId = action.id || action.name || 'unnamed';

    // Actor kind
    if (action.actorKind) {
      ensureEntityKind(action.actorKind);
      usage.entityKinds[action.actorKind].actions.push(actionId);
    }

    // Target kind
    if (action.targetKind) {
      ensureEntityKind(action.targetKind);
      usage.entityKinds[action.targetKind].actions.push(actionId);
    }

    // Relationship kind created
    if (action.relationshipKind) {
      ensureRelationshipKind(action.relationshipKind);
      usage.relationshipKinds[action.relationshipKind].actions.push(actionId);
    }
  });

  // Analyze pressures
  pressures.forEach((pressure) => {
    const pressureId = pressure.id || pressure.name || 'unnamed';

    // Entity kinds affected
    const affectedKinds = pressure.affectedKinds || pressure.entityKinds || [];
    affectedKinds.forEach((kind) => {
      ensureEntityKind(kind);
      usage.entityKinds[kind].pressures.push(pressureId);
    });

    // Single entity kind
    if (pressure.entityKind) {
      ensureEntityKind(pressure.entityKind);
      usage.entityKinds[pressure.entityKind].pressures.push(pressureId);
    }
  });

  // Analyze seed entities
  seedEntities.forEach((entity) => {
    const entityLabel = entity.name || entity.id || 'unnamed seed';

    if (entity.kind) {
      ensureEntityKind(entity.kind);
      usage.entityKinds[entity.kind].seeds.push(entityLabel);
    }

    if (entity.kind && entity.subtype) {
      ensureSubtype(entity.kind, entity.subtype);
      usage.subtypes[entity.kind][entity.subtype].seeds.push(entityLabel);
    }
  });

  return usage;
}
