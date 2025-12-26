/**
 * Shared narrative selection stage.
 * Filters entities/events via style rules and decides required neighbors.
 */

import type {
  ChronicleGenerationContext,
  EntityContext,
  NarrativeEventContext,
} from '../chronicleTypes';
import type {
  NarrativeStyle,
  EntitySelectionRules,
  EventSelectionRules,
} from '@canonry/world-schema';

export interface CastAssignment {
  role: string;
  entityId: string;
  entityName: string;
  score: number;
}

export interface SelectionContext {
  entrypoint: EntityContext;
  candidateEntities: EntityContext[];
  candidateEvents: NarrativeEventContext[];
  requiredNeighborIds: string[];
  requiredNeighbors: EntityContext[];
  suggestedCast: CastAssignment[];
}

export function buildSelectionContext(
  context: ChronicleGenerationContext,
  style: NarrativeStyle
): SelectionContext {
  if (!context.entity) {
    throw new Error('Selection requires an entrypoint entity');
  }

  const entrypoint = context.entity;
  const filteredEntities = filterEntities(context, style.entityRules)
    .filter((entity) => entity.id !== entrypoint.id);

  const candidateEntities = [entrypoint, ...filteredEntities];
  const candidateEvents = filterEvents(context, style.eventRules);

  const requiredNeighborIds = selectRequiredNeighbors(context, candidateEntities);
  if (requiredNeighborIds.length === 0) {
    throw new Error('Entrypoint has no eligible neighbors for multi-entity focus');
  }

  const requiredNeighbors = requiredNeighborIds
    .map((id) => candidateEntities.find((entity) => entity.id === id))
    .filter((entity): entity is EntityContext => Boolean(entity));

  const suggestedCast = suggestCast(candidateEntities, style.entityRules, context.relationships);

  return {
    entrypoint,
    candidateEntities,
    candidateEvents,
    requiredNeighborIds,
    requiredNeighbors,
    suggestedCast,
  };
}

type Prominence = 'mythic' | 'renowned' | 'recognized' | 'marginal' | 'forgotten';

function matchesProminenceFilter(entity: EntityContext, rules: EntitySelectionRules): boolean {
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

function meetsRelationshipRequirements(
  entity: EntityContext,
  relationships: ChronicleGenerationContext['relationships'],
  rules: EntitySelectionRules
): boolean {
  if (!rules.relationshipRequirements) return true;

  const { protagonistMustHave, minConnections } = rules.relationshipRequirements;
  const connectionCount = relationships.filter(
    (r) => r.src === entity.id || r.dst === entity.id
  ).length;

  if (minConnections !== undefined && connectionCount < minConnections) {
    return false;
  }

  if (protagonistMustHave && protagonistMustHave.length > 0) {
    const entityRelKinds = new Set(
      relationships
        .filter((r) => r.src === entity.id || r.dst === entity.id)
        .map((r) => r.kind)
    );
    const hasRequired = protagonistMustHave.some((kind) => entityRelKinds.has(kind));
    if (!hasRequired) {
      return false;
    }
  }

  return true;
}

export function filterEntities(
  context: ChronicleGenerationContext,
  rules: EntitySelectionRules
): EntityContext[] {
  return context.entities.filter((entity) => {
    if (entity.kind === 'era') return false;
    if (!matchesProminenceFilter(entity, rules)) return false;
    if (!matchesKindFilter(entity, rules)) return false;
    if (!meetsRelationshipRequirements(entity, context.relationships, rules)) return false;
    return true;
  });
}

function matchesSignificanceRange(
  event: NarrativeEventContext,
  rules: EventSelectionRules
): boolean {
  const { min, max } = rules.significanceRange;
  return event.significance >= min && event.significance <= max;
}

function matchesEventKindFilter(
  event: NarrativeEventContext,
  rules: EventSelectionRules
): boolean {
  if (rules.excludeKinds?.includes(event.eventKind)) {
    return false;
  }
  return true;
}

function scoreEvent(event: NarrativeEventContext, rules: EventSelectionRules): number {
  let score = event.significance * 100;

  if (rules.priorityKinds?.includes(event.eventKind)) {
    score += 30;
  }

  if (rules.priorityTags && event.narrativeTags) {
    const matchingTags = event.narrativeTags.filter((tag) =>
      rules.priorityTags!.includes(tag)
    );
    score += matchingTags.length * 15;
  }

  return score;
}

export function filterEvents(
  context: ChronicleGenerationContext,
  rules: EventSelectionRules
): NarrativeEventContext[] {
  const filtered = context.events.filter((event) => {
    if (!matchesSignificanceRange(event, rules)) return false;
    if (!matchesEventKindFilter(event, rules)) return false;
    return true;
  });

  const scored = filtered.map((event) => ({
    event,
    score: scoreEvent(event, rules),
  }));
  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, rules.maxEvents).map((s) => s.event);
}

