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

import type { NarrativeEvent, NarrativeStateChange, Polarity, RelationshipKindDefinition, EntityKindDefinition, TagDefinition } from '@canonry/world-schema';
import { FRAMEWORK_RELATIONSHIP_KINDS, FRAMEWORK_TAGS } from '@canonry/world-schema';
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
 * Pending tag change accumulated during a tick
 */
interface PendingTagChange {
  entityId: string;
  tag: string;
  changeType: 'added' | 'removed';
  value?: string | boolean;
  catalyst?: { entityId: string; actionType: string };
}

/**
 * Relationship summary for creation batch events
 */
export interface RelationshipSummary {
  kind: string;
  count: number;
}

/**
 * Pending creation batch from template execution
 */
interface PendingCreationBatch {
  templateId: string;
  templateName: string;
  entityIds: string[];
  relationships: RelationshipSummary[];
  description?: string;
}

/**
 * Schema slice needed for polarity lookups
 */
export interface NarrativeSchemaSlice {
  relationshipKinds: RelationshipKindDefinition[];
  entityKinds: EntityKindDefinition[];
  tagRegistry?: TagDefinition[];
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
  private authorityConnectionsAtTickStart: Map<string, Set<string>> = new Map();
  private currentTick: number = 0;

  // Polarity lookup caches
  private relationshipPolarityCache: Map<string, Polarity | undefined> = new Map();
  private statusPolarityCache: Map<string, Polarity | undefined> = new Map();
  private authoritySubtypeCache: Set<string> = new Set();

  // Tag tracking
  private pendingTagChanges: Map<string, PendingTagChange[]> = new Map();
  private tagRegistry: Map<string, TagDefinition> = new Map();
  private frameworkTagSet: Set<string> = new Set(Object.values(FRAMEWORK_TAGS));

  // Creation batch tracking
  private pendingCreationBatches: PendingCreationBatch[] = [];

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

