/**
 * Selection Types
 *
 * Shared selection rule types used across templates, actions, and systems.
 */

import type { Prominence } from '../../core/worldTypes';
import type { Direction } from '../types';
import type { SelectionFilter } from '../filters/types';

/**
 * Saturation limit - filter targets by relationship count.
 * Useful for limiting generator creation based on existing relationships.
 */
export interface SaturationLimit {
  /** Relationship kind to count */
  relationshipKind: string;
  /** Direction: 'in' = incoming, 'out' = outgoing (default: 'in') */
  direction?: 'in' | 'out' | Direction;
  /** Optional: only count relationships from/to this entity kind */
  fromKind?: string;
  /** Maximum number of relationships allowed (target is selected only if count < maxCount) */
  maxCount: number;
}

export type SelectionPickStrategy = 'random' | 'first' | 'all' | 'weighted';

/**
 * Rules that determine how to find target entities.
 */
export interface SelectionRule {
  strategy: 'by_kind' | 'by_preference_order' | 'by_relationship' | 'by_proximity' | 'by_prominence';
  kind?: string;
  kinds?: string[];

  // Common filters
  subtypes?: string[];
  excludeSubtypes?: string[];
  statusFilter?: string;
  statuses?: string[];
  notStatus?: string;

  // For by_relationship strategy
  relationshipKind?: string;
  mustHave?: boolean;
  direction?: Direction;

  // For by_preference_order strategy
  subtypePreferences?: string[];

  // For by_proximity strategy
  referenceEntity?: string;  // Variable reference like "$target"
  maxDistance?: number;

  // For by_prominence strategy
  minProminence?: Prominence;

  // Post-selection filters
  filters?: SelectionFilter[];

  // Saturation limits - filter by relationship counts
  saturationLimits?: SaturationLimit[];

  // Result handling
  pickStrategy?: SelectionPickStrategy;
  maxResults?: number;
}

export interface RelatedEntitiesSpec {
  relatedTo: string;  // Variable reference
  relationship: string;  // Relationship kind
  direction: Direction | 'out' | 'in' | 'any';
}

/**
 * Variable selection rule (used by template variables).
 */
export interface VariableSelectionRule {
  // Select from graph or from related entities
  from?: RelatedEntitiesSpec | 'graph';

  // Entity filtering (kind used when from='graph')
  kind?: string;
  kinds?: string[];
  subtypes?: string[];
  statusFilter?: string;
  statuses?: string[];
  notStatus?: string;

  // Post-filters
  filters?: SelectionFilter[];

  // Prefer filters (try these first, fall back to all matches)
  preferFilters?: SelectionFilter[];

  // Result handling
  pickStrategy?: SelectionPickStrategy;
  maxResults?: number;
  fallback?: string;  // Variable reference or fixed value if nothing found
}

/**
 * Base criteria for filtering entities across contexts.
 */
export interface EntitySelectionCriteria {
  kind?: string;
  kinds?: string[];
  subtypes?: string[];
  excludeSubtypes?: string[];
  statusFilter?: string;
  statuses?: string[];
  notStatus?: string;
  hasTag?: string;
  notHasTag?: string;
}
