/**
 * MutationCard - Edit a single mutation entry
 */

import React from 'react';
import { ReferenceDropdown, NumberInput } from './index';
import TagSelector from '@lore-weave/shared-components/TagSelector';

export const DEFAULT_MUTATION_TYPES = [
  { value: 'set_tag', label: 'Set Tag' },
  { value: 'remove_tag', label: 'Remove Tag' },
  { value: 'create_relationship', label: 'Create Relationship' },
  { value: 'adjust_relationship_strength', label: 'Adjust Relationship Strength' },
  { value: 'archive_relationship', label: 'Archive Relationship' },
  { value: 'change_status', label: 'Change Status' },
  { value: 'adjust_prominence', label: 'Adjust Prominence' },
  { value: 'modify_pressure', label: 'Modify Pressure' },
];

const DIRECTION_OPTIONS = [
  { value: 'both', label: 'Both' },
  { value: 'src', label: 'Source (outgoing)' },
  { value: 'dst', label: 'Destination (incoming)' },
];

function normalizeOptions(options) {
  return (options || []).map((opt) => {
    if (typeof opt === 'string') return { value: opt, label: opt };
    return opt;
  });
}

function parseTagValue(value) {
  if (value === '') return undefined;
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (!Number.isNaN(Number(value))) return Number(value);
  return value;
}

