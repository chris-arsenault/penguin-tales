/**
 * Selection logic for the Chronicle Wizard.
 *
 * Provides role suggestion, validation, and entity/event filtering
 * for the interactive wizard flow.
 */

import type {
  ChronicleRoleAssignment,
  EntityContext,
  RelationshipContext,
  NarrativeEventContext,
} from '../chronicleTypes';
import type {
  NarrativeStyle,
  EntitySelectionRules,
  EventSelectionRules,
  RoleDefinition,
} from '@canonry/world-schema';

// =============================================================================
// Types
// =============================================================================

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface WizardSelectionContext {
  entryPoint: EntityContext;
  candidates: EntityContext[];
  candidateRelationships: RelationshipContext[];
  candidateEvents: NarrativeEventContext[];
}

// =============================================================================
// Prominence Scoring (reused from selection.ts)
// =============================================================================

const PROMINENCE_SCORES: Record<string, number> = {
  mythic: 100,
  renowned: 75,
  recognized: 50,
  marginal: 25,
  forgotten: 10,
};

// =============================================================================
// Neighbor Graph Building
// =============================================================================

interface NeighborGraph {
  ids: Set<string>;
  distances: Map<string, number>;
}

/**
 * Build a graph of entities reachable within maxDepth hops from entrypoint.
 */
export function buildNeighborGraph(
  relationships: RelationshipContext[],
  entrypointId: string,
  maxDepth: number = 2
): NeighborGraph {
  const adjacency = new Map<string, Set<string>>();
  for (const rel of relationships) {
    if (!adjacency.has(rel.src)) adjacency.set(rel.src, new Set());
    if (!adjacency.has(rel.dst)) adjacency.set(rel.dst, new Set());
    adjacency.get(rel.src)!.add(rel.dst);
    adjacency.get(rel.dst)!.add(rel.src);
  }

  const distances = new Map<string, number>();
  const queue: Array<{ id: string; depth: number }> = [{ id: entrypointId, depth: 0 }];
  distances.set(entrypointId, 0);

  while (queue.length > 0) {
    const { id, depth } = queue.shift()!;
    if (depth >= maxDepth) continue;
    const neighbors = adjacency.get(id);
    if (!neighbors) continue;
    for (const neighbor of neighbors) {
      if (distances.has(neighbor)) continue;
      distances.set(neighbor, depth + 1);
      queue.push({ id: neighbor, depth: depth + 1 });
    }
  }

  return { ids: new Set(distances.keys()), distances };
}

// =============================================================================
// Entity Filtering
// =============================================================================

type Prominence = 'mythic' | 'renowned' | 'recognized' | 'marginal' | 'forgotten';

function matchesProminenceFilter(entity: EntityContext, rules: EntitySelectionRules): boolean {
  if (!rules.prominenceFilter?.include) return true;
  const prominence = entity.prominence as Prominence;
  return rules.prominenceFilter.include.includes(prominence);
}

function matchesKindFilter(entity: EntityContext, rules: EntitySelectionRules): boolean {
  if (!rules.kindFilter) return true;

  const { include, exclude } = rules.kindFilter;

  if (exclude && exclude.includes(entity.kind)) {
    return false;
  }

  if (include && include.length > 0) {
    return include.includes(entity.kind);
  }

  return true;
}

/**
 * Filter candidates by style's entity rules.
 */
export function filterCandidatesByStyleRules(
  candidates: EntityContext[],
  rules: EntitySelectionRules
): EntityContext[] {
  return candidates.filter((entity) => {
    if (entity.kind === 'era') return false;
    if (!matchesProminenceFilter(entity, rules)) return false;
    if (!matchesKindFilter(entity, rules)) return false;
    return true;
  });
}

// =============================================================================
// Role Suggestion
// =============================================================================

/**
 * Score an entity for a specific role based on style rules.
 */
