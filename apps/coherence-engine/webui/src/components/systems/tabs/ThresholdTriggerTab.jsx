/**
 * ThresholdTriggerTab - Configuration for threshold trigger systems
 */

import React from 'react';
import { CLUSTER_MODES } from '../constants';
import { ReferenceDropdown, NumberInput } from '../../shared';
import { ApplicabilityRuleCard } from '../../generators/applicability/ApplicabilityRuleCard';
import { AddRuleButton } from '../../generators/applicability/AddRuleButton';
import { createNewRule } from '../../generators/applicability/createNewRule';
import MutationCard, { DEFAULT_MUTATION_TYPES } from '../../shared/MutationCard';

const TRIGGER_MUTATION_TYPES = DEFAULT_MUTATION_TYPES;

/**
 * @param {Object} props
 * @param {Object} props.system - The system being edited
 * @param {Function} props.onChange - Called when system changes
 * @param {Object} props.schema - Domain schema
 * @param {Array} props.pressures - Pressure definitions
 */
export function ThresholdTriggerTab({ system, onChange, schema, pressures }) {
  const config = system.config || {};

  const relationshipKindOptions = (schema?.relationshipKinds || []).map((rk) => ({
    value: rk.kind,
    label: rk.description || rk.kind,
  }));

  const updateConfig = (field, value) => {
    onChange({ ...system, config: { ...config, [field]: value } });
  };


  // Conditions
  const conditions = config.conditions || [];

  const addCondition = (type) => {
    const newRule = createNewRule(type, pressures);
    updateConfig('conditions', [...conditions, newRule]);
  };

  const updateCondition = (index, cond) => {
    const newConditions = [...conditions];
    newConditions[index] = cond;
    updateConfig('conditions', newConditions);
  };

  const removeCondition = (index) => {
    updateConfig('conditions', conditions.filter((_, i) => i !== index));
  };

  // Actions (mutations)
  const actions = config.actions || [];

  const createAction = (type) => {
    const defaultPressure = pressures?.[0]?.id || '';
    switch (type) {
      case 'modify_pressure':
        return { type: 'modify_pressure', pressureId: defaultPressure, delta: 0 };
      case 'set_tag':
        return { type: 'set_tag', entity: '$self', tag: '', value: true };
      case 'remove_tag':
        return { type: 'remove_tag', entity: '$self', tag: '' };
      case 'change_status':
        return { type: 'change_status', entity: '$self', newStatus: '' };
      case 'adjust_prominence':
        return { type: 'adjust_prominence', entity: '$self', direction: 'up' };
      case 'archive_relationship':
        return { type: 'archive_relationship', entity: '$self', relationshipKind: '', direction: 'both' };
      case 'adjust_relationship_strength':
        return { type: 'adjust_relationship_strength', kind: '', src: '$self', dst: '$self', delta: 0.1 };
      case 'update_rate_limit':
        return { type: 'update_rate_limit' };
      case 'create_relationship':
      default:
        return { type: 'create_relationship', kind: '', src: '$self', dst: '$self', strength: 0.5 };
    }
  };

  const addAction = (type) => {
    updateConfig('actions', [...actions, createAction(type)]);
  };

  const updateAction = (index, action) => {
    const newActions = [...actions];
    newActions[index] = action;
    updateConfig('actions', newActions);
  };

  const removeAction = (index) => {
    updateConfig('actions', actions.filter((_, i) => i !== index));
  };

  return (
    <div>
      <div className="section">
        <div className="section-title">Conditions ({conditions.length})</div>
        <div className="section-desc">
          All conditions must pass for an entity to be included in the trigger.
        </div>

        {conditions.length === 0 ? (
          <div className="empty-state-compact">No conditions defined.</div>
        ) : (
          conditions.map((cond, index) => (
            <ApplicabilityRuleCard
              key={index}
              rule={cond}
              onChange={(c) => updateCondition(index, c)}
              onRemove={() => removeCondition(index)}
              schema={schema}
              pressures={pressures}
            />
          ))
        )}

        <AddRuleButton onAdd={addCondition} />
      </div>

      <div className="section">
        <div className="section-title">Actions ({actions.length})</div>
        <div className="section-desc">
          Mutations applied to each matching entity (or clusters when configured).
        </div>

        {actions.map((actionItem, index) => (
          <div key={index} style={{ marginBottom: '12px' }}>
            <MutationCard
              mutation={actionItem}
              onChange={(a) => updateAction(index, a)}
              onRemove={() => removeAction(index)}
              schema={schema}
              pressures={pressures}
              entityOptions={[
                { value: '$self', label: '$self' },
                { value: '$member', label: '$member' },
                { value: '$member2', label: '$member2' },
              ]}
              typeOptions={TRIGGER_MUTATION_TYPES}
              createMutation={createAction}
              titlePrefix="Action"
            />
            {actionItem.type === 'create_relationship' && (
              <label className="checkbox-label" style={{ marginTop: '8px' }}>
                <input
                  type="checkbox"
                  checked={actionItem.betweenMatching || false}
                  onChange={(e) => updateAction(index, { ...actionItem, betweenMatching: e.target.checked })}
                  className="checkbox"
                />
                Between matching entities
              </label>
            )}
          </div>
        ))}

        <div className="form-group" style={{ marginTop: '12px' }}>
          <select
            className="select"
            value=""
            onChange={(e) => {
              if (!e.target.value) return;
              addAction(e.target.value);
            }}
          >
            <option value="">+ Add action...</option>
            {TRIGGER_MUTATION_TYPES.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="section">
        <div className="section-title">Clustering</div>
        <div className="form-grid">
          <ReferenceDropdown
            label="Cluster Mode"
            value={config.clusterMode || 'individual'}
            onChange={(v) => updateConfig('clusterMode', v)}
            options={CLUSTER_MODES}
          />
          {config.clusterMode === 'by_relationship' && (
            <>
              <ReferenceDropdown
                label="Cluster Relationship"
                value={config.clusterRelationshipKind}
                onChange={(v) => updateConfig('clusterRelationshipKind', v)}
                options={relationshipKindOptions}
              />
              <div className="form-group">
                <label className="label">Min Cluster Size</label>
                <NumberInput
                  value={config.minClusterSize}
                  onChange={(v) => updateConfig('minClusterSize', v)}
                  min={1}
                  integer
                  allowEmpty
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
