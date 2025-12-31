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
  DisambiguationEntry,
  NarrativeEvent,
  Region,
} from '../types/world.ts';
import type { ChronicleRecord } from './chronicleStorage.ts';
import { getChronicleContent } from './chronicleStorage.ts';
import type { StaticPage } from './staticPageStorage.ts';

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
  const aliasIndex = buildAliasIndex(worldData);
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
 * Parse namespace and base name from a page title
 * e.g., "Cultures:Aurora Stack" -> { namespace: "Cultures", baseName: "Aurora Stack" }
 *       "Aurora Stack" -> { namespace: undefined, baseName: "Aurora Stack" }
 */
function parseNamespace(title: string): { namespace?: string; baseName: string } {
  const colonIndex = title.indexOf(':');
  if (colonIndex > 0 && colonIndex < title.length - 1) {
    return {
      namespace: title.slice(0, colonIndex).trim(),
      baseName: title.slice(colonIndex + 1).trim(),
    };
  }
  return { baseName: title };
}

/**
 * Get all regions (seed + emergent) for a given entity kind
 */
function getAllRegions(worldData: WorldState, entityKind: string): Region[] {
  const kindDef = worldData.schema.entityKinds.find(k => k.kind === entityKind);
  const seedRegions = kindDef?.semanticPlane?.regions ?? [];
  const emergentRegions = worldData.coordinateState?.emergentRegions?.[entityKind] ?? [];
  return [...seedRegions, ...emergentRegions];
}

/**
 * Get all regions across all entity kinds
 */
function getAllRegionsFlat(worldData: WorldState): Array<{ region: Region; entityKind: string }> {
  const results: Array<{ region: Region; entityKind: string }> = [];
  for (const kindDef of worldData.schema.entityKinds) {
    const seedRegions = kindDef.semanticPlane?.regions ?? [];
    const emergentRegions = worldData.coordinateState?.emergentRegions?.[kindDef.kind] ?? [];
    for (const region of [...seedRegions, ...emergentRegions]) {
      results.push({ region, entityKind: kindDef.kind });
    }
  }
  return results;
}

/**
 * Look up a region by ID across all entity kinds
 */
function findRegionById(worldData: WorldState, regionId: string): { region: Region; entityKind: string } | null {
  for (const kindDef of worldData.schema.entityKinds) {
    const seedRegions = kindDef.semanticPlane?.regions ?? [];
    const emergentRegions = worldData.coordinateState?.emergentRegions?.[kindDef.kind] ?? [];
    for (const region of [...seedRegions, ...emergentRegions]) {
      if (region.id === regionId) {
        return { region, entityKind: kindDef.kind };
      }
    }
  }
  return null;
}

/**
 * Build lightweight page index for navigation and search
 * This is fast and should be called on initial load
 *
 * @param chronicles - Completed ChronicleRecords from IndexedDB (preferred source for chronicles)
 * @param staticPages - Published StaticPages from IndexedDB
 */
