/**
 * Template Interpreter
 *
 * Executes declarative templates without custom TypeScript code.
 * Templates are pure JSON data; this interpreter provides the execution logic.
 */

import type { HardState, Relationship } from '../core/worldTypes';
import type { TemplateGraphView } from '../graph/templateGraphView';
import type { TemplateResult, PlacementDebug } from './types';
import { pickRandom, hasTag, getTagValue } from '../utils';
import type { Point } from '../coordinates/types';

import type {
  DeclarativeTemplate,
  ApplicabilityRule,
  SelectionRule,
  SelectionFilter,
  CreationRule,
  RelationshipRule,
  StateUpdateRule,
  VariableDefinition,
  SubtypeSpec,
  CultureSpec,
  DescriptionSpec,
  PlacementSpec,
  PlacementAnchor,
  PlacementSpacing,
  PlacementRegionPolicy,
  PlacementFallback,
  CountRange,
  RelationshipCondition,
  GraphPathAssertion,
  PathStep,
  PathConstraint,
  ExecutionContext as IExecutionContext,
  TemplateVariants,
  TemplateVariant,
  VariantCondition,
  VariantEffects
} from './declarativeTypes';

// =============================================================================
// SELECTION DIAGNOSIS TYPE
// =============================================================================

/**
 * Diagnostic information about why selection returned no targets.
 */
export interface SelectionDiagnosis {
  strategy: string;
  targetKind: string;
  filterSteps: Array<{
    description: string;
    remaining: number;
  }>;
}

/**
 * Diagnostic information about why a required variable failed to resolve.
 */
export interface VariableDiagnosis {
  name: string;
  fromType: 'graph' | 'related';
  kind?: string;
  relationshipKind?: string;
  relatedTo?: string;
  filterSteps: Array<{
    description: string;
    remaining: number;
  }>;
}

// =============================================================================
// EXECUTION CONTEXT
// =============================================================================

/**
 * Context maintained during template execution.
 * Holds resolved variables and provides utility methods.
 */
class ExecutionContext implements IExecutionContext {
  graphView: TemplateGraphView;
  variables: Map<string, HardState | HardState[] | undefined> = new Map();
  target?: HardState;
  pathSets: Map<string, Set<string>> = new Map();

  constructor(graphView: TemplateGraphView) {
    this.graphView = graphView;
  }

  set(name: string, value: HardState | HardState[] | undefined): void {
    this.variables.set(name, value);
  }

  get(name: string): HardState | HardState[] | undefined {
    return this.variables.get(name);
  }

  setPathSet(name: string, ids: Set<string>): void {
    this.pathSets.set(name, ids);
  }

  getPathSet(name: string): Set<string> | undefined {
    return this.pathSets.get(name);
  }

  /**
   * Resolve an entity reference to an actual entity.
   * Supports:
   *   - "$target" -> the selected target
   *   - "$varName" -> resolved variable
   *   - "$varName.property" -> property access (for .name, .id, etc.)
   */
  resolveEntity(ref: string): HardState | undefined {
    if (!ref.startsWith('$')) {
      // Literal entity ID
      return this.graphView.getEntity(ref);
    }

    const parts = ref.slice(1).split('.');
    const varName = parts[0];

    if (varName === 'target') {
      return this.target;
    }

    const value = this.variables.get('$' + varName);
    if (Array.isArray(value)) {
      return value[0];  // Return first if array
    }
    return value;
  }

  /**
   * Resolve a string reference that might contain variable substitutions.
   */
  resolveString(ref: string): string {
    if (!ref.includes('$')) {
      return ref;
    }

    // Handle property access like "$target.name"
    const match = ref.match(/\$(\w+)\.(\w+)/g);
    if (match) {
      let result = ref;
      for (const m of match) {
        const [varPart, propPart] = m.slice(1).split('.');
        const entity = varPart === 'target' ? this.target : this.resolveEntity('$' + varPart);
        if (entity && propPart in entity) {
          result = result.replace(m, String((entity as unknown as Record<string, unknown>)[propPart]));
        }
      }
      return result;
    }

    return ref;
  }
}

// =============================================================================
// TEMPLATE INTERPRETER
// =============================================================================

/**
 * Interprets and executes declarative templates.
 */
export class TemplateInterpreter {
  constructor() {}

  /**
   * Check if a template can be applied.
   *
   * A template can apply when:
   *   1. All explicit applicability rules pass
   *   2. AND the selection returns at least one valid target
   *   3. AND all required variables can be resolved
   *
   * This means graph_path rules only need to be in selection, not duplicated
   * in applicability.
   */
  canApply(template: DeclarativeTemplate, graphView: TemplateGraphView): boolean {
    const context = new ExecutionContext(graphView);

    // First check explicit applicability rules (pressure, era, counts, etc.)
    if (!this.evaluateApplicability(template.applicability, context)) {
      return false;
    }

    // Then check if selection returns at least one target
    const targets = this.executeSelection(template.selection, context);
    if (targets.length === 0) {
      return false;
    }

    // Check required variables can be resolved (using first target as context)
    if (template.variables) {
      context.target = targets[0];
      context.set('$target', targets[0]);

      for (const [name, def] of Object.entries(template.variables)) {
        if (def.required) {
          const resolved = this.resolveVariable(def, context);
          if (!resolved || (Array.isArray(resolved) && resolved.length === 0)) {
            return false;
          }
          // Store resolved variable so subsequent required variables can reference it
          context.set(name, resolved);
        }
      }
    }

    return true;
  }

  /**
   * Diagnose why a template can't apply.
   * Returns detailed information about which checks failed.
   */
  diagnoseCanApply(template: DeclarativeTemplate, graphView: TemplateGraphView): {
    canApply: boolean;
    applicabilityPassed: boolean;
    failedRules: string[];
    selectionCount: number;
    selectionStrategy: string;
    selectionDiagnosis?: SelectionDiagnosis;
    requiredVariablesPassed: boolean;
    failedVariables: string[];
    failedVariableDiagnoses: VariableDiagnosis[];
  } {
    const context = new ExecutionContext(graphView);
    const failedRules: string[] = [];

    // Check each applicability rule individually
    const rules = template.applicability || [];
    for (const rule of rules) {
      if (!this.evaluateApplicabilityRule(rule, context)) {
        failedRules.push(this.describeRuleFailure(rule, context));
      }
    }

    const applicabilityPassed = failedRules.length === 0;

    // Check selection if applicability passed
    let selectionCount = 0;
    let selectionStrategy = 'none';
    let selectionDiagnosis: SelectionDiagnosis | undefined;
    let targets: HardState[] = [];
    if (applicabilityPassed && template.selection) {
      targets = this.executeSelection(template.selection, context);
      selectionCount = targets.length;
      selectionStrategy = template.selection.strategy || 'random';

      // If no targets found, get detailed diagnosis
      if (selectionCount === 0) {
        selectionDiagnosis = this.diagnoseSelection(template.selection, context);
      }
    }

    // Check required variables if selection passed
    const failedVariables: string[] = [];
    const failedVariableDiagnoses: VariableDiagnosis[] = [];
    let requiredVariablesPassed = true;
    if (applicabilityPassed && selectionCount > 0 && template.variables) {
      context.target = targets[0];
      context.set('$target', targets[0]);

      for (const [name, def] of Object.entries(template.variables)) {
        if (def.required) {
          const resolved = this.resolveVariable(def, context);
          if (!resolved || (Array.isArray(resolved) && resolved.length === 0)) {
            failedVariables.push(name);
            failedVariableDiagnoses.push(this.diagnoseVariable(name, def, context));
            requiredVariablesPassed = false;
          } else {
            // Store for subsequent variable resolution
            context.set(name, resolved);
          }
        }
      }
    }

    return {
      canApply: applicabilityPassed && selectionCount > 0 && requiredVariablesPassed,
      applicabilityPassed,
      failedRules,
      selectionCount,
      selectionStrategy,
      selectionDiagnosis,
      requiredVariablesPassed,
      failedVariables,
      failedVariableDiagnoses
    };
  }

