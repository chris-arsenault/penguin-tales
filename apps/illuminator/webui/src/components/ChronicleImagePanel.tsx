/**
 * ChronicleImagePanel - Review and generate chronicle images
 *
 * Shows all image refs for a chronicle:
 * - Entity refs: references to existing entity images
 * - Prompt requests: new images to be generated with LLM-provided prompts
 *
 * Integrates with the existing style library and visual identity system:
 * - StyleSelector for artistic/composition style selection
 * - Culture dropdown for visual identity theming
 * - Uses the same image generation pipeline as entity images
 */

import { useState, useMemo, useCallback } from 'react';
import { useImageUrl } from '../hooks/useImageUrl';
import StyleSelector, { resolveStyleSelection, CULTURE_DEFAULT_ID } from './StyleSelector';
import { buildChronicleImagePrompt } from '../lib/promptBuilders';
import type { ChronicleImageRefs, EntityImageRef, PromptRequestRef } from '../lib/chronicleTypes';
import type { StyleInfo } from '../lib/promptBuilders';

interface EntityContext {
  id: string;
  name: string;
  kind: string;
  culture?: string;
  enrichment?: {
    image?: {
      imageId: string;
    };
    text?: {
      visualThesis?: string;
      visualTraits?: string[];
    };
  };
}

interface Culture {
  id: string;
  name: string;
  styleKeywords?: string[];
  defaultArtisticStyleId?: string;
  defaultCompositionStyles?: Record<string, string>;
}

interface StyleLibrary {
  artisticStyles: Array<{ id: string; name: string; description?: string; promptFragment?: string }>;
  compositionStyles: Array<{ id: string; name: string; description?: string; promptFragment?: string; suitableForKinds?: string[] }>;
  colorPalettes: Array<{ id: string; name: string; description?: string; promptFragment?: string }>;
}

interface WorldContext {
  name?: string;
  description?: string;
  tone?: string;
}

interface CultureIdentities {
  visual?: Record<string, Record<string, string>>;
  descriptive?: Record<string, Record<string, string>>;
  visualKeysByKind?: Record<string, string[]>;
  descriptiveKeysByKind?: Record<string, string[]>;
}

interface ChronicleImagePanelProps {
  imageRefs: ChronicleImageRefs | null;
  entities: Map<string, EntityContext>;
  /** Callback to generate an image - receives the ref and the built prompt */
  onGenerateImage?: (ref: PromptRequestRef, prompt: string, styleInfo: StyleInfo) => void;
  isGenerating?: boolean;
  /** Style library for style selection */
  styleLibrary?: StyleLibrary;
  /** Current style selection from parent (optional - uses local state if not provided) */
  styleSelection?: { artisticStyleId?: string; compositionStyleId?: string; colorPaletteId?: string };
  onStyleSelectionChange?: (selection: { artisticStyleId?: string; compositionStyleId?: string; colorPaletteId?: string }) => void;
  /** Available cultures for visual identity */
  cultures?: Culture[];
  /** Culture identities containing visual identity data */
  cultureIdentities?: CultureIdentities;
  /** World context for prompt building */
  worldContext?: WorldContext;
  /** Chronicle title for prompt context */
  chronicleTitle?: string;
}

// Size display names
const SIZE_LABELS: Record<string, string> = {
  small: 'Small (150px)',
  medium: 'Medium (300px)',
  large: 'Large (450px)',
  'full-width': 'Full Width',
};

// Status badge colors
const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  pending: { bg: 'rgba(245, 158, 11, 0.2)', text: '#f59e0b' },
  generating: { bg: 'rgba(59, 130, 246, 0.2)', text: '#3b82f6' },
  complete: { bg: 'rgba(16, 185, 129, 0.2)', text: '#10b981' },
  failed: { bg: 'rgba(239, 68, 68, 0.2)', text: '#ef4444' },
};

// Default entity kind for visual identity filtering (general scene images)
const DEFAULT_VISUAL_IDENTITY_KIND = 'scene';

