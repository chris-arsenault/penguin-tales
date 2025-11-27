/**
 * Coordinate System Types
 *
 * Implements a generalized 6-axis coordinate template that can represent
 * both physical and semantic spaces. Based on COORDINATES.md design.
 *
 * The 6-axis template:
 * - plane: Which "map" the entity exists on (categorical)
 * - sector_x, sector_y: Coarse grid position (typically numeric)
 * - cell_x, cell_y: Fine grid position within sector
 * - z_band: Vertical layer/tier
 *
 * Also supports simplified region-based coordinates (Point) for
 * narrative-driven placement where mechanical distance matters less.
 */

import type { HardState } from './worldTypes';
import type { Graph } from './engine';
import type { Point } from './regions';

// ===========================
// AXIS VALUE TYPES
// ===========================

/**
 * Axis value type classification
 * - enum: Discrete named values (e.g., 'political', 'criminal', 'arcane')
 * - numeric: Continuous numeric scale (e.g., 0.0 to 100.0)
 * - hierarchical: Tree-structured values with depth (e.g., galaxy > system > station)
 */
export type AxisValueType = 'enum' | 'numeric' | 'hierarchical';

/**
 * Runtime axis value - can be string (enum/hierarchical) or number (numeric)
 */
export type AxisValue = string | number;

// ===========================
// COORDINATE STRUCTURE
// ===========================

/**
 * The unified 6-axis coordinate structure.
 * All entity kinds use this same shape with domain-specific semantics.
 */
export interface Coordinate {
  /** Which "map" or domain the entity exists on */
  plane: AxisValue;

  /** Coarse grid X position (sector/region) */
  sector_x: AxisValue;

  /** Coarse grid Y position (sector/region) */
  sector_y: AxisValue;

  /** Fine grid X position (cell/room within sector) */
  cell_x: AxisValue;

  /** Fine grid Y position (cell/room within sector) */
  cell_y: AxisValue;

  /** Vertical layer or tier */
  z_band: AxisValue;
}

/**
 * Coordinate space identifiers.
 * Entities can exist in multiple coordinate spaces simultaneously.
 */
export type CoordinateSpaceId =
  | 'physical'     // Spatial location in the world
  | 'political'    // Political alignment/affiliation
  | 'social'       // Social hierarchy/network position
  | 'magical'      // Magical domain/affinity
  | 'ideological'  // Ideological position
  | string;        // Domain-extensible

/**
 * Collection of coordinates across multiple spaces.
 * An entity might have physical coordinates AND political coordinates.
 */
export type EntityCoordinates = Partial<Record<CoordinateSpaceId, Coordinate>>;

/**
 * Extended coordinates that include region-based placement.
 * Use this when working with region coordinates (Point type).
 */
export type ExtendedEntityCoordinates = EntityCoordinates & {
  /** Simplified region-based coordinates (x, y, z normalized 0-100) */
  region?: Point;
};

// ===========================
// AXIS DEFINITIONS
// ===========================

/**
 * Enum value definition for categorical axes
 */
export interface EnumValue {
  /** Unique identifier for this value */
  id: string;

  /** Human-readable label */
  label: string;

  /** Numeric equivalent for distance calculations (0.0 to 1.0) */
  numericValue: number;

  /** Optional description */
  description?: string;
}

/**
 * Hierarchy level definition for hierarchical axes
 */
export interface HierarchyLevel {
  /** Level identifier */
  id: string;

  /** Human-readable label */
  label: string;

  /** Depth in hierarchy (0 = root) */
  depth: number;
}

/**
 * Axis definition within a coordinate space.
 * Defines what each axis means semantically for a given entity kind.
 */
export interface AxisDefinition {
  /** Human-readable name/label for this axis (e.g., 'Life Domain', 'Surface Type') */
  name?: string;

  /** Description of what this axis represents */
  description?: string;

  /** Type of values for this axis */
  valueType: AxisValueType;

  /** For enum axes: valid values with numeric equivalents */
  enumValues?: EnumValue[];

  /** For numeric axes: range bounds */
  numericRange?: { min: number; max: number };

