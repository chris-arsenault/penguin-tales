/**
 * MutationCard - Edit a single mutation entry
 */

import React, { useState } from 'react';
import { ReferenceDropdown, NumberInput } from './index';
import TagSelector from '@lore-weave/shared-components/TagSelector';
import { MUTATION_TYPE_META, MUTATION_TYPE_ORDER } from '../actions/constants';

export const DEFAULT_MUTATION_TYPES = [
  ...MUTATION_TYPE_ORDER.map((key) => ({
    value: key,
    label: MUTATION_TYPE_META[key]?.label || key,
  })),
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

function formatDelta(delta) {
  if (delta === undefined || delta === null || Number.isNaN(delta)) return '0';
  const numeric = Number(delta);
  if (Number.isNaN(numeric)) return String(delta);
  return `${numeric >= 0 ? '+' : ''}${numeric}`;
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
  const [expanded, setExpanded] = useState(false);
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

  const fallbackLabel = types.find((t) => t.value === mutation.type)?.label
    || MUTATION_TYPE_META[mutation.type]?.label
    || mutation.type;
  const typeMeta = MUTATION_TYPE_META[mutation.type] || { icon: '?', color: '#6b7280' };
  const headerLabel = titlePrefix ? `${titlePrefix}: ${fallbackLabel}` : fallbackLabel;

  const getSummary = () => {
    switch (mutation.type) {
      case 'modify_pressure':
        return `${mutation.pressureId || '?'} ${formatDelta(mutation.delta)}`;
      case 'set_tag': {
        const value = mutation.value !== undefined ? ` = ${mutation.value}` : '';
        return `${mutation.entity || '?'} tag ${mutation.tag || '?'}${value}`;
      }
      case 'remove_tag':
        return `${mutation.entity || '?'} remove ${mutation.tag || '?'}`;
      case 'change_status':
        return `${mutation.entity || '?'} -> ${mutation.newStatus || '?'}`;
      case 'adjust_prominence':
        return `${mutation.entity || '?'} ${mutation.direction || 'up'}`;
      case 'archive_relationship': {
        const withLabel = mutation.with ? ` with ${mutation.with}` : '';
        return `${mutation.entity || '?'} ${mutation.relationshipKind || '?'}${withLabel}`;
      }
      case 'adjust_relationship_strength':
        return `${mutation.kind || '?'} ${mutation.src || '?'} -> ${mutation.dst || '?'} ${formatDelta(mutation.delta)}`;
      case 'create_relationship': {
        const arrow = mutation.bidirectional ? '<->' : '->';
        return `${mutation.kind || '?'} ${mutation.src || '?'} ${arrow} ${mutation.dst || '?'}`;
      }
      case 'update_rate_limit':
        return 'track execution';
      default:
        return '';
    }
  };

  const summary = getSummary();

  return (
    <div className="condition-card">
      <div
        className="condition-card-header"
        style={{ marginBottom: expanded ? undefined : 0 }}
      >
        <div className="condition-card-type">
          <div className="condition-card-icon" style={{ backgroundColor: `${typeMeta.color}20` }}>
            {typeMeta.icon}
          </div>
          <div>
            <div className="condition-card-label">{headerLabel}</div>
            {summary && <div className="condition-card-summary">{summary}</div>}
          </div>
        </div>
        <div className="condition-card-actions">
          <button className="btn-icon" onClick={() => setExpanded(!expanded)}>
            {expanded ? '^' : 'v'}
          </button>
          {onRemove && (
            <button className="btn-icon btn-icon-danger" onClick={onRemove}>
              x
            </button>
          )}
        </div>
      </div>

      {expanded && (
        <div className="condition-card-fields">
          <div className="form-grid" style={{ flex: '1 1 100%' }}>
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

            {mutation.type === 'update_rate_limit' && (
              <div className="text-muted" style={{ gridColumn: '1 / -1' }}>
                Tracks generator execution for rate limiting.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default MutationCard;
