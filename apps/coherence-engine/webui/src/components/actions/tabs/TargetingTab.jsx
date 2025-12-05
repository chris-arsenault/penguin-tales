/**
 * TargetingTab - Target selection configuration
 */

import React from 'react';
import { DIRECTIONS } from '../constants';
import { ReferenceDropdown, ChipSelect } from '../../shared';

function ExistingRelationshipEditor({ value, onChange, relationshipKindOptions, showActorRefs = false }) {
  const config = value || {};

  const updateConfig = (field, val) => {
    const newConfig = { ...config, [field]: val };
    if (!val) delete newConfig[field];
    onChange(Object.keys(newConfig).length > 0 ? newConfig : undefined);
  };

  return (
    <div className="form-grid">
      <ReferenceDropdown
        label="Relationship Kind"
        value={config.kind}
        onChange={(v) => updateConfig('kind', v)}
        options={relationshipKindOptions}
        placeholder="Select relationship..."
      />
      <ReferenceDropdown
        label="Direction"
        value={config.direction}
        onChange={(v) => updateConfig('direction', v)}
        options={DIRECTIONS}
        placeholder="Any direction"
      />
      {showActorRefs && (
        <>
          <div className="form-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={config.fromResolvedActor || false}
                onChange={(e) => updateConfig('fromResolvedActor', e.target.checked || undefined)}
                className="checkbox"
              />
              From Resolved Actor
            </label>
          </div>
          <div className="form-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={config.toActor || false}
                onChange={(e) => updateConfig('toActor', e.target.checked || undefined)}
                className="checkbox"
              />
              To Actor
            </label>
          </div>
        </>
      )}
    </div>
  );
}

function AdjacentToEditor({ value, onChange, relationshipKindOptions }) {
  const config = value || {};

  const updateConfig = (field, val) => {
    const newConfig = { ...config, [field]: val };
    if (!val) delete newConfig[field];
    onChange(Object.keys(newConfig).length > 0 ? newConfig : undefined);
  };

  return (
    <div className="form-grid">
      <ReferenceDropdown
        label="Relationship Kind"
        value={config.relationshipKind}
        onChange={(v) => updateConfig('relationshipKind', v)}
        options={relationshipKindOptions}
        placeholder="e.g., adjacent_to"
      />
      <div className="form-group">
        <label className="label">Actor Controls Via</label>
        <input
          type="text"
          value={config.actorControlsVia || ''}
          onChange={(e) => updateConfig('actorControlsVia', e.target.value || undefined)}
          className="input"
          placeholder="e.g., controls"
        />
      </div>
      <div className="form-group">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={config.toResolvedActor || false}
            onChange={(e) => updateConfig('toResolvedActor', e.target.checked || undefined)}
            className="checkbox"
          />
          To Resolved Actor
        </label>
      </div>
    </div>
  );
}

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

  const relationshipKindOptions = (schema?.relationshipKinds || []).map((rk) => ({
    value: rk.kind,
    label: rk.description || rk.kind,
  }));

  const subtypeOptions = (schema?.subtypes || []).map((st) => ({
    value: st,
    label: st,
  }));

  // Exclude config
  const exclude = targeting.exclude || {};
  const updateExclude = (field, value) => {
    const newExclude = { ...exclude, [field]: value };
    if (!value || (typeof value === 'object' && Object.keys(value).length === 0)) {
      delete newExclude[field];
    }
    updateTargeting('exclude', Object.keys(newExclude).length > 0 ? newExclude : undefined);
  };

  // Require config
  const require = targeting.require || {};
  const updateRequire = (field, value) => {
    const newRequire = { ...require, [field]: value };
    if (!value || (typeof value === 'object' && Object.keys(value).length === 0)) {
      delete newRequire[field];
    }
    updateTargeting('require', Object.keys(newRequire).length > 0 ? newRequire : undefined);
  };

  return (
    <div>
      <div className="info-box">
        <div className="info-box-title">Target Selection</div>
        <div className="info-box-text">
          Define how valid targets are selected for this action. Targets must match kind, status,
          and other filters.
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
        <div className="section-title">🚫 Exclusion Filter</div>
        <div className="section-desc">
          Exclude targets that have certain existing relationships.
        </div>
        <ExistingRelationshipEditor
          value={exclude.existingRelationship}
          onChange={(v) => updateExclude('existingRelationship', v)}
          relationshipKindOptions={relationshipKindOptions}
        />
      </div>

      <div className="section">
        <div className="section-title">✓ Requirements</div>
        <div className="section-desc">
          Requirements that targets must satisfy.
        </div>

        <div className="item-card">
          <div className="item-card-header">
            <div className="item-card-title">Has Relationship</div>
          </div>
          <div className="item-card-body">
            <ExistingRelationshipEditor
              value={require.hasRelationship}
              onChange={(v) => updateRequire('hasRelationship', v)}
              relationshipKindOptions={relationshipKindOptions}
              showActorRefs
            />
          </div>
        </div>

        <div className="item-card">
          <div className="item-card-header">
            <div className="item-card-title">Adjacent To</div>
          </div>
          <div className="item-card-body">
            <AdjacentToEditor
              value={require.adjacentTo}
              onChange={(v) => updateRequire('adjacentTo', v)}
              relationshipKindOptions={relationshipKindOptions}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
