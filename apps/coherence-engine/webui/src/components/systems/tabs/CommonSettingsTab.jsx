/**
 * CommonSettingsTab - Shared settings for all system types
 */

import React from 'react';
import { ReferenceDropdown, PressureChangesEditor } from '../../shared';

/**
 * @param {Object} props
 * @param {Object} props.system - The system being edited
 * @param {Function} props.onChange - Called when system changes
 * @param {Object} props.schema - Domain schema
 * @param {Array} props.pressures - Available pressure definitions
 */
export function CommonSettingsTab({ system, onChange, schema, pressures }) {
  const config = system.config || {};

  const entityKindOptions = (schema?.entityKinds || []).map((ek) => ({
    value: ek.kind,
    label: ek.description || ek.kind,
  }));

  const getSubtypeOptions = (kind) => {
    const ek = (schema?.entityKinds || []).find((e) => e.kind === kind);
    if (!ek?.subtypes) return [];
    return ek.subtypes.map((st) => ({ value: st.id, label: st.name || st.id }));
  };

  const getStatusOptions = (kind) => {
    const ek = (schema?.entityKinds || []).find((e) => e.kind === kind);
    if (!ek?.statuses) return [];
    return ek.statuses.map((st) => ({ value: st.id, label: st.name || st.id }));
  };

  const updateConfig = (field, value) => {
    onChange({ ...system, config: { ...config, [field]: value } });
  };

  return (
    <div>
      <div className="section">
        <div className="section-title">Entity Filter</div>
        <div className="section-desc">
          Define which entities this system operates on.
        </div>

        <div className="form-grid">
          <ReferenceDropdown
            label="Entity Kind"
            value={config.entityKind}
            onChange={(v) => updateConfig('entityKind', v)}
            options={entityKindOptions}
            placeholder="All kinds"
          />
          {config.entityKind && (
            <ReferenceDropdown
              label="Entity Subtype"
              value={config.entitySubtype}
              onChange={(v) => updateConfig('entitySubtype', v)}
              options={[{ value: '', label: 'Any' }, ...getSubtypeOptions(config.entityKind)]}
            />
          )}
          {config.entityKind && (
            <ReferenceDropdown
              label="Entity Status"
              value={config.entityStatus}
              onChange={(v) => updateConfig('entityStatus', v)}
              options={[{ value: '', label: 'Any' }, ...getStatusOptions(config.entityKind)]}
            />
          )}
        </div>
      </div>

      <div className="section">
        <div className="section-title">Throttling</div>
        <div className="form-grid">
          <div className="form-group">
            <label className="label">Throttle Chance (0-1)</label>
            <input
              type="number"
              value={config.throttleChance ?? ''}
              onChange={(e) => updateConfig('throttleChance', parseFloat(e.target.value) || undefined)}
              className="input"
              step="0.1"
              min="0"
              max="1"
              placeholder="0.2"
            />
          </div>
          <div className="form-group">
            <label className="label">Cooldown (ticks)</label>
            <input
              type="number"
              value={config.cooldown ?? ''}
              onChange={(e) => updateConfig('cooldown', parseInt(e.target.value) || undefined)}
              className="input"
              min="0"
              placeholder="0"
            />
          </div>
        </div>
      </div>

      <div className="section">
        <PressureChangesEditor
          value={config.pressureChanges || {}}
          onChange={(v) => updateConfig('pressureChanges', Object.keys(v).length > 0 ? v : undefined)}
          pressures={pressures}
        />
      </div>
    </div>
  );
}