  /**
   * Diagnose why selection returned no targets.
   * Tracks entity counts through each filtering step.
   */
  private diagnoseSelection(rule: SelectionRule, context: ExecutionContext): SelectionDiagnosis {
    const { graphView } = context;
    const filterSteps: Array<{ description: string; remaining: number }> = [];
    let entities: HardState[];

    // Primary selection strategy
    switch (rule.strategy) {
      case 'by_kind': {
        entities = graphView.findEntities({ kind: rule.kind });
        filterSteps.push({ description: `${rule.kind} entities`, remaining: entities.length });

        if (rule.subtypes && rule.subtypes.length > 0) {
          entities = entities.filter(e => rule.subtypes!.includes(e.subtype));
          filterSteps.push({ description: `subtype in [${rule.subtypes.join(', ')}]`, remaining: entities.length });
        }
        break;
      }

      case 'by_preference_order': {
        const allEntities = graphView.findEntities({ kind: rule.kind });
        filterSteps.push({ description: `${rule.kind} entities`, remaining: allEntities.length });

        entities = [];
        for (const subtype of rule.subtypePreferences || []) {
          const matches = allEntities.filter(e => e.subtype === subtype);
          if (matches.length > 0) {
            entities = matches;
            filterSteps.push({ description: `preferred subtype '${subtype}'`, remaining: entities.length });
            break;
          }
        }
        if (entities.length === 0) {
          entities = allEntities;
          filterSteps.push({ description: 'no preferred subtypes found, using all', remaining: entities.length });
        }
        break;
      }

      case 'by_relationship': {
        const allEntities = graphView.findEntities({ kind: rule.kind });
        filterSteps.push({ description: `${rule.kind} entities`, remaining: allEntities.length });

        entities = allEntities.filter(entity => {
          const hasRel = entity.links.some(link => {
            if (link.kind !== rule.relationshipKind) return false;
            if (rule.direction === 'src') return link.src === entity.id;
            if (rule.direction === 'dst') return link.dst === entity.id;
            return true;
          });
          return rule.mustHave ? hasRel : !hasRel;
        });
        const relDesc = rule.mustHave ? `has ${rule.relationshipKind}` : `lacks ${rule.relationshipKind}`;
        filterSteps.push({ description: relDesc, remaining: entities.length });
        break;
      }

      case 'by_proximity': {
        const refEntity = context.resolveEntity(rule.referenceEntity || '$target');
        const allEntities = graphView.findEntities({ kind: rule.kind });
        filterSteps.push({ description: `${rule.kind} entities`, remaining: allEntities.length });

        if (!refEntity?.coordinates) {
          entities = [];
          filterSteps.push({ description: 'reference entity has no coordinates', remaining: 0 });
        } else {
          const maxDist = rule.maxDistance || 50;
          entities = allEntities.filter(e => {
            if (!e.coordinates) return false;
            const dx = e.coordinates.x - refEntity.coordinates!.x;
            const dy = e.coordinates.y - refEntity.coordinates!.y;
            const dz = e.coordinates.z - refEntity.coordinates!.z;
            return Math.sqrt(dx * dx + dy * dy + dz * dz) <= maxDist;
          });
          filterSteps.push({ description: `within distance ${maxDist}`, remaining: entities.length });
        }
        break;
      }

      case 'by_prominence': {
        const prominenceOrder = ['forgotten', 'marginal', 'recognized', 'renowned', 'mythic'];
        const minIndex = prominenceOrder.indexOf(rule.minProminence || 'marginal');
        const allEntities = graphView.findEntities({ kind: rule.kind });
        filterSteps.push({ description: `${rule.kind} entities`, remaining: allEntities.length });

        entities = allEntities.filter(e => {
          const entityIndex = prominenceOrder.indexOf(e.prominence);
          return entityIndex >= minIndex;
        });
        filterSteps.push({ description: `prominence >= ${rule.minProminence || 'marginal'}`, remaining: entities.length });
        break;
      }

      default:
        entities = [];
        filterSteps.push({ description: 'unknown strategy', remaining: 0 });
    }

    // Apply status filter
    if (rule.statusFilter) {
      entities = entities.filter(e => e.status === rule.statusFilter);
      filterSteps.push({ description: `status = '${rule.statusFilter}'`, remaining: entities.length });
    }

    // Apply post-filters
    if (rule.filters) {
      for (const filter of rule.filters) {
        const beforeCount = entities.length;
        entities = this.applySelectionFilter(entities, filter, context);
        filterSteps.push({ description: this.describeSelectionFilter(filter), remaining: entities.length });
      }
    }

    return {
      strategy: rule.strategy,
      targetKind: rule.kind,
      filterSteps
    };
  }

