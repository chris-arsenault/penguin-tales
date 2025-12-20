/**
 * TargetTab - Configure the primary target selection ($target)
 */

import React from 'react';
import { PICK_STRATEGIES } from '../constants';
import { ReferenceDropdown, ChipSelect, PROMINENCE_LEVELS, NumberInput } from '../../shared';
import { SelectionFiltersEditor } from '../filters';

/**
 * @param {Object} props
 * @param {Object} props.generator - The generator being edited
 * @param {Function} props.onChange - Callback when generator changes
 * @param {Object} props.schema - Domain schema with entity/relationship kinds
 */
export function TargetTab({ generator, onChange, schema }) {
  const selection = generator.selection || {};

  const entityKindOptions = (schema?.entityKinds || []).map((ek) => ({
    value: ek.kind,
    label: ek.description || ek.kind,
  }));

  const getSubtypeOptions = (kind) => {
    const ek = (schema?.entityKinds || []).find((e) => e.kind === kind);
    if (!ek?.subtypes) return [];
    return ek.subtypes.map((st) => ({ value: st.id, label: st.name || st.id }));
  };

  const updateSelection = (field, value) => {
    onChange({ ...generator, selection: { ...selection, [field]: value } });
  };

  // Get the kind of the first created entity for saturation limit inference
  const firstCreatedKind = (generator.creation || [])[0]?.kind;

  return (
    <div>
      <div className="section">
        <div className="section-title">Target Selection</div>

        <div className="info-box">
          <div className="info-box-title">What is $target?</div>
          <div className="info-box-text">
            The <code className="inline-code">$target</code> is the primary entity this generator operates on.
            It's selected from the world graph based on the rules you define here. Once selected, you can reference
            it in creation rules (e.g., inherit culture from $target) and relationships (e.g., connect new entity to $target).
          </div>
        </div>

        <div className="form-grid">
          <ReferenceDropdown
            label="Selection Strategy"
            value={selection.strategy || 'by_kind'}
            onChange={(v) => updateSelection('strategy', v)}
            options={[
              { value: 'by_kind', label: 'By Entity Kind' },
              { value: 'by_relationship', label: 'By Relationship' },
            ]}
          />
          <ReferenceDropdown
            label="Pick Strategy"
            value={selection.pickStrategy || 'random'}
            onChange={(v) => updateSelection('pickStrategy', v)}
            options={PICK_STRATEGIES}
          />
          <ReferenceDropdown
            label="Min Prominence"
            value={selection.minProminence || ''}
            onChange={(v) => updateSelection('minProminence', v || undefined)}
            options={PROMINENCE_LEVELS.map((p) => ({ value: p.value, label: p.label }))}
            placeholder="Any prominence"
          />
        </div>

        <div style={{ marginTop: '16px' }}>
          <div className="form-grid">
            {selection.strategy !== 'by_relationship' && (
              <>
                <ReferenceDropdown
                  label="Entity Kind"
                  value={selection.kind}
                  onChange={(v) => {
                    onChange({ ...generator, selection: { ...selection, kind: v, subtypes: undefined } });
                  }}
                  options={entityKindOptions}
                  placeholder="Select entity kind..."
                />
                {selection.kind && (
                  <ChipSelect
                    label="Subtypes (optional)"
                    value={selection.subtypes || []}
                    onChange={(v) => updateSelection('subtypes', v.length > 0 ? v : undefined)}
                    options={getSubtypeOptions(selection.kind)}
                    placeholder="Any subtype"
                  />
                )}
              </>
            )}
            {selection.strategy === 'by_relationship' && (
              <>
                <ReferenceDropdown
                  label="Relationship Kind"
                  value={selection.relationshipKind}
                  onChange={(v) => updateSelection('relationshipKind', v)}
                  options={(schema?.relationshipKinds || []).map((rk) => ({
                    value: rk.kind,
                    label: rk.description || rk.kind,
                  }))}
                  placeholder="Select relationship kind..."
                />
                <ReferenceDropdown
                  label="Direction"
                  value={selection.direction || 'any'}
                  onChange={(v) => updateSelection('direction', v)}
                  options={[
                    { value: 'any', label: 'Any direction' },
                    { value: 'outgoing', label: 'Outgoing (source)' },
                    { value: 'incoming', label: 'Incoming (target)' },
                  ]}
                />
              </>
            )}
          </div>
        </div>

        {/* Selection Filters */}
        <div style={{ marginTop: '24px' }}>
          <label className="label">Selection Filters</label>
          <div className="info-box-text" style={{ marginBottom: '12px', fontSize: '12px' }}>
            Optional filters to narrow down which entities can be selected as the target.
            All filters must pass for an entity to be selected.
          </div>
          <SelectionFiltersEditor
            filters={selection.filters}
            onChange={(filters) => updateSelection('filters', filters.length > 0 ? filters : undefined)}
            schema={schema}
            availableRefs={['$target', ...(Object.keys(generator.variables || {}))]}
          />
        </div>

        {/* Saturation Limits */}
        <div style={{ marginTop: '24px' }}>
          <label className="label">Saturation Limits</label>
          <div className="info-box-text" style={{ marginBottom: '12px', fontSize: '12px' }}>
            Limit targets based on existing relationship counts. Only targets with fewer than
            the max count of relationships will be selected.
          </div>
          <SaturationLimitsEditor
            limits={selection.saturationLimits || []}
            onChange={(limits) => updateSelection('saturationLimits', limits.length > 0 ? limits : undefined)}
            schema={schema}
            createdKind={firstCreatedKind}
          />
        </div>
      </div>
    </div>
  );
}

