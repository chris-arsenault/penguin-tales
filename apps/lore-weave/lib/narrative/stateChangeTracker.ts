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
  private leadershipTargetsAtTickStart: Map<string, Set<string>> = new Map();
  private currentTick: number = 0;

  // Polarity lookup caches
  private relationshipPolarityCache: Map<string, Polarity | undefined> = new Map();
  private statusPolarityCache: Map<string, Polarity | undefined> = new Map();
  private authoritySubtypeCache: Set<string> = new Set();
  private warRelationshipKinds: Set<string> = new Set(['at_war_with']);
  private leadershipRelationshipKinds: Set<string> = new Set(['leader_of']);

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

    this.refreshNarrativeRelationshipKinds();
  }

  /**
   * Refresh narrative relationship kind roles (war, leadership)
   */
  private refreshNarrativeRelationshipKinds(): void {
    const warKinds = new Set(this.config.warRelationshipKinds ?? []);
    const leadershipKinds = new Set(this.config.leadershipRelationshipKinds ?? []);

    if (this.schema) {
      for (const rel of this.schema.relationshipKinds) {
        if (rel.narrativeRole === 'war') {
          warKinds.add(rel.kind);
        }
        if (rel.narrativeRole === 'leadership') {
          leadershipKinds.add(rel.kind);
        }
      }
    }

    if (warKinds.size === 0) warKinds.add('at_war_with');
    if (leadershipKinds.size === 0) leadershipKinds.add('leader_of');

    this.warRelationshipKinds = warKinds;
    this.leadershipRelationshipKinds = leadershipKinds;
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

    // Snapshot leadership targets at tick start (for first-leadership detection)
    this.leadershipTargetsAtTickStart.clear();
    if (this.leadershipRelationshipKinds.size > 0) {
      for (const rel of graph.getRelationships({ includeHistorical: false })) {
        if (!this.leadershipRelationshipKinds.has(rel.kind)) continue;
        let targets = this.leadershipTargetsAtTickStart.get(rel.kind);
        if (!targets) {
          targets = new Set<string>();
          this.leadershipTargetsAtTickStart.set(rel.kind, targets);
        }
        targets.add(rel.dst);
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
    const endedEntityIds = this.collectEndedEntityIds();
    const coalescenceChanges = this.detectCoalescenceChanges();
    const coalescenceMemberIds = new Set<string>();
    for (const memberIds of coalescenceChanges.values()) {
      memberIds.forEach(id => coalescenceMemberIds.add(id));
    }
    const suppressedCoalescenceMembers = new Set<string>(
      Array.from(coalescenceMemberIds).filter(id => endedEntityIds.has(id))
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
      suppressedCoalescenceMembers
    ));

    // 5. Generate rivalry and alliance events (new negative/positive relationships)
    events.push(...this.generateRivalryAndAllianceEvents());

    // 6. Generate succession events (container entities that became historical)
    // Also generates power_vacuum for authority subtypes
    events.push(...this.generateSuccessionEvents());

    // 7. Generate coalescence events (new part_of relationships)
    events.push(...this.generateCoalescenceEvents(coalescenceChanges));

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
   * Collect entities that ended this tick (death, dissolution, historical)
   */
  private collectEndedEntityIds(): Set<string> {
    const ended = new Set<string>();
    for (const [entityId, changes] of this.pendingChanges) {
      const becameHistorical = changes.some(c =>
        c.field === 'status' &&
        (c.newValue === 'historical' || c.newValue === 'dissolved' || c.newValue === 'dead')
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
   * Generate leadership events (first leadership on target)
   */
  private generateLeadershipEvents(): NarrativeEvent[] {
    if (!this.eventBuilder || !this.graph) return [];
    if (this.leadershipRelationshipKinds.size === 0) return [];

    const events: NarrativeEvent[] = [];
    const newLeadershipByTarget = new Map<string, { kind: string; targetId: string; leaderIds: Set<string> }>();

    for (const rel of this.graph.getRelationships({ includeHistorical: false })) {
      if (!this.leadershipRelationshipKinds.has(rel.kind)) continue;
      const key = this.relationshipKey(rel.src, rel.dst, rel.kind);
      if (this.relationshipSnapshotAtTickStart.has(key)) continue;

      const targetsAtStart = this.leadershipTargetsAtTickStart.get(rel.kind);
      if (targetsAtStart?.has(rel.dst)) continue;

      const groupKey = `${rel.kind}|${rel.dst}`;
      let group = newLeadershipByTarget.get(groupKey);
      if (!group) {
        group = { kind: rel.kind, targetId: rel.dst, leaderIds: new Set<string>() };
        newLeadershipByTarget.set(groupKey, group);
      }
      group.leaderIds.add(rel.src);
    }

    for (const group of newLeadershipByTarget.values()) {
      const targetEntity = this.graph.getEntity(group.targetId);
      if (!targetEntity) continue;

      const leaders: HardState[] = Array.from(group.leaderIds)
        .map(id => this.graph!.getEntity(id))
        .filter((e): e is HardState => Boolean(e));

      if (leaders.length === 0) continue;

      const event = this.eventBuilder.buildLeadershipEstablishedEvent(
        targetEntity,
        leaders,
        group.kind
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
    if (this.warRelationshipKinds.size === 0) return { events: [], suppressedRelationshipKeys: new Set() };

    const events: NarrativeEvent[] = [];
    const suppressedRelationshipKeys = new Set<string>();

    const currentWarRels = this.graph.getRelationships({ includeHistorical: false })
      .filter(rel => this.warRelationshipKinds.has(rel.kind));
    const currentRelationshipKeys = new Set<string>(
      currentWarRels.map(rel => this.relationshipKey(rel.src, rel.dst, rel.kind))
    );

    for (const [key, snapshot] of this.relationshipSnapshotAtTickStart) {
      if (this.warRelationshipKinds.has(snapshot.kind) && !currentRelationshipKeys.has(key)) {
        suppressedRelationshipKeys.add(key);
      }
    }

    for (const kind of this.warRelationshipKinds) {
      const currentEdges = new Set<string>();
      const startEdges = new Set<string>();
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

      for (const rel of currentWarRels) {
        if (rel.kind !== kind) continue;
        const edgeKey = this.undirectedEdgeKey(rel.src, rel.dst);
        currentEdges.add(edgeKey);
        addAdjacency(currentAdjacency, rel.src, rel.dst);
      }

      for (const snapshot of this.relationshipSnapshotAtTickStart.values()) {
        if (snapshot.kind !== kind) continue;
        const edgeKey = this.undirectedEdgeKey(snapshot.src, snapshot.dst);
        startEdges.add(edgeKey);
        addAdjacency(startAdjacency, snapshot.src, snapshot.dst);
      }

      const newEdges = new Set<string>();
      for (const edge of currentEdges) {
        if (!startEdges.has(edge)) newEdges.add(edge);
      }

      const currentComponents = this.getConnectedComponents(currentAdjacency);
      for (const component of currentComponents) {
        if (component.length < 2) continue;
        const componentSet = new Set(component);
        const hasNewEdge = Array.from(newEdges).some(edge => {
          const [a, b] = edge.split('|');
          return componentSet.has(a) && componentSet.has(b);
        });
        if (!hasNewEdge) continue;

        const participants = component
          .map(id => this.graph!.getEntity(id))
          .filter((e): e is HardState => Boolean(e));
        if (participants.length < 2) continue;

        const event = this.eventBuilder.buildWarEvent('war_started', participants, kind);
        if (event.significance >= this.config.minSignificance) {
          events.push(event);
        }
      }

      const startComponents = this.getConnectedComponents(startAdjacency);
      for (const component of startComponents) {
        if (component.length < 2) continue;
        const componentSet = new Set(component);
        const hasRemainingEdge = Array.from(currentEdges).some(edge => {
          const [a, b] = edge.split('|');
          return componentSet.has(a) && componentSet.has(b);
        });
        if (hasRemainingEdge) continue;

        const participants = component
          .map(id => this.graph!.getEntity(id))
          .filter((e): e is HardState => Boolean(e));
        if (participants.length < 2) continue;

        const event = this.eventBuilder.buildWarEvent('war_ended', participants, kind);
        if (event.significance >= this.config.minSignificance) {
          events.push(event);
        }
      }
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
        if (this.warRelationshipKinds.has(snapshot.kind)) continue;
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
        if (this.warRelationshipKinds.has(rel.kind)) continue;
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
    warRelationshipKinds: ['at_war_with'],
    leadershipRelationshipKinds: ['leader_of'],
  };
}
