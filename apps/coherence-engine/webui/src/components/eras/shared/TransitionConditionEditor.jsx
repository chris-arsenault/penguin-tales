/**
 * TransitionConditionEditor - Editor for era transition conditions
 *
 * Uses shared ItemRow for consistent row styling with era-specific form fields.
 */

import React, { useMemo } from 'react';
import { ItemRow, NumberInput } from '../../shared';
import { CONDITION_TYPES, OPERATORS } from '../constants';

/**
 * @param {Object} props
 * @param {Object} props.condition - The condition object
 * @param {number} props.index - Index in the conditions array
 * @param {Function} props.onChange - Called when condition changes
 * @param {Function} props.onRemove - Called to remove condition
 * @param {Array} props.pressures - Available pressure definitions
 * @param {Object} props.schema - Domain schema
 */
export function TransitionConditionEditor({ condition, index, onChange, onRemove, pressures, schema }) {
  const handleFieldChange = (field, value) => {
    onChange({ ...condition, [field]: value });
  };

  const entityKinds = useMemo(() => {
    return schema?.entityKinds?.map(ek => ({ id: ek.kind, name: ek.description || ek.kind })) || [];
  }, [schema]);

  const subtypes = useMemo(() => {
    if (!condition.entityKind || !schema?.entityKinds) return [];
    const kind = schema.entityKinds.find(ek => ek.kind === condition.entityKind);
    return kind?.subtypes?.map(st => ({ id: st.id, name: st.name || st.id })) || [];
  }, [condition.entityKind, schema]);

  const conditionType = CONDITION_TYPES.find(ct => ct.value === condition.type);

  return (
    <div className="condition-editor">
      <ItemRow
        name={conditionType?.description || 'Condition'}
        onRemove={onRemove}
        removeTitle="Remove condition"
      >
        <select
          value={condition.type}
          onChange={(e) => handleFieldChange('type', e.target.value)}
          className="select select-md"
        >
          {CONDITION_TYPES.map(ct => (
            <option key={ct.value} value={ct.value}>{ct.label}</option>
          ))}
        </select>
      </ItemRow>

      {condition.type === 'time' && (
        <div className="flex items-center gap-md">
          <label className="label-inline">Min Ticks</label>
          <NumberInput
            value={condition.minTicks ?? 50}
            onChange={(v) => handleFieldChange('minTicks', v ?? 0)}
            className="input input-sm"
            min={0}
            integer
          />
          <span className="text-muted text-sm">Era must run at least this many ticks</span>
        </div>
      )}

      {condition.type === 'pressure' && (
        <div className="flex items-center gap-md flex-wrap">
          <select
            value={condition.pressureId || ''}
            onChange={(e) => handleFieldChange('pressureId', e.target.value)}
            className="select select-lg"
          >
            <option value="">Select pressure...</option>
            {pressures.map(p => (
              <option key={p.id} value={p.id}>{p.name || p.id}</option>
            ))}
          </select>
          <select
            value={condition.operator || 'above'}
            onChange={(e) => handleFieldChange('operator', e.target.value)}
            className="select select-sm"
          >
            {OPERATORS.map(op => (
              <option key={op.value} value={op.value}>{op.label}</option>
            ))}
          </select>
          <NumberInput
            value={condition.threshold ?? 50}
            onChange={(v) => handleFieldChange('threshold', v ?? 0)}
            className="input input-xs"
            min={0}
            max={100}
            integer
          />
        </div>
      )}

      {condition.type === 'entity_count' && (
        <div className="flex items-center gap-md flex-wrap">
          <select
            value={condition.entityKind || ''}
            onChange={(e) => handleFieldChange('entityKind', e.target.value)}
            className="select select-md"
          >
            <option value="">Entity kind...</option>
            {entityKinds.map(ek => (
              <option key={ek.id} value={ek.id}>{ek.name}</option>
            ))}
          </select>
          {subtypes.length > 0 && (
            <select
              value={condition.subtype || ''}
              onChange={(e) => handleFieldChange('subtype', e.target.value || undefined)}
              className="select select-md"
            >
              <option value="">Any subtype</option>
              {subtypes.map(st => (
                <option key={st.id} value={st.id}>{st.name}</option>
              ))}
            </select>
          )}
          <select
            value={condition.operator || 'above'}
            onChange={(e) => handleFieldChange('operator', e.target.value)}
            className="select select-sm"
          >
            {OPERATORS.map(op => (
              <option key={op.value} value={op.value}>{op.label}</option>
            ))}
          </select>
          <NumberInput
            value={condition.threshold ?? 10}
            onChange={(v) => handleFieldChange('threshold', v ?? 0)}
            className="input input-xs"
            min={0}
            integer
          />
        </div>
      )}
    </div>
  );
}
