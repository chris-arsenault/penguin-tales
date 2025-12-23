/**
 * Entity Kind Types
 *
 * Defines the structure and constraints for entity types in a world.
 */

/**
 * A subtype within an entity kind (e.g., "merchant" for NPC kind)
 */
export interface Subtype {
  id: string;
  name: string;
}

/**
 * A status value for an entity kind (e.g., "alive", "dead" for NPC)
 */
export interface Status {
  id: string;
  name: string;
  /** If true, entities with this status are considered "ended" and won't be modified */
  isTerminal: boolean;
}

/**
 * Required relationship rule for structural validation
 */
export interface RequiredRelationshipRule {
  /** Relationship kind that must exist */
  kind: string;
  /** Human-readable description of why this is required */
  description?: string;
}

/**
 * A semantic axis reference points to a registered axis definition
 */
export interface SemanticAxis {
  /** Reference to axisDefinitions[].id */
  axisId: string;
}

/**
 * Circle-shaped region bounds
 */
export interface CircleBounds {
  shape: 'circle';
  center: { x: number; y: number };
  radius: number;
}

/**
 * Rectangle-shaped region bounds
 */
export interface RectBounds {
  shape: 'rect';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/**
 * Polygon-shaped region bounds
 */
export interface PolygonBounds {
  shape: 'polygon';
  points: Array<{ x: number; y: number }>;
}

/**
 * Union type for all region bound shapes
 */
export type RegionBounds = CircleBounds | RectBounds | PolygonBounds;

/**
 * A region within a semantic plane
 */
export interface SemanticRegion {
  id: string;
  label: string;
  /** Display color (hex string, optional) */
  color?: string;
  /** Culture that "owns" this region (optional) */
  culture?: string | null;
  /** Tags to apply to entities placed in this region */
  tags?: string[];
  /** Narrative description (optional) */
  description?: string;
  /** Optional z-range constraint */
  zRange?: { min: number; max: number };
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
  bounds: RegionBounds;
}

/**
 * A semantic plane is a 3D conceptual space for placing entities of a kind
 */
export interface SemanticPlane {
  axes: {
    x?: SemanticAxis;
    y?: SemanticAxis;
    z?: SemanticAxis;
  };
  regions: SemanticRegion[];
}

/**
 * Visual styling for an entity kind
 */
export interface EntityKindStyle {
  /** Hex color for visualization */
  color?: string;
  /** Shape for graph visualization (e.g., 'ellipse', 'diamond', 'hexagon') */
  shape?: string;
  /** Display name for UI (defaults to description/kind) */
  displayName?: string;
}

/**
 * Complete definition of an entity kind
 */
export interface EntityKindDefinition {
  /** Unique identifier (e.g., "npc", "location", "faction") */
  kind: string;
  /** Human-readable description (used as display name) */
  description?: string;
  /** True if this kind is defined by the framework and is read-only in editors */
  isFramework?: boolean;
  /** Valid subtypes for this entity kind */
  subtypes: Subtype[];
  /** Valid status values for this entity kind */
  statuses: Status[];
  /** Relationships required for this entity kind to be structurally valid */
  requiredRelationships?: RequiredRelationshipRule[];
  /** Default status for new entities of this kind */
  defaultStatus?: string;
  /** Visual styling for UI */
  style?: EntityKindStyle;
  /** Semantic placement configuration (Cosmographer) */
  semanticPlane?: SemanticPlane;

  // === Illuminator: Visual Identity ===
  /**
   * Which visual identity keys from culture.visualIdentity to include in image prompts.
   * e.g., ["ATTIRE", "SPECIES"] for NPCs, ["ARCHITECTURE", "SPECIES"] for locations.
   */
  visualIdentityKeys?: string[];
}
