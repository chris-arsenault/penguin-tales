/**
 * Relationship Kind Types
 *
 * Defines the types of relationships that can exist between entities.
 */

/**
 * Polarity indicates the nature of a relationship or status for narrative purposes.
 * - positive: cooperative, beneficial (allies, friends, promoted)
 * - neutral: neither beneficial nor harmful (trades_with, knows)
 * - negative: hostile, harmful (rivals, enemies, exiled)
 */
export type Polarity = 'positive' | 'neutral' | 'negative';

/**
 * Definition of a relationship kind
 */
export interface RelationshipKindDefinition {
  /** Unique identifier (e.g., "member_of", "controls") */
  kind: string;
  /** Display name (e.g., "Member Of", "Controls") */
  name?: string;
  /** Human-readable description */
  description?: string;
  /** True if this relationship is defined by the framework and is read-only in editors */
  isFramework?: boolean;
  /** Entity kinds that can be the source of this relationship */
  srcKinds: string[];
  /** Entity kinds that can be the destination of this relationship */
  dstKinds: string[];
  /** If true, A→B implies B→A */
  symmetric?: boolean;
  /** Optional category for grouping (e.g., "social", "political", "economic") */
  category?: string;
  /** If false, this relationship is immutable (used by simulation) */
  cullable?: boolean;
  /** Decay rate used by simulation systems */
  decayRate?: 'none' | 'slow' | 'medium' | 'fast';
  /**
   * Narrative polarity of this relationship kind.
   * Used by the narrative system to detect betrayals, alliances, rivalries.
   * - positive: allies, friends, supporters
   * - neutral: trades_with, knows, neighbor_of
   * - negative: rivals, enemies, opposes
   */
  polarity?: Polarity;
}
