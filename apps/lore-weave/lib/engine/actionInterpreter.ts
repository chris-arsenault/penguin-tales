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
 * Pressure band requirement - action available only when pressure is within range
 */
export interface PressureBand {
  /** Pressure ID */
  pressure: string;
  /** Minimum value (-100 to 100), optional */
  min?: number;
  /** Maximum value (-100 to 100), optional */
  max?: number;
}

/**
 * Instigator configuration - optional entity that triggers the action on behalf of the actor
 */
export interface InstigatorConfig {
  /** Relationship kind connecting instigator to actor */
  relationshipKind: string;
  /** Direction: 'in' = instigator has relationship TO actor, 'out' = actor has relationship TO instigator */
  direction: 'in' | 'out';
  /** Entity kinds that can be instigators */
  kinds?: string[];
  /** Optional subtype filter */
  subtypes?: string[];
  /** Optional status filter */
  statuses?: string[];
  /** Selection filters on instigator */
  filters?: SelectionFilter[];
  /** Is an instigator required? Default false - actor can act alone */
  required?: boolean;
}

/**
 * Actor configuration - who can attempt this action
 */
export interface ActionActorConfig {
  /** Entity kinds that can be actors (the entity that interacts with the target) */
  kinds: string[];
  /** Optional subtype filter */
  subtypes?: string[];
  /** Optional status filter */
  statuses?: string[];
  /** Pressure bands - action available only when pressures are within ranges */
  requiredPressures?: PressureBand[];
  /** Selection filters (same as generator targeting) */
  filters?: SelectionFilter[];
  /** Optional instigator - entity that triggers the action on behalf of actor */
  instigator?: InstigatorConfig;
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

/** Entity reference for outcome relationships */
export type OutcomeEntityRef = 'actor' | 'instigator' | 'target' | 'target2';

/**
 * Relationship to create on success
 */
export interface OutcomeRelationship {
  /** Relationship kind */
  kind: string;
  /** Source entity */
  src: OutcomeEntityRef;
  /** Destination entity */
  dst: OutcomeEntityRef;
  /** Initial strength */
  strength: number;
  /** Create reverse relationship too */
  bidirectional?: boolean;
}

/** Channel for relationship strengthening */
export type StrengtheningChannel = 'instigator_actor' | 'actor_target';

/**
 * Relationship to strengthen on success
 */
export interface RelationshipStrengthening {
  /** Relationship kind to strengthen */
  kind: string;
  /** Which entities to strengthen relationship between */
  channel: StrengtheningChannel;
  /** Amount to increase strength (can be negative to weaken) */
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
  /** Apply system-level prominence changes to actor on success/failure */
  applyProminenceToActor?: boolean;
  /** Apply system-level prominence changes to instigator on success/failure */
  applyProminenceToInstigator?: boolean;
  /** Description template (supports {actor.name}, {target.name}, etc.) */
  descriptionTemplate: string;
}

/**
 * Pressure modifier - how a pressure affects action weight and attempt chance
 */
export interface PressureModifier {
  /** Pressure ID */
  pressure: string;
  /** Multiplier for how pressure affects weight/attempt chance.
   *  Positive: high pressure increases likelihood
   *  Negative: high pressure decreases likelihood (inverse relationship)
   *  e.g., 1.0 means full effect, 0.5 means half effect, -1.0 means inverse
   */
  multiplier: number;
}

/**
 * Action probability configuration
 */
export interface ActionProbabilityConfig {
  /** Base success chance (0-1) */
  baseSuccessChance: number;
  /** Selection weight for weighted random */
  baseWeight: number;
  /** Pressure modifiers that affect this action's weight and attempt chance */
  pressureModifiers?: PressureModifier[];
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

