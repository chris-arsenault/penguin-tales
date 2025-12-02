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

      // Calculate era age for condition checking
      const eraAge = graphView.tick - currentEra.createdAt;

      // Initialize temporal tracking if missing
      if (!currentEra.temporal?.startTick) {
        currentEra.temporal = {
          startTick: graphView.tick - eraAge,
          endTick: null
        };
      }

      const timeSinceStart = graphView.tick - currentEra.temporal.startTick;

      // Get era config to check transition conditions for THIS era
      const eraConfig = graphView.config.eras.find(e => e.id === currentEra.subtype) as Era | undefined;

      if (!eraConfig) {
        throw new Error(
          `[EraTransition] No era config found for "${currentEra.name}" (subtype="${currentEra.subtype}", id="${currentEra.id}"). ` +
          `Era entity subtype must match an era config id. ` +
          `Available era configs: [${graphView.config.eras.map(e => e.id).join(', ')}].`
        );
      }

      const eraConditions = eraConfig.transitionConditions;
      if (!eraConditions) {
        throw new Error(
          `[EraTransition] Era config "${eraConfig.id}" has no transitionConditions defined. ` +
          `Every era must define transitionConditions (use [] for immediate transition).`
        );
      }
      const eraEffects = eraConfig.transitionEffects;

      // Check per-era transition conditions
      const { shouldTransition, conditionResults } = checkTransitionConditions(currentEra, graphView, eraConditions);

      if (!shouldTransition) {
        // Build detailed condition status string
        const conditionSummary = conditionResults.map(r => {
          const status = r.passed ? '✓' : '✗';
          const details = Object.entries(r.details)
            .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
            .join(', ');
          return `${status} ${r.type}: ${details}`;
        }).join(' | ');

        graphView.log('debug',
          `[EraTransition] ${currentEra.name}: conditions not met (age=${timeSinceStart}) [${conditionSummary}]`,
          { eraAge: timeSinceStart, conditionResults }
        );
        return {
          relationshipsAdded: [],
          entitiesModified: [],
          pressureChanges: {},
          description: `${currentEra.name} persists`
        };
      }

      // Build detailed condition status string for success case too
      const conditionSummary = conditionResults.map(r => {
        const status = r.passed ? '✓' : '✗';
        const details = Object.entries(r.details)
          .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
          .join(', ');
        return `${status} ${r.type}: ${details}`;
      }).join(' | ');

      graphView.log('debug',
        `[EraTransition] ${currentEra.name}: transition conditions MET (age=${timeSinceStart}) [${conditionSummary}]`,
        { eraAge: timeSinceStart, conditionResults }
      );

      // Find next era (first entity with status: 'future')
      const nextEra = graphView.findEntities({
        kind: FRAMEWORK_ENTITY_KINDS.ERA,
        status: FRAMEWORK_STATUS.FUTURE
      })[0];

      if (!nextEra) {
        // No more eras - current era continues indefinitely
        graphView.log('debug', `[EraTransition] ${currentEra.name}: final era, no transition possible`);
        return {
          relationshipsAdded: [],
          entitiesModified: [],
          pressureChanges: {},
          description: `${currentEra.name} endures (final era)`
        };
      }

      // Perform transition
      graphView.log('info', `[EraTransition] TRANSITIONING: ${currentEra.name} → ${nextEra.name}`, {
        tick: graphView.tick,
        fromEra: currentEra.subtype,
        toEra: nextEra.subtype
      });
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

interface ConditionResult {
  type: string;
  passed: boolean;
  details: Record<string, unknown>;
}

interface TransitionCheckResult {
  shouldTransition: boolean;
  conditionResults: ConditionResult[];
}

/**
 * Check if conditions are met for era transition
 * Uses config-defined transition conditions from per-era config
 */
function checkTransitionConditions(
  currentEra: HardState,
  graphView: TemplateGraphView,
  conditions: TransitionCondition[]
): TransitionCheckResult {
  // Empty conditions array = allow immediate transition
  if (conditions.length === 0) {
    return {
      shouldTransition: true,
      conditionResults: [{ type: 'none', passed: true, details: { reason: 'empty conditions array - immediate transition' } }]
    };
  }

  // Check each condition - ALL must be met
  const conditionResults: ConditionResult[] = [];

  for (const condition of conditions) {
    let passed = false;
    let details: Record<string, unknown> = {};

    switch (condition.type) {
      case 'pressure': {
        const pressureCondition = condition as PressureTransitionCondition;
        const currentValue = graphView.getPressure(pressureCondition.pressureId);
        passed = checkPressureCondition(pressureCondition, graphView);
        details = {
          pressureId: pressureCondition.pressureId,
          operator: pressureCondition.operator,
          threshold: pressureCondition.threshold,
          currentValue
        };
        break;
      }
      case 'entity_count': {
        const entityCondition = condition as EntityCountTransitionCondition;
        const entities = graphView.findEntities({
          kind: entityCondition.entityKind,
          subtype: entityCondition.subtype,
          status: entityCondition.status
        });
        passed = checkEntityCountCondition(entityCondition, graphView);
        details = {
          entityKind: entityCondition.entityKind,
          subtype: entityCondition.subtype,
          status: entityCondition.status,
          operator: entityCondition.operator,
          threshold: entityCondition.threshold,
          currentCount: entities.length
        };
        break;
      }
      case 'time': {
        const timeCondition = condition as TimeTransitionCondition;
        const eraAge = currentEra.temporal
          ? graphView.tick - currentEra.temporal.startTick
          : graphView.tick - currentEra.createdAt;
        passed = checkTimeCondition(timeCondition, currentEra, graphView);
        details = {
          minTicks: timeCondition.minTicks,
          currentAge: eraAge
        };
        break;
      }
      default:
        passed = true;
        details = { reason: 'unknown condition type' };
    }

    conditionResults.push({ type: condition.type, passed, details });
  }

  return {
    shouldTransition: conditionResults.every(r => r.passed),
    conditionResults
  };
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