  /** For hierarchical axes: level definitions */
  hierarchyLevels?: HierarchyLevel[];

  /** Weight multiplier for distance calculation (default: 1.0) */
  distanceWeight?: number;

  /** Default value if not explicitly set */
  defaultValue?: AxisValue;
}

// ===========================
// COORDINATE SPACE DEFINITION
// ===========================

/**
 * Computation strategy for deriving axis values from entity attributes
 */
export interface CoordinateComputation {
  /** Human-readable description of what this computes */
  description: string;

  /**
   * Computation strategy:
   * - 'attribute': Direct mapping from entity attribute
   * - 'tag_based': Derived from entity tags
   * - 'relationship_based': Derived from relationship patterns
   * - 'custom': Custom function
   */
  strategy: 'attribute' | 'tag_based' | 'relationship_based' | 'custom';

  /** For 'attribute' strategy: which attribute path to read (e.g., 'prominence', 'culture') */
  attributePath?: string;

  /** For 'tag_based' strategy: tag matching rules */
  tagRules?: Array<{
    pattern: string | RegExp;
    value: AxisValue;
  }>;

  /** For 'relationship_based' strategy: relationship analysis config */
  relationshipRules?: {
    kinds: string[];
    direction: 'src' | 'dst' | 'both';
    aggregation: 'count' | 'centrality' | 'average_strength';
  };

  /** For 'custom' strategy: computation function */
  compute?: (entity: HardState, graph: Graph) => AxisValue;
}

/**
 * Complete coordinate space definition.
 * Defines how coordinates work for entity kinds in a particular space.
 * A single space can apply to multiple entity kinds (e.g., physical space
 * for locations, NPCs, and factions that share the same geographic model).
 */
export interface CoordinateSpaceDefinition {
  /** Unique identifier for this coordinate space (e.g., 'physical', 'social') */
  id: CoordinateSpaceId;

  /** Entity kinds this space applies to (e.g., ['location', 'npc', 'faction']) */
  entityKinds: string[];

  /** Human-readable name for this coordinate space */
  name: string;

  /** Description of what this space represents */
  description: string;

  /** Axis definitions for each of the 6 standard axes */
  axes: {
    plane: AxisDefinition;
    sector_x: AxisDefinition;
    sector_y: AxisDefinition;
    cell_x: AxisDefinition;
    cell_y: AxisDefinition;
    z_band: AxisDefinition;
  };

  /**
   * Cross-plane distance function (optional).
   * If not provided, entities on different planes have infinite distance.
   * @returns Distance multiplier (1.0 = adjacent planes, Infinity = unreachable)
   */
  crossPlaneDistance?: (plane1: string, plane2: string) => number;

  /**
   * Custom distance function (optional).
   * If provided, overrides default Euclidean calculation.
   */
  customDistanceFunction?: (c1: Coordinate, c2: Coordinate) => number;

  /**
   * Computation functions to derive axis values from entity attributes.
   * Used by templates/systems when computing coordinates for new entities.
   */
  computations?: Partial<Record<keyof Coordinate, CoordinateComputation>>;
}

// ===========================
// PLACEMENT OPTIONS
// ===========================

/**
 * Options for placeNear() operation
 */
export interface PlaceNearOptions {
  /** Maximum distance from reference point */
  maxDistance?: number;

  /** Minimum distance from reference point (to avoid overlap) */
  minDistance?: number;

  /** Constrain placement to specific plane(s) */
  constrainPlanes?: string[];

  /** Constrain placement to specific z_band(s) */
  constrainZBands?: AxisValue[];

  /** Bias toward specific axis direction */
  directionalBias?: {
    axis: 'sector_x' | 'sector_y' | 'cell_x' | 'cell_y';
    direction: 'positive' | 'negative';
    strength: number; // 0-1
  };
}

/**
 * Options for placeWithin() operation
 */
export interface PlaceWithinOptions {
  /** Prefer center of bounds vs random within */
  preferCenter?: boolean;

  /** Apply jitter to avoid identical positions */
  jitter?: number;

  /** Constrain to specific z_band(s) within bounds */
  constrainZBands?: AxisValue[];
}

