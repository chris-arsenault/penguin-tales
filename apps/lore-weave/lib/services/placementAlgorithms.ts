/**
 * Placement Algorithms Service
 *
 * Implements mathematically sound placement algorithms for entity coordinate generation.
 * Each algorithm has specific properties suited to different use cases.
 *
 * Algorithms:
 * - Poisson Disk Sampling: Blue noise with guaranteed minimum spacing (Bridson's algorithm)
 * - Halton Sequence: Deterministic low-discrepancy quasi-random
 * - Jittered Grid: Regular coverage with controlled randomness
 * - Gaussian Cluster: Natural density falloff around center point
 * - Anchor Colocated: Exact copy of anchor entity coordinates
 * - Centroid Colocated: Average of reference entity coordinates
 * - Exclusion Aware: Wrapper adding exclusion zones to any scheme
 */

import type { Graph } from '../types/engine';
import type { HardState } from '../types/worldTypes';
import type { DomainSchema } from '../types/domainSchema';
import type {
  Coordinate,
  CoordinateBounds,
  CoordinateSpaceDefinition,
  CoordinateSpaceId,
  AnyPlacementScheme,
  PoissonDiskPlacement,
  HaltonSequencePlacement,
  JitteredGridPlacement,
  GaussianClusterPlacement,
  AnchorColocatedPlacement,
  CentroidColocatedPlacement,
  ExclusionAwarePlacement,
  CrossPlanePoissonPlacement,
  SaturationCascadePlacement,
  PlacementResult,
  AxisValue,
  NormalizedCoordinate,
  AxisWeights,
  ManifoldConfig,
  CascadeEvent
} from '../types/coordinates';
import { DEFAULT_AXIS_WEIGHTS } from '../types/coordinates';
import { CoordinateService } from './coordinateService';
import { CoordinatePlacementService } from './coordinatePlacementService';

/**
 * PlacementAlgorithms - Framework service for coordinate generation
 *
 * Provides mathematically sound algorithms for entity placement.
 * Used by TemplateGraphView.addEntityWithPlacement().
 */
export class PlacementAlgorithms {
  constructor(
    private graph: Graph,
    private domain: DomainSchema,
    private coordinateService: CoordinateService,
    private placementService: CoordinatePlacementService
  ) {}

  /**
   * Execute a placement scheme and return coordinates
   *
   * @param scheme - The placement scheme configuration
   * @param entityKind - Kind of entity being placed
   * @param existingPlacements - Previously placed coordinates in this batch (for incremental exclusion)
   * @returns PlacementResult or null if placement failed
   */
  execute(
    scheme: AnyPlacementScheme,
    entityKind: string,
    existingPlacements: Coordinate[] = []
  ): PlacementResult | null {
    switch (scheme.kind) {
      case 'poisson_disk':
        return this.poissonDisk(scheme, entityKind, existingPlacements);
      case 'halton_sequence':
        return this.haltonSequence(scheme, entityKind, existingPlacements);
      case 'jittered_grid':
        return this.jitteredGrid(scheme, entityKind, existingPlacements);
      case 'gaussian_cluster':
        return this.gaussianCluster(scheme, entityKind, existingPlacements);
      case 'anchor_colocated':
        return this.anchorColocated(scheme);
      case 'centroid_colocated':
        return this.centroidColocated(scheme, entityKind);
      case 'exclusion_aware':
        return this.exclusionAware(scheme, entityKind, existingPlacements);
      case 'cross_plane_poisson':
        return this.crossPlanePoisson(scheme, entityKind, existingPlacements);
      case 'saturation_cascade':
        return this.saturationCascade(scheme, entityKind, existingPlacements);
      default:
        throw new Error(`Unknown placement scheme kind: ${(scheme as AnyPlacementScheme).kind}`);
    }
  }

  // ===========================
  // POISSON DISK SAMPLING
  // ===========================

