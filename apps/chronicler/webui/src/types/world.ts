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

export type WorldState = CanonryWorldOutput;
export type HardState = CanonryWorldEntity;
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
  | 'entity_story'
  | 'enhanced_entity_page'
  | 'relationship_narrative';

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
}

export interface ImageMetadata {
  generatedAt: string;
  totalImages: number;
  results: EntityImage[];
}

// Wiki-specific types
export interface WikiPage {
  id: string;
  slug: string;
  title: string;
  type: 'entity' | 'era' | 'category' | 'relationship';
  content: WikiContent;
  categories: string[];
  linkedEntities: string[];
  images: WikiImage[];
  lastUpdated: number;
}

export interface WikiContent {
  summary: string;
  sections: WikiSection[];
  infobox?: WikiInfobox;
}

export interface WikiSection {
  id: string;
  heading: string;
  level: 1 | 2 | 3;
  content: string;
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