/**
 * Options for placeAvoiding() operation
 */
export interface PlaceAvoidingOptions {
  /** Minimum separation distance from existing positions */
  minSeparation: number;

  /** Bounds to place within */
  bounds?: CoordinateBounds;

  /** Maximum attempts before giving up */
  maxAttempts?: number;
}

/**
 * Options for findNearest() query
 */
export interface FindNearestOptions {
  /** Maximum number of results */
  limit?: number;

  /** Maximum distance to search */
  maxDistance?: number;

  /** Constrain to specific planes */
  constrainPlanes?: string[];

  /** Constrain to specific z_bands */
  constrainZBands?: AxisValue[];

  /** Filter by entity criteria */
  filter?: {
    kind?: string;
    subtype?: string;
    status?: string;
    tags?: string[];
  };
}

/**
 * Coordinate bounds for region queries
 */
export interface CoordinateBounds {
  plane?: string;
  sector_x?: { min: number; max: number };
  sector_y?: { min: number; max: number };
  cell_x?: { min: number; max: number };
  cell_y?: { min: number; max: number };
  z_band?: AxisValue[];
}

// ===========================
// RESULT TYPES
// ===========================

/**
 * Result of a nearest-neighbor query
 */
export interface NearestResult {
  /** The entity found */
  entity: HardState;

  /** Its coordinates in the queried space */
  coordinates: Coordinate;

  /** Distance to query point */
  distance: number;
}

/**
 * Result of a placement operation
 */
export interface PlacementResult {
  /** Generated coordinates */
  coordinates: Coordinate;

  /** Distance from reference (if applicable) */
  distanceFromReference?: number;

  /** Diagnostic information */
  diagnostics?: {
    attemptsUsed?: number;
    nearestObstacleDistance?: number;
    /** For cross-plane placements, the original plane before cascade */
    cascadedFrom?: string;
  };
}

// ===========================
// PLACEMENT SCHEMES
// ===========================

/**
 * Available placement algorithm kinds.
 * Each kind has different mathematical properties suited to different use cases.
 */
export type PlacementSchemeKind =
  | 'poisson_disk'          // Blue noise with guaranteed minimum spacing (Bridson's algorithm)
  | 'halton_sequence'       // Low-discrepancy quasi-random sequence
  | 'jittered_grid'         // Regular grid with random offset per cell
  | 'gaussian_cluster'      // Gaussian distribution around a center point
  | 'anchor_colocated'      // Exact copy of anchor entity's coordinates
  | 'centroid_colocated'    // Average position of reference entities
  | 'attraction_repulsion'  // Force-based placement using relationships
  | 'exclusion_aware'       // Wrapper that adds exclusion zones to any scheme
  | 'cross_plane_poisson'   // 6D Poisson disk with cross-plane support
  | 'saturation_cascade';   // Cascade to child planes on saturation

/**
 * Base interface for all placement schemes
 */
export interface PlacementSchemeBase {
  /** The algorithm to use */
  kind: PlacementSchemeKind;

  /** Which coordinate space to place in */
  spaceId: CoordinateSpaceId;

  /** Whether multiple entities can occupy the same position */
  allowCoLocation: boolean;
}

// ----------------------------
// Distribution Schemes (Non-Co-located)
// ----------------------------

/**
 * Poisson Disk Sampling - Blue noise distribution
 *
 * Uses Bridson's algorithm to generate points with guaranteed minimum spacing.
 * Produces natural-looking, organic distributions with O(N) complexity.
 *
 * Best for: Colony placement, resource distribution, NPC homes
 */
export interface PoissonDiskPlacement extends PlacementSchemeBase {
  kind: 'poisson_disk';
  allowCoLocation: false;

  /** Minimum distance between points (normalized 0-1 of space range) */
  minDistance: number;

  /** Samples per point before giving up (default: 30) */
  maxSamplesPerPoint?: number;

  /** Region to fill with points */
  bounds?: CoordinateBounds;

  /** Constrain to specific plane */
  constrainPlane?: string;

  /** Constrain to specific z_band(s) */
  constrainZBands?: AxisValue[];
}

