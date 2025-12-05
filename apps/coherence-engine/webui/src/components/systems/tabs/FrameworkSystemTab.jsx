/**
 * FrameworkSystemTab - Configuration for framework-level systems
 */

import React from 'react';

/**
 * @param {Object} props
 * @param {Object} props.system - The system being edited
 * @param {Function} props.onChange - Called when system changes
 */
export function FrameworkSystemTab({ system, onChange }) {
  const config = system.config || {};

  const updateConfig = (field, value) => {
    onChange({ ...system, config: { ...config, [field]: value } });
  };

  return (
    <div>
      <div className="info-box">
        <div className="info-box-title">Framework System</div>
        <div className="info-box-text">
          This is a framework-level system with specific configuration options.
        </div>
      </div>

      <div className="section">
        <div className="section-title">Configuration</div>

        {system.systemType === 'eraSpawner' && (
          <div className="form-grid">
            <div className="form-group">
              <label className="label">Ticks Per Era</label>
              <input
                type="number"
                value={config.ticksPerEra ?? ''}
                onChange={(e) => updateConfig('ticksPerEra', parseInt(e.target.value) || undefined)}
                className="input"
                min="1"
              />
            </div>
          </div>
        )}

        {system.systemType === 'eraTransition' && (
          <div className="form-grid">
            <p className="label" style={{ gridColumn: '1 / -1', color: '#666' }}>
              Era transition timing is controlled by per-era transitionConditions in eras.json.
              Add a time condition (e.g., {`{ type: 'time', minTicks: 25 }`}) to control minimum era length.
            </p>
          </div>
        )}

        {system.systemType === 'universalCatalyst' && (
          <div className="form-grid">
            <div className="form-group">
              <label className="label">Action Attempt Rate</label>
              <input
                type="number"
                value={config.actionAttemptRate ?? ''}
                onChange={(e) => updateConfig('actionAttemptRate', parseFloat(e.target.value) || undefined)}
                className="input"
                step="0.1"
                min="0"
                max="1"
              />
            </div>
            <div className="form-group">
              <label className="label">Influence Gain</label>
              <input
                type="number"
                value={config.influenceGain ?? ''}
                onChange={(e) => updateConfig('influenceGain', parseFloat(e.target.value) || undefined)}
                className="input"
                step="0.05"
                min="0"
              />
            </div>
            <div className="form-group">
              <label className="label">Influence Loss</label>
              <input
                type="number"
                value={config.influenceLoss ?? ''}
                onChange={(e) => updateConfig('influenceLoss', parseFloat(e.target.value) || undefined)}
                className="input"
                step="0.05"
                min="0"
              />
            </div>
            <div className="form-group">
              <label className="label">Pressure Multiplier</label>
              <input
                type="number"
                value={config.pressureMultiplier ?? ''}
                onChange={(e) => updateConfig('pressureMultiplier', parseFloat(e.target.value) || undefined)}
                className="input"
                step="0.1"
                min="0"
              />
            </div>
          </div>
        )}

        {system.systemType === 'relationshipMaintenance' && (
          <div className="form-grid">
            <div className="form-group">
              <label className="label">Maintenance Frequency</label>
              <input
                type="number"
                value={config.maintenanceFrequency ?? ''}
                onChange={(e) => updateConfig('maintenanceFrequency', parseInt(e.target.value) || undefined)}
                className="input"
                min="1"
              />
            </div>
            <div className="form-group">
              <label className="label">Cull Threshold</label>
              <input
                type="number"
                value={config.cullThreshold ?? ''}
                onChange={(e) => updateConfig('cullThreshold', parseFloat(e.target.value) || undefined)}
                className="input"
                step="0.05"
                min="0"
                max="1"
              />
            </div>
            <div className="form-group">
              <label className="label">Grace Period</label>
              <input
                type="number"
                value={config.gracePeriod ?? ''}
                onChange={(e) => updateConfig('gracePeriod', parseInt(e.target.value) || undefined)}
                className="input"
                min="0"
              />
            </div>
            <div className="form-group">
              <label className="label">Reinforcement Bonus</label>
              <input
                type="number"
                value={config.reinforcementBonus ?? ''}
                onChange={(e) => updateConfig('reinforcementBonus', parseFloat(e.target.value) || undefined)}
                className="input"
                step="0.01"
                min="0"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
