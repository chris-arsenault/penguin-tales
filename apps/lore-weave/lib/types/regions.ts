/**
 * Region-Based Coordinate System
 *
 * Each entity kind has its own independent 2D coordinate map with optional z.
 * This supports both physical entities (locations, NPCs) and conceptual entities
 * (rules, abilities) that have no physical location analog.
 *
 * Key concepts:
 * - EntityKindMap: A 2D coordinate space for a single entity kind
 * - Region: A named area within a kind's map with narrative meaning
 * - Point: Simple {x, y, z?} coordinate within a kind's map
 */

// ============================================================================
// CORE COORDINATE TYPE (simplified)
// ============================================================================

/**
 * Simple 3D coordinate. Framework only does math on these.
 */
export interface Point {
  x: number;  // 0-100 normalized
  y: number;  // 0-100 normalized
  z: number;  // 0-100 normalized (depth/layer/power level)
}

/**
 * Default coordinate space bounds.
 */
export const SPACE_BOUNDS = {
  min: 0,
  max: 100
};

// ============================================================================
// REGION DEFINITIONS
// ============================================================================

/**
 * Shape types for region boundaries.
 */
export type RegionShape = 'circle' | 'rect' | 'polygon';

/**
 * Circle region bounds.
 */
export interface CircleBounds {
  shape: 'circle';
  center: { x: number; y: number };
  radius: number;
}

/**
 * Rectangle region bounds.
 */
export interface RectBounds {
  shape: 'rect';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/**
 * Polygon region bounds.
 */
export interface PolygonBounds {
  shape: 'polygon';
  points: Array<{ x: number; y: number }>;
}

/**
 * Union of all bounds types.
 */
export type RegionBounds = CircleBounds | RectBounds | PolygonBounds;

/**
 * A named region in coordinate space.
 */
export interface Region {
  /** Unique identifier */
  id: string;

  /** Human-readable name */
  label: string;

  /** Narrative description */
  description: string;

  /** Spatial bounds */
  bounds: RegionBounds;

  /** Optional z-range constraint */
  zRange?: { min: number; max: number };

  /** Tags to auto-apply to entities in this region */
  autoTags?: string[];

  /** Parent region (for nested regions like city within planet) */
  parentRegion?: string;

  /** Whether this region was created dynamically */
  emergent?: boolean;

  /** Tick when region was created (for emergent regions) */
  createdAt?: number;

  /** Entity that triggered creation (for emergent regions) */
  createdBy?: string;

  /** Custom metadata */
  metadata?: Record<string, unknown>;
}

// ============================================================================
// REGION REGISTRY
// ============================================================================

/**
 * Configuration for finding/creating emergent regions.
 */
export interface EmergentRegionConfig {
  /** Minimum distance from existing regions */
  minDistanceFromExisting: number;

  /** Default radius for new circular regions */
  defaultRadius: number;

  /** Default z-range for new regions */
  defaultZRange?: { min: number; max: number };

  /** Maximum attempts to find valid position */
  maxAttempts: number;

  /** Bias toward certain areas */
  preferredArea?: {
    center: { x: number; y: number };
    weight: number;  // 0-1, how strongly to prefer
  };
}

/**
 * Result of emergent region creation.
 */
export interface EmergentRegionResult {
  success: boolean;
  region?: Region;
  failureReason?: string;
}

/**
 * Options for finding a point within a region.
 */
export interface SampleRegionOptions {
  /** Existing points to avoid (for Poisson-like spacing) */
  avoid?: Point[];

  /** Minimum distance from avoided points */
  minDistance?: number;

  /** Prefer center vs edges */
  centerBias?: number;  // 0 = uniform, 1 = strongly prefer center

  /** Specific z value (otherwise random within zRange) */
  z?: number;
}

/**
 * Result of region lookup.
 */
export interface RegionLookupResult {
  /** Primary region containing the point */
  primary: Region | null;

  /** All regions containing the point (for overlaps) */
  all: Region[];

  /** Nearest region if not in any */
  nearest?: {
    region: Region;
    distance: number;
  };
}

// ============================================================================
// REGION MAPPER INTERFACE
// ============================================================================

/**
 * Configuration for the region mapper.
 */
export interface RegionMapperConfig {
  /** Pre-defined regions */
  regions: Region[];

  /** Label for points not in any region */
  defaultRegionLabel: string;

  /** Tags to apply to entities not in any region */
  defaultTags?: string[];

  /** Allow emergent region creation */
  allowEmergent: boolean;

  /** Config for emergent regions */
  emergentConfig?: EmergentRegionConfig;
}

/**
 * Event emitted when a region is created.
 */
export interface RegionCreatedEvent {
  region: Region;
  trigger: 'manual' | 'emergent';
  nearPoint?: Point;
  tick: number;
}

/**
 * Event emitted when an entity is placed in a region.
 */
export interface EntityPlacedInRegionEvent {
  entityId: string;
  point: Point;
  region: Region | null;
  appliedTags: string[];
}

// ============================================================================
// PER-KIND COORDINATE MAPS
// ============================================================================

/**
 * Bounds for a coordinate map.
 */
export interface MapBounds {
  x: { min: number; max: number };
  y: { min: number; max: number };
  z?: { min: number; max: number };
}

/**
 * Configuration for a single entity kind's coordinate map.
 *
 * Each entity kind has its own independent 2D (or 3D) coordinate space.
 * This allows physical entities (locations) and conceptual entities (rules)
 * to have completely separate spatial models.
 */
export interface EntityKindMapConfig {
  /** Entity kind this map is for */
  entityKind: string;

  /** Human-readable name for this map */
  name: string;

  /** Description of what this coordinate space represents */
  description: string;

  /** Coordinate bounds (default 0-100 for each axis) */
  bounds: MapBounds;

  /** Whether z-coordinate is used */
  hasZAxis: boolean;

  /** Label for the z-axis if used (e.g., "Depth", "Power Level", "Abstraction") */
  zAxisLabel?: string;

  /** Configuration for emergent region creation */
  emergentConfig: EmergentRegionConfig;

  /** Initial seed regions (optional - most regions should be emergent) */
  seedRegions?: Region[];
}

/**
 * Runtime state for a kind's coordinate map.
 * Includes both config and dynamically created regions.
 */
export interface EntityKindMapState {
  /** The configuration */
  config: EntityKindMapConfig;

  /** All regions (seed + emergent) */
  regions: Region[];

  /** Tick when last region was created */
  lastRegionCreatedAt?: number;
}

/**
 * Collection of all entity kind maps.
 */
export type EntityKindMaps = Record<string, EntityKindMapConfig>;

/**
 * Runtime state for all kind maps.
 */
export type EntityKindMapsState = Record<string, EntityKindMapState>;
