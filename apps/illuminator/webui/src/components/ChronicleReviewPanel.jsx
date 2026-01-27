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
        <AssembledContentViewer
          content={item.finalContent}
          wordCount={wordCount(item.finalContent)}
          onCopy={() => copyToClipboard(item.finalContent)}
        />
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
