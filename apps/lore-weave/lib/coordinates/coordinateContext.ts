/**
 * Coordinate Context
 *
 * Centralized coordinate services with culture as first-class input.
 * Works directly with canonry's entityKinds[] and cultures[] arrays.
 */

import type { Point } from './types';

// =============================================================================
// CULTURE CONFIGURATION TYPES
// =============================================================================

/**
 * Axis biases for a single entity kind.
 */
export interface KindAxisBiases {
  x: number;  // 0-100
  y: number;  // 0-100
  z: number;  // 0-100
}

/**
 * Context passed to placement operations.
 * Culture data flows through this object to bias sampling and encoding.
 */
export interface PlacementContext {
  /** Culture driving placement biases */
  cultureId?: string;

  /** Entity kind being placed (needed to look up kind-specific biases/regions) */
  entityKind?: string;

  /** Culture's axis biases for this entity kind */
  axisBiases?: KindAxisBiases;

  /** Region IDs to bias placement toward (derived from regions with matching culture) */
  seedRegionIds?: string[];

  /** Reference entity for proximity-based placement */
  referenceEntity?: {
    id: string;
    coordinates: Point;
  };
}

/**
 * Result of a culture-aware placement operation.
 */
export interface PlacementResult {
  /** Whether placement succeeded */
  success: boolean;

  /** Placed coordinates (if successful) */
  coordinates?: Point;

  /** Region ID entity was placed in (null if not in any region) */
  regionId?: string | null;

  /** All region IDs containing the point */
  allRegionIds?: string[];

  /** Tags derived from region + axis position (as Record for backward compatibility) */
  derivedTags?: Record<string, string | boolean>;

  /**
   * Tags derived from placement as an array (easier to merge into entity.tags).
   * Includes tags from:
   * - Region tags (from regions containing the placed point)
   * - Axis tags (based on coordinate position relative to axis thresholds)
   */
  placementTags?: string[];

  /** Culture ID used for placement */
  cultureId?: string;

  /** Whether an emergent region was created */
  emergentRegionCreated?: {
    id: string;
    label: string;
  };

  /** Failure reason if unsuccessful */
  failureReason?: string;
}

// =============================================================================
// SEMANTIC PLANE (per entity kind)
// =============================================================================

/**
 * Semantic plane definition for an entity kind.
 */
export interface SemanticPlane {
  axes: {
    x: { name: string; lowTag: string; highTag: string };
    y: { name: string; lowTag: string; highTag: string };
    z?: { name: string; lowTag: string; highTag: string };
  };
  regions: import('./types').Region[];
}

/**
 * Entity kind definition from canonry.
 * Contains id and optional semanticPlane.
 */
export interface EntityKindConfig {
  id: string;
  name?: string;
  semanticPlane?: SemanticPlane;
}

/**
 * Culture definition from canonry.
 * Contains id and axisBiases keyed by entity kind.
 */
export interface CultureConfig {
  id: string;
  name?: string;
  axisBiases?: {
    [entityKindId: string]: KindAxisBiases;
  };
  homeRegions?: {
    [entityKindId: string]: string[];
  };
}

// =============================================================================
// COORDINATE CONTEXT CONFIGURATION
// =============================================================================

/**
 * Configuration for CoordinateContext.
 * Accepts canonry's array-based format directly.
 */
export interface CoordinateContextConfig {
  /** Entity kinds array from canonry - each may have a semanticPlane */
  entityKinds: EntityKindConfig[];

  /** Cultures array from canonry - each has axisBiases keyed by entity kind */
  cultures: CultureConfig[];
}

// =============================================================================
// EMERGENT REGION DEFAULTS
// =============================================================================

const EMERGENT_DEFAULTS = {
  radius: 10,
  minDistanceFromExisting: 5,
  maxAttempts: 50
};

// =============================================================================
// COORDINATE CONTEXT
// =============================================================================

