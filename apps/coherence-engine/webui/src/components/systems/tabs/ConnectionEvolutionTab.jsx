/**
 * ConnectionEvolutionTab - Configuration for connection evolution systems
 */

import React, { useState } from 'react';
import { METRIC_TYPES, DIRECTIONS } from '../constants';
import { ReferenceDropdown } from '../../shared';

/**
 * RuleCard - Expandable card for rule configuration
 */
function RuleCard({ rule, onChange, onRemove, schema }) {
  const [expanded, setExpanded] = useState(false);

  const relationshipKindOptions = (schema?.relationshipKinds || []).map((rk) => ({
    value: rk.kind,
    label: rk.description || rk.kind,
  }));

  const updateCondition = (field, value) => {
    onChange({ ...rule, condition: { ...rule.condition, [field]: value } });
  };

  const updateAction = (field, value) => {
    onChange({ ...rule, action: { ...rule.action, [field]: value } });
  };

  return (
    <div className="item-card">
      <div
        className="item-card-header"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="item-card-icon" style={{ backgroundColor: 'rgba(59, 130, 246, 0.2)' }}>R</div>
        <div className="item-card-info">
          <div className="item-card-title">
            {rule.condition?.operator || '>='} {rule.condition?.threshold || '?'}
          </div>
          <div className="item-card-subtitle">
            {rule.action?.type} - {(rule.probability * 100).toFixed(0)}% chance
          </div>
        </div>
        <div className="item-card-actions">
          <button className="btn-icon">{expanded ? '^' : 'v'}</button>
          <button className="btn-icon btn-icon-danger" onClick={(e) => { e.stopPropagation(); onRemove(); }}>x</button>
        </div>
      </div>

      {expanded && (
        <div className="item-card-body">
          <div className="form-grid">
            <ReferenceDropdown
              label="Operator"
              value={rule.condition?.operator || '>='}
              onChange={(v) => updateCondition('operator', v)}
              options={[
                { value: '>=', label: '>= (greater or equal)' },
                { value: '>', label: '> (greater)' },
                { value: '<=', label: '<= (less or equal)' },
                { value: '<', label: '< (less)' },
                { value: '==', label: '== (equal)' },
              ]}
            />
            <div className="form-group">
              <label className="label">Threshold</label>
              <input
                type="text"
                value={rule.condition?.threshold ?? ''}
                onChange={(e) => {
                  const v = e.target.value;
                  updateCondition('threshold', isNaN(Number(v)) ? v : Number(v));
                }}
                className="input"
              />
            </div>
            <div className="form-group">
              <label className="label">Probability</label>
              <input
                type="number"
                value={rule.probability ?? ''}
                onChange={(e) => onChange({ ...rule, probability: parseFloat(e.target.value) || 0 })}
                className="input"
                step="0.05"
                min="0"
                max="1"
              />
            </div>
          </div>

          <div style={{ marginTop: '16px' }}>
            <label className="label">Action</label>
            <div className="form-grid">
              <ReferenceDropdown
                label="Type"
                value={rule.action?.type || 'create_relationship'}
                onChange={(v) => updateAction('type', v)}
                options={[
                  { value: 'create_relationship', label: 'Create Relationship' },
                  { value: 'adjust_prominence', label: 'Adjust Prominence' },
                  { value: 'set_tag', label: 'Set Tag' },
                ]}
              />
              {rule.action?.type === 'create_relationship' && (
                <>
                  <ReferenceDropdown
                    label="Relationship Kind"
                    value={rule.action?.kind}
                    onChange={(v) => updateAction('kind', v)}
                    options={relationshipKindOptions}
                  />
                  <div className="form-group">
                    <label className="label">Strength</label>
                    <input
                      type="number"
                      value={rule.action?.strength ?? ''}
                      onChange={(e) => updateAction('strength', parseFloat(e.target.value) || undefined)}
                      className="input"
                      step="0.1"
                      min="0"
                      max="1"
                    />
                  </div>
                </>
              )}
              {rule.action?.type === 'adjust_prominence' && (
                <ReferenceDropdown
                  label="Direction"
                  value={rule.action?.direction || 'up'}
                  onChange={(v) => updateAction('direction', v)}
                  options={[
                    { value: 'up', label: 'Up' },
                    { value: 'down', label: 'Down' },
                  ]}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * @param {Object} props
 * @param {Object} props.system - The system being edited
 * @param {Function} props.onChange - Called when system changes
 * @param {Object} props.schema - Domain schema
 */
export function ConnectionEvolutionTab({ system, onChange, schema }) {
  const config = system.config || {};

  const relationshipKindOptions = (schema?.relationshipKinds || []).map((rk) => ({
    value: rk.kind,
    label: rk.description || rk.kind,
  }));

  const updateConfig = (field, value) => {
    onChange({ ...system, config: { ...config, [field]: value } });
  };

  const updateMetric = (field, value) => {
    updateConfig('metric', { ...config.metric, [field]: value });
  };

  // Rules
  const rules = config.rules || [];

  const addRule = () => {
    updateConfig('rules', [...rules, {
      condition: { operator: '>=', threshold: 1 },
      probability: 0.1,
      action: { type: 'create_relationship', kind: '' },
    }]);
  };

  const updateRule = (index, rule) => {
    const newRules = [...rules];
    newRules[index] = rule;
    updateConfig('rules', newRules);
  };

  const removeRule = (index) => {
    updateConfig('rules', rules.filter((_, i) => i !== index));
  };

  return (
    <div>
      <div className="section">
        <div className="section-title">Metric</div>
        <div className="section-desc">
          How entities are measured for rule evaluation.
        </div>
        <div className="form-grid">
          <ReferenceDropdown
            label="Metric Type"
            value={config.metric?.type || 'connection_count'}
            onChange={(v) => updateMetric('type', v)}
            options={METRIC_TYPES}
          />
          <ReferenceDropdown
            label="Direction"
            value={config.metric?.direction || 'both'}
            onChange={(v) => updateMetric('direction', v)}
            options={DIRECTIONS}
          />
          {config.metric?.type === 'shared_relationship' && (
            <ReferenceDropdown
              label="Shared Relationship Kind"
              value={config.metric?.sharedRelationshipKind}
              onChange={(v) => updateMetric('sharedRelationshipKind', v)}
              options={relationshipKindOptions}
            />
          )}
          {config.metric?.type === 'tagged_connection_count' && (
            <>
              <ReferenceDropdown
                label="Relationship Kind"
                value={config.metric?.relationshipKind}
                onChange={(v) => updateMetric('relationshipKind', v)}
                options={relationshipKindOptions}
              />
              <div className="form-group">
                <label className="label">Target Tag</label>
                <input
                  type="text"
                  value={config.metric?.targetTag || ''}
                  onChange={(e) => updateMetric('targetTag', e.target.value)}
                  className="input"
                />
              </div>
            </>
          )}
        </div>
      </div>

      <div className="section">
        <div className="section-title">Rules ({rules.length})</div>
        <div className="section-desc">
          Conditions and actions based on the metric.
        </div>

        {rules.map((rule, index) => (
          <RuleCard
            key={index}
            rule={rule}
            onChange={(r) => updateRule(index, r)}
            onRemove={() => removeRule(index)}
            schema={schema}
          />
        ))}

        <button
          className="btn-add"
          onClick={addRule}
        >
          + Add Rule
        </button>
      </div>
    </div>
  );
}
