/**
 * ThresholdTriggerTab - Configuration for threshold trigger systems
 */

import React, { useState } from 'react';
import { CLUSTER_MODES, CONDITION_TYPES, ACTION_TYPES, DIRECTIONS } from '../constants';
import { ReferenceDropdown } from '../../shared';

/**
 * ConditionCard - Expandable card for condition configuration
 */
function ConditionCard({ condition, onChange, onRemove, schema }) {
  const [expanded, setExpanded] = useState(false);

  const relationshipKindOptions = (schema?.relationshipKinds || []).map((rk) => ({
    value: rk.kind,
    label: rk.description || rk.kind,
  }));

  const update = (field, value) => {
    onChange({ ...condition, [field]: value });
  };

  const getSummary = () => {
    switch (condition.type) {
      case 'relationship_count':
        return `${condition.relationshipKind || 'any'} count ${condition.minCount !== undefined ? `>= ${condition.minCount}` : ''} ${condition.maxCount !== undefined ? `<= ${condition.maxCount}` : ''}`;
      case 'time_since_update':
        return `${condition.minTicks || '?'} ticks since update`;
      case 'has_tag':
      case 'has_any_tag':
        return `has tag ${condition.tag || condition.tags?.join(', ') || '?'}`;
      case 'tag_absent':
        return `missing tag ${condition.tag || '?'}`;
      default:
        return condition.type;
    }
  };

  return (
    <div className="item-card">
      <div className="item-card-header" onClick={() => setExpanded(!expanded)}>
        <div className="item-card-icon" style={{ backgroundColor: 'rgba(34, 197, 94, 0.2)' }}>C</div>
        <div className="item-card-info">
          <div className="item-card-title">{condition.type}</div>
          <div className="item-card-subtitle">{getSummary()}</div>
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
              label="Condition Type"
              value={condition.type}
              onChange={(v) => update('type', v)}
              options={CONDITION_TYPES}
            />
            {(condition.type === 'relationship_count' || condition.type === 'relationship_exists') && (
              <>
                <ReferenceDropdown
                  label="Relationship Kind"
                  value={condition.relationshipKind}
                  onChange={(v) => update('relationshipKind', v)}
                  options={relationshipKindOptions}
                />
                <ReferenceDropdown
                  label="Direction"
                  value={condition.relationshipDirection || 'both'}
                  onChange={(v) => update('relationshipDirection', v)}
                  options={DIRECTIONS}
                />
              </>
            )}
            {condition.type === 'relationship_count' && (
              <>
                <div className="form-group">
                  <label className="label">Min Count</label>
                  <input
                    type="number"
                    value={condition.minCount ?? ''}
                    onChange={(e) => update('minCount', parseInt(e.target.value) || undefined)}
                    className="input"
                    min="0"
                  />
                </div>
                <div className="form-group">
                  <label className="label">Max Count</label>
                  <input
                    type="number"
                    value={condition.maxCount ?? ''}
                    onChange={(e) => update('maxCount', parseInt(e.target.value) || undefined)}
                    className="input"
                    min="0"
                  />
                </div>
              </>
            )}
            {condition.type === 'time_since_update' && (
              <div className="form-group">
                <label className="label">Min Ticks</label>
                <input
                  type="number"
                  value={condition.minTicks ?? ''}
                  onChange={(e) => update('minTicks', parseInt(e.target.value) || undefined)}
                  className="input"
                  min="0"
                />
              </div>
            )}
            {(condition.type === 'has_tag' || condition.type === 'tag_absent') && (
              <div className="form-group">
                <label className="label">Tag</label>
                <input
                  type="text"
                  value={condition.tag || ''}
                  onChange={(e) => update('tag', e.target.value)}
                  className="input"
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * ActionCard - Expandable card for action configuration
 */
function ActionCard({ action, onChange, onRemove, schema }) {
  const [expanded, setExpanded] = useState(false);

  const relationshipKindOptions = (schema?.relationshipKinds || []).map((rk) => ({
    value: rk.kind,
    label: rk.description || rk.kind,
  }));

  const update = (field, value) => {
    onChange({ ...action, [field]: value });
  };

  const getSummary = () => {
    switch (action.type) {
      case 'set_tag':
      case 'set_cluster_tag':
        return `${action.tag} = ${action.tagValue !== undefined ? String(action.tagValue) : 'true'}`;
      case 'remove_tag':
        return `remove ${action.tag}`;
      case 'create_relationship':
        return `create ${action.relationshipKind}`;
      default:
        return action.type;
    }
  };

  return (
    <div className="item-card">
      <div className="item-card-header" onClick={() => setExpanded(!expanded)}>
        <div className="item-card-icon" style={{ backgroundColor: 'rgba(245, 158, 11, 0.2)' }}>A</div>
        <div className="item-card-info">
          <div className="item-card-title">{action.type}</div>
          <div className="item-card-subtitle">{getSummary()}</div>
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
              label="Action Type"
              value={action.type}
              onChange={(v) => update('type', v)}
              options={ACTION_TYPES}
            />
            {(action.type === 'set_tag' || action.type === 'set_cluster_tag' || action.type === 'remove_tag') && (
              <div className="form-group">
                <label className="label">Tag</label>
                <input
                  type="text"
                  value={action.tag || ''}
                  onChange={(e) => update('tag', e.target.value)}
                  className="input"
                />
              </div>
            )}
            {(action.type === 'set_tag' || action.type === 'set_cluster_tag') && (
              <div className="form-group">
                <label className="label">Tag Value</label>
                <input
                  type="text"
                  value={action.tagValue !== undefined ? String(action.tagValue) : ''}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === 'true') update('tagValue', true);
                    else if (v === 'false') update('tagValue', false);
                    else if (!isNaN(Number(v)) && v !== '') update('tagValue', Number(v));
                    else update('tagValue', v || undefined);
                  }}
                  className="input"
                  placeholder="true"
                />
              </div>
            )}
            {action.type === 'create_relationship' && (
              <ReferenceDropdown
                label="Relationship Kind"
                value={action.relationshipKind}
                onChange={(v) => update('relationshipKind', v)}
                options={relationshipKindOptions}
              />
            )}
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
export function ThresholdTriggerTab({ system, onChange, schema }) {
  const config = system.config || {};

  const entityKindOptions = (schema?.entityKinds || []).map((ek) => ({
    value: ek.kind,
    label: ek.description || ek.kind,
  }));

  const relationshipKindOptions = (schema?.relationshipKinds || []).map((rk) => ({
    value: rk.kind,
    label: rk.description || rk.kind,
  }));

  const getStatusOptions = (kind) => {
    const ek = (schema?.entityKinds || []).find((e) => e.kind === kind);
    if (!ek?.statuses) return [];
    return ek.statuses.map((st) => ({ value: st.id, label: st.name || st.id }));
  };

  const updateConfig = (field, value) => {
    onChange({ ...system, config: { ...config, [field]: value } });
  };

  const updateEntityFilter = (field, value) => {
    updateConfig('entityFilter', { ...config.entityFilter, [field]: value });
  };

  // Conditions
  const conditions = config.conditions || [];

  const addCondition = () => {
    updateConfig('conditions', [...conditions, { type: 'relationship_count', minCount: 1 }]);
  };

  const updateCondition = (index, cond) => {
    const newConditions = [...conditions];
    newConditions[index] = cond;
    updateConfig('conditions', newConditions);
  };

  const removeCondition = (index) => {
    updateConfig('conditions', conditions.filter((_, i) => i !== index));
  };

  // Actions
  const actions = config.actions || [];

  const addAction = () => {
    updateConfig('actions', [...actions, { type: 'set_tag', tag: '' }]);
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
        <div className="section-title">Entity Filter</div>
        <div className="form-grid">
          <ReferenceDropdown
            label="Kind"
            value={config.entityFilter?.kind}
            onChange={(v) => updateEntityFilter('kind', v)}
            options={entityKindOptions}
          />
          {config.entityFilter?.kind && (
            <ReferenceDropdown
              label="Status"
              value={config.entityFilter?.status}
              onChange={(v) => updateEntityFilter('status', v)}
              options={[{ value: '', label: 'Any' }, ...getStatusOptions(config.entityFilter.kind)]}
            />
          )}
          <div className="form-group">
            <label className="label">Has Tag</label>
            <input
              type="text"
              value={config.entityFilter?.hasTag || ''}
              onChange={(e) => updateEntityFilter('hasTag', e.target.value || undefined)}
              className="input"
              placeholder="Optional"
            />
          </div>
          <div className="form-group">
            <label className="label">Not Has Tag</label>
            <input
              type="text"
              value={config.entityFilter?.notHasTag || ''}
              onChange={(e) => updateEntityFilter('notHasTag', e.target.value || undefined)}
              className="input"
              placeholder="Optional"
            />
          </div>
        </div>
      </div>

      <div className="section">
        <div className="section-title">Conditions ({conditions.length})</div>

        {conditions.map((cond, index) => (
          <ConditionCard
            key={index}
            condition={cond}
            onChange={(c) => updateCondition(index, c)}
            onRemove={() => removeCondition(index)}
            schema={schema}
          />
        ))}

        <button
          className="btn-add"
          onClick={addCondition}
        >
          + Add Condition
        </button>
      </div>

      <div className="section">
        <div className="section-title">Actions ({actions.length})</div>

        {actions.map((action, index) => (
          <ActionCard
            key={index}
            action={action}
            onChange={(a) => updateAction(index, a)}
            onRemove={() => removeAction(index)}
            schema={schema}
          />
        ))}

        <button
          className="btn-add"
          onClick={addAction}
        >
          + Add Action
        </button>
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
                <input
                  type="number"
                  value={config.minClusterSize ?? ''}
                  onChange={(e) => updateConfig('minClusterSize', parseInt(e.target.value) || undefined)}
                  className="input"
                  min="1"
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
