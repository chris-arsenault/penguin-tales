/**
 * ChronicleReviewPanel - Shared review/refinement UI for chronicles
 *
 * Renders the review screen for single-shot chronicle generation.
 */

import { useMemo, useState, useCallback, useEffect } from 'react';
import { diffWords } from 'diff';
import CohesionReportViewer from './CohesionReportViewer';
import ChronicleImagePanel from './ChronicleImagePanel';
import ImageModal from './ImageModal';
import { ExpandableSeedSection } from './ChronicleSeedViewer';
import HistorianMarginNotes from './HistorianMarginNotes';
import { useImageUrl } from '../hooks/useImageUrl';

// ============================================================================
// Cover Image Preview
// ============================================================================

function CoverImagePreview({ imageId, onImageClick }) {
  const { url, loading, error } = useImageUrl(imageId);

  if (!imageId) return null;

  if (loading) {
    return (
      <div style={{ marginTop: '8px', fontSize: '11px', color: 'var(--text-muted)' }}>
        Loading image...
      </div>
    );
  }

  if (error || !url) {
    return (
      <div style={{ marginTop: '8px', fontSize: '11px', color: '#ef4444' }}>
        Failed to load image{error ? `: ${error}` : ''}
      </div>
    );
  }

  return (
    <div style={{ marginTop: '10px' }}>
      <img
        src={url}
        alt="Cover image"
        onClick={onImageClick ? () => onImageClick(imageId, 'Cover Image') : undefined}
        style={{
          maxWidth: '100%',
          maxHeight: '300px',
          borderRadius: '8px',
          border: '1px solid var(--border-color)',
          objectFit: 'contain',
          cursor: onImageClick ? 'pointer' : undefined,
        }}
      />
    </div>
  );
}

// ============================================================================
// Cover Image Controls (shared between refinement and published views)
// ============================================================================

