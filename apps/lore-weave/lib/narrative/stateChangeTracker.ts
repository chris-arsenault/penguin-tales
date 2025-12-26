/**
 * State Change Tracker
 *
 * Captures entity state changes during simulation ticks and generates
 * NarrativeEvents for story generation. Integrates with the NarrativeEventBuilder
 * to create meaningful narrative hooks from simulation data.
 *
 * Tracks:
 * - Entity state changes (status, prominence, culture)
 * - Relationship dissolutions (when relationships are archived)
 * - Succession events (when container entities with part_of relationships end)
 * - Coalescence events (when multiple entities join under one container)
 * - Polarity-based events (betrayal, reconciliation, rivalry, alliance, downfall, triumph, power_vacuum)
 */

import type { NarrativeEvent, NarrativeStateChange, Polarity, RelationshipKindDefinition, EntityKindDefinition } from '@canonry/world-schema';
import { FRAMEWORK_RELATIONSHIP_KINDS } from '@canonry/world-schema';
import type { HardState } from '../core/worldTypes.js';
import type { Graph, NarrativeConfig } from '../engine/types.js';
import { NarrativeEventBuilder, type NarrativeContext } from './narrativeEventBuilder.js';

/**
 * Pending state change accumulated during a tick
 */
interface PendingStateChange {
  entityId: string;
  field: string;
  previousValue: unknown;
  newValue: unknown;
  catalyst?: { entityId: string; actionType: string };
}

/**
 * Snapshot of a relationship for comparison
 */
interface RelationshipSnapshot {
  kind: string;
  src: string;
  dst: string;
  createdAt: number;
  polarity?: Polarity;
}

/**
 * Snapshot of part_of relationships for an entity
 */
interface PartOfSnapshot {
  /** Entity IDs that are part_of this container */
  memberIds: Set<string>;
}

/**
 * Schema slice needed for polarity lookups
 */
export interface NarrativeSchemaSlice {
  relationshipKinds: RelationshipKindDefinition[];
  entityKinds: EntityKindDefinition[];
}

/**
 * Tracks state changes during simulation and generates narrative events
 */
export class StateChangeTracker {
  private config: NarrativeConfig;
  private eventBuilder: NarrativeEventBuilder | null = null;
  private pendingChanges: Map<string, PendingStateChange[]> = new Map();
  private graph: Graph | null = null;
  private schema: NarrativeSchemaSlice | null = null;

  // Relationship tracking
  private relationshipSnapshotAtTickStart: Map<string, RelationshipSnapshot> = new Map();
  private partOfSnapshotAtTickStart: Map<string, PartOfSnapshot> = new Map();
  private currentTick: number = 0;

  // Polarity lookup caches
  private relationshipPolarityCache: Map<string, Polarity | undefined> = new Map();
  private statusPolarityCache: Map<string, Polarity | undefined> = new Map();
  private authoritySubtypeCache: Set<string> = new Set();

  constructor(config: NarrativeConfig) {
    this.config = config;
  }

  /**
   * Set schema for polarity lookups
   * Call once at engine initialization
   */
  setSchema(schema: NarrativeSchemaSlice): void {
    this.schema = schema;

    // Build lookup caches
    this.relationshipPolarityCache.clear();
    for (const rel of schema.relationshipKinds) {
      if (rel.polarity) {
        this.relationshipPolarityCache.set(rel.kind, rel.polarity);
      }
    }

    this.statusPolarityCache.clear();
    this.authoritySubtypeCache.clear();
    for (const entityKind of schema.entityKinds) {
      // Cache status polarities as "entityKind:statusId" -> polarity
      for (const status of entityKind.statuses) {
        if (status.polarity) {
          this.statusPolarityCache.set(`${entityKind.kind}:${status.id}`, status.polarity);
        }
      }
      // Cache authority subtypes
      for (const subtype of entityKind.subtypes) {
        if (subtype.isAuthority) {
          this.authoritySubtypeCache.add(`${entityKind.kind}:${subtype.id}`);
        }
      }
    }
  }

  /**
   * Get relationship polarity from cache
   */
  private getRelationshipPolarity(kind: string): Polarity | undefined {
    return this.relationshipPolarityCache.get(kind);
  }

