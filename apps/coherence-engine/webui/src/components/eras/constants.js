/**
 * Constants for ErasEditor components
 */

// Re-export shared strength levels
export { STRENGTH_LEVELS } from '../shared';

// Transition condition types
export const CONDITION_TYPES = [
  { value: 'time', label: 'Time', description: 'Transition after minimum ticks' },
  { value: 'pressure', label: 'Pressure', description: 'Based on pressure level' },
  { value: 'entity_count', label: 'Entity Count', description: 'Based on entity population' },
];

// Operators for threshold conditions
export const OPERATORS = [
  { value: 'above', label: 'Above' },
  { value: 'below', label: 'Below' },
];
