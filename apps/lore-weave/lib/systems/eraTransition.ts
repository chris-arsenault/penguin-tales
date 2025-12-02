import {
  SimulationSystem,
  SystemResult,
  Era,
  TransitionCondition,
  PressureTransitionCondition,
  EntityCountTransitionCondition,
  TimeTransitionCondition
} from '../engine/types';
import { HardState } from '../core/worldTypes';
import {
  FRAMEWORK_ENTITY_KINDS,
  FRAMEWORK_STATUS,
  FRAMEWORK_RELATIONSHIP_KINDS
} from '../core/frameworkPrimitives';
import { TemplateGraphView } from '../graph/templateGraphView';
import type { EraTransitionConfig } from '../engine/systemInterpreter';

/**
 * Era Transition System
 *
 * Framework-level system that transitions between era entities based on
 * world state and per-era transition conditions defined in eras.json.
 *
 * Eras are HardState entities (not just config objects) that exist in the graph.
 * They have status: 'historical' | 'current' | 'future' and can be referenced in relationships.
 *
 * Transition Logic:
 * 1. Get current era entity (status: 'current')
 * 2. Look up era config to get transition conditions for THIS era
 * 3. Check if conditions are met
 * 4. If met, update current era status to 'historical', next era to 'current'
 * 5. Apply era-specific transition effects
 */

/**
 * Create an Era Transition system with the given configuration.
 */
export function createEraTransitionSystem(config: EraTransitionConfig): SimulationSystem {
  // Extract config with defaults
  const minEraLength = config.minEraLength ?? 50;
  const transitionCooldown = config.transitionCooldown ?? 10;

  return {
    id: config.id || 'era_transition',
    name: config.name || 'Era Progression',

    apply: (graphView: TemplateGraphView, modifier: number = 1.0): SystemResult => {
      // Find current era entity
      const currentEra = graphView.findEntities({
        kind: FRAMEWORK_ENTITY_KINDS.ERA,
        status: FRAMEWORK_STATUS.CURRENT
      })[0];

      if (!currentEra) {
        // No current era - try to activate first future era
        return activateFirstEra(graphView);
      }

      // Check minimum era length
      const eraAge = graphView.tick - currentEra.createdAt;
      if (eraAge < minEraLength) {
        return {
          relationshipsAdded: [],
          entitiesModified: [],
          pressureChanges: {},
          description: `${currentEra.name} continues (${eraAge}/${minEraLength} ticks)`
        };
      }

      // Check transition cooldown (prevent rapid cycling)
      if (!currentEra.temporal?.startTick) {
        // Initialize temporal tracking if missing
        currentEra.temporal = {
          startTick: graphView.tick - eraAge,
          endTick: null
        };
      }

      const timeSinceStart = graphView.tick - currentEra.temporal.startTick;
      if (timeSinceStart < transitionCooldown) {
        return {
          relationshipsAdded: [],
          entitiesModified: [],
          pressureChanges: {},
          description: `${currentEra.name} stabilizing`
        };
      }

      // Get era config to check transition conditions for THIS era
      const eraConfig = graphView.config.eras.find(e => e.id === currentEra.subtype) as Era | undefined;
      const eraConditions = eraConfig?.transitionConditions;
      const eraEffects = eraConfig?.transitionEffects;

      // Check per-era transition conditions
      const shouldTransition = checkTransitionConditions(currentEra, graphView, minEraLength, eraConditions);

      if (!shouldTransition) {
        return {
          relationshipsAdded: [],
          entitiesModified: [],
          pressureChanges: {},
          description: `${currentEra.name} persists`
        };
      }

      // Find next era (first entity with status: 'future')
      const nextEra = graphView.findEntities({
        kind: FRAMEWORK_ENTITY_KINDS.ERA,
        status: FRAMEWORK_STATUS.FUTURE
      })[0];

      if (!nextEra) {
        // No more eras - current era continues indefinitely
        return {
          relationshipsAdded: [],
          entitiesModified: [],
          pressureChanges: {},
          description: `${currentEra.name} endures (final era)`
        };
      }

      // Perform transition
      currentEra.status = FRAMEWORK_STATUS.HISTORICAL;
      currentEra.temporal!.endTick = graphView.tick;
      currentEra.updatedAt = graphView.tick;

      nextEra.status = FRAMEWORK_STATUS.CURRENT;
      nextEra.temporal = {
        startTick: graphView.tick,
        endTick: null
      };
      nextEra.updatedAt = graphView.tick;

      // Update graph's currentEra reference
      // Find matching era in config
      const configEra = graphView.config.eras.find(e => e.id === nextEra.subtype);
      if (configEra) {
        graphView.setCurrentEra(configEra);
      }

      // Create active_during relationships for prominent entities in the ending era
      const relationshipsAdded: any[] = [];
      const prominentEntities = graphView.getEntities().filter(e =>
        (e.prominence === 'recognized' || e.prominence === 'renowned' || e.prominence === 'mythic') &&
        e.kind !== FRAMEWORK_ENTITY_KINDS.ERA &&
        e.createdAt >= currentEra.temporal!.startTick &&
        e.createdAt < graphView.tick
      );

      // Link up to 10 most prominent entities to the ending era
      prominentEntities.slice(0, 10).forEach(entity => {
        relationshipsAdded.push({
          kind: FRAMEWORK_RELATIONSHIP_KINDS.ACTIVE_DURING,
          src: entity.id,
          dst: currentEra.id,
          strength: 1.0,
          createdAt: graphView.tick
        });
        // Note: entity.links will be updated by addRelationship() in worldEngine
      });

      // Create history event
      graphView.addHistoryEvent({
        tick: graphView.tick,
        era: nextEra.subtype,
        type: 'special',
        description: `The ${currentEra.name} ends. The ${nextEra.name} begins.`,
        entitiesCreated: [],
        relationshipsCreated: relationshipsAdded,
        entitiesModified: [currentEra.id, nextEra.id]
      });

      return {
        relationshipsAdded,
        entitiesModified: [
          { id: currentEra.id, changes: { status: FRAMEWORK_STATUS.HISTORICAL, temporal: currentEra.temporal } },
          { id: nextEra.id, changes: { status: FRAMEWORK_STATUS.CURRENT, temporal: nextEra.temporal } }
        ],
        pressureChanges: eraEffects?.pressureChanges || {},
        description: `Era transition: ${currentEra.name} → ${nextEra.name} (${prominentEntities.length} entities linked)`
      };
    }
  };
}