/**
 * Halton Sequence - Low-discrepancy quasi-random
 *
 * Generates deterministic, reproducible point distributions that fill
 * space more uniformly than pure random. Best for < 200 points.
 *
 * Best for: Landmark placement, systematic coverage, reproducible tests
 */
export interface HaltonSequencePlacement extends PlacementSchemeBase {
  kind: 'halton_sequence';
  allowCoLocation: false;

  /** Starting index in sequence (for continuation) */
  startIndex?: number;

  /** Bases for x,y generation (default: [2, 3]) */
  bases?: [number, number];

  /** Region to place within */
  bounds?: CoordinateBounds;

  /** Constrain to specific plane */
  constrainPlane?: string;

  /** Constrain to specific z_band(s) */
  constrainZBands?: AxisValue[];
}

/**
 * Jittered Grid - Regular coverage with controlled randomness
 *
 * Divides space into cells and places one point per cell with random offset.
 * Guarantees coverage of all regions while avoiding pure grid patterns.
 *
 * Best for: Initial seed placement, systematic exploration
 */
export interface JitteredGridPlacement extends PlacementSchemeBase {
  kind: 'jittered_grid';
  allowCoLocation: false;

  /** Number of grid divisions on X axis */
  gridDivisionsX: number;

  /** Number of grid divisions on Y axis */
  gridDivisionsY: number;

  /** Maximum jitter as fraction of cell size (0-1, default: 0.5) */
  jitterAmount?: number;

  /** Region to divide into grid */
  bounds?: CoordinateBounds;

  /** Constrain to specific plane */
  constrainPlane?: string;

  /** Constrain to specific z_band(s) */
  constrainZBands?: AxisValue[];
}

// ----------------------------
// Cluster Schemes
// ----------------------------

/**
 * Gaussian Cluster - Natural density falloff
 *
 * Places entities following a 2D Gaussian distribution centered on a point.
 * Produces dense centers with natural density falloff toward edges.
 *
 * Best for: Population around settlements, resources near sources
 */
export interface GaussianClusterPlacement extends PlacementSchemeBase {
  kind: 'gaussian_cluster';
  /** Gaussian allows colocation for conceptual entities (rules, events) */
  allowCoLocation: boolean;

  /** Center point: coordinate or entity ID to use as center */
  center: Coordinate | string;

  /** Standard deviation (controls spread, normalized 0-1) */
  sigma: number;

  /** Hard maximum distance from center (optional cutoff) */
  maxDistance?: number;

  /** Constrain to specific plane (inherits from center if not specified) */
  constrainPlane?: string;

  /** Constrain to specific z_band(s) */
  constrainZBands?: AxisValue[];
}

// ----------------------------
// Co-location Schemes
// ----------------------------

/**
 * Anchor Co-location - Exact position copy
 *
 * Copies coordinates exactly from an anchor entity.
 * Zero computational cost, perfect co-location.
 *
 * Best for: Abilities at locations, technologies at workshops
 */
export interface AnchorColocatedPlacement extends PlacementSchemeBase {
  kind: 'anchor_colocated';
  allowCoLocation: true;

  /** Entity ID to copy coordinates from */
  anchorEntityId: string;
}

/**
 * Centroid Co-location - Average of reference positions
 *
 * Computes the centroid (average) of multiple reference entity positions.
 * Represents the "center" of a distributed phenomenon.
 *
 * Best for: Shared beliefs, faction ideologies, cultural practices
 */
export interface CentroidColocatedPlacement extends PlacementSchemeBase {
  kind: 'centroid_colocated';
  allowCoLocation: true;

  /** Entity IDs to average positions from */
  referenceEntityIds: string[];
}

// ----------------------------
// Constraint-Based Schemes
// ----------------------------

/**
 * Attraction/Repulsion - Force-based placement
 *
 * Places entities based on attraction to related entities and repulsion
 * from unrelated/hostile entities. Uses relationship kinds from schema.
 *
 * Best for: Allied factions clustering, criminals avoiding authorities
 */
export interface AttractionRepulsionPlacement extends PlacementSchemeBase {
  kind: 'attraction_repulsion';
  allowCoLocation: false;

