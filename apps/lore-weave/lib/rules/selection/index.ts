/**
 * Unified Selection Helpers
 *
 * Shared selection logic for templates, actions, and systems.
 */

import { HardState } from '../../core/worldTypes';
import { hasTag, pickRandom } from '../../utils';
import type { RuleContext } from '../context';
import { applySelectionFilters } from '../filters';
import { normalizeDirection, prominenceIndex, PROMINENCE_ORDER } from '../types';
import type {
  EntitySelectionCriteria,
  SelectionRule,
  VariableSelectionRule,
  SaturationLimit,
} from './types';
import type { SelectionFilter } from '../filters/types';

export interface SelectionTraceStep {
  description: string;
  remaining: number;
}

export interface SelectionTrace {
  steps: SelectionTraceStep[];
}

function pushTrace(trace: SelectionTrace | undefined, description: string, remaining: number): void {
  if (!trace) return;
  trace.steps.push({ description, remaining });
}

export function describeSelectionFilter(filter: SelectionFilter): string {
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
      return `has_prominence >= ${filter.minProminence}`;
    case 'shares_related':
      return `shares_related '${filter.relationshipKind}' with ${filter.with}`;
    case 'graph_path':
      return `graph_path ${filter.assert.check}`;
    default:
      return 'unknown filter';
  }
}

/**
 * Apply base selection criteria to a set of entities.
 */
export function applyEntityCriteria(
  entities: HardState[],
  criteria: EntitySelectionCriteria
): HardState[] {
  let result = entities;

  if (criteria.kind) {
    result = result.filter((e) => e.kind === criteria.kind);
  }

  if (criteria.kinds && criteria.kinds.length > 0) {
    result = result.filter((e) => criteria.kinds!.includes(e.kind));
  }

  if (criteria.subtypes && criteria.subtypes.length > 0) {
    result = result.filter((e) => criteria.subtypes!.includes(e.subtype));
  }

  if (criteria.excludeSubtypes && criteria.excludeSubtypes.length > 0) {
    result = result.filter((e) => !criteria.excludeSubtypes!.includes(e.subtype));
  }

  if (criteria.statusFilter) {
    result = result.filter((e) => e.status === criteria.statusFilter);
  }

  if (criteria.statuses && criteria.statuses.length > 0) {
    result = result.filter((e) => criteria.statuses!.includes(e.status));
  }

  if (criteria.notStatus) {
    result = result.filter((e) => e.status !== criteria.notStatus);
  }

  if (criteria.hasTag) {
    result = result.filter((e) => hasTag(e.tags, criteria.hasTag!));
  }

  if (criteria.notHasTag) {
    result = result.filter((e) => !hasTag(e.tags, criteria.notHasTag!));
  }

  return result;
}

/**
 * Apply prefer filters to an entity list, falling back to the original list.
 */
export function applyPreferFilters(
  entities: HardState[],
  filters: SelectionFilter[] | undefined,
  ctx: RuleContext,
  trace?: SelectionTrace
): HardState[] {
  if (!filters || filters.length === 0) return entities;

  let preferred = entities;
  for (const filter of filters) {
    preferred = applySelectionFilters(preferred, [filter], ctx.resolver);
  }

  if (preferred.length > 0) {
    pushTrace(trace, 'prefer filters matched', preferred.length);
    return preferred;
  }

  pushTrace(trace, 'prefer filters (no match, using all)', entities.length);
  return entities;
}

/**
 * Apply pick strategy to an entity list.
 * Always returns an array (possibly length 0 or 1).
 */
function sampleRandom(entities: HardState[], count: number): HardState[] {
  if (count <= 0 || entities.length === 0) return [];
  const pool = entities.slice();
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, Math.min(count, pool.length));
}

function getProminenceWeight(entity: HardState): number {
  const weight = prominenceIndex(entity.prominence) + 1;
  return weight > 0 ? weight : 1;
}

function pickWeighted(entities: HardState[]): HardState | undefined {
  if (entities.length === 0) return undefined;
  const weights = entities.map(getProminenceWeight);
  const total = weights.reduce((sum, w) => sum + w, 0);
  let roll = Math.random() * total;
  for (let i = 0; i < entities.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return entities[i];
  }
  return entities[entities.length - 1];
}

function sampleWeighted(entities: HardState[], count: number): HardState[] {
  if (count <= 0 || entities.length === 0) return [];
  const pool = entities.slice();
  const picks: HardState[] = [];
  const limit = Math.min(count, pool.length);
  for (let i = 0; i < limit; i++) {
    const picked = pickWeighted(pool);
    if (!picked) break;
    picks.push(picked);
    const idx = pool.indexOf(picked);
    if (idx >= 0) pool.splice(idx, 1);
  }
  return picks;
}

