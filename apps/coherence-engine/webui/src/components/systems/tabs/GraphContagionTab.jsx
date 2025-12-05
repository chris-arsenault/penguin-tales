/**
 * GraphContagionTab - Configuration for graph contagion systems
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
export function GraphContagionTab({ system, onChange, schema }) {
  const config = system.config || {};

  const relationshipKindOptions = (schema?.relationshipKinds || []).map((rk) => ({
    value: rk.kind,
    label: rk.description || rk.kind,
  }));

  const updateConfig = (field, value) => {
    onChange({ ...system, config: { ...config, [field]: value } });
  };

  const updateContagion = (field, value) => {
    updateConfig('contagion', { ...config.contagion, [field]: value });
  };

  const updateTransmission = (field, value) => {
    updateConfig('transmission', { ...config.transmission, [field]: value });
  };

  const updateInfectionAction = (field, value) => {
    updateConfig('infectionAction', { ...config.infectionAction, [field]: value });
  };

  // Vectors
  const vectors = config.vectors || [];

  const addVector = () => {
    updateConfig('vectors', [...vectors, { relationshipKind: '', direction: 'both', minStrength: 0.5 }]);
  };

  const updateVector = (index, field, value) => {
    const newVectors = [...vectors];
    newVectors[index] = { ...newVectors[index], [field]: value };
    updateConfig('vectors', newVectors);
  };

  const removeVector = (index) => {
    updateConfig('vectors', vectors.filter((_, i) => i !== index));
  };

  return (
    <div>
      <div className="section">
        <div className="section-title">Contagion Source</div>
        <div className="section-desc">
          What is being spread through the network.
        </div>
        <div className="form-grid">
          <ReferenceDropdown
            label="Type"
            value={config.contagion?.type || 'relationship'}
            onChange={(v) => updateContagion('type', v)}
            options={[
              { value: 'relationship', label: 'Relationship' },
              { value: 'tag', label: 'Tag' },
            ]}
          />
          {config.contagion?.type === 'relationship' && (
            <ReferenceDropdown
              label="Relationship Kind"
              value={config.contagion?.relationshipKind}
              onChange={(v) => updateContagion('relationshipKind', v)}
              options={relationshipKindOptions}
            />
          )}
          {config.contagion?.type === 'tag' && (
            <div className="form-group">
              <label className="label">Tag</label>
              <input
                type="text"
                value={config.contagion?.tag || ''}
                onChange={(e) => updateContagion('tag', e.target.value)}
                className="input"
              />
            </div>
          )}
        </div>
      </div>

      <div className="section">
        <div className="section-title">Transmission Vectors ({vectors.length})</div>
        <div className="section-desc">
          Relationships through which the contagion spreads.
        </div>

        {vectors.map((vector, index) => (
          <div key={index} className="item-card">
            <div style={{ padding: '16px' }}>
              <div className="form-grid">
                <ReferenceDropdown
                  label="Relationship Kind"
                  value={vector.relationshipKind}
                  onChange={(v) => updateVector(index, 'relationshipKind', v)}
                  options={relationshipKindOptions}
                />
                <ReferenceDropdown
                  label="Direction"
                  value={vector.direction || 'both'}
                  onChange={(v) => updateVector(index, 'direction', v)}
                  options={DIRECTIONS}
                />
                <div className="form-group">
                  <label className="label">Min Strength</label>
                  <input
                    type="number"
                    value={vector.minStrength ?? ''}
                    onChange={(e) => updateVector(index, 'minStrength', parseFloat(e.target.value) || undefined)}
                    className="input"
                    step="0.1"
                    min="0"
                    max="1"
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                  <button className="btn-icon btn-icon-danger" onClick={() => removeVector(index)}>x</button>
                </div>
              </div>
            </div>
          </div>
        ))}

        <button
          className="btn-add"
          onClick={addVector}
        >
          + Add Vector
        </button>
      </div>

      <div className="section">
        <div className="section-title">Transmission Rates</div>
        <div className="form-grid">
          <div className="form-group">
            <label className="label">Base Rate</label>
            <input
              type="number"
              value={config.transmission?.baseRate ?? ''}
              onChange={(e) => updateTransmission('baseRate', parseFloat(e.target.value) || undefined)}
              className="input"
              step="0.05"
              min="0"
              max="1"
            />
          </div>
          <div className="form-group">
            <label className="label">Contact Multiplier</label>
            <input
              type="number"
              value={config.transmission?.contactMultiplier ?? ''}
              onChange={(e) => updateTransmission('contactMultiplier', parseFloat(e.target.value) || undefined)}
              className="input"
              step="0.05"
              min="0"
            />
          </div>
          <div className="form-group">
            <label className="label">Max Probability</label>
            <input
              type="number"
              value={config.transmission?.maxProbability ?? ''}
              onChange={(e) => updateTransmission('maxProbability', parseFloat(e.target.value) || undefined)}
              className="input"
              step="0.05"
              min="0"
              max="1"
            />
          </div>
        </div>
      </div>

      <div className="section">
        <div className="section-title">Infection Action</div>
        <div className="section-desc">
          What happens when an entity gets infected.
        </div>
        <div className="form-grid">
          <ReferenceDropdown
            label="Action Type"
            value={config.infectionAction?.type || 'create_relationship'}
            onChange={(v) => updateInfectionAction('type', v)}
            options={[
              { value: 'create_relationship', label: 'Create Relationship' },
              { value: 'set_tag', label: 'Set Tag' },
            ]}
          />
          {config.infectionAction?.type === 'create_relationship' && (
            <>
              <ReferenceDropdown
                label="Relationship Kind"
                value={config.infectionAction?.relationshipKind}
                onChange={(v) => updateInfectionAction('relationshipKind', v)}
                options={relationshipKindOptions}
              />
              <div className="form-group">
                <label className="label">Strength</label>
                <input
                  type="number"
                  value={config.infectionAction?.strength ?? ''}
                  onChange={(e) => updateInfectionAction('strength', parseFloat(e.target.value) || undefined)}
                  className="input"
                  step="0.1"
                  min="0"
                  max="1"
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
