/**
 * WikiPage - Renders a single wiki page
 *
 * Features:
 * - Infobox sidebar (Wikipedia-style)
 * - Table of contents for long content
 * - Cross-linking via [[Entity Name]] syntax
 * - Backlinks section
 */

import React, { useMemo, useState, useEffect } from 'react';
import type { WikiPage, WikiSection, WikiSectionImage, HardState, ImageMetadata, ImageLoader } from '../types/world.ts';

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
  summary: {
    fontSize: '14px',
    lineHeight: 1.6,
    color: colors.textSecondary,
    marginTop: '8px',
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
  chronicles: {
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
  chroniclesTitle: {
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
  chronicleItem: {
    fontSize: '13px',
    color: colors.accent,
    cursor: 'pointer',
    padding: '4px 0',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    border: 'none',
    backgroundColor: 'transparent',
    textAlign: 'left' as const,
  },
  chronicleMeta: {
    fontSize: '11px',
    color: colors.textMuted,
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
  // Chronicle inline image styles - Wikipedia-style thumb frames
  sectionWithImages: {
    position: 'relative' as const,
  },
  // Wikipedia-style thumb: floated box with frame, border, caption
  imageThumbRight: {
    float: 'right' as const,
    clear: 'right' as const,
    margin: '4px 0 12px 16px',
    border: `1px solid ${colors.border}`,
    borderRadius: '4px',
    backgroundColor: colors.bgSecondary,
    padding: '4px',
  },
  imageThumbLeft: {
    float: 'left' as const,
    clear: 'left' as const,
    margin: '4px 16px 12px 0',
    border: `1px solid ${colors.border}`,
    borderRadius: '4px',
    backgroundColor: colors.bgSecondary,
    padding: '4px',
  },
  imageSmall: {
    width: '150px',
  },
  imageMedium: {
    width: '220px',
  },
  imageLarge: {
    width: '350px',
    margin: '16px auto',
    display: 'block',
    border: `1px solid ${colors.border}`,
    borderRadius: '4px',
    backgroundColor: colors.bgSecondary,
    padding: '4px',
  },
  imageFullWidth: {
    width: '100%',
    margin: '24px 0',
    border: `1px solid ${colors.border}`,
    borderRadius: '4px',
    backgroundColor: colors.bgSecondary,
    padding: '4px',
  },
  figureImage: {
    width: '100%',
    display: 'block',
    borderRadius: '2px',
  },
  imageCaption: {
    fontSize: '11px',
    lineHeight: 1.4,
    color: colors.textMuted,
    padding: '6px 4px 2px',
    textAlign: 'center' as const,
  },
  imagePlaceholder: {
    width: '100%',
    height: '100px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: colors.textMuted,
    fontSize: '11px',
    backgroundColor: colors.bgTertiary,
    borderRadius: '2px',
  },
  clearfix: {
    clear: 'both' as const,
  },
};

/**
 * Check if image size is a float (small/medium) vs block (large/full-width)
 */
function isFloatImage(size: WikiSectionImage['size']): boolean {
  return size === 'small' || size === 'medium';
}

/**
 * Get the combined style for an image based on size
 * Float images (small/medium): thumb frame + size width
 * Block images (large/full-width): centered block style
 */
function getImageStyle(size: WikiSectionImage['size'], position: 'left' | 'right' = 'right'): React.CSSProperties {
  const isFloat = isFloatImage(size);

  if (isFloat) {
    const thumbStyle = position === 'left' ? styles.imageThumbLeft : styles.imageThumbRight;
    const sizeStyle = size === 'small' ? styles.imageSmall : styles.imageMedium;
    return { ...thumbStyle, ...sizeStyle };
  }

  // Block images
  return size === 'full-width' ? styles.imageFullWidth : styles.imageLarge;
}

/**
 * ChronicleImage - Renders an inline chronicle image
 * Uses imageLoader for on-demand loading, falls back to imageData if available
 */
function ChronicleImage({
  image,
  imageData,
  imageLoader,
}: {
  image: WikiSectionImage;
  imageData: ImageMetadata | null;
  imageLoader?: ImageLoader;
}) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadImage() {
      // Prefer imageLoader (lazy loading from IndexedDB)
      if (imageLoader) {
        try {
          const url = await imageLoader(image.imageId);
          if (!cancelled) {
            setImageUrl(url);
            setLoading(false);
          }
        } catch (err) {
          if (!cancelled) {
            console.error('Failed to load image:', image.imageId, err);
            setLoading(false);
          }
        }
        return;
      }

      // Fallback to pre-loaded imageData
      if (imageData?.results) {
        const imageResult = imageData.results.find(r => r.imageId === image.imageId);
        if (imageResult?.localPath) {
          const path = imageResult.localPath;
          const webPath = path.startsWith('blob:') || path.startsWith('data:')
            ? path
            : path.replace('output/images/', 'images/');
          setImageUrl(webPath);
        }
      }
      setLoading(false);
    }

    loadImage();

    return () => {
      cancelled = true;
    };
  }, [image.imageId, imageData, imageLoader]);

  const imageStyle = getImageStyle(image.size);

  if (loading) {
    return (
      <figure style={imageStyle}>
        <div style={styles.imagePlaceholder}>Loading...</div>
      </figure>
    );
  }

  if (error || !imageUrl) {
    return null; // Don't render if image not found
  }

  return (
    <figure style={imageStyle}>
      <img
        src={imageUrl}
        alt={image.caption || 'Chronicle illustration'}
        style={styles.figureImage}
        onError={() => setError(true)}
      />
      {image.caption && (
        <figcaption style={styles.imageCaption}>{image.caption}</figcaption>
      )}
    </figure>
  );
}

