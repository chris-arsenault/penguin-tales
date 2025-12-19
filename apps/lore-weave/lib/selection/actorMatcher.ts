/**
 * Actor matching - checks if an entity can perform an action based on actor config.
 *
 * This follows the same pattern as target selection but for actor eligibility.
 */

import { HardState } from '../core/worldTypes';
import { TemplateGraphView } from '../graph/templateGraphView';
import { ActionActorConfig, PressureBand } from '../engine/actionInterpreter';
import { SimpleEntityResolver } from './entityResolver';
import { entityPassesAllFilters } from './selectionFilters';

/**
 * Check if an entity matches the actor configuration for an action.
 *
 * Applies all actor constraints in order:
 * 1. Entity kind must be in actorConfig.kinds
 * 2. Entity subtype must match (if subtypes specified)
 * 3. Entity status must match (if statuses specified)
 * 4. Entity must pass all selection filters (if filters specified)
 * 5. Pressure bands must be satisfied (if requiredPressures specified)
 *
 * @param entity The entity to check
 * @param actorConfig The actor configuration from the action
 * @param graphView The graph view for filter evaluation and pressure access
 * @returns true if the entity can perform the action
 */
export function matchesActorConfig(
  entity: HardState,
  actorConfig: ActionActorConfig,
  graphView: TemplateGraphView
): boolean {
  // 1. Check entity kind (required)
  if (!actorConfig.kinds.includes(entity.kind)) {
    return false;
  }

  // 2. Check subtype (optional)
  if (actorConfig.subtypes && actorConfig.subtypes.length > 0) {
    if (!actorConfig.subtypes.includes(entity.subtype)) {
      return false;
    }
  }

  // 3. Check status (optional)
  if (actorConfig.statuses && actorConfig.statuses.length > 0) {
    if (!actorConfig.statuses.includes(entity.status)) {
      return false;
    }
  }

  // 4. Apply selection filters (optional)
  if (actorConfig.filters && actorConfig.filters.length > 0) {
    const resolver = new SimpleEntityResolver(graphView);
    if (!entityPassesAllFilters(entity, actorConfig.filters, resolver)) {
      return false;
    }
  }

  // 5. Check pressure bands (optional)
  if (actorConfig.requiredPressures && actorConfig.requiredPressures.length > 0) {
    if (!meetsPressureBands(actorConfig.requiredPressures, graphView)) {
      return false;
    }
  }

  return true;
}

/**
 * Check if current pressures satisfy all required pressure bands.
 */
function meetsPressureBands(
  bands: PressureBand[],
  graphView: TemplateGraphView
): boolean {
  for (const band of bands) {
    const pressure = graphView.getPressure(band.pressure);

    // Check min bound if specified
    if (band.min !== undefined && pressure < band.min) {
      return false;
    }

    // Check max bound if specified
    if (band.max !== undefined && pressure > band.max) {
      return false;
    }
  }
  return true;
}