function scoreEntityForRole(
  entity: EntityContext,
  role: string,
  rules: EntitySelectionRules,
  relationships: RelationshipContext[]
): number {
  let score = 0;

  // Base prominence score
  score += PROMINENCE_SCORES[entity.prominence] || 0;

  // Protagonist-like role bonuses
  const protagonistRoles = [
    'protagonist', 'hero', 'tragic-hero', 'lover-a', 'focal-character',
    'investigator', 'consciousness', 'schemer'
  ];
  if (protagonistRoles.includes(role)) {
    const prefs = rules.prominenceFilter?.protagonistPreference;
    if (prefs && prefs.includes(entity.prominence as Prominence)) {
      score += 30;
    }

    if (rules.kindFilter?.protagonistKinds?.includes(entity.kind)) {
      score += 25;
    }
  }

  // Connection bonus for key roles
  if (role === 'schemer' || role === 'protagonist' || role === 'hero') {
    const connectionCount = relationships.filter(
      (r) => r.src === entity.id || r.dst === entity.id
    ).length;
    score += connectionCount * 5;
  }

  // Description availability bonus
  if (entity.summary || entity.description) {
    score += 15;
  }

  return score;
}

/**
 * Auto-suggest role assignments from candidates based on style rules.
 * Entry point is assigned to first protagonist-like role.
 */
export function suggestRoleAssignments(
  candidates: EntityContext[],
  roles: RoleDefinition[],
  entryPointId: string,
  rules: EntitySelectionRules,
  relationships: RelationshipContext[]
): ChronicleRoleAssignment[] {
  const assignments: ChronicleRoleAssignment[] = [];
  const usedEntityIds = new Set<string>();

  // Find entry point entity
  const entryPoint = candidates.find(e => e.id === entryPointId);

  // Build role scores for all candidates
  const roleScores = new Map<string, Array<{ entity: EntityContext; score: number }>>();
  for (const roleDef of roles) {
    const scores: Array<{ entity: EntityContext; score: number }> = [];
    for (const entity of candidates) {
      const score = scoreEntityForRole(entity, roleDef.role, rules, relationships);
      if (score > 0) {
        scores.push({ entity, score });
      }
    }
    scores.sort((a, b) => b.score - a.score);
    roleScores.set(roleDef.role, scores);
  }

  // Assign entry point to first protagonist-like role
  const protagonistRoles = ['protagonist', 'hero', 'tragic-hero', 'focal-character', 'investigator'];
  if (entryPoint) {
    const firstProtagonistRole = roles.find(r => protagonistRoles.includes(r.role));
    if (firstProtagonistRole) {
      assignments.push({
        role: firstProtagonistRole.role,
        entityId: entryPoint.id,
        entityName: entryPoint.name,
        entityKind: entryPoint.kind,
        isPrimary: true,
      });
      usedEntityIds.add(entryPoint.id);
    }
  }

  // Assign remaining roles greedily, respecting min counts
  for (const roleDef of roles) {
    // Skip if already assigned (e.g., protagonist role)
    const existingCount = assignments.filter(a => a.role === roleDef.role).length;
    if (existingCount >= roleDef.count.max) continue;

    const scores = roleScores.get(roleDef.role) || [];
    let assigned = existingCount;

    for (const { entity, score } of scores) {
      if (assigned >= roleDef.count.max) break;
      if (usedEntityIds.has(entity.id)) continue;

      // Determine if primary (first assignments up to min count are primary)
      const isPrimary = assigned < roleDef.count.min;

      assignments.push({
        role: roleDef.role,
        entityId: entity.id,
        entityName: entity.name,
        entityKind: entity.kind,
        isPrimary,
      });
      usedEntityIds.add(entity.id);
      assigned += 1;
    }
  }

  return assignments;
}

// =============================================================================
// Role Assignment Validation
// =============================================================================

/**
 * Validate role assignments against style constraints.
 */
