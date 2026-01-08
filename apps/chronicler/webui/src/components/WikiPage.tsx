/**
 * WikiPage - Renders a single wiki page
 *
 * Features:
 * - Infobox sidebar (Wikipedia-style)
 * - Table of contents for long content
 * - Cross-linking via [[Entity Name]] syntax
 * - Backlinks section
 */

import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import MDEditor from '@uiw/react-md-editor';
import type { WikiPage, WikiSection, WikiSectionImage, HardState, ImageMetadata, ImageLoader, DisambiguationEntry } from '../types/world.ts';
import { SeedModal, type ChronicleSeedData } from './ChronicleSeedViewer.tsx';
import { applyWikiLinks } from '../lib/wikiBuilder.ts';
import EntityTimeline from './EntityTimeline.tsx';
import ProminenceTimeline from './ProminenceTimeline.tsx';
import ImageLightbox from './ImageLightbox.tsx';
import { prominenceLabelFromScale, type ProminenceScale } from '@canonry/world-schema';

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
  // Disambiguation notice (Wikipedia-style hatnote)
  disambiguationNotice: {
    marginBottom: '16px',
    padding: '10px 14px',
    fontSize: '13px',
    fontStyle: 'italic' as const,
    color: colors.textMuted,
    backgroundColor: 'rgba(59, 130, 246, 0.08)',
    borderRadius: '4px',
    borderLeft: `3px solid ${colors.accent}`,
    lineHeight: 1.5,
  },
  disambiguationLink: {
    color: colors.accent,
    cursor: 'pointer',
    marginLeft: '4px',
    fontStyle: 'normal' as const,
    fontWeight: 500,
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
    cursor: 'zoom-in',
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
  seedButton: {
    padding: '6px 12px',
    fontSize: '12px',
    background: colors.bgTertiary,
    border: `1px solid ${colors.border}`,
    borderRadius: '4px',
    color: colors.textSecondary,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    marginTop: '12px',
  },
  // Entity preview card styles
  previewCard: {
    position: 'fixed' as const,
    zIndex: 1000,
    width: '260px',
    backgroundColor: colors.bgSecondary,
    border: `1px solid ${colors.border}`,
    borderRadius: '8px',
    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.4)',
    overflow: 'hidden',
    pointerEvents: 'none' as const,
  },
  previewHeader: {
    display: 'flex',
    gap: '10px',
    padding: '10px 12px',
    backgroundColor: colors.accent,
    color: colors.bgPrimary,
  },
  previewThumbnail: {
    width: '48px',
    height: '48px',
    borderRadius: '4px',
    objectFit: 'cover' as const,
    flexShrink: 0,
  },
  previewThumbnailPlaceholder: {
    width: '48px',
    height: '48px',
    borderRadius: '4px',
    backgroundColor: 'rgba(0,0,0,0.2)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '18px',
    flexShrink: 0,
  },
  previewTitle: {
    fontWeight: 600,
    fontSize: '14px',
    lineHeight: 1.3,
    flex: 1,
    display: 'flex',
    alignItems: 'center',
  },
  previewBody: {
    padding: '10px 12px',
  },
  previewBadges: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '4px',
    marginBottom: '8px',
  },
  previewBadge: {
    display: 'inline-block',
    padding: '2px 6px',
    fontSize: '10px',
    borderRadius: '3px',
    backgroundColor: colors.bgTertiary,
    color: colors.textSecondary,
  },
  previewBadgeKind: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    color: colors.accentLight,
  },
  previewBadgeStatus: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    color: colors.textMuted,
  },
  previewSummary: {
    fontSize: '12px',
    lineHeight: 1.5,
    color: colors.textSecondary,
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
  onOpen,
}: {
  image: WikiSectionImage;
  imageData: ImageMetadata | null;
  imageLoader?: ImageLoader;
  onOpen?: (imageUrl: string, image: WikiSectionImage) => void;
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
        onClick={() => onOpen?.(imageUrl, image)}
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
  entityNameMap,
  aliasMap,
  linkableNames,
  onNavigate,
  onHoverEnter,
  onHoverLeave,
  onImageOpen,
}: {
  section: WikiSection;
  imageData: ImageMetadata | null;
  imageLoader?: ImageLoader;
  entityNameMap: Map<string, string>;
  aliasMap: Map<string, string>;
  linkableNames: Array<{ name: string; id: string }>;
  onNavigate: (pageId: string) => void;
  onHoverEnter?: (pageId: string, e: React.MouseEvent) => void;
  onHoverLeave?: () => void;
  onImageOpen?: (imageUrl: string, image: WikiSectionImage) => void;
}) {
  const images = section.images || [];
  if (images.length === 0) {
    return (
      <MarkdownSection
        content={section.content}
        entityNameMap={entityNameMap}
        aliasMap={aliasMap}
        linkableNames={linkableNames}
        onNavigate={onNavigate}
        onHoverEnter={onHoverEnter}
        onHoverLeave={onHoverLeave}
      />
    );
  }

  const content = section.content;
  const contentLower = content.toLowerCase();

  // Find anchor position for ALL images and sort by position
  const positionedImages: Array<{ image: WikiSectionImage; position: number }> = [];

  for (const img of images) {
    const anchorLower = img.anchorText?.toLowerCase() || '';
    let position = anchorLower ? contentLower.indexOf(anchorLower) : -1;
    // Use anchorIndex as fallback if text not found
    if (position < 0 && img.anchorIndex !== undefined && img.anchorIndex < content.length) {
      position = img.anchorIndex;
    }
    // If still not found, use end of content
    if (position < 0) {
      position = content.length;
    }
    positionedImages.push({ image: img, position });
  }

  // Sort by position
  positionedImages.sort((a, b) => a.position - b.position);

  // Build fragments: split content at paragraph boundaries after each image's anchor
  const fragments: Array<
    | { type: 'text'; content: string }
    | { type: 'image'; image: WikiSectionImage }
  > = [];
  let lastIndex = 0;

  for (const { image, position } of positionedImages) {
    // Find paragraph boundary after the anchor
    const anchorEnd = position + (image.anchorText?.length || 0);
    const paragraphEnd = content.indexOf('\n\n', anchorEnd);
    const insertPoint = paragraphEnd >= 0 ? paragraphEnd : content.length;

    // Add text before this image
    if (insertPoint > lastIndex) {
      fragments.push({ type: 'text', content: content.slice(lastIndex, insertPoint) });
    }
    fragments.push({ type: 'image', image });
    lastIndex = paragraphEnd >= 0 ? paragraphEnd + 2 : insertPoint;
  }

  // Add remaining content
  if (lastIndex < content.length) {
    fragments.push({ type: 'text', content: content.slice(lastIndex) });
  }

  return (
    <div style={styles.sectionWithImages}>
      {fragments.map((fragment, i) => {
        if (fragment.type === 'image') {
          const isFloat = isFloatImage(fragment.image.size);
          if (isFloat) {
            // Float images don't need clearfix, they float naturally
            return (
              <ChronicleImage
                key={`img-${fragment.image.refId}-${i}`}
                image={fragment.image}
                imageData={imageData}
                imageLoader={imageLoader}
                onOpen={onImageOpen}
              />
            );
          } else {
            // Block images need clearfix before them
            return (
              <React.Fragment key={`img-${fragment.image.refId}-${i}`}>
                <div style={styles.clearfix} />
                <ChronicleImage
                  image={fragment.image}
                  imageData={imageData}
                  imageLoader={imageLoader}
                  onOpen={onImageOpen}
                />
              </React.Fragment>
            );
          }
        } else {
          return (
            <MarkdownSection
              key={`text-${i}`}
              content={fragment.content}
              entityNameMap={entityNameMap}
              aliasMap={aliasMap}
              linkableNames={linkableNames}
              onNavigate={onNavigate}
              onHoverEnter={onHoverEnter}
              onHoverLeave={onHoverLeave}
            />
          );
        }
      })}
      {/* Final clearfix to contain floats */}
      <div style={styles.clearfix} />
    </div>
  );
}