  /**
   * Get status polarity from cache
   */
  private getStatusPolarity(entityKind: string, statusId: string): Polarity | undefined {
    return this.statusPolarityCache.get(`${entityKind}:${statusId}`);
  }

  /**
   * Check if subtype is an authority position
   */
  private isAuthoritySubtype(entityKind: string, subtype: string): boolean {
    return this.authoritySubtypeCache.has(`${entityKind}:${subtype}`);
  }

  /**
   * Create a unique key for a relationship
   */
  private relationshipKey(src: string, dst: string, kind: string): string {
    return `${src}|${dst}|${kind}`;
  }

  /**
   * Initialize tracker for a new tick
   */
  startTick(graph: Graph, tick: number, eraId: string): void {
    if (!this.config.enabled) return;

    this.graph = graph;
    this.currentTick = tick;
    this.pendingChanges.clear();

    // Snapshot active relationships at tick start (for dissolution detection)
    this.relationshipSnapshotAtTickStart.clear();
    for (const rel of graph.getRelationships({ includeHistorical: false })) {
      const key = this.relationshipKey(rel.src, rel.dst, rel.kind);
      this.relationshipSnapshotAtTickStart.set(key, {
        kind: rel.kind,
        src: rel.src,
        dst: rel.dst,
        createdAt: rel.createdAt ?? 0,
        polarity: this.getRelationshipPolarity(rel.kind),
      });
    }

    // Snapshot part_of relationships at tick start (for coalescence/succession detection)
    this.partOfSnapshotAtTickStart.clear();
    for (const rel of graph.getRelationships({ includeHistorical: false })) {
      if (rel.kind === FRAMEWORK_RELATIONSHIP_KINDS.PART_OF) {
        const containerId = rel.dst;
        let snapshot = this.partOfSnapshotAtTickStart.get(containerId);
        if (!snapshot) {
          snapshot = { memberIds: new Set() };
          this.partOfSnapshotAtTickStart.set(containerId, snapshot);
        }
        snapshot.memberIds.add(rel.src);
      }
    }

    // Create or update the event builder context
    const context: NarrativeContext = {
      tick,
      eraId,
      getEntity: (id: string) => graph.getEntity(id),
      getEntityRelationships: (id: string) => {
        return graph.getEntityRelationships(id).map(r => ({
          kind: r.kind,
          src: r.src,
          dst: r.dst,
        }));
      },
    };

    if (!this.eventBuilder) {
      this.eventBuilder = new NarrativeEventBuilder(context);
    } else {
      this.eventBuilder.updateContext(context);
    }
  }

  /**
   * Record an entity state change
   * Call this BEFORE applying the change to capture the previous value
   */
  recordChange(
    entityId: string,
    field: string,
    previousValue: unknown,
    newValue: unknown,
    catalyst?: { entityId: string; actionType: string }
  ): void {
    if (!this.config.enabled) return;
    if (previousValue === newValue) return; // No actual change

    // Only track narratively significant fields
    const significantFields = ['status', 'prominence', 'culture'];
    if (!significantFields.includes(field)) return;

    const pending: PendingStateChange = {
      entityId,
      field,
      previousValue,
      newValue,
      catalyst,
    };

    const existing = this.pendingChanges.get(entityId) || [];
    existing.push(pending);
    this.pendingChanges.set(entityId, existing);
  }

  /**
   * Record entity state change by providing entity and changes object
   * Convenience method that extracts individual field changes
   */
  recordEntityChange(
    entity: HardState,
    changes: Partial<HardState>,
    catalyst?: { entityId: string; actionType: string }
  ): void {
    if (!this.config.enabled) return;

    for (const [field, newValue] of Object.entries(changes)) {
      const previousValue = (entity as unknown as Record<string, unknown>)[field];
      this.recordChange(entity.id, field, previousValue, newValue, catalyst);
    }
  }

