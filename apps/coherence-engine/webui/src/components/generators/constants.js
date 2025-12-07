/**
 * Shared constants for GeneratorsEditor components
 */

// ============================================================================
// TABS
// ============================================================================

export const TABS = [
  { id: 'overview', label: 'Overview', icon: '📋' },
  { id: 'applicability', label: 'When', icon: '✓' },
  { id: 'target', label: 'Target', icon: '🎯' },
  { id: 'variables', label: 'Variables', icon: '📦' },
  { id: 'creation', label: 'Create', icon: '✨' },
  { id: 'relationships', label: 'Connect', icon: '🔗' },
  { id: 'effects', label: 'Effects', icon: '⚡' },
];

// ============================================================================
// APPLICABILITY TYPES
// ============================================================================

export const APPLICABILITY_TYPES = {
  entity_count_min: { label: 'Min Entities', icon: '📊', color: '#3b82f6', desc: 'Requires minimum entity count' },
  entity_count_max: { label: 'Max Entities', icon: '📉', color: '#8b5cf6', desc: 'Stops at maximum entity count' },
  pressure_threshold: { label: 'Pressure Range', icon: '🌡️', color: '#f59e0b', desc: 'Runs when pressure is in range' },
  era_match: { label: 'Era Match', icon: '🕰️', color: '#10b981', desc: 'Only runs in specific eras' },
  random_chance: { label: 'Random Chance', icon: '🎲', color: '#a855f7', desc: 'Runs with a probability (0-100%)' },
  cooldown_elapsed: { label: 'Cooldown', icon: '⏱️', color: '#06b6d4', desc: 'Wait N ticks since last run' },
  creations_per_epoch: { label: 'Rate Limit', icon: '📈', color: '#f97316', desc: 'Max creations per epoch' },
  or: { label: 'Any Of (OR)', icon: '⚡', color: '#ec4899', desc: 'Passes if any sub-rule passes' },
  and: { label: 'All Of (AND)', icon: '🔗', color: '#14b8a6', desc: 'Passes if all sub-rules pass' },
};

// ============================================================================
// PROMINENCE LEVELS
// ============================================================================

// Re-export from shared
export { PROMINENCE_LEVELS } from '../shared';

// ============================================================================
// PICK STRATEGIES
// ============================================================================

// For target selection (supports weighted)
export const PICK_STRATEGIES = [
  { value: 'random', label: 'Random', desc: 'Pick randomly from matches' },
  { value: 'first', label: 'First', desc: 'Pick the first match' },
  { value: 'all', label: 'All', desc: 'Use all matches' },
  { value: 'weighted', label: 'Weighted', desc: 'Weight by prominence' },
];

// For variable selection (no weighted support)
export const VARIABLE_PICK_STRATEGIES = [
  { value: 'random', label: 'Random', desc: 'Pick randomly from matches' },
  { value: 'first', label: 'First', desc: 'Pick the first match' },
  { value: 'all', label: 'All', desc: 'Use all matches' },
];

// ============================================================================
// SELECTION FILTER TYPES
// ============================================================================

export const FILTER_TYPES = {
  has_tag: { label: 'Has Tag', icon: '🏷️', color: '#10b981' },
  has_any_tag: { label: 'Has Any Tag', icon: '🏷️', color: '#10b981' },
  has_relationship: { label: 'Has Relationship', icon: '🔗', color: '#8b5cf6' },
  lacks_relationship: { label: 'Lacks Relationship', icon: '🚫', color: '#ef4444' },
  shares_related: { label: 'Shares Related Entity', icon: '📍', color: '#3b82f6', desc: 'Both entities have same related entity via relationship' },
  exclude: { label: 'Exclude Entities', icon: '⛔', color: '#f59e0b' },
  graph_path: { label: 'Graph Path', icon: '🔀', color: '#ec4899' },
};

// ============================================================================
// GRAPH PATH CONSTANTS
// ============================================================================

export const PATH_CHECK_TYPES = [
  { value: 'exists', label: 'Path Exists' },
  { value: 'not_exists', label: 'Path Does Not Exist' },
  { value: 'count_min', label: 'Count At Least' },
  { value: 'count_max', label: 'Count At Most' },
];

export const PATH_DIRECTIONS = [
  { value: 'out', label: 'Outgoing →' },
  { value: 'in', label: '← Incoming' },
  { value: 'any', label: '↔ Any' },
];

export const PATH_CONSTRAINT_TYPES = [
  { value: 'not_self', label: 'Not Self' },
  { value: 'not_in', label: 'Not In Set' },
  { value: 'in', label: 'In Set' },
  { value: 'kind_equals', label: 'Kind Equals' },
  { value: 'subtype_equals', label: 'Subtype Equals' },
  { value: 'has_relationship', label: 'Has Relationship' },
  { value: 'lacks_relationship', label: 'Lacks Relationship' },
];

// ============================================================================
// CSS HOVER STYLES (injected once)
// ============================================================================

export const HOVER_STYLES_ID = 'generators-editor-hover-styles';

export const hoverCSS = `
  .ge-tab-btn:not(.ge-tab-btn-active):hover {
    background-color: rgba(245, 158, 11, 0.15) !important;
  }
  .ge-tab-btn:not(.ge-tab-btn-active) {
    background-color: transparent !important;
  }
  .ge-add-item-btn:hover {
    border-color: #f59e0b !important;
    color: #f59e0b !important;
  }
  .ge-add-item-btn {
    border-color: rgba(59, 130, 246, 0.3) !important;
    color: #60a5fa !important;
  }
  .ge-card-option:hover {
    border-color: #f59e0b !important;
  }
`;
