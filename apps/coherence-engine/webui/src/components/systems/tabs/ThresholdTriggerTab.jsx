/**
 * ThresholdTriggerTab - Configuration for threshold trigger systems
 */

import React, { useState } from 'react';
import { CLUSTER_MODES, CONDITION_TYPES, ACTION_TYPES, DIRECTIONS } from '../constants';
import { ReferenceDropdown, NumberInput } from '../../shared';
import TagSelector from '@lore-weave/shared-components/TagSelector';
import { SelectionFiltersEditor } from '../../generators/filters/SelectionFiltersEditor';

/**
 * ConditionCard - Expandable card for condition configuration
 */
function ConditionCard({ condition, onChange, onRemove, schema }) {
  const [expanded, setExpanded] = useState(false);

  const entityKindOptions = (schema?.entityKinds || []).map((ek) => ({
    value: ek.kind,
    label: ek.description || ek.kind,
  }));

  const relationshipKindOptions = (schema?.relationshipKinds || []).map((rk) => ({
    value: rk.kind,
    label: rk.description || rk.kind,
  }));
  const tagRegistry = schema?.tagRegistry || [];

  const update = (field, value) => {
    onChange({ ...condition, [field]: value });
  };

  const getSummary = () => {
    switch (condition.type) {
      case 'relationship_count':
        return `${condition.relationshipKind || 'any'} count ${condition.minCount !== undefined ? `>= ${condition.minCount}` : ''} ${condition.maxCount !== undefined ? `<= ${condition.maxCount}` : ''}`;
      case 'relationship_exists': {
        let summary = `has ${condition.relationshipKind || '?'} relationship`;
        if (condition.targetKind) summary += ` to ${condition.targetKind}`;
        if (condition.targetStatus) summary += ` (${condition.targetStatus})`;
        return summary;
      }
      case 'entity_status':
        return condition.notStatus ? `status != ${condition.notStatus}` : `status = ${condition.status || '?'}`;
      case 'tag_exists':
        return `has tag "${condition.tag || '?'}"`;
      case 'tag_absent':
        return `missing tag "${condition.tag || '?'}"`;
      case 'pressure_above':
        return `${condition.pressureId || '?'} > ${condition.threshold ?? '?'}`;
      case 'pressure_below':
        return `${condition.pressureId || '?'} < ${condition.threshold ?? '?'}`;
      case 'time_since_update':
        return `${condition.minTicks || '?'} ticks since update`;
      case 'connection_count':
        return `connections ${condition.minConnections !== undefined ? `>= ${condition.minConnections}` : ''} ${condition.maxConnections !== undefined ? `<= ${condition.maxConnections}` : ''}`;
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
            {condition.type === 'relationship_exists' && (
              <>
                <ReferenceDropdown
                  label="Target Kind"
                  value={condition.targetKind}
                  onChange={(v) => update('targetKind', v)}
                  options={entityKindOptions}
                  placeholder="Any"
                />
                <div className="form-group">
                  <label className="label">Target Status</label>
                  <input
                    type="text"
                    value={condition.targetStatus || ''}
                    onChange={(e) => update('targetStatus', e.target.value || undefined)}
                    className="input"
                    placeholder="Any"
                  />
                </div>
              </>
            )}
            {condition.type === 'relationship_count' && (
              <>
                <div className="form-group">
                  <label className="label">Min Count</label>
                  <NumberInput
                    value={condition.minCount}
                    onChange={(v) => update('minCount', v)}
                    min={0}
                    integer
                    allowEmpty
                  />
                </div>
                <div className="form-group">
                  <label className="label">Max Count</label>
                  <NumberInput
                    value={condition.maxCount}
                    onChange={(v) => update('maxCount', v)}
                    min={0}
                    integer
                    allowEmpty
                  />
                </div>
              </>
            )}
            {condition.type === 'time_since_update' && (
              <div className="form-group">
                <label className="label">Min Ticks</label>
                <NumberInput
                  value={condition.minTicks}
                  onChange={(v) => update('minTicks', v)}
                  min={0}
                  integer
                  allowEmpty
                />
              </div>
            )}
            {(condition.type === 'tag_exists' || condition.type === 'tag_absent') && (
              <div className="form-group">
                <label className="label">Tag</label>
                <TagSelector
                  value={condition.tag ? [condition.tag] : []}
                  onChange={(tags) => update('tag', tags[0] || '')}
                  tagRegistry={tagRegistry}
                  placeholder="Select tag..."
                  singleSelect
                />
              </div>
            )}
            {condition.type === 'entity_status' && (
              <>
                <div className="form-group">
                  <label className="label">Status</label>
                  <input
                    type="text"
                    value={condition.status || ''}
                    onChange={(e) => update('status', e.target.value || undefined)}
                    className="input"
                    placeholder="Required status"
                  />
                </div>
                <div className="form-group">
                  <label className="label">Not Status</label>
                  <input
                    type="text"
                    value={condition.notStatus || ''}
                    onChange={(e) => update('notStatus', e.target.value || undefined)}
                    className="input"
                    placeholder="Excluded status"
                  />
                </div>
              </>
            )}
            {(condition.type === 'pressure_above' || condition.type === 'pressure_below') && (
              <>
                <div className="form-group">
                  <label className="label">Pressure ID</label>
                  <input
                    type="text"
                    value={condition.pressureId || ''}
                    onChange={(e) => update('pressureId', e.target.value)}
                    className="input"
                  />
                </div>
                <div className="form-group">
                  <label className="label">Threshold</label>
                  <NumberInput
                    value={condition.threshold}
                    onChange={(v) => update('threshold', v)}
                    allowEmpty
                  />
                </div>
              </>
            )}
            {condition.type === 'connection_count' && (
              <>
                <div className="form-group">
                  <label className="label">Min Connections</label>
                  <NumberInput
                    value={condition.minConnections}
                    onChange={(v) => update('minConnections', v)}
                    min={0}
                    integer
                    allowEmpty
                  />
                </div>
                <div className="form-group">
                  <label className="label">Max Connections</label>
                  <NumberInput
                    value={condition.maxConnections}
                    onChange={(v) => update('maxConnections', v)}
                    min={0}
                    integer
                    allowEmpty
                  />
                </div>
              </>
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
  const tagRegistry = schema?.tagRegistry || [];

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
      case 'modify_pressure':
        return `${action.pressureId || '?'} ${action.delta >= 0 ? '+' : ''}${action.delta ?? '?'}`;
      case 'create_relationship':
        return `create ${action.relationshipKind || '?'}${action.betweenMatching ? ' (all pairs)' : ''}`;
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
                <TagSelector
                  value={action.tag ? [action.tag] : []}
                  onChange={(tags) => update('tag', tags[0] || '')}
                  tagRegistry={tagRegistry}
                  placeholder="Select tag..."
                  singleSelect
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
              <>
                <ReferenceDropdown
                  label="Relationship Kind"
                  value={action.relationshipKind}
                  onChange={(v) => update('relationshipKind', v)}
                  options={relationshipKindOptions}
                />
                <div className="form-group">
                  <label className="label">Strength</label>
                  <NumberInput
                    value={action.relationshipStrength}
                    onChange={(v) => update('relationshipStrength', v)}
                    min={0}
                    max={1}
                    allowEmpty
                    placeholder="0.5"
                  />
                </div>
                <div className="form-group">
                  <label className="label">
                    <input
                      type="checkbox"
                      checked={action.betweenMatching || false}
                      onChange={(e) => update('betweenMatching', e.target.checked)}
                      style={{ marginRight: '8px' }}
                    />
                    Between All Matching
                  </label>
                </div>
              </>
            )}
            {action.type === 'modify_pressure' && (
              <>
                <div className="form-group">
                  <label className="label">Pressure ID</label>
                  <input
                    type="text"
                    value={action.pressureId || ''}
                    onChange={(e) => update('pressureId', e.target.value)}
                    className="input"
                  />
                </div>
                <div className="form-group">
                  <label className="label">Delta</label>
                  <NumberInput
                    value={action.delta}
                    onChange={(v) => update('delta', v ?? 0)}
                  />
                </div>
              </>
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
            value={config.entityFilter?.kind || 'any'}
            onChange={(v) => updateEntityFilter('kind', v)}
            options={[{ value: 'any', label: 'All Kinds' }, ...entityKindOptions]}
          />
          {config.entityFilter?.kind && config.entityFilter?.kind !== 'any' && (
            <ReferenceDropdown
              label="Status"
              value={config.entityFilter?.status}
              onChange={(v) => updateEntityFilter('status', v)}
              options={getStatusOptions(config.entityFilter.kind)}
              placeholder="Any"
            />
          )}
        </div>

        <div className="mt-xl">
          <div className="section-subtitle">Advanced Selection Filters</div>
          <div className="section-desc">
            Filter entities by tags, relationships, prominence, culture, and more.
          </div>
          <SelectionFiltersEditor
            filters={config.entityFilter?.filters || []}
            onChange={(v) => updateEntityFilter('filters', v.length > 0 ? v : undefined)}
            schema={schema}
            availableRefs={[]}
          />
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
