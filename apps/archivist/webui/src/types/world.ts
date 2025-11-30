// Prominence is now dynamic from uiSchema, but we keep a type alias for compatibility
export type Prominence = string;

// EntityKind is now dynamic from uiSchema
export type EntityKind = string;

// UI Schema types - populated from domain configuration
export interface EntityKindSchema {
  kind: string;
  displayName: string;
  color: string;
  shape: string;
  subtypes: string[];
  statusValues: string[];
}

export interface RelationshipKindSchema {
  kind: string;
  description?: string;
  srcKinds: string[];
  dstKinds: string[];
  category: string;
}

export interface CultureSchema {
  id: string;
  name: string;
  description?: string;
}

// Region types for coordinate map visualization
export interface CircleBounds {
  shape: 'circle';
  center: { x: number; y: number };
  radius: number;
}

export interface RectBounds {
  shape: 'rect';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface PolygonBounds {
  shape: 'polygon';
  points: Array<{ x: number; y: number }>;
}

export type RegionBounds = CircleBounds | RectBounds | PolygonBounds;

export interface RegionSchema {
  id: string;
  label: string;
  description: string;
  bounds: RegionBounds;
  zRange?: { min: number; max: number };
  parentRegion?: string;
  metadata?: Record<string, unknown>;
}

// Entity coordinate types - simple Point per entity kind
export interface Point {
  x: number;
  y: number;
  z: number;
}

// Each entity kind has its own coordinate space with its own regions
export interface EntityKindMapConfig {
  entityKind: string;
  name: string;
  description: string;
  bounds: { min: number; max: number };
  hasZAxis: boolean;
  zAxisLabel?: string;
}

export interface UISchema {
  worldName: string;
  worldIcon: string;
  entityKinds: EntityKindSchema[];
  relationshipKinds: RelationshipKindSchema[];
  prominenceLevels: string[];
  cultures: CultureSchema[];
  regions?: RegionSchema[];  // Global regions (deprecated - use perKindMaps)
  coordinateBounds?: { min: number; max: number };  // Global bounds (deprecated - use perKindMaps)
  perKindMaps?: Record<string, EntityKindMapConfig>;  // Per-entity-kind map configurations
  perKindRegions?: Record<string, RegionSchema[]>;  // Per-entity-kind region lists
}

export interface Relationship {
  kind: string;
  src: string;
  dst: string;
  strength?: number;
  distance?: number;
  status?: 'active' | 'historical';
  archivedAt?: number;
}

export interface HardState {
  id: string;
  kind: EntityKind;
  subtype: string;
  name: string;
  description: string;
  status: string;
  prominence: Prominence;
  culture?: string;
  tags: Record<string, string | boolean> | string[];
  links: Relationship[];
  coordinates?: Point;  // Simple {x, y, z} - each entity kind has its own coordinate space
  createdAt: number;
  updatedAt: number;
}

export interface HistoryEvent {
  tick: number;
  era: string;
  type: 'growth' | 'simulation' | 'special';
  description: string;
  entitiesCreated: string[];
  relationshipsCreated: Relationship[];
  entitiesModified: string[];
}

export interface EnrichmentTriggers {
  total: number;
  byKind: {
    locationEnrichments: number;
    factionEnrichments: number;
    ruleEnrichments: number;
    abilityEnrichments: number;
    npcEnrichments: number;
  };
  comment: string;
}

export interface WorldMetadata {
  tick: number;
  epoch: number;
  era: string;
  entityCount: number;
  relationshipCount: number;
  historyEventCount: number;
  enrichmentTriggers: EnrichmentTriggers;
}

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

export interface GraphMetrics {
  clusters: number;
  avgClusterSize: number;
  intraClusterDensity: number;
  interClusterDensity: number;
  isolatedNodes: number;
  isolatedNodeRatio: number;
}

export interface DistributionMetrics {
  entityKindRatios: Record<string, number>;
  prominenceRatios: Record<string, number>;
  relationshipTypeRatios: Record<string, number>;
  graphMetrics: GraphMetrics;
  deviation: Record<string, number>;
  targets: Record<string, any>;
}

export interface WorldState {
  metadata: WorldMetadata;
  hardState: HardState[];
  relationships: Relationship[];
  pressures: Record<string, number>;
  history: HistoryEvent[];
  uiSchema?: UISchema;
  distributionMetrics?: DistributionMetrics;
  validation?: Validation;
}

export interface Filters {
  kinds: EntityKind[];
  minProminence: Prominence;
  timeRange: [number, number];
  tags: string[];
  searchQuery: string;
  relationshipTypes: string[];
  minStrength: number;
  showCatalyzedBy: boolean;
  showHistoricalRelationships: boolean;
}

export type GraphMode = 'full' | 'radial' | 'temporal' | 'faction' | 'conflict' | 'economic';

// Lore types
export type LoreType = 'description' | 'relationship_backstory' | 'era_narrative' | 'chain_link' | 'discovery_event';

export interface LoreRecord {
  id: string;
  type: LoreType;
  targetId?: string;  // For description, relationship_backstory, chain_link, discovery_event
  text: string;
  cached?: boolean;
  warnings?: string[];
}

export interface DescriptionLore extends LoreRecord {
  type: 'description';
  targetId: string;
}

export interface RelationshipBackstoryLore extends LoreRecord {
  type: 'relationship_backstory';
  targetId: string;
  relationship: {
    kind: string;
    src: string;
    dst: string;
  };
}

export interface EraNarrativeLore extends LoreRecord {
  type: 'era_narrative';
  metadata: {
    from: string;
    to: string;
    tick: number;
  };
}

export interface ChainLinkLore extends LoreRecord {
  type: 'chain_link';
  targetId: string;
  metadata: {
    sourceLocation: string;
    revealedTheme: string;
  };
}

export interface DiscoveryEventLore extends LoreRecord {
  type: 'discovery_event';
  targetId: string;
  metadata: {
    explorer: string;
    discoveryType: 'pressure' | 'chain';
    significance: string;
    tick: number;
  };
}

export interface LoreData {
  llmEnabled: boolean;
  model: string;
  records: (DescriptionLore | RelationshipBackstoryLore | EraNarrativeLore | ChainLinkLore | DiscoveryEventLore)[];
}

export interface EntityImage {
  entityId: string;
  entityName: string;
  entityKind: string;
  prompt: string;
  localPath: string;
}

export interface ImageMetadata {
  generatedAt: string;
  totalImages: number;
  results: EntityImage[];
}