  /** Relationship kinds that attract (entity pulled toward related entities) */
  attractByRelationship?: Array<{
    /** Relationship kind from schema */
    kind: string;
    /** Attraction strength (higher = stronger pull) */
    strength: number;
  }>;

  /** Relationship kinds that repel (entity pushed away from related entities) */
  repelByRelationship?: Array<{
    /** Relationship kind from schema */
    kind: string;
    /** Repulsion strength (higher = stronger push) */
    strength: number;
  }>;

  /** Region to place within */
  bounds?: CoordinateBounds;

  /** Constrain to specific plane */
  constrainPlane?: string;

  /** Maximum iterations for force simulation (default: 100) */
  maxIterations?: number;

  /** Convergence threshold (stop when movement < this, default: 0.001) */
  convergenceThreshold?: number;
}

/**
 * Exclusion-Aware - Wrapper adding exclusion zones
 *
 * Wraps any other placement scheme and rejects placements that fall
 * within exclusion zones or too close to specified entities.
 *
 * Best for: Minimum colony separation, sacred zone avoidance
 */
export interface ExclusionAwarePlacement extends PlacementSchemeBase {
  kind: 'exclusion_aware';

  /** The underlying placement algorithm */
  baseScheme: AnyPlacementScheme;

  /** Static exclusion zones (coordinates must not fall within these bounds) */
  exclusionZones?: CoordinateBounds[];

  /** Dynamic exclusion based on existing entities */
  excludeNearEntities?: Array<{
    /** Entity kind to avoid (optional, all kinds if not specified) */
    kind?: string;
    /** Minimum distance to maintain from these entities */
    minDistance: number;
  }>;

  /** Maximum placement attempts before giving up (default: 100) */
  maxAttempts?: number;
}

// ===========================
// 6-DIMENSIONAL PLACEMENT
// ===========================

/**
 * Plane hierarchy definition for saturation cascade.
 * Defines which planes to cascade to when a plane becomes saturated.
 */
export interface PlaneHierarchy {
  /** Plane identifier */
  planeId: string;

  /** Child planes to cascade to when this plane is saturated */
  children: string[];

  /** Density threshold (0-1) at which to consider this plane saturated */
  saturationThreshold: number;

  /** Priority order for filling (lower = fill first) */
  priority: number;
}

/**
 * Manifold configuration for cross-plane placement.
 * Controls how entities can be placed across multiple planes.
 */
export interface ManifoldConfig {
  /** Plane hierarchy definitions */
  planeHierarchy: PlaneHierarchy[];

  /**
   * Strategy for determining saturation:
   * - 'density': Based on entity density in the plane
   * - 'count': Based on raw entity count
   * - 'failures': Based on consecutive placement failures
   */
  saturationStrategy: 'density' | 'count' | 'failures';

  /** Threshold for 'density' strategy (0-1) */
  densityThreshold?: number;

  /** Threshold for 'count' strategy (max entities per plane) */
  countThreshold?: number;

  /** Threshold for 'failures' strategy (consecutive failures before cascade) */
  failureThreshold?: number;
}

/**
 * Normalized 6-dimensional coordinate for placement algorithms.
 * All values are in [0,1] range for uniform distance calculation.
 */
export interface NormalizedCoordinate {
  plane: number;
  sector_x: number;
  sector_y: number;
  cell_x: number;
  cell_y: number;
  z_band: number;
}

/**
 * Axis weights for 6D distance calculation.
 * Higher weight = axis contributes more to distance.
 */
export interface AxisWeights {
  plane: number;
  sector_x: number;
  sector_y: number;
  cell_x: number;
  cell_y: number;
  z_band: number;
}

/**
 * Default axis weights (all equal at 1.0)
 */
export const DEFAULT_AXIS_WEIGHTS: AxisWeights = {
  plane: 1.0,
  sector_x: 1.0,
  sector_y: 1.0,
  cell_x: 1.0,
  cell_y: 1.0,
  z_band: 1.0
};

// ----------------------------
// Cross-Plane Placement Schemes
// ----------------------------