function EntityImageRefCard({ imageRef, entity }: { imageRef: EntityImageRef; entity: EntityContext | undefined }) {
  const imageId = entity?.enrichment?.image?.imageId;
  const { url, loading } = useImageUrl(imageId);
  const hasImage = Boolean(imageId);

  return (
    <div
      style={{
        display: 'flex',
        gap: '12px',
        padding: '12px',
        background: 'var(--bg-primary)',
        border: '1px solid var(--border-color)',
        borderRadius: '6px',
      }}
    >
      {/* Thumbnail */}
      <div
        style={{
          width: '60px',
          height: '60px',
          borderRadius: '4px',
          background: 'var(--bg-tertiary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          flexShrink: 0,
        }}
      >
        {loading ? (
          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>...</span>
        ) : url ? (
          <img
            src={url}
            alt={entity?.name || 'Entity image'}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <span style={{ fontSize: '20px', color: 'var(--text-muted)' }}>
            {hasImage ? '?' : '—'}
          </span>
        )}
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <span
            style={{
              fontSize: '10px',
              padding: '2px 6px',
              background: 'rgba(59, 130, 246, 0.15)',
              color: '#3b82f6',
              borderRadius: '4px',
              fontWeight: 500,
            }}
          >
            Entity Ref
          </span>
          <span
            style={{
              fontSize: '10px',
              padding: '2px 6px',
              background: 'var(--bg-tertiary)',
              color: 'var(--text-muted)',
              borderRadius: '4px',
            }}
          >
            {SIZE_LABELS[imageRef.size] || imageRef.size}
          </span>
        </div>

        <div style={{ fontSize: '13px', fontWeight: 500, marginBottom: '2px' }}>
          {entity?.name || imageRef.entityId}
        </div>

        {entity?.kind && (
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            {entity.kind}
            {entity.culture && entity.culture !== 'universal' && ` • ${entity.culture}`}
          </div>
        )}

        <div
          style={{
            fontSize: '11px',
            color: 'var(--text-muted)',
            marginTop: '4px',
            fontStyle: 'italic',
          }}
        >
          Anchor: &quot;{imageRef.anchorText.slice(0, 40)}{imageRef.anchorText.length > 40 ? '...' : ''}&quot;
        </div>

        {imageRef.caption && (
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Caption: {imageRef.caption}
          </div>
        )}

        {!hasImage && (
          <div
            style={{
              fontSize: '11px',
              color: '#f59e0b',
              marginTop: '6px',
              padding: '4px 8px',
              background: 'rgba(245, 158, 11, 0.1)',
              borderRadius: '4px',
              display: 'inline-block',
            }}
          >
            Entity has no image
          </div>
        )}
      </div>
    </div>
  );
}

