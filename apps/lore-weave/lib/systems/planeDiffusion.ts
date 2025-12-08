/**
 * Plane Diffusion System Factory
 *
 * Creates configurable systems that compute diffusion fields on semantic planes.
 * Sources emit values, sinks absorb values, and all entities receive tags based
 * on the computed field value at their position.
 *
 * This enables physics-like simulations (heat, resources, influence) to be
 * expressed declaratively, with effects handled by downstream generators/systems.
 *
 * Mathematical Foundation:
 * For each entity position p:
 *   field(p) = Σ_sources(strength_s / falloff(distance(p, s)))
 *            - Σ_sinks(strength_k / falloff(distance(p, k)))
 *
 * Falloff functions:
 * - linear: max(0, 1 - distance/maxRadius)
 * - inverse_square: 1 / (1 + distance²)
 * - exponential: e^(-rate * distance)
 */

import { SimulationSystem, SystemResult, ComponentPurpose } from '../engine/types';
import { HardState } from '../core/worldTypes';
import { Point } from '../coordinates/types';
import { TemplateGraphView } from '../graph/templateGraphView';
import { hasTag, getTagValue } from '../utils';

// =============================================================================
// CONFIGURATION TYPES
// =============================================================================

export type FalloffType = 'linear' | 'inverse_square' | 'exponential';

/**
 * Source configuration: entities that emit into the diffusion field
 */
export interface DiffusionSourceConfig {
  /** Tag that marks an entity as a source */
  tagFilter: string;
  /** Optional tag containing numeric strength value (e.g., "strength:0.5") */
  strengthTag?: string;
  /** Default strength if strengthTag not present */
  defaultStrength: number;
}

/**
 * Sink configuration: entities that absorb from the diffusion field
 */
export interface DiffusionSinkConfig {
  /** Tag that marks an entity as a sink */
  tagFilter: string;
  /** Optional tag containing numeric strength value */
  strengthTag?: string;
  /** Default strength if strengthTag not present */
  defaultStrength: number;
}

/**
 * Diffusion parameters
 */
export interface DiffusionParams {
  /** Diffusivity rate (affects exponential falloff) */
  rate: number;
  /** How value decreases with distance */
  falloff: FalloffType;
  /** Maximum radius of effect (for linear falloff, also used as normalization) */
  maxRadius?: number;
}

/**
 * Output tag configuration: tags set based on field value thresholds
 */
export interface DiffusionOutputTag {
  /** Tag to set on entity */
  tag: string;
  /** Minimum field value to set this tag (inclusive) */
  minValue?: number;
  /** Maximum field value to set this tag (exclusive) */
  maxValue?: number;
}

/**
 * Full plane diffusion configuration
 */
export interface PlaneDiffusionConfig {
  /** Unique system identifier */
  id: string;
  /** Human-readable name */
  name: string;
  /** Optional description */
  description?: string;

  /** Entity kind to operate on (defines the semantic plane) */
  entityKind: string;
  /** Optional: only process entities with this status */
  entityStatus?: string;

  /** Source configuration: entities that emit into the field */
  sources: DiffusionSourceConfig;

  /** Optional sink configuration: entities that absorb from the field */
  sinks?: DiffusionSinkConfig;

  /** Diffusion parameters */
  diffusion: DiffusionParams;

  /** Output tags based on field value thresholds */
  outputTags: DiffusionOutputTag[];

  /** Optional: store raw field value as a tag (e.g., "field_value" → "field_value:0.73") */
  valueTag?: string;

  /** Throttle: only run on some ticks (0-1, default: 1.0 = every tick) */
  throttleChance?: number;