function CoverImageControls({
  item,
  onGenerateCoverImageScene,
  onGenerateCoverImage,
  onImageClick,
  isGenerating,
  labelWeight = 500,
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '13px', fontWeight: labelWeight }}>Cover Image</div>
        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
          Generate a montage-style cover image for this chronicle.
        </div>
        {!item.coverImage && (
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Not run yet
          </div>
        )}
        {item.coverImage && item.coverImage.status === 'pending' && (
          <div style={{ fontSize: '11px', color: '#f59e0b', marginTop: '4px' }}>
            Scene ready - click Generate Image to create
          </div>
        )}
        {item.coverImage && item.coverImage.status === 'generating' && (
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Generating image...
          </div>
        )}
        {item.coverImage && item.coverImage.status === 'complete' && (
          <div style={{ fontSize: '11px', color: '#10b981', marginTop: '4px' }}>
            Complete
          </div>
        )}
        {item.coverImage && item.coverImage.status === 'failed' && (
          <div style={{ fontSize: '11px', color: '#ef4444', marginTop: '4px' }}>
            Failed{item.coverImage.error ? `: ${item.coverImage.error}` : ''}
          </div>
        )}
        {item.coverImage?.sceneDescription && (
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '6px', fontStyle: 'italic', lineHeight: 1.4, maxWidth: '500px' }}>
            {item.coverImage.sceneDescription}
          </div>
        )}
        <CoverImagePreview imageId={item.coverImage?.generatedImageId} onImageClick={onImageClick} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignSelf: 'flex-start' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          {onGenerateCoverImageScene && (
            <button
              onClick={onGenerateCoverImageScene}
              disabled={isGenerating}
              style={{
                padding: '8px 14px',
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                color: 'var(--text-secondary)',
                cursor: isGenerating ? 'not-allowed' : 'pointer',
                opacity: isGenerating ? 0.6 : 1,
                fontSize: '12px',
                height: '32px',
                whiteSpace: 'nowrap',
              }}
            >
              {item.coverImage ? 'Regen Scene' : 'Gen Scene'}
            </button>
          )}
          {onGenerateCoverImage && item.coverImage && (item.coverImage.status === 'pending' || item.coverImage.status === 'complete' || item.coverImage.status === 'failed') && (
            <button
              onClick={onGenerateCoverImage}
              disabled={isGenerating}
              style={{
                padding: '8px 14px',
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                color: 'var(--text-secondary)',
                cursor: isGenerating ? 'not-allowed' : 'pointer',
                opacity: isGenerating ? 0.6 : 1,
                fontSize: '12px',
                height: '32px',
                whiteSpace: 'nowrap',
              }}
            >
              {item.coverImage.status === 'complete' ? 'Regen Image' : 'Gen Image'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Perspective Synthesis Viewer
// ============================================================================

function PerspectiveSynthesisViewer({ synthesis }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState('output'); // 'input' or 'output'

  if (!synthesis) return null;

  const formatCost = (cost) => `$${cost.toFixed(4)}`;
  const formatTimestamp = (ts) => new Date(ts).toLocaleString();

  const hasInputData = synthesis.coreTone || synthesis.inputFacts || synthesis.inputCulturalIdentities || synthesis.constellation;

  return (
    <div
      style={{
        marginBottom: '16px',
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-color)',
        borderRadius: '8px',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '12px 16px',
          background: 'var(--bg-tertiary)',
          borderBottom: isExpanded ? '1px solid var(--border-color)' : 'none',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          cursor: 'pointer',
        }}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
          {isExpanded ? '▼' : '▶'}
        </span>
        <span style={{ fontSize: '13px', fontWeight: 500 }}>
          Perspective Synthesis
        </span>
        <span
          style={{
            fontSize: '11px',
            color: 'var(--text-muted)',
            marginLeft: 'auto',
          }}
        >
          {synthesis.facets?.length || 0} facets • {synthesis.entityDirectives?.length || 0} directives • {synthesis.suggestedMotifs?.length || 0} motifs • {formatCost(synthesis.actualCost)}
        </span>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div style={{ padding: '16px' }}>
          {/* Tab selector */}
          {hasInputData && (
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              <button
                onClick={() => setActiveTab('output')}
                style={{
                  padding: '6px 14px',
                  fontSize: '12px',
                  fontWeight: activeTab === 'output' ? 600 : 400,
                  background: activeTab === 'output' ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                  color: activeTab === 'output' ? 'white' : 'var(--text-secondary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  cursor: 'pointer',
                }}
              >
                LLM Output
              </button>
              <button
                onClick={() => setActiveTab('input')}
                style={{
                  padding: '6px 14px',
                  fontSize: '12px',
                  fontWeight: activeTab === 'input' ? 600 : 400,
                  background: activeTab === 'input' ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                  color: activeTab === 'input' ? 'white' : 'var(--text-secondary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  cursor: 'pointer',
                }}
              >
                LLM Input
              </button>
            </div>
          )}

          {/* OUTPUT TAB */}
          {activeTab === 'output' && (
            <>
              {/* Constellation Summary */}
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-muted)', marginBottom: '4px' }}>
                  CONSTELLATION SUMMARY
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  {synthesis.constellationSummary}
                </div>
              </div>

              {/* Brief */}
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-muted)', marginBottom: '4px' }}>
                  PERSPECTIVE BRIEF
                </div>
                <div
                  style={{
                    fontSize: '12px',
                    lineHeight: 1.6,
                    color: 'var(--text-primary)',
                    padding: '12px',
                    background: 'var(--bg-tertiary)',
                    borderRadius: '6px',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {synthesis.brief}
                </div>
              </div>

              {/* Facets */}
              {synthesis.facets && synthesis.facets.length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-muted)', marginBottom: '8px' }}>
                    FACETED FACTS ({synthesis.facets.length})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {synthesis.facets.map((facet, i) => (
                      <div
                        key={i}
                        style={{
                          padding: '10px 12px',
                          background: 'var(--bg-tertiary)',
                          borderRadius: '6px',
                          borderLeft: '3px solid var(--accent-color)',
                        }}
                      >
                        <div
                          style={{
                            fontSize: '11px',
                            fontFamily: 'monospace',
                            color: 'var(--accent-color)',
                            marginBottom: '4px',
                          }}
                        >
                          {facet.factId}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                          {facet.interpretation}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Narrative Voice */}
              {synthesis.narrativeVoice && Object.keys(synthesis.narrativeVoice).length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-muted)', marginBottom: '8px' }}>
                    NARRATIVE VOICE
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {Object.entries(synthesis.narrativeVoice).map(([key, value]) => (
                      <div
                        key={key}
                        style={{
                          padding: '10px 12px',
                          background: 'var(--bg-tertiary)',
                          borderRadius: '6px',
                          borderLeft: '3px solid var(--accent-secondary, #8b5cf6)',
                        }}
                      >
                        <div
                          style={{
                            fontSize: '11px',
                            fontWeight: 600,
                            color: 'var(--accent-secondary, #8b5cf6)',
                            marginBottom: '4px',
                            textTransform: 'uppercase',
                          }}
                        >
                          {key}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                          {value}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Entity Directives */}
              {synthesis.entityDirectives && synthesis.entityDirectives.length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-muted)', marginBottom: '8px' }}>
                    ENTITY DIRECTIVES ({synthesis.entityDirectives.length})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {synthesis.entityDirectives.map((d, i) => (
                      <div
                        key={i}
                        style={{
                          padding: '10px 12px',
                          background: 'var(--bg-tertiary)',
                          borderRadius: '6px',
                          borderLeft: '3px solid var(--accent-tertiary, #f59e0b)',
                        }}
                      >
                        <div
                          style={{
                            fontSize: '11px',
                            fontWeight: 600,
                            color: 'var(--accent-tertiary, #f59e0b)',
                            marginBottom: '4px',
                          }}
                        >
                          {d.entityName}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                          {d.directive}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Suggested Motifs */}
              {synthesis.suggestedMotifs && synthesis.suggestedMotifs.length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-muted)', marginBottom: '8px' }}>
                    SUGGESTED MOTIFS
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {synthesis.suggestedMotifs.map((motif, i) => (
                      <span
                        key={i}
                        style={{
                          padding: '4px 10px',
                          background: 'var(--bg-tertiary)',
                          borderRadius: '12px',
                          fontSize: '12px',
                          color: 'var(--text-secondary)',
                          fontStyle: 'italic',
                        }}
                      >
                        "{motif}"
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* INPUT TAB */}
          {activeTab === 'input' && (
            <>
              {/* Core Tone */}
              {synthesis.coreTone && (
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-muted)', marginBottom: '4px' }}>
                    CORE TONE
                  </div>
                  <div
                    style={{
                      fontSize: '12px',
                      lineHeight: 1.6,
                      color: 'var(--text-primary)',
                      padding: '12px',
                      background: 'var(--bg-tertiary)',
                      borderRadius: '6px',
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {synthesis.coreTone}
                  </div>
                </div>
              )}

              {/* Constellation Analysis */}
              {synthesis.constellation && (
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-muted)', marginBottom: '8px' }}>
                    CONSTELLATION ANALYSIS
                  </div>
                  <div style={{ padding: '12px', background: 'var(--bg-tertiary)', borderRadius: '6px', fontSize: '12px' }}>
                    <div style={{ marginBottom: '8px' }}>
                      <strong>Cultures:</strong> {Object.entries(synthesis.constellation.cultures || {}).map(([k, v]) => `${k}(${v})`).join(', ') || 'none'}
                    </div>
                    <div style={{ marginBottom: '8px' }}>
                      <strong>Entity Kinds:</strong> {Object.entries(synthesis.constellation.kinds || {}).map(([k, v]) => `${k}(${v})`).join(', ') || 'none'}
                    </div>
                    <div style={{ marginBottom: '8px' }}>
                      <strong>Prominent Tags:</strong> {synthesis.constellation.prominentTags?.join(', ') || 'none'}
                    </div>
                    <div style={{ marginBottom: '8px' }}>
                      <strong>Culture Balance:</strong> {synthesis.constellation.cultureBalance}
                      {synthesis.constellation.dominantCulture && ` (dominant: ${synthesis.constellation.dominantCulture})`}
                    </div>
                    <div>
                      <strong>Relationships:</strong> {
                        synthesis.constellation.relationshipKinds && Object.keys(synthesis.constellation.relationshipKinds).length > 0
                          ? Object.entries(synthesis.constellation.relationshipKinds).map(([k, v]) => `${k}(${v})`).join(', ')
                          : 'none'
                      }
                    </div>
                  </div>
                </div>
              )}

              {/* Input Entities */}
              {synthesis.inputEntities && synthesis.inputEntities.length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-muted)', marginBottom: '8px' }}>
                    ENTITIES ({synthesis.inputEntities.length})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {synthesis.inputEntities.map((entity, i) => (
                      <div
                        key={i}
                        style={{
                          padding: '8px 12px',
                          background: 'var(--bg-tertiary)',
                          borderRadius: '6px',
                          fontSize: '12px',
                        }}
                      >
                        <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                          {entity.name} <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>({entity.kind}{entity.culture ? `, ${entity.culture}` : ''})</span>
                        </div>
                        {entity.summary && (
                          <div style={{ color: 'var(--text-secondary)', marginTop: '4px', fontSize: '11px' }}>
                            {entity.summary}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Input Facts */}
              {synthesis.inputFacts && synthesis.inputFacts.length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-muted)', marginBottom: '8px' }}>
                    INPUT FACTS ({synthesis.inputFacts.length})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {synthesis.inputFacts.map((fact, i) => (
                      <div
                        key={i}
                        style={{
                          padding: '8px 12px',
                          background: 'var(--bg-tertiary)',
                          borderRadius: '6px',
                          fontSize: '12px',
                          borderLeft: `3px solid ${fact.type === 'generation_constraint' ? '#f59e0b' : 'var(--accent-color)'}`,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                          <span style={{ fontFamily: 'monospace', fontSize: '11px', color: 'var(--text-muted)' }}>
                            {fact.id}
                          </span>
                          {fact.type === 'generation_constraint' && (
                            <span style={{ padding: '2px 6px', background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', fontSize: '10px', borderRadius: '4px' }}>
                              constraint
                            </span>
                          )}
                        </div>
                        <div style={{ color: 'var(--text-secondary)' }}>
                          {fact.text}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Cultural Identities */}
              {synthesis.inputCulturalIdentities && Object.keys(synthesis.inputCulturalIdentities).length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-muted)', marginBottom: '8px' }}>
                    CULTURAL IDENTITIES ({Object.keys(synthesis.inputCulturalIdentities).length} cultures)
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {Object.entries(synthesis.inputCulturalIdentities).map(([cultureId, traits]) => (
                      <div
                        key={cultureId}
                        style={{
                          padding: '10px 12px',
                          background: 'var(--bg-tertiary)',
                          borderRadius: '6px',
                        }}
                      >
                        <div style={{ fontWeight: 500, fontSize: '12px', marginBottom: '6px', color: 'var(--text-primary)' }}>
                          {cultureId}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          {Object.entries(traits).map(([key, value]) => (
                            <div key={key}>
                              <span style={{ color: 'var(--text-muted)' }}>{key}:</span> {value}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Metadata */}
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', gap: '16px', flexWrap: 'wrap', borderTop: '1px solid var(--border-color)', paddingTop: '12px', marginTop: '8px' }}>
            <span>Model: {synthesis.model}</span>
            <span>Tokens: {synthesis.inputTokens} in / {synthesis.outputTokens} out</span>
            <span>Generated: {formatTimestamp(synthesis.generatedAt)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Assembled Content Viewer
// ============================================================================

function AssembledContentViewer({ content, wordCount, onCopy, compareContent, compareLabel }) {
  const diffParts = useMemo(() => {
    if (!compareContent) return null;
    return diffWords(compareContent, content);
  }, [content, compareContent]);

  return (
    <div
      style={{
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-color)',
        borderRadius: '8px',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: '12px 16px',
          background: 'var(--bg-tertiary)',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
          {wordCount.toLocaleString()} words
          {diffParts && (
            <span style={{ marginLeft: '8px' }}>
              — diff vs {compareLabel}
              <span style={{ marginLeft: '6px', color: 'rgba(34, 197, 94, 0.8)' }}>
                +{diffParts.filter(p => p.added).reduce((n, p) => n + p.value.split(/\s+/).filter(Boolean).length, 0)}
              </span>
              <span style={{ marginLeft: '4px', color: 'rgba(239, 68, 68, 0.8)' }}>
                -{diffParts.filter(p => p.removed).reduce((n, p) => n + p.value.split(/\s+/).filter(Boolean).length, 0)}
              </span>
            </span>
          )}
        </span>
        <button
          onClick={onCopy}
          style={{
            padding: '4px 12px',
            fontSize: '11px',
            background: 'var(--bg-primary)',
            border: '1px solid var(--border-color)',
            borderRadius: '4px',
            cursor: 'pointer',
            color: 'var(--text-secondary)',
          }}
        >
          Copy
        </button>
      </div>
      <div
        style={{
          padding: '20px',
          maxHeight: '500px',
          overflowY: 'auto',
          fontSize: '14px',
          lineHeight: 1.7,
          whiteSpace: 'pre-wrap',
          color: 'var(--text-primary)',
        }}
      >
        {diffParts ? (
          diffParts.map((part, i) => {
            if (part.added) {
              return (
                <span key={i} style={{
                  background: 'rgba(34, 197, 94, 0.2)',
                  color: 'var(--text-primary)',
                  borderRadius: '2px',
                  padding: '0 1px',
                }}>
                  {part.value}
                </span>
              );
            }
            if (part.removed) {
              return (
                <span key={i} style={{
                  background: 'rgba(239, 68, 68, 0.2)',
                  color: 'var(--text-secondary)',
                  borderRadius: '2px',
                  padding: '0 1px',
                  textDecoration: 'line-through',
                }}>
                  {part.value}
                </span>
              );
            }
            return <span key={i}>{part.value}</span>;
          })
        ) : (
          content
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Refinement Options Panel (for V2 without validation)
// ============================================================================

function RefinementOptionsPanel({
  item,
  onValidate,
  onGenerateSummary,
  onGenerateTitle,
  onGenerateImageRefs,
  onGenerateCoverImageScene,
  onGenerateCoverImage,
  onImageClick,
  imageSize,
  imageQuality,
  imageModel,
  onGenerateChronicleImage,
  onResetChronicleImage,
  onUpdateChronicleAnchorText,
  onUpdateChronicleImageSize,
  onUpdateChronicleImageJustification,
  onRegenerateDescription,
  isGenerating,
  refinements,
  entityMap,
  styleLibrary,
  styleSelection,
  cultures,
  cultureIdentities,
  worldContext,
  summaryIndicator,
  imageRefsIndicator,
  imageRefsTargetContent,
  imageGenSettings,
  onOpenImageSettings,
}) {
  const formatTimestamp = (timestamp) => new Date(timestamp).toLocaleString();
  const summaryState = refinements?.summary || {};
  const titleState = refinements?.title || {};
  const imageRefsState = refinements?.imageRefs || {};

  return (
    <div
      style={{
        marginBottom: '24px',
        padding: '16px',
        background: 'var(--bg-secondary)',
        borderRadius: '8px',
        border: '1px solid var(--border-color)',
      }}
    >
      <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>
        Refinement Options
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {/* Summary */}
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 500 }}>Summary</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Generate a short summary for chronicle listings.
            </div>
            {summaryState.generatedAt && (
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Done - {formatTimestamp(summaryState.generatedAt)}
                {summaryState.model ? ` - ${summaryState.model}` : ''}
              </div>
            )}
            {summaryIndicator && summaryState.generatedAt && (
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                {summaryIndicator}
              </div>
            )}
            {!summaryState.generatedAt && !summaryState.running && (
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Not run yet
              </div>
            )}
            {summaryState.running && (
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Running...
              </div>
            )}
          </div>
          {onGenerateSummary && (
            <button
              onClick={onGenerateSummary}
              disabled={isGenerating || summaryState.running}
              style={{
                padding: '8px 14px',
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                color: 'var(--text-secondary)',
                cursor: isGenerating || summaryState.running ? 'not-allowed' : 'pointer',
                opacity: isGenerating || summaryState.running ? 0.6 : 1,
                fontSize: '12px',
                height: '32px',
                alignSelf: 'center',
              }}
            >
              {summaryState.generatedAt ? 'Regenerate' : 'Generate'}
            </button>
          )}
        </div>

        {/* Title */}
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '13px', fontWeight: 500 }}>Title</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Generate an evocative title using two-pass synthesis.
            </div>
            {titleState.generatedAt && (
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Done - {formatTimestamp(titleState.generatedAt)}
                {titleState.model ? ` - ${titleState.model}` : ''}
              </div>
            )}
            {item.titleCandidates?.length > 0 && (
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', lineHeight: 1.5 }}>
                <span style={{ color: 'var(--text-secondary)' }}>
                  ◆ {item.title}
                </span>
                <br />
                {item.titleCandidates.map((c, i) => (
                  <span key={i}>
                    <span style={{ opacity: 0.6 }}>◇</span> {c}
                    {i < item.titleCandidates.length - 1 ? <br /> : null}
                  </span>
                ))}
              </div>
            )}
            {!titleState.generatedAt && !titleState.running && (
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Not run yet
              </div>
            )}
            {titleState.running && (
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Running...
              </div>
            )}
          </div>
          {onGenerateTitle && (
            <button
              onClick={onGenerateTitle}
              disabled={isGenerating || titleState.running}
              style={{
                padding: '8px 14px',
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                color: 'var(--text-secondary)',
                cursor: isGenerating || titleState.running ? 'not-allowed' : 'pointer',
                opacity: isGenerating || titleState.running ? 0.6 : 1,
                fontSize: '12px',
                height: '32px',
                alignSelf: 'center',
              }}
            >
              {titleState.generatedAt ? 'Regenerate' : 'Generate'}
            </button>
          )}
        </div>

        {/* Cover Image */}
        <CoverImageControls
          item={item}
          onGenerateCoverImageScene={onGenerateCoverImageScene}
          onGenerateCoverImage={onGenerateCoverImage}
          isGenerating={isGenerating}
          onImageClick={onImageClick}
        />

        {/* Image Refs */}
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '13px', fontWeight: 500 }}>Add Image Refs</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Generate image placement suggestions for this chronicle.
            </div>
            {imageRefsState.generatedAt && (
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Done - {formatTimestamp(imageRefsState.generatedAt)}
                {imageRefsState.model ? ` - ${imageRefsState.model}` : ''}
              </div>
            )}
            {imageRefsIndicator && imageRefsState.generatedAt && (
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                {imageRefsIndicator}
              </div>
            )}
            {!imageRefsState.generatedAt && !imageRefsState.running && (
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Not run yet
              </div>
            )}
            {imageRefsState.running && (
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Running...
              </div>
            )}
          </div>
          {onGenerateImageRefs && (
            <button
              onClick={onGenerateImageRefs}
              disabled={isGenerating || imageRefsState.running}
              style={{
                padding: '8px 14px',
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                color: 'var(--text-secondary)',
                cursor: isGenerating || imageRefsState.running ? 'not-allowed' : 'pointer',
                opacity: isGenerating || imageRefsState.running ? 0.6 : 1,
                fontSize: '12px',
                height: '32px',
                alignSelf: 'center',
              }}
            >
              {imageRefsState.generatedAt ? 'Regenerate' : 'Generate'}
            </button>
          )}
        </div>

        {/* Image Panel when refs are available */}
        {item.imageRefs && entityMap && (
          <div style={{ marginTop: '4px' }}>
            <ChronicleImagePanel
              imageRefs={item.imageRefs}
              entities={entityMap}
              onGenerateImage={onGenerateChronicleImage}
              onResetImage={onResetChronicleImage}
              onRegenerateDescription={onRegenerateDescription}
              onUpdateAnchorText={onUpdateChronicleAnchorText}
              onUpdateSize={onUpdateChronicleImageSize}
              onUpdateJustification={onUpdateChronicleImageJustification}
              chronicleText={imageRefsTargetContent || item.assembledContent}
              isGenerating={isGenerating}
              styleLibrary={styleLibrary}
              styleSelection={styleSelection}
              cultures={cultures}
              cultureIdentities={cultureIdentities}
              worldContext={worldContext}
              chronicleTitle={item.name}
              imageSize={imageSize}
              imageQuality={imageQuality}
              imageModel={imageModel}
              imageGenSettings={imageGenSettings}
              onOpenImageSettings={onOpenImageSettings}
            />
          </div>
        )}

        {/* Validate (optional quality check — last in refinements) */}
        {onValidate && (
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 500 }}>Validate</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Run quality validation to check narrative coherence.
              </div>
              {item.cohesionReport && (
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Done - Score: {item.cohesionReport.overallScore}/100
                </div>
              )}
            </div>
            <button
              onClick={onValidate}
              disabled={isGenerating}
              style={{
                padding: '8px 14px',
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                color: 'var(--text-secondary)',
                cursor: isGenerating ? 'not-allowed' : 'pointer',
                opacity: isGenerating ? 0.6 : 1,
                fontSize: '12px',
                height: '32px',
                alignSelf: 'center',
              }}
            >
              {item.cohesionReport ? 'Revalidate' : 'Validate'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Temporal Context Editor (post-publish)
// ============================================================================

function TemporalContextEditor({
  item,
  eras,
  onUpdateTemporalContext,
  isGenerating,
}) {
  const availableEras = useMemo(() => {
    if (eras && eras.length > 0) return eras;
    return item.temporalContext?.allEras || [];
  }, [eras, item.temporalContext?.allEras]);

  const [selectedEraId, setSelectedEraId] = useState(
    item.temporalContext?.focalEra?.id || availableEras[0]?.id || ''
  );

  useEffect(() => {
    setSelectedEraId(item.temporalContext?.focalEra?.id || availableEras[0]?.id || '');
  }, [item.temporalContext?.focalEra?.id, availableEras]);

  const focalEra = item.temporalContext?.focalEra;
  const tickRange = item.temporalContext?.chronicleTickRange;

  return (
    <div
      style={{
        marginTop: '20px',
        padding: '16px',
        background: 'var(--bg-secondary)',
        borderRadius: '8px',
        border: '1px solid var(--border-color)',
      }}
    >
      <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>
        Temporal Context
      </div>
      {availableEras.length === 0 ? (
        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
          No eras available for this world.
        </div>
      ) : (
        <>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '12px',
              alignItems: 'center',
            }}
          >
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Focal Era
            </div>
            <select
              value={selectedEraId}
              onChange={(event) => setSelectedEraId(event.target.value)}
              style={{
                padding: '6px 10px',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-primary)',
                color: 'var(--text-primary)',
                fontSize: '12px',
                minWidth: '200px',
              }}
            >
              {availableEras.map((era) => (
                <option key={era.id} value={era.id}>
                  {era.name}
                </option>
              ))}
            </select>
            <button
              onClick={() => onUpdateTemporalContext?.(selectedEraId)}
              disabled={!selectedEraId || isGenerating}
              style={{
                padding: '6px 12px',
                fontSize: '12px',
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                color: 'var(--text-secondary)',
                cursor: !selectedEraId || isGenerating ? 'not-allowed' : 'pointer',
                opacity: !selectedEraId || isGenerating ? 0.6 : 1,
              }}
            >
              Update Era
            </button>
          </div>
          <div style={{ marginTop: '10px', fontSize: '12px', color: 'var(--text-secondary)' }}>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Current:</span>{' '}
              {focalEra?.name || 'Not set'}
            </div>
            {focalEra?.summary && (
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Era Summary:</span>{' '}
                {focalEra.summary}
              </div>
            )}
            {item.temporalContext?.temporalDescription && (
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Temporal Scope:</span>{' '}
                {item.temporalContext.temporalDescription}
              </div>
            )}
            {tickRange && (
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Tick Range:</span>{' '}
                {tickRange[0]}–{tickRange[1]}
              </div>
            )}
            {typeof item.temporalContext?.isMultiEra === 'boolean' && (
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Multi-era:</span>{' '}
                {item.temporalContext.isMultiEra ? 'Yes' : 'No'}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function TemperatureRegenerationControl({ item, onRegenerateWithTemperature, isGenerating }) {
  const baseTemperature = typeof item.generationTemperature === 'number'
    ? item.generationTemperature
    : (item.narrativeStyle?.temperature ?? 0.7);
  const [temperature, setTemperature] = useState(baseTemperature);

  useEffect(() => {
    setTemperature(baseTemperature);
  }, [baseTemperature, item.chronicleId]);

  const hasPrompts = Boolean(item.generationSystemPrompt && item.generationUserPrompt);
  const disabled = isGenerating || !hasPrompts || !onRegenerateWithTemperature;

  const clamp = (value) => Math.min(1, Math.max(0, value));
  const handleChange = (value) => setTemperature(clamp(value));

  return (
    <div
      style={{
        marginBottom: '16px',
        padding: '12px 16px',
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-color)',
        borderRadius: '8px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
        <div style={{ fontSize: '13px', fontWeight: 500 }}>
          Temperature Regeneration
          <span style={{ marginLeft: '8px', color: 'var(--text-muted)', fontSize: '12px' }}>
            (0–1)
          </span>
        </div>
        <button
          onClick={() => onRegenerateWithTemperature?.(temperature)}
          disabled={disabled}
          style={{
            padding: '8px 14px',
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--border-color)',
            borderRadius: '6px',
            color: 'var(--text-secondary)',
            cursor: disabled ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.6 : 1,
            fontSize: '12px',
          }}
        >
          Regenerate with temperature
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '10px', flexWrap: 'wrap' }}>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={temperature}
          onChange={(e) => handleChange(parseFloat(e.target.value))}
          disabled={disabled}
          style={{ flex: 1, minWidth: '160px' }}
        />
        <input
          type="number"
          min="0"
          max="1"
          step="0.01"
          value={temperature}
          onChange={(e) => handleChange(parseFloat(e.target.value || '0'))}
          disabled={disabled}
          style={{
            width: '72px',
            padding: '6px 8px',
            borderRadius: '6px',
            border: '1px solid var(--border-color)',
            background: 'var(--bg-tertiary)',
            color: 'var(--text-primary)',
            fontSize: '12px',
          }}
        />
        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
          Current: {temperature.toFixed(2)}
        </span>
      </div>

      {!hasPrompts && (
        <div style={{ marginTop: '8px', fontSize: '11px', color: 'var(--text-muted)' }}>
          Stored prompts unavailable for this chronicle (legacy generation). Temperature regen is disabled.
        </div>
      )}
    </div>
  );
}

function ChronicleVersionSelector({
  versions,
  selectedVersionId,
  activeVersionId,
  compareToVersionId,
  onSelectVersion,
  onSelectCompareVersion,
  onSetActiveVersion,
  disabled,
}) {
  const isActive = selectedVersionId === activeVersionId;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
      <select
        value={selectedVersionId}
        onChange={(e) => onSelectVersion(e.target.value)}
        disabled={disabled}
        className="illuminator-select"
        style={{ width: 'auto', minWidth: '240px', fontSize: '12px', padding: '4px 6px' }}
      >
        {versions.map((version) => (
          <option key={version.id} value={version.id}>{version.label}</option>
        ))}
      </select>
      <select
        value={compareToVersionId}
        onChange={(e) => onSelectCompareVersion(e.target.value)}
        disabled={disabled}
        className="illuminator-select"
        style={{ width: 'auto', minWidth: '160px', fontSize: '12px', padding: '4px 6px' }}
        title="Select a version to diff against"
      >
        <option value="">Compare to...</option>
        {versions.filter(v => v.id !== selectedVersionId).map((version) => (
          <option key={version.id} value={version.id}>{version.shortLabel || version.label}</option>
        ))}
      </select>
      {isActive ? (
        <span
          style={{
            fontSize: '11px',
            padding: '2px 8px',
            background: 'rgba(16, 185, 129, 0.15)',
            color: '#10b981',
            borderRadius: '999px',
            fontWeight: 500,
          }}
        >
          Active
        </span>
      ) : (
        <button
          onClick={() => onSetActiveVersion?.(selectedVersionId)}
          disabled={disabled || !onSetActiveVersion}
          style={{
            padding: '6px 12px',
            fontSize: '11px',
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--border-color)',
            borderRadius: '6px',
            color: 'var(--text-secondary)',
            cursor: disabled || !onSetActiveVersion ? 'not-allowed' : 'pointer',
            opacity: disabled || !onSetActiveVersion ? 0.6 : 1,
          }}
        >
          Make Active
        </button>
      )}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function ChronicleReviewPanel({
  // Chronicle data
  item,

  // Actions
  onContinueToValidation,
  onValidate,
  onAddImages,
  onAccept,
  onRegenerate,
  onRegenerateWithTemperature,
  onCompareVersions,
  onCombineVersions,
  onCorrectSuggestions,
  onGenerateSummary,
  onGenerateTitle,
  onAcceptPendingTitle,
  onRejectPendingTitle,
  onGenerateImageRefs,
  onRevalidate,
  onGenerateChronicleImage,
  onResetChronicleImage,
  onRegenerateDescription,
  onUpdateChronicleAnchorText,
  onUpdateChronicleTemporalContext,
  onUpdateChronicleActiveVersion,
  onUpdateCombineInstructions,
  onUnpublish,

  // Cover image
  onGenerateCoverImageScene,
  onGenerateCoverImage,
  styleSelection,
  imageSize,
  imageQuality,
  imageModel,
  imageGenSettings,
  onOpenImageSettings,

  // Image layout edits
  onUpdateChronicleImageSize,
  onUpdateChronicleImageJustification,

  // Export
  onExport,

  // Lore backport
  onBackportLore,

  // Historian review
  onHistorianReview,
  isHistorianActive,

  // State
  isGenerating,
  refinements,

  // Data for refinements
  entities,
  styleLibrary,
  cultures,
  entityGuidance,
  cultureIdentities,
  worldContext,
  eras,
}) {
  // Build entity map for ChronicleImagePanel (expects Map, not array)
  const entityMap = useMemo(() => {
    if (!entities) return new Map();
    return new Map(entities.map((e) => [e.id, e]));
  }, [entities]);

  // Combine instructions editing state
  const [editingCombineInstructions, setEditingCombineInstructions] = useState(false);
  const [combineInstructionsDraft, setCombineInstructionsDraft] = useState('');

  // Title regeneration modal state (for published chronicles)
  const [showTitleAcceptModal, setShowTitleAcceptModal] = useState(false);

  const handleGenerateTitleWithModal = useCallback(() => {
    if (!onGenerateTitle) return;
    setShowTitleAcceptModal(true);
    onGenerateTitle();
  }, [onGenerateTitle]);

  const handleAcceptTitle = useCallback(async () => {
    if (onAcceptPendingTitle) await onAcceptPendingTitle();
    setShowTitleAcceptModal(false);
  }, [onAcceptPendingTitle]);

  const handleRejectTitle = useCallback(async () => {
    if (onRejectPendingTitle) await onRejectPendingTitle();
    setShowTitleAcceptModal(false);
  }, [onRejectPendingTitle]);

  // Image modal state for full-size viewing
  const [imageModal, setImageModal] = useState({ open: false, imageId: '', title: '' });
  const handleImageClick = useCallback((imageId, title) => {
    setImageModal({ open: true, imageId, title });
  }, []);

  const renderImageModal = () => (
    <ImageModal
      isOpen={imageModal.open}
      imageId={imageModal.imageId}
      title={imageModal.title}
      onClose={() => setImageModal({ open: false, imageId: '', title: '' })}
    />
  );

  const titleRunning = refinements?.title?.running;
  const renderTitleAcceptModal = () => {
    if (!showTitleAcceptModal) return null;
    const hasPending = !!item?.pendingTitle;
    return (
      <div
        style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0, 0, 0, 0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}
        onClick={() => { if (hasPending) handleRejectTitle(); }}
      >
        <div
          style={{
            background: 'var(--bg-primary)',
            borderRadius: '12px',
            padding: '24px',
            maxWidth: '480px',
            width: '90%',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {!hasPending ? (
            <>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '18px' }}>
                Generating Title...
              </h3>
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '4px' }}>Current</div>
                <div style={{ fontSize: '15px', fontWeight: 500 }}>{item.title}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '13px' }}>
                <span style={{ display: 'inline-block', width: '14px', height: '14px', border: '2px solid var(--text-muted)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                Two-pass title synthesis in progress...
              </div>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </>
          ) : hasPending ? (
            <>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '18px' }}>
                Accept New Title?
              </h3>
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '4px' }}>Current</div>
                <div style={{ fontSize: '15px', fontWeight: 500 }}>{item.title}</div>
              </div>
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '4px' }}>New</div>
                <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>{item.pendingTitle}</div>
              </div>
              {item.pendingTitleCandidates?.length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Candidates considered</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                    {item.pendingTitleCandidates.map((c, i) => (
                      <div key={i}>
                        <span style={{ opacity: 0.5 }}>&#x25C7;</span> {c}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button
                  onClick={handleRejectTitle}
                  style={{
                    padding: '8px 16px',
                    fontSize: '13px',
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    color: 'var(--text-secondary)',
                  }}
                >
                  Keep Current
                </button>
                <button
                  onClick={handleAcceptTitle}
                  style={{
                    padding: '8px 16px',
                    fontSize: '13px',
                    background: '#2563eb',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    color: 'white',
                  }}
                >
                  Accept New
                </button>
              </div>
            </>
          ) : null}
        </div>
      </div>
    );
  };

  if (!item) return null;

  const wordCount = (content) => content?.split(/\s+/).filter(Boolean).length || 0;
  const copyToClipboard = (content) => navigator.clipboard.writeText(content);

  const currentVersionId = `current_${item.assembledAt ?? item.createdAt}`;
  const activeVersionId = item.activeVersionId || currentVersionId;

  const versions = useMemo(() => {
    const history = (item.generationHistory || []).map((version, index) => {
      const tempLabel = typeof version.temperature === 'number' ? version.temperature.toFixed(2) : 'default';
      return {
        id: version.versionId,
        content: version.content,
        wordCount: version.wordCount,
        shortLabel: `V${index + 1}`,
        label: `Version ${index + 1} • ${new Date(version.generatedAt).toLocaleString()} • temp ${tempLabel}`,
      };
    });

    const currentTempLabel = typeof item.generationTemperature === 'number'
      ? item.generationTemperature.toFixed(2)
      : 'default';

    history.push({
      id: currentVersionId,
      content: item.assembledContent,
      wordCount: wordCount(item.assembledContent),
      shortLabel: 'Current',
      label: `Current • ${new Date(item.assembledAt ?? item.createdAt).toLocaleString()} • temp ${currentTempLabel}`,
    });

    return history;
  }, [
    item.generationHistory,
    item.assembledContent,
    item.assembledAt,
    item.createdAt,
    item.generationTemperature,
    wordCount,
  ]);

  const [selectedVersionId, setSelectedVersionId] = useState(activeVersionId);
  const [compareToVersionId, setCompareToVersionId] = useState('');

  useEffect(() => {
    setSelectedVersionId(activeVersionId);
    setCompareToVersionId('');
  }, [activeVersionId, item.chronicleId]);

  const selectedVersion = useMemo(
    () => versions.find((version) => version.id === selectedVersionId) || versions[versions.length - 1],
    [versions, selectedVersionId]
  );

  const compareToVersion = useMemo(
    () => compareToVersionId ? versions.find((version) => version.id === compareToVersionId) : null,
    [versions, compareToVersionId]
  );

  const versionLabelMap = useMemo(() => {
    const map = new Map();
    for (const version of versions) {
      map.set(version.id, version.shortLabel);
    }
    return map;
  }, [versions]);

  const versionContentMap = useMemo(() => {
    const map = new Map();
    for (const version of versions) {
      map.set(version.id, version.content);
    }
    return map;
  }, [versions]);

  const getVersionLabel = (versionId) => versionLabelMap.get(versionId) || 'Unknown';

  const formatTargetIndicator = (targetVersionId) => {
    if (!targetVersionId) return null;
    const targetLabel = getVersionLabel(targetVersionId);
    const activeLabel = getVersionLabel(activeVersionId);
    if (targetVersionId === activeVersionId) return null;
    return `Targets ${targetLabel} • Active ${activeLabel}`;
  };

  const summaryIndicator = formatTargetIndicator(item.summaryTargetVersionId);
  const imageRefsIndicator = formatTargetIndicator(item.imageRefsTargetVersionId);
  const imageRefsTargetContent = versionContentMap.get(item.imageRefsTargetVersionId || activeVersionId) || item.assembledContent;

  const hasMultipleVersions = versions.length >= 2;
  const compareRunning = refinements?.compare?.running || false;
  const combineRunning = refinements?.combine?.running || false;

  // Build seed data from item for display
  const seedData = {
    narrativeStyleId: item.narrativeStyleId || '',
    narrativeStyleName: item.narrativeStyle?.name || styleLibrary?.narrativeStyles?.find(s => s.id === item.narrativeStyleId)?.name,
    entrypointId: item.entrypointId,
    entrypointName: item.entrypointId
      ? entities?.find(e => e.id === item.entrypointId)?.name
      : undefined,
    roleAssignments: item.roleAssignments || [],
    selectedEventIds: item.selectedEventIds || [],
    selectedRelationshipIds: item.selectedRelationshipIds || [],
  };

  // -------------------------------------------------------------------------
  // Assembly Ready - Full review experience
  // -------------------------------------------------------------------------
  if (item.status === 'assembly_ready' && item.assembledContent) {
    return (
      <div style={{ maxWidth: '900px' }}>
        {/* 1. Content + Versions — READ FIRST */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
            <h3 style={{ margin: 0, fontSize: '16px' }}>Content</h3>
            <ChronicleVersionSelector
              versions={versions}
              selectedVersionId={selectedVersionId}
              activeVersionId={activeVersionId}
              compareToVersionId={compareToVersionId}
              onSelectVersion={(id) => {
                setSelectedVersionId(id);
                if (id === compareToVersionId) setCompareToVersionId('');
              }}
              onSelectCompareVersion={setCompareToVersionId}
              onSetActiveVersion={onUpdateChronicleActiveVersion}
              disabled={isGenerating}
            />
          </div>
          <AssembledContentViewer
            content={selectedVersion?.content || item.assembledContent}
            wordCount={selectedVersion?.wordCount ?? wordCount(item.assembledContent)}
            onCopy={() => copyToClipboard(selectedVersion?.content || item.assembledContent)}
            compareContent={compareToVersion?.content}
            compareLabel={compareToVersion?.shortLabel}
          />
        </div>

        {/* 2. Primary Actions Bar — DECIDE */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: '24px',
            marginBottom: '24px',
            padding: '24px',
            background: 'var(--bg-secondary)',
            borderRadius: '8px',
            border: '1px solid var(--border-color)',
          }}
        >
          <div>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '18px' }}>Chronicle Review</h3>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              {(selectedVersion?.wordCount ?? wordCount(item.assembledContent)).toLocaleString()} words
              {item.selectionSummary && (
                <span>
                  {' '}• {item.selectionSummary.entityCount} entities, {item.selectionSummary.eventCount} events
                </span>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={onRegenerate}
              disabled={isGenerating}
              style={{
                padding: '10px 20px',
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                color: 'var(--text-secondary)',
                cursor: isGenerating ? 'not-allowed' : 'pointer',
                opacity: isGenerating ? 0.6 : 1,
                fontSize: '13px',
              }}
            >
              ⟳ Regenerate
            </button>
            {onExport && (
              <button
                onClick={onExport}
                style={{
                  padding: '10px 20px',
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontSize: '13px',
                }}
              >
                Export
              </button>
            )}
            <button
              onClick={onAccept}
              disabled={isGenerating}
              style={{
                padding: '10px 20px',
                background: 'var(--accent-primary)',
                border: 'none',
                borderRadius: '6px',
                color: 'white',
                cursor: isGenerating ? 'not-allowed' : 'pointer',
                opacity: isGenerating ? 0.6 : 1,
                fontSize: '13px',
                fontWeight: 500,
              }}
            >
              Accept Chronicle ✓
            </button>
          </div>
        </div>

        {/* 3. Version Management — ITERATE */}
        <TemperatureRegenerationControl
          item={item}
          onRegenerateWithTemperature={onRegenerateWithTemperature}
          isGenerating={isGenerating}
        />

        {/* Compare & Combine Versions */}
        {hasMultipleVersions && (
          <div
            style={{
              marginBottom: '16px',
              padding: '12px 16px',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
            }}
          >
            <div style={{ fontSize: '13px', fontWeight: 500, marginBottom: '10px' }}>
              Version Analysis
              <span style={{ marginLeft: '8px', color: 'var(--text-muted)', fontSize: '12px', fontWeight: 400 }}>
                ({versions.length} versions available)
              </span>
            </div>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <button
                onClick={onCompareVersions}
                disabled={isGenerating || compareRunning || combineRunning}
                style={{
                  padding: '8px 14px',
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  color: 'var(--text-secondary)',
                  cursor: isGenerating || compareRunning || combineRunning ? 'not-allowed' : 'pointer',
                  opacity: isGenerating || compareRunning || combineRunning ? 0.6 : 1,
                  fontSize: '12px',
                }}
              >
                {compareRunning ? 'Comparing...' : 'Compare Versions'}
              </button>
              <button
                onClick={onCombineVersions}
                disabled={isGenerating || compareRunning || combineRunning}
                style={{
                  padding: '8px 14px',
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  color: 'var(--text-secondary)',
                  cursor: isGenerating || compareRunning || combineRunning ? 'not-allowed' : 'pointer',
                  opacity: isGenerating || compareRunning || combineRunning ? 0.6 : 1,
                  fontSize: '12px',
                }}
              >
                {combineRunning ? 'Combining...' : 'Combine Versions'}
              </button>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>
              Compare produces an analysis report. Combine synthesizes all drafts into a new version.
              {item.comparisonReport && !item.combineInstructions && (
                <span style={{ color: 'var(--warning-color, #e6a700)' }}>
                  {' '}Combine instructions missing — combine will use generic criteria.
                  {onUpdateCombineInstructions && (
                    <button
                      onClick={() => {
                        setCombineInstructionsDraft('');
                        setEditingCombineInstructions(true);
                      }}
                      style={{
                        marginLeft: '6px',
                        padding: '1px 6px',
                        background: 'none',
                        border: '1px solid var(--border-color)',
                        borderRadius: '3px',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        fontSize: '11px',
                      }}
                    >
                      Set manually
                    </button>
                  )}
                </span>
              )}
              {item.combineInstructions && (
                <span style={{ color: 'var(--success-color, #4caf50)' }}>
                  {' '}Combine instructions ready.
                  {onUpdateCombineInstructions && (
                    <button
                      onClick={() => {
                        setCombineInstructionsDraft(item.combineInstructions);
                        setEditingCombineInstructions(true);
                      }}
                      style={{
                        marginLeft: '6px',
                        padding: '1px 6px',
                        background: 'none',
                        border: '1px solid var(--border-color)',
                        borderRadius: '3px',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        fontSize: '11px',
                      }}
                    >
                      Edit
                    </button>
                  )}
                </span>
              )}
            </div>
            {editingCombineInstructions && (
              <div style={{ marginTop: '8px' }}>
                <textarea
                  value={combineInstructionsDraft}
                  onChange={(e) => setCombineInstructionsDraft(e.target.value)}
                  placeholder="Enter combine instructions — editorial direction for how to merge versions..."
                  style={{
                    width: '100%',
                    minHeight: '80px',
                    padding: '8px',
                    fontSize: '12px',
                    lineHeight: 1.5,
                    background: 'var(--bg-primary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '4px',
                    color: 'var(--text-primary)',
                    resize: 'vertical',
                    fontFamily: 'inherit',
                  }}
                />
                <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                  <button
                    onClick={() => {
                      onUpdateCombineInstructions(combineInstructionsDraft.trim());
                      setEditingCombineInstructions(false);
                    }}
                    disabled={!combineInstructionsDraft.trim()}
                    style={{
                      padding: '3px 10px',
                      background: combineInstructionsDraft.trim() ? 'var(--accent-color, #6366f1)' : 'var(--bg-tertiary)',
                      border: 'none',
                      borderRadius: '4px',
                      color: combineInstructionsDraft.trim() ? '#fff' : 'var(--text-muted)',
                      cursor: combineInstructionsDraft.trim() ? 'pointer' : 'not-allowed',
                      fontSize: '11px',
                    }}
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setEditingCombineInstructions(false)}
                    style={{
                      padding: '3px 10px',
                      background: 'none',
                      border: '1px solid var(--border-color)',
                      borderRadius: '4px',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      fontSize: '11px',
                    }}
                  >
                    Cancel
                  </button>
                  {item.combineInstructions && (
                    <button
                      onClick={() => {
                        onUpdateCombineInstructions('');
                        setEditingCombineInstructions(false);
                      }}
                      style={{
                        padding: '3px 10px',
                        background: 'none',
                        border: '1px solid var(--error-color, #ef4444)',
                        borderRadius: '4px',
                        color: 'var(--error-color, #ef4444)',
                        cursor: 'pointer',
                        fontSize: '11px',
                      }}
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Comparison Report */}
        {item.comparisonReport && (
          <div
            style={{
              marginBottom: '16px',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: '12px 16px',
                background: 'var(--bg-tertiary)',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span style={{ fontSize: '13px', fontWeight: 500 }}>
                Comparison Report
                {!item.combineInstructions && (
                  <span style={{ marginLeft: '8px', fontSize: '11px', color: 'var(--warning-color, #e6a700)', fontWeight: 400 }}>
                    (combine instructions not parsed —{' '}
                    {onUpdateCombineInstructions ? (
                      <button
                        onClick={() => {
                          setCombineInstructionsDraft('');
                          setEditingCombineInstructions(true);
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--warning-color, #e6a700)',
                          cursor: 'pointer',
                          fontSize: '11px',
                          fontWeight: 400,
                          padding: 0,
                          textDecoration: 'underline',
                        }}
                      >
                        set manually
                      </button>
                    ) : (
                      'set manually via edit'
                    )}
                    )
                  </span>
                )}
              </span>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {item.comparisonReportGeneratedAt && (
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    {new Date(item.comparisonReportGeneratedAt).toLocaleString()}
                  </span>
                )}
                <button
                  onClick={() => {
                    const blob = new Blob([item.comparisonReport], { type: 'text/markdown' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `comparison-report-${item.chronicleId.slice(0, 20)}-${Date.now()}.md`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  style={{
                    padding: '2px 8px',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '4px',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    fontSize: '11px',
                  }}
                >
                  Export
                </button>
              </div>
            </div>
            <div
              style={{
                padding: '16px',
                maxHeight: '400px',
                overflowY: 'auto',
                fontSize: '13px',
                lineHeight: 1.7,
                whiteSpace: 'pre-wrap',
                color: 'var(--text-primary)',
              }}
            >
              {item.comparisonReport}
            </div>
          </div>
        )}

        {/* 4. Refinements — ENRICH */}
        <RefinementOptionsPanel
          item={item}
          onValidate={onValidate}
          onGenerateSummary={onGenerateSummary}
          onGenerateTitle={handleGenerateTitleWithModal}
          onGenerateImageRefs={onGenerateImageRefs}
          onGenerateCoverImageScene={onGenerateCoverImageScene}
          onGenerateCoverImage={onGenerateCoverImage}
          onImageClick={handleImageClick}
          imageSize={imageSize}
          imageQuality={imageQuality}
          imageModel={imageModel}
          onGenerateChronicleImage={onGenerateChronicleImage}
          onResetChronicleImage={onResetChronicleImage}
          onUpdateChronicleAnchorText={onUpdateChronicleAnchorText}
          onUpdateChronicleImageSize={onUpdateChronicleImageSize}
          onUpdateChronicleImageJustification={onUpdateChronicleImageJustification}
          onRegenerateDescription={onRegenerateDescription}
          isGenerating={isGenerating}
          refinements={refinements}
          entityMap={entityMap}
          styleLibrary={styleLibrary}
          styleSelection={styleSelection}
          cultures={cultures}
          cultureIdentities={cultureIdentities}
          worldContext={worldContext}
          summaryIndicator={summaryIndicator}
          imageRefsIndicator={imageRefsIndicator}
          imageRefsTargetContent={imageRefsTargetContent}
          imageGenSettings={imageGenSettings}
          onOpenImageSettings={onOpenImageSettings}
        />

        {/* 5. Reference — CONTEXT (collapsed by default) */}
        {item.perspectiveSynthesis && (
          <PerspectiveSynthesisViewer synthesis={item.perspectiveSynthesis} />
        )}

        <ExpandableSeedSection seed={seedData} defaultExpanded={false} />
        {renderTitleAcceptModal()}
        {renderImageModal()}
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Validation Ready State
  // -------------------------------------------------------------------------
  if (item.status === 'validation_ready') {
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
          {onExport && (
            <button
              onClick={onExport}
              style={{
                padding: '8px 16px',
                fontSize: '12px',
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border-color)',
                borderRadius: '4px',
                cursor: 'pointer',
                color: 'var(--text-secondary)',
              }}
              title="Export chronicle with full generation context as JSON"
            >
              Export
            </button>
          )}
        </div>
        <TemperatureRegenerationControl
          item={item}
          onRegenerateWithTemperature={onRegenerateWithTemperature}
          isGenerating={isGenerating}
        />

        {/* Perspective Synthesis (if used) */}
        {item.perspectiveSynthesis && (
          <PerspectiveSynthesisViewer synthesis={item.perspectiveSynthesis} />
        )}

        {item.cohesionReport && (
          <CohesionReportViewer
            report={item.cohesionReport}
            seedData={seedData}
            onAccept={onAccept}
            onRegenerate={onRegenerate}
            onCorrectSuggestions={onCorrectSuggestions}
            onGenerateSummary={onGenerateSummary}
            onGenerateImageRefs={onGenerateImageRefs}
            onRevalidate={onRevalidate}
            refinements={refinements}
            isValidationStale={Boolean(item.validationStale)}
            editVersion={item.editVersion}
            isGenerating={isGenerating}
            imageRefs={item.imageRefs}
            entityMap={entityMap}
            onGenerateChronicleImage={onGenerateChronicleImage}
            onResetChronicleImage={onResetChronicleImage}
            onUpdateChronicleAnchorText={onUpdateChronicleAnchorText}
            onUpdateChronicleImageSize={onUpdateChronicleImageSize}
            onUpdateChronicleImageJustification={onUpdateChronicleImageJustification}
            chronicleText={imageRefsTargetContent}
            summaryIndicator={summaryIndicator}
            imageRefsIndicator={imageRefsIndicator}
            styleLibrary={styleLibrary}
            cultures={cultures}
            cultureIdentities={cultureIdentities}
            worldContext={worldContext}
            chronicleTitle={item.title || item.name}
          />
        )}
        {item.assembledContent && (
          <div style={{ marginTop: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
              <h3 style={{ margin: 0, fontSize: '16px' }}>Preview</h3>
              <ChronicleVersionSelector
                versions={versions}
                selectedVersionId={selectedVersionId}
                activeVersionId={activeVersionId}
                compareToVersionId={compareToVersionId}
                onSelectVersion={(id) => {
                  setSelectedVersionId(id);
                  if (id === compareToVersionId) setCompareToVersionId('');
                }}
                onSelectCompareVersion={setCompareToVersionId}
                onSetActiveVersion={onUpdateChronicleActiveVersion}
                disabled={isGenerating}
              />
            </div>
            <AssembledContentViewer
              content={selectedVersion?.content || item.assembledContent}
              wordCount={selectedVersion?.wordCount ?? wordCount(item.assembledContent)}
              onCopy={() => copyToClipboard(selectedVersion?.content || item.assembledContent)}
              compareContent={compareToVersion?.content}
              compareLabel={compareToVersion?.shortLabel}
            />
          </div>
        )}
        {renderImageModal()}
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Complete State
  // -------------------------------------------------------------------------
  if (item.status === 'complete' && item.finalContent) {
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ margin: 0, fontSize: '16px' }}>Completed Chronicle</h3>
          <div style={{ display: 'flex', gap: '8px' }}>
            {onHistorianReview && (
              <button
                onClick={onHistorianReview}
                disabled={isGenerating || isHistorianActive}
                style={{
                  padding: '8px 16px',
                  fontSize: '12px',
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '4px',
                  cursor: isGenerating || isHistorianActive ? 'not-allowed' : 'pointer',
                  color: isHistorianActive ? 'var(--text-muted)' : '#8b7355',
                  opacity: isGenerating || isHistorianActive ? 0.6 : 1,
                }}
                title={item.historianNotes?.length
                  ? "Re-generate historian annotations for this chronicle"
                  : "Generate scholarly margin notes from the historian"}
              >
                {item.historianNotes?.length ? 'Re-annotate' : 'Historian Notes'}
              </button>
            )}
            {onBackportLore && (
              <button
                onClick={onBackportLore}
                disabled={isGenerating}
                style={{
                  padding: '8px 16px',
                  fontSize: '12px',
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '4px',
                  cursor: isGenerating ? 'not-allowed' : 'pointer',
                  color: 'var(--text-secondary)',
                  opacity: isGenerating ? 0.6 : 1,
                }}
                title={item.loreBackported
                  ? "Re-run lore backport for this chronicle"
                  : "Extract new lore from this chronicle and update cast member summaries/descriptions"}
              >
                {item.loreBackported ? 'Re-backport Lore' : 'Backport Lore to Cast'}
              </button>
            )}
{item.loreBackported && (
              <span
                style={{
                  padding: '8px 12px',
                  fontSize: '11px',
                  color: '#10b981',
                  fontWeight: 500,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
                title="Lore from this chronicle has been backported to cast"
              >
                &#x21C4; Backported
              </span>
            )}
            {onGenerateTitle && (
              <button
                onClick={handleGenerateTitleWithModal}
                disabled={isGenerating || refinements?.title?.running}
                style={{
                  padding: '8px 16px',
                  fontSize: '12px',
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '4px',
                  cursor: isGenerating || refinements?.title?.running ? 'not-allowed' : 'pointer',
                  color: 'var(--text-secondary)',
                  opacity: isGenerating || refinements?.title?.running ? 0.6 : 1,
                }}
                title="Generate a new title for this chronicle"
              >
                {refinements?.title?.running ? 'Generating...' : 'Regenerate Title'}
              </button>
            )}
            {onExport && (
              <button
                onClick={onExport}
                style={{
                  padding: '8px 16px',
                  fontSize: '12px',
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  color: 'var(--text-secondary)',
                }}
                title="Export chronicle with full generation context as JSON"
              >
                Export
              </button>
            )}
            {onUnpublish && (
              <button
                onClick={onUnpublish}
                style={{
                  padding: '8px 16px',
                  fontSize: '12px',
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  color: 'var(--text-secondary)',
                }}
                title="Revert to assembly review without discarding content"
              >
                Unpublish
              </button>
            )}
            <button
              onClick={onRegenerate}
              style={{
                padding: '8px 16px',
                fontSize: '12px',
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border-color)',
                borderRadius: '4px',
                cursor: 'pointer',
                color: 'var(--text-secondary)',
              }}
            >
              Restart
            </button>
          </div>
        </div>
        <AssembledContentViewer
          content={item.finalContent}
          wordCount={wordCount(item.finalContent)}
          onCopy={() => copyToClipboard(item.finalContent)}
        />

        {item.historianNotes?.length > 0 && (
          <div style={{ marginTop: '16px' }}>
            <HistorianMarginNotes
              text={item.finalContent}
              notes={item.historianNotes}
            />
          </div>
        )}

        {/* 3. Visual Assets — IMAGES (grouped) */}
        {/* Cover Image */}
        {(onGenerateCoverImageScene || onGenerateCoverImage) && (
          <div style={{ marginTop: '20px' }}>
            <CoverImageControls
              item={item}
              onGenerateCoverImageScene={onGenerateCoverImageScene}
              onGenerateCoverImage={onGenerateCoverImage}
              isGenerating={isGenerating}
              labelWeight={600}
              onImageClick={handleImageClick}
            />
          </div>
        )}

        {/* Image Anchors */}
        {item.imageRefs && entityMap && (
          <div style={{ marginTop: '20px' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>
              Image Anchors
            </div>
            <ChronicleImagePanel
              imageRefs={item.imageRefs}
              entities={entityMap}
              onGenerateImage={onGenerateChronicleImage}
              onResetImage={onResetChronicleImage}
              onRegenerateDescription={onRegenerateDescription}
              onUpdateAnchorText={onUpdateChronicleAnchorText}
              onUpdateSize={onUpdateChronicleImageSize}
              onUpdateJustification={onUpdateChronicleImageJustification}
              chronicleText={item.finalContent || imageRefsTargetContent || item.assembledContent}
              isGenerating={isGenerating}
              styleLibrary={styleLibrary}
              styleSelection={styleSelection}
              cultures={cultures}
              cultureIdentities={cultureIdentities}
              worldContext={worldContext}
              chronicleTitle={item.name}
              imageSize={imageSize}
              imageQuality={imageQuality}
              imageModel={imageModel}
              imageGenSettings={imageGenSettings}
              onOpenImageSettings={onOpenImageSettings}
            />
          </div>
        )}

        {/* 4. Metadata — WORLD CONTEXT */}
        <TemporalContextEditor
          item={item}
          eras={eras}
          onUpdateTemporalContext={onUpdateChronicleTemporalContext}
          isGenerating={isGenerating}
        />

        {/* 5. Reference — CONTEXT */}
        {item.perspectiveSynthesis && (
          <PerspectiveSynthesisViewer synthesis={item.perspectiveSynthesis} />
        )}

        {renderTitleAcceptModal()}
        {renderImageModal()}
      </div>
    );
  }

  // No content to show
  return null;
}