export function validateRoleAssignments(
  assignments: ChronicleRoleAssignment[],
  roles: RoleDefinition[],
  maxCastSize: number
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check total cast size
  if (assignments.length > maxCastSize) {
    errors.push(`Too many entities assigned (${assignments.length}/${maxCastSize} max)`);
  }

  // Check each role's min/max constraints
  for (const roleDef of roles) {
    const roleCount = assignments.filter(a => a.role === roleDef.role).length;

    if (roleCount < roleDef.count.min) {
      if (roleDef.count.min === 1) {
        errors.push(`Role "${roleDef.role}" requires at least 1 entity`);
      } else {
        errors.push(`Role "${roleDef.role}" requires at least ${roleDef.count.min} entities (has ${roleCount})`);
      }
    }

    if (roleCount > roleDef.count.max) {
      warnings.push(`Role "${roleDef.role}" has ${roleCount} entities (max ${roleDef.count.max})`);
    }
  }

  // Check for duplicate entity assignments
  const entityCounts = new Map<string, number>();
  for (const assignment of assignments) {
    const count = entityCounts.get(assignment.entityId) || 0;
    entityCounts.set(assignment.entityId, count + 1);
  }
  for (const [entityId, count] of entityCounts) {
    if (count > 1) {
      const entity = assignments.find(a => a.entityId === entityId);
      warnings.push(`Entity "${entity?.entityName}" is assigned to ${count} roles`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// =============================================================================
// Relationship & Event Selection
// =============================================================================

/**
 * Get relationships between assigned entities.
 */
export function getRelevantRelationships(
  assignments: ChronicleRoleAssignment[],
  allRelationships: RelationshipContext[]
): RelationshipContext[] {
  const assignedIds = new Set(assignments.map(a => a.entityId));
  return allRelationships.filter(
    r => assignedIds.has(r.src) && assignedIds.has(r.dst)
  );
}

/**
 * Get events involving assigned entities.
 */
export function getRelevantEvents(
  assignments: ChronicleRoleAssignment[],
  allEvents: NarrativeEventContext[],
  eventRules?: EventSelectionRules
): NarrativeEventContext[] {
  const assignedIds = new Set(assignments.map(a => a.entityId));

  let filtered = allEvents.filter(e =>
    (e.subjectId && assignedIds.has(e.subjectId)) ||
    (e.objectId && assignedIds.has(e.objectId))
  );

  // Apply significance filter if rules provided
  if (eventRules?.significanceRange) {
    filtered = filtered.filter(
      e => e.significance >= eventRules.significanceRange.min &&
           e.significance <= eventRules.significanceRange.max
    );
  }

  // Apply max events limit
  const maxEvents = eventRules?.maxEvents ?? 20;
  if (filtered.length > maxEvents) {
    // Sort by significance descending
    filtered.sort((a, b) => b.significance - a.significance);
    filtered = filtered.slice(0, maxEvents);
  }

  return filtered;
}

// =============================================================================
// Wizard Selection Context Builder
// =============================================================================

/**
 * Build the selection context for the wizard given an entry point.
 * Returns candidates within 2-hop neighborhood.
 */
export function buildWizardSelectionContext(
  entryPoint: EntityContext,
  allEntities: EntityContext[],
  allRelationships: RelationshipContext[],
  allEvents: NarrativeEventContext[],
  style: NarrativeStyle
): WizardSelectionContext {
  // Build 2-hop neighborhood
  const neighborGraph = buildNeighborGraph(allRelationships, entryPoint.id, 2);

  // Filter entities to those in the neighborhood
  const neighborEntities = allEntities.filter(e => neighborGraph.ids.has(e.id));

  // Apply style filters
  const filteredCandidates = filterCandidatesByStyleRules(
    neighborEntities,
    style.entityRules
  );

  // Ensure entry point is included
  const candidates = filteredCandidates.some(e => e.id === entryPoint.id)
    ? filteredCandidates
    : [entryPoint, ...filteredCandidates];

  // Get relationships between candidates
  const candidateIds = new Set(candidates.map(e => e.id));
  const candidateRelationships = allRelationships.filter(
    r => candidateIds.has(r.src) && candidateIds.has(r.dst)
  );

  // Get events involving candidates
  const candidateEvents = allEvents.filter(e =>
    (e.subjectId && candidateIds.has(e.subjectId)) ||
    (e.objectId && candidateIds.has(e.objectId))
  );

  return {
    entryPoint,
    candidates,
    candidateRelationships,
    candidateEvents,
  };
}
