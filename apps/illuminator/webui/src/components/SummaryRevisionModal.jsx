/**
 * SummaryRevisionModal - Batch review UI for entity summary revisions
 *
 * Shows a modal with:
 * - Batch progress indicator
 * - Per-entity patches with inline diff view
 * - Accept/reject toggles per entity
 * - Continue/cancel/apply controls
 */

import { useState, useRef, useEffect, useMemo } from 'react';

// ============================================================================
// Inline Diff Display
// ============================================================================

function InlineDiff({ original, revised, label }) {
  if (!revised || revised === original) return null;

  return (
    <div style={{ marginBottom: '8px' }}>
      <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
        {label}
      </div>
      <div style={{
        fontSize: '11px',
        lineHeight: '1.6',
        padding: '8px',
        background: 'var(--bg-primary)',
        borderRadius: '4px',
        border: '1px solid var(--border-color)',
      }}>
        <div style={{ marginBottom: '6px' }}>
          <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontStyle: 'italic' }}>Current:</span>
          <div style={{ color: 'var(--text-secondary)' }}>{original}</div>
        </div>
        <div>
          <span style={{ fontSize: '10px', color: 'var(--success-color, #22c55e)', fontStyle: 'italic' }}>Proposed:</span>
          <div style={{ color: 'var(--text-primary)' }}>{revised}</div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Patch Card
// ============================================================================

function PatchCard({ patch, accepted, onToggle }) {
  const hasChanges = patch.summary || patch.description;

  return (
    <div style={{
      padding: '10px 12px',
      background: 'var(--bg-secondary)',
      borderRadius: '6px',
      marginBottom: '8px',
      borderLeft: `3px solid ${accepted !== false ? 'var(--success-color, #22c55e)' : 'var(--text-muted)'}`,
      opacity: accepted === false ? 0.6 : 1,
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: hasChanges ? '8px' : '0',
      }}>
        <div>
          <span style={{ fontWeight: 600, fontSize: '12px' }}>{patch.entityName}</span>
          <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginLeft: '8px' }}>
            {patch.entityKind}
          </span>
        </div>
        <button
          onClick={() => onToggle(patch.entityId, accepted === false)}
          style={{
            padding: '2px 8px',
            fontSize: '10px',
            borderRadius: '4px',
            border: '1px solid var(--border-color)',
            background: accepted !== false ? 'var(--success-color, #22c55e)' : 'var(--bg-tertiary)',
            color: accepted !== false ? '#fff' : 'var(--text-secondary)',
            cursor: 'pointer',
          }}
        >
          {accepted !== false ? 'Accepted' : 'Rejected'}
        </button>
      </div>

      {/* Diffs */}
      {patch.summary && (
        <InlineDiff original="" revised={patch.summary} label="Summary" />
      )}
      {patch.description && (
        <InlineDiff original="" revised={patch.description} label="Description" />
      )}

      {/* Reasoning */}
      <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontStyle: 'italic', marginTop: '4px' }}>
        {patch.reasoning}
      </div>
    </div>
  );
}

// ============================================================================
// Main Modal
// ============================================================================

