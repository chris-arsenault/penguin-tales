/**
 * Semantic Encoder Service
 *
 * Encodes entity tags into coordinate positions based on semantic axis definitions.
 * Used by deriveCoordinates to place entities meaningfully in their kind's map.
 */

import { Point } from '../coordinates/types';
import {
  EntityKindAxes,
  TagSemanticWeights,
  SemanticEncodingResult,
  SemanticEncoderConfig,
} from '../coordinates/types';

// Track unconfigured tags to avoid repeated warnings
const warnedTags = new Set<string>();

/**
 * Semantic Encoder
 *
 * Converts entity tags into meaningful coordinate positions.
 */
export class SemanticEncoder {
  private axesByKind: Map<string, EntityKindAxes> = new Map();
  private weightsByTag: Map<string, TagSemanticWeights> = new Map();
  private warnOnUnconfigured: boolean;

  constructor(config: SemanticEncoderConfig) {
    // Index axes by entity kind
    for (const axes of config.axes) {
      this.axesByKind.set(axes.entityKind, axes);
    }

    // Index weights by tag
    for (const weight of config.tagWeights) {
      this.weightsByTag.set(weight.tag, weight);
    }

    this.warnOnUnconfigured = config.warnOnUnconfiguredTags;
  }

  /**
   * Check if encoder has configuration for an entity kind.
   */
  hasConfigForKind(entityKind: string): boolean {
    return this.axesByKind.has(entityKind);
  }

  /**
   * Get axis definitions for an entity kind.
   */
  getAxes(entityKind: string): EntityKindAxes | undefined {
    return this.axesByKind.get(entityKind);
  }

  /**
   * Encode tags into coordinates for an entity kind.
   *
   * @param entityKind - The entity kind (e.g., 'abilities', 'npc')
   * @param tags - Tags as KVP object or array
   * @returns Encoding result with coordinates and metadata
   */
  encode(
    entityKind: string,
    tags: Record<string, boolean> | string[]
  ): SemanticEncodingResult {
    const axes = this.axesByKind.get(entityKind);

    // No axis config for this kind - return center with warning
    if (!axes) {
      return {
        coordinates: { x: 50, y: 50, z: 50 },
        contributingTags: [],
        unconfiguredTags: [],
        hasConfiguredWeights: false,
      };
    }

    // Normalize tags to array
    const tagArray = Array.isArray(tags) ? tags : Object.keys(tags);

    const contributingTags: string[] = [];
    const unconfiguredTags: string[] = [];

    // Collect weights for each axis
    const xWeights: number[] = [];
    const yWeights: number[] = [];
    const zWeights: number[] = [];

    for (const tag of tagArray) {
      const tagWeight = this.weightsByTag.get(tag);

      if (!tagWeight || !tagWeight.weights[entityKind]) {
        // Tag has no configured weight for this entity kind
        unconfiguredTags.push(tag);

        // Warn once per tag
        if (this.warnOnUnconfigured && !warnedTags.has(`${entityKind}:${tag}`)) {
          warnedTags.add(`${entityKind}:${tag}`);
          console.warn(
            `⚠️  Semantic encoding: Tag "${tag}" has no configured weight for ${entityKind}. ` +
            `Add weight in semanticAxes.ts or it will default to 50.`
          );
        }

        // Use default of 50 for unconfigured tags
        xWeights.push(50);
        yWeights.push(50);
        zWeights.push(50);
      } else {
        contributingTags.push(tag);
        const kindWeights = tagWeight.weights[entityKind];

        // Get weight for each axis (default 50 if axis not specified)
        xWeights.push(kindWeights[axes.x.name] ?? 50);
        yWeights.push(kindWeights[axes.y.name] ?? 50);
        zWeights.push(kindWeights[axes.z.name] ?? 50);
      }
    }

    // Calculate average position on each axis
    const avgX = xWeights.length > 0
      ? xWeights.reduce((a, b) => a + b, 0) / xWeights.length
      : 50;
    const avgY = yWeights.length > 0
      ? yWeights.reduce((a, b) => a + b, 0) / yWeights.length
      : 50;
    const avgZ = zWeights.length > 0
      ? zWeights.reduce((a, b) => a + b, 0) / zWeights.length
      : 50;

    // Add small jitter to prevent exact overlaps (±2 units)
    const jitter = () => (Math.random() - 0.5) * 4;

    return {
      coordinates: {
        x: Math.max(0, Math.min(100, avgX + jitter())),
        y: Math.max(0, Math.min(100, avgY + jitter())),
        z: Math.max(0, Math.min(100, avgZ + jitter())),
      },
      contributingTags,
      unconfiguredTags,
      hasConfiguredWeights: contributingTags.length > 0,
    };
  }

  /**
   * Encode with reference entities (for relative positioning).
   *
   * Blends semantic encoding with reference entity centroid.
   *
   * @param entityKind - The entity kind
   * @param tags - Tags for the new entity
   * @param referenceCoords - Centroid of reference entities
   * @param blendFactor - How much to weight semantic vs reference (0-1, default 0.7 semantic)
   */
  encodeWithReference(
    entityKind: string,
    tags: Record<string, boolean> | string[],
    referenceCoords: Point,
    blendFactor: number = 0.7
  ): SemanticEncodingResult {
    const semanticResult = this.encode(entityKind, tags);

    // If no configured weights, lean more on reference
    const effectiveBlend = semanticResult.hasConfiguredWeights
      ? blendFactor
      : 0.3;  // Only 30% semantic if no configured tags

    // Blend semantic coordinates with reference centroid
    const blendedCoords = {
      x: semanticResult.coordinates.x * effectiveBlend +
         referenceCoords.x * (1 - effectiveBlend),
      y: semanticResult.coordinates.y * effectiveBlend +
         referenceCoords.y * (1 - effectiveBlend),
      z: semanticResult.coordinates.z * effectiveBlend +
         referenceCoords.z * (1 - effectiveBlend),
    };

    // Add jitter
    const jitter = () => (Math.random() - 0.5) * 4;

    return {
      coordinates: {
        x: Math.max(0, Math.min(100, blendedCoords.x + jitter())),
        y: Math.max(0, Math.min(100, blendedCoords.y + jitter())),
        z: Math.max(0, Math.min(100, blendedCoords.z + jitter())),
      },
      contributingTags: semanticResult.contributingTags,
      unconfiguredTags: semanticResult.unconfiguredTags,
      hasConfiguredWeights: semanticResult.hasConfiguredWeights,
    };
  }

  /**
   * Get all unconfigured tags encountered so far.
   * Useful for generating configuration.
   */
  static getWarnedTags(): string[] {
    return Array.from(warnedTags);
  }

  /**
   * Clear warned tags (for testing).
   */
  static clearWarnedTags(): void {
    warnedTags.clear();
  }
}

/**
 * Create a semantic encoder from configuration.
 */
export function createSemanticEncoder(config: SemanticEncoderConfig): SemanticEncoder {
  return new SemanticEncoder(config);
}
