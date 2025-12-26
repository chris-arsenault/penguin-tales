/**
 * WikiExplorer - Main layout for the Chronicler wiki
 *
 * MediaWiki-inspired layout with:
 * - Search bar at top
 * - Navigation sidebar (left)
 * - Content area (center)
 * - Page actions/info (right, optional)
 */

import { useState, useMemo } from 'react';
import type { WorldState, LoreData, ImageMetadata, WikiPage, HardState } from '../types/world.ts';
import { buildWikiPages, buildCategories } from '../lib/wikiBuilder.ts';
import WikiNav from './WikiNav.tsx';
import ChronicleIndex from './ChronicleIndex.tsx';
import WikiPageView from './WikiPage.tsx';
import WikiSearch from './WikiSearch.tsx';

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
}

export default function WikiExplorer({ worldData, loreData, imageData }: WikiExplorerProps) {
  const [currentPageId, setCurrentPageId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Build wiki pages from world data
  const { pages, categories, entityIndex } = useMemo(() => {
    const pages = buildWikiPages(worldData, loreData, imageData);
    const categories = buildCategories(worldData, pages);
    const entityIndex = new Map<string, HardState>();
    for (const entity of worldData.hardState) {
      entityIndex.set(entity.id, entity);
    }
    return { pages, categories, entityIndex };
  }, [worldData, loreData, imageData]);

  const chroniclePages = useMemo(
    () => pages.filter((page) => page.type === 'chronicle' && page.chronicle),
    [pages]
  );

  // Get current page
  const isChronicleIndex = currentPageId === 'chronicles'
    || currentPageId === 'chronicles-story'
    || currentPageId === 'chronicles-document';

  const currentPage = !isChronicleIndex && currentPageId
    ? pages.find(p => p.id === currentPageId)
    : null;

  // Handle navigation
  const handleNavigate = (pageId: string) => {
    setCurrentPageId(pageId);
    setSearchQuery('');
  };

  const handleNavigateToEntity = (entityId: string) => {
    // Find the page for this entity
    const page = pages.find(p => p.id === entityId || p.id === `entity-${entityId}`);
    if (page) {
      handleNavigate(page.id);
    }
  };

  const handleGoHome = () => {
    setCurrentPageId(null);
  };

  return (
    <div style={styles.container}>
      {/* Navigation Sidebar */}
      <div style={styles.sidebar}>
        <div style={styles.searchContainer}>
          <WikiSearch
            pages={pages}
            query={searchQuery}
            onQueryChange={setSearchQuery}
            onSelect={handleNavigate}
          />
        </div>
        <WikiNav
          categories={categories}
          pages={pages}
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
              pages={pages}
              entityIndex={entityIndex}
              imageData={imageData}
              onNavigate={handleNavigate}
              onNavigateToEntity={handleNavigateToEntity}
            />
          ) : (
            <HomePage
              worldData={worldData}
              pages={pages}
              categories={categories}
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
                  {era.description && (
                    <span style={{ color: colors.textMuted, marginLeft: '12px' }}>
                      {era.description.slice(0, 100)}...
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
