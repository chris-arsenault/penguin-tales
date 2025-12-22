/**
 * VariableSelectionEditor - Edit a VariableSelectionRule
 */

import React from 'react';
import { ReferenceDropdown, ChipSelect, NumberInput } from './index';
import { VARIABLE_PICK_STRATEGIES } from '../generators/constants';
import { SelectionFiltersEditor } from '../generators/filters';

export function VariableSelectionEditor({
  value,
  onChange,
  schema,
  availableRefs = [],
  showPickStrategy = true,
  showMaxResults = true,
  allowPreferFilters = true,
}) {
  const select = value || {};
  const isRelatedMode = select.from && typeof select.from === 'object';
  const fromSpec = isRelatedMode ? select.from : null;

  const entityKindOptions = (schema?.entityKinds || []).map((ek) => ({
    value: ek.kind,
    label: ek.description || ek.kind,
  }));

  const relationshipKindOptions = (schema?.relationshipKinds || []).map((rk) => ({
    value: rk.kind,
    label: rk.description || rk.kind,
  }));

  const getSubtypeOptions = (kind) => {
    const ek = (schema?.entityKinds || []).find((e) => e.kind === kind);
    if (!ek?.subtypes) return [];
    return ek.subtypes.map((st) => ({ value: st.id, label: st.name || st.id }));
  };

  const updateSelect = (field, fieldValue) => {
    onChange({ ...select, [field]: fieldValue });
  };

  const updateSelectMultiple = (updates) => {
    onChange({ ...select, ...updates });
  };

  const setMode = (mode) => {
    if (mode === 'graph') {
      onChange({ ...select, from: 'graph' });
      return;
    }
    const relatedTo = availableRefs[0] || '$target';
    onChange({
      ...select,
      from: { relatedTo, relationship: '', direction: 'both' },
    });
  };

  const updateFrom = (field, fieldValue) => {
    const nextFrom = { ...(fromSpec || { relatedTo: availableRefs[0] || '$target', relationship: '', direction: 'both' }), [field]: fieldValue };
    updateSelect('from', nextFrom);
  };

  return (
    <div>
      <div className="form-grid">
        <ReferenceDropdown
          label="Select From"
          value={isRelatedMode ? 'related' : 'graph'}
          onChange={(v) => setMode(v)}
          options={[
            { value: 'graph', label: 'Graph (by entity kind)' },
            { value: 'related', label: 'Related Entities' },
          ]}
        />

        {!isRelatedMode && (
          <ReferenceDropdown
            label="Entity Kind"
            value={select.kind || ''}
            onChange={(v) => updateSelectMultiple({ kind: v || undefined, subtypes: undefined })}
            options={entityKindOptions}
            placeholder="Any kind"
          />
        )}

        {isRelatedMode && (
          <>
            <ReferenceDropdown
              label="Related To"
              value={fromSpec?.relatedTo || availableRefs[0] || '$target'}
              onChange={(v) => updateFrom('relatedTo', v)}
              options={availableRefs.map((r) => ({ value: r, label: r }))}
              placeholder="Select entity..."
            />
            <ReferenceDropdown
              label="Relationship Kind"
              value={fromSpec?.relationship || ''}
              onChange={(v) => updateFrom('relationship', v)}
              options={relationshipKindOptions}
              placeholder="Select relationship..."
            />
            <ReferenceDropdown
              label="Direction"
              value={fromSpec?.direction || 'both'}
              onChange={(v) => updateFrom('direction', v)}
              options={[
                { value: 'both', label: 'Both' },
                { value: 'src', label: 'Source (outgoing)' },
                { value: 'dst', label: 'Destination (incoming)' },
              ]}
            />
          </>
        )}

        {showPickStrategy && (
          <ReferenceDropdown
            label="Pick Strategy"
            value={select.pickStrategy || ''}
            onChange={(v) => updateSelect('pickStrategy', v || undefined)}
            options={VARIABLE_PICK_STRATEGIES}
            placeholder="Select..."
          />
        )}

        {showMaxResults && (
          <div className="form-group">
            <label className="label">Max Results</label>
            <NumberInput
              value={select.maxResults}
              onChange={(v) => updateSelect('maxResults', v)}
              min={1}
              integer
              allowEmpty
              placeholder="1"
            />
          </div>
        )}
      </div>

      {isRelatedMode && (
        <div style={{ marginTop: '16px' }}>
          <ReferenceDropdown
            label="Filter by Entity Kind (optional)"
            value={select.kind || ''}
            onChange={(v) => updateSelectMultiple({ kind: v || undefined, subtypes: undefined })}
            options={entityKindOptions}
            placeholder="Any kind"
          />
        </div>
      )}

      {select.kind && (
        <div style={{ marginTop: '16px' }}>
          <ChipSelect
            label="Subtypes (optional)"
            value={select.subtypes || []}
            onChange={(v) => updateSelect('subtypes', v.length > 0 ? v : undefined)}
            options={getSubtypeOptions(select.kind)}
            placeholder="Any subtype"
          />
        </div>
      )}

      <div style={{ marginTop: '16px' }}>
        <label className="label">Status Filter (optional)</label>
        <input
          type="text"
          value={select.statusFilter || ''}
          onChange={(e) => updateSelect('statusFilter', e.target.value || undefined)}
          className="input"
          placeholder="e.g., active"
        />
      </div>

      <div style={{ marginTop: '16px' }}>
        <label className="label">Not Status (optional)</label>
        <input
          type="text"
          value={select.notStatus || ''}
          onChange={(e) => updateSelect('notStatus', e.target.value || undefined)}
          className="input"
          placeholder="e.g., dead"
        />
      </div>

      <div style={{ marginTop: '24px' }}>
        <label className="label">Selection Filters</label>
        <div className="info-box-text" style={{ marginBottom: '12px', fontSize: '12px' }}>
          Optional filters to narrow down which entities can be selected. All filters must pass.
        </div>
        <SelectionFiltersEditor
          filters={select.filters}
          onChange={(filters) => updateSelect('filters', filters.length > 0 ? filters : undefined)}
          schema={schema}
          availableRefs={availableRefs}
        />
      </div>

      {allowPreferFilters && (
        <div style={{ marginTop: '24px' }}>
          <label className="label">Prefer Filters (optional)</label>
          <div className="info-box-text" style={{ marginBottom: '12px', fontSize: '12px' }}>
            Preferred matches. If no entities match these filters, selection falls back to all matches.
          </div>
          <SelectionFiltersEditor
            filters={select.preferFilters}
            onChange={(filters) => updateSelect('preferFilters', filters.length > 0 ? filters : undefined)}
            schema={schema}
            availableRefs={availableRefs}
          />
        </div>
      )}
    </div>
  );
}

export default VariableSelectionEditor;
