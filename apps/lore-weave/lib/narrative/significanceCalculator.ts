/**
 * Significance Calculator
 *
 * Calculates narrative significance scores (0.0-1.0) for events.
 * Higher scores indicate more narratively important events.
 *
 * Score ranges:
 * - 0.9+ = World-changing (era transitions, major deaths)
 * - 0.5-0.8 = Significant (wars ending, prominence shifts)
 * - 0.3-0.5 = Notable (relationship changes)
 * - <0.3 = Noise (filtered out by default)
 */

import type { NarrativeEventKind, NarrativeStateChange, Polarity, Prominence, TagDefinition } from '@canonry/world-schema';
import type { HardState } from '../core/worldTypes.js';

export interface SignificanceContext {
  getEntity: (id: string) => HardState | undefined;
  getEntityRelationships: (id: string) => { kind: string; src: string; dst: string }[];
}

const PROMINENCE_VALUES: Record<Prominence, number> = {
  mythic: 5,
  renowned: 4,
  recognized: 3,
  marginal: 2,
  forgotten: 1,
};

/**
 * Calculate significance score for a narrative event
 */
export function calculateSignificance(
  eventKind: NarrativeEventKind,
  subjectId: string,
  stateChanges: NarrativeStateChange[],
  context: SignificanceContext
): number {
  let score = 0.0;

  // Base scores by event kind
  const kindScores: Record<NarrativeEventKind, number> = {
    // Core events
    entity_lifecycle: 0.5,         // Deaths, births are significant
    era_transition: 0.9,           // Era changes are very significant
    state_change: 0.3,             // Base for state changes
    relationship_dissolved: 0.4,   // Breaking ties is notable
    relationship_ended: 0.4,       // Lifecycle-driven endings are notable
    succession: 0.6,               // Leadership transitions are significant
    coalescence: 0.5,              // Multiple entities uniting is notable
    // Polarity-based relationship events
    betrayal: 0.7,                 // Breaking positive bonds is dramatic
    reconciliation: 0.5,           // Ending enmity is notable
    rivalry_formed: 0.5,           // New conflicts are significant
    alliance_formed: 0.4,          // New alliances matter
    relationship_formed: 0.35,     // Single relationship formed (base, modified by calculateRelationshipFormationSignificance)
    // Status polarity events
    downfall: 0.6,                 // Negative status transitions are significant
    triumph: 0.5,                  // Positive status transitions are notable
    // Leadership events
    leadership_established: 0.6,   // First leadership is significant
    // War events
    war_started: 0.8,              // Wars starting are dramatic
    war_ended: 0.7,                // Wars ending are significant
    // Authority events
    power_vacuum: 0.7,             // Leadership gaps are dramatic
    // Tag events (base score, modified by calculateTagSignificance)
    tag_gained: 0.3,               // Base for tag gains
    tag_lost: 0.25,                // Base for tag losses
    // Creation events (base score, modified by calculateCreationBatchSignificance)
    creation_batch: 0.3,           // Base for creation batches
  };
  score += kindScores[eventKind] || 0.2;

  // Prominence multiplier - mythic entities = more significant
  const prominenceMultipliers: Record<Prominence, number> = {
    mythic: 1.5,
    renowned: 1.3,
    recognized: 1.1,
    marginal: 0.9,
    forgotten: 0.5,
  };

  const entity = context.getEntity(subjectId);
  if (entity) {
    const multiplier = prominenceMultipliers[entity.prominence as Prominence] || 1.0;
    score *= multiplier;
  }

  // Status change severity
  for (const change of stateChanges) {
    if (change.field === 'status') {
      const newValue = String(change.newValue);
      // Endings are more significant
      if (newValue === 'historical' || newValue === 'dissolved') {
        score += 0.3;
      }
    }

    // Prominence changes
    if (change.field === 'prominence') {
      const oldProminence = PROMINENCE_VALUES[change.previousValue as Prominence] || 0;
      const newProminence = PROMINENCE_VALUES[change.newValue as Prominence] || 0;
      const delta = Math.abs(newProminence - oldProminence);
      score += delta * 0.1; // Each level of prominence change adds significance
    }
  }

  // Connected entities - more connections = more significance
  if (entity) {
    const connections = context.getEntityRelationships(subjectId).length;
    score += Math.min(0.2, connections * 0.01); // Cap at 0.2 bonus
  }

  // Cap at 1.0
  return Math.min(1.0, score);
}

/**
 * Get prominence value for comparison
 */
export function getProminenceValue(prominence: string): number {
  return PROMINENCE_VALUES[prominence as Prominence] || 0;
}

/**
 * Category weights for tag significance
 * Higher weights for tags that represent narratively important state changes
 */
const TAG_CATEGORY_WEIGHTS: Record<string, number> = {
  status: 0.4,       // Status changes are narratively important
  behavior: 0.35,    // Behavioral shifts matter
  trait: 0.3,        // Character development
  affiliation: 0.3,  // Group membership changes
  theme: 0.25,       // Thematic associations
  location: 0.2,     // Location attributes (lower)
};

