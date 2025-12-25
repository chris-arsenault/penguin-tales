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
 */
export type NarrativeEventKind =
  | 'state_change'        // Entity status/prominence changed
  | 'relationship_change' // Relationship formed/dissolved/changed
  | 'entity_lifecycle'    // Birth, death, formation, dissolution
  | 'era_transition'      // Era ended/began
  | 'conflict'            // War, battle, rivalry
  | 'alliance'            // Alliances, mergers, cooperation
  | 'discovery'           // New knowledge, abilities, locations
  | 'achievement';        // Prominence gains, milestones

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