  /**
   * Bridson's Algorithm for Poisson Disk Sampling
   *
   * Generates a single point with guaranteed minimum distance from existing points.
   * O(N) complexity using spatial hashing for neighbor lookups.
   *
   * Algorithm:
   * 1. Select random active point (or use random if no actives)
   * 2. Generate k candidates in annulus [r, 2r]
   * 3. Accept first candidate that's >= minDistance from all existing points
   * 4. Return null after k failed attempts
   */
  private poissonDisk(
    scheme: PoissonDiskPlacement,
    entityKind: string,
    existingPlacements: Coordinate[]
  ): PlacementResult | null {
    const space = this.getSpaceDefinition(entityKind, scheme.spaceId);
    const bounds = this.resolveBounds(scheme.bounds, space, scheme.constrainPlane);
    const maxSamples = scheme.maxSamplesPerPoint ?? 30;
    const minDist = scheme.minDistance;

    // Get all existing coordinates in this space (from graph + batch)
    const allExisting = this.getAllExistingCoordinates(scheme.spaceId, existingPlacements);

    // Build spatial hash for O(1) neighbor lookups
    const cellSize = minDist / Math.sqrt(2);
    const spatialHash = this.buildSpatialHash(allExisting, cellSize, bounds);

    let attempts = 0;

    // If we have active points, try to place near them (standard Bridson)
    // Otherwise, place randomly in bounds
    const activePoints = allExisting.length > 0 ? allExisting : null;

    for (let sample = 0; sample < maxSamples; sample++) {
      attempts++;
      const candidate = activePoints
        ? this.generateAnnulusCandidate(activePoints, minDist, bounds, space)
        : this.generateRandomInBounds(bounds, space, scheme.constrainZBands);

      if (!candidate) continue;

      // Check minimum distance from all existing points
      if (this.checkMinDistance(candidate, spatialHash, cellSize, minDist, bounds)) {
        return {
          coordinates: candidate,
          diagnostics: { attemptsUsed: attempts }
        };
      }
    }

    return null; // Failed to place
  }

  /**
   * Generate candidate in annulus [r, 2r] around a random active point
   */
  private generateAnnulusCandidate(
    activePoints: Coordinate[],
    minDist: number,
    bounds: CoordinateBounds,
    space: CoordinateSpaceDefinition | undefined
  ): Coordinate | null {
    const center = activePoints[Math.floor(Math.random() * activePoints.length)];

    // Generate random point in annulus
    const angle = Math.random() * 2 * Math.PI;
    const radius = minDist + Math.random() * minDist; // [r, 2r]

    const sectorRange = this.getNumericRange(bounds.sector_x, space?.axes.sector_x);
    const sectorYRange = this.getNumericRange(bounds.sector_y, space?.axes.sector_y);

    const newSectorX = (center.sector_x as number) + radius * Math.cos(angle) * (sectorRange.max - sectorRange.min);
    const newSectorY = (center.sector_y as number) + radius * Math.sin(angle) * (sectorYRange.max - sectorYRange.min);

    // Check bounds
    if (newSectorX < sectorRange.min || newSectorX > sectorRange.max) return null;
    if (newSectorY < sectorYRange.min || newSectorY > sectorYRange.max) return null;

    return {
      plane: bounds.plane ?? center.plane,
      sector_x: newSectorX,
      sector_y: newSectorY,
      cell_x: Math.random() * 10, // Random cell position
      cell_y: Math.random() * 10,
      z_band: this.pickZBand(bounds.z_band, center.z_band)
    };
  }

  /**
   * Build spatial hash for O(1) neighbor lookups
   */
  private buildSpatialHash(
    points: Coordinate[],
    cellSize: number,
    bounds: CoordinateBounds
  ): Map<string, Coordinate[]> {
    const hash = new Map<string, Coordinate[]>();

    for (const point of points) {
      const key = this.getSpatialKey(point, cellSize, bounds);
      const cell = hash.get(key) ?? [];
      cell.push(point);
      hash.set(key, cell);
    }

    return hash;
  }

  /**
   * Get spatial hash key for a coordinate
   */
  private getSpatialKey(coord: Coordinate, cellSize: number, bounds: CoordinateBounds): string {
    const sectorRange = bounds.sector_x ?? { min: 0, max: 100 };
    const sectorYRange = bounds.sector_y ?? { min: 0, max: 100 };

    const normalizedX = ((coord.sector_x as number) - sectorRange.min) / (sectorRange.max - sectorRange.min);
    const normalizedY = ((coord.sector_y as number) - sectorYRange.min) / (sectorYRange.max - sectorYRange.min);

    const cellX = Math.floor(normalizedX / cellSize);
    const cellY = Math.floor(normalizedY / cellSize);

    return `${cellX},${cellY}`;
  }

