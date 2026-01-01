/**
 * Selection Filters
 *
 * Single source of truth for all filter evaluation logic.
 * Used by template interpreter, action interpreter, and systems.
 */

import { HardState } from '../../core/worldTypes';
import { SelectionFilter } from './types';
import { hasTag, getTagValue } from '../../utils';
import { EntityResolver } from '../resolver';
import { evaluateGraphPath } from '../graphPath';
import { prominenceThreshold } from '../types';

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
      const graphView = resolver.getGraphView();
      const withEntity = filter.with ? resolver.resolveEntity(filter.with) : undefined;
      return entities.filter(entity => {
        const relationships = graphView.getRelationships(entity.id, filter.kind);
        return relationships.some(link => {
          if (filter.direction === 'src' && link.src !== entity.id) return false;
          if (filter.direction === 'dst' && link.dst !== entity.id) return false;
          if (withEntity) {
            const otherId = link.src === entity.id ? link.dst : link.src;
            return otherId === withEntity.id;
          }
          return true;
        });
      });
    }

    case 'lacks_relationship': {
      const graphView = resolver.getGraphView();
      const withEntity = filter.with ? resolver.resolveEntity(filter.with) : undefined;
      return entities.filter(entity => {
        const relationships = graphView.getRelationships(entity.id, filter.kind);
        const hasRel = relationships.some(link => {
          if (withEntity) {
            const otherId = link.src === entity.id ? link.dst : link.src;
            return otherId === withEntity.id;
          }
          return true;
        });
        return !hasRel;
      });
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

    case 'not_matches_culture': {
      const refEntity = resolver.resolveEntity(filter.with);
      if (!refEntity) return entities;
      return entities.filter(e => e.culture !== refEntity.culture);
    }

    case 'has_status': {
      return entities.filter(e => e.status === filter.status);
    }

    case 'has_prominence': {
      const minValue = prominenceThreshold(filter.minProminence);
      return entities.filter(e => e.prominence >= minValue);
    }

    case 'shares_related': {
      // Find entities that share a common related entity with the reference
      const graphView = resolver.getGraphView();
      const refEntity = resolver.resolveEntity(filter.with);
      if (!refEntity) return entities;

      const refRelated = graphView
        .getRelatedEntities(refEntity.id, filter.relationshipKind, 'both')
        .map(entity => entity.id);

      if (refRelated.length === 0) return [];

      const refRelatedSet = new Set(refRelated);

      return entities.filter(entity => {
        const entityRelated = graphView
          .getRelatedEntities(entity.id, filter.relationshipKind, 'both')
          .map(related => related.id);
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

// Re-export types
export * from './types';