/**
 * CoordinateContext - Centralized coordinate services with culture support.
 *
 * Works directly with canonry's entityKinds[] and cultures[] arrays.
 * Derives seed regions by finding regions where region.culture matches the culture ID.
 * Supports emergent region creation during simulation.
 */
export class CoordinateContext {
  /** Entity kinds from canonry (stored directly, no transformation) */
  private readonly entityKinds: EntityKindConfig[];

  /** Cultures from canonry (stored directly, no transformation) */
  private readonly cultures: CultureConfig[];

  /** Mutable region storage per entity kind (includes both seed and emergent regions) */
  private regions: { [entityKind: string]: import('./types').Region[] } = {};

  /** Counter for generating unique emergent region IDs */
  private emergentRegionCounter = 0;

  constructor(config: CoordinateContextConfig) {
    this.entityKinds = config.entityKinds || [];
    this.cultures = config.cultures || [];

    // Initialize mutable region storage from entity kinds' semantic planes
    for (const entityKind of this.entityKinds) {
      if (entityKind.semanticPlane?.regions) {
        this.regions[entityKind.id] = [...entityKind.semanticPlane.regions];
      }
    }
  }

  // ===========================================================================
  // SEMANTIC DATA ACCESS
  // ===========================================================================

  /**
   * Get semantic plane for an entity kind.
   */
  getSemanticPlane(entityKind: string): SemanticPlane | undefined {
    const kind = this.entityKinds.find(k => k.id === entityKind);
    return kind?.semanticPlane;
  }

  /**
   * Get all configured entity kinds (those with semantic planes).
   */
  getConfiguredKinds(): string[] {
    return this.entityKinds
      .filter(k => k.semanticPlane)
      .map(k => k.id);
  }

  /**
   * Check if a kind has semantic data configured.
   */
  hasKindMap(kind: string): boolean {
    return this.entityKinds.some(k => k.id === kind && k.semanticPlane);
  }

  /**
   * Get regions for an entity kind (includes both seed and emergent regions).
   */
  getRegions(entityKind: string): import('./types').Region[] {
    // Initialize kind if not present
    if (!(entityKind in this.regions)) {
      this.regions[entityKind] = [];
    }
    return this.regions[entityKind];
  }

  /**
   * Get a specific region by ID within an entity kind.
   */
  getRegion(entityKind: string, regionId: string): import('./types').Region | undefined {
    return this.getRegions(entityKind).find(r => r.id === regionId);
  }

  // ===========================================================================
  // CULTURE QUERIES
  // ===========================================================================

  /**
   * Get culture configuration by ID.
   */
  getCultureConfig(cultureId: string): CultureConfig | undefined {
    return this.cultures.find(c => c.id === cultureId);
  }

  /**
   * Check if a culture is configured.
   */
  hasCulture(cultureId: string): boolean {
    return this.cultures.some(c => c.id === cultureId);
  }

  /**
   * Get all configured culture IDs.
   */
  getCultureIds(): string[] {
    return this.cultures.map(c => c.id);
  }

  /**
   * Get seed region IDs for a culture within an entity kind.
   * Derived from regions where region.culture === cultureId.
   */
  getSeedRegionIds(cultureId: string, entityKind: string): string[] {
    const regions = this.getRegions(entityKind);
    return regions
      .filter(r => r.culture === cultureId)
      .map(r => r.id);
  }

  /**
   * Get axis biases for a culture and entity kind.
   */
  getAxisBiases(cultureId: string, entityKind: string): KindAxisBiases | undefined {
    const culture = this.cultures.find(c => c.id === cultureId);
    return culture?.axisBiases?.[entityKind];
  }

  /**
   * Build PlacementContext from culture ID and entity kind.
   */
  buildPlacementContext(cultureId: string, entityKind: string): PlacementContext {
    return {
      cultureId,
      entityKind,
      axisBiases: this.getAxisBiases(cultureId, entityKind),
      seedRegionIds: this.getSeedRegionIds(cultureId, entityKind)
    };
  }

  // ===========================================================================
  // EMERGENT REGION CREATION
  // ===========================================================================