/**
 * Editor for saturation limits (simplified: just relationship kind + max count)
 * fromKind is auto-inferred from first creation entry, direction is always 'any'
 */
function SaturationLimitsEditor({ limits, onChange, schema, createdKind }) {
  const relationshipKindOptions = (schema?.relationshipKinds || []).map((rk) => ({
    value: rk.kind,
    label: rk.description || rk.kind,
  }));

  const addLimit = () => {
    // Auto-populate fromKind from the first created entity kind
    onChange([...limits, { relationshipKind: '', maxCount: 2, fromKind: createdKind }]);
  };

  const updateLimit = (index, field, value) => {
    const updated = [...limits];
    updated[index] = { ...updated[index], [field]: value };
    // Remove undefined/empty values
    if (value === undefined || value === '') {
      delete updated[index][field];
    }
    // Always ensure fromKind is set to the created kind
    if (!updated[index].fromKind && createdKind) {
      updated[index].fromKind = createdKind;
    }
    onChange(updated);
  };

  const removeLimit = (index) => {
    onChange(limits.filter((_, i) => i !== index));
  };

  const getRelationshipLabel = (kind) => {
    const rk = relationshipKindOptions.find(r => r.value === kind);
    return rk?.label || kind || '?';
  };

  if (limits.length === 0) {
    return (
      <button className="btn-add" onClick={addLimit}>
        + Add Saturation Limit
      </button>
    );
  }

  return (
    <div>
      {limits.map((limit, index) => (
        <div key={index} className="item-card">
          <div className="item-card-header">
            <div className="rel-visual">
              <span className="text-small">
                <span className="rel-kind">{getRelationshipLabel(limit.relationshipKind)}</span>
                {' < '}{limit.maxCount || '?'}
              </span>
            </div>
            <button className="btn-icon btn-icon-danger" onClick={() => removeLimit(index)}>×</button>
          </div>
          <div className="item-card-body">
            <div className="form-grid">
              <ReferenceDropdown
                label="Relationship Kind"
                value={limit.relationshipKind || ''}
                onChange={(v) => updateLimit(index, 'relationshipKind', v)}
                options={relationshipKindOptions}
                placeholder="Select relationship..."
              />
              <div className="form-group">
                <label className="label">Max Count</label>
                <NumberInput
                  value={limit.maxCount}
                  onChange={(v) => updateLimit(index, 'maxCount', v ?? 2)}
                  min={0}
                  integer
                  placeholder="2"
                />
              </div>
            </div>
          </div>
        </div>
      ))}
      <button className="btn-add" onClick={addLimit}>
        + Add Saturation Limit
      </button>
    </div>
  );
}

export default TargetTab;
