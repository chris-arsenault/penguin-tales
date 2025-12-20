/**
 * ActorTab - Actor requirements configuration
 */

import React from 'react';
import { ChipSelect, NumberInput } from '../../shared';
import { SelectionFiltersEditor } from '../../generators/filters/SelectionFiltersEditor';

/**
 * Editor for pressure band requirements (min/max ranges).
 * Value is an array of { pressure: string, min?: number, max?: number }
 */
function PressureBandsEditor({ value = [], onChange, pressures = [] }) {
  const bands = Array.isArray(value) ? value : [];

  // Helper to get pressure name from id
  const getPressureName = (pressureId) => {
    const pressure = pressures.find((p) => p.id === pressureId);
    return pressure?.name || pressureId;
  };

  const updateBand = (index, field, fieldValue) => {
    const newBands = [...bands];
    newBands[index] = { ...newBands[index], [field]: fieldValue };
    // Remove undefined values
    if (fieldValue === undefined || fieldValue === '') {
      delete newBands[index][field];
    }
    onChange(newBands);
  };

  const removeBand = (index) => {
    const newBands = bands.filter((_, i) => i !== index);
    onChange(newBands);
  };

  const addBand = () => {
    onChange([...bands, { pressure: '' }]);
  };

  return (
    <div>
      {bands.map((band, index) => (
        <div key={index} className="flex items-center gap-md mb-md">
          <select
            value={band.pressure || ''}
            onChange={(e) => updateBand(index, 'pressure', e.target.value)}
            className="input flex-1"
          >
            <option value="">Select pressure...</option>
            {pressures.map((p) => (
              <option key={p.id} value={p.id}>{p.name || p.id}</option>
            ))}
          </select>
          <span className="text-muted text-xs">min</span>
          <NumberInput
            value={band.min}
            onChange={(v) => updateBand(index, 'min', v)}
            className="input input-xs"
            integer
            placeholder="-100"
          />
          <span className="text-muted text-xs">max</span>
          <NumberInput
            value={band.max}
            onChange={(v) => updateBand(index, 'max', v)}
            className="input input-xs"
            integer
            placeholder="100"
          />
          <button className="btn-icon btn-icon-danger" onClick={() => removeBand(index)}>
            ×
          </button>
        </div>
      ))}
      <button className="btn btn-add" onClick={addBand}>
        + Add Pressure Band
      </button>
    </div>
  );
}

/**
 * Editor for instigator configuration.
 * Instigator is an optional entity that triggers the action on behalf of the actor.
 */
