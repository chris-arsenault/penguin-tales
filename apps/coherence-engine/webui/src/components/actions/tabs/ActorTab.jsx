/**
 * ActorTab - Actor requirements configuration
 */

import React from 'react';
import { PROMINENCE_LEVELS } from '../constants';
import { ReferenceDropdown, ChipSelect, NumberInput } from '../../shared';

function PressureRequirementsEditor({ value = {}, onChange }) {
  const entries = Object.entries(value);

  const updatePressure = (pressureId, min) => {
    onChange({ ...value, [pressureId]: min });
  };

  const removePressure = (pressureId) => {
    const newValue = { ...value };
    delete newValue[pressureId];
    onChange(newValue);
  };

  const addPressure = () => {
    const id = `pressure_${Date.now()}`;
    onChange({ ...value, [id]: 0 });
  };

  return (
    <div>
      {entries.map(([pressureId, minValue]) => (
        <div key={pressureId} className="flex items-center gap-md mb-md">
          <input
            type="text"
            value={pressureId}
            onChange={(e) => {
              const newValue = { ...value };
              delete newValue[pressureId];
              newValue[e.target.value] = minValue;
              onChange(newValue);
            }}
            className="input flex-1"
            placeholder="Pressure ID"
          />
          <span className="text-muted text-xs">≥</span>
          <NumberInput
            value={minValue}
            onChange={(v) => updatePressure(pressureId, v ?? 0)}
            className="input input-xs"
            integer
          />
          <button className="btn-icon btn-icon-danger" onClick={() => removePressure(pressureId)}>
            ×
          </button>
        </div>
      ))}
      <button className="btn btn-add" onClick={addPressure}>
        + Add Pressure Requirement
      </button>
    </div>
  );
}

export function ActorTab({ action, onChange, schema }) {
  const actor = action.actor || {};

  const updateActor = (field, value) => {
    onChange({
      ...action,
      actor: { ...actor, [field]: value },
    });
  };

  const entityKindOptions = (schema?.entityKinds || []).map((ek) => ({
    value: ek.kind,
    label: ek.kind,
  }));

  const relationshipKindOptions = (schema?.relationshipKinds || []).map((rk) => ({
    value: rk.kind,
    label: rk.description || rk.kind,
  }));

  const subtypeOptions = (schema?.subtypes || []).map((st) => ({
    value: st,
    label: st,
  }));

  const requiredRelationships = actor.requiredRelationships || [];

  return (
    <div>
      <div className="info-box">
        <div className="info-box-title">Actor Requirements</div>
        <div className="info-box-text">
          Define which entities can perform this action. Actors must match all specified criteria.
        </div>
      </div>

      <div className="section">
        <div className="section-title">🎭 Entity Requirements</div>
        <ChipSelect
          label="Actor Kinds"
          value={actor.kinds || []}
          options={entityKindOptions}
          onChange={(v) => updateActor('kinds', v.length > 0 ? v : undefined)}
          placeholder="Add kind..."
        />

        <div className="mt-xl">
          <ChipSelect
            label="Subtypes (optional)"
            value={actor.subtypes || []}
            options={subtypeOptions}
            onChange={(v) => updateActor('subtypes', v.length > 0 ? v : undefined)}
            placeholder="Add subtype..."
          />
        </div>
      </div>

      <div className="section">
        <div className="section-title">⭐ Prominence</div>
        <ReferenceDropdown
          label="Minimum Prominence"
          value={actor.minProminence}
          onChange={(v) => updateActor('minProminence', v)}
          options={PROMINENCE_LEVELS}
          placeholder="Any prominence"
        />
      </div>

      <div className="section">
        <div className="section-title">🔗 Required Relationships</div>
        <div className="section-desc">
          Actor must have at least one of these relationship types to perform this action.
        </div>
        <ChipSelect
          value={requiredRelationships}
          options={relationshipKindOptions}
          onChange={(v) => updateActor('requiredRelationships', v.length > 0 ? v : undefined)}
          placeholder="Add relationship..."
        />
      </div>

      <div className="section">
        <div className="section-title">📊 Required Pressures</div>
        <div className="section-desc">
          Minimum pressure levels required for this action to be available.
        </div>
        <PressureRequirementsEditor
          value={actor.requiredPressures || {}}
          onChange={(v) => updateActor('requiredPressures', Object.keys(v).length > 0 ? v : undefined)}
        />
      </div>
    </div>
  );
}
