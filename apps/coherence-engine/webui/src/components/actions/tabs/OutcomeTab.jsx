/**
 * OutcomeTab - Action outcome configuration
 */

import React from 'react';
import { RELATIONSHIP_REFS } from '../constants';
import { ReferenceDropdown, PressureChangesEditor, NumberInput } from '../../shared';

export function OutcomeTab({ action, onChange, schema, pressures }) {
  const outcome = action.outcome || {};

  const updateOutcome = (field, value) => {
    onChange({
      ...action,
      outcome: { ...outcome, [field]: value },
    });
  };

  const relationships = outcome.relationships || [];
  const strengthenRelationships = outcome.strengthenRelationships || [];

  const relationshipKindOptions = (schema?.relationshipKinds || []).map((rk) => ({
    value: rk.kind,
    label: rk.description || rk.kind,
  }));

  const addRelationship = () => {
    updateOutcome('relationships', [
      ...relationships,
      { kind: '', src: 'actor', dst: 'target', strength: 0.5 },
    ]);
  };

  const updateRelationship = (index, rel) => {
    const newRels = [...relationships];
    newRels[index] = rel;
    updateOutcome('relationships', newRels);
  };

  const removeRelationship = (index) => {
    updateOutcome('relationships', relationships.filter((_, i) => i !== index));
  };

  const addStrengthen = () => {
    updateOutcome('strengthenRelationships', [
      ...strengthenRelationships,
      { kind: '', channel: 'actor_target', amount: 0.1 },
    ]);
  };

  const CHANNEL_OPTIONS = [
    { value: 'instigator_actor', label: 'Instigator ↔ Actor' },
    { value: 'actor_target', label: 'Actor ↔ Target' },
  ];

  const updateStrengthen = (index, item) => {
    const newItems = [...strengthenRelationships];
    newItems[index] = item;
    updateOutcome('strengthenRelationships', newItems);
  };

  const removeStrengthen = (index) => {
    updateOutcome('strengthenRelationships', strengthenRelationships.filter((_, i) => i !== index));
  };

  return (
    <div>
      <div className="info-box">
        <div className="info-box-title">Action Outcome</div>
        <div className="info-box-text">
          Define what happens when this action succeeds. Create relationships, modify pressures,
          or strengthen existing connections.
        </div>
      </div>

      <div className="section">
        <div className="section-title">🔗 Create Relationships ({relationships.length})</div>
        {relationships.map((rel, index) => (
          <div key={index} className="item-card">
            <div className="item-card-body">
              <div className="form-row-with-delete">
                <div className="form-row-fields">
                  <ReferenceDropdown
                    label="Kind"
                    value={rel.kind}
                    onChange={(v) => updateRelationship(index, { ...rel, kind: v })}
                    options={relationshipKindOptions}
                  />
                  <ReferenceDropdown
                    label="Source"
                    value={rel.src}
                    onChange={(v) => updateRelationship(index, { ...rel, src: v })}
                    options={RELATIONSHIP_REFS}
                  />
                  <ReferenceDropdown
                    label="Destination"
                    value={rel.dst}
                    onChange={(v) => updateRelationship(index, { ...rel, dst: v })}
                    options={RELATIONSHIP_REFS}
                  />
                  <div className="form-group">
                    <label className="label">Strength</label>
                    <NumberInput
                      value={rel.strength}
                      onChange={(v) => updateRelationship(index, { ...rel, strength: v ?? 0 })}
                      min={0}
                      max={1}
                    />
                  </div>
                  <div className="form-group">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={rel.bidirectional || false}
                        onChange={(e) => updateRelationship(index, { ...rel, bidirectional: e.target.checked || undefined })}
                        className="checkbox"
                      />
                      Bidirectional
                    </label>
                  </div>
                </div>
                <button className="btn-icon btn-icon-danger" onClick={() => removeRelationship(index)}>
                  ×
                </button>
              </div>
            </div>
          </div>
        ))}
        <button className="btn btn-add" onClick={addRelationship}>
          + Add Relationship
        </button>
      </div>

      <div className="section">
        <div className="section-title">💪 Strengthen Relationships ({strengthenRelationships.length})</div>
        <div className="section-desc">
          Modify strength of existing relationships between entities. Use negative amounts to weaken.
        </div>
        {strengthenRelationships.map((item, index) => (
          <div key={index} className="item-card">
            <div className="item-card-body">
              <div className="form-row-with-delete">
                <div className="form-row-fields">
                  <ReferenceDropdown
                    label="Kind"
                    value={item.kind}
                    onChange={(v) => updateStrengthen(index, { ...item, kind: v })}
                    options={relationshipKindOptions}
                  />
                  <ReferenceDropdown
                    label="Channel"
                    value={item.channel || 'actor_target'}
                    onChange={(v) => updateStrengthen(index, { ...item, channel: v })}
                    options={CHANNEL_OPTIONS}
                  />
                  <div className="form-group">
                    <label className="label">Amount</label>
                    <NumberInput
                      value={item.amount}
                      onChange={(v) => updateStrengthen(index, { ...item, amount: v ?? 0 })}
                      step={0.1}
                    />
                  </div>
                </div>
                <button className="btn-icon btn-icon-danger" onClick={() => removeStrengthen(index)}>
                  ×
                </button>
              </div>
            </div>
          </div>
        ))}
        <button className="btn btn-add" onClick={addStrengthen}>
          + Add Strengthen Rule
        </button>
      </div>

      <div className="section">
        <div className="section-title">⭐ Prominence Changes</div>
        <div className="section-desc">
          Apply system-level prominence changes on success/failure. Chances are configured at the system level.
        </div>
        <div className="form-row">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={outcome.applyProminenceToActor || false}
              onChange={(e) => updateOutcome('applyProminenceToActor', e.target.checked || undefined)}
              className="checkbox"
            />
            Apply prominence changes to Actor
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={outcome.applyProminenceToInstigator || false}
              onChange={(e) => updateOutcome('applyProminenceToInstigator', e.target.checked || undefined)}
              className="checkbox"
            />
            Apply prominence changes to Instigator
          </label>
        </div>
      </div>

      <div className="section">
        <div className="section-title">📊 Pressure Changes</div>
        <PressureChangesEditor
          value={outcome.pressureChanges || {}}
          onChange={(v) => updateOutcome('pressureChanges', Object.keys(v).length > 0 ? v : undefined)}
          pressures={pressures}
        />
      </div>

      <div className="section">
        <div className="section-title">📝 Description Template</div>
        <div className="section-desc">
          Template for generating occurrence descriptions. Use {'{actor.name}'}, {'{instigator.name}'}, {'{target.name}'}, etc.
        </div>
        <textarea
          value={outcome.descriptionTemplate || ''}
          onChange={(e) => updateOutcome('descriptionTemplate', e.target.value || undefined)}
          className="textarea"
          placeholder="e.g., declared war on {target.name}"
        />
      </div>
    </div>
  );
}
