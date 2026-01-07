/**
 * WikiExplorer - Main layout for the Chronicler wiki
 *
 * MediaWiki-inspired layout with:
 * - Search bar at top
 * - Navigation sidebar (left)
 * - Content area (center)
 * - Page actions/info (right, optional)
 */

import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import type { WorldState, LoreData, ImageMetadata, WikiPage, HardState, ImageLoader } from '../types/world.ts';
import { buildPageIndex, buildPageById } from '../lib/wikiBuilder.ts';
import { getCompletedChroniclesForSimulation, type ChronicleRecord } from '../lib/chronicleStorage.ts';
import { getPublishedStaticPagesForProject, type StaticPage } from '../lib/staticPageStorage.ts';
import WikiNav from './WikiNav.tsx';
import ChronicleIndex from './ChronicleIndex.tsx';
import ConfluxesIndex from './ConfluxesIndex.tsx';
import HuddlesIndex from './HuddlesIndex.tsx';
import WikiPageView from './WikiPage.tsx';
import WikiSearch from './WikiSearch.tsx';
import {
  buildProminenceScale,
  DEFAULT_PROMINENCE_DISTRIBUTION,
  prominenceLabelFromScale,
  type ProminenceScale,
} from '@canonry/world-schema';

/**
 * Parse page ID from URL hash
 * Hash format: #/page/{pageId} or #/ for home
 */
