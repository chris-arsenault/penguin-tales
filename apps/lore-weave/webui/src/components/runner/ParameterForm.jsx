/**
 * ParameterForm - Simulation parameter configuration form
 */

import React from 'react';

export default function ParameterForm({ params, onParamChange }) {
  return (
    <div className="lw-form-grid">
      <div className="lw-form-group">
        <label className="lw-label">Scale Factor</label>
        <input
          type="number"
          min="0.1"
          max="10"
          step="0.1"
          value={params.scaleFactor}
          onChange={(e) => onParamChange('scaleFactor', parseFloat(e.target.value) || 1)}
          className="lw-input"
        />
      </div>
      <div className="lw-form-group">
        <label className="lw-label">Graph Density</label>
        <input
          type="number"
          min="1"
          max="20"
          step="0.5"
          value={params.graphDensity}
          onChange={(e) => onParamChange('graphDensity', parseFloat(e.target.value) || 5)}
          className="lw-input"
          title="Minimum distance between entities on semantic planes (lower = more dense)"
        />
      </div>
      <div className="lw-form-group">
        <label className="lw-label">Epoch Length</label>
        <input
          type="number"
          min="5"
          max="100"
          value={params.epochLength}
          onChange={(e) => onParamChange('epochLength', parseInt(e.target.value) || 20)}
          className="lw-input"
        />
      </div>
      <div className="lw-form-group">
        <label className="lw-label">Sim Ticks / Growth</label>
        <input
          type="number"
          min="1"
          max="50"
          value={params.simulationTicksPerGrowth}
          onChange={(e) => onParamChange('simulationTicksPerGrowth', parseInt(e.target.value) || 15)}
          className="lw-input"
        />
      </div>
      <div className="lw-form-group">
        <label className="lw-label">Target / Kind</label>
        <input
          type="number"
          min="5"
          max="500"
          value={params.targetEntitiesPerKind}
          onChange={(e) => onParamChange('targetEntitiesPerKind', parseInt(e.target.value) || 30)}
          className="lw-input"
        />
      </div>
      <div className="lw-form-group">
        <label className="lw-label">Max Ticks</label>
        <input
          type="number"
          min="100"
          max="5000"
          value={params.maxTicks}
          onChange={(e) => onParamChange('maxTicks', parseInt(e.target.value) || 500)}
          className="lw-input"
        />
      </div>
    </div>
  );
}
