/**
 * StyleSelector - Select artistic and composition styles for image generation
 *
 * Two dropdowns for style selection:
 * - Artistic style (oil painting, watercolor, digital art, etc.)
 * - Composition style (portrait, full body, establishing shot, etc.)
 *
 * Supports culture defaults - if "Use Culture Default" is selected,
 * the entity's culture default will be used at generation time.
 */

import { useMemo } from 'react';

const CULTURE_DEFAULT_ID = 'culture-default';

export default function StyleSelector({
  styleLibrary,
  selectedArtisticStyleId,
  selectedCompositionStyleId,
  onArtisticStyleChange,
  onCompositionStyleChange,
  entityKind,
  compact = false,
}) {
  const artisticStyles = styleLibrary?.artisticStyles || [];
  const compositionStyles = styleLibrary?.compositionStyles || [];

  // Filter composition styles based on entity kind
  const filteredCompositionStyles = useMemo(() => {
    if (!entityKind) {
      return compositionStyles;
    }
    return compositionStyles.filter(
      (s) => !s.suitableForKinds || s.suitableForKinds.length === 0 || s.suitableForKinds.includes(entityKind)
    );
  }, [compositionStyles, entityKind]);

  const selectedArtistic = artisticStyles.find((s) => s.id === selectedArtisticStyleId);
  const selectedComposition = compositionStyles.find((s) => s.id === selectedCompositionStyleId);

  if (compact) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          flexWrap: 'wrap',
        }}
      >
        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Style:</span>
        <select
          value={selectedArtisticStyleId || ''}
          onChange={(e) => onArtisticStyleChange(e.target.value || null)}
          className="illuminator-select"
          style={{ width: 'auto', minWidth: '120px' }}
          title={selectedArtistic?.description || 'Select artistic style'}
        >
          <option value="">No style</option>
          <option value={CULTURE_DEFAULT_ID}>Culture Default</option>
          {artisticStyles.map((style) => (
            <option key={style.id} value={style.id}>
              {style.name}
            </option>
          ))}
        </select>

        <select
          value={selectedCompositionStyleId || ''}
          onChange={(e) => onCompositionStyleChange(e.target.value || null)}
          className="illuminator-select"
          style={{ width: 'auto', minWidth: '120px' }}
          title={selectedComposition?.description || 'Select composition style'}
        >
          <option value="">No composition</option>
          <option value={CULTURE_DEFAULT_ID}>Culture Default</option>
          {filteredCompositionStyles.map((style) => (
            <option key={style.id} value={style.id}>
              {style.name}
            </option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '12px',
      }}
    >
      {/* Artistic Style */}
      <div>
        <label
          style={{
            display: 'block',
            fontSize: '12px',
            color: 'var(--text-muted)',
            marginBottom: '4px',
          }}
        >
          Artistic Style
        </label>
        <select
          value={selectedArtisticStyleId || ''}
          onChange={(e) => onArtisticStyleChange(e.target.value || null)}
          className="illuminator-select"
        >
          <option value="">No style override</option>
          <option value={CULTURE_DEFAULT_ID}>Use Culture Default</option>
          {artisticStyles.map((style) => (
            <option key={style.id} value={style.id}>
              {style.name}
            </option>
          ))}
        </select>
        {selectedArtistic && (
          <div
            style={{
              fontSize: '11px',
              color: 'var(--text-muted)',
              marginTop: '4px',
            }}
          >
            {selectedArtistic.description}
          </div>
        )}
      </div>

      {/* Composition Style */}
      <div>
        <label
          style={{
            display: 'block',
            fontSize: '12px',
            color: 'var(--text-muted)',
            marginBottom: '4px',
          }}
        >
          Composition Style{entityKind && ` (for ${entityKind})`}
        </label>
        <select
          value={selectedCompositionStyleId || ''}
          onChange={(e) => onCompositionStyleChange(e.target.value || null)}
          className="illuminator-select"
        >
          <option value="">No composition override</option>
          <option value={CULTURE_DEFAULT_ID}>Use Culture Default</option>
          {filteredCompositionStyles.map((style) => (
            <option key={style.id} value={style.id}>
              {style.name}
            </option>
          ))}
        </select>
        {selectedComposition && (
          <div
            style={{
              fontSize: '11px',
              color: 'var(--text-muted)',
              marginTop: '4px',
            }}
          >
            {selectedComposition.description}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Resolve style selection to actual style definitions
 * Handles culture defaults and fallbacks
 */
export function resolveStyleSelection({
  selection,
  entityCultureId,
  entityKind,
  cultures,
  styleLibrary,
}) {
  const result = {
    artisticStyle: null,
    compositionStyle: null,
    cultureKeywords: [],
  };

  if (!styleLibrary) return result;

  // Resolve artistic style
  if (selection.artisticStyleId === CULTURE_DEFAULT_ID) {
    // Look up culture default
    const culture = cultures?.find((c) => c.id === entityCultureId);
    if (culture?.defaultArtisticStyleId) {
      result.artisticStyle = styleLibrary.artisticStyles.find(
        (s) => s.id === culture.defaultArtisticStyleId
      );
    }
  } else if (selection.artisticStyleId) {
    result.artisticStyle = styleLibrary.artisticStyles.find(
      (s) => s.id === selection.artisticStyleId
    );
  }

  // Resolve composition style
  if (selection.compositionStyleId === CULTURE_DEFAULT_ID) {
    // Look up culture default for this entity kind
    const culture = cultures?.find((c) => c.id === entityCultureId);
    const defaultStyleId = culture?.defaultCompositionStyles?.[entityKind];
    if (defaultStyleId) {
      result.compositionStyle = styleLibrary.compositionStyles.find(
        (s) => s.id === defaultStyleId
      );
    }
  } else if (selection.compositionStyleId) {
    result.compositionStyle = styleLibrary.compositionStyles.find(
      (s) => s.id === selection.compositionStyleId
    );
  }

  // Get culture style keywords
  const culture = cultures?.find((c) => c.id === entityCultureId);
  if (culture?.styleKeywords?.length > 0) {
    result.cultureKeywords = culture.styleKeywords;
  }

  return result;
}

export { CULTURE_DEFAULT_ID };