  /**
   * Diagnose why a variable failed to resolve.
   * Tracks entity counts through each filtering step.
   */
  private diagnoseVariable(
    name: string,
    def: VariableDefinition,
    context: ExecutionContext
  ): VariableDiagnosis {
    const { select } = def;
    const { graphView } = context;
    const filterSteps: Array<{ description: string; remaining: number }> = [];
    let entities: HardState[];

    // Determine source type
    const fromSpec = select.from;
    const isFromRelated = fromSpec && fromSpec !== 'graph';
    const fromType: 'graph' | 'related' = isFromRelated ? 'related' : 'graph';

    // Step 1: Get source entities
    if (isFromRelated) {
      const relatedTo = context.resolveEntity(fromSpec.relatedTo);
      if (!relatedTo) {
        filterSteps.push({
          description: `related to ${fromSpec.relatedTo} (not found)`,
          remaining: 0
        });
        return {
          name,
          fromType,
          relationshipKind: fromSpec.relationship,
          relatedTo: fromSpec.relatedTo,
          filterSteps
        };
      }
      entities = graphView.getRelatedEntities(
        relatedTo.id,
        fromSpec.relationship,
        fromSpec.direction
      );
      filterSteps.push({
        description: `via ${fromSpec.relationship} from ${relatedTo.name || relatedTo.id}`,
        remaining: entities.length
      });
    } else {
      // From graph
      entities = graphView.findEntities({ kind: select.kind });
      filterSteps.push({
        description: `${select.kind} entities`,
        remaining: entities.length
      });
    }

    // Step 2: Apply subtype filter
    if (select.subtypes && select.subtypes.length > 0) {
      entities = entities.filter(e => select.subtypes!.includes(e.subtype));
      filterSteps.push({
        description: `subtype in [${select.subtypes.join(', ')}]`,
        remaining: entities.length
      });
    }

    // Step 3: Apply status filter
    if (select.statusFilter) {
      entities = entities.filter(e => e.status === select.statusFilter);
      filterSteps.push({
        description: `status = '${select.statusFilter}'`,
        remaining: entities.length
      });
    }

    // Step 4: Apply post-filters
    if (select.filters) {
      for (const filter of select.filters) {
        entities = this.applySelectionFilter(entities, filter, context);
        filterSteps.push({
          description: this.describeSelectionFilter(filter),
          remaining: entities.length
        });
      }
    }

    // Step 5: Apply prefer filters (if we still have entities)
    if (select.preferFilters && select.preferFilters.length > 0 && entities.length > 0) {
      let preferred = entities;
      for (const filter of select.preferFilters) {
        preferred = this.applySelectionFilter(preferred, filter, context);
      }
      if (preferred.length > 0) {
        filterSteps.push({
          description: `prefer filters matched`,
          remaining: preferred.length
        });
      } else {
        filterSteps.push({
          description: `prefer filters (no match, using all)`,
          remaining: entities.length
        });
      }
    }

    return {
      name,
      fromType,
      kind: select.kind,
      relationshipKind: isFromRelated ? fromSpec.relationship : undefined,
      relatedTo: isFromRelated ? fromSpec.relatedTo : undefined,
      filterSteps
    };
  }

  /**
   * Describe a selection filter for diagnostic output.
   */
  private describeSelectionFilter(filter: SelectionFilter): string {
    switch (filter.type) {
      case 'exclude':
        return `exclude [${filter.entities.join(', ')}]`;
      case 'has_relationship':
        return `has_relationship '${filter.kind}'${filter.with ? ` with ${filter.with}` : ''}`;
      case 'lacks_relationship':
        return `lacks_relationship '${filter.kind}'${filter.with ? ` with ${filter.with}` : ''}`;
      case 'has_tag':
        return `has_tag '${filter.tag}'${filter.value !== undefined ? ` = ${filter.value}` : ''}`;
      case 'has_tags':
        return `has_tags [${filter.tags.join(', ')}]`;
      case 'has_any_tag':
        return `has_any_tag [${filter.tags.join(', ')}]`;
      case 'lacks_tag':
        return `lacks_tag '${filter.tag}'${filter.value !== undefined ? ` = ${filter.value}` : ''}`;
      case 'lacks_any_tag':
        return `lacks_any_tag [${filter.tags.join(', ')}]`;
      case 'has_culture':
        return `has_culture '${filter.culture}'`;
      case 'matches_culture':
        return `matches_culture with ${filter.with}`;
      case 'has_status':
        return `has_status '${filter.status}'`;
      case 'has_prominence':
        return `has_prominence >= '${filter.minProminence}'`;
      case 'shares_related':
        return `shares '${filter.relationshipKind}' with ${filter.with}`;
      case 'graph_path':
        return 'graph_path assertion';
      default:
        return 'unknown filter';
    }
  }

  /**
   * Describe why a specific applicability rule failed.
   */
  private describeRuleFailure(rule: ApplicabilityRule, context: ExecutionContext): string {
    const { graphView } = context;

    switch (rule.type) {
      case 'pressure_threshold': {
        const pressure = graphView.getPressure(rule.pressureId) || 0;
        return `pressure_threshold: ${rule.pressureId}=${pressure.toFixed(1)} (need ${rule.min}-${rule.max})`;
      }

      case 'pressure_any_above': {
        const pressures = rule.pressureIds.map(id => `${id}=${(graphView.getPressure(id) || 0).toFixed(1)}`);
        return `pressure_any_above: [${pressures.join(', ')}] (need >${rule.threshold})`;
      }

      case 'pressure_compare': {
        const pA = graphView.getPressure(rule.pressureA) || 0;
        const pB = graphView.getPressure(rule.pressureB) || 0;
        return `pressure_compare: ${rule.pressureA}=${pA.toFixed(1)} > ${rule.pressureB}=${pB.toFixed(1)}`;
      }

      case 'entity_count_min': {
        let entities = graphView.findEntities({ kind: rule.kind });
        if (rule.subtype) entities = entities.filter(e => e.subtype === rule.subtype);
        if (rule.status) entities = entities.filter(e => e.status === rule.status);
        const desc = `${rule.kind}${rule.subtype ? ':' + rule.subtype : ''}${rule.status ? '(' + rule.status + ')' : ''}`;
        return `entity_count_min: ${desc}=${entities.length} (need >=${rule.min})`;
      }

      case 'entity_count_max': {
        const count = graphView.getEntityCount(rule.kind, rule.subtype);
        const targets = graphView.config.distributionTargets;
        const kindTargets = targets?.global?.entityKindDistribution?.targets;
        const target = kindTargets?.[rule.kind] ?? rule.max;
        const threshold = target * (rule.overshootFactor ?? 1.5);
        const desc = `${rule.kind}${rule.subtype ? ':' + rule.subtype : ''}`;
        return `entity_count_max: ${desc}=${count} (limit ${threshold.toFixed(0)})`;
      }

      case 'era_match': {
        return `era_match: current=${graphView.currentEra.id} (need [${rule.eras.join(', ')}])`;
      }

      case 'random_chance': {
        return `random_chance: ${(rule.chance * 100).toFixed(0)}% failed`;
      }

      case 'and':
        return `and: one or more sub-rules failed`;

      case 'or':
        return `or: all sub-rules failed`;

      default:
        return `${(rule as ApplicabilityRule).type}: unknown rule failed`;
    }
  }

  /**
   * Find valid targets for a template.
   */
  findTargets(template: DeclarativeTemplate, graphView: TemplateGraphView): HardState[] {
    const context = new ExecutionContext(graphView);
    return this.executeSelection(template.selection, context);
  }

  /**
   * Execute a template and return the result.
   */
  async expand(
    template: DeclarativeTemplate,
    graphView: TemplateGraphView,
    target?: HardState
  ): Promise<TemplateResult> {
    const context = new ExecutionContext(graphView);
    context.target = target;
    context.set('$target', target);

    // Resolve variables
    if (template.variables) {
      for (const [name, def] of Object.entries(template.variables)) {
        const resolved = this.resolveVariable(def, context);
        context.set(name, resolved);
      }
    }

    // Execute creation rules
    const entities: Partial<HardState>[] = [];
    const entityRefs: Map<string, string[]> = new Map();  // Track created entity placeholders
    const placementStrategies: string[] = [];  // For debugging
    const derivedTagsList: Record<string, string | boolean>[] = [];  // Tags from placement
    const placementDebugList: PlacementDebug[] = [];  // Detailed placement debug info

    for (const rule of template.creation) {
      const created = await this.executeCreation(rule, context, entities.length);
      entities.push(...created.entities);
      entityRefs.set(rule.entityRef, created.placeholders);
      placementStrategies.push(...created.placementStrategies);
      derivedTagsList.push(...created.derivedTagsList);
      placementDebugList.push(...created.placementDebugList);
    }

    // Execute relationship rules
    const relationships: Relationship[] = [];
    for (const rule of template.relationships) {
      const rels = this.executeRelationship(rule, context, entityRefs);
      relationships.push(...rels);
    }

    // Execute state updates
    for (const rule of template.stateUpdates) {
      this.executeStateUpdate(rule, context);
    }

    // Apply variant effects based on world state
    const matchingVariants = this.getMatchingVariants(template.variants, context);
    for (const variant of matchingVariants) {
      this.applyVariantEffects(variant.apply, entities, entityRefs, relationships, context);
    }

    return {
      entities,
      relationships,
      description: `${template.name} executed`,
      placementStrategies,
      derivedTagsList,
      placementDebugList
    };
  }

