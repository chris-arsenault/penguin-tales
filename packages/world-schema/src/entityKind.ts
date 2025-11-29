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
 * A semantic axis defines a dimension of meaning for entity placement
 */
export interface SemanticAxis {
  /** Display name for the axis */
  name: string;
  /** Label for the low end (0) of the axis */
  lowLabel: string;
  /** Label for the high end (100) of the axis */
  highLabel: string;
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
 * A region within a semantic plane
 */
export interface SemanticRegion {
  id: string;
  label: string;
  color: string;
  /** Culture that "owns" this region (optional) */
  culture?: string;
  bounds: CircleBounds | RectBounds;
}

/**
 * A semantic plane is a 3D conceptual space for placing entities of a kind
 */
export interface SemanticPlane {
  axes: {
    x: SemanticAxis;
    y: SemanticAxis;
    z: SemanticAxis;
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
}

/**
 * Complete definition of an entity kind
 */
export interface EntityKindDefinition {
  /** Unique identifier (e.g., "npc", "location", "faction") */
  id: string;
  /** Display name (e.g., "NPCs", "Locations") */
  name: string;
  /** Human-readable description */
  description?: string;
  /** Valid subtypes for this entity kind */
  subtypes: Subtype[];
  /** Valid status values for this entity kind */
  statuses: Status[];
  /** Default status for new entities of this kind */
  defaultStatus?: string;
  /** Visual styling for UI */
  style?: EntityKindStyle;
  /** Semantic placement configuration (Cosmographer) */
  semanticPlane?: SemanticPlane;
}
