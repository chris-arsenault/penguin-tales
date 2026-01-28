/**
 * ChronicleReviewPanel - Shared review/refinement UI for chronicles
 *
 * Renders the review screen for single-shot chronicle generation.
 */

import { useMemo, useState, useEffect } from 'react';
import CohesionReportViewer from './CohesionReportViewer';
import ChronicleImagePanel from './ChronicleImagePanel';
import { ExpandableSeedSection } from './ChronicleSeedViewer';

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

function AssembledContentViewer({ content, wordCount, onCopy }) {
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
        {content}
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
  onGenerateImageRefs,
  onGenerateChronicleImage,
  onResetChronicleImage,
  onUpdateChronicleAnchorText,
  onUpdateChronicleImageSize,
  onUpdateChronicleImageJustification,
  isGenerating,
  refinements,
  entityMap,
  styleLibrary,
  cultures,
  cultureIdentities,
  worldContext,
}) {
  const formatTimestamp = (timestamp) => new Date(timestamp).toLocaleString();
  const summaryState = refinements?.summary || {};
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
        {/* Validate (optional for V2) */}
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

        {/* Summary */}
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 500 }}>Add Summary</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Generate a short summary for chronicle listings.
            </div>
            {summaryState.generatedAt && (
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Done - {formatTimestamp(summaryState.generatedAt)}
                {summaryState.model ? ` - ${summaryState.model}` : ''}
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
              onUpdateAnchorText={onUpdateChronicleAnchorText}
              onUpdateSize={onUpdateChronicleImageSize}
              onUpdateJustification={onUpdateChronicleImageJustification}
              chronicleText={item.assembledContent}
              isGenerating={isGenerating}
              styleLibrary={styleLibrary}
              cultures={cultures}
              cultureIdentities={cultureIdentities}
              worldContext={worldContext}
              chronicleTitle={item.name}
            />
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
  onCorrectSuggestions,
  onGenerateSummary,
  onGenerateImageRefs,
  onRevalidate,
  onGenerateChronicleImage,
  onResetChronicleImage,
  onUpdateChronicleAnchorText,
  onUpdateChronicleTemporalContext,

  // Image layout edits
  onUpdateChronicleImageSize,
  onUpdateChronicleImageJustification,

  // Export
  onExport,

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

  if (!item) return null;

  const wordCount = (content) => content?.split(/\s+/).filter(Boolean).length || 0;
  const copyToClipboard = (content) => navigator.clipboard.writeText(content);

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
        {/* Header with primary actions */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
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
              {wordCount(item.assembledContent).toLocaleString()} words
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

        <TemperatureRegenerationControl
          item={item}
          onRegenerateWithTemperature={onRegenerateWithTemperature}
          isGenerating={isGenerating}
        />

        {/* Refinement Options */}
        <RefinementOptionsPanel
          item={item}
          onValidate={onValidate}
          onGenerateSummary={onGenerateSummary}
          onGenerateImageRefs={onGenerateImageRefs}
          onGenerateChronicleImage={onGenerateChronicleImage}
          onResetChronicleImage={onResetChronicleImage}
          onUpdateChronicleAnchorText={onUpdateChronicleAnchorText}
          onUpdateChronicleImageSize={onUpdateChronicleImageSize}
          onUpdateChronicleImageJustification={onUpdateChronicleImageJustification}
          isGenerating={isGenerating}
          refinements={refinements}
          entityMap={entityMap}
          styleLibrary={styleLibrary}
          cultures={cultures}
          cultureIdentities={cultureIdentities}
          worldContext={worldContext}
        />

        {/* Perspective Synthesis (if used) */}
        {item.perspectiveSynthesis && (
          <PerspectiveSynthesisViewer synthesis={item.perspectiveSynthesis} />
        )}

        {/* Generation Context (expandable) */}
        <ExpandableSeedSection seed={seedData} defaultExpanded={false} />

        {/* Content Preview */}
        <div>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '16px' }}>Content</h3>
          <AssembledContentViewer
            content={item.assembledContent}
            wordCount={wordCount(item.assembledContent)}
            onCopy={() => copyToClipboard(item.assembledContent)}
          />
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Validation Ready State
  // -------------------------------------------------------------------------
  if (item.status === 'validation_ready') {
    return (
      <div>
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
            chronicleText={item.assembledContent}
            styleLibrary={styleLibrary}
            cultures={cultures}
            cultureIdentities={cultureIdentities}
            worldContext={worldContext}
            chronicleTitle={item.title || item.name}
          />
        )}
        {item.assembledContent && (
          <div style={{ marginTop: '24px' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '16px' }}>Preview</h3>
            <AssembledContentViewer
              content={item.assembledContent}
              wordCount={wordCount(item.assembledContent)}
              onCopy={() => copyToClipboard(item.assembledContent)}
            />
          </div>
        )}
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

        {/* Perspective Synthesis (if used) */}
        {item.perspectiveSynthesis && (
          <PerspectiveSynthesisViewer synthesis={item.perspectiveSynthesis} />
        )}

        <TemporalContextEditor
          item={item}
          eras={eras}
          onUpdateTemporalContext={onUpdateChronicleTemporalContext}
          isGenerating={isGenerating}
        />
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
              onUpdateAnchorText={onUpdateChronicleAnchorText}
              onUpdateSize={onUpdateChronicleImageSize}
              onUpdateJustification={onUpdateChronicleImageJustification}
              isGenerating={isGenerating}
              styleLibrary={styleLibrary}
              cultures={cultures}
              cultureIdentities={cultureIdentities}
              worldContext={worldContext}
              chronicleTitle={item.name}
            />
          </div>
        )}
      </div>
    );
  }

  // No content to show
  return null;
}
