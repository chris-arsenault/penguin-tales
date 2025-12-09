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
  // Create rules with empty required fields - validation will flag them
  // No domain-specific defaults - user must explicitly select values
  const newRule = { type };
  if (type === 'entity_count_min') {
    newRule.kind = '';
    newRule.min = 0;
  } else if (type === 'entity_count_max') {
    newRule.kind = '';
    newRule.max = 0;
  } else if (type === 'pressure_threshold') {
    newRule.pressureId = '';
  } else if (type === 'era_match') {
    newRule.eras = [];
  } else if (type === 'random_chance') {
    newRule.chance = 0;
  } else if (type === 'cooldown_elapsed') {
    newRule.cooldownTicks = 0;
  } else if (type === 'creations_per_epoch') {
    newRule.maxPerEpoch = 0;
  } else if (type === 'or' || type === 'and') {
    newRule.rules = [];
  } else if (type === 'pressure_any_above') {
    newRule.pressureIds = [];
    newRule.threshold = 0;
  } else if (type === 'pressure_compare') {
    newRule.pressureA = '';
    newRule.pressureB = '';
  }
  return newRule;
}

export default createNewRule;
