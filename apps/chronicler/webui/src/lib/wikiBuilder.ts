/**
 * wikiBuilder - Transforms world data into wiki pages
 *
 * Wiki pages are computed views, not stored separately.
 * This module creates WikiPage objects from worldData + loreData.
 */

import type {
  WorldState,
  LoreData,
  ImageMetadata,
  WikiPage,
  WikiSection,
  WikiInfobox,
  WikiCategory,
  HardState,
  LoreRecord,
} from '../types/world.ts';

/**
 * Build all wiki pages from world data
 */
export function buildWikiPages(
  worldData: WorldState,
  loreData: LoreData | null,
  imageData: ImageMetadata | null
): WikiPage[] {
  const pages: WikiPage[] = [];
  const loreIndex = buildLoreIndex(loreData);
  const imageIndex = buildImageIndex(worldData, imageData);

  // Build entity pages
  for (const entity of worldData.hardState) {
    const page = buildEntityPage(entity, worldData, loreIndex, imageIndex);
    pages.push(page);
  }

  // Build chronicle pages
  const chroniclePages = buildChroniclePages(worldData, loreData);
  pages.push(...chroniclePages);

  // Build category pages
  const categories = buildCategories(worldData, pages);
  for (const category of categories) {
    pages.push(buildCategoryPage(category, pages));
  }

  return pages;
}

function buildChroniclePages(
  worldData: WorldState,
  loreData: LoreData | null
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

    const { sections } = buildChronicleSections(record.text);

    const linkedEntities = entityIds.length > 0
      ? entityIds
      : extractLinkedEntities(sections, worldData);

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
      },
      categories: [],
      linkedEntities: Array.from(new Set(linkedEntities)),
      images: [],
      lastUpdated: acceptedAt,
    };
  });
}

function buildChronicleSections(content: string): { sections: WikiSection[] } {
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
      id: `chronicle-section-${sectionIndex++}`,
      heading: currentHeading || 'Chronicle',
      level: 2,
      content: sectionBody,
    });
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

  return { sections };
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
  imageIndex: Map<string, string>
): WikiPage {
  const entityLore = loreIndex.get(entity.id) || [];
  const description = entityLore.find(l => l.type === 'description');
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
  } else if (description?.text || entity.description) {
    // Fall back to simple description
    sections.push({
      id: `section-${sectionIndex++}`,
      heading: 'Overview',
      level: 2,
      content: description?.text || entity.description || '',
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
  const linkedEntities = extractLinkedEntities(sections, worldData);

  // Build categories for this entity
  const categories = buildEntityCategories(entity, worldData);

  return {
    id: entity.id,
    slug: slugify(entity.name),
    title: entity.name,
    type: entity.kind === 'era' ? 'era' : 'entity',
    content: {
      sections,
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
function extractLinkedEntities(sections: WikiSection[], worldData: WorldState): string[] {
  const linked: Set<string> = new Set();
  const entityByName = new Map(worldData.hardState.map(e => [e.name.toLowerCase(), e.id]));

  for (const section of sections) {
    // Find [[Entity Name]] patterns
    const matches = section.content.matchAll(/\[\[([^\]]+)\]\]/g);
    for (const match of matches) {
      const name = match[1].toLowerCase();
      const entityId = entityByName.get(name);
      if (entityId) {
        linked.add(entityId);
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
