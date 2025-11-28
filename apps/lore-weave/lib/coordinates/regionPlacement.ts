/**
 * Region-Based Placement Service
 *
 * Simplified placement that works with the RegionMapper.
 * Places entities in regions with Poisson-like spacing.
 */

import type { Point, Region, SampleRegionOptions } from '../types/regions.js';
import type { RegionMapper } from './regionMapper.js';
import { SPACE_BOUNDS } from '../types/regions.js';

/**
 * Options for placing an entity.
 */
export interface PlacementOptions {
  /** Target region ID (if null, uses global space) */
  regionId?: string;

  /** Existing points to maintain distance from */
  existingPoints?: Point[];

  /** Minimum distance from existing points */
  minDistance?: number;

  /** Prefer center of region vs edges */
  centerBias?: number;

  /** Specific z value */
  z?: number;

  /** Maximum placement attempts */
  maxAttempts?: number;
}

/**
 * Result of a placement operation.
 */
export interface PlacementResult {
  success: boolean;
  point?: Point;
  regionId?: string;
  failureReason?: string;
  attempts?: number;
}

/**
 * Options for batch placement.
 */
export interface BatchPlacementOptions extends PlacementOptions {
  /** Number of entities to place */
  count: number;

  /** Whether to create emergent region if main region is full */
  allowEmergentExpansion?: boolean;

  /** Label for emergent region (if created) */
  emergentRegionLabel?: string;

  /** Current tick (for emergent region creation) */
  tick?: number;
}

/**
 * Result of batch placement.
 */
export interface BatchPlacementResult {
  placed: Array<{ point: Point; regionId: string }>;
  failed: number;
  emergentRegionsCreated: string[];
}

/**
 * Region Placement Service
 */
export class RegionPlacementService {
  constructor(private regionMapper: RegionMapper) {}

  /**
   * Place a single entity.
   */
  place(options: PlacementOptions = {}): PlacementResult {
    const {
      regionId,
      existingPoints = [],
      minDistance = 5,
      centerBias = 0,
      z,
      maxAttempts = 100
    } = options;

    // If region specified, sample within it
    if (regionId) {
      const region = this.regionMapper.getRegion(regionId);
      if (!region) {
        return { success: false, failureReason: `Region not found: ${regionId}` };
      }

      for (let i = 0; i < maxAttempts; i++) {
        const point = this.regionMapper.sampleRegion(regionId, {
          avoid: existingPoints,
          minDistance,
          centerBias,
          z
        });

        if (point && this.isValidPlacement(point, existingPoints, minDistance)) {
          return { success: true, point, regionId, attempts: i + 1 };
        }
      }

      return {
        success: false,
        failureReason: `Could not find valid placement in region ${regionId}`,
        attempts: maxAttempts
      };
    }

    // Global placement (no specific region)
    for (let i = 0; i < maxAttempts; i++) {
      const point = this.sampleGlobalSpace(z);

      if (this.isValidPlacement(point, existingPoints, minDistance)) {
        const lookup = this.regionMapper.lookup(point);
        return {
          success: true,
          point,
          regionId: lookup.primary?.id,
          attempts: i + 1
        };
      }
    }

    return {
      success: false,
      failureReason: 'Could not find valid global placement',
      attempts: maxAttempts
    };
  }

  /**
   * Place multiple entities, with optional emergent expansion.
   */
  placeBatch(options: BatchPlacementOptions): BatchPlacementResult {
    const {
      count,
      regionId,
      allowEmergentExpansion = false,
      emergentRegionLabel,
      tick = 0,
      ...placementOptions
    } = options;

    const placed: Array<{ point: Point; regionId: string }> = [];
    const emergentRegionsCreated: string[] = [];
    let failed = 0;

    // Track placed points for spacing
    const allPoints = [...(placementOptions.existingPoints ?? [])];

    // Current target region (may change if expansion happens)
    let currentRegionId = regionId;
    let consecutiveFailures = 0;
    const maxConsecutiveFailures = 10;

    for (let i = 0; i < count; i++) {
      const result = this.place({
        ...placementOptions,
        regionId: currentRegionId,
        existingPoints: allPoints
      });

      if (result.success && result.point) {
        placed.push({
          point: result.point,
          regionId: result.regionId ?? 'global'
        });
        allPoints.push(result.point);
        consecutiveFailures = 0;
      } else {
        consecutiveFailures++;

        // Try emergent expansion
        if (allowEmergentExpansion && consecutiveFailures >= maxConsecutiveFailures) {
          const nearPoint = allPoints.length > 0
            ? allPoints[allPoints.length - 1]
            : { x: 50, y: 50, z: 50 };

          const emergentResult = this.regionMapper.createEmergentRegion(
            nearPoint,
            emergentRegionLabel ?? `Expansion ${emergentRegionsCreated.length + 1}`,
            `Emergent expansion from ${currentRegionId ?? 'global'}`,
            tick
          );

          if (emergentResult.success && emergentResult.region) {
            currentRegionId = emergentResult.region.id;
            emergentRegionsCreated.push(emergentResult.region.id);
            consecutiveFailures = 0;

            // Retry this placement in new region
            const retry = this.place({
              ...placementOptions,
              regionId: currentRegionId,
              existingPoints: allPoints
            });

            if (retry.success && retry.point) {
              placed.push({
                point: retry.point,
                regionId: retry.regionId ?? 'global'
              });
              allPoints.push(retry.point);
            } else {
              failed++;
            }
          } else {
            failed++;
          }
        } else {
          failed++;
        }
      }
    }

    return { placed, failed, emergentRegionsCreated };
  }

