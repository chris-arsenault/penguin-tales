/**
 * Region-Based Coordinate System
 *
 * Pure mechanical coordinates (x, y, z) with narrative meaning provided
 * by domain-defined regions. Framework handles math, domain handles meaning.
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