/**
 * Rarity multipliers for tag significance
 * Rare tags are more significant when gained/lost
 */
const TAG_RARITY_MULTIPLIERS: Record<string, number> = {
  rare: 1.5,
  uncommon: 1.2,
  common: 1.0,
};

/**
 * High-value tags that get a significance bonus
 * These tags represent major narrative moments
 */
const HIGH_VALUE_TAGS = new Set([
  'wounded', 'maimed', 'corrupted', 'legendary', 'hostile',
  'leader', 'war_leader', 'armed_raider', 'crisis', 'war_weary',
  'discovered', 'ancient', 'sacred', 'cursed',
]);

/**
 * Calculate significance score for a tag change event.
 *
 * Uses tag metadata (category, rarity) and entity prominence to determine
 * how narratively important the tag change is.
 *
 * @param tag - The tag that was added or removed
 * @param tagMetadata - Registry entry for the tag (if available)
 * @param entity - The entity whose tag changed
 * @param changeType - Whether the tag was 'added' or 'removed'
 * @returns Significance score between 0.0 and 1.0
 */
export function calculateTagSignificance(
  tag: string,
  tagMetadata: TagDefinition | undefined,
  entity: HardState,
  changeType: 'added' | 'removed'
): number {
  // Base significance by category
  const category = tagMetadata?.category || 'trait';
  let base = TAG_CATEGORY_WEIGHTS[category] ?? 0.25;

  // Rarity modifier
  const rarity = tagMetadata?.rarity || 'common';
  base *= TAG_RARITY_MULTIPLIERS[rarity] ?? 1.0;

  // Entity prominence modifier
  const prominenceMultipliers: Record<Prominence, number> = {
    mythic: 1.5,
    renowned: 1.3,
    recognized: 1.1,
    marginal: 0.9,
    forgotten: 0.5,
  };
  base *= prominenceMultipliers[entity.prominence as Prominence] ?? 1.0;

  // High-value tag bonus
  if (HIGH_VALUE_TAGS.has(tag)) {
    base += 0.2;
  }

  // Losing a tag is slightly less significant than gaining it
  if (changeType === 'removed') {
    base *= 0.9;
  }

  return Math.min(1.0, base);
}

/**
 * Calculate significance score for a creation batch event.
 *
 * Uses entity count, relationship count, and primary entity prominence
 * to determine how narratively important the creation is.
 *
 * @param entities - The entities created in this batch
 * @param relationshipCount - Number of relationships created
 * @returns Significance score between 0.0 and 1.0
 */
export function calculateCreationBatchSignificance(
  entities: HardState[],
  relationshipCount: number
): number {
  if (entities.length === 0) return 0;

  // Base significance for creation
  let base = 0.3;

  // Entity count bonus: +0.05 per entity (cap +0.2)
  const entityBonus = Math.min(0.2, (entities.length - 1) * 0.05);
  base += entityBonus;

  // Relationship count bonus: +0.02 per relationship (cap +0.1)
  const relationshipBonus = Math.min(0.1, relationshipCount * 0.02);
  base += relationshipBonus;

  // Primary entity prominence multiplier (first entity is the "subject")
  const primaryEntity = entities[0];
  const prominenceMultipliers: Record<Prominence, number> = {
    mythic: 1.5,
    renowned: 1.3,
    recognized: 1.1,
    marginal: 0.9,
    forgotten: 0.5,
  };
  const prominenceMultiplier = prominenceMultipliers[primaryEntity.prominence as Prominence] ?? 1.0;
  base *= prominenceMultiplier;

  return Math.min(1.0, base);
}

/**
 * Calculate significance score for a relationship formation event.
 *
 * Uses relationship polarity and entity prominence to determine
 * how narratively important the new relationship is.
 *
 * @param srcEntity - The source entity in the relationship
 * @param dstEntity - The destination entity in the relationship
 * @param polarity - The polarity of the relationship kind (if any)
 * @returns Significance score between 0.0 and 1.0
 */
export function calculateRelationshipFormationSignificance(
  srcEntity: HardState,
  dstEntity: HardState,
  polarity: Polarity | undefined
): number {
  // Base significance
  let base = 0.35;

  // Polarity modifier - polarized relationships are more narratively interesting
  if (polarity === 'positive') {
    base += 0.1; // Alliances, friendships are notable
  } else if (polarity === 'negative') {
    base += 0.15; // Conflicts, enmities are more dramatic
  }
  // Neutral relationships stay at base

  // Average prominence multiplier (use higher of the two)
  const prominenceMultipliers: Record<Prominence, number> = {
    mythic: 1.5,
    renowned: 1.3,
    recognized: 1.1,
    marginal: 0.9,
    forgotten: 0.5,
  };
  const srcMult = prominenceMultipliers[srcEntity.prominence as Prominence] ?? 1.0;
  const dstMult = prominenceMultipliers[dstEntity.prominence as Prominence] ?? 1.0;
  const prominenceMultiplier = Math.max(srcMult, dstMult);
  base *= prominenceMultiplier;

  return Math.min(1.0, base);
}