export default function SummaryRevisionModal({
  run,
  isActive,
  onContinue,
  onAutoContine,
  onTogglePatch,
  onAccept,
  onCancel,
  getEntityContexts,
}) {
  const scrollRef = useRef(null);

  // Auto-scroll on new content
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [run?.batches?.length, run?.currentBatchIndex, run?.status]);

  if (!isActive || !run) return null;

  const isGenerating = run.status === 'generating' || run.status === 'pending';
  const isBatchReviewing = run.status === 'batch_reviewing';
  const isRunReviewing = run.status === 'run_reviewing';
  const isFailed = run.status === 'failed';

  const currentBatch = run.batches[run.currentBatchIndex];
  const totalBatches = run.batches.length;
  const completedBatches = run.batches.filter((b) => b.status === 'complete' || b.status === 'failed').length;

  // Collect all patches across all completed batches for run_reviewing
  const allPatches = isRunReviewing
    ? run.batches.flatMap((b) => b.patches || [])
    : (currentBatch?.patches || []);

  const acceptedCount = allPatches.filter((p) => run.patchDecisions[p.entityId] !== false).length;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 1000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(0, 0, 0, 0.6)',
    }}>
      <div style={{
        background: 'var(--bg-primary)',
        borderRadius: '12px',
        border: '1px solid var(--border-color)',
        width: '800px',
        maxWidth: '90vw',
        maxHeight: '85vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '16px' }}>
              Summary Revision
              {currentBatch && !isRunReviewing && (
                <span style={{ fontWeight: 400, fontSize: '13px', color: 'var(--text-muted)', marginLeft: '8px' }}>
                  {currentBatch.culture}
                </span>
              )}
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: '11px', color: 'var(--text-muted)' }}>
              {isRunReviewing
                ? `All ${totalBatches} batches complete. Review and apply patches.`
                : `Batch ${run.currentBatchIndex + 1} of ${totalBatches}`
              }
              {completedBatches > 0 && !isRunReviewing && ` (${completedBatches} complete)`}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {run.totalActualCost > 0 && (
              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                ${run.totalActualCost.toFixed(4)}
              </span>
            )}
            <button
              onClick={onCancel}
              className="illuminator-button illuminator-button-secondary"
              style={{ padding: '4px 12px', fontSize: '12px' }}
            >
              Cancel
            </button>
          </div>
        </div>

        {/* Scrollable content */}
        <div style={{
          flex: 1,
          overflow: 'auto',
          padding: '16px 20px',
          minHeight: 0,
        }}>
          {isGenerating && (
            <div style={{
              padding: '40px 12px',
              fontSize: '12px',
              color: 'var(--text-muted)',
              textAlign: 'center',
            }}>
              <div style={{ marginBottom: '8px' }}>Generating revisions for batch {run.currentBatchIndex + 1}...</div>
              {currentBatch && (
                <div style={{ fontSize: '10px' }}>
                  {currentBatch.culture} ({currentBatch.entityIds.length} entities)
                </div>
              )}
            </div>
          )}

          {isFailed && currentBatch?.error && (
            <div style={{
              padding: '10px 12px',
              background: 'var(--bg-tertiary)',
              borderRadius: '6px',
              borderLeft: '3px solid var(--danger)',
              fontSize: '12px',
              color: 'var(--danger)',
              marginBottom: '8px',
            }}>
              {currentBatch.error}
            </div>
          )}

          {/* Patches */}
          {allPatches.length > 0 && (
            <div>
              <div style={{
                fontWeight: 600,
                fontSize: '13px',
                marginBottom: '10px',
                display: 'flex',
                justifyContent: 'space-between',
              }}>
                <span>Proposed Patches ({allPatches.length})</span>
                <span style={{ fontSize: '11px', fontWeight: 400, color: 'var(--text-muted)' }}>
                  {acceptedCount} accepted
                </span>
              </div>
              {allPatches.map((patch) => (
                <PatchCard
                  key={patch.entityId}
                  patch={patch}
                  accepted={run.patchDecisions[patch.entityId]}
                  onToggle={onTogglePatch}
                />
              ))}
            </div>
          )}

          {(isBatchReviewing || isRunReviewing) && allPatches.length === 0 && (
            <div style={{
              padding: '20px 12px',
              fontSize: '12px',
              color: 'var(--text-muted)',
              textAlign: 'center',
            }}>
              No changes suggested for this batch. All entities look good.
            </div>
          )}

          <div ref={scrollRef} />
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 20px 16px',
          borderTop: '1px solid var(--border-color)',
          flexShrink: 0,
          display: 'flex',
          gap: '8px',
          justifyContent: 'flex-end',
          alignItems: 'center',
        }}>
          {isBatchReviewing && (
            <>
              <button
                onClick={onAutoContine}
                className="illuminator-button illuminator-button-secondary"
                style={{ padding: '6px 16px', fontSize: '12px' }}
              >
                Auto-Continue All
              </button>
              <button
                onClick={onContinue}
                className="illuminator-button illuminator-button-primary"
                style={{ padding: '6px 16px', fontSize: '12px' }}
              >
                {run.currentBatchIndex + 1 < totalBatches
                  ? `Continue to Batch ${run.currentBatchIndex + 2}`
                  : 'Finish Review'
                }
              </button>
            </>
          )}
          {isRunReviewing && (
            <button
              onClick={onAccept}
              className="illuminator-button illuminator-button-primary"
              style={{ padding: '6px 16px', fontSize: '12px' }}
            >
              Apply Accepted ({acceptedCount})
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