  /**
   * Create an emergent region near a point.
   *
   * Uses static defaults for radius and minimum distance from existing regions.
   * Always enabled - emergent regions are created whenever placement occurs
   * outside existing regions.
   *
   * @param entityKind - Entity kind for the region
   * @param nearPoint - Point to create region near
   * @param label - Human-readable label for the region
   * @param description - Narrative description
   * @param tick - Current simulation tick
   * @param createdBy - Optional entity ID that triggered creation
   * @returns Result with created region or failure reason
   */
  createEmergentRegion(
    entityKind: string,
    nearPoint: Point,
    label: string,
    description: string,
    tick: number,
    createdBy?: string
  ): import('./types').EmergentRegionResult {
    const regions = this.getRegions(entityKind);

    // Check if point is too close to existing regions
    for (const region of regions) {
      if (region.bounds.shape === 'circle') {
        const { center, radius } = region.bounds;
        const dx = nearPoint.x - center.x;
        const dy = nearPoint.y - center.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Too close if within region or within min distance of edge
        if (distance < radius + EMERGENT_DEFAULTS.minDistanceFromExisting) {
          return {
            success: false,
            failureReason: `Point too close to existing region "${region.label}"`
          };
        }
      }
    }

    // Create the emergent region
    this.emergentRegionCounter++;
    const regionId = `emergent_${entityKind}_${this.emergentRegionCounter}`;

    const newRegion: import('./types').Region = {
      id: regionId,
      label,
      description,
      bounds: {
        shape: 'circle',
        center: { x: nearPoint.x, y: nearPoint.y },
        radius: EMERGENT_DEFAULTS.radius
      },
      emergent: true,
      createdAt: tick,
      createdBy
    };

    // Add to mutable region storage
    regions.push(newRegion);

    return {
      success: true,
      region: newRegion
    };
  }

  /**
   * Check if a point is inside any existing region for an entity kind.
   */
  isPointInAnyRegion(entityKind: string, point: Point): boolean {
    const regions = this.getRegions(entityKind);
    return regions.some(r => this.pointInRegion(point, r));
  }

  // ===========================================================================
  // REGION SAMPLING
  // ===========================================================================

  /**
   * Sample a point within a specific region.
   *
   * @param entityKind - Entity kind whose regions to use
   * @param regionId - Region to sample within
   * @param existingPoints - Points to avoid
   * @param minDistance - Minimum distance from existing points
   * @returns Point or null if no valid point found
   */
  sampleInRegion(
    entityKind: string,
    regionId: string,
    existingPoints: Point[] = [],
    minDistance: number = 5
  ): Point | null {
    const region = this.getRegion(entityKind, regionId);
    if (!region) return null;
    return this.sampleCircleRegion(region, existingPoints, minDistance);
  }

  /**
   * Sample a point near a reference point.
   *
   * @param referencePoint - Point to place near
   * @param existingPoints - Points to avoid
   * @param minDistance - Minimum distance from existing points
   * @param maxSearchRadius - Maximum distance from reference
   * @returns Point or null if no valid point found
   */
  sampleNearPoint(
    referencePoint: Point,
    existingPoints: Point[] = [],
    minDistance: number = 5,
    maxSearchRadius: number = 20
  ): Point | null {
    const maxAttempts = 50;

    for (let i = 0; i < maxAttempts; i++) {
      // Sample in a ring around the reference point
      const r = minDistance + Math.random() * (maxSearchRadius - minDistance);
      const theta = Math.random() * 2 * Math.PI;
      const point: Point = {
        x: referencePoint.x + r * Math.cos(theta),
        y: referencePoint.y + r * Math.sin(theta),
        z: referencePoint.z ?? 50
      };

      // Clamp to bounds
      point.x = Math.max(0, Math.min(100, point.x));
      point.y = Math.max(0, Math.min(100, point.y));

      if (this.isValidPlacement(point, existingPoints, minDistance)) {
        return point;
      }
    }
    return null;
  }

  // ===========================================================================
  // SPARSE AREA PLACEMENT
  // ===========================================================================

