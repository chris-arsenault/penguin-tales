/**
 * ParameterForm - Simulation parameter configuration form
 */

import React from 'react';
import { NumberInput } from '@penguin-tales/shared-components';

export default function ParameterForm({ params, onParamChange }) {
  return (
    <div className="lw-form-grid">
      <div className="lw-form-group">
        <label className="lw-label">Scale Factor</label>
        <NumberInput
          min={0.1}
          max={10}
          step={0.1}
          value={params.scaleFactor}
          onChange={(v) => onParamChange('scaleFactor', v ?? 1)}
          className="lw-input"
        />
      </div>
      <div className="lw-form-group">
        <label className="lw-label">Default Min Distance</label>
        <NumberInput
          min={1}
          max={20}
          step={0.5}
          value={params.defaultMinDistance}
          onChange={(v) => onParamChange('defaultMinDistance', v ?? 5)}
          className="lw-input"
          title="Minimum distance between entities on semantic planes"
        />
      </div>
      <div className="lw-form-group">
        <label className="lw-label">Pressure Smoothing</label>
        <NumberInput
          min={1}
          max={50}
          step={1}
          value={params.pressureDeltaSmoothing}
          onChange={(v) => onParamChange('pressureDeltaSmoothing', v ?? 10)}
          className="lw-input"
          integer
          title="Max pressure change per tick from feedback (higher = faster swings)"
        />
      </div>
      <div className="lw-form-group">
        <label className="lw-label">Ticks Per Epoch</label>
        <NumberInput
          min={1}
          max={50}
          value={params.ticksPerEpoch}
          onChange={(v) => onParamChange('ticksPerEpoch', v ?? 15)}
          className="lw-input"
          integer
          title="Number of simulation ticks to run per epoch"
        />
      </div>
      <div className="lw-form-group">
        <label className="lw-label">Max Epochs</label>
        <NumberInput
          min={1}
          max={100}
          value={params.maxEpochs}
          onChange={(v) => onParamChange('maxEpochs', v ?? 10)}
          className="lw-input"
          integer
          title="Maximum epochs to run (hard limit on simulation length)"
        />
      </div>
      <div className="lw-form-group">
        <label className="lw-label">Target / Kind</label>
        <NumberInput
          min={5}
          max={500}
          value={params.targetEntitiesPerKind}
          onChange={(v) => onParamChange('targetEntitiesPerKind', v ?? 30)}
          className="lw-input"
          integer
        />
      </div>
      <div className="lw-form-group">
        <label className="lw-label">Max Ticks</label>
        <NumberInput
          min={100}
          max={5000}
          value={params.maxTicks}
          onChange={(v) => onParamChange('maxTicks', v ?? 500)}
          className="lw-input"
          integer
        />
      </div>
    </div>
  );
}
