/**
 * TargetTab - Configure the primary target selection ($target)
 */

import React from 'react';
import { PICK_STRATEGIES } from '../constants';
import { ReferenceDropdown, ChipSelect } from '../../shared';
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
      </div>
    </div>
  );
}

export default TargetTab;
