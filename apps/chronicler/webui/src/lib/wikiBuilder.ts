/**
 * wikiBuilder - Transforms world data into wiki pages
 *
 * Wiki pages are computed views, not stored separately.
 * This module creates WikiPage objects from worldData + loreData.
 *
 * Supports two modes:
 * 1. Full build: buildWikiPages() - builds all pages upfront (legacy)
 * 2. Lazy build: buildPageIndex() + buildPageById() - builds on-demand
 */

import type {
  WorldState,
  LoreData,
  ImageMetadata,
  WikiPage,
  WikiPageIndex,
  PageIndexEntry,
  WikiSection,
  WikiSectionImage,
  WikiInfobox,
  WikiCategory,
  HardState,
  LoreRecord,
} from '../types/world.ts';
import type { StoryRecord } from './storyStorage.ts';
import { getStoryContent } from './storyStorage.ts';

/**
 * Chronicle image ref types (matching illuminator/chronicleTypes.ts)
 */
interface ChronicleImageRef {
  refId: string;
  sectionId: string;
  anchorText: string;
  size: 'small' | 'medium' | 'large' | 'full-width';
  caption?: string;
  type: 'entity_ref' | 'prompt_request';
  entityId?: string;
  sceneDescription?: string;
  status?: 'pending' | 'generating' | 'complete' | 'failed';
  generatedImageId?: string;
}

interface ChronicleImageRefs {
  refs: ChronicleImageRef[];
  generatedAt: number;
  model: string;
}

/**
 * Build all wiki pages from world data (legacy full build)
 *
 * @param chronicles - Completed StoryRecords from IndexedDB (preferred source for chronicles)
 */
export function buildWikiPages(
  worldData: WorldState,
  loreData: LoreData | null,
  imageData: ImageMetadata | null,
  chronicles: StoryRecord[] = []
): WikiPage[] {
  const pages: WikiPage[] = [];
  const loreIndex = buildLoreIndex(loreData);
  const aliasIndex = buildAliasIndex(loreIndex);
  const imageIndex = buildImageIndex(worldData, imageData);

  // Build entity pages
  for (const entity of worldData.hardState) {
    const page = buildEntityPage(entity, worldData, loreIndex, imageIndex, aliasIndex);
    pages.push(page);
  }

  // Build chronicle pages from StoryRecords (IndexedDB)
  const chroniclePages = buildChroniclePagesFromStories(chronicles, worldData, aliasIndex);
  pages.push(...chroniclePages);

  // Build category pages
  const categories = buildCategories(worldData, pages);
  for (const category of categories) {
    pages.push(buildCategoryPage(category, pages));
  }

  return pages;
}

/**
 * Build lightweight page index for navigation and search
 * This is fast and should be called on initial load
 *
 * @param chronicles - Completed StoryRecords from IndexedDB (preferred source for chronicles)
 */
