/**
 * Selection module - unified entity selection and filtering.
 *
 * This module provides a single source of truth for selection filters
 * used across templates, actions, and systems.
 */

export {
  EntityResolver,
  ActionEntityResolver,
  SimpleEntityResolver,
} from './entityResolver';

export {
  evaluateGraphPath,
} from './graphPath';

export {
  applySelectionFilters,
  applySelectionFilter,
  entityPassesFilter,
  entityPassesAllFilters,
} from './selectionFilters';