/**
 * EntityPreviewCard - Hover preview for entity links
 * Shows thumbnail, badges for metadata, and short summary
 */
interface EntityPreviewCardProps {
  entity: HardState;
  summary?: string;
  position: { x: number; y: number };
  imageUrl?: string | null;
  prominenceScale: ProminenceScale;
}

function EntityPreviewCard({
  entity,
  summary,
  position,
  imageUrl,
  prominenceScale,
}: EntityPreviewCardProps) {
  // Position the card to the right of cursor, adjusting if it would go off-screen
  const cardWidth = 260;
  const cardHeight = 180;

  let left = position.x + 16;
  let top = position.y - 20;

  // Check if card would go off right edge
  if (left + cardWidth > window.innerWidth - 20) {
    left = position.x - cardWidth - 16;
  }

  // Check if card would go off bottom edge
  if (top + cardHeight > window.innerHeight - 20) {
    top = window.innerHeight - cardHeight - 20;
  }

  // Keep within top boundary
  if (top < 20) {
    top = 20;
  }

  // Get first letter for placeholder
  const initial = entity.name.charAt(0).toUpperCase();

  return (
    <div style={{ ...styles.previewCard, left, top }}>
      <div style={styles.previewHeader}>
        {imageUrl ? (
          <img src={imageUrl} alt="" style={styles.previewThumbnail} />
        ) : (
          <div style={styles.previewThumbnailPlaceholder}>{initial}</div>
        )}
        <div style={styles.previewTitle}>{entity.name}</div>
      </div>
      <div style={styles.previewBody}>
        <div style={styles.previewBadges}>
          <span style={{ ...styles.previewBadge, ...styles.previewBadgeKind }}>
            {entity.kind}
          </span>
          {entity.subtype && (
            <span style={styles.previewBadge}>{entity.subtype}</span>
          )}
          <span style={{ ...styles.previewBadge, ...styles.previewBadgeStatus }}>
            {entity.status}
          </span>
          <span style={styles.previewBadge}>
            {prominenceLabelFromScale(entity.prominence, prominenceScale)}
          </span>
          {entity.culture && (
            <span style={styles.previewBadge}>{entity.culture}</span>
          )}
        </div>
        {summary && (
          <div style={styles.previewSummary}>
            {summary.length > 250 ? `${summary.slice(0, 250)}...` : summary}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * MarkdownSection - Renders content with markdown support and entity linking
 * Unified renderer for all page types (entity, chronicle, static, era)
 * Supports: markdown tables, wiki links, click navigation, hover previews
 */
function MarkdownSection({
  content,
  entityNameMap,
  aliasMap,
  linkableNames,
  onNavigate,
  onHoverEnter,
  onHoverLeave,
}: {
  content: string;
  entityNameMap: Map<string, string>;
  aliasMap: Map<string, string>;
  linkableNames: Array<{ name: string; id: string }>;
  onNavigate: (pageId: string) => void;
  onHoverEnter?: (pageId: string, e: React.MouseEvent) => void;
  onHoverLeave?: () => void;
}) {
  // Pre-process content:
  // 1. Apply wiki links to wrap entity names with [[...]]
  // 2. Convert [[Entity Name]] to markdown links with proper URLs
  const processedContent = useMemo(() => {
    // First apply wiki links to detect entity names
    const linkedContent = applyWikiLinks(content, linkableNames);
    // Then convert [[Entity Name]] to markdown-friendly link format with proper URLs
    return linkedContent.replace(/\[\[([^\]]+)\]\]/g, (match, name) => {
      const normalized = name.toLowerCase().trim();
      const pageId = entityNameMap.get(normalized) || aliasMap.get(normalized);
      if (pageId) {
        // Use #/page/{pageId} format that matches the router
        return `[${name}](#/page/${encodeURIComponent(pageId)})`;
      }
      // Keep as-is if page not found
      return match;
    });
  }, [content, entityNameMap, aliasMap, linkableNames]);

  // Handle clicks on page links within the markdown
  const handleClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'A') {
      const href = target.getAttribute('href');
      // Handle #/page/{pageId} format
      if (href?.startsWith('#/page/')) {
        e.preventDefault();
        const pageId = decodeURIComponent(href.slice(7)); // Remove '#/page/'
        onNavigate(pageId);
      }
    }
  }, [onNavigate]);

  // Handle hover on page links
  const handleMouseOver = useCallback((e: React.MouseEvent) => {
    if (!onHoverEnter) return;
    const target = e.target as HTMLElement;
    if (target.tagName === 'A') {
      const href = target.getAttribute('href');
      // Handle #/page/{pageId} format
      if (href?.startsWith('#/page/')) {
        const pageId = decodeURIComponent(href.slice(7));
        onHoverEnter(pageId, e);
      }
    }
  }, [onHoverEnter]);

  const handleMouseOut = useCallback((e: React.MouseEvent) => {
    if (!onHoverLeave) return;
    const target = e.target as HTMLElement;
    if (target.tagName === 'A') {
      const href = target.getAttribute('href');
      if (href?.startsWith('#/page/')) {
        onHoverLeave();
      }
    }
  }, [onHoverLeave]);

  return (
    <div
      data-color-mode="dark"
      onClick={handleClick}
      onMouseOver={handleMouseOver}
      onMouseOut={handleMouseOut}
      style={{
        fontSize: '14px',
        lineHeight: 1.7,
        color: colors.textSecondary,
      }}
    >
      <MDEditor.Markdown
        source={processedContent}
        style={{
          backgroundColor: 'transparent',
          color: colors.textSecondary,
        }}
      />
      <style>{`
        .wmde-markdown {
          background: transparent !important;
          color: ${colors.textSecondary} !important;
          font-size: 14px !important;
          line-height: 1.7 !important;
        }
        .wmde-markdown h1,
        .wmde-markdown h2,
        .wmde-markdown h3,
        .wmde-markdown h4 {
          color: ${colors.textPrimary} !important;
          border-bottom: none !important;
          margin-top: 1.5em !important;
          margin-bottom: 0.5em !important;
        }
        .wmde-markdown a {
          color: ${colors.accent} !important;
          text-decoration: none !important;
          border-bottom: 1px dotted ${colors.accent};
        }
        .wmde-markdown a:hover {
          opacity: 0.8;
        }
        .wmde-markdown code {
          background: ${colors.bgTertiary} !important;
          color: ${colors.textSecondary} !important;
          padding: 2px 6px !important;
          border-radius: 4px !important;
        }
        .wmde-markdown pre {
          background: ${colors.bgSecondary} !important;
          border: 1px solid ${colors.border} !important;
          border-radius: 6px !important;
        }
        .wmde-markdown pre code {
          background: transparent !important;
          padding: 0 !important;
        }
        .wmde-markdown blockquote {
          border-left: 3px solid ${colors.accent} !important;
          color: ${colors.textMuted} !important;
          background: rgba(16, 185, 129, 0.08) !important;
          padding: 8px 16px !important;
          margin: 16px 0 !important;
          border-radius: 0 4px 4px 0 !important;
        }
        .wmde-markdown ul,
        .wmde-markdown ol {
          padding-left: 24px !important;
        }
        .wmde-markdown li {
          margin-bottom: 4px !important;
        }
        .wmde-markdown table {
          border-collapse: collapse !important;
        }
        .wmde-markdown th,
        .wmde-markdown td {
          border: 1px solid ${colors.border} !important;
          padding: 8px 12px !important;
        }
        .wmde-markdown th {
          background: ${colors.bgSecondary} !important;
        }
        .wmde-markdown hr {
          border-color: ${colors.border} !important;
        }
        .wmde-markdown strong {
          color: ${colors.textPrimary} !important;
        }
      `}</style>
    </div>
  );
}

