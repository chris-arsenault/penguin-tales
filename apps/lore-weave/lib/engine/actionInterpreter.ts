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
import { getEntitiesByRelationship } from '../graph/graphQueries';

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
  /** Minimum prominence required */
  minProminence?: string;
  /** Must have these relationship kinds (from actor) */
  requiredRelationships?: string[];
  /** Pressures must exceed these thresholds */
  requiredPressures?: Record<string, number>;
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
 * Relationship filter configuration
 */
export interface RelationshipFilter {
  /** Relationship kind */
  kind: string;
  /** Direction from the entity being filtered */
  direction: 'src' | 'dst' | 'both';
  /** Relationship must be from/to the resolved actor */
  fromResolvedActor?: boolean;
  toResolvedActor?: boolean;
  toActor?: boolean;
}

/**
 * Adjacency requirement
 */
export interface AdjacencyRequirement {
  /** Relationship kind for adjacency (e.g., 'adjacent_to') */
  relationshipKind: string;
  /** Actor controls the adjacent entity via this relationship */
  actorControlsVia?: string;
  /** Must be adjacent to the resolved actor */
  toResolvedActor?: boolean;
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

  /** Exclusion rules */
  exclude?: {
    existingRelationship?: RelationshipFilter;
  };
  excludeMultiple?: Array<{
    existingRelationship?: RelationshipFilter;
  }>;