export function buildPageIndex(
  worldData: WorldState,
  loreData: LoreData | null,
  chronicles: StoryRecord[] = []
): WikiPageIndex {
  const entries: PageIndexEntry[] = [];
  const byId = new Map<string, PageIndexEntry>();
  const byName = new Map<string, string>();
  const byAlias = new Map<string, string>();

  const loreIndex = buildLoreIndex(loreData);

  // Build entity index entries
  for (const entity of worldData.hardState) {
    const entityLore = loreIndex.get(entity.id) || [];
    const description = entityLore.find(l => l.type === 'description');
    const summary = typeof description?.metadata?.summary === 'string'
      ? description.metadata.summary.trim()
      : '';
    const aliases = Array.isArray(description?.metadata?.aliases)
      ? description.metadata.aliases
        .filter((alias): alias is string => typeof alias === 'string')
        .map((alias) => alias.trim())
        .filter(Boolean)
      : [];

    const entry: PageIndexEntry = {
      id: entity.id,
      title: entity.name,
      type: entity.kind === 'era' ? 'era' : 'entity',
      slug: slugify(entity.name),
      summary: summary || undefined,
      aliases: aliases.length > 0 ? aliases : undefined,
      categories: buildEntityCategories(entity, worldData),
      entityKind: entity.kind,
      entitySubtype: entity.subtype,
      prominence: entity.prominence,
      culture: entity.culture,
      linkedEntities: [], // Computed on full page build
      lastUpdated: entity.updatedAt || entity.createdAt,
    };

    entries.push(entry);
    byId.set(entry.id, entry);
    byName.set(entity.name.toLowerCase(), entity.id);

    for (const alias of aliases) {
      const normalized = alias.toLowerCase();
      if (!byName.has(normalized) && !byAlias.has(normalized)) {
        byAlias.set(normalized, entity.id);
      }
    }
  }

  // Build chronicle index entries from StoryRecords (IndexedDB)
  for (const story of chronicles) {
    const content = getStoryContent(story);
    if (!content) continue;

    const title = deriveChronicleTitle(worldData, story.entityId, 'story');

    const entry: PageIndexEntry = {
      id: story.storyId,
      title,
      type: 'chronicle',
      slug: `chronicle/${slugify(title)}`,
      summary: story.summary || undefined,
      categories: [],
      chronicle: {
        format: 'story',
        entrypointId: story.entityId,
      },
      linkedEntities: [story.entityId],
      lastUpdated: story.acceptedAt || story.updatedAt,
    };

    entries.push(entry);
    byId.set(entry.id, entry);
  }

  // Build category entries (based on entity categories)
  const categoryMap = new Map<string, { id: string; name: string; pageCount: number }>();
  for (const entry of entries) {
    for (const catId of entry.categories) {
      if (!categoryMap.has(catId)) {
        categoryMap.set(catId, {
          id: catId,
          name: formatCategoryName(catId),
          pageCount: 0,
        });
      }
      categoryMap.get(catId)!.pageCount++;
    }
  }

  const categories: WikiCategory[] = Array.from(categoryMap.values())
    .map(cat => ({ ...cat, type: 'auto' as const }))
    .sort((a, b) => b.pageCount - a.pageCount);

  // Add category entries to index
  for (const category of categories) {
    const entry: PageIndexEntry = {
      id: `category-${category.id}`,
      title: `Category: ${category.name}`,
      type: 'category',
      slug: `category/${slugify(category.name)}`,
      categories: [],
      linkedEntities: entries.filter(e => e.categories.includes(category.id)).map(e => e.id),
      lastUpdated: Date.now(),
    };
    entries.push(entry);
    byId.set(entry.id, entry);
  }

  return { entries, byId, byName, byAlias, categories };
}

/**
 * Build a single page by ID (on-demand)
 * Returns null if page not found
 *
 * @param chronicles - Completed StoryRecords from IndexedDB (for chronicle pages)
 */
export function buildPageById(
  pageId: string,
  worldData: WorldState,
  loreData: LoreData | null,
  imageData: ImageMetadata | null,
  pageIndex: WikiPageIndex,
  chronicles: StoryRecord[] = []
): WikiPage | null {
  const indexEntry = pageIndex.byId.get(pageId);
  if (!indexEntry) return null;

  const loreIndex = buildLoreIndex(loreData);
  const imageIndex = buildImageIndex(worldData, imageData);

  // Build alias index from page index
  const aliasIndex = pageIndex.byAlias;

  // Entity page
  if (indexEntry.type === 'entity' || indexEntry.type === 'era') {
    const entity = worldData.hardState.find(e => e.id === pageId);
    if (!entity) return null;
    return buildEntityPage(entity, worldData, loreIndex, imageIndex, aliasIndex);
  }

  // Chronicle page - look up in StoryRecords
  if (indexEntry.type === 'chronicle') {
    const story = chronicles.find(s => s.storyId === pageId);
    if (!story) return null;
    return buildChroniclePageFromStory(story, worldData, aliasIndex);
  }

  // Category page
  if (indexEntry.type === 'category') {
    const catId = pageId.replace('category-', '');
    const category = pageIndex.categories.find(c => c.id === catId);
    if (!category) return null;

    // Build minimal page list for category
    const pagesInCategory = pageIndex.entries
      .filter(e => e.categories.includes(catId))
      .map(e => ({
        id: e.id,
        title: e.title,
        type: e.type,
        slug: e.slug,
        content: { sections: [], summary: e.summary },
        categories: e.categories,
        linkedEntities: e.linkedEntities,
        images: [],
        lastUpdated: e.lastUpdated,
      })) as WikiPage[];

    return buildCategoryPage(category, pagesInCategory);
  }

  return null;
}

/**
 * Build a single chronicle page from a StoryRecord (IndexedDB)
 */
