import { SimulationSystem, SystemResult, Graph, ComponentPurpose } from '../types/engine';
import { HardState } from '../types/worldTypes';

/**
 * Era Transition System
 *
 * Framework-level system that transitions between era entities based on
 * world state and domain-defined transition conditions.
 *
 * Eras are HardState entities (not just config objects) that exist in the graph.
 * They have status: 'past' | 'current' | 'future' and can be referenced in relationships.
 *
 * Transition Logic:
 * 1. Get current era entity (status: 'current')
 * 2. Check domain-defined transition conditions
 * 3. If met, update current era status to 'past', next era to 'current'
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
          kind: 'era',
          operation: 'modify',
          count: { min: 2, max: 2 }
        }
      ],
      relationships: [
        {
          kind: 'active_during',
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

  apply: (graph: Graph, modifier: number = 1.0): SystemResult => {
    const params = eraTransition.metadata?.parameters || {};
    const minEraLength = params.minEraLength?.value ?? 50;
    const transitionCooldown = params.transitionCooldown?.value ?? 10;

    // Find current era entity
    const currentEra = graph.getEntities().find(e =>
      e.kind === 'era' && e.status === 'current'
    );

    if (!currentEra) {
      // No current era - try to activate first future era
      return activateFirstEra(graph);
    }

    // Check minimum era length
    const eraAge = graph.tick - currentEra.createdAt;
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
        startTick: graph.tick - eraAge,
        endTick: null
      };
    }

    const timeSinceStart = graph.tick - currentEra.temporal.startTick;
    if (timeSinceStart < transitionCooldown) {
      return {
        relationshipsAdded: [],
        entitiesModified: [],
        pressureChanges: {},
        description: `${currentEra.name} stabilizing`
      };
    }

    // Check domain-defined transition conditions
    const shouldTransition = checkTransitionConditions(currentEra, graph);

    if (!shouldTransition) {
      return {
        relationshipsAdded: [],
        entitiesModified: [],
        pressureChanges: {},
        description: `${currentEra.name} persists`
      };
    }

    // Find next era (first entity with status: 'future')
    const nextEra = graph.getEntities().find(e =>
      e.kind === 'era' && e.status === 'future'
    );

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
    currentEra.status = 'past';
    currentEra.temporal!.endTick = graph.tick;
    currentEra.updatedAt = graph.tick;

    nextEra.status = 'current';
    nextEra.temporal = {
      startTick: graph.tick,
      endTick: null
    };
    nextEra.updatedAt = graph.tick;

    // Update graph's currentEra reference
    // Find matching era in config
    const configEra = graph.config.eras.find(e => e.id === nextEra.subtype);
    if (configEra) {
      graph.currentEra = configEra;
    }

    // Create active_during relationships for prominent entities in the ending era
    const relationshipsAdded: any[] = [];
    const prominentEntities = graph.getEntities().filter(e =>
      (e.prominence === 'recognized' || e.prominence === 'renowned' || e.prominence === 'mythic') &&
      e.kind !== 'era' &&
      e.createdAt >= currentEra.temporal!.startTick &&
      e.createdAt < graph.tick
    );

    // Link up to 10 most prominent entities to the ending era
    prominentEntities.slice(0, 10).forEach(entity => {
      relationshipsAdded.push({
        kind: 'active_during',
        src: entity.id,
        dst: currentEra.id,
        strength: 1.0,
        createdAt: graph.tick
      });
      // Note: entity.links will be updated by addRelationship() in worldEngine
    });

    // Create history event
    graph.history.push({
      tick: graph.tick,
      era: nextEra.subtype,
      type: 'special',
      description: `The ${currentEra.name} ends. The ${nextEra.name} begins.`,
      entitiesCreated: [],
      relationshipsCreated: relationshipsAdded,
      entitiesModified: [currentEra.id, nextEra.id]
    });

    // Apply era transition effects (domain-specific)
    const transitionEffects = graph.config.domain.getEraTransitionEffects?.(currentEra, nextEra, graph) || {};

    return {
      relationshipsAdded,
      entitiesModified: [
        { id: currentEra.id, changes: { status: 'past', temporal: currentEra.temporal } },
        { id: nextEra.id, changes: { status: 'current', temporal: nextEra.temporal } }
      ],
      pressureChanges: transitionEffects.pressureChanges || {},
      description: `Era transition: ${currentEra.name} → ${nextEra.name} (${prominentEntities.length} entities linked)`
    };
  }
};

/**
 * Activate the first era if no current era exists
 */
