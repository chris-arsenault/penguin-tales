import { SimulationSystem, SystemResult, ComponentPurpose } from '../engine/types';
import { HardState, Relationship } from '../core/worldTypes';
import { TemplateGraphView } from '../graph/templateGraphView';
import { adjustProminence, getProminenceValue, rollProbability } from '../utils';

/**
 * Connection Evolution System Factory
 *
 * Creates configurable systems that modify entity/relationship state
 * based on connection metrics. This is a domain-agnostic pattern that
 * can implement:
 * - Prominence evolution (fame/obscurity based on connections)
 * - Alliance formation (create relationships between entities with shared relationships)
 * - Status transitions based on graph topology
 *
 * The factory creates a SimulationSystem from a ConnectionEvolutionConfig.
 */

// =============================================================================
// CONFIGURATION TYPES
// =============================================================================

export type MetricType =
  | 'connection_count'      // Total relationships involving entity
  | 'relationship_count'    // Count of specific relationship kind(s)
  | 'shared_relationship'   // Count entities sharing a specific relationship (e.g., common enemies)
  | 'catalyzed_events';     // Number of catalyst events (for NPCs with catalyst data)

export type ConditionOperator = '>' | '<' | '>=' | '<=' | '==';

export type ThresholdValue =
  | number
  | 'prominence_scaled';    // (prominenceLevel + 1) * multiplier

export type ActionType =
  | { type: 'adjust_prominence'; direction: 'up' | 'down' }
  | { type: 'create_relationship'; kind: string; category?: string; strength?: number }
  | { type: 'change_status'; newStatus: string }
  | { type: 'add_tag'; tag: string; value?: string | boolean };

export interface MetricConfig {
  type: MetricType;
  /** For connection_count: which relationship kinds to count. Empty = all */
  relationshipKinds?: string[];
  /** For relationship_count: direction to filter (src = outgoing, dst = incoming, both = either) */
  direction?: 'src' | 'dst' | 'both';
  /** For shared_relationship: the relationship kind to check for shared targets */
  sharedRelationshipKind?: string;
  /** For shared_relationship: direction to check (src = outgoing shared targets) */
  sharedDirection?: 'src' | 'dst';
  /** Minimum relationship strength to count */
  minStrength?: number;
}

export interface EvolutionRule {
  /** Condition to check */
  condition: {
    operator: ConditionOperator;
    threshold: ThresholdValue;
    /** Multiplier for prominence_scaled threshold (default: 6) */
    multiplier?: number;
  };
  /** Probability of applying action when condition is met (0-1) */
  probability: number;
  /** Action to take */
  action: ActionType;
  /**
   * For create_relationship: create between matching entities that satisfy condition.
   * If true, pairs entities that both pass the condition.
   * If false/undefined, action applies to entity directly.
   */
  betweenMatching?: boolean;
}

export interface SubtypeBonus {
  subtype: string;
  bonus: number;
}

export interface ConnectionEvolutionConfig {
  /** Unique system identifier */
  id: string;
  /** Human-readable name */
  name: string;
  /** Optional description */
  description?: string;

  /** Entity kind to evaluate */
  entityKind: string;
  /** Optional: only evaluate these subtypes */
  entitySubtypes?: string[];
  /** Optional: only evaluate entities with this status */
  entityStatus?: string;

  /** How to calculate the metric for each entity */
  metric: MetricConfig;

  /** Rules to apply based on metric value */
  rules: EvolutionRule[];

  /** Subtype bonuses added to metric value */
  subtypeBonuses?: SubtypeBonus[];

  /** Pressure changes when system runs and modifies entities */
  pressureChanges?: Record<string, number>;

  /** Throttle: only run on some ticks (0-1, default: 1.0 = every tick) */
  throttleChance?: number;
}

// =============================================================================
// METRIC CALCULATION
// =============================================================================