  /** Who can attempt this action (primary actor + optional instigator) */
  actor: ActionActorConfig;
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
  /** Pressure modifiers that affect this action's weight and attempt chance */
  pressureModifiers: PressureModifier[];
  /** Actor configuration for filtering valid actors */
  actorConfig: ActionActorConfig;
  /** Apply system-level prominence changes to actor on success/failure */
  applyProminenceToActor: boolean;
  /** Apply system-level prominence changes to instigator on success/failure */
  applyProminenceToInstigator: boolean;
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
  /** ID of the instigator entity, if any (for prominence changes) */
  instigatorId?: string;
}


// =============================================================================
// ACTION INTERPRETATION
// =============================================================================

/**
 * Find an instigator for the action based on instigator config.
 * Instigator is an optional entity that triggers the action on behalf of the actor.
 *
 * @param actor The primary actor (e.g., faction)
 * @param instigatorConfig How to find the instigator
 * @param graph The graph to search
 * @returns The instigator entity, or null if not found
 */
function findInstigator(
  actor: HardState,
  instigatorConfig: InstigatorConfig | undefined,
  graph: TemplateGraphView
): HardState | null {
  if (!instigatorConfig) return null;

  const { relationshipKind, direction, kinds, subtypes, statuses, filters } = instigatorConfig;

  // Find entities with the specified relationship to the actor
  let candidates: HardState[];

  if (direction === 'in') {
    // Instigator has relationship TO actor (e.g., NPC --leader_of--> Faction)
    candidates = graph.getEntities().filter(e => {
      return e.links.some(link =>
        link.kind === relationshipKind && link.dst === actor.id
      );
    });
  } else {
    // Actor has relationship TO instigator (e.g., Faction --has_leader--> NPC)
    const relatedIds = actor.links
      .filter(link => link.kind === relationshipKind)
      .map(link => link.dst);
    candidates = relatedIds
      .map(id => graph.getEntity(id))
      .filter((e): e is HardState => e !== undefined);
  }

  // Apply kind filter
  if (kinds && kinds.length > 0) {
    candidates = candidates.filter(e => kinds.includes(e.kind));
  }

  // Apply subtype filter
  if (subtypes && subtypes.length > 0) {
    candidates = candidates.filter(e => subtypes.includes(e.subtype));
  }

  // Apply status filter
  if (statuses && statuses.length > 0) {
    candidates = candidates.filter(e => statuses.includes(e.status));
  }

  // Apply selection filters
  if (filters && filters.length > 0) {
    const resolver = new ActionEntityResolver(graph, actor, null);
    candidates = sharedApplySelectionFilters(candidates, filters, resolver);
  }

  // Return first matching instigator (could add weighted selection later)
  return candidates.length > 0 ? candidates[0] : null;
}

/**
 * Find valid targets for an action.
 */
function findTargets(
  actor: HardState,
  instigator: HardState | null,
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

  // Self exclusion (exclude actor and instigator)
  if (targeting.excludeSelf) {
    candidates = candidates.filter(e => {
      if (e.id === actor.id) return false;
      if (instigator && e.id === instigator.id) return false;
      return true;
    });
  }

  // Apply selection filters using shared module
  if (targeting.filters && targeting.filters.length > 0) {
    const resolver = new ActionEntityResolver(graph, actor, instigator);
    candidates = sharedApplySelectionFilters(candidates, targeting.filters, resolver);
  }

  return candidates;
}

/**
 * Resolve entity reference for relationship creation.
 */
function resolveEntityRef(
  ref: OutcomeEntityRef,
  actor: HardState,
  instigator: HardState | null,
  target: HardState,
  target2: HardState | undefined
): string | null {
  switch (ref) {
    case 'actor':
      return actor.id;
    case 'instigator':
      return instigator?.id || null;
    case 'target':
      return target.id;
    case 'target2':
      return target2?.id || null;
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
  instigator: HardState | null,
  target: HardState,
  target2: HardState | undefined,
  tick: number
): Relationship[] {
  const relationships: Relationship[] = [];

  for (const rel of outcomeRels) {
    const srcId = resolveEntityRef(rel.src, actor, instigator, target, target2);
    const dstId = resolveEntityRef(rel.dst, actor, instigator, target, target2);

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
  instigator: HardState | null,
  target: HardState,
  target2?: HardState
): string {
  return template
    .replace('{actor.name}', actor.name)
    .replace('{instigator.name}', instigator?.name || '')
    .replace('{target.name}', target.name)
    .replace('{target2.name}', target2?.name || '');
}

/**
 * Create an executable action handler from declarative configuration.
 */
function createActionHandler(action: DeclarativeAction): ExecutableAction['handler'] {
  return (graph: TemplateGraphView, actor: HardState): ActionResult => {
    const instigatorConfig = action.actor.instigator;

    // Find optional instigator
    const instigator = findInstigator(actor, instigatorConfig, graph);

    // Check if instigator is required but not found
    if (instigatorConfig?.required && !instigator) {
      return {
        success: false,
        relationships: [],
        description: `has no instigator to perform the action`
      };
    }

    // Find targets
    const candidates = findTargets(actor, instigator, action.targeting, graph);

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
          instigator,
          target,
          target2,
          graph.tick
        )
      : [];

    // Handle relationship strengthening
    if (action.outcome.strengthenRelationships && action.outcome.strengthenRelationships.length > 0) {
      for (const strengthen of action.outcome.strengthenRelationships) {
        // Determine entities based on channel
        let entity1: HardState | null = null;
        let entity2: HardState | null = null;

        if (strengthen.channel === 'instigator_actor') {
          entity1 = instigator;
          entity2 = actor;
        } else if (strengthen.channel === 'actor_target') {
          entity1 = actor;
          entity2 = target;
        }

        if (!entity1 || !entity2) continue;

        // Find and strengthen relationships in both directions
        const strengthenLink = (source: HardState, destId: string) => {
          const link = source.links.find(l => l.kind === strengthen.kind && l.dst === destId);
          if (link) {
            link.strength = Math.min(1, Math.max(0, (link.strength || 0) + strengthen.amount));
          }
        };

        strengthenLink(entity1, entity2.id);
        strengthenLink(entity2, entity1.id);
      }
    }

    const description = formatDescription(
      action.outcome.descriptionTemplate,
      actor,
      instigator,
      target,
      target2
    );

    const modifiedIds = [target.id];
    if (target2) modifiedIds.push(target2.id);

    return {
      success: true,
      relationships,
      description,
      entitiesModified: modifiedIds,
      instigatorId: instigator?.id
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
    actorConfig: action.actor,
    applyProminenceToActor: action.outcome.applyProminenceToActor ?? false,
    applyProminenceToInstigator: action.outcome.applyProminenceToInstigator ?? false,
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

    // Skip disabled actions (default to enabled if not specified)
    if (action.enabled === false) {
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

