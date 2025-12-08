/**
 * ConnectionEvolutionTab - Configuration for connection evolution systems
 */

import React, { useState } from 'react';
import { METRIC_TYPES, DIRECTIONS } from '../constants';
import { ReferenceDropdown, NumberInput } from '../../shared';

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
                placeholder="Number or 'prominence_scaled'"
              />
            </div>
            {rule.condition?.threshold === 'prominence_scaled' && (
              <div className="form-group">
                <label className="label">Multiplier</label>
                <NumberInput
                  value={rule.condition?.multiplier}
                  onChange={(v) => updateCondition('multiplier', v)}
                  allowEmpty
                  placeholder="6"
                />
              </div>
            )}
            <div className="form-group">
              <label className="label">Probability</label>
              <NumberInput
                value={rule.probability}
                onChange={(v) => onChange({ ...rule, probability: v ?? 0 })}
                min={0}
                max={1}
              />
            </div>
          </div>

          <div style={{ marginTop: '16px' }}>
            <label className="label">Action</label>
            <div className="form-grid">
              <ReferenceDropdown
                label="Type"
                value={rule.action?.type || 'adjust_prominence'}
                onChange={(v) => updateAction('type', v)}
                options={[
                  { value: 'adjust_prominence', label: 'Adjust Prominence' },
                  { value: 'create_relationship', label: 'Create Relationship' },
                  { value: 'change_status', label: 'Change Status' },
                  { value: 'add_tag', label: 'Add Tag' },
                ]}
              />
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
              {rule.action?.type === 'create_relationship' && (
                <>
                  <ReferenceDropdown
                    label="Relationship Kind"
                    value={rule.action?.kind}
                    onChange={(v) => updateAction('kind', v)}
                    options={relationshipKindOptions}
                  />
                  <div className="form-group">
                    <label className="label">Category</label>
                    <input
                      type="text"
                      value={rule.action?.category || ''}
                      onChange={(e) => updateAction('category', e.target.value || undefined)}
                      className="input"
                      placeholder="Optional"
                    />
                  </div>
                  <div className="form-group">
                    <label className="label">Strength</label>
                    <NumberInput
                      value={rule.action?.strength}
                      onChange={(v) => updateAction('strength', v)}
                      min={0}
                      max={1}
                      allowEmpty
                    />
                  </div>
                </>
              )}
              {rule.action?.type === 'change_status' && (
                <div className="form-group">
                  <label className="label">New Status</label>
                  <input
                    type="text"
                    value={rule.action?.newStatus || ''}
                    onChange={(e) => updateAction('newStatus', e.target.value)}
                    className="input"
                  />
                </div>
              )}
              {rule.action?.type === 'add_tag' && (
                <>
                  <div className="form-group">
                    <label className="label">Tag</label>
                    <input
                      type="text"
                      value={rule.action?.tag || ''}
                      onChange={(e) => updateAction('tag', e.target.value)}
                      className="input"
                    />
                  </div>
                  <div className="form-group">
                    <label className="label">Value (optional)</label>
                    <input
                      type="text"
                      value={rule.action?.value ?? ''}
                      onChange={(e) => updateAction('value', e.target.value || undefined)}
                      className="input"
                      placeholder="true"
                    />
                  </div>
                </>
              )}
            </div>
          </div>

          {rule.action?.type === 'create_relationship' && (
            <div style={{ marginTop: '16px' }}>
              <label className="label">
                <input
                  type="checkbox"
                  checked={rule.betweenMatching || false}
                  onChange={(e) => onChange({ ...rule, betweenMatching: e.target.checked })}
                  style={{ marginRight: '8px' }}
                />
                Between Matching (create relationships between all entity pairs that pass condition)
              </label>
            </div>
          )}
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

  const entityKindOptions = (schema?.entityKinds || []).map((ek) => ({
    value: ek.kind,
    label: ek.description || ek.kind,
  }));

  const relationshipKindOptions = (schema?.relationshipKinds || []).map((rk) => ({
    value: rk.kind,
    label: rk.description || rk.kind,
  }));

  const getSubtypeOptions = (kind) => {
    const ek = (schema?.entityKinds || []).find((e) => e.kind === kind);
    if (!ek?.subtypes) return [];
    return ek.subtypes.map((st) => ({ value: st.id, label: st.name || st.id }));
  };

  const getStatusOptions = (kind) => {
    const ek = (schema?.entityKinds || []).find((e) => e.kind === kind);
    if (!ek?.statuses) return [];
    return ek.statuses.map((st) => ({ value: st.id, label: st.name || st.id }));
  };

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
      action: { type: 'adjust_prominence', direction: 'up' },
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

  // Subtype bonuses
  const subtypeBonuses = config.subtypeBonuses || [];

  const addSubtypeBonus = () => {
    updateConfig('subtypeBonuses', [...subtypeBonuses, { subtype: '', bonus: 0 }]);
  };

  const updateSubtypeBonus = (index, bonus) => {
    const newBonuses = [...subtypeBonuses];
    newBonuses[index] = bonus;
    updateConfig('subtypeBonuses', newBonuses);
  };

  const removeSubtypeBonus = (index) => {
    updateConfig('subtypeBonuses', subtypeBonuses.filter((_, i) => i !== index));
  };

  return (
    <div>
      <div className="section">
        <div className="section-title">Entity Filter</div>
        <div className="section-desc">
          Which entities this system evaluates.
        </div>
        <div className="form-grid">
          <div className="form-group">
            <label className="label">Subtypes (comma-separated)</label>
            <input
              type="text"
              value={(config.entitySubtypes || []).join(', ')}
              onChange={(e) => {
                const subtypes = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                updateConfig('entitySubtypes', subtypes.length > 0 ? subtypes : undefined);
              }}
              className="input"
              placeholder="Leave empty for all subtypes"
            />
          </div>
          <ReferenceDropdown
            label="Status"
            value={config.entityStatus}
            onChange={(v) => updateConfig('entityStatus', v)}
            options={getStatusOptions(config.entityKind)}
            placeholder="Any"
          />
        </div>
      </div>

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
          {(config.metric?.type === 'connection_count' || config.metric?.type === 'relationship_count') && (
            <div className="form-group">
              <label className="label">Filter by Relationship Kinds (optional)</label>
              <input
                type="text"
                value={(config.metric?.relationshipKinds || []).join(', ')}
                onChange={(e) => {
                  const kinds = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                  updateMetric('relationshipKinds', kinds.length > 0 ? kinds : undefined);
                }}
                className="input"
                placeholder="Leave empty for all kinds"
              />
            </div>
          )}
          {config.metric?.type === 'shared_relationship' && (
            <>
              <ReferenceDropdown
                label="Shared Relationship Kind"
                value={config.metric?.sharedRelationshipKind}
                onChange={(v) => updateMetric('sharedRelationshipKind', v)}
                options={relationshipKindOptions}
              />
              <ReferenceDropdown
                label="Shared Direction"
                value={config.metric?.sharedDirection || 'src'}
                onChange={(v) => updateMetric('sharedDirection', v)}
                options={[
                  { value: 'src', label: 'Source (outgoing)' },
                  { value: 'dst', label: 'Destination (incoming)' },
                ]}
              />
            </>
          )}
          <div className="form-group">
            <label className="label">Min Strength</label>
            <NumberInput
              value={config.metric?.minStrength}
              onChange={(v) => updateMetric('minStrength', v)}
              min={0}
              max={1}
              allowEmpty
              placeholder="0"
            />
          </div>
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

      <div className="section">
        <div className="section-title">Subtype Bonuses ({subtypeBonuses.length})</div>
        <div className="section-desc">
          Bonuses added to metric value based on entity subtype.
        </div>

        {subtypeBonuses.map((bonus, index) => (
          <div key={index} className="item-card">
            <div style={{ padding: '12px 16px' }}>
              <div className="form-grid">
                <ReferenceDropdown
                  label="Subtype"
                  value={bonus.subtype}
                  onChange={(v) => updateSubtypeBonus(index, { ...bonus, subtype: v })}
                  options={getSubtypeOptions(config.entityKind)}
                />
                <div className="form-group">
                  <label className="label">Bonus</label>
                  <NumberInput
                    value={bonus.bonus}
                    onChange={(v) => updateSubtypeBonus(index, { ...bonus, bonus: v ?? 0 })}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                  <button className="btn-icon btn-icon-danger" onClick={() => removeSubtypeBonus(index)}>x</button>
                </div>
              </div>
            </div>
          </div>
        ))}

        <button
          className="btn-add"
          onClick={addSubtypeBonus}
        >
          + Add Subtype Bonus
        </button>
      </div>
    </div>
  );
}
