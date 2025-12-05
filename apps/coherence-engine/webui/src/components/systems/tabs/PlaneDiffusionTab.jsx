/**
 * PlaneDiffusionTab - Configuration for plane diffusion systems
 */

import React from 'react';
import { ReferenceDropdown } from '../../shared';

/**
 * @param {Object} props
 * @param {Object} props.system - The system being edited
 * @param {Function} props.onChange - Called when system changes
 */
export function PlaneDiffusionTab({ system, onChange }) {
  const config = system.config || {};

  const updateConfig = (field, value) => {
    onChange({ ...system, config: { ...config, [field]: value } });
  };

  const updateSources = (field, value) => {
    updateConfig('sources', { ...config.sources, [field]: value });
  };

  const updateSinks = (field, value) => {
    updateConfig('sinks', { ...config.sinks, [field]: value });
  };

  const updateDiffusion = (field, value) => {
    updateConfig('diffusion', { ...config.diffusion, [field]: value });
  };

  // Output tags
  const outputTags = config.outputTags || [];

  const addOutputTag = () => {
    updateConfig('outputTags', [...outputTags, { tag: '', minValue: 0 }]);
  };

  const updateOutputTag = (index, tag) => {
    const newTags = [...outputTags];
    newTags[index] = tag;
    updateConfig('outputTags', newTags);
  };

  const removeOutputTag = (index) => {
    updateConfig('outputTags', outputTags.filter((_, i) => i !== index));
  };

  return (
    <div>
      <div className="section">
        <div className="section-title">Sources</div>
        <div className="form-grid">
          <div className="form-group">
            <label className="label">Tag Filter</label>
            <input
              type="text"
              value={config.sources?.tagFilter || ''}
              onChange={(e) => updateSources('tagFilter', e.target.value)}
              className="input"
              placeholder="e.g., volcanic"
            />
          </div>
          <div className="form-group">
            <label className="label">Default Strength</label>
            <input
              type="number"
              value={config.sources?.defaultStrength ?? ''}
              onChange={(e) => updateSources('defaultStrength', parseFloat(e.target.value) || undefined)}
              className="input"
              step="0.1"
              min="0"
            />
          </div>
        </div>
      </div>

      <div className="section">
        <div className="section-title">Sinks</div>
        <div className="form-grid">
          <div className="form-group">
            <label className="label">Tag Filter</label>
            <input
              type="text"
              value={config.sinks?.tagFilter || ''}
              onChange={(e) => updateSinks('tagFilter', e.target.value)}
              className="input"
              placeholder="e.g., deep_ice"
            />
          </div>
          <div className="form-group">
            <label className="label">Default Strength</label>
            <input
              type="number"
              value={config.sinks?.defaultStrength ?? ''}
              onChange={(e) => updateSinks('defaultStrength', parseFloat(e.target.value) || undefined)}
              className="input"
              step="0.1"
              min="0"
            />
          </div>
        </div>
      </div>

      <div className="section">
        <div className="section-title">Diffusion</div>
        <div className="form-grid">
          <div className="form-group">
            <label className="label">Rate</label>
            <input
              type="number"
              value={config.diffusion?.rate ?? ''}
              onChange={(e) => updateDiffusion('rate', parseFloat(e.target.value) || undefined)}
              className="input"
              step="0.05"
              min="0"
            />
          </div>
          <ReferenceDropdown
            label="Falloff"
            value={config.diffusion?.falloff || 'inverse_square'}
            onChange={(v) => updateDiffusion('falloff', v)}
            options={[
              { value: 'linear', label: 'Linear' },
              { value: 'inverse_square', label: 'Inverse Square' },
              { value: 'exponential', label: 'Exponential' },
            ]}
          />
          <div className="form-group">
            <label className="label">Max Radius</label>
            <input
              type="number"
              value={config.diffusion?.maxRadius ?? ''}
              onChange={(e) => updateDiffusion('maxRadius', parseInt(e.target.value) || undefined)}
              className="input"
              min="1"
            />
          </div>
        </div>
      </div>

      <div className="section">
        <div className="section-title">Output Tags ({outputTags.length})</div>
        <div className="section-desc">
          Tags assigned based on diffusion value thresholds.
        </div>

        {outputTags.map((tag, index) => (
          <div key={index} className="item-card">
            <div style={{ padding: '12px 16px' }}>
              <div className="form-grid">
                <div className="form-group">
                  <label className="label">Tag</label>
                  <input
                    type="text"
                    value={tag.tag || ''}
                    onChange={(e) => updateOutputTag(index, { ...tag, tag: e.target.value })}
                    className="input"
                  />
                </div>
                <div className="form-group">
                  <label className="label">Min Value</label>
                  <input
                    type="number"
                    value={tag.minValue ?? ''}
                    onChange={(e) => updateOutputTag(index, { ...tag, minValue: parseFloat(e.target.value) || undefined })}
                    className="input"
                    step="0.05"
                    min="0"
                    max="1"
                  />
                </div>
                <div className="form-group">
                  <label className="label">Max Value</label>
                  <input
                    type="number"
                    value={tag.maxValue ?? ''}
                    onChange={(e) => updateOutputTag(index, { ...tag, maxValue: parseFloat(e.target.value) || undefined })}
                    className="input"
                    step="0.05"
                    min="0"
                    max="1"
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                  <button className="btn-icon btn-icon-danger" onClick={() => removeOutputTag(index)}>x</button>
                </div>
              </div>
            </div>
          </div>
        ))}

        <button
          className="btn-add"
          onClick={addOutputTag}
        >
          + Add Output Tag
        </button>

        <div style={{ marginTop: '16px' }}>
          <div className="form-group">
            <label className="label">Value Tag</label>
            <input
              type="text"
              value={config.valueTag || ''}
              onChange={(e) => updateConfig('valueTag', e.target.value)}
              className="input"
              placeholder="e.g., temperature"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
