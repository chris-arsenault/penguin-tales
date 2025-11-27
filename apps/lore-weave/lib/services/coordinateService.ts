/**
 * Coordinate Service
 *
 * Framework service for coordinate-based distance calculations.
 * Provides algorithms for computing distances between entities in coordinate spaces.
 */

import type { DomainSchema } from '../types/domainSchema';
import type { HardState } from '../types/worldTypes';
import type {
  Coordinate,
  CoordinateSpaceId,
  CoordinateSpaceDefinition,
  AxisDefinition,
  AxisValue,
  NormalizedCoordinate,
  AxisWeights,
  ManifoldConfig,
  PlaneHierarchy
} from '../types/coordinates';
import { DEFAULT_AXIS_WEIGHTS } from '../types/coordinates';

/**
 * CoordinateService provides distance calculation algorithms for entities
 * positioned in coordinate spaces.
 */
export class CoordinateService {
  constructor(private domain: DomainSchema) {}

  /**
   * Calculate distance between two entities in a coordinate space.
   * Returns undefined if either entity lacks coordinates in that space.
   */
  calculateDistance(
    entity1: HardState,
    entity2: HardState,
    spaceId: CoordinateSpaceId
  ): number | undefined {
    const coord1 = entity1.coordinates?.[spaceId];
    const coord2 = entity2.coordinates?.[spaceId];

    if (!coord1 || !coord2) {
      return undefined;
    }

    // Find the coordinate space definition
    // Try entity1's kind first, then entity2's (for cross-kind distance in shared spaces)
    let spaceDef = this.domain.getCoordinateSpace?.(entity1.kind, spaceId);
    if (!spaceDef) {
      spaceDef = this.domain.getCoordinateSpace?.(entity2.kind, spaceId);
    }

    if (!spaceDef) {
      // Fall back to simple Euclidean distance on numeric axes
      return this.simpleEuclideanDistance(coord1, coord2);
    }

    return this.calculateCoordinateDistance(coord1, coord2, spaceDef);
  }

  /**
   * Calculate distance between two coordinate points using a space definition.
   */
  calculateCoordinateDistance(
    coord1: Coordinate,
    coord2: Coordinate,
    spaceDef: CoordinateSpaceDefinition
  ): number {
    // Check if custom distance function is defined
    if (spaceDef.customDistanceFunction) {
      return spaceDef.customDistanceFunction(coord1, coord2);
    }

    // Check plane compatibility first
    if (coord1.plane !== coord2.plane) {
      if (spaceDef.crossPlaneDistance) {
        const planeMultiplier = spaceDef.crossPlaneDistance(
          String(coord1.plane),
          String(coord2.plane)
        );
        if (!isFinite(planeMultiplier)) {
          return Infinity;
        }
        // For cross-plane, compute distance without cell precision
        return this.computeHierarchicalDistance(coord1, coord2, spaceDef, true) * planeMultiplier;
      }
      return Infinity;
    }

    // Same plane: compute full hierarchical distance
    return this.computeHierarchicalDistance(coord1, coord2, spaceDef, false);
  }

  /**
   * Compute hierarchical distance respecting the plane > sector > cell hierarchy.
   */
  private computeHierarchicalDistance(
    coord1: Coordinate,
    coord2: Coordinate,
    spaceDef: CoordinateSpaceDefinition,
    skipCells: boolean
  ): number {
    const axes = spaceDef.axes;

    // Sector-level distance
    const sectorXDist = this.computeAxisDistance(
      coord1.sector_x,
      coord2.sector_x,
      axes.sector_x
    );
    const sectorYDist = this.computeAxisDistance(
      coord1.sector_y,
      coord2.sector_y,
      axes.sector_y
    );
    const sectorDist = Math.sqrt(sectorXDist ** 2 + sectorYDist ** 2);

    // Cell-level distance (only if same or adjacent sectors and not skipping)
    let cellDist = 0;
    if (!skipCells) {
      const sectorXClose = this.isAdjacentOrSame(coord1.sector_x, coord2.sector_x);
      const sectorYClose = this.isAdjacentOrSame(coord1.sector_y, coord2.sector_y);

      if (sectorXClose && sectorYClose) {
        const cellXDist = this.computeAxisDistance(
          coord1.cell_x,
          coord2.cell_x,
          axes.cell_x
        );
        const cellYDist = this.computeAxisDistance(
          coord1.cell_y,
          coord2.cell_y,
          axes.cell_y
        );
        cellDist = Math.sqrt(cellXDist ** 2 + cellYDist ** 2);
      }
    }

    // Z-band distance
    const zBandDist = this.computeAxisDistance(
      coord1.z_band,
      coord2.z_band,
      axes.z_band
    );

    // Combine with weights
    const sectorWeight = ((axes.sector_x.distanceWeight ?? 1.0) + (axes.sector_y.distanceWeight ?? 1.0)) / 2;
    const cellWeight = ((axes.cell_x.distanceWeight ?? 1.0) + (axes.cell_y.distanceWeight ?? 1.0)) / 2;
    const zWeight = axes.z_band.distanceWeight ?? 1.0;

    return sectorDist * sectorWeight + cellDist * cellWeight + zBandDist * zWeight;
  }

