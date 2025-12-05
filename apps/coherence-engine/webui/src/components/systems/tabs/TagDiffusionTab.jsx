/**
 * TagDiffusionTab - Configuration for tag diffusion systems
 */

import React from 'react';
import { DIRECTIONS } from '../constants';
import { ReferenceDropdown } from '../../shared';

/**
 * @param {Object} props
 * @param {Object} props.system - The system being edited
 * @param {Function} props.onChange - Called when system changes
 * @param {Object} props.schema - Domain schema
 */
export function TagDiffusionTab({ system, onChange, schema }) {
  const config = system.config || {};

  const relationshipKindOptions = (schema?.relationshipKinds || []).map((rk) => ({
    value: rk.kind,
    label: rk.description || rk.kind,
  }));

  const updateConfig = (field, value) => {
    onChange({ ...system, config: { ...config, [field]: value } });
  };

  const updateConvergence = (field, value) => {
    updateConfig('convergence', { ...config.convergence, [field]: value });
  };

  const updateDivergence = (field, value) => {
    updateConfig('divergence', { ...config.divergence, [field]: value });
  };

  return (
    <div>
      <div className="section">
        <div className="section-title">Connection</div>
        <div className="form-grid">
          <ReferenceDropdown
            label="Connection Kind"
            value={config.connectionKind}
            onChange={(v) => updateConfig('connectionKind', v)}
            options={relationshipKindOptions}
          />
          <ReferenceDropdown
            label="Direction"
            value={config.connectionDirection || 'both'}
            onChange={(v) => updateConfig('connectionDirection', v)}
            options={DIRECTIONS}
          />
          <div className="form-group">
            <label className="label">Max Tags</label>
            <input
              type="number"
              value={config.maxTags ?? ''}
              onChange={(e) => updateConfig('maxTags', parseInt(e.target.value) || undefined)}
              className="input"
              min="1"
            />
          </div>
        </div>
      </div>

      <div className="section">
        <div className="section-title">Convergence</div>
        <div className="section-desc">
          Connected entities become more similar.
        </div>
        <div className="form-grid">
          <div className="form-group">
            <label className="label">Tags (comma-separated)</label>
            <input
              type="text"
              value={(config.convergence?.tags || []).join(', ')}
              onChange={(e) => updateConvergence('tags', e.target.value.split(',').map(t => t.trim()).filter(Boolean))}
              className="input"
            />
          </div>
          <div className="form-group">
            <label className="label">Min Connections</label>
            <input
              type="number"
              value={config.convergence?.minConnections ?? ''}
              onChange={(e) => updateConvergence('minConnections', parseInt(e.target.value) || undefined)}
              className="input"
              min="0"
            />
          </div>
          <div className="form-group">
            <label className="label">Probability</label>
            <input
              type="number"
              value={config.convergence?.probability ?? ''}
              onChange={(e) => updateConvergence('probability', parseFloat(e.target.value) || undefined)}
              className="input"
              step="0.1"
              min="0"
              max="1"
            />
          </div>
        </div>
      </div>

      <div className="section">
        <div className="section-title">Divergence</div>
        <div className="section-desc">
          Isolated entities become more unique.
        </div>
        <div className="form-grid">
          <div className="form-group">
            <label className="label">Tags (comma-separated)</label>
            <input
              type="text"
              value={(config.divergence?.tags || []).join(', ')}
              onChange={(e) => updateDivergence('tags', e.target.value.split(',').map(t => t.trim()).filter(Boolean))}
              className="input"
            />
          </div>
          <div className="form-group">
            <label className="label">Max Connections</label>
            <input
              type="number"
              value={config.divergence?.maxConnections ?? ''}
              onChange={(e) => updateDivergence('maxConnections', parseInt(e.target.value) || undefined)}
              className="input"
              min="0"
            />
          </div>
          <div className="form-group">
            <label className="label">Probability</label>
            <input
              type="number"
              value={config.divergence?.probability ?? ''}
              onChange={(e) => updateDivergence('probability', parseFloat(e.target.value) || undefined)}
              className="input"
              step="0.1"
              min="0"
              max="1"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
