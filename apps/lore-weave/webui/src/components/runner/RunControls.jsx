/**
 * RunControls - Simulation run/stop/step buttons
 */

import React from 'react';

function ValidityBadge({ runValidity }) {
  if (!runValidity) return null;

  const { isValid, allTemplatesRun, allActionsSucceeded, reachedFinalEra } = runValidity;

  if (isValid) {
    return (
      <span
        className="lw-validity-badge lw-validity-valid"
        title="All templates run, all actions succeeded, reached final era"
      >
        ✓ Valid
      </span>
    );
  }

  // Build tooltip with reasons for invalidity
  const reasons = [];
  if (!allTemplatesRun) reasons.push('Some templates never ran');
  if (!allActionsSucceeded) reasons.push('Some actions never succeeded');
  if (!reachedFinalEra) reasons.push('Did not reach final era');

  return (
    <span
      className="lw-validity-badge lw-validity-invalid"
      title={reasons.join(', ')}
    >
      ✗ Invalid
    </span>
  );
}

export default function RunControls({
  isRunning,
  isPaused,
  simState,
  validation,
  runValidity,
  isRunningUntilValid,
  validityAttempts,
  maxValidityAttempts,
  validitySearchComplete,
  validityReport,
  onRun,
  onRunUntilValid,
  onCancelRunUntilValid,
  onDownloadValidityData,
  onStartStepMode,
  onStep,
  onRunToCompletion,
  onAbort,
  onReset,
  onViewResults,
}) {
  // Running until valid - show special stop button
  if (isRunningUntilValid && isRunning) {
    return (
      <>
        <div className="lw-step-indicator">
          <span>Attempt {validityAttempts} / {maxValidityAttempts}</span>
          <span style={{ color: 'var(--lw-accent)' }}>SEARCHING FOR VALID RUN</span>
        </div>
        <button className="lw-btn lw-btn-danger" onClick={onCancelRunUntilValid}>
          ◼ Cancel
        </button>
      </>
    );
  }

  if (isRunning && !isPaused) {
    // Running state - show stop button
    return (
      <button className="lw-btn lw-btn-danger" onClick={onAbort}>
        ◼ Stop
      </button>
    );
  }

  if (isPaused) {
    // Paused state - show step controls
    return (
      <>
        <div className="lw-step-indicator">
          <span>Epoch {simState.progress?.epoch || 0} / {simState.progress?.totalEpochs || 0}</span>
          <span style={{ color: 'var(--lw-warning)' }}>PAUSED</span>
        </div>
        <div className="lw-button-group">
          <button className="lw-btn lw-btn-step" onClick={onStep}>
            ⏭ Next Epoch
          </button>
          <button
            className="lw-btn lw-btn-primary"
            onClick={onRunToCompletion}
            title="Continue running all remaining epochs"
          >
            ▶ Continue
          </button>
          <button className="lw-btn lw-btn-reset" onClick={onReset}>
            ↻ Reset
          </button>
        </div>
        {simState.status === 'complete' && onViewResults && (
          <button className="lw-btn lw-btn-success" onClick={onViewResults}>
            ✓ View Results
          </button>
        )}
      </>
    );
  }

  // Idle or complete state - show run/step buttons
  return (
    <>
      {simState.status === 'complete' && (
        <ValidityBadge runValidity={runValidity} />
      )}
      {validitySearchComplete && validityReport && (
        <span
          className="lw-validity-badge"
          style={{
            backgroundColor: 'rgba(139, 92, 246, 0.15)',
            color: '#8b5cf6',
            border: '1px solid rgba(139, 92, 246, 0.3)'
          }}
          title={`${validityReport.summary.foundValid ? 'Found valid on attempt ' + validityReport.summary.validAttempt : 'No valid run found'}`}
        >
          {validityReport.summary.totalAttempts} runs
        </span>
      )}
      <div className="lw-button-group">
        <button
          className={`lw-btn lw-btn-primary ${!validation.isValid ? 'disabled' : ''}`}
          onClick={onRun}
          disabled={!validation.isValid}
        >
          ▶ Run
        </button>
        <button
          className={`lw-btn lw-btn-secondary ${!validation.isValid ? 'disabled' : ''}`}
          onClick={onRunUntilValid}
          disabled={!validation.isValid}
          title={`Run up to ${maxValidityAttempts} simulations until a valid one is found`}
        >
          ⟳ Until Valid
        </button>
        <button
          className={`lw-btn lw-btn-step ${!validation.isValid ? 'disabled' : ''}`}
          onClick={onStartStepMode}
          disabled={!validation.isValid}
          title="Run one epoch at a time"
        >
          ⏯ Step
        </button>
      </div>
      {validitySearchComplete && validityReport && (
        <button
          className="lw-btn lw-btn-secondary"
          onClick={onDownloadValidityData}
          title="Download all run data and analysis report as ZIP"
        >
          ⬇ Download Runs
        </button>
      )}
      {simState.status === 'complete' && onViewResults && (
        <button className="lw-btn lw-btn-success" onClick={onViewResults}>
          ✓ View Results
        </button>
      )}
    </>
  );
}
