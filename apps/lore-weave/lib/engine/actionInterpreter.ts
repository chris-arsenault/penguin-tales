/**
 * Action Interpreter
 *
 * Converts declarative action configurations (JSON) into executable action handlers.
 * This enables actions to be defined as pure data in the canonry project files,
 * while the universalCatalyst system executes them.
 *
 * Action Types:
 * - Relationship creation: Create relationships between actor and target
 * - Relationship strengthening: Increase strength of existing relationships
 * - Target selection: Find valid targets based on criteria
 */

import { HardState, Relationship } from '../core/worldTypes';
import { TemplateGraphView } from '../graph/templateGraphView';
import { SelectionFilter } from './declarativeTypes';
import {
  ActionEntityResolver,
  applySelectionFilters as sharedApplySelectionFilters,
} from '../selection';

// =============================================================================
// DECLARATIVE ACTION TYPES
// =============================================================================

/**
 * Actor configuration - who can attempt this action
 */
export interface ActionActorConfig {
  /** Entity kinds that can be actors */
  kinds: string[];
  /** Optional subtype filter */
  subtypes?: string[];
  /** Optional status filter */
  statuses?: string[];
  /** Pressures must exceed these thresholds */
  requiredPressures?: Record<string, number>;
  /** Selection filters (same as generator targeting) */
  filters?: SelectionFilter[];
}

/**
 * Actor resolution - how to resolve the "acting entity" (e.g., NPC -> their faction)
 */
export interface ActionActorResolution {
  /** Resolution type */
  type: 'self' | 'via_relationship';
  /** Relationship kind to follow (for via_relationship) */
  relationshipKind?: string;
  /** Expected kind of resolved entity */
  targetKind?: string;
  /** Require specific subtype on resolved entity */
  requireSubtype?: string;
}

/**
 * Target configuration - how to find valid targets
 */
export interface ActionTargetConfig {
  /** Target entity kind */
  kind: string;
  /** Filter by subtype */
  subtypes?: string[];
  /** Filter by status */
  statuses?: string[];
  /** Select two targets (for actions like trade routes) */
  selectTwo?: boolean;
  /** Exclude self (for faction-to-faction actions) */
  excludeSelf?: boolean;
  /** Selection filters (same as generator targeting) */
  filters?: SelectionFilter[];
}

/**
 * Relationship to create on success
 */
export interface OutcomeRelationship {
  /** Relationship kind */
  kind: string;
  /** Source entity */
  src: 'actor' | 'target' | 'target2' | 'resolved_actor' | 'corruption_source';
  /** Destination entity */
  dst: 'actor' | 'target' | 'target2' | 'resolved_actor' | 'corruption_source';
  /** Initial strength */
  strength: number;
  /** Create reverse relationship too */
  bidirectional?: boolean;
}

/**
 * Relationship to strengthen on success
 */
export interface RelationshipStrengthening {
  /** Relationship kind to strengthen */
  kind: string;
  /** Amount to increase strength */
  amount: number;
}

/**
 * Action outcome configuration
 */
export interface ActionOutcomeConfig {
  /** Relationships to create */
  relationships?: OutcomeRelationship[];
  /** Relationships to strengthen */
  strengthenRelationships?: RelationshipStrengthening[];
  /** Pressure changes */
  pressureChanges?: Record<string, number>;
  /** Description template (supports {actor.name}, {target.name}, etc.) */
  descriptionTemplate: string;
}

/**
 * Action probability configuration
 */
export interface ActionProbabilityConfig {
  /** Base success chance (0-1) */
  baseSuccessChance: number;
  /** Selection weight for weighted random */
  baseWeight: number;
  /** Pressure IDs that affect this action's weight (high pressure = more likely) */
  pressureModifiers?: string[];
}

/**
 * Complete declarative action configuration
 */
export interface DeclarativeAction {
  /** Unique identifier */
  id: string;
  /** Display name */
  name: string;
  /** Description of what this action does */
  description: string;

  /** Who can attempt this action */
  actor: ActionActorConfig;
  /** How to resolve the acting entity */
  actorResolution?: ActionActorResolution;
  /** How to find valid targets */
  targeting: ActionTargetConfig;
  /** What happens on success */
  outcome: ActionOutcomeConfig;
  /** Probability settings */
  probability: ActionProbabilityConfig;
}