  /** Requirements */
  require?: {
    adjacentTo?: AdjacencyRequirement;
    hasRelationship?: RelationshipFilter;
  };
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
  /** Action domain (political, military, etc.) */
  domain: string;

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
  domain: string;
  baseSuccessChance: number;
  baseWeight: number;
  requirements?: {
    minProminence?: string;
    requiredRelationships?: string[];
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

/**
 * Action domain (grouping of related actions)
 */
export interface ExecutableActionDomain {
  id: string;
  name: string;
  description: string;
  validActors: string[];
  actions: ExecutableAction[];
}

// =============================================================================
// ACTION INTERPRETATION
// =============================================================================

const PROMINENCE_ORDER = ['forgotten', 'marginal', 'recognized', 'renowned', 'mythic'];

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
 * Check if an entity passes exclusion filters.
 * Returns true if entity should be EXCLUDED.
 */
function shouldExclude(
  entity: HardState,
  actor: HardState,
  resolvedActor: HardState | null,
  exclude: ActionTargetConfig['exclude'],
  excludeMultiple: ActionTargetConfig['excludeMultiple'],
  excludeSelf: boolean | undefined,
  graph: TemplateGraphView
): boolean {
  // Self exclusion
  if (excludeSelf) {
    if (entity.id === actor.id) return true;
    if (resolvedActor && entity.id === resolvedActor.id) return true;
  }

  // Check single exclusion
  if (exclude?.existingRelationship) {
    if (hasMatchingRelationship(entity, actor, resolvedActor, exclude.existingRelationship, graph)) {
      return true;
    }
  }

  // Check multiple exclusions
  if (excludeMultiple) {
    for (const excl of excludeMultiple) {
      if (excl.existingRelationship) {
        if (hasMatchingRelationship(entity, actor, resolvedActor, excl.existingRelationship, graph)) {
          return true;
        }
      }
    }
  }

  return false;
}

/**
 * Check if entity has a matching relationship.
 */
function hasMatchingRelationship(
  entity: HardState,
  actor: HardState,
  resolvedActor: HardState | null,
  filter: RelationshipFilter,
  graph: TemplateGraphView
): boolean {
  const relationships = graph.getAllRelationships();

  return relationships.some(rel => {
    if (rel.kind !== filter.kind) return false;

    const entityIsSource = rel.src === entity.id;
    const entityIsDest = rel.dst === entity.id;

    if (filter.direction === 'src' && !entityIsSource) return false;
    if (filter.direction === 'dst' && !entityIsDest) return false;
    if (filter.direction === 'both' && !entityIsSource && !entityIsDest) return false;

    // Check relationship is from/to actor or resolved actor
    if (filter.fromResolvedActor && resolvedActor) {
      return rel.src === resolvedActor.id;
    }
    if (filter.toResolvedActor && resolvedActor) {
      return rel.dst === resolvedActor.id;
    }
    if (filter.toActor) {
      return rel.dst === actor.id;
    }

    return true;
  });
}

/**
 * Check if entity meets inclusion requirements.
 */
function meetsRequirements(
  entity: HardState,
  actor: HardState,
  resolvedActor: HardState | null,
  require: ActionTargetConfig['require'],
  graph: TemplateGraphView
): boolean {
  if (!require) return true;

  // Adjacency requirement
  if (require.adjacentTo) {
    const adj = require.adjacentTo;

    if (adj.actorControlsVia && resolvedActor) {
      // Entity must be adjacent to something the actor controls
      const controlledIds = new Set(
        graph.getAllRelationships()
          .filter(r => r.kind === adj.actorControlsVia && r.src === resolvedActor.id)
          .map(r => r.dst)
      );

      // If actor controls nothing, allow any target (initial seizure)
      if (controlledIds.size === 0) return true;

      // Check if entity is adjacent to any controlled location
      const isAdjacent = graph.getAllRelationships().some(r => {
        if (r.kind !== adj.relationshipKind) return false;
        return (
          (r.src === entity.id && controlledIds.has(r.dst)) ||
          (r.dst === entity.id && controlledIds.has(r.src))
        );
      });

      if (!isAdjacent) return false;
    }

    if (adj.toResolvedActor && resolvedActor) {
      // Entity must be adjacent to resolved actor (epicenter)
      const isAdjacent = graph.getAllRelationships().some(r => {
        if (r.kind !== adj.relationshipKind) return false;
        return (
          (r.src === entity.id && r.dst === resolvedActor.id) ||
          (r.dst === entity.id && r.src === resolvedActor.id)
        );
      });

      if (!isAdjacent) return false;
    }
  }

  // Relationship requirement
  if (require.hasRelationship) {
    const hasReq = require.hasRelationship;

    const matchingRels = graph.getAllRelationships().filter(r => {
      if (r.kind !== hasReq.kind) return false;

      const entityIsSource = r.src === entity.id;
      const entityIsDest = r.dst === entity.id;

      if (hasReq.direction === 'src' && !entityIsSource) return false;
      if (hasReq.direction === 'dst' && !entityIsDest) return false;

      if (hasReq.fromResolvedActor && resolvedActor) {
        return r.src === resolvedActor.id;
      }
      if (hasReq.toActor) {
        return r.dst === actor.id;
      }

      return true;
    });

    if (matchingRels.length === 0) return false;
  }

  return true;
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

  // Apply exclusion filters
  candidates = candidates.filter(e =>
    !shouldExclude(
      e,
      actor,
      resolvedActor,
      targeting.exclude,
      targeting.excludeMultiple,
      targeting.excludeSelf,
      graph
    )
  );

  // Apply inclusion requirements
  candidates = candidates.filter(e =>
    meetsRequirements(e, actor, resolvedActor, targeting.require, graph)
  );

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
    domain: action.domain,
    baseSuccessChance: action.probability.baseSuccessChance,
    baseWeight: action.probability.baseWeight,
    requirements: {
      minProminence: action.actor.minProminence,
      requiredRelationships: action.actor.requiredRelationships,
      requiredPressures: action.actor.requiredPressures
    },
    handler: createActionHandler(action)
  };
}

/**
 * Load declarative actions and group them by domain.
 */
export function loadActions(actions: DeclarativeAction[]): ExecutableActionDomain[] {
  if (!Array.isArray(actions)) {
    console.warn('loadActions: expected array, got', typeof actions);
    return [];
  }

  // Group actions by domain
  const domainMap = new Map<string, ExecutableAction[]>();

  for (const action of actions) {
    if (!action || !action.domain || !action.id) {
      console.warn('loadActions: skipping invalid action', action);
      continue;
    }

    try {
      const executable = createExecutableAction(action);

      if (!domainMap.has(action.domain)) {
        domainMap.set(action.domain, []);
      }
      domainMap.get(action.domain)!.push(executable);
    } catch (error) {
      console.error(`Failed to create action ${action.id}:`, error);
    }
  }

  // Create domain objects
  const domains: ExecutableActionDomain[] = [];

  for (const [domainId, domainActions] of domainMap.entries()) {
    // Collect all valid actor kinds from actions in this domain
    const validActors = new Set<string>();
    for (const action of domainActions) {
      // Get the original declarative action to access actor kinds
      const declAction = actions.find(a => a.id === action.type);
      if (declAction) {
        declAction.actor.kinds.forEach(k => validActors.add(k));
      }
    }

    domains.push({
      id: domainId,
      name: domainIdToName(domainId),
      description: `Actions in the ${domainId} domain`,
      validActors: Array.from(validActors),
      actions: domainActions
    });
  }

  return domains;
}

/**
 * Convert domain ID to display name.
 */
function domainIdToName(domainId: string): string {
  const names: Record<string, string> = {
    political: 'Political Actions',
    military: 'Military Actions',
    economic: 'Economic Actions',
    magical: 'Magical Actions',
    technological: 'Technological Actions',
    environmental: 'Environmental Actions',
    cultural: 'Cultural Actions',
    conflict_escalation: 'Conflict Escalation',
    disaster_spread: 'Disaster Spread'
  };
  return names[domainId] || `${domainId} Actions`;
}

/**
 * Pressure-domain mappings (which pressures affect which domains).
 * This is domain-agnostic default; can be overridden in domain schema.
 */
export const DEFAULT_PRESSURE_DOMAIN_MAPPINGS: Record<string, string[]> = {
  political: ['conflict', 'stability'],
  military: ['conflict', 'external_threat'],
  economic: ['resource_scarcity', 'stability'],
  magical: ['magical_instability'],
  technological: ['resource_scarcity', 'magical_instability'],
  environmental: ['magical_instability'],
  cultural: ['cultural_tension', 'stability'],
  conflict_escalation: ['conflict', 'external_threat'],
  disaster_spread: ['magical_instability']
};

/**
 * Get action domains for an entity based on its kind.
 * This is domain-agnostic default; can be overridden in domain schema.
 */
export function getDefaultActionDomainsForEntity(entity: HardState): string[] {
  // Default mapping based on entity kind
  const kindDomains: Record<string, string[]> = {
    npc: ['political', 'economic', 'cultural'],
    faction: ['political', 'economic', 'cultural', 'military'],
    abilities: ['magical', 'technological'],
    occurrence: ['conflict_escalation', 'disaster_spread'],
    location: ['environmental']
  };

  return kindDomains[entity.kind] || [];
}
