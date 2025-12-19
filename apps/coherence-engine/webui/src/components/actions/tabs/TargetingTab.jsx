/**
 * TargetingTab - Target selection configuration
 */

import React from 'react';
import { ReferenceDropdown, ChipSelect } from '../../shared';
import { SelectionFiltersEditor } from '../../generators/filters/SelectionFiltersEditor';

export function TargetingTab({ action, onChange, schema }) {
  const targeting = action.targeting || {};

  const updateTargeting = (field, value) => {
    onChange({
      ...action,
      targeting: { ...targeting, [field]: value },
    });
  };

  const entityKindOptions = (schema?.entityKinds || []).map((ek) => ({
    value: ek.kind,
    label: ek.kind,
  }));

  const statusOptions = (schema?.statuses || []).map((s) => ({
    value: s,
    label: s,
  }));

  const subtypeOptions = (schema?.subtypes || []).map((st) => ({
    value: st,
    label: st,
  }));

  // Available refs for selection filters (action context)
  const availableRefs = ['$actor', '$instigator'];

  return (
    <div>
      <div className="info-box">
        <div className="info-box-title">Target Selection</div>
        <div className="info-box-text">
          Define how valid targets are selected for this action.
        </div>
      </div>

      <div className="section">
        <div className="section-title">🎯 Basic Selection</div>
        <div className="form-grid">
          <ReferenceDropdown
            label="Target Kind"
            value={targeting.kind}
            onChange={(v) => updateTargeting('kind', v)}
            options={entityKindOptions}
            placeholder="Select entity kind..."
          />
          <div className="form-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={targeting.selectTwo || false}
                onChange={(e) => updateTargeting('selectTwo', e.target.checked || undefined)}
                className="checkbox"
              />
              Select Two Targets
            </label>
          </div>
          <div className="form-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={targeting.excludeSelf || false}
                onChange={(e) => updateTargeting('excludeSelf', e.target.checked || undefined)}
                className="checkbox"
              />
              Exclude Self
            </label>
          </div>
        </div>

        <div className="mt-xl">
          <ChipSelect
            label="Statuses (optional)"
            value={targeting.statuses || []}
            options={statusOptions}
            onChange={(v) => updateTargeting('statuses', v.length > 0 ? v : undefined)}
            placeholder="Add status..."
          />
        </div>

        <div className="mt-xl">
          <ChipSelect
            label="Subtypes (optional)"
            value={targeting.subtypes || []}
            options={subtypeOptions}
            onChange={(v) => updateTargeting('subtypes', v.length > 0 ? v : undefined)}
            placeholder="Add subtype..."
          />
        </div>
      </div>

      <div className="section">
        <div className="section-title">🔍 Selection Filters</div>
        <div className="section-desc">
          Filter targets by tags, relationships, prominence, culture, and more.
        </div>
        <SelectionFiltersEditor
          filters={targeting.filters || []}
          onChange={(v) => updateTargeting('filters', v.length > 0 ? v : undefined)}
          schema={schema}
          availableRefs={availableRefs}
        />
      </div>
    </div>
  );
}