  /** Pressure changes when field computation produces significant values */
  pressureChanges?: Record<string, number>;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Calculate Euclidean distance between two points
 */
function distance(p1: Point, p2: Point): number {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  const dz = (p1.z ?? 50) - (p2.z ?? 50);
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Apply falloff function to distance
 */
function applyFalloff(
  dist: number,
  falloff: FalloffType,
  rate: number,
  maxRadius: number
): number {
  switch (falloff) {
    case 'linear':
      // Linear falloff from 1 at distance=0 to 0 at distance=maxRadius
      return Math.max(0, 1 - dist / maxRadius);

    case 'inverse_square':
      // Inverse square falloff: 1 / (1 + d²/r²) where r normalizes the scale
      const normalizedDist = dist / (maxRadius || 50);
      return 1 / (1 + normalizedDist * normalizedDist);

    case 'exponential':
      // Exponential decay: e^(-rate * distance)
      return Math.exp(-rate * dist / (maxRadius || 50));

    default:
      return 0;
  }
}

/**
 * Get numeric strength from entity tags
 */
function getStrength(entity: HardState, strengthTag: string | undefined, defaultStrength: number): number {
  if (!strengthTag) return defaultStrength;

  const value = getTagValue(entity.tags, strengthTag);
  if (value === undefined) return defaultStrength;

  const parsed = typeof value === 'number' ? value : parseFloat(String(value));
  return isNaN(parsed) ? defaultStrength : parsed;
}

/**
 * Check if entity has valid coordinates
 */
function hasCoordinates(entity: HardState): entity is HardState & { coordinates: Point } {
  return (
    entity.coordinates !== undefined &&
    typeof entity.coordinates.x === 'number' &&
    typeof entity.coordinates.y === 'number'
  );
}

// =============================================================================
// SYSTEM FACTORY
// =============================================================================

/**
 * Create a SimulationSystem from a PlaneDiffusionConfig
 */
export function createPlaneDiffusionSystem(
  config: PlaneDiffusionConfig
): SimulationSystem {
  const maxRadius = config.diffusion.maxRadius ?? 50;

  return {
    id: config.id,
    name: config.name,

    apply: (graphView: TemplateGraphView, modifier: number = 1.0): SystemResult => {
      // Throttle check
      if (config.throttleChance !== undefined && config.throttleChance < 1.0) {
        if (Math.random() > config.throttleChance) {
          return {
            relationshipsAdded: [],
            entitiesModified: [],
            pressureChanges: {},
            description: `${config.name}: dormant`
          };
        }
      }

      const modifications: Array<{ id: string; changes: Partial<HardState> }> = [];

      // Find all entities of the target kind
      let entities = graphView.findEntities({ kind: config.entityKind });
      if (config.entityStatus) {
        entities = entities.filter(e => e.status === config.entityStatus);
      }

      // Filter to entities with valid coordinates
      const entitiesWithCoords = entities.filter(hasCoordinates);

      if (entitiesWithCoords.length === 0) {
        return {
          relationshipsAdded: [],
          entitiesModified: [],
          pressureChanges: {},
          description: `${config.name}: no entities with coordinates`
        };
      }

      // Identify sources and sinks
      const sources = entitiesWithCoords.filter(e => hasTag(e.tags, config.sources.tagFilter));
      const sinks = config.sinks
        ? entitiesWithCoords.filter(e => hasTag(e.tags, config.sinks!.tagFilter))
        : [];

      if (sources.length === 0) {
        return {
          relationshipsAdded: [],
          entitiesModified: [],
          pressureChanges: {},
          description: `${config.name}: no sources`
        };
      }

      // Compute field value at each entity position
      const fieldValues = new Map<string, number>();

      for (const entity of entitiesWithCoords) {
        let fieldValue = 0;

        // Sum contributions from sources
        for (const source of sources) {
          const dist = distance(entity.coordinates, source.coordinates);
          const strength = getStrength(source, config.sources.strengthTag, config.sources.defaultStrength);
          const contribution = strength * applyFalloff(dist, config.diffusion.falloff, config.diffusion.rate, maxRadius);
          fieldValue += contribution;
        }

        // Subtract contributions from sinks
        for (const sink of sinks) {
          const dist = distance(entity.coordinates, sink.coordinates);
          const strength = getStrength(sink, config.sinks!.strengthTag, config.sinks!.defaultStrength);
          const contribution = strength * applyFalloff(dist, config.diffusion.falloff, config.diffusion.rate, maxRadius);
          fieldValue -= contribution;
        }

        // Apply modifier and clamp to reasonable range
        fieldValue = Math.max(0, Math.min(2, fieldValue * modifier));
        fieldValues.set(entity.id, fieldValue);
      }

      // Normalize field values to 0-1 range for consistent thresholding
      const maxFieldValue = Math.max(...Array.from(fieldValues.values()), 0.001);
      const normalizedValues = new Map<string, number>();
      for (const [id, value] of fieldValues) {
        normalizedValues.set(id, value / maxFieldValue);
      }

      // Set output tags based on field values
      for (const entity of entitiesWithCoords) {
        const normalizedValue = normalizedValues.get(entity.id) ?? 0;
        const newTags: Record<string, boolean | string> = { ...entity.tags };
        let tagsChanged = false;

        // Remove old output tags and value tag
        for (const outputTag of config.outputTags) {
          if (hasTag(entity.tags, outputTag.tag)) {
            delete newTags[outputTag.tag];
            tagsChanged = true;
          }
        }
        if (config.valueTag) {
          // Remove old value tag (any key starting with valueTag:)
          for (const key of Object.keys(newTags)) {
            if (key.startsWith(`${config.valueTag}:`)) {
              delete newTags[key];
              tagsChanged = true;
            }
          }
        }

        // Add appropriate output tag based on thresholds
        for (const outputTag of config.outputTags) {
          const minOk = outputTag.minValue === undefined || normalizedValue >= outputTag.minValue;
          const maxOk = outputTag.maxValue === undefined || normalizedValue < outputTag.maxValue;

          if (minOk && maxOk) {
            newTags[outputTag.tag] = true;
            tagsChanged = true;
          }
        }

        // Optionally add raw value tag
        if (config.valueTag) {
          newTags[`${config.valueTag}:${normalizedValue.toFixed(3)}`] = true;
          tagsChanged = true;
        }

        if (tagsChanged) {
          // Enforce max tags limit
          const tagKeys = Object.keys(newTags);
          if (tagKeys.length > 10) {
            const excessCount = tagKeys.length - 10;
            for (let i = 0; i < excessCount; i++) {
              delete newTags[tagKeys[i]];
            }
          }

          modifications.push({
            id: entity.id,
            changes: { tags: newTags as Record<string, boolean> }
          });
        }
      }

      // Calculate pressure changes
      const pressureChanges = modifications.length > 0
        ? (config.pressureChanges ?? {})
        : {};

      return {
        relationshipsAdded: [],
        entitiesModified: modifications,
        pressureChanges,
        description: `${config.name}: ${sources.length} sources, ${sinks.length} sinks, ${modifications.length} entities updated`
      };
    }
  };
}
