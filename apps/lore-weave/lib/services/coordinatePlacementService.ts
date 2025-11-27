/**
 * Coordinate Placement Service
 *
 * Framework service for coordinate-based entity placement and spatial queries.
 * Provides algorithms for placing new entities and finding nearby entities.
 */

import type { DomainSchema } from '../types/domainSchema';
import type { HardState } from '../types/worldTypes';
import type { Graph } from '../types/engine';
import { hasTag } from '../utils/helpers';
import type {
  Coordinate,
  CoordinateSpaceId,
  CoordinateSpaceDefinition,
  PlaceNearOptions,
  PlaceWithinOptions,
  PlaceAvoidingOptions,
  FindNearestOptions,
  CoordinateBounds,
  NearestResult,
  PlacementResult,
  AxisValue
} from '../types/coordinates';
import { CoordinateService } from './coordinateService';

/**
 * CoordinatePlacementService provides placement algorithms and spatial queries
 * for entities in coordinate spaces.
 */
export class CoordinatePlacementService {
  private coordinateService: CoordinateService;

  constructor(private domain: DomainSchema) {
    this.coordinateService = new CoordinateService(domain);
  }

  /**
   * Place an entity near a reference point.
   */
  placeNear(
    reference: Coordinate,
    entityKind: string,
    spaceId: CoordinateSpaceId,
    options?: PlaceNearOptions
  ): PlacementResult {
    const spaceDef = this.domain.getCoordinateSpace?.(entityKind, spaceId);
    const maxDistance = options?.maxDistance ?? 1.0;
    const minDistance = options?.minDistance ?? 0.1;

    // Generate random offset within distance bounds
    const angle = Math.random() * 2 * Math.PI;
    const distance = minDistance + Math.random() * (maxDistance - minDistance);

    // Apply offset to sector coordinates
    const sectorXOffset = Math.cos(angle) * distance;
    const sectorYOffset = Math.sin(angle) * distance;

    // Calculate new coordinates
    let newSectorX = this.addToAxis(reference.sector_x, sectorXOffset, spaceDef?.axes.sector_x);
    let newSectorY = this.addToAxis(reference.sector_y, sectorYOffset, spaceDef?.axes.sector_y);

    // Apply directional bias if specified
    if (options?.directionalBias) {
      const { axis, direction, strength } = options.directionalBias;
      const biasAmount = maxDistance * strength * (direction === 'positive' ? 1 : -1);

      if (axis === 'sector_x') {
        newSectorX = this.addToAxis(newSectorX, biasAmount, spaceDef?.axes.sector_x);
      } else if (axis === 'sector_y') {
        newSectorY = this.addToAxis(newSectorY, biasAmount, spaceDef?.axes.sector_y);
      }
    }

    // Use reference plane unless constrained
    let plane = reference.plane;
    if (options?.constrainPlanes && options.constrainPlanes.length > 0) {
      if (!options.constrainPlanes.includes(String(plane))) {
        plane = options.constrainPlanes[Math.floor(Math.random() * options.constrainPlanes.length)];
      }
    }

    // Use reference z_band unless constrained
    let zBand = reference.z_band;
    if (options?.constrainZBands && options.constrainZBands.length > 0) {
      if (!options.constrainZBands.includes(zBand)) {
        zBand = options.constrainZBands[Math.floor(Math.random() * options.constrainZBands.length)];
      }
    }

    // Randomize cell coordinates within sector
    const cellX = this.randomInRange(spaceDef?.axes.cell_x);
    const cellY = this.randomInRange(spaceDef?.axes.cell_y);

    const coordinates: Coordinate = {
      plane,
      sector_x: newSectorX,
      sector_y: newSectorY,
      cell_x: cellX,
      cell_y: cellY,
      z_band: zBand
    };

    return {
      coordinates,
      distanceFromReference: spaceDef
        ? this.coordinateService.calculateCoordinateDistance(reference, coordinates, spaceDef)
        : distance
    };
  }