function calculateMetric(
  entity: HardState,
  config: MetricConfig,
  graphView: TemplateGraphView
): number {
  switch (config.type) {
    case 'connection_count': {
      const relationships = graphView.getAllRelationships();
      return relationships.filter(r => {
        const involvesEntity = r.src === entity.id || r.dst === entity.id;
        if (!involvesEntity) return false;

        if (config.relationshipKinds && config.relationshipKinds.length > 0) {
          if (!config.relationshipKinds.includes(r.kind)) return false;
        }

        if (config.minStrength !== undefined) {
          if ((r.strength ?? 0.5) < config.minStrength) return false;
        }

        return true;
      }).length;
    }

    case 'relationship_count': {
      const direction = config.direction ?? 'both';
      const relationships = graphView.getAllRelationships().filter(r => {
        if (config.relationshipKinds && !config.relationshipKinds.includes(r.kind)) {
          return false;
        }

        if (config.minStrength !== undefined && (r.strength ?? 0.5) < config.minStrength) {
          return false;
        }

        if (direction === 'src') return r.src === entity.id;
        if (direction === 'dst') return r.dst === entity.id;
        return r.src === entity.id || r.dst === entity.id;
      });
      return relationships.length;
    }

    case 'shared_relationship': {
      // Find entities that share a common target via the specified relationship
      // E.g., for alliance formation: find entities sharing common enemies (at_war_with)
      if (!config.sharedRelationshipKind) return 0;

      const direction = config.sharedDirection ?? 'src';
      const minStrength = config.minStrength ?? 0;

      // Get this entity's targets
      const entityTargets = new Set<string>();
      graphView.getAllRelationships().forEach(r => {
        if (r.kind !== config.sharedRelationshipKind) return;
        if (config.minStrength !== undefined && (r.strength ?? 0.5) < minStrength) return;

        if (direction === 'src' && r.src === entity.id) {
          entityTargets.add(r.dst);
        } else if (direction === 'dst' && r.dst === entity.id) {
          entityTargets.add(r.src);
        }
      });

      if (entityTargets.size === 0) return 0;

      // Count other entities that share at least one target
      const sharedCount = new Set<string>();
      graphView.getAllRelationships().forEach(r => {
        if (r.kind !== config.sharedRelationshipKind) return;
        if (config.minStrength !== undefined && (r.strength ?? 0.5) < minStrength) return;

        let otherId: string | null = null;
        let targetId: string | null = null;

        if (direction === 'src' && r.src !== entity.id) {
          otherId = r.src;
          targetId = r.dst;
        } else if (direction === 'dst' && r.dst !== entity.id) {
          otherId = r.dst;
          targetId = r.src;
        }

        if (otherId && targetId && entityTargets.has(targetId)) {
          sharedCount.add(otherId);
        }
      });

      return sharedCount.size;
    }

    case 'catalyzed_events': {
      return entity.catalyst?.catalyzedEvents?.length ?? 0;
    }

    default:
      return 0;
  }
}

function resolveThreshold(
  threshold: ThresholdValue,
  entity: HardState,
  multiplier: number = 6
): number {
  if (typeof threshold === 'number') {
    return threshold;
  }
  // prominence_scaled: (prominenceLevel + 1) * multiplier
  const level = getProminenceValue(entity.prominence);
  return (level + 1) * multiplier;
}

function evaluateCondition(
  value: number,
  operator: ConditionOperator,
  threshold: number
): boolean {
  switch (operator) {
    case '>': return value > threshold;
    case '<': return value < threshold;
    case '>=': return value >= threshold;
    case '<=': return value <= threshold;
    case '==': return value === threshold;
    default: return false;
  }
}

// =============================================================================
// SYSTEM FACTORY
// =============================================================================

/**
 * Create a SimulationSystem from a ConnectionEvolutionConfig
 */