/**
 * Activate the first era if no current era exists
 */
function activateFirstEra(graphView: TemplateGraphView): SystemResult {
  const firstEra = graphView.findEntities({ kind: FRAMEWORK_ENTITY_KINDS.ERA })[0];

  if (!firstEra) {
    return {
      relationshipsAdded: [],
      entitiesModified: [],
      pressureChanges: {},
      description: 'No era entities exist'
    };
  }

  firstEra.status = FRAMEWORK_STATUS.CURRENT;
  firstEra.temporal = {
    startTick: graphView.tick,
    endTick: null
  };
  firstEra.updatedAt = graphView.tick;

  // Update graph's currentEra reference
  const configEra = graphView.config.eras.find(e => e.id === firstEra.subtype);
  if (configEra) {
    graphView.setCurrentEra(configEra);
  }

  return {
    relationshipsAdded: [],
    entitiesModified: [
      { id: firstEra.id, changes: { status: FRAMEWORK_STATUS.CURRENT, temporal: firstEra.temporal } }
    ],
    pressureChanges: {},
    description: `${firstEra.name} begins`
  };
}

/**
 * Check if conditions are met for era transition
 * Uses config-defined transition conditions
 */
function checkTransitionConditions(
  currentEra: HardState,
  graphView: TemplateGraphView,
  minEraLength: number,
  conditions?: TransitionCondition[]
): boolean {
  // No conditions array = use default heuristics
  if (conditions === undefined) {
    return checkDefaultTransitionConditions(currentEra, graphView, minEraLength);
  }

  // Empty conditions array = allow transition (no conditions to check)
  if (conditions.length === 0) {
    return true;
  }

  // Check each condition - ALL must be met
  return conditions.every((condition) => {
    switch (condition.type) {
      case 'pressure':
        return checkPressureCondition(condition as PressureTransitionCondition, graphView);
      case 'entity_count':
        return checkEntityCountCondition(condition as EntityCountTransitionCondition, graphView);
      case 'time':
        return checkTimeCondition(condition as TimeTransitionCondition, currentEra, graphView);
      default:
        return true;
    }
  });
}

/**
 * Default transition conditions (if domain doesn't define custom logic)
 */
function checkDefaultTransitionConditions(currentEra: HardState, graphView: TemplateGraphView, minEraLength: number): boolean {
  const eraAge = currentEra.temporal
    ? graphView.tick - currentEra.temporal.startTick
    : graphView.tick - currentEra.createdAt;

  // Simple heuristic: transition after era has lasted 2x minimum length
  return eraAge > minEraLength * 2;
}

/**
 * Check pressure-based condition
 */
function checkPressureCondition(condition: PressureTransitionCondition, graphView: TemplateGraphView): boolean {
  const pressure = graphView.getPressure(condition.pressureId);

  switch (condition.operator) {
    case 'above':
      return pressure > condition.threshold;
    case 'below':
      return pressure < condition.threshold;
    default:
      return false;
  }
}

/**
 * Check entity count condition
 */
function checkEntityCountCondition(condition: EntityCountTransitionCondition, graphView: TemplateGraphView): boolean {
  const entities = graphView.findEntities({
    kind: condition.entityKind,
    subtype: condition.subtype,
    status: condition.status
  });

  switch (condition.operator) {
    case 'above':
      return entities.length > condition.threshold;
    case 'below':
      return entities.length < condition.threshold;
    default:
      return false;
  }
}

/**
 * Check time-based condition
 */
function checkTimeCondition(condition: TimeTransitionCondition, currentEra: HardState, graphView: TemplateGraphView): boolean {
  const eraAge = currentEra.temporal
    ? graphView.tick - currentEra.temporal.startTick
    : graphView.tick - currentEra.createdAt;

  return eraAge > condition.minTicks;
}

