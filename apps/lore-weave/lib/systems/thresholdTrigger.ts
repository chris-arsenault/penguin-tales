import { SimulationSystem, SystemResult, ComponentPurpose } from '../engine/types';
import { HardState, Relationship, EntityTags } from '../core/worldTypes';
import { TemplateGraphView } from '../graph/templateGraphView';
import { rollProbability, hasTag, generateId } from '../utils';
import { SelectionFilter } from '../engine/declarativeTypes';
import { SimpleEntityResolver, applySelectionFilters } from '../selection';

/**
 * Threshold Trigger System Factory
 *
 * Creates configurable systems that detect graph conditions and set tags/pressures
 * to trigger generation templates. This separates condition detection (systems)
 * from entity creation (templates).
 *
 * Design philosophy:
 * - Systems observe and label reality with tags describing current state
 * - Tags use state-descriptive names (e.g., "power_vacuum", "war_brewing")
 * - Templates react to these tags and create entities
 * - After creation, templates transition tags (e.g., "war_brewing" → "at_war")
 *
 * Tag patterns:
 * - Boolean tag for single-entity conditions: { power_vacuum: true }
 * - Cluster ID tag for multi-entity conditions: { war_brewing: "cluster_xyz" }
 *
 * The factory creates a SimulationSystem from a ThresholdTriggerConfig.
 */

// =============================================================================
// CONFIGURATION TYPES
// =============================================================================

export type ConditionType =
  | 'relationship_count'      // Count relationships of a kind
  | 'relationship_exists'     // Check if specific relationship pattern exists
  | 'entity_status'           // Check entity status
  | 'tag_exists'              // Check if tag is set
  | 'tag_absent'              // Check if tag is NOT set
  | 'pressure_above'          // Check pressure threshold
  | 'pressure_below'          // Check pressure threshold
  | 'time_since_update'       // Ticks since entity was updated
  | 'connection_count';       // Total connections for entity

export interface TriggerCondition {
  type: ConditionType;

  // For relationship_count
  relationshipKind?: string;
  relationshipDirection?: 'src' | 'dst' | 'both';
  minCount?: number;
  maxCount?: number;

  // For relationship_exists
  targetKind?: string;
  targetStatus?: string;

  // For entity_status
  status?: string;
  notStatus?: string;

  // For tag_exists / tag_absent
  tag?: string;

  // For pressure_above / pressure_below
  pressureId?: string;
  threshold?: number;

  // For time_since_update
  minTicks?: number;

  // For connection_count
  minConnections?: number;
  maxConnections?: number;
}

export type TriggerActionType =
  | 'set_tag'           // Set a tag on matching entities
  | 'set_cluster_tag'   // Set a tag with cluster ID for grouped entities
  | 'remove_tag'        // Remove a tag
  | 'modify_pressure'   // Change a pressure value
  | 'create_relationship'; // Create relationship between existing entities

export interface TriggerAction {
  type: TriggerActionType;

  // For set_tag / set_cluster_tag / remove_tag
  tag?: string;
  tagValue?: string | boolean;

  // For modify_pressure
  pressureId?: string;
  delta?: number;

  // For create_relationship
  relationshipKind?: string;
  relationshipStrength?: number;
  /** If true, create relationships between all matching entities */
  betweenMatching?: boolean;
}

export interface EntityFilter {
  kind: string;
  subtypes?: string[];
  status?: string;
  notStatus?: string;
  /** Filter for entities that have this tag */
  hasTag?: string;
  /** Filter for entities that do NOT have this tag */
  notHasTag?: string;
  /** Advanced selection filters (same as generator targeting) */
  filters?: SelectionFilter[];
}

export interface ThresholdTriggerConfig {
  /** Unique system identifier */
  id: string;
  /** Human-readable name */
  name: string;
  /** Optional description */
  description?: string;

  /** What entities to evaluate */
  entityFilter: EntityFilter;

  /** Conditions that must ALL be true for an entity to match */
  conditions: TriggerCondition[];

  /** Actions to take on matching entities */
  actions: TriggerAction[];

