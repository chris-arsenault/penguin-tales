/**
 * Coordinate System Types
 *
 * Types for the region-based coordinate system and semantic axis encoding.
 *
 * =============================================================================
 * CRITICAL CONCEPT: SEMANTIC PLANES ARE PER-ENTITY-KIND
 * =============================================================================
 *
 * Each entity kind (npc, location, faction, abilities, rules, etc.) has its own
 * INDEPENDENT semantic plane. Coordinates represent SEMANTIC SIMILARITY within
 * that kind, NOT physical/spatial location.
 *
 * For example:
 * - Two NPCs close together on the NPC plane are semantically similar
 *   (similar roles, traits, cultural background)
 * - Two locations close together on the location plane are semantically similar
 *   (similar terrain types, strategic importance, resources)
 *
 * CROSS-KIND COORDINATES ARE MEANINGLESS:
 * - An NPC's coordinates have NO relationship to a location's coordinates
 * - Placing an NPC "near" a location is NONSENSICAL - they exist on different planes
 * - The x,y values between different entity kinds cannot be compared
 *
 * CORRECT USAGE:
 * - near_entity placement: Reference entity MUST be the same kind as the new entity
 * - Lineage relationships can cross kinds (an ability can be derived_from a location)
 *   but the placement must use a same-kind reference or random/culture placement
 *
 * Key concepts:
 * - EntityKindMap: A 2D coordinate space for a single entity kind
 * - Region: A named area within a kind's map with narrative meaning
 * - Point: Simple {x, y, z?} coordinate within a kind's map
 * - SemanticAxis: Meaningful axis for coordinate derivation from tags
 */

// ============================================================================
// CORE COORDINATE TYPE
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
 * Matches cosmographer's region structure.
 */
export interface Region {
  /** Unique identifier */
  id: string;

  /** Human-readable name */
  label: string;

  /** Display color (hex string) */
  color?: string;

  /** Culture that owns/inhabits this region (used to derive seedRegionIds) */
  culture?: string | null;

  /** Spatial bounds */
  bounds: RegionBounds;

  /** Optional z-range constraint */
  zRange?: { min: number; max: number };

  /** Narrative description (optional) */
  description?: string;

  /** Tags to apply to entities placed in this region */
  tags?: string[];

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
 * Result of finding a sparse area on a semantic plane.
 */
export interface SparseAreaResult {
  success: boolean;
  coordinates?: Point;
  /** Minimum distance to nearest entity (score of how "sparse" the area is) */
  minDistanceToEntity?: number;
  failureReason?: string;
}

/**
 * Options for finding a sparse area.
 */
export interface SparseAreaOptions {
  /** Minimum required distance from any existing entity (default: 15) */
  minDistanceFromEntities: number;
  /** Bias toward plane edges/periphery (default: false) */
  preferPeriphery: boolean;
  /** Maximum sampling attempts (default: 50) */
  maxAttempts?: number;
  /** Existing entity positions to avoid */
  existingPositions: Point[];
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

// ============================================================================
// SEMANTIC AXIS SYSTEM
// ============================================================================

/**
 * Definition of a single semantic axis.
 * Matches cosmographer's axis structure.
 */
export interface SemanticAxis {
  /** Axis identifier (e.g., 'source', 'scope', 'alignment') */
  name: string;

  /** Tag at position 0 - applied to entities at low axis values */
  lowTag: string;

  /** Tag at position 100 - applied to entities at high axis values */
  highTag: string;
}

/**
 * Complete axis configuration for an entity kind.
 */
export interface EntityKindAxes {
  /** Entity kind this configuration applies to */
  entityKind: string;

  /** X-axis definition */
  x: SemanticAxis;

  /** Y-axis definition */
  y: SemanticAxis;

  /** Z-axis definition */
  z: SemanticAxis;
}

/**
 * Semantic weight for a tag on a specific axis.
 * Value 0-100 indicates position on the axis.
 */
export interface TagSemanticWeight {
  /** Axis name this weight applies to */
  axis: string;

  /** Position on the axis (0-100) */
  value: number;
}

/**
 * Extended tag metadata with semantic weights.
 */
export interface TagSemanticWeights {
  /** Tag name */
  tag: string;

  /** Weights per entity kind and axis */
  weights: {
    [entityKind: string]: {
      [axisName: string]: number;  // 0-100
    };
  };
}

/**
 * Result of semantic encoding.
 */
export interface SemanticEncodingResult {
  /** Encoded coordinates */
  coordinates: {
    x: number;
    y: number;
    z: number;
  };

  /** Tags that contributed to encoding */
  contributingTags: string[];

  /** Tags that had no weights configured (defaulted to 50) */
  unconfiguredTags: string[];

  /** Whether encoding used any configured weights */
  hasConfiguredWeights: boolean;
}

/**
 * Configuration for the semantic encoder.
 */
export interface SemanticEncoderConfig {
  /** Axis definitions per entity kind */
  axes: EntityKindAxes[];

  /** Tag weights */
  tagWeights: TagSemanticWeights[];

  /** Whether to warn about unconfigured tags */
  warnOnUnconfiguredTags: boolean;
}