function buildChroniclePageFromStory(
  story: StoryRecord,
  worldData: WorldState,
  aliasIndex: Map<string, string>
): WikiPage {
  const content = getStoryContent(story);
  const title = deriveChronicleTitle(worldData, story.entityId, 'story');

  // Extract image refs from story
  const imageRefs = story.imageRefs;

  const { sections } = buildChronicleSections(content, imageRefs, worldData);
  const summary = story.summary || '';

  const linkedEntities = extractLinkedEntities(sections, worldData, aliasIndex);

  if (story.entityId && !linkedEntities.includes(story.entityId)) {
    linkedEntities.push(story.entityId);
  }

  return {
    id: story.storyId,
    slug: `chronicle/${slugify(title)}`,
    title,
    type: 'chronicle',
    chronicle: {
      format: 'story',
      entrypointId: story.entityId,
    },
    content: {
      sections,
      summary: summary || undefined,
    },
    categories: [],
    linkedEntities: Array.from(new Set(linkedEntities)),
    images: [],
    lastUpdated: story.acceptedAt || story.updatedAt,
  };
}

/**
 * Build all chronicle pages from StoryRecords (IndexedDB)
 */
function buildChroniclePagesFromStories(
  chronicles: StoryRecord[],
  worldData: WorldState,
  aliasIndex: Map<string, string>
): WikiPage[] {
  return chronicles
    .filter(story => getStoryContent(story)) // Only stories with content
    .map(story => buildChroniclePageFromStory(story, worldData, aliasIndex));
}

// Legacy functions below - kept for backwards compatibility but no longer used

/**
 * @deprecated Use buildChroniclePageFromStory instead
 */
function buildSingleChroniclePage(
  record: LoreRecord,
  worldData: WorldState,
  aliasIndex: Map<string, string>
): WikiPage {
  const metadata = record.metadata || {};
  const format = metadata.format === 'document' ? 'document' : 'story';
  const entrypointId = typeof metadata.entrypointId === 'string'
    ? metadata.entrypointId
    : record.targetId;
  const entityIds = Array.isArray(metadata.entityIds)
    ? metadata.entityIds.filter((id) => typeof id === 'string')
    : [];

  const title = typeof metadata.title === 'string' && metadata.title.trim().length > 0
    ? metadata.title.trim()
    : deriveChronicleTitle(worldData, entrypointId, format);

  // Extract image refs from metadata
  const imageRefs = isChronicleImageRefs(metadata.imageRefs)
    ? metadata.imageRefs
    : undefined;

  const { sections } = buildChronicleSections(record.text, imageRefs, worldData);
  const summary = typeof metadata.summary === 'string' ? metadata.summary.trim() : '';

  const linkedEntities = entityIds.length > 0
    ? entityIds
    : extractLinkedEntities(sections, worldData, aliasIndex);

  if (entrypointId && !linkedEntities.includes(entrypointId)) {
    linkedEntities.push(entrypointId);
  }

  const acceptedAt = typeof metadata.acceptedAt === 'number' ? metadata.acceptedAt : Date.now();

  return {
    id: record.id,
    slug: `chronicle/${slugify(title)}`,
    title,
    type: 'chronicle',
    chronicle: {
      format,
      entrypointId: entrypointId || undefined,
    },
    content: {
      sections,
      summary: summary || undefined,
    },
    categories: [],
    linkedEntities: Array.from(new Set(linkedEntities)),
    images: [],
    lastUpdated: acceptedAt,
  };
}

/**
 * @deprecated Use buildChroniclePagesFromStories instead
 */