  // ===========================================================================
  // STEP 1: APPLICABILITY
  // ===========================================================================

  private evaluateApplicability(rules: ApplicabilityRule[] | undefined, context: ExecutionContext): boolean {
    // No rules means always applicable
    if (!rules || rules.length === 0) return true;
    // All rules must pass (AND logic)
    return rules.every(rule => this.evaluateApplicabilityRule(rule, context));
  }

  private evaluateApplicabilityRule(rule: ApplicabilityRule, context: ExecutionContext): boolean {
    const { graphView } = context;

    switch (rule.type) {
      case 'pressure_threshold': {
        const pressure = graphView.getPressure(rule.pressureId) || 0;
        if (pressure < rule.min) return false;
        if (pressure > rule.max) return false;
        return true;
      }

      case 'pressure_any_above': {
        return rule.pressureIds.some(id =>
          (graphView.getPressure(id) || 0) > rule.threshold
        );
      }

      case 'pressure_compare': {
        const pressureA = graphView.getPressure(rule.pressureA) || 0;
        const pressureB = graphView.getPressure(rule.pressureB) || 0;
        return pressureA > pressureB;
      }

      case 'entity_count_min': {
        let entities = graphView.findEntities({ kind: rule.kind });
        if (rule.subtype) {
          entities = entities.filter(e => e.subtype === rule.subtype);
        }
        if (rule.status) {
          entities = entities.filter(e => e.status === rule.status);
        }
        return entities.length >= rule.min;
      }

      case 'entity_count_max': {
        const count = graphView.getEntityCount(rule.kind, rule.subtype);
        // Use entity kind distribution targets if available
        const targets = graphView.config.distributionTargets;
        const kindTargets = targets?.global?.entityKindDistribution?.targets;
        const target = kindTargets?.[rule.kind] ?? rule.max;
        const threshold = target * (rule.overshootFactor ?? 1.5);
        return count < threshold;
      }

      case 'era_match': {
        return rule.eras.includes(graphView.currentEra.id);
      }

      case 'random_chance': {
        return Math.random() < rule.chance;
      }

      case 'cooldown_elapsed': {
        const ticksSince = graphView.tick - graphView.rateLimitState.lastCreationTick;
        return ticksSince >= rule.cooldownTicks;
      }

      case 'creations_per_epoch': {
        return graphView.rateLimitState.creationsThisEpoch < rule.maxPerEpoch;
      }

      case 'and': {
        return rule.rules.every(r => this.evaluateApplicabilityRule(r, context));
      }

      case 'or': {
        return rule.rules.some(r => this.evaluateApplicabilityRule(r, context));
      }

      default:
        return false;
    }
  }

  // ===========================================================================
  // GRAPH PATH EVALUATION
  // ===========================================================================

  /**
   * Evaluate a graph path assertion starting from an entity.
   * Supports up to 2 hops of traversal.
   */
  private evaluateGraphPath(
    startEntity: HardState,
    assertion: GraphPathAssertion,
    context: ExecutionContext
  ): boolean {
    const { graphView } = context;

    // Traverse the path, collecting entities at each step
    let currentEntities: HardState[] = [startEntity];

    for (const step of assertion.path) {
      const nextEntities: HardState[] = [];

      for (const entity of currentEntities) {
        const related = this.traverseStep(entity, step, graphView);
        nextEntities.push(...related);
      }

      // Store intermediate results if requested
      if (step.as) {
        context.setPathSet(step.as, new Set(nextEntities.map(e => e.id)));
      }

      currentEntities = nextEntities;
    }

    // Apply constraints to filter final entities
    if (assertion.where) {
      currentEntities = currentEntities.filter(entity =>
        this.evaluatePathConstraints(entity, startEntity, assertion.where!, context)
      );
    }

    // Evaluate the assertion
    switch (assertion.check) {
      case 'exists':
        return currentEntities.length > 0;

      case 'not_exists':
        return currentEntities.length === 0;

      case 'count_min':
        return currentEntities.length >= (assertion.count ?? 1);

      case 'count_max':
        return currentEntities.length <= (assertion.count ?? 0);

      default:
        return false;
    }
  }

  /**
   * Traverse one step in a graph path.
   */
  private traverseStep(
    entity: HardState,
    step: PathStep,
    graphView: TemplateGraphView
  ): HardState[] {
    // Get related entities via the relationship
    const direction = step.direction === 'out' ? 'src' :
                     step.direction === 'in' ? 'dst' : 'both';

    let related = graphView.getRelatedEntities(entity.id, step.via, direction);

    // Filter by target kind/subtype/status ("any" means no filtering)
    if (step.targetKind && step.targetKind !== 'any') {
      related = related.filter(e => e.kind === step.targetKind);
    }
    if (step.targetSubtype && step.targetSubtype !== 'any') {
      related = related.filter(e => e.subtype === step.targetSubtype);
    }
    if (step.targetStatus && step.targetStatus !== 'any') {
      related = related.filter(e => e.status === step.targetStatus);
    }

    return related;
  }

  /**
   * Evaluate constraints on a path target entity.
   */
  private evaluatePathConstraints(
    entity: HardState,
    startEntity: HardState,
    constraints: PathConstraint[],
    context: ExecutionContext
  ): boolean {
    const { graphView } = context;

    for (const constraint of constraints) {
      switch (constraint.type) {
        case 'not_in': {
          const set = context.getPathSet(constraint.set);
          if (set && set.has(entity.id)) {
            return false;
          }
          break;
        }

        case 'in': {
          const set = context.getPathSet(constraint.set);
          if (!set || !set.has(entity.id)) {
            return false;
          }
          break;
        }

        case 'not_self': {
          if (entity.id === startEntity.id) {
            return false;
          }
          break;
        }

        case 'lacks_relationship': {
          const direction = constraint.direction === 'out' ? 'src' :
                           constraint.direction === 'in' ? 'dst' : 'both';
          const withEntity = constraint.with === '$self' ? startEntity :
                            context.resolveEntity(constraint.with);

          if (withEntity) {
            const hasRel = graphView.hasRelationship(entity.id, withEntity.id, constraint.kind) ||
                          (direction === 'both' && graphView.hasRelationship(withEntity.id, entity.id, constraint.kind));
            if (hasRel) {
              return false;
            }
          }
          break;
        }

        case 'has_relationship': {
          const direction = constraint.direction === 'out' ? 'src' :
                           constraint.direction === 'in' ? 'dst' : 'both';
          const withEntity = constraint.with === '$self' ? startEntity :
                            context.resolveEntity(constraint.with);

          if (withEntity) {
            const hasRel = graphView.hasRelationship(entity.id, withEntity.id, constraint.kind) ||
                          (direction === 'both' && graphView.hasRelationship(withEntity.id, entity.id, constraint.kind));
            if (!hasRel) {
              return false;
            }
          } else {
            // No withEntity specified - just check if any such relationship exists
            const related = graphView.getRelatedEntities(entity.id, constraint.kind, 'both');
            if (related.length === 0) {
              return false;
            }
          }
          break;
        }

        case 'kind_equals': {
          if (entity.kind !== constraint.kind) {
            return false;
          }
          break;
        }

        case 'subtype_equals': {
          if (entity.subtype !== constraint.subtype) {
            return false;
          }
          break;
        }
      }
    }

    return true;
  }