/**
 * Cross-plane Poisson disk sampling.
 * Uses 6D spatial hashing to ensure minimum distance across all dimensions.
 * Can place entities on different planes when saturation is detected.
 */
export interface CrossPlanePoissonPlacement extends PlacementSchemeBase {
  kind: 'cross_plane_poisson';
  allowCoLocation: false;

  /** Enable cross-plane placement */
  allowCrossPlane: true;

  /** Minimum distance between points (normalized 0-1) */
  minDistance: number;

  /** Override default axis weights */
  axisWeights?: Partial<AxisWeights>;

  /** Override manifold config from domain schema */
  manifoldConfig?: ManifoldConfig;

  /** Preferred starting plane (default: first in hierarchy) */
  preferredPlane?: string;

  /** Samples per point before giving up (default: 30) */
  maxSamplesPerPoint?: number;
}

/**
 * Saturation cascade placement.
 * Places on preferred plane, cascades to children when saturated.
 * Uses 2D placement within each plane.
 */
export interface SaturationCascadePlacement extends PlacementSchemeBase {
  kind: 'saturation_cascade';
  allowCoLocation: false;

  /** Enable cross-plane placement */
  allowCrossPlane: true;

  /** Base 2D placement scheme to use within each plane */
  basePlacementScheme: PoissonDiskPlacement | HaltonSequencePlacement | JitteredGridPlacement | GaussianClusterPlacement;

  /** Override manifold config from domain schema */
  manifoldConfig?: ManifoldConfig;

  /** Override default axis weights for saturation calculation */
  axisWeights?: Partial<AxisWeights>;

  /** Preferred starting plane (default: first in hierarchy) */
  preferredPlane?: string;
}

/**
 * Event emitted when placement cascades to a new plane
 */
export interface CascadeEvent {
  /** ID of the entity that was cascaded */
  entityId: string;

  /** Original target plane */
  fromPlane: string;

  /** Actual placement plane */
  toPlane: string;

  /** Reason for cascade */
  reason: 'saturation' | 'placement_failure';
}

/**
 * Extended batch placement result with cascade events
 */
export interface CrossPlaneBatchPlacementResult extends BatchPlacementResult {
  /** Cascade events that occurred during placement */
  cascadeEvents: CascadeEvent[];
}

/**
 * Union type for all placement schemes
 */
export type AnyPlacementScheme =
  | PoissonDiskPlacement
  | HaltonSequencePlacement
  | JitteredGridPlacement
  | GaussianClusterPlacement
  | AnchorColocatedPlacement
  | CentroidColocatedPlacement
  | AttractionRepulsionPlacement
  | ExclusionAwarePlacement
  | CrossPlanePoissonPlacement
  | SaturationCascadePlacement;

// ----------------------------
// Placement API Types
// ----------------------------

/**
 * Options for addEntityWithPlacement
 */
export interface EntityPlacementOptions {
  /** Primary placement scheme */
  scheme: AnyPlacementScheme;

  /** Fallback scheme if primary fails (optional) */
  fallbackScheme?: AnyPlacementScheme;

  /** Custom validation function (return false to reject placement) */
  validatePlacement?: (coord: Coordinate) => boolean;
}

/**
 * Options for batch placement
 */
export interface BatchPlacementOptions {
  /** Primary placement scheme */
  scheme: AnyPlacementScheme;

  /** Fallback scheme if primary fails */
  fallbackScheme?: AnyPlacementScheme;

  /** Custom validation function */
  validatePlacement?: (coord: Coordinate) => boolean;
}

/**
 * Result of a batch placement operation
 */
export interface BatchPlacementResult {
  /** IDs of successfully placed entities */
  placedEntityIds: string[];

  /** Entities that failed to place (with reason) */
  failures: Array<{
    entityIndex: number;
    reason: string;
  }>;

  /** Diagnostic summary */
  diagnostics: {
    totalAttempts: number;
    successCount: number;
    failureCount: number;
  };
}

/**
 * Default placement scheme configuration per entity kind.
 * Domains define these in their schema.
 */
export interface DefaultPlacementSchemes {
  [entityKind: string]: AnyPlacementScheme;
}
