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
        <label className="lw-label">Graph Density</label>
        <NumberInput
          min={1}
          max={20}
          step={0.5}
          value={params.graphDensity}
          onChange={(v) => onParamChange('graphDensity', v ?? 5)}
          className="lw-input"
          title="Minimum distance between entities on semantic planes (lower = more dense)"
        />
      </div>
      <div className="lw-form-group">
        <label className="lw-label">Epoch Length</label>
        <NumberInput
          min={5}
          max={100}
          value={params.epochLength}
          onChange={(v) => onParamChange('epochLength', v ?? 20)}
          className="lw-input"
          integer
        />
      </div>
      <div className="lw-form-group">
        <label className="lw-label">Sim Ticks / Growth</label>
        <NumberInput
          min={1}
          max={50}
          value={params.simulationTicksPerGrowth}
          onChange={(v) => onParamChange('simulationTicksPerGrowth', v ?? 15)}
          className="lw-input"
          integer
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
