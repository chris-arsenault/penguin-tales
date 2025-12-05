/**
 * TransitionEffectItem - Row component for pressure change effects
 *
 * Wrapper around shared ItemRow with pressure-specific controls.
 */

import React from 'react';
import { ItemRow } from '../../shared';

/**
 * @param {Object} props
 * @param {string} props.pressureId - The pressure ID
 * @param {number} props.value - The delta value
 * @param {Function} props.onChange - Called when value changes
 * @param {Function} props.onRemove - Called to remove effect
 * @param {Array} props.pressures - Available pressure definitions
 */
export function TransitionEffectItem({ pressureId, value, onChange, onRemove, pressures }) {
  const pressure = pressures.find(p => p.id === pressureId);

  return (
    <ItemRow
      name={pressure?.name || pressureId}
      onRemove={onRemove}
      removeTitle="Remove effect"
    >
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value) || 0)}
        className={`input input-compact input-centered ${value >= 0 ? 'text-success' : 'text-danger'}`}
      />
      <span className="text-dim text-sm" style={{ minWidth: '80px' }}>
        {value >= 0 ? '+' : ''}{value} pressure
      </span>
    </ItemRow>
  );
}
