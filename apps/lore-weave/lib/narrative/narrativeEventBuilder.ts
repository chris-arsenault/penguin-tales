/**
 * Narrative Event Builder
 *
 * Creates NarrativeEvent objects from state changes during simulation.
 * Used to capture semantically meaningful world changes for story generation.
 */

import type {
  NarrativeEvent,
  NarrativeEventKind,
  NarrativeEntityRef,
  NarrativeStateChange,
} from '@canonry/world-schema';
import type { HardState } from '../core/worldTypes.js';
import { calculateSignificance, getProminenceValue } from './significanceCalculator.js';
import { generateNarrativeTags } from './narrativeTagGenerator.js';

export interface NarrativeContext {
  tick: number;
  eraId: string;
  getEntity: (id: string) => HardState | undefined;
  getEntityRelationships: (id: string) => { kind: string; src: string; dst: string }[];
}

/**
 * Builder for creating narrative events from simulation state changes
 */
export class NarrativeEventBuilder {
  private eventIdCounter = 0;
  private context: NarrativeContext;

  constructor(context: NarrativeContext) {
    this.context = context;
  }

  /**
   * Update context (call at start of each tick)
   */
  updateContext(context: NarrativeContext): void {
    this.context = context;
  }

  /**
   * Generate unique event ID
   */
  private generateId(): string {
    return `event-${this.context.tick}-${++this.eventIdCounter}`;
  }

  /**
   * Build entity reference from HardState
   */
  private buildEntityRef(entity: HardState): NarrativeEntityRef {
    return {
      id: entity.id,
      name: entity.name,
      kind: entity.kind,
      subtype: entity.subtype,
    };
  }

  /**
   * Determine event kind from state changes
   */
  private determineEventKind(stateChanges: NarrativeStateChange[]): NarrativeEventKind {
    const hasStatusChange = stateChanges.some(c => c.field === 'status');
    const hasProminenceChange = stateChanges.some(c => c.field === 'prominence');
    const isDeath = stateChanges.some(c =>
      c.field === 'status' &&
      (c.newValue === 'dead' || c.newValue === 'historical' || c.newValue === 'dissolved')
    );
    const isWar = stateChanges.some(c =>
      c.field === 'status' && (c.newValue === 'at_war' || c.previousValue === 'at_war')
    );

    if (isDeath) return 'entity_lifecycle';
    if (isWar) return 'conflict';
    if (hasProminenceChange) return 'achievement';
    if (hasStatusChange) return 'state_change';
    return 'state_change';
  }

  /**
   * Infer action from state changes
   */
  private inferAction(stateChanges: NarrativeStateChange[]): string {
    for (const change of stateChanges) {
      if (change.field === 'status') {
        if (change.newValue === 'dead') return 'died';
        if (change.newValue === 'historical') return 'ended';
        if (change.newValue === 'dissolved') return 'dissolved';
        if (change.newValue === 'at_war') return 'went_to_war';
        if (change.previousValue === 'at_war') return 'made_peace';
      }
      if (change.field === 'prominence') {
        const oldVal = getProminenceValue(String(change.previousValue));
        const newVal = getProminenceValue(String(change.newValue));
        if (newVal > oldVal) return 'rose_in_prominence';
        if (newVal < oldVal) return 'fell_in_prominence';
      }
    }
    return 'changed';
  }

  /**
   * Generate headline from entity and changes
   */
  private generateHeadline(entity: HardState, stateChanges: NarrativeStateChange[]): string {
    for (const change of stateChanges) {
      if (change.field === 'status') {
        if (change.newValue === 'dead') {
          return `${entity.name} dies`;
        }
        if (change.newValue === 'historical') {
          return `${entity.name} comes to an end`;
        }
        if (change.newValue === 'dissolved') {
          return `${entity.name} dissolves`;
        }
        if (change.newValue === 'at_war') {
          return `${entity.name} goes to war`;
        }
        if (change.previousValue === 'at_war' && change.newValue !== 'at_war') {
          return `${entity.name} makes peace`;
        }
      }
      if (change.field === 'prominence') {
        const oldVal = getProminenceValue(String(change.previousValue));
        const newVal = getProminenceValue(String(change.newValue));
        if (newVal > oldVal) {
          return `${entity.name} rises to ${change.newValue} prominence`;
        }
        if (newVal < oldVal) {
          return `${entity.name} falls to ${change.newValue} prominence`;
        }
      }
    }
    return `${entity.name} changes`;
  }

