/**
 * SelectionFiltersEditor - Manage a list of selection filters
 */

import React, { useState } from 'react';
import { FILTER_TYPES } from '../constants';
import { SelectionFilterCard } from './SelectionFilterCard';

/**
 * @param {Object} props
 * @param {Array} props.filters - Array of filter configurations
 * @param {Function} props.onChange - Callback when filters change
 * @param {Object} props.schema - Domain schema
 * @param {Array} props.availableRefs - Available entity references
 */
export function SelectionFiltersEditor({ filters, onChange, schema, availableRefs }) {
  const [showTypeMenu, setShowTypeMenu] = useState(false);

  const handleAddFilter = (type) => {
    const newFilter = { type };
    // Set defaults based on type
    if (type === 'has_any_tag') newFilter.tags = [];
    if (type === 'exclude') newFilter.entities = [];
    if (type === 'has_relationship') newFilter.direction = 'both';
    onChange([...(filters || []), newFilter]);
    setShowTypeMenu(false);
  };

  const handleUpdateFilter = (index, updated) => {
    const newFilters = [...(filters || [])];
    newFilters[index] = updated;
    onChange(newFilters);
  };

  const handleRemoveFilter = (index) => {
    onChange((filters || []).filter((_, i) => i !== index));
  };

  return (
    <div>
      {(filters || []).length === 0 ? (
        <div className="empty-state-compact">
          No filters defined. Filters narrow down which entities can be selected as targets.
        </div>
      ) : (
        <div className="condition-list">
          {(filters || []).map((filter, index) => (
            <SelectionFilterCard
              key={index}
              filter={filter}
              onChange={(updated) => handleUpdateFilter(index, updated)}
              onRemove={() => handleRemoveFilter(index)}
              schema={schema}
              availableRefs={availableRefs}
            />
          ))}
        </div>
      )}

      <div style={{ position: 'relative', marginTop: '12px' }}>
        <button
          onClick={() => setShowTypeMenu(!showTypeMenu)}
          className="btn-add-inline"
        >
          + Add Filter
        </button>

        {showTypeMenu && (
          <div className="dropdown-menu">
            {Object.entries(FILTER_TYPES).map(([type, config]) => (
              <div
                key={type}
                onClick={() => handleAddFilter(type)}
                className="dropdown-menu-item"
              >
                <span className="dropdown-menu-icon" style={{ backgroundColor: `${config.color}20` }}>
                  {config.icon}
                </span>
                <span className="dropdown-menu-label">{config.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default SelectionFiltersEditor;