function InstigatorEditor({ value, onChange, schema }) {
  const instigator = value || {};
  const hasInstigator = !!value;

  const updateInstigator = (field, fieldValue) => {
    const updated = { ...instigator, [field]: fieldValue };
    // Remove undefined values
    if (fieldValue === undefined || fieldValue === '' || (Array.isArray(fieldValue) && fieldValue.length === 0)) {
      delete updated[field];
    }
    onChange(updated);
  };

  const enableInstigator = () => {
    onChange({ relationshipKind: '', direction: 'in' });
  };

  const disableInstigator = () => {
    onChange(undefined);
  };

  const entityKindOptions = (schema?.entityKinds || []).map((ek) => ({
    value: ek.kind,
    label: ek.kind,
  }));

  const subtypeOptions = (schema?.subtypes || []).map((st) => ({
    value: st,
    label: st,
  }));

  const statusOptions = (schema?.statuses || []).map((s) => ({
    value: s,
    label: s,
  }));

  const relationshipKindOptions = (schema?.relationshipKinds || []).map((rk) => ({
    value: rk.kind,
    label: rk.description || rk.kind,
  }));

  if (!hasInstigator) {
    return (
      <div>
        <div className="text-muted text-small mb-md">
          No instigator configured. The actor performs the action directly.
        </div>
        <button className="btn btn-add" onClick={enableInstigator}>
          + Add Instigator
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-lg mb-lg">
        <div className="flex-1">
          <label className="label">Relationship Kind</label>
          <select
            value={instigator.relationshipKind || ''}
            onChange={(e) => updateInstigator('relationshipKind', e.target.value)}
            className="input"
          >
            <option value="">Select relationship...</option>
            {relationshipKindOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Direction</label>
          <select
            value={instigator.direction || 'in'}
            onChange={(e) => updateInstigator('direction', e.target.value)}
            className="input"
          >
            <option value="in">Instigator → Actor</option>
            <option value="out">Actor → Instigator</option>
          </select>
        </div>
      </div>

      <div className="text-muted text-xs mb-lg">
        {instigator.direction === 'in'
          ? 'Instigator has relationship pointing TO the actor (e.g., NPC --leader_of--> Faction)'
          : 'Actor has relationship pointing TO the instigator (e.g., Faction --has_leader--> NPC)'}
      </div>

      <div className="mb-lg">
        <ChipSelect
          label="Instigator Kinds (optional)"
          value={instigator.kinds || []}
          options={entityKindOptions}
          onChange={(v) => updateInstigator('kinds', v)}
          placeholder="Any kind..."
        />
      </div>

      <div className="mb-lg">
        <ChipSelect
          label="Instigator Subtypes (optional)"
          value={instigator.subtypes || []}
          options={subtypeOptions}
          onChange={(v) => updateInstigator('subtypes', v)}
          placeholder="Any subtype..."
        />
      </div>

      <div className="mb-lg">
        <ChipSelect
          label="Instigator Statuses (optional)"
          value={instigator.statuses || []}
          options={statusOptions}
          onChange={(v) => updateInstigator('statuses', v)}
          placeholder="Any status..."
        />
      </div>

      <div className="flex items-center gap-md mb-lg">
        <label className="flex items-center gap-sm">
          <input
            type="checkbox"
            checked={instigator.required || false}
            onChange={(e) => updateInstigator('required', e.target.checked || undefined)}
          />
          <span className="text-small">Instigator required (actor cannot act without one)</span>
        </label>
      </div>

      <button className="btn btn-danger-outline" onClick={disableInstigator}>
        Remove Instigator
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

  const subtypeOptions = (schema?.subtypes || []).map((st) => ({
    value: st,
    label: st,
  }));

  const statusOptions = (schema?.statuses || []).map((s) => ({
    value: s,
    label: s,
  }));

  // Available refs for selection filters (actor context)
  const availableRefs = ['$actor', '$instigator'];

  return (
    <div>
      <div className="info-box">
        <div className="info-box-title">Actor Configuration</div>
        <div className="info-box-text">
          The actor is the primary entity that performs the action on the target.
          An optional instigator can trigger the action on behalf of the actor.
        </div>
      </div>

      <div className="section">
        <div className="section-title">🎭 Actor Requirements</div>
        <div className="section-desc">
          The actor is the entity that interacts with the target (e.g., faction that controls a location).
        </div>
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

        <div className="mt-xl">
          <ChipSelect
            label="Statuses (optional)"
            value={actor.statuses || []}
            options={statusOptions}
            onChange={(v) => updateActor('statuses', v.length > 0 ? v : undefined)}
            placeholder="Add status..."
          />
        </div>
      </div>

      <div className="section">
        <div className="section-title">🔍 Actor Selection Filters</div>
        <div className="section-desc">
          Filter actors by tags, relationships, prominence, culture, and more.
        </div>
        <SelectionFiltersEditor
          filters={actor.filters || []}
          onChange={(v) => updateActor('filters', v.length > 0 ? v : undefined)}
          schema={schema}
          availableRefs={availableRefs}
        />
      </div>

      <div className="section">
        <div className="section-title">👤 Instigator (Optional)</div>
        <div className="section-desc">
          An instigator triggers the action on behalf of the actor (e.g., NPC leader acts for their faction).
        </div>
        <InstigatorEditor
          value={actor.instigator}
          onChange={(v) => updateActor('instigator', v)}
          schema={schema}
        />
      </div>

      <div className="section">
        <div className="section-title">📊 Required Pressure Bands</div>
        <div className="section-desc">
          Pressure ranges required for this action to be available. Leave min/max empty for no bound.
        </div>
        <PressureBandsEditor
          value={actor.requiredPressures || []}
          onChange={(v) => updateActor('requiredPressures', v.length > 0 ? v : undefined)}
          pressures={schema?.pressures || []}
        />
      </div>
    </div>
  );
}
