/**
 * State Change Tracker
 *
 * Captures entity state changes during simulation ticks and generates
 * NarrativeEvents for story generation. Integrates with the NarrativeEventBuilder
 * to create meaningful narrative hooks from simulation data.
 */

import type { NarrativeEvent, NarrativeStateChange } from '@canonry/world-schema';
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
 * Tracks state changes during simulation and generates narrative events
 */
export class StateChangeTracker {
  private config: NarrativeConfig;
  private eventBuilder: NarrativeEventBuilder | null = null;
  private pendingChanges: Map<string, PendingStateChange[]> = new Map();
  private graph: Graph | null = null;

  constructor(config: NarrativeConfig) {
    this.config = config;
  }

  /**
   * Initialize tracker for a new tick
   */
  startTick(graph: Graph, tick: number, eraId: string): void {
    if (!this.config.enabled) return;

    this.graph = graph;
    this.pendingChanges.clear();

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

    for (const [entityId, changes] of this.pendingChanges) {
      const entity = this.graph.getEntity(entityId);
      if (!entity) continue;

      // Convert pending changes to NarrativeStateChange format
      const stateChanges: NarrativeStateChange[] = changes.map(c => ({
        entityId: c.entityId,
        entityName: entity.name,
        entityKind: entity.kind,
        field: c.field,
        previousValue: c.previousValue,
        newValue: c.newValue,
      }));

      // Get catalyst from first change (all changes for an entity in a tick
      // typically share the same catalyst)
      const catalyst = changes[0]?.catalyst;

      // Build the narrative event
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

    this.pendingChanges.clear();
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
 * Create a default narrative config (disabled)
 */
export function createDefaultNarrativeConfig(): NarrativeConfig {
  return {
    enabled: false,
    minSignificance: 0.3,
    trackRelationships: false,
  };
}
