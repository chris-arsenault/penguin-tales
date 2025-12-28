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

import type { NarrativeEventKind, NarrativeStateChange, Prominence } from '@canonry/world-schema';
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
      // Deaths and endings are more significant
      if (newValue === 'dead' || newValue === 'historical' || newValue === 'dissolved') {
        score += 0.3;
      }
      // Wars starting/ending
      if (newValue === 'at_war' || change.previousValue === 'at_war') {
        score += 0.2;
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
