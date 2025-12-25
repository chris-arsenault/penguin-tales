/**
 * WikiNav - Sidebar navigation for the wiki
 *
 * Features:
 * - Home link
 * - Browse by category
 * - Random page
 */

import type { WikiPage, WikiCategory } from '../types/world.ts';

const colors = {
  bgSecondary: '#1e3a5f',
  border: 'rgba(59, 130, 246, 0.3)',
  textPrimary: '#ffffff',
  textSecondary: '#93c5fd',
  textMuted: '#60a5fa',
  accent: '#10b981',
  hoverBg: 'rgba(16, 185, 129, 0.15)',
};

const styles = {
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
};

interface WikiNavProps {
  categories: WikiCategory[];
  pages: WikiPage[];
  currentPageId: string | null;
  onNavigate: (pageId: string) => void;
  onGoHome: () => void;
}

export default function WikiNav({
  categories,
  pages,
  currentPageId,
  onNavigate,
  onGoHome,
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

  return (
    <nav style={styles.nav}>
      {/* Main Navigation */}
      <div style={styles.section}>
        <button
          style={{
            ...styles.navItem,
            ...(currentPageId === null ? styles.navItemActive : {}),
          }}
          onClick={onGoHome}
          onMouseEnter={(e) => {
            if (currentPageId !== null) {
              e.currentTarget.style.backgroundColor = colors.hoverBg;
              e.currentTarget.style.color = colors.accent;
            }
          }}
          onMouseLeave={(e) => {
            if (currentPageId !== null) {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = colors.textSecondary;
            }
          }}
        >
          Home
        </button>
        <button
          style={styles.navItem}
          onClick={handleRandomPage}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = colors.hoverBg;
            e.currentTarget.style.color = colors.accent;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.color = colors.textSecondary;
          }}
        >
          Random Page
        </button>
      </div>

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
    </nav>
  );
}
