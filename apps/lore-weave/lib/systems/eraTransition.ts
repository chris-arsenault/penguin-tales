import { SimulationSystem, SystemResult, ComponentPurpose } from '../engine/types';
import { HardState } from '../core/worldTypes';
import {
  FRAMEWORK_ENTITY_KINDS,
  FRAMEWORK_STATUS,
  FRAMEWORK_RELATIONSHIP_KINDS
} from '../core/frameworkPrimitives';
import { TemplateGraphView } from '../graph/templateGraphView';

/**
 * Era Transition System
 *
 * Framework-level system that transitions between era entities based on
 * world state and domain-defined transition conditions.
 *
 * Eras are HardState entities (not just config objects) that exist in the graph.
 * They have status: 'historical' | 'current' | 'future' and can be referenced in relationships.
 *
 * Transition Logic:
 * 1. Get current era entity (status: 'current')
 * 2. Check domain-defined transition conditions
 * 3. If met, update current era status to 'historical', next era to 'current'
 * 4. Create historical event for era transition
 * 5. Apply era-specific effects (optional)
 */
export const eraTransition: SimulationSystem = {
  id: 'era_transition',
  name: 'Era Progression',

  contract: {
    purpose: ComponentPurpose.PHASE_TRANSITION,
    affects: {
      entities: [
        {
          kind: FRAMEWORK_ENTITY_KINDS.ERA,
          operation: 'modify',
          count: { min: 2, max: 2 }
        }
      ],
      relationships: [
        {
          kind: FRAMEWORK_RELATIONSHIP_KINDS.ACTIVE_DURING,
          operation: 'create',
          count: { min: 0, max: 10 }
        }
      ]
    }
  },

  metadata: {
    produces: {
      relationships: [],
      modifications: [
        { type: 'status', frequency: 'rare', comment: 'Era status changes (current → past → future → current)' }
      ]
    },
    effects: {
      graphDensity: 0.0,
      clusterFormation: 0.0,
      diversityImpact: 0.8,
      comment: 'Era transitions reshape world dynamics via template weights and system modifiers'
    },
    parameters: {
      minEraLength: {
        value: 50,
        min: 20,
        max: 200,
        description: 'Minimum ticks before era can transition'
      },
      transitionCooldown: {
        value: 10,
        min: 5,
        max: 50,
        description: 'Ticks between transitions to prevent rapid cycling'
      }
    },
    triggers: {
      graphConditions: [
        'Era minimum length met',
        'Domain transition conditions satisfied'
      ],
      comment: 'Runs every tick, checks transition conditions'
    }
  },

  apply: (graphView: TemplateGraphView, modifier: number = 1.0): SystemResult => {
    const params = eraTransition.metadata?.parameters || {};
    const minEraLength = params.minEraLength?.value ?? 50;
    const transitionCooldown = params.transitionCooldown?.value ?? 10;

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

    // Check domain-defined transition conditions
    const shouldTransition = checkTransitionConditions(currentEra, graphView);

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

    // Apply era transition effects (domain-specific)
    const transitionEffects = graphView.config.domain.getEraTransitionEffects?.(currentEra, nextEra, graphView) || {};

    return {
      relationshipsAdded,
      entitiesModified: [
        { id: currentEra.id, changes: { status: FRAMEWORK_STATUS.HISTORICAL, temporal: currentEra.temporal } },
        { id: nextEra.id, changes: { status: FRAMEWORK_STATUS.CURRENT, temporal: nextEra.temporal } }
      ],
      pressureChanges: transitionEffects.pressureChanges || {},
      description: `Era transition: ${currentEra.name} → ${nextEra.name} (${prominentEntities.length} entities linked)`
    };
  }
};

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
 * Uses domain-defined transition logic
 */
function checkTransitionConditions(currentEra: HardState, graphView: TemplateGraphView): boolean {
  // Get domain-specific transition conditions
  const transitionConditions = graphView.config.domain.getEraTransitionConditions?.(currentEra.subtype);

  if (!transitionConditions) {
    // No domain-specific conditions - use default heuristics
    return checkDefaultTransitionConditions(currentEra, graphView);
  }

  // Check each condition
  return transitionConditions.every((condition: any) => {
    switch (condition.type) {
      case 'pressure':
        return checkPressureCondition(condition, graphView);
      case 'entity_count':
        return checkEntityCountCondition(condition, graphView);
      case 'occurrence':
        return checkOccurrenceCondition(condition, graphView);
      case 'time':
        return checkTimeCondition(condition, currentEra, graphView);
      default:
        return true;
    }
  });
}

/**
 * Default transition conditions (if domain doesn't define custom logic)
 */
function checkDefaultTransitionConditions(currentEra: HardState, graphView: TemplateGraphView): boolean {
  const eraAge = currentEra.temporal
    ? graphView.tick - currentEra.temporal.startTick
    : graphView.tick - currentEra.createdAt;

  // Simple heuristic: transition after era has lasted 2x minimum length
  const minLength = eraTransition.metadata?.parameters?.minEraLength?.value ?? 50;
  return eraAge > minLength * 2;
}

/**
 * Check pressure-based condition
 */
function checkPressureCondition(condition: any, graphView: TemplateGraphView): boolean {
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
function checkEntityCountCondition(condition: any, graphView: TemplateGraphView): boolean {
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
 * Check occurrence-based condition
 */
function checkOccurrenceCondition(condition: any, graphView: TemplateGraphView): boolean {
  const occurrences = graphView.findEntities({
    kind: FRAMEWORK_ENTITY_KINDS.OCCURRENCE,
    subtype: condition.subtype,
    status: FRAMEWORK_STATUS.ACTIVE
  });

  switch (condition.operator) {
    case 'exists':
      return occurrences.length > 0;
    case 'ended':
      const endedOccurrences = graphView.findEntities({
        kind: FRAMEWORK_ENTITY_KINDS.OCCURRENCE,
        subtype: condition.subtype,
        status: FRAMEWORK_STATUS.HISTORICAL
      });
      return endedOccurrences.length > 0;
    default:
      return false;
  }
}

/**
 * Check time-based condition
 */
function checkTimeCondition(condition: any, currentEra: HardState, graphView: TemplateGraphView): boolean {
  const eraAge = currentEra.temporal
    ? graphView.tick - currentEra.temporal.startTick
    : graphView.tick - currentEra.createdAt;

  return eraAge > condition.minTicks;
}
