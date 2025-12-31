/**
 * World Output Types
 *
 * Canonical, fully qualified world output shape emitted by Lore Weave.
 * MFEs select what they need directly from this structure without mapping.
 */

import type { CanonrySchemaSlice } from './mfeContracts.js';
import type { SemanticRegion } from './entityKind.js';

/**
 * Prominence level for entities
 */
export type Prominence = 'forgotten' | 'marginal' | 'recognized' | 'renowned' | 'mythic';

/**
 * 3D coordinates in semantic space
 */
export interface SemanticCoordinates {
  x: number;
  y: number;
  z: number;
}

/**
 * Entity tags as key-value pairs
 */
export type EntityTags = Record<string, string | boolean>;

/**
 * Execution context for lineage tracking.
 *
 * Every mutation (entity creation, relationship creation, tag change, field change)
 * happens within an execution context. This enables:
 * - Deduplication: "This relationship was already counted in creation_batch"
 * - Causality: "This tag change was caused by system X"
 * - Debugging: "Why does this entity have this tag?"
 *
 * See: apps/lore-weave/lib/narrative/LINEAGE.md for full design.
 */
export type ExecutionSource = 'template' | 'system' | 'action' | 'pressure' | 'seed' | 'framework';

export interface ExecutionContext {
  /** Tick when this execution occurred */
  tick: number;
  /** What kind of thing triggered this execution */
  source: ExecutionSource;
  /** Identifier for the specific template/system/action (e.g., "hero_emergence") */
  sourceId: string;
}

/**
 * World entity (current or historical)
 */
export interface WorldEntity {
  id: string;
  kind: string;
  subtype: string;
  name: string;
  description: string;
  status: string;
  prominence: Prominence;
  culture: string;
  tags: EntityTags;
  createdAt: number;
  updatedAt: number;
  coordinates: SemanticCoordinates;
  temporal?: { startTick: number; endTick: number | null };
  catalyst?: {
    canAct: boolean;
    catalyzedEvents: Array<{
      relationshipId?: string;
      entityId?: string;
      action: string;
      tick: number;
    }>;
  };
  regionId?: string | null;
  allRegionIds?: string[];
  /** Short user-defined summary (distinct from LLM-generated description) */
  summary?: string;
  /** If true, the summary field should not be overwritten by enrichment */
  lockedSummary?: boolean;
  /**
   * Lineage: what created this entity.
   * Part of the unified lineage system - see LINEAGE.md.
   * Persistent on entities for debugging and causal queries.
   */
  createdBy?: ExecutionContext;
}

/**
 * World relationship between entities
 */
export interface WorldRelationship {
  kind: string;
  src: string;
  dst: string;
  strength?: number;
  distance?: number;
  category?: string;
  createdAt?: number;
  catalyzedBy?: string;
  status?: 'active' | 'historical';
  archivedAt?: number;
  /**
   * Lineage: what created this relationship.
   * Part of the unified lineage system - see LINEAGE.md.
   * Persistent on relationships for debugging and causal queries.
   */
  createdBy?: ExecutionContext;
}

/**
 * World history event
 */
export interface HistoryEvent {
  tick: number;
  era: string;
  type: 'growth' | 'simulation' | 'special';
  description: string;
  entitiesCreated: string[];
  relationshipsCreated: WorldRelationship[];
  entitiesModified: string[];
}

/**
 * Narrative event types for story generation
 *
 * Domain-agnostic event kinds that can be detected from framework primitives
 * and optional polarity metadata on relationships and statuses.
 */
export type NarrativeEventKind =
  // === Core events (no metadata required) ===
  | 'state_change'           // Entity status/prominence changed
  | 'relationship_dissolved' // Relationship ended (not creation - too noisy)
  | 'relationship_ended'     // Relationship ended due to lifecycle
  | 'entity_lifecycle'       // Birth, death, formation, dissolution
  | 'era_transition'         // Era ended/began
  | 'succession'             // Container entity ended, members reorganized
  | 'coalescence'            // Multiple entities joined under one container via part_of
  // === Polarity-based events (require relationship polarity metadata) ===
  | 'betrayal'               // Positive relationship dissolved
  | 'reconciliation'         // Negative relationship dissolved
  | 'rivalry_formed'         // Negative relationship created between known entities
  | 'alliance_formed'        // Multiple positive relationships formed in same tick
  | 'relationship_formed'    // Single relationship created by system (not template)
  // === Status polarity events (require status polarity metadata) ===
  | 'downfall'               // Status changed to negative polarity
  | 'triumph'                // Status changed to positive polarity
  // === Leadership events ===
  | 'leadership_established' // First authority connection for a target
  // === War events ===
  | 'war_started'            // Negative-polarity component formed (multi-entity)
  | 'war_ended'              // Negative-polarity component dissolved (multi-entity)
  // === Authority events (require isAuthority subtype metadata) ===
  | 'power_vacuum'           // Authority entity ended with no clear successor
  // === Tag events ===
  | 'tag_gained'             // Entity gained a tag during simulation
  | 'tag_lost'               // Entity lost a tag during simulation
  // === Creation events ===
  | 'creation_batch';        // Template created entities and relationships