  /**
   * Find a sparse (unoccupied) area on the semantic plane.
   *
   * This is used for templates that need to place entities far from existing
   * same-kind entities, like colony founding where new colonies should spread
   * across the plane rather than cluster.
   *
   * @param options - Configuration for sparse area search
   * @returns Result with coordinates of the sparsest valid area found
   */
  findSparseArea(
    options: import('./types').SparseAreaOptions
  ): import('./types').SparseAreaResult {
    const { existingPositions, minDistanceFromEntities, preferPeriphery, maxAttempts = 50 } = options;

    // If no existing positions, any point is valid
    if (existingPositions.length === 0) {
      const point = preferPeriphery
        ? this.generatePeripheryBiasedPoint()
        : { x: Math.random() * 100, y: Math.random() * 100, z: 50 };
      return {
        success: true,
        coordinates: point,
        minDistanceToEntity: 100 // Maximum possible distance
      };
    }

    // Sample candidate points and score them by distance from existing entities
    const candidates: Array<{ point: Point; score: number }> = [];

    for (let i = 0; i < maxAttempts; i++) {
      // Generate candidate point
      const point = preferPeriphery
        ? this.generatePeripheryBiasedPoint()
        : { x: Math.random() * 100, y: Math.random() * 100, z: 50 };

      // Calculate minimum distance to any existing entity
      const minDist = this.calculateMinDistanceToPoints(point, existingPositions);

      // Only consider points that meet minimum distance requirement
      if (minDist >= minDistanceFromEntities) {
        candidates.push({ point, score: minDist });
      }
    }

    if (candidates.length === 0) {
      return {
        success: false,
        failureReason: `No sparse area found after ${maxAttempts} attempts. ` +
          `All sampled points were within ${minDistanceFromEntities} units of existing entities.`
      };
    }

    // Return the point with highest score (furthest from existing entities)
    candidates.sort((a, b) => b.score - a.score);
    const best = candidates[0];

    return {
      success: true,
      coordinates: best.point,
      minDistanceToEntity: best.score
    };
  }

  /**
   * Generate a point biased toward the periphery of the coordinate space.
   * Uses a ring sampling strategy that favors edges over center.
   */
  private generatePeripheryBiasedPoint(): Point {
    // Sample angle uniformly
    const theta = Math.random() * 2 * Math.PI;

    // Bias radius toward edges (inverse of center-biased sqrt distribution)
    // This makes ~70% of points fall in the outer half of the space
    const r = 50 * (1 - Math.sqrt(1 - Math.random()));

    // Convert polar to cartesian, centered at (50, 50)
    const x = 50 + r * Math.cos(theta);
    const y = 50 + r * Math.sin(theta);

    return {
      x: Math.max(0, Math.min(100, x)),
      y: Math.max(0, Math.min(100, y)),
      z: 50
    };
  }

