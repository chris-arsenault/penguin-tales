/**
 * RunControls - Simulation run/stop/step buttons
 */

import React from 'react';

export default function RunControls({
  isRunning,
  isPaused,
  simState,
  validation,
  onRun,
  onStartStepMode,
  onStep,
  onRunToCompletion,
  onAbort,
  onReset,
  onViewResults,
}) {
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
      <div className="lw-button-group">
        <button
          className={`lw-btn lw-btn-primary ${!validation.isValid ? 'disabled' : ''}`}
          onClick={onRun}
          disabled={!validation.isValid}
        >
          ▶ Run All
        </button>
        <button
          className={`lw-btn lw-btn-step ${!validation.isValid ? 'disabled' : ''}`}
          onClick={onStartStepMode}
          disabled={!validation.isValid}
          title="Run one epoch at a time"
        >
          ⏯ Step Mode
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
