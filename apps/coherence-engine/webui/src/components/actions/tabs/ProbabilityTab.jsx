/**
 * ProbabilityTab - Probability configuration
 */

import React from 'react';

export function ProbabilityTab({ action, onChange, pressures }) {
  const probability = action.probability || {};

  const updateProbability = (field, value) => {
    onChange({
      ...action,
      probability: { ...probability, [field]: value },
    });
  };

  const pressureModifiers = probability.pressureModifiers || [];
  const availablePressures = (pressures || []).filter((p) => !pressureModifiers.includes(p.id));

  const addPressureModifier = (id) => {
    if (id && !pressureModifiers.includes(id)) {
      updateProbability('pressureModifiers', [...pressureModifiers, id]);
    }
  };

  const removePressureModifier = (id) => {
    updateProbability('pressureModifiers', pressureModifiers.filter((p) => p !== id));
  };

  const baseSuccessChance = probability.baseSuccessChance ?? 0.5;
  const baseWeight = probability.baseWeight ?? 1.0;

  return (
    <div>
      <div className="info-box">
        <div className="info-box-title">Probability Configuration</div>
        <div className="info-box-text">
          Control how likely this action is to be selected and succeed. Pressure modifiers
          dynamically adjust probability based on world state.
        </div>
      </div>

      <div className="section">
        <div className="section-title">🎯 Base Success Chance</div>
        <div className="section-desc">
          Probability that this action succeeds when attempted.
        </div>
        <div className="slider-row">
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={baseSuccessChance}
            onChange={(e) => updateProbability('baseSuccessChance', parseFloat(e.target.value))}
            className="slider"
          />
          <span className="slider-value">{(baseSuccessChance * 100).toFixed(0)}%</span>
        </div>
      </div>

      <div className="section">
        <div className="section-title">⚖️ Base Weight</div>
        <div className="section-desc">
          Relative weight for action selection. Higher weight means more likely to be chosen.
        </div>
        <div className="form-group">
          <input
            type="number"
            value={baseWeight}
            onChange={(e) => updateProbability('baseWeight', parseFloat(e.target.value) || 1.0)}
            className="input"
            step="0.1"
            min="0"
          />
        </div>
      </div>

      <div className="section">
        <div className="section-title">📊 Pressure Modifiers ({pressureModifiers.length})</div>
        <div className="section-desc">
          Pressures that affect the probability of this action. Higher pressure values increase
          the likelihood of this action being selected.
        </div>
        <div className="chip-container">
          {pressureModifiers.map((p) => (
            <div key={p} className="chip">
              {p}
              <button className="chip-remove" onClick={() => removePressureModifier(p)}>
                ×
              </button>
            </div>
          ))}
        </div>
        <select
          className="select mt-lg"
          value=""
          onChange={(e) => addPressureModifier(e.target.value)}
        >
          <option value="">+ Add pressure modifier...</option>
          {availablePressures.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name || p.id}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
