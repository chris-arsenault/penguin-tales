/**
 * TuningParameters - Meta-parameters for the tuning system
 */

import React from 'react';

export default function TuningParameters({ tuning, updateTargets }) {
  return (
    <>
      <p className="lw-section-description">
        Meta-parameters that control how the tuning system operates
      </p>
      <div className="lw-card">
        <div className="lw-card-title">Adjustment Parameters</div>
        <div className="lw-form-grid">
          <div className="lw-form-group">
            <label className="lw-label">Adjustment Speed</label>
            <input
              type="number"
              step="0.1"
              className="lw-input"
              value={tuning.adjustmentSpeed || 0.3}
              onChange={(e) => updateTargets('tuning.adjustmentSpeed', parseFloat(e.target.value) || 0)}
            />
            <div className="lw-comment">How quickly weights adjust (0-1)</div>
          </div>
          <div className="lw-form-group">
            <label className="lw-label">Deviation Sensitivity</label>
            <input
              type="number"
              step="0.1"
              className="lw-input"
              value={tuning.deviationSensitivity || 1.5}
              onChange={(e) => updateTargets('tuning.deviationSensitivity', parseFloat(e.target.value) || 0)}
            />
            <div className="lw-comment">Multiplier for deviation detection</div>
          </div>
          <div className="lw-form-group">
            <label className="lw-label">Min Template Weight</label>
            <input
              type="number"
              step="0.01"
              className="lw-input"
              value={tuning.minTemplateWeight || 0.05}
              onChange={(e) => updateTargets('tuning.minTemplateWeight', parseFloat(e.target.value) || 0)}
            />
          </div>
          <div className="lw-form-group">
            <label className="lw-label">Max Template Weight</label>
            <input
              type="number"
              step="0.1"
              className="lw-input"
              value={tuning.maxTemplateWeight || 3.0}
              onChange={(e) => updateTargets('tuning.maxTemplateWeight', parseFloat(e.target.value) || 0)}
            />
          </div>
          <div className="lw-form-group">
            <label className="lw-label">Convergence Threshold</label>
            <input
              type="number"
              step="0.01"
              className="lw-input"
              value={tuning.convergenceThreshold || 0.08}
              onChange={(e) => updateTargets('tuning.convergenceThreshold', parseFloat(e.target.value) || 0)}
            />
            <div className="lw-comment">When to consider targets met</div>
          </div>
          <div className="lw-form-group">
            <label className="lw-label">Measurement Interval</label>
            <input
              type="number"
              className="lw-input"
              value={tuning.measurementInterval || 5}
              onChange={(e) => updateTargets('tuning.measurementInterval', parseInt(e.target.value) || 0)}
            />
            <div className="lw-comment">Ticks between measurements</div>
          </div>
        </div>
      </div>

      <div className="lw-card">
        <div className="lw-card-title">Correction Strength</div>
        <p className="lw-section-description">
          Relative weights for different deviation types when calculating corrections
        </p>
        <div className="lw-form-grid">
          <div className="lw-form-group">
            <label className="lw-label">Entity Kind</label>
            <input
              type="number"
              step="0.1"
              className="lw-input"
              value={tuning.correctionStrength?.entityKind || 1.2}
              onChange={(e) => updateTargets('tuning.correctionStrength.entityKind', parseFloat(e.target.value) || 0)}
            />
          </div>
          <div className="lw-form-group">
            <label className="lw-label">Prominence</label>
            <input
              type="number"
              step="0.1"
              className="lw-input"
              value={tuning.correctionStrength?.prominence || 0.8}
              onChange={(e) => updateTargets('tuning.correctionStrength.prominence', parseFloat(e.target.value) || 0)}
            />
          </div>
          <div className="lw-form-group">
            <label className="lw-label">Relationship</label>
            <input
              type="number"
              step="0.1"
              className="lw-input"
              value={tuning.correctionStrength?.relationship || 1.5}
              onChange={(e) => updateTargets('tuning.correctionStrength.relationship', parseFloat(e.target.value) || 0)}
            />
          </div>
          <div className="lw-form-group">
            <label className="lw-label">Connectivity</label>
            <input
              type="number"
              step="0.1"
              className="lw-input"
              value={tuning.correctionStrength?.connectivity || 1.0}
              onChange={(e) => updateTargets('tuning.correctionStrength.connectivity', parseFloat(e.target.value) || 0)}
            />
          </div>
        </div>
      </div>
    </>
  );
}
