/**
 * WikiPage - Renders a single wiki page
 *
 * Features:
 * - Infobox sidebar (Wikipedia-style)
 * - Table of contents for long content
 * - Cross-linking via [[Entity Name]] syntax
 * - Backlinks section
 */

import { useMemo } from 'react';
import type { WikiPage, HardState, ImageMetadata } from '../types/world.ts';

const colors = {
  bgPrimary: '#0a1929',
  bgSecondary: '#1e3a5f',
  bgTertiary: '#2d4a6f',
  border: 'rgba(59, 130, 246, 0.3)',
  textPrimary: '#ffffff',
  textSecondary: '#93c5fd',
  textMuted: '#60a5fa',
  accent: '#10b981',
  accentLight: '#34d399',
};

const styles = {
  container: {
    maxWidth: '900px',
    margin: '0 auto',
  },
  header: {
    marginBottom: '24px',
  },
  title: {
    fontSize: '28px',
    fontWeight: 600,
    color: colors.textPrimary,
    marginBottom: '8px',
  },
  breadcrumbs: {
    fontSize: '12px',
    color: colors.textMuted,
    marginBottom: '16px',
  },
  breadcrumbLink: {
    color: colors.accent,
    cursor: 'pointer',
    textDecoration: 'none',
  },
  content: {
    display: 'flex',
    gap: '24px',
  },
  main: {
    flex: 1,
    minWidth: 0,
  },
  infobox: {
    width: '260px',
    flexShrink: 0,
    backgroundColor: colors.bgSecondary,
    border: `1px solid ${colors.border}`,
    borderRadius: '8px',
    overflow: 'hidden',
    alignSelf: 'flex-start',
    position: 'sticky' as const,
    top: '24px',
  },
  infoboxHeader: {
    padding: '12px 16px',
    backgroundColor: colors.accent,
    color: colors.bgPrimary,
    fontWeight: 600,
    fontSize: '14px',
    textAlign: 'center' as const,
  },
  infoboxImage: {
    width: '100%',
    height: '180px',
    objectFit: 'cover' as const,
    display: 'block',
  },
  infoboxBody: {
    padding: '12px',
  },
  infoboxRow: {
    display: 'flex',
    padding: '6px 0',
    borderBottom: `1px solid ${colors.border}`,
    fontSize: '12px',
  },
  infoboxLabel: {
    width: '80px',
    color: colors.textMuted,
    flexShrink: 0,
  },
  infoboxValue: {
    color: colors.textSecondary,
    flex: 1,
  },
  toc: {
    backgroundColor: colors.bgSecondary,
    border: `1px solid ${colors.border}`,
    borderRadius: '6px',
    padding: '16px',
    marginBottom: '24px',
  },
  tocTitle: {
    fontSize: '14px',
    fontWeight: 600,
    color: colors.textPrimary,
    marginBottom: '12px',
  },
  tocItem: {
    fontSize: '13px',
    color: colors.accent,
    cursor: 'pointer',
    padding: '4px 0',
    display: 'block',
    textDecoration: 'none',
    border: 'none',
    backgroundColor: 'transparent',
    textAlign: 'left' as const,
    width: '100%',
  },
  section: {
    marginBottom: '24px',
  },
  sectionHeading: {
    fontSize: '18px',
    fontWeight: 600,
    color: colors.textPrimary,
    marginBottom: '12px',
    paddingBottom: '8px',
    borderBottom: `1px solid ${colors.border}`,
  },
  paragraph: {
    fontSize: '14px',
    lineHeight: 1.7,
    color: colors.textSecondary,
    marginBottom: '12px',
    whiteSpace: 'pre-wrap' as const,
  },
  entityLink: {
    color: colors.accent,
    cursor: 'pointer',
    borderBottom: `1px dotted ${colors.accent}`,
    textDecoration: 'none',
  },
  backlinks: {
    marginTop: '32px',
    padding: '16px',
    backgroundColor: colors.bgSecondary,
    borderRadius: '6px',
    border: `1px solid ${colors.border}`,
  },
  backlinksTitle: {
    fontSize: '14px',
    fontWeight: 600,
    color: colors.textMuted,
    marginBottom: '12px',
  },
  backlinkItem: {
    fontSize: '13px',
    color: colors.accent,
    cursor: 'pointer',
    padding: '4px 0',
    display: 'block',
    border: 'none',
    backgroundColor: 'transparent',
    textAlign: 'left' as const,
  },
  categories: {
    marginTop: '24px',
    paddingTop: '16px',
    borderTop: `1px solid ${colors.border}`,
  },
  categoriesLabel: {
    fontSize: '12px',
    color: colors.textMuted,
    marginBottom: '8px',
  },
  categoryTag: {
    display: 'inline-block',
    padding: '4px 8px',
    margin: '0 4px 4px 0',
    fontSize: '11px',
    backgroundColor: colors.bgTertiary,
    borderRadius: '4px',
    color: colors.textSecondary,
    cursor: 'pointer',
    border: 'none',
  },
};

interface WikiPageViewProps {
  page: WikiPage;
  pages: WikiPage[];
  entityIndex: Map<string, HardState>;
  imageData: ImageMetadata | null;
  onNavigate: (pageId: string) => void;
  onNavigateToEntity: (entityId: string) => void;
}