function activateFirstEra(graph: Graph): SystemResult {
  const firstEra = graph.getEntities().find(e =>
    e.kind === 'era'
  );

  if (!firstEra) {
    return {
      relationshipsAdded: [],
      entitiesModified: [],
      pressureChanges: {},
      description: 'No era entities exist'
    };
  }

  firstEra.status = 'current';
  firstEra.temporal = {
    startTick: graph.tick,
    endTick: null
  };
  firstEra.updatedAt = graph.tick;

  // Update graph's currentEra reference
  const configEra = graph.config.eras.find(e => e.id === firstEra.subtype);
  if (configEra) {
    graph.currentEra = configEra;
  }

  return {
    relationshipsAdded: [],
    entitiesModified: [
      { id: firstEra.id, changes: { status: 'current', temporal: firstEra.temporal } }
    ],
    pressureChanges: {},
    description: `${firstEra.name} begins`
  };
}

/**
 * Check if conditions are met for era transition
 * Uses domain-defined transition logic
 */
function checkTransitionConditions(currentEra: HardState, graph: Graph): boolean {
  // Get domain-specific transition conditions
  const transitionConditions = graph.config.domain.getEraTransitionConditions?.(currentEra.subtype);

  if (!transitionConditions) {
    // No domain-specific conditions - use default heuristics
    return checkDefaultTransitionConditions(currentEra, graph);
  }

  // Check each condition
  return transitionConditions.every((condition: any) => {
    switch (condition.type) {
      case 'pressure':
        return checkPressureCondition(condition, graph);
      case 'entity_count':
        return checkEntityCountCondition(condition, graph);
      case 'occurrence':
        return checkOccurrenceCondition(condition, graph);
      case 'time':
        return checkTimeCondition(condition, currentEra, graph);
      default:
        return true;
    }
  });
}

/**
 * Default transition conditions (if domain doesn't define custom logic)
 */
function checkDefaultTransitionConditions(currentEra: HardState, graph: Graph): boolean {
  const eraAge = currentEra.temporal
    ? graph.tick - currentEra.temporal.startTick
    : graph.tick - currentEra.createdAt;

  // Simple heuristic: transition after era has lasted 2x minimum length
  const minLength = eraTransition.metadata?.parameters?.minEraLength?.value ?? 50;
  return eraAge > minLength * 2;
}

/**
 * Check pressure-based condition
 */
function checkPressureCondition(condition: any, graph: Graph): boolean {
  const pressure = graph.pressures.get(condition.pressureId) || 0;

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
function checkEntityCountCondition(condition: any, graph: Graph): boolean {
  const entities = graph.getEntities().filter(e =>
    e.kind === condition.entityKind &&
    (!condition.subtype || e.subtype === condition.subtype) &&
    (!condition.status || e.status === condition.status)
  );

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
function checkOccurrenceCondition(condition: any, graph: Graph): boolean {
  const occurrences = graph.getEntities().filter(e =>
    e.kind === 'occurrence' &&
    (!condition.subtype || e.subtype === condition.subtype) &&
    e.status === 'active'
  );

  switch (condition.operator) {
    case 'exists':
      return occurrences.length > 0;
    case 'ended':
      const endedOccurrences = graph.getEntities().filter(e =>
        e.kind === 'occurrence' &&
        e.subtype === condition.subtype &&
        e.status === 'ended'
      );
      return endedOccurrences.length > 0;
    default:
      return false;
  }
}

/**
 * Check time-based condition
 */
function checkTimeCondition(condition: any, currentEra: HardState, graph: Graph): boolean {
  const eraAge = currentEra.temporal
    ? graph.tick - currentEra.temporal.startTick
    : graph.tick - currentEra.createdAt;

  return eraAge > condition.minTicks;
}