  /**
   * Place an entity within specified bounds.
   */
  placeWithin(
    bounds: CoordinateBounds,
    entityKind: string,
    spaceId: CoordinateSpaceId,
    options?: PlaceWithinOptions
  ): PlacementResult {
    const spaceDef = this.domain.getCoordinateSpace?.(entityKind, spaceId);

    // Determine plane
    const plane = bounds.plane ?? spaceDef?.axes.plane.defaultValue ?? 'default';

    // Calculate sector position
    let sectorX: number;
    let sectorY: number;

    if (bounds.sector_x) {
      if (options?.preferCenter) {
        sectorX = (bounds.sector_x.min + bounds.sector_x.max) / 2;
      } else {
        sectorX = bounds.sector_x.min + Math.random() * (bounds.sector_x.max - bounds.sector_x.min);
      }
    } else {
      sectorX = this.randomInRange(spaceDef?.axes.sector_x);
    }

    if (bounds.sector_y) {
      if (options?.preferCenter) {
        sectorY = (bounds.sector_y.min + bounds.sector_y.max) / 2;
      } else {
        sectorY = bounds.sector_y.min + Math.random() * (bounds.sector_y.max - bounds.sector_y.min);
      }
    } else {
      sectorY = this.randomInRange(spaceDef?.axes.sector_y);
    }

    // Calculate cell position
    let cellX: number;
    let cellY: number;

    if (bounds.cell_x) {
      if (options?.preferCenter) {
        cellX = (bounds.cell_x.min + bounds.cell_x.max) / 2;
      } else {
        cellX = bounds.cell_x.min + Math.random() * (bounds.cell_x.max - bounds.cell_x.min);
      }
    } else {
      cellX = this.randomInRange(spaceDef?.axes.cell_x);
    }

    if (bounds.cell_y) {
      if (options?.preferCenter) {
        cellY = (bounds.cell_y.min + bounds.cell_y.max) / 2;
      } else {
        cellY = bounds.cell_y.min + Math.random() * (bounds.cell_y.max - bounds.cell_y.min);
      }
    } else {
      cellY = this.randomInRange(spaceDef?.axes.cell_y);
    }

    // Apply jitter if specified
    if (options?.jitter) {
      sectorX += (Math.random() - 0.5) * options.jitter;
      sectorY += (Math.random() - 0.5) * options.jitter;
      cellX += (Math.random() - 0.5) * options.jitter;
      cellY += (Math.random() - 0.5) * options.jitter;
    }

    // Determine z_band
    let zBand: AxisValue;
    if (options?.constrainZBands && options.constrainZBands.length > 0) {
      zBand = options.constrainZBands[Math.floor(Math.random() * options.constrainZBands.length)];
    } else if (bounds.z_band && bounds.z_band.length > 0) {
      zBand = bounds.z_band[Math.floor(Math.random() * bounds.z_band.length)];
    } else {
      zBand = spaceDef?.axes.z_band.defaultValue ?? 'default';
    }

    return {
      coordinates: {
        plane,
        sector_x: sectorX,
        sector_y: sectorY,
        cell_x: cellX,
        cell_y: cellY,
        z_band: zBand
      }
    };
  }

  /**
   * Place an entity avoiding existing positions.
   */
  placeAvoiding(
    existingPositions: Coordinate[],
    entityKind: string,
    spaceId: CoordinateSpaceId,
    options: PlaceAvoidingOptions
  ): PlacementResult | null {
    const maxAttempts = options.maxAttempts ?? 100;
    const spaceDef = this.domain.getCoordinateSpace?.(entityKind, spaceId);

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      // Generate random position within bounds
      const result = this.placeWithin(
        options.bounds ?? {},
        entityKind,
        spaceId
      );

      // Check distance from all existing positions
      let valid = true;
      let nearestDistance = Infinity;

      for (const existing of existingPositions) {
        const distance = spaceDef
          ? this.coordinateService.calculateCoordinateDistance(result.coordinates, existing, spaceDef)
          : this.simpleDistance(result.coordinates, existing);

        nearestDistance = Math.min(nearestDistance, distance);

        if (distance < options.minSeparation) {
          valid = false;
          break;
        }
      }

      if (valid) {
        return {
          coordinates: result.coordinates,
          diagnostics: {
            attemptsUsed: attempt + 1,
            nearestObstacleDistance: nearestDistance
          }
        };
      }
    }

