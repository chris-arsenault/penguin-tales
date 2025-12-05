/**
 * SystemsSection - Era system modifiers configuration
 */

import React from 'react';
import { SectionHeader, EmptyState, ItemRow, LevelSelector, STRENGTH_LEVELS, SearchableDropdown } from '../../shared';

/**
 * @param {Object} props
 * @param {Array} props.systemModifiers - Array of [key, value] tuples
 * @param {number} props.activeCount - Count of active systems (value > 0)
 * @param {Function} props.getSystemName - Function to get display name for system ID
 * @param {Function} props.onModifierChange - Called when modifier changes
 * @param {Function} props.onRemove - Called to remove a system
 * @param {Array} props.availableSystems - Systems that can be added
 * @param {Function} props.onAdd - Called to add a system
 */
export function SystemsSection({
  systemModifiers,
  activeCount,
  getSystemName,
  onModifierChange,
  onRemove,
  availableSystems,
  onAdd,
}) {
  return (
    <div className="section">
      <SectionHeader
        icon="⚙️"
        title="Systems"
        count={`${activeCount} active / ${systemModifiers.length} total`}
      />
      <div className="items-grid">
        {systemModifiers.length === 0 ? (
          <EmptyState
            title="No systems assigned"
            description="Add systems to control simulation behavior during this era."
          />
        ) : (
          systemModifiers.map(([key, value]) => (
            <ItemRow
              key={key}
              name={getSystemName(key) || key.replace(/_/g, ' ')}
              muted={value === 0}
              onRemove={() => onRemove(key)}
              removeTitle="Remove from era"
            >
              <LevelSelector
                value={value}
                onChange={(newValue) => onModifierChange(key, newValue)}
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
          items={availableSystems}
          onSelect={onAdd}
          placeholder="Add system..."
          emptyMessage="All systems added"
        />
      </div>
    </div>
  );
}
