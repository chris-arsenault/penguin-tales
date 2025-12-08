/**
 * PlaneDiffusionTab - Configuration for plane diffusion systems
 */

import React from 'react';
import { ReferenceDropdown, NumberInput } from '../../shared';
import TagSelector from '@lore-weave/shared-components/TagSelector';

/**
 * @param {Object} props
 * @param {Object} props.system - The system being edited
 * @param {Function} props.onChange - Called when system changes
 * @param {Object} props.schema - Domain schema (for tag registry)
 */
export function PlaneDiffusionTab({ system, onChange, schema }) {
  const config = system.config || {};
  const tagRegistry = schema?.tagRegistry || [];

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
            <TagSelector
              value={config.sources?.tagFilter ? [config.sources.tagFilter] : []}
              onChange={(tags) => updateSources('tagFilter', tags[0] || '')}
              tagRegistry={tagRegistry}
              placeholder="Select tag..."
              singleSelect
            />
          </div>
          <div className="form-group">
            <label className="label">Default Strength</label>
            <NumberInput
              value={config.sources?.defaultStrength}
              onChange={(v) => updateSources('defaultStrength', v)}
              min={0}
              allowEmpty
            />
          </div>
        </div>
      </div>

      <div className="section">
        <div className="section-title">Sinks</div>
        <div className="form-grid">
          <div className="form-group">
            <label className="label">Tag Filter</label>
            <TagSelector
              value={config.sinks?.tagFilter ? [config.sinks.tagFilter] : []}
              onChange={(tags) => updateSinks('tagFilter', tags[0] || '')}
              tagRegistry={tagRegistry}
              placeholder="Select tag..."
              singleSelect
            />
          </div>
          <div className="form-group">
            <label className="label">Default Strength</label>
            <NumberInput
              value={config.sinks?.defaultStrength}
              onChange={(v) => updateSinks('defaultStrength', v)}
              min={0}
              allowEmpty
            />
          </div>
        </div>
      </div>

      <div className="section">
        <div className="section-title">Diffusion</div>
        <div className="form-grid">
          <div className="form-group">
            <label className="label">Rate</label>
            <NumberInput
              value={config.diffusion?.rate}
              onChange={(v) => updateDiffusion('rate', v)}
              min={0}
              allowEmpty
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
            <NumberInput
              value={config.diffusion?.maxRadius}
              onChange={(v) => updateDiffusion('maxRadius', v)}
              min={1}
              integer
              allowEmpty
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
                  <TagSelector
                    value={tag.tag ? [tag.tag] : []}
                    onChange={(tags) => updateOutputTag(index, { ...tag, tag: tags[0] || '' })}
                    tagRegistry={tagRegistry}
                    placeholder="Select tag..."
                    singleSelect
                  />
                </div>
                <div className="form-group">
                  <label className="label">Min Value</label>
                  <NumberInput
                    value={tag.minValue}
                    onChange={(v) => updateOutputTag(index, { ...tag, minValue: v })}
                    min={0}
                    max={1}
                    allowEmpty
                  />
                </div>
                <div className="form-group">
                  <label className="label">Max Value</label>
                  <NumberInput
                    value={tag.maxValue}
                    onChange={(v) => updateOutputTag(index, { ...tag, maxValue: v })}
                    min={0}
                    max={1}
                    allowEmpty
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
            <TagSelector
              value={config.valueTag ? [config.valueTag] : []}
              onChange={(tags) => updateConfig('valueTag', tags[0] || '')}
              tagRegistry={tagRegistry}
              placeholder="Select tag..."
              singleSelect
            />
          </div>
        </div>
      </div>
    </div>
  );
}