export function createConnectionEvolutionSystem(
  config: ConnectionEvolutionConfig
): SimulationSystem {
  return {
    id: config.id,
    name: config.name,

    // Note: contract removed - systems don't need lineage and affects is redundant

    metadata: {
      produces: {
        relationships: config.rules
          .filter(r => r.action.type === 'create_relationship')
          .map(r => ({
            kind: (r.action as { type: 'create_relationship'; kind: string }).kind,
            category: (r.action as { type: 'create_relationship'; category?: string }).category,
            frequency: 'uncommon' as const,
            comment: `Created by ${config.name}`
          })),
        modifications: [
          { type: 'prominence', frequency: 'common', comment: config.description || config.name }
        ]
      },
      effects: {
        graphDensity: 0.3,
        clusterFormation: 0.4,
        diversityImpact: 0.4,
        comment: config.description || config.name
      },
      parameters: {},
      triggers: {
        graphConditions: ['Entity connection metrics'],
        comment: `Evaluates ${config.entityKind} based on ${config.metric.type}`
      }
    },

    apply: (graphView: TemplateGraphView, modifier: number = 1.0): SystemResult => {
      // Throttle check
      if (config.throttleChance !== undefined && config.throttleChance < 1.0) {
        if (Math.random() > config.throttleChance) {
          return {
            relationshipsAdded: [],
            entitiesModified: [],
            pressureChanges: {},
            description: `${config.name}: throttled`
          };
        }
      }

      const modifications: Array<{ id: string; changes: Partial<HardState> }> = [];
      const relationships: Relationship[] = [];

      // Find entities to evaluate
      let entities = graphView.findEntities({ kind: config.entityKind });

      if (config.entitySubtypes && config.entitySubtypes.length > 0) {
        entities = entities.filter(e => config.entitySubtypes!.includes(e.subtype!));
      }

      if (config.entityStatus) {
        entities = entities.filter(e => e.status === config.entityStatus);
      }

      // For create_relationship with betweenMatching, track matching entities per rule
      const matchingByRule = new Map<number, HardState[]>();

      // Evaluate each entity
      for (const entity of entities) {
        let metricValue = calculateMetric(entity, config.metric, graphView);

        // Apply subtype bonuses
        if (config.subtypeBonuses && entity.subtype) {
          const bonus = config.subtypeBonuses.find(b => b.subtype === entity.subtype);
          if (bonus) {
            metricValue += bonus.bonus;
          }
        }

        // Evaluate each rule
        for (let ruleIdx = 0; ruleIdx < config.rules.length; ruleIdx++) {
          const rule = config.rules[ruleIdx];
          const threshold = resolveThreshold(
            rule.condition.threshold,
            entity,
            rule.condition.multiplier
          );

          if (!evaluateCondition(metricValue, rule.condition.operator, threshold)) {
            continue;
          }

          // Condition met - check probability
          if (!rollProbability(rule.probability, modifier)) {
            continue;
          }

          // Apply action
          switch (rule.action.type) {
            case 'adjust_prominence': {
              const delta = rule.action.direction === 'up' ? 1 : -1;
              modifications.push({
                id: entity.id,
                changes: {
                  prominence: adjustProminence(entity.prominence, delta)
                }
              });
              break;
            }

            case 'create_relationship': {
              if (rule.betweenMatching) {
                // Track for later pairing
                if (!matchingByRule.has(ruleIdx)) {
                  matchingByRule.set(ruleIdx, []);
                }
                matchingByRule.get(ruleIdx)!.push(entity);
              }
              // Non-betweenMatching relationships would need a target - skip for now
              break;
            }

            case 'change_status': {
              modifications.push({
                id: entity.id,
                changes: { status: rule.action.newStatus }
              });
              break;
            }

            case 'add_tag': {
              const newTags = { ...entity.tags };
              newTags[rule.action.tag] = rule.action.value ?? true;
              modifications.push({
                id: entity.id,
                changes: { tags: newTags }
              });
              break;
            }
          }
        }
      }

      // Create relationships between matching entities (for betweenMatching rules)
      for (const [ruleIdx, matchingEntities] of matchingByRule.entries()) {
        const rule = config.rules[ruleIdx];
        if (rule.action.type !== 'create_relationship') continue;

        // Create relationships between all pairs of matching entities
        for (let i = 0; i < matchingEntities.length; i++) {
          for (let j = i + 1; j < matchingEntities.length; j++) {
            const src = matchingEntities[i];
            const dst = matchingEntities[j];

            // Check if relationship already exists
            if (graphView.hasRelationship(src.id, dst.id, rule.action.kind)) {
              continue;
            }

            relationships.push({
              kind: rule.action.kind,
              src: src.id,
              dst: dst.id,
              strength: rule.action.strength ?? 0.5,
              category: rule.action.category
            });
          }
        }
      }

      const pressureChanges = (modifications.length > 0 || relationships.length > 0)
        ? (config.pressureChanges ?? {})
        : {};

      return {
        relationshipsAdded: relationships,
        entitiesModified: modifications,
        pressureChanges,
        description: `${config.name}: ${modifications.length} modified, ${relationships.length} relationships`
      };
    }
  };
}