  /**
   * For cluster actions: how to group matching entities
   * 'individual' - each entity gets its own trigger
   * 'all_matching' - all matching entities share one cluster ID
   * 'by_relationship' - group by shared relationship targets
   */
  clusterMode?: 'individual' | 'all_matching' | 'by_relationship';

  /** For by_relationship clustering: the relationship to group by */
  clusterRelationshipKind?: string;

  /** Minimum entities needed to trigger (for cluster modes) */
  minClusterSize?: number;

  /** Throttle: only run on some ticks (0-1, default: 1.0 = every tick) */
  throttleChance?: number;

  /** Cooldown tag: if this tag exists on entity, skip it */
  cooldownTag?: string;

  /** Ticks to check for cooldown */
  cooldownTicks?: number;

  /** Pressure changes when trigger fires */
  pressureChanges?: Record<string, number>;
}

// =============================================================================
// CONDITION EVALUATION
// =============================================================================

function evaluateCondition(
  entity: HardState,
  condition: TriggerCondition,
  graphView: TemplateGraphView
): boolean {
  switch (condition.type) {
    case 'relationship_count': {
      const direction = condition.relationshipDirection ?? 'both';
      const relationships = graphView.getAllRelationships().filter(r => {
        if (condition.relationshipKind && r.kind !== condition.relationshipKind) return false;
        if (direction === 'src') return r.src === entity.id;
        if (direction === 'dst') return r.dst === entity.id;
        return r.src === entity.id || r.dst === entity.id;
      });

      const count = relationships.length;
      if (condition.minCount !== undefined && count < condition.minCount) return false;
      if (condition.maxCount !== undefined && count > condition.maxCount) return false;
      return true;
    }

    case 'relationship_exists': {
      const direction = condition.relationshipDirection ?? 'both';
      return graphView.getAllRelationships().some(r => {
        if (condition.relationshipKind && r.kind !== condition.relationshipKind) return false;

        let entityMatches = false;
        if (direction === 'src') entityMatches = r.src === entity.id;
        else if (direction === 'dst') entityMatches = r.dst === entity.id;
        else entityMatches = r.src === entity.id || r.dst === entity.id;

        if (!entityMatches) return false;

        // Check target entity properties if specified
        if (condition.targetKind || condition.targetStatus) {
          const targetId = r.src === entity.id ? r.dst : r.src;
          const target = graphView.getEntity(targetId);
          if (!target) return false;
          if (condition.targetKind && target.kind !== condition.targetKind) return false;
          if (condition.targetStatus && target.status !== condition.targetStatus) return false;
        }

        return true;
      });
    }

    case 'entity_status': {
      if (condition.status && entity.status !== condition.status) return false;
      if (condition.notStatus && entity.status === condition.notStatus) return false;
      return true;
    }

    case 'tag_exists': {
      return condition.tag ? hasTag(entity.tags, condition.tag) : false;
    }

    case 'tag_absent': {
      return condition.tag ? !hasTag(entity.tags, condition.tag) : true;
    }

    case 'pressure_above': {
      if (!condition.pressureId) return false;
      const pressure = graphView.getPressure(condition.pressureId);
      return pressure >= (condition.threshold ?? 0);
    }

    case 'pressure_below': {
      if (!condition.pressureId) return false;
      const pressure = graphView.getPressure(condition.pressureId);
      return pressure < (condition.threshold ?? 0);
    }

    case 'time_since_update': {
      const ticksSinceUpdate = graphView.tick - entity.updatedAt;
      return ticksSinceUpdate >= (condition.minTicks ?? 0);
    }

    case 'connection_count': {
      const connections = graphView.getAllRelationships().filter(r =>
        r.src === entity.id || r.dst === entity.id
      ).length;

      if (condition.minConnections !== undefined && connections < condition.minConnections) return false;
      if (condition.maxConnections !== undefined && connections > condition.maxConnections) return false;
      return true;
    }

    default:
      return false;
  }
}

function evaluateAllConditions(
  entity: HardState,
  conditions: TriggerCondition[],
  graphView: TemplateGraphView
): boolean {
  return conditions.every(condition => evaluateCondition(entity, condition, graphView));
}

