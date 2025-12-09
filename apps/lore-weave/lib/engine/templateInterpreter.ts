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
    return targets.length > 0;
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
    if (applicabilityPassed) {
      const targets = this.executeSelection(template.selection, context);
      selectionCount = targets.length;
      selectionStrategy = template.selection?.strategy || 'random';
    }

    return {
      canApply: applicabilityPassed && selectionCount > 0,
      applicabilityPassed,
      failedRules,
      selectionCount,
      selectionStrategy
    };
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
        if (pressure > rule.max) {
          return Math.random() < (rule.extremeChance ?? 0.3);
        }
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

      case 'has_any_tag': {
        const tagList = filter.tags || [];
        if (tagList.length === 0) return entities;
        return entities.filter(entity => tagList.some(tag => hasTag(entity.tags, tag)));
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
      return refEntity?.culture || 'world';
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

    if (spec.anchor.type === 'entity') {
      const ref = context.resolveEntity(spec.anchor.ref);
      if (ref) anchorEntities.push(ref);
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
      spec,
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
        const withEntity = context.resolveEntity(rule.with);
        if (entity && withEntity) {
          graphView.archiveRelationship(entity.id, withEntity.id, rule.relationshipKind);
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