    return null;
  }

  /**
   * Find nearest entities to a coordinate point.
   */
  findNearest(
    graph: Graph,
    point: Coordinate,
    entityKind: string,
    spaceId: CoordinateSpaceId,
    options?: FindNearestOptions
  ): NearestResult[] {
    const results: NearestResult[] = [];
    const spaceDef = this.domain.getCoordinateSpace?.(entityKind, spaceId);

    for (const entity of graph.getEntities()) {
      // Apply entity kind filter
      if (options?.filter?.kind && entity.kind !== options.filter.kind) {
        continue;
      }
      if (options?.filter?.subtype && entity.subtype !== options.filter.subtype) {
        continue;
      }
      if (options?.filter?.status && entity.status !== options.filter.status) {
        continue;
      }
      if (options?.filter?.tags) {
        const hasAllTags = options.filter.tags.every(tag => hasTag(entity.tags, tag));
        if (!hasAllTags) continue;
      }

      // Get entity coordinates in this space
      const entityCoords = entity.coordinates?.[spaceId];
      if (!entityCoords) continue;

      // Apply plane constraints
      if (options?.constrainPlanes && !options.constrainPlanes.includes(String(entityCoords.plane))) {
        continue;
      }

      // Apply z_band constraints
      if (options?.constrainZBands && !options.constrainZBands.includes(entityCoords.z_band)) {
        continue;
      }

      // Calculate distance
      const distance = spaceDef
        ? this.coordinateService.calculateCoordinateDistance(point, entityCoords, spaceDef)
        : this.simpleDistance(point, entityCoords);

      // Apply max distance filter
      if (options?.maxDistance !== undefined && distance > options.maxDistance) {
        continue;
      }

      results.push({
        entity,
        coordinates: entityCoords,
        distance
      });
    }

    // Sort by distance
    results.sort((a, b) => a.distance - b.distance);

    // Apply limit
    if (options?.limit !== undefined) {
      return results.slice(0, options.limit);
    }

    return results;
  }

  /**
   * Find all entities within a radius from a point.
   */
  findWithinRadius(
    graph: Graph,
    point: Coordinate,
    radius: number,
    entityKind: string,
    spaceId: CoordinateSpaceId,
    filter?: FindNearestOptions['filter']
  ): NearestResult[] {
    return this.findNearest(graph, point, entityKind, spaceId, {
      maxDistance: radius,
      filter
    });
  }

  /**
   * Check if coordinates are within bounds.
   */
  isWithinBounds(coordinates: Coordinate, bounds: CoordinateBounds): boolean {
    if (bounds.plane && coordinates.plane !== bounds.plane) {
      return false;
    }

    if (bounds.sector_x) {
      const sectorX = typeof coordinates.sector_x === 'number' ? coordinates.sector_x : 0;
      if (sectorX < bounds.sector_x.min || sectorX > bounds.sector_x.max) {
        return false;
      }
    }

    if (bounds.sector_y) {
      const sectorY = typeof coordinates.sector_y === 'number' ? coordinates.sector_y : 0;
      if (sectorY < bounds.sector_y.min || sectorY > bounds.sector_y.max) {
        return false;
      }
    }

    if (bounds.cell_x) {
      const cellX = typeof coordinates.cell_x === 'number' ? coordinates.cell_x : 0;
      if (cellX < bounds.cell_x.min || cellX > bounds.cell_x.max) {
        return false;
      }
    }

    if (bounds.cell_y) {
      const cellY = typeof coordinates.cell_y === 'number' ? coordinates.cell_y : 0;
      if (cellY < bounds.cell_y.min || cellY > bounds.cell_y.max) {
        return false;
      }
    }

    if (bounds.z_band && bounds.z_band.length > 0) {
      if (!bounds.z_band.includes(coordinates.z_band)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Compute centroid of multiple coordinate points.
   * Only works for same-plane points.
   */
  computeCentroid(
    points: Coordinate[],
    entityKind: string,
    spaceId: CoordinateSpaceId
  ): Coordinate | null {
    if (points.length === 0) return null;

    // Check all points are on same plane
    const plane = points[0].plane;
    if (!points.every(p => p.plane === plane)) {
      return null;
    }

    // Average numeric coordinates
    let sumSectorX = 0;
    let sumSectorY = 0;
    let sumCellX = 0;
    let sumCellY = 0;
    let countSector = 0;
    let countCell = 0;

    for (const point of points) {
      if (typeof point.sector_x === 'number' && typeof point.sector_y === 'number') {
        sumSectorX += point.sector_x;
        sumSectorY += point.sector_y;
        countSector++;
      }
      if (typeof point.cell_x === 'number' && typeof point.cell_y === 'number') {
        sumCellX += point.cell_x;
        sumCellY += point.cell_y;
        countCell++;
      }
    }

    // Use most common z_band
    const zBandCounts = new Map<AxisValue, number>();
    for (const point of points) {
      zBandCounts.set(point.z_band, (zBandCounts.get(point.z_band) ?? 0) + 1);
    }
    let mostCommonZBand = points[0].z_band;
    let maxCount = 0;
    for (const [zBand, count] of zBandCounts) {
      if (count > maxCount) {
        maxCount = count;
        mostCommonZBand = zBand;
      }
    }

    return {
      plane,
      sector_x: countSector > 0 ? sumSectorX / countSector : 50,
      sector_y: countSector > 0 ? sumSectorY / countSector : 50,
      cell_x: countCell > 0 ? sumCellX / countCell : 5,
      cell_y: countCell > 0 ? sumCellY / countCell : 5,
      z_band: mostCommonZBand
    };
  }

  // ===========================
  // HELPER METHODS
  // ===========================

  /**
   * Add offset to an axis value, respecting bounds.
   */
  private addToAxis(
    value: AxisValue,
    offset: number,
    axisDef?: { numericRange?: { min: number; max: number } }
  ): number {
    const numValue = typeof value === 'number' ? value : 50;
    let result = numValue + offset;

    if (axisDef?.numericRange) {
      result = Math.max(axisDef.numericRange.min, Math.min(axisDef.numericRange.max, result));
    }

    return result;
  }

  /**
   * Generate random value within axis range.
   */
  private randomInRange(
    axisDef?: { numericRange?: { min: number; max: number }; defaultValue?: AxisValue }
  ): number {
    if (axisDef?.numericRange) {
      const { min, max } = axisDef.numericRange;
      return min + Math.random() * (max - min);
    }
    if (typeof axisDef?.defaultValue === 'number') {
      return axisDef.defaultValue;
    }
    return 50;
  }

  /**
   * Simple Euclidean distance for fallback.
   */
  private simpleDistance(a: Coordinate, b: Coordinate): number {
    let sum = 0;

    const axes: (keyof Coordinate)[] = ['sector_x', 'sector_y', 'cell_x', 'cell_y'];
    for (const axis of axes) {
      const v1 = a[axis];
      const v2 = b[axis];
      if (typeof v1 === 'number' && typeof v2 === 'number') {
        sum += (v1 - v2) ** 2;
      }
    }

    if (a.plane !== b.plane) sum += 100;
    if (a.z_band !== b.z_band) sum += 1;

    return Math.sqrt(sum);
  }
}