function scoreEntityForRole(
  entity: EntityContext,
  role: string,
  rules: EntitySelectionRules,
  relationships: ChronicleGenerationContext['relationships']
): number {
  let score = 0;

  const prominenceScores: Record<string, number> = {
    mythic: 100,
    renowned: 75,
    recognized: 50,
    marginal: 25,
    forgotten: 10,
  };
  score += prominenceScores[entity.prominence] || 0;

  if (
    role === 'protagonist' ||
    role === 'hero' ||
    role === 'tragic-hero' ||
    role === 'lover-a' ||
    role === 'focal-character' ||
    role === 'investigator' ||
    role === 'consciousness' ||
    role === 'schemer'
  ) {
    const prefs = rules.prominenceFilter.protagonistPreference;
    if (prefs && prefs.includes(entity.prominence as Prominence)) {
      score += 30;
    }

    if (rules.kindFilter?.protagonistKinds?.includes(entity.kind)) {
      score += 25;
    }
  }

  if (role === 'schemer' || role === 'protagonist' || role === 'hero') {
    const connectionCount = relationships.filter(
      (r) => r.src === entity.id || r.dst === entity.id
    ).length;
    score += connectionCount * 5;
  }

  if (entity.enrichedDescription) {
    score += 15;
  }

  return score;
}

export function suggestCast(
  entities: EntityContext[],
  rules: EntitySelectionRules,
  relationships: ChronicleGenerationContext['relationships']
): CastAssignment[] {
  const assignments: CastAssignment[] = [];
  const usedEntityIds = new Set<string>();

  const roleScores: Map<string, Array<{ entity: EntityContext; score: number }>> =
    new Map();

  for (const roleDef of rules.roles) {
    const scores: Array<{ entity: EntityContext; score: number }> = [];
    for (const entity of entities) {
      const score = scoreEntityForRole(entity, roleDef.role, rules, relationships);
      if (score > 0) {
        scores.push({ entity, score });
      }
    }
    scores.sort((a, b) => b.score - a.score);
    roleScores.set(roleDef.role, scores);
  }

  for (const roleDef of rules.roles) {
    const scores = roleScores.get(roleDef.role) || [];
    let assigned = 0;

    for (const { entity, score } of scores) {
      if (assigned >= roleDef.count.max) break;
      if (usedEntityIds.has(entity.id)) continue;

      assignments.push({
        role: roleDef.role,
        entityId: entity.id,
        entityName: entity.name,
        score,
      });
      usedEntityIds.add(entity.id);
      assigned += 1;
    }
  }

  return assignments;
}

function selectRequiredNeighbors(
  context: ChronicleGenerationContext,
  candidateEntities: EntityContext[]
): string[] {
  if (!context.entity) return [];

  const entrypointId = context.entity.id;
  const candidateIds = new Set(candidateEntities.map((entity) => entity.id));

  const neighborLinks = context.relationships
    .filter((rel) => rel.src === entrypointId || rel.dst === entrypointId)
    .map((rel) => {
      const neighborId = rel.src === entrypointId ? rel.dst : rel.src;
      return { neighborId, strength: rel.strength ?? 0 };
    })
    .filter((rel) => candidateIds.has(rel.neighborId));

  if (neighborLinks.length === 0) return [];

  const prominenceScores: Record<string, number> = {
    mythic: 100,
    renowned: 75,
    recognized: 50,
    marginal: 25,
    forgotten: 10,
  };

  const uniqueNeighbors = new Map<string, { score: number }>();
  for (const link of neighborLinks) {
    const entity = candidateEntities.find((e) => e.id === link.neighborId);
    if (!entity) continue;
    const score = link.strength * 100 + (prominenceScores[entity.prominence] || 0);
    const existing = uniqueNeighbors.get(link.neighborId);
    if (!existing || score > existing.score) {
      uniqueNeighbors.set(link.neighborId, { score });
    }
  }

  const sorted = Array.from(uniqueNeighbors.entries())
    .sort((a, b) => b[1].score - a[1].score)
    .map(([id]) => id);

  return sorted.slice(0, Math.min(4, sorted.length));
}