  /**
   * Flush pending changes and generate narrative events
   * Call this at the end of each tick
   * @returns Array of generated narrative events above the significance threshold
   */
  flush(): NarrativeEvent[] {
    if (!this.config.enabled || !this.eventBuilder || !this.graph) {
      this.pendingChanges.clear();
      return [];
    }

    const events: NarrativeEvent[] = [];

    // 1. Generate state change events (including downfall/triumph based on status polarity)
    events.push(...this.generateStateChangeEvents());

    // 2. Generate relationship dissolution events (including betrayal/reconciliation)
    events.push(...this.generateDissolutionEvents());

    // 3. Generate rivalry and alliance events (new negative/positive relationships)
    events.push(...this.generateRivalryAndAllianceEvents());

    // 4. Generate succession events (container entities that became historical)
    // Also generates power_vacuum for authority subtypes
    events.push(...this.generateSuccessionEvents());

    // 5. Generate coalescence events (new part_of relationships)
    events.push(...this.generateCoalescenceEvents());

    this.pendingChanges.clear();
    return events;
  }

  /**
   * Generate events for entity state changes
   * Also detects downfall/triumph events based on status polarity
   */
  private generateStateChangeEvents(): NarrativeEvent[] {
    if (!this.eventBuilder || !this.graph) return [];

    const events: NarrativeEvent[] = [];

    for (const [entityId, changes] of this.pendingChanges) {
      const entity = this.graph.getEntity(entityId);
      if (!entity) continue;

      // Check for status polarity transitions
      for (const change of changes) {
        if (change.field === 'status') {
          const prevPolarity = this.getStatusPolarity(entity.kind, String(change.previousValue));
          const newPolarity = this.getStatusPolarity(entity.kind, String(change.newValue));

          // Downfall: any status -> negative status
          if (newPolarity === 'negative' && prevPolarity !== 'negative') {
            const downfallEvent = this.eventBuilder.buildDownfallEvent(
              entity,
              String(change.previousValue),
              String(change.newValue),
              change.catalyst
            );
            if (downfallEvent.significance >= this.config.minSignificance) {
              events.push(downfallEvent);
              continue; // Skip regular state_change for this
            }
          }

          // Triumph: any status -> positive status
          if (newPolarity === 'positive' && prevPolarity !== 'positive') {
            const triumphEvent = this.eventBuilder.buildTriumphEvent(
              entity,
              String(change.previousValue),
              String(change.newValue),
              change.catalyst
            );
            if (triumphEvent.significance >= this.config.minSignificance) {
              events.push(triumphEvent);
              continue; // Skip regular state_change for this
            }
          }
        }
      }

      // Convert pending changes to NarrativeStateChange format
      const stateChanges: NarrativeStateChange[] = changes.map(c => ({
        entityId: c.entityId,
        entityName: entity.name,
        entityKind: entity.kind,
        field: c.field,
        previousValue: c.previousValue,
        newValue: c.newValue,
      }));

      // Get catalyst from first change
      const catalyst = changes[0]?.catalyst;

      // Build the regular state change event
      const event = this.eventBuilder.buildStateChangeEvent(
        entityId,
        stateChanges,
        catalyst
      );

      // Filter by significance threshold
      if (event && event.significance >= this.config.minSignificance) {
        events.push(event);
      }
    }

    return events;
  }

  /**
   * Generate events for relationship dissolutions
   * Compares relationships at tick start vs tick end to find archived ones
   * Uses polarity to generate betrayal (positive dissolved) or reconciliation (negative dissolved)
   */
  private generateDissolutionEvents(): NarrativeEvent[] {
    if (!this.eventBuilder || !this.graph) return [];

    const events: NarrativeEvent[] = [];

    // Build set of currently active relationships
    const currentActiveKeys = new Set<string>();
    for (const rel of this.graph.getRelationships({ includeHistorical: false })) {
      currentActiveKeys.add(this.relationshipKey(rel.src, rel.dst, rel.kind));
    }

    // Find relationships that were active at tick start but are no longer active
    for (const [key, snapshot] of this.relationshipSnapshotAtTickStart) {
      if (!currentActiveKeys.has(key)) {
        // This relationship was dissolved
        const srcEntity = this.graph.getEntity(snapshot.src);
        const dstEntity = this.graph.getEntity(snapshot.dst);

        if (srcEntity && dstEntity) {
          const relationshipAge = this.currentTick - snapshot.createdAt;

          // Check polarity for specialized events
          if (snapshot.polarity === 'positive') {
            // Betrayal: positive relationship dissolved
            const event = this.eventBuilder.buildBetrayalEvent(
              srcEntity,
              dstEntity,
              snapshot.kind,
              relationshipAge
            );
            if (event.significance >= this.config.minSignificance) {
              events.push(event);
            }
          } else if (snapshot.polarity === 'negative') {
            // Reconciliation: negative relationship dissolved
            const event = this.eventBuilder.buildReconciliationEvent(
              srcEntity,
              dstEntity,
              snapshot.kind
            );
            if (event.significance >= this.config.minSignificance) {
              events.push(event);
            }
          } else {
            // Neutral or unknown polarity: regular dissolution event
            const event = this.eventBuilder.buildRelationshipDissolutionEvent(
              srcEntity,
              dstEntity,
              snapshot.kind,
              relationshipAge
            );
            if (event.significance >= this.config.minSignificance) {
              events.push(event);
            }
          }
        }
      }
    }

    return events;
  }

