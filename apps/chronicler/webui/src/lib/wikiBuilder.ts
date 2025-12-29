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
import type { ChronicleRecord } from './chronicleStorage.ts';
import { getChronicleContent } from './chronicleStorage.ts';

/**
 * Chronicle image ref types (matching illuminator/chronicleTypes.ts)
 */
interface ChronicleImageRef {
  refId: string;
  anchorText: string;
  /** Character index where anchorText was found (fallback if text changes) */
  anchorIndex?: number;
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
 * @param chronicles - Completed ChronicleRecords from IndexedDB (preferred source for chronicles)
 */
export function buildWikiPages(
  worldData: WorldState,
  loreData: LoreData | null,
  imageData: ImageMetadata | null,
  chronicles: ChronicleRecord[] = []
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

  // Build chronicle pages from ChronicleRecords (IndexedDB)
  const chroniclePages = buildChroniclePagesFromChronicles(chronicles, worldData, aliasIndex);
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
 * @param chronicles - Completed ChronicleRecords from IndexedDB (preferred source for chronicles)
 */
export function buildPageIndex(
  worldData: WorldState,
  loreData: LoreData | null,
  chronicles: ChronicleRecord[] = []
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

  // Build chronicle index entries from ChronicleRecords (IndexedDB)
  for (const chronicle of chronicles) {
    const content = getChronicleContent(chronicle);
    if (!content) continue;

    const title = chronicle.title;

    const entry: PageIndexEntry = {
      id: chronicle.chronicleId,
      title,
      type: 'chronicle',
      slug: `chronicle/${slugify(title)}`,
      summary: chronicle.summary || undefined,
      categories: [],
      chronicle: {
        format: chronicle.format,
        entrypointId: chronicle.entrypointId,
        narrativeStyleId: chronicle.narrativeStyleId,
        roleAssignments: chronicle.roleAssignments,
        selectedEventIds: chronicle.selectedEventIds,
        selectedRelationshipIds: chronicle.selectedRelationshipIds,
      },
      linkedEntities: chronicle.selectedEntityIds,
      lastUpdated: chronicle.acceptedAt || chronicle.updatedAt,
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
 * @param chronicles - Completed ChronicleRecords from IndexedDB (for chronicle pages)
 */
export function buildPageById(
  pageId: string,
  worldData: WorldState,
  loreData: LoreData | null,
  imageData: ImageMetadata | null,
  pageIndex: WikiPageIndex,
  chronicles: ChronicleRecord[] = []
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

  // Chronicle page - look up in ChronicleRecords
  if (indexEntry.type === 'chronicle') {
    const chronicle = chronicles.find(c => c.chronicleId === pageId);
    if (!chronicle) return null;
    return buildChroniclePageFromChronicle(chronicle, worldData, aliasIndex);
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
 * Build a single chronicle page from a ChronicleRecord (IndexedDB)
 */
function buildChroniclePageFromChronicle(
  chronicle: ChronicleRecord,
  worldData: WorldState,
  aliasIndex: Map<string, string>
): WikiPage {
  const content = getChronicleContent(chronicle);
  const title = chronicle.title;

  // Extract image refs from chronicle
  const imageRefs = chronicle.imageRefs;

  const { sections } = buildChronicleSections(content, imageRefs, worldData);
  const summary = chronicle.summary || '';

  const linkedEntities = Array.from(new Set([
    ...chronicle.selectedEntityIds,
    ...extractLinkedEntities(sections, worldData, aliasIndex),
    ...(chronicle.entrypointId ? [chronicle.entrypointId] : []),
  ]));

  return {
    id: chronicle.chronicleId,
    slug: `chronicle/${slugify(title)}`,
    title,
    type: 'chronicle',
    chronicle: {
      format: chronicle.format,
      entrypointId: chronicle.entrypointId,
      narrativeStyleId: chronicle.narrativeStyleId,
      roleAssignments: chronicle.roleAssignments,
      selectedEventIds: chronicle.selectedEventIds,
      selectedRelationshipIds: chronicle.selectedRelationshipIds,
    },
    content: {
      sections,
      summary: summary || undefined,
    },
    categories: [],
    linkedEntities,
    images: [],
    lastUpdated: chronicle.acceptedAt || chronicle.updatedAt,
  };
}

/**
 * Build all chronicle pages from ChronicleRecords (IndexedDB)
 */
function buildChroniclePagesFromChronicles(
  chronicles: ChronicleRecord[],
  worldData: WorldState,
  aliasIndex: Map<string, string>
): WikiPage[] {
  return chronicles
    .filter(chronicle => getChronicleContent(chronicle)) // Only chronicles with content
    .map((chronicle) => buildChroniclePageFromChronicle(chronicle, worldData, aliasIndex));
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

  console.log('[wikiBuilder] buildChronicleSections:', {
    contentLength: content.length,
    sectionCount: sections.length,
    sectionHeadings: sections.map(s => s.heading),
    sectionLengths: sections.map(s => s.content.length),
    imageRefsCount: imageRefs?.refs?.length ?? 0,
  });

  // Attach images to sections by anchor text
  if (imageRefs?.refs && worldData) {
    attachImagesToSections(sections, imageRefs.refs, worldData);
  }

  console.log('[wikiBuilder] After image attachment:', {
    sectionsWithImages: sections.filter(s => s.images && s.images.length > 0).length,
    imagesPerSection: sections.map(s => ({ heading: s.heading, imageCount: s.images?.length ?? 0 })),
  });

  return { sections };
}

/**
 * Find which section contains the anchor text
 */
function findSectionForAnchor(
  sections: WikiSection[],
  anchorText: string
): WikiSection | null {
  if (!anchorText || sections.length === 0) {
    return sections.length > 0 ? sections[0] : null;
  }

  // Direct search: find which section contains the anchor text
  const anchorLower = anchorText.toLowerCase();
  for (const section of sections) {
    if (section.content.toLowerCase().includes(anchorLower)) {
      return section;
    }
  }

  // Not found - return first section as fallback
  console.warn('[wikiBuilder] Anchor text not found in any section, using first section:', anchorText);
  return sections[0];
}

/**
 * Attach images to their corresponding sections based on anchorText
 */
function attachImagesToSections(
  sections: WikiSection[],
  refs: ChronicleImageRef[],
  worldData: WorldState
): void {
  console.log('[wikiBuilder] attachImagesToSections called with:', {
    sectionCount: sections.length,
    refCount: refs.length,
    refs: refs.map(r => ({
      refId: r.refId,
      type: r.type,
      status: r.status,
      anchorText: r.anchorText?.slice(0, 50),
      anchorIndex: r.anchorIndex,
      size: r.size,
      hasGeneratedImageId: !!r.generatedImageId,
    })),
  });

  for (const ref of refs) {
    // Skip prompt requests that aren't complete
    if (ref.type === 'prompt_request' && ref.status !== 'complete') {
      console.warn('[wikiBuilder] Skipping incomplete prompt_request:', ref.refId, ref.status);
      continue;
    }

    // Find the target section by anchor text
    const section = findSectionForAnchor(sections, ref.anchorText);
    if (!section) {
      console.warn('[wikiBuilder] Could not find section for anchor:', ref.anchorText, ref);
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

    console.log('[wikiBuilder] Attaching image:', {
      refId: ref.refId,
      type: ref.type,
      imageId,
      anchorText: ref.anchorText?.slice(0, 50),
      toSection: section.heading,
      sectionContentPreview: section.content.slice(0, 100),
    });

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
      anchorIndex: ref.anchorIndex,
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
  const entityChronicle = entityLore.find(l => l.type === 'entity_chronicle');
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

  // Long-form chronicle for mythic entities
  if (entityChronicle?.text) {
    // If chronicle has structured sections from wikiContent, use those
    if (entityChronicle.wikiContent?.sections && entityChronicle.wikiContent.sections.length > 0) {
      for (const section of entityChronicle.wikiContent.sections) {
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
        content: entityChronicle.text,
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
