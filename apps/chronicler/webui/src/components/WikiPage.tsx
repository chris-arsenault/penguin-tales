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
import type { WikiPage, WikiSection, WikiSectionImage, HardState, ImageMetadata, ImageLoader, DisambiguationEntry, ImageAspect } from '../types/world.ts';
import { SeedModal, type ChronicleSeedData } from './ChronicleSeedViewer.tsx';
import { applyWikiLinks } from '../lib/wikiBuilder.ts';
import { resolveAnchorPhrase } from '../lib/fuzzyAnchor.ts';
import EntityTimeline from './EntityTimeline.tsx';
import ProminenceTimeline from './ProminenceTimeline.tsx';
import ImageLightbox from './ImageLightbox.tsx';
import { prominenceLabelFromScale, type ProminenceScale } from '@canonry/world-schema';
import styles from './WikiPage.module.css';

/**
 * Check if image size is a float (small/medium) vs block (large/full-width)
 */
function isFloatImage(size: WikiSectionImage['size']): boolean {
  return size === 'small' || size === 'medium' || size === 'large';
}

/**
 * Get the combined className for an image based on size
 * Float images (small/medium): thumb frame + size width
 * Block images (large/full-width): centered block style
 */
function getImageClassName(size: WikiSectionImage['size'], position: 'left' | 'right' = 'left'): string {
  const isFloat = isFloatImage(size);

  if (isFloat) {
    const thumbClass = position === 'left' ? styles.imageThumbLeft : styles.imageThumbRight;
    const sizeClass = size === 'small'
      ? styles.imageSmall
      : size === 'medium'
      ? styles.imageMedium
      : styles.imageLarge;
    return `${thumbClass} ${sizeClass}`;
  }

  // Block images
  if (size === 'full-width') return styles.imageFullWidth;
  const alignClass = position === 'right' ? styles.imageLargeRight : styles.imageLargeLeft;
  return `${styles.imageLarge} ${alignClass}`;
}

/**
 * Classify aspect ratio from width/height (for runtime detection fallback)
 */
function classifyAspect(width: number, height: number): ImageAspect {
  const ratio = width / height;
  if (ratio < 0.9) return 'portrait';
  if (ratio > 1.1) return 'landscape';
  return 'square';
}

/**
 * Get infobox image CSS class based on aspect ratio
 */
