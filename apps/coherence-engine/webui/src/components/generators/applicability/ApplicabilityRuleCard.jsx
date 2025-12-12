/**
 * ApplicabilityRuleCard - Display and edit a single applicability rule
 */

import React, { useState } from 'react';
import { APPLICABILITY_TYPES } from '../constants';
import { ReferenceDropdown, ChipSelect, NumberInput } from '../../shared';
import { AddRuleButton } from './AddRuleButton';
import { createNewRule } from './createNewRule';

/**
 * @param {Object} props
 * @param {Object} props.rule - The rule configuration
 * @param {Function} props.onChange - Callback when rule changes
 * @param {Function} props.onRemove - Callback to remove this rule
 * @param {Object} props.schema - Domain schema
 * @param {Array} props.pressures - Available pressure definitions
 * @param {Array} props.eras - Available era definitions
 * @param {number} props.depth - Nesting depth for nested rules
 */
export function ApplicabilityRuleCard({ rule, onChange, onRemove, schema, pressures, eras, depth = 0 }) {
  const [expanded, setExpanded] = useState(false);
  const typeConfig = APPLICABILITY_TYPES[rule.type] || {};

  const entityKinds = schema?.entityKinds || [];
  const entityKindOptions = entityKinds.map((ek) => ({
    value: ek.kind,
    label: ek.description || ek.kind,
  }));

  // Get subtypes for selected entity kind
  const getSubtypesForKind = (kind) => {
    const ek = entityKinds.find((e) => e.kind === kind);
    if (!ek?.subtypes) return [];
    return ek.subtypes.map((st) => ({ value: st.id, label: st.name || st.id }));
  };

  const pressureOptions = (pressures || []).map((p) => ({
    value: p.id,
    label: p.name || p.id,
  }));

  const eraOptions = (eras || []).map((e) => ({
    value: e.id,
    label: e.name || e.id,
  }));

  const updateField = (field, value) => {
    onChange({ ...rule, [field]: value });
  };

  const getSummary = () => {
    switch (rule.type) {
      case 'entity_count_min':
        return `${rule.kind || '?'}${rule.subtype ? ':' + rule.subtype : ''} >= ${rule.min ?? '?'}`;
      case 'entity_count_max':
        return `${rule.kind || '?'}${rule.subtype ? ':' + rule.subtype : ''} <= ${rule.max ?? '?'}`;
      case 'pressure_threshold':
        return `${rule.pressureId || '?'} in [${rule.min ?? 0}, ${rule.max ?? 100}]`;
      case 'era_match':
        return rule.eras?.length ? rule.eras.join(', ') : 'No eras selected';
      case 'random_chance':
        return `${Math.round((rule.chance ?? 0.5) * 100)}% chance`;
      case 'cooldown_elapsed':
        return `${rule.cooldownTicks ?? '?'} ticks since last run`;
      case 'creations_per_epoch':
        return `max ${rule.maxPerEpoch ?? '?'} per epoch`;
      case 'or':
      case 'and':
        return `${rule.rules?.length || 0} sub-rules`;
      case 'pressure_any_above':
        return `Any of [${rule.pressureIds?.join(', ') || '?'}] > ${rule.threshold ?? '?'}`;
      case 'pressure_compare':
        return `${rule.pressureA || '?'} > ${rule.pressureB || '?'}`;
      default:
        return rule.type;
    }
  };

  const isNested = rule.type === 'or' || rule.type === 'and';

  return (
    <div className="condition-card">
      <div className="condition-card-header">
        <div className="condition-card-type">
          <div className="condition-card-icon" style={{ backgroundColor: `${typeConfig.color || '#3b82f6'}20` }}>
            {typeConfig.icon || '📋'}
          </div>
          <div>
            <div className="condition-card-label">{typeConfig.label || rule.type}</div>
            <div className="condition-card-summary">{getSummary()}</div>
          </div>
        </div>
        <div className="condition-card-actions">
          <button className="btn-icon" onClick={() => setExpanded(!expanded)}>
            {expanded ? '▲' : '▼'}
          </button>
          <button className="btn-icon btn-icon-danger" onClick={onRemove}>
            ×
          </button>
        </div>
      </div>

      {expanded && (
        <div style={{ marginTop: '12px' }}>
          <div className="form-grid">
            {(rule.type === 'entity_count_min' || rule.type === 'entity_count_max') && (
              <>
                <ReferenceDropdown
                  label="Entity Kind"
                  value={rule.kind}
                  onChange={(v) => {
                    updateField('kind', v);
                    // Clear subtype when kind changes
                    if (rule.subtype) updateField('subtype', undefined);
                  }}
                  options={entityKindOptions}
                />
                <ReferenceDropdown
                  label="Subtype (optional)"
                  value={rule.subtype || ''}
                  onChange={(v) => updateField('subtype', v || undefined)}
                  options={[{ value: '', label: 'Any' }, ...getSubtypesForKind(rule.kind)]}
                  placeholder="Any"
                />
                <div className="form-group">
                  <label className="label">{rule.type === 'entity_count_min' ? 'Minimum' : 'Maximum'}</label>
                  <NumberInput
                    value={rule.type === 'entity_count_min' ? rule.min : rule.max}
                    onChange={(v) => updateField(rule.type === 'entity_count_min' ? 'min' : 'max', v ?? 0)}
                    min={0}
                    integer
                  />
                </div>
              </>
            )}

            {rule.type === 'pressure_threshold' && (
              <>
                <ReferenceDropdown
                  label="Pressure"
                  value={rule.pressureId}
                  onChange={(v) => updateField('pressureId', v)}
                  options={pressureOptions}
                />
                <div className="form-group">
                  <label className="label">Min Value</label>
                  <NumberInput
                    value={rule.min}
                    onChange={(v) => updateField('min', v)}
                    min={-100}
                    max={100}
                    integer
                    allowEmpty
                    placeholder="0"
                  />
                </div>
                <div className="form-group">
                  <label className="label">Max Value</label>
                  <NumberInput
                    value={rule.max}
                    onChange={(v) => updateField('max', v)}
                    min={-100}
                    max={100}
                    integer
                    allowEmpty
                    placeholder="100"
                  />
                </div>
              </>
            )}

            {rule.type === 'era_match' && (
              <div style={{ gridColumn: '1 / -1' }}>
                <ChipSelect
                  label="Eras"
                  value={rule.eras || []}
                  onChange={(v) => updateField('eras', v)}
                  options={eraOptions}
                  placeholder="+ Add era"
                />
              </div>
            )}

            {rule.type === 'random_chance' && (
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="label">Chance (%)</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={Math.round((rule.chance ?? 0.5) * 100)}
                    onChange={(e) => updateField('chance', parseInt(e.target.value) / 100)}
                    style={{ flex: 1 }}
                  />
                  <NumberInput
                    value={Math.round((rule.chance ?? 0.5) * 100)}
                    onChange={(v) => updateField('chance', Math.max(0, Math.min(100, v ?? 0)) / 100)}
                    min={0}
                    max={100}
                    integer
                    style={{ width: '80px' }}
                  />
                  <span>%</span>
                </div>
              </div>
            )}

            {rule.type === 'cooldown_elapsed' && (
              <div className="form-group">
                <label className="label">Cooldown (ticks)</label>
                <NumberInput
                  value={rule.cooldownTicks}
                  onChange={(v) => updateField('cooldownTicks', v ?? 0)}
                  min={1}
                  integer
                  placeholder="10"
                />
              </div>
            )}

            {rule.type === 'creations_per_epoch' && (
              <div className="form-group">
                <label className="label">Max Creations Per Epoch</label>
                <NumberInput
                  value={rule.maxPerEpoch}
                  onChange={(v) => updateField('maxPerEpoch', v ?? 0)}
                  min={1}
                  integer
                  placeholder="3"
                />
              </div>
            )}

            {rule.type === 'pressure_any_above' && (
              <>
                <div style={{ gridColumn: '1 / -1' }}>
                  <ChipSelect
                    label="Pressures"
                    value={rule.pressureIds || []}
                    onChange={(v) => updateField('pressureIds', v)}
                    options={pressureOptions}
                    placeholder="+ Add pressure"
                  />
                </div>
                <div className="form-group">
                  <label className="label">Threshold</label>
                  <NumberInput
                    value={rule.threshold}
                    onChange={(v) => updateField('threshold', v ?? 0)}
                    min={0}
                    max={100}
                    integer
                    placeholder="50"
                  />
                </div>
              </>
            )}

            {rule.type === 'pressure_compare' && (
              <>
                <ReferenceDropdown
                  label="Pressure A"
                  value={rule.pressureA}
                  onChange={(v) => updateField('pressureA', v)}
                  options={pressureOptions}
                />
                <div className="form-group" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: '1.5rem', color: '#94a3b8' }}>&gt;</span>
                </div>
                <ReferenceDropdown
                  label="Pressure B"
                  value={rule.pressureB}
                  onChange={(v) => updateField('pressureB', v)}
                  options={pressureOptions}
                />
              </>
            )}
          </div>
        </div>
      )}

      {isNested && (
        <div className="condition-card-nested">
          {(rule.rules || []).map((subRule, idx) => (
            <ApplicabilityRuleCard
              key={idx}
              rule={subRule}
              onChange={(updated) => {
                const newRules = [...(rule.rules || [])];
                newRules[idx] = updated;
                updateField('rules', newRules);
              }}
              onRemove={() => updateField('rules', (rule.rules || []).filter((_, i) => i !== idx))}
              schema={schema}
              pressures={pressures}
              eras={eras}
              depth={depth + 1}
            />
          ))}
          <AddRuleButton
            onAdd={(type) => {
              const newRule = createNewRule(type, pressures);
              updateField('rules', [...(rule.rules || []), newRule]);
            }}
            depth={depth + 1}
          />
        </div>
      )}
    </div>
  );
}

export default ApplicabilityRuleCard;
