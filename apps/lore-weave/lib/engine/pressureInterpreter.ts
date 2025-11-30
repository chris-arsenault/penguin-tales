/**
 * Pressure Interpreter
 *
 * Converts declarative pressure definitions into runtime Pressure objects
 * with executable growth functions.
 */

import { Pressure, Graph } from './types';
import {
  DeclarativePressure,
  FeedbackFactor,
  SimpleCountFactor,
  PressuresFile
} from './declarativePressureTypes';
import { findEntities, hasTag } from '../utils/index';

// =============================================================================
// FACTOR EVALUATION
// =============================================================================

/**
 * Evaluate a simple count factor (used in ratios)
 */
function evaluateSimpleCount(factor: SimpleCountFactor, graph: Graph): number {
  switch (factor.type) {
    case 'entity_count':
      return findEntities(graph, {
        kind: factor.kind,
        subtype: factor.subtype,
        status: factor.status
      }).length;

    case 'relationship_count':
      return graph.getRelationships().filter(r =>
        factor.relationshipKinds.includes(r.kind)
      ).length;

    case 'tag_count':
      return graph.getEntities().filter(e =>
        factor.tags.some(tag => hasTag(e.tags, tag))
      ).length;

    case 'total_entities':
      return graph.getEntityCount();

    case 'constant':
      return factor.value;

    default:
      return 0;
  }
}

/**
 * Evaluate a feedback factor and return its contribution
 */
function evaluateFactor(factor: FeedbackFactor, graph: Graph): number {
  let value: number;

  switch (factor.type) {
    case 'entity_count':
      value = findEntities(graph, {
        kind: factor.kind,
        subtype: factor.subtype,
        status: factor.status
      }).length;
      break;

    case 'relationship_count':
      value = graph.getRelationships().filter(r =>
        factor.relationshipKinds.includes(r.kind)
      ).length;
      break;

    case 'tag_count':
      value = graph.getEntities().filter(e =>
        factor.tags.some(tag => hasTag(e.tags, tag))
      ).length;
      break;

    case 'ratio': {
      const numerator = evaluateSimpleCount(factor.numerator, graph);
      const denominator = evaluateSimpleCount(factor.denominator, graph);

      if (denominator === 0) {
        value = factor.fallbackValue ?? 0;
      } else {
        value = numerator / denominator;
      }
      break;
    }

    case 'status_ratio': {
      const allEntities = findEntities(graph, {
        kind: factor.kind,
        subtype: factor.subtype
      });
      const aliveEntities = allEntities.filter(e => e.status === factor.aliveStatus);

      if (allEntities.length === 0) {
        value = 1; // No entities = stable (not tracked yet)
      } else {
        value = aliveEntities.length / allEntities.length;
      }
      break;
    }

    case 'cross_culture_ratio': {
      // Count relationships where src and dst have different cultures
      const relationships = graph.getRelationships().filter(r =>
        factor.relationshipKinds.includes(r.kind)
      );

      if (relationships.length === 0) {
        value = 0;
      } else {
        let crossCultureCount = 0;
        for (const rel of relationships) {
          const src = graph.getEntity(rel.src);
          const dst = graph.getEntity(rel.dst);
          if (src && dst && src.culture !== dst.culture) {
            crossCultureCount++;
          }
        }
        value = crossCultureCount / relationships.length;
      }
      break;
    }

    default:
      value = 0;
  }

  // Apply coefficient
  let result = value * factor.coefficient;

  // Apply cap if specified
  if (factor.cap !== undefined) {
    result = Math.min(result, factor.cap);
  }

  return result;
}

// =============================================================================
// PRESSURE INTERPRETER
// =============================================================================

/**
 * Convert a declarative pressure to a runtime Pressure object
 */
export function createPressureFromDeclarative(definition: DeclarativePressure): Pressure {
  return {
    id: definition.id,
    name: definition.name,
    value: definition.initialValue,
    decay: definition.decay,
    contract: definition.contract,

    growth: (graph: Graph): number => {
      const config = definition.growth;

      // Start with base growth
      let total = config.baseGrowth ?? 0;

      // Add positive feedback
      for (const factor of config.positiveFeedback) {
        total += evaluateFactor(factor, graph);
      }

      // Subtract negative feedback
      for (const factor of config.negativeFeedback) {
        total -= evaluateFactor(factor, graph);
      }

      // Apply floor of 0
      total = Math.max(0, total);

      // Apply cap if specified
      if (config.maxGrowth !== undefined) {
        total = Math.min(total, config.maxGrowth);
      }

      return total;
    }
  };
}

/**
 * Load all pressures from a PressuresFile
 */
export function loadPressures(file: PressuresFile): Pressure[] {
  return file.pressures.map(createPressureFromDeclarative);
}

/**
 * Load a single pressure from a declarative definition
 */
export function loadPressure(definition: DeclarativePressure): Pressure {
  return createPressureFromDeclarative(definition);
}
