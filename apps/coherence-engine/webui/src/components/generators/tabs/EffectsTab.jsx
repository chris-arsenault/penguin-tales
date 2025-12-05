/**
 * EffectsTab - Configure state updates (pressure modifications, relationship archiving)
 */

import React from 'react';
import { ReferenceDropdown, AddItemButton } from '../../shared';

/**
 * @param {Object} props
 * @param {Object} props.generator - The generator being edited
 * @param {Function} props.onChange - Callback when generator changes
 * @param {Array} props.pressures - Available pressure definitions
 * @param {Object} props.schema - Domain schema
 */
export function EffectsTab({ generator, onChange, pressures, schema }) {
  const stateUpdates = generator.stateUpdates || [];

  const pressureOptions = (pressures || []).map((p) => ({ value: p.id, label: p.name || p.id }));
  const relationshipKindOptions = (schema?.relationshipKinds || []).map((rk) => ({ value: rk.kind, label: rk.description || rk.kind }));

  const handleAddPressure = () => {
    onChange({
      ...generator,
      stateUpdates: [...stateUpdates, { type: 'modify_pressure', pressureId: pressures?.[0]?.id || '', delta: 0 }],
    });
  };

  const handleAddArchive = () => {
    onChange({
      ...generator,
      stateUpdates: [...stateUpdates, { type: 'archive_relationship', entity: '$target', relationshipKind: '' }],
    });
  };

  const handleUpdate = (index, updated) => {
    const newUpdates = [...stateUpdates];
    newUpdates[index] = updated;
    onChange({ ...generator, stateUpdates: newUpdates });
  };

  const handleRemove = (index) => {
    onChange({ ...generator, stateUpdates: stateUpdates.filter((_, i) => i !== index) });
  };

  const pressureUpdates = stateUpdates.filter((u) => u.type === 'modify_pressure');
  const archiveUpdates = stateUpdates.filter((u) => u.type === 'archive_relationship');

  return (
    <div>
      <div className="section">
        <div className="section-title"><span>🌡️</span> Pressure Modifications</div>
        <div className="section-desc">
          Change pressure values when this generator runs. Positive values increase pressure, negative values decrease it.
        </div>

        {pressureUpdates.map((update) => {
          const globalIdx = stateUpdates.indexOf(update);
          return (
            <div key={globalIdx} className="item-card">
              <div style={{ padding: '16px' }}>
                <div className="form-grid">
                  <ReferenceDropdown
                    label="Pressure"
                    value={update.pressureId}
                    onChange={(v) => handleUpdate(globalIdx, { ...update, pressureId: v })}
                    options={pressureOptions}
                  />
                  <div className="form-group">
                    <label className="label">Delta</label>
                    <input
                      type="number"
                      value={update.delta ?? ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        // Allow empty or minus sign while typing
                        if (val === '' || val === '-') return;
                        const num = parseFloat(val);
                        if (!isNaN(num)) {
                          handleUpdate(globalIdx, { ...update, delta: num });
                        }
                      }}
                      className="input"
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                    <button className="btn-icon btn-icon-danger" onClick={() => handleRemove(globalIdx)}>×</button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        <AddItemButton onClick={handleAddPressure} label="Add Pressure Modification" />
      </div>

      <div className="section">
        <div className="section-title"><span>📦</span> Archive Relationships</div>
        <div className="section-desc">Archive (end) existing relationships when this generator runs.</div>

        {archiveUpdates.map((update) => {
          const globalIdx = stateUpdates.indexOf(update);
          return (
            <div key={globalIdx} className="item-card">
              <div style={{ padding: '16px' }}>
                <div className="form-grid">
                  <div className="form-group">
                    <label className="label">Entity</label>
                    <input
                      type="text"
                      value={update.entity || ''}
                      onChange={(e) => handleUpdate(globalIdx, { ...update, entity: e.target.value })}
                      className="input"
                      placeholder="$target"
                    />
                  </div>
                  <ReferenceDropdown
                    label="Relationship Kind"
                    value={update.relationshipKind}
                    onChange={(v) => handleUpdate(globalIdx, { ...update, relationshipKind: v })}
                    options={relationshipKindOptions}
                  />
                  <div className="form-group">
                    <label className="label">With Entity</label>
                    <input
                      type="text"
                      value={update.with || ''}
                      onChange={(e) => handleUpdate(globalIdx, { ...update, with: e.target.value || undefined })}
                      className="input"
                      placeholder="Optional"
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                    <button className="btn-icon btn-icon-danger" onClick={() => handleRemove(globalIdx)}>×</button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        <AddItemButton onClick={handleAddArchive} label="Add Archive Rule" />
      </div>
    </div>
  );
}

export default EffectsTab;
