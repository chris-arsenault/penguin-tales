/**
 * Constants for ActionsEditor
 */

// Re-export colors from shared-components for backwards compatibility
export {
  ACCENT_COLOR,
  ACCENT_GRADIENT,
  COLORS,
} from '@penguin-tales/shared-components';

export const TABS = [
  { id: 'overview', label: 'Overview', icon: '📋' },
  { id: 'actor', label: 'Actor', icon: '🎭' },
  { id: 'resolution', label: 'Resolution', icon: '🔍' },
  { id: 'targeting', label: 'Targeting', icon: '🎯' },
  { id: 'outcome', label: 'Outcome', icon: '⚡' },
  { id: 'probability', label: 'Probability', icon: '🎲' },
];

export const RESOLUTION_TYPES = [
  { value: 'self', label: 'Self', desc: 'Actor acts as themselves' },
  { value: 'via_relationship', label: 'Via Relationship', desc: 'Actor resolves through a relationship' },
];

export const DIRECTIONS = [
  { value: 'src', label: 'Source' },
  { value: 'dst', label: 'Destination' },
  { value: 'both', label: 'Both' },
];

export const PROMINENCE_LEVELS = [
  { value: 'forgotten', label: 'Forgotten' },
  { value: 'marginal', label: 'Marginal' },
  { value: 'recognized', label: 'Recognized' },
  { value: 'renowned', label: 'Renowned' },
  { value: 'mythic', label: 'Mythic' },
];

export const RELATIONSHIP_REFS = [
  { value: 'actor', label: 'Actor' },
  { value: 'resolved_actor', label: 'Resolved Actor' },
  { value: 'target', label: 'Target' },
  { value: 'target2', label: 'Target 2' },
  { value: 'corruption_source', label: 'Corruption Source' },
];