/**
 * Entity reference for narrative events
 */
export interface NarrativeEntityRef {
  id: string;
  name: string;
  kind: string;
  subtype: string;
}

/**
 * State change captured during simulation
 */
export interface NarrativeStateChange {
  entityId: string;
  entityName: string;
  entityKind: string;
  field: string;
  previousValue: unknown;
  newValue: unknown;
  reason?: string;
}

/**
 * Narrative event for story generation
 *
 * Captures semantically meaningful world changes with causality
 * for feeding into long-form narrative generation.
 */
export interface NarrativeEvent {
  id: string;
  tick: number;
  era: string;
  eventKind: NarrativeEventKind;
  /** Significance score 0.0-1.0 (higher = more narratively important) */
  significance: number;
  subject: NarrativeEntityRef;
  action: string;
  object?: NarrativeEntityRef;
  /** Multi-entity participation for group events */
  participants?: NarrativeEntityRef[];
  /** Short description: "King Aldric dies in battle" */
  headline: string;
  /** Longer narrative description */
  description: string;
  stateChanges: NarrativeStateChange[];
  causedBy?: {
    eventId?: string;
    entityId?: string;
    actionType?: string;
  };
  /** Child event IDs (populated by downstream events) */
  consequences?: string[];
  /** Tags for filtering: ['death', 'war', 'royal'] */
  narrativeTags: string[];
}

/**
 * Emergent region state only (seed regions live in schema)
 */
export interface CoordinateState {
  emergentRegions: Record<string, SemanticRegion[]>;
}

/**
 * Validation result (optional)
 */
export interface ValidationResult {
  name: string;
  passed: boolean;
  failureCount: number;
  details: string;
}

export interface Validation {
  totalChecks: number;
  passed: number;
  failed: number;
  results: ValidationResult[];
}

/**
 * Distribution metrics (optional)
 */
export interface GraphMetrics {
  clusters: number;
  avgClusterSize: number;
  intraClusterDensity: number;
  interClusterDensity: number;
  isolatedNodes: number;
  isolatedNodeRatio: number;
}

/**
 * Reachability metrics (pure connectivity, no clustering thresholds)
 */
export interface ReachabilityMetrics {
  connectedComponents: number;
  fullyConnectedTick?: number | null;
}

export interface DistributionMetrics {
  entityKindRatios?: Record<string, number>;
  prominenceRatios?: Record<string, number>;
  relationshipTypeRatios?: Record<string, number>;
  graphMetrics?: GraphMetrics;
  deviation?: {
    overall: number;
    entityKind: number;
    prominence: number;
    relationship: number;
    connectivity: number;
  };
  targets?: Record<string, unknown>;
}

/**
 * World metadata
 */
export interface WorldMetadata {
  /** Unique identifier for this simulation run - used to associate enrichment content */
  simulationRunId: string;
  tick: number;
  epoch: number;
  era: string;
  historyEventCount: number;
  durationMs?: number;
  isComplete?: boolean;
  entityCount?: number;
  relationshipCount?: number;
  metaEntityCount?: number;
  enriched?: boolean;
  enrichedAt?: number;
  metaEntityFormation?: {
    totalFormed: number;
    formations: Array<Record<string, unknown>>;
    comment?: string;
  };
  reachability?: ReachabilityMetrics;
  enrichmentTriggers?: Record<string, unknown>;
}

/**
 * Fully qualified world output
 */
export interface WorldOutput {
  schema: CanonrySchemaSlice;
  metadata: WorldMetadata;
  hardState: WorldEntity[];
  relationships: WorldRelationship[];
  pressures: Record<string, number>;
  history: HistoryEvent[];
  /** Narrative events for story generation (optional, enabled via config) */
  narrativeHistory?: NarrativeEvent[];
  distributionMetrics?: DistributionMetrics;
  coordinateState?: CoordinateState;
  validation?: Validation;
}
