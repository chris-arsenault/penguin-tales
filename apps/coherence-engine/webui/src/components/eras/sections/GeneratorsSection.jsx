/**
 * GeneratorsSection - Era generator weights configuration
 */

import React from 'react';
import { SectionHeader, EmptyState, ItemRow, LevelSelector, STRENGTH_LEVELS, SearchableDropdown } from '../../shared';

/**
 * @param {Object} props
 * @param {Array} props.templateWeights - Array of [key, value] tuples
 * @param {number} props.activeCount - Count of active generators (value > 0)
 * @param {Function} props.getGeneratorName - Function to get display name for generator ID
 * @param {Function} props.onWeightChange - Called when weight changes
 * @param {Function} props.onRemove - Called to remove a generator
 * @param {Array} props.availableGenerators - Generators that can be added
 * @param {Function} props.onAdd - Called to add a generator
 */
export function GeneratorsSection({
  templateWeights,
  activeCount,
  getGeneratorName,
  onWeightChange,
  onRemove,
  availableGenerators,
  onAdd,
}) {
  return (
    <div className="section">
      <SectionHeader
        icon="⚡"
        title="Generators"
        count={`${activeCount} active / ${templateWeights.length} total`}
      />
      <div className="items-grid">
        {templateWeights.length === 0 ? (
          <EmptyState
            title="No generators assigned"
            description="Add generators to control entity creation during this era."
          />
        ) : (
          templateWeights.map(([key, value]) => (
            <ItemRow
              key={key}
              name={getGeneratorName(key) || key.replace(/_/g, ' ')}
              muted={value === 0}
              onRemove={() => onRemove(key)}
              removeTitle="Remove from era"
            >
              <LevelSelector
                value={value}
                onChange={(newValue) => onWeightChange(key, newValue)}
                levels={STRENGTH_LEVELS}
                showNumeric
                min={0}
                max={10}
                step={0.1}
              />
            </ItemRow>
          ))
        )}
      </div>
      <div className="add-container">
        <SearchableDropdown
          items={availableGenerators}
          onSelect={onAdd}
          placeholder="Add generator..."
          emptyMessage="All generators added"
        />
      </div>
    </div>
  );
}
