import type {
  CanonrySchemaSlice,
  CultureDefinition,
  DistributionMetrics,
  EntityKindDefinition,
  HistoryEvent,
  Prominence as CanonryProminence,
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
  };
};
export type WorldState = Omit<CanonryWorldOutput, 'hardState'> & {
  hardState: HardState[];
};
export type Relationship = CanonryWorldRelationship;
export type WorldMetadata = CanonryWorldMetadata;
export type Prominence = CanonryProminence;
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
  };
  // For entity pages
  entityKind?: string;
  entitySubtype?: string;
  prominence?: string;
  culture?: string;
  // For link resolution
  linkedEntities: string[];
  lastUpdated: number;
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
  type: 'entity' | 'era' | 'category' | 'relationship' | 'chronicle';
  chronicle?: {
    format: 'story' | 'document';
    entrypointId?: string;
    // Seed data for generation context display
    narrativeStyleId?: string;
    roleAssignments?: ChronicleRoleAssignment[];
    selectedEventIds?: string[];
    selectedRelationshipIds?: string[];
  };
  aliases?: string[];
  content: WikiContent;
  categories: string[];
  linkedEntities: string[];
  images: WikiImage[];
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

export type {
  CanonrySchemaSlice,
  CultureDefinition,
  DistributionMetrics,
  EntityKindDefinition,
  HistoryEvent,
  Validation,
};