  /**
   * Generate rivalry and alliance events for new relationships
   * Rivalry: negative relationship created between entities that previously knew each other
   * Alliance: multiple positive relationships formed in same tick
   */
  private generateRivalryAndAllianceEvents(): NarrativeEvent[] {
    if (!this.eventBuilder || !this.graph) return [];

    const events: NarrativeEvent[] = [];

    // Track new positive relationships for alliance detection
    const newPositiveRelsByEntity: Map<string, { entity: HardState; kind: string }[]> = new Map();

    // Find relationships that exist now but didn't at tick start
    for (const rel of this.graph.getRelationships({ includeHistorical: false })) {
      const key = this.relationshipKey(rel.src, rel.dst, rel.kind);
      if (!this.relationshipSnapshotAtTickStart.has(key)) {
        // This is a new relationship
        const polarity = this.getRelationshipPolarity(rel.kind);
        const srcEntity = this.graph.getEntity(rel.src);
        const dstEntity = this.graph.getEntity(rel.dst);

        if (!srcEntity || !dstEntity) continue;

        if (polarity === 'negative') {
          // Check if these entities had any prior relationship
          const hadPriorRelationship = Array.from(this.relationshipSnapshotAtTickStart.values())
            .some(s => (s.src === rel.src && s.dst === rel.dst) || (s.src === rel.dst && s.dst === rel.src));

          if (hadPriorRelationship) {
            // Rivalry formed between previously connected entities
            const event = this.eventBuilder.buildRivalryFormedEvent(
              srcEntity,
              dstEntity,
              rel.kind
            );
            if (event.significance >= this.config.minSignificance) {
              events.push(event);
            }
          }
        } else if (polarity === 'positive') {
          // Track for alliance detection
          if (!newPositiveRelsByEntity.has(rel.src)) {
            newPositiveRelsByEntity.set(rel.src, []);
          }
          newPositiveRelsByEntity.get(rel.src)!.push({ entity: dstEntity, kind: rel.kind });
        }
      }
    }

    // Check for alliances (2+ positive relationships formed by same entity in same tick)
    for (const [srcId, targets] of newPositiveRelsByEntity) {
      if (targets.length >= 2) {
        const srcEntity = this.graph.getEntity(srcId);
        if (srcEntity) {
          const allEntities = [srcEntity, ...targets.map(t => t.entity)];
          const event = this.eventBuilder.buildAllianceFormedEvent(
            allEntities,
            targets[0].kind
          );
          if (event.significance >= this.config.minSignificance) {
            events.push(event);
          }
        }
      }
    }

    return events;
  }

