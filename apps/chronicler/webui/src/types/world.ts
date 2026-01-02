import type {
  CanonrySchemaSlice,
  CultureDefinition,
  DistributionMetrics,
  EntityKindDefinition,
  HistoryEvent,
  NarrativeEvent,
  ProminenceLabel,
  SemanticCoordinates,
  SemanticRegion,
  Validation,
  WorldEntity as CanonryWorldEntity,
  WorldMetadata as CanonryWorldMetadata,
  WorldOutput as CanonryWorldOutput,
  WorldRelationship as CanonryWorldRelationship,
} from '@canonry/world-schema';

export type HardState = CanonryWorldEntity & {
  enrichment?: {
    image?: {
      imageId?: string;
    };
    text?: {
      aliases?: string[];
      visualThesis?: string;
      visualTraits?: string[];
      generatedAt?: number;
      model?: string;
    };
  };
};
export type WorldState = Omit<CanonryWorldOutput, 'hardState'> & {
  hardState: HardState[];
};
export type Relationship = CanonryWorldRelationship;
export type WorldMetadata = CanonryWorldMetadata;
export type Prominence = ProminenceLabel;
export type EntityKind = EntityKindDefinition['kind'];
export type Point = SemanticCoordinates;
export type Region = SemanticRegion;
export type Schema = CanonrySchemaSlice;

// Lore types
export type LoreType =
  | 'description'
  | 'relationship_backstory'
  | 'era_narrative'
  | 'chain_link'
  | 'discovery_event'
  | 'era_chapter'
  | 'entity_chronicle'
  | 'enhanced_entity_page'
  | 'relationship_narrative'
  | 'chronicle';

export interface LoreWikiSection {
  heading: string;
  level?: 1 | 2 | 3;
  content: string;
}

export interface LoreWikiContent {
  sections: LoreWikiSection[];
  entityRefs?: { name: string; entityId: string; occurrences: number }[];
  imageSlots?: { position: string; entityId?: string }[];
  wordCount?: number;
}

export interface LoreRecord {
  id: string;
  type: LoreType;
  targetId?: string;
  text: string;
  cached?: boolean;
  warnings?: string[];
  wikiContent?: LoreWikiContent;
  metadata?: Record<string, unknown>;
}

export interface LoreData {
  llmEnabled: boolean;
  model: string;
  records: LoreRecord[];
}

export interface EntityImage {
  entityId: string;
  entityName: string;
  entityKind: string;
  prompt: string;
  localPath: string;
  imageId: string;
}

export interface ImageMetadata {
  generatedAt: string;
  totalImages: number;
  results: EntityImage[];
}

/**
 * Lazy image loader function type
 * Takes an imageId and returns a promise that resolves to the image URL (or null)
 */
export type ImageLoader = (imageId: string) => Promise<string | null>;

/**
 * Lightweight page index entry for navigation and search
 * Contains only the minimal info needed without building full content
 */
export interface PageIndexEntry {
  id: string;
  title: string;
  type: WikiPage['type'];
  slug: string;
  summary?: string;
  aliases?: string[];
  categories: string[];
  chronicle?: {
    format: 'story' | 'document';
    entrypointId?: string;
    narrativeStyleId?: string;
    roleAssignments?: ChronicleRoleAssignment[];
    selectedEventIds?: string[];
    selectedRelationshipIds?: string[];
  };
  // For entity pages
  entityKind?: string;
  entitySubtype?: string;
  prominence?: number;
  culture?: string;
  // For static pages
  static?: {
    pageId: string;
    status: 'draft' | 'published';
  };
  // For conflux pages
  conflux?: {
    confluxId: string;
    sourceType: 'system' | 'action' | 'template';
    manifestations: number;
    touchedCount: number;
  };
  // For huddle type pages
  huddleType?: {
    entityKind: string;
    relationshipKind: string;
    instanceCount: number;
    largestSize: number;
    totalEntities: number;
  };
  // For link resolution
  linkedEntities: string[];
  lastUpdated: number;
}

/**
 * Disambiguation entry for pages sharing a base name
 */