/**
 * Executable action (what universalCatalyst uses)
 */
export interface ExecutableAction {
  type: string;
  name: string;
  description: string;
  baseSuccessChance: number;
  baseWeight: number;
  /** Pressure IDs that affect this action's weight */
  pressureModifiers: string[];
  requirements?: {
    requiredPressures?: Record<string, number>;
  };
  handler: (graph: TemplateGraphView, actor: HardState, target?: HardState) => ActionResult;
}

/**
 * Action execution result
 */
export interface ActionResult {
  success: boolean;
  relationships: Relationship[];
  description: string;
  entitiesCreated?: string[];
  entitiesModified?: string[];
}


// =============================================================================
// ACTION INTERPRETATION
// =============================================================================

/**
 * Resolve the acting entity based on actor resolution config.
 * For example, an NPC leading a faction resolves to that faction.
 */
function resolveActor(
  actor: HardState,
  resolution: ActionActorResolution | undefined,
  graph: TemplateGraphView
): HardState | null {
  if (!resolution || resolution.type === 'self') {
    return actor;
  }

  if (resolution.type === 'via_relationship' && resolution.relationshipKind) {
    // Actor already is the target kind
    if (resolution.targetKind && actor.kind === resolution.targetKind) {
      if (resolution.requireSubtype && actor.subtype !== resolution.requireSubtype) {
        return null;
      }
      return actor;
    }

    // Find via relationship
    const rel = actor.links.find(l => l.kind === resolution.relationshipKind);
    if (!rel) return null;

    const resolved = graph.getEntity(rel.dst);
    if (!resolved) return null;

    if (resolution.targetKind && resolved.kind !== resolution.targetKind) {
      return null;
    }

    if (resolution.requireSubtype && resolved.subtype !== resolution.requireSubtype) {
      return null;
    }

    return resolved;
  }

  return actor;
}

/**
 * Find valid targets for an action.
 */
function findTargets(
  actor: HardState,
  resolvedActor: HardState | null,
  targeting: ActionTargetConfig,
  graph: TemplateGraphView
): HardState[] {
  let candidates = graph.getEntities().filter(e => {
    // Kind filter
    if (e.kind !== targeting.kind) return false;

    // Subtype filter
    if (targeting.subtypes && !targeting.subtypes.includes(e.subtype)) return false;

    // Status filter
    if (targeting.statuses && !targeting.statuses.includes(e.status)) return false;

    return true;
  });

  // Self exclusion
  if (targeting.excludeSelf) {
    candidates = candidates.filter(e => {
      if (e.id === actor.id) return false;
      if (resolvedActor && e.id === resolvedActor.id) return false;
      return true;
    });
  }

  // Apply selection filters using shared module
  if (targeting.filters && targeting.filters.length > 0) {
    const resolver = new ActionEntityResolver(graph, actor, resolvedActor);
    candidates = sharedApplySelectionFilters(candidates, targeting.filters, resolver);
  }

  return candidates;
}

/**
 * Resolve entity reference for relationship creation.
 */
function resolveEntityRef(
  ref: string,
  actor: HardState,
  resolvedActor: HardState | null,
  target: HardState,
  target2: HardState | undefined,
  graph: TemplateGraphView
): string | null {
  switch (ref) {
    case 'actor':
      return actor.id;
    case 'resolved_actor':
      return resolvedActor?.id || actor.id;
    case 'target':
      return target.id;
    case 'target2':
      return target2?.id || null;
    case 'corruption_source':
      // Find a corruption ability or use the resolved actor
      const corruption = graph.getEntities().find(
        e => e.kind === 'abilities' && e.name.toLowerCase().includes('corruption')
      );
      return corruption?.id || resolvedActor?.id || null;
    default:
      return null;
  }
}

/**
 * Create relationships from outcome configuration.
 */
