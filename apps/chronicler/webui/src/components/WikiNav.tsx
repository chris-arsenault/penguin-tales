/**
 * WikiNav - Sidebar navigation for the wiki
 *
 * Features:
 * - Browse by category
 * - Search, Home, Random at bottom
 */

import type { WikiPage, WikiCategory, PageIndexEntry } from '../types/world.ts';
import WikiSearch from './WikiSearch.tsx';

const colors = {
  bgSecondary: '#1e3a5f',
  bgSidebar: '#0c1f2e',
  border: 'rgba(59, 130, 246, 0.3)',
  textPrimary: '#ffffff',
  textSecondary: '#93c5fd',
  textMuted: '#60a5fa',
  accent: '#10b981',
  hoverBg: 'rgba(16, 185, 129, 0.15)',
};

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    height: '100%',
  },
  nav: {
    flex: 1,
    overflow: 'auto',
    padding: '8px',
  },
  section: {
    marginBottom: '16px',
  },
  sectionTitle: {
    fontSize: '11px',
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
    color: colors.textMuted,
    padding: '8px 12px',
  },
  navItem: {
    display: 'block',
    width: '100%',
    padding: '8px 12px',
    fontSize: '13px',
    color: colors.textSecondary,
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: '4px',
    textAlign: 'left' as const,
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  navItemActive: {
    backgroundColor: colors.accent,
    color: '#0a1929',
    fontWeight: 500,
  },
  badge: {
    fontSize: '11px',
    color: colors.textMuted,
    marginLeft: '8px',
  },
  bottomSection: {
    borderTop: `1px solid ${colors.border}`,
    padding: '12px',
    backgroundColor: colors.bgSidebar,
  },
  bottomLinks: {
    display: 'flex',
    gap: '8px',
    marginTop: '12px',
  },
  bottomLink: {
    flex: 1,
    padding: '8px',
    fontSize: '12px',
    color: colors.textSecondary,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    border: `1px solid ${colors.border}`,
    borderRadius: '6px',
    textAlign: 'center' as const,
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
};

interface WikiNavProps {
  categories: WikiCategory[];
  pages: WikiPage[];
  chronicles: WikiPage[];
  staticPages: WikiPage[];
  confluxPages: PageIndexEntry[];
  huddlePages: PageIndexEntry[];
  currentPageId: string | null;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  onNavigate: (pageId: string) => void;
  onGoHome: () => void;
  onRefreshIndex?: () => void;
  isRefreshing?: boolean;
}

export default function WikiNav({
  categories,
  pages,
  chronicles,
  staticPages,
  confluxPages,
  huddlePages,
  currentPageId,
  searchQuery,
  onSearchQueryChange,
  onNavigate,
  onGoHome,
  onRefreshIndex,
  isRefreshing,
}: WikiNavProps) {
  // Get top categories for quick access
  const topCategories = categories
    .filter(c => c.id.startsWith('kind-'))
    .slice(0, 10);

  // Random page function
  const handleRandomPage = () => {
    const entityPages = pages.filter(p => p.type === 'entity' || p.type === 'era');
    if (entityPages.length > 0) {
      const randomIndex = Math.floor(Math.random() * entityPages.length);
      onNavigate(entityPages[randomIndex].id);
    }
  };

  const chroniclePages = chronicles.filter((page) => page.chronicle);
  const storyChronicles = chroniclePages.filter((page) => page.chronicle?.format === 'story');
  const documentChronicles = chroniclePages.filter((page) => page.chronicle?.format === 'document');

  return (
    <div style={styles.container}>
      <nav style={styles.nav}>

      {/* Browse by Type */}
      {topCategories.length > 0 && (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Browse by Type</div>
          {topCategories.map(category => (
            <button
              key={category.id}
              style={{
                ...styles.navItem,
                ...(currentPageId === `category-${category.id}` ? styles.navItemActive : {}),
              }}
              onClick={() => onNavigate(`category-${category.id}`)}
              onMouseEnter={(e) => {
                if (currentPageId !== `category-${category.id}`) {
                  e.currentTarget.style.backgroundColor = colors.hoverBg;
                  e.currentTarget.style.color = colors.accent;
                }
              }}
              onMouseLeave={(e) => {
                if (currentPageId !== `category-${category.id}`) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = colors.textSecondary;
                }
              }}
            >
              {category.name.replace('Kind: ', '')}
              <span style={styles.badge}>({category.pageCount})</span>
            </button>
          ))}
        </div>
      )}

      {chroniclePages.length > 0 && (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Chronicles</div>
          <button
            style={{
              ...styles.navItem,
              ...(currentPageId === 'chronicles' ? styles.navItemActive : {}),
            }}
            onClick={() => onNavigate('chronicles')}
            onMouseEnter={(e) => {
              if (currentPageId !== 'chronicles') {
                e.currentTarget.style.backgroundColor = colors.hoverBg;
                e.currentTarget.style.color = colors.accent;
              }
            }}
            onMouseLeave={(e) => {
              if (currentPageId !== 'chronicles') {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = colors.textSecondary;
              }
            }}
          >
            All Chronicles
            <span style={styles.badge}>({chroniclePages.length})</span>
          </button>
          {storyChronicles.length > 0 && (
            <button
              style={{
                ...styles.navItem,
                ...(currentPageId === 'chronicles-story' ? styles.navItemActive : {}),
              }}
              onClick={() => onNavigate('chronicles-story')}
              onMouseEnter={(e) => {
                if (currentPageId !== 'chronicles-story') {
                  e.currentTarget.style.backgroundColor = colors.hoverBg;
                  e.currentTarget.style.color = colors.accent;
                }
              }}
              onMouseLeave={(e) => {
                if (currentPageId !== 'chronicles-story') {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = colors.textSecondary;
                }
              }}
            >
              Stories
              <span style={styles.badge}>({storyChronicles.length})</span>
            </button>
          )}
          {documentChronicles.length > 0 && (
            <button
              style={{
                ...styles.navItem,
                ...(currentPageId === 'chronicles-document' ? styles.navItemActive : {}),
              }}
              onClick={() => onNavigate('chronicles-document')}
              onMouseEnter={(e) => {
                if (currentPageId !== 'chronicles-document') {
                  e.currentTarget.style.backgroundColor = colors.hoverBg;
                  e.currentTarget.style.color = colors.accent;
                }
              }}
              onMouseLeave={(e) => {
                if (currentPageId !== 'chronicles-document') {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = colors.textSecondary;
                }
              }}
            >
              Documents
              <span style={styles.badge}>({documentChronicles.length})</span>
            </button>
          )}
        </div>
      )}

      {/* Confluxes */}
      {confluxPages.length > 0 && (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Confluxes</div>
          <button
            style={{
              ...styles.navItem,
              ...(currentPageId === 'confluxes' ? styles.navItemActive : {}),
            }}
            onClick={() => onNavigate('confluxes')}
            onMouseEnter={(e) => {
              if (currentPageId !== 'confluxes') {
                e.currentTarget.style.backgroundColor = colors.hoverBg;
                e.currentTarget.style.color = colors.accent;
              }
            }}
            onMouseLeave={(e) => {
              if (currentPageId !== 'confluxes') {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = colors.textSecondary;
              }
            }}
          >
            All Confluxes
            <span style={styles.badge}>({confluxPages.length})</span>
          </button>
          {/* Show 5 rarest confluxes */}
          {confluxPages
            .sort((a, b) => (a.conflux?.manifestations ?? 0) - (b.conflux?.manifestations ?? 0))
            .slice(0, 5)
            .map(page => (
              <button
                key={page.id}
                style={{
                  ...styles.navItem,
                  ...(currentPageId === page.id ? styles.navItemActive : {}),
                }}
                onClick={() => onNavigate(page.id)}
                onMouseEnter={(e) => {
                  if (currentPageId !== page.id) {
                    e.currentTarget.style.backgroundColor = colors.hoverBg;
                    e.currentTarget.style.color = colors.accent;
                  }
                }}
                onMouseLeave={(e) => {
                  if (currentPageId !== page.id) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = colors.textSecondary;
                  }
                }}
              >
                {page.title}
                <span style={styles.badge}>({page.conflux?.manifestations ?? 0})</span>
              </button>
            ))}
        </div>
      )}

      {/* Huddles */}
      {huddlePages.length > 0 && (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Huddles</div>
          <button
            style={{
              ...styles.navItem,
              ...(currentPageId === 'huddles' ? styles.navItemActive : {}),
            }}
            onClick={() => onNavigate('huddles')}
            onMouseEnter={(e) => {
              if (currentPageId !== 'huddles') {
                e.currentTarget.style.backgroundColor = colors.hoverBg;
                e.currentTarget.style.color = colors.accent;
              }
            }}
            onMouseLeave={(e) => {
              if (currentPageId !== 'huddles') {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = colors.textSecondary;
              }
            }}
          >
            All Huddles
            <span style={styles.badge}>({huddlePages.length})</span>
          </button>
          {/* Show 5 largest huddle types */}
          {huddlePages
            .sort((a, b) => (b.huddleType?.largestSize ?? 0) - (a.huddleType?.largestSize ?? 0))
            .slice(0, 5)
            .map(page => (
              <button
                key={page.id}
                style={{
                  ...styles.navItem,
                  ...(currentPageId === page.id ? styles.navItemActive : {}),
                }}
                onClick={() => onNavigate(page.id)}
                onMouseEnter={(e) => {
                  if (currentPageId !== page.id) {
                    e.currentTarget.style.backgroundColor = colors.hoverBg;
                    e.currentTarget.style.color = colors.accent;
                  }
                }}
                onMouseLeave={(e) => {
                  if (currentPageId !== page.id) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = colors.textSecondary;
                  }
                }}
              >
                {page.title}
                <span style={styles.badge}>({page.huddleType?.largestSize ?? 0})</span>
              </button>
            ))}
        </div>
      )}

      {/* Static Pages - show by namespace category */}
      {staticPages.length > 0 && (() => {
        // Group pages by namespace prefix (e.g., "System:", "Cultures:", "Names:")
        const pagesByNamespace = new Map<string, WikiPage[]>();
        for (const page of staticPages) {
          const colonIndex = page.title.indexOf(':');
          const namespace = colonIndex > 0 ? page.title.slice(0, colonIndex) : 'General';
          if (!pagesByNamespace.has(namespace)) {
            pagesByNamespace.set(namespace, []);
          }
          pagesByNamespace.get(namespace)!.push(page);
        }

        // Sort namespaces alphabetically, but keep "General" at the end
        const sortedNamespaces = Array.from(pagesByNamespace.keys()).sort((a, b) => {
          if (a === 'General') return 1;
          if (b === 'General') return -1;
          return a.localeCompare(b);
        });

        return (
          <div style={styles.section}>
            <div style={styles.sectionTitle}>Pages</div>
            <button
              style={{
                ...styles.navItem,
                ...(currentPageId === 'pages' ? styles.navItemActive : {}),
              }}
              onClick={() => onNavigate('pages')}
              onMouseEnter={(e) => {
                if (currentPageId !== 'pages') {
                  e.currentTarget.style.backgroundColor = colors.hoverBg;
                  e.currentTarget.style.color = colors.accent;
                }
              }}
              onMouseLeave={(e) => {
                if (currentPageId !== 'pages') {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = colors.textSecondary;
                }
              }}
            >
              All Pages
              <span style={styles.badge}>({staticPages.length})</span>
            </button>
            {sortedNamespaces.map(namespace => (
              <button
                key={namespace}
                style={{
                  ...styles.navItem,
                  ...(currentPageId === `page-category-${namespace}` ? styles.navItemActive : {}),
                }}
                onClick={() => onNavigate(`page-category-${namespace}`)}
                onMouseEnter={(e) => {
                  if (currentPageId !== `page-category-${namespace}`) {
                    e.currentTarget.style.backgroundColor = colors.hoverBg;
                    e.currentTarget.style.color = colors.accent;
                  }
                }}
                onMouseLeave={(e) => {
                  if (currentPageId !== `page-category-${namespace}`) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = colors.textSecondary;
                  }
                }}
              >
                {namespace}
                <span style={styles.badge}>({pagesByNamespace.get(namespace)!.length})</span>
              </button>
            ))}
          </div>
        );
      })()}

      {/* All Categories */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>All Categories</div>
        <button
          style={styles.navItem}
          onClick={() => onNavigate('all-categories')}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = colors.hoverBg;
            e.currentTarget.style.color = colors.accent;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.color = colors.textSecondary;
          }}
        >
          View All Categories
          <span style={styles.badge}>({categories.length})</span>
        </button>
      </div>

      {/* Refresh Index */}
      {onRefreshIndex && (
        <div style={styles.section}>
          <button
            style={{
              ...styles.navItem,
              opacity: isRefreshing ? 0.6 : 1,
              cursor: isRefreshing ? 'wait' : 'pointer',
            }}
            onClick={onRefreshIndex}
            disabled={isRefreshing}
            onMouseEnter={(e) => {
              if (!isRefreshing) {
                e.currentTarget.style.backgroundColor = colors.hoverBg;
                e.currentTarget.style.color = colors.accent;
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = colors.textSecondary;
            }}
          >
            {isRefreshing ? 'Refreshing...' : 'Refresh Index'}
          </button>
        </div>
      )}
      </nav>

      {/* Bottom Section - Search and Links */}
      <div style={styles.bottomSection}>
        <WikiSearch
          pages={pages}
          query={searchQuery}
          onQueryChange={onSearchQueryChange}
          onSelect={onNavigate}
          expandDirection="up"
        />
        <div style={styles.bottomLinks}>
          <button
            style={{
              ...styles.bottomLink,
              ...(currentPageId === null ? { backgroundColor: colors.accent, color: '#0a1929', borderColor: colors.accent } : {}),
            }}
            onClick={onGoHome}
            onMouseEnter={(e) => {
              if (currentPageId !== null) {
                e.currentTarget.style.backgroundColor = colors.hoverBg;
                e.currentTarget.style.borderColor = colors.accent;
              }
            }}
            onMouseLeave={(e) => {
              if (currentPageId !== null) {
                e.currentTarget.style.backgroundColor = 'rgba(16, 185, 129, 0.1)';
                e.currentTarget.style.borderColor = colors.border;
              }
            }}
          >
            Home
          </button>
          <button
            style={styles.bottomLink}
            onClick={handleRandomPage}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = colors.hoverBg;
              e.currentTarget.style.borderColor = colors.accent;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(16, 185, 129, 0.1)';
              e.currentTarget.style.borderColor = colors.border;
            }}
          >
            Random
          </button>
        </div>
      </div>
    </div>
  );
}