  /**
   * Compute distance for a single axis.
   */
  private computeAxisDistance(
    v1: AxisValue,
    v2: AxisValue,
    axisDef: AxisDefinition
  ): number {
    const n1 = this.normalizeAxis(v1, axisDef);
    const n2 = this.normalizeAxis(v2, axisDef);
    return Math.abs(n1 - n2);
  }

  /**
   * Normalize an axis value to 0-1 range for distance calculation.
   */
  normalizeAxis(value: AxisValue, axisDef: AxisDefinition): number {
    switch (axisDef.valueType) {
      case 'enum':
        if (axisDef.enumValues) {
          const enumValue = axisDef.enumValues.find(ev => ev.id === value);
          return enumValue?.numericValue ?? 0.5;
        }
        return 0.5;

      case 'numeric':
        if (typeof value !== 'number') {
          return 0.5;
        }
        if (axisDef.numericRange) {
          const { min, max } = axisDef.numericRange;
          return (value - min) / (max - min);
        }
        return value;

      case 'hierarchical':
        if (axisDef.hierarchyLevels) {
          const level = axisDef.hierarchyLevels.find(hl => hl.id === value);
          if (level) {
            const maxDepth = Math.max(...axisDef.hierarchyLevels.map(l => l.depth));
            return maxDepth > 0 ? level.depth / maxDepth : 0;
          }
        }
        return 0.5;

      default:
        return 0.5;
    }
  }

  /**
   * Check if two numeric axis values are adjacent or same.
   */
  private isAdjacentOrSame(v1: AxisValue, v2: AxisValue): boolean {
    if (typeof v1 === 'number' && typeof v2 === 'number') {
      return Math.abs(v1 - v2) <= 1;
    }
    // For non-numeric, consider same value as adjacent
    return v1 === v2;
  }

  /**
   * Simple Euclidean distance when no space definition is available.
   * Only considers numeric axes.
   */
  private simpleEuclideanDistance(coord1: Coordinate, coord2: Coordinate): number {
    let sum = 0;

    // Only use numeric values
    const axes: (keyof Coordinate)[] = ['sector_x', 'sector_y', 'cell_x', 'cell_y'];
    for (const axis of axes) {
      const v1 = coord1[axis];
      const v2 = coord2[axis];
      if (typeof v1 === 'number' && typeof v2 === 'number') {
        sum += (v1 - v2) ** 2;
      }
    }

    // Plane difference (0 if same, 1 if different)
    if (coord1.plane !== coord2.plane) {
      sum += 1;
    }

    // Z-band difference
    if (coord1.z_band !== coord2.z_band) {
      sum += 0.5 ** 2;
    }

    return Math.sqrt(sum);
  }

  /**
   * Get default coordinates for an entity kind based on space definition.
   */
  getDefaultCoordinates(entityKind: string, spaceId: CoordinateSpaceId): Coordinate | undefined {
    const spaceDef = this.domain.getCoordinateSpace?.(entityKind, spaceId);
    if (!spaceDef) return undefined;

    return {
      plane: spaceDef.axes.plane.defaultValue ?? '',
      sector_x: spaceDef.axes.sector_x.defaultValue ?? 50,
      sector_y: spaceDef.axes.sector_y.defaultValue ?? 50,
      cell_x: spaceDef.axes.cell_x.defaultValue ?? 5,
      cell_y: spaceDef.axes.cell_y.defaultValue ?? 5,
      z_band: spaceDef.axes.z_band.defaultValue ?? ''
    };
  }

  // ===========================
  // 6-DIMENSIONAL OPERATIONS
  // ===========================