export interface DisambiguationEntry {
  pageId: string;
  title: string;
  namespace?: string;  // e.g., "Cultures", "Names", or undefined for no namespace
  type: WikiPage['type'];
  entityKind?: string;  // For entity pages
}

/**
 * Full page index with lookup maps
 */
export interface WikiPageIndex {
  entries: PageIndexEntry[];
  // Quick lookup maps
  byId: Map<string, PageIndexEntry>;
  byName: Map<string, string>; // lowercase name -> id
  byAlias: Map<string, string>; // lowercase alias -> id
  categories: WikiCategory[];
  // Disambiguation: baseName (lowercase) -> pages sharing that base name
  byBaseName: Map<string, DisambiguationEntry[]>;
}

// Wiki-specific types
/** Role assignment for chronicle seed */
export interface ChronicleRoleAssignment {
  role: string;
  entityId: string;
  entityName: string;
  entityKind: string;
  isPrimary: boolean;
}

export interface WikiPage {
  id: string;
  slug: string;
  title: string;
  type: 'entity' | 'era' | 'category' | 'relationship' | 'chronicle' | 'static' | 'region' | 'conflux' | 'huddle-type';
  chronicle?: {
    format: 'story' | 'document';
    entrypointId?: string;
    // Seed data for generation context display
    narrativeStyleId?: string;
    roleAssignments?: ChronicleRoleAssignment[];
    selectedEventIds?: string[];
    selectedRelationshipIds?: string[];
  };
  static?: {
    pageId: string;
    status: 'draft' | 'published';
  };
  conflux?: ConfluxPageData;
  aliases?: string[];
  content: WikiContent;
  categories: string[];
  linkedEntities: string[];
  images: WikiImage[];
  /** Raw narrative events for timeline display (entity pages) */
  timelineEvents?: NarrativeEvent[];
  lastUpdated: number;
}

export interface WikiContent {
  sections: WikiSection[];
  summary?: string;
  infobox?: WikiInfobox;
}

/** Image display size for chronicle inline images */
export type WikiImageSize = 'small' | 'medium' | 'large' | 'full-width';

/** Inline image within a wiki section */
export interface WikiSectionImage {
  refId: string;
  type: 'entity_ref' | 'chronicle_image';
  imageId: string;
  anchorText: string;
  /** Character index where anchorText was found (fallback if text changes) */
  anchorIndex?: number;
  size: WikiImageSize;
  caption?: string;
}

export interface WikiSection {
  id: string;
  heading: string;
  level: 1 | 2 | 3;
  content: string;
  /** Inline images for this section (chronicle pages) */
  images?: WikiSectionImage[];
}

export interface WikiInfobox {
  type: 'entity' | 'era' | 'relationship';
  fields: WikiInfoboxField[];
  image?: WikiImage;
}

export interface WikiInfoboxField {
  label: string;
  value: string | string[];
  linkedEntity?: string;
}

export interface WikiImage {
  entityId: string;
  path: string;
  caption?: string;
}

export interface WikiCategory {
  id: string;
  name: string;
  description?: string;
  parentCategory?: string;
  type: 'auto' | 'manual';
  pageCount: number;
}

export interface WikiBacklink {
  pageId: string;
  pageTitle: string;
  pageType: WikiPage['type'];
  context: string;
}

// ============================================================================
// Conflux Types - Narrative view of simulation systems/actions
// ============================================================================

/**
 * Aggregated activity for one conflux (simulation system/action).
 * A conflux is the narrative manifestation of an underlying simulation mechanic.
 */
export interface ConfluxSummary {
  /** Internal ID (e.g., "corruption_harm", "cleanse_corruption") */
  confluxId: string;
  /** Display name (e.g., "Corruption's Embrace") */
  name: string;
  /** Description from system/action config */
  description?: string;
  /** Whether this is a system or action internally */
  sourceType: 'system' | 'action' | 'template';
  /** How many times this conflux manifested (event count) */
  manifestations: number;
  /** IDs of entities touched by this conflux */
  touchedEntityIds: string[];
  /** Breakdown of effect types: { tag_gained: 5, relationship_formed: 3 } */
  effectCounts: Record<string, number>;
  /** Tags added by this conflux */
  tagsAdded: string[];
  /** Tags removed by this conflux */
  tagsRemoved: string[];
  /** Relationship kinds created by this conflux */
  relationshipsCreated: string[];
  /** Relationship kinds ended by this conflux */
  relationshipsEnded: string[];
  /** First and last tick this conflux was active */
  tickRange: { first: number; last: number };
}