function buildChroniclePages(
  worldData: WorldState,
  loreData: LoreData | null,
  aliasIndex: Map<string, string>
): WikiPage[] {
  if (!loreData?.records) return [];

  const chronicleRecords = loreData.records.filter(
    (record) => record.type === 'chronicle' && record.text
  );

  return chronicleRecords.map((record) => {
    const metadata = record.metadata || {};
    const format = metadata.format === 'document' ? 'document' : 'story';
    const entrypointId = typeof metadata.entrypointId === 'string'
      ? metadata.entrypointId
      : record.targetId;
    const entityIds = Array.isArray(metadata.entityIds)
      ? metadata.entityIds.filter((id) => typeof id === 'string')
      : [];

    const title = typeof metadata.title === 'string' && metadata.title.trim().length > 0
      ? metadata.title.trim()
      : deriveChronicleTitle(worldData, entrypointId, format);

    // Extract image refs from metadata
    const imageRefs = isChronicleImageRefs(metadata.imageRefs)
      ? metadata.imageRefs
      : undefined;

    const { sections } = buildChronicleSections(record.text, imageRefs, worldData);
    const summary = typeof metadata.summary === 'string' ? metadata.summary.trim() : '';

    const linkedEntities = entityIds.length > 0
      ? entityIds
      : extractLinkedEntities(sections, worldData, aliasIndex);

    if (entrypointId && !linkedEntities.includes(entrypointId)) {
      linkedEntities.push(entrypointId);
    }

    const acceptedAt = typeof metadata.acceptedAt === 'number' ? metadata.acceptedAt : Date.now();

    return {
      id: record.id,
      slug: `chronicle/${slugify(title)}`,
      title,
      type: 'chronicle',
      chronicle: {
        format,
        entrypointId: entrypointId || undefined,
      },
      content: {
        sections,
        summary: summary || undefined,
      },
      categories: [],
      linkedEntities: Array.from(new Set(linkedEntities)),
      images: [],
      lastUpdated: acceptedAt,
    };
  });
}

/**
 * Type guard for ChronicleImageRefs
 */
function isChronicleImageRefs(value: unknown): value is ChronicleImageRefs {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return Array.isArray(obj.refs) && typeof obj.generatedAt === 'number';
}