  /**
   * Evaluate a graph path filter for entity selection.
   */
  private evaluateGraphPathForEntity(
    entity: HardState,
    assertion: GraphPathAssertion,
    context: ExecutionContext
  ): boolean {
    // Create a fresh path context with this entity as the start
    const pathContext = new ExecutionContext(context.graphView);
    pathContext.target = context.target;
    pathContext.variables = context.variables;
    return this.evaluateGraphPath(entity, assertion, pathContext);
  }

  // ===========================================================================
  // STEP 2: SELECTION
  // ===========================================================================

  private executeSelection(rule: SelectionRule, context: ExecutionContext): HardState[] {
    const { graphView } = context;
    let entities: HardState[];

    // Primary selection strategy
    switch (rule.strategy) {
      case 'by_kind': {
        entities = graphView.findEntities({ kind: rule.kind });
        if (rule.subtypes && rule.subtypes.length > 0) {
          entities = entities.filter(e => rule.subtypes!.includes(e.subtype));
        }
        break;
      }

      case 'by_preference_order': {
        entities = [];
        const allEntities = graphView.findEntities({ kind: rule.kind });
        for (const subtype of rule.subtypePreferences || []) {
          const matches = allEntities.filter(e => e.subtype === subtype);
          if (matches.length > 0) {
            entities = matches;
            break;
          }
        }
        if (entities.length === 0) {
          entities = allEntities;
        }
        break;
      }

      case 'by_relationship': {
        const allEntities = graphView.findEntities({ kind: rule.kind });
        entities = allEntities.filter(entity => {
          const hasRel = entity.links.some(link => {
            if (link.kind !== rule.relationshipKind) return false;
            if (rule.direction === 'src') return link.src === entity.id;
            if (rule.direction === 'dst') return link.dst === entity.id;
            return true;
          });
          return rule.mustHave ? hasRel : !hasRel;
        });
        break;
      }

      case 'by_proximity': {
        const refEntity = context.resolveEntity(rule.referenceEntity || '$target');
        if (!refEntity?.coordinates) {
          entities = [];
          break;
        }
        const maxDist = rule.maxDistance || 50;
        entities = graphView.findEntities({ kind: rule.kind }).filter(e => {
          if (!e.coordinates) return false;
          const dx = e.coordinates.x - refEntity.coordinates!.x;
          const dy = e.coordinates.y - refEntity.coordinates!.y;
          const dz = e.coordinates.z - refEntity.coordinates!.z;
          return Math.sqrt(dx * dx + dy * dy + dz * dz) <= maxDist;
        });
        break;
      }

      case 'by_prominence': {
        const prominenceOrder = ['forgotten', 'marginal', 'recognized', 'renowned', 'mythic'];
        const minIndex = prominenceOrder.indexOf(rule.minProminence || 'marginal');
        entities = graphView.findEntities({ kind: rule.kind }).filter(e => {
          const entityIndex = prominenceOrder.indexOf(e.prominence);
          return entityIndex >= minIndex;
        });
        break;
      }

      default:
        entities = [];
    }

    // Apply status filter
    if (rule.statusFilter) {
      entities = entities.filter(e => e.status === rule.statusFilter);
    }

    // Apply post-filters
    if (rule.filters) {
      for (const filter of rule.filters) {
        entities = this.applySelectionFilter(entities, filter, context);
      }
    }

    // Apply result handling
    if (rule.maxResults && entities.length > rule.maxResults) {
      entities = entities.slice(0, rule.maxResults);
    }

    switch (rule.pickStrategy) {
      case 'random':
        return entities.length > 0 ? [pickRandom(entities)] : [];
      case 'first':
        return entities.slice(0, 1);
      case 'all':
      default:
        return entities;
    }
  }

  private applySelectionFilter(
    entities: HardState[],
    filter: SelectionFilter,
    context: ExecutionContext
  ): HardState[] {
    switch (filter.type) {
      case 'exclude': {
        const excludeIds = new Set(
          filter.entities.map(ref => context.resolveEntity(ref)?.id).filter(Boolean)
        );
        return entities.filter(e => !excludeIds.has(e.id));
      }

      case 'has_relationship': {
        const withEntity = filter.with ? context.resolveEntity(filter.with) : undefined;
        return entities.filter(entity =>
          entity.links.some(link => {
            if (link.kind !== filter.kind) return false;
            if (withEntity) {
              if (filter.direction === 'src') return link.dst === withEntity.id;
              if (filter.direction === 'dst') return link.src === withEntity.id;
              return link.src === withEntity.id || link.dst === withEntity.id;
            }
            return true;
          })
        );
      }

      case 'lacks_relationship': {
        const withEntity = filter.with ? context.resolveEntity(filter.with) : undefined;
        return entities.filter(entity =>
          !entity.links.some(link => {
            if (link.kind !== filter.kind) return false;
            if (withEntity) {
              return link.src === withEntity.id || link.dst === withEntity.id;
            }
            return true;
          })
        );
      }

      case 'has_tag': {
        return entities.filter(entity => {
          if (!hasTag(entity.tags, filter.tag)) return false;
          if (filter.value === undefined) return true;
          return getTagValue(entity.tags, filter.tag) === filter.value;
        });
      }

      case 'has_tags': {
        const tagList = filter.tags || [];
        if (tagList.length === 0) return entities;
        return entities.filter(entity => tagList.every(tag => hasTag(entity.tags, tag)));
      }

      case 'has_any_tag': {
        const tagList = filter.tags || [];
        if (tagList.length === 0) return entities;
        return entities.filter(entity => tagList.some(tag => hasTag(entity.tags, tag)));
      }

      case 'lacks_tag': {
        return entities.filter(entity => {
          if (!hasTag(entity.tags, filter.tag)) return true;  // Doesn't have tag, include
          if (filter.value === undefined) return false;  // Has tag, exclude
          // Has tag, only exclude if value matches
          return getTagValue(entity.tags, filter.tag) !== filter.value;
        });
      }

      case 'lacks_any_tag': {
        const tagList = filter.tags || [];
        if (tagList.length === 0) return entities;
        return entities.filter(entity => !tagList.some(tag => hasTag(entity.tags, tag)));
      }

      case 'has_culture': {
        return entities.filter(e => e.culture === filter.culture);
      }

      case 'matches_culture': {
        const refEntity = context.resolveEntity(filter.with);
        if (!refEntity) return entities;
        return entities.filter(e => e.culture === refEntity.culture);
      }

      case 'has_status': {
        return entities.filter(e => e.status === filter.status);
      }

      case 'has_prominence': {
        const prominenceLevels = ['forgotten', 'marginal', 'recognized', 'renowned', 'mythic'];
        const minIndex = prominenceLevels.indexOf(filter.minProminence);
        if (minIndex === -1) return entities;
        return entities.filter(e => {
          const entityIndex = prominenceLevels.indexOf(e.prominence);
          return entityIndex >= minIndex;
        });
      }

      case 'shares_related': {
        // Find entities that share a common related entity with the reference
        const refEntity = context.resolveEntity(filter.with);
        if (!refEntity) return entities;

        // Get the related entities for the reference via the specified relationship kind
        const refRelated = refEntity.links
          .filter(link => link.kind === filter.relationshipKind)
          .map(link => link.dst);

        if (refRelated.length === 0) return [];

        const refRelatedSet = new Set(refRelated);

        // Filter entities that have at least one common related entity
        return entities.filter(entity => {
          const entityRelated = entity.links
            .filter(link => link.kind === filter.relationshipKind)
            .map(link => link.dst);
          return entityRelated.some(id => refRelatedSet.has(id));
        });
      }

      case 'graph_path': {
        return entities.filter(entity =>
          this.evaluateGraphPathForEntity(entity, filter.assert, context)
        );
      }

      default:
        return entities;
    }
  }