/**
 * SectionWithImages - Renders a section with Wikipedia-style image layout
 *
 * For text to properly wrap around floated images, we need:
 * 1. Float images FIRST in the DOM, before the text they float with
 * 2. Text in a single continuous block (not fragmented into separate divs)
 * 3. Block images inserted at paragraph boundaries
 *
 * Wikipedia approach: float images at section start, text flows around them
 */
function SectionWithImages({
  section,
  imageData,
  imageLoader,
  renderContent,
}: {
  section: WikiSection;
  imageData: ImageMetadata | null;
  imageLoader?: ImageLoader;
  renderContent: (text: string) => React.ReactNode;
}) {
  const images = section.images || [];
  if (images.length === 0) {
    return (
      <div style={styles.paragraph}>
        {renderContent(section.content)}
      </div>
    );
  }

  const content = section.content;

  // Separate float images (small/medium) from block images (large/full-width)
  const floatImages: WikiSectionImage[] = [];
  const blockImages: Array<{ image: WikiSectionImage; position: number }> = [];

  for (const img of images) {
    if (isFloatImage(img.size)) {
      floatImages.push(img);
    } else {
      // Find anchor position for block images to insert at paragraph boundaries
      const anchorLower = img.anchorText.toLowerCase();
      const contentLower = content.toLowerCase();
      const position = contentLower.indexOf(anchorLower);
      blockImages.push({ image: img, position: position >= 0 ? position : content.length });
    }
  }

  // Sort block images by position
  blockImages.sort((a, b) => a.position - b.position);

  // If we have block images, we need to split content at paragraph boundaries
  // Otherwise, render all text as one block with float images at the start
  if (blockImages.length === 0) {
    // Simple case: only float images - put them first, then all text
    return (
      <div style={styles.sectionWithImages}>
        {floatImages.map((img, i) => (
          <ChronicleImage key={`float-${img.refId}-${i}`} image={img} imageData={imageData} imageLoader={imageLoader} />
        ))}
        <div style={styles.paragraph}>
          {renderContent(content)}
        </div>
        <div style={styles.clearfix} />
      </div>
    );
  }

  // Complex case: mix of float and block images
  // Split content at paragraph boundaries where block images should be inserted
  const fragments: Array<{ type: 'text'; content: string } | { type: 'block-image'; image: WikiSectionImage }> = [];
  let lastIndex = 0;

  for (const { image, position } of blockImages) {
    // Find paragraph boundary after the anchor
    const anchorEnd = position + image.anchorText.length;
    const paragraphEnd = content.indexOf('\n\n', anchorEnd);
    const insertPoint = paragraphEnd >= 0 ? paragraphEnd : content.length;

    if (insertPoint > lastIndex) {
      fragments.push({ type: 'text', content: content.slice(lastIndex, insertPoint) });
    }
    fragments.push({ type: 'block-image', image });
    lastIndex = paragraphEnd >= 0 ? paragraphEnd + 2 : content.length;
  }

  // Add remaining content
  if (lastIndex < content.length) {
    fragments.push({ type: 'text', content: content.slice(lastIndex) });
  }

  // Render: float images first (they'll float right), then fragments
  // The first text fragment will flow around the floats
  let floatsRendered = false;

  return (
    <div style={styles.sectionWithImages}>
      {fragments.map((fragment, i) => {
        if (fragment.type === 'block-image') {
          return (
            <React.Fragment key={`block-${fragment.image.refId}-${i}`}>
              <div style={styles.clearfix} />
              <ChronicleImage image={fragment.image} imageData={imageData} imageLoader={imageLoader} />
            </React.Fragment>
          );
        } else {
          // For the first text fragment, prepend float images
          if (!floatsRendered && floatImages.length > 0) {
            floatsRendered = true;
            return (
              <React.Fragment key={`text-${i}`}>
                {floatImages.map((img, j) => (
                  <ChronicleImage key={`float-${img.refId}-${j}`} image={img} imageData={imageData} imageLoader={imageLoader} />
                ))}
                <div style={styles.paragraph}>
                  {renderContent(fragment.content)}
                </div>
              </React.Fragment>
            );
          }
          return (
            <div key={`text-${i}`} style={styles.paragraph}>
              {renderContent(fragment.content)}
            </div>
          );
        }
      })}
      {/* Final clearfix to contain floats */}
      <div style={styles.clearfix} />
    </div>
  );
}

