/**
 * ResolutionTab - Actor resolution configuration
 */

import React from 'react';
import { RESOLUTION_TYPES } from '../constants';
import { ReferenceDropdown } from '../../shared';

export function ResolutionTab({ action, onChange, schema }) {
  const resolution = action.actorResolution || { type: 'self' };

  const updateResolution = (field, value) => {
    onChange({
      ...action,
      actorResolution: { ...resolution, [field]: value },
    });
  };

  const setResolutionType = (type) => {
    if (type === 'self') {
      onChange({ ...action, actorResolution: { type: 'self' } });
    } else {
      onChange({
        ...action,
        actorResolution: {
          type: 'via_relationship',
          relationshipKind: '',
          targetKind: '',
        },
      });
    }
  };

  const relationshipKindOptions = (schema?.relationshipKinds || []).map((rk) => ({
    value: rk.kind,
    label: rk.description || rk.kind,
  }));

  const entityKindOptions = (schema?.entityKinds || []).map((ek) => ({
    value: ek.kind,
    label: ek.kind,
  }));

  const subtypeOptions = (schema?.subtypes || []).map((st) => ({
    value: st,
    label: st,
  }));

  return (
    <div>
      <div className="info-box">
        <div className="info-box-title">Actor Resolution</div>
        <div className="info-box-text">
          How the actor resolves for the action. "Self" means the actor acts directly.
          "Via Relationship" means the actor is resolved through a relationship to another entity.
        </div>
      </div>

      <div className="section">
        <div className="section-title">🔍 Resolution Type</div>
        <div className="flex gap-lg">
          {RESOLUTION_TYPES.map((rt) => {
            const isSelected = resolution.type === rt.value;
            return (
              <div
                key={rt.value}
                className={`item-card cursor-pointer ${isSelected ? 'card-selected' : ''}`}
                style={{
                  padding: '16px',
                  borderColor: isSelected ? 'var(--color-accent)' : undefined,
                  backgroundColor: isSelected ? 'rgba(245, 158, 11, 0.08)' : undefined,
                }}
                onClick={() => setResolutionType(rt.value)}
              >
                <div className="font-semibold mb-xs">{rt.label}</div>
                <div className="text-xs text-muted">{rt.desc}</div>
              </div>
            );
          })}
        </div>
      </div>

      {resolution.type === 'via_relationship' && (
        <div className="section">
          <div className="section-title">🔗 Relationship Configuration</div>
          <div className="form-grid">
            <ReferenceDropdown
              label="Relationship Kind"
              value={resolution.relationshipKind}
              onChange={(v) => updateResolution('relationshipKind', v)}
              options={relationshipKindOptions}
              placeholder="Select relationship..."
            />
            <ReferenceDropdown
              label="Target Kind"
              value={resolution.targetKind}
              onChange={(v) => updateResolution('targetKind', v)}
              options={entityKindOptions}
              placeholder="Select entity kind..."
            />
            <ReferenceDropdown
              label="Require Subtype"
              value={resolution.requireSubtype}
              onChange={(v) => updateResolution('requireSubtype', v)}
              options={subtypeOptions}
              placeholder="Any subtype"
            />
          </div>
        </div>
      )}
    </div>
  );
}