export function buildPageIndex(
  worldData: WorldState,
  _loreData: LoreData | null, // Not used here - kept for API compatibility
  chronicles: ChronicleRecord[] = [],
  staticPages: StaticPage[] = []
): WikiPageIndex {
  const entries: PageIndexEntry[] = [];
  const byId = new Map<string, PageIndexEntry>();
  const byName = new Map<string, string>();
  const byAlias = new Map<string, string>();

  // Build entity name lookup for resolving linked entity names to IDs
  const entityByName = new Map(worldData.hardState.map(e => [e.name.toLowerCase(), e.id]));

  // Note: loreIndex is not built here - it's only needed for full page builds (buildPageById)
  // Summary/description/aliases are now read directly from entity fields

  // Build entity index entries
  for (const entity of worldData.hardState) {
    // Summary and description are now directly on entity
    const summary = entity.summary || '';
    // Aliases are in enrichment.text (the old lore record format is dead code)
    const aliases = Array.isArray(entity.enrichment?.text?.aliases)
      ? entity.enrichment.text.aliases
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

  // Build static page index entries (two-pass for proper cross-page link resolution)
  // Pass 1: Add all static page titles to byName first (including base names)
  // This ensures page-to-page links can be resolved regardless of processing order
  for (const staticPage of staticPages) {
    byName.set(staticPage.title.toLowerCase(), staticPage.pageId);
    // Also index by base name (without namespace prefix) for link resolution
    // e.g., "World:The Berg" should be findable via [[The Berg]]
    const { baseName } = parseNamespace(staticPage.title);
    const baseNameLower = baseName.toLowerCase();
    if (baseNameLower !== staticPage.title.toLowerCase() && !byName.has(baseNameLower)) {
      byName.set(baseNameLower, staticPage.pageId);
    }
  }

  // Build list of all linkable names (entities + static page base names + regions)
  const linkableNames: Array<{ name: string; id: string }> = [];
  for (const entity of worldData.hardState) {
    linkableNames.push({ name: entity.name, id: entity.id });
  }
  for (const staticPage of staticPages) {
    const { baseName } = parseNamespace(staticPage.title);
    linkableNames.push({ name: baseName, id: staticPage.pageId });
    // Also add full title if different
    if (baseName !== staticPage.title) {
      linkableNames.push({ name: staticPage.title, id: staticPage.pageId });
    }
  }
  // Add region labels as linkable names
  for (const { region } of getAllRegionsFlat(worldData)) {
    linkableNames.push({ name: region.label, id: `region:${region.id}` });
  }

  // Pass 2: Build entries with resolved linked IDs
  for (const staticPage of staticPages) {
    // Apply wikilinks to content (auto-wrap entity/page names with [[...]])
    const linkedContent = applyWikiLinks(staticPage.content, linkableNames);

    // Extract [[...]] links from the linked content
    const resolvedLinkedIds: Set<string> = new Set();
    const linkMatches = linkedContent.matchAll(/\[\[([^\]]+)\]\]/g);
    for (const match of linkMatches) {
      const nameLower = match[1].toLowerCase().trim();
      // Check if it's an entity name
      const entityId = entityByName.get(nameLower);
      if (entityId) {
        resolvedLinkedIds.add(entityId);
        continue;
      }
      // Check entity aliases
      const aliasId = byAlias.get(nameLower);
      if (aliasId) {
        resolvedLinkedIds.add(aliasId);
        continue;
      }
      // Check static page titles (including base names)
      const pageId = byName.get(nameLower);
      if (pageId) {
        resolvedLinkedIds.add(pageId);
      }
    }

    const entry: PageIndexEntry = {
      id: staticPage.pageId,
      title: staticPage.title,
      type: 'static',
      slug: `page/${staticPage.slug}`,
      summary: staticPage.summary || undefined,
      categories: [],
      static: {
        pageId: staticPage.pageId,
        status: staticPage.status,
      },
      linkedEntities: Array.from(resolvedLinkedIds),
      lastUpdated: staticPage.updatedAt,
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

  // Add region entries to index
  const allRegions = getAllRegionsFlat(worldData);
  for (const { region, entityKind } of allRegions) {
    const regionPageId = `region:${region.id}`;
    // Find entities in this region
    const entitiesInRegion = worldData.hardState.filter(
      e => e.regionId === region.id || e.allRegionIds?.includes(region.id)
    );

    const entry: PageIndexEntry = {
      id: regionPageId,
      title: region.label,
      type: 'region',
      slug: `region/${slugify(region.label)}`,
      summary: region.description,
      categories: [`region-${entityKind}`],
      linkedEntities: entitiesInRegion.map(e => e.id),
      lastUpdated: region.createdAt ?? Date.now(),
    };

    entries.push(entry);
    byId.set(entry.id, entry);
    // Also index by region label for link resolution
    const labelLower = region.label.toLowerCase();
    if (!byName.has(labelLower)) {
      byName.set(labelLower, regionPageId);
    }
  }

  // Build disambiguation index: group pages by base name (after namespace prefix)
  const byBaseName = new Map<string, DisambiguationEntry[]>();
  for (const entry of entries) {
    // Skip category entries from disambiguation
    if (entry.type === 'category') continue;

    const { namespace, baseName } = parseNamespace(entry.title);
    const baseNameLower = baseName.toLowerCase();

    if (!byBaseName.has(baseNameLower)) {
      byBaseName.set(baseNameLower, []);
    }

    byBaseName.get(baseNameLower)!.push({
      pageId: entry.id,
      title: entry.title,
      namespace,
      type: entry.type,
      entityKind: entry.entityKind,
    });
  }

  // Remove entries with only one page (no disambiguation needed)
  for (const [baseName, pages] of byBaseName) {
    if (pages.length <= 1) {
      byBaseName.delete(baseName);
    }
  }

  return { entries, byId, byName, byAlias, categories, byBaseName };
}

/**
 * Build a single page by ID (on-demand)
 * Returns null if page not found
 *
 * @param chronicles - Completed ChronicleRecords from IndexedDB (for chronicle pages)
 * @param staticPages - Published StaticPages from IndexedDB
 */
export function buildPageById(
  pageId: string,
  worldData: WorldState,
  loreData: LoreData | null,
  imageData: ImageMetadata | null,
  pageIndex: WikiPageIndex,
  chronicles: ChronicleRecord[] = [],
  staticPages: StaticPage[] = []
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

  // Static page - look up in StaticPages
  if (indexEntry.type === 'static') {
    const staticPage = staticPages.find(p => p.pageId === pageId);
    if (!staticPage) return null;
    return buildStaticPageFromStaticPage(staticPage, worldData, loreData, aliasIndex, pageIndex.byName);
  }

  // Region page
  if (indexEntry.type === 'region') {
    // Extract region ID from page ID (format: "region:region_id")
    const regionId = pageId.replace('region:', '');
    const regionInfo = findRegionById(worldData, regionId);
    if (!regionInfo) return null;
    return buildRegionPage(regionInfo.region, regionInfo.entityKind, worldData, aliasIndex);
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
 * Template variable context for static page rendering
 */
interface TemplateContext {
  worldData: WorldState;
  loreData: LoreData | null;
}

/**
 * Process template variables in content
 * Supports: {{world.context}}, {{cultures}}, {{eras}}, {{entity:Name}}, {{stats}}
 */
function processTemplateVariables(content: string, ctx: TemplateContext): string {
  const { worldData } = ctx;

  return content.replace(/\{\{([^}]+)\}\}/g, (match, variable) => {
    const trimmed = variable.trim();

    // {{world.context}} - World metadata summary
    if (trimmed === 'world.context') {
      // WorldMetadata doesn't have description, return era info instead
      const era = worldData.metadata?.era;
      const tick = worldData.metadata?.tick;
      return era ? `Era: ${era}${tick ? ` (Tick ${tick})` : ''}` : '';
    }

    // {{cultures}} - List of cultures
    if (trimmed === 'cultures') {
      const cultures = worldData.schema?.cultures || [];
      if (cultures.length === 0) return '_No cultures defined_';
      return cultures.map((c: { id: string; name?: string }) =>
        `- **${c.name || c.id}**`
      ).join('\n');
    }

    // {{eras}} - List of eras
    if (trimmed === 'eras') {
      const eras = worldData.hardState.filter(e => e.kind === 'era');
      if (eras.length === 0) return '_No eras_';
      return eras.map(e => `- [[${e.name}]]`).join('\n');
    }

    // {{stats}} - World statistics
    if (trimmed === 'stats') {
      const entityCount = worldData.hardState.length;
      const relCount = worldData.relationships.length;
      const eraCount = worldData.hardState.filter(e => e.kind === 'era').length;
      return `- **Entities:** ${entityCount}\n- **Relationships:** ${relCount}\n- **Eras:** ${eraCount}`;
    }

    // {{entity:Name}} - Entity summary
    if (trimmed.startsWith('entity:')) {
      const entityName = trimmed.slice(7).trim();
      const entity = worldData.hardState.find(
        e => e.name.toLowerCase() === entityName.toLowerCase()
      );
      if (!entity) return `_Entity "${entityName}" not found_`;
      return `**[[${entity.name}]]** (${entity.kind}${entity.subtype ? ` - ${entity.subtype}` : ''})`;
    }

    // {{kinds}} - List of entity kinds with counts
    if (trimmed === 'kinds') {
      const kindCounts = new Map<string, number>();
      for (const e of worldData.hardState) {
        kindCounts.set(e.kind, (kindCounts.get(e.kind) || 0) + 1);
      }
      return Array.from(kindCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([kind, count]) => `- **${kind}:** ${count}`)
        .join('\n');
    }

    // Unknown variable - return as-is
    return match;
  });
}

/**
 * Build a single static page from a StaticPage (IndexedDB)
 * Note: Wiki links are applied at render time in WikiPage.tsx, not here
 */
function buildStaticPageFromStaticPage(
  staticPage: StaticPage,
  worldData: WorldState,
  loreData: LoreData | null,
  aliasIndex: Map<string, string>,
  pageNameIndex: Map<string, string>
): WikiPage {
  // Process template variables before parsing sections
  const processedContent = processTemplateVariables(staticPage.content, {
    worldData,
    loreData,
  });

  // Store raw content - wiki links are applied at render time
  const { sections } = buildStaticPageSections(processedContent);

  // Build linkable names to detect entity/page references for backlinks
  const linkableNames: Array<{ name: string; id: string }> = [];
  for (const entity of worldData.hardState) {
    linkableNames.push({ name: entity.name, id: entity.id });
  }
  for (const [name, id] of pageNameIndex) {
    if (!linkableNames.some(n => n.name.toLowerCase() === name)) {
      linkableNames.push({ name, id });
    }
  }

  // Extract linked entities by scanning for name mentions (for backlinks)
  const linkedContent = applyWikiLinks(processedContent, linkableNames);
  const linkedEntities = Array.from(new Set([
    ...extractLinkedEntities(
      [{ id: 'temp', heading: '', level: 2, content: linkedContent }],
      worldData,
      aliasIndex,
      pageNameIndex
    ),
  ]));

  return {
    id: staticPage.pageId,
    slug: `page/${staticPage.slug}`,
    title: staticPage.title,
    type: 'static',
    static: {
      pageId: staticPage.pageId,
      status: staticPage.status,
    },
    content: {
      sections,
      summary: staticPage.summary || undefined,
    },
    categories: [],
    linkedEntities,
    images: [],
    lastUpdated: staticPage.updatedAt,
  };
}

/**
 * Parse markdown content into wiki sections
 */
function buildStaticPageSections(content: string): { sections: WikiSection[] } {
  const trimmed = content.trim();
  if (!trimmed) {
    return { sections: [] };
  }

  let body = trimmed;
  let pageTitle = '';

  // Extract title from first heading if present
  if (body.startsWith('# ')) {
    const lines = body.split('\n');
    pageTitle = lines[0].replace(/^#\s+/, '').trim();
    body = lines.slice(1).join('\n').trim();
  }

  const sections: WikiSection[] = [];
  let currentHeading = pageTitle || 'Content';
  let buffer: string[] = [];
  let sectionIndex = 0;

  const flush = () => {
    const sectionBody = buffer.join('\n').trim();
    if (!sectionBody) return;
    sections.push({
      id: `static-section-${sectionIndex}`,
      heading: currentHeading || 'Content',
      level: 2,
      content: sectionBody,
    });
    sectionIndex++;
  };

  for (const line of body.split('\n')) {
    if (line.startsWith('## ')) {
      flush();
      currentHeading = line.replace(/^##\s+/, '').trim() || 'Content';
      buffer = [];
      continue;
    }
    buffer.push(line);
  }

  flush();

  if (sections.length === 0 && body) {
    sections.push({
      id: 'static-section-0',
      heading: pageTitle || 'Content',
      level: 2,
      content: body,
    });
  }

  return { sections };
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
  // Summary and description are now directly on entity
  const summary = entity.summary || '';
  // Aliases are in enrichment.text
  const aliases = Array.isArray(entity.enrichment?.text?.aliases)
    ? entity.enrichment.text.aliases
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

  // Prefer enhanced page with structured sections, fall back to entity.description
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
  } else if (entity.description) {
    // Use entity's description field (now stored directly on entity)
    sections.push({
      id: `section-${sectionIndex++}`,
      heading: 'Overview',
      level: 2,
      content: entity.description,
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

  // Timeline section (narrative events)
  if (worldData.narrativeHistory && worldData.narrativeHistory.length > 0) {
    const timelineContent = formatNarrativeEvents(entity.id, worldData.narrativeHistory, worldData);
    if (timelineContent) {
      sections.push({
        id: `section-${sectionIndex++}`,
        heading: 'Timeline',
        level: 2,
        content: timelineContent,
      });
    }
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
 * Format relationships for display with expand/collapse by type
 */
function formatRelationships(
  entityId: string,
  relationships: WorldState['relationships'],
  worldData: WorldState
): string {
  const entityMap = new Map(worldData.hardState.map(e => [e.id, e]));

  // Build a map to detect bidirectional relationships
  // Key: "kind:otherId", Value: { outgoing: rel | null, incoming: rel | null }
  const relMap = new Map<string, {
    otherId: string;
    kind: string;
    outgoing: WorldState['relationships'][0] | null;
    incoming: WorldState['relationships'][0] | null;
  }>();

  for (const rel of relationships) {
    const isOutgoing = rel.src === entityId;
    const otherId = isOutgoing ? rel.dst : rel.src;
    const key = `${rel.kind}:${otherId}`;

    if (!relMap.has(key)) {
      relMap.set(key, { otherId, kind: rel.kind, outgoing: null, incoming: null });
    }
    const entry = relMap.get(key)!;
    if (isOutgoing) {
      entry.outgoing = rel;
    } else {
      entry.incoming = rel;
    }
  }

  // Build rows with direction info
  interface RelRow {
    entity: string;
    entityName: string;
    direction: '→' | '←' | '↔';
    status: string;
    since: string;
  }

  const rowsByKind = new Map<string, RelRow[]>();

  for (const [, entry] of relMap) {
    const other = entityMap.get(entry.otherId);
    if (!other) continue;

    // Determine direction
    let direction: '→' | '←' | '↔';
    let primaryRel: WorldState['relationships'][0];
    if (entry.outgoing && entry.incoming) {
      direction = '↔';
      primaryRel = entry.outgoing; // Use outgoing for metadata
    } else if (entry.outgoing) {
      direction = '→';
      primaryRel = entry.outgoing;
    } else {
      direction = '←';
      primaryRel = entry.incoming!;
    }

    const row: RelRow = {
      entity: `[[${other.name}]]`,
      entityName: other.name,
      direction,
      status: primaryRel.status || 'active',
      since: primaryRel.createdAt != null ? `Tick ${primaryRel.createdAt}` : '—',
    };

    if (!rowsByKind.has(entry.kind)) {
      rowsByKind.set(entry.kind, []);
    }
    rowsByKind.get(entry.kind)!.push(row);
  }

  // Group by (kind, direction) pair
  const byPair = new Map<string, RelRow[]>();
  for (const [kind, rows] of rowsByKind) {
    for (const row of rows) {
      const pairKey = `${kind}:${row.direction}`;
      if (!byPair.has(pairKey)) {
        byPair.set(pairKey, []);
      }
      byPair.get(pairKey)!.push(row);
    }
  }

  // Build rows for each pair, sorted by kind then direction
  const pairRows: { kind: string; direction: string; entities: string[] }[] = [];
  for (const [pairKey, rows] of byPair) {
    const [kind, direction] = pairKey.split(':');
    // Sort entities alphabetically
    const entities = rows
      .sort((a, b) => a.entityName.localeCompare(b.entityName))
      .map(r => r.entity);
    pairRows.push({ kind, direction, entities });
  }

  // Sort by kind, then by direction (↔ first, then →, then ←)
  const dirOrder = { '↔': 0, '→': 1, '←': 2 };
  pairRows.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind.localeCompare(b.kind);
    return (dirOrder[a.direction as keyof typeof dirOrder] || 0) -
           (dirOrder[b.direction as keyof typeof dirOrder] || 0);
  });

  // Build table
  const lines: string[] = [];
  lines.push('| Relation | Dir | Entities |');
  lines.push('|----------|:---:|----------|');
  for (const row of pairRows) {
    lines.push(`| ${row.kind} | ${row.direction} | ${row.entities.join(', ')} |`);
  }

  return lines.join('\n');
}

/**
 * Format narrative events for display as a table
 */
function formatNarrativeEvents(
  entityId: string,
  narrativeEvents: NarrativeEvent[],
  worldData: WorldState
): string {
  // Find events where this entity is subject, object, or participant
  const relevantEvents = narrativeEvents.filter(event => {
    if (event.subject.id === entityId) return true;
    if (event.object?.id === entityId) return true;
    if (event.participants?.some(p => p.id === entityId)) return true;
    return false;
  });

  if (relevantEvents.length === 0) return '';

  // Sort by tick (chronological order)
  const sorted = [...relevantEvents].sort((a, b) => a.tick - b.tick);

  const entityMap = new Map(worldData.hardState.map(e => [e.id, e]));

  // Build table
  const lines: string[] = [];
  lines.push('| Tick | Era | Event |');
  lines.push('|------|-----|-------|');

  for (const event of sorted) {
    let headline = event.headline;

    // Wiki-link the subject if not the current entity
    if (event.subject.id !== entityId) {
      const subjectEntity = entityMap.get(event.subject.id);
      if (subjectEntity) {
        headline = headline.replace(
          new RegExp(`\\b${escapeRegex(event.subject.name)}\\b`, 'i'),
          `[[${subjectEntity.name}]]`
        );
      }
    }

    // Wiki-link the object if present and not the current entity
    if (event.object && event.object.id !== entityId) {
      const objectEntity = entityMap.get(event.object.id);
      if (objectEntity) {
        headline = headline.replace(
          new RegExp(`\\b${escapeRegex(event.object.name)}\\b`, 'i'),
          `[[${objectEntity.name}]]`
        );
      }
    }

    // Look up era name from entity map
    const eraEntity = entityMap.get(event.era);
    const eraName = eraEntity ? eraEntity.name : event.era;

    lines.push(`| ${event.tick} | ${eraName} | ${headline} |`);
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

  // Tags (compact display)
  if (entity.tags && Object.keys(entity.tags).length > 0) {
    const tagPairs = Object.entries(entity.tags)
      .map(([k, v]) => (v === true ? k : `${k}:${v}`))
      .join(', ');
    fields.push({ label: 'Tags', value: tagPairs });
  }

  // Region (if any) - look up region name and link to region page
  if (entity.regionId) {
    const regionInfo = findRegionById(worldData, entity.regionId);
    if (regionInfo) {
      fields.push({
        label: 'Region',
        value: regionInfo.region.label,
        linkedEntity: `region:${entity.regionId}`
      });
    } else {
      fields.push({ label: 'Region', value: entity.regionId });
    }
  }

  // Coordinates (compact)
  if (entity.coordinates) {
    const { x, y, z } = entity.coordinates;
    const coordStr = `(${x.toFixed(1)}, ${y.toFixed(1)}, ${z.toFixed(1)})`;
    fields.push({ label: 'Coords', value: coordStr });
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
 * Build a region page showing all entities in that region
 */
function buildRegionPage(
  region: Region,
  entityKind: string,
  worldData: WorldState,
  _aliasIndex: Map<string, string>
): WikiPage {
  // Find all entities in this region
  const entitiesInRegion = worldData.hardState.filter(
    e => e.regionId === region.id || e.allRegionIds?.includes(region.id)
  );

  // Group entities by kind
  const byKind = new Map<string, HardState[]>();
  for (const entity of entitiesInRegion) {
    if (!byKind.has(entity.kind)) {
      byKind.set(entity.kind, []);
    }
    byKind.get(entity.kind)!.push(entity);
  }

  // Build sections
  const sections: WikiSection[] = [];

  // Overview section
  const overviewLines: string[] = [];
  if (region.description) {
    overviewLines.push(region.description);
  }
  if (region.culture) {
    const culture = worldData.schema.cultures.find(c => c.id === region.culture);
    overviewLines.push(`**Culture:** ${culture?.name ?? region.culture}`);
  }
  overviewLines.push(`**Entity Kind:** ${entityKind}`);
  overviewLines.push(`**Total Entities:** ${entitiesInRegion.length}`);

  sections.push({
    id: 'overview',
    heading: 'Overview',
    level: 2,
    content: overviewLines.join('\n\n'),
  });

  // Entities section with table per kind
  for (const [kind, entities] of byKind) {
    const rows = entities
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(e => `| [[${e.name}]] | ${e.subtype} | ${e.status} |`)
      .join('\n');

    const tableContent = `| Name | Subtype | Status |\n|------|---------|--------|\n${rows}`;

    sections.push({
      id: `entities-${kind}`,
      heading: capitalize(kind),
      level: 2,
      content: tableContent,
    });
  }

  return {
    id: `region:${region.id}`,
    slug: `region/${slugify(region.label)}`,
    title: region.label,
    type: 'region',
    content: {
      sections,
      summary: region.description,
    },
    categories: [`region-${entityKind}`],
    linkedEntities: entitiesInRegion.map(e => e.id),
    images: [],
    lastUpdated: region.createdAt ?? Date.now(),
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
 * Extract linked page IDs from content (entities and static pages)
 *
 * @param pageNameIndex - Map of lowercase name -> page ID (includes entities and static pages)
 */
function extractLinkedEntities(
  sections: WikiSection[],
  worldData: WorldState,
  aliasIndex: Map<string, string>,
  pageNameIndex?: Map<string, string>
): string[] {
  const linked: Set<string> = new Set();
  const entityByName = new Map(worldData.hardState.map(e => [e.name.toLowerCase(), e.id]));

  for (const section of sections) {
    // Find [[Entity Name]] patterns
    const matches = section.content.matchAll(/\[\[([^\]]+)\]\]/g);
    for (const match of matches) {
      const name = match[1].toLowerCase().trim();
      // Check entity names first
      const directId = entityByName.get(name);
      if (directId) {
        linked.add(directId);
        continue;
      }
      // Check entity aliases
      const aliasId = aliasIndex.get(name);
      if (aliasId) {
        linked.add(aliasId);
        continue;
      }
      // Check static page titles (via pageNameIndex which includes both)
      if (pageNameIndex) {
        const pageId = pageNameIndex.get(name);
        if (pageId) {
          linked.add(pageId);
        }
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
 * Aliases are now stored in entity.enrichment.text.aliases
 */
function buildAliasIndex(worldData: WorldState): Map<string, string> {
  const index = new Map<string, string>();

  for (const entity of worldData.hardState) {
    const aliases = Array.isArray(entity.enrichment?.text?.aliases)
      ? entity.enrichment.text.aliases
      : [];

    for (const alias of aliases) {
      if (typeof alias !== 'string') continue;
      const normalized = alias.trim().toLowerCase();
      if (!normalized) continue;
      if (!index.has(normalized)) {
        index.set(normalized, entity.id);
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

/**
 * Check if a position in the string is inside a [[wikilink]].
 */
function isInsideWikilink(text: string, position: number): boolean {
  let depth = 0;
  for (let i = 0; i < position; i++) {
    if (text[i] === '[' && text[i + 1] === '[') {
      depth++;
      i++; // Skip next char
    } else if (text[i] === ']' && text[i + 1] === ']') {
      depth = Math.max(0, depth - 1);
      i++; // Skip next char
    }
  }
  return depth > 0;
}

/**
 * Escape special regex characters in a string
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Apply wikilinks to a single section - wraps entity/page name mentions with [[...]] syntax.
 * Only links the first occurrence of each name per section (Wikipedia style).
 */
function applyWikiLinksToSection(
  section: string,
  combinedPattern: RegExp
): string {
  // Track which names have been linked in this section (lowercase for case-insensitive matching)
  const linkedInSection = new Set<string>();

  return section.replace(combinedPattern, (match, _group, offset) => {
    // Check if this position is already inside a wikilink
    if (isInsideWikilink(section, offset)) {
      return match;
    }

    // Check if we've already linked this name in this section
    const matchLower = match.toLowerCase();
    if (linkedInSection.has(matchLower)) {
      return match; // Don't link again
    }

    // Mark as linked and wrap with [[...]]
    linkedInSection.add(matchLower);
    return `[[${match}]]`;
  });
}

/**
 * Apply wikilinks to content - wraps entity/page name mentions with [[...]] syntax.
 * Only links first occurrence of each name per section (Wikipedia MOS:LINK style).
 * Used at render time to make entity names clickable.
 *
 * @param content - Raw text content
 * @param names - Array of { name, id } for entities and static pages to link
 */
export function applyWikiLinks(
  content: string,
  names: Array<{ name: string; id: string }>
): string {
  // Filter names >= 3 chars and sort by length descending (match longer names first)
  const validNames = names
    .filter((n) => n.name.length >= 3)
    .sort((a, b) => b.name.length - a.name.length);

  if (validNames.length === 0) return content;

  // Build a single regex that matches any name (word boundaries, case-insensitive)
  const patterns = validNames.map((n) => `\\b${escapeRegex(n.name)}\\b`);
  const combinedPattern = new RegExp(`(${patterns.join('|')})`, 'gi');

  // Split by section headings (## or #), keeping the delimiter
  // This regex captures the heading line so we can preserve it
  const sectionSplitRegex = /^(#{1,3}\s+.*)$/gm;
  const parts = content.split(sectionSplitRegex);

  // Process each part - headings pass through, content gets wiki-linked
  const result: string[] = [];
  for (const part of parts) {
    if (part.match(/^#{1,3}\s+/)) {
      // This is a heading - pass through unchanged
      result.push(part);
    } else {
      // This is content - apply wiki links (first occurrence per section)
      result.push(applyWikiLinksToSection(part, combinedPattern));
    }
  }

  return result.join('');
}