function PromptRequestCard({
  imageRef,
  onGenerate,
  isGenerating,
  entities,
}: {
  imageRef: PromptRequestRef;
  onGenerate?: () => void;
  isGenerating?: boolean;
  entities?: Map<string, EntityContext>;
}) {
  const { url, loading } = useImageUrl(imageRef.generatedImageId);
  const statusColor = STATUS_COLORS[imageRef.status] || STATUS_COLORS.pending;
  const canGenerate = imageRef.status === 'pending' && !isGenerating;

  // Resolve involved entity names
  const involvedEntityNames = imageRef.involvedEntityIds
    ?.map(id => entities?.get(id)?.name)
    .filter((name): name is string => Boolean(name));

  return (
    <div
      style={{
        display: 'flex',
        gap: '12px',
        padding: '12px',
        background: 'var(--bg-primary)',
        border: '1px solid var(--border-color)',
        borderRadius: '6px',
      }}
    >
      {/* Thumbnail/Placeholder */}
      <div
        style={{
          width: '60px',
          height: '60px',
          borderRadius: '4px',
          background: 'var(--bg-tertiary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          flexShrink: 0,
        }}
      >
        {loading ? (
          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>...</span>
        ) : url ? (
          <img
            src={url}
            alt="Generated image"
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <span style={{ fontSize: '20px', color: 'var(--text-muted)' }}>
            {imageRef.status === 'generating' ? '...' : '🖼️'}
          </span>
        )}
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <span
            style={{
              fontSize: '10px',
              padding: '2px 6px',
              background: 'rgba(168, 85, 247, 0.15)',
              color: '#a855f7',
              borderRadius: '4px',
              fontWeight: 500,
            }}
          >
            Scene Image
          </span>
          <span
            style={{
              fontSize: '10px',
              padding: '2px 6px',
              background: statusColor.bg,
              color: statusColor.text,
              borderRadius: '4px',
              fontWeight: 500,
              textTransform: 'capitalize',
            }}
          >
            {imageRef.status}
          </span>
          <span
            style={{
              fontSize: '10px',
              padding: '2px 6px',
              background: 'var(--bg-tertiary)',
              color: 'var(--text-muted)',
              borderRadius: '4px',
            }}
          >
            {SIZE_LABELS[imageRef.size] || imageRef.size}
          </span>
        </div>

        <div
          style={{
            fontSize: '12px',
            color: 'var(--text-primary)',
            marginBottom: '4px',
            lineHeight: 1.4,
          }}
        >
          {imageRef.sceneDescription.slice(0, 120)}
          {imageRef.sceneDescription.length > 120 ? '...' : ''}
        </div>

        <div
          style={{
            fontSize: '11px',
            color: 'var(--text-muted)',
            fontStyle: 'italic',
          }}
        >
          Anchor: &quot;{imageRef.anchorText.slice(0, 40)}{imageRef.anchorText.length > 40 ? '...' : ''}&quot;
        </div>

        {involvedEntityNames && involvedEntityNames.length > 0 && (
          <div
            style={{
              fontSize: '11px',
              color: 'var(--text-secondary)',
              marginTop: '4px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              flexWrap: 'wrap',
            }}
          >
            <span style={{ color: 'var(--text-muted)' }}>Figures:</span>
            {involvedEntityNames.map((name, i) => (
              <span
                key={i}
                style={{
                  padding: '1px 6px',
                  background: 'rgba(168, 85, 247, 0.1)',
                  color: '#a855f7',
                  borderRadius: '3px',
                  fontSize: '10px',
                }}
              >
                {name}
              </span>
            ))}
          </div>
        )}

        {imageRef.caption && (
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Caption: {imageRef.caption}
          </div>
        )}

        {imageRef.error && (
          <div
            style={{
              fontSize: '11px',
              color: '#ef4444',
              marginTop: '6px',
              padding: '4px 8px',
              background: 'rgba(239, 68, 68, 0.1)',
              borderRadius: '4px',
            }}
          >
            Error: {imageRef.error}
          </div>
        )}

        {canGenerate && onGenerate && (
          <button
            onClick={onGenerate}
            style={{
              marginTop: '8px',
              padding: '6px 12px',
              fontSize: '11px',
              background: 'var(--accent-primary)',
              border: 'none',
              borderRadius: '4px',
              color: 'white',
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            Generate Image
          </button>
        )}
      </div>
    </div>
  );
}

export default function ChronicleImagePanel({
  imageRefs,
  entities,
  onGenerateImage,
  isGenerating = false,
  styleLibrary,
  styleSelection: externalStyleSelection,
  onStyleSelectionChange,
  cultures,
  cultureIdentities,
  worldContext,
  chronicleTitle,
}: ChronicleImagePanelProps) {
  // Local style selection state (used if not controlled externally)
  const [localStyleSelection, setLocalStyleSelection] = useState({
    artisticStyleId: 'random',
    compositionStyleId: 'random',
    colorPaletteId: 'random',
  });

  // Use external or local style selection
  const styleSelection = externalStyleSelection || localStyleSelection;
  const handleStyleChange = useCallback((newSelection: typeof localStyleSelection) => {
    if (onStyleSelectionChange) {
      onStyleSelectionChange(newSelection);
    } else {
      setLocalStyleSelection(newSelection);
    }
  }, [onStyleSelectionChange]);

  // Local culture selection for visual identity
  const [selectedCultureId, setSelectedCultureId] = useState<string>('');

  // Derive primary culture from chronicle entities if not manually selected
  const derivedCultureId = useMemo(() => {
    if (selectedCultureId) return selectedCultureId;

    // Try to find dominant culture from entities involved in the chronicle
    const cultureCounts = new Map<string, number>();
    for (const entity of entities.values()) {
      if (entity.culture && entity.culture !== 'universal') {
        cultureCounts.set(entity.culture, (cultureCounts.get(entity.culture) || 0) + 1);
      }
    }

    let maxCulture = '';
    let maxCount = 0;
    for (const [culture, count] of cultureCounts) {
      if (count > maxCount) {
        maxCulture = culture;
        maxCount = count;
      }
    }

    return maxCulture;
  }, [selectedCultureId, entities]);

  // Separate entity refs and prompt requests
  const { entityRefs, promptRequests } = useMemo(() => {
    if (!imageRefs?.refs) return { entityRefs: [], promptRequests: [] };

    const entityRefs: EntityImageRef[] = [];
    const promptRequests: PromptRequestRef[] = [];

    for (const ref of imageRefs.refs) {
      if (ref.type === 'entity_ref') {
        entityRefs.push(ref as EntityImageRef);
      } else {
        promptRequests.push(ref as PromptRequestRef);
      }
    }

    return { entityRefs, promptRequests };
  }, [imageRefs]);

  // Count by status
  const stats = useMemo(() => {
    const pending = promptRequests.filter((r) => r.status === 'pending').length;
    const generating = promptRequests.filter((r) => r.status === 'generating').length;
    const complete = promptRequests.filter((r) => r.status === 'complete').length;
    const failed = promptRequests.filter((r) => r.status === 'failed').length;

    return { pending, generating, complete, failed };
  }, [promptRequests]);

  // Build style info for image generation
  const buildStyleInfo = useCallback((): StyleInfo => {
    const resolved = resolveStyleSelection({
      selection: styleSelection,
      entityCultureId: derivedCultureId,
      entityKind: DEFAULT_VISUAL_IDENTITY_KIND,
      cultures: cultures || [],
      styleLibrary: styleLibrary || { artisticStyles: [], compositionStyles: [], colorPalettes: [] },
    });

    // Get visual identity for the selected culture
    const cultureVisualIdentity = cultureIdentities?.visual?.[derivedCultureId] || {};
    const allowedKeys = cultureIdentities?.visualKeysByKind?.[DEFAULT_VISUAL_IDENTITY_KIND] ||
      Object.keys(cultureVisualIdentity); // Use all keys if no kind-specific filtering

    const filteredVisualIdentity: Record<string, string> = {};
    for (const key of allowedKeys) {
      if (cultureVisualIdentity[key]) {
        filteredVisualIdentity[key] = cultureVisualIdentity[key];
      }
    }

    return {
      artisticPromptFragment: resolved.artisticStyle?.promptFragment,
      compositionPromptFragment: resolved.compositionStyle?.promptFragment,
      colorPalettePromptFragment: resolved.colorPalette?.promptFragment,
      cultureKeywords: resolved.cultureKeywords,
      visualIdentity: Object.keys(filteredVisualIdentity).length > 0 ? filteredVisualIdentity : undefined,
    };
  }, [styleSelection, derivedCultureId, cultures, styleLibrary, cultureIdentities]);

  // Handle generating a single image
  const handleGenerateImage = useCallback((ref: PromptRequestRef) => {
    if (!onGenerateImage) return;

    const styleInfo = buildStyleInfo();

    // Look up involved entities and extract their visual identity
    const involvedEntities = ref.involvedEntityIds
      ?.map(id => {
        const entity = entities.get(id);
        if (!entity) return null;
        return {
          id: entity.id,
          name: entity.name,
          kind: entity.kind,
          visualThesis: entity.enrichment?.text?.visualThesis,
          visualTraits: entity.enrichment?.text?.visualTraits,
        };
      })
      .filter((e): e is NonNullable<typeof e> => e !== null);

    const prompt = buildChronicleImagePrompt(
      {
        sceneDescription: ref.sceneDescription,
        size: ref.size,
        chronicleTitle,
        culture: derivedCultureId,
        world: worldContext ? {
          name: worldContext.name || 'Unknown World',
          description: worldContext.description,
          tone: worldContext.tone,
        } : undefined,
        involvedEntities,
      },
      styleInfo
    );

    onGenerateImage(ref, prompt, styleInfo);
  }, [onGenerateImage, buildStyleInfo, chronicleTitle, derivedCultureId, worldContext, entities]);

  // No image refs yet
  if (!imageRefs) {
    return (
      <div
        style={{
          padding: '24px',
          textAlign: 'center',
          color: 'var(--text-muted)',
          background: 'var(--bg-secondary)',
          borderRadius: '8px',
          border: '1px solid var(--border-color)',
        }}
      >
        No image references generated yet. Use the &quot;Generate&quot; button above to create image placement suggestions.
      </div>
    );
  }

  const totalRefs = entityRefs.length + promptRequests.length;

  if (totalRefs === 0) {
    return (
      <div
        style={{
          padding: '24px',
          textAlign: 'center',
          color: 'var(--text-muted)',
          background: 'var(--bg-secondary)',
          borderRadius: '8px',
          border: '1px solid var(--border-color)',
        }}
      >
        No image references in this chronicle.
      </div>
    );
  }

  const hasSceneImages = promptRequests.length > 0;

  return (
    <div>
      {/* Header with stats */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px',
        }}
      >
        <div style={{ fontSize: '14px', fontWeight: 600 }}>
          Image References ({totalRefs})
        </div>
        <div style={{ display: 'flex', gap: '12px', fontSize: '11px' }}>
          <span style={{ color: 'var(--text-muted)' }}>
            Entity refs: {entityRefs.length}
          </span>
          <span style={{ color: 'var(--text-muted)' }}>
            Scenes: {promptRequests.length}
          </span>
          {stats.pending > 0 && (
            <span style={{ color: '#f59e0b' }}>
              Pending: {stats.pending}
            </span>
          )}
          {stats.complete > 0 && (
            <span style={{ color: '#10b981' }}>
              Complete: {stats.complete}
            </span>
          )}
        </div>
      </div>

      {/* Style Selection - show when there are scene images (for generation/regeneration) */}
      {hasSceneImages && (
        <div
          style={{
            marginBottom: '16px',
            padding: '12px',
            background: 'var(--bg-tertiary)',
            borderRadius: '6px',
            border: '1px solid var(--border-color)',
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: 500, marginBottom: '8px' }}>
            Generation Settings
          </div>

          {/* Style Selector - only show when styleLibrary is available */}
          {styleLibrary ? (
            <div style={{ marginBottom: '12px' }}>
              <StyleSelector
                styleLibrary={styleLibrary}
                selectedArtisticStyleId={styleSelection.artisticStyleId}
                selectedCompositionStyleId={styleSelection.compositionStyleId}
                selectedColorPaletteId={styleSelection.colorPaletteId}
                onArtisticStyleChange={(id: string) => handleStyleChange({ ...styleSelection, artisticStyleId: id })}
                onCompositionStyleChange={(id: string) => handleStyleChange({ ...styleSelection, compositionStyleId: id })}
                onColorPaletteChange={(id: string) => handleStyleChange({ ...styleSelection, colorPaletteId: id })}
                compact
              />
            </div>
          ) : (
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>
              Loading style options...
            </div>
          )}

          {/* Culture Selection */}
          {cultures && cultures.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Culture:</span>
              <select
                value={selectedCultureId}
                onChange={(e) => setSelectedCultureId(e.target.value)}
                className="illuminator-select"
                style={{ width: 'auto', minWidth: '140px' }}
              >
                <option value="">Auto-detect ({derivedCultureId || 'none'})</option>
                {cultures.map((culture) => (
                  <option key={culture.id} value={culture.id}>
                    {culture.name}
                  </option>
                ))}
              </select>
              {derivedCultureId && cultureIdentities?.visual?.[derivedCultureId] && (
                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                  ({Object.keys(cultureIdentities.visual[derivedCultureId]).length} visual identity keys)
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Entity Refs Section */}
      {entityRefs.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <div
            style={{
              fontSize: '12px',
              fontWeight: 500,
              color: 'var(--text-muted)',
              marginBottom: '8px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
          >
            Entity Images ({entityRefs.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {entityRefs.map((ref) => (
              <EntityImageRefCard
                key={ref.refId}
                imageRef={ref}
                entity={entities.get(ref.entityId)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Prompt Requests Section */}
      {promptRequests.length > 0 && (
        <div>
          <div
            style={{
              fontSize: '12px',
              fontWeight: 500,
              color: 'var(--text-muted)',
              marginBottom: '8px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
          >
            Scene Images ({promptRequests.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {promptRequests.map((ref) => (
              <PromptRequestCard
                key={ref.refId}
                imageRef={ref}
                onGenerate={() => handleGenerateImage(ref)}
                isGenerating={isGenerating}
                entities={entities}
              />
            ))}
          </div>
        </div>
      )}

      {/* Metadata footer */}
      <div
        style={{
          marginTop: '16px',
          padding: '8px 12px',
          background: 'var(--bg-tertiary)',
          borderRadius: '6px',
          fontSize: '10px',
          color: 'var(--text-muted)',
        }}
      >
        Generated: {new Date(imageRefs.generatedAt).toLocaleString()} • Model: {imageRefs.model}
      </div>
    </div>
  );
}
