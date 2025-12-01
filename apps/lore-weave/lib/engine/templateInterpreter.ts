/**
 * Template Interpreter
 *
 * Executes declarative templates without custom TypeScript code.
 * Templates are pure JSON data; this interpreter provides the execution logic.
 */

import type { HardState, Relationship } from '../core/worldTypes';
import type { TemplateGraphView } from '../graph/templateGraphView';
import type { TemplateResult } from './types';
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
  NearAncestorPlacement,
  AncestorFilterSpec,
  LineageSpec,
  CountRange,
  RelationshipCondition,
  GraphPathAssertion,
  PathStep,
  PathConstraint,
  ExecutionContext as IExecutionContext
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
    const lineageRelationships: Relationship[] = [];  // Relationships from near_ancestor placement

    for (const rule of template.creation) {
      const created = await this.executeCreation(rule, context, entities.length);
      entities.push(...created.entities);
      entityRefs.set(rule.entityRef, created.placeholders);
      lineageRelationships.push(...created.lineageRelationships);
    }

    // Execute relationship rules
    const relationships: Relationship[] = [...lineageRelationships];
    for (const rule of template.relationships) {
      const rels = this.executeRelationship(rule, context, entityRefs);
      relationships.push(...rels);
    }

    // Execute state updates
    for (const rule of template.stateUpdates) {
      this.executeStateUpdate(rule, context);
    }

    return {
      entities,
      relationships,
      description: `${template.name} executed`
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

      case 'graph_path': {
        // Find starting entities
        const startEntities = graphView.findEntities({
          kind: rule.from.kind,
          subtype: rule.from.subtype,
          status: rule.from.status
        });

        // Check if ANY starting entity satisfies the assertion
        return startEntities.some(startEntity => {
          // Create a fresh context for this entity's path evaluation
          const pathContext = new ExecutionContext(graphView);
          pathContext.target = startEntity;
          return this.evaluateGraphPath(startEntity, rule.assert, pathContext);
        });
      }

      case 'tag_exists': {
        // Find entities matching the filter criteria
        let entities = graphView.findEntities({ kind: rule.kind });
        if (rule.subtype) {
          entities = entities.filter(e => e.subtype === rule.subtype);
        }
        if (rule.status) {
          entities = entities.filter(e => e.status === rule.status);
        }
        // Filter to those with the tag
        const entitiesWithTag = entities.filter(e => {
          if (!hasTag(e.tags, rule.tag)) return false;
          // If specific value required, check it matches
          if (rule.tagValue !== undefined) {
            const value = getTagValue(e.tags, rule.tag);
            return value === rule.tagValue;
          }
          return true;
        });
        const minCount = rule.minCount ?? 1;
        return entitiesWithTag.length >= minCount;
      }

      case 'tag_absent': {
        // Find entities matching the filter criteria
        let entities = graphView.findEntities({ kind: rule.kind });
        if (rule.subtype) {
          entities = entities.filter(e => e.subtype === rule.subtype);
        }
        if (rule.status) {
          entities = entities.filter(e => e.status === rule.status);
        }
        // Check that NO entities have the tag
        return entities.every(e => !hasTag(e.tags, rule.tag));
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

    // Filter by target kind/subtype/status
    if (step.targetKind) {
      related = related.filter(e => e.kind === step.targetKind);
    }
    if (step.targetSubtype) {
      related = related.filter(e => e.subtype === step.targetSubtype);
    }
    if (step.targetStatus) {
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

      case 'same_location': {
        const refEntity = context.resolveEntity(filter.as);
        if (!refEntity) return entities;
        const refLocation = context.graphView.getLocation(refEntity.id);
        if (!refLocation) return entities;
        return entities.filter(e => {
          const loc = context.graphView.getLocation(e.id);
          return loc?.id === refLocation.id;
        });
      }

      case 'not_at_war': {
        const withEntity = context.resolveEntity(filter.with);
        if (!withEntity) return entities;
        return entities.filter(entity =>
          !context.graphView.hasRelationship(entity.id, withEntity.id, 'at_war_with') &&
          !context.graphView.hasRelationship(withEntity.id, entity.id, 'at_war_with')
        );
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
  ): Promise<{ entities: Partial<HardState>[]; placeholders: string[]; lineageRelationships: Relationship[] }> {
    const entities: Partial<HardState>[] = [];
    const placeholders: string[] = [];
    const lineageRelationships: Relationship[] = [];

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

      // Resolve placement (may also create lineage relationship for near_ancestor)
      const placementResult = this.resolvePlacement(rule.placement, context, culture, placeholder);

      const entity: Partial<HardState> = {
        kind: rule.kind,
        subtype,
        status: rule.status || 'active',
        prominence: rule.prominence || 'marginal',
        culture,
        description,
        tags: rule.tags || {},
        coordinates: placementResult.coordinates,
        links: []
      };

      entities.push(entity);

      // Collect lineage relationship from near_ancestor placement
      if (placementResult.lineageRelationship) {
        lineageRelationships.push(placementResult.lineageRelationship);
      }

      // Process inline lineage spec (separate from placement)
      if (rule.lineage) {
        const lineageRel = this.resolveLineage(rule.lineage, context, entity, placeholder);
        if (lineageRel) {
          lineageRelationships.push(lineageRel);
        }
      }
    }

    return { entities, placeholders, lineageRelationships };
  }

  /**
   * Resolve lineage spec: find ancestor and create lineage relationship.
   */
  private resolveLineage(
    spec: LineageSpec,
    context: ExecutionContext,
    newEntity: Partial<HardState>,
    placeholder: string
  ): Relationship | undefined {
    const { graphView } = context;

    // Find ancestor using filters (try each in order)
    let ancestor: HardState | undefined;
    for (const filter of spec.ancestorFilter) {
      const candidates = this.findAncestorCandidates(graphView, filter, newEntity.culture || '');
      if (candidates.length > 0) {
        ancestor = pickRandom(candidates);
        break;
      }
    }

    // No ancestor found - skip lineage
    if (!ancestor) {
      return undefined;
    }

    // Calculate distance within specified range (0-100 scale)
    const { min, max } = spec.distanceRange;
    const distance = min + Math.random() * (max - min);

    // Create lineage relationship
    return {
      kind: spec.relationshipKind,
      src: placeholder,  // Will be resolved to real ID by worldEngine
      dst: ancestor.id,
      distance
    };
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

    if ('inherit' in spec) {
      const refEntity = context.resolveEntity(spec.inherit);
      return refEntity?.culture || 'world';
    }

    if ('fixed' in spec) {
      return spec.fixed;
    }

    return 'world';
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
   * Result of placement resolution.
   * Includes coordinates and optionally a lineage relationship (for near_ancestor).
   */
  private resolvePlacement(
    spec: PlacementSpec,
    context: ExecutionContext,
    culture: string,
    placeholder: string
  ): { coordinates: Point; lineageRelationship?: Relationship } {
    const { graphView } = context;

    switch (spec.type) {
      case 'near_entity': {
        const refEntity = context.resolveEntity(spec.entity);
        if (refEntity?.coordinates) {
          const offset = spec.maxDistance || 10;
          return {
            coordinates: {
              x: refEntity.coordinates.x + (Math.random() - 0.5) * offset,
              y: refEntity.coordinates.y + (Math.random() - 0.5) * offset,
              z: refEntity.coordinates.z
            }
          };
        }
        break;
      }

      case 'in_culture_region': {
        const cultureId = context.resolveString(spec.culture);
        const result = graphView.deriveCoordinatesWithCulture(cultureId, 'entity', []);
        if (result) {
          return { coordinates: result.coordinates };
        }
        break;
      }

      case 'at_location': {
        const location = context.resolveEntity(spec.location);
        if (location?.coordinates) {
          return { coordinates: { ...location.coordinates } };
        }
        break;
      }

      case 'derived_from_references': {
        const refs = spec.references
          .map(ref => context.resolveEntity(ref))
          .filter((e): e is HardState => !!e);
        const cultureId = spec.culture ? context.resolveString(spec.culture) : culture;
        const result = graphView.deriveCoordinatesWithCulture(cultureId, 'entity', refs);
        if (result) {
          return { coordinates: result.coordinates };
        }
        break;
      }

      case 'random_in_bounds': {
        const bounds = spec.bounds || { x: [0, 100], y: [0, 100] };
        return {
          coordinates: {
            x: bounds.x[0] + Math.random() * (bounds.x[1] - bounds.x[0]),
            y: bounds.y[0] + Math.random() * (bounds.y[1] - bounds.y[0]),
            z: bounds.z ? bounds.z[0] + Math.random() * (bounds.z[1] - bounds.z[0]) : 50
          }
        };
      }

      case 'near_ancestor': {
        return this.resolveNearAncestorPlacement(spec, context, culture, placeholder);
      }
    }

    // Fallback
    return {
      coordinates: {
        x: 50 + (Math.random() - 0.5) * 20,
        y: 50 + (Math.random() - 0.5) * 20,
        z: 50
      }
    };
  }

  /**
   * Handle near_ancestor placement: find ancestor, place nearby, create lineage relationship.
   */
  private resolveNearAncestorPlacement(
    spec: NearAncestorPlacement,
    context: ExecutionContext,
    culture: string,
    placeholder: string
  ): { coordinates: Point; lineageRelationship?: Relationship } {
    const { graphView } = context;

    // Find ancestor using filters (try each in order)
    let ancestor: HardState | undefined;
    for (const filter of spec.ancestorFilter) {
      const candidates = this.findAncestorCandidates(graphView, filter, culture);
      if (candidates.length > 0) {
        ancestor = pickRandom(candidates);
        break;
      }
    }

    // If no ancestor found, fall back to random placement
    if (!ancestor || !ancestor.coordinates) {
      return {
        coordinates: {
          x: 50 + (Math.random() - 0.5) * 20,
          y: 50 + (Math.random() - 0.5) * 20,
          z: 50
        }
      };
    }

    // Calculate distance within specified range (0-100 scale)
    const { min, max } = spec.distanceRange;
    const targetDistance = min + Math.random() * (max - min);

    // Place at target distance from ancestor (random direction)
    const angle = Math.random() * 2 * Math.PI;
    const phi = Math.random() * Math.PI;  // For 3D placement

    const coordinates: Point = {
      x: Math.max(0, Math.min(100, ancestor.coordinates.x + targetDistance * Math.cos(angle) * Math.sin(phi))),
      y: Math.max(0, Math.min(100, ancestor.coordinates.y + targetDistance * Math.sin(angle) * Math.sin(phi))),
      z: Math.max(0, Math.min(100, ancestor.coordinates.z + targetDistance * Math.cos(phi)))
    };

    // Calculate actual Euclidean distance (may differ from target due to clamping)
    const dx = coordinates.x - ancestor.coordinates.x;
    const dy = coordinates.y - ancestor.coordinates.y;
    const dz = coordinates.z - ancestor.coordinates.z;
    const actualDistance = Math.sqrt(dx * dx + dy * dy + dz * dz);

    // Create lineage relationship with actual distance
    const lineageRelationship: Relationship = {
      kind: spec.relationshipKind,
      src: placeholder,  // Will be resolved to real ID by worldEngine
      dst: ancestor.id,
      distance: actualDistance
    };

    return { coordinates, lineageRelationship };
  }

  /**
   * Find candidate ancestors matching a filter.
   */
  private findAncestorCandidates(
    graphView: TemplateGraphView,
    filter: AncestorFilterSpec,
    newEntityCulture: string
  ): HardState[] {
    // Build criteria
    const criteria: { kind: string; subtype?: string; status?: string } = {
      kind: filter.kind
    };
    if (filter.subtype) criteria.subtype = filter.subtype;
    if (filter.status) criteria.status = filter.status;

    let candidates = graphView.findEntities(criteria);

    // Filter by same culture if specified
    if (filter.sameCulture && newEntityCulture) {
      const sameCultureCandidates = candidates.filter(c => c.culture === newEntityCulture);
      if (sameCultureCandidates.length > 0) {
        candidates = sameCultureCandidates;
      }
    }

    return candidates;
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

        const distance = typeof rule.distance === 'number'
          ? rule.distance
          : rule.distance
            ? rule.distance.min + Math.random() * (rule.distance.max - rule.distance.min)
            : undefined;

        const rel: Relationship = {
          kind: rule.kind,
          src: srcId,
          dst: dstId,
          strength: rule.strength,
          distance
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
            distance,
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
    metadata: template.metadata,
    contract: template.contract,

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