    // Build tag registry cache
    this.tagRegistry.clear();
    if (schema.tagRegistry) {
      for (const tag of schema.tagRegistry) {
        this.tagRegistry.set(tag.tag, tag);
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
    this.pendingTagChanges.clear();
    this.pendingCreationBatches = [];

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

    // Snapshot authority connections at tick start (for first-authority detection)
    this.authorityConnectionsAtTickStart.clear();
    const addAuthorityConnection = (targetId: string, authorityId: string) => {
      let authorities = this.authorityConnectionsAtTickStart.get(targetId);
      if (!authorities) {
        authorities = new Set<string>();
        this.authorityConnectionsAtTickStart.set(targetId, authorities);
      }
      authorities.add(authorityId);
    };
    for (const rel of graph.getRelationships({ includeHistorical: false })) {
      const srcEntity = graph.getEntity(rel.src);
      const dstEntity = graph.getEntity(rel.dst);
      if (!srcEntity || !dstEntity) continue;
      const srcIsAuthority = this.isAuthoritySubtype(srcEntity.kind, srcEntity.subtype);
      const dstIsAuthority = this.isAuthoritySubtype(dstEntity.kind, dstEntity.subtype);
      if (srcIsAuthority) addAuthorityConnection(rel.dst, rel.src);
      if (dstIsAuthority) addAuthorityConnection(rel.src, rel.dst);
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
   * Record a tag change for narrative event generation.
   * Call this when a tag is added or removed during simulation.
   *
   * @param entityId - The entity whose tag changed
   * @param tag - The tag that was added or removed
   * @param changeType - Whether the tag was 'added' or 'removed'
   * @param value - The tag value (for added tags)
   * @param catalyst - What caused the change (system/action)
   */
  recordTagChange(
    entityId: string,
    tag: string,
    changeType: 'added' | 'removed',
    value: string | boolean | undefined,
    catalyst?: { entityId: string; actionType: string }
  ): void {
    if (!this.config.enabled) return;

    // Skip framework tags (internal machinery, not narratively interesting)
    if (this.frameworkTagSet.has(tag)) return;

    // Skip system tags (prefixed with sys_)
    if (tag.startsWith('sys_')) return;

    const pending: PendingTagChange = {
      entityId,
      tag,
      changeType,
      value,
      catalyst,
    };

    const existing = this.pendingTagChanges.get(entityId) || [];
    existing.push(pending);
    this.pendingTagChanges.set(entityId, existing);
  }

  /**
   * Record a creation batch from template execution.
   * Call this after a template successfully creates entities/relationships.
   *
   * @param templateId - The template's ID
   * @param templateName - The template's display name
   * @param entityIds - IDs of all entities created by this template
   * @param relationships - Summary of relationship kinds created
   * @param description - Optional description from the template's first creation item
   */
  recordCreationBatch(
    templateId: string,
    templateName: string,
    entityIds: string[],
    relationships: RelationshipSummary[],
    description?: string
  ): void {
    if (!this.config.enabled) return;

    this.pendingCreationBatches.push({
      templateId,
      templateName,
      entityIds,
      relationships,
      description,
    });
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
    const endedEntityIds = this.collectEndedEntityIds();
    const coalescenceChanges = this.detectCoalescenceChanges();
    const coalescenceParticipantIds = new Set<string>();
    for (const [containerId, memberIds] of coalescenceChanges) {
      coalescenceParticipantIds.add(containerId);
      memberIds.forEach(id => coalescenceParticipantIds.add(id));
    }
    // Coalescence can trigger large relationship cleanup; suppress those dissolutions.
    const suppressedCoalescenceEntities = new Set<string>(
      Array.from(coalescenceParticipantIds).filter(id => !endedEntityIds.has(id))
    );

    // 1. Generate state change events (including downfall/triumph based on status polarity)
    events.push(...this.generateStateChangeEvents());

    // 2. Generate leadership events (first leadership on target)
    events.push(...this.generateLeadershipEvents());

    // 3. Generate war events (aggregated)
    const warResults = this.generateWarEvents();
    events.push(...warResults.events);

    // 4. Generate relationship dissolution events (including betrayal/reconciliation)
    events.push(...this.generateDissolutionEvents(
      endedEntityIds,
      warResults.suppressedRelationshipKeys,
      suppressedCoalescenceEntities
    ));

    // 5. Generate rivalry and alliance events (new negative/positive relationships)
    events.push(...this.generateRivalryAndAllianceEvents());

    // 6. Generate succession events (container entities that became historical)
    // Also generates power_vacuum for authority subtypes
    events.push(...this.generateSuccessionEvents());

    // 7. Generate coalescence events (new part_of relationships)
    events.push(...this.generateCoalescenceEvents(coalescenceChanges));

    // 8. Generate tag change events
    events.push(...this.generateTagChangeEvents());

    // 9. Generate creation batch events (from template executions)
    events.push(...this.generateCreationBatchEvents());

    this.pendingChanges.clear();
    this.pendingTagChanges.clear();
    this.pendingCreationBatches = [];
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
   * Collect entities that ended this tick (death, dissolution, historical)
   */
  private collectEndedEntityIds(): Set<string> {
    const ended = new Set<string>();
    for (const [entityId, changes] of this.pendingChanges) {
      const becameHistorical = changes.some(c =>
        c.field === 'status' &&
        (c.newValue === 'historical' || c.newValue === 'dissolved')
      );
      if (becameHistorical) {
        ended.add(entityId);
      }
    }
    return ended;
  }

  /**
   * Detect coalescence changes for this tick
   */
  private detectCoalescenceChanges(): Map<string, string[]> {
    if (!this.graph) return new Map();

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

    const changes = new Map<string, string[]>();
    for (const [containerId, currentMembers] of currentPartOf) {
      const previousSnapshot = this.partOfSnapshotAtTickStart.get(containerId);
      const previousMembers = previousSnapshot?.memberIds ?? new Set<string>();

      const newMemberIds: string[] = [];
      for (const memberId of currentMembers) {
        if (!previousMembers.has(memberId)) {
          newMemberIds.push(memberId);
        }
      }

      if (newMemberIds.length >= 2) {
        changes.set(containerId, newMemberIds);
      }
    }

    return changes;
  }

  private undirectedEdgeKey(a: string, b: string): string {
    return a < b ? `${a}|${b}` : `${b}|${a}`;
  }

  private getConnectedComponents(adjacency: Map<string, Set<string>>): string[][] {
    const visited = new Set<string>();
    const components: string[][] = [];

    for (const node of adjacency.keys()) {
      if (visited.has(node)) continue;
      const stack = [node];
      const component: string[] = [];
      visited.add(node);

      while (stack.length > 0) {
        const current = stack.pop()!;
        component.push(current);
        const neighbors = adjacency.get(current);
        if (!neighbors) continue;
        for (const neighbor of neighbors) {
          if (!visited.has(neighbor)) {
            visited.add(neighbor);
            stack.push(neighbor);
          }
        }
      }

      components.push(component);
    }

    return components;
  }

  /**
   * Generate leadership events (first authority connection on target)
   */
  private generateLeadershipEvents(): NarrativeEvent[] {
    if (!this.eventBuilder || !this.graph) return [];

    const events: NarrativeEvent[] = [];
    const currentAuthorityConnections = new Map<string, Set<string>>();

    const addAuthorityConnection = (targetId: string, authorityId: string) => {
      let authorities = currentAuthorityConnections.get(targetId);
      if (!authorities) {
        authorities = new Set<string>();
        currentAuthorityConnections.set(targetId, authorities);
      }
      authorities.add(authorityId);
    };

    for (const rel of this.graph.getRelationships({ includeHistorical: false })) {
      const srcEntity = this.graph.getEntity(rel.src);
      const dstEntity = this.graph.getEntity(rel.dst);
      if (!srcEntity || !dstEntity) continue;

      const srcIsAuthority = this.isAuthoritySubtype(srcEntity.kind, srcEntity.subtype);
      const dstIsAuthority = this.isAuthoritySubtype(dstEntity.kind, dstEntity.subtype);

      if (srcIsAuthority) addAuthorityConnection(rel.dst, rel.src);
      if (dstIsAuthority) addAuthorityConnection(rel.src, rel.dst);
    }

    for (const [targetId, authorityIds] of currentAuthorityConnections) {
      if (authorityIds.size === 0) continue;
      const startAuthorities = this.authorityConnectionsAtTickStart.get(targetId);
      if (startAuthorities && startAuthorities.size > 0) continue;

      const targetEntity = this.graph.getEntity(targetId);
      if (!targetEntity) continue;

      const authorities: HardState[] = Array.from(authorityIds)
        .map(id => this.graph!.getEntity(id))
        .filter((e): e is HardState => Boolean(e));

      if (authorities.length === 0) continue;

      const event = this.eventBuilder.buildLeadershipEstablishedEvent(
        targetEntity,
        authorities
      );
      if (event.significance >= this.config.minSignificance) {
        events.push(event);
      }
    }

    return events;
  }

  /**
   * Generate war events (aggregated by connected components)
   */
  private generateWarEvents(): { events: NarrativeEvent[]; suppressedRelationshipKeys: Set<string> } {
    if (!this.eventBuilder || !this.graph) return { events: [], suppressedRelationshipKeys: new Set() };

    const events: NarrativeEvent[] = [];
    const suppressedRelationshipKeys = new Set<string>();
    const currentAdjacency = new Map<string, Set<string>>();
    const startAdjacency = new Map<string, Set<string>>();

    const addAdjacency = (adj: Map<string, Set<string>>, src: string, dst: string) => {
      let srcSet = adj.get(src);
      if (!srcSet) {
        srcSet = new Set();
        adj.set(src, srcSet);
      }
      srcSet.add(dst);
      let dstSet = adj.get(dst);
      if (!dstSet) {
        dstSet = new Set();
        adj.set(dst, dstSet);
      }
      dstSet.add(src);
    };

    for (const rel of this.graph.getRelationships({ includeHistorical: false })) {
      if (this.getRelationshipPolarity(rel.kind) !== 'negative') continue;
      addAdjacency(currentAdjacency, rel.src, rel.dst);
    }

    for (const snapshot of this.relationshipSnapshotAtTickStart.values()) {
      if (snapshot.polarity !== 'negative') continue;
      addAdjacency(startAdjacency, snapshot.src, snapshot.dst);
    }

    const currentComponents = this.getConnectedComponents(currentAdjacency).filter(c => c.length >= 2);
    const startComponents = this.getConnectedComponents(startAdjacency).filter(c => c.length >= 2);

    const currentComponentByNode = new Map<string, number>();
    currentComponents.forEach((component, index) => {
      for (const node of component) currentComponentByNode.set(node, index);
    });

    const startComponentByNode = new Map<string, number>();
    startComponents.forEach((component, index) => {
      for (const node of component) startComponentByNode.set(node, index);
    });

    const endedComponentIndexes = new Set<number>();
    startComponents.forEach((component, index) => {
      const hasOverlap = component.some(node => currentComponentByNode.has(node));
      if (!hasOverlap) endedComponentIndexes.add(index);
    });

    currentComponents.forEach(component => {
      const hasOverlap = component.some(node => startComponentByNode.has(node));
      if (hasOverlap) return;

      const participants = component
        .map(id => this.graph!.getEntity(id))
        .filter((e): e is HardState => Boolean(e));
      if (participants.length < 2) return;

      const event = this.eventBuilder!.buildWarEvent('war_started', participants);
      if (event.significance >= this.config.minSignificance) {
        events.push(event);
      }
    });

    startComponents.forEach((component, index) => {
      if (!endedComponentIndexes.has(index)) return;

      const participants = component
        .map(id => this.graph!.getEntity(id))
        .filter((e): e is HardState => Boolean(e));
      if (participants.length < 2) return;

      const event = this.eventBuilder!.buildWarEvent('war_ended', participants);
      if (event.significance >= this.config.minSignificance) {
        events.push(event);
      }
    });

    for (const [key, snapshot] of this.relationshipSnapshotAtTickStart) {
      if (snapshot.polarity !== 'negative') continue;
      const componentIndex = startComponentByNode.get(snapshot.src);
      if (componentIndex === undefined) continue;
      if (startComponentByNode.get(snapshot.dst) !== componentIndex) continue;
      if (!endedComponentIndexes.has(componentIndex)) continue;
      suppressedRelationshipKeys.add(key);
    }

    return { events, suppressedRelationshipKeys };
  }

  /**
   * Generate events for relationship dissolutions
   * Compares relationships at tick start vs tick end to find archived ones
   * Uses polarity to generate betrayal (positive dissolved) or reconciliation (negative dissolved)
   */
  private generateDissolutionEvents(
    endedEntityIds: Set<string>,
    suppressedRelationshipKeys: Set<string>,
    suppressedEntityIds: Set<string>
  ): NarrativeEvent[] {
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
        if (suppressedRelationshipKeys.has(key)) continue;
        if (suppressedEntityIds.has(snapshot.src) || suppressedEntityIds.has(snapshot.dst)) continue;

        // This relationship was dissolved
        const srcEntity = this.graph.getEntity(snapshot.src);
        const dstEntity = this.graph.getEntity(snapshot.dst);

        if (srcEntity && dstEntity) {
          const relationshipAge = this.currentTick - snapshot.createdAt;

          const endedEntities: HardState[] = [];
          if (endedEntityIds.has(srcEntity.id)) endedEntities.push(srcEntity);
          if (endedEntityIds.has(dstEntity.id)) endedEntities.push(dstEntity);
          if (endedEntities.length > 0) {
            const event = this.eventBuilder.buildRelationshipEndedEvent(
              srcEntity,
              dstEntity,
              snapshot.kind,
              relationshipAge,
              endedEntities
            );
            if (event.significance >= this.config.minSignificance) {
              events.push(event);
            }
            continue;
          }

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
   * Generate events for new relationships
   * - Rivalry: negative relationship created between entities that previously knew each other
   * - Alliance: multiple positive relationships formed in same tick
   * - Relationship formed: all other new relationships
   */
  private generateRivalryAndAllianceEvents(): NarrativeEvent[] {
    if (!this.eventBuilder || !this.graph) return [];

    const events: NarrativeEvent[] = [];

    // Track new positive relationships for alliance detection
    const newPositiveRelsByEntity: Map<string, { src: HardState; dst: HardState; kind: string }[]> = new Map();
    // Track all new relationships for fallback relationship_formed events
    const processedPositiveRels = new Set<string>();

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
            const event = this.eventBuilder!.buildRivalryFormedEvent(
              srcEntity,
              dstEntity,
              rel.kind
            );
            if (event.significance >= this.config.minSignificance) {
              events.push(event);
            }
          } else {
            // Negative relationship without prior connection - emit relationship_formed
            const event = this.eventBuilder!.buildRelationshipFormedEvent(
              srcEntity,
              dstEntity,
              rel.kind,
              polarity
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
          newPositiveRelsByEntity.get(rel.src)!.push({ src: srcEntity, dst: dstEntity, kind: rel.kind });
        } else {
          // Neutral or undefined polarity - emit relationship_formed
          const event = this.eventBuilder!.buildRelationshipFormedEvent(
            srcEntity,
            dstEntity,
            rel.kind,
            polarity
          );
          if (event.significance >= this.config.minSignificance) {
            events.push(event);
          }
        }
      }
    }

    // Check for alliances (2+ positive relationships formed by same entity in same tick)
    for (const [srcId, rels] of newPositiveRelsByEntity) {
      if (rels.length >= 2) {
        const srcEntity = this.graph.getEntity(srcId);
        if (srcEntity) {
          const allEntities = [srcEntity, ...rels.map(r => r.dst)];
          const event = this.eventBuilder!.buildAllianceFormedEvent(
            allEntities,
            rels[0].kind
          );
          if (event.significance >= this.config.minSignificance) {
            events.push(event);
          }
          // Mark these as processed
          for (const r of rels) {
            processedPositiveRels.add(this.relationshipKey(r.src.id, r.dst.id, r.kind));
          }
        }
      }
    }

    // Emit relationship_formed for single positive relationships that weren't part of an alliance
    for (const [_srcId, rels] of newPositiveRelsByEntity) {
      for (const r of rels) {
        const key = this.relationshipKey(r.src.id, r.dst.id, r.kind);
        if (!processedPositiveRels.has(key)) {
          const event = this.eventBuilder!.buildRelationshipFormedEvent(
            r.src,
            r.dst,
            r.kind,
            'positive'
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
        (c.newValue === 'historical' || c.newValue === 'dissolved')
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
  private generateCoalescenceEvents(coalescenceChanges?: Map<string, string[]>): NarrativeEvent[] {
    if (!this.eventBuilder || !this.graph) return [];

    const events: NarrativeEvent[] = [];
    const changes = coalescenceChanges ?? this.detectCoalescenceChanges();

    for (const [containerId, newMemberIds] of changes) {
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
   * Generate events for tag changes during simulation
   */
  private generateTagChangeEvents(): NarrativeEvent[] {
    if (!this.eventBuilder || !this.graph) return [];

    const events: NarrativeEvent[] = [];

    for (const [entityId, tagChanges] of this.pendingTagChanges) {
      const entity = this.graph.getEntity(entityId);
      if (!entity) continue;

      for (const change of tagChanges) {
        const tagMetadata = this.tagRegistry.get(change.tag);

        let event: NarrativeEvent;
        if (change.changeType === 'added') {
          event = this.eventBuilder.buildTagGainedEvent(
            entity,
            change.tag,
            change.value,
            tagMetadata,
            change.catalyst
          );
        } else {
          event = this.eventBuilder.buildTagLostEvent(
            entity,
            change.tag,
            tagMetadata,
            change.catalyst
          );
        }

        if (event.significance >= this.config.minSignificance) {
          events.push(event);
        }
      }
    }

    return events;
  }

  /**
   * Generate events for creation batches from template executions
   */
  private generateCreationBatchEvents(): NarrativeEvent[] {
    if (!this.eventBuilder || !this.graph) return [];

    const events: NarrativeEvent[] = [];

    for (const batch of this.pendingCreationBatches) {
      // Get the created entities
      const entities: HardState[] = [];
      for (const id of batch.entityIds) {
        const entity = this.graph.getEntity(id);
        if (entity) {
          entities.push(entity);
        }
      }

      if (entities.length === 0) continue;

      const event = this.eventBuilder.buildCreationBatchEvent(
        entities,
        batch.relationships,
        batch.templateId,
        batch.templateName,
        batch.description
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
