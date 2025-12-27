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
import type { WorldState, LoreData, ImageMetadata, WikiPage, WikiPageIndex, PageIndexEntry, HardState, ImageLoader } from '../types/world.ts';
import { buildPageIndex, buildPageById } from '../lib/wikiBuilder.ts';
import { getCompletedChroniclesForSimulation, type ChronicleRecord } from '../lib/chronicleStorage.ts';
import WikiNav from './WikiNav.tsx';
import ChronicleIndex from './ChronicleIndex.tsx';
import WikiPageView from './WikiPage.tsx';
import WikiSearch from './WikiSearch.tsx';

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
  worldData: WorldState;
  loreData: LoreData | null;
  imageData: ImageMetadata | null;
  /** Lazy image loader - loads images on-demand from IndexedDB */
  imageLoader?: ImageLoader;
}

export default function WikiExplorer({ worldData, loreData, imageData, imageLoader }: WikiExplorerProps) {
  // Initialize from hash on mount
  const [currentPageId, setCurrentPageId] = useState<string | null>(() => parseHashPageId());
  const [searchQuery, setSearchQuery] = useState('');

  // Chronicles loaded from IndexedDB
  const [chronicles, setChronicles] = useState<ChronicleRecord[]>([]);
  const simulationRunId = (worldData as { metadata?: { simulationRunId?: string } }).metadata?.simulationRunId;

  // Load chronicles from IndexedDB when simulationRunId changes
  useEffect(() => {
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
  }, [simulationRunId]);

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

  // Build lightweight page index (fast)
  const { pageIndex, entityIndex } = useMemo(() => {
    const pageIndex = buildPageIndex(worldData, loreData, chronicles);
    const entityIndex = new Map<string, HardState>();
    for (const entity of worldData.hardState) {
      entityIndex.set(entity.id, entity);
    }
    return { pageIndex, entityIndex };
  }, [worldData, loreData, chronicles]);

  // Page cache - stores fully built pages by ID
  const pageCacheRef = useRef<Map<string, WikiPage>>(new Map());

  // Clear cache when data changes
  useEffect(() => {
    pageCacheRef.current.clear();
  }, [worldData, loreData, imageData, chronicles]);

  // Get a page from cache or build it on-demand
  const getPage = useCallback((pageId: string): WikiPage | null => {
    const cache = pageCacheRef.current;
    if (cache.has(pageId)) {
      return cache.get(pageId)!;
    }

    const page = buildPageById(pageId, worldData, loreData, imageData, pageIndex, chronicles);
    if (page) {
      cache.set(pageId, page);
    }
    return page;
  }, [worldData, loreData, imageData, pageIndex, chronicles]);

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

  // Get current page
  const isChronicleIndex = currentPageId === 'chronicles'
    || currentPageId === 'chronicles-story'
    || currentPageId === 'chronicles-document';

  // Build current page on-demand
  const currentPage = !isChronicleIndex && currentPageId
    ? getPage(currentPageId)
    : null;

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
          currentPageId={currentPageId}
          onNavigate={handleNavigate}
          onGoHome={handleGoHome}
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
          ) : currentPage ? (
            <WikiPageView
              page={currentPage}
              pages={indexAsPages}
              entityIndex={entityIndex}
              imageData={imageData}
              imageLoader={imageLoader}
              onNavigate={handleNavigate}
              onNavigateToEntity={handleNavigateToEntity}
            />
          ) : (
            <HomePage
              worldData={worldData}
              pages={indexAsPages}
              categories={pageIndex.categories}
              onNavigate={handleNavigate}
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
  categories: { id: string; name: string; pageCount: number }[];
  onNavigate: (pageId: string) => void;
}

function HomePage({ worldData, pages, categories, onNavigate }: HomePageProps) {
  // Get notable entities (mythic/renowned)
  const notableEntities = worldData.hardState
    .filter(e => e.prominence === 'mythic' || e.prominence === 'renowned')
    .slice(0, 10);

  // Get eras
  const eras = worldData.hardState.filter(e => e.kind === 'era');

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <h1 style={{
        fontSize: '32px',
        fontWeight: 600,
        marginBottom: '8px',
        color: colors.textPrimary,
      }}>
        World Chronicle
      </h1>
      <p style={{
        fontSize: '16px',
        color: colors.textSecondary,
        marginBottom: '32px',
        lineHeight: 1.6,
      }}>
        Explore the history, legends, and lore of this world. Browse by era, entity type,
        or search for specific topics.
      </p>

      {/* Stats */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '16px',
        marginBottom: '32px',
      }}>
        <StatCard label="Entities" value={worldData.hardState.length} />
        <StatCard label="Relationships" value={worldData.relationships.length} />
        <StatCard label="Eras" value={eras.length} />
        <StatCard label="Wiki Pages" value={pages.length} />
      </div>

      {/* Eras section */}
      {eras.length > 0 && (
        <section style={{ marginBottom: '32px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '16px', color: colors.accent }}>
            Eras
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {eras.map(era => {
              const page = pages.find(p => p.id === era.id);
              const summary = page?.content.summary;
              return (
                <button
                  key={era.id}
                  onClick={() => page && onNavigate(page.id)}
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
                  }}
                >
                  <span style={{ fontWeight: 500 }}>{era.name}</span>
                  {summary && (
                    <span style={{ color: colors.textMuted, marginLeft: '12px' }}>
                      {summary.slice(0, 100)}...
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Notable Entities */}
      {notableEntities.length > 0 && (
        <section style={{ marginBottom: '32px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '16px', color: colors.accent }}>
            Notable Figures & Places
          </h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {notableEntities.map(entity => {
              const page = pages.find(p => p.id === entity.id);
              return (
                <button
                  key={entity.id}
                  onClick={() => page && onNavigate(page.id)}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: colors.bgSecondary,
                    border: `1px solid ${colors.border}`,
                    borderRadius: '16px',
                    color: colors.textPrimary,
                    cursor: 'pointer',
                    fontSize: '13px',
                  }}
                >
                  {entity.name}
                  <span style={{
                    marginLeft: '8px',
                    color: colors.textMuted,
                    fontSize: '11px',
                  }}>
                    {entity.kind}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Categories */}
      {categories.length > 0 && (
        <section>
          <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '16px', color: colors.accent }}>
            Browse by Category
          </h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {categories.slice(0, 20).map(cat => (
              <button
                key={cat.id}
                onClick={() => onNavigate(`category-${cat.id}`)}
                style={{
                  padding: '6px 12px',
                  backgroundColor: 'transparent',
                  border: `1px solid ${colors.border}`,
                  borderRadius: '4px',
                  color: colors.textSecondary,
                  cursor: 'pointer',
                  fontSize: '12px',
                }}
              >
                {cat.name} ({cat.pageCount})
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div style={{
      padding: '16px',
      backgroundColor: colors.bgSecondary,
      borderRadius: '8px',
      border: `1px solid ${colors.border}`,
      textAlign: 'center',
    }}>
      <div style={{ fontSize: '24px', fontWeight: 600, color: colors.accent }}>
        {value.toLocaleString()}
      </div>
      <div style={{ fontSize: '12px', color: colors.textMuted, marginTop: '4px' }}>
        {label}
      </div>
    </div>
  );
}
