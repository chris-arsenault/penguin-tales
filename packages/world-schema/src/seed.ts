/**
 * Seed Data Types
 *
 * Seed entities and relationships are the initial state of the world
 * before simulation begins.
 */

/**
 * Prominence level for entities
 */
export type Prominence = 'forgotten' | 'marginal' | 'recognized' | 'renowned' | 'mythic';

/**
 * 3D coordinates in semantic space
 */
export interface SemanticCoordinates {
  x: number;
  y: number;
  z: number;
}

/**
 * A seed entity is an initial entity in the world
 */
export interface SeedEntity {
  /** Unique identifier */
  id: string;
  /** Entity kind (must match an entityKind.id) */
  kind: string;
  /** Subtype (must match a subtype.id within the entity kind) */
  subtype: string;
  /** Display name */
  name: string;
  /** Description of the entity */
  description: string;
  /** Status (must match a status.id within the entity kind) */
  status: string;
  /** Prominence level */
  prominence: Prominence;
  /** Culture this entity belongs to (must match a culture.id) */
  culture?: string;
  /** Tags for categorization and condition matching */
  tags: string[];
  /** Position in semantic space (0-100 on each axis) */
  coordinates?: SemanticCoordinates;
}

/**
 * A seed relationship is an initial relationship between entities
 */
export interface SeedRelationship {
  /** Unique identifier */
  id: string;
  /** Relationship kind (must match a relationshipKind.id) */
  kind: string;
  /** Source entity ID */
  srcId: string;
  /** Destination entity ID */
  dstId: string;
  /** Relationship strength (0-1) */
  strength?: number;
}
