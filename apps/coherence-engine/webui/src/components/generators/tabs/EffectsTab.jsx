/**
 * EffectsTab - Configure state updates (pressure modifications, tags, status changes, etc.)
 *
 * Supports all 6 stateUpdate types:
 * - modify_pressure: Change pressure values
 * - archive_relationship: End existing relationships
 * - update_entity_status: Change entity status
 * - set_tag: Add/update tags on entities
 * - remove_tag: Remove tags from entities
 * - update_rate_limit: Track template execution for rate limiting
 */

import React, { useMemo } from 'react';
import { ReferenceDropdown, AddItemButton, NumberInput } from '../../shared';
import TagSelector from '@lore-weave/shared-components/TagSelector';

// All supported stateUpdate types
const STATE_UPDATE_TYPES = [
  { value: 'modify_pressure', label: 'Modify Pressure', icon: '🌡️' },
  { value: 'archive_relationship', label: 'Archive Relationship', icon: '📦' },
  { value: 'update_entity_status', label: 'Update Status', icon: '🔄' },
  { value: 'set_tag', label: 'Set Tag', icon: '🏷️' },
  { value: 'remove_tag', label: 'Remove Tag', icon: '🗑️' },
  { value: 'update_rate_limit', label: 'Update Rate Limit', icon: '⏱️' },
];

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
  const tagRegistry = schema?.tagRegistry || [];

  // Build entity kind options for status updates
  const entityKinds = schema?.entityKinds || [];
  const entityKindOptions = entityKinds.map((ek) => ({ value: ek.kind, label: ek.kind }));

  // Get status options for a specific entity kind
  const getStatusOptionsForKind = (entityKind) => {
    const ek = entityKinds.find(e => e.kind === entityKind);
    if (!ek?.statusValues?.length) return [];
    return ek.statusValues.map(status => ({ value: status, label: status }));
  };

  // Build available entity references from target + variables + created entities
  const availableRefs = useMemo(() => {
    const refs = ['$target'];
    Object.keys(generator.variables || {}).forEach((v) => refs.push(v));
    (generator.creation || []).forEach((c) => { if (c.entityRef) refs.push(c.entityRef); });
    return refs;
  }, [generator.variables, generator.creation]);

  const entityRefOptions = availableRefs.map((r) => ({ value: r, label: r }));

  const handleAdd = (type) => {
    let newUpdate;
    switch (type) {
      case 'modify_pressure':
        newUpdate = { type: 'modify_pressure', pressureId: pressures?.[0]?.id || '', delta: 0 };
        break;
      case 'archive_relationship':
        newUpdate = { type: 'archive_relationship', entity: '$target', relationshipKind: '', with: 'any', direction: 'any' };
        break;
      case 'update_entity_status':
        newUpdate = { type: 'update_entity_status', entity: '$target', entityKind: entityKinds[0]?.kind || '', newStatus: '' };
        break;
      case 'set_tag':
        newUpdate = { type: 'set_tag', entity: '$target', tag: '', value: true };
        break;
      case 'remove_tag':
        newUpdate = { type: 'remove_tag', entity: '$target', tag: '' };
        break;
      case 'update_rate_limit':
        newUpdate = { type: 'update_rate_limit' };
        break;
      default:
        return;
    }
    onChange({ ...generator, stateUpdates: [...stateUpdates, newUpdate] });
  };

  const handleUpdate = (index, updated) => {
    const newUpdates = [...stateUpdates];
    newUpdates[index] = updated;
    onChange({ ...generator, stateUpdates: newUpdates });
  };

  const handleRemove = (index) => {
    onChange({ ...generator, stateUpdates: stateUpdates.filter((_, i) => i !== index) });
  };

  // Known stateUpdate types
  const KNOWN_TYPES = new Set([
    'modify_pressure',
    'archive_relationship',
    'update_entity_status',
    'set_tag',
    'remove_tag',
    'update_rate_limit',
  ]);

  // Group updates by type for display
  const pressureUpdates = stateUpdates.filter((u) => u.type === 'modify_pressure');
  const archiveUpdates = stateUpdates.filter((u) => u.type === 'archive_relationship');
  const statusUpdates = stateUpdates.filter((u) => u.type === 'update_entity_status');
  const setTagUpdates = stateUpdates.filter((u) => u.type === 'set_tag');
  const removeTagUpdates = stateUpdates.filter((u) => u.type === 'remove_tag');
  const rateLimitUpdates = stateUpdates.filter((u) => u.type === 'update_rate_limit');

  // Catch any unrecognized types
  const unrecognizedUpdates = stateUpdates.filter((u) => !KNOWN_TYPES.has(u.type));

  return (
    <div>
      {/* Unrecognized Effects - shown first to draw attention */}
      {unrecognizedUpdates.length > 0 && (
        <div className="section" style={{ backgroundColor: 'rgba(248, 113, 113, 0.1)', borderRadius: '8px', padding: '16px', marginBottom: '24px' }}>
          <div className="section-title" style={{ color: '#f87171' }}><span>⚠️</span> Unrecognized Effects</div>
          <div className="section-desc" style={{ marginBottom: '12px' }}>
            These state updates have unrecognized types and may be from an older version.
            Remove them to clear validation errors.
          </div>

          {unrecognizedUpdates.map((update) => {
            const globalIdx = stateUpdates.indexOf(update);
            return (
              <div key={globalIdx} className="item-card" style={{ borderColor: 'rgba(248, 113, 113, 0.4)' }}>
                <div style={{ padding: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, marginBottom: '8px', color: '#f87171' }}>
                        Unknown type: "{update.type || '(no type)'}"
                      </div>
                      <pre style={{
                        fontSize: '11px',
                        backgroundColor: 'rgba(0,0,0,0.2)',
                        padding: '8px',
                        borderRadius: '4px',
                        overflow: 'auto',
                        margin: 0,
                      }}>
                        {JSON.stringify(update, null, 2)}
                      </pre>
                    </div>
                    <button
                      className="btn btn-danger"
                      onClick={() => handleRemove(globalIdx)}
                      style={{ flexShrink: 0 }}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pressure Modifications */}
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
                <div className="form-row-with-delete">
                  <div className="form-row-fields">
                    <ReferenceDropdown
                      label="Pressure"
                      value={update.pressureId}
                      onChange={(v) => handleUpdate(globalIdx, { ...update, pressureId: v })}
                      options={pressureOptions}
                    />
                    <div className="form-group">
                      <label className="label">Delta</label>
                      <NumberInput
                        value={update.delta}
                        onChange={(v) => handleUpdate(globalIdx, { ...update, delta: v })}
                      />
                    </div>
                  </div>
                  <button className="btn-icon btn-icon-danger" onClick={() => handleRemove(globalIdx)}>×</button>
                </div>
              </div>
            </div>
          );
        })}

        <AddItemButton onClick={() => handleAdd('modify_pressure')} label="Add Pressure Modification" />
      </div>

      {/* Archive Relationships */}
      <div className="section">
        <div className="section-title"><span>📦</span> Archive Relationships</div>
        <div className="section-desc">Archive (end) existing relationships when this generator runs.</div>

        {archiveUpdates.map((update) => {
          const globalIdx = stateUpdates.indexOf(update);
          const isAnyWith = update.with === 'any';
          const withOptions = [
            { value: 'any', label: '(Any - archive all of this kind)' },
            ...entityRefOptions
          ];
          const directionOptions = [
            { value: 'any', label: 'Any direction' },
            { value: 'src', label: 'Entity is source (outgoing)' },
            { value: 'dst', label: 'Entity is destination (incoming)' },
          ];
          return (
            <div key={globalIdx} className="item-card">
              <div style={{ padding: '16px' }}>
                <div className="form-row-with-delete">
                  <div className="form-row-fields">
                    <ReferenceDropdown
                      label="Entity"
                      value={update.entity || '$target'}
                      onChange={(v) => handleUpdate(globalIdx, { ...update, entity: v })}
                      options={entityRefOptions}
                    />
                    <ReferenceDropdown
                      label="Relationship Kind"
                      value={update.relationshipKind}
                      onChange={(v) => handleUpdate(globalIdx, { ...update, relationshipKind: v })}
                      options={relationshipKindOptions}
                    />
                    <ReferenceDropdown
                      label="With Entity"
                      value={update.with || 'any'}
                      onChange={(v) => {
                        const newUpdate = { ...update, with: v };
                        // Add direction when switching to "any", remove when switching to specific
                        if (v === 'any') {
                          newUpdate.direction = update.direction || 'any';
                        } else {
                          delete newUpdate.direction;
                        }
                        handleUpdate(globalIdx, newUpdate);
                      }}
                      options={withOptions}
                    />
                    {isAnyWith && (
                      <ReferenceDropdown
                        label="Direction"
                        value={update.direction || 'any'}
                        onChange={(v) => handleUpdate(globalIdx, { ...update, direction: v })}
                        options={directionOptions}
                      />
                    )}
                  </div>
                  <button className="btn-icon btn-icon-danger" onClick={() => handleRemove(globalIdx)}>×</button>
                </div>
              </div>
            </div>
          );
        })}

        <AddItemButton onClick={() => handleAdd('archive_relationship')} label="Add Archive Rule" />
      </div>

      {/* Update Entity Status */}
      <div className="section">
        <div className="section-title"><span>🔄</span> Update Entity Status</div>
        <div className="section-desc">Change the status of entities when this generator runs.</div>

        {statusUpdates.map((update) => {
          const globalIdx = stateUpdates.indexOf(update);
          const statusOptionsForKind = getStatusOptionsForKind(update.entityKind);
          return (
            <div key={globalIdx} className="item-card">
              <div style={{ padding: '16px' }}>
                <div className="form-row-with-delete">
                  <div className="form-row-fields">
                    <ReferenceDropdown
                      label="Entity Reference"
                      value={update.entity || '$target'}
                      onChange={(v) => handleUpdate(globalIdx, { ...update, entity: v })}
                      options={entityRefOptions}
                    />
                    <ReferenceDropdown
                      label="Entity Kind"
                      value={update.entityKind || ''}
                      onChange={(v) => handleUpdate(globalIdx, { ...update, entityKind: v, newStatus: '' })}
                      options={entityKindOptions}
                      placeholder="Select entity kind..."
                    />
                    {statusOptionsForKind.length > 0 ? (
                      <ReferenceDropdown
                        label="New Status"
                        value={update.newStatus || ''}
                        onChange={(v) => handleUpdate(globalIdx, { ...update, newStatus: v })}
                        options={statusOptionsForKind}
                        placeholder="Select status..."
                      />
                    ) : (
                      <div className="form-group">
                        <label className="label">New Status</label>
                        <div className="input" style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
                          {update.entityKind ? 'No statuses defined for this kind' : 'Select entity kind first'}
                        </div>
                      </div>
                    )}
                  </div>
                  <button className="btn-icon btn-icon-danger" onClick={() => handleRemove(globalIdx)}>×</button>
                </div>
              </div>
            </div>
          );
        })}

        <AddItemButton onClick={() => handleAdd('update_entity_status')} label="Add Status Update" />
      </div>

      {/* Set Tags */}
      <div className="section">
        <div className="section-title"><span>🏷️</span> Set Tags</div>
        <div className="section-desc">Add or update tags on entities when this generator runs.</div>

        {setTagUpdates.map((update) => {
          const globalIdx = stateUpdates.indexOf(update);
          return (
            <div key={globalIdx} className="item-card">
              <div style={{ padding: '16px' }}>
                <div className="form-row-with-delete">
                  <div className="form-row-fields">
                    <ReferenceDropdown
                      label="Entity"
                      value={update.entity || '$target'}
                      onChange={(v) => handleUpdate(globalIdx, { ...update, entity: v })}
                      options={entityRefOptions}
                    />
                    <div className="form-group">
                      <label className="label">Tag</label>
                      <TagSelector
                        value={update.tag ? [update.tag] : []}
                        onChange={(tags) => handleUpdate(globalIdx, { ...update, tag: tags[0] || '' })}
                        tagRegistry={tagRegistry}
                        placeholder="Select tag..."
                        singleSelect
                      />
                    </div>
                    <div className="form-group">
                      <label className="label">Value</label>
                      <input
                        type="text"
                        value={update.value === true ? 'true' : update.value === false ? 'false' : (update.value || '')}
                        onChange={(e) => {
                          const val = e.target.value;
                          let parsed = val;
                          if (val === 'true') parsed = true;
                          else if (val === 'false') parsed = false;
                          handleUpdate(globalIdx, { ...update, value: parsed });
                        }}
                        className="input"
                        placeholder="true"
                      />
                    </div>
                  </div>
                  <button className="btn-icon btn-icon-danger" onClick={() => handleRemove(globalIdx)}>×</button>
                </div>
              </div>
            </div>
          );
        })}

        <AddItemButton onClick={() => handleAdd('set_tag')} label="Add Set Tag" />
      </div>

      {/* Remove Tags */}
      <div className="section">
        <div className="section-title"><span>🗑️</span> Remove Tags</div>
        <div className="section-desc">Remove tags from entities when this generator runs.</div>

        {removeTagUpdates.map((update) => {
          const globalIdx = stateUpdates.indexOf(update);
          return (
            <div key={globalIdx} className="item-card">
              <div style={{ padding: '16px' }}>
                <div className="form-row-with-delete">
                  <div className="form-row-fields">
                    <ReferenceDropdown
                      label="Entity"
                      value={update.entity || '$target'}
                      onChange={(v) => handleUpdate(globalIdx, { ...update, entity: v })}
                      options={entityRefOptions}
                    />
                    <div className="form-group">
                      <label className="label">Tag</label>
                      <TagSelector
                        value={update.tag ? [update.tag] : []}
                        onChange={(tags) => handleUpdate(globalIdx, { ...update, tag: tags[0] || '' })}
                        tagRegistry={tagRegistry}
                        placeholder="Select tag..."
                        singleSelect
                      />
                    </div>
                  </div>
                  <button className="btn-icon btn-icon-danger" onClick={() => handleRemove(globalIdx)}>×</button>
                </div>
              </div>
            </div>
          );
        })}

        <AddItemButton onClick={() => handleAdd('remove_tag')} label="Add Remove Tag" />
      </div>

      {/* Rate Limit Updates */}
      <div className="section">
        <div className="section-title"><span>⏱️</span> Rate Limit Tracking</div>
        <div className="section-desc">
          Track template execution for rate limiting. Used with creations_per_epoch applicability rules.
        </div>

        {rateLimitUpdates.map((update) => {
          const globalIdx = stateUpdates.indexOf(update);
          return (
            <div key={globalIdx} className="item-card">
              <div style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-muted)' }}>Updates rate limit counter when this generator runs</span>
                <button className="btn-icon btn-icon-danger" onClick={() => handleRemove(globalIdx)}>×</button>
              </div>
            </div>
          );
        })}

        <AddItemButton onClick={() => handleAdd('update_rate_limit')} label="Add Rate Limit Tracking" />
      </div>
    </div>
  );
}

export default EffectsTab;