export default function WikiPageView({
  page,
  pages,
  entityIndex,
  imageData: _imageData,
  onNavigate,
  onNavigateToEntity,
}: WikiPageViewProps) {
  // Note: _imageData is passed for future use in inline content images
  void _imageData;
  // Compute backlinks
  const backlinks = useMemo(() => {
    return pages.filter(p =>
      p.id !== page.id && p.linkedEntities.includes(page.id)
    );
  }, [pages, page.id]);

  // Build entity name to ID map for link resolution
  const entityNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const [id, entity] of entityIndex) {
      map.set(entity.name.toLowerCase(), id);
    }
    return map;
  }, [entityIndex]);

  // Parse content and resolve [[Entity Name]] links
  const parseContent = (text: string) => {
    const parts: (string | { type: 'link'; name: string; entityId: string })[] = [];
    let lastIndex = 0;
    const regex = /\[\[([^\]]+)\]\]/g;
    let match;

    while ((match = regex.exec(text)) !== null) {
      // Add text before the match
      if (match.index > lastIndex) {
        parts.push(text.slice(lastIndex, match.index));
      }

      const name = match[1];
      const entityId = entityNameMap.get(name.toLowerCase());

      if (entityId) {
        parts.push({ type: 'link', name, entityId });
      } else {
        parts.push(`[[${name}]]`); // Keep as-is if entity not found
      }

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < text.length) {
      parts.push(text.slice(lastIndex));
    }

    return parts;
  };

  // Render content with links
  const renderContent = (text: string) => {
    const parts = parseContent(text);
    return parts.map((part, i) => {
      if (typeof part === 'string') {
        return <span key={i}>{part}</span>;
      }
      return (
        <span
          key={i}
          style={styles.entityLink}
          onClick={() => onNavigateToEntity(part.entityId)}
        >
          {part.name}
        </span>
      );
    });
  };

  // Get image for infobox
  const infoboxImage = page.content.infobox?.image?.path || page.images[0]?.path;

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.breadcrumbs}>
          <span
            style={styles.breadcrumbLink}
            onClick={() => onNavigate('')}
          >
            Home
          </span>
          {' / '}
          <span>{page.type === 'category' ? 'Categories' : page.type}</span>
          {' / '}
          <span style={{ color: colors.textSecondary }}>{page.title}</span>
        </div>
        <h1 style={styles.title}>{page.title}</h1>
      </div>

      <div style={styles.content}>
        {/* Main Content */}
        <div style={styles.main}>
          {/* Table of Contents (if > 2 sections) */}
          {page.content.sections.length > 2 && (
            <div style={styles.toc}>
              <div style={styles.tocTitle}>Contents</div>
              {page.content.sections.map((section, i) => (
                <button
                  key={section.id}
                  style={{
                    ...styles.tocItem,
                    paddingLeft: `${(section.level - 1) * 16}px`,
                  }}
                  onClick={() => {
                    const el = document.getElementById(section.id);
                    el?.scrollIntoView({ behavior: 'smooth' });
                  }}
                >
                  {i + 1}. {section.heading}
                </button>
              ))}
            </div>
          )}

          {/* Summary */}
          <p style={styles.paragraph}>
            {renderContent(page.content.summary)}
          </p>

          {/* Sections */}
          {page.content.sections.map(section => (
            <div key={section.id} id={section.id} style={styles.section}>
              <h2 style={styles.sectionHeading}>{section.heading}</h2>
              <div style={styles.paragraph}>
                {renderContent(section.content)}
              </div>
            </div>
          ))}

          {/* Backlinks */}
          {backlinks.length > 0 && (
            <div style={styles.backlinks}>
              <div style={styles.backlinksTitle}>
                What links here ({backlinks.length})
              </div>
              {backlinks.slice(0, 20).map(link => (
                <button
                  key={link.id}
                  style={styles.backlinkItem}
                  onClick={() => onNavigate(link.id)}
                >
                  {link.title}
                </button>
              ))}
              {backlinks.length > 20 && (
                <div style={{ fontSize: '12px', color: colors.textMuted, marginTop: '8px' }}>
                  ...and {backlinks.length - 20} more
                </div>
              )}
            </div>
          )}

          {/* Categories */}
          {page.categories.length > 0 && (
            <div style={styles.categories}>
              <div style={styles.categoriesLabel}>Categories:</div>
              {page.categories.map(catId => (
                <button
                  key={catId}
                  style={styles.categoryTag}
                  onClick={() => onNavigate(`category-${catId}`)}
                >
                  {formatCategoryName(catId)}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Infobox */}
        {page.content.infobox && (
          <div style={styles.infobox}>
            <div style={styles.infoboxHeader}>{page.title}</div>
            {infoboxImage && (
              <img
                src={infoboxImage}
                alt={page.title}
                style={styles.infoboxImage}
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            )}
            <div style={styles.infoboxBody}>
              {page.content.infobox.fields.map((field, i) => (
                <div key={i} style={styles.infoboxRow}>
                  <div style={styles.infoboxLabel}>{field.label}</div>
                  <div style={styles.infoboxValue}>
                    {field.linkedEntity ? (
                      <span
                        style={styles.entityLink}
                        onClick={() => onNavigateToEntity(field.linkedEntity!)}
                      >
                        {Array.isArray(field.value) ? field.value.join(', ') : field.value}
                      </span>
                    ) : (
                      Array.isArray(field.value) ? field.value.join(', ') : field.value
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function formatCategoryName(catId: string): string {
  const parts = catId.split('-');
  if (parts.length >= 2) {
    const value = parts.slice(1).join('-');
    return value.replace(/_/g, ' ');
  }
  return catId.replace(/_/g, ' ');
}