  /**
   * Calculate minimum Euclidean distance from a point to a set of existing points.
   */
  private calculateMinDistanceToPoints(point: Point, existingPoints: Point[]): number {
    if (existingPoints.length === 0) return Infinity;

    let minDist = Infinity;
    for (const existing of existingPoints) {
      const dx = point.x - existing.x;
      const dy = point.y - existing.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < minDist) {
        minDist = dist;
      }
    }
    return minDist;
  }

  // ===========================================================================
  // CULTURE-AWARE PLACEMENT
  // ===========================================================================

  /**
   * Sample a point within a region (circle bounds).
   */
  private sampleCircleRegion(
    region: import('./types').Region,
    existingPoints: Point[],
    minDistance: number
  ): Point | null {
    if (region.bounds.shape !== 'circle') return null;

    const { center, radius } = region.bounds;
    const maxAttempts = 50;

    for (let i = 0; i < maxAttempts; i++) {
      // Sample with center bias
      const r = radius * Math.sqrt(Math.random()) * 0.8;
      const theta = Math.random() * 2 * Math.PI;
      const point: Point = {
        x: center.x + r * Math.cos(theta),
        y: center.y + r * Math.sin(theta),
        z: 50 // default z
      };

      if (this.isValidPlacement(point, existingPoints, minDistance)) {
        return point;
      }
    }
    return null;
  }

  /**
   * Sample a point biased toward culture's seed regions or near a reference entity.
   */
  sampleWithCulture(
    entityKind: string,
    context: PlacementContext,
    existingPoints: Point[] = [],
    minDistance: number = 5
  ): Point | null {
    // If reference entity provided, sample near it
    if (context.referenceEntity?.coordinates) {
      const point = this.sampleNearPoint(
        context.referenceEntity.coordinates,
        existingPoints,
        minDistance,
        minDistance * 4  // maxSearchRadius
      );
      if (point) return point;
    }

    const regions = this.getRegions(entityKind);

    // Try seed regions first (regions belonging to this culture)
    if (context.seedRegionIds && context.seedRegionIds.length > 0) {
      const shuffledSeeds = [...context.seedRegionIds].sort(() => Math.random() - 0.5);

      for (const regionId of shuffledSeeds) {
        const region = regions.find(r => r.id === regionId);
        if (!region) continue;

        const point = this.sampleCircleRegion(region, existingPoints, minDistance);
        if (point) return point;
      }
    }

    // Try any region
    for (const region of regions.sort(() => Math.random() - 0.5)) {
      const point = this.sampleCircleRegion(region, existingPoints, minDistance);
      if (point) return point;
    }

    // Fallback: random point with culture bias applied
    const biases = context.axisBiases || { x: 50, y: 50, z: 50 };
    return {
      x: biases.x + (Math.random() - 0.5) * 30,
      y: biases.y + (Math.random() - 0.5) * 30,
      z: biases.z
    };
  }

  /**
   * Derive tags from entity placement based on:
   * 1. Region tags - tags associated with the region the entity is placed in
   * 2. Axis tags - tags derived from position on semantic axes (low/high thresholds)
   *
   * @param entityKind - Entity kind to get semantic plane from
   * @param point - Coordinates of the placed entity
   * @param containingRegions - Regions containing the point
   * @returns Array of derived tag strings
   */
  deriveTagsFromPlacement(
    entityKind: string,
    point: Point,
    containingRegions: import('./types').Region[]
  ): string[] {
    const tags: string[] = [];
    const seenTags = new Set<string>();

    const addTag = (tag: string) => {
      if (tag && !seenTags.has(tag)) {
        seenTags.add(tag);
        tags.push(tag);
      }
    };

    // 1. Add tags from containing regions
    for (const region of containingRegions) {
      if (region.tags) {
        for (const tag of region.tags) {
          addTag(tag);
        }
      }
    }

    // 2. Derive tags from axis positions
    const semanticPlane = this.getSemanticPlane(entityKind);
    if (semanticPlane?.axes) {
      const { axes } = semanticPlane;

      // X axis: low tag if < 33, high tag if > 66
      if (axes.x) {
        if (point.x < 33) addTag(axes.x.lowTag);
        else if (point.x > 66) addTag(axes.x.highTag);
      }

      // Y axis: low tag if < 33, high tag if > 66
      if (axes.y) {
        if (point.y < 33) addTag(axes.y.lowTag);
        else if (point.y > 66) addTag(axes.y.highTag);
      }

      // Z axis: low tag if < 33, high tag if > 66
      if (axes.z && point.z !== undefined) {
        if (point.z < 33) addTag(axes.z.lowTag);
        else if (point.z > 66) addTag(axes.z.highTag);
      }
    }

    return tags;
  }

  /**
   * Place an entity with culture context.
   */
  placeWithCulture(
    entityKind: string,
    _entityId: string,
    _tick: number,
    context: PlacementContext,
    existingPoints: Point[] = [],
    minDistance: number = 5
  ): PlacementResult {
    const point = this.sampleWithCulture(entityKind, context, existingPoints, minDistance);
    if (!point) {
      return {
        success: false,
        failureReason: 'Could not find valid placement point'
      };
    }

    // Find which regions contain this point
    const regions = this.getRegions(entityKind);
    const containingRegions = regions.filter(r => this.pointInRegion(point, r));
    const containingRegion = containingRegions[0];

    // Derive tags from placement (region tags + axis-based tags)
    const derivedTagList = this.deriveTagsFromPlacement(entityKind, point, containingRegions);

    // Build derivedTags object (for backward compatibility, includes culture as a special key)
    const derivedTags: Record<string, string | boolean> = {};
    if (context.cultureId) {
      derivedTags.culture = context.cultureId;
    }
    // Add derived tags as boolean flags
    for (const tag of derivedTagList) {
      derivedTags[tag] = true;
    }

    return {
      success: true,
      coordinates: point,
      regionId: containingRegion?.id ?? null,
      allRegionIds: containingRegions.map(r => r.id),
      derivedTags,
      placementTags: derivedTagList,
      cultureId: context.cultureId
    };
  }

  /**
   * Check if a point is inside a region.
   */
  private pointInRegion(point: Point, region: import('./types').Region): boolean {
    if (region.bounds.shape === 'circle') {
      const { center, radius } = region.bounds;
      const dx = point.x - center.x;
      const dy = point.y - center.y;
      return Math.sqrt(dx * dx + dy * dy) <= radius;
    }
    return false; // Only circle supported for now
  }

  /**
   * Check if a point maintains minimum distance from existing points.
   */
  private isValidPlacement(
    point: Point,
    existing: Point[],
    minDistance: number
  ): boolean {
    for (const other of existing) {
      const dx = point.x - other.x;
      const dy = point.y - other.y;
      if (Math.sqrt(dx * dx + dy * dy) < minDistance) {
        return false;
      }
    }
    return true;
  }

  // ===========================================================================
  // SERIALIZATION
  // ===========================================================================

  /**
   * Export coordinate state for world persistence.
   * Returns the original canonry format plus emergent regions.
   */
  export(): {
    entityKinds: EntityKindConfig[];
    cultures: CultureConfig[];
    regions: { [entityKind: string]: import('./types').Region[] };
  } {
    return {
      entityKinds: this.entityKinds,
      cultures: this.cultures,
      regions: this.regions
    };
  }

  /**
   * Import coordinate state from a previously exported world.
   * Restores emergent regions.
   */
  import(state: { regions?: { [entityKind: string]: import('./types').Region[] } }): void {
    if (state.regions) {
      for (const [kind, regions] of Object.entries(state.regions)) {
        this.regions[kind] = [...regions];
      }
      // Update counter based on imported regions
      const maxId = Object.values(this.regions)
        .flat()
        .filter(r => r.emergent)
        .map(r => {
          const match = r.id.match(/emergent_\w+_(\d+)/);
          return match ? parseInt(match[1], 10) : 0;
        })
        .reduce((max, n) => Math.max(max, n), 0);
      this.emergentRegionCounter = maxId;
    }
  }

  // ===========================================================================
  // STATISTICS
  // ===========================================================================

  /**
   * Get statistics about coordinate system state.
   */
  getStats(): {
    cultures: number;
    kinds: number;
    totalRegions: number;
    emergentRegions: number;
  } {
    let totalRegions = 0;
    let emergentRegions = 0;

    for (const kind of Object.keys(this.regions)) {
      const kindRegions = this.regions[kind] || [];
      totalRegions += kindRegions.length;
      emergentRegions += kindRegions.filter(r => r.emergent).length;
    }

    return {
      cultures: this.cultures.length,
      kinds: this.entityKinds.filter(k => k.semanticPlane).length,
      totalRegions,
      emergentRegions
    };
  }
}

// =============================================================================
// FACTORY FUNCTION
// =============================================================================

/**
 * Create a CoordinateContext from configuration.
 */
export function createCoordinateContext(
  config: CoordinateContextConfig
): CoordinateContext {
  return new CoordinateContext(config);
}