  /**
   * Normalize a coordinate to [0,1] space for 6D algorithms.
   * All 6 axes are normalized using their axis definitions.
   */
  normalizeCoordinate(
    coord: Coordinate,
    entityKind: string,
    spaceId: CoordinateSpaceId
  ): NormalizedCoordinate {
    const spaceDef = this.domain.getCoordinateSpace?.(entityKind, spaceId);
    if (!spaceDef) {
      // Fallback: assume numeric values in [0,100] range, strings map to 0.5
      return {
        plane: typeof coord.plane === 'number' ? coord.plane / 100 : 0.5,
        sector_x: typeof coord.sector_x === 'number' ? coord.sector_x / 100 : 0.5,
        sector_y: typeof coord.sector_y === 'number' ? coord.sector_y / 100 : 0.5,
        cell_x: typeof coord.cell_x === 'number' ? coord.cell_x / 10 : 0.5,
        cell_y: typeof coord.cell_y === 'number' ? coord.cell_y / 10 : 0.5,
        z_band: typeof coord.z_band === 'number' ? coord.z_band / 100 : 0.5
      };
    }

    return {
      plane: this.normalizeAxis(coord.plane, spaceDef.axes.plane),
      sector_x: this.normalizeAxis(coord.sector_x, spaceDef.axes.sector_x),
      sector_y: this.normalizeAxis(coord.sector_y, spaceDef.axes.sector_y),
      cell_x: this.normalizeAxis(coord.cell_x, spaceDef.axes.cell_x),
      cell_y: this.normalizeAxis(coord.cell_y, spaceDef.axes.cell_y),
      z_band: this.normalizeAxis(coord.z_band, spaceDef.axes.z_band)
    };
  }

  /**
   * Denormalize a [0,1] coordinate back to domain coordinate space.
   */
  denormalizeCoordinate(
    normalized: NormalizedCoordinate,
    entityKind: string,
    spaceId: CoordinateSpaceId
  ): Coordinate {
    const spaceDef = this.domain.getCoordinateSpace?.(entityKind, spaceId);
    if (!spaceDef) {
      // Fallback: assume [0,100] ranges for sectors, [0,10] for cells
      return {
        plane: 'default',
        sector_x: normalized.sector_x * 100,
        sector_y: normalized.sector_y * 100,
        cell_x: normalized.cell_x * 10,
        cell_y: normalized.cell_y * 10,
        z_band: 'default'
      };
    }

    return {
      plane: this.denormalizeAxis(normalized.plane, spaceDef.axes.plane),
      sector_x: this.denormalizeAxis(normalized.sector_x, spaceDef.axes.sector_x),
      sector_y: this.denormalizeAxis(normalized.sector_y, spaceDef.axes.sector_y),
      cell_x: this.denormalizeAxis(normalized.cell_x, spaceDef.axes.cell_x),
      cell_y: this.denormalizeAxis(normalized.cell_y, spaceDef.axes.cell_y),
      z_band: this.denormalizeAxis(normalized.z_band, spaceDef.axes.z_band)
    };
  }

  /**
   * Denormalize a single axis value from [0,1] to domain value.
   */
  private denormalizeAxis(normalized: number, axisDef: AxisDefinition): AxisValue {
    switch (axisDef.valueType) {
      case 'enum':
        if (axisDef.enumValues && axisDef.enumValues.length > 0) {
          // Find the enum value closest to the normalized value
          let closest = axisDef.enumValues[0];
          let minDiff = Math.abs(closest.numericValue - normalized);

          for (const ev of axisDef.enumValues) {
            const diff = Math.abs(ev.numericValue - normalized);
            if (diff < minDiff) {
              minDiff = diff;
              closest = ev;
            }
          }
          return closest.id;
        }
        return axisDef.defaultValue ?? '';

      case 'numeric':
        if (axisDef.numericRange) {
          const { min, max } = axisDef.numericRange;
          return min + normalized * (max - min);
        }
        return normalized;

      case 'hierarchical':
        if (axisDef.hierarchyLevels && axisDef.hierarchyLevels.length > 0) {
          const maxDepth = Math.max(...axisDef.hierarchyLevels.map(l => l.depth));
          const targetDepth = normalized * maxDepth;

          // Find the level closest to the target depth
          let closest = axisDef.hierarchyLevels[0];
          let minDiff = Math.abs(closest.depth - targetDepth);

          for (const level of axisDef.hierarchyLevels) {
            const diff = Math.abs(level.depth - targetDepth);
            if (diff < minDiff) {
              minDiff = diff;
              closest = level;
            }
          }
          return closest.id;
        }
        return axisDef.defaultValue ?? '';

      default:
        return axisDef.defaultValue ?? normalized;
    }
  }

  /**
   * Calculate weighted 6D Euclidean distance between two normalized coordinates.
   */
  calculate6DDistance(
    coord1: NormalizedCoordinate,
    coord2: NormalizedCoordinate,
    weights: Partial<AxisWeights> = {}
  ): number {
    const w = { ...DEFAULT_AXIS_WEIGHTS, ...weights };

    return Math.sqrt(
      w.plane * (coord1.plane - coord2.plane) ** 2 +
      w.sector_x * (coord1.sector_x - coord2.sector_x) ** 2 +
      w.sector_y * (coord1.sector_y - coord2.sector_y) ** 2 +
      w.cell_x * (coord1.cell_x - coord2.cell_x) ** 2 +
      w.cell_y * (coord1.cell_y - coord2.cell_y) ** 2 +
      w.z_band * (coord1.z_band - coord2.z_band) ** 2
    );
  }