  // ===========================================================================
  // STEP 3: CREATION
  // ===========================================================================

  private async executeCreation(
    rule: CreationRule,
    context: ExecutionContext,
    startIndex: number
  ): Promise<{
    entities: Partial<HardState>[];
    placeholders: string[];
    placementStrategies: string[];
    derivedTagsList: Record<string, string | boolean>[];
    placementDebugList: PlacementDebug[];
  }> {
    const entities: Partial<HardState>[] = [];
    const placeholders: string[] = [];
    const placementStrategies: string[] = [];
    const derivedTagsList: Record<string, string | boolean>[] = [];
    const placementDebugList: PlacementDebug[] = [];

    // Determine count
    const count = this.resolveCount(rule.count);

    for (let i = 0; i < count; i++) {
      const placeholder = `will-be-assigned-${startIndex + i}`;
      placeholders.push(placeholder);

      // Resolve subtype
      const subtype = this.resolveSubtype(rule.subtype, context);

      // Resolve culture
      const culture = this.resolveCulture(rule.culture, context);

      // Resolve description
      const description = this.resolveDescription(rule.description, context);

      // Resolve placement
      const placementResult = await this.resolvePlacement(rule.placement, context, culture, placeholder, rule.kind);

      // Merge template tags with derived tags from placement (derived tags take precedence)
      const derivedTags = placementResult.derivedTags || {};
      const mergedTags = { ...(rule.tags || {}), ...derivedTags };

      const entity: Partial<HardState> = {
        kind: rule.kind,
        subtype,
        status: rule.status || 'active',
        prominence: rule.prominence || 'marginal',
        culture,
        description,
        tags: mergedTags,
        coordinates: placementResult.coordinates,
        links: []
      };

      entities.push(entity);
      placementStrategies.push(placementResult.strategy);
      derivedTagsList.push(derivedTags);

      // Collect placement debug info
      placementDebugList.push({
        anchorType: placementResult.debug?.anchorType || rule.placement.anchor.type,
        anchorEntity: placementResult.debug?.anchorEntity,
        anchorCulture: placementResult.debug?.anchorCulture,
        resolvedVia: placementResult.debug?.resolvedVia || placementResult.strategy,
        seedRegionsAvailable: placementResult.debug?.seedRegionsAvailable,
        emergentRegionCreated: placementResult.debug?.emergentRegionCreated,
        regionId: placementResult.regionId,
        allRegionIds: placementResult.allRegionIds
      });
    }

    return { entities, placeholders, placementStrategies, derivedTagsList, placementDebugList };
  }

  private resolveCount(count: number | CountRange | undefined): number {
    if (!count) return 1;
    if (typeof count === 'number') return count;
    return count.min + Math.floor(Math.random() * (count.max - count.min + 1));
  }

  private resolveSubtype(spec: SubtypeSpec, context: ExecutionContext): string {
    if (typeof spec === 'string') {
      return spec;
    }

    if ('inherit' in spec) {
      const refEntity = context.resolveEntity(spec.inherit);
      if (refEntity && (!spec.chance || Math.random() < spec.chance)) {
        return refEntity.subtype;
      }
      if (spec.fallback === 'random') {
        // Would need subtype list from domain schema
        return 'default';
      }
      return spec.fallback || 'default';
    }

    if ('fromPressure' in spec) {
      const { graphView } = context;
      let maxPressure = -1;
      let selectedSubtype = Object.values(spec.fromPressure)[0] || 'default';

      for (const [pressureId, subtype] of Object.entries(spec.fromPressure)) {
        const value = graphView.getPressure(pressureId) || 0;
        if (value > maxPressure) {
          maxPressure = value;
          selectedSubtype = subtype;
        }
      }
      return selectedSubtype;
    }

    if ('random' in spec) {
      return pickRandom(spec.random);
    }

    return 'default';
  }

  private resolveCulture(spec: CultureSpec | undefined, context: ExecutionContext): string {
    if (!spec) {
      return context.target?.culture || 'world';
    }

    if (typeof spec === 'string') {
      throw new Error(`Invalid culture spec: "${spec}". Use { fixed: "${spec}" } or { inherit: "entity_ref" }`);
    }

    if ('inherit' in spec) {
      const refEntity = context.resolveEntity(spec.inherit);
      const resolvedCulture = refEntity?.culture || 'world';
      // Debug: ensure we're not returning the raw variable reference
      if (resolvedCulture.startsWith('$')) {
        console.warn(`[resolveCulture] BUG: Resolved culture is a variable reference: ${resolvedCulture}. RefEntity: ${refEntity?.id}, spec.inherit: ${spec.inherit}`);
      }
      return resolvedCulture;
    }

    if ('fixed' in spec) {
      return spec.fixed;
    }

    throw new Error(`Invalid culture spec: ${JSON.stringify(spec)}. Must have 'inherit' or 'fixed' property.`);
  }

  private resolveDescription(spec: DescriptionSpec | undefined, context: ExecutionContext): string {
    if (!spec) return '';
    if (typeof spec === 'string') return spec;

    let result = spec.template;
    for (const [key, ref] of Object.entries(spec.replacements)) {
      const value = context.resolveString(ref);
      result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
    }
    return result;
  }