function createRelationships(
  outcomeRels: OutcomeRelationship[],
  actor: HardState,
  resolvedActor: HardState | null,
  target: HardState,
  target2: HardState | undefined,
  graph: TemplateGraphView,
  tick: number
): Relationship[] {
  const relationships: Relationship[] = [];

  for (const rel of outcomeRels) {
    const srcId = resolveEntityRef(rel.src, actor, resolvedActor, target, target2, graph);
    const dstId = resolveEntityRef(rel.dst, actor, resolvedActor, target, target2, graph);

    if (!srcId || !dstId) continue;

    relationships.push({
      kind: rel.kind,
      src: srcId,
      dst: dstId,
      strength: rel.strength,
      createdAt: tick
    });

    if (rel.bidirectional) {
      relationships.push({
        kind: rel.kind,
        src: dstId,
        dst: srcId,
        strength: rel.strength,
        createdAt: tick
      });
    }
  }

  return relationships;
}

/**
 * Format description template with entity names.
 */
function formatDescription(
  template: string,
  actor: HardState,
  resolvedActor: HardState | null,
  target: HardState,
  target2?: HardState
): string {
  return template
    .replace('{actor.name}', actor.name)
    .replace('{resolved_actor.name}', resolvedActor?.name || actor.name)
    .replace('{target.name}', target.name)
    .replace('{target2.name}', target2?.name || '');
}

/**
 * Create an executable action handler from declarative configuration.
 */
function createActionHandler(action: DeclarativeAction): ExecutableAction['handler'] {
  return (graph: TemplateGraphView, actor: HardState): ActionResult => {
    // Resolve actor
    const resolvedActor = resolveActor(actor, action.actorResolution, graph);
    if (!resolvedActor && action.actorResolution?.type === 'via_relationship') {
      return {
        success: false,
        relationships: [],
        description: `has no ${action.actorResolution.targetKind || 'entity'} to act through`
      };
    }

    // Find targets
    const candidates = findTargets(actor, resolvedActor, action.targeting, graph);

    if (candidates.length === 0) {
      return {
        success: false,
        relationships: [],
        description: `found no valid ${action.targeting.kind} targets`
      };
    }

    // Select target(s)
    const target = candidates[Math.floor(Math.random() * candidates.length)];
    let target2: HardState | undefined;

    if (action.targeting.selectTwo) {
      const remaining = candidates.filter(c => c.id !== target.id);
      if (remaining.length === 0) {
        return {
          success: false,
          relationships: [],
          description: `cannot find second ${action.targeting.kind} target`
        };
      }
      target2 = remaining[Math.floor(Math.random() * remaining.length)];
    }

    // Create relationships
    const relationships = action.outcome.relationships
      ? createRelationships(
          action.outcome.relationships,
          actor,
          resolvedActor,
          target,
          target2,
          graph,
          graph.tick
        )
      : [];

    // TODO: Handle relationship strengthening
    // if (action.outcome.strengthenRelationships) { ... }

    const description = formatDescription(
      action.outcome.descriptionTemplate,
      actor,
      resolvedActor,
      target,
      target2
    );

    const modifiedIds = [target.id];
    if (target2) modifiedIds.push(target2.id);

    return {
      success: true,
      relationships,
      description,
      entitiesModified: modifiedIds
    };
  };
}

/**
 * Convert a declarative action to an executable action.
 */
export function createExecutableAction(action: DeclarativeAction): ExecutableAction {
  return {
    type: action.id,
    name: action.name,
    description: action.description,
    baseSuccessChance: action.probability.baseSuccessChance,
    baseWeight: action.probability.baseWeight,
    pressureModifiers: action.probability.pressureModifiers || [],
    requirements: {
      requiredPressures: action.actor.requiredPressures
    },
    handler: createActionHandler(action)
  };
}

/**
 * Load declarative actions and convert them to executable actions.
 */
export function loadActions(actions: DeclarativeAction[]): ExecutableAction[] {
  if (!Array.isArray(actions)) {
    console.warn('loadActions: expected array, got', typeof actions);
    return [];
  }

  const executableActions: ExecutableAction[] = [];

  for (const action of actions) {
    if (!action || !action.id) {
      console.warn('loadActions: skipping invalid action', action);
      continue;
    }

    try {
      const executable = createExecutableAction(action);
      executableActions.push(executable);
    } catch (error) {
      console.error(`Failed to create action ${action.id}:`, error);
    }
  }

  return executableActions;
}