export function applyPickStrategy(
  entities: HardState[],
  pickStrategy: SelectionRule['pickStrategy'] | VariableSelectionRule['pickStrategy'] | undefined,
  maxResults?: number
): HardState[] {
  const limit = maxResults && maxResults > 0 ? Math.min(maxResults, entities.length) : undefined;

  switch (pickStrategy) {
    case 'random':
      return limit ? sampleRandom(entities, limit) : (entities.length > 0 ? [pickRandom(entities)] : []);
    case 'weighted':
      if (limit) return sampleWeighted(entities, limit);
      const picked = pickWeighted(entities);
      return picked ? [picked] : [];
    case 'first':
      return limit ? entities.slice(0, limit) : entities.slice(0, 1);
    case 'all':
      return limit ? entities.slice(0, limit) : entities;
    default:
      return limit ? entities.slice(0, limit) : entities;
  }
}

/**
 * Apply saturation limits to filter out entities that have too many relationships.
 * Always counts relationships in both directions (any).
 */
export function applySaturationLimits(
  entities: HardState[],
  limits: SaturationLimit[] | undefined,
  ctx: RuleContext
): HardState[] {
  if (!limits || limits.length === 0) return entities;

  return entities.filter((entity) => {
    for (const limit of limits) {
      let count = 0;
      const relationships = ctx.graph.getRelationships(entity.id, limit.relationshipKind);

      for (const rel of relationships) {
        const otherId = rel.src === entity.id ? rel.dst : rel.src;
        if (limit.fromKind) {
          const otherEntity = ctx.graph.getEntity(otherId);
          if (!otherEntity || otherEntity.kind !== limit.fromKind) continue;
        }
        count++;
      }

      if (count >= limit.maxCount) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Select entities using a SelectionRule.
 */
export function selectEntities(
  rule: SelectionRule,
  ctx: RuleContext,
  trace?: SelectionTrace
): HardState[] {
  const graphView = ctx.graph;
  let entities: HardState[];
  const kinds = rule.kinds && rule.kinds.length > 0 ? rule.kinds : (rule.kind ? [rule.kind] : []);
  const kindLabel = kinds.length > 0 ? kinds.join('|') : 'any';

  const getCandidatesByKind = (): HardState[] => {
    if (kinds.length === 0 || kinds.includes('any')) {
      return graphView.getEntities();
    }
    if (kinds.length === 1 && rule.kind && (!rule.kinds || rule.kinds.length === 0)) {
      return graphView.findEntities({ kind: rule.kind });
    }
    return graphView.getEntities().filter((e) => kinds.includes(e.kind));
  };

  switch (rule.strategy) {
    case 'by_kind': {
      entities = getCandidatesByKind();
      pushTrace(trace, `kind=${kindLabel}`, entities.length);
      break;
    }

    case 'by_preference_order': {
      entities = [];
      const allEntities = getCandidatesByKind();
      for (const subtype of rule.subtypePreferences || []) {
        const matches = allEntities.filter((e) => e.subtype === subtype);
        if (matches.length > 0) {
          entities = matches;
          break;
        }
      }
      if (entities.length === 0) {
        entities = allEntities;
      }
      pushTrace(trace, `preference_order=${kindLabel}`, entities.length);
      break;
    }

    case 'by_relationship': {
      const allEntities = getCandidatesByKind();
      const direction = normalizeDirection(rule.direction);
      const mustHave = rule.mustHave === true;
      entities = allEntities.filter((entity) => {
        const relationships = ctx.graph.getRelationships(entity.id, rule.relationshipKind);
        const hasRel = relationships.some((link) => {
          if (direction === 'src') return link.src === entity.id;
          if (direction === 'dst') return link.dst === entity.id;
          return link.src === entity.id || link.dst === entity.id;
        });
        return mustHave ? hasRel : !hasRel;
      });
      pushTrace(trace, `relationship=${rule.relationshipKind ?? 'any'}`, entities.length);
      break;
    }

    case 'by_proximity': {
      const refEntity = ctx.resolver.resolveEntity(rule.referenceEntity || '$target');
      if (!refEntity?.coordinates) {
        entities = [];
        pushTrace(trace, 'proximity: no reference coordinates', 0);
        break;
      }
      const maxDist = rule.maxDistance || 50;
      entities = getCandidatesByKind().filter((e) => {
        if (!e.coordinates) return false;
        const dx = e.coordinates.x - refEntity.coordinates!.x;
        const dy = e.coordinates.y - refEntity.coordinates!.y;
        const dz = e.coordinates.z - refEntity.coordinates!.z;
        return Math.sqrt(dx * dx + dy * dy + dz * dz) <= maxDist;
      });
      pushTrace(trace, `proximity<=${maxDist}`, entities.length);
      break;
    }

    case 'by_prominence': {
      const minIndex = PROMINENCE_ORDER.indexOf(rule.minProminence || 'marginal');
      entities = getCandidatesByKind().filter((e) => {
        const entityIndex = PROMINENCE_ORDER.indexOf(e.prominence);
        return entityIndex >= minIndex;
      });
      pushTrace(trace, `prominence>=${rule.minProminence ?? 'marginal'}`, entities.length);
      break;
    }

    default:
      entities = [];
      pushTrace(trace, 'unknown strategy', 0);
  }

  if (rule.subtypes && rule.subtypes.length > 0) {
    entities = entities.filter((e) => rule.subtypes!.includes(e.subtype));
    pushTrace(trace, `subtype in [${rule.subtypes.join(', ')}]`, entities.length);
  }

  if (rule.excludeSubtypes && rule.excludeSubtypes.length > 0) {
    entities = entities.filter((e) => !rule.excludeSubtypes!.includes(e.subtype));
    pushTrace(trace, `subtype not in [${rule.excludeSubtypes.join(', ')}]`, entities.length);
  }

  if (rule.statusFilter) {
    entities = entities.filter((e) => e.status === rule.statusFilter);
    pushTrace(trace, `status=${rule.statusFilter}`, entities.length);
  }

  if (rule.statuses && rule.statuses.length > 0) {
    entities = entities.filter((e) => rule.statuses!.includes(e.status));
    pushTrace(trace, `status in [${rule.statuses.join(', ')}]`, entities.length);
  }

  if (rule.notStatus) {
    entities = entities.filter((e) => e.status !== rule.notStatus);
    pushTrace(trace, `status!=${rule.notStatus}`, entities.length);
  }

  if (rule.filters && rule.filters.length > 0) {
    for (const filter of rule.filters) {
      entities = applySelectionFilters(entities, [filter], ctx.resolver);
      pushTrace(trace, describeSelectionFilter(filter), entities.length);
    }
  }

  entities = applySaturationLimits(entities, rule.saturationLimits, ctx);

  return applyPickStrategy(entities, rule.pickStrategy, rule.maxResults);
}

/**
 * Select candidates for a variable selection rule.
 */
export function selectVariableEntities(
  select: VariableSelectionRule,
  ctx: RuleContext,
  trace?: SelectionTrace
): HardState[] {
  const graphView = ctx.graph;
  let entities: HardState[];

  if (select.from && select.from !== 'graph') {
    const relatedTo = ctx.resolver.resolveEntity(select.from.relatedTo);
    if (!relatedTo) {
      pushTrace(trace, `related to ${select.from.relatedTo} (not found)`, 0);
      return [];
    }
    const direction = normalizeDirection(select.from.direction);
    entities = graphView.getRelatedEntities(
      relatedTo.id,
      select.from.relationship,
      direction
    );
    pushTrace(trace, `via ${select.from.relationship} from ${relatedTo.name || relatedTo.id}`, entities.length);
  } else {
    if (select.kinds && select.kinds.length > 0) {
      entities = graphView.getEntities().filter((e) => select.kinds!.includes(e.kind));
      pushTrace(trace, `${select.kinds.join('|')} entities`, entities.length);
    } else if (select.kind) {
      entities = graphView.findEntities({ kind: select.kind });
      pushTrace(trace, `${select.kind} entities`, entities.length);
    } else {
      entities = graphView.getEntities();
      pushTrace(trace, 'all entities', entities.length);
    }
  }

  if (select.kinds && select.kinds.length > 0) {
    entities = entities.filter((e) => select.kinds!.includes(e.kind));
    pushTrace(trace, `kind in [${select.kinds.join(', ')}]`, entities.length);
  } else if (select.kind) {
    entities = entities.filter((e) => e.kind === select.kind);
    pushTrace(trace, `kind=${select.kind}`, entities.length);
  }

  if (select.subtypes && select.subtypes.length > 0) {
    entities = entities.filter((e) => select.subtypes!.includes(e.subtype));
    pushTrace(trace, `subtype in [${select.subtypes.join(', ')}]`, entities.length);
  }

  if (select.statusFilter) {
    entities = entities.filter((e) => e.status === select.statusFilter);
    pushTrace(trace, `status=${select.statusFilter}`, entities.length);
  }

  if (select.statuses && select.statuses.length > 0) {
    entities = entities.filter((e) => select.statuses!.includes(e.status));
    pushTrace(trace, `status in [${select.statuses.join(', ')}]`, entities.length);
  }

  if (select.notStatus) {
    entities = entities.filter((e) => e.status !== select.notStatus);
    pushTrace(trace, `status!=${select.notStatus}`, entities.length);
  }

  if (select.filters && select.filters.length > 0) {
    for (const filter of select.filters) {
      entities = applySelectionFilters(entities, [filter], ctx.resolver);
      pushTrace(trace, describeSelectionFilter(filter), entities.length);
    }
  }

  return applyPreferFilters(entities, select.preferFilters, ctx, trace);
}

export * from './types';