interface WikiPageViewProps {
  page: WikiPage;
  pages: WikiPage[];
  entityIndex: Map<string, HardState>;
  imageData: ImageMetadata | null;
  imageLoader?: ImageLoader;
  onNavigate: (pageId: string) => void;
  onNavigateToEntity: (entityId: string) => void;
}

export default function WikiPageView({
  page,
  pages,
  entityIndex,
  imageData,
  imageLoader,
  onNavigate,
  onNavigateToEntity,
}: WikiPageViewProps) {
  // Compute backlinks
  const chronicleLinks = useMemo(() => {
    return pages.filter(p =>
      p.type === 'chronicle' &&
      p.chronicle &&
      p.id !== page.id &&
      p.linkedEntities.includes(page.id)
    );
  }, [pages, page.id]);

  const backlinks = useMemo(() => {
    return pages.filter(p =>
      p.id !== page.id &&
      p.type !== 'chronicle' &&
      p.linkedEntities.includes(page.id)
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

  const aliasMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const candidate of pages) {
      if (candidate.type !== 'entity' || !candidate.aliases?.length) continue;
      for (const alias of candidate.aliases) {
        const normalized = alias.toLowerCase().trim();
        if (!normalized || entityNameMap.has(normalized)) continue;
        if (!map.has(normalized)) {
          map.set(normalized, candidate.id);
        }
      }
    }
    return map;
  }, [pages, entityNameMap]);

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
      const normalized = name.toLowerCase().trim();
      const entityId = entityNameMap.get(normalized) || aliasMap.get(normalized);

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
          <span>
            {page.type === 'category'
              ? 'Categories'
              : page.type === 'chronicle'
              ? 'Chronicles'
              : page.type}
          </span>
          {' / '}
          <span style={{ color: colors.textSecondary }}>{page.title}</span>
        </div>
        <h1 style={styles.title}>{page.title}</h1>
        {page.content.summary && (
          <div style={styles.summary}>{page.content.summary}</div>
        )}
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

          {/* Sections */}
          {page.content.sections.map(section => (
            <div key={section.id} id={section.id} style={styles.section}>
              <h2 style={styles.sectionHeading}>{section.heading}</h2>
              {section.images && section.images.length > 0 ? (
                <SectionWithImages
                  section={section}
                  imageData={imageData}
                  imageLoader={imageLoader}
                  renderContent={renderContent}
                />
              ) : (
                <div style={styles.paragraph}>
                  {renderContent(section.content)}
                </div>
              )}
            </div>
          ))}

          {/* Chronicles */}
          {chronicleLinks.length > 0 && (
            <div style={styles.chronicles}>
              <div style={styles.chroniclesTitle}>
                Chronicles ({chronicleLinks.length})
              </div>
              {chronicleLinks.slice(0, 20).map(link => (
                <button
                  key={link.id}
                  style={styles.chronicleItem}
                  onClick={() => onNavigate(link.id)}
                >
                  <span>{link.title}</span>
                  {link.chronicle?.format && (
                    <span style={styles.chronicleMeta}>
                      {link.chronicle.format === 'document' ? 'Document' : 'Story'}
                    </span>
                  )}
                </button>
              ))}
              {chronicleLinks.length > 20 && (
                <div style={{ fontSize: '12px', color: colors.textMuted, marginTop: '8px' }}>
                  ...and {chronicleLinks.length - 20} more
                </div>
              )}
            </div>
          )}

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
