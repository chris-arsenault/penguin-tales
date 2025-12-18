/**
 * Selection filter evaluation - single source of truth for all filter types.
 *
 * Used by both template interpreter and action interpreter.
 */

import { HardState } from '../core/worldTypes';
import { SelectionFilter } from '../engine/declarativeTypes';
import { hasTag, getTagValue } from '../utils';
import { EntityResolver } from './entityResolver';
import { evaluateGraphPath } from './graphPath';

const PROMINENCE_ORDER = ['forgotten', 'marginal', 'recognized', 'renowned', 'mythic'];

/**
 * Apply a list of selection filters to entities.
 * Filters are applied in sequence (AND logic).
 */
export function applySelectionFilters(
  entities: HardState[],
  filters: SelectionFilter[] | undefined,
  resolver: EntityResolver
): HardState[] {
  if (!filters || filters.length === 0) return entities;

  let result = entities;

  for (const filter of filters) {
    result = applySelectionFilter(result, filter, resolver);
  }

  return result;
}

/**
 * Apply a single selection filter to a list of entities.
 */
export function applySelectionFilter(
  entities: HardState[],
  filter: SelectionFilter,
  resolver: EntityResolver
): HardState[] {
  switch (filter.type) {
    case 'exclude': {
      const excludeIds = new Set(
        filter.entities
          .map(ref => resolver.resolveEntity(ref)?.id)
          .filter((id): id is string => id !== undefined)
      );
      return entities.filter(e => !excludeIds.has(e.id));
    }

    case 'has_relationship': {
      const withEntity = filter.with ? resolver.resolveEntity(filter.with) : undefined;
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
      const withEntity = filter.with ? resolver.resolveEntity(filter.with) : undefined;
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
        if (!hasTag(entity.tags, filter.tag)) return true; // Doesn't have tag, include
        if (filter.value === undefined) return false; // Has tag, exclude
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
      const refEntity = resolver.resolveEntity(filter.with);
      if (!refEntity) return entities;
      return entities.filter(e => e.culture === refEntity.culture);
    }

    case 'has_status': {
      return entities.filter(e => e.status === filter.status);
    }

    case 'has_prominence': {
      const minIndex = PROMINENCE_ORDER.indexOf(filter.minProminence);
      if (minIndex === -1) return entities;
      return entities.filter(e => {
        const entityIndex = PROMINENCE_ORDER.indexOf(e.prominence);
        return entityIndex >= minIndex;
      });
    }

    case 'shares_related': {
      // Find entities that share a common related entity with the reference
      const refEntity = resolver.resolveEntity(filter.with);
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
        evaluateGraphPath(entity, filter.assert, resolver)
      );
    }

    default:
      return entities;
  }
}

/**
 * Check if an entity passes a single filter.
 * Useful for checking individual entities without creating a list.
 */
export function entityPassesFilter(
  entity: HardState,
  filter: SelectionFilter,
  resolver: EntityResolver
): boolean {
  const result = applySelectionFilter([entity], filter, resolver);
  return result.length > 0;
}

/**
 * Check if an entity passes all filters.
 */
export function entityPassesAllFilters(
  entity: HardState,
  filters: SelectionFilter[] | undefined,
  resolver: EntityResolver
): boolean {
  if (!filters || filters.length === 0) return true;

  for (const filter of filters) {
    if (!entityPassesFilter(entity, filter, resolver)) {
      return false;
    }
  }
  return true;
}