  /**
   * Check if a plane is saturated based on the manifold configuration.
   */
  isPlaneSaturated(
    plane: string,
    entities: HardState[],
    manifoldConfig: ManifoldConfig,
    spaceId: CoordinateSpaceId
  ): boolean {
    // Find the plane hierarchy entry
    const planeHierarchy = manifoldConfig.planeHierarchy.find(ph => ph.planeId === plane);
    if (!planeHierarchy) {
      // Unknown plane - assume not saturated
      return false;
    }

    // Count entities on this plane
    const entitiesOnPlane = entities.filter(e => {
      const coord = e.coordinates?.[spaceId];
      return coord && coord.plane === plane;
    });

    const count = entitiesOnPlane.length;

    switch (manifoldConfig.saturationStrategy) {
      case 'count':
        const countThreshold = manifoldConfig.countThreshold ?? 50;
        return count >= countThreshold;

      case 'density':
        // Calculate density as count relative to saturation threshold
        // A threshold of 0.7 at 100 entities = saturated
        const densityThreshold = manifoldConfig.densityThreshold ?? 0.7;
        const maxDensityEntities = 100; // Baseline for density calculation
        const density = count / maxDensityEntities;
        return density >= densityThreshold * planeHierarchy.saturationThreshold;

      case 'failures':
        // This strategy is tracked externally (consecutive placement failures)
        // Here we just return false and let the caller track failures
        return false;

      default:
        return false;
    }
  }

  /**
   * Get the next available plane in the hierarchy when the current plane is saturated.
   * Returns null if no child planes are available.
   */
  getNextAvailablePlane(
    currentPlane: string,
    entities: HardState[],
    manifoldConfig: ManifoldConfig,
    spaceId: CoordinateSpaceId
  ): string | null {
    // Find the current plane's hierarchy entry
    const currentHierarchy = manifoldConfig.planeHierarchy.find(ph => ph.planeId === currentPlane);
    if (!currentHierarchy) {
      return null;
    }

    // Check each child plane in order
    for (const childPlane of currentHierarchy.children) {
      if (!this.isPlaneSaturated(childPlane, entities, manifoldConfig, spaceId)) {
        return childPlane;
      }
    }

    // All children are saturated, try grandchildren
    for (const childPlane of currentHierarchy.children) {
      const result = this.getNextAvailablePlane(childPlane, entities, manifoldConfig, spaceId);
      if (result) {
        return result;
      }
    }

    return null;
  }

  /**
   * Get the primary (root/highest priority) plane from the manifold config.
   */
  getPrimaryPlane(manifoldConfig: ManifoldConfig): string {
    // Find the plane with lowest priority (filled first)
    const sorted = [...manifoldConfig.planeHierarchy].sort((a, b) => a.priority - b.priority);
    return sorted[0]?.planeId ?? '';
  }

  /**
   * Get all planes in the manifold hierarchy in fill order (by priority).
   */
  getPlanesInOrder(manifoldConfig: ManifoldConfig): string[] {
    return [...manifoldConfig.planeHierarchy]
      .sort((a, b) => a.priority - b.priority)
      .map(ph => ph.planeId);
  }

  /**
   * Get axis weights from domain schema or use defaults.
   */
  getAxisWeights(
    entityKind: string,
    spaceId: CoordinateSpaceId,
    overrides?: Partial<AxisWeights>
  ): AxisWeights {
    const spaceDef = this.domain.getCoordinateSpace?.(entityKind, spaceId);

    // Build weights from axis definitions
    const fromDef: Partial<AxisWeights> = {};
    if (spaceDef) {
      fromDef.plane = spaceDef.axes.plane.distanceWeight;
      fromDef.sector_x = spaceDef.axes.sector_x.distanceWeight;
      fromDef.sector_y = spaceDef.axes.sector_y.distanceWeight;
      fromDef.cell_x = spaceDef.axes.cell_x.distanceWeight;
      fromDef.cell_y = spaceDef.axes.cell_y.distanceWeight;
      fromDef.z_band = spaceDef.axes.z_band.distanceWeight;
    }

    // Merge: defaults < schema definition < explicit overrides
    return {
      ...DEFAULT_AXIS_WEIGHTS,
      ...Object.fromEntries(Object.entries(fromDef).filter(([_, v]) => v !== undefined)),
      ...overrides
    } as AxisWeights;
  }
}