  /**
   * Generate description from entity and changes
   */
  private generateDescription(entity: HardState, stateChanges: NarrativeStateChange[]): string {
    const parts: string[] = [];

    for (const change of stateChanges) {
      if (change.field === 'status') {
        parts.push(`${entity.name} is now ${change.newValue} (was ${change.previousValue})`);
      } else if (change.field === 'prominence') {
        parts.push(`${entity.name}'s prominence changed from ${change.previousValue} to ${change.newValue}`);
      } else {
        parts.push(`${entity.name}'s ${change.field} changed from ${change.previousValue} to ${change.newValue}`);
      }
      if (change.reason) {
        parts.push(`Reason: ${change.reason}`);
      }
    }

    return parts.join('. ');
  }

  /**
   * Build a narrative event from state changes
   */
  buildStateChangeEvent(
    entityId: string,
    stateChanges: NarrativeStateChange[],
    catalyst?: { entityId: string; actionType: string }
  ): NarrativeEvent | null {
    const entity = this.context.getEntity(entityId);
    if (!entity) return null;
    if (stateChanges.length === 0) return null;

    const eventKind = this.determineEventKind(stateChanges);
    const action = this.inferAction(stateChanges);
    const headline = this.generateHeadline(entity, stateChanges);
    const description = this.generateDescription(entity, stateChanges);

    const significance = calculateSignificance(
      eventKind,
      entityId,
      stateChanges,
      this.context
    );

    const narrativeTags = generateNarrativeTags(
      eventKind,
      this.buildEntityRef(entity),
      undefined,
      stateChanges,
      action,
      { entityKinds: new Set() }
    );

    const event: NarrativeEvent = {
      id: this.generateId(),
      tick: this.context.tick,
      era: this.context.eraId,
      eventKind,
      significance,
      subject: this.buildEntityRef(entity),
      action,
      headline,
      description,
      stateChanges,
      causedBy: catalyst ? {
        entityId: catalyst.entityId,
        actionType: catalyst.actionType,
      } : undefined,
      narrativeTags,
    };

    return event;
  }

  /**
   * Build an era transition event
   */
  buildEraTransitionEvent(
    currentEra: HardState,
    nextEra: HardState,
    reason: string
  ): NarrativeEvent {
    const stateChange: NarrativeStateChange = {
      entityId: currentEra.id,
      entityName: currentEra.name,
      entityKind: 'era',
      field: 'status',
      previousValue: 'current',
      newValue: 'historical',
      reason,
    };

    return {
      id: this.generateId(),
      tick: this.context.tick,
      era: nextEra.id,
      eventKind: 'era_transition',
      significance: 0.95,
      subject: this.buildEntityRef(currentEra),
      action: 'ended',
      object: this.buildEntityRef(nextEra),
      headline: `The ${currentEra.name} ends. The ${nextEra.name} begins.`,
      description: `${reason}. The world enters a new era.`,
      stateChanges: [stateChange],
      narrativeTags: ['era', 'transition', 'historical', 'temporal'],
    };
  }

  /**
   * Build a relationship change event
   */
  buildRelationshipEvent(
    sourceEntity: HardState,
    targetEntity: HardState,
    relationshipKind: string,
    action: 'formed' | 'dissolved' | 'changed',
    catalyst?: { entityId: string; actionType: string }
  ): NarrativeEvent {
    const eventKind: NarrativeEventKind = relationshipKind.includes('war') || relationshipKind.includes('enemy')
      ? 'conflict'
      : relationshipKind.includes('ally') || relationshipKind.includes('alliance')
        ? 'alliance'
        : 'relationship_change';

    const actionVerbs = {
      formed: 'established',
      dissolved: 'broke',
      changed: 'changed',
    };

    const headline = `${sourceEntity.name} ${actionVerbs[action]} ${relationshipKind} with ${targetEntity.name}`;

    const significance = calculateSignificance(
      eventKind,
      sourceEntity.id,
      [],
      this.context
    );

    return {
      id: this.generateId(),
      tick: this.context.tick,
      era: this.context.eraId,
      eventKind,
      significance: Math.min(1.0, significance + 0.1), // Relationship events get small boost
      subject: this.buildEntityRef(sourceEntity),
      action: `${action}_${relationshipKind}`,
      object: this.buildEntityRef(targetEntity),
      headline,
      description: `A ${relationshipKind} relationship was ${action} between ${sourceEntity.name} and ${targetEntity.name}.`,
      stateChanges: [],
      causedBy: catalyst ? {
        entityId: catalyst.entityId,
        actionType: catalyst.actionType,
      } : undefined,
      narrativeTags: generateNarrativeTags(
        eventKind,
        this.buildEntityRef(sourceEntity),
        this.buildEntityRef(targetEntity),
        [],
        action,
        { entityKinds: new Set() }
      ),
    };
  }
}
