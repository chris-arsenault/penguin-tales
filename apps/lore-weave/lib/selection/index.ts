/**
 * Selection module - unified entity selection and filtering.
 *
 * This module provides a single source of truth for selection filters
 * used across templates, actions, and systems.
 */

export type { EntityResolver } from './entityResolver';
export { ActionEntityResolver, SimpleEntityResolver } from './entityResolver';

export {
  evaluateGraphPath,
} from './graphPath';

export {
  applySelectionFilters,
  applySelectionFilter,
  entityPassesFilter,
  entityPassesAllFilters,
} from './selectionFilters';

export {
  matchesActorConfig,
} from './actorMatcher';