function buildChronicleSections(
  content: string,
  imageRefs?: ChronicleImageRefs,
  worldData?: WorldState
): { sections: WikiSection[] } {
  const trimmed = content.trim();
  if (!trimmed) {
    return { sections: [] };
  }

  let body = trimmed;
  if (body.startsWith('# ')) {
    const lines = body.split('\n');
    body = lines.slice(1).join('\n').trim();
  }

  const sections: WikiSection[] = [];
  let currentHeading = 'Chronicle';
  let buffer: string[] = [];
  let sectionIndex = 0;

  const flush = () => {
    const sectionBody = buffer.join('\n').trim();
    if (!sectionBody) return;
    sections.push({
      id: `chronicle-section-${sectionIndex}`,
      heading: currentHeading || 'Chronicle',
      level: 2,
      content: sectionBody,
    });
    sectionIndex++;
  };

  for (const line of body.split('\n')) {
    if (line.startsWith('## ')) {
      flush();
      currentHeading = line.replace(/^##\s+/, '').trim() || 'Chronicle';
      buffer = [];
      continue;
    }
    buffer.push(line);
  }

  flush();

  if (sections.length === 0) {
    sections.push({
      id: 'chronicle-section-0',
      heading: 'Chronicle',
      level: 2,
      content: body,
    });
  }

  // Attach images to sections if imageRefs provided
  if (imageRefs?.refs && worldData) {
    attachImagesToSections(sections, imageRefs.refs, worldData);
  }

  return { sections };
}

/**
 * Attach images to their corresponding sections based on sectionId
 */
function attachImagesToSections(
  sections: WikiSection[],
  refs: ChronicleImageRef[],
  worldData: WorldState
): void {
  // Create a map from section ID patterns to actual section objects
  // The LLM generates "section-0", "section-1", etc.
  // Our sections have "chronicle-section-0", "chronicle-section-1", etc.
  const sectionMap = new Map<string, WikiSection>();
  for (const section of sections) {
    sectionMap.set(section.id, section);
    // Also map the short form (e.g., "section-0" -> "chronicle-section-0")
    const shortId = section.id.replace('chronicle-', '');
    sectionMap.set(shortId, section);
  }

  for (const ref of refs) {
    // Find the target section
    const section = sectionMap.get(ref.sectionId);
    if (!section) {
      console.warn('[wikiBuilder] Image ref section not found:', ref.sectionId, ref);
      continue;
    }

    // Skip prompt requests that aren't complete
    if (ref.type === 'prompt_request' && ref.status !== 'complete') {
      console.warn('[wikiBuilder] Skipping incomplete prompt_request:', ref.refId, ref.status);
      continue;
    }

    // Resolve the image ID
    let imageId: string | undefined;
    if (ref.type === 'entity_ref' && ref.entityId) {
      // Look up entity's image
      const entity = worldData.hardState.find(e => e.id === ref.entityId);
      imageId = entity?.enrichment?.image?.imageId;
      if (!imageId) {
        console.warn('[wikiBuilder] entity_ref has no image:', ref.refId, ref.entityId);
      }
    } else if (ref.type === 'prompt_request' && ref.generatedImageId) {
      imageId = ref.generatedImageId;
    } else if (ref.type === 'prompt_request') {
      console.warn('[wikiBuilder] prompt_request missing generatedImageId:', ref.refId, ref);
    }

    if (!imageId) continue;

    console.log('[wikiBuilder] Attaching image:', ref.refId, ref.type, imageId, ref.caption);

    // Initialize images array if needed
    if (!section.images) {
      section.images = [];
    }

    // Add the image to the section
    const sectionImage: WikiSectionImage = {
      refId: ref.refId,
      type: ref.type === 'entity_ref' ? 'entity_ref' : 'chronicle_image',
      imageId,
      anchorText: ref.anchorText,
      size: ref.size,
      caption: ref.caption,
    };

    section.images.push(sectionImage);
  }
}

function deriveChronicleTitle(
  worldData: WorldState,
  entrypointId: string | undefined,
  format: 'story' | 'document'
): string {
  const entrypoint = entrypointId
    ? worldData.hardState.find((entity) => entity.id === entrypointId)
    : undefined;
  const base = entrypoint?.name || 'Untitled';
  const suffix = format === 'document' ? 'Document' : 'Chronicle';
  return `${base} ${suffix}`;
}

/**
 * Build a single entity page
 */
function buildEntityPage(
  entity: HardState,
  worldData: WorldState,
  loreIndex: Map<string, LoreRecord[]>,
  imageIndex: Map<string, string>,
  aliasIndex: Map<string, string>
): WikiPage {
  const entityLore = loreIndex.get(entity.id) || [];
  const description = entityLore.find(l => l.type === 'description');
  const summary = typeof description?.metadata?.summary === 'string'
    ? description.metadata.summary.trim()
    : '';
  const aliases = Array.isArray(description?.metadata?.aliases)
    ? description.metadata.aliases
      .filter((alias): alias is string => typeof alias === 'string')
      .map((alias) => alias.trim())
      .filter(Boolean)
    : [];
  const eraChapter = entityLore.find(l => l.type === 'era_chapter');
  const entityStory = entityLore.find(l => l.type === 'entity_story');
  const enhancedPage = entityLore.find(l => l.type === 'enhanced_entity_page');

  // Get relationships
  const relationships = worldData.relationships.filter(
    r => r.src === entity.id || r.dst === entity.id
  );

  // Build sections
  const sections: WikiSection[] = [];
  let sectionIndex = 0;

  // Prefer enhanced page with structured sections, fall back to description
  if (enhancedPage?.wikiContent?.sections && enhancedPage.wikiContent.sections.length > 0) {
    // Use structured sections from enhanced page
    for (const section of enhancedPage.wikiContent.sections) {
      sections.push({
        id: `section-${sectionIndex++}`,
        heading: section.heading,
        level: section.level || 2,
        content: section.content,
      });
    }
  } else if (description?.text) {
    // Use enriched description only
    sections.push({
      id: `section-${sectionIndex++}`,
      heading: 'Overview',
      level: 2,
      content: description.text,
    });
  }

  // Long-form story for mythic entities
  if (entityStory?.text) {
    // If story has structured sections from wikiContent, use those
    if (entityStory.wikiContent?.sections && entityStory.wikiContent.sections.length > 0) {
      for (const section of entityStory.wikiContent.sections) {
        sections.push({
          id: `section-${sectionIndex++}`,
          heading: section.heading,
          level: section.level || 2,
          content: section.content,
        });
      }
    } else {
      sections.push({
        id: `section-${sectionIndex++}`,
        heading: 'Story',
        level: 2,
        content: entityStory.text,
      });
    }
  }

  // Era chapter content (for era entities)
  if (entity.kind === 'era' && eraChapter?.text) {
    // If chapter has structured sections from wikiContent, use those
    if (eraChapter.wikiContent?.sections && eraChapter.wikiContent.sections.length > 0) {
      for (const section of eraChapter.wikiContent.sections) {
        sections.push({
          id: `section-${sectionIndex++}`,
          heading: section.heading,
          level: section.level || 2,
          content: section.content,
        });
      }
    } else {
      sections.push({
        id: `section-${sectionIndex++}`,
        heading: 'Chronicle',
        level: 2,
        content: eraChapter.text,
      });
    }
  }

  // Relationships section
  if (relationships.length > 0) {
    const relContent = formatRelationships(entity.id, relationships, worldData);
    sections.push({
      id: `section-${sectionIndex++}`,
      heading: 'Relationships',
      level: 2,
      content: relContent,
    });
  }

  // Build infobox
  const infobox = buildEntityInfobox(entity, worldData, imageIndex);

  // Extract linked entities from content
  const linkedEntities = extractLinkedEntities(sections, worldData, aliasIndex);

  // Build categories for this entity
  const categories = buildEntityCategories(entity, worldData);

  return {
    id: entity.id,
    slug: slugify(entity.name),
    title: entity.name,
    type: entity.kind === 'era' ? 'era' : 'entity',
    aliases: aliases.length > 0 ? aliases : undefined,
    content: {
      sections,
      summary: summary || undefined,
      infobox,
    },
    categories,
    linkedEntities,
    images: imageIndex.has(entity.id)
      ? [{ entityId: entity.id, path: imageIndex.get(entity.id)!, caption: entity.name }]
      : [],
    lastUpdated: entity.updatedAt || entity.createdAt,
  };
}

/**
 * Format relationships for display
 */
function formatRelationships(
  entityId: string,
  relationships: WorldState['relationships'],
  worldData: WorldState
): string {
  const lines: string[] = [];
  const entityMap = new Map(worldData.hardState.map(e => [e.id, e]));

  // Group by relationship kind
  const byKind = new Map<string, typeof relationships>();
  for (const rel of relationships) {
    const kind = rel.kind;
    if (!byKind.has(kind)) byKind.set(kind, []);
    byKind.get(kind)!.push(rel);
  }

  for (const [kind, rels] of byKind) {
    lines.push(`**${kind}:**`);
    for (const rel of rels) {
      const otherId = rel.src === entityId ? rel.dst : rel.src;
      const other = entityMap.get(otherId);
      if (other) {
        lines.push(`- [[${other.name}]]`);
      }
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Build infobox for an entity
 */
function buildEntityInfobox(
  entity: HardState,
  worldData: WorldState,
  imageIndex: Map<string, string>
): WikiInfobox {
  const fields: WikiInfobox['fields'] = [];

  fields.push({ label: 'Type', value: entity.kind });
  if (entity.subtype) {
    fields.push({ label: 'Subtype', value: entity.subtype });
  }
  fields.push({ label: 'Status', value: entity.status });
  fields.push({ label: 'Prominence', value: entity.prominence });
  if (entity.culture) {
    fields.push({ label: 'Culture', value: entity.culture });
  }

  // Find era if applicable
  const activeEra = worldData.relationships.find(
    r => r.src === entity.id && r.kind === 'active_during'
  );
  if (activeEra) {
    const era = worldData.hardState.find(e => e.id === activeEra.dst);
    if (era) {
      fields.push({ label: 'Era', value: era.name, linkedEntity: era.id });
    }
  }

  return {
    type: entity.kind === 'era' ? 'era' : 'entity',
    fields,
    image: imageIndex.has(entity.id)
      ? { entityId: entity.id, path: imageIndex.get(entity.id)! }
      : undefined,
  };
}

/**
 * Build categories for an entity
 */
function buildEntityCategories(entity: HardState, worldData: WorldState): string[] {
  const categories: string[] = [];

  // By kind
  categories.push(`kind-${entity.kind}`);

  // By subtype
  if (entity.subtype) {
    categories.push(`subtype-${entity.subtype}`);
  }

  // By culture
  if (entity.culture) {
    categories.push(`culture-${entity.culture}`);
  }

  // By prominence
  categories.push(`prominence-${entity.prominence}`);

  // By status
  categories.push(`status-${entity.status}`);

  // By era
  const activeEra = worldData.relationships.find(
    r => r.src === entity.id && r.kind === 'active_during'
  );
  if (activeEra) {
    categories.push(`era-${activeEra.dst}`);
  }

  return categories;
}

/**
 * Build all categories from pages
 */
export function buildCategories(
  _worldData: WorldState,
  pages: WikiPage[]
): WikiCategory[] {
  void _worldData; // Reserved for future category enrichment
  const categoryMap = new Map<string, WikiCategory>();

  // Collect all category IDs from pages
  for (const page of pages) {
    for (const catId of page.categories) {
      if (!categoryMap.has(catId)) {
        categoryMap.set(catId, {
          id: catId,
          name: formatCategoryName(catId),
          type: 'auto',
          pageCount: 0,
        });
      }
      categoryMap.get(catId)!.pageCount++;
    }
  }

  return Array.from(categoryMap.values()).sort((a, b) => b.pageCount - a.pageCount);
}

/**
 * Build a category page
 */
function buildCategoryPage(category: WikiCategory, pages: WikiPage[]): WikiPage {
  const pagesInCategory = pages.filter(p => p.categories.includes(category.id));

  const content = pagesInCategory
    .map(p => `- [[${p.title}]]`)
    .join('\n');

  return {
    id: `category-${category.id}`,
    slug: `category/${slugify(category.name)}`,
    title: `Category: ${category.name}`,
    type: 'category',
    content: {
      sections: [
        {
          id: 'pages',
          heading: 'Pages',
          level: 2,
          content,
        },
      ],
    },
    categories: [],
    linkedEntities: pagesInCategory.map(p => p.id),
    images: [],
    lastUpdated: Date.now(),
  };
}

/**
 * Format category ID to display name
 */
function formatCategoryName(catId: string): string {
  // Remove prefix and capitalize
  const parts = catId.split('-');
  if (parts.length >= 2) {
    const type = parts[0];
    const value = parts.slice(1).join('-');
    return `${capitalize(type)}: ${capitalize(value.replace(/_/g, ' '))}`;
  }
  return capitalize(catId.replace(/_/g, ' '));
}

/**
 * Extract entity names that are linked in content
 */
function extractLinkedEntities(
  sections: WikiSection[],
  worldData: WorldState,
  aliasIndex: Map<string, string>
): string[] {
  const linked: Set<string> = new Set();
  const entityByName = new Map(worldData.hardState.map(e => [e.name.toLowerCase(), e.id]));

  for (const section of sections) {
    // Find [[Entity Name]] patterns
    const matches = section.content.matchAll(/\[\[([^\]]+)\]\]/g);
    for (const match of matches) {
      const name = match[1].toLowerCase().trim();
      const directId = entityByName.get(name);
      if (directId) {
        linked.add(directId);
        continue;
      }
      const aliasId = aliasIndex.get(name);
      if (aliasId) {
        linked.add(aliasId);
      }
    }
  }

  return Array.from(linked);
}

/**
 * Build index of lore records by target entity
 */
function buildLoreIndex(loreData: LoreData | null): Map<string, LoreRecord[]> {
  const index = new Map<string, LoreRecord[]>();
  if (!loreData) return index;

  for (const record of loreData.records) {
    if (record.targetId) {
      if (!index.has(record.targetId)) {
        index.set(record.targetId, []);
      }
      index.get(record.targetId)!.push(record);
    }
  }

  return index;
}

/**
 * Build index of entity images
 * Handles both file paths and object URLs
 */
function buildImageIndex(
  worldData: WorldState,
  imageData: ImageMetadata | null
): Map<string, string> {
  const index = new Map<string, string>();
  if (!imageData) return index;

  const imageById = new Map(imageData.results.map((img) => [img.imageId, img]));

  for (const entity of worldData.hardState) {
    const imageId = entity?.enrichment?.image?.imageId;
    if (!imageId) continue;

    const img = imageById.get(imageId);
    if (!img?.localPath) continue;

    // If it's already an object URL (blob:) or data URL, use it directly
    // Otherwise transform file path to web path
    const path = img.localPath;
    const webPath = path.startsWith('blob:') || path.startsWith('data:')
      ? path
      : path.replace('output/images/', 'images/');
    index.set(entity.id, webPath);
  }

  return index;
}

/**
 * Build index of entity aliases to entity IDs
 */
function buildAliasIndex(loreIndex: Map<string, LoreRecord[]>): Map<string, string> {
  const index = new Map<string, string>();

  for (const [entityId, records] of loreIndex.entries()) {
    const description = records.find((record) => record.type === 'description');
    const aliases = Array.isArray(description?.metadata?.aliases)
      ? description.metadata.aliases
      : [];

    for (const alias of aliases) {
      if (typeof alias !== 'string') continue;
      const normalized = alias.trim().toLowerCase();
      if (!normalized) continue;
      if (!index.has(normalized)) {
        index.set(normalized, entityId);
      }
    }
  }

  return index;
}

/**
 * Convert string to URL-friendly slug
 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Capitalize first letter
 */
function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