interface WikiPageViewProps {
  page: WikiPage;
  pages: WikiPage[];
  entityIndex: Map<string, HardState>;
  imageData: ImageMetadata | null;
  imageLoader?: ImageLoader;
  /** Other pages that share this page's base name (for disambiguation) */
  disambiguation?: DisambiguationEntry[];
  onNavigate: (pageId: string) => void;
  onNavigateToEntity: (entityId: string) => void;
  prominenceScale: ProminenceScale;
  breakpoint?: 'mobile' | 'tablet' | 'desktop';
}

export default function WikiPageView({
  page,
  pages,
  entityIndex,
  imageData,
  imageLoader,
  disambiguation,
  onNavigate,
  onNavigateToEntity,
  prominenceScale,
  breakpoint = 'desktop',
}: WikiPageViewProps) {
  const isMobile = breakpoint === 'mobile';
  const isTablet = breakpoint === 'tablet';
  const showInfoboxInline = isMobile || isTablet;
  const [showSeedModal, setShowSeedModal] = useState(false);
  const [activeImage, setActiveImage] = useState<{
    url: string;
    title: string;
    summary?: string;
  } | null>(null);
  const [hoveredBacklink, setHoveredBacklink] = useState<{
    id: string;
    position: { x: number; y: number };
  } | null>(null);
  const hoverTimeoutRef = useRef<number | null>(null);

  // Handle entity link hover with delay to prevent flicker
  const handleEntityHoverEnter = useCallback((id: string, e: React.MouseEvent) => {
    // Capture position immediately - React synthetic events are pooled
    const x = e.clientX;
    const y = e.clientY;

    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    hoverTimeoutRef.current = window.setTimeout(() => {
      setHoveredBacklink({
        id,
        position: { x, y },
      });
    }, 200); // 200ms delay before showing preview
  }, []);

  const handleEntityHoverLeave = useCallback(() => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setHoveredBacklink(null);
  }, []);

  // Clear hover when clicking to navigate
  const handleEntityClick = useCallback((entityId: string) => {
    handleEntityHoverLeave();
    onNavigateToEntity(entityId);
  }, [handleEntityHoverLeave, onNavigateToEntity]);

  // Get hovered entity data for preview
  const hoveredEntity = useMemo(() => {
    if (!hoveredBacklink) return null;
    return entityIndex.get(hoveredBacklink.id) || null;
  }, [hoveredBacklink, entityIndex]);

  // Get summary for hovered entity
  const hoveredSummary = useMemo(() => {
    if (!hoveredBacklink) return undefined;
    const page = pages.find(p => p.id === hoveredBacklink.id);
    return page?.content?.summary;
  }, [hoveredBacklink, pages]);

  // Load image for hovered entity
  // Build a map for fast image lookup by entityId
  const imageByEntityId = useMemo(() => {
    const map = new Map<string, ImageMetadata['results'][0]>();
    if (imageData?.results) {
      for (const img of imageData.results) {
        map.set(img.entityId, img);
      }
    }
    return map;
  }, [imageData]);

  // Resolve hovered image URL synchronously using pre-resolved paths
  const hoveredImageUrl = useMemo(() => {
    if (!hoveredBacklink) return null;
    const imageEntry = imageByEntityId.get(hoveredBacklink.id);
    if (!imageEntry) return null;
    // Use thumbPath (already resolved by normalizeBundle) or fall back to localPath
    return imageEntry.thumbPath || imageEntry.localPath || null;
  }, [hoveredBacklink, imageByEntityId]);

  const pageById = useMemo(() => new Map(pages.map(p => [p.id, p])), [pages]);

  const resolveImageDetails = useCallback(({
    entityId,
    imageId,
    caption,
    fallbackTitle,
    fallbackSummary,
  }: {
    entityId?: string;
    imageId?: string;
    caption?: string;
    fallbackTitle?: string;
    fallbackSummary?: string;
  }) => {
    let resolvedEntityId = entityId;
    if (!resolvedEntityId && imageId && imageData?.results) {
      const match = imageData.results.find(result => result.imageId === imageId);
      resolvedEntityId = match?.entityId;
    }

    let title = '';
    let summary = '';

    if (resolvedEntityId) {
      const entity = entityIndex.get(resolvedEntityId);
      const entityPage = pageById.get(resolvedEntityId);
      title = entity?.name || entityPage?.title || '';
      summary = entityPage?.content.summary || '';
    }

    if (!title) {
      title = fallbackTitle || caption || page.title;
    }
    if (!summary) {
      summary = fallbackSummary || page.content.summary || caption || '';
    }

    return { title, summary };
  }, [imageData, entityIndex, pageById, page.content.summary, page.title]);

  const openImageModal = useCallback((imageUrl: string, info: {
    entityId?: string;
    imageId?: string;
    caption?: string;
    fallbackTitle?: string;
    fallbackSummary?: string;
  }) => {
    if (!imageUrl) return;
    const { title, summary } = resolveImageDetails(info);
    setActiveImage({ url: imageUrl, title, summary });
  }, [resolveImageDetails]);

  const closeImageModal = useCallback(() => {
    setActiveImage(null);
  }, []);

  const handleInlineImageOpen = useCallback(async (thumbUrl: string, image: WikiSectionImage) => {
    // Try to load full-size image for lightbox, fall back to thumbnail
    let fullUrl = thumbUrl;
    if (imageLoader && image.imageId) {
      try {
        const loaded = await imageLoader(image.imageId, 'full');
        if (loaded) fullUrl = loaded;
      } catch {
        // Fall back to thumbnail
      }
    }
    openImageModal(fullUrl, {
      entityId: image.entityId,
      imageId: image.imageId,
      caption: image.caption,
    });
  }, [openImageModal, imageLoader]);

  // Build seed data for chronicle pages
  const seedData = useMemo((): ChronicleSeedData | null => {
    if (page.type !== 'chronicle' || !page.chronicle) return null;
    const chronicle = page.chronicle;
    if (!chronicle.narrativeStyleId && !chronicle.roleAssignments?.length) return null;

    // Get entrypoint name
    const entrypoint = chronicle.entrypointId
      ? entityIndex.get(chronicle.entrypointId)
      : undefined;

    return {
      narrativeStyleId: chronicle.narrativeStyleId || '',
      entrypointId: chronicle.entrypointId,
      entrypointName: entrypoint?.name,
      roleAssignments: chronicle.roleAssignments || [],
      selectedEventIds: chronicle.selectedEventIds || [],
      selectedRelationshipIds: chronicle.selectedRelationshipIds || [],
    };
  }, [page, entityIndex]);

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
      p.type !== 'category' &&
      p.linkedEntities.includes(page.id)
    );
  }, [pages, page.id]);

  // Build name to ID map for link resolution (entities + static pages)
  const entityNameMap = useMemo(() => {
    const map = new Map<string, string>();
    // Add entity names
    for (const [id, entity] of entityIndex) {
      map.set(entity.name.toLowerCase(), id);
    }
    // Add static page titles (full title and base name without namespace)
    for (const p of pages) {
      if (p.type !== 'static') continue;
      const titleLower = p.title.toLowerCase();
      if (!map.has(titleLower)) {
        map.set(titleLower, p.id);
      }
      // Also add base name (e.g., "The Berg" from "World:The Berg")
      const colonIdx = p.title.indexOf(':');
      if (colonIdx > 0 && colonIdx < p.title.length - 1) {
        const baseName = p.title.slice(colonIdx + 1).trim().toLowerCase();
        if (baseName && !map.has(baseName)) {
          map.set(baseName, p.id);
        }
      }
    }
    return map;
  }, [entityIndex, pages]);

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

  // Build linkable names for auto-linking (used by applyWikiLinks)
  const linkableNames = useMemo(() => {
    const names: Array<{ name: string; id: string }> = [];
    // Add entity names
    for (const [id, entity] of entityIndex) {
      names.push({ name: entity.name, id });
    }
    // Add entity aliases
    for (const candidate of pages) {
      if (candidate.type !== 'entity' || !candidate.aliases?.length) continue;
      for (const alias of candidate.aliases) {
        if (alias.length >= 3) {
          names.push({ name: alias, id: candidate.id });
        }
      }
    }
    // Add static page names (full title and base name)
    for (const p of pages) {
      if (p.type !== 'static') continue;
      names.push({ name: p.title, id: p.id });
      const colonIdx = p.title.indexOf(':');
      if (colonIdx > 0 && colonIdx < p.title.length - 1) {
        const baseName = p.title.slice(colonIdx + 1).trim();
        if (baseName && baseName !== p.title) {
          names.push({ name: baseName, id: p.id });
        }
      }
    }
    return names;
  }, [entityIndex, pages]);

  // Get image for infobox
  const infoboxImage = page.content.infobox?.image?.path || page.images[0]?.path;

  // Handle infobox image click - load full-size for lightbox
  const handleInfoboxImageClick = useCallback(async () => {
    if (!infoboxImage) return;
    const entityId = entityIndex.has(page.id) ? page.id : undefined;
    // Try to load full-size image for lightbox
    let fullUrl = infoboxImage;
    if (imageLoader && entityId) {
      const entity = entityIndex.get(entityId);
      const imageId = entity?.enrichment?.image?.imageId;
      if (imageId) {
        try {
          const loaded = await imageLoader(imageId, 'full');
          if (loaded) fullUrl = loaded;
        } catch {
          // Fall back to infobox image path
        }
      }
    }
    openImageModal(fullUrl, {
      entityId,
      fallbackTitle: page.title,
      fallbackSummary: page.content.summary,
    });
  }, [infoboxImage, entityIndex, page.id, page.title, page.content.summary, imageLoader, openImageModal]);

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
              : page.type === 'conflux'
              ? 'Confluxes'
              : page.type}
          </span>
          {' / '}
          <span style={{ color: colors.textSecondary }}>{page.title}</span>
        </div>
        <h1 style={styles.title}>{page.title}</h1>

        {/* Disambiguation notice - Wikipedia-style hatnote */}
        {disambiguation && disambiguation.length > 0 && (
          <div style={styles.disambiguationNotice}>
            This page is about the {
              page.type === 'entity' || page.type === 'era'
                ? (entityIndex.get(page.id)?.kind || page.type)
                : page.type === 'static'
                  ? (page.title.includes(':') ? page.title.split(':')[0].toLowerCase() : 'page')
                  : page.type === 'conflux'
                    ? 'conflux'
                    : page.type
            }.
            {' '}See also:
            {disambiguation
              .filter(d => d.pageId !== page.id)
              .map((d, i, arr) => (
                <span key={d.pageId}>
                  <span
                    style={styles.disambiguationLink}
                    onClick={() => onNavigate(d.pageId)}
                  >
                    {d.title}
                  </span>
                  {i < arr.length - 1 && ','}
                </span>
              ))}
          </div>
        )}

        {page.content.summary && (
          <div style={styles.summary}>{page.content.summary}</div>
        )}
        {seedData && (
          <button
            style={styles.seedButton}
            onClick={() => setShowSeedModal(true)}
          >
            View Generation Context
          </button>
        )}
      </div>

      <div style={{
        ...styles.content,
        flexDirection: showInfoboxInline ? 'column' : 'row',
      }}>
        {/* Infobox - inline on mobile/tablet (rendered first, above content) */}
        {showInfoboxInline && page.content.infobox && (
          <div style={{
            ...styles.infobox,
            width: '100%',
            position: 'static',
            marginBottom: '24px',
          }}>
            <div style={styles.infoboxHeader}>{page.title}</div>
            {infoboxImage && (
              <img
                src={infoboxImage}
                alt={page.title}
                style={{ ...styles.infoboxImage, cursor: 'zoom-in', height: isMobile ? '200px' : '180px' }}
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
                onClick={handleInfoboxImageClick}
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
              {section.heading === 'Timeline' && page.timelineEvents && page.timelineEvents.length > 0 ? (
                <>
                  {/* Prominence Timeline graph - shows prominence changes over time */}
                  <ProminenceTimeline
                    events={page.timelineEvents}
                    entityId={page.id}
                    prominenceScale={prominenceScale}
                  />
                  {/* Entity Timeline table - shows discrete events (excluding prominence-only) */}
                  <EntityTimeline
                    events={page.timelineEvents}
                    entityId={page.id}
                    entityIndex={entityIndex}
                    onNavigate={handleEntityClick}
                    onHoverEnter={handleEntityHoverEnter}
                    onHoverLeave={handleEntityHoverLeave}
                  />
                </>
              ) : (
                <SectionWithImages
                  section={section}
                  imageData={imageData}
                  imageLoader={imageLoader}
                  entityNameMap={entityNameMap}
                  aliasMap={aliasMap}
                  linkableNames={linkableNames}
                  onNavigate={handleEntityClick}
                  onHoverEnter={handleEntityHoverEnter}
                  onHoverLeave={handleEntityHoverLeave}
                  onImageOpen={handleInlineImageOpen}
                />
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

        {/* Infobox - sidebar on desktop (rendered after main content) */}
        {!showInfoboxInline && page.content.infobox && (
          <div style={styles.infobox}>
            <div style={styles.infoboxHeader}>{page.title}</div>
            {infoboxImage && (
              <img
                src={infoboxImage}
                alt={page.title}
                style={{ ...styles.infoboxImage, cursor: 'zoom-in' }}
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
                onClick={handleInfoboxImageClick}
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

      {/* Generation Context Modal */}
      {seedData && (
        <SeedModal
          isOpen={showSeedModal}
          onClose={() => setShowSeedModal(false)}
          seed={seedData}
          title="Generation Context"
        />
      )}

      <ImageLightbox
        isOpen={Boolean(activeImage)}
        imageUrl={activeImage?.url || null}
        title={activeImage?.title || ''}
        summary={activeImage?.summary}
        onClose={closeImageModal}
      />

      {/* Entity Preview Card (hover) */}
      {hoveredBacklink && hoveredEntity && (
        <EntityPreviewCard
          entity={hoveredEntity}
          summary={hoveredSummary}
          position={hoveredBacklink.position}
          imageUrl={hoveredImageUrl}
          prominenceScale={prominenceScale}
        />
      )}
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