// =============================================================================
// CLUSTERING
// =============================================================================

function clusterEntities(
  entities: HardState[],
  config: ThresholdTriggerConfig,
  graphView: TemplateGraphView
): Map<string, HardState[]> {
  const clusters = new Map<string, HardState[]>();

  switch (config.clusterMode) {
    case 'individual':
      // Each entity is its own cluster
      entities.forEach(e => {
        clusters.set(e.id, [e]);
      });
      break;

    case 'all_matching':
      // All entities share one cluster
      if (entities.length > 0) {
        const clusterId = generateId('cluster');
        clusters.set(clusterId, entities);
      }
      break;

    case 'by_relationship': {
      // Group by shared relationship targets
      if (!config.clusterRelationshipKind) {
        // Fallback to individual
        entities.forEach(e => clusters.set(e.id, [e]));
        break;
      }

      // Find shared targets
      const entityTargets = new Map<string, Set<string>>();
      entities.forEach(e => {
        const targets = new Set<string>();
        graphView.getAllRelationships().forEach(r => {
          if (r.kind !== config.clusterRelationshipKind) return;
          if (r.src === e.id) targets.add(r.dst);
          if (r.dst === e.id) targets.add(r.src);
        });
        entityTargets.set(e.id, targets);
      });

      // Group entities that share at least one target
      const visited = new Set<string>();
      entities.forEach(e => {
        if (visited.has(e.id)) return;

        const cluster: HardState[] = [e];
        visited.add(e.id);
        const myTargets = entityTargets.get(e.id) || new Set();

        entities.forEach(other => {
          if (visited.has(other.id)) return;
          const otherTargets = entityTargets.get(other.id) || new Set();

          // Check for shared targets
          const hasShared = Array.from(myTargets).some(t => otherTargets.has(t));
          if (hasShared) {
            cluster.push(other);
            visited.add(other.id);
          }
        });

        const clusterId = generateId('cluster');
        clusters.set(clusterId, cluster);
      });
      break;
    }

    default:
      // Default to individual
      entities.forEach(e => clusters.set(e.id, [e]));
  }

  // Filter by minimum cluster size
  if (config.minClusterSize && config.minClusterSize > 1) {
    for (const [id, members] of clusters) {
      if (members.length < config.minClusterSize) {
        clusters.delete(id);
      }
    }
  }

  return clusters;
}

// =============================================================================
// ACTION APPLICATION
// =============================================================================

function applyActions(
  clusters: Map<string, HardState[]>,
  config: ThresholdTriggerConfig,
  graphView: TemplateGraphView
): {
  modifications: Array<{ id: string; changes: Partial<HardState> }>;
  relationships: Relationship[];
  pressureChanges: Record<string, number>;
} {
  const modifications: Array<{ id: string; changes: Partial<HardState> }> = [];
  const relationships: Relationship[] = [];
  const pressureChanges: Record<string, number> = {};

  for (const [clusterId, members] of clusters) {
    for (const action of config.actions) {
      switch (action.type) {
        case 'set_tag': {
          members.forEach(entity => {
            const newTags: EntityTags = { ...entity.tags };
            newTags[action.tag!] = action.tagValue ?? true;
            modifications.push({
              id: entity.id,
              changes: { tags: newTags }
            });
          });
          break;
        }

        case 'set_cluster_tag': {
          members.forEach(entity => {
            const newTags: EntityTags = { ...entity.tags };
            // Use cluster ID as tag value for correlation
            newTags[action.tag!] = clusterId;
            modifications.push({
              id: entity.id,
              changes: { tags: newTags }
            });
          });
          break;
        }

        case 'remove_tag': {
          members.forEach(entity => {
            if (hasTag(entity.tags, action.tag!)) {
              const newTags: EntityTags = { ...entity.tags };
              delete newTags[action.tag!];
              modifications.push({
                id: entity.id,
                changes: { tags: newTags }
              });
            }
          });
          break;
        }

        case 'modify_pressure': {
          if (action.pressureId && action.delta) {
            pressureChanges[action.pressureId] =
              (pressureChanges[action.pressureId] || 0) + action.delta;
          }
          break;
        }

        case 'create_relationship': {
          if (action.betweenMatching && members.length >= 2) {
            // Create relationships between all pairs
            for (let i = 0; i < members.length; i++) {
              for (let j = i + 1; j < members.length; j++) {
                const src = members[i];
                const dst = members[j];

                // Check if relationship already exists
                if (!graphView.hasRelationship(src.id, dst.id, action.relationshipKind!)) {
                  relationships.push({
                    kind: action.relationshipKind!,
                    src: src.id,
                    dst: dst.id,
                    strength: action.relationshipStrength ?? 0.5
                  });
                }
              }
            }
          }
          break;
        }
      }
    }
  }

  // Add config-level pressure changes if any triggers fired
  if (clusters.size > 0 && config.pressureChanges) {
    for (const [pressureId, delta] of Object.entries(config.pressureChanges)) {
      pressureChanges[pressureId] = (pressureChanges[pressureId] || 0) + delta;
    }
  }

  return { modifications, relationships, pressureChanges };
}

