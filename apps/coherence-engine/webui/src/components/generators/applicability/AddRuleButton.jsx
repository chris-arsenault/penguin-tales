/**
 * AddRuleButton - Button with type picker for adding applicability rules
 */

import React, { useState } from 'react';
import { APPLICABILITY_TYPES } from '../constants';

/**
 * @param {Object} props
 * @param {Function} props.onAdd - Callback when a rule type is selected
 * @param {number} props.depth - Nesting depth (limits nested rule types at depth >= 2)
 */
export function AddRuleButton({ onAdd, depth = 0 }) {
  const [showPicker, setShowPicker] = useState(false);

  return (
    <div style={{ position: 'relative' }}>
      <button
        className="btn-add"
        onClick={() => setShowPicker(!showPicker)}
      >
        + Add Rule
      </button>

      {showPicker && (
        <div className="type-picker">
          {Object.entries(APPLICABILITY_TYPES)
            .filter(([type]) => depth < 2 || (type !== 'or' && type !== 'and'))
            .map(([type, config]) => (
              <div
                key={type}
                className="type-option"
                onClick={() => { onAdd(type); setShowPicker(false); }}
              >
                <div className="type-option-icon">{config.icon}</div>
                <div className="type-option-label">{config.label}</div>
                <div className="type-option-desc">{config.desc}</div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

export default AddRuleButton;
