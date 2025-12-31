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
  Polarity,
  TagDefinition,
} from '@canonry/world-schema';
import type { HardState } from '../core/worldTypes.js';
import { generateEventId } from '../core/idGeneration.js';
import { calculateSignificance, getProminenceValue, calculateTagSignificance, calculateCreationBatchSignificance, calculateRelationshipFormationSignificance } from './significanceCalculator.js';
import { generateNarrativeTags } from './narrativeTagGenerator.js';
import type { RelationshipSummary } from './stateChangeTracker.js';

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
    return generateEventId();
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

  private buildParticipantRefs(entities: HardState[]): NarrativeEntityRef[] {
    const seen = new Set<string>();
    const participants: NarrativeEntityRef[] = [];
    for (const entity of entities) {
      if (seen.has(entity.id)) continue;
      seen.add(entity.id);
      participants.push(this.buildEntityRef(entity));
    }
    return participants;
  }

  /**
   * Determine event kind from state changes
   */
  private determineEventKind(stateChanges: NarrativeStateChange[]): NarrativeEventKind {
    const hasStatusChange = stateChanges.some(c => c.field === 'status');
    const isDeath = stateChanges.some(c =>
      c.field === 'status' &&
      (c.newValue === 'historical' || c.newValue === 'dissolved')
    );

    if (isDeath) return 'entity_lifecycle';
    if (hasStatusChange) return 'state_change';
    return 'state_change';
  }

  /**
   * Infer action from state changes
   */
  private inferAction(stateChanges: NarrativeStateChange[]): string {
    for (const change of stateChanges) {
      if (change.field === 'status') {
        if (change.newValue === 'historical') return 'passed';
        if (change.newValue === 'dissolved') return 'dissolved';
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
        if (change.newValue === 'historical') {
          // Use appropriate verb based on entity kind
          if (entity.kind === 'npc') {
            return `${entity.name} passes`;
          }
          return `${entity.name} comes to an end`;
        }
        if (change.newValue === 'dissolved') {
          return `${entity.name} dissolves`;
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
      headline: `${currentEra.name} ends. ${nextEra.name} begins.`,
      description: `${reason}. The world enters a new era.`,
      stateChanges: [stateChange],
      narrativeTags: ['era', 'transition', 'historical', 'temporal'],
    };
  }

  /**
   * Build a relationship dissolution event
   * Only tracks dissolution - formation is too noisy
   */
  buildRelationshipDissolutionEvent(
    sourceEntity: HardState,
    targetEntity: HardState,
    relationshipKind: string,
    relationshipAge: number,
    catalyst?: { entityId: string; actionType: string }
  ): NarrativeEvent {
    const headline = `${sourceEntity.name} breaks ${relationshipKind} with ${targetEntity.name}`;

    const significance = calculateSignificance(
      'relationship_dissolved',
      sourceEntity.id,
      [],
      this.context
    );

    // Boost significance for long-standing relationships
    const ageBonus = Math.min(0.2, relationshipAge * 0.002); // +0.002 per tick, max +0.2

    return {
      id: this.generateId(),
      tick: this.context.tick,
      era: this.context.eraId,
      eventKind: 'relationship_dissolved',
      significance: Math.min(1.0, significance + ageBonus),
      subject: this.buildEntityRef(sourceEntity),
      action: `dissolved_${relationshipKind}`,
      object: this.buildEntityRef(targetEntity),
      participants: this.buildParticipantRefs([sourceEntity, targetEntity]),
      headline,
      description: `The ${relationshipKind} relationship between ${sourceEntity.name} and ${targetEntity.name} has ended after ${relationshipAge} ticks.`,
      stateChanges: [],
      causedBy: catalyst ? {
        entityId: catalyst.entityId,
        actionType: catalyst.actionType,
      } : undefined,
      narrativeTags: generateNarrativeTags(
        'relationship_dissolved',
        this.buildEntityRef(sourceEntity),
        this.buildEntityRef(targetEntity),
        [],
        'dissolved',
        { entityKinds: new Set() }
      ),
    };
  }

  /**
   * Build a succession event
   * Triggered when an entity with inbound part_of relationships becomes historical
   */
  buildSuccessionEvent(
    containerEntity: HardState,
    memberEntities: HardState[],
    catalyst?: { entityId: string; actionType: string }
  ): NarrativeEvent {
    const memberNames = memberEntities.slice(0, 3).map(e => e.name).join(', ');
    const moreCount = memberEntities.length > 3 ? ` and ${memberEntities.length - 3} others` : '';

    const headline = `${containerEntity.name} ends, leaving ${memberNames}${moreCount}`;

    const significance = calculateSignificance(
      'succession',
      containerEntity.id,
      [],
      this.context
    );

    // Boost significance based on number of members affected
    const memberBonus = Math.min(0.3, memberEntities.length * 0.05);

    return {
      id: this.generateId(),
      tick: this.context.tick,
      era: this.context.eraId,
      eventKind: 'succession',
      significance: Math.min(1.0, significance + memberBonus),
      subject: this.buildEntityRef(containerEntity),
      action: 'succession_triggered',
      participants: this.buildParticipantRefs([containerEntity, ...memberEntities]),
      headline,
      description: `${containerEntity.name} has come to an end. Its ${memberEntities.length} member(s) must now forge their own path.`,
      stateChanges: [{
        entityId: containerEntity.id,
        entityName: containerEntity.name,
        entityKind: containerEntity.kind,
        field: 'status',
        previousValue: 'active',
        newValue: 'historical',
      }],
      causedBy: catalyst ? {
        entityId: catalyst.entityId,
        actionType: catalyst.actionType,
      } : undefined,
      narrativeTags: generateNarrativeTags(
        'succession',
        this.buildEntityRef(containerEntity),
        undefined,
        [],
        'succession',
        { entityKinds: new Set() }
      ),
    };
  }

  /**
   * Build a coalescence event
   * Triggered when multiple entities join under a single container via part_of
   */
  buildCoalescenceEvent(
    containerEntity: HardState,
    newMemberEntities: HardState[],
    catalyst?: { entityId: string; actionType: string }
  ): NarrativeEvent {
    const memberNames = newMemberEntities.slice(0, 3).map(e => e.name).join(', ');
    const moreCount = newMemberEntities.length > 3 ? ` and ${newMemberEntities.length - 3} others` : '';

    const headline = `${memberNames}${moreCount} unite under ${containerEntity.name}`;

    const significance = calculateSignificance(
      'coalescence',
      containerEntity.id,
      [],
      this.context
    );

    // Boost significance based on number of members joining
    const memberBonus = Math.min(0.3, newMemberEntities.length * 0.05);

    return {
      id: this.generateId(),
      tick: this.context.tick,
      era: this.context.eraId,
      eventKind: 'coalescence',
      significance: Math.min(1.0, significance + memberBonus),
      subject: this.buildEntityRef(containerEntity),
      action: 'coalescence',
      participants: this.buildParticipantRefs([containerEntity, ...newMemberEntities]),
      headline,
      description: `${newMemberEntities.length} entities have united under ${containerEntity.name}, forming a larger collective.`,
      stateChanges: [],
      causedBy: catalyst ? {
        entityId: catalyst.entityId,
        actionType: catalyst.actionType,
      } : undefined,
      narrativeTags: generateNarrativeTags(
        'coalescence',
        this.buildEntityRef(containerEntity),
        undefined,
        [],
        'coalescence',
        { entityKinds: new Set() }
      ),
    };
  }

  /**
   * Build a betrayal event (positive relationship dissolved)
   */
  buildBetrayalEvent(
    sourceEntity: HardState,
    targetEntity: HardState,
    relationshipKind: string,
    relationshipAge: number,
    catalyst?: { entityId: string; actionType: string }
  ): NarrativeEvent {
    const headline = `${sourceEntity.name} betrays ${targetEntity.name}`;

    const significance = calculateSignificance(
      'betrayal',
      sourceEntity.id,
      [],
      this.context
    );

    const ageBonus = Math.min(0.2, relationshipAge * 0.002);

    return {
      id: this.generateId(),
      tick: this.context.tick,
      era: this.context.eraId,
      eventKind: 'betrayal',
      significance: Math.min(1.0, significance + ageBonus),
      subject: this.buildEntityRef(sourceEntity),
      action: 'betrayed',
      object: this.buildEntityRef(targetEntity),
      participants: this.buildParticipantRefs([sourceEntity, targetEntity]),
      headline,
      description: `The ${relationshipKind} bond between ${sourceEntity.name} and ${targetEntity.name} has been broken after ${relationshipAge} ticks.`,
      stateChanges: [],
      causedBy: catalyst ? {
        entityId: catalyst.entityId,
        actionType: catalyst.actionType,
      } : undefined,
      narrativeTags: generateNarrativeTags(
        'betrayal',
        this.buildEntityRef(sourceEntity),
        this.buildEntityRef(targetEntity),
        [],
        'betrayed',
        { entityKinds: new Set() }
      ),
    };
  }

  /**
   * Build a reconciliation event (negative relationship dissolved)
   */
  buildReconciliationEvent(
    sourceEntity: HardState,
    targetEntity: HardState,
    relationshipKind: string,
    catalyst?: { entityId: string; actionType: string }
  ): NarrativeEvent {
    const headline = `${sourceEntity.name} reconciles with ${targetEntity.name}`;

    const significance = calculateSignificance(
      'reconciliation',
      sourceEntity.id,
      [],
      this.context
    );

    return {
      id: this.generateId(),
      tick: this.context.tick,
      era: this.context.eraId,
      eventKind: 'reconciliation',
      significance,
      subject: this.buildEntityRef(sourceEntity),
      action: 'reconciled',
      object: this.buildEntityRef(targetEntity),
      participants: this.buildParticipantRefs([sourceEntity, targetEntity]),
      headline,
      description: `The ${relationshipKind} enmity between ${sourceEntity.name} and ${targetEntity.name} has ended.`,
      stateChanges: [],
      causedBy: catalyst ? {
        entityId: catalyst.entityId,
        actionType: catalyst.actionType,
      } : undefined,
      narrativeTags: generateNarrativeTags(
        'reconciliation',
        this.buildEntityRef(sourceEntity),
        this.buildEntityRef(targetEntity),
        [],
        'reconciled',
        { entityKinds: new Set() }
      ),
    };
  }

  /**
   * Build a rivalry formed event (negative relationship created between known entities)
   */
  buildRivalryFormedEvent(
    sourceEntity: HardState,
    targetEntity: HardState,
    relationshipKind: string,
    catalyst?: { entityId: string; actionType: string }
  ): NarrativeEvent {
    const headline = `${sourceEntity.name} becomes rivals with ${targetEntity.name}`;

    const significance = calculateSignificance(
      'rivalry_formed',
      sourceEntity.id,
      [],
      this.context
    );

    return {
      id: this.generateId(),
      tick: this.context.tick,
      era: this.context.eraId,
      eventKind: 'rivalry_formed',
      significance,
      subject: this.buildEntityRef(sourceEntity),
      action: 'became_rivals',
      object: this.buildEntityRef(targetEntity),
      participants: this.buildParticipantRefs([sourceEntity, targetEntity]),
      headline,
      description: `A ${relationshipKind} relationship has formed between ${sourceEntity.name} and ${targetEntity.name}.`,
      stateChanges: [],
      causedBy: catalyst ? {
        entityId: catalyst.entityId,
        actionType: catalyst.actionType,
      } : undefined,
      narrativeTags: generateNarrativeTags(
        'rivalry_formed',
        this.buildEntityRef(sourceEntity),
        this.buildEntityRef(targetEntity),
        [],
        'rivalry',
        { entityKinds: new Set() }
      ),
    };
  }

  /**
   * Build an alliance formed event (multiple positive relationships in same tick)
   */
  buildAllianceFormedEvent(
    entities: HardState[],
    relationshipKind: string,
    catalyst?: { entityId: string; actionType: string }
  ): NarrativeEvent {
    const names = entities.slice(0, 3).map(e => e.name).join(', ');
    const moreCount = entities.length > 3 ? ` and ${entities.length - 3} others` : '';
    const headline = `${names}${moreCount} form an alliance`;

    const significance = calculateSignificance(
      'alliance_formed',
      entities[0].id,
      [],
      this.context
    );

    const memberBonus = Math.min(0.2, entities.length * 0.03);

    return {
      id: this.generateId(),
      tick: this.context.tick,
      era: this.context.eraId,
      eventKind: 'alliance_formed',
      significance: Math.min(1.0, significance + memberBonus),
      subject: this.buildEntityRef(entities[0]),
      action: 'formed_alliance',
      participants: this.buildParticipantRefs(entities),
      headline,
      description: `${entities.length} entities have formed ${relationshipKind} bonds, creating a new alliance.`,
      stateChanges: [],
      causedBy: catalyst ? {
        entityId: catalyst.entityId,
        actionType: catalyst.actionType,
      } : undefined,
      narrativeTags: generateNarrativeTags(
        'alliance_formed',
        this.buildEntityRef(entities[0]),
        undefined,
        [],
        'alliance',
        { entityKinds: new Set() }
      ),
    };
  }

  /**
   * Build a relationship formed event (single relationship created by system)
   */
  buildRelationshipFormedEvent(
    sourceEntity: HardState,
    targetEntity: HardState,
    relationshipKind: string,
    polarity: Polarity | undefined,
    catalyst?: { entityId: string; actionType: string }
  ): NarrativeEvent {
    const headline = this.generateRelationshipHeadline(sourceEntity, targetEntity, relationshipKind, polarity);

    const significance = calculateRelationshipFormationSignificance(
      sourceEntity,
      targetEntity,
      polarity
    );

    return {
      id: this.generateId(),
      tick: this.context.tick,
      era: this.context.eraId,
      eventKind: 'relationship_formed',
      significance,
      subject: this.buildEntityRef(sourceEntity),
      action: `formed_${relationshipKind}`,
      object: this.buildEntityRef(targetEntity),
      participants: this.buildParticipantRefs([sourceEntity, targetEntity]),
      headline,
      description: `${sourceEntity.name} and ${targetEntity.name} have formed a ${relationshipKind} relationship.`,
      stateChanges: [],
      causedBy: catalyst ? {
        entityId: catalyst.entityId,
        actionType: catalyst.actionType,
      } : undefined,
      narrativeTags: generateNarrativeTags(
        'relationship_formed',
        this.buildEntityRef(sourceEntity),
        this.buildEntityRef(targetEntity),
        [],
        'relationship',
        { entityKinds: new Set() }
      ),
    };
  }

  /**
   * Generate headline for relationship formed events
   */
  private generateRelationshipHeadline(
    source: HardState,
    target: HardState,
    kind: string,
    polarity: Polarity | undefined
  ): string {
    // Relationship-kind specific headlines
    const kindHeadlines: Record<string, string> = {
      ally_of: `${source.name} allies with ${target.name}`,
      enemy_of: `${source.name} becomes enemies with ${target.name}`,
      trades_with: `${source.name} begins trade with ${target.name}`,
      friend_of: `${source.name} befriends ${target.name}`,
      mentor_of: `${source.name} mentors ${target.name}`,
      member_of: `${source.name} joins ${target.name}`,
      serves: `${source.name} enters service to ${target.name}`,
      resides_in: `${source.name} settles in ${target.name}`,
      rules: `${source.name} begins ruling ${target.name}`,
    };

    if (kindHeadlines[kind]) {
      return kindHeadlines[kind];
    }

    // Polarity-based fallback
    if (polarity === 'positive') {
      return `${source.name} forms a bond with ${target.name}`;
    } else if (polarity === 'negative') {
      return `${source.name} comes into conflict with ${target.name}`;
    }

    // Generic fallback
    return `${source.name} connects with ${target.name}`;
  }

  /**
   * Build a downfall event (status changed to negative polarity)
   */
  buildDownfallEvent(
    entity: HardState,
    previousStatus: string,
    newStatus: string,
    catalyst?: { entityId: string; actionType: string }
  ): NarrativeEvent {
    const headline = `${entity.name} falls to ${newStatus}`;

    const significance = calculateSignificance(
      'downfall',
      entity.id,
      [{
        entityId: entity.id,
        entityName: entity.name,
        entityKind: entity.kind,
        field: 'status',
        previousValue: previousStatus,
        newValue: newStatus,
      }],
      this.context
    );

    return {
      id: this.generateId(),
      tick: this.context.tick,
      era: this.context.eraId,
      eventKind: 'downfall',
      significance,
      subject: this.buildEntityRef(entity),
      action: 'fell',
      headline,
      description: `${entity.name} has fallen from ${previousStatus} to ${newStatus}.`,
      stateChanges: [{
        entityId: entity.id,
        entityName: entity.name,
        entityKind: entity.kind,
        field: 'status',
        previousValue: previousStatus,
        newValue: newStatus,
      }],
      causedBy: catalyst ? {
        entityId: catalyst.entityId,
        actionType: catalyst.actionType,
      } : undefined,
      narrativeTags: generateNarrativeTags(
        'downfall',
        this.buildEntityRef(entity),
        undefined,
        [],
        'fell',
        { entityKinds: new Set() }
      ),
    };
  }

  /**
   * Build a triumph event (status changed to positive polarity)
   */
  buildTriumphEvent(
    entity: HardState,
    previousStatus: string,
    newStatus: string,
    catalyst?: { entityId: string; actionType: string }
  ): NarrativeEvent {
    const headline = `${entity.name} rises to ${newStatus}`;

    const significance = calculateSignificance(
      'triumph',
      entity.id,
      [{
        entityId: entity.id,
        entityName: entity.name,
        entityKind: entity.kind,
        field: 'status',
        previousValue: previousStatus,
        newValue: newStatus,
      }],
      this.context
    );

    return {
      id: this.generateId(),
      tick: this.context.tick,
      era: this.context.eraId,
      eventKind: 'triumph',
      significance,
      subject: this.buildEntityRef(entity),
      action: 'rose',
      headline,
      description: `${entity.name} has risen from ${previousStatus} to ${newStatus}.`,
      stateChanges: [{
        entityId: entity.id,
        entityName: entity.name,
        entityKind: entity.kind,
        field: 'status',
        previousValue: previousStatus,
        newValue: newStatus,
      }],
      causedBy: catalyst ? {
        entityId: catalyst.entityId,
        actionType: catalyst.actionType,
      } : undefined,
      narrativeTags: generateNarrativeTags(
        'triumph',
        this.buildEntityRef(entity),
        undefined,
        [],
        'rose',
        { entityKinds: new Set() }
      ),
    };
  }

  /**
   * Build a power vacuum event (authority entity ended with no successor)
   */
  buildPowerVacuumEvent(
    authorityEntity: HardState,
    affectedEntities: HardState[],
    catalyst?: { entityId: string; actionType: string }
  ): NarrativeEvent {
    const affectedNames = affectedEntities.slice(0, 3).map(e => e.name).join(', ');
    const moreCount = affectedEntities.length > 3 ? ` and ${affectedEntities.length - 3} others` : '';
    const headline = `${authorityEntity.name} falls, leaving a power vacuum`;

    const significance = calculateSignificance(
      'power_vacuum',
      authorityEntity.id,
      [],
      this.context
    );

    const affectedBonus = Math.min(0.2, affectedEntities.length * 0.03);

    return {
      id: this.generateId(),
      tick: this.context.tick,
      era: this.context.eraId,
      eventKind: 'power_vacuum',
      significance: Math.min(1.0, significance + affectedBonus),
      subject: this.buildEntityRef(authorityEntity),
      action: 'created_vacuum',
      participants: this.buildParticipantRefs([authorityEntity, ...affectedEntities]),
      headline,
      description: `${authorityEntity.name} has ended without a clear successor. ${affectedNames}${moreCount} are left without leadership.`,
      stateChanges: [{
        entityId: authorityEntity.id,
        entityName: authorityEntity.name,
        entityKind: authorityEntity.kind,
        field: 'status',
        previousValue: 'active',
        newValue: 'historical',
      }],
      causedBy: catalyst ? {
        entityId: catalyst.entityId,
        actionType: catalyst.actionType,
      } : undefined,
      narrativeTags: generateNarrativeTags(
        'power_vacuum',
        this.buildEntityRef(authorityEntity),
        undefined,
        [],
        'vacuum',
        { entityKinds: new Set() }
      ),
    };
  }

  /**
   * Build a relationship ended event (ended due to lifecycle)
   */
  buildRelationshipEndedEvent(
    sourceEntity: HardState,
    targetEntity: HardState,
    relationshipKind: string,
    relationshipAge: number,
    endedEntities: HardState[],
    catalyst?: { entityId: string; actionType: string }
  ): NarrativeEvent {
    const endedNames = endedEntities.map(e => e.name).join(' and ');
    const headline = `${sourceEntity.name}'s ${relationshipKind} with ${targetEntity.name} ends`;

    const significance = calculateSignificance(
      'relationship_ended',
      sourceEntity.id,
      [],
      this.context
    );

    return {
      id: this.generateId(),
      tick: this.context.tick,
      era: this.context.eraId,
      eventKind: 'relationship_ended',
      significance,
      subject: this.buildEntityRef(sourceEntity),
      action: 'relationship_ended',
      object: this.buildEntityRef(targetEntity),
      participants: this.buildParticipantRefs([sourceEntity, targetEntity, ...endedEntities]),
      headline,
      description: `The ${relationshipKind} relationship between ${sourceEntity.name} and ${targetEntity.name} ended after ${relationshipAge} ticks as ${endedNames} left the world.`,
      stateChanges: [],
      causedBy: catalyst ? {
        entityId: catalyst.entityId,
        actionType: catalyst.actionType,
      } : undefined,
      narrativeTags: generateNarrativeTags(
        'relationship_ended',
        this.buildEntityRef(sourceEntity),
        this.buildEntityRef(targetEntity),
        [],
        'ended',
        { entityKinds: new Set() }
      ),
    };
  }

  /**
   * Build a leadership established event (first authority connection on target)
   */
  buildLeadershipEstablishedEvent(
    targetEntity: HardState,
    leaderEntities: HardState[]
  ): NarrativeEvent {
    const leaderNames = leaderEntities.slice(0, 3).map(e => e.name).join(', ');
    const moreCount = leaderEntities.length > 3 ? ` and ${leaderEntities.length - 3} others` : '';
    const singleLeader = leaderEntities.length === 1;
    const headline = singleLeader
      ? `${leaderEntities[0].name} becomes an authority for ${targetEntity.name}`
      : `${targetEntity.name} gains new authorities`;

    const significance = calculateSignificance(
      'leadership_established',
      targetEntity.id,
      [],
      this.context
    );

    const leaderBonus = Math.min(0.2, leaderEntities.length * 0.05);

    return {
      id: this.generateId(),
      tick: this.context.tick,
      era: this.context.eraId,
      eventKind: 'leadership_established',
      significance: Math.min(1.0, significance + leaderBonus),
      subject: this.buildEntityRef(targetEntity),
      action: 'leadership_established',
      object: singleLeader ? this.buildEntityRef(leaderEntities[0]) : undefined,
      participants: this.buildParticipantRefs([targetEntity, ...leaderEntities]),
      headline,
      description: `${targetEntity.name} now has authority connections from ${leaderNames}${moreCount}.`,
      stateChanges: [],
      narrativeTags: generateNarrativeTags(
        'leadership_established',
        this.buildEntityRef(targetEntity),
        singleLeader ? this.buildEntityRef(leaderEntities[0]) : undefined,
        [],
        'leadership',
        { entityKinds: new Set() }
      ),
    };
  }

  /**
   * Build a war event (started or ended) with multiple participants
   */
  buildWarEvent(
    eventKind: 'war_started' | 'war_ended',
    participants: HardState[]
  ): NarrativeEvent {
    const names = participants.slice(0, 3).map(e => e.name).join(', ');
    const moreCount = participants.length > 3 ? ` and ${participants.length - 3} others` : '';
    const headline = eventKind === 'war_started'
      ? `War erupts between ${names}${moreCount}`
      : `War ends between ${names}${moreCount}`;

    const significance = calculateSignificance(
      eventKind,
      participants[0].id,
      [],
      this.context
    );

    const participantBonus = Math.min(0.3, participants.length * 0.03);

    return {
      id: this.generateId(),
      tick: this.context.tick,
      era: this.context.eraId,
      eventKind,
      significance: Math.min(1.0, significance + participantBonus),
      subject: this.buildEntityRef(participants[0]),
      action: eventKind === 'war_started' ? 'war_started' : 'war_ended',
      participants: this.buildParticipantRefs(participants),
      headline,
      description: `${participants.length} entities are bound by negative ties as the war ${eventKind === 'war_started' ? 'begins' : 'concludes'}.`,
      stateChanges: [],
      narrativeTags: generateNarrativeTags(
        eventKind,
        this.buildEntityRef(participants[0]),
        undefined,
        [],
        eventKind === 'war_started' ? 'war_started' : 'war_ended',
        { entityKinds: new Set() }
      ),
    };
  }

  /**
   * Build a tag gained event
   */
  buildTagGainedEvent(
    entity: HardState,
    tag: string,
    value: string | boolean | undefined,
    tagMetadata: TagDefinition | undefined,
    catalyst?: { entityId: string; actionType: string }
  ): NarrativeEvent {
    const headline = this.generateTagHeadline(entity, tag, 'gained', tagMetadata);
    const significance = calculateTagSignificance(tag, tagMetadata, entity, 'added');

    const stateChange: NarrativeStateChange = {
      entityId: entity.id,
      entityName: entity.name,
      entityKind: entity.kind,
      field: 'tags',
      previousValue: undefined,
      newValue: value ?? true,
    };

    return {
      id: this.generateId(),
      tick: this.context.tick,
      era: this.context.eraId,
      eventKind: 'tag_gained',
      significance,
      subject: this.buildEntityRef(entity),
      action: `gained_${tag}`,
      headline,
      description: tagMetadata?.description
        ? `${entity.name} ${tagMetadata.description.toLowerCase()}.`
        : `${entity.name} gained the ${tag.replace(/_/g, ' ')} trait.`,
      stateChanges: [stateChange],
      causedBy: catalyst ? {
        entityId: catalyst.entityId,
        actionType: catalyst.actionType,
      } : undefined,
      narrativeTags: [tag, tagMetadata?.category || 'trait', entity.kind, 'tag_change'],
    };
  }

  /**
   * Build a tag lost event
   */
  buildTagLostEvent(
    entity: HardState,
    tag: string,
    tagMetadata: TagDefinition | undefined,
    catalyst?: { entityId: string; actionType: string }
  ): NarrativeEvent {
    const headline = this.generateTagHeadline(entity, tag, 'lost', tagMetadata);
    const significance = calculateTagSignificance(tag, tagMetadata, entity, 'removed');

    const stateChange: NarrativeStateChange = {
      entityId: entity.id,
      entityName: entity.name,
      entityKind: entity.kind,
      field: 'tags',
      previousValue: true,
      newValue: undefined,
    };

    return {
      id: this.generateId(),
      tick: this.context.tick,
      era: this.context.eraId,
      eventKind: 'tag_lost',
      significance,
      subject: this.buildEntityRef(entity),
      action: `lost_${tag}`,
      headline,
      description: `${entity.name} is no longer ${tag.replace(/_/g, ' ')}.`,
      stateChanges: [stateChange],
      causedBy: catalyst ? {
        entityId: catalyst.entityId,
        actionType: catalyst.actionType,
      } : undefined,
      narrativeTags: [tag, tagMetadata?.category || 'trait', entity.kind, 'tag_change'],
    };
  }

  /**
   * Generate headline for tag change events
   */
  private generateTagHeadline(
    entity: HardState,
    tag: string,
    type: 'gained' | 'lost',
    metadata?: TagDefinition
  ): string {
    // Special cases for common simulation tags
    const specialHeadlines: Record<string, Record<string, string>> = {
      wounded: {
        gained: `${entity.name} is wounded`,
        lost: `${entity.name} recovers from wounds`,
      },
      maimed: {
        gained: `${entity.name} is maimed`,
        lost: `${entity.name} heals from their injuries`,
      },
      corrupted: {
        gained: `${entity.name} becomes corrupted`,
        lost: `${entity.name} is purified`,
      },
      legendary: {
        gained: `${entity.name} becomes legendary`,
        lost: `${entity.name}'s legend fades`,
      },
      hostile: {
        gained: `${entity.name} turns hostile`,
        lost: `${entity.name} becomes peaceful`,
      },
      leader: {
        gained: `${entity.name} rises to leadership`,
        lost: `${entity.name} steps down from leadership`,
      },
      war_leader: {
        gained: `${entity.name} becomes a war leader`,
        lost: `${entity.name} is no longer a war leader`,
      },
      armed_raider: {
        gained: `${entity.name} takes up arms`,
        lost: `${entity.name} disarms`,
      },
      crisis: {
        gained: `${entity.name} enters crisis`,
        lost: `${entity.name} emerges from crisis`,
      },
      discovered: {
        gained: `${entity.name} is discovered`,
        lost: `${entity.name} is forgotten`,
      },
    };

    if (specialHeadlines[tag]?.[type]) {
      return specialHeadlines[tag][type];
    }

    // Generic fallback using tag description or formatted name
    const displayTag = metadata?.description || tag.replace(/_/g, ' ');
    return type === 'gained'
      ? `${entity.name} becomes ${displayTag}`
      : `${entity.name} is no longer ${displayTag}`;
  }

  /**
   * Build a creation batch event from template execution
   */
  buildCreationBatchEvent(
    entities: HardState[],
    relationships: RelationshipSummary[],
    templateId: string,
    templateName: string,
    description?: string
  ): NarrativeEvent {
    if (entities.length === 0) {
      throw new Error('Cannot build creation batch event with no entities');
    }

    // Primary entity is the first one (typically the "main" creation)
    const primaryEntity = entities[0];
    const participants = entities.slice(1);
    const totalRelationships = relationships.reduce((sum, r) => sum + r.count, 0);

    const headline = this.generateCreationHeadline(entities, templateName);
    const significance = calculateCreationBatchSignificance(entities, totalRelationships);

    // Build narrative description
    const eventDescription = description || this.generateCreationDescription(entities, relationships, templateName);

    // Collect entity kinds for narrative tags
    const entityKinds = new Set(entities.map(e => e.kind));
    const narrativeTags = ['creation', ...entityKinds];
    if (relationships.length > 0) {
      narrativeTags.push('relationship_formation');
    }

    return {
      id: this.generateId(),
      tick: this.context.tick,
      era: this.context.eraId,
      eventKind: 'creation_batch',
      significance,
      subject: this.buildEntityRef(primaryEntity),
      action: 'created',
      participants: participants.map(e => this.buildEntityRef(e)),
      headline,
      description: eventDescription,
      stateChanges: [],
      causedBy: {
        entityId: templateId,
        actionType: templateName,
      },
      narrativeTags,
    };
  }

  /**
   * Generate headline for creation batch events
   */
  private generateCreationHeadline(entities: HardState[], templateName: string): string {
    if (entities.length === 0) return templateName;

    const primary = entities[0];
    const others = entities.slice(1);

    // If there's just one entity, use its name
    if (others.length === 0) {
      return `${primary.name} ${this.getCreationVerb(primary.kind)}`;
    }

    // Group other entities by kind/subtype
    const subtypeCounts = new Map<string, number>();
    for (const e of others) {
      const key = e.subtype || e.kind;
      subtypeCounts.set(key, (subtypeCounts.get(key) || 0) + 1);
    }

    // Build participant description
    const participantParts: string[] = [];
    for (const [subtype, count] of subtypeCounts) {
      if (count === 1) {
        participantParts.push(`1 ${subtype}`);
      } else {
        participantParts.push(`${count} ${subtype}s`);
      }
    }

    const participantText = participantParts.join(', ');

    // Primary entity with participants
    return `${primary.name} ${this.getCreationVerb(primary.kind)} with ${participantText}`;
  }

  /**
   * Get creation verb based on entity kind
   */
  private getCreationVerb(kind: string): string {
    const verbs: Record<string, string> = {
      location: 'founded',
      npc: 'emerges',
      faction: 'formed',
      artifact: 'created',
      occurrence: 'begins',
      era: 'dawns',
    };
    return verbs[kind] || 'created';
  }

  /**
   * Generate description for creation batch events
   */
  private generateCreationDescription(
    entities: HardState[],
    relationships: RelationshipSummary[],
    templateName: string
  ): string {
    const parts: string[] = [];

    // Entity summary
    const kindCounts = new Map<string, number>();
    for (const e of entities) {
      kindCounts.set(e.kind, (kindCounts.get(e.kind) || 0) + 1);
    }

    const entityParts: string[] = [];
    for (const [kind, count] of kindCounts) {
      entityParts.push(`${count} ${kind}${count > 1 ? 's' : ''}`);
    }
    parts.push(`${templateName} created ${entityParts.join(', ')}`);

    // Relationship summary
    if (relationships.length > 0) {
      const relParts = relationships.map(r => `${r.count} ${r.kind}`);
      parts.push(`establishing ${relParts.join(', ')} relationship${relationships.reduce((s, r) => s + r.count, 0) > 1 ? 's' : ''}`);
    }

    return parts.join(', ') + '.';
  }
}