// =============================================================================
// SYSTEM FACTORY
// =============================================================================

/**
 * Create a SimulationSystem from a ThresholdTriggerConfig
 */
export function createThresholdTriggerSystem(
  config: ThresholdTriggerConfig
): SimulationSystem {
  return {
    id: config.id,
    name: config.name,

    apply: (graphView: TemplateGraphView, modifier: number = 1.0): SystemResult => {
      // Throttle check
      if (config.throttleChance !== undefined && config.throttleChance < 1.0) {
        if (!rollProbability(config.throttleChance, modifier)) {
          return {
            relationshipsAdded: [],
            entitiesModified: [],
            pressureChanges: {},
            description: `${config.name}: dormant`
          };
        }
      }

      // Find entities matching filter
      let entities = graphView.findEntities({
        kind: config.entityFilter.kind,
        subtype: config.entityFilter.subtypes?.[0],
        status: config.entityFilter.status
      });

      // Apply additional filters
      if (config.entityFilter.subtypes && config.entityFilter.subtypes.length > 1) {
        entities = entities.filter(e =>
          config.entityFilter.subtypes!.includes(e.subtype!)
        );
      }

      if (config.entityFilter.notStatus) {
        entities = entities.filter(e => e.status !== config.entityFilter.notStatus);
      }

      // Apply tag filters
      if (config.entityFilter.hasTag) {
        entities = entities.filter(e => hasTag(e.tags, config.entityFilter.hasTag!));
      }

      if (config.entityFilter.notHasTag) {
        entities = entities.filter(e => !hasTag(e.tags, config.entityFilter.notHasTag!));
      }

      // Apply cooldown filter
      if (config.cooldownTag) {
        entities = entities.filter(e => !hasTag(e.tags, config.cooldownTag!));
      }

      // Apply advanced selection filters
      if (config.entityFilter.filters && config.entityFilter.filters.length > 0) {
        const resolver = new SimpleEntityResolver(graphView);
        entities = applySelectionFilters(entities, config.entityFilter.filters, resolver);
      }

      // Evaluate conditions on each entity
      const matchingEntities = entities.filter(entity =>
        evaluateAllConditions(entity, config.conditions, graphView)
      );

      if (matchingEntities.length === 0) {
        return {
          relationshipsAdded: [],
          entitiesModified: [],
          pressureChanges: {},
          description: `${config.name}: no matches`
        };
      }

      // Cluster matching entities
      const clusters = clusterEntities(matchingEntities, config, graphView);

      if (clusters.size === 0) {
        return {
          relationshipsAdded: [],
          entitiesModified: [],
          pressureChanges: {},
          description: `${config.name}: clusters too small`
        };
      }

      // Apply actions
      const { modifications, relationships, pressureChanges } =
        applyActions(clusters, config, graphView);

      return {
        relationshipsAdded: relationships,
        entitiesModified: modifications,
        pressureChanges,
        description: `${config.name}: ${clusters.size} trigger(s), ${modifications.length} entities tagged`
      };
    }
  };
}