function parseHashPageId(): string | null {
  const hash = window.location.hash;
  if (!hash || hash === '#/' || hash === '#') {
    return null;
  }
  // Match #/page/{pageId}
  const match = hash.match(/^#\/page\/(.+)$/);
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * Build hash URL for a page
 */
function buildPageHash(pageId: string | null): string {
  if (!pageId) {
    return '#/';
  }
  return `#/page/${encodeURIComponent(pageId)}`;
}

function normalizeChronicles(records?: ChronicleRecord[]): ChronicleRecord[] {
  if (!records) return [];
  return records
    .filter((record) => record && record.chronicleId && record.title)
    .map((record) => ({
      ...record,
      roleAssignments: record.roleAssignments ?? [],
      selectedEntityIds: record.selectedEntityIds ?? [],
      selectedEventIds: record.selectedEventIds ?? [],
      selectedRelationshipIds: record.selectedRelationshipIds ?? [],
    }))
    .sort((a, b) => (b.acceptedAt || b.updatedAt || 0) - (a.acceptedAt || a.updatedAt || 0));
}

function normalizeStaticPages(pages?: StaticPage[]): StaticPage[] {
  if (!pages) return [];
  return pages
    .filter((page) => page && page.pageId && page.title && page.slug)
    .map((page) => ({
      ...page,
      status: page.status || 'published',
    }))
    .filter((page) => page.status === 'published')
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

// Theme colors matching canonry arctic theme
const colors = {
  bgPrimary: '#0a1929',
  bgSecondary: '#1e3a5f',
  bgTertiary: '#2d4a6f',
  bgSidebar: '#0c1f2e',
  border: 'rgba(59, 130, 246, 0.3)',
  textPrimary: '#ffffff',
  textSecondary: '#93c5fd',
  textMuted: '#60a5fa',
  accent: '#10b981', // Emerald for chronicler
  accentLight: '#34d399',
};

const styles = {
  container: {
    display: 'flex',
    height: '100%',
    backgroundColor: colors.bgPrimary,
    color: colors.textPrimary,
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  },
  sidebar: {
    width: '240px',
    flexShrink: 0,
    backgroundColor: colors.bgSidebar,
    borderRight: `1px solid ${colors.border}`,
    display: 'flex',
    flexDirection: 'column' as const,
    overflow: 'hidden',
  },
  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    overflow: 'hidden',
  },
  header: {
    padding: '12px 24px',
    borderBottom: `1px solid ${colors.border}`,
    backgroundColor: colors.bgSecondary,
  },
  content: {
    flex: 1,
    overflow: 'auto',
    padding: '24px',
  },
  searchContainer: {
    padding: '16px',
    borderBottom: `1px solid ${colors.border}`,
  },
};

interface WikiExplorerProps {
  /** Project ID - used to load static pages (project-scoped, not simulation-scoped) */
  projectId?: string;
  worldData: WorldState;
  loreData: LoreData | null;
  imageData: ImageMetadata | null;
  /** Lazy image loader - loads images on-demand from IndexedDB */
  imageLoader?: ImageLoader;
  chronicles?: ChronicleRecord[];
  staticPages?: StaticPage[];
}

export default function WikiExplorer({
  projectId,
  worldData,
  loreData,
  imageData,
  imageLoader,
  chronicles: chroniclesOverride,
  staticPages: staticPagesOverride,
}: WikiExplorerProps) {
  // Initialize from hash on mount
  const [currentPageId, setCurrentPageId] = useState<string | null>(() => parseHashPageId());
  const [searchQuery, setSearchQuery] = useState('');

  // Chronicles and static pages loaded from IndexedDB
  const [chronicles, setChronicles] = useState<ChronicleRecord[]>(() => normalizeChronicles(chroniclesOverride));
  const [staticPages, setStaticPages] = useState<StaticPage[]>(() => normalizeStaticPages(staticPagesOverride));
  const [isRefreshing, setIsRefreshing] = useState(false);
  const simulationRunId = (worldData as { metadata?: { simulationRunId?: string } }).metadata?.simulationRunId;
  const hasChroniclesOverride = chroniclesOverride !== undefined;
  const hasStaticPagesOverride = staticPagesOverride !== undefined;

  // Load chronicles from IndexedDB when simulationRunId changes
  useEffect(() => {
    if (hasChroniclesOverride) {
      setChronicles(normalizeChronicles(chroniclesOverride));
      return;
    }
    if (!simulationRunId) {
      setChronicles([]);
      return;
    }

    let cancelled = false;

    async function loadChronicles() {
      try {
        const loadedChronicles = await getCompletedChroniclesForSimulation(simulationRunId!);
        if (!cancelled) {
          setChronicles(loadedChronicles);
        }
      } catch (err) {
        console.error('[WikiExplorer] Failed to load chronicles:', err);
        if (!cancelled) {
          setChronicles([]);
        }
      }
    }

    loadChronicles();

    return () => {
      cancelled = true;
    };
  }, [chroniclesOverride, hasChroniclesOverride, simulationRunId]);

  // Load static pages from IndexedDB when projectId changes
  useEffect(() => {
    if (hasStaticPagesOverride) {
      setStaticPages(normalizeStaticPages(staticPagesOverride));
      return;
    }
    if (!projectId) {
      setStaticPages([]);
      return;
    }

    let cancelled = false;

    async function loadStaticPages() {
      try {
        const loadedPages = await getPublishedStaticPagesForProject(projectId!);
        if (!cancelled) {
          setStaticPages(loadedPages);
        }
      } catch (err) {
        console.error('[WikiExplorer] Failed to load static pages:', err);
        if (!cancelled) {
          setStaticPages([]);
        }
      }
    }

    loadStaticPages();

    return () => {
      cancelled = true;
    };
  }, [projectId, staticPagesOverride, hasStaticPagesOverride]);

  // Sync hash changes to state (for back/forward buttons)
  useEffect(() => {
    const handleHashChange = () => {
      const pageId = parseHashPageId();
      setCurrentPageId(pageId);
      setSearchQuery('');
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Validate world data before building index
  // Returns first validation error found, or null if valid
  const dataError = useMemo((): { message: string; details: string } | null => {
    for (const entity of worldData.hardState) {
      // Validate prominence is numeric
      if (typeof entity.prominence !== 'number') {
        return {
          message: 'Invalid entity data format',
          details: `Entity "${entity.name}" (${entity.id}) has prominence="${entity.prominence}" (${typeof entity.prominence}). ` +
            `Expected a number (0-5). The saved simulation data may be from an older format.`,
        };
      }
    }
    return null;
  }, [worldData]);

  const prominenceScale = useMemo(() => {
    if (dataError) {
      return buildProminenceScale([], { distribution: DEFAULT_PROMINENCE_DISTRIBUTION });
    }
    const values = worldData.hardState
      .map((entity) => entity.prominence)
      .filter((value) => typeof value === 'number' && Number.isFinite(value));
    return buildProminenceScale(values, { distribution: DEFAULT_PROMINENCE_DISTRIBUTION });
  }, [worldData, dataError]);

  // Build lightweight page index (fast) - only if data is valid
  const { pageIndex, entityIndex } = useMemo(() => {
    if (dataError) {
      // Return empty index when data is invalid
      return {
        pageIndex: { entries: [], byId: new Map(), byName: new Map(), byAlias: new Map(), categories: [], byBaseName: new Map() },
        entityIndex: new Map<string, HardState>(),
      };
    }
    const pageIndex = buildPageIndex(worldData, loreData, chronicles, staticPages, prominenceScale);
    const entityIndex = new Map<string, HardState>();
    for (const entity of worldData.hardState) {
      entityIndex.set(entity.id, entity);
    }
    return { pageIndex, entityIndex };
  }, [worldData, loreData, chronicles, staticPages, dataError, prominenceScale]);

  // Page cache - stores fully built pages by ID
  const pageCacheRef = useRef<Map<string, WikiPage>>(new Map());

  // Clear cache when data changes
  useEffect(() => {
    pageCacheRef.current.clear();
  }, [worldData, loreData, imageData, chronicles, staticPages]);

  // Get a page from cache or build it on-demand
  const getPage = useCallback((pageId: string): WikiPage | null => {
    const cache = pageCacheRef.current;
    if (cache.has(pageId)) {
      return cache.get(pageId)!;
    }

    const page = buildPageById(
      pageId,
      worldData,
      loreData,
      imageData,
      pageIndex,
      chronicles,
      staticPages,
      prominenceScale
    );
    if (page) {
      cache.set(pageId, page);
    }
    return page;
  }, [worldData, loreData, imageData, pageIndex, chronicles, staticPages, prominenceScale]);

  // Convert index entries to minimal WikiPage objects for navigation components
  const indexAsPages = useMemo(() => {
    return pageIndex.entries.map(entry => ({
      id: entry.id,
      title: entry.title,
      type: entry.type,
      slug: entry.slug,
      chronicle: entry.chronicle,
      aliases: entry.aliases,
      content: { sections: [], summary: entry.summary },
      categories: entry.categories,
      linkedEntities: entry.linkedEntities,
      images: [],
      lastUpdated: entry.lastUpdated,
    })) as WikiPage[];
  }, [pageIndex]);

  const chroniclePages = useMemo(
    () => indexAsPages.filter((page) => page.type === 'chronicle' && page.chronicle),
    [indexAsPages]
  );

  const staticPagesAsWikiPages = useMemo(
    () => indexAsPages.filter((page) => page.type === 'static'),
    [indexAsPages]
  );

  // Get conflux pages from page index entries (need PageIndexEntry type for conflux data)
  const confluxPages = useMemo(
    () => pageIndex.entries.filter((entry) => entry.type === 'conflux'),
    [pageIndex.entries]
  );

  // Get huddle pages from page index entries
  const huddlePages = useMemo(
    () => pageIndex.entries.filter((entry) => entry.type === 'huddle-type'),
    [pageIndex.entries]
  );

  // Get current page
  const isChronicleIndex = currentPageId === 'chronicles'
    || currentPageId === 'chronicles-story'
    || currentPageId === 'chronicles-document';

  const isPagesIndex = currentPageId === 'pages';

  const isConfluxesIndex = currentPageId === 'confluxes';

  const isHuddlesIndex = currentPageId === 'huddles';

  // Check if it's a page category (e.g., "page-category-System")
  const isPageCategory = currentPageId?.startsWith('page-category-');
  const pageCategoryNamespace = isPageCategory
    ? currentPageId!.replace('page-category-', '')
    : null;

  // Build current page on-demand
  const currentPage = !isChronicleIndex && !isPagesIndex && !isConfluxesIndex && !isHuddlesIndex && !isPageCategory && currentPageId
    ? getPage(currentPageId)
    : null;

  // Get disambiguation entries for current page (if any)
  const currentDisambiguation = useMemo(() => {
    if (!currentPage) return undefined;
    // Parse namespace from title (e.g., "Cultures:Aurora Stack" -> baseName: "Aurora Stack")
    const colonIdx = currentPage.title.indexOf(':');
    const baseName = colonIdx > 0 && colonIdx < currentPage.title.length - 1
      ? currentPage.title.slice(colonIdx + 1).trim().toLowerCase()
      : currentPage.title.toLowerCase();
    return pageIndex.byBaseName.get(baseName);
  }, [currentPage, pageIndex.byBaseName]);

  // Update page/tab title based on current page
  useEffect(() => {
    if (currentPage) {
      document.title = `${currentPage.title} | The Canonry`;
    } else if (isChronicleIndex) {
      document.title = 'Chronicles | The Canonry';
    } else if (isPagesIndex) {
      document.title = 'Pages | The Canonry';
    } else if (isConfluxesIndex) {
      document.title = 'Confluxes | The Canonry';
    } else if (isHuddlesIndex) {
      document.title = 'Huddles | The Canonry';
    } else if (isPageCategory && pageCategoryNamespace) {
      document.title = `${pageCategoryNamespace} | The Canonry`;
    } else {
      document.title = 'The Canonry';
    }
  }, [currentPage, isChronicleIndex, isPagesIndex, isConfluxesIndex, isHuddlesIndex, isPageCategory, pageCategoryNamespace]);

  // Handle navigation - updates hash which triggers state update via hashchange
  const handleNavigate = useCallback((pageId: string) => {
    const newHash = buildPageHash(pageId);
    if (window.location.hash !== newHash) {
      window.location.hash = newHash;
    }
  }, []);

  const handleNavigateToEntity = useCallback((entityId: string) => {
    // Check if entity ID exists in index
    if (pageIndex.byId.has(entityId)) {
      handleNavigate(entityId);
    } else if (pageIndex.byId.has(`entity-${entityId}`)) {
      handleNavigate(`entity-${entityId}`);
    }
  }, [pageIndex, handleNavigate]);

  const handleGoHome = useCallback(() => {
    window.location.hash = '#/';
  }, []);

  // Refresh index by reloading chronicles and static pages from IndexedDB
  const handleRefreshIndex = useCallback(async () => {
    if (isRefreshing) return;

    setIsRefreshing(true);
    try {
      if (hasChroniclesOverride || hasStaticPagesOverride) {
        if (hasChroniclesOverride) {
          setChronicles(normalizeChronicles(chroniclesOverride));
        }
        if (hasStaticPagesOverride) {
          setStaticPages(normalizeStaticPages(staticPagesOverride));
        }
      } else {
        const [loadedChronicles, loadedStaticPages] = await Promise.all([
          simulationRunId ? getCompletedChroniclesForSimulation(simulationRunId) : Promise.resolve([]),
          projectId ? getPublishedStaticPagesForProject(projectId) : Promise.resolve([]),
        ]);
        setChronicles(loadedChronicles);
        setStaticPages(loadedStaticPages);
      }
      // Clear page cache so pages are rebuilt with new data
      pageCacheRef.current.clear();
    } catch (err) {
      console.error('[WikiExplorer] Failed to refresh index:', err);
    } finally {
      setIsRefreshing(false);
    }
  }, [
    chroniclesOverride,
    hasChroniclesOverride,
    hasStaticPagesOverride,
    projectId,
    simulationRunId,
    staticPagesOverride,
    isRefreshing,
  ]);

  // Show data error UI
  if (dataError) {
    return (
      <div style={styles.container}>
        <div style={{ ...styles.main, padding: '48px', maxWidth: '600px', margin: '0 auto' }}>
          <div style={{
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '8px',
            padding: '24px',
          }}>
            <h2 style={{ color: '#ef4444', margin: '0 0 16px 0', fontSize: '18px' }}>
              {dataError.message}
            </h2>
            <p style={{ color: colors.textSecondary, margin: '0 0 16px 0', fontSize: '14px', lineHeight: 1.6 }}>
              {dataError.details}
            </p>
            <div style={{
              backgroundColor: colors.bgSecondary,
              borderRadius: '4px',
              padding: '12px 16px',
              fontSize: '13px',
              color: colors.textPrimary,
              lineHeight: 1.6,
            }}>
              <strong>How to fix:</strong>
              <ol style={{ margin: '8px 0 0 0', paddingLeft: '20px' }}>
                <li>In the Canonry shell, click the <strong>"Run Slots"</strong> dropdown in the top navigation bar</li>
                <li>Click the <strong>×</strong> button next to the saved simulation slot to delete it</li>
                <li>Re-run the simulation to generate fresh data</li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Navigation Sidebar */}
      <div style={styles.sidebar}>
        <div style={styles.searchContainer}>
          <WikiSearch
            pages={indexAsPages}
            query={searchQuery}
            onQueryChange={setSearchQuery}
            onSelect={handleNavigate}
          />
        </div>
        <WikiNav
          categories={pageIndex.categories}
          pages={indexAsPages}
          chronicles={chroniclePages}
          staticPages={staticPagesAsWikiPages}
          confluxPages={confluxPages}
          huddlePages={huddlePages}
          currentPageId={currentPageId}
          onNavigate={handleNavigate}
          onGoHome={handleGoHome}
          onRefreshIndex={handleRefreshIndex}
          isRefreshing={isRefreshing}
        />
      </div>

      {/* Main Content */}
      <div style={styles.main}>
        <div style={styles.content}>
          {isChronicleIndex ? (
            <ChronicleIndex
              chronicles={chroniclePages}
              filter={
                currentPageId === 'chronicles-story'
                  ? 'story'
                  : currentPageId === 'chronicles-document'
                  ? 'document'
                  : 'all'
              }
              onNavigate={handleNavigate}
              entityIndex={entityIndex}
            />
          ) : isPagesIndex ? (
            <PagesIndex
              pages={staticPagesAsWikiPages}
              onNavigate={handleNavigate}
            />
          ) : isConfluxesIndex ? (
            <ConfluxesIndex
              confluxPages={confluxPages}
              onNavigate={handleNavigate}
            />
          ) : isHuddlesIndex ? (
            <HuddlesIndex
              huddlePages={huddlePages}
              onNavigate={handleNavigate}
            />
          ) : isPageCategory && pageCategoryNamespace ? (
            <PageCategoryIndex
              namespace={pageCategoryNamespace}
              pages={staticPagesAsWikiPages}
              onNavigate={handleNavigate}
            />
          ) : currentPage ? (
            <WikiPageView
              page={currentPage}
              pages={indexAsPages}
              entityIndex={entityIndex}
              imageData={imageData}
              imageLoader={imageLoader}
              disambiguation={currentDisambiguation}
              onNavigate={handleNavigate}
              onNavigateToEntity={handleNavigateToEntity}
              prominenceScale={prominenceScale}
            />
          ) : (
            <HomePage
              worldData={worldData}
              pages={indexAsPages}
              chronicles={chroniclePages}
              staticPages={staticPagesAsWikiPages}
              categories={pageIndex.categories}
              imageData={imageData}
              imageLoader={imageLoader}
              onNavigate={handleNavigate}
              prominenceScale={prominenceScale}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// Home page component
interface HomePageProps {
  worldData: WorldState;
  pages: WikiPage[];
  chronicles: WikiPage[];
  staticPages: WikiPage[];
  categories: { id: string; name: string; pageCount: number }[];
  imageData: ImageMetadata | null;
  imageLoader?: ImageLoader;
  onNavigate: (pageId: string) => void;
  prominenceScale: ProminenceScale;
}

/**
 * Weighted random selection - higher prominence = higher weight
 */
function weightedRandomSelect<T extends { prominence?: number }>(
  items: T[],
  count: number,
  prominenceScale: ProminenceScale
): T[] {
  if (items.length <= count) return items;

  // Assign weights based on prominence
  const weights: Record<string, number> = {
    mythic: 10,
    renowned: 6,
    recognized: 3,
    marginal: 1,
    forgotten: 0.5,
  };

  const weighted = items.map(item => ({
    item,
    weight: item.prominence != null
      ? weights[prominenceLabelFromScale(item.prominence, prominenceScale)] || 1
      : 1,
  }));

  const selected: T[] = [];
  const available = [...weighted];

  for (let i = 0; i < count && available.length > 0; i++) {
    const totalWeight = available.reduce((sum, w) => sum + w.weight, 0);
    let random = Math.random() * totalWeight;

    for (let j = 0; j < available.length; j++) {
      random -= available[j].weight;
      if (random <= 0) {
        selected.push(available[j].item);
        available.splice(j, 1);
        break;
      }
    }
  }

  return selected;
}

function HomePage({
  worldData,
  chronicles,
  staticPages,
  imageLoader,
  onNavigate,
  prominenceScale
}: HomePageProps) {
  // Find System:About This Project page
  const aboutPage = useMemo(() => {
    return staticPages.find(p =>
      p.title.toLowerCase() === 'system:about this project' ||
      p.title.toLowerCase() === 'about this project'
    );
  }, [staticPages]);

  // Get eras
  const eras = useMemo(() =>
    worldData.hardState.filter(e => e.kind === 'era'),
    [worldData.hardState]
  );

  // Calculate link counts for each entity
  const linkStats = useMemo(() => {
    const incomingCounts = new Map<string, number>();
    const outgoingCounts = new Map<string, number>();

    for (const rel of worldData.relationships) {
      incomingCounts.set(rel.dst, (incomingCounts.get(rel.dst) || 0) + 1);
      outgoingCounts.set(rel.src, (outgoingCounts.get(rel.src) || 0) + 1);
    }

    const totalLinks = new Map<string, number>();
    for (const entity of worldData.hardState) {
      const incoming = incomingCounts.get(entity.id) || 0;
      const outgoing = outgoingCounts.get(entity.id) || 0;
      totalLinks.set(entity.id, incoming + outgoing);
    }

    const sortedByLinks = [...worldData.hardState]
      .filter(e => e.kind !== 'era')
      .sort((a, b) => (totalLinks.get(b.id) || 0) - (totalLinks.get(a.id) || 0));

    const mostLinked = sortedByLinks.slice(0, 5);
    const leastLinked = sortedByLinks
      .filter(e => (totalLinks.get(e.id) || 0) > 0)
      .slice(-5)
      .reverse();

    const isolated = worldData.hardState.filter(e =>
      e.kind !== 'era' && (totalLinks.get(e.id) || 0) === 0
    );

    return { totalLinks, mostLinked, leastLinked, isolated };
  }, [worldData]);

  // Featured article - single prominent entity with image and full summary
  const featuredArticle = useMemo(() => {
    // Find entities with images and summaries, prefer mythic/renowned
    const candidates = worldData.hardState.filter(e =>
      e.kind !== 'era' &&
      e.summary &&
      e.enrichment?.image?.imageId
    );
    if (candidates.length === 0) {
      // Fallback to any entity with a summary
      const withSummary = worldData.hardState.filter(e => e.kind !== 'era' && e.summary);
      if (withSummary.length === 0) return null;
      return weightedRandomSelect(withSummary, 1, prominenceScale)[0];
    }
    return weightedRandomSelect(candidates, 1, prominenceScale)[0];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load featured article image
  const [featuredImageUrl, setFeaturedImageUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!featuredArticle?.enrichment?.image?.imageId || !imageLoader) {
      setFeaturedImageUrl(null);
      return;
    }
    let cancelled = false;
    imageLoader(featuredArticle.enrichment.image.imageId).then(url => {
      if (!cancelled) setFeaturedImageUrl(url);
    });
    return () => { cancelled = true; };
  }, [featuredArticle, imageLoader]);

  // "Did you know" - 5 random relationships as interesting facts
  const didYouKnow = useMemo(() => {
    if (worldData.relationships.length === 0) return [];
    const entityMap = new Map(worldData.hardState.map(e => [e.id, e]));

    // Shuffle and pick 5 interesting relationships
    const shuffled = [...worldData.relationships]
      .sort(() => Math.random() - 0.5)
      .slice(0, 20); // Get more, then filter for good ones

    const facts: Array<{
      srcEntity: typeof worldData.hardState[0];
      dstEntity: typeof worldData.hardState[0];
      kind: string;
    }> = [];

    for (const rel of shuffled) {
      if (facts.length >= 5) break;
      const src = entityMap.get(rel.src);
      const dst = entityMap.get(rel.dst);
      // Skip era relationships and self-references
      if (!src || !dst || src.kind === 'era' || dst.kind === 'era' || src.id === dst.id) continue;
      facts.push({ srcEntity: src, dstEntity: dst, kind: rel.kind });
    }
    return facts;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Entity kind distribution
  const kindDistribution = useMemo(() => {
    const counts = new Map<string, number>();
    for (const entity of worldData.hardState) {
      if (entity.kind !== 'era') {
        counts.set(entity.kind, (counts.get(entity.kind) || 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);
  }, [worldData.hardState]);

  const sectionStyle = {
    marginBottom: '24px',
    padding: '20px',
    backgroundColor: colors.bgSecondary,
    borderRadius: '8px',
    border: `1px solid ${colors.border}`,
  };

  const sectionTitleStyle = {
    fontSize: '14px',
    fontWeight: 600,
    marginBottom: '16px',
    color: colors.accent,
    borderBottom: `1px solid ${colors.border}`,
    paddingBottom: '8px',
  };

  // Format relationship kind for display
  const formatRelKind = (kind: string) => {
    return kind.replace(/_/g, ' ');
  };

  // Truncate summary to max length
  const truncateSummary = (text: string, maxLen: number) => {
    if (text.length <= maxLen) return text;
    return text.slice(0, maxLen).replace(/\s+\S*$/, '') + '...';
  };

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      {/* Header with stats */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '24px',
        paddingBottom: '16px',
        borderBottom: `1px solid ${colors.border}`,
      }}>
        <h1 style={{
          fontSize: '28px',
          fontWeight: 600,
          color: colors.textPrimary,
          margin: 0,
        }}>
          World Chronicle
        </h1>
        <div style={{ fontSize: '13px', color: colors.textMuted }}>
          {worldData.hardState.filter(e => e.kind !== 'era').length} entities
          {' · '}
          {worldData.relationships.length} relationships
          {eras.length > 0 && <> · {eras.length} eras</>}
        </div>
      </div>

      {/* About This Project banner - if exists */}
      {aboutPage && (
        <div style={{
          marginBottom: '24px',
          padding: '16px 20px',
          backgroundColor: 'rgba(16, 185, 129, 0.08)',
          borderRadius: '8px',
          borderLeft: `4px solid ${colors.accent}`,
        }}>
          <div style={{
            fontSize: '14px',
            color: colors.textSecondary,
            lineHeight: 1.6,
            marginBottom: '12px',
          }}>
            {aboutPage.content.summary || 'Learn about this world and its lore.'}
          </div>
          <button
            onClick={() => onNavigate(aboutPage.id)}
            style={{
              padding: '6px 12px',
              backgroundColor: 'transparent',
              border: `1px solid ${colors.accent}`,
              borderRadius: '4px',
              color: colors.accent,
              cursor: 'pointer',
              fontSize: '12px',
            }}
          >
            Read more →
          </button>
        </div>
      )}

      {/* Two-column layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px' }}>
        {/* Left column */}
        <div>
          {/* Featured Article - Wikipedia style */}
          {featuredArticle && (
            <div style={sectionStyle}>
              <h2 style={sectionTitleStyle}>Featured Article</h2>
              <div style={{ display: 'flex', gap: '16px' }}>
                {featuredImageUrl && (
                  <div style={{
                    width: '140px',
                    height: '140px',
                    flexShrink: 0,
                    borderRadius: '6px',
                    overflow: 'hidden',
                    backgroundColor: colors.bgTertiary,
                  }}>
                    <img
                      src={featuredImageUrl}
                      alt={featuredArticle.name}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                      }}
                    />
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <button
                    onClick={() => onNavigate(featuredArticle.id)}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <h3 style={{
                      fontSize: '18px',
                      fontWeight: 600,
                      color: colors.textPrimary,
                      marginBottom: '4px',
                    }}>
                      {featuredArticle.name}
                    </h3>
                  </button>
                  <div style={{
                    fontSize: '11px',
                    color: colors.textMuted,
                    marginBottom: '8px',
                    textTransform: 'capitalize',
                  }}>
                    {featuredArticle.kind}
                    {featuredArticle.subtype && featuredArticle.subtype !== featuredArticle.kind && (
                      <> · {featuredArticle.subtype}</>
                    )}
                    {featuredArticle.culture && <> · {featuredArticle.culture}</>}
                  </div>
                  <p style={{
                    fontSize: '13px',
                    color: colors.textSecondary,
                    lineHeight: 1.6,
                    margin: 0,
                  }}>
                    {truncateSummary(featuredArticle.summary || '', 280)}
                    {' '}
                    <button
                      onClick={() => onNavigate(featuredArticle.id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        color: colors.accent,
                        cursor: 'pointer',
                        fontSize: '13px',
                      }}
                    >
                      (Full article...)
                    </button>
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Did You Know - Wikipedia style */}
          {didYouKnow.length > 0 && (
            <div style={sectionStyle}>
              <h2 style={sectionTitleStyle}>Did you know...</h2>
              <ul style={{
                margin: 0,
                paddingLeft: '20px',
                listStyle: 'disc',
              }}>
                {didYouKnow.map((fact, idx) => (
                  <li key={idx} style={{
                    fontSize: '13px',
                    color: colors.textSecondary,
                    lineHeight: 1.7,
                    marginBottom: '8px',
                  }}>
                    ...that{' '}
                    <button
                      onClick={() => onNavigate(fact.srcEntity.id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        color: colors.accent,
                        cursor: 'pointer',
                        fontSize: '13px',
                        fontWeight: 500,
                      }}
                    >
                      {fact.srcEntity.name}
                    </button>
                    {' '}has a <em>{formatRelKind(fact.kind)}</em> relationship with{' '}
                    <button
                      onClick={() => onNavigate(fact.dstEntity.id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        color: colors.accent,
                        cursor: 'pointer',
                        fontSize: '13px',
                        fontWeight: 500,
                      }}
                    >
                      {fact.dstEntity.name}
                    </button>
                    ?
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Eras */}
          {eras.length > 0 && (
            <div style={sectionStyle}>
              <h2 style={sectionTitleStyle}>Eras of History</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {eras.map((era, idx) => (
                  <button
                    key={era.id}
                    onClick={() => onNavigate(era.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      textAlign: 'left',
                      padding: '8px 12px',
                      backgroundColor: colors.bgTertiary,
                      border: 'none',
                      borderRadius: '4px',
                      color: colors.textPrimary,
                      cursor: 'pointer',
                    }}
                  >
                    <span style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      backgroundColor: colors.accent,
                      color: colors.bgPrimary,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '11px',
                      fontWeight: 600,
                      flexShrink: 0,
                    }}>
                      {idx + 1}
                    </span>
                    <span style={{ fontSize: '13px', fontWeight: 500 }}>{era.name}</span>
                    {era.summary && (
                      <span style={{ fontSize: '11px', color: colors.textMuted, marginLeft: 'auto' }}>
                        {truncateSummary(era.summary, 40)}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right column */}
        <div>
          {/* Most Connected - with more context */}
          <div style={sectionStyle}>
            <h2 style={sectionTitleStyle}>Most Connected</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {linkStats.mostLinked.map(entity => {
                const linkCount = linkStats.totalLinks.get(entity.id) || 0;
                return (
                  <button
                    key={entity.id}
                    onClick={() => onNavigate(entity.id)}
                    style={{
                      display: 'block',
                      textAlign: 'left',
                      padding: '10px 12px',
                      backgroundColor: colors.bgTertiary,
                      border: 'none',
                      borderRadius: '4px',
                      color: colors.textPrimary,
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ fontWeight: 500, fontSize: '13px' }}>{entity.name}</span>
                      <span style={{
                        fontSize: '11px',
                        color: colors.textMuted,
                        backgroundColor: colors.bgSecondary,
                        padding: '2px 6px',
                        borderRadius: '8px',
                      }}>
                        {linkCount} links
                      </span>
                    </div>
                    <div style={{ fontSize: '11px', color: colors.textMuted, textTransform: 'capitalize' }}>
                      {entity.kind}
                      {entity.culture && <> · {entity.culture}</>}
                    </div>
                    {entity.summary && (
                      <div style={{ fontSize: '12px', color: colors.textSecondary, marginTop: '6px', lineHeight: 1.5 }}>
                        {truncateSummary(entity.summary, 80)}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Hidden Gems - with more context */}
          <div style={sectionStyle}>
            <h2 style={sectionTitleStyle}>Hidden Gems</h2>
            <p style={{ fontSize: '12px', color: colors.textMuted, marginBottom: '12px', marginTop: 0 }}>
              Lesser-known entities worth exploring
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {linkStats.leastLinked.map(entity => {
                const linkCount = linkStats.totalLinks.get(entity.id) || 0;
                return (
                  <button
                    key={entity.id}
                    onClick={() => onNavigate(entity.id)}
                    style={{
                      display: 'block',
                      textAlign: 'left',
                      padding: '10px 12px',
                      backgroundColor: colors.bgTertiary,
                      border: 'none',
                      borderRadius: '4px',
                      color: colors.textPrimary,
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ fontWeight: 500, fontSize: '13px' }}>{entity.name}</span>
                      <span style={{
                        fontSize: '11px',
                        color: colors.textMuted,
                        backgroundColor: colors.bgSecondary,
                        padding: '2px 6px',
                        borderRadius: '8px',
                      }}>
                        {linkCount} links
                      </span>
                    </div>
                    <div style={{ fontSize: '11px', color: colors.textMuted, textTransform: 'capitalize' }}>
                      {entity.kind}
                      {entity.culture && <> · {entity.culture}</>}
                    </div>
                    {entity.summary && (
                      <div style={{ fontSize: '12px', color: colors.textSecondary, marginTop: '6px', lineHeight: 1.5 }}>
                        {truncateSummary(entity.summary, 80)}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
            {linkStats.isolated.length > 0 && (
              <div style={{ marginTop: '12px', fontSize: '11px', color: colors.textMuted }}>
                + {linkStats.isolated.length} isolated entities with no connections
              </div>
            )}
          </div>

          {/* Browse by Type */}
          <div style={sectionStyle}>
            <h2 style={sectionTitleStyle}>Browse by Type</h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {kindDistribution.map(([kind, count]) => (
                <button
                  key={kind}
                  onClick={() => onNavigate(`category-kind-${kind}`)}
                  style={{
                    padding: '6px 10px',
                    backgroundColor: colors.bgTertiary,
                    border: 'none',
                    borderRadius: '4px',
                    color: colors.textSecondary,
                    cursor: 'pointer',
                    fontSize: '12px',
                    textTransform: 'capitalize',
                  }}
                >
                  {kind} <span style={{ color: colors.textMuted }}>({count})</span>
                </button>
              ))}
            </div>
          </div>

          {/* Chronicles */}
          {chronicles.length > 0 && (
            <div style={sectionStyle}>
              <h2 style={sectionTitleStyle}>Chronicles</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {chronicles.slice(0, 4).map(chronicle => (
                  <button
                    key={chronicle.id}
                    onClick={() => onNavigate(chronicle.id)}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      textAlign: 'left',
                      padding: '8px 10px',
                      backgroundColor: colors.bgTertiary,
                      border: 'none',
                      borderRadius: '4px',
                      color: colors.textPrimary,
                      cursor: 'pointer',
                      fontSize: '13px',
                    }}
                  >
                    <span>{chronicle.title}</span>
                    <span style={{ fontSize: '10px', color: colors.textMuted }}>
                      {chronicle.chronicle?.format === 'story' ? 'Story' : 'Document'}
                    </span>
                  </button>
                ))}
              </div>
              {chronicles.length > 4 && (
                <button
                  onClick={() => onNavigate('chronicles')}
                  style={{
                    marginTop: '10px',
                    padding: '6px 10px',
                    backgroundColor: 'transparent',
                    border: `1px solid ${colors.border}`,
                    borderRadius: '4px',
                    color: colors.textMuted,
                    cursor: 'pointer',
                    fontSize: '11px',
                    width: '100%',
                  }}
                >
                  View all {chronicles.length} chronicles →
                </button>
              )}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}

// Pages Index component
interface PagesIndexProps {
  pages: WikiPage[];
  onNavigate: (pageId: string) => void;
}

function PagesIndex({ pages, onNavigate }: PagesIndexProps) {
  // Group pages by namespace
  const pagesByNamespace = useMemo(() => {
    const grouped = new Map<string, WikiPage[]>();
    for (const page of pages) {
      const colonIndex = page.title.indexOf(':');
      const namespace = colonIndex > 0 ? page.title.slice(0, colonIndex) : 'General';
      if (!grouped.has(namespace)) {
        grouped.set(namespace, []);
      }
      grouped.get(namespace)!.push(page);
    }
    // Sort namespaces, keeping General at end
    return Array.from(grouped.entries()).sort((a, b) => {
      if (a[0] === 'General') return 1;
      if (b[0] === 'General') return -1;
      return a[0].localeCompare(b[0]);
    });
  }, [pages]);

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <h1 style={{
        fontSize: '28px',
        fontWeight: 600,
        marginBottom: '8px',
        color: colors.textPrimary,
      }}>
        Pages
      </h1>
      <p style={{
        fontSize: '14px',
        color: colors.textSecondary,
        marginBottom: '24px',
        lineHeight: 1.6,
      }}>
        User-authored pages providing additional world context, cultural overviews, and lore articles.
      </p>

      {pages.length === 0 ? (
        <div style={{
          padding: '48px 24px',
          textAlign: 'center',
          backgroundColor: colors.bgSecondary,
          borderRadius: '8px',
          border: `1px solid ${colors.border}`,
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>📝</div>
          <div style={{ fontSize: '16px', color: colors.textSecondary, marginBottom: '8px' }}>
            No pages yet
          </div>
          <div style={{ fontSize: '13px', color: colors.textMuted }}>
            Create and publish pages in Illuminator to see them here.
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {pagesByNamespace.map(([namespace, pagesInNs]) => (
            <div key={namespace}>
              <h2 style={{
                fontSize: '16px',
                fontWeight: 600,
                color: colors.accent,
                marginBottom: '12px',
                paddingBottom: '8px',
                borderBottom: `1px solid ${colors.border}`,
              }}>
                {namespace}
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {pagesInNs.map(page => (
                  <button
                    key={page.id}
                    onClick={() => onNavigate(page.id)}
                    style={{
                      display: 'block',
                      textAlign: 'left',
                      padding: '12px 16px',
                      backgroundColor: colors.bgSecondary,
                      border: `1px solid ${colors.border}`,
                      borderRadius: '6px',
                      color: colors.textPrimary,
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: 500,
                    }}
                  >
                    {page.title}
                    {page.content.summary && (
                      <div style={{
                        fontSize: '12px',
                        color: colors.textMuted,
                        marginTop: '4px',
                        fontWeight: 400,
                      }}>
                        {page.content.summary}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Page Category Index - shows pages filtered by namespace
interface PageCategoryIndexProps {
  namespace: string;
  pages: WikiPage[];
  onNavigate: (pageId: string) => void;
}

function PageCategoryIndex({ namespace, pages, onNavigate }: PageCategoryIndexProps) {
  // Filter pages to this namespace
  const filteredPages = useMemo(() => {
    return pages.filter(page => {
      const colonIndex = page.title.indexOf(':');
      const pageNamespace = colonIndex > 0 ? page.title.slice(0, colonIndex) : 'General';
      return pageNamespace === namespace;
    });
  }, [pages, namespace]);

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <h1 style={{
        fontSize: '28px',
        fontWeight: 600,
        marginBottom: '8px',
        color: colors.textPrimary,
      }}>
        {namespace} Pages
      </h1>
      <p style={{
        fontSize: '14px',
        color: colors.textSecondary,
        marginBottom: '24px',
        lineHeight: 1.6,
      }}>
        {namespace === 'General'
          ? 'Pages without a namespace prefix.'
          : `Pages in the ${namespace} namespace.`}
      </p>

      {filteredPages.length === 0 ? (
        <div style={{
          padding: '48px 24px',
          textAlign: 'center',
          backgroundColor: colors.bgSecondary,
          borderRadius: '8px',
          border: `1px solid ${colors.border}`,
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>📝</div>
          <div style={{ fontSize: '16px', color: colors.textSecondary, marginBottom: '8px' }}>
            No pages in this category
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {filteredPages.map(page => (
            <button
              key={page.id}
              onClick={() => onNavigate(page.id)}
              style={{
                display: 'block',
                textAlign: 'left',
                padding: '16px 20px',
                backgroundColor: colors.bgSecondary,
                border: `1px solid ${colors.border}`,
                borderRadius: '6px',
                color: colors.textPrimary,
                cursor: 'pointer',
                fontSize: '15px',
                fontWeight: 500,
              }}
            >
              {page.title}
              {page.content.summary && (
                <div style={{
                  fontSize: '13px',
                  color: colors.textMuted,
                  marginTop: '4px',
                  fontWeight: 400,
                }}>
                  {page.content.summary}
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
