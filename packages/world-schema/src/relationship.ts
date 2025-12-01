/**
 * Relationship Kind Types
 *
 * Defines the types of relationships that can exist between entities.
 */

/**
 * Definition of a relationship kind
 */
export interface RelationshipKindDefinition {
  /** Unique identifier (e.g., "member_of", "controls") */
  id: string;
  /** Display name (e.g., "Member Of", "Controls") */
  name: string;
  /** Human-readable description */
  description?: string;
  /** Entity kinds that can be the source of this relationship */
  srcKinds: string[];
  /** Entity kinds that can be the destination of this relationship */
  dstKinds: string[];
  /** If true, A→B implies B→A */
  symmetric?: boolean;
  /** Optional category for grouping (e.g., "social", "political", "economic") */
  category?: string;
}