  /**
   * Find nearest available position to a reference point.
   */
  placeNear(
    referencePoint: Point,
    existingPoints: Point[],
    minDistance: number,
    maxSearchRadius: number = 30
  ): PlacementResult {
    const maxAttempts = 100;

    for (let i = 0; i < maxAttempts; i++) {
      // Gradually expand search radius, starting at minDistance to avoid exact overlap
      // Range: [minDistance, maxSearchRadius]
      const searchRadius = minDistance + (i / maxAttempts) * (maxSearchRadius - minDistance);
      const angle = Math.random() * 2 * Math.PI;

      const point: Point = {
        x: Math.max(SPACE_BOUNDS.min, Math.min(SPACE_BOUNDS.max,
          referencePoint.x + searchRadius * Math.cos(angle))),
        y: Math.max(SPACE_BOUNDS.min, Math.min(SPACE_BOUNDS.max,
          referencePoint.y + searchRadius * Math.sin(angle))),
        z: referencePoint.z
      };

      if (this.isValidPlacement(point, existingPoints, minDistance)) {
        const lookup = this.regionMapper.lookup(point);
        return {
          success: true,
          point,
          regionId: lookup.primary?.id,
          attempts: i + 1
        };
      }
    }

    return { success: false, failureReason: 'Could not find valid placement near reference', attempts: maxAttempts };
  }

  /**
   * Place in the same region as a reference entity.
   */
  placeInSameRegion(
    referencePoint: Point,
    existingPoints: Point[],
    minDistance: number
  ): PlacementResult {
    const lookup = this.regionMapper.lookup(referencePoint);

    if (lookup.primary) {
      return this.place({
        regionId: lookup.primary.id,
        existingPoints,
        minDistance
      });
    }

    // No region - place nearby
    return this.placeNear(referencePoint, existingPoints, minDistance);
  }

  // ==========================================================================
  // HELPERS
  // ==========================================================================

  /**
   * Check if a point is valid (maintains minimum distance from existing).
   */
  private isValidPlacement(
    point: Point,
    existing: Point[],
    minDistance: number
  ): boolean {
    for (const other of existing) {
      if (this.regionMapper.distance(point, other) < minDistance) {
        return false;
      }
    }
    return true;
  }

  /**
   * Sample a random point in global space.
   */
  private sampleGlobalSpace(z?: number): Point {
    return {
      x: SPACE_BOUNDS.min + Math.random() * (SPACE_BOUNDS.max - SPACE_BOUNDS.min),
      y: SPACE_BOUNDS.min + Math.random() * (SPACE_BOUNDS.max - SPACE_BOUNDS.min),
      z: z ?? (SPACE_BOUNDS.min + Math.random() * (SPACE_BOUNDS.max - SPACE_BOUNDS.min))
    };
  }

  /**
   * Calculate density of points in a region.
   */
  getRegionDensity(regionId: string, points: Point[]): number {
    const region = this.regionMapper.getRegion(regionId);
    if (!region) return 0;

    const pointsInRegion = points.filter(p =>
      this.regionMapper.containsPoint(region, p)
    );

    const area = this.getRegionArea(region);
    return area > 0 ? pointsInRegion.length / area : 0;
  }

  /**
   * Check if a region is "saturated" (above density threshold).
   */
  isRegionSaturated(
    regionId: string,
    points: Point[],
    threshold: number = 0.01  // entities per unit area
  ): boolean {
    return this.getRegionDensity(regionId, points) >= threshold;
  }

  private getRegionArea(region: Region): number {
    const bounds = region.bounds;
    switch (bounds.shape) {
      case 'circle':
        return Math.PI * bounds.radius * bounds.radius;
      case 'rect':
        return (bounds.x2 - bounds.x1) * (bounds.y2 - bounds.y1);
      case 'polygon': {
        let area = 0;
        const n = bounds.points.length;
        for (let i = 0; i < n; i++) {
          const j = (i + 1) % n;
          area += bounds.points[i].x * bounds.points[j].y;
          area -= bounds.points[j].x * bounds.points[i].y;
        }
        return Math.abs(area) / 2;
      }
    }
  }
}