function getInfoboxImageClass(aspect: ImageAspect | undefined, isMobile: boolean): string {
  // If no aspect info, use the fallback class that handles any aspect gracefully
  if (!aspect) {
    return isMobile ? styles.infoboxImageMobile : styles.infoboxImage;
  }
  // Use aspect-specific classes
  const suffix = isMobile ? 'Mobile' : '';
  switch (aspect) {
    case 'portrait':
      return styles[`infoboxImagePortrait${suffix}`] || styles.infoboxImagePortrait;
    case 'landscape':
      return styles[`infoboxImageLandscape${suffix}`] || styles.infoboxImageLandscape;
    case 'square':
      return styles[`infoboxImageSquare${suffix}`] || styles.infoboxImageSquare;
    default:
      return isMobile ? styles.infoboxImageMobile : styles.infoboxImage;
  }
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

  const imageClassName = getImageClassName(image.size, image.justification || 'left');

  if (loading) {
    return (
      <figure className={imageClassName}>
        <div className={styles.imagePlaceholder}>Loading...</div>
      </figure>
    );
  }

  if (error || !imageUrl) {
    return null; // Don't render if image not found
  }

  return (
    <figure className={imageClassName}>
      <img
        src={imageUrl}
        alt={image.caption || 'Chronicle illustration'}
        className={styles.figureImage}
        onError={() => setError(true)}
        onClick={() => onOpen?.(imageUrl, image)}
      />
      {image.caption && (
        <figcaption className={styles.imageCaption}>{image.caption}</figcaption>
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

  // Find anchor position for ALL images and sort by position
  const positionedImages: Array<{ image: WikiSectionImage; position: number }> = [];

  for (const img of images) {
    // Fuzzy anchor resolution: handles LLM paraphrases
    const resolved = img.anchorText ? resolveAnchorPhrase(img.anchorText, content) : null;
    let position = resolved ? resolved.index : -1;
    // Use anchorIndex as fallback if fuzzy match fails
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
    <div className={styles.sectionWithImages}>
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
                <div className={styles.clearfix} />
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
      <div className={styles.clearfix} />
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
    <div className={styles.previewCard} style={{ left, top }}>
      <div className={styles.previewHeader}>
        {imageUrl ? (
          <img src={imageUrl} alt="" className={styles.previewThumbnail} />
        ) : (
          <div className={styles.previewThumbnailPlaceholder}>{initial}</div>
        )}
        <div className={styles.previewTitle}>{entity.name}</div>
      </div>
      <div className={styles.previewBody}>
        <div className={styles.previewBadges}>
          <span className={styles.previewBadgeKind}>
            {entity.kind}
          </span>
          {entity.subtype && (
            <span className={styles.previewBadge}>{entity.subtype}</span>
          )}
          <span className={styles.previewBadgeStatus}>
            {entity.status}
          </span>
          <span className={styles.previewBadge}>
            {prominenceLabelFromScale(entity.prominence, prominenceScale)}
          </span>
          {entity.culture && (
            <span className={styles.previewBadge}>{entity.culture}</span>
          )}
        </div>
        {summary && (
          <div className={styles.previewSummary}>
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
  // 2. Convert [[Entity Name]] or [[Entity Name|entityId]] to markdown links with proper URLs
  const processedContent = useMemo(() => {
    // First apply wiki links to detect entity names
    const linkedContent = applyWikiLinks(content, linkableNames);
    // Then convert [[...]] to markdown-friendly link format with proper URLs
    // Supports both [[EntityName]] (lookup by name) and [[EntityName|entityId]] (direct ID)
    return linkedContent.replace(/\[\[([^\]]+)\]\]/g, (match, linkContent) => {
      // Support [[EntityName|entityId]] format for ID-based linking
      // This is used by conflux pages where entities may exist in narrativeHistory
      // but not in hardState (entityNameMap is built from hardState)
      const pipeIndex = linkContent.lastIndexOf('|');
      let displayName: string;
      let pageId: string | undefined;

      if (pipeIndex > 0 && pipeIndex < linkContent.length - 1) {
        // Format: [[DisplayName|entityId]] - use provided ID directly
        displayName = linkContent.slice(0, pipeIndex);
        pageId = linkContent.slice(pipeIndex + 1);
      } else {
        // Format: [[EntityName]] - look up by name
        displayName = linkContent;
        // Use Unicode NFC normalization for consistent lookup with entityNameMap
        const normalized = displayName.toLowerCase().trim().normalize('NFC');
        pageId = entityNameMap.get(normalized) || aliasMap.get(normalized);
      }

      if (pageId) {
        // Use #/page/{pageId} format that matches the router
        return `[${displayName}](#/page/${encodeURIComponent(pageId)})`;
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
      className={styles.markdownSection}
    >
      <MDEditor.Markdown
        source={processedContent}
        style={{ backgroundColor: 'transparent', color: 'var(--color-text-secondary)' }}
      />
      <style>{`
        .wmde-markdown {
          background: transparent !important;
          color: var(--color-text-secondary) !important;
          font-size: 14px !important;
          line-height: 1.7 !important;
        }
        .wmde-markdown h1,
        .wmde-markdown h2,
        .wmde-markdown h3,
        .wmde-markdown h4 {
          color: var(--color-text-primary) !important;
          border-bottom: none !important;
          margin-top: 1.5em !important;
          margin-bottom: 0.5em !important;
        }
        .wmde-markdown a {
          color: var(--color-accent) !important;
          text-decoration: none !important;
          border-bottom: 1px dotted var(--color-accent);
        }
        .wmde-markdown a:hover {
          opacity: 0.8;
        }
        .wmde-markdown code {
          background: var(--color-bg-tertiary) !important;
          color: var(--color-text-secondary) !important;
          padding: 2px 6px !important;
          border-radius: 4px !important;
        }
        .wmde-markdown pre {
          background: var(--color-bg-secondary) !important;
          border: 1px solid var(--color-border) !important;
          border-radius: 6px !important;
        }
        .wmde-markdown pre code {
          background: transparent !important;
          padding: 0 !important;
        }
        .wmde-markdown blockquote {
          border-left: 3px solid var(--color-accent) !important;
          color: var(--color-text-muted) !important;
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
          border: 1px solid var(--color-border) !important;
          padding: 8px 12px !important;
        }
        .wmde-markdown th {
          background: var(--color-bg-secondary) !important;
        }
        .wmde-markdown hr {
          border-color: var(--color-border) !important;
        }
        .wmde-markdown strong {
          color: var(--color-text-primary) !important;
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
    suppressSummaryFallback,
    captionOnly,
  }: {
    entityId?: string;
    imageId?: string;
    caption?: string;
    fallbackTitle?: string;
    fallbackSummary?: string;
    suppressSummaryFallback?: boolean;
    captionOnly?: boolean;
  }) => {
    if (captionOnly) {
      return { title: caption || '', summary: '' };
    }
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
      if (suppressSummaryFallback) {
        summary = fallbackSummary || caption || '';
      } else {
        summary = fallbackSummary || page.content.summary || caption || '';
      }
    }

    return { title, summary };
  }, [imageData, entityIndex, pageById, page.content.summary, page.title]);

  const openImageModal = useCallback((imageUrl: string, info: {
    entityId?: string;
    imageId?: string;
    caption?: string;
    fallbackTitle?: string;
    fallbackSummary?: string;
    suppressSummaryFallback?: boolean;
    captionOnly?: boolean;
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
      suppressSummaryFallback: image.type === 'chronicle_image',
      captionOnly: image.type === 'chronicle_image',
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
      temporalContext: chronicle.temporalContext,
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
  // Use Unicode NFC normalization to ensure consistent string comparison
  // (important for names with special characters like ☽, ~, accents, etc.)
  const entityNameMap = useMemo(() => {
    const map = new Map<string, string>();
    // Add entity names
    for (const [id, entity] of entityIndex) {
      map.set(entity.name.toLowerCase().normalize('NFC'), id);
    }
    // Add static page titles (full title and base name without namespace)
    for (const p of pages) {
      if (p.type !== 'static') continue;
      const titleLower = p.title.toLowerCase().normalize('NFC');
      if (!map.has(titleLower)) {
        map.set(titleLower, p.id);
      }
      // Also add base name (e.g., "The Berg" from "World:The Berg")
      const colonIdx = p.title.indexOf(':');
      if (colonIdx > 0 && colonIdx < p.title.length - 1) {
        const baseName = p.title.slice(colonIdx + 1).trim().toLowerCase().normalize('NFC');
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
        // Use Unicode NFC normalization for consistent string comparison
        const normalized = alias.toLowerCase().trim().normalize('NFC');
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

  // Get image for infobox with dimension info
  const infoboxImage = page.content.infobox?.image?.path || page.images[0]?.path;
  const infoboxImageAspect = page.content.infobox?.image?.aspect || page.images[0]?.aspect;

  // State for detected aspect (fallback when metadata is missing)
  const [detectedAspect, setDetectedAspect] = useState<ImageAspect | undefined>(undefined);

  // Effective aspect: use metadata if available, otherwise use detected
  const effectiveAspect = infoboxImageAspect || detectedAspect;

  // Handle image load to detect aspect for images without metadata
  const handleInfoboxImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    if (!infoboxImageAspect) {
      const img = e.currentTarget;
      const detected = classifyAspect(img.naturalWidth, img.naturalHeight);
      setDetectedAspect(detected);
    }
  }, [infoboxImageAspect]);

  // Reset detected aspect when page changes
  useEffect(() => {
    setDetectedAspect(undefined);
  }, [page.id]);

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
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.breadcrumbs}>
          <span
            className={styles.breadcrumbLink}
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
          <span className={styles.breadcrumbCurrent}>{page.title}</span>
        </div>
        <h1 className={styles.title}>{page.title}</h1>

        {/* Disambiguation notice - Wikipedia-style hatnote */}
        {disambiguation && disambiguation.length > 0 && (
          <div className={styles.disambiguationNotice}>
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
                    className={styles.disambiguationLink}
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
          <div className={styles.summary}>
            {page.content.coverImageId && (
              <ChronicleImage
                image={{
                  refId: 'cover',
                  type: 'chronicle_image',
                  imageId: page.content.coverImageId,
                  anchorText: '',
                  size: 'medium',
                  justification: 'left',
                  caption: page.title,
                }}
                imageData={imageData}
                imageLoader={imageLoader}
                onOpen={(url, img) => setActiveImage({ url, title: img.caption || page.title })}
              />
            )}
            {page.content.summary}
            {page.content.coverImageId && <div className={styles.clearfix} />}
          </div>
        )}
        {seedData && (
          <button
            className={styles.seedButton}
            onClick={() => setShowSeedModal(true)}
          >
            View Generation Context
          </button>
        )}
      </div>

      <div className={showInfoboxInline ? styles.contentColumn : styles.content}>
        {/* Infobox - inline on mobile/tablet (rendered first, above content) */}
        {showInfoboxInline && page.content.infobox && (
          <div className={styles.infoboxInline}>
            <div className={styles.infoboxHeader}>{page.title}</div>
            {infoboxImage && (
              <img
                src={infoboxImage}
                alt={page.title}
                className={getInfoboxImageClass(effectiveAspect, isMobile)}
                onLoad={handleInfoboxImageLoad}
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
                onClick={handleInfoboxImageClick}
              />
            )}
            <div className={styles.infoboxBody}>
              {page.content.infobox.fields.map((field, i) => (
                <div key={i} className={styles.infoboxRow}>
                  <div className={styles.infoboxLabel}>{field.label}</div>
                  <div className={styles.infoboxValue}>
                    {field.linkedEntity ? (
                      <span
                        className={styles.entityLink}
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
        <div className={styles.main}>
          {/* Table of Contents (if > 2 sections) */}
          {page.content.sections.length > 2 && (
            <div className={styles.toc}>
              <div className={styles.tocTitle}>Contents</div>
              {page.content.sections.map((section, i) => (
                <button
                  key={section.id}
                  className={styles.tocItem}
                  style={{ paddingLeft: `${(section.level - 1) * 16}px` }}
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

        {chronicleLinks.length > 0 && (
          <div className={styles.chronicles}>
            <div className={styles.chroniclesTitle}>
              Chronicles ({chronicleLinks.length})
            </div>
            {chronicleLinks.slice(0, 20).map(link => (
              <button
                key={link.id}
                className={styles.chronicleItem}
                onClick={() => onNavigate(link.id)}
              >
                <span>{link.title}</span>
                {link.chronicle?.format && (
                  <span className={styles.chronicleMeta}>
                    {link.chronicle.format === 'document' ? 'Document' : 'Story'}
                  </span>
                )}
              </button>
            ))}
            {chronicleLinks.length > 20 && (
              <div className={styles.moreText}>
                ...and {chronicleLinks.length - 20} more
              </div>
            )}
          </div>
        )}

        {/* Sections */}
        {page.content.sections.map(section => (
          <div key={section.id} id={section.id} className={styles.section}>
            <h2 className={styles.sectionHeading}>{section.heading}</h2>
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

          {/* Backlinks */}
          {backlinks.length > 0 && (
            <div className={styles.backlinks}>
              <div className={styles.backlinksTitle}>
                What links here ({backlinks.length})
              </div>
              {backlinks.slice(0, 20).map(link => (
                <button
                  key={link.id}
                  className={styles.backlinkItem}
                  onClick={() => onNavigate(link.id)}
                >
                  {link.title}
                </button>
              ))}
              {backlinks.length > 20 && (
                <div className={styles.moreText}>
                  ...and {backlinks.length - 20} more
                </div>
              )}
            </div>
          )}

          {/* Categories */}
          {page.categories.length > 0 && (
            <div className={styles.categories}>
              <div className={styles.categoriesLabel}>Categories:</div>
              {page.categories.map(catId => (
                <button
                  key={catId}
                  className={styles.categoryTag}
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
          <div className={styles.infobox}>
            <div className={styles.infoboxHeader}>{page.title}</div>
            {infoboxImage && (
              <img
                src={infoboxImage}
                alt={page.title}
                className={getInfoboxImageClass(effectiveAspect, false)}
                onLoad={handleInfoboxImageLoad}
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
                onClick={handleInfoboxImageClick}
              />
            )}
            <div className={styles.infoboxBody}>
              {page.content.infobox.fields.map((field, i) => (
                <div key={i} className={styles.infoboxRow}>
                  <div className={styles.infoboxLabel}>{field.label}</div>
                  <div className={styles.infoboxValue}>
                    {field.linkedEntity ? (
                      <span
                        className={styles.entityLink}
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