  /**
   * Generate succession events when container entities with part_of relationships become historical
   * Also generates power_vacuum events for authority subtypes
   */
  private generateSuccessionEvents(): NarrativeEvent[] {
    if (!this.eventBuilder || !this.graph) return [];

    const events: NarrativeEvent[] = [];

    // Find entities that became historical this tick
    for (const [entityId, changes] of this.pendingChanges) {
      const becameHistorical = changes.some(c =>
        c.field === 'status' &&
        (c.newValue === 'historical' || c.newValue === 'dissolved' || c.newValue === 'dead')
      );

      if (!becameHistorical) continue;

      const entity = this.graph.getEntity(entityId);
      if (!entity) continue;

      const catalyst = changes[0]?.catalyst;

      // Check if this is an authority entity (power_vacuum)
      if (this.isAuthoritySubtype(entity.kind, entity.subtype)) {
        // Get entities that were connected to this authority
        const affectedEntities: HardState[] = [];
        for (const snapshot of this.relationshipSnapshotAtTickStart.values()) {
          if (snapshot.src === entityId || snapshot.dst === entityId) {
            const otherId = snapshot.src === entityId ? snapshot.dst : snapshot.src;
            const other = this.graph.getEntity(otherId);
            if (other && other.status !== 'historical') {
              affectedEntities.push(other);
            }
          }
        }

        if (affectedEntities.length > 0) {
          const event = this.eventBuilder.buildPowerVacuumEvent(
            entity,
            affectedEntities,
            catalyst
          );
          if (event.significance >= this.config.minSignificance) {
            events.push(event);
          }
        }
      }

      // Check if this entity had members (inbound part_of relationships) for succession
      const previousMembers = this.partOfSnapshotAtTickStart.get(entityId);
      if (!previousMembers || previousMembers.memberIds.size === 0) continue;

      // Get member entities (they may still exist)
      const memberEntities: HardState[] = [];
      for (const memberId of previousMembers.memberIds) {
        const member = this.graph.getEntity(memberId);
        if (member) {
          memberEntities.push(member);
        }
      }

      if (memberEntities.length === 0) continue;

      const event = this.eventBuilder.buildSuccessionEvent(
        entity,
        memberEntities,
        catalyst
      );

      if (event.significance >= this.config.minSignificance) {
        events.push(event);
      }
    }

    return events;
  }

  /**
   * Generate coalescence events when multiple entities join under a container
   */
  private generateCoalescenceEvents(): NarrativeEvent[] {
    if (!this.eventBuilder || !this.graph) return [];

    const events: NarrativeEvent[] = [];

    // Build current part_of relationships
    const currentPartOf = new Map<string, Set<string>>();
    for (const rel of this.graph.getRelationships({ includeHistorical: false })) {
      if (rel.kind === FRAMEWORK_RELATIONSHIP_KINDS.PART_OF) {
        const containerId = rel.dst;
        let members = currentPartOf.get(containerId);
        if (!members) {
          members = new Set();
          currentPartOf.set(containerId, members);
        }
        members.add(rel.src);
      }
    }

    // Find containers that gained new members this tick
    for (const [containerId, currentMembers] of currentPartOf) {
      const previousSnapshot = this.partOfSnapshotAtTickStart.get(containerId);
      const previousMembers = previousSnapshot?.memberIds ?? new Set<string>();

      // Find new members added this tick
      const newMemberIds: string[] = [];
      for (const memberId of currentMembers) {
        if (!previousMembers.has(memberId)) {
          newMemberIds.push(memberId);
        }
      }

      // Only generate coalescence if 2+ entities joined in the same tick
      if (newMemberIds.length < 2) continue;

      const containerEntity = this.graph.getEntity(containerId);
      if (!containerEntity) continue;

      const newMemberEntities: HardState[] = [];
      for (const memberId of newMemberIds) {
        const member = this.graph.getEntity(memberId);
        if (member) {
          newMemberEntities.push(member);
        }
      }

      if (newMemberEntities.length < 2) continue;

      const event = this.eventBuilder.buildCoalescenceEvent(
        containerEntity,
        newMemberEntities
      );

      if (event.significance >= this.config.minSignificance) {
        events.push(event);
      }
    }

    return events;
  }

  /**
   * Get number of pending changes (for diagnostics)
   */
  getPendingCount(): number {
    let count = 0;
    for (const changes of this.pendingChanges.values()) {
      count += changes.length;
    }
    return count;
  }

  /**
   * Check if tracking is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }
}

/**
 * Create a default narrative config (enabled)
 */
export function createDefaultNarrativeConfig(): NarrativeConfig {
  return {
    enabled: true,
    minSignificance: 0,
  };
}
