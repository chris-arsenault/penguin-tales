/**
 * SelectionFilterCard - Display and edit a single selection filter
 */

import React from 'react';
import { FILTER_TYPES } from '../constants';
import { ReferenceDropdown, ChipSelect } from '../../shared';
import { GraphPathEditor } from './GraphPathEditor';

/**
 * @param {Object} props
 * @param {Object} props.filter - The filter configuration
 * @param {Function} props.onChange - Callback when filter changes
 * @param {Function} props.onRemove - Callback to remove this filter
 * @param {Object} props.schema - Domain schema
 * @param {Array} props.availableRefs - Available entity references
 */
export function SelectionFilterCard({ filter, onChange, onRemove, schema, availableRefs }) {
  const typeConfig = FILTER_TYPES[filter.type] || { label: filter.type, icon: '❓', color: '#6b7280' };

  const relationshipKindOptions = (schema?.relationshipKinds || []).map((rk) => ({
    value: rk.kind,
    label: rk.description || rk.kind,
  }));

  const tagOptions = (schema?.tagRegistry || []).map((t) => ({
    value: t.tag,
    label: t.tag,
  }));

  const refOptions = (availableRefs || []).map((ref) => ({
    value: ref,
    label: ref,
  }));

  const updateFilter = (field, value) => {
    onChange({ ...filter, [field]: value });
  };

  const renderFilterFields = () => {
    switch (filter.type) {
      case 'has_tag':
        return (
          <div className="filter-fields">
            <div style={{ flex: '1 1 150px' }}>
              <label className="label label-small">Tag</label>
              <ReferenceDropdown
                value={filter.tag || ''}
                onChange={(v) => updateFilter('tag', v)}
                options={tagOptions}
                placeholder="Select tag..."
              />
            </div>
            <div style={{ flex: '1 1 150px' }}>
              <label className="label label-small">Value (optional)</label>
              <input
                type="text"
                value={filter.value ?? ''}
                onChange={(e) => updateFilter('value', e.target.value || undefined)}
                className="input input-compact"
                placeholder="Any value"
              />
            </div>
          </div>
        );

      case 'has_any_tag':
        return (
          <div>
            <label className="label label-small">Tags (comma-separated)</label>
            <input
              type="text"
              value={(filter.tags || []).join(', ')}
              onChange={(e) => updateFilter('tags', e.target.value.split(',').map(t => t.trim()).filter(Boolean))}
              className="input input-compact"
              placeholder="tag1, tag2, tag3"
            />
          </div>
        );

      case 'has_relationship':
      case 'lacks_relationship':
        return (
          <div className="filter-fields">
            <div style={{ flex: '1 1 140px' }}>
              <label className="label label-small">Relationship Kind</label>
              <ReferenceDropdown
                value={filter.kind || ''}
                onChange={(v) => updateFilter('kind', v)}
                options={relationshipKindOptions}
                placeholder="Select kind..."
              />
            </div>
            <div style={{ flex: '1 1 120px' }}>
              <label className="label label-small">With Entity (optional)</label>
              <ReferenceDropdown
                value={filter.with || ''}
                onChange={(v) => updateFilter('with', v || undefined)}
                options={[{ value: '', label: 'Any entity' }, ...refOptions]}
              />
            </div>
            {filter.type === 'has_relationship' && (
              <div style={{ flex: '1 1 100px' }}>
                <label className="label label-small">Direction</label>
                <ReferenceDropdown
                  value={filter.direction || 'both'}
                  onChange={(v) => updateFilter('direction', v)}
                  options={[
                    { value: 'both', label: 'Both' },
                    { value: 'src', label: 'Outgoing' },
                    { value: 'dst', label: 'Incoming' },
                  ]}
                />
              </div>
            )}
          </div>
        );

      case 'exclude':
        return (
          <ChipSelect
            label="Entities to Exclude"
            value={filter.entities || []}
            onChange={(v) => updateFilter('entities', v)}
            options={refOptions}
            placeholder="+ Add variable..."
          />
        );

      case 'same_location':
        return (
          <div>
            <label className="label label-small">Same Location As</label>
            <ReferenceDropdown
              value={filter.as || ''}
              onChange={(v) => updateFilter('as', v)}
              options={refOptions}
              placeholder="Select variable..."
            />
          </div>
        );

      case 'not_at_war':
        return (
          <div>
            <label className="label label-small">Not At War With</label>
            <ReferenceDropdown
              value={filter.with || ''}
              onChange={(v) => updateFilter('with', v)}
              options={refOptions}
              placeholder="Select variable..."
            />
          </div>
        );

      case 'graph_path':
        return (
          <GraphPathEditor
            assert={filter.assert}
            onChange={(assert) => updateFilter('assert', assert)}
            schema={schema}
            availableRefs={availableRefs}
          />
        );

      default:
        return (
          <div className="text-muted">
            Unknown filter type: {filter.type}
          </div>
        );
    }
  };

  return (
    <div className="condition-card">
      <div className="condition-card-header">
        <div className="condition-card-type">
          <span className="condition-card-icon" style={{ backgroundColor: `${typeConfig.color}20` }}>
            {typeConfig.icon}
          </span>
          <span className="condition-card-label">
            {typeConfig.label}
          </span>
        </div>
        <button onClick={onRemove} className="button-remove">
          Remove
        </button>
      </div>
      <div className="condition-card-fields">
        {renderFilterFields()}
      </div>
    </div>
  );
}

export default SelectionFilterCard;
