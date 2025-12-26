/**
 * Narrative Tag Generator
 *
 * Generates semantic tags for narrative events to enable
 * filtering and categorization in story generation.
 */

import type { NarrativeEventKind, NarrativeStateChange, NarrativeEntityRef } from '@canonry/world-schema';
import { getProminenceValue } from './significanceCalculator.js';

export interface TagContext {
  entityKinds: Set<string>;
}

/**
 * Generate narrative tags for an event
 */
export function generateNarrativeTags(
  eventKind: NarrativeEventKind,
  subject: NarrativeEntityRef,
  object: NarrativeEntityRef | undefined,
  stateChanges: NarrativeStateChange[],
  action: string,
  _context: TagContext
): string[] {
  const tags: Set<string> = new Set();

  // Event kind tag
  tags.add(eventKind);

  // Event kind specific tags
  if (eventKind === 'succession') {
    tags.add('leadership');
    tags.add('transition');
  }
  if (eventKind === 'coalescence') {
    tags.add('unification');
    tags.add('formation');
  }
  if (eventKind === 'relationship_dissolved') {
    tags.add('dissolution');
    tags.add('ended');
  }
  // Polarity-based relationship events
  if (eventKind === 'betrayal') {
    tags.add('treachery');
    tags.add('broken_trust');
    tags.add('dramatic');
  }
  if (eventKind === 'reconciliation') {
    tags.add('peace');
    tags.add('healing');
    tags.add('resolution');
  }
  if (eventKind === 'rivalry_formed') {
    tags.add('conflict');
    tags.add('enmity');
    tags.add('tension');
  }
  if (eventKind === 'alliance_formed') {
    tags.add('cooperation');
    tags.add('unity');
    tags.add('pact');
  }
  // Status polarity events
  if (eventKind === 'downfall') {
    tags.add('tragedy');
    tags.add('decline');
    tags.add('loss');
  }
  if (eventKind === 'triumph') {
    tags.add('victory');
    tags.add('success');
    tags.add('achievement');
  }
  // Authority events
  if (eventKind === 'power_vacuum') {
    tags.add('leadership');
    tags.add('crisis');
    tags.add('uncertainty');
  }

  // State change tags
  for (const change of stateChanges) {
    if (change.field === 'status') {
      const newValue = String(change.newValue);
      const oldValue = String(change.previousValue);

      // Death/ending tags
      if (newValue === 'dead') {
        tags.add('death');
        tags.add('mortality');
      }
      if (newValue === 'historical' || newValue === 'dissolved') {
        tags.add('ended');
        tags.add('concluded');
      }

      // War tags
      if (oldValue === 'at_war' && newValue !== 'at_war') {
        tags.add('peace');
        tags.add('war_end');
      }
      if (newValue === 'at_war') {
        tags.add('war');
        tags.add('conflict');
      }
    }

    // Prominence change tags
    if (change.field === 'prominence') {
      const oldProminence = getProminenceValue(String(change.previousValue));
      const newProminence = getProminenceValue(String(change.newValue));

      if (newProminence > oldProminence) {
        tags.add('rise');
        tags.add('ascension');
      } else if (newProminence < oldProminence) {
        tags.add('fall');
        tags.add('decline');
      }
    }
  }

  // Entity kind tags
  tags.add(subject.kind);
  if (subject.kind === 'npc') tags.add('character');
  if (subject.kind === 'faction') tags.add('political');
  if (subject.kind === 'location') tags.add('geographic');
  if (subject.kind === 'era') tags.add('temporal');

  if (object) {
    tags.add(`target_${object.kind}`);
  }

  // Action-based tags
  const actionLower = action.toLowerCase();
  if (actionLower.includes('war') || actionLower.includes('attack') || actionLower.includes('battle')) {
    tags.add('conflict');
    tags.add('war');
  }
  if (actionLower.includes('alliance') || actionLower.includes('ally') || actionLower.includes('join')) {
    tags.add('cooperation');
    tags.add('alliance');
  }
  if (actionLower.includes('die') || actionLower.includes('death') || actionLower.includes('kill')) {
    tags.add('death');
    tags.add('violence');
  }
  if (actionLower.includes('discover') || actionLower.includes('found') || actionLower.includes('reveal')) {
    tags.add('discovery');
    tags.add('exploration');
  }

  return Array.from(tags);
}