/**
 * An entity's journey through a convergence (complementary confluxes).
 * Tracks how an entity passed through both sides of related forces.
 */
export interface EntityConvergence {
  entityId: string;
  entityName: string;
  entityKind: string;
  /** Events from the first side of the convergence */
  confluxAEvents: NarrativeEvent[];
  /** Events from the complementary side */
  confluxBEvents: NarrativeEvent[];
  /** Whether the entity experienced both sides */
  complete: boolean;
}

/**
 * Detected convergence between complementary confluxes.
 * E.g., corruption_harm and cleanse_corruption form a convergence.
 */
export interface ConvergenceResult {
  /** The two confluxes that form this convergence [source, complement] */
  confluxes: [string, string];
  /** Display names for the confluxes */
  confluxNames: [string, string];
  /** Entities that journeyed through this convergence */
  journeys: EntityConvergence[];
}

/**
 * Full data for a conflux wiki page.
 */
export interface ConfluxPageData {
  summary: ConfluxSummary;
  /** All manifestation events for this conflux, sorted by tick */
  events: NarrativeEvent[];
  /** Related confluxes that share touched entities */
  relatedConfluxes: Array<{
    confluxId: string;
    name: string;
    sharedCount: number;
    convergenceDetected: boolean;
  }>;
  /** Entities most touched by this conflux (by effect count) */
  mostTouched: Array<{
    entityId: string;
    entityName: string;
    entityKind: string;
    effectCount: number;
  }>;
  /** Convergences this conflux participates in */
  convergences: ConvergenceResult[];
}

// =============================================================================
// HUDDLE TYPES - Connected subgraphs of same-kind entities with same relationship
// =============================================================================

/**
 * A category of huddles defined by entity kind + relationship kind.
 * E.g., "faction alliances" = factions connected by allied_with.
 */
export interface HuddleType {
  /** Unique ID: "{entityKind}-{relationshipKind}" */
  id: string;
  /** The entity kind that forms this huddle (e.g., "faction") */
  entityKind: string;
  /** The relationship kind that connects entities (e.g., "allied_with") */
  relationshipKind: string;
  /** Human-readable name (e.g., "Alliance Networks") */
  displayName: string;
  /** Number of distinct connected components (huddles) of this type */
  instanceCount: number;
  /** Size of the largest huddle instance */
  largestSize: number;
  /** Total entities across all instances */
  totalEntities: number;
}

/**
 * A specific huddle instance - one connected component.
 */
export interface HuddleInstance {
  /** Unique ID: "{huddleTypeId}-{index}" */
  id: string;
  /** Reference to parent huddle type */
  huddleTypeId: string;
  /** Number of entities in this huddle */
  size: number;
  /** Entity IDs in this huddle */
  entityIds: string[];
  /** Number of relationships in this huddle */
  edgeCount: number;
  /** Graph density: edgeCount / maxPossibleEdges (0-1) */
  density: number;
}

/**
 * Full data for a huddle type page showing all instances.
 */
export interface HuddleTypePageData {
  huddleType: HuddleType;
  /** All instances of this huddle type, sorted by size descending */
  instances: HuddleInstance[];
  /** Entity details for display */
  entityDetails: Map<string, { name: string; subtype: string }>;
}

/**
 * Full data for a single huddle instance page.
 */
export interface HuddleInstancePageData {
  huddleType: HuddleType;
  instance: HuddleInstance;
  /** Entities in this huddle with their connection counts */
  entities: Array<{
    id: string;
    name: string;
    subtype: string;
    connectionCount: number;
  }>;
  /** The actual relationships in this huddle */
  relationships: Array<{
    srcId: string;
    srcName: string;
    dstId: string;
    dstName: string;
    strength?: number;
  }>;
}

export type {
  CanonrySchemaSlice,
  CultureDefinition,
  DistributionMetrics,
  EntityKindDefinition,
  HistoryEvent,
  NarrativeEvent,
  Validation,
};
