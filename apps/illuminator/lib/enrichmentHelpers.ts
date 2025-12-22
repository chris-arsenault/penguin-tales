/**
 * Enrichment Helpers - Integration points for enriching entities during world generation
 *
 * These helpers were extracted from lore-weave's WorldEngine to allow
 * LLM-based enrichment to be an optional add-on module.
 *
 * When illuminator is integrated, these helpers connect WorldEngine events
 * to the EnrichmentService for description generation.
 */

import type { HardState, Relationship } from './types';
import type { Graph, Era } from './types';

// Re-export from the moved modules
export { EnrichmentService } from './llm/enrichmentService';
export { ImageGenerationService } from './llm/imageGenerationService';
export type { LoreRecord, LoreIndex, DomainLoreProvider } from './llm/types';

/**
 * Entity snapshot for change detection
 * Tracks kind-specific metrics to enable world-centric enrichment
 */
export interface EntitySnapshot {
  // Common fields
  tick: number;
  status: string;
  prominence: string;
  keyRelationshipIds: Set<string>;

  // Location-specific
  residentCount?: number;
  controllerId?: string;

  // Faction-specific
  leaderId?: string;
  territoryCount?: number;
  allyIds?: Set<string>;
  enemyIds?: Set<string>;

  // Rule-specific
  enforcerIds?: Set<string>;

  // Ability-specific
  practitionerCount?: number;
  locationIds?: Set<string>;

  // NPC-specific
  leadershipIds?: Set<string>;
}

/**
 * Enrichment analytics tracking
 * Tracks trigger counts even when enrichment is disabled
 */
export interface EnrichmentAnalytics {
  locationEnrichments: number;
  factionEnrichments: number;
  ruleEnrichments: number;
  abilityEnrichments: number;
  npcEnrichments: number;
  occurrenceEnrichments: number;
  eraEnrichments: number;
}

/**
 * Creates initial enrichment analytics
 */
export function createEnrichmentAnalytics(): EnrichmentAnalytics {
  return {
    locationEnrichments: 0,
    factionEnrichments: 0,
    ruleEnrichments: 0,
    abilityEnrichments: 0,
    npcEnrichments: 0,
    occurrenceEnrichments: 0,
    eraEnrichments: 0,
  };
}

/**
 * Increment analytics counter for an entity kind
 */
export function trackEnrichmentTrigger(
  analytics: EnrichmentAnalytics,
  kind: string
): void {
  switch (kind) {
    case 'location':
      analytics.locationEnrichments++;
      break;
    case 'faction':
      analytics.factionEnrichments++;
      break;
    case 'rules':
      analytics.ruleEnrichments++;
      break;
    case 'abilities':
      analytics.abilityEnrichments++;
      break;
    case 'npc':
      analytics.npcEnrichments++;
      break;
    case 'occurrence':
      analytics.occurrenceEnrichments++;
      break;
    case 'era':
      analytics.eraEnrichments++;
      break;
  }
}

/**
 * Get total enrichment triggers
 */
export function getTotalEnrichmentTriggers(analytics: EnrichmentAnalytics): number {
  return Object.values(analytics).reduce((a, b) => a + b, 0);
}

/**
 * Enrichment context passed to enrichment services
 */
export interface EnrichmentContext {
  tick: number;
  era: Era;
  entities: Map<string, HardState>;
  relationships: Relationship[];
  history: Array<{ tick: number; description: string }>;
}

/**
 * Build enrichment context from graph state
 */
export function buildEnrichmentContext(graph: Graph): EnrichmentContext {
  const entities = new Map<string, HardState>();
  graph.forEachEntity((entity, id) => {
    entities.set(id, entity);
  });

  return {
    tick: graph.tick,
    era: graph.currentEra,
    entities,
    relationships: graph.getRelationships(),
    history: graph.history.slice(-50).map(h => ({
      tick: h.tick,
      description: h.description,
    })),
  };
}

/**
 * Create entity snapshot for change detection
 */
export function createEntitySnapshot(
  entity: HardState,
  graph: Graph
): EntitySnapshot {
  const relationshipIds = graph
    .getEntityRelationships(entity.id, 'both')
    .map(rel => `${rel.kind}:${rel.src}:${rel.dst}`);

  const snapshot: EntitySnapshot = {
    tick: graph.tick,
    status: entity.status,
    prominence: entity.prominence,
    keyRelationshipIds: new Set(relationshipIds),
  };

  // Kind-specific tracking
  switch (entity.kind) {
    case 'location': {
      const residents = graph.findRelationships({ kind: 'resident_of', dst: entity.id });
      snapshot.residentCount = residents.length;
      const controlRels = graph.getEntityRelationships(entity.id, 'dst');
      const controller = controlRels.find(r => r.kind === 'stronghold_of' || r.kind === 'controls');
      snapshot.controllerId = controller?.src;
      break;
    }
    case 'faction': {
      const leaderRels = graph.findRelationships({ kind: 'leader_of', dst: entity.id });
      snapshot.leaderId = leaderRels[0]?.src;
      const territories = graph.getEntityRelationships(entity.id, 'src')
        .filter(r => r.kind === 'stronghold_of' || r.kind === 'controls');
      snapshot.territoryCount = territories.length;
      snapshot.allyIds = new Set(
        graph.findRelationships({ kind: 'allied_with', src: entity.id }).map(r => r.dst)
      );
      snapshot.enemyIds = new Set(
        graph.findRelationships({ kind: 'at_war_with', src: entity.id }).map(r => r.dst)
      );
      break;
    }
    case 'rules': {
      const enforcementRels = graph.getEntityRelationships(entity.id, 'dst');
      snapshot.enforcerIds = new Set(
        enforcementRels
          .filter(r => r.kind === 'weaponized_by' || r.kind === 'kept_secret_by')
          .map(r => r.src)
      );
      break;
    }
    case 'abilities': {
      const practitioners = graph.findRelationships({ kind: 'practitioner_of', dst: entity.id });
      snapshot.practitionerCount = practitioners.length;
      snapshot.locationIds = new Set(
        graph.findRelationships({ kind: 'manifests_at', src: entity.id }).map(r => r.dst)
      );
      break;
    }
    case 'npc': {
      snapshot.leadershipIds = new Set(
        graph.findRelationships({ kind: 'leader_of', src: entity.id }).map(rel => rel.dst)
      );
      break;
    }
  }

  return snapshot;
}

/**
 * Batch entity enrichment queue manager
 */
export class EnrichmentQueue {
  private queue: HardState[] = [];
  private readonly batchSize: number;
  private flushCallback: (entities: HardState[]) => void;

  constructor(batchSize: number, onFlush: (entities: HardState[]) => void) {
    this.batchSize = batchSize;
    this.flushCallback = onFlush;
  }

  /**
   * Add entity to queue, flush if batch size reached
   */
  enqueue(entity: HardState): void {
    this.queue.push(entity);
    if (this.queue.length >= this.batchSize) {
      this.flush();
    }
  }

  /**
   * Add multiple entities to queue
   */
  enqueueAll(entities: HardState[]): void {
    for (const entity of entities) {
      this.enqueue(entity);
    }
  }

  /**
   * Flush remaining entities in queue
   */
  flush(): void {
    if (this.queue.length > 0) {
      this.flushCallback([...this.queue]);
      this.queue = [];
    }
  }

  /**
   * Get current queue size
   */
  get size(): number {
    return this.queue.length;
  }
}