  /**
   * Derive strategy name from placement anchor type.
   */
  private getStrategyFromAnchor(anchor: PlacementAnchor): string {
    switch (anchor.type) {
      case 'entity':
        return 'near_entity';
      case 'culture':
        return 'within_culture';
      case 'refs_centroid':
        return 'near_centroid';
      case 'bounds':
        return 'within_bounds';
      case 'sparse':
        return anchor.preferPeriphery ? 'sparse_periphery' : 'sparse_area';
      default:
        return 'unknown';
    }
  }

  /**
   * Resolve placement to coordinates.
   */
  private async resolvePlacement(
    spec: PlacementSpec,
    context: ExecutionContext,
    culture: string,
    _placeholder: string,
    entityKind: string
  ): Promise<{
    coordinates: Point;
    strategy: string;
    derivedTags?: Record<string, string | boolean>;
    regionId?: string | null;
    allRegionIds?: string[];
    debug?: {
      anchorType: string;
      anchorEntity?: { id: string; name: string; kind: string };
      anchorCulture?: string;
      resolvedVia: string;
      seedRegionsAvailable?: string[];
      emergentRegionCreated?: { id: string; label: string };
    };
  }> {
    const { graphView } = context;

    // Collect anchor entities for placement
    const anchorEntities: HardState[] = [];
    const avoidEntities: HardState[] = [];

    // Clone spec to allow modification of anchor.id for culture type
    let resolvedSpec = spec;

    if (spec.anchor.type === 'entity') {
      const ref = context.resolveEntity(spec.anchor.ref);
      if (ref) anchorEntities.push(ref);
    } else if (spec.anchor.type === 'culture') {
      // Resolve culture anchor id: if it's a variable reference like "$target",
      // resolve to the entity's culture
      const anchorWithId = spec.anchor as { type: 'culture'; id?: string };
      if (anchorWithId.id?.startsWith('$')) {
        const refEntity = context.resolveEntity(anchorWithId.id);
        const resolvedCultureId = refEntity?.culture || culture;
        // Clone the spec with resolved culture id
        resolvedSpec = {
          ...spec,
          anchor: { ...spec.anchor, id: resolvedCultureId }
        };
      }
    } else if (spec.anchor.type === 'refs_centroid') {
      for (const refId of spec.anchor.refs) {
        const ref = context.resolveEntity(refId);
        if (ref) anchorEntities.push(ref);
      }
    }

    (spec.spacing?.avoidRefs || []).forEach(refId => {
      const ref = context.resolveEntity(refId);
      if (ref) avoidEntities.push(ref);
    });

    const placementResult = await graphView.placeWithPlacementOptions(
      entityKind,
      culture,
      resolvedSpec,
      anchorEntities,
      avoidEntities
    );

    if (placementResult) {
      return {
        coordinates: placementResult.coordinates,
        strategy: this.getStrategyFromAnchor(spec.anchor),
        derivedTags: placementResult.derivedTags,
        regionId: placementResult.regionId,
        allRegionIds: placementResult.allRegionIds,
        debug: placementResult.debug
      };
    }

    // Fallback to random placement (shouldn't happen if placeWithPlacementOptions handles fallbacks)
    const fallbackCoords = {
      x: Math.random() * 100,
      y: Math.random() * 100,
      z: 50
    };
    return {
      coordinates: fallbackCoords,
      strategy: 'random_fallback',
      debug: {
        anchorType: spec.anchor.type,
        resolvedVia: 'interpreter_fallback'
      }
    };
  }

  // ===========================================================================
  // STEP 4: RELATIONSHIPS
  // ===========================================================================

  private executeRelationship(
    rule: RelationshipRule,
    context: ExecutionContext,
    entityRefs: Map<string, string[]>
  ): Relationship[] {
    const relationships: Relationship[] = [];

    // Check condition
    if (rule.condition && !this.evaluateRelationshipCondition(rule.condition, context)) {
      return relationships;
    }

    // Resolve src and dst
    const srcIds = this.resolveRelationshipEntity(rule.src, context, entityRefs);
    const dstIds = this.resolveRelationshipEntity(rule.dst, context, entityRefs);

    for (const srcId of srcIds) {
      for (const dstId of dstIds) {
        if (srcId === dstId) continue;

        // Note: distance is computed from coordinates when relationship is added to graph
        const rel: Relationship = {
          kind: rule.kind,
          src: srcId,
          dst: dstId,
          strength: rule.strength
          // distance computed from coordinates, not set here
        };

        if (rule.catalyzedBy) {
          const catalyst = context.resolveEntity(rule.catalyzedBy);
          if (catalyst) {
            rel.catalyzedBy = catalyst.id;
          }
        }

        relationships.push(rel);

        if (rule.bidirectional) {
          relationships.push({
            kind: rule.kind,
            src: dstId,
            dst: srcId,
            strength: rule.strength,
            catalyzedBy: rel.catalyzedBy
          });
        }
      }
    }

    return relationships;
  }

  private resolveRelationshipEntity(
    ref: string,
    context: ExecutionContext,
    entityRefs: Map<string, string[]>
  ): string[] {
    // Check if it's a reference to created entities
    if (entityRefs.has(ref)) {
      return entityRefs.get(ref)!;
    }

    // Resolve as entity reference
    const entity = context.resolveEntity(ref);
    if (entity) {
      return [entity.id];
    }

    // It might be a placeholder
    if (ref.startsWith('will-be-assigned-')) {
      return [ref];
    }

    return [];
  }

  private evaluateRelationshipCondition(
    condition: RelationshipCondition,
    context: ExecutionContext
  ): boolean {
    switch (condition.type) {
      case 'random_chance':
        return Math.random() < condition.chance;

      case 'entity_exists': {
        const entity = context.resolveEntity(condition.entity);
        return !!entity;
      }

      case 'entity_has_relationship': {
        const entity = context.resolveEntity(condition.entity);
        if (!entity) return false;
        return entity.links.some(l => l.kind === condition.relationshipKind);
      }

      default:
        return true;
    }
  }

  // ===========================================================================
  // STEP 5: STATE UPDATES
  // ===========================================================================

  private executeStateUpdate(rule: StateUpdateRule, context: ExecutionContext): void {
    const { graphView } = context;

    switch (rule.type) {
      case 'update_rate_limit':
        graphView.rateLimitState.lastCreationTick = graphView.tick;
        graphView.rateLimitState.creationsThisEpoch += 1;
        break;

      case 'archive_relationship': {
        const entity = context.resolveEntity(rule.entity);
        if (!entity) break;

        if (rule.with === 'any') {
          // Archive all relationships of this kind involving the entity
          const direction = rule.direction || 'any';
          graphView.archiveRelationshipsByKind(entity.id, rule.relationshipKind, direction);
        } else {
          // Archive specific relationship with a known entity
          const withEntity = context.resolveEntity(rule.with);
          if (withEntity) {
            graphView.archiveRelationship(entity.id, withEntity.id, rule.relationshipKind);
          }
        }
        break;
      }

      case 'modify_pressure':
        graphView.modifyPressure(rule.pressureId, rule.delta);
        break;

      case 'update_entity_status': {
        const entity = context.resolveEntity(rule.entity);
        if (entity) {
          graphView.updateEntityStatus(entity.id, rule.newStatus);
        }
        break;
      }

      case 'set_tag': {
        const entity = context.resolveEntity(rule.entity);
        if (entity) {
          const newTags = { ...entity.tags, [rule.tag]: rule.value ?? true };
          graphView.updateEntity(entity.id, { tags: newTags });
        }
        break;
      }

      case 'remove_tag': {
        const entity = context.resolveEntity(rule.entity);
        if (entity) {
          const newTags = { ...entity.tags };
          delete newTags[rule.tag];
          graphView.updateEntity(entity.id, { tags: newTags });
        }
        break;
      }
    }
  }