export function MutationCard({
  mutation,
  onChange,
  onRemove,
  schema,
  pressures,
  entityOptions,
  typeOptions,
  createMutation,
  titlePrefix,
}) {
  const types = typeOptions || DEFAULT_MUTATION_TYPES;
  const entityRefs = normalizeOptions(entityOptions);
  const relationshipKindOptions = (schema?.relationshipKinds || []).map((rk) => ({
    value: rk.kind,
    label: rk.description || rk.kind,
  }));
  const pressureOptions = (pressures || []).map((p) => ({
    value: p.id,
    label: p.name || p.id,
  }));
  const tagRegistry = schema?.tagRegistry || [];

  const update = (field, value) => {
    onChange({ ...mutation, [field]: value });
  };

  const updateType = (value) => {
    if (createMutation) {
      onChange(createMutation(value));
      return;
    }
    update('type', value);
  };

  const headerLabel = types.find((t) => t.value === mutation.type)?.label || mutation.type;

  return (
    <div className="item-card">
      <div className="item-card-header">
        <div className="item-card-icon" style={{ backgroundColor: 'rgba(59, 130, 246, 0.15)' }}>M</div>
        <div className="item-card-info">
          <div className="item-card-title">{titlePrefix ? `${titlePrefix}: ${headerLabel}` : headerLabel}</div>
        </div>
        {onRemove && (
          <div className="item-card-actions">
            <button className="btn-icon btn-icon-danger" onClick={onRemove}>×</button>
          </div>
        )}
      </div>

      <div className="item-card-body">
        <div className="form-grid">
          <ReferenceDropdown
            label="Type"
            value={mutation.type}
            onChange={updateType}
            options={types}
          />

          {mutation.type === 'modify_pressure' && (
            <>
              <ReferenceDropdown
                label="Pressure"
                value={mutation.pressureId || ''}
                onChange={(v) => update('pressureId', v)}
                options={pressureOptions}
                placeholder="Select pressure..."
              />
              <div className="form-group">
                <label className="label">Delta</label>
                <NumberInput
                  value={mutation.delta}
                  onChange={(v) => update('delta', v ?? 0)}
                />
              </div>
            </>
          )}

          {(mutation.type === 'set_tag' || mutation.type === 'remove_tag') && (
            <>
              <ReferenceDropdown
                label="Entity"
                value={mutation.entity || ''}
                onChange={(v) => update('entity', v)}
                options={entityRefs}
                placeholder="Select entity..."
              />
              <div className="form-group">
                <label className="label">Tag</label>
                <TagSelector
                  value={mutation.tag ? [mutation.tag] : []}
                  onChange={(tags) => update('tag', tags[0] || '')}
                  tagRegistry={tagRegistry}
                  placeholder="Select tag..."
                  singleSelect
                />
              </div>
            </>
          )}

          {mutation.type === 'set_tag' && (
            <>
              <div className="form-group">
                <label className="label">Value (optional)</label>
                <input
                  type="text"
                  value={mutation.value !== undefined ? String(mutation.value) : ''}
                  onChange={(e) => update('value', parseTagValue(e.target.value))}
                  className="input"
                  placeholder="true"
                  disabled={Boolean(mutation.valueFrom)}
                />
              </div>
              <div className="form-group">
                <label className="label">Value Source (optional)</label>
                <input
                  type="text"
                  value={mutation.valueFrom || ''}
                  onChange={(e) => update('valueFrom', e.target.value || undefined)}
                  className="input"
                  placeholder="e.g., cluster_id"
                />
              </div>
            </>
          )}

          {mutation.type === 'change_status' && (
            <>
              <ReferenceDropdown
                label="Entity"
                value={mutation.entity || ''}
                onChange={(v) => update('entity', v)}
                options={entityRefs}
                placeholder="Select entity..."
              />
              <div className="form-group">
                <label className="label">New Status</label>
                <input
                  type="text"
                  value={mutation.newStatus || ''}
                  onChange={(e) => update('newStatus', e.target.value || undefined)}
                  className="input"
                  placeholder="e.g., active"
                />
              </div>
            </>
          )}

          {mutation.type === 'adjust_prominence' && (
            <>
              <ReferenceDropdown
                label="Entity"
                value={mutation.entity || ''}
                onChange={(v) => update('entity', v)}
                options={entityRefs}
                placeholder="Select entity..."
              />
              <ReferenceDropdown
                label="Direction"
                value={mutation.direction || 'up'}
                onChange={(v) => update('direction', v)}
                options={[
                  { value: 'up', label: 'Up' },
                  { value: 'down', label: 'Down' },
                ]}
              />
            </>
          )}

          {mutation.type === 'create_relationship' && (
            <>
              <ReferenceDropdown
                label="Relationship Kind"
                value={mutation.kind || ''}
                onChange={(v) => update('kind', v)}
                options={relationshipKindOptions}
                placeholder="Select relationship..."
              />
              <ReferenceDropdown
                label="Source"
                value={mutation.src || ''}
                onChange={(v) => update('src', v)}
                options={entityRefs}
                placeholder="Select source..."
              />
              <ReferenceDropdown
                label="Destination"
                value={mutation.dst || ''}
                onChange={(v) => update('dst', v)}
                options={entityRefs}
                placeholder="Select destination..."
              />
              <div className="form-group">
                <label className="label">Strength</label>
                <NumberInput
                  value={mutation.strength}
                  onChange={(v) => update('strength', v)}
                  min={0}
                  max={1}
                  allowEmpty
                />
              </div>
              <div className="form-group">
                <label className="label">Category (optional)</label>
                <input
                  type="text"
                  value={mutation.category || ''}
                  onChange={(e) => update('category', e.target.value || undefined)}
                  className="input"
                  placeholder="Optional"
                />
              </div>
              <div className="form-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={mutation.bidirectional || false}
                    onChange={(e) => update('bidirectional', e.target.checked || undefined)}
                    className="checkbox"
                  />
                  Bidirectional
                </label>
              </div>
            </>
          )}

          {mutation.type === 'adjust_relationship_strength' && (
            <>
              <ReferenceDropdown
                label="Relationship Kind"
                value={mutation.kind || ''}
                onChange={(v) => update('kind', v)}
                options={relationshipKindOptions}
                placeholder="Select relationship..."
              />
              <ReferenceDropdown
                label="Source"
                value={mutation.src || ''}
                onChange={(v) => update('src', v)}
                options={entityRefs}
                placeholder="Select source..."
              />
              <ReferenceDropdown
                label="Destination"
                value={mutation.dst || ''}
                onChange={(v) => update('dst', v)}
                options={entityRefs}
                placeholder="Select destination..."
              />
              <div className="form-group">
                <label className="label">Delta</label>
                <NumberInput
                  value={mutation.delta}
                  onChange={(v) => update('delta', v ?? 0)}
                />
              </div>
              <div className="form-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={mutation.bidirectional || false}
                    onChange={(e) => update('bidirectional', e.target.checked || undefined)}
                    className="checkbox"
                  />
                  Bidirectional
                </label>
              </div>
            </>
          )}

          {mutation.type === 'archive_relationship' && (
            <>
              <ReferenceDropdown
                label="Entity"
                value={mutation.entity || ''}
                onChange={(v) => update('entity', v)}
                options={entityRefs}
                placeholder="Select entity..."
              />
              <ReferenceDropdown
                label="Relationship Kind"
                value={mutation.relationshipKind || ''}
                onChange={(v) => update('relationshipKind', v)}
                options={relationshipKindOptions}
                placeholder="Select relationship..."
              />
              <ReferenceDropdown
                label="With Entity (optional)"
                value={mutation.with || ''}
                onChange={(v) => update('with', v || undefined)}
                options={[{ value: '', label: 'Any entity' }, ...entityRefs]}
              />
              <ReferenceDropdown
                label="Direction"
                value={mutation.direction || 'both'}
                onChange={(v) => update('direction', v)}
                options={DIRECTION_OPTIONS}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default MutationCard;