  /**
   * Check if candidate is at least minDistance from all neighbors
   */
  private checkMinDistance(
    candidate: Coordinate,
    spatialHash: Map<string, Coordinate[]>,
    cellSize: number,
    minDist: number,
    bounds: CoordinateBounds
  ): boolean {
    const key = this.getSpatialKey(candidate, cellSize, bounds);
    const [cellX, cellY] = key.split(',').map(Number);

    // Check 3x3 neighborhood
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const neighborKey = `${cellX + dx},${cellY + dy}`;
        const neighbors = spatialHash.get(neighborKey);

        if (neighbors) {
          for (const neighbor of neighbors) {
            const dist = this.calculateNormalizedDistance(candidate, neighbor, bounds);
            if (dist < minDist) {
              return false;
            }
          }
        }
      }
    }

    return true;
  }

  // ===========================
  // HALTON SEQUENCE
  // ===========================

  /**
   * Halton Sequence - Low-discrepancy quasi-random
   *
   * Generates deterministic point using van der Corput sequence.
   * Fills space more uniformly than pure random.
   */
  private haltonSequence(
    scheme: HaltonSequencePlacement,
    entityKind: string,
    existingPlacements: Coordinate[]
  ): PlacementResult | null {
    const space = this.getSpaceDefinition(entityKind, scheme.spaceId);
    const bounds = this.resolveBounds(scheme.bounds, space, scheme.constrainPlane);
    const bases = scheme.bases ?? [2, 3];

    // Determine sequence index (continue from existing + startIndex)
    const allExisting = this.getAllExistingCoordinates(scheme.spaceId, existingPlacements);
    const index = (scheme.startIndex ?? 0) + allExisting.length;

    // Generate Halton point
    const x = this.halton(index, bases[0]);
    const y = this.halton(index, bases[1]);

    // Map to bounds
    const sectorRange = this.getNumericRange(bounds.sector_x, space?.axes.sector_x);
    const sectorYRange = this.getNumericRange(bounds.sector_y, space?.axes.sector_y);

    const coord: Coordinate = {
      plane: bounds.plane ?? this.getDefaultPlane(space),
      sector_x: sectorRange.min + x * (sectorRange.max - sectorRange.min),
      sector_y: sectorYRange.min + y * (sectorYRange.max - sectorYRange.min),
      cell_x: this.halton(index, 5) * 10, // Use different bases for cell
      cell_y: this.halton(index, 7) * 10,
      z_band: this.pickZBand(bounds.z_band, undefined)
    };

    return { coordinates: coord, diagnostics: { attemptsUsed: 1 } };
  }

  /**
   * Van der Corput sequence (basis of Halton)
   */
  private halton(index: number, base: number): number {
    let result = 0;
    let f = 1;
    let i = index;

    while (i > 0) {
      f = f / base;
      result = result + f * (i % base);
      i = Math.floor(i / base);
    }

    return result;
  }

  // ===========================
  // JITTERED GRID
  // ===========================

  /**
   * Jittered Grid - Regular coverage with controlled randomness
   *
   * Places point in next available grid cell with random jitter.
   */
  private jitteredGrid(
    scheme: JitteredGridPlacement,
    entityKind: string,
    existingPlacements: Coordinate[]
  ): PlacementResult | null {
    const space = this.getSpaceDefinition(entityKind, scheme.spaceId);
    const bounds = this.resolveBounds(scheme.bounds, space, scheme.constrainPlane);
    const jitter = scheme.jitterAmount ?? 0.5;

    // Determine which cell to fill
    const allExisting = this.getAllExistingCoordinates(scheme.spaceId, existingPlacements);
    const cellIndex = allExisting.length;
    const totalCells = scheme.gridDivisionsX * scheme.gridDivisionsY;

    if (cellIndex >= totalCells) {
      return null; // Grid is full
    }

    const cellX = cellIndex % scheme.gridDivisionsX;
    const cellY = Math.floor(cellIndex / scheme.gridDivisionsX);

    // Calculate cell bounds
    const sectorRange = this.getNumericRange(bounds.sector_x, space?.axes.sector_x);
    const sectorYRange = this.getNumericRange(bounds.sector_y, space?.axes.sector_y);

    const cellWidth = (sectorRange.max - sectorRange.min) / scheme.gridDivisionsX;
    const cellHeight = (sectorYRange.max - sectorYRange.min) / scheme.gridDivisionsY;

    // Place with jitter
    const jitterX = (Math.random() - 0.5) * jitter;
    const jitterY = (Math.random() - 0.5) * jitter;

    const coord: Coordinate = {
      plane: bounds.plane ?? this.getDefaultPlane(space),
      sector_x: sectorRange.min + (cellX + 0.5 + jitterX) * cellWidth,
      sector_y: sectorYRange.min + (cellY + 0.5 + jitterY) * cellHeight,
      cell_x: Math.random() * 10,
      cell_y: Math.random() * 10,
      z_band: this.pickZBand(bounds.z_band, undefined)
    };

    return { coordinates: coord, diagnostics: { attemptsUsed: 1 } };
  }

  // ===========================
  // GAUSSIAN CLUSTER
  // ===========================

  /**
   * Gaussian Cluster - Natural density falloff
   *
   * Places point following 2D Gaussian distribution around center.
   */
  private gaussianCluster(
    scheme: GaussianClusterPlacement,
    entityKind: string,
    existingPlacements: Coordinate[]
  ): PlacementResult | null {
    const space = this.getSpaceDefinition(entityKind, scheme.spaceId);

    // Resolve center coordinate
    let center: Coordinate;
    if (typeof scheme.center === 'string') {
      const entity = this.graph.getEntity(scheme.center);
      if (!entity?.coordinates?.[scheme.spaceId]) {
        return null; // Center entity has no coordinates in this space
      }
      center = entity.coordinates[scheme.spaceId]!;
    } else {
      center = scheme.center;
    }

    const maxAttempts = 100;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      // Box-Muller transform for Gaussian distribution
      const u1 = Math.random();
      const u2 = Math.random();
      const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      const z1 = Math.sqrt(-2 * Math.log(u1)) * Math.sin(2 * Math.PI * u2);

      const offsetX = z0 * scheme.sigma;
      const offsetY = z1 * scheme.sigma;

      // Check maxDistance constraint
      const distance = Math.sqrt(offsetX * offsetX + offsetY * offsetY);
      if (scheme.maxDistance !== undefined && distance > scheme.maxDistance) {
        continue;
      }

      // Apply offset to center
      const sectorRange = space?.axes.sector_x.numericRange ?? { min: 0, max: 100 };
      const sectorYRange = space?.axes.sector_y.numericRange ?? { min: 0, max: 100 };

      const newX = (center.sector_x as number) + offsetX * (sectorRange.max - sectorRange.min);
      const newY = (center.sector_y as number) + offsetY * (sectorYRange.max - sectorYRange.min);

      // Check bounds
      if (newX < sectorRange.min || newX > sectorRange.max) continue;
      if (newY < sectorYRange.min || newY > sectorYRange.max) continue;

      const coord: Coordinate = {
        plane: scheme.constrainPlane ?? center.plane,
        sector_x: newX,
        sector_y: newY,
        cell_x: Math.random() * 10,
        cell_y: Math.random() * 10,
        z_band: this.pickZBand(scheme.constrainZBands, center.z_band)
      };

      return {
        coordinates: coord,
        distanceFromReference: distance,
        diagnostics: { attemptsUsed: attempt + 1 }
      };
    }

    return null;
  }

  // ===========================
  // ANCHOR COLOCATED
  // ===========================

  /**
   * Anchor Colocated - Exact copy of anchor coordinates
   */
  private anchorColocated(scheme: AnchorColocatedPlacement): PlacementResult | null {
    const entity = this.graph.getEntity(scheme.anchorEntityId);
    if (!entity?.coordinates?.[scheme.spaceId]) {
      return null;
    }

    // Deep copy the coordinates
    const anchor = entity.coordinates[scheme.spaceId]!;
    const coord: Coordinate = { ...anchor };

    return {
      coordinates: coord,
      distanceFromReference: 0,
      diagnostics: { attemptsUsed: 1 }
    };
  }

  // ===========================
  // CENTROID COLOCATED
  // ===========================

  /**
   * Centroid Colocated - Average of reference coordinates
   */
  private centroidColocated(
    scheme: CentroidColocatedPlacement,
    entityKind: string
  ): PlacementResult | null {
    const coordinates: Coordinate[] = [];

    for (const entityId of scheme.referenceEntityIds) {
      const entity = this.graph.getEntity(entityId);
      if (entity?.coordinates?.[scheme.spaceId]) {
        coordinates.push(entity.coordinates[scheme.spaceId]!);
      }
    }

    if (coordinates.length === 0) {
      return null;
    }

    // Compute centroid using placement service
    const centroid = this.placementService.computeCentroid(
      coordinates,
      entityKind,
      scheme.spaceId
    );
    if (!centroid) {
      return null;
    }

    return {
      coordinates: centroid,
      diagnostics: { attemptsUsed: 1 }
    };
  }

  // ===========================
  // EXCLUSION AWARE WRAPPER
  // ===========================

  /**
   * Exclusion Aware - Wrapper adding exclusion zones
   *
   * Executes base scheme and rejects if within exclusion zones.
   */
  private exclusionAware(
    scheme: ExclusionAwarePlacement,
    entityKind: string,
    existingPlacements: Coordinate[]
  ): PlacementResult | null {
    const maxAttempts = scheme.maxAttempts ?? 100;

    // Build exclusion coordinates from entities
    const excludedCoords: Array<{ coord: Coordinate; minDistance: number }> = [];

    if (scheme.excludeNearEntities) {
      for (const exclusion of scheme.excludeNearEntities) {
        for (const entity of this.graph.getEntities()) {
          if (exclusion.kind && entity.kind !== exclusion.kind) continue;
          if (entity.coordinates?.[scheme.baseScheme.spaceId]) {
            excludedCoords.push({
              coord: entity.coordinates[scheme.baseScheme.spaceId]!,
              minDistance: exclusion.minDistance
            });
          }
        }
      }
    }

    let totalAttempts = 0;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      // Execute base scheme
      const result = this.execute(scheme.baseScheme, entityKind, existingPlacements);
      totalAttempts++;

      if (!result) continue;

      // Check static exclusion zones
      let excluded = false;
      if (scheme.exclusionZones) {
        for (const zone of scheme.exclusionZones) {
          if (this.placementService.isWithinBounds(result.coordinates, zone)) {
            excluded = true;
            break;
          }
        }
      }
      if (excluded) continue;

      // Check dynamic exclusions (entity proximity)
      for (const exclusion of excludedCoords) {
        const bounds = this.resolveBounds(undefined, undefined, undefined);
        const dist = this.calculateNormalizedDistance(result.coordinates, exclusion.coord, bounds);
        if (dist < exclusion.minDistance) {
          excluded = true;
          break;
        }
      }
      if (excluded) continue;

      // Passed all checks
      return {
        ...result,
        diagnostics: {
          ...result.diagnostics,
          attemptsUsed: totalAttempts
        }
      };
    }

    return null;
  }

  // ===========================
  // HELPER METHODS
  // ===========================

  /**
   * Get coordinate space definition for entity kind
   */
  private getSpaceDefinition(
    entityKind: string,
    spaceId: CoordinateSpaceId
  ): CoordinateSpaceDefinition | undefined {
    return this.domain.getCoordinateSpace?.(entityKind, spaceId);
  }

  /**
   * Resolve bounds with defaults from space definition
   */
  private resolveBounds(
    bounds: CoordinateBounds | undefined,
    space: CoordinateSpaceDefinition | undefined,
    constrainPlane: string | undefined
  ): CoordinateBounds {
    return {
      plane: constrainPlane ?? bounds?.plane,
      sector_x: bounds?.sector_x ?? space?.axes.sector_x.numericRange ?? { min: 0, max: 100 },
      sector_y: bounds?.sector_y ?? space?.axes.sector_y.numericRange ?? { min: 0, max: 100 },
      cell_x: bounds?.cell_x ?? space?.axes.cell_x.numericRange ?? { min: 0, max: 10 },
      cell_y: bounds?.cell_y ?? space?.axes.cell_y.numericRange ?? { min: 0, max: 10 },
      z_band: bounds?.z_band
    };
  }

  /**
   * Get numeric range from bounds or axis definition
   */
  private getNumericRange(
    boundsRange: { min: number; max: number } | undefined,
    axis: { numericRange?: { min: number; max: number } } | undefined
  ): { min: number; max: number } {
    return boundsRange ?? axis?.numericRange ?? { min: 0, max: 100 };
  }

  /**
   * Get default plane from space definition
   */
  private getDefaultPlane(space: CoordinateSpaceDefinition | undefined): string {
    return (space?.axes.plane.defaultValue as string) ?? 'default';
  }

  /**
   * Pick z_band value from constraints or default
   */
  private pickZBand(
    constraints: AxisValue[] | undefined,
    fallback: AxisValue | undefined
  ): AxisValue {
    if (constraints && constraints.length > 0) {
      return constraints[Math.floor(Math.random() * constraints.length)];
    }
    return fallback ?? 'surface';
  }

  /**
   * Generate random coordinate within bounds
   */
  private generateRandomInBounds(
    bounds: CoordinateBounds,
    space: CoordinateSpaceDefinition | undefined,
    constrainZBands: AxisValue[] | undefined
  ): Coordinate {
    const sectorRange = this.getNumericRange(bounds.sector_x, space?.axes.sector_x);
    const sectorYRange = this.getNumericRange(bounds.sector_y, space?.axes.sector_y);
    const cellRange = this.getNumericRange(bounds.cell_x, space?.axes.cell_x);
    const cellYRange = this.getNumericRange(bounds.cell_y, space?.axes.cell_y);

    return {
      plane: bounds.plane ?? this.getDefaultPlane(space),
      sector_x: sectorRange.min + Math.random() * (sectorRange.max - sectorRange.min),
      sector_y: sectorYRange.min + Math.random() * (sectorYRange.max - sectorYRange.min),
      cell_x: cellRange.min + Math.random() * (cellRange.max - cellRange.min),
      cell_y: cellYRange.min + Math.random() * (cellYRange.max - cellYRange.min),
      z_band: this.pickZBand(constrainZBands ?? bounds.z_band, undefined)
    };
  }

  /**
   * Get all existing coordinates in a space (from graph + batch)
   */
  private getAllExistingCoordinates(
    spaceId: string,
    batchCoords: Coordinate[]
  ): Coordinate[] {
    const existing: Coordinate[] = [...batchCoords];

    for (const entity of this.graph.getEntities()) {
      if (entity.coordinates?.[spaceId]) {
        existing.push(entity.coordinates[spaceId]!);
      }
    }

    return existing;
  }

  /**
   * Calculate normalized distance between two coordinates (0-1 scale)
   */
  private calculateNormalizedDistance(
    c1: Coordinate,
    c2: Coordinate,
    bounds: CoordinateBounds
  ): number {
    const sectorRange = bounds.sector_x ?? { min: 0, max: 100 };
    const sectorYRange = bounds.sector_y ?? { min: 0, max: 100 };

    const dx = ((c1.sector_x as number) - (c2.sector_x as number)) / (sectorRange.max - sectorRange.min);
    const dy = ((c1.sector_y as number) - (c2.sector_y as number)) / (sectorYRange.max - sectorYRange.min);

    return Math.sqrt(dx * dx + dy * dy);
  }

  // ===========================
  // 6D CROSS-PLANE PLACEMENT
  // ===========================

  /**
   * Cross-Plane Poisson Disk Sampling
   *
   * Uses 6D spatial hashing to ensure minimum distance across all dimensions.
   * Cell size = r / sqrt(6) for 6D (Bridson's formula).
   * Checks 3^6 = 729 neighboring cells for distance validation.
   */
  private crossPlanePoisson(
    scheme: CrossPlanePoissonPlacement,
    entityKind: string,
    existingPlacements: Coordinate[]
  ): PlacementResult | null {
    const space = this.getSpaceDefinition(entityKind, scheme.spaceId);
    const manifoldConfig = scheme.manifoldConfig ?? this.getManifoldConfig(entityKind, scheme.spaceId);

    if (!manifoldConfig) {
      // No manifold config - fall back to regular 2D poisson
      return this.poissonDiskFallback(scheme, entityKind, existingPlacements);
    }

    const weights = this.resolveAxisWeights(scheme.axisWeights, entityKind, scheme.spaceId);
    const minDist = scheme.minDistance;
    const maxSamples = scheme.maxSamplesPerPoint ?? 30;

    // Get all existing entities
    const allEntities = this.getAllEntitiesWithCoordinates(scheme.spaceId);
    const allCoords = [
      ...existingPlacements,
      ...allEntities.map(e => e.coordinates![scheme.spaceId]!)
    ];

    // Normalize all existing coordinates
    const normalized = allCoords.map(c =>
      this.coordinateService.normalizeCoordinate(c, entityKind, scheme.spaceId)
    );

    // Build 6D spatial hash
    const cellSize = minDist / Math.sqrt(6);
    const spatialHash = this.build6DSpatialHash(normalized, cellSize);

    // Determine starting plane
    const startPlane = scheme.preferredPlane ??
      this.coordinateService.getPrimaryPlane(manifoldConfig);

    // Try to place on current plane, cascade if saturated
    let currentPlane = startPlane;
    let attempts = 0;
    let cascaded = false;
    let cascadeFromPlane: string | undefined;

    while (currentPlane && attempts < maxSamples * 3) {
      // Check saturation
      if (this.coordinateService.isPlaneSaturated(currentPlane, allEntities, manifoldConfig, scheme.spaceId)) {
        cascadeFromPlane = currentPlane;
        currentPlane = this.coordinateService.getNextAvailablePlane(
          currentPlane, allEntities, manifoldConfig, scheme.spaceId
        ) ?? currentPlane; // Stay on current if no children available
        cascaded = cascadeFromPlane !== currentPlane;
      }

      // Generate candidate in 6D
      const candidate = this.generate6DCandidate(
        currentPlane, entityKind, scheme.spaceId, weights
      );

      if (candidate) {
        // Check distance to all nearby points in 6D
        const nearby = this.get6DNeighbors(candidate, cellSize, spatialHash);
        const valid = nearby.every(neighbor =>
          this.calculate6DWeightedDistance(candidate, neighbor, weights) >= minDist
        );

        if (valid) {
          // Denormalize back to domain coordinates
          const result = this.coordinateService.denormalizeCoordinate(
            candidate, entityKind, scheme.spaceId
          );

          return {
            coordinates: result,
            diagnostics: {
              attemptsUsed: attempts + 1,
              ...(cascaded ? { cascadedFrom: cascadeFromPlane } : {})
            }
          };
        }
      }

      attempts++;
    }

    return null;
  }

  /**
   * Fallback to 2D Poisson when no manifold config
   */
  private poissonDiskFallback(
    scheme: CrossPlanePoissonPlacement,
    entityKind: string,
    existingPlacements: Coordinate[]
  ): PlacementResult | null {
    // Convert to regular PoissonDiskPlacement
    const fallbackScheme: PoissonDiskPlacement = {
      kind: 'poisson_disk',
      spaceId: scheme.spaceId,
      allowCoLocation: false,
      minDistance: scheme.minDistance,
      maxSamplesPerPoint: scheme.maxSamplesPerPoint,
      constrainPlane: scheme.preferredPlane
    };
    return this.poissonDisk(fallbackScheme, entityKind, existingPlacements);
  }

  /**
   * Saturation Cascade Placement
   *
   * Uses 2D placement within each plane, cascading to child planes when saturated.
   */
  private saturationCascade(
    scheme: SaturationCascadePlacement,
    entityKind: string,
    existingPlacements: Coordinate[]
  ): PlacementResult | null {
    const manifoldConfig = scheme.manifoldConfig ?? this.getManifoldConfig(entityKind, scheme.spaceId);

    if (!manifoldConfig) {
      // No manifold config - just use base scheme
      return this.execute(scheme.basePlacementScheme, entityKind, existingPlacements);
    }

    // Get all existing entities
    const allEntities = this.getAllEntitiesWithCoordinates(scheme.spaceId);

    // Determine starting plane
    const startPlane = scheme.preferredPlane ??
      this.coordinateService.getPrimaryPlane(manifoldConfig);

    let currentPlane = startPlane;
    let cascadeFrom: string | undefined;
    let maxCascades = manifoldConfig.planeHierarchy.length;

    for (let cascade = 0; cascade < maxCascades; cascade++) {
      // Check if current plane is saturated
      if (this.coordinateService.isPlaneSaturated(currentPlane, allEntities, manifoldConfig, scheme.spaceId)) {
        cascadeFrom = currentPlane;
        const nextPlane = this.coordinateService.getNextAvailablePlane(
          currentPlane, allEntities, manifoldConfig, scheme.spaceId
        );

        if (nextPlane) {
          currentPlane = nextPlane;
        } else {
          // No more planes available, try placing anyway
          break;
        }
      } else {
        // Not saturated, try to place here
        break;
      }
    }

    // Create modified base scheme with current plane constraint
    const modifiedScheme = {
      ...scheme.basePlacementScheme,
      constrainPlane: currentPlane
    };

    const result = this.execute(modifiedScheme as AnyPlacementScheme, entityKind, existingPlacements);

    if (result && cascadeFrom) {
      return {
        ...result,
        diagnostics: {
          ...result.diagnostics,
          cascadedFrom: cascadeFrom
        }
      };
    }

    return result;
  }

  // ===========================
  // 6D HELPER METHODS
  // ===========================

  /**
   * Get manifold config from domain schema
   */
  private getManifoldConfig(
    entityKind: string,
    spaceId: CoordinateSpaceId
  ): ManifoldConfig | undefined {
    const space = this.domain.getCoordinateSpace?.(entityKind, spaceId);
    // Note: manifoldConfig would be added to CoordinateSpaceDefinition
    // For now, check if domain has a global manifold config
    return (this.domain as unknown as { manifoldConfig?: ManifoldConfig }).manifoldConfig;
  }

  /**
   * Resolve axis weights from scheme, domain, or defaults
   */
  private resolveAxisWeights(
    overrides: Partial<AxisWeights> | undefined,
    entityKind: string,
    spaceId: CoordinateSpaceId
  ): AxisWeights {
    return this.coordinateService.getAxisWeights(entityKind, spaceId, overrides);
  }

  /**
   * Get all entities that have coordinates in a space
   */
  private getAllEntitiesWithCoordinates(spaceId: CoordinateSpaceId): HardState[] {
    const result: HardState[] = [];
    for (const entity of this.graph.getEntities()) {
      if (entity.coordinates?.[spaceId]) {
        result.push(entity);
      }
    }
    return result;
  }

  /**
   * Build 6D spatial hash for efficient neighbor lookups
   */
  private build6DSpatialHash(
    points: NormalizedCoordinate[],
    cellSize: number
  ): Map<string, NormalizedCoordinate[]> {
    const hash = new Map<string, NormalizedCoordinate[]>();

    for (const point of points) {
      const key = this.get6DHashKey(point, cellSize);
      const cell = hash.get(key) ?? [];
      cell.push(point);
      hash.set(key, cell);
    }

    return hash;
  }

  /**
   * Get 6D spatial hash key for a coordinate
   */
  private get6DHashKey(coord: NormalizedCoordinate, cellSize: number): string {
    return [
      Math.floor(coord.plane / cellSize),
      Math.floor(coord.sector_x / cellSize),
      Math.floor(coord.sector_y / cellSize),
      Math.floor(coord.cell_x / cellSize),
      Math.floor(coord.cell_y / cellSize),
      Math.floor(coord.z_band / cellSize)
    ].join(',');
  }

  /**
   * Get all neighbors within 3^6 = 729 adjacent cells in 6D
   */
  private get6DNeighbors(
    coord: NormalizedCoordinate,
    cellSize: number,
    spatialHash: Map<string, NormalizedCoordinate[]>
  ): NormalizedCoordinate[] {
    const results: NormalizedCoordinate[] = [];
    const base = {
      plane: Math.floor(coord.plane / cellSize),
      sector_x: Math.floor(coord.sector_x / cellSize),
      sector_y: Math.floor(coord.sector_y / cellSize),
      cell_x: Math.floor(coord.cell_x / cellSize),
      cell_y: Math.floor(coord.cell_y / cellSize),
      z_band: Math.floor(coord.z_band / cellSize)
    };

    // Check all 3^6 = 729 neighboring cells
    for (let p = -1; p <= 1; p++) {
      for (let sx = -1; sx <= 1; sx++) {
        for (let sy = -1; sy <= 1; sy++) {
          for (let cx = -1; cx <= 1; cx++) {
            for (let cy = -1; cy <= 1; cy++) {
              for (let z = -1; z <= 1; z++) {
                const key = [
                  base.plane + p,
                  base.sector_x + sx,
                  base.sector_y + sy,
                  base.cell_x + cx,
                  base.cell_y + cy,
                  base.z_band + z
                ].join(',');

                const neighbors = spatialHash.get(key);
                if (neighbors) {
                  results.push(...neighbors);
                }
              }
            }
          }
        }
      }
    }

    return results;
  }

  /**
   * Generate a random 6D candidate point
   */
  private generate6DCandidate(
    plane: string,
    entityKind: string,
    spaceId: CoordinateSpaceId,
    weights: AxisWeights
  ): NormalizedCoordinate {
    const space = this.domain.getCoordinateSpace?.(entityKind, spaceId);

    // Get plane's numeric value
    let planeValue = 0.5;
    if (space?.axes.plane.enumValues) {
      const enumVal = space.axes.plane.enumValues.find(e => e.id === plane);
      planeValue = enumVal?.numericValue ?? 0.5;
    }

    // Get z_band value (random from available)
    let zBandValue = 0.5;
    if (space?.axes.z_band.enumValues && space.axes.z_band.enumValues.length > 0) {
      const randomZBand = space.axes.z_band.enumValues[
        Math.floor(Math.random() * space.axes.z_band.enumValues.length)
      ];
      zBandValue = randomZBand.numericValue;
    }

    return {
      plane: planeValue,
      sector_x: Math.random(),
      sector_y: Math.random(),
      cell_x: Math.random(),
      cell_y: Math.random(),
      z_band: zBandValue
    };
  }

  /**
   * Calculate weighted 6D distance between two normalized coordinates
   */
  private calculate6DWeightedDistance(
    c1: NormalizedCoordinate,
    c2: NormalizedCoordinate,
    weights: AxisWeights
  ): number {
    return this.coordinateService.calculate6DDistance(c1, c2, weights);
  }
}
