/**
 * ChronicleReviewPanel - Shared review/refinement UI for chronicles
 *
 * Renders the review screen for single-shot chronicle generation.
 */

import { useMemo } from 'react';
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
      </div>
    );
  }

  // No content to show
  return null;
}
