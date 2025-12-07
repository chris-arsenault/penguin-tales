/**
 * createNewRule - Factory for creating new applicability rules
 */

/**
 * Creates a new applicability rule with default values based on type
 * @param {string} type - The rule type
 * @param {Array} pressures - Available pressure definitions
 * @returns {Object} A new rule object with default values
 */
export function createNewRule(type, pressures) {
  const newRule = { type };
  if (type === 'entity_count_min') {
    newRule.kind = 'npc';
    newRule.min = 1;
  } else if (type === 'entity_count_max') {
    newRule.kind = 'npc';
    newRule.max = 10;
  } else if (type === 'pressure_threshold') {
    newRule.pressureId = pressures?.[0]?.id || '';
    newRule.min = 0;
    newRule.max = 100;
  } else if (type === 'era_match') {
    newRule.eras = [];
  } else if (type === 'or' || type === 'and') {
    newRule.rules = [];
  }
  return newRule;
}

export default createNewRule;
