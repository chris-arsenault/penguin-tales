/**
 * ClusterFormationTab - Configuration for cluster formation systems
 */

import React from 'react';
import { CLUSTERING_CRITERIA_TYPES } from '../constants';
import { ReferenceDropdown } from '../../shared';

/**
 * @param {Object} props
 * @param {Object} props.system - The system being edited
 * @param {Function} props.onChange - Called when system changes
 * @param {Object} props.schema - Domain schema
 */
export function ClusterFormationTab({ system, onChange, schema }) {
  const config = system.config || {};

  const entityKindOptions = (schema?.entityKinds || []).map((ek) => ({
    value: ek.kind,
    label: ek.description || ek.kind,
  }));

  const relationshipKindOptions = (schema?.relationshipKinds || []).map((rk) => ({
    value: rk.kind,
    label: rk.description || rk.kind,
  }));

  const updateConfig = (field, value) => {
    onChange({ ...system, config: { ...config, [field]: value } });
  };

  const updateEntityFilter = (field, value) => {
    updateConfig('entityFilter', { ...config.entityFilter, [field]: value });
  };

  const updateClustering = (field, value) => {
    updateConfig('clustering', { ...config.clustering, [field]: value });
  };

  const updateMetaEntity = (field, value) => {
    updateConfig('metaEntity', { ...config.metaEntity, [field]: value });
  };

  // Criteria
  const criteria = config.clustering?.criteria || [];

  const addCriterion = () => {
    updateClustering('criteria', [...criteria, { type: 'same_culture', weight: 1.0 }]);
  };

  const updateCriterion = (index, crit) => {
    const newCriteria = [...criteria];
    newCriteria[index] = crit;
    updateClustering('criteria', newCriteria);
  };

  const removeCriterion = (index) => {
    updateClustering('criteria', criteria.filter((_, i) => i !== index));
  };

  return (
    <div>
      <div className="section">
        <div className="section-title">Entity Filter</div>
        <div className="form-grid">
          <ReferenceDropdown
            label="Kind"
            value={config.entityFilter?.kind || 'any'}
            onChange={(v) => updateEntityFilter('kind', v)}
            options={[{ value: 'any', label: 'All Kinds' }, ...entityKindOptions]}
          />
        </div>
      </div>

      <div className="section">
        <div className="section-title">Clustering Configuration</div>
        <div className="form-grid">
          <div className="form-group">
            <label className="label">Min Size</label>
            <input
              type="number"
              value={config.clustering?.minSize ?? ''}
              onChange={(e) => updateClustering('minSize', parseInt(e.target.value) || undefined)}
              className="input"
              min="2"
            />
          </div>
          <div className="form-group">
            <label className="label">Max Size</label>
            <input
              type="number"
              value={config.clustering?.maxSize ?? ''}
              onChange={(e) => updateClustering('maxSize', parseInt(e.target.value) || undefined)}
              className="input"
              min="2"
            />
          </div>
          <div className="form-group">
            <label className="label">Minimum Score</label>
            <input
              type="number"
              value={config.clustering?.minimumScore ?? ''}
              onChange={(e) => updateClustering('minimumScore', parseFloat(e.target.value) || undefined)}
              className="input"
              step="0.5"
              min="0"
            />
          </div>
        </div>

        <div style={{ marginTop: '16px' }}>
          <label className="label">Clustering Criteria ({criteria.length})</label>
        </div>

        {criteria.map((crit, index) => (
          <div key={index} className="item-card">
            <div style={{ padding: '12px 16px' }}>
              <div className="form-grid">
                <ReferenceDropdown
                  label="Type"
                  value={crit.type}
                  onChange={(v) => updateCriterion(index, { ...crit, type: v })}
                  options={CLUSTERING_CRITERIA_TYPES}
                />
                <div className="form-group">
                  <label className="label">Weight</label>
                  <input
                    type="number"
                    value={crit.weight ?? ''}
                    onChange={(e) => updateCriterion(index, { ...crit, weight: parseFloat(e.target.value) || 0 })}
                    className="input"
                    step="0.5"
                    min="0"
                  />
                </div>
                {crit.type === 'shared_relationship' && (
                  <ReferenceDropdown
                    label="Relationship Kind"
                    value={crit.relationshipKind}
                    onChange={(v) => updateCriterion(index, { ...crit, relationshipKind: v })}
                    options={relationshipKindOptions}
                  />
                )}
                <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                  <button className="btn-icon btn-icon-danger" onClick={() => removeCriterion(index)}>x</button>
                </div>
              </div>
            </div>
          </div>
        ))}

        <button
          className="btn-add"
          onClick={addCriterion}
        >
          + Add Criterion
        </button>
      </div>

      <div className="section">
        <div className="section-title">Meta Entity</div>
        <div className="section-desc">
          Configuration for the meta-entity created from clusters.
        </div>
        <div className="form-grid">
          <ReferenceDropdown
            label="Kind"
            value={config.metaEntity?.kind}
            onChange={(v) => updateMetaEntity('kind', v)}
            options={entityKindOptions}
          />
          <div className="form-group">
            <label className="label">Status</label>
            <input
              type="text"
              value={config.metaEntity?.status || ''}
              onChange={(e) => updateMetaEntity('status', e.target.value)}
              className="input"
            />
          </div>
        </div>
        <div style={{ marginTop: '16px' }}>
          <div className="form-group">
            <label className="label">Description Template</label>
            <textarea
              value={config.metaEntity?.descriptionTemplate || ''}
              onChange={(e) => updateMetaEntity('descriptionTemplate', e.target.value)}
              className="textarea"
              placeholder="Use {names}, {count} placeholders"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