  // ===========================================================================
  // STEP 6: VARIANT EVALUATION
  // ===========================================================================

  /**
   * Get all matching variants based on current world state.
   */
  private getMatchingVariants(
    variants: TemplateVariants | undefined,
    context: ExecutionContext
  ): TemplateVariant[] {
    if (!variants || !variants.options || variants.options.length === 0) {
      return [];
    }

    const matching: TemplateVariant[] = [];

    for (const variant of variants.options) {
      if (this.evaluateVariantCondition(variant.when, context)) {
        matching.push(variant);
        if (variants.selection === 'first_match') {
          break;
        }
      }
    }

    return matching;
  }

  /**
   * Evaluate a variant condition.
   */
  private evaluateVariantCondition(condition: VariantCondition, context: ExecutionContext): boolean {
    const { graphView } = context;

    switch (condition.type) {
      case 'pressure': {
        const pressure = graphView.getPressure(condition.pressureId) || 0;
        if (condition.min !== undefined && pressure < condition.min) return false;
        if (condition.max !== undefined && pressure > condition.max) return false;
        return true;
      }

      case 'pressure_compare': {
        const pressureA = graphView.getPressure(condition.pressureA) || 0;
        const pressureB = graphView.getPressure(condition.pressureB) || 0;
        return pressureA > pressureB;
      }

      case 'entity_count': {
        let entities = graphView.findEntities({ kind: condition.kind });
        if (condition.subtype) {
          entities = entities.filter(e => e.subtype === condition.subtype);
        }
        const count = entities.length;
        if (condition.min !== undefined && count < condition.min) return false;
        if (condition.max !== undefined && count > condition.max) return false;
        return true;
      }

      case 'has_tag': {
        const entity = context.resolveEntity(condition.entity);
        if (!entity) return false;
        return hasTag(entity.tags, condition.tag);
      }

      case 'random': {
        return Math.random() < condition.chance;
      }

      case 'always': {
        return true;
      }

      case 'and': {
        return condition.conditions.every(c => this.evaluateVariantCondition(c, context));
      }

      case 'or': {
        return condition.conditions.some(c => this.evaluateVariantCondition(c, context));
      }

      default:
        return false;
    }
  }

  /**
   * Apply variant effects to entities, relationships, and state updates.
   */
  private applyVariantEffects(
    effects: VariantEffects,
    entities: Partial<HardState>[],
    entityRefs: Map<string, string[]>,
    relationships: Relationship[],
    context: ExecutionContext
  ): void {
    // Apply subtype overrides
    if (effects.subtype) {
      for (const [entityRef, newSubtype] of Object.entries(effects.subtype)) {
        const placeholders = entityRefs.get(entityRef);
        if (placeholders) {
          // Find the entity indices matching these placeholders
          for (let i = 0; i < entities.length; i++) {
            // Entities are created in order, match by index to placeholder
            const placeholder = `will-be-assigned-${i}`;
            if (placeholders.includes(placeholder)) {
              entities[i].subtype = newSubtype;
            }
          }
        }
      }
    }

    // Apply additional tags
    if (effects.tags) {
      for (const [entityRef, tagMap] of Object.entries(effects.tags)) {
        const placeholders = entityRefs.get(entityRef);
        if (placeholders) {
          for (let i = 0; i < entities.length; i++) {
            const placeholder = `will-be-assigned-${i}`;
            if (placeholders.includes(placeholder)) {
              entities[i].tags = { ...(entities[i].tags || {}), ...tagMap };
            }
          }
        }
      }
    }

    // Apply additional relationships
    if (effects.relationships) {
      for (const rule of effects.relationships) {
        const rels = this.executeRelationship(rule, context, entityRefs);
        relationships.push(...rels);
      }
    }

    // Apply additional state updates
    if (effects.stateUpdates) {
      for (const rule of effects.stateUpdates) {
        this.executeStateUpdate(rule, context);
      }
    }
  }

  // ===========================================================================
  // VARIABLE RESOLUTION
  // ===========================================================================

  private resolveVariable(
    def: VariableDefinition,
    context: ExecutionContext
  ): HardState | HardState[] | undefined {
    const { select } = def;
    const { graphView } = context;

    let entities: HardState[];

    // Determine source
    if (select.from && select.from !== 'graph') {
      const relatedTo = context.resolveEntity(select.from.relatedTo);
      if (!relatedTo) {
        return select.fallback ? context.resolveEntity(select.fallback) : undefined;
      }
      entities = graphView.getRelatedEntities(
        relatedTo.id,
        select.from.relationship,
        select.from.direction
      );
    } else {
      entities = graphView.findEntities({ kind: select.kind });
    }

    // Apply filters
    if (select.subtypes && select.subtypes.length > 0) {
      entities = entities.filter(e => select.subtypes!.includes(e.subtype));
    }
    if (select.statusFilter) {
      entities = entities.filter(e => e.status === select.statusFilter);
    }
    if (select.filters) {
      for (const filter of select.filters) {
        entities = this.applySelectionFilter(entities, filter, context);
      }
    }

    // Apply prefer filters (try these first)
    if (select.preferFilters && select.preferFilters.length > 0) {
      let preferred = entities;
      for (const filter of select.preferFilters) {
        preferred = this.applySelectionFilter(preferred, filter, context);
      }
      if (preferred.length > 0) {
        entities = preferred;
      }
    }

    // Apply pick strategy
    if (entities.length === 0) {
      return select.fallback ? context.resolveEntity(select.fallback) : undefined;
    }

    switch (select.pickStrategy) {
      case 'random':
        return pickRandom(entities);
      case 'first':
        return entities[0];
      case 'all':
        return entities;
      default:
        return pickRandom(entities);
    }
  }
}

// =============================================================================
// ADAPTER: Convert DeclarativeTemplate to GrowthTemplate
// =============================================================================

import type { GrowthTemplate } from './types';

/**
 * Creates a GrowthTemplate from a DeclarativeTemplate.
 * This allows declarative templates to be used with the existing WorldEngine.
 */
export function createTemplateFromDeclarative(
  template: DeclarativeTemplate,
  interpreter: TemplateInterpreter
): GrowthTemplate {
  return {
    id: template.id,
    name: template.name,

    canApply: (graphView: TemplateGraphView) => {
      return interpreter.canApply(template, graphView);
    },

    findTargets: (graphView: TemplateGraphView) => {
      return interpreter.findTargets(template, graphView);
    },

    expand: async (graphView: TemplateGraphView, target?: HardState) => {
      return interpreter.expand(template, graphView, target);
    }
  };
}
